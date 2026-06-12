import { supabase } from './supabase';

// ─── Static fallback icebreakers ──────────────────────────────────────────────
// Shown when Gemini is unavailable. They are intentionally astrological so they
// always feel on-brand, and are varied enough to avoid feeling templated.
const STATIC_FALLBACKS = [
  "Your charts crossed paths for a reason ✨ — what's been the most unexpected thing to happen to you this year?",
  "The stars lined you two up — so tell me, are you more of a sunrise or sunset person? 🌅",
  "Mercury might have something to say about this match 😄 — what's the last thing that genuinely made you laugh out loud?",
  "Your Moon signs are doing all the talking 🌙 — what's something you've been quietly passionate about lately?",
  "Venus says hi 💫 — if you could have dinner anywhere in the world tonight, where would you pick?",
  "The cosmos doesn't do accidents ☄️ — what's one thing on your bucket list you've never told anyone about?",
  "With energy like yours, the universe had to introduce us 🔮 — coffee or tea, and why does it say so much about a person?",
];

function pickFallback(): string {
  return STATIC_FALLBACKS[Math.floor(Math.random() * STATIC_FALLBACKS.length)];
}

// ─── generateAndSaveIcebreaker ────────────────────────────────────────────────
/**
 * Called once when a match is created (from `checkMutualLike` in user-likes.ts).
 * Runs fully in the background — callers should NOT await this in the hot path.
 *
 * Flow:
 *  1. Check if the match already has an icebreaker (idempotent — safe to call twice).
 *  2. Fetch both users' astro signs for personalised prompting.
 *  3. Call Gemini via the existing Edge Function.
 *  4. Persist the result to `user_matches.icebreaker_text`.
 *  5. On any failure → write a static fallback so the chat screen always has text.
 *
 * @param matchId  The `user_matches.id` UUID.
 */
export async function generateAndSaveIcebreaker(matchId: string): Promise<void> {
  try {
    // 1 — Idempotency check
    const { data: match, error: matchError } = await supabase
      .from('user_matches')
      .select('id, user1_id, user2_id, icebreaker_text')
      .eq('id', matchId)
      .single();

    if (matchError || !match) {
      console.warn('[icebreaker] Could not fetch match:', matchId, matchError?.message);
      return;
    }

    if (match.icebreaker_text) {
      // Already generated — nothing to do
      return;
    }

    // 2 — Fetch both users' astro data for a personalised prompt
    const [aRes, bRes] = await Promise.all([
      supabase
        .from('astro_details')
        .select('western_sign, indian_sign, venus_sign')
        .eq('user_id', match.user1_id)
        .maybeSingle(),
      supabase
        .from('astro_details')
        .select('western_sign, indian_sign, venus_sign')
        .eq('user_id', match.user2_id)
        .maybeSingle(),
    ]);

    const a = aRes.data;
    const b = bRes.data;

    const astroContext =
      a && b
        ? `User A: Sun in ${a.western_sign ?? '?'}, Moon in ${a.indian_sign ?? '?'}, Venus in ${a.venus_sign ?? '?'}. ` +
          `User B: Sun in ${b.western_sign ?? '?'}, Moon in ${b.indian_sign ?? '?'}, Venus in ${b.venus_sign ?? '?'}.`
        : 'Astro details not yet available for this pair.';

    // 3 — Call Gemini via Edge Function
    let icebreakerText: string | null = null;

    try {
      const { data: geminiData, error: geminiError } = await supabase.functions.invoke(
        'gemini-chatbot',
        {
          body: {
            prompt:
              `You are AstroDate's cosmic matchmaker. Generate ONE short, warm, and playful icebreaker question ` +
              `(max 30 words) for two people who just matched on an astrology dating app. ` +
              `Make it feel personal by weaving in their astrological signs naturally — ` +
              `do not just list signs, use them to set up the question. ` +
              `Context: ${astroContext} ` +
              `Respond with only the icebreaker question and nothing else.`,
            max_tokens: 80,
          },
        }
      );

      if (geminiError) throw geminiError;

      const rawText =
        typeof geminiData === 'string'
          ? geminiData
          : geminiData?.text ?? geminiData?.content ?? null;

      if (rawText && typeof rawText === 'string' && rawText.trim().length > 0) {
        icebreakerText = rawText.trim();
      }
    } catch (geminiErr) {
      console.warn('[icebreaker] Gemini call failed, using static fallback:', geminiErr);
    }

    // Fall back to static if Gemini returned nothing
    if (!icebreakerText) {
      icebreakerText = pickFallback();
    }

    // 4 — Persist to user_matches
    const { error: saveError } = await supabase
      .from('user_matches')
      .update({
        icebreaker_text: icebreakerText,
        icebreaker_generated_at: new Date().toISOString(),
      })
      .eq('id', matchId);

    if (saveError) {
      console.error('[icebreaker] Failed to save icebreaker:', saveError.message);
    }
  } catch (err) {
    // Last-resort: try to write a static fallback so the chat screen isn't empty
    try {
      await supabase
        .from('user_matches')
        .update({
          icebreaker_text: pickFallback(),
          icebreaker_generated_at: new Date().toISOString(),
        })
        .eq('id', matchId)
        .is('icebreaker_text', null); // don't overwrite if somehow set concurrently
    } catch {
      // Swallow — nothing more we can do
    }
    console.error('[icebreaker] Unexpected error in generateAndSaveIcebreaker:', err);
  }
}

// ─── getIcebreakerForMatch ────────────────────────────────────────────────────
/**
 * Reads the pre-generated icebreaker for a match from the DB.
 * Called by the chat screen; never triggers a Gemini call.
 *
 * Returns null when no icebreaker exists yet (pending background generation).
 */
export async function getIcebreakerForMatch(
  matchId: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('user_matches')
      .select('icebreaker_text')
      .eq('id', matchId)
      .maybeSingle();

    if (error || !data) return null;
    return data.icebreaker_text ?? null;
  } catch {
    return null;
  }
}