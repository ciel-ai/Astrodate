import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ClaimedJob = {
  id: string;
  user_id: string;
  candidate_user_id: string;
  retry_count: number;
};

type ProcessResult = {
  job_id: string;
  status: string;
  duration_ms: number;
  error?: string;
};

const MAX_BATCH_SIZE = 10;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startedAt = Date.now();
  const requestId = crypto.randomUUID();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("process-synastry-prewarm missing Supabase env", { requestId });
      return json({ error: "Server configuration error" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    const prewarmSecret = Deno.env.get("PREWARM_FUNCTION_SECRET");
    const providedSecret = req.headers.get("x-prewarm-secret");

    if (!authHeader && (!prewarmSecret || providedSecret !== prewarmSecret)) {
      console.warn("synastry prewarm unauthorized request", { requestId });
      return json({ error: "Unauthorized" }, 401);
    }

    if (authHeader) {
      const authClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false },
        global: { headers: { Authorization: authHeader } },
      });

      const { data: authData, error: authError } = await authClient.auth.getUser();

      if (authError || !authData.user) {
        console.warn("synastry prewarm invalid jwt", { requestId, authError });
        return json({ error: "Unauthorized" }, 401);
      }
    }

    const body = await readJson(req);
    const requestedBatchSize = Number(body?.batch_size ?? MAX_BATCH_SIZE);
    const batchSize = Math.min(
      Math.max(Number.isFinite(requestedBatchSize) ? requestedBatchSize : MAX_BATCH_SIZE, 1),
      MAX_BATCH_SIZE,
    );

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: jobs, error: claimError } = await supabase.rpc(
      "claim_synastry_prewarm_jobs",
      { p_limit: batchSize },
    );

    if (claimError) {
      console.error("synastry prewarm claim failed", { requestId, error: claimError });
      return json({ error: "Failed to claim jobs" }, 500);
    }

    const claimedJobs = (jobs ?? []) as ClaimedJob[];
    console.log("synastry prewarm batch claimed", {
      requestId,
      requestedBatchSize,
      batchSize,
      claimed: claimedJobs.length,
    });

    const results: ProcessResult[] = [];

    for (const job of claimedJobs) {
      const jobStartedAt = Date.now();
      console.log("synastry prewarm job started", {
        requestId,
        jobId: job.id,
        userId: job.user_id,
        candidateUserId: job.candidate_user_id,
        retryCount: job.retry_count,
      });

      const { data, error } = await supabase.rpc("process_synastry_prewarm_job", {
        p_job_id: job.id,
      });

      const durationMs = Date.now() - jobStartedAt;

      // Fire Ashtakoota computation asynchronously — don't await so the batch
      // doesn't block on the external Astrology API per-job.
      if (!error) {
        supabase.functions
          .invoke("compute-synastry", {
            body: {
              user_a_id: job.user_id,
              user_b_id: job.candidate_user_id,
            },
          })
          .catch((e: unknown) =>
            console.warn(
              "compute-synastry invoke failed for job",
              job.id,
              e instanceof Error ? e.message : String(e),
            ),
          );
      }

      if (error) {
        console.error("synastry prewarm job rpc failed", {
          requestId,
          jobId: job.id,
          durationMs,
          error,
        });

        const nextRetryCount = job.retry_count + 1;
        const nextStatus = nextRetryCount >= 3 ? "failed" : "pending";
        const { error: retryUpdateError } = await supabase
          .from("synastry_prewarm_jobs")
          .update({
            status: nextStatus,
            retry_count: nextRetryCount,
            last_error: error.message.slice(0, 1000),
            processed_at: nextStatus === "failed" ? new Date().toISOString() : null,
          })
          .eq("id", job.id);

        if (retryUpdateError) {
          console.error("synastry prewarm retry update failed", {
            requestId,
            jobId: job.id,
            retryUpdateError,
          });
        } else {
          console.warn("synastry prewarm rpc failure tracked", {
            requestId,
            jobId: job.id,
            nextStatus,
            nextRetryCount,
          });
        }

        results.push({
          job_id: job.id,
          status: "rpc_failed",
          duration_ms: durationMs,
          error: error.message,
        });
        continue;
      }

      const status = readStatus(data);

      if (status === "retry_scheduled") {
        console.warn("synastry prewarm job retry scheduled", {
          requestId,
          jobId: job.id,
          durationMs,
          result: data,
        });
      } else {
        console.log("synastry prewarm job completed", {
          requestId,
          jobId: job.id,
          durationMs,
          result: data,
        });
      }

      results.push({
        job_id: job.id,
        status,
        duration_ms: durationMs,
      });
    }

    const durationMs = Date.now() - startedAt;
    console.log("synastry prewarm batch finished", {
      requestId,
      claimed: claimedJobs.length,
      durationMs,
      processed: results.filter((result) => result.status === "processed").length,
      cacheFresh: results.filter((result) => result.status === "cache_fresh").length,
      retryScheduled: results.filter((result) => result.status === "retry_scheduled").length,
      rpcFailed: results.filter((result) => result.status === "rpc_failed").length,
    });

    return json({
      success: true,
      request_id: requestId,
      claimed: claimedJobs.length,
      duration_ms: durationMs,
      results,
    });
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    console.error("synastry prewarm unexpected failure", {
      requestId,
      durationMs,
      error: error instanceof Error ? error.message : String(error),
    });

    return json({ error: "Internal Server Error", request_id: requestId }, 500);
  }
});

async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  if (req.method === "GET") return null;

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return null;

  try {
    return await req.json();
  } catch {
    return null;
  }
}

function readStatus(value: unknown): string {
  if (value && typeof value === "object" && "status" in value) {
    const status = (value as { status?: unknown }).status;
    return typeof status === "string" ? status : "unknown";
  }

  return "unknown";
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
