import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase';
import { invokeSupabaseFunctionWithTimeout, withTimeout } from './network';
import type { VedicMatchReport } from '@/lib/astro-types';


export type AstroRequest = {
  day: number;
  month: number;
  year: number;
  hour: number;
  min: number;
  lat: number;
  lon: number;
  tzone: number;
  language?: string;
  mode?: 'basic' | 'full';
};

export type DailyHoroscopeRequest = {
  day: number;
  month: number;
  year: number;
  hour: number;
  min: number;
  lat: number;
  lon: number;
  tzone: number;
  language?: string;
};

export type BirthPayload = {
  day: number;
  month: number;
  year: number;
  hour: number;
  min: number;
  lat: number;
  lon: number;
  tzone: number;
};

// ─── Shared helpers ───────────────────────────────────────────────────────────

/**
 * Parse a timezone string like "UTC+5", "UTC-8", "UTC+5.5", or a bare
 * number string like "5.5" into a numeric offset. Falls back to the
 * device's local offset when the string is missing or unparseable.
 */
export function parseTzString(tz: string | null | undefined): number {
  if (!tz) return -new Date().getTimezoneOffset() / 60;
  // Strip "UTC" prefix, then parse whatever remains (handles "+5", "-8", "+5.5")
  const numeric = parseFloat(tz.replace(/^UTC/i, ''));
  if (!isFinite(numeric)) return -new Date().getTimezoneOffset() / 60;
  return numeric;
}

/**
 * Validates that every numeric field in an astro payload is a finite number.
 * Returns a string describing the first bad field, or null if all good.
 */
function validateNumericPayload(
  p: { hour: number; min: number; lat: number; lon: number; tzone: number }
): string | null {
  const checks: [string, number][] = [
    ['hour', p.hour], ['min', p.min],
    ['lat', p.lat], ['lon', p.lon], ['tzone', p.tzone],
  ];
  for (const [name, val] of checks) {
    if (!isFinite(val)) return `${name} is ${val}`;
  }
  return null;
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function getAstroDetails(payload: AstroRequest) {
  const badField = validateNumericPayload(payload);
  if (badField) {
    console.warn(`[astro] getAstroDetails skipped — invalid payload: ${badField}`);
    return null;
  }
  try {
    const { data, error } = await invokeSupabaseFunctionWithTimeout(
      () => supabase.functions.invoke('astro-details', { body: payload }),
      20000
    );
    if (error) {
      console.warn('[astro] getAstroDetails non-fatal error:', error.message ?? error);
      return null;
    }
    return data;
  } catch (err: any) {
    console.warn('[astro] getAstroDetails exception (non-fatal):', err?.message ?? err);
    return null;
  }
}

export async function getDailyHoroscope(payload: DailyHoroscopeRequest) {
  const badField = validateNumericPayload(payload);
  if (badField) {
    console.warn(`[astro] getDailyHoroscope skipped — invalid payload: ${badField}`);
    return null;
  }
  try {
    // Use raw fetch instead of supabase.functions.invoke so we can read the
    // actual error body when the edge function returns non-2xx.
    const { data: { session } } = await supabase.auth.getSession();
    const authToken = session?.access_token ?? SUPABASE_ANON_KEY;

    const body = { ...payload, mode: 'full', language: payload.language || 'en' };

    const res = await withTimeout(
      fetch(`${SUPABASE_URL}/functions/v1/astro-details`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(body),
      }),
      20000,
      'getDailyHoroscope timed out'
    );

    const text = await res.text();

    if (!res.ok) {
      console.warn(`[astro] getDailyHoroscope edge error ${res.status}:`, text);
      return null;
    }

    try {
      return JSON.parse(text);
    } catch {
      console.warn('[astro] getDailyHoroscope: response was not JSON:', text);
      return null;
    }
  } catch (err: any) {
    console.warn('[astro] getDailyHoroscope exception (non-fatal):', err?.message ?? err);
    return null;
  }
}

export type ZodiacCompatibilityResult = {
  compatibility_percentage: number;
  compatibility_report: string;
};

export async function getZodiacCompatibility(
  userSign: string,
  partnerSign: string
): Promise<ZodiacCompatibilityResult | null> {
  try {
    const { data, error } = await invokeSupabaseFunctionWithTimeout(
      () =>
        supabase.functions.invoke('astro-compatibility', {
          body: { type: 'western_signs', userSign, partnerSign },
        }),
      20000
    );
    if (error) return null;
    return data as ZodiacCompatibilityResult;
  } catch {
    return null;
  }
}

export async function getVedicMatchReport(
  male: BirthPayload,
  female: BirthPayload
): Promise<VedicMatchReport | null> {
  try {
    const { data, error } = await invokeSupabaseFunctionWithTimeout(
      () =>
        supabase.functions.invoke('astro-compatibility', {
          body: { type: 'vedic_match', male, female },
        }),
      30000
    );
    if (error) return null;
    return data as VedicMatchReport;
  } catch {
    return null;
  }
}

export type { VedicMatchReport, VedicKootaDetail } from '@/lib/astro-types';