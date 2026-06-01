import { COUNTRIES, CountryCodePicker, type Country } from '@/components/country-code-picker';
import { useAuthAlert } from '@/lib/auth-alert-context';
import { supabase } from '@/lib/supabase';
import { verifyPhoneNumberExists } from '@/lib/user-profile';
import { isValidPhoneNumber } from '@/utils/phone-utils';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { makeRedirectUri } from 'expo-auth-session';
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

export default function LoginScreen() {
  const router = useRouter();
  const navigation: any = useNavigation();
  const { showAlert } = useAuthAlert();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[0]);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const isMountedRef = useRef(true);
  const oauthRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      if (oauthRetryTimeoutRef.current) {
        clearTimeout(oauthRetryTimeoutRef.current);
        oauthRetryTimeoutRef.current = null;
      }
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
    if (!isSignup) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!profile) {
        if (isMountedRef.current) setLoading(false);
        await supabase.auth.signOut();
        showAlert('Account Not Found', 'No account found with this Google email. Please sign up first.',
          [{ text: 'Go to Signup', onPress: () => router.replace('/onboarding/signup') }]);
        return;
      }
    }
    console.log('✅ Login successful, navigating to home');
    if (isMountedRef.current) setLoading(false);
    router.replace('/(tabs)');
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
      console.log('🔍 Verifying user with phone number:', formatted);
      const verificationResult = await verifyPhoneNumberExists(formatted);

      if (!verificationResult.success || !verificationResult.data) {
        console.warn('⚠️ No account found with this phone number');
        console.warn('⚠️ Verification result:', verificationResult);

        if (isMountedRef.current) setLoading(false);
        showAlert(
          'Account Not Found',
          'No account found with this phone number. Please sign up first.',
          [
            {
              text: 'Go to Signup',
              onPress: () => { router.replace('/onboarding/signup'); },
            },
            {
              text: 'Cancel',
              onPress: () => { if (isMountedRef.current) setLoading(false); },
              style: 'cancel',
            },
          ]
        );
        return;
      }

      console.log('✅ User found in database:', {
        userId: verificationResult.data.user_id,
        phoneInDb: verificationResult.phoneNumberInDb,
        name: verificationResult.data.full_name,
      });

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
        pathname: '/onboarding/phone-verification',
        params: { phone: formatted },
      });
    } catch (err: any) {
      console.error('❌ Login error:', err?.message || String(err));
      showAlert('Login error', err?.message ?? String(err) ?? 'An unexpected error occurred. Please try again.');
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  const handleOAuthSignIn = async () => {
    try {
      setLoading(true);
      const finalRedirectUri = makeRedirectUri({ native: 'astrodate://auth/callback' });
      console.log('🔗 Final Redirect URI:', finalRedirectUri);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: finalRedirectUri,
          skipBrowserRedirect: false,
        }
      });

      if (error) {
        console.error('❌ OAuth error:', error);
        showAlert('OAuth error', error.message || 'Could not start OAuth');
        if (isMountedRef.current) setLoading(false);
        return;
      }

      if (!data || !data.url) {
        console.error('❌ No OAuth URL received');
        showAlert('OAuth error', 'Invalid OAuth response from Supabase');
        if (isMountedRef.current) setLoading(false);
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, finalRedirectUri, { showInRecents: true });
      console.log('📱 OAuth result:', result.type);

      if (result.type === 'cancel') {
        if (isMountedRef.current) setLoading(false);
        return;
      }

      if (result.type === 'success' && result.url) {
        try {
          const urlObj = new URL(result.url);
          const hashParams = new URLSearchParams(urlObj.hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');

          if (accessToken && refreshToken) {
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

          if (sessionError) {
            // Before: setLoading(false); return;
            // After:
            if (isMountedRef.current) setLoading(false);
            showAlert(
              'Authentication Error',
              'Could not establish session. Please try again.'
            );
            return;
          }
            if (sessionData?.session?.user) {
              await handleOAuthSuccess(sessionData.session.user, false);
              return;
            }
          }
        } catch (urlError) {
          console.log('⚠️ Could not parse URL, trying session retrieval...');
        }

        let retries = 0;
        const maxRetries = 10;
        const checkSession = async () => {
          if (!isMountedRef.current) return;
          const sessionResult = await supabase.auth.getSession();
          const session = sessionResult?.data?.session;
          const sessionError = sessionResult?.error;

          if (sessionError) {
            if (retries >= maxRetries) {
              if (isMountedRef.current) setLoading(false);
              showAlert('Authentication Error', 'Could not establish session. Please try again.');
            } else {
              retries++;
              oauthRetryTimeoutRef.current = setTimeout(checkSession, 500);
            }
            return;
          }

          if (session?.user) {
            await handleOAuthSuccess(session.user, false);
          } else {
            if (retries < maxRetries) {
              retries++;
              oauthRetryTimeoutRef.current = setTimeout(checkSession, 500);
            } else {
              if (isMountedRef.current) setLoading(false);
              showAlert('Authentication Error', 'Session not found. Please try again.');
            }
          }
        };

        oauthRetryTimeoutRef.current = setTimeout(checkSession, 500);
      } else {
        if (isMountedRef.current) setLoading(false);
      }
    } catch (err: any) {
      console.error('❌ Exception in OAuth:', err);
      showAlert('OAuth error', err?.message ?? String(err));
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

                <Text style={styles.heroTitle}>Welcome Back</Text>
                <Text style={styles.heroSubtitle}>Your stars have been waiting ✦</Text>
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
                <Text style={styles.cardTitle}>Sign In</Text>
                <Text style={styles.cardSubtitle}>Enter your phone number to continue</Text>

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
                        <MaterialIcons name="send" size={18} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.otpButtonText}>Send OTP</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {/* Divider */}
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* Google Sign In */}
                <TouchableOpacity
                  onPress={handleOAuthSignIn}
                  activeOpacity={0.85}
                  disabled={loading}
                  style={styles.googleButton}
                >
                  <View style={styles.googleIconCircle}>
                    <Text style={styles.googleLetter}>G</Text>
                  </View>
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </TouchableOpacity>

                {/* Sign up link */}
                <View style={styles.signupRow}>
                  <Text style={styles.signupText}>Don't have an account?</Text>
                  <TouchableOpacity onPress={() => router.push('/onboarding/signup')} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                    <Text style={styles.signupLink}> Sign up</Text>
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
    marginBottom: 24,
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

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#EAE2F8',
  },
  dividerText: {
    color: '#A090C0',
    fontSize: 13,
    marginHorizontal: 14,
    fontWeight: '500',
  },

  // Google
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: '#E8E0F4',
    marginBottom: 28,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
    gap: 10,
  },
  googleIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1EDFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleLetter: {
    fontSize: 15,
    fontWeight: '800',
    color: '#4285F4',
  },
  googleButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2D1255',
    letterSpacing: 0.2,
  },

  // Sign up
  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signupText: {
    color: '#8B7BAE',
    fontSize: 14,
  },
  signupLink: {
    color: '#7C3AED',
    fontWeight: '700',
    fontSize: 14,
  },
});
