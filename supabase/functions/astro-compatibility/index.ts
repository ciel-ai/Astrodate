import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2";
import type { VedicKootaDetail, VedicMatchReport } from "../_shared/astro-types.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BASE_URL = 'https://json.astrologyapi.com/v1';

// ─── Adapter ──────────────────────────────────────────────────────────────────

function parseKoota(raw: Record<string, unknown>): VedicKootaDetail {
  return {
    description: String(raw.description ?? ''),
    male_koot_attribute: String(raw.male_koot_attribute ?? ''),
    female_koot_attribute: String(raw.female_koot_attribute ?? ''),
    total_points: Number(raw.total_points ?? 0),
    received_points: Number(raw.received_points ?? 0),
    male_point: Number(raw.male_point ?? 0),
    female_point: Number(raw.female_point ?? 0),
  };
}

function adaptDetailedReport(raw: unknown): VedicMatchReport {
  const r = raw as Record<string, unknown>;
  const ak = r.ashtakoota as Record<string, unknown>;
  const total = ak.total as Record<string, unknown>;
  const akConclusion = ak.conclusion as Record<string, unknown>;
  const manglik = r.manglik as Record<string, unknown>;
  const rajju = (r.rajju_dosha ?? {}) as Record<string, unknown>;
  const vedha = (r.vedha_dosha ?? {}) as Record<string, unknown>;
  const conclusion = r.conclusion as Record<string, unknown>;

  return {
    ashtakoota: {
      varna: parseKoota(ak.varna as Record<string, unknown>),
      vashya: parseKoota(ak.vashya as Record<string, unknown>),
      tara: parseKoota(ak.tara as Record<string, unknown>),
      yoni: parseKoota(ak.yoni as Record<string, unknown>),
      maitri: parseKoota(ak.maitri as Record<string, unknown>),
      gan: parseKoota(ak.gan as Record<string, unknown>),
      bhakut: parseKoota(ak.bhakut as Record<string, unknown>),
      nadi: parseKoota(ak.nadi as Record<string, unknown>),
      total: {
        total_points: Number(total.total_points ?? 36),
        received_points: Number(total.received_points ?? 0),
        minimum_required: Number(total.minimum_required ?? 18),
      },
      conclusion: {
        status: Boolean(akConclusion.status ?? false),
        report: String(akConclusion.report ?? ''),
      },
    },
    manglik: {
      status: Boolean(manglik.status ?? false),
      male_percentage: Number(manglik.male_percentage ?? 0),
      female_percentage: Number(manglik.female_percentage ?? 0),
    },
    rajju_dosha: { status: Boolean(rajju.status ?? false) },
    vedha_dosha: { status: Boolean(vedha.status ?? false) },
    conclusion: {
      match_report: String(conclusion.match_report ?? ''),
    },
  };
}

// ─── Compatibility Report Builder ─────────────────────────────────────────────

function buildCompatibilityReport(score: number): string {
  if (score >= 0.80) return "An exceptionally harmonious pairing. Shared elemental energy creates natural understanding and strong emotional resonance.";
  if (score >= 0.70) return "A complementary match. Your elemental energies support and invigorate each other in meaningful ways.";
  if (score >= 0.55) return "A balanced pairing with room for growth. Differences in elemental energy can spark curiosity and mutual learning.";
  if (score >= 0.40) return "A challenging but potentially transformative pairing. Contrasting elemental energies require conscious effort to harmonise.";
  return "A contrasting pairing. Significant elemental differences mean this connection will require patience and intentional communication.";
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const userId = Deno.env.get('ASTROLOGY_API_USER_ID');
    const apiKey = Deno.env.get('ASTROLOGY_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!userId || !apiKey) {
      return new Response(JSON.stringify({ error: "Missing Astrology API credentials" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(JSON.stringify({ error: "Missing Supabase credentials" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    const authHeader = 'Basic ' + btoa(userId + ':' + apiKey);
    const commonHeaders = {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      'Accept-Language': 'en',
    };

    const payload = await req.json();
    const { type } = payload;

    // ── Western zodiac ───────────────────────────────────────────────────────
    if (type === 'western_signs') {
      const { userSign, partnerSign } = payload;
      const sign1 = (userSign || '').toLowerCase().trim();
      const sign2 = (partnerSign || '').toLowerCase().trim();

      try {
        const getHeaders = {
          'Authorization': authHeader,
          'Accept-Language': 'en',
        };

        const res = await fetch(`${BASE_URL}/zodiac_compatibility/${sign1}/${sign2}`, {
          method: 'GET',
          headers: getHeaders,
        });

        if (res.ok) {
          const data = await res.json();
          const score = data.compatibility_percentage ?? data.score;
          const report = data.compatibility_report ?? data.report ?? data.description;

          if (score !== undefined && report !== undefined) {
            return new Response(
              JSON.stringify({ compatibility_percentage: score, compatibility_report: report }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      } catch (_apiErr) {
        // Fall through silently to DB fallback
      }

      const { data: rpcScore, error: rpcErr } = await supabaseAdmin.rpc('get_western_sign_score', {
        sign_a: sign1,
        sign_b: sign2,
      });

      if (rpcErr || rpcScore === null || rpcScore === undefined) {
        return new Response(JSON.stringify({ error: "Unable to compute compatibility" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 502,
        });
      }

      const numericScore = Number(rpcScore);
      return new Response(
        JSON.stringify({
          compatibility_percentage: Math.round(numericScore * 100),
          compatibility_report: buildCompatibilityReport(numericScore),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Vedic match ──────────────────────────────────────────────────────────
    if (type === 'vedic_match') {
      const { male, female } = payload;

      const body = JSON.stringify({
        m_day: male.day, m_month: male.month, m_year: male.year,
        m_hour: male.hour, m_min: male.min,
        m_lat: male.lat, m_lon: male.lon, m_tzone: male.tzone,
        f_day: female.day, f_month: female.month, f_year: female.year,
        f_hour: female.hour, f_min: female.min,
        f_lat: female.lat, f_lon: female.lon, f_tzone: female.tzone,
      });

      const res = await fetch(`${BASE_URL}/match_making_detailed_report`, {
        method: 'POST',
        headers: commonHeaders,
        body,
      });

      if (!res.ok) {
        return new Response(JSON.stringify({ error: "Failed to fetch vedic match report" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 502,
        });
      }

      const raw = await res.json();
      const adapted = adaptDetailedReport(raw);

      return new Response(JSON.stringify(adapted), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid type" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });

  } catch (error: unknown) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Invalid request' }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});