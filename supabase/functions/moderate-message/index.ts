// supabase/functions/moderate-message/index.ts
// Classifies a chat message using Gemini before it is stored.
// Returns: { status: 'SAFE' | 'SPAM' | 'HARASSMENT' | 'ILLEGAL' }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Gemini model to use — flash is faster and cheaper for short classification tasks
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SYSTEM_PROMPT = `You are a content moderation classifier for a dating app. 
Classify the user's message into exactly ONE of these four categories:

SAFE        – Normal conversation, greetings, questions, compliments, general chat.
SPAM        – Promotional content, links, solicitations, repeated identical messages, advertisements.
HARASSMENT  – Insults, threats, sexual harassment, hate speech, bullying, unwanted explicit content.
ILLEGAL     – Content facilitating or describing illegal activities (drug dealing, violence solicitation, CSAM, fraud, etc.)

Rules:
- Respond with ONLY the single category word. No explanation, no punctuation, no extra text.
- When in doubt between SAFE and SPAM, return SPAM.
- When in doubt between HARASSMENT and ILLEGAL, return HARASSMENT.
- Short messages like "hi", "hello", "how are you" are always SAFE.
- Mildly flirtatious language is SAFE unless it becomes explicitly sexual or threatening.`;

type ModerationStatus = 'SAFE' | 'SPAM' | 'HARASSMENT' | 'ILLEGAL';
const VALID_STATUSES = new Set<ModerationStatus>(['SAFE', 'SPAM', 'HARASSMENT', 'ILLEGAL']);

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // ── 1. Validate auth ──────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    // ── 2. Parse request body ─────────────────────────────────────────────
    const body = await req.json();
    const messageText: string | undefined = body?.messageText;

    if (!messageText || typeof messageText !== 'string') {
      return new Response(
        JSON.stringify({ error: 'messageText is required and must be a string' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    // Very short / empty messages are trivially SAFE — skip API call
    if (messageText.trim().length === 0) {
      return new Response(
        JSON.stringify({ status: 'SAFE' }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    // ── 3. Call Gemini ────────────────────────────────────────────────────
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      console.error('❌ GEMINI_API_KEY environment variable is not set');
      // Fail open — don't block the user's message if moderation is misconfigured
      return new Response(
        JSON.stringify({ status: 'SAFE', warning: 'Moderation service unavailable' }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const geminiPayload = {
      system_instruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: messageText }],
        },
      ],
      generationConfig: {
        maxOutputTokens: 10,
        temperature: 0,
      },
    };

    const geminiResponse = await fetch(`${GEMINI_API_URL}?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiPayload),
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error('❌ Gemini API error:', geminiResponse.status, errText);
      // Fail open on upstream errors to avoid blocking legitimate users
      return new Response(
        JSON.stringify({ status: 'SAFE', warning: 'Moderation service error' }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const geminiData = await geminiResponse.json();
    const rawText: string = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const classification = rawText.trim().toUpperCase() as ModerationStatus;

    // ── 4. Validate & return ──────────────────────────────────────────────
    const status: ModerationStatus = VALID_STATUSES.has(classification) ? classification : 'SAFE';

    console.log(`🔍 Moderation: "${messageText.slice(0, 40)}..." → ${status}`);

    return new Response(
      JSON.stringify({ status }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('❌ moderate-message exception:', message);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
});