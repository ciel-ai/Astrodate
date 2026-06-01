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

    if (type === 'search') {
      const { place } = payload;
      
      const body = JSON.stringify({ 
        place,
        maxRows: 10
      });

      const res = await fetch(`${BASE_URL}/geo_details`, { 
        method: 'POST', 
        headers: commonHeaders, 
        body 
      });

      if (!res.ok) {
        return new Response(JSON.stringify({ error: "Failed to fetch geo details" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 502,
        });
      }

      const data = await res.json();
      
      // The frontend expects { results: [{ place_name, latitude, longitude, timezone_id }] }
      // AstrologyAPI returns { geonames: [...] }
      const results = (data.geonames || []).map((geo: any) => ({
        place_name: geo.place_name,
        latitude: parseFloat(geo.latitude),
        longitude: parseFloat(geo.longitude),
        timezone_id: geo.timezone_id
      }));

      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (type === 'timezone') {
      const { latitude, longitude, date } = payload;
      
      const body = JSON.stringify({
        latitude,
        longitude,
        date, // Expected DD-MM-YYYY
      });

      const res = await fetch(`${BASE_URL}/timezone_with_dst`, { 
        method: 'POST', 
        headers: commonHeaders, 
        body 
      });

      if (!res.ok) {
        return new Response(JSON.stringify({ error: "Failed to fetch timezone" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 502,
        });
      }

      const data = await res.json();
      
      // Frontend expects data?.tzone
      return new Response(JSON.stringify({ tzone: data.timezone }), {
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
