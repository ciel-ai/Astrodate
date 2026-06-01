/**
 * useSubscriptionPayment
 *
 * A self-contained hook that owns the entire Razorpay payment flow, including
 * the BUG-07 race-condition fix.
 *
 * ── The Race Condition ───────────────────────────────────────────────────────
 * Payment flow:
 *   1. App creates a Razorpay payment link (via Edge Function).
 *   2. App opens it in the external browser.
 *   3. User pays and taps "Back" / the browser closes.
 *   4. App polls checkRazorpayPaymentLinkStatus().
 *   5. The razorpay-webhook Edge Function activates the subscription in DB.
 *
 * Steps 4 and 5 are concurrent and independent. A single poll at step 4 will
 * often fire before step 5 completes → false "payment failed" shown to the
 * user even though the webhook will activate them moments later.
 *
 * ── The Fix ──────────────────────────────────────────────────────────────────
 * After the browser closes, this hook:
 *   A) Opens a Supabase Realtime channel on the user's subscription row.
 *      When the webhook fires and sets status = 'active', the push arrives
 *      here instantly — this is the fast path, O(seconds).
 *   B) Concurrently runs an exponential-backoff retry loop as a safety net
 *      for environments where Realtime is unavailable or slow.
 *      Schedule: 3 s → 6 s → 12 s → 20 s → 30 s (≈ 71 s total, 5 attempts).
 *   C) Only sets status → 'failed' after ALL retries are exhausted AND the
 *      Realtime channel has not confirmed activation. The failure copy is
 *      deliberately soft ("Still verifying") because the webhook may still
 *      arrive after the polling window closes.
 *
 * ── Usage ────────────────────────────────────────────────────────────────────
 * ```tsx
 * const { paymentStatus, startPayment, resetPayment } = useSubscriptionPayment();
 *
 * // In your "Subscribe" button handler:
 * await startPayment({ planId, planName, amountPaise, userId, userEmail });
 *
 * // Show status to the user:
 * if (paymentStatus === 'pending')  { ... spinner ... }
 * if (paymentStatus === 'active')   { ... success ... }
 * if (paymentStatus === 'failed')   { ... soft retry prompt ... }
 * ```
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import {
  checkRazorpayPaymentLinkStatus,
  createRazorpayPaymentLink,
  openRazorpayPaymentLink,
  type PlanCheckoutPayload,
} from './razorpay';
import { releaseRealtimeChannel, trackRealtimeChannel } from './realtime-channels';
import { supabase } from './supabase';

// ── Types ────────────────────────────────────────────────────────────────────

export type PaymentStatus =
  | 'idle'      // No payment in flight
  | 'creating'  // Creating the Razorpay payment link
  | 'browser'   // Browser is open; waiting for user to pay
  | 'pending'   // Browser closed; verifying with retries + realtime
  | 'active'    // Subscription confirmed
  | 'failed';   // All retries exhausted; webhook may still arrive

export type StartPaymentOptions = PlanCheckoutPayload;

export interface UseSubscriptionPaymentReturn {
  paymentStatus: PaymentStatus;
  paymentError: string | null;
  startPayment: (options: StartPaymentOptions) => Promise<void>;
  resetPayment: () => void;
}

// ── Constants ────────────────────────────────────────────────────────────────

/**
 * Retry back-off intervals in milliseconds.
 * The first poll fires 3 s after the browser closes — enough time for the
 * user to land back on screen before the network round-trip.
 */
