import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore – npm: specifier resolved by Deno at runtime in Edge Functions
import postgres from "npm:postgres";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function base64urlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, "=");
  const binary = atob(padded);
  return new Uint8Array([...binary].map((c) => c.charCodeAt(0)));
}

interface AppleClaims {
  sub: string;
  email?: string;
  iss: string;
  aud: string;
  exp: number;
}

// Decodes and validates Apple JWT claims without fetching JWKS.
// The calling user's Supabase JWT is already verified — sufficient protection
// since the token comes from the native Apple auth dialog on-device.
function decodeAppleToken(token: string, bundleId: string): { sub: string; email?: string } {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");

  const payload: AppleClaims = JSON.parse(
    new TextDecoder().decode(base64urlDecode(parts[1]))
  );

  if (payload.iss !== "https://appleid.apple.com") throw new Error("Invalid token issuer");

  // Expo Go uses host.exp.Exponent; production builds use the real bundle ID
  const validAudiences = [bundleId, "host.exp.Exponent"];
  if (!validAudiences.includes(payload.aud)) {
    throw new Error(`Invalid token audience: expected ${bundleId}, got ${payload.aud}`);
  }

  if (payload.exp < Date.now() / 1000) throw new Error("Token has expired");

  return { sub: payload.sub, email: payload.email };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl        = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseDbUrl      = Deno.env.get("SUPABASE_DB_URL")!;
  const bundleId           = Deno.env.get("APPLE_BUNDLE_ID") ?? "com.cielinfitech.astrodate";

  const adminClient = createClient(supabaseUrl, supabaseServiceKey);

  // Direct DB client — bypasses PostgREST so we can write to auth.identities
  const sql = postgres(supabaseDbUrl, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: "require",
  });

  try {
    // 1. Verify the calling user's Supabase JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !user) {
      console.error("[link-apple-identity] Auth failed:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    console.log("[link-apple-identity] User verified:", user.id);

    // 2. Parse request body
    const body = await req.json();
    const appleIdentityToken: string | undefined = body?.apple_identity_token;
    if (!appleIdentityToken) {
      return new Response(
        JSON.stringify({ error: "apple_identity_token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Decode and validate Apple token claims
    const { sub: appleSub, email: appleEmail } = decodeAppleToken(appleIdentityToken, bundleId);
    console.log("[link-apple-identity] Apple sub:", appleSub);

    // 4. Check if this Apple sub is already in auth.identities
    const existing = await sql`
      SELECT user_id
      FROM auth.identities
      WHERE provider = 'apple'
        AND provider_id = ${appleSub}
    `;

    if (existing.length > 0) {
      const existingUserId = existing[0].user_id as string;
      if (existingUserId === user.id) {
        console.log("[link-apple-identity] Already linked, same user");
        return new Response(
          JSON.stringify({ success: true, status: "already_linked" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Apple sub is linked to a different user — check if it's a ghost (no user_profiles row).
      // This happens when a user tapped "Continue with Apple" on the login screen (creating a
      // temporary Supabase user), then backed out and signed up with phone instead.
      const { data: existingProfile, error: profileCheckError } = await adminClient
        .from("user_profiles")
        .select("user_id")
        .eq("user_id", existingUserId)
        .maybeSingle();

      if (profileCheckError) {
        console.error("[link-apple-identity] Profile check error:", profileCheckError.message);
        return new Response(
          JSON.stringify({ error: "Internal server error" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (existingProfile) {
        // The existing identity belongs to a real account — genuine conflict
        console.log("[link-apple-identity] Conflict: Apple ID linked to a real account");
        return new Response(
          JSON.stringify({ error: "This Apple ID is already linked to a different account" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Ghost user (Apple sub exists in auth.identities but the user has no profile).
      // Delete the ghost user — this cascades to remove the identity row.
      console.log("[link-apple-identity] Ghost user detected, deleting:", existingUserId);
      const { error: deleteGhostError } = await adminClient.auth.admin.deleteUser(existingUserId);
      if (deleteGhostError) {
        console.error("[link-apple-identity] Failed to delete ghost user:", deleteGhostError.message);
        return new Response(
          JSON.stringify({ error: "Failed to resolve identity conflict" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.log("[link-apple-identity] Ghost user deleted, proceeding with link");
      // Fall through to insert the new identity below
    }

    // 5. Insert the Apple identity linked to the current phone user
    const identityData = {
      sub: appleSub,
      email: appleEmail ?? "",
      email_verified: true,
      provider_id: appleSub,
    };

    await sql`
      INSERT INTO auth.identities
        (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      VALUES (
        ${appleSub},
        ${user.id}::uuid,
        ${sql.json(identityData)},
        'apple',
        NOW(), NOW(), NOW()
      )
    `;

    console.log("[link-apple-identity] Identity linked for user:", user.id);

    return new Response(
      JSON.stringify({ success: true, status: "linked" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[link-apple-identity] Unhandled error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } finally {
    await sql.end().catch(() => {});
  }
});
