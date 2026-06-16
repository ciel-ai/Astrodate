import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as AppleAuthentication from 'expo-apple-authentication';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

export default function SplashScreen() {
  const router = useRouter();
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showCombinedModal, setShowCombinedModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy'>('terms');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const handleCheckboxPress = () => {
    // Just toggle the checkbox state
    setAgreedToTerms(!agreedToTerms);
  };

  const handleAgree = () => {
    setShowCombinedModal(false);
    setAgreedToTerms(true);
  };

  const handleModalClose = () => {
    setShowCombinedModal(false);
  };

  const handleGetStarted = () => {
    if (agreedToTerms) {
      router.replace('/onboarding/welcome');
    }
  };

  const checkUserAndNavigate = async (userId?: string, email?: string) => {
    if (!userId) {
      router.replace('/onboarding/welcome');
      return;
    }

    let { data: profile } = await supabase
      .from('user_profiles')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!profile && email) {
      const { data: profileByEmail } = await supabase
        .from('user_profiles')
        .select('user_id')
        .eq('email', email)
        .maybeSingle();
      profile = profileByEmail;
    }

    if (profile) {
      router.replace('/(tabs)');
    } else {
      await supabase.auth.signOut();
      alert('This email is not registered. Please sign up using your phone number first.');
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'apple') => {
    if (isLoggingIn) return;
    if (!agreedToTerms) return;
    
    try {
      setIsLoggingIn(true);
      
      if (provider === 'apple' && Platform.OS === 'ios') {
        const credential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
        });
        
        if (credential.identityToken) {
          const { data: sessionData, error } = await supabase.auth.signInWithIdToken({
            provider: 'apple',
            token: credential.identityToken,
          });
          
          if (error) throw error;
          await checkUserAndNavigate(
            sessionData.session?.user?.id,
            sessionData.session?.user?.email
          );
          return;
        } else {
          throw new Error('No identity token returned from Apple.');
        }
      }

      const redirectUrl = makeRedirectUri();
      console.log('🔗 [auth] Starting OAuth with redirect:', redirectUrl);
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) throw error;

      if (data?.url) {
        // Helper to process the OAuth callback URL
        const processAuthUrl = async (url: string) => {
          const parsed = Linking.parse(url);
          let code = parsed.queryParams?.code;
          
          if (!code && url.includes('?')) {
             const query = url.split('?')[1]?.split('#')[0] || '';
             const pairs = query.split('&');
             for (const pair of pairs) {
               const [k, v] = pair.split('=');
               if (k === 'code' && v) { code = decodeURIComponent(v); break; }
             }
          }

          if (code) {
             const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(code as string);
             if (sessionError) throw sessionError;
             await checkUserAndNavigate(sessionData.session?.user?.id);
          } else if (url.includes('#access_token')) {
             const hash = url.split('#')[1] || '';
             const pairs = hash.split('&');
             let access_token: string | null = null;
             let refresh_token: string | null = null;
             for (const pair of pairs) {
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
          } else {
            // Unhandled URL format, fallback to onboarding
            router.replace('/onboarding/welcome');
          }
        };

        if (Platform.OS === 'android') {
          // Android: Chrome Custom Tab can't redirect to custom schemes (exp://, astrodate://)
          // and shows a permanent white screen. Use the default browser instead.
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
          await processAuthUrl(authUrl);
        } else {
          // iOS: openAuthSessionAsync works correctly with SFSafariViewController
          const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
          console.log(`[auth] Browser result: ${result.type}`);
          if (result.type === 'success' && result.url) {
            await processAuthUrl(result.url);
          }
        }
      }
    } catch (err) {
      console.error('Social login error:', err);
      alert('Login failed. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Scroll to top when tab changes
  useEffect(() => {
    if (showCombinedModal && scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y: 0, animated: true });
    }
  }, [activeTab, showCombinedModal]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topContent}>
        <View style={styles.logoWrapper}>
          <Image 
            source={require('@/assets/images/logo.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.appName}>Astro Date</Text>
        <Text style={styles.tagline}>Find your cosmic match ✨</Text>
      </View>
      
      <View style={styles.bottomContent}>
        <View style={styles.termsContainer}>
          <View style={styles.checkboxContainer}>
          <TouchableOpacity 
            onPress={handleCheckboxPress}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}>
              {agreedToTerms && <Text style={styles.checkmark}>✓</Text>}
            </View>
            </TouchableOpacity>
            <Text style={styles.termsText}>
              I agree to the{' '}
              <Text 
                style={styles.linkText}
                onPress={() => {
                  setActiveTab('terms');
                  setShowCombinedModal(true);
                }}
              >
                Terms & Conditions
              </Text>
              {' '}and{' '}
              <Text 
                style={styles.linkText}
                onPress={() => {
                  setActiveTab('privacy');
                  setShowCombinedModal(true);
                }}
              >
                Privacy Policy
              </Text>
            </Text>
          </View>
        </View>

        <View style={styles.authButtonsContainer}>
          {Platform.OS === 'ios' ? (
            <View style={{ width: '100%', pointerEvents: (isLoggingIn || !agreedToTerms) ? 'none' : 'auto', opacity: (!agreedToTerms || isLoggingIn) ? 0.5 : 1 }}>
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={25}
                style={{ width: '100%', height: 50 }}
                onPress={() => handleSocialLogin('apple')}
              />
              {isLoggingIn && (
                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 25, justifyContent: 'center', alignItems: 'center' }]}>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                </View>
              )}
            </View>
          ) : (
            <TouchableOpacity 
              style={[styles.socialButton, styles.appleButton, (!agreedToTerms || isLoggingIn) && styles.buttonDisabled]} 
              onPress={() => handleSocialLogin('apple')}
              activeOpacity={agreedToTerms ? 0.8 : 1}
              disabled={!agreedToTerms || isLoggingIn}
            >
              {isLoggingIn ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="logo-apple" size={20} color="#FFFFFF" style={styles.socialIcon} />
                  <Text style={styles.appleButtonText}>
                    Continue with Apple
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            style={[styles.socialButton, styles.googleButton, (!agreedToTerms || isLoggingIn) && styles.buttonDisabled]} 
            onPress={() => handleSocialLogin('google')}
            activeOpacity={agreedToTerms ? 0.8 : 1}
            disabled={!agreedToTerms || isLoggingIn}
          >
            {isLoggingIn ? (
              <ActivityIndicator color="#000000" size="small" />
            ) : (
              <>
                <Ionicons name="logo-google" size={20} color="#000000" style={styles.socialIcon} />
                <Text style={styles.googleButtonText}>
                  Continue with Google
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Combined Terms & Privacy Modal */}
      <Modal
        visible={showCombinedModal}
        animationType="slide"
        onRequestClose={handleModalClose}
      >
        <SafeAreaView style={styles.modalOverlay} edges={['top', 'bottom']}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {activeTab === 'terms' ? 'Terms & Conditions' : 'Privacy Policy'}
              </Text>
              <TouchableOpacity onPress={handleModalClose}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Tab Switcher */}
            <View style={styles.tabContainer}>
              <TouchableOpacity 
                style={[styles.tab, activeTab === 'terms' && styles.activeTab]}
                onPress={() => {
                  setActiveTab('terms');
                }}
              >
                <Text style={[styles.tabText, activeTab === 'terms' && styles.activeTabText]}>
                  Terms & Conditions
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.tab, activeTab === 'privacy' && styles.activeTab]}
                onPress={() => {
                  setActiveTab('privacy');
                }}
              >
                <Text style={[styles.tabText, activeTab === 'privacy' && styles.activeTabText]}>
                  Privacy Policy
                </Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView 
              ref={scrollViewRef}
              style={styles.modalBody} 
              showsVerticalScrollIndicator={true}
            >
              {activeTab === 'terms' ? (
                <Text style={styles.modalText}>
                  <Text style={styles.sectionTitle}>Welcome to Astro Date</Text>
                  {'\n\n'}
                  By using our app, you agree to the following terms and conditions:
                  {'\n\n'}
                  <Text style={styles.sectionTitle}>1. Data Collection</Text>
                  {'\n'}
                  We collect the following information to provide you with accurate astrological insights and personalized matchmaking:
                  {'\n\n'}
                  • <Text style={styles.bold}>Date of Birth (DOB):</Text> Required for astrological chart calculations and compatibility matching.
                  {'\n\n'}
                  • <Text style={styles.bold}>Time of Birth (TOB):</Text> Essential for precise horoscope generation and birth chart analysis.
                  {'\n\n'}
                  • <Text style={styles.bold}>Place of Birth (POB):</Text> Used to determine accurate planetary positions and astrological houses.
                  {'\n\n'}
                  • <Text style={styles.bold}>Personal Information:</Text> Including name, gender, interests, photos, and other profile details to facilitate meaningful connections.
                  {'\n\n'}
                  <Text style={styles.sectionTitle}>2. Use of Information</Text>
                  {'\n'}
                  Your information will be used to:
                  {'\n'}
                  • Generate your astrological profile and birth chart
                  {'\n'}
                  • Match you with compatible partners based on astrological compatibility
                  {'\n'}
                  • Verify your identity and maintain platform security
                  {'\n'}
                  • Provide personalized insights and recommendations
                  {'\n\n'}
                  <Text style={styles.sectionTitle}>3. User Responsibility</Text>
                  {'\n'}
                  • You must provide accurate information
                  {'\n'}
                  • You must be at least 18 years of age
                  {'\n'}
                  • You agree to maintain respectful communication with other users
                  {'\n'}
                  • You will not misuse or abuse the platform
                  {'\n\n'}
                  <Text style={styles.sectionTitle}>4. Account Security</Text>
                  {'\n'}
                  You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.
                  {'\n\n'}
                  <Text style={styles.sectionTitle}>5. Termination</Text>
                  {'\n'}
                  We reserve the right to terminate or suspend your account if you violate these terms or engage in inappropriate behavior.
                  {'\n\n'}
                  By continuing, you acknowledge that you have read and agree to these terms.
                </Text>
              ) : (
                <Text style={styles.modalText}>
                  <Text style={styles.sectionTitle}>Your Privacy Matters</Text>
                  {'\n\n'}
                  Astro Date is committed to protecting your privacy and personal information. This policy explains how we collect, use, and safeguard your data.
                  {'\n\n'}
                  <Text style={styles.sectionTitle}>1. Information We Collect</Text>
                  {'\n\n'}
                  <Text style={styles.bold}>Birth Details:</Text>
                  {'\n'}
                  • Date of Birth (DOB)
                  {'\n'}
                  • Time of Birth (TOB)
                  {'\n'}
                  • Place of Birth (POB)
                  {'\n'}
                  These details are used exclusively for astrological calculations and compatibility analysis.
                  {'\n\n'}
                  <Text style={styles.bold}>Biometric & Verification Data:</Text>
                  {'\n'}
                  • We use third-party AI (Google Gemini) to process facial imagery from your photos for liveness detection and face verification
                  {'\n'}
                  • This biometric data is processed in real-time, never used for training models, and discarded immediately after verification
                  {'\n'}
                  • Phone verification is processed securely to authenticate your identity
                  {'\n'}
                  • We do not share your verification information with unauthorized third parties
                  {'\n\n'}
                  <Text style={styles.bold}>Profile Information:</Text>
                  {'\n'}
                  • Name, age, gender, photos
                  {'\n'}
                  • Interests, preferences, and bio
                  {'\n'}
                  • Communication history within the app
                  {'\n\n'}
                  <Text style={styles.sectionTitle}>2. How We Use Your Information</Text>
                  {'\n'}
                  • To create your astrological profile and generate birth charts
                  {'\n'}
                  • To match you with compatible partners using Vedic astrology principles
                  {'\n'}
                  • To verify user authenticity and prevent fake profiles
                  {'\n'}
                  • To improve our services and user experience
                  {'\n'}
                  • To send important notifications about matches and messages
                  {'\n\n'}
                  <Text style={styles.sectionTitle}>3. Data Security</Text>
                  {'\n'}
                  We implement industry-standard security measures:
                  {'\n'}
                  • End-to-end encryption for sensitive data
                  {'\n'}
                  • Secure cloud storage with regular backups
                  {'\n'}
                  • Regular security audits and updates
                  {'\n'}
                  • Limited employee access to personal information
                  {'\n\n'}
                  <Text style={styles.sectionTitle}>4. Data Sharing</Text>
                  {'\n'}
                  We DO NOT sell your personal information. We only share data:
                  {'\n'}
                  • With other users as part of your public profile
                  {'\n'}
                  • With service providers who help operate our platform (under strict confidentiality)
                  {'\n'}
                  • When required by law or legal process
                  {'\n\n'}
                  <Text style={styles.sectionTitle}>5. Your Rights</Text>
                  {'\n'}
                  You have the right to:
                  {'\n'}
                  • Access your personal data
                  {'\n'}
                  • Request data correction or deletion
                  {'\n'}
                  • Opt-out of promotional communications
                  {'\n'}
                  • Delete your account at any time
                  {'\n\n'}
                  <Text style={styles.sectionTitle}>6. Contact Us</Text>
                  {'\n'}
                  For privacy concerns or data requests, contact us at privacy@astrodate.com
                  {'\n\n'}
                  Last updated: November 2025
                </Text>
              )}
            </ScrollView>
            
            <TouchableOpacity 
              style={styles.modalButton}
              onPress={handleAgree}
            >
              <Text style={styles.modalButtonText}>I Agree to Both</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomContent: {
    width: '100%',
    paddingBottom: 50,
    alignItems: 'center',
  },
  logoWrapper: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: COLORS.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
  },
  logo: {
    width: 72,
    height: 72,
  },
  appName: {
    fontSize: 34,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: -0.4,
  },
  tagline: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 6,
    letterSpacing: 0.2,
  },
  termsContainer: {
    marginBottom: 20,
    paddingHorizontal: 30,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: COLORS.accent,
    borderRadius: 6,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  checkboxChecked: {
    backgroundColor: COLORS.accent,
  },
  checkmark: {
    color: COLORS.background,
    fontSize: 16,
    fontWeight: 'bold',
  },
  termsText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    flexShrink: 1,
  },
  linkText: {
    color: COLORS.accent,
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  authButtonsContainer: {
    width: '100%',
    paddingHorizontal: 30,
    gap: 12,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 40,
    elevation: 3,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  socialIcon: {
    marginRight: 10,
  },
  appleButton: {
    backgroundColor: '#000000',
    shadowColor: '#000000',
  },
  appleButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  googleButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalContent: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.accent,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  closeButton: {
    fontSize: 28,
    color: COLORS.accent,
    fontWeight: 'bold',
  },
  modalBody: {
    flex: 1,
    marginBottom: 20,
  },
  modalText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.accent,
  },
  bold: {
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  modalButton: {
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 'auto',
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  modalButtonText: {
    color: COLORS.background,
    fontSize: 16,
    fontWeight: '700',
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: COLORS.accent,
  },
  tabText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  activeTabText: {
    color: COLORS.accent,
    fontWeight: '600',
  },
});