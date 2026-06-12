import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("EXPO_PUBLIC_GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing Gemini API key" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const payload = await req.json();
    const { action, base64Image, base64Image1, base64Image2, base64Images } = payload;

    const controller = new AbortController();
    // 20s timeout for vision models which take slightly longer
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const callGemini = async (prompt: string, imagesBase64: string[]) => {
      const contents = [
        {
          role: "user",
          parts: [
            ...imagesBase64.map(b64 => ({
              inlineData: { mimeType: "image/jpeg", data: b64 }
            })),
            { text: prompt }
          ]
        }
      ];

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          generationConfig: {
            responseMimeType: "application/json",
          }
        }),
        signal: controller.signal
      });

      if (!res.ok) {
        throw new Error(`Gemini API error: ${res.status} ${await res.text()}`);
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
          throw new Error('No response from Gemini API');
      }
      return JSON.parse(text);
    };

    let result = {};

    if (action === 'detect') {
      const prompt = `Analyze this image and return a JSON object with these exact keys: "success" (boolean), "hasFace" (boolean if at least 1 human face is clearly visible), and "faceCount" (integer number of human faces).`;
      const aiRes = await callGemini(prompt, [base64Image]);
      result = {
        success: aiRes.success ?? true,
        hasFace: aiRes.hasFace ?? false,
        faceCount: aiRes.faceCount ?? 0,
      };
    } else if (action === 'verify') {
      const prompt = `Compare these two images and return a JSON object with these exact keys: "success" (boolean), "isSamePerson" (boolean if the two images show the face of the exact same person), and "confidence" (number between 0 and 1 indicating certainty).`;
      const aiRes = await callGemini(prompt, [base64Image1, base64Image2]);
      result = {
        success: aiRes.success ?? true,
        isSamePerson: aiRes.isSamePerson ?? false,
        confidence: aiRes.confidence ?? 0,
      };
    } else if (action === 'verifyAll') {
      const prompt = `Analyze all these images and return a JSON object with these exact keys: "success" (boolean), "allHaveFaces" (boolean if EVERY image has a clearly visible human face), "allSamePerson" (boolean if ALL images show the exact same person), and "errors" (array of strings, empty if all good).`;
      const aiRes = await callGemini(prompt, base64Images);
      result = {
        success: aiRes.success ?? true,
        allHaveFaces: aiRes.allHaveFaces ?? false,
        allSamePerson: aiRes.allSamePerson ?? false,
        faceEmbeddings: new Array(base64Images.length).fill(null), // backward compatibility
        errors: aiRes.errors ?? [],
      };
    } else {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    clearTimeout(timeoutId);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: unknown) {
    const isTimeout = error instanceof DOMException && error.name === "AbortError";
    const errorMessage = isTimeout ? "Request timed out" : (error instanceof Error ? error.message : "Internal server error");

    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: isTimeout ? 504 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});