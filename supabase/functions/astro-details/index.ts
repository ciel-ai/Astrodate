/**
 * Required Secrets in Supabase Dashboard -> Edge Functions -> astro-details -> Secrets:
 * ASTROLOGY_API_USER_ID
 * ASTROLOGY_API_KEY
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BASE_URL = 'https://json.astrologyapi.com/v1';

type AstroRequestPayload = {
  mode?: 'basic' | 'full';
  day?: number;
  month?: number;
  year?: number;
  hour?: number;
  min?: number;
  lat?: number;
  lon?: number;
  tzone?: number;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const userId = Deno.env.get('ASTROLOGY_API_USER_ID');
    const apiKey = Deno.env.get('ASTROLOGY_API_KEY');

    if (!userId || !apiKey) {
      return new Response(JSON.stringify({ error: "Missing Astrology API credentials" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const authHeader = 'Basic ' + btoa(userId + ':' + apiKey);
    const commonHeaders = {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      'Accept-Language': 'en'
    };

    const payload = await req.json() as AstroRequestPayload;
    const { mode } = payload;

    if (mode === 'basic') {
      const { day, month, year, hour, min, lat, lon, tzone } = payload;
      const body = JSON.stringify({ day, month, year, hour, min, lat, lon, tzone });

      const [planetsRes, nakshatraRes] = await Promise.all([
        fetch(`${BASE_URL}/planets/tropical`, { method: 'POST', headers: commonHeaders, body }),
        fetch(`${BASE_URL}/daily_nakshatra_prediction`, { method: 'POST', headers: commonHeaders, body })
      ]);

      if (!planetsRes.ok || !nakshatraRes.ok) {
        return new Response(JSON.stringify({ 
          error: "Failed to fetch from Astrology API", 
          status: { planets: planetsRes.status, nakshatra: nakshatraRes.status }, 
          endpoint: mode 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 502,
        });
      }

      const planetsData = await planetsRes.json();
      const nakshatraData = await nakshatraRes.json();

      let venus_sign, mars_sign, mercury_sign, rising_sign, western_sign;

      if (Array.isArray(planetsData)) {
        for (const p of planetsData) {
          if (p.name === 'Venus') venus_sign = p.sign;
          if (p.name === 'Mars') mars_sign = p.sign;
          if (p.name === 'Mercury') mercury_sign = p.sign;
          if (p.name === 'Ascendant') rising_sign = p.sign;
          if (p.name === 'Sun') {
            western_sign = p.sign ? p.sign.charAt(0).toUpperCase() + p.sign.slice(1).toLowerCase() : undefined;
          }
        }
      }

      const indian_sign = nakshatraData.birth_moon_sign;
      const nakshatra_name = nakshatraData.birth_moon_nakshatra;

      // Compute dominant element
      const elements = { Fire: 0, Earth: 0, Air: 0, Water: 0 };
      const mapSignToElement = (sign: string | undefined) => {
        if (!sign) return;
        const s = sign.toLowerCase();
        if (['aries', 'leo', 'sagittarius'].includes(s)) elements.Fire++;
        if (['taurus', 'virgo', 'capricorn'].includes(s)) elements.Earth++;
        if (['gemini', 'libra', 'aquarius'].includes(s)) elements.Air++;
        if (['cancer', 'scorpio', 'pisces'].includes(s)) elements.Water++;
      };

      [western_sign, venus_sign, mars_sign, mercury_sign, rising_sign].forEach(mapSignToElement);

      let dominant_element = 'Fire';
      let max = -1;
      for (const [el, count] of Object.entries(elements)) {
        if (count > max) { max = count; dominant_element = el; }
      }

      return new Response(JSON.stringify({
        western_sign, indian_sign, nakshatra_name,
        venus_sign, mars_sign, mercury_sign, rising_sign,
        dominant_element,
        chart_json: { planets: planetsData, nakshatra: nakshatraData }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else if (mode === 'full') {
      const { hour, min, lat, lon, tzone } = payload;
      const today = new Date();
      const body = JSON.stringify({ 
        day: today.getDate(), 
        month: today.getMonth() + 1, 
        year: today.getFullYear(), 
        hour, min, lat, lon, tzone 
      });

      const res = await fetch(`${BASE_URL}/daily_nakshatra_prediction`, { method: 'POST', headers: commonHeaders, body });

      if (!res.ok) {
        return new Response(JSON.stringify({ 
          error: "Failed to fetch daily prediction", 
          status: res.status, 
          endpoint: 'daily_nakshatra_prediction' 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 502,
        });
      }

      const data = await res.json();
      return new Response(JSON.stringify({
        birth_moon_sign: data.birth_moon_sign,
        birth_moon_nakshatra: data.birth_moon_nakshatra,
        prediction: data.prediction
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid mode" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  } catch (error: unknown) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Invalid request' }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
