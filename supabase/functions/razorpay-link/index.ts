import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const keyId = Deno.env.get('RAZORPAY_KEY_ID');
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!keyId || !keySecret || !supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify the user JWT
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { planId, planName, amountPaise, currency, userEmail, userPhone, userName, platform } = body;
    const userId = user.id;

    if (!planId || !amountPaise) {
      return new Response(JSON.stringify({ error: 'planId and amountPaise are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- FIX: adminClient is created FIRST, before the Razorpay call ---
    // This lets us validate planId exists before creating a payment link
    // we can't record, and gives a clean error instead of FK violation.
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Validate that planId exists in plan_catalog BEFORE hitting Razorpay
    const { data: planRow, error: planLookupError } = await adminClient
      .from('plan_catalog')
      .select('id, plan_slug, plan_name, amount_paise, is_active')
      .eq('id', planId)
      .single();

    console.log('plan lookup:', JSON.stringify({ planId, planRow, planLookupError }));

    if (planLookupError || !planRow) {
      console.error('plan_id not found in plan_catalog:', planId);
      return new Response(JSON.stringify({
        error: 'Invalid plan',
        detail: `plan_id ${planId} not found in plan_catalog`,
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!planRow.is_active) {
      return new Response(JSON.stringify({ error: 'Plan is not active' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use the DB-authoritative amount, not the client-supplied one
    // (prevents price tampering)
    const verifiedAmountPaise = planRow.amount_paise;
    const verifiedPlanName = planRow.plan_name;

    const callbackUrl = Deno.env.get('RAZORPAY_CALLBACK_URL') ?? 'https://astrodate.app/payment-success';
    const basicAuth = btoa(`${keyId}:${keySecret}`);

    // Only include customer fields that have real values — Razorpay rejects empty strings
    const customer: Record<string, string> = {};
    if (userName) customer.name = userName;
    if (userEmail) customer.email = userEmail;
    if (userPhone) customer.contact = userPhone;

    const razorpayPayload: Record<string, unknown> = {
      amount: verifiedAmountPaise,
      currency: currency ?? 'INR',
      accept_partial: false,
      description: `AstroDate ${verifiedPlanName} Plan`,
      ...(Object.keys(customer).length > 0 && { customer }),
      notify: { sms: !!userPhone, email: !!userEmail },
      reminder_enable: true,
      notes: { user_id: userId, plan_id: planId, platform: platform ?? 'unknown' },
      callback_url: callbackUrl,
      callback_method: 'get',
    };

    console.log('Creating Razorpay payment link:', JSON.stringify({ amount: verifiedAmountPaise, planId, userId, callbackUrl }));

    const razorpayRes = await fetch('https://api.razorpay.com/v1/payment_links', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${basicAuth}`
      },
      body: JSON.stringify(razorpayPayload),
    });

    if (!razorpayRes.ok) {
      const errorData = await razorpayRes.text();
      console.error('Razorpay API Error:', razorpayRes.status, errorData);
      let parsedError: unknown;
      try { parsedError = JSON.parse(errorData); } catch { parsedError = errorData; }
      return new Response(JSON.stringify({ error: 'Razorpay API Error', detail: parsedError, razorpay_status: razorpayRes.status }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await razorpayRes.json();

    const { error: insertError } = await adminClient
      .from('user_subscriptions')
      .insert({
        user_id: userId,
        plan_id: planId,
        status: 'incomplete',
        razorpay_payment_link_id: data.id,
      });

    if (insertError) {
      console.error('Failed to insert user subscription:', JSON.stringify(insertError));
      return new Response(JSON.stringify({ error: 'Database Error', detail: insertError.message, code: insertError.code }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ short_url: data.short_url, id: data.id, amount: data.amount, currency: data.currency }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Unexpected error:', err);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});