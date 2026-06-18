/**
 * app/onboarding/email-signup.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Email + Password signup screen.
 * Mirrors the visual design of the existing phone-based signup.tsx exactly.
 * On success → navigates to email-verify-pending screen (not the app).
 */

import { useAuthAlert } from '@/lib/auth-alert-context';
import {
  getErrorMessage,
  signUpWithEmail,
  validateEmail,
  validateName,
  validatePassword,
} from '@/lib/email-auth';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
// makeRedirectUri removed — it generates astrodate:///auth/verify (triple slash)
// which Android intent filters do not match. Use the explicit URL instead.
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
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

export default function EmailSignupScreen() {
  const router = useRouter();
  const navigation: any = useNavigation();
  const { showAlert } = useAuthAlert();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const isSubmittingRef = useRef(false); // prevent duplicate submissions

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
    return () => { isMountedRef.current = false; };
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

  const handleSignup = async () => {
    if (isSubmittingRef.current) {
      console.warn('⚠️ [email-signup] Duplicate submission blocked');
      return;
    }

    Keyboard.dismiss();

    // Client-side validation
    const nameError = validateName(name);
    if (nameError) { showAlert('Invalid Name', nameError); return; }

    const emailError = validateEmail(email);
    if (emailError) { showAlert('Invalid Email', emailError); return; }

    const passwordError = validatePassword(password);
    if (passwordError) { showAlert('Weak Password', passwordError); return; }

    if (password !== confirmPassword) {
      showAlert('Password Mismatch', 'Passwords do not match. Please try again.');
      return;
    }

    isSubmittingRef.current = true;
    if (isMountedRef.current) setLoading(true);

    // Build the redirect URL — must match Android intentFilter: astrodate://auth/verify
    // NOTE: makeRedirectUri generates astrodate:///auth/verify (triple slash) which
    // Android intent filters reject. Use the explicit URL instead.
    const redirectUrl = 'astrodate://auth/verify';

    console.log('📧 [email-signup] Starting signup', {
      redirectUrl,
    });

    try {
      const result = await signUpWithEmail(email, password, name, redirectUrl);

      if (!isMountedRef.current) return;

      if (!result.success) {
        if (result.code === 'EMAIL_ALREADY_EXISTS') {
          showAlert(
            'Account Already Exists',
            result.error ?? 'An error occurred',
            [
              { text: 'Log In Instead', onPress: () => router.replace('/onboarding/email-login') },
              { text: 'Cancel', style: 'cancel' },
            ]
          );
        } else {
          showAlert('Sign Up Failed', result.error ?? 'An error occurred');
        }
        return;
      }

      console.log('✅ [email-signup] Account created, verification disabled, proceeding to onboarding');

      // Navigate straight to the basic details onboarding screen
      router.replace('/onboarding/basic-details');
    } finally {
      isSubmittingRef.current = false;
      if (isMountedRef.current) setLoading(false);
    }
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
            {!isKeyboardVisible && (
              <Animated.View
                style={[styles.heroSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
              >
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
                  <View style={styles.backButtonInner}>
                    <MaterialIcons name="arrow-back" size={20} color="#E0D4FF" />
                  </View>
                </TouchableOpacity>
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

            <Animated.View style={[styles.card, { transform: [{ translateY: cardSlideAnim }], opacity: fadeAnim }]}>
              <LinearGradient
                colors={['#7C3AED', '#A855F7', '#EC4899']}
                style={styles.cardAccentLine}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />

              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>Sign Up</Text>
                <Text style={styles.cardSubtitle}>Enter your details to get started</Text>

                {/* Name */}
                <View style={[styles.inputContainer, inputBorder('name')]}>
                  <MaterialIcons name="person" size={17} color="#9B72CF" style={styles.inputIcon} />
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Full name"
                    placeholderTextColor="#B0A0C8"
                    style={styles.input}
                    autoCapitalize="words"
                    onFocus={() => setFocusedField('name')}
                    onBlur={() => setFocusedField(null)}
                  />
                </View>

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
                <View style={[styles.inputContainer, inputBorder('password')]}>
                  <MaterialIcons name="lock" size={17} color="#9B72CF" style={styles.inputIcon} />
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Password (min 8 characters)"
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

                {/* Confirm Password */}
                <View style={[styles.inputContainer, inputBorder('confirm'), { marginBottom: 24 }]}>
                  <MaterialIcons name="lock-outline" size={17} color="#9B72CF" style={styles.inputIcon} />
                  <TextInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Confirm password"
                    placeholderTextColor="#B0A0C8"
                    style={styles.input}
                    secureTextEntry={!showConfirm}
                    autoCapitalize="none"
                    onFocus={() => setFocusedField('confirm')}
                    onBlur={() => setFocusedField(null)}
                  />
                  <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <MaterialIcons name={showConfirm ? 'visibility-off' : 'visibility'} size={18} color="#B0A0C8" />
                  </TouchableOpacity>
                </View>

                {/* Submit */}
                <TouchableOpacity
                  onPress={handleSignup}
                  activeOpacity={0.85}
                  disabled={loading}
                  style={styles.buttonWrapper}
                >
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
                        <MaterialIcons name="mail" size={18} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.buttonText}>Create Account</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <Text style={styles.termsText}>
                  By signing up you agree to our{' '}
                  <Text style={styles.termsLink}>Terms of Service</Text>
                  {' '}and{' '}
                  <Text style={styles.termsLink}>Privacy Policy</Text>
                </Text>

                <View style={styles.loginRow}>
                  <Text style={styles.loginText}>Already have an account?</Text>
                  <TouchableOpacity onPress={() => router.push('/onboarding/email-login')} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                    <Text style={styles.loginLink}> Log In</Text>
                  </TouchableOpacity>
                </View>

                {/* Phone signup link */}
                <TouchableOpacity onPress={() => router.push('/onboarding/signup')} style={styles.altAuthRow}>
                  <MaterialIcons name="phone" size={14} color="#8B7BAE" />
                  <Text style={styles.altAuthText}> Sign up with phone instead</Text>
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
  heroLogo: {
    width: 76, height: 76, borderRadius: 38, marginTop: 16, marginBottom: 20,
    borderWidth: 2, borderColor: 'rgba(167,139,250,0.4)',
  },
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
    borderRadius: 18, overflow: 'hidden', marginBottom: 16,
    shadowColor: '#7C3AED', shadowOpacity: 0.35, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 6,
  },
  button: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  buttonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 17, letterSpacing: 0.4 },
  termsText: { fontSize: 12, color: '#A090C0', textAlign: 'center', lineHeight: 18, marginBottom: 20, paddingHorizontal: 8 },
  termsLink: { color: '#7C3AED', fontWeight: '600' },
  loginRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  loginText: { color: '#8B7BAE', fontSize: 14 },
  loginLink: { color: '#7C3AED', fontWeight: '700', fontSize: 14 },
  altAuthRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  altAuthText: { color: '#8B7BAE', fontSize: 13 },
});