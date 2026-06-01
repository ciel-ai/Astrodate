import { COUNTRIES, CountryCodePicker, type Country } from '@/components/country-code-picker';
import { useAuthAlert } from '@/lib/auth-alert-context';
import { supabase } from '@/lib/supabase';
import { isValidPhoneNumber } from '@/utils/phone-utils';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Complete the OAuth session in the browser
WebBrowser.maybeCompleteAuthSession();



export default function SignupScreen() {
  const router = useRouter();
  const navigation: any = useNavigation();
  const { showAlert } = useAuthAlert();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[0]);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const isMountedRef = useRef(true);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const cardSlideAnim = useRef(new Animated.Value(80)).current;
  const inputBorderAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 50, useNativeDriver: true }),
      Animated.spring(cardSlideAnim, { toValue: 0, friction: 8, tension: 40, delay: 150, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    Animated.timing(inputBorderAnim, {
      toValue: isFocused ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isFocused]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardVisible(true)
    );
    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsKeyboardVisible(false)
    );
    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  const onGenerateOTP = () => {
    handleGenerateOTP();
  };

  const handleOAuthSuccess = async (user: any, isSignup: boolean) => {
    const userCreatedAt = new Date(user.created_at);
    const now = new Date();
    const minutesSinceCreation = (now.getTime() - userCreatedAt.getTime()) / (1000 * 60);

    if (isSignup && minutesSinceCreation > 2) {
      if (isMountedRef.current) setLoading(false);
      await supabase.auth.signOut();
      if (!isMountedRef.current) return;
      showAlert(
        'Account Already Exists',
        'An account with this Google email already exists. Please use the login page instead.',
        [
          {
            text: 'Go to Login',
            onPress: () => { router.replace('/onboarding/login'); },
          },
        ]
      );
      return;
    }

    console.log('✅ Signup successful, navigating to basic details');
    if (isMountedRef.current) setLoading(false);
    router.replace('/onboarding/basic-details');
  };

  const handleGenerateOTP = async () => {

    if (!phoneNumber || phoneNumber.trim() === '') {
      showAlert('Phone number required', 'Please enter your phone number');
      return;
    }

    const cleanedNumber = phoneNumber.replace(/\D/g, '');
    if (!cleanedNumber || cleanedNumber.length < 7) {
      showAlert('Invalid phone number', 'Please enter a valid phone number');
      return;
    }

    const formatted = `${selectedCountry.dialCode}${cleanedNumber}`;

    if (!isValidPhoneNumber(formatted)) {
      showAlert('Invalid phone number', 'Please enter a valid phone number');
      return;
    }

    setLoading(true);
    try {
      const { data: authUserData, error: authUserError } = await supabase.rpc('check_auth_user_exists', {
        input_phone: formatted,
      });

      console.log('🔍 Checking auth.users for phone:', formatted, {
        data: authUserData,
        error: authUserError,
      });

      if (authUserData && authUserData.length > 0) {
        console.warn('⚠️ User already exists in auth.users with this phone number');
        if (isMountedRef.current) setLoading(false);
        showAlert(
          'Account Already Exists',
          'An account with this phone number already exists. Please use the login page instead.',
          [
            {
              text: 'Go to Login',
              onPress: () => { router.replace('/onboarding/login'); },
            },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
        return;
      }

      if (authUserError && authUserError.code === '42883') {
        console.warn('⚠️ RPC function check_auth_user_exists not found, falling back to user_profiles check');

        const { data: profileData } = await supabase
          .from('user_profiles')
          .select('user_id, phone_number')
          .eq('phone_number', formatted);

        if (profileData && profileData.length > 0) {
          console.warn('⚠️ User already exists with this phone number in user_profiles');
          if (isMountedRef.current) setLoading(false);
          showAlert(
            'Account Already Exists',
            'An account with this phone number already exists. Please use the login page instead.',
            [
              {
                text: 'Go to Login',
                onPress: () => { router.replace('/onboarding/login'); },
              },
              { text: 'Cancel', style: 'cancel' },
            ]
          );
          return;
        }
      }

      const { data, error } = await supabase.auth.signInWithOtp({ phone: formatted });

      if (error) {
        let errorMessage = error.message || 'Could not send OTP. Please try again.';
        if (error.message?.includes('Invalid phone number')) {
          errorMessage = 'Invalid phone number format. Please include country code (e.g., +1 for US, +91 for India)';
        } else if (error.message?.includes('Twilio') || error.message?.includes('SMS')) {
          errorMessage = 'SMS service error. Please check your Twilio configuration in Supabase.';
        }
        showAlert('OTP Generation Failed', errorMessage);
        if (isMountedRef.current) setLoading(false);
        return;
      }

      if (!data) {
        showAlert('OTP Generation Failed', 'No response from server. Please check your Supabase configuration.');
        if (isMountedRef.current) setLoading(false);
        return;
      }

      router.push({
        pathname: '/onboarding/otp-verify',
        params: { phone: formatted, isSignup: 'true' },
      });
    } catch (err: any) {
      console.error('❌ OTP generation error:', err?.message || String(err));
      showAlert('OTP generation error', err?.message ?? String(err) ?? 'An unexpected error occurred. Please try again.');
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  const borderColor = inputBorderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#E8E0F0', '#7C3AED'],
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={0}
      >
        {/* Deep space gradient background */}
        <LinearGradient
          colors={['#0D0618', '#1A0B2E', '#2D1255', '#3D1A6E']}
          style={styles.background}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
        >
          {/* Star field dots */}
          <View style={styles.starField} pointerEvents="none">
            {[...Array(28)].map((_, i) => (
              <View
                key={i}
                style={[
                  styles.star,
                  {
                    top: `${(i * 37 + 5) % 95}%`,
                    left: `${(i * 53 + 8) % 93}%`,
                    width: i % 4 === 0 ? 3 : i % 3 === 0 ? 2 : 1.5,
                    height: i % 4 === 0 ? 3 : i % 3 === 0 ? 2 : 1.5,
                    opacity: 0.15 + (i % 5) * 0.12,
                  },
                ]}
              />
            ))}
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Hero section */}
            {!isKeyboardVisible && (
              <Animated.View
                style={[
                  styles.heroSection,
                  { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
                ]}
              >
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => router.back()}
                  activeOpacity={0.7}
                >
                  <View style={styles.backButtonInner}>
                    <MaterialIcons name="arrow-back" size={20} color="#E0D4FF" />
                  </View>
                </TouchableOpacity>

                {/* Glow orb behind logo */}
                <View style={styles.logoGlow} />
                <Image
                  source={require('../../assets/images/logo.png')}
                  style={styles.heroLogo}
                  resizeMode="contain"
                />

                <Text style={styles.heroTitle}>Create Account</Text>
                <Text style={styles.heroSubtitle}>Love is written in the stars ✦</Text>
              </Animated.View>
            )}

            {/* Card */}
            <Animated.View
              style={[
                styles.card,
                { transform: [{ translateY: cardSlideAnim }], opacity: fadeAnim },
              ]}
            >
              {/* Card top accent line */}
              <LinearGradient
                colors={['#7C3AED', '#A855F7', '#EC4899']}
                style={styles.cardAccentLine}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />

              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>Sign Up</Text>
                <Text style={styles.cardSubtitle}>Enter your phone number to get started</Text>

                {/* Phone input */}
                <Animated.View style={[styles.inputContainer, { borderColor }]}>
                  <View style={styles.phoneIconWrap}>
                    <MaterialIcons name="phone" size={17} color="#9B72CF" />
                  </View>
                  <CountryCodePicker
                    selectedCountry={selectedCountry}
                    onSelect={setSelectedCountry}
                  />
                  <View style={styles.inputDivider} />
                  <TextInput
                    value={phoneNumber}
                    onChangeText={(text) => {
                      const digitsOnly = text.replace(/\D/g, '');
                      if (digitsOnly.length <= 10) setPhoneNumber(digitsOnly);
                    }}
                    placeholder="Phone number"
                    placeholderTextColor="#B0A0C8"
                    style={styles.input}
                    keyboardType="number-pad"
                    autoCapitalize="none"
                    maxLength={10}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                  />
                  {phoneNumber.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setPhoneNumber('')}
                      style={styles.clearButton}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <MaterialIcons name="cancel" size={18} color="#B0A0C8" />
                    </TouchableOpacity>
                  )}
                </Animated.View>

                {/* Number length hint */}
                <Text style={styles.inputHint}>
                  {phoneNumber.length > 0
                    ? `${phoneNumber.length}/10 digits entered`
                    : `${selectedCountry.flag} ${selectedCountry.name} (${selectedCountry.dialCode})`}
                </Text>

                {/* OTP Button */}
                <TouchableOpacity
                  onPress={onGenerateOTP}
                  activeOpacity={0.85}
                  disabled={loading}
                  style={styles.otpButtonWrapper}
                >
                  <LinearGradient
                    colors={loading ? ['#6B6B8A', '#6B6B8A'] : ['#6D28D9', '#7C3AED', '#9333EA']}
                    style={styles.otpButton}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <MaterialIcons name="person-add" size={18} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.otpButtonText}>Get OTP</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {/* Terms note */}
                <Text style={styles.termsText}>
                  By signing up you agree to our{' '}
                  <Text style={styles.termsLink}>Terms of Service</Text>
                  {' '}and{' '}
                  <Text style={styles.termsLink}>Privacy Policy</Text>
                </Text>

                {/* Login link */}
                <View style={styles.loginRow}>
                  <Text style={styles.loginText}>Already have an account?</Text>
                  <TouchableOpacity
                    onPress={() => router.push('/onboarding/login')}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                  >
                    <Text style={styles.loginLink}> Login</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>
          </ScrollView>
        </LinearGradient>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0D0618' },
  keyboardView: { flex: 1 },
  background: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'flex-end' },

  // Star field
  starField: { ...StyleSheet.absoluteFillObject },
  star: {
    position: 'absolute',
    borderRadius: 99,
    backgroundColor: '#FFFFFF',
  },

  // Hero
  heroSection: {
    paddingTop: 20,
    paddingBottom: 32,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  backButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    zIndex: 10,
  },
  backButtonInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoGlow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#7C3AED',
    opacity: 0.18,
    top: 50,
    alignSelf: 'center',
  },
  heroLogo: {
    width: 76,
    height: 76,
    borderRadius: 38,
    marginTop: 16,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: 'rgba(167,139,250,0.4)',
  },
  heroTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: '#F3EEFF',
    letterSpacing: 0.3,
    marginBottom: 8,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 15,
    color: '#C4A8F0',
    textAlign: 'center',
    opacity: 0.9,
    letterSpacing: 0.2,
  },

  // Card
  card: {
    width: '100%',
    backgroundColor: '#FDFBFF',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    overflow: 'hidden',
    shadowColor: '#4B0082',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: -6 },
    shadowRadius: 24,
    elevation: 16,
  },
  cardAccentLine: {
    height: 4,
    width: '100%',
  },
  cardContent: {
    paddingTop: 32,
    paddingBottom: 44,
    paddingHorizontal: 28,
  },
  cardTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#1A0B2E',
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#8B7BAE',
    marginBottom: 28,
    letterSpacing: 0.1,
  },

  // Input
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F3FF',
    borderRadius: 18,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 8,
  },
  phoneIconWrap: {
    width: 26,
    alignItems: 'center',
    marginRight: 6,
  },
  inputDivider: {
    width: 1,
    height: 22,
    backgroundColor: '#DDD4F0',
    marginHorizontal: 10,
  },
  input: {
    flex: 1,
    color: '#1A0B2E',
    fontSize: 16,
    fontWeight: '500',
    paddingVertical: 14,
    letterSpacing: 0.5,
  },
  clearButton: {
    padding: 4,
    marginLeft: 4,
  },
  inputHint: {
    fontSize: 12,
    color: '#A090C0',
    marginBottom: 24,
    marginLeft: 4,
    letterSpacing: 0.1,
  },

  // OTP Button
  otpButtonWrapper: {
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#7C3AED',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 6,
  },
  otpButton: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  otpButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 17,
    letterSpacing: 0.4,
  },

  // Terms
  termsText: {
    fontSize: 12,
    color: '#A090C0',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  termsLink: {
    color: '#7C3AED',
    fontWeight: '600',
  },

  // Login
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    color: '#8B7BAE',
    fontSize: 14,
  },
  loginLink: {
    color: '#7C3AED',
    fontWeight: '700',
    fontSize: 14,
  },
});