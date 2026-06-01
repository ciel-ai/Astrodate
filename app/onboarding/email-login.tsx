/**
 * app/onboarding/email-login.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Email + Password login screen.
 * - Blocks unverified users and shows resend option
 * - Google OAuth reused from existing login.tsx pattern
 * - Matches existing visual design exactly
 */

import { useAuthAlert } from '@/lib/auth-alert-context';
import {
  loginWithEmail,
  resendVerificationEmail,
  validateEmail,
  validatePassword
} from '@/lib/email-auth';
import { supabase } from '@/lib/supabase';
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

WebBrowser.maybeCompleteAuthSession();

export default function EmailLoginScreen() {
  const router = useRouter();
  const navigation: any = useNavigation();
  const { showAlert } = useAuthAlert();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  const oauthRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const cardSlideAnim = useRef(new Animated.Value(80)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 50, useNativeDriver: true }),
      Animated.spring(cardSlideAnim, { toValue: 0, friction: 8, tension: 40, delay: 150, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (oauthRetryRef.current) clearTimeout(oauthRetryRef.current);
    };
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardVisible(true)
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsKeyboardVisible(false)
    );
    return () => { show.remove(); hide.remove(); };
  }, []);



  const inputBorder = (field: string) => ({
    borderColor: focusedField === field ? '#7C3AED' : '#E8E0F0',
  });

  const handleLogin = async () => {
    Keyboard.dismiss();

    const emailError = validateEmail(email);
    if (emailError) { showAlert('Invalid Email', emailError); return; }

    const passwordError = validatePassword(password);
    if (passwordError) { showAlert('Invalid Password', passwordError); return; }

    if (isMountedRef.current) setLoading(true);

    console.log('🔑 [email-login] Attempting login', { email: email.trim().toLowerCase() });

    try {
      const result = await loginWithEmail(email, password);
      if (!isMountedRef.current) return;

      if (!result.success) {
        showAlert('Login Failed', result.error ?? 'An error occurred');
        return;
      }

      // Successful login — check if profile exists to route correctly
      const user = result.data?.session?.user;
      if (!user) return;

      console.log('✅ [email-login] Login success, checking profile', { userId: user.id });

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!isMountedRef.current) return;

      if (profile) {
        console.log('✅ [email-login] Profile found — navigating to tabs');
        router.replace('/(tabs)');
      } else {
        console.log('ℹ️ [email-login] No profile — navigating to onboarding');
        router.replace('/onboarding/basic-details');
      }
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };



  const handleGoogleLogin = async () => {
    try {
      if (isMountedRef.current) setLoading(true);
      const finalRedirectUri = makeRedirectUri({ native: 'astrodate://auth/callback' });
      console.log('🔗 [email-login] Google OAuth redirect URI:', finalRedirectUri);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: finalRedirectUri, skipBrowserRedirect: false },
      });

      if (error || !data?.url) {
        showAlert('Google Login Failed', error?.message ?? 'Could not start Google login.');
        if (isMountedRef.current) setLoading(false);
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, finalRedirectUri, { showInRecents: true });
      console.log('📱 [email-login] Google OAuth result:', result.type);

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
            const { data: sd, error: se } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
            if (!se && sd?.session?.user) {
              await handleOAuthSuccess(sd.session.user);
              return;
            }
          }
        } catch { }

        // Fallback: poll for session
        let retries = 0;
        const checkSession = async () => {
          if (!isMountedRef.current) return;
          const { data: sd } = await supabase.auth.getSession();
          if (sd?.session?.user) {
            await handleOAuthSuccess(sd.session.user);
          } else if (retries < 10) {
            retries++;
            oauthRetryRef.current = setTimeout(checkSession, 500);
          } else {
            if (isMountedRef.current) setLoading(false);
            showAlert('Authentication Error', 'Could not establish session. Please try again.');
          }
        };
        oauthRetryRef.current = setTimeout(checkSession, 500);
      } else {
        if (isMountedRef.current) setLoading(false);
      }
    } catch (err: any) {
      console.error('❌ [email-login] Google OAuth exception:', err);
      showAlert('Google Login Error', err?.message ?? String(err));
      if (isMountedRef.current) setLoading(false);
    }
  };

  const handleOAuthSuccess = async (user: any) => {
    console.log('✅ [email-login] Google OAuth success', { userId: user.id });
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!isMountedRef.current) return;
    if (isMountedRef.current) setLoading(false);

    if (!profile) {
      await supabase.auth.signOut();
      showAlert('Account Not Found', 'No account found with this Google email. Please sign up first.',
        [{ text: 'Go to Signup', onPress: () => router.replace('/onboarding/email-signup') }]);
      return;
    }
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={0}
      >
        <LinearGradient
          colors={['#0D0618', '#1A0B2E', '#2D1255', '#3D1A6E']}
          style={styles.background}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
        >
          {/* Star field */}
          <View style={styles.starField} pointerEvents="none">
            {[...Array(28)].map((_, i) => (
              <View
                key={i}
                style={[styles.star, {
                  top: `${(i * 37 + 5) % 95}%`,
                  left: `${(i * 53 + 8) % 93}%`,
                  width: i % 4 === 0 ? 3 : i % 3 === 0 ? 2 : 1.5,
                  height: i % 4 === 0 ? 3 : i % 3 === 0 ? 2 : 1.5,
                  opacity: 0.15 + (i % 5) * 0.12,
                }]}
              />
            ))}
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {!isKeyboardVisible && (
              <Animated.View style={[styles.heroSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
                  <View style={styles.backButtonInner}>
                    <MaterialIcons name="arrow-back" size={20} color="#E0D4FF" />
                  </View>
                </TouchableOpacity>
                <View style={styles.logoGlow} />
                <Image source={require('../../assets/images/logo.png')} style={styles.heroLogo} resizeMode="contain" />
                <Text style={styles.heroTitle}>Welcome Back</Text>
                <Text style={styles.heroSubtitle}>Your stars have been waiting ✦</Text>
              </Animated.View>
            )}

            <Animated.View style={[styles.card, { transform: [{ translateY: cardSlideAnim }], opacity: fadeAnim }]}>
              <LinearGradient
                colors={['#7C3AED', '#A855F7', '#EC4899']}
                style={styles.cardAccentLine}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>Sign In</Text>
                <Text style={styles.cardSubtitle}>Enter your email and password</Text>

                {/* Email */}
                <View style={[styles.inputContainer, inputBorder('email')]}>
                  <MaterialIcons name="email" size={17} color="#9B72CF" style={styles.inputIcon} />
                  <TextInput
                    value={email}
                    onChangeText={(t) => setEmail(t.toLowerCase().trim())}
                    placeholder="Email address"
                    placeholderTextColor="#B0A0C8"
                    style={styles.input}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                  />
                </View>

                {/* Password */}
                <View style={[styles.inputContainer, inputBorder('password'), { marginBottom: 24 }]}>
                  <MaterialIcons name="lock" size={17} color="#9B72CF" style={styles.inputIcon} />
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Password"
                    placeholderTextColor="#B0A0C8"
                    style={styles.input}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <MaterialIcons name={showPassword ? 'visibility-off' : 'visibility'} size={18} color="#B0A0C8" />
                  </TouchableOpacity>
                </View>



                {/* Login button */}
                <TouchableOpacity onPress={handleLogin} activeOpacity={0.85} disabled={loading} style={styles.buttonWrapper}>
                  <LinearGradient
                    colors={loading ? ['#6B6B8A', '#6B6B8A'] : ['#6D28D9', '#7C3AED', '#9333EA']}
                    style={styles.button}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <MaterialIcons name="login" size={18} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.buttonText}>Sign In</Text>
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

                {/* Google */}
                <TouchableOpacity onPress={handleGoogleLogin} activeOpacity={0.85} disabled={loading} style={styles.googleButton}>
                  <View style={styles.googleIconCircle}>
                    <Text style={styles.googleLetter}>G</Text>
                  </View>
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </TouchableOpacity>

                <View style={styles.signupRow}>
                  <Text style={styles.signupText}>Don't have an account?</Text>
                  <TouchableOpacity onPress={() => router.push('/onboarding/email-signup')} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                    <Text style={styles.signupLink}> Sign up</Text>
                  </TouchableOpacity>
                </View>

                {/* Phone login link */}
                <TouchableOpacity onPress={() => router.push('/onboarding/login')} style={styles.altAuthRow}>
                  <MaterialIcons name="phone" size={14} color="#8B7BAE" />
                  <Text style={styles.altAuthText}> Sign in with phone instead</Text>
                </TouchableOpacity>
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
  starField: { ...StyleSheet.absoluteFillObject },
  star: { position: 'absolute', borderRadius: 99, backgroundColor: '#FFFFFF' },
  heroSection: { paddingTop: 20, paddingBottom: 32, alignItems: 'center', paddingHorizontal: 24 },
  backButton: { position: 'absolute', top: 20, left: 20, zIndex: 10 },
  backButtonInner: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  logoGlow: {
    position: 'absolute', width: 120, height: 120, borderRadius: 60,
    backgroundColor: '#7C3AED', opacity: 0.18, top: 50, alignSelf: 'center',
  },
  heroLogo: { width: 76, height: 76, borderRadius: 38, marginTop: 16, marginBottom: 20, borderWidth: 2, borderColor: 'rgba(167,139,250,0.4)' },
  heroTitle: { fontSize: 34, fontWeight: '800', color: '#F3EEFF', letterSpacing: 0.3, marginBottom: 8, textAlign: 'center' },
  heroSubtitle: { fontSize: 15, color: '#C4A8F0', textAlign: 'center', opacity: 0.9, letterSpacing: 0.2 },
  card: {
    width: '100%', backgroundColor: '#FDFBFF', borderTopLeftRadius: 36, borderTopRightRadius: 36,
    overflow: 'hidden', shadowColor: '#4B0082', shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: -6 }, shadowRadius: 24, elevation: 16,
  },
  cardAccentLine: { height: 4, width: '100%' },
  cardContent: { paddingTop: 32, paddingBottom: 44, paddingHorizontal: 28 },
  cardTitle: { fontSize: 30, fontWeight: '800', color: '#1A0B2E', marginBottom: 6, letterSpacing: 0.2 },
  cardSubtitle: { fontSize: 14, color: '#8B7BAE', marginBottom: 20, letterSpacing: 0.1 },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7F3FF',
    borderRadius: 18, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 4, marginBottom: 12,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: '#1A0B2E', fontSize: 15, fontWeight: '500', paddingVertical: 14 },
  buttonWrapper: {
    borderRadius: 18, overflow: 'hidden', marginBottom: 24,
    shadowColor: '#7C3AED', shadowOpacity: 0.35, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 6,
  },
  button: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  buttonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 17, letterSpacing: 0.4 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#EAE2F8' },
  dividerText: { color: '#A090C0', fontSize: 13, marginHorizontal: 14, fontWeight: '500' },
  googleButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 18, paddingVertical: 14,
    borderWidth: 1.5, borderColor: '#E8E0F4', marginBottom: 28,
    shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2, gap: 10,
  },
  googleIconCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F1EDFF', alignItems: 'center', justifyContent: 'center' },
  googleLetter: { fontSize: 15, fontWeight: '800', color: '#4285F4' },
  googleButtonText: { fontSize: 15, fontWeight: '600', color: '#2D1255', letterSpacing: 0.2 },
  signupRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  signupText: { color: '#8B7BAE', fontSize: 14 },
  signupLink: { color: '#7C3AED', fontWeight: '700', fontSize: 14 },
  altAuthRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  altAuthText: { color: '#8B7BAE', fontSize: 13 },
});

function makeRedirectUri({ native }: { native: string }) {
  // Preserve the provided native redirect URI and normalize any accidental
  // triple-slash form (e.g. astrodate:///auth/callback) that can cause issues
  // on Android.
  return native.replace(/:\/\/\/+/, '://');
}
