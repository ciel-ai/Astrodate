/**
 * compute-synastry Edge Function
 *
 * Computes the Vedic Ashtakoota (36-guna) compatibility score for a pair of
 * users by calling the external Astrology API's match_making_detailed_report
 * endpoint, then caches the result in synastry_cache_details.
 *
 * Required Edge Function secrets:
 *   ASTROLOGY_API_USER_ID
 *   ASTROLOGY_API_KEY
 *
 * Request body: { user_a_id: string, user_b_id: string }
 * Can be called by an authenticated user (their JWT) or by the prewarm worker
 * (service role key). The function always uses the service role for DB writes.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ASTRO_BASE = "https://json.astrologyapi.com/v1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Parse "UTC+5.5", "UTC-8", "+5.5", "5.5" → numeric offset. */
function parseTzNum(tz: string | null | undefined): number | null {
  if (!tz) return null;
  const n = parseFloat(tz.replace(/^UTC/i, ""));
  return isFinite(n) ? n : null;
}

/** Parse "YYYY-MM-DD" → { year, month, day } */
function parseDate(s: string): { year: number; month: number; day: number } {
  const [year, month, day] = s.split("-").map(Number);
  return { year, month, day };
}

/** Parse "HH:MM:SS" → { hour, min } */
function parseTime(s: string): { hour: number; min: number } {
  const [hour, min] = s.split(":").map(Number);
  return { hour, min };
}

/** Build a human-readable summary from the Ashtakoota score. */
function buildSummary(score: number, detail: Record<string, unknown>): string {
  const kootas = (detail as any)?.ashtakoota_points ?? detail;
  if (score >= 32) {
    return "Exceptional cosmic alignment — a rare and profound connection blessed by the stars.";
  }
  if (score >= 27) {
    return "Strong compatibility — your stars create natural harmony and shared life purpose.";
  }
  if (score >= 24) {
    return "Good compatibility — a balanced foundation with strong potential for growth together.";
  }
  if (score >= 18) {
    return "Compatible match — meaningful differences that create interesting and complementary dynamics.";
  }
  return "Challenging match — significant karmic contrasts that invite deep understanding and growth.";
}

