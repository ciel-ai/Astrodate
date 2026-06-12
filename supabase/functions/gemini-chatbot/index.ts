import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ChatHistoryItem = {
  role?: string;
  content?: string;
};

type GeminiRequestBody = {
  message?: unknown;
  conversationHistory?: unknown;
};

type GeminiApiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

Deno.serve(async (req: Request) => {
  // 1. Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 2. Validate request body
    const body = await req.json() as GeminiRequestBody;
    const { message, conversationHistory } = body || {};

    // Basic payload validation to prevent abuse
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Limit message length and conversation history to prevent oversized payloads
    const MAX_MESSAGE_LENGTH = 5000; // characters
    const MAX_HISTORY = 12; // messages
    const MAX_HISTORY_MESSAGE_LENGTH = 2000;

    if (message.length > MAX_MESSAGE_LENGTH) {
      return new Response(JSON.stringify({ error: 'Message too long' }), { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (conversationHistory && Array.isArray(conversationHistory) && conversationHistory.length > MAX_HISTORY) {
      return new Response(JSON.stringify({ error: 'Conversation history too long' }), { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (conversationHistory && Array.isArray(conversationHistory)) {
      for (const m of conversationHistory as ChatHistoryItem[]) {
        if (typeof m.content !== 'string') continue;
        if (m.content.length > MAX_HISTORY_MESSAGE_LENGTH) {
          return new Response(JSON.stringify({ error: 'Conversation history message too long' }), { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }
    }

    // 2a. Authenticate: require Authorization: Bearer <jwt>
    const authHeader = req.headers.get('authorization') || '';
    const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!tokenMatch) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const jwt = tokenMatch[1];

    // Validate token with Supabase Auth endpoint
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    if (!SUPABASE_URL) {
      console.error('Missing SUPABASE_URL env');
      return new Response(JSON.stringify({ success: false, error: 'Server misconfiguration' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const userResp = await fetch(`${SUPABASE_URL.replace(/\/+$/, '')}/auth/v1/user`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${jwt}` },
    });

    if (!userResp.ok) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const userJson = await userResp.json();
    const userId = userJson?.id;
    if (!userId) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 2b. Enforce per-user daily quota via RPC using service role key
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SERVICE_ROLE) {
      console.error('Missing SUPABASE_SERVICE_ROLE_KEY env');
      return new Response(JSON.stringify({ success: false, error: 'Server misconfiguration' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Call RPC to increment usage atomically and enforce limit
    try {
      const rpcResp = await fetch(`${SUPABASE_URL.replace(/\/+$/, '')}/rpc/increment_ai_usage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_ROLE}`,
          'Accept': 'application/json',
        },
        body: JSON.stringify({ p_user: userId, p_endpoint: 'gemini-chatbot', p_limit: 20 }),
      });

      if (!rpcResp.ok) {
        console.error('RPC increment_ai_usage failed', await rpcResp.text());
        return new Response(JSON.stringify({ success: false, error: 'Rate limit check failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const rpcJson = await rpcResp.json();
      // RPC returns a boolean or an array with a boolean; normalize
      const allowed = Array.isArray(rpcJson) ? rpcJson[0] === true : rpcJson === true || rpcJson === 't' || rpcJson === 1;
      if (!allowed) {
        return new Response(JSON.stringify({ success: false, error: 'Daily AI limit reached. Try again tomorrow.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    } catch (e) {
      console.error('Error calling increment_ai_usage RPC', e);
      return new Response(JSON.stringify({ success: false, error: 'Rate limit check failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 3. Validate environment variable.
    // SEC-06: Only read GEMINI_API_KEY — the EXPO_PUBLIC_ prefix is exclusively
    // for client-side Expo bundles and must never appear in Supabase Edge Function
    // secrets. If your secret was previously set as EXPO_PUBLIC_GEMINI_API_KEY,
    // re-add it in the Supabase dashboard under the correct name: GEMINI_API_KEY.
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

    if (!GEMINI_API_KEY) {
      throw new Error("Missing Gemini API key in environment");
    }

    // 4. Timeout protection for the external API call (15 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    // 5. Call external API securely
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            ...(Array.isArray(conversationHistory) ? conversationHistory as ChatHistoryItem[] : []).map((m) => ({
              role: m.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: m.content || '' }],
            })),
            { role: 'user', parts: [{ text: message }] },
          ],
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Gemini API error:", res.status, errorText);
      throw new Error(`External API returned status ${res.status}`);
    }

    const data = await res.json() as GeminiApiResponse;
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || "I'm sorry, I couldn't generate a response.";

    // 6. Return response preserving exact existing format expected by frontend
    return new Response(
      JSON.stringify({ success: true, message: reply }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Function error:", error);

    // Check if it was an abort/timeout error
    const isTimeout = error instanceof DOMException && error.name === "AbortError";
    const errorMessage = isTimeout ? "Request timed out" : (error instanceof Error ? error.message : "Internal server error");

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: isTimeout ? 504 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});