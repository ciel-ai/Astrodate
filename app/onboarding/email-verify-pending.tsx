/**
 * app/onboarding/email-verify-pending.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Screen shown after email signup — tells user to check their Gmail inbox.
 * Features:
 *  - Email displayed so user knows which inbox to check
 *  - Resend verification email with 60s cooldown
 *  - Auto-polls for verification (catches users who verify on another device)
 *  - "Already verified? Try logging in" escape hatch
 */

import { useAuthAlert } from '@/lib/auth-alert-context';
import { resendVerificationEmail, verifyEmailOtp } from '@/lib/email-auth';
import { supabase } from '@/lib/supabase';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const POLL_INTERVAL_MS = 4_000; // Check every 4 seconds

export default function EmailVerifyPendingScreen() {
  const router = useRouter();
  const navigation: any = useNavigation();
  const { showAlert } = useAuthAlert();
  const params = useLocalSearchParams<{ email: string }>();
  const email = params.email ?? '';

  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60); // Start with 60s (just sent)
  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [focused, setFocused] = useState(false);

  const isMountedRef = useRef(true);
  const cooldownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    // Pulse the envelope icon
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);
    };
  }, []);

  // Cooldown countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    cooldownIntervalRef.current = setInterval(() => {
      if (!isMountedRef.current) return;
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownIntervalRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);
    };
  }, []);

  const handleVerify = async () => {
    if (!otp || otp.length < 6) {
      showAlert('Invalid OTP', 'Please enter the 6-digit code sent to your email.');
      return;
    }

    if (isMountedRef.current) setVerifying(true);

    const result = await verifyEmailOtp(email, otp);

    if (!isMountedRef.current) return;

    if (!result.success) {
      setVerifying(false);
      showAlert('Verification Failed', result.error ?? 'Verification failed');
      return;
    }

    // Check if they have a profile yet
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('user_id')
      .eq('user_id', result.data?.user?.id)
      .maybeSingle();

    if (!isMountedRef.current) return;
    router.replace(profile ? '/(tabs)' : '/onboarding/basic-details');
  };

  const handleResend = async () => {
    if (resendLoading || resendCooldown > 0) return;

    if (isMountedRef.current) setResendLoading(true);

    const redirectUrl = 'astrodate://auth/verify'; // explicit URL — makeRedirectUri generates triple-slash which Android rejects
    console.log('📨 [verify-pending] Resending verification email');

    const result = await resendVerificationEmail(email, redirectUrl);

    if (isMountedRef.current) setResendLoading(false);

    if (!result.success) {
      if (result.cooldownSeconds) {
        setResendCooldown(result.cooldownSeconds);
      }
      showAlert('Could Not Resend', result.error ?? 'Could not resend');
    } else {
      setResendCooldown(60);
      showAlert(
        'Email Sent ✅',
        'A new verification link has been sent. Please check your inbox and spam folder.'
      );
    }
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

        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
          {/* Envelope icon */}
          <Animated.View style={[styles.iconWrap, { transform: [{ scale: pulseAnim }] }]}>
            <LinearGradient
              colors={['#6D28D9', '#A855F7', '#EC4899']}
              style={styles.iconGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <MaterialIcons name="mark-email-unread" size={48} color="#FFFFFF" />
            </LinearGradient>
          </Animated.View>

          <Text style={styles.title}>Check Your Email</Text>
          <Text style={styles.subtitle}>
            We sent a verification code to:
          </Text>
          <View style={styles.emailBadge}>
            <MaterialIcons name="email" size={14} color="#7C3AED" style={{ marginRight: 6 }} />
            <Text style={styles.emailText} numberOfLines={1}>{email}</Text>
          </View>

          <Text style={styles.instructions}>
            Enter the 6-digit OTP code sent to your email by <Text style={styles.bold}>AstroDate</Text>. Check your spam folder if you don't see it.
          </Text>

          {/* OTP Input */}
          <View style={[styles.otpInputContainer, focused && styles.otpInputFocused]}>
            <TextInput
              value={otp}
              onChangeText={setOtp}
              placeholder="Enter 6-digit OTP"
              placeholderTextColor="#A090C0"
              style={styles.otpInput}
              keyboardType="number-pad"
              maxLength={6}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
            />
          </View>

          {/* Verify Button */}
          <TouchableOpacity
            onPress={handleVerify}
            disabled={verifying || otp.length < 6}
            style={[styles.verifyButton, (verifying || otp.length < 6) && styles.verifyButtonDisabled]}
            activeOpacity={0.8}
          >
            {verifying ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.verifyButtonText}>Verify OTP</Text>
            )}
          </TouchableOpacity>

          {/* Resend */}
          <TouchableOpacity
            onPress={handleResend}
            disabled={resendLoading || resendCooldown > 0}
            style={[styles.resendButton, (resendLoading || resendCooldown > 0) && styles.resendDisabled]}
            activeOpacity={0.7}
          >
            {resendLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.resendText}>
                {resendCooldown > 0
                  ? `Resend email (${resendCooldown}s)`
                  : 'Resend verification email'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Back to login */}
          <TouchableOpacity
            onPress={() => router.replace('/onboarding/email-login')}
            style={styles.backRow}
            activeOpacity={0.7}
          >
            <MaterialIcons name="arrow-back" size={14} color="#8B7BAE" />
            <Text style={styles.backText}> Back to Login</Text>
          </TouchableOpacity>
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
    paddingHorizontal: 32, paddingVertical: 40,
  },
  iconWrap: { marginBottom: 32 },
  iconGradient: {
    width: 100, height: 100, borderRadius: 50,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#7C3AED', shadowOpacity: 0.5, shadowOffset: { width: 0, height: 8 }, shadowRadius: 20, elevation: 10,
  },
  title: { fontSize: 28, fontWeight: '800', color: '#F3EEFF', textAlign: 'center', marginBottom: 12 },
  subtitle: { fontSize: 15, color: '#C4A8F0', textAlign: 'center', marginBottom: 10 },
  emailBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(124,58,237,0.15)',
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8,
    marginBottom: 24, borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)',
    maxWidth: '100%',
  },
  emailText: { fontSize: 14, fontWeight: '600', color: '#E0D4FF', flexShrink: 1 },
  instructions: {
    fontSize: 14, color: '#A090C0', textAlign: 'center', lineHeight: 22, marginBottom: 32,
  },
  bold: { color: '#E0D4FF', fontWeight: '600' },
  otpInputContainer: {
    width: '100%', backgroundColor: 'rgba(124,58,237,0.15)',
    borderRadius: 18, paddingHorizontal: 16, paddingVertical: 4,
    marginBottom: 24, borderWidth: 1.5, borderColor: 'rgba(124,58,237,0.3)',
  },
  otpInputFocused: {
    borderColor: '#A855F7',
    backgroundColor: 'rgba(124,58,237,0.25)',
  },
  otpInput: {
    color: '#E0D4FF', fontSize: 18, fontWeight: '700', textAlign: 'center',
    paddingVertical: 14, letterSpacing: 4,
  },
  verifyButton: {
    width: '100%', backgroundColor: '#7C3AED',
    borderRadius: 18, paddingVertical: 14, alignItems: 'center',
    marginBottom: 12,
  },
  verifyButtonDisabled: {
    backgroundColor: '#4A3070', opacity: 0.7,
  },
  verifyButtonText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  resendButton: {
    width: '100%', backgroundColor: '#7C3AED',
    borderRadius: 18, paddingVertical: 14, alignItems: 'center', marginBottom: 20,
  },
  resendDisabled: { backgroundColor: '#4A3070' },
  resendText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  backRow: { flexDirection: 'row', alignItems: 'center' },
  backText: { fontSize: 14, color: '#8B7BAE' },
});