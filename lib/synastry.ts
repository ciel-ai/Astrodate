import { supabase } from './supabase';
import type { Json } from './database.types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KootaScore {
  total_points: number;
  received_points: number;
  description?: string;
}

export interface AshtakootaDetail {
  varna:   KootaScore;
  vasya:   KootaScore;
  tara:    KootaScore;
  yoni:    KootaScore;
  maitri:  KootaScore;
  gan:     KootaScore;
  bhakoot: KootaScore;
  nadi:    KootaScore;
  total_points:    number;
  received_points: number;
}

export interface SynastryDetail {
  sun_score:             number;
  moon_score:            number;
  venus_score:           number;
  mars_score:            number;
  mercury_score:         number;
  dominant_element_match: boolean;
  compatibility_summary: string;
  badges:                string[];
  computed_at:           string;
  // Vedic Ashtakoota — null until compute-synastry Edge Function has run
  ashtakoota_score:  number | null;
  ashtakoota_detail: AshtakootaDetail | null;
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
const SESSION_CACHE = new Map<string, { data: SynastryDetail; at: number }>();
const SESSION_TTL_MS = 30 * 60 * 1000;

function pairKey(userX: string, userY: string): string {
  return [userX, userY].sort().join(':');
}

// ─── getSynastryDetail ────────────────────────────────────────────────────────
/**
 * Fetch planet-by-planet synastry + Vedic Ashtakoota score for a pair.
 *
 * 1. Checks in-memory session cache (TTL = 30 min).
 * 2. Calls the `get_synastry_detail` RPC (read-through DB cache).
 * 3. If Ashtakoota score is absent, triggers the `compute-synastry` Edge
 *    Function fire-and-forget so the next open will have the full score.
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

  // 2 — RPC (handles DB cache + planet score compute if needed)
  try {
    const { data, error } = await supabase.rpc('get_synastry_detail', {
      user_x: userX,
      user_y: userY,
    });

    if (error) {
      console.error('[getSynastryDetail] RPC error:', error);
      return { success: false, error: error.message };
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      return { success: false, error: 'No synastry data returned' };
    }

    // get_sign_compatibility returns only 2/6/8/10 for real data.
    // All-5 means no chart data was available — hide the strip.
    const allDefaults = [
      row.sun_score, row.moon_score, row.venus_score,
      row.mars_score, row.mercury_score,
    ].every(s => Number(s) === 5);
    if (allDefaults) {
      return { success: false, error: 'no_computed_data' };
    }

    // Parse Ashtakoota detail
    const ashtakootaDetail = parseAshtakootaDetail(row.ashtakoota_detail);

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
      ashtakoota_score:       row.ashtakoota_score != null ? Number(row.ashtakoota_score) : null,
      ashtakoota_detail:      ashtakootaDetail,
    };

    // Populate session cache
    SESSION_CACHE.set(key, { data: result, at: Date.now() });

    // 3 — If Ashtakoota hasn't been computed yet, trigger async computation.
    //     Fire-and-forget: the next time the user opens this chat it will be ready.
    if (result.ashtakoota_score == null) {
      void triggerAshtakootaCompute(userX, userY);
    }

    return { success: true, data: result };
  } catch (err) {
    console.error('[getSynastryDetail] Unexpected error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/** Fire-and-forget: ask the Edge Function to compute Ashtakoota for this pair. */
async function triggerAshtakootaCompute(userX: string, userY: string): Promise<void> {
  try {
    await supabase.functions.invoke('compute-synastry', {
      body: { user_a_id: userX, user_b_id: userY },
    });
    // Bust the session cache so the next getSynastryDetail call fetches fresh data
    SESSION_CACHE.delete(pairKey(userX, userY));
  } catch (err) {
    console.warn('[getSynastryDetail] compute-synastry trigger failed:', err);
  }
}

// ─── getActiveAstroEvents ─────────────────────────────────────────────────────
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

// ─── derivedAstroScore ────────────────────────────────────────────────────────
/**
 * Single 0-100 compatibility score.
 *
 * When Ashtakoota is available it contributes 60% of the total (Vedic system
 * is the primary score for this app). Western planet scores contribute 40%.
 * Without Ashtakoota, falls back to pure Western planet weighting.
 */
export function derivedAstroScore(detail: SynastryDetail): number {
  if (detail.ashtakoota_score != null) {
    // Ashtakoota: 0-36 → 0-100
    const vedicPct = (detail.ashtakoota_score / 36) * 100;

    // Western planets: raw is 0-10 scale → multiply by 10 for 0-100
    const westernRaw =
      detail.sun_score     * 0.20 +
      detail.moon_score    * 0.25 +
      detail.venus_score   * 0.20 +
      detail.mars_score    * 0.15 +
      detail.mercury_score * 0.10 +
      (detail.dominant_element_match ? 10 : 0) * 0.10;
    const westernPct = Math.min(100, westernRaw * 10);

    return Math.round(Math.min(100, Math.max(0, vedicPct * 0.60 + westernPct * 0.40)));
  }

  // Fallback: pure Western calculation
  const raw =
    detail.sun_score     * 0.20 +
    detail.moon_score    * 0.25 +
    detail.venus_score   * 0.20 +
    detail.mars_score    * 0.15 +
    detail.mercury_score * 0.10 +
    (detail.dominant_element_match ? 10 : 0) * 0.10;

  return Math.round(Math.min(100, Math.max(0, raw * 10)));
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function toStringArray(value: Json | undefined): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function isEventUiConfig(value: Json | undefined): value is AstroEvent['ui_config'] {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseAshtakootaDetail(raw: Json | undefined | null): AshtakootaDetail | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  // Accept both top-level and nested { ashtakoota_points: {...} } shapes
  const k = (r.ashtakoota_points as Record<string, unknown>) ?? r;
  if (!k.varna) return null;
  return k as unknown as AshtakootaDetail;
}
