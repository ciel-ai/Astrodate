import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";

const EXPO_PUSH_SEND_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_PUSH_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";
const MAX_BATCH_SIZE = 50;
const EXPO_CHUNK_SIZE = 100;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-push-worker-secret",
};

type NotificationLog = {
  id: string;
  user_id: string;
  notification_type: "new_match" | "new_message" | "marketing";
  reference_id: string;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  attempt_count: number;
};

type PushToken = {
  id: string;
  user_id: string;
  expo_push_token: string;
};

type NotificationPreference = {
  user_id: string;
  new_matches_enabled: boolean;
  new_messages_enabled: boolean;
  marketing_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
};

type ExpoMessage = {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  sound: "default";
  priority: "default" | "high";
};

type ExpoTicket = {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
};

type SendMapping = {
  logId: string;
  token: string;
};

type AdminClient = ReturnType<typeof createClient<any>>;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("push worker missing Supabase env", { requestId });
      return json({ error: "Server configuration error" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    const workerSecret = Deno.env.get("PUSH_WORKER_SECRET");
    const providedSecret = req.headers.get("x-push-worker-secret");

    if (!authHeader && (!workerSecret || providedSecret !== workerSecret)) {
      console.warn("push worker unauthorized request", { requestId });
      return json({ error: "Unauthorized" }, 401);
    }

    if (authHeader) {
      const authClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false },
        global: { headers: { Authorization: authHeader } },
      });
      const { data, error } = await authClient.auth.getUser();
      if (error || !data.user) {
        console.warn("push worker invalid jwt", { requestId, error });
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

    const { data: claimed, error: claimError } = await supabase.rpc(
      "claim_notification_delivery_logs",
      { p_limit: batchSize },
    );

    if (claimError) {
      console.error("push worker claim failed", { requestId, error: claimError });
      return json({ error: "Failed to claim notifications" }, 500);
    }

    const logs = (claimed ?? []) as NotificationLog[];
    console.log("push worker claimed notifications", {
      requestId,
      batchSize,
      claimed: logs.length,
    });

    if (logs.length === 0) {
      return json({
        success: true,
        request_id: requestId,
        claimed: 0,
        duration_ms: Date.now() - startedAt,
      });
    }

    const userIds = [...new Set(logs.map((log) => log.user_id))];

    const [{ data: tokensData, error: tokensError }, { data: prefsData, error: prefsError }] =
      await Promise.all([
        supabase
          .from("user_push_tokens")
          .select("id,user_id,expo_push_token")
          .in("user_id", userIds)
          .eq("is_active", true),
        supabase
          .from("user_notification_preferences")
          .select("user_id,new_matches_enabled,new_messages_enabled,marketing_enabled,quiet_hours_start,quiet_hours_end")
          .in("user_id", userIds),
      ]);

    if (tokensError || prefsError) {
      console.error("push worker lookup failed", { requestId, tokensError, prefsError });
      await markManyFailed(
        supabase,
        logs,
        "Token or preference lookup failed",
      );
      return json({ error: "Lookup failed" }, 500);
    }

    const tokensByUser = groupByUser((tokensData ?? []) as PushToken[]);
    const prefsByUser = new Map(
      ((prefsData ?? []) as NotificationPreference[]).map((pref) => [pref.user_id, pref]),
    );

    const messages: ExpoMessage[] = [];
    const mappings: SendMapping[] = [];
    const skipped: string[] = [];
    const invalidTokens: string[] = [];

    for (const log of logs) {
      const preference = prefsByUser.get(log.user_id);
      if (!isNotificationEnabled(log, preference)) {
        await markSkipped(supabase, log.id, "Notification preference disabled");
        skipped.push(log.id);
        continue;
      }

      if (isQuietHours(preference)) {
        await markSkipped(supabase, log.id, "Quiet hours");
        skipped.push(log.id);
        continue;
      }

      const userTokens = tokensByUser.get(log.user_id) ?? [];
      const validTokens = userTokens.filter((token) => isLikelyExpoToken(token.expo_push_token));
      const badTokens = userTokens.filter((token) => !isLikelyExpoToken(token.expo_push_token));

      invalidTokens.push(...badTokens.map((token) => token.expo_push_token));

      if (validTokens.length === 0) {
        await markSkipped(supabase, log.id, "No active push tokens");
        skipped.push(log.id);
        continue;
      }

      for (const token of validTokens) {
        messages.push({
          to: token.expo_push_token,
          title: log.title,
          body: log.body,
          sound: "default",
          priority: "high",
          data: {
            ...log.payload,
            notification_log_id: log.id,
            notification_type: log.notification_type,
            reference_id: log.reference_id,
          },
        });
        mappings.push({ logId: log.id, token: token.expo_push_token });
      }
    }

    if (invalidTokens.length > 0) {
      await deactivateTokens(supabase, invalidTokens, "invalid token format", requestId);
    }

    const sendResults = await sendExpoMessages(messages, mappings, requestId);
    const receiptResults = await fetchExpoReceipts(
      sendResults.ticketIds,
      sendResults.ticketToLog,
      requestId,
    );
    const invalidReceiptTokens = receiptResults.invalidTicketIds
      .map((ticketId) => sendResults.ticketToToken.get(ticketId))
      .filter((token): token is string => Boolean(token));

    if (sendResults.invalidTokens.length > 0 || invalidReceiptTokens.length > 0) {
      await deactivateTokens(
        supabase,
        [...sendResults.invalidTokens, ...invalidReceiptTokens],
        "Expo rejected token",
        requestId,
      );
    }

    const outcomes = summarizeOutcomes(logs, sendResults, receiptResults);

    await Promise.all(
      outcomes.sent.map((outcome) =>
        supabase
          .from("notification_delivery_logs")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            expo_ticket_ids: outcome.ticketIds,
            expo_receipt_ids: outcome.receiptIds,
            error_message: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", outcome.logId)
      ),
    );

    await Promise.all(
      outcomes.failed.map((outcome) =>
        supabase
          .from("notification_delivery_logs")
          .update({
            status: outcome.nextAttemptCount >= 3 ? "failed" : "pending",
            attempt_count: outcome.nextAttemptCount,
            next_attempt_at: nextAttemptAt(outcome.nextAttemptCount),
            expo_ticket_ids: outcome.ticketIds,
            expo_receipt_ids: outcome.receiptIds,
            error_message: outcome.error,
            updated_at: new Date().toISOString(),
          })
          .eq("id", outcome.logId)
      ),
    );

    console.log("push worker finished", {
      requestId,
      claimed: logs.length,
      sent: outcomes.sent.length,
      failed: outcomes.failed.length,
      skipped: skipped.length,
      invalidTokens: sendResults.invalidTokens.length + invalidReceiptTokens.length + invalidTokens.length,
      durationMs: Date.now() - startedAt,
    });

    return json({
      success: true,
      request_id: requestId,
      claimed: logs.length,
      sent: outcomes.sent.length,
      failed: outcomes.failed.length,
      skipped: skipped.length,
      duration_ms: Date.now() - startedAt,
    });
  } catch (error) {
    console.error("push worker unexpected failure", {
      requestId,
      durationMs: Date.now() - startedAt,
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

function groupByUser(tokens: PushToken[]): Map<string, PushToken[]> {
  const grouped = new Map<string, PushToken[]>();
  for (const token of tokens) {
    const bucket = grouped.get(token.user_id) ?? [];
    bucket.push(token);
    grouped.set(token.user_id, bucket);
  }
  return grouped;
}

function isNotificationEnabled(
  log: NotificationLog,
  preference?: NotificationPreference,
): boolean {
  if (!preference) return true;
  if (log.notification_type === "new_match") return preference.new_matches_enabled;
  if (log.notification_type === "new_message") return preference.new_messages_enabled;
  if (log.notification_type === "marketing") return preference.marketing_enabled;
  return false;
}

function isQuietHours(preference?: NotificationPreference): boolean {
  if (!preference?.quiet_hours_start || !preference.quiet_hours_end) return false;

  const now = new Date();
  const current = now.getUTCHours() * 60 + now.getUTCMinutes();
  const start = parseTime(preference.quiet_hours_start);
  const end = parseTime(preference.quiet_hours_end);

  if (start === null || end === null || start === end) return false;
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}

function parseTime(value: string): number | null {
  const [hour, minute] = value.split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

function isLikelyExpoToken(token: string): boolean {
  return token.startsWith("ExpoPushToken[") || token.startsWith("ExponentPushToken[");
}

async function sendExpoMessages(
  messages: ExpoMessage[],
  mappings: SendMapping[],
  requestId: string,
) {
  const logTickets = new Map<string, string[]>();
  const logErrors = new Map<string, string[]>();
  const ticketToLog = new Map<string, string>();
  const ticketToToken = new Map<string, string>();
  const invalidTokens: string[] = [];
  const ticketIds: string[] = [];

  for (let start = 0; start < messages.length; start += EXPO_CHUNK_SIZE) {
    const chunk = messages.slice(start, start + EXPO_CHUNK_SIZE);
    const chunkMappings = mappings.slice(start, start + EXPO_CHUNK_SIZE);

    if (chunk.length === 0) continue;

    try {
      const response = await fetch(EXPO_PUSH_SEND_URL, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chunk),
      });

      const payload = await response.json();
      const tickets = Array.isArray(payload?.data) ? payload.data as ExpoTicket[] : [];

      if (!response.ok || tickets.length !== chunk.length) {
        console.error("Expo push chunk failed", {
          requestId,
          status: response.status,
          payload,
        });
        for (const mapping of chunkMappings) {
          addMapValue(logErrors, mapping.logId, `Expo send failed with status ${response.status}`);
        }
        continue;
      }

      tickets.forEach((ticket, index) => {
        const mapping = chunkMappings[index];
        if (ticket.status === "ok" && ticket.id) {
          addMapValue(logTickets, mapping.logId, ticket.id);
          ticketIds.push(ticket.id);
          ticketToLog.set(ticket.id, mapping.logId);
          ticketToToken.set(ticket.id, mapping.token);
          return;
        }

        const expoError = ticket.details?.error ?? ticket.message ?? "Expo ticket error";
        addMapValue(logErrors, mapping.logId, expoError);
        if (isInvalidTokenError(expoError)) {
          invalidTokens.push(mapping.token);
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Expo push chunk exception", { requestId, error: message });
      for (const mapping of chunkMappings) {
        addMapValue(logErrors, mapping.logId, message);
      }
    }
  }

  return { logTickets, logErrors, ticketIds, ticketToLog, ticketToToken, invalidTokens };
}

async function fetchExpoReceipts(
  ticketIds: string[],
  ticketToLog: Map<string, string>,
  requestId: string,
) {
  const logReceiptIds = new Map<string, string[]>();
  const logReceiptErrors = new Map<string, string[]>();
  const invalidTicketIds: string[] = [];

  if (ticketIds.length === 0) {
    return { logReceiptIds, logReceiptErrors, invalidTicketIds };
  }

  await delay(1000);

  for (let start = 0; start < ticketIds.length; start += EXPO_CHUNK_SIZE) {
    const ids = ticketIds.slice(start, start + EXPO_CHUNK_SIZE);

    try {
      const response = await fetch(EXPO_PUSH_RECEIPTS_URL, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids }),
      });
      const payload = await response.json();

      if (!response.ok) {
        console.warn("Expo receipt lookup failed", {
          requestId,
          status: response.status,
          payload,
        });
        continue;
      }

      const receipts = payload?.data ?? {};
      for (const id of ids) {
        const receipt = receipts[id];
        if (!receipt) continue;

        const logId = ticketToLog.get(id);
        if (!logId) continue;

        if (receipt.status === "ok") {
          addMapValue(logReceiptIds, logId, id);
        } else if (receipt.status === "error") {
          const expoError = receipt.details?.error ?? receipt.message ?? "Expo receipt error";
          addMapValue(logReceiptErrors, logId, expoError);
          if (isInvalidTokenError(expoError)) invalidTicketIds.push(id);
        }
      }
    } catch (error) {
      console.warn("Expo receipt lookup exception", {
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { logReceiptIds, logReceiptErrors, invalidTicketIds };
}

function summarizeOutcomes(
  logs: NotificationLog[],
  sendResults: Awaited<ReturnType<typeof sendExpoMessages>>,
  receiptResults: Awaited<ReturnType<typeof fetchExpoReceipts>>,
) {
  const sent: Array<{ logId: string; ticketIds: string[]; receiptIds: string[] }> = [];
  const failed: Array<{
    logId: string;
    nextAttemptCount: number;
    ticketIds: string[];
    receiptIds: string[];
    error: string;
  }> = [];

  for (const log of logs) {
    const ticketIds = sendResults.logTickets.get(log.id) ?? [];
    const sendErrors = sendResults.logErrors.get(log.id) ?? [];
    const receiptErrors: string[] = [];

    const okReceiptIds = receiptResults.logReceiptIds.get(log.id) ?? [];
    const receiptIds = okReceiptIds;

    const receiptError = receiptResults.logReceiptErrors.get(log.id);
    if (receiptError) receiptErrors.push(...receiptError);

    if (ticketIds.length > 0 && receiptErrors.length === 0) {
      sent.push({ logId: log.id, ticketIds, receiptIds });
      continue;
    }

    if (sendErrors.length > 0 || receiptErrors.length > 0) {
      failed.push({
        logId: log.id,
        nextAttemptCount: log.attempt_count + 1,
        ticketIds,
        receiptIds,
        error: [...sendErrors, ...receiptErrors].join("; ").slice(0, 1000),
      });
    }
  }

  return { sent, failed };
}

function isInvalidTokenError(error: string): boolean {
  return error === "DeviceNotRegistered"
    || error === "InvalidCredentials"
    || error.toLowerCase().includes("device not registered")
    || error.toLowerCase().includes("invalid");
}

async function deactivateTokens(
  supabase: AdminClient,
  tokens: string[],
  reason: string,
  requestId: string,
) {
  const uniqueTokens = [...new Set(tokens)];
  if (uniqueTokens.length === 0) return;

  const { error } = await supabase
    .from("user_push_tokens")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .in("expo_push_token", uniqueTokens);

  if (error) {
    console.error("invalid token cleanup failed", { requestId, reason, error });
  } else {
    console.log("invalid tokens deactivated", {
      requestId,
      reason,
      count: uniqueTokens.length,
    });
  }
}

async function markSkipped(
  supabase: AdminClient,
  logId: string,
  reason: string,
) {
  await supabase
    .from("notification_delivery_logs")
    .update({
      status: "skipped",
      error_message: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", logId);
}

async function markManyFailed(
  supabase: AdminClient,
  logs: NotificationLog[],
  error: string,
) {
  await Promise.all(
    logs.map((log) =>
      supabase
        .from("notification_delivery_logs")
        .update({
          status: log.attempt_count + 1 >= 3 ? "failed" : "pending",
          attempt_count: log.attempt_count + 1,
          next_attempt_at: nextAttemptAt(log.attempt_count + 1),
          error_message: error,
          updated_at: new Date().toISOString(),
        })
        .eq("id", log.id)
    ),
  );
}

function nextAttemptAt(attemptCount: number): string {
  const delaySeconds = Math.min(60 * 10, 2 ** attemptCount * 30);
  return new Date(Date.now() + delaySeconds * 1000).toISOString();
}

function addMapValue(map: Map<string, string[]>, key: string, value: string) {
  const values = map.get(key) ?? [];
  values.push(value);
  map.set(key, values);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
