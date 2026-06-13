import { GlobalAuthAlertModal } from '@/components/global-auth-alert-modal';
import { ErrorBoundary } from '@/components/error-boundary';
import { useColorScheme } from '@/hooks/use-color-scheme';
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
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter, useSegments, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, AppStateStatus, Platform, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

SplashScreen.preventAutoHideAsync();

const STARTUP_HARD_TIMEOUT_MS = 12_000;
type ProfileLookupResult = {
  data: Pick<Tables<'user_profiles'>, 'user_id'> | null;
  error: unknown;
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
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

    const routeFromSegments = () => {
      const current = segmentsRef.current;
      return current.length ? `/${current.join('/')}` : '/';
    };

    const safeReplace = (route: Href) => {
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
    };

    const markReady = () => {
      if (!isMountedRef.current || isReadyRef.current) return;
      isReadyRef.current = true;
      setIsReady(true);
    };

    const hideSplashSafely = () => {
      SplashScreen.hideAsync().catch(() => { });
    };

    const finishBoot = (route: Href) => {
      if (!isMountedRef.current || hasNavigatedRef.current) return;
      hasNavigatedRef.current = true;
      // Navigate first (Stack is already mounted), then remove spinner
      safeReplace(route);
      markReady();
      hideSplashSafely();
      if (hardTimeoutRef.current) {
        clearTimeout(hardTimeoutRef.current);
        hardTimeoutRef.current = null;
      }
    };

    // Hard safety net: if Supabase/network hangs beyond 12s, render anyway
    hardTimeoutRef.current = setTimeout(() => {
      console.warn('⚠️ [Layout] Startup hard timeout — forcing render');
      finishBoot('/onboarding/welcome');
    }, STARTUP_HARD_TIMEOUT_MS);

    const bootstrap = async () => {
      try {
        if (Platform.OS === 'ios') {
          const { requestTrackingPermissionsAsync } = await import('expo-tracking-transparency');
          await requestTrackingPermissionsAsync();
        }
        await ensureRevenueCatConfigured(); // init once here

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
      } catch (err) {
        console.error('[Layout] Bootstrap error (non-fatal):', err);
        if (isMountedRef.current) finishBoot('/onboarding/welcome');
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
        safeReplace('/onboarding/login');
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

  useEffect(() => {
    const responseListener = Notifications.addNotificationResponseReceivedListener((response: { notification: { request: { content: { data: any; }; }; }; }) => {
      const data = response.notification.request.content.data as any;
      if (data?.type === 'new_message' && data?.chat_id) {
        router.push({
          pathname: '/chat/[id]',
          params: { id: data.chat_id }
        });
      } else if (data?.type === 'new_match' && data?.chat_id) {
        router.push({
          pathname: '/chat/[id]',
          params: { id: data.chat_id }
        });
      }
    });

    const cleanup = setupNotificationListeners();
    return () => {
      responseListener.remove();
      if (typeof cleanup === 'function') cleanup();
    };
  }, [router]);

  // ─── DEEP LINK HANDLER ──────────────────────────────────────────────────────
  //
  // Intercepts astrodate://auth/verify?... links from Gmail verification emails.
  // We handle it here (in the root) so it works even when the app was cold-started
  // from the link (initial URL) AND when the app was already running (URL event).
  //
  // We intentionally do NOT navigate here — instead we push to /auth/verify which
  // handles the full token exchange + routing logic. This keeps the layout clean.

  useEffect(() => {
    const processVerifyLink = (url: string) => {
      if (!isMountedRef.current || processedDeepLinkRef.current === url) return;
      // Only intercept actual email verification links, NOT Google OAuth links.
      // Email links contain type=signup, type=recovery, type=email_change, etc.
      // Use '&type=' or '?type=' to avoid matching 'token_type=bearer' from OAuth.
      const hasStrictType = url.includes('&type=') || url.includes('?type=');
      const isEmailVerificationLink = 
        url.includes('auth/verify') ||
        (url.includes('token_hash') && hasStrictType) ||
        (url.includes('access_token') && hasStrictType);

      if (isEmailVerificationLink) {
        processedDeepLinkRef.current = url;
        console.log('🔗 [Layout] Email verification deep link detected:', url);
        // FIX BUG 2: Pass the URL as a param so verify.tsx doesn't need to call
        // getInitialURL() again (which can return null on the second call on Android).
        router.push({ pathname: '/auth/verify', params: { url: encodeURIComponent(url) } });
      }
    };

    // Cold-start: app was opened from the link
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('🔗 [Layout] Initial URL on cold start:', url);
        processVerifyLink(url);
      }
    }).catch(console.warn);

    // Warm-start: link opened while app was running
    const linkSub = Linking.addEventListener('url', ({ url }) => {
      console.log('🔗 [Layout] Incoming URL (warm):', url);
      processVerifyLink(url);
    });

    return () => linkSub.remove();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
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
      supabase.auth.getUser()
        .then(({ data }) => { if (data?.user) updateOnlineStatus(false).catch(() => { }); })
        .catch(() => { });
    };
  }, []); // EMPTY DEPS

  // ─── RENDER ─────────────────────────────────────────────────────────────────
  // Stack is ALWAYS rendered so the navigator is ready before finishBoot fires.
  // Spinner is an absolute overlay that disappears once isReady=true.
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthAlertProvider>
        <SubscriptionProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <OfflineBanner />
            <Stack
              screenOptions={{
                contentStyle: {
                  backgroundColor: Platform.OS === 'android' ? '#1A0B2E' : undefined,
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