import { GlobalAuthAlertModal } from '@/components/global-auth-alert-modal';
import { ErrorBoundary } from '@/components/error-boundary';
import { AuthAlertProvider } from '@/lib/auth-alert-context';
import { SubscriptionProvider } from '@/hooks/useSubscriptionStatus';
import { ensureRevenueCatConfigured } from '@/lib/useSubscriptionPayment';
import { OfflineBanner } from '@/components/OfflineBanner';
import type { Tables } from '@/lib/database.types';
import { cleanupOldMessages } from '@/lib/messages';
import { drainPendingPushNotifications, setupNotificationListeners, syncPushTokenForCurrentUser } from '@/lib/notifications';
import { updateOnlineStatus } from '@/lib/online-status';
import { releaseAllOwnedRealtimeChannels } from '@/lib/realtime-channels';
import { supabase } from '@/lib/supabase';
import { resetGlobalTypingChannel } from '@/lib/typing-status';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter, useSegments, useRootNavigationState, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState, useCallback } from 'react';
import { ActivityIndicator, AppState, AppStateStatus, Platform, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-reanimated';

SplashScreen.preventAutoHideAsync();

const STARTUP_HARD_TIMEOUT_MS = 12_000;
type ProfileLookupResult = {
  data: Pick<Tables<'user_profiles'>, 'user_id'> | null;
  error: unknown;
};

function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [isReady, setIsReady] = useState(false);
  const hasNavigatedRef = useRef(false);
  const isMountedRef = useRef(true);
  const hardTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const segmentsRef = useRef<string[]>([]);
  const isReadyRef = useRef(false);
  const lastRouteRef = useRef<string | null>(null);
  const navigationInFlightRef = useRef(false);
  const processedDeepLinkRef = useRef<string | null>(null);

  const rootNavigationState = useRootNavigationState();
  const isNavigationReady = rootNavigationState?.key != null;
  const [bootRoute, setBootRoute] = useState<Href | null>(null);

  const markReady = useCallback(() => {
    if (!isMountedRef.current || isReadyRef.current) return;
    isReadyRef.current = true;
    setIsReady(true);
  }, []);

  const hideSplashSafely = useCallback(() => {
    SplashScreen.hideAsync().catch(() => { });
  }, []);

  const routeFromSegments = useCallback(() => {
    const current = segmentsRef.current;
    return current.length ? `/${current.join('/')}` : '/';
  }, []);

  const safeReplace = useCallback((route: Href) => {
    if (!isMountedRef.current) return;
    const nextRoute = String(route);
    const currentRoute = routeFromSegments();
    if (navigationInFlightRef.current || lastRouteRef.current === nextRoute || currentRoute === nextRoute) return;

    console.log('[Nav] redirect', nextRoute);

    navigationInFlightRef.current = true;
    lastRouteRef.current = nextRoute;
    router.replace(route);
    setTimeout(() => {
      navigationInFlightRef.current = false;
    }, 0);
  }, [router, routeFromSegments]);

  const finishBoot = useCallback((route: Href) => {
    if (!isMountedRef.current || hasNavigatedRef.current) return;
    hasNavigatedRef.current = true;
    
    // Defer deep link / normal boot navigation until navigation state is mounted
    setBootRoute(route);

    markReady();
    hideSplashSafely();
    if (hardTimeoutRef.current) {
      clearTimeout(hardTimeoutRef.current);
      hardTimeoutRef.current = null;
    }
  }, [markReady, hideSplashSafely]);

  useEffect(() => {
    segmentsRef.current = [...segments];
  }, [segments]);

  // ─── BOOT EFFECT ────────────────────────────────────────────────────────────
  //
  // ROOT CAUSE OF INFINITE LOOP (fixed here):
  //
  // BUG 1 — segments in deps: old useEffect([router, segments]) re-ran on every
  // navigation. Each router.replace changed segments → effect re-ran →
  // checkUserSession fired again → another replace → infinite cycle.
  //
  // BUG 2 — Stack not mounted during spinner: old code returned ONLY the spinner
  // View when isLoading=true, so the Stack navigator didn't exist when
  // router.replace fired → navigation was silently dropped → spinner forever.
  //
  // BUG 3 — SIGNED_IN event handling: old onAuthStateChange responded to
  // SIGNED_IN, which fires when Supabase restores a session from AsyncStorage
  // on cold start. This triggered state updates → re-renders → segments changed
  // → useEffect re-ran → boot loop.
  //
  // FIX: empty deps [], Stack always mounted, spinner is an overlay, SIGNED_IN ignored.

  useEffect(() => {
    isMountedRef.current = true;

    // TEMPORARY FIX: Clear corrupted session storage
    // NOTE: This was causing returning users to be logged out on cold start
    // because it wiped persisted Supabase sessions. Keep this DEV-only so
    // it never runs in production builds. See PR/Hotfix notes.
    // if (__DEV__) {
    //   AsyncStorage.clear().catch(() => { });
    // }

    // Helper to detect if a session token is present locally without hitting network
    const checkLocalSession = async () => {
      try {
        const keys = await AsyncStorage.getAllKeys();
        return keys.some(k => k.includes('-auth-token'));
      } catch {
        return false;
      }
    };

    // Hard safety net: if Supabase/network hangs beyond 12s, render anyway
    hardTimeoutRef.current = setTimeout(async () => {
      console.warn('⚠️ [Layout] Startup hard timeout — forcing render');
      const hasSession = await checkLocalSession();
      finishBoot(hasSession ? '/(tabs)' : '/onboarding/welcome');
    }, STARTUP_HARD_TIMEOUT_MS);

    const bootstrap = async () => {
      try {
        await ensureRevenueCatConfigured(); // init once here

        // ── Cold-start Deep Link Interception ───────────────────────────────────
        // If the app was launched by clicking a deep link (OAuth callback or email verify),
        // we intercept it here to bypass the standard boot routing (welcome or tabs).
        // This prevents the React Navigation routing crash by routing directly via finishBoot.
        try {
          const initialUrl = await Linking.getInitialURL();
          if (initialUrl && initialUrl.startsWith('astrodate://')) {
            console.log('🔗 [Layout] Initial URL detected during bootstrap:', initialUrl);
            const hasStrictType = initialUrl.includes('&type=') || initialUrl.includes('?type=');
            const isEmailVerificationLink = 
              initialUrl.includes('auth/verify') ||
              (initialUrl.includes('token_hash') && hasStrictType) ||
              (initialUrl.includes('access_token') && hasStrictType);

            const isAuthCallbackLink = initialUrl.includes('auth/callback');

            if (isEmailVerificationLink) {
              console.log('🔗 [Layout] Cold-start email verification link routed directly');
              try {
                WebBrowser.dismissBrowser();
              } catch (e) { console.warn('[WebBrowser] dismissBrowser failed:', e); }
              finishBoot(`/auth/verify?url=${encodeURIComponent(initialUrl)}` as Href);
              return;
            } else if (isAuthCallbackLink) {
              console.log('🔗 [Layout] Cold-start OAuth callback link routed directly');
              try {
                WebBrowser.dismissBrowser();
              } catch (e) { console.warn('[WebBrowser] dismissBrowser failed:', e); }
              finishBoot(`/auth/callback?url=${encodeURIComponent(initialUrl)}` as Href);
              return;
            }
          }
        } catch (coldStartErr) {
          console.warn('[Layout] Cold-start deep link check failed (non-fatal):', coldStartErr);
        }

        // Session check — 8s timeout
        const sessionResult = await Promise.race([
          supabase.auth.getSession(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('session timeout')), 8_000)
          ),
        ]) as Awaited<ReturnType<typeof supabase.auth.getSession>>;

        if (!isMountedRef.current) return;

        const session = sessionResult?.data?.session;

        if (!session?.user?.id) {
          finishBoot('/onboarding/welcome');
          return;
        }

        // Verify with server that user actually exists (avows stale/deleted user sessions)
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          console.warn('[Layout] Session validation failed (user may be deleted):', userError?.message);
          await supabase.auth.signOut();
          finishBoot('/onboarding/welcome');
          return;
        }

        syncPushTokenForCurrentUser().catch((error) => {
          console.warn('[Layout] push token sync non-fatal error:', error);
        });
        drainPendingPushNotifications().catch(() => { });
        supabase.functions.invoke('resign-photos').catch(() => { });

        // Profile check — 5s timeout
        const profileResult = await Promise.race([
          supabase
            .from('user_profiles')
            .select('user_id')
            .eq('user_id', session.user.id)
            .maybeSingle(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('profile timeout')), 5_000)
          ),
        ]) as ProfileLookupResult;

        if (!isMountedRef.current) return;

        finishBoot(profileResult?.data ? '/(tabs)' : '/onboarding/basic-details');
      } catch (err: any) {
        console.error('[Layout] Bootstrap error (non-fatal):', err);
        if (isMountedRef.current) {
          if (err?.message === 'session timeout' || err?.message === 'profile timeout') {
            // They have a local session trying to refresh over a poor network. 
            // Send them to the main app where offline state/retry logic can handle it.
            finishBoot('/(tabs)');
          } else {
            finishBoot('/onboarding/welcome');
          }
        }
      }
    };

    bootstrap();

    // Only handle SIGNED_OUT — SIGNED_IN intentionally ignored (see BUG 3 above)
    const { data: authSub } = supabase.auth.onAuthStateChange((event) => {
      console.log('[Auth] state change', event);
      if (event === 'SIGNED_OUT' && isMountedRef.current) {
        resetGlobalTypingChannel().catch(console.error);
        releaseAllOwnedRealtimeChannels(supabase);
        hasNavigatedRef.current = false;
        markReady();
        hideSplashSafely();
        // Use welcome screen so users can pick their sign-in method (Apple, phone, email)
        safeReplace('/onboarding/welcome');
      }
    });

    return () => {
      isMountedRef.current = false;
      authSub.subscription.unsubscribe();
      if (hardTimeoutRef.current) {
        clearTimeout(hardTimeoutRef.current);
        hardTimeoutRef.current = null;
      }
    };
  }, []); // EMPTY DEPS — must never be changed

  // ─── BOOT ROUTE NAVIGATION DEFERRAL ─────────────────────────────────────────
  //
  // Defers the actual navigation replacement until the Expo Router navigation
  // container is fully mounted and ready (rootNavigationState?.key != null).
  // This prevents the fatal React Navigation crash when cold-starting from deep links.
  useEffect(() => {
    if (isNavigationReady && bootRoute) {
      console.log('[Layout] Navigation container ready — executing boot route:', bootRoute);
      safeReplace(bootRoute);
    }
  }, [isNavigationReady, bootRoute, safeReplace]);

  useEffect(() => {
    const cleanup = setupNotificationListeners();
    return () => {
      if (typeof cleanup === 'function') cleanup();
    };
  }, []);

  // ─── DEEP LINK HANDLER ──────────────────────────────────────────────────────
  //
  // Intercepts astrodate://auth/verify?... links from Gmail verification emails.
  // We handle it here (in the root) so it works even when the app was cold-started
  // from the link (initial URL) AND when the app was already running (URL event).
  //
  // We intentionally do NOT navigate here — instead we push to /auth/verify which
  // handles the full token exchange + routing logic. This keeps the layout clean.

  const processDeepLink = useCallback((url: string) => {
    if (!url.startsWith('astrodate://')) return;
    if (!isMountedRef.current || processedDeepLinkRef.current === url) return;

    const currentRoute = routeFromSegments();
    if (currentRoute.includes('auth/callback') || currentRoute.includes('auth/verify')) {
      console.log('⏳ [Layout] Deep link received but already on auth screen:', currentRoute);
      return;
    }

    const hasStrictType = url.includes('&type=') || url.includes('?type=');
    const isEmailVerificationLink = 
      url.includes('auth/verify') ||
      (url.includes('token_hash') && hasStrictType) ||
      (url.includes('access_token') && hasStrictType);

    const isAuthCallbackLink = url.includes('auth/callback');

    if (isEmailVerificationLink) {
      processedDeepLinkRef.current = url;
      console.log('🔗 [Layout] Email verification deep link detected:', url);
      try {
        WebBrowser.dismissBrowser();
      } catch (e) { console.warn('[WebBrowser] dismissBrowser failed:', e); }

      // Ensure splash screen is hidden and app is marked ready on deep link cold-start
      hasNavigatedRef.current = true;
      markReady();
      hideSplashSafely();
      if (hardTimeoutRef.current) {
        clearTimeout(hardTimeoutRef.current);
        hardTimeoutRef.current = null;
      }

      router.push(`/auth/verify?url=${encodeURIComponent(url)}` as Href);
    } else if (isAuthCallbackLink) {
      processedDeepLinkRef.current = url;
      console.log('🔗 [Layout] OAuth callback deep link detected:', url);
      try {
        WebBrowser.dismissBrowser();
      } catch (e) { console.warn('[WebBrowser] dismissBrowser failed:', e); }

      // Ensure splash screen is hidden and app is marked ready on deep link cold-start
      hasNavigatedRef.current = true;
      markReady();
      hideSplashSafely();
      if (hardTimeoutRef.current) {
        clearTimeout(hardTimeoutRef.current);
        hardTimeoutRef.current = null;
      }

      router.push(`/auth/callback?url=${encodeURIComponent(url)}` as Href);
    }
  }, [router, routeFromSegments, markReady, hideSplashSafely]);

  useEffect(() => {
    // Warm-start: link opened while app was running
    const linkSub = Linking.addEventListener('url', ({ url }) => {
      console.log('🔗 [Layout] Incoming URL (warm):', url);
      WebBrowser.maybeCompleteAuthSession();
      processDeepLink(url);
    });

    return () => linkSub.remove();
  }, [processDeepLink]);
  //
  // ROOT CAUSE OF REPEATED "App started" LOG (fixed here):
  //
  // BUG 4 — No AppState dedup: Android fires AppState 'active' multiple times
  // rapidly on cold start. Each call to handleAppStateChange called
  // updateOnlineStatus concurrently with no guard → N parallel calls logged.
  //
  // BUG 5 — statusUpdateInFlight only guarded isOnline=true: the old guard
  // `if (isOnline && statusUpdateInFlight) return` skipped the guard for
  // isOnline=false calls entirely.
  //
  // BUG 6 — Edge function FunctionsHttpError: updateOnlineStatus calls
  // supabase upsert on user_online_status. If RLS or the table blocks it,
  // it throws FunctionsHttpError. Old code let this propagate and potentially
  // block the status interval. Fixed: wrapped in try/catch, errors are warnings.

  useEffect(() => {
    let statusUpdateInterval: ReturnType<typeof setInterval> | null = null;
    let isMounted = true;
    let statusUpdateInFlight = false;
    let lastAppState = AppState.currentState;

    const clearStatusInterval = () => {
      if (statusUpdateInterval) {
        clearInterval(statusUpdateInterval);
        statusUpdateInterval = null;
      }
    };

    const updateStatusSafely = async (isOnline: boolean) => {
      if (statusUpdateInFlight) return; // FIX BUG 5: guard ALL calls not just isOnline=true
      statusUpdateInFlight = true;
      try {
        await updateOnlineStatus(isOnline);
      } catch (err) {
        // FIX BUG 6: edge function errors are non-fatal warnings, never rethrown
        console.warn('[Layout] updateOnlineStatus non-fatal error:', err);
      } finally {
        statusUpdateInFlight = false;
      }
    };

    const startStatusInterval = () => {
      clearStatusInterval();
      statusUpdateInterval = setInterval(async () => {
        if (isMounted) await updateStatusSafely(true);
      }, 2 * 60 * 1000);
    };

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      // FIX BUG 4: deduplicate AppState events (Android fires 'active' repeatedly)
      if (nextAppState === lastAppState) return;
      lastAppState = nextAppState;
      console.log('[Lifecycle] app state', nextAppState);

      try {
        const { data } = await supabase.auth.getUser();
        if (!data?.user || !isMounted) return;

        if (nextAppState === 'active') {
          await updateStatusSafely(true);
          syncPushTokenForCurrentUser().catch((error) => {
            console.warn('[Layout] active push token sync non-fatal error:', error);
          });
          drainPendingPushNotifications().catch(() => { });
          cleanupOldMessages().catch(() => { }); // fire-and-forget, non-fatal
          startStatusInterval();
        } else if (nextAppState === 'background' || nextAppState === 'inactive') {
          clearStatusInterval();
          await updateStatusSafely(false);
          resetGlobalTypingChannel().catch(console.error);
        }
      } catch (err) {
        console.warn('[Layout] AppState handler non-fatal error:', err);
      }
    };

    // Set initial online status — completely non-blocking
    const setInitialStatus = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (data?.user && isMounted) {
          console.log('📱 App started — setting user online');
          await updateStatusSafely(true);
          if (isMounted) startStatusInterval();
        }
      } catch (err) {
        console.warn('[Layout] setInitialStatus non-fatal error:', err);
      }
    };

    setInitialStatus();
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      isMounted = false;
      subscription.remove();
      clearStatusInterval();
    };
  }, []); // EMPTY DEPS

  // ─── RENDER ─────────────────────────────────────────────────────────────────
  // Stack is ALWAYS rendered so the navigator is ready before finishBoot fires.
  // Spinner is an absolute overlay that disappears once isReady=true.
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#04020b' }}>
        <AuthAlertProvider>
        <SubscriptionProvider>
          <ThemeProvider value={{ ...DarkTheme, colors: { ...DarkTheme.colors, background: '#04020b', card: '#04020b' } }}>
            <OfflineBanner />
            <Stack
              screenOptions={{
                contentStyle: {
                  backgroundColor: '#04020b',
                },
              }}>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="onboarding/login" options={{ headerShown: false }} />
              <Stack.Screen name="onboarding/onboarding_ques" options={{ headerShown: false }} />
              <Stack.Screen name="profile-details/index" options={{ headerShown: false, animation: 'fade', gestureEnabled: true }} />
              <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
              <Stack.Screen name="onboarding/signup" options={{ headerShown: false }} />
              <Stack.Screen name="onboarding/otp-verify" options={{ headerShown: false }} />
              <Stack.Screen name="onboarding/welcome" options={{ headerShown: false }} />
              <Stack.Screen name="onboarding/basic-details" options={{ headerShown: false }} />
              <Stack.Screen name="onboarding/birth-details" options={{ headerShown: false }} />
              <Stack.Screen name="onboarding/photo_upload" options={{ headerShown: false }} />
              <Stack.Screen name="onboarding/zodiac-preview" options={{ headerShown: false }} />
              <Stack.Screen name="onboarding/congratulations" options={{ headerShown: false }} />
              <Stack.Screen name="onboarding/phone-verification" options={{ headerShown: false }} />
              <Stack.Screen name="onboarding/email-signup" options={{ headerShown: false }} />
              <Stack.Screen name="onboarding/email-login" options={{ headerShown: false }} />
              <Stack.Screen name="onboarding/email-verify-pending" options={{ headerShown: false }} />
              <Stack.Screen name="auth/verify" options={{ headerShown: false }} />
              <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
              <Stack.Screen name="chat/[id]/index" options={{ headerShown: false, animation: 'slide_from_right' }} />
              <Stack.Screen name="chatbot" options={{ headerShown: false }} />
              <Stack.Screen name="filters" options={{ headerShown: false }} />
              <Stack.Screen name="settings" options={{ headerShown: false }} />
              <Stack.Screen name="help" options={{ headerShown: false }} />
              <Stack.Screen name="cosmic-insights" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
              <Stack.Screen name="privacy" options={{ headerShown: false }} />
              <Stack.Screen name="terms" options={{ headerShown: false }} />
              <Stack.Screen name="subscription" options={{ headerShown: false }} />
            </Stack>

            {/* Global alert modal — survives all navigation */}
            <GlobalAuthAlertModal />

            {/* Boot spinner overlay — removed once isReady=true */}
            {!isReady && (
              <View style={styles.spinnerOverlay} pointerEvents="none">
                <ActivityIndicator size="large" color="#A855F7" />
              </View>
            )}

            <StatusBar
              style="auto"
              translucent={false}
              backgroundColor={Platform.OS === 'android' ? '#1A0B2E' : undefined}
            />
          </ThemeProvider>
        </SubscriptionProvider>
      </AuthAlertProvider>
    </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  spinnerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1A0B2E',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
export default RootLayout;
