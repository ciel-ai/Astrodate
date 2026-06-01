import { supabase } from './supabase';
import type { Json } from './database.types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SynastryDetail {
  sun_score: number;
  moon_score: number;
  venus_score: number;
  mars_score: number;
  mercury_score: number;
  dominant_element_match: boolean;
  compatibility_summary: string;
  badges: string[];
  computed_at: string;
}

export interface AstroEvent {
  id: number;
  event_type: string;
  event_name: string;
  start_date: string;
  end_date: string;
  description: string | null;
  ui_config: {
    emoji?: string;
    banner_text?: string;
    cta?: string;
    gradient_start?: string;
    gradient_end?: string;
    text_color?: string;
  } | null;
}

// ─── In-memory cache (session lifetime) ──────────────────────────────────────
// Avoids duplicate RPC calls when a user repeatedly opens/closes a profile
// within the same app session. TTL is 30 minutes.
const SESSION_CACHE = new Map<string, { data: SynastryDetail; at: number }>();
const SESSION_TTL_MS = 30 * 60 * 1000;

function pairKey(userX: string, userY: string): string {
  return [userX, userY].sort().join(':');
}

// ─── getSynastryDetail ────────────────────────────────────────────────────────
/**
 * Fetch planet-by-planet synastry for a pair.
 *
 * 1. Checks the in-memory session cache (TTL = 30 min).
 * 2. Falls back to the Supabase `get_synastry_detail` RPC which is itself a
 *    read-through cache backed by the `synastry_cache_details` table (migration 044).
 *
 * @param userX  Either user in the pair (order is normalised server-side).
 * @param userY  The other user.
 */
export async function getSynastryDetail(
  userX: string,
  userY: string
): Promise<{ success: boolean; data?: SynastryDetail; error?: string }> {
  const key = pairKey(userX, userY);

  // 1 — session cache hit
  const cached = SESSION_CACHE.get(key);
  if (cached && Date.now() - cached.at < SESSION_TTL_MS) {
    return { success: true, data: cached.data };
  }

  // 2 — RPC (handles DB cache + compute if needed)
  try {
    const { data, error } = await supabase.rpc('get_synastry_detail', {
      user_x: userX,
      user_y: userY,
    });

    if (error) {
      console.error('[getSynastryDetail] RPC error:', error);
      return { success: false, error: error.message };
    }

    // RPC returns a table; Supabase JS wraps it as an array
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      return { success: false, error: 'No synastry data returned' };
    }

    const result: SynastryDetail = {
      sun_score:              Number(row.sun_score ?? 5),
      moon_score:             Number(row.moon_score ?? 5),
      venus_score:            Number(row.venus_score ?? 5),
      mars_score:             Number(row.mars_score ?? 5),
      mercury_score:          Number(row.mercury_score ?? 5),
      dominant_element_match: Boolean(row.dominant_element_match),
      compatibility_summary:  row.compatibility_summary ?? '',
      badges:                 toStringArray(row.badges),
      computed_at:            row.computed_at ?? new Date().toISOString(),
    };

    // Populate session cache
    SESSION_CACHE.set(key, { data: result, at: Date.now() });

    return { success: true, data: result };
  } catch (err) {
    console.error('[getSynastryDetail] Unexpected error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

// ─── getActiveAstroEvents ─────────────────────────────────────────────────────
/**
 * Fetches all astrological events whose date window includes right now.
 * Results are ordered by start_date ascending (soonest ending first).
 *
 * The feed screen calls this on mount to decide whether to show a banner.
 * If the database isn't available, an empty array is returned so the UI
 * degrades gracefully (no banner, no crash).
 */
export async function getActiveAstroEvents(): Promise<AstroEvent[]> {
  try {
    const { data, error } = await supabase.rpc('get_active_astro_events');

    if (error) {
      console.warn('[getActiveAstroEvents] RPC error:', error.message);
      return [];
    }

    return (data ?? []).map((event) => ({
      id: event.id,
      event_type: event.event_type,
      event_name: event.event_name,
      start_date: event.start_date,
      end_date: event.end_date,
      description: event.description,
      ui_config: isEventUiConfig(event.ui_config) ? event.ui_config : null,
    }));
  } catch (err) {
    console.warn('[getActiveAstroEvents] Unexpected error:', err);
    return [];
  }
}

// ─── Utility: weighted composite AstroScore ───────────────────────────────────
/**
 * Derives a single 0-100 AstroScore percentage from a SynastryDetail row,
 * using the canonical planet weights from the audit (Section 6.2).
 *
 * This is a pure client-side calculation — no extra RPC needed.
 */
export function derivedAstroScore(detail: SynastryDetail): number {
  const raw =
    detail.sun_score    * 0.20 +
    detail.moon_score   * 0.25 +
    detail.venus_score  * 0.20 +
    detail.mars_score   * 0.15 +
    detail.mercury_score * 0.10 +
    (detail.dominant_element_match ? 10 : 0) * 0.10;

  // raw is on a 0-10 scale → convert to 0-100
  return Math.round(Math.min(100, Math.max(0, raw * 10)));
}

function toStringArray(value: Json | undefined): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function isEventUiConfig(value: Json | undefined): value is AstroEvent['ui_config'] {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