const POLL_INTERVALS_MS = [3_000, 6_000, 12_000, 20_000, 30_000];

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useSubscriptionPayment(): UseSubscriptionPaymentReturn {
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('idle');
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Refs that survive re-renders without causing them
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const activePaymentLinkIdRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);

  // ── Cleanup helper ─────────────────────────────────────────────────────────

  const stopPollingAndChannel = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (realtimeChannelRef.current) {
      releaseRealtimeChannel(supabase, realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }
  }, []);

  // ── Resolution helpers ─────────────────────────────────────────────────────

  const resolveActive = useCallback(() => {
    stopPollingAndChannel();
    if (isMountedRef.current) {
      setPaymentStatus('active');
      setPaymentError(null);
    }
  }, [stopPollingAndChannel]);

  const resolveFailed = useCallback(() => {
    stopPollingAndChannel();
    if (isMountedRef.current) {
      setPaymentStatus('failed');
      setPaymentError(
        'We could not confirm your subscription yet. If you completed payment, ' +
        'please wait a moment and check back. Contact support at hello@Astrodate.in if the issue persists.'
      );
    }
  }, [stopPollingAndChannel]);

  // ── Core: start retry loop + realtime channel ──────────────────────────────

  /**
   * Arms both verification mechanisms after the browser closes.
   * Call this with the paymentLinkId and the authenticated userId.
   */
  const startVerification = useCallback(
    (paymentLinkId: string, userId: string) => {
      stopPollingAndChannel();
      activePaymentLinkIdRef.current = paymentLinkId;
      if (isMountedRef.current) setPaymentStatus('pending');

      // ── A) Supabase Realtime: escape the race the moment the webhook fires ──
      //
      // The razorpay-webhook Edge Function calls process_razorpay_payment_link_paid(),
      // which UPDATEs user_subscriptions.status → 'active'. Realtime broadcasts
      // that change here and we resolve immediately — no polling needed in the
      // happy path.
      //
      // NOTE: user_subscriptions must be added to the supabase_realtime publication.
      // See migration 055_enable_subscription_realtime.sql.
      const channel = supabase
        .channel(`subscription-verify-${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'user_subscriptions',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            if (payload.new?.status === 'active') {
              resolveActive();
            }
          }
        )
        .subscribe((channelStatus) => {
          if (channelStatus === 'CHANNEL_ERROR') {
            // Realtime unavailable — the polling loop is the safety net; do nothing here.
            console.warn('[useSubscriptionPayment] Realtime channel error; relying on poll fallback.');
          }
        });
      realtimeChannelRef.current = trackRealtimeChannel(channel);

      // ── B) Exponential-backoff retry loop ──────────────────────────────────
      //
      // Runs concurrently with the Realtime channel. Each iteration polls the
      // razorpay-link-status Edge Function (which proxies to Razorpay's API).
      // Resolves early if the payment link shows 'paid'; otherwise waits for
      // the next scheduled tick. Only marks 'failed' when all attempts are
      // exhausted.

      let attempt = 0;

      const poll = async () => {
        // Realtime already resolved; bail out.
        if (!realtimeChannelRef.current) return;
        if (!isMountedRef.current) return;

        try {
          const result = await checkRazorpayPaymentLinkStatus(paymentLinkId);
          if (result?.status === 'paid') {
            resolveActive();
            return;
          }
        } catch (err) {
          console.warn(`[useSubscriptionPayment] Poll attempt ${attempt + 1} error:`, err);
        }

        attempt += 1;
        if (attempt < POLL_INTERVALS_MS.length) {
          pollTimerRef.current = setTimeout(poll, POLL_INTERVALS_MS[attempt]);
        } else {
          // All retries exhausted. The webhook may still be in flight.
          resolveFailed();
        }
      };

      // First poll fires after the shortest interval so the user has time
      // to land back on the screen before the network call.
      pollTimerRef.current = setTimeout(poll, POLL_INTERVALS_MS[0]);
    },
    [stopPollingAndChannel, resolveActive, resolveFailed]
  );

  // ── AppState listener: immediate check on foreground resume ────────────────
  //
  // If startVerification() was called before the browser opened (status =
  // 'browser'), this fires an extra poll the moment the app comes back to
  // the foreground — catching the case where the user paid very quickly and
  // returned before the first scheduled timer tick.

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const wasBackground =
        appStateRef.current === 'background' || appStateRef.current === 'inactive';
      const isNowActive = nextState === 'active';

      if (wasBackground && isNowActive) {
        if (paymentStatus === 'browser') {
          // Browser just closed — start the full verification machinery.
          if (activePaymentLinkIdRef.current && isMountedRef.current) {
            setPaymentStatus('pending');
          }
        } else if (paymentStatus === 'pending') {
          // Already verifying — fire an opportunistic immediate check without
          // waiting for the next scheduled retry tick.
          (async () => {
            if (!activePaymentLinkIdRef.current || !isMountedRef.current) return;
            try {
              const result = await checkRazorpayPaymentLinkStatus(
                activePaymentLinkIdRef.current
              );
              if (result?.status === 'paid') {
                resolveActive();
              }
            } catch (err) {
              console.warn('[useSubscriptionPayment] Foreground immediate check error:', err);
            }
          })();
        }
      }

      appStateRef.current = nextState;
    });

    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentStatus, resolveActive]);

  // ── Mount / unmount ────────────────────────────────────────────────────────

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopPollingAndChannel();
    };
  }, [stopPollingAndChannel]);

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Creates a payment link, opens the external browser, then arms both the
   * Realtime channel and the retry-polling loop so that whichever resolves
   * first (webhook push or poll) triggers the 'active' state.
   */
  const startPayment = useCallback(
    async (options: StartPaymentOptions) => {
      stopPollingAndChannel();
      activePaymentLinkIdRef.current = null;
      setPaymentError(null);

      if (isMountedRef.current) setPaymentStatus('creating');

      try {
        const { paymentLinkId, shortUrl } = await createRazorpayPaymentLink(options);
        activePaymentLinkIdRef.current = paymentLinkId;

        if (isMountedRef.current) setPaymentStatus('browser');

        // Arm verification BEFORE opening the browser so the Realtime channel
        // is subscribed by the time the webhook might fire.
        const userId = options.userId;
        if (!userId) throw new Error('userId is required for subscription verification');
        startVerification(paymentLinkId, userId);

        // Open the browser. This call resolves when the browser closes (iOS)
        // or immediately (Android). The AppState listener handles the resume.
        await openRazorpayPaymentLink(shortUrl);

        // On iOS, openBrowserAsync resolves after the browser is dismissed.
        // Flip to 'pending' here in case AppState didn't catch the transition.
        if (isMountedRef.current && paymentStatus !== 'active') {
          setPaymentStatus('pending');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[useSubscriptionPayment] startPayment error:', err);
        if (isMountedRef.current) {
          setPaymentStatus('failed');
          setPaymentError(message);
        }
        stopPollingAndChannel();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stopPollingAndChannel, startVerification]
  );

  const resetPayment = useCallback(() => {
    stopPollingAndChannel();
    activePaymentLinkIdRef.current = null;
    setPaymentStatus('idle');
    setPaymentError(null);
  }, [stopPollingAndChannel]);

  return { paymentStatus, paymentError, startPayment, resetPayment };
}
