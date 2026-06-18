import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// SEC: No CORS headers — this endpoint is called exclusively by RevenueCat
// servers (server-to-server POST). The Authorization header secret below is
// the only access control that matters.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RevenueCatEventType =
  | "INITIAL_PURCHASE"
  | "RENEWAL"
  | "CANCELLATION"
  | "EXPIRATION"
  | "BILLING_ISSUE"
  | "PRODUCT_CHANGE"
  | "SUBSCRIBER_ALIAS"
  | "TRANSFER"
  | "UNCANCELLATION"
  | string;

interface RevenueCatEvent {
  type: RevenueCatEventType;
  app_user_id: string;           // maps to our auth.users.id (set as RevenueCat appUserID)
  product_id: string;            // e.g. "astrodate_astroplus_monthly"
  entitlement_ids?: string[];    // e.g. ["astro_plus"]
  expiration_at_ms?: number | null;
  purchased_at_ms?: number;
  period_type?: string;          // "NORMAL" | "TRIAL" | "INTRO"
  store?: string;                // "APP_STORE" | "PLAY_STORE"
  is_family_share?: boolean;
}

interface RevenueCatWebhookBody {
  event: RevenueCatEvent;
  api_version: string;
}

// ---------------------------------------------------------------------------
// Plan slug normaliser
// Maps RevenueCat product_id / entitlement_id → our plan_catalog.plan_slug
// ---------------------------------------------------------------------------

