import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// Web Crypto API is available natively in Deno

// SEC-03: No CORS headers here. This endpoint is called exclusively by Razorpay's
// servers via server-to-server POST — never by a browser. Adding CORS headers
// (especially Access-Control-Allow-Origin: *) would be a misleading code smell
// and could confuse automated security scanners into thinking this endpoint
// accepts cross-origin browser requests.
//
// The x-razorpay-signature HMAC-SHA256 verification below is the only access
// control that matters for this endpoint.

function hexToBytes(hex: string): Uint8Array {
  if (!/^[0-9a-f]{64}$/i.test(hex)) {
    throw new Error("Malformed Razorpay signature");
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < hex.length; index += 2) {
    bytes[index / 2] = parseInt(hex.slice(index, index + 2), 16);
  }
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req: Request) => {
  // Razorpay only sends POST requests — reject everything else immediately.
  // We do not handle OPTIONS/preflight because this endpoint is never called
  // from a browser (SEC-03).
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // 2. Validate environment variables
    const webhookSecret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
    if (!webhookSecret) {
      throw new Error("Missing RAZORPAY_WEBHOOK_SECRET");
    }

    // 3. Get signature from headers
    const signature = req.headers.get("x-razorpay-signature");
    if (!signature) {
      return new Response(JSON.stringify({ error: "Missing signature" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 4. Read body as raw text for signature verification
    const bodyText = await req.text();

    // 5. Verify Razorpay Signature (HMAC-SHA256)
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(webhookSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    let signatureBytes: Uint8Array;
    try {
      signatureBytes = hexToBytes(signature);
    } catch (signatureError) {
      console.error("Malformed Razorpay webhook signature:", signatureError);
      return new Response(JSON.stringify({ error: "Malformed signature" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      toArrayBuffer(signatureBytes),
      encoder.encode(bodyText)
    );

    if (!isValid) {
      console.error("Invalid Razorpay webhook signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 6. Parse the verified payload
    const payload = JSON.parse(bodyText);
    const event = payload?.event;
    console.log('Verified Razorpay Webhook Event:', event);

    // Setup service role Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const adminClient = createClient(supabaseUrl, serviceKey);

    if (event === 'payment_link.paid') {
      const paymentLink = payload?.payload?.payment_link?.entity;
      const payment = payload?.payload?.payment?.entity;
      const userId = paymentLink?.notes?.user_id;
      const planId = paymentLink?.notes?.plan_id;
      const paymentLinkId = paymentLink?.id;
      const paymentId = payment?.id;
      const orderId = payment?.order_id ?? paymentLink?.order_id ?? null;
      const webhookEventId = paymentId
        ? `payment_link.paid:${paymentId}`
        : orderId
          ? `payment_link.paid:${orderId}`
          : paymentLinkId
            ? `payment_link.paid:${paymentLinkId}`
            : null;

      if (!userId || !planId || !paymentLinkId || !webhookEventId) {
        console.error('Missing userId, planId, paymentLinkId, or webhookEventId in webhook payload');
        // Still return 200 to Razorpay so it does not retry
        return new Response(JSON.stringify({ status: 'ok' }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      const payloadHash = await sha256Hex(bodyText);
      const { data: activationResult, error: activationError } = await adminClient.rpc(
        'process_razorpay_payment_link_paid',
        {
          p_webhook_event_id: webhookEventId,
          p_payment_id: paymentId ?? null,
          p_order_id: orderId,
          p_payment_link_id: paymentLinkId,
          p_user_id: userId,
          p_plan_id: planId,
          p_payload_hash: payloadHash,
        },
      );

      if (activationError) {
        console.error('Failed to process Razorpay payment_link.paid webhook:', activationError);
        return new Response(JSON.stringify({ error: 'Webhook processing failed' }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }

      console.log('Razorpay payment_link.paid processing result:', activationResult);

    } else if (event === 'payment_link.expired' || event === 'payment.failed') {
      const paymentLinkId = payload?.payload?.payment_link?.entity?.id;
      if (paymentLinkId) {
        await adminClient
          .from('user_subscriptions')
          .update({ status: 'expired', updated_at: new Date().toISOString() })
          .eq('razorpay_payment_link_id', paymentLinkId)
          .eq('status', 'incomplete');
      }
    }

    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});