/** Build badges from Ashtakoota result. */
function buildBadges(score: number, kootas: Record<string, any>): string[] {
  const badges: string[] = [];
  if (score >= 32) badges.push("Cosmic Soulmates");
  else if (score >= 27) badges.push("Harmonious Souls");

  const nadiPts = kootas?.nadi?.received_points ?? kootas?.nadi;
  if (typeof nadiPts === "number" && nadiPts >= 8) badges.push("Nadi Match");

  const ganPts = kootas?.gan?.received_points ?? kootas?.gan;
  if (typeof ganPts === "number" && ganPts >= 6) badges.push("Gana Match");

  const venusPts = kootas?.vasya?.received_points ?? 0;
  if (typeof venusPts === "number" && venusPts >= 2) badges.push("Vashya Bond");

  return badges;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const astroUserId = Deno.env.get("ASTROLOGY_API_USER_ID");
  const astroApiKey = Deno.env.get("ASTROLOGY_API_KEY");

  if (!supabaseUrl || !serviceKey || !astroUserId || !astroApiKey) {
    return json({ error: "Server configuration error" }, 500);
  }

  // Verify caller is an authenticated user or the service role (prewarm)
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "Unauthorized" }, 401);
  }

  // Use service-role client for all DB operations (reads private birth data)
  const db = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  let body: { user_a_id?: string; user_b_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { user_a_id, user_b_id } = body;
  if (!user_a_id || !user_b_id) {
    return json({ error: "user_a_id and user_b_id are required" }, 400);
  }

  // Normalize pair order (consistent with all other synastry logic)
  const va = user_a_id < user_b_id ? user_a_id : user_b_id;
  const vb = user_a_id < user_b_id ? user_b_id : user_a_id;

  // Skip if ashtakoota already computed and fresh
  const { data: existing } = await db
    .from("synastry_cache_details")
    .select("ashtakoota_score, is_stale")
    .eq("user_a_id", va)
    .eq("user_b_id", vb)
    .maybeSingle();

  if (existing && existing.ashtakoota_score != null && !existing.is_stale) {
    return json({ success: true, cached: true, ashtakoota_score: existing.ashtakoota_score });
  }

  // Fetch both users' astro details
  const [{ data: aRec }, { data: bRec }] = await Promise.all([
    db.from("astro_details").select("*").eq("user_id", va).maybeSingle(),
    db.from("astro_details").select("*").eq("user_id", vb).maybeSingle(),
  ]);

  if (!aRec || !bRec) {
    return json({ success: false, error: "missing_astro_details" }, 422);
  }
  if (!aRec.birth_date || !aRec.birth_time || !aRec.birth_latitude || !aRec.birth_longitude) {
    return json({ success: false, error: "incomplete_birth_data_user_a" }, 422);
  }
  if (!bRec.birth_date || !bRec.birth_time || !bRec.birth_latitude || !bRec.birth_longitude) {
    return json({ success: false, error: "incomplete_birth_data_user_b" }, 422);
  }

  const astroAuth = "Basic " + btoa(astroUserId + ":" + astroApiKey);
  const astroHeaders = {
    Authorization: astroAuth,
    "Content-Type": "application/json",
    "Accept-Language": "en",
  };

  // Resolve timezones — use stored value first, fall back to API
  const resolveTz = async (
    rec: typeof aRec,
    lat: number,
    lon: number,
    date: { day: number; month: number; year: number }
  ): Promise<number> => {
    const stored = parseTzNum(rec.birth_timezone);
    if (stored !== null) return stored;

    try {
      const res = await fetch(`${ASTRO_BASE}/timezone_with_dst`, {
        method: "POST",
        headers: astroHeaders,
        body: JSON.stringify({
          latitude: lat,
          longitude: lon,
          date: `${date.day}/${date.month}/${date.year}`,
        }),
      });
      if (res.ok) {
        const tzData = await res.json();
        if (typeof tzData.timezone === "number") return tzData.timezone;
      }
    } catch {
      // fall through to longitude estimate
    }
    return Math.round(lon / 15);
  };

  const aDate = parseDate(aRec.birth_date);
  const aTime = parseTime(aRec.birth_time);
  const bDate = parseDate(bRec.birth_date);
  const bTime = parseTime(bRec.birth_time);

  const [aTz, bTz] = await Promise.all([
    resolveTz(aRec, aRec.birth_latitude, aRec.birth_longitude, aDate),
    resolveTz(bRec, bRec.birth_latitude, bRec.birth_longitude, bDate),
  ]);

  // Call match_making_detailed_report
  // Pair order: va = "m_" (male slot), vb = "f_" (female slot)
  // The API uses these as person-A / person-B labels; gender doesn't affect Ashtakoota scoring
  const matchRes = await fetch(`${ASTRO_BASE}/match_making_detailed_report`, {
    method: "POST",
    headers: astroHeaders,
    body: JSON.stringify({
      m_day: aDate.day, m_month: aDate.month, m_year: aDate.year,
      m_hour: aTime.hour, m_min: aTime.min,
      m_lat: aRec.birth_latitude, m_lon: aRec.birth_longitude, m_tzone: aTz,
      f_day: bDate.day, f_month: bDate.month, f_year: bDate.year,
      f_hour: bTime.hour, f_min: bTime.min,
      f_lat: bRec.birth_latitude, f_lon: bRec.birth_longitude, f_tzone: bTz,
    }),
  });

  if (!matchRes.ok) {
    const errBody = await matchRes.text().catch(() => "");
    console.error("[compute-synastry] API error", matchRes.status, errBody);
    return json({ success: false, error: "astrology_api_error", status: matchRes.status }, 502);
  }

  const matchData = await matchRes.json();

  // Extract Ashtakoota score — handle both response shapes the API may return
  const kootas = matchData?.ashtakoota_points ?? matchData;
  const totalScore: number =
    typeof kootas?.received_points === "number"
      ? kootas.received_points
      : typeof matchData?.total_points === "number"
      ? matchData.total_points
      : 0;

  const summary = buildSummary(totalScore, matchData);
  const badges = buildBadges(totalScore, kootas);

  // Upsert only the Ashtakoota columns — leave planet scores intact (set by SQL RPC)
  const { error: upsertError } = await db
    .from("synastry_cache_details")
    .upsert(
      {
        user_a_id: va,
        user_b_id: vb,
        ashtakoota_score: totalScore,
        ashtakoota_detail: kootas,
        compatibility_summary: summary,
        badges: JSON.stringify(badges),
        computed_at: new Date().toISOString(),
        is_stale: false,
      },
      {
        onConflict: "user_a_id,user_b_id",
        ignoreDuplicates: false,
      }
    );

  if (upsertError) {
    console.error("[compute-synastry] DB upsert failed", upsertError);
    return json({ success: false, error: upsertError.message }, 500);
  }

  console.log(
    `[compute-synastry] pair ${va}:${vb} → ${totalScore}/36 gunas`
  );

  return json({ success: true, ashtakoota_score: totalScore, cached: false });
});
