import { COUNTRIES, CountryCodePicker, type Country } from '@/components/country-code-picker';
import { useAuthAlert } from '@/lib/auth-alert-context';
import { supabase } from '@/lib/supabase';
import { isValidPhoneNumber } from '@/utils/phone-utils';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { makeRedirectUri } from 'expo-auth-session';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

WebBrowser.maybeCompleteAuthSession();
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
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


const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function LoginScreen() {
  const router = useRouter();
  const navigation: any = useNavigation();
  const { showAlert } = useAuthAlert();
    const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[0]);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const isMountedRef = useRef(true);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

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
      const { data, error } = await supabase.auth.signInWithOtp({ phone: formatted });
      if (error) {
        let errorMessage = error.message || 'Could not send OTP. Please try again.';
        if (error.message?.includes('Invalid phone number')) {
          errorMessage = 'Invalid phone number format. Please include country code.';
        } else if (error.message?.includes('Twilio') || error.message?.includes('SMS')) {
          errorMessage = 'SMS service error. Please check your configuration.';
        }
        showAlert('OTP Generation Failed', errorMessage);
        if (isMountedRef.current) setLoading(false);
        return;
      }
      if (!data) {
        showAlert('OTP Generation Failed', 'No response from server.');
        if (isMountedRef.current) setLoading(false);
        return;
      }
      router.push({ pathname: '/onboarding/phone-verification', params: { phone: formatted } });
    } catch (err: any) {
      showAlert('Login error', err?.message ?? String(err) ?? 'An unexpected error occurred.');
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  const checkUserAndNavigate = async (userId?: string, email?: string, appleFullName?: string) => {
    if (!userId) {
      router.replace('/onboarding/welcome');
      return;
    }

    // Check 1 — profile matched by Supabase user_id (already linked or phone user)
    const { data: profileByUserId } = await supabase
      .from('user_profiles')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (profileByUserId) {
      router.replace('/(tabs)');
      return;
    }

    // Check 2 — profile matched by email (existing phone user, Apple not yet linked)
    let profileByEmail = null;
    if (email) {
      const { data } = await supabase
        .from('user_profiles')
        .select('user_id')
        .eq('email', email)
        .maybeSingle();
      profileByEmail = data;
    }

    if (profileByEmail) {
      // Email belongs to a phone-signup account — session user_id would be wrong if we let them in
      await supabase.auth.signOut();
      showAlert(
        'Account Not Linked',
        'This Apple ID is not linked to any account. Log in with your phone number, then go to Settings → Linked Accounts to connect your Apple ID.',
        [
          { text: 'Log in with Phone', onPress: () => router.replace('/onboarding/login') },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }

    // Check 3 — no profile anywhere
    if (email) {
      // Apple provided an email (first-ever sign-in) and no account exists → new user → onboard
      router.replace({
        pathname: '/onboarding/basic-details',
        params: {
          ...(appleFullName ? { prefillName: appleFullName } : {}),
          prefillEmail: email,
        },
      });
    } else {
      // No email (Apple withholds it after first sign-in) and no profile → cannot identify user
      await supabase.auth.signOut();
      showAlert(
        'Account Not Found',
        'Could not find an account for this Apple ID. Please sign up with your phone number first.',
        [
          { text: 'Sign Up', onPress: () => router.replace('/onboarding/signup') },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'apple') => {
    if (isLoggingIn) return;
    try {
      setIsLoggingIn(true);
      
      if (provider === 'apple' && Platform.OS === 'ios') {
        // Generate nonce — Apple receives the SHA-256 hash, Supabase receives the raw value
        const rawNonce = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
        const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

        const credential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
          nonce: hashedNonce,
        });

        // Apple sends fullName and email only on the FIRST sign-in ever — capture immediately
        const appleFullName = [credential.fullName?.givenName, credential.fullName?.familyName]
          .filter(Boolean).join(' ') || undefined;
        const appleEmail = credential.email ?? undefined;

        if (credential.identityToken) {
          const { data: sessionData, error } = await supabase.auth.signInWithIdToken({
            provider: 'apple',
            token: credential.identityToken,
            nonce: rawNonce,
          });

          if (error) throw error;
          await checkUserAndNavigate(
            sessionData.session?.user?.id,
            sessionData.session?.user?.email ?? appleEmail,
            appleFullName,
          );
          return;
        } else {
          throw new Error('No identity token returned from Apple.');
        }
      }

      const redirectUrl = Linking.createURL('auth/callback');
      console.log('🔗 [auth] Starting OAuth with redirect:', redirectUrl);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) throw error;
      if (!data?.url) return;

      // Processes the callback URL once we have it (code or implicit token)
      const processLoginUrl = async (url: string) => {
        const parsed = Linking.parse(url);
        let code = parsed.queryParams?.code as string | undefined;

        if (!code && url.includes('?')) {
          const query = url.split('?')[1]?.split('#')[0] || '';
          for (const pair of query.split('&')) {
            const [k, v] = pair.split('=');
            if (k === 'code' && v) { code = decodeURIComponent(v); break; }
          }
        }

        if (code) {
          const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
          if (sessionError) throw sessionError;
          await checkUserAndNavigate(sessionData.session?.user?.id);
          return;
        }

        if (url.includes('#access_token')) {
          const hash = url.split('#')[1] || '';
          let access_token: string | null = null;
          let refresh_token: string | null = null;
          for (const pair of hash.split('&')) {
            const [k, v] = pair.split('=');
            if (k === 'access_token' && v) access_token = decodeURIComponent(v);
            if (k === 'refresh_token' && v) refresh_token = decodeURIComponent(v);
          }
          if (access_token && refresh_token) {
            const { data: sessionData } = await supabase.auth.setSession({ access_token, refresh_token });
            await checkUserAndNavigate(sessionData.session?.user?.id);
          } else {
            router.replace('/onboarding/welcome');
          }
          return;
        }

        router.replace('/onboarding/welcome');
      };

      if (Platform.OS === 'android') {
        const linkingPromise = new Promise<string>((resolve, reject) => {
          const timeout = setTimeout(() => {
            sub.remove();
            reject(new Error('Google sign-in timed out. Please try again.'));
          }, 120_000);

          const sub = Linking.addEventListener('url', ({ url }) => {
            console.log(`[auth] Android deep link received:`, url);
            if (url.includes('code=') || url.includes('access_token') || url.includes('error=')) {
              clearTimeout(timeout);
              sub.remove();
              resolve(url);
            }
          });
        });

        console.log(`[auth] Opening Google auth in default browser...`);
        await Linking.openURL(data.url);
        const authUrl = await linkingPromise;
        await processLoginUrl(authUrl);
      } else {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
        console.log(`[auth] Browser result: ${result.type}`);
        if (result.type === 'success' && result.url) {
          await processLoginUrl(result.url);
        }
      }
    } catch (err: any) {
      if (err?.code === 'ERR_REQUEST_CANCELED') return; // user dismissed Apple sheet — silent
      console.warn('⚠️ Social login error:', err);
      showAlert('Login error', err?.message ?? 'Social login failed. Please try again.');
    } finally {
      if (isMountedRef.current) setIsLoggingIn(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Background Illustration */}
      <Image
        source={require('@/assets/images/get_started_bg.png')}
        style={styles.bgIllustration}
        resizeMode="cover"
      />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            scrollEnabled={true}
            bounces={true}
          >

            {/* Header Section (Welcome Back) */}
            {!isKeyboardVisible && (
              <View style={styles.headerSection}>
                <Text style={styles.headerTitle}>Welcome Back</Text>
                <Text style={styles.headerSubtitle}>
                  Your stars have been waiting ✦
                </Text>
              </View>
            )}

            {/* Spacing spacer to push content down when keyboard is not visible */}
            {isKeyboardVisible && <View style={{ height: SCREEN_HEIGHT * 0.1 }} />}

            {/* Login Form Card */}
            <BlurView
              intensity={60}
              tint="dark"
              style={styles.glassCard}
            >
              {/* Card Title & Icon Header */}
              <View style={styles.cardHeaderRow}>
                <View style={styles.iconCircle}>
                  <MaterialIcons name="person-outline" size={24} color="#A855F7" />
                </View>
                <View style={styles.headerTextCol}>
                  <Text style={styles.cardTitle}>Login</Text>
                  <Text style={styles.cardSubtitle}>Enter your phone number to continue</Text>
                </View>
              </View>

              {/* Phone Input Box */}
              <View style={[styles.inputContainer, isFocused && styles.inputContainerFocused]}>
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
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  style={styles.input}
                  keyboardType="number-pad"
                  autoCapitalize="none"
                  maxLength={10}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  accessibilityLabel="Phone number input"
                  accessibilityHint="Enter your mobile number for login"
                />
              </View>

              {/* Send OTP Button */}
              <TouchableOpacity
                onPress={handleGenerateOTP}
                activeOpacity={0.85}
                disabled={loading}
                style={[styles.buttonWrapper, phoneNumber.length === 0 && styles.buttonDisabled]}
                accessibilityRole="button"
                accessibilityLabel="Send OTP"
                accessibilityHint="Requests a one-time password to be sent to your phone number"
                accessibilityState={{ disabled: loading || phoneNumber.length === 0 }}
              >
                <LinearGradient
                  colors={['#A855F7', '#6366F1']}
                  style={styles.getStartedButton}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <View style={styles.buttonTextRow}>
                      <MaterialIcons name="send" size={17} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={styles.getStartedButtonText}>Send OTP</Text>
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* OR Divider */}
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Social Login Buttons */}
              <View style={styles.authButtonsContainer}>
                <TouchableOpacity 
                  style={[styles.socialButton, styles.appleButton, isLoggingIn && styles.buttonDisabled]} 
                  onPress={() => handleSocialLogin('apple')}
                  disabled={isLoggingIn}
                >
                  {isLoggingIn ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Ionicons name="logo-apple" size={18} color="#FFFFFF" style={styles.socialIcon} />
                      <Text style={styles.appleButtonText}>Continue with Apple</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.socialButton, styles.googleButton, isLoggingIn && styles.buttonDisabled]}
                  onPress={() => handleSocialLogin('google')}
                  disabled={isLoggingIn}
                  accessibilityRole="button"
                  accessibilityLabel="Continue with Google"
                  accessibilityState={{ disabled: isLoggingIn }}
                >
                  {isLoggingIn ? (
                    <ActivityIndicator color="#000000" size="small" />
                  ) : (
                    <>
                      <Ionicons name="logo-google" size={18} color="#000000" style={styles.socialIcon} />
                      <Text style={styles.googleButtonText}>Continue with Google</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Sign up link */}
              <View style={styles.signupRow}>
                <Text style={styles.signupText}>Don't have an account? </Text>
                <TouchableOpacity 
                  onPress={() => router.push('/onboarding/signup')}
                  accessibilityRole="button"
                  accessibilityLabel="Sign up"
                  accessibilityHint="Navigates to the account registration screen"
                >
                  <Text style={styles.signupLink}>Sign up</Text>
                </TouchableOpacity>
              </View>
            </BlurView>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#04020b', // deep cosmic black background
  },
  bgIllustration: {
    position: 'absolute',
    width: '100%',
    height: SCREEN_HEIGHT * 0.55,
    top: -SCREEN_HEIGHT * 0.04, // shifted down to original spacious position
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  topSection: {
    alignItems: 'center',
    paddingTop: SCREEN_HEIGHT * 0.015,
  },
  logo: {
    width: 56,
    height: 56,
    marginBottom: 6,
  },
  appName: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  appNameStart: {
    color: '#FFFFFF',
  },
  appNameEnd: {
    color: '#A855F7', // rich purple matching the logo
  },
  headerSection: {
    alignItems: 'center',
    marginTop: SCREEN_HEIGHT * 0.30, // shifted up slightly to fit new buttons
    marginBottom: 12,
    paddingHorizontal: 24,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#CBD5E1',
    textAlign: 'center',
    lineHeight: 20,
    opacity: 0.85,
  },
  glassCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 18, // compacted padding
    paddingHorizontal: 20,
    marginHorizontal: 20,
    backgroundColor: 'rgba(13, 6, 28, 0.7)',
    overflow: 'hidden',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    width: '100%',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTextCol: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#CBD5E1',
    opacity: 0.65,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 12,
    height: 54,
    marginBottom: 14, // compacted margin
    width: '100%',
  },
  inputContainerFocused: {
    borderColor: '#A855F7',
  },
  inputDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginHorizontal: 8,
  },
  input: {
    flex: 1,
    color: '#EDE8FF',
    fontSize: 15,
    fontWeight: '500',
  },
  buttonWrapper: {
    borderRadius: 30,
    shadowColor: '#A855F7',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 6,
    marginBottom: 14, // compacted margin
    width: '100%',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  getStartedButton: {
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  getStartedButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  signupText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 13,
  },
  signupLink: {
    color: '#A855F7',
    fontWeight: '600',
    fontSize: 13,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  dividerText: {
    color: 'rgba(255, 255, 255, 0.4)',
    marginHorizontal: 12,
    fontSize: 12,
  },
  authButtonsContainer: {
    gap: 10,
    marginBottom: 16,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 30,
  },
  socialIcon: {
    marginRight: 8,
  },
  appleButton: {
    backgroundColor: '#000000',
  },
  appleButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
  },
  googleButtonText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '600',
  },
});