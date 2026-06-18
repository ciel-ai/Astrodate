import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  // 1. Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 2. Validate environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      console.error("[delete-user-account] Missing env vars:", {
        hasUrl: !!supabaseUrl,
        hasAnon: !!supabaseAnonKey,
        hasService: !!supabaseServiceRoleKey,
      });
      throw new Error("Missing server environment variables");
    }

    // 3. Create regular client to verify user's JWT token
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization")! } },
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      console.error("[delete-user-account] Auth error:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Unauthorized request" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[delete-user-account] Deleting user:", user.id);

    // 4. Delete all user's photos from Storage first (prevents orphaned storage files)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: photos, error: photosQueryError } = await supabaseAdmin
      .from("user_photos")
      .select("storage_path")
      .eq("user_id", user.id);

    if (photosQueryError) {
      console.warn("[delete-user-account] Could not query photos:", photosQueryError.message);
    } else if (photos && photos.length > 0) {
      const paths = photos
        .map((p: { storage_path: string | null }) => p.storage_path)
        .filter(Boolean) as string[];

      if (paths.length > 0) {
        const { error: storageError } = await supabaseAdmin.storage
          .from("user-photos")
          .remove(paths);

        if (storageError) {
          console.warn("[delete-user-account] Storage delete error (non-fatal):", storageError.message);
        } else {
          console.log("[delete-user-account] Deleted", paths.length, "photos from storage");
        }
      }
    }

    // Also clean up message media files from messages bucket (folder named by user ID)
    const { data: msgFiles, error: msgListError } = await supabaseAdmin.storage
      .from("messages")
      .list(user.id, { limit: 200 });

    if (!msgListError && msgFiles && msgFiles.length > 0) {
      const msgPaths = msgFiles.map((f: { name: string }) => `${user.id}/${f.name}`);
      const { error: msgDeleteError } = await supabaseAdmin.storage
        .from("messages")
        .remove(msgPaths);
      if (msgDeleteError) {
        console.warn("[delete-user-account] Message storage delete error (non-fatal):", msgDeleteError.message);
      } else {
        console.log("[delete-user-account] Deleted", msgPaths.length, "message files from storage");
      }
    }

    // 5. Delete the user from auth.users (cascades to all related tables)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);

    if (deleteError) {
      console.error("[delete-user-account] Delete user error:", deleteError.message, deleteError);
      throw new Error(deleteError.message);
    }

    console.log("[delete-user-account] Successfully deleted user:", user.id);

    return new Response(
      JSON.stringify({ success: true, message: "User account deleted successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("[delete-user-account] Unhandled error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});