import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import Purchases, { PURCHASES_ERROR_CODE } from 'react-native-purchases';
import {
  REVENUECAT_API_KEY_IOS,
  REVENUECAT_PRODUCT_IDS,
  type RevenueCatPlanSlug,
} from './iap-products';
import {
  checkRazorpayPaymentLinkStatus,
  createRazorpayPaymentLink,
  openRazorpayPaymentLink,
  type PlanCheckoutPayload,
} from './razorpay';
import { releaseRealtimeChannel, trackRealtimeChannel } from './realtime-channels';
import { supabase } from './supabase';
import type { Json } from './database.types';

export type PaymentStatus = 'idle' | 'creating' | 'browser' | 'pending' | 'active' | 'failed';

export type StartPaymentOptions = PlanCheckoutPayload & {
  planSlug?: RevenueCatPlanSlug;
};

export interface UseSubscriptionPaymentReturn {
  paymentStatus: PaymentStatus;
  paymentError: string | null;
  startPayment: (options: StartPaymentOptions) => Promise<void>;
  resetPayment: () => void;
  restorePurchases: () => Promise<boolean>;
}

const POLL_INTERVALS_MS = [3_000, 6_000, 12_000, 20_000, 30_000];

let revenueCatConfigured = false;

export function ensureRevenueCatConfigured() {
  if (revenueCatConfigured) return;
  if (!REVENUECAT_API_KEY_IOS) {
    throw new Error('RevenueCat iOS API key is missing.');
  }
  Purchases.configure({ apiKey: REVENUECAT_API_KEY_IOS });
  revenueCatConfigured = true;
}

function getRevenueCatPlanSlug(options: StartPaymentOptions): RevenueCatPlanSlug | null {
  if (options.planSlug) return options.planSlug;
  if (options.planName.toLowerCase().includes('astrox') || options.amountPaise === 59900) {
    return 'astro_x';
  }
  if (options.planName.toLowerCase().includes('astro+') || options.amountPaise === 29900) {
    return 'astro_plus';
  }
  return null;
}

