import { useAuthAlert } from '@/lib/auth-alert-context';
import { supabase } from '@/lib/supabase';
import { useNavigation } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const COLORS = {
  background: '#FFFFFF',
  textPrimary: '#1B1528',
  textSecondary: '#6B7280',
  accent: '#4B0082',
  accentLight: '#6A0DAD',
  accentSoft: '#F3ECFF',
  border: '#E5E7EB',
  success: '#10B981',
  shadow: 'rgba(75, 0, 130, 0.1)',
};

export default function PhoneVerificationScreen() {
  const router = useRouter();
  const navigation: any = useNavigation();
  const { showAlert } = useAuthAlert();
  const params = useLocalSearchParams<{ phone: string }>();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const isVerifyingRef = useRef(false);
  const isMountedRef = useRef(true);
  const hasNavigatedRef = useRef(false);

  const phoneNumber = params.phone || '';

  const safeReplace = (route: Parameters<typeof router.replace>[0]) => {
    if (!isMountedRef.current || hasNavigatedRef.current) return;
    hasNavigatedRef.current = true;
    router.replace(route);
  };

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const normalizePhoneForAuth = (value: string): string => {
    const trimmed = value.trim();
    const digits = trimmed.replace(/\D/g, '');
    return digits ? `+${digits}` : '';
  };

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    setResendCooldown(60); // Start 60 second cooldown
    // Focus first input after a short delay
    const focusTimeout = setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 300);
    return () => clearTimeout(focusTimeout);
  }, [navigation]);

  // Countdown timer for resend
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleOtpChange = (value: string, index: number) => {
    // Only allow digits
    if (value && !/^\d+$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1); // Only take the last character
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Dismiss keyboard when all 6 digits are entered
    if (newOtp.every((digit) => digit !== '') && newOtp.join('').length === 6) {
      inputRefs.current[index]?.blur();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    // Handle backspace
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (otpCode?: string) => {
    if (isVerifyingRef.current || loading) return;

    const code = otpCode || otp.join('');
    if (code.length !== 6) {
      showAlert('Invalid OTP', 'Please enter all 6 digits');
      return;
    }

    const normalizedPhone = normalizePhoneForAuth(phoneNumber);
    if (!normalizedPhone) {
      showAlert('Verification Failed', 'Invalid phone number. Please go back and try again.');
      return;
    }

    isVerifyingRef.current = true;
    setLoading(true);
    try {
      // Verify OTP with Supabase
      const { data, error } = await supabase.auth.verifyOtp({
        phone: normalizedPhone,
        token: code,
        type: 'sms',
      });

      if (error) {
        // Log error for debugging (not shown to user)
        console.warn('⚠️ OTP verification error:', error);

        // Show user-friendly alert message
        let errorMessage = 'Invalid OTP. Please check the code and try again.';
        if (error.message?.includes('expired') || error.message?.includes('Expired')) {
          errorMessage = 'The OTP has expired. Please request a new one.';
        } else if (error.message?.includes('invalid') || error.message?.includes('Invalid')) {
          errorMessage = 'Invalid OTP. Please check the code and try again.';
        } else if (error.message?.includes('rate limit') || error.message?.includes('too many')) {
          errorMessage = 'Too many attempts. Please wait a moment and try again.';
        }

        showAlert('Verification Failed', errorMessage);
        // Clear OTP on error
        if (isMountedRef.current) {
          setOtp(['', '', '', '', '', '']);
          inputRefs.current[0]?.focus();
        }
        return;
      }

      // verifyOtp may not return session directly — fall back to getSession()
      let session = data?.session;
      let user = data?.user;

      if (!session || !user) {
        const { data: sessionData } = await supabase.auth.getSession();
        session = sessionData?.session ?? null;
        user = sessionData?.session?.user ?? null;
      }

      if (session && user) {
        // Check if a profile exists — distinguishes returning users from new phone numbers
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('user_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (profile) {
          safeReplace('/(tabs)');
        } else {
          // Auth user was created by Supabase but no account exists — clean up and redirect
          await supabase.auth.signOut();
          showAlert(
            'No Account Found',
            'This phone number is not registered. Please sign up first.',
            [{ text: 'Sign Up', onPress: () => safeReplace('/onboarding/signup') }],
          );
          if (isMountedRef.current) {
            isVerifyingRef.current = false;
            setLoading(false);
            setOtp(['', '', '', '', '', '']);
          }
        }
      } else {
        showAlert('Verification Failed', 'Session not created. Please try again.');
        if (isMountedRef.current) {
          setOtp(['', '', '', '', '', '']);
          inputRefs.current[0]?.focus();
        }
      }
    } catch (err: any) {
      // Log error for debugging (not shown to user)
      console.warn('⚠️ OTP verification exception:', err);
      showAlert('Verification Failed', 'An error occurred. Please try again.');
      if (isMountedRef.current) {
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } finally {
      if (isMountedRef.current) {
        isVerifyingRef.current = false;
        setLoading(false);
      }
    }
  };

  const handleResendOTP = async () => {
    if (resendCooldown > 0) return;

    const normalizedPhone = normalizePhoneForAuth(phoneNumber);
    if (!normalizedPhone) {
      showAlert('Resend Failed', 'Invalid phone number. Please go back and try again.');
      return;
    }

    setLoading(true);
    try {
      // Resend OTP
      const { error } = await supabase.auth.signInWithOtp({
        phone: normalizedPhone,
      });

      if (error) {
        console.warn('⚠️ OTP resend error:', error);
        showAlert('Resend Failed', error.message || 'Could not resend OTP. Please try again.');
        if (isMountedRef.current) setLoading(false);
        return;
      }

      setResendCooldown(60);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      showAlert('OTP Resent', 'A new OTP has been sent to your phone number');
    } catch (err: any) {
      console.warn('⚠️ OTP resend exception:', err);
      showAlert('Resend Failed', err?.message || 'Could not resend OTP. Please try again.');
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.content}
        >
          <View style={styles.innerContent}>
            <View style={styles.headerRow}>
              <Image source={require('../../assets/images/logo.png')} style={styles.logo} resizeMode="contain" />
              <Text style={styles.appTitle}>AstroDate</Text>
            </View>

            <Text style={styles.welcome}>Verify Phone Number</Text>
            <Text style={styles.subtitle}>Enter the 6-digit code sent to</Text>
            <Text style={styles.phoneNumber}>{phoneNumber}</Text>

            {/* OTP Inputs */}
            <View style={styles.otpContainer}>
              {otp.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => {
                    inputRefs.current[index] = ref;
                  }}
                  style={[styles.otpInput, digit ? styles.otpInputFilled : null]}
                  value={digit}
                  onChangeText={(value) => handleOtpChange(value, index)}
                  onKeyPress={(e) => handleKeyPress(e, index)}
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                  editable={!loading}
                />
              ))}
            </View>

            {/* Verify Button */}
            <TouchableOpacity
              style={styles.verifyButtonWrapper}
              onPress={() => handleVerify()}
              activeOpacity={0.9}
              disabled={loading || otp.join('').length !== 6}
            >
              <View style={[styles.verifyButton, (loading || otp.join('').length !== 6) && styles.verifyButtonDisabled]}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.verifyButtonText}>Verify OTP</Text>}
              </View>
            </TouchableOpacity>

            {/* Resend OTP */}
            <View style={styles.resendContainer}>
              <Text style={styles.resendText}>Didn't receive the code?</Text>
              <TouchableOpacity
                onPress={handleResendOTP}
                disabled={loading}
                style={[styles.resendButton, (resendCooldown > 0 || loading) && styles.resendButtonDisabled]}
              >
                <Text style={styles.resendButtonText}>{loading ? 'Sending...' : 'Resend OTP'}</Text>
              </TouchableOpacity>
              {resendCooldown > 0 && <Text style={styles.resendCooldownText}>Available in {resendCooldown}s</Text>}
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  innerContent: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  appTitle: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: '700',
  },
  welcome: {
    color: COLORS.textPrimary,
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 8,
  },
  phoneNumber: {
    color: COLORS.accent,
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 32,
    textAlign: 'center',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
    width: '100%',
    gap: 8,
  },
  otpInput: {
    flex: 1,
    height: 60,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
  },
  otpInputFilled: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accentSoft,
    borderWidth: 2,
  },
  verifyButtonWrapper: {
    marginBottom: 24,
    width: '100%',
  },
  verifyButton: {
    paddingVertical: 16,
    borderRadius: 40,
    alignItems: 'center',
    backgroundColor: COLORS.accent,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  verifyButtonDisabled: {
    opacity: 0.5,
  },
  verifyButtonText: {
    color: COLORS.background,
    fontWeight: '700',
    fontSize: 16,
  },
  resendContainer: {
    alignItems: 'center',
  },
  resendText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginBottom: 8,
  },
  resendButton: {
    minWidth: 140,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: COLORS.accentSoft,
    alignItems: 'center',
  },
  resendButtonText: {
    color: COLORS.accentLight,
    fontWeight: '600',
    fontSize: 15,
  },
  resendButtonDisabled: {
    opacity: 0.7,
  },
  resendCooldownText: {
    marginTop: 8,
    color: COLORS.textSecondary,
    fontSize: 13,
  },
});
