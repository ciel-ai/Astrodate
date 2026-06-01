// ─── PATCH: lib/user-likes.ts ────────────────────────────────────────────────
//
// Add one import at the top of the file and one fire-and-forget call inside
// checkMutualLike(), immediately after saveMatch() succeeds.
//
// No other changes are needed.
//
// ─── 1. Add import (at top of file, after existing imports) ──────────────────

import { generateAndSaveIcebreaker } from './icebreaker';

// ─── 2. Replace the success branch of checkMutualLike ────────────────────────
//
// BEFORE (lines ~174-182 in the original file):
//
//   if (matchResult.success) {
//     return {
//       isMatch: true,
//       channelId: matchResult.channelId,
//       matchData: matchResult.data,
//     };
//   }
//
// AFTER:

    if (matchResult.success) {
      // Kick off icebreaker generation in the background.
      // We deliberately do NOT await this — the match modal should open
      // immediately. By the time the user taps into chat, the icebreaker
      // will already be stored in user_matches.icebreaker_text.
      if (matchResult.data?.id) {
        generateAndSaveIcebreaker(matchResult.data.id).catch((err) => {
          // Swallow — failure here never blocks the match flow
          console.warn('[checkMutualLike] Icebreaker generation failed:', err);
        });
      }

      return {
        isMatch: true,
        channelId: matchResult.channelId,
        matchData: matchResult.data,
      };
    }

// ─── Summary ─────────────────────────────────────────────────────────────────
//
// The icebreaker is generated:
//   • Once — at match creation time.
//   • Asynchronously — does not block the UI.
//   • With automatic fallback — static text is written if Gemini fails.
//   • Idempotently — safe to call twice; second call exits early if text exists.