function isPurchaseCancelled(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function toJson(value: unknown): Json {
  if (value === null) {
    return null;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(toJson);
  }
  if (typeof value === 'object') {
    const record: Record<string, Json> = {};
    for (const [key, item] of Object.entries(value)) {
      record[key] = toJson(item);
    }
    return record;
  }
  return null;
}

export function useSubscriptionPayment(): UseSubscriptionPaymentReturn {
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('idle');
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const activePaymentLinkIdRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);

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

  const startVerification = useCallback(
    (paymentLinkId: string, userId: string) => {
      stopPollingAndChannel();
      activePaymentLinkIdRef.current = paymentLinkId;
      if (isMountedRef.current) setPaymentStatus('pending');

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
            console.warn('[useSubscriptionPayment] Realtime channel error; relying on poll fallback.');
          }
        });
      realtimeChannelRef.current = trackRealtimeChannel(channel);

      let attempt = 0;

      const poll = async () => {
        if (!realtimeChannelRef.current) return;
        if (!isMountedRef.current) return;

        try {
          const result = await checkRazorpayPaymentLinkStatus(paymentLinkId);
          if (result?.status === 'paid') {
            resolveActive();
            return;
          }
        } catch (error) {
          console.warn(`[useSubscriptionPayment] Poll attempt ${attempt + 1} error:`, error);
        }

        attempt += 1;
        if (attempt < POLL_INTERVALS_MS.length) {
          pollTimerRef.current = setTimeout(poll, POLL_INTERVALS_MS[attempt]);
        } else {
          resolveFailed();
        }
      };

      pollTimerRef.current = setTimeout(poll, POLL_INTERVALS_MS[0]);
    },
    [stopPollingAndChannel, resolveActive, resolveFailed]
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const wasBackground =
        appStateRef.current === 'background' || appStateRef.current === 'inactive';
      const isNowActive = nextState === 'active';

      if (wasBackground && isNowActive && paymentStatus === 'pending') {
        void (async () => {
          if (!activePaymentLinkIdRef.current || !isMountedRef.current) return;
          try {
            const result = await checkRazorpayPaymentLinkStatus(activePaymentLinkIdRef.current);
            if (result?.status === 'paid') {
              resolveActive();
            }
          } catch (error) {
            console.warn('[useSubscriptionPayment] Foreground immediate check error:', error);
          }
        })();
      }

      appStateRef.current = nextState;
    });

    return () => sub.remove();
  }, [paymentStatus, resolveActive]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopPollingAndChannel();
    };
  }, [stopPollingAndChannel]);

  const startPayment = useCallback(
    async (options: StartPaymentOptions) => {
      stopPollingAndChannel();
      activePaymentLinkIdRef.current = null;
      setPaymentError(null);
      if (isMountedRef.current) setPaymentStatus('pending');

      if (Platform.OS === 'ios') {
        try {
          const planSlug = getRevenueCatPlanSlug(options);
          if (!planSlug) {
            throw new Error('This subscription plan is not available for iOS purchases yet.');
          }

          ensureRevenueCatConfigured();
          const productId = REVENUECAT_PRODUCT_IDS[planSlug];
          const offerings = await Purchases.getOfferings();
          const allPackages = Object.values(offerings.all).flatMap((offering) => offering.availablePackages);
          const selectedPackage = allPackages.find(
            (candidate) => candidate.product.identifier === productId
          );

          if (!selectedPackage) {
            throw new Error(`RevenueCat package not found for product ${productId}.`);
          }

          const { customerInfo } = await Purchases.purchasePackage(selectedPackage);
          if (!customerInfo.activeSubscriptions.includes(productId)) {
            throw new Error('Purchase completed, but no active subscription was returned.');
          }

          if (isMountedRef.current) {
            setPaymentStatus('active');
            setPaymentError(null);
          }
        } catch (error) {
          if (isPurchaseCancelled(error)) {
            if (isMountedRef.current) {
              setPaymentStatus('idle');
              setPaymentError(null);
            }
            return;
          }

          if (isMountedRef.current) {
            setPaymentStatus('failed');
            setPaymentError(getErrorMessage(error));
          }
        }
        return;
      }

      try {
        if (isMountedRef.current) setPaymentStatus('creating');
        const { paymentLinkId, shortUrl } = await createRazorpayPaymentLink(options);
        activePaymentLinkIdRef.current = paymentLinkId;

        const userId = options.userId;
        if (!userId) throw new Error('userId is required for subscription verification');
        startVerification(paymentLinkId, userId);

        if (isMountedRef.current) setPaymentStatus('browser');
        await openRazorpayPaymentLink(shortUrl);

        if (isMountedRef.current && paymentStatus !== 'active') {
          setPaymentStatus('pending');
        }
      } catch (error) {
        const message = getErrorMessage(error);
        console.error('[useSubscriptionPayment] startPayment error:', error);
        if (isMountedRef.current) {
          setPaymentStatus('failed');
          setPaymentError(message);
        }
        stopPollingAndChannel();
      }
    },
    [paymentStatus, startVerification, stopPollingAndChannel]
  );

  const restorePurchases = useCallback(async () => {
    if (Platform.OS === 'ios') {
      ensureRevenueCatConfigured();
      const customerInfo = await Purchases.restorePurchases();
      const activeEntitlements = Object.keys(customerInfo.entitlements.active);
      if (activeEntitlements.length > 0) {
        await supabase.rpc('sync_ios_subscription', {
          entitlement_id: activeEntitlements[0],
        });
      }
      return activeEntitlements.length > 0;
    }

    const { data, error } = await supabase.functions.invoke('razorpay-link-status', {});
    return (
      !error &&
      typeof data === 'object' &&
      data !== null &&
      'status' in data &&
      data.status === 'active'
    );
  }, []);

  const resetPayment = useCallback(() => {
    stopPollingAndChannel();
    activePaymentLinkIdRef.current = null;
    setPaymentStatus('idle');
    setPaymentError(null);
  }, [stopPollingAndChannel]);

  return { paymentStatus, paymentError, startPayment, resetPayment, restorePurchases };
}
