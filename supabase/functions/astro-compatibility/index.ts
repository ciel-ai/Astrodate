import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BASE_URL = 'https://json.astrologyapi.com/v1';

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

    const payload = await req.json();
    const { type } = payload;

    if (type === 'western_signs') {
      const { userSign, partnerSign } = payload;
      
      const body = JSON.stringify({ 
        sign1: (userSign || '').toLowerCase(), 
        sign2: (partnerSign || '').toLowerCase() 
      });

      const res = await fetch(`${BASE_URL}/sun_sign_compatibility`, { 
        method: 'POST', 
        headers: commonHeaders, 
        body 
      });

      if (!res.ok) {
        return new Response(JSON.stringify({ error: "Failed to fetch western compatibility" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 502,
        });
      }

      const data = await res.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (type === 'vedic_match') {
      const { male, female } = payload;
      
      const body = JSON.stringify({
        m_day: male.day,
        m_month: male.month,
        m_year: male.year,
        m_hour: male.hour,
        m_min: male.min,
        m_lat: male.lat,
        m_lon: male.lon,
        m_tzone: male.tzone,
        f_day: female.day,
        f_month: female.month,
        f_year: female.year,
        f_hour: female.hour,
        f_min: female.min,
        f_lat: female.lat,
        f_lon: female.lon,
        f_tzone: female.tzone,
      });

      const res = await fetch(`${BASE_URL}/match_making_report`, { 
        method: 'POST', 
        headers: commonHeaders, 
        body 
      });

      if (!res.ok) {
        return new Response(JSON.stringify({ error: "Failed to fetch vedic match report" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 502,
        });
      }

      const data = await res.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid type" }), {
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