function normalisePlanSlug(productId: string, entitlementIds?: string[]): string | null {
  // Try entitlement first — it's more stable than product IDs
  if (entitlementIds && entitlementIds.length > 0) {
    const ent = entitlementIds[0].toLowerCase();
    if (ent.includes("astro_x") || ent.includes("astrox")) return "astro_x";
    if (ent.includes("astro_plus") || ent.includes("astroplus")) return "astro_plus";
    // Attempt direct match against plan_catalog slugs
    return ent;
  }

  // Fall back to product_id pattern matching
  const pid = productId.toLowerCase();
  if (pid.includes("astrox") || pid.includes("astro_x")) return "astro_x";
  if (pid.includes("astroplus") || pid.includes("astro_plus")) return "astro_plus";

  return null;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // 1. Validate env vars
    const webhookSecret = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!webhookSecret || !supabaseUrl || !supabaseServiceKey) {
      console.error("Missing required environment variables");
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2. Verify the shared secret RevenueCat sends in the Authorization header
    //    RevenueCat sends: Authorization: <your_secret>
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || authHeader !== webhookSecret) {
      console.warn("RevenueCat webhook: invalid or missing Authorization header");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 3. Parse body
    const bodyText = await req.text();
    let body: RevenueCatWebhookBody;
    try {
      body = JSON.parse(bodyText);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const event = body?.event;
    if (!event || !event.type || !event.app_user_id) {
      return new Response(JSON.stringify({ error: "Malformed event" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`RevenueCat webhook received: ${event.type} for user ${event.app_user_id}`);

    // 4. Route event
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const userId = event.app_user_id; // We configure RevenueCat to use our auth UID

    switch (event.type) {
      case "INITIAL_PURCHASE":
        await handleInitialPurchase(supabase, userId, event);
        break;

      case "RENEWAL":
      case "UNCANCELLATION":
        await handleRenewal(supabase, userId, event);
        break;

      case "CANCELLATION":
        await handleStatusChange(supabase, userId, "canceled");
        break;

      case "EXPIRATION":
        await handleStatusChange(supabase, userId, "expired");
        break;

      case "BILLING_ISSUE":
        await handleStatusChange(supabase, userId, "past_due");
        break;

      default:
        // PRODUCT_CHANGE, TRANSFER, SUBSCRIBER_ALIAS, etc.
        console.log(`RevenueCat webhook: unhandled event type ${event.type} — skipping`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("RevenueCat webhook error:", err);
    // Return 200 so RevenueCat does not retry — retries on non-transient errors
    // would cause duplicate subscription activations. Investigate via logs.
    return new Response(JSON.stringify({ error: "Internal error", detail: String(err) }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
});

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handleInitialPurchase(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  event: RevenueCatEvent,
): Promise<void> {
  const planSlug = normalisePlanSlug(event.product_id, event.entitlement_ids);
  if (!planSlug) {
    console.error(`handleInitialPurchase: cannot resolve plan slug for product=${event.product_id}`);
    return;
  }

  // Resolve plan_id from plan_catalog
  const { data: plan, error: planErr } = await supabase
    .from("plan_catalog")
    .select("id, plan_slug, plan_badge")
    .eq("plan_slug", planSlug)
    .single();

  if (planErr || !plan) {
    console.error(`handleInitialPurchase: plan not found for slug=${planSlug}`, planErr);
    return;
  }

  const periodStart = event.purchased_at_ms
    ? new Date(event.purchased_at_ms).toISOString()
    : new Date().toISOString();

  const periodEnd = event.expiration_at_ms
    ? new Date(event.expiration_at_ms).toISOString()
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  // Check for existing subscription row
  const { data: existing } = await supabase
    .from("user_subscriptions")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("user_subscriptions")
      .update({
        plan_id: plan.id,
        status: "active",
        current_period_start: periodStart,
        current_period_end: periodEnd,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (error) console.error("handleInitialPurchase UPDATE error:", error);
  } else {
    const { error } = await supabase.from("user_subscriptions").insert({
      user_id: userId,
      plan_id: plan.id,
      status: "active",
      current_period_start: periodStart,
      current_period_end: periodEnd,
    });

    if (error) console.error("handleInitialPurchase INSERT error:", error);
  }

  // Sync plan_type on user_profiles
  await syncProfilePlanType(supabase, userId, planSlug);
  console.log(`handleInitialPurchase: activated ${planSlug} for user ${userId}`);
}

async function handleRenewal(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  event: RevenueCatEvent,
): Promise<void> {
  // If RevenueCat gives us the new expiration timestamp, use it.
  // Otherwise extend by 30 days from now as a safe fallback.
  const newPeriodEnd = event.expiration_at_ms
    ? new Date(event.expiration_at_ms).toISOString()
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  // Also resolve the plan in case this is a renewal on a changed product
  const planSlug = normalisePlanSlug(event.product_id, event.entitlement_ids);

  let planId: string | null = null;
  if (planSlug) {
    const { data: plan } = await supabase
      .from("plan_catalog")
      .select("id")
      .eq("plan_slug", planSlug)
      .single();
    planId = plan?.id ?? null;
  }

  const updatePayload: Record<string, unknown> = {
    status: "active",
    current_period_start: new Date().toISOString(),
    current_period_end: newPeriodEnd,
    updated_at: new Date().toISOString(),
  };
  if (planId) updatePayload.plan_id = planId;

  const { error } = await supabase
    .from("user_subscriptions")
    .update(updatePayload)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) console.error("handleRenewal UPDATE error:", error);

  // Ensure profile plan_type is correct (handles UNCANCELLATION reactivations)
  if (planSlug) await syncProfilePlanType(supabase, userId, planSlug);
  console.log(`handleRenewal: extended subscription to ${newPeriodEnd} for user ${userId}`);
}

async function handleStatusChange(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  status: "canceled" | "expired" | "past_due",
): Promise<void> {
  const { error } = await supabase
    .from("user_subscriptions")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) console.error(`handleStatusChange(${status}) UPDATE error:`, error);

  // Downgrade profile plan_type when subscription ends
  if (status === "canceled" || status === "expired") {
    await supabase
      .from("user_profiles")
      .update({ plan_type: "Free" })
      .eq("user_id", userId);
  }

  console.log(`handleStatusChange: set status=${status} for user ${userId}`);
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function syncProfilePlanType(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  planSlug: string,
): Promise<void> {
  const planType =
    planSlug === "astro_x" || planSlug.includes("astrox") ? "AstroX" : "Astro+";

  const { error } = await supabase
    .from("user_profiles")
    .update({ plan_type: planType })
    .eq("user_id", userId);

  if (error) console.error("syncProfilePlanType error:", error);
}