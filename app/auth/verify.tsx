/**
 * app/auth/verify.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Deep link landing page for email verification.
 *
 * When Gmail sends the user back to the app via:
 *   astrodate://auth/verify?token_hash=xxx&type=signup
 *   astrodate://auth/verify#access_token=xxx&refresh_token=xxx
 *
 * This screen:
 *  1. Shows a loading spinner immediately
 *  2. Exchanges the token with Supabase
 *  3. On success → navigates to basic-details (new user) or tabs (existing)
 *  4. On failure → shows a clear error with retry option
 *
 * IMPORTANT: This screen must be registered in _layout.tsx.
 *
 * FIXES APPLIED:
 *  BUG 2 — URL is now read from the route param (passed by _layout.tsx) instead
 *           of calling Linking.getInitialURL() here again. On Android,
 *           getInitialURL() can return null on the second call in the same process.
 *  BUG 3 — "Try Again" now increments retryCount which is a useEffect dependency,
 *           so the verification logic actually re-runs instead of just showing a spinner.
 */

import { useAuthAlert } from '@/lib/auth-alert-context';
import { handleEmailVerificationDeepLink } from '@/lib/email-auth';
import { supabase } from '@/lib/supabase';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type VerifyState = 'loading' | 'success' | 'error';

export default function EmailVerifyScreen() {
  const router = useRouter();
  const navigation: any = useNavigation();
  const { showAlert } = useAuthAlert();

  // FIX BUG 2: Read the URL passed as a param from _layout.tsx. _layout encodes
  // the full deep link URL here so we never need to call getInitialURL() ourselves
  // (which can return null on the 2nd call on Android).
  const params = useLocalSearchParams<{ url?: string }>();

  const [state, setState] = useState<VerifyState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  // FIX BUG 3: retryCount is a useEffect dependency so incrementing it causes
  // the verification effect to re-run when the user presses "Try Again".
  const [retryCount, setRetryCount] = useState(0);

  const isMountedRef = useRef(true);
  const hasProcessedRef = useRef(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
    ]).start();
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    // Reset guard on each retry attempt
    hasProcessedRef.current = false;

    const processDeepLink = async (url: string) => {
      if (hasProcessedRef.current) {
        console.warn('⚠️ [auth/verify] Duplicate deep link processing blocked');
        return;
      }
      hasProcessedRef.current = true;

      console.log('🔗 [auth/verify] Processing deep link');

      const result = await handleEmailVerificationDeepLink(url);

      if (!isMountedRef.current) return;

      if (!result.success) {
        console.error('❌ [auth/verify] Verification failed:', result.error);
        setState('error');
        setErrorMessage(result.error ?? '');
        return;
      }

      console.log('✅ [auth/verify] Verification success — determining destination');
      setState('success');

      // Small pause to show success UI before navigating
      await new Promise((res) => setTimeout(res, 1500));
      if (!isMountedRef.current) return;

      // Determine destination: existing profile → tabs, new user → onboarding
      try {
        const session = result.data;
        const userId = session?.user?.id;

        if (userId) {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('user_id')
            .eq('user_id', userId)
            .maybeSingle();

          if (!isMountedRef.current) return;
          console.log('🔀 [auth/verify] Routing', profile ? 'to tabs' : 'to basic-details');
          router.replace(profile ? '/(tabs)' : '/onboarding/basic-details');
        } else {
          router.replace('/onboarding/basic-details');
        }
      } catch {
        router.replace('/onboarding/basic-details');
      }
    };

    const init = async () => {
      try {
        // FIX BUG 2: Prefer the URL passed via route params by _layout.tsx.
        // Fall back to Linking.getInitialURL() only if params.url is absent
        // (e.g. app was opened directly from the link with no layout interception).
        const paramUrl = params.url ? decodeURIComponent(params.url) : null;
        console.log('🔗 [auth/verify] Param URL:', paramUrl);

        if (paramUrl && (paramUrl.includes('token_hash') || paramUrl.includes('access_token') || paramUrl.includes('auth/verify'))) {
          await processDeepLink(paramUrl);
          return;
        }

        // Fallback: try getInitialURL (works reliably on cold-start before _layout runs)
        const initialUrl = await Linking.getInitialURL();
        console.log('🔗 [auth/verify] Fallback initial URL:', initialUrl);

        if (initialUrl && (initialUrl.includes('auth/verify') || initialUrl.includes('access_token') || initialUrl.includes('token_hash'))) {
          await processDeepLink(initialUrl);
        } else {
          setState('error');
          setErrorMessage('No verification token found. Please use the link from your email.');
        }
      } catch (err: any) {
        console.error('❌ [auth/verify] init error:', err);
        if (isMountedRef.current) {
          setState('error');
          setErrorMessage('Failed to process verification link. Please try again.');
        }
      }
    };

    // Also listen for deep links arriving while the screen is already mounted
    const subscription = Linking.addEventListener('url', async ({ url }) => {
      console.log('🔗 [auth/verify] Incoming URL event:', url);
      if (url && (url.includes('auth/verify') || url.includes('token_hash') || url.includes('access_token'))) {
        await processDeepLink(url);
      }
    });

    init();
    return () => subscription.remove();
  }, [router, retryCount, params.url]); // FIX BUG 3: retryCount in deps re-runs on retry

  const renderContent = () => {
    if (state === 'loading') {
      return (
        <>
          <ActivityIndicator size="large" color="#A855F7" style={styles.spinner} />
          <Text style={styles.title}>Verifying Email…</Text>
          <Text style={styles.subtitle}>Please wait while we confirm your email address.</Text>
        </>
      );
    }

    if (state === 'success') {
      return (
        <>
          <View style={styles.successIcon}>
            <LinearGradient
              colors={['#10B981', '#059669']}
              style={styles.iconGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <MaterialIcons name="check-circle" size={48} color="#FFFFFF" />
            </LinearGradient>
          </View>
          <Text style={styles.title}>Email Verified! ✨</Text>
          <Text style={styles.subtitle}>Your email has been confirmed. Taking you to AstroDate…</Text>
        </>
      );
    }

    // Error state
    return (
      <>
        <View style={styles.errorIcon}>
          <LinearGradient
            colors={['#EF4444', '#DC2626']}
            style={styles.iconGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <MaterialIcons name="error" size={48} color="#FFFFFF" />
          </LinearGradient>
        </View>
        <Text style={styles.title}>Verification Failed</Text>
        <Text style={styles.subtitle}>{errorMessage}</Text>

        <TouchableOpacity
          onPress={() => router.replace('/onboarding/email-login')}
          style={styles.errorButton}
          activeOpacity={0.8}
        >
          <Text style={styles.errorButtonText}>Go to Login</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            // FIX BUG 3: incrementing retryCount triggers the useEffect to re-run
            setState('loading');
            setErrorMessage('');
            setRetryCount((c) => c + 1);
          }}
          style={styles.retryButton}
          activeOpacity={0.7}
        >
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <LinearGradient
        colors={['#0D0618', '#1A0B2E', '#2D1255', '#3D1A6E']}
        style={styles.background}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
      >
        {/* Star field */}
        <View style={styles.starField} pointerEvents="none">
          {[...Array(20)].map((_, i) => (
            <View key={i} style={[styles.star, {
              top: `${(i * 37 + 5) % 95}%`,
              left: `${(i * 53 + 8) % 93}%`,
              width: i % 4 === 0 ? 3 : 1.5,
              height: i % 4 === 0 ? 3 : 1.5,
              opacity: 0.15 + (i % 5) * 0.1,
            }]} />
          ))}
        </View>

        <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
          {renderContent()}
        </Animated.View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0D0618' },
  background: { flex: 1 },
  starField: { ...StyleSheet.absoluteFillObject },
  star: { position: 'absolute', borderRadius: 99, backgroundColor: '#FFFFFF' },
  container: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32,
  },
  spinner: { marginBottom: 32 },
  title: { fontSize: 26, fontWeight: '800', color: '#F3EEFF', textAlign: 'center', marginBottom: 12 },
  subtitle: { fontSize: 15, color: '#C4A8F0', textAlign: 'center', lineHeight: 22 },
  successIcon: { marginBottom: 28 },
  errorIcon: { marginBottom: 28 },
  iconGradient: {
    width: 96, height: 96, borderRadius: 48,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.3, shadowOffset: { width: 0, height: 8 }, shadowRadius: 16, elevation: 10,
  },
  errorButton: {
    marginTop: 32, width: '100%', backgroundColor: '#7C3AED',
    borderRadius: 18, paddingVertical: 14, alignItems: 'center',
  },
  errorButtonText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  retryButton: {
    marginTop: 12, width: '100%',
    borderRadius: 18, paddingVertical: 14, alignItems: 'center',
    borderWidth: 1.5, borderColor: 'rgba(124,58,237,0.4)',
  },
  retryText: { fontSize: 15, fontWeight: '600', color: '#C4A8F0' },
});