/**
 * Required Secrets in Supabase Dashboard -> Edge Functions -> personality_compute -> Secrets:
 * SUPABASE_URL
 * SUPABASE_SERVICE_ROLE_KEY
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0";

Deno.serve(async (req) => {
  try {
    const { user_id, target_user_id } = await req.json();

    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id is required" }), {
        headers: { "Content-Type": "application/json" },
        status: 400,
      });
    }

    if (!target_user_id) {
      return new Response(JSON.stringify({ personality_score: 0.5, user_id }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: "Missing Supabase configuration" }), {
        headers: { "Content-Type": "application/json" },
        status: 500,
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data } = await supabase.rpc('compute_personality_score', { 
      user_a: user_id, 
      user_b: target_user_id 
    });

    return new Response(
      JSON.stringify({ 
        personality_score: data ?? 0.5, 
        user_id,
        target_user_id
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    });
  }
});
