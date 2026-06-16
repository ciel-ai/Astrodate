import { useAuthAlert } from '@/lib/auth-alert-context';
import { saveUserProfile } from '@/lib/user-profile';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase, SUPABASE_URL } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { makeRedirectUri } from 'expo-auth-session';
import * as AppleAuthentication from 'expo-apple-authentication';
import React, { memo, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type GenderOption = 'female' | 'male' | 'nonBinary';

type GenderDetailOption = {
  value: string;
  label: string;
  description: string;
};

type StepConfig =
  | {
    id: 'fullName' | 'location';
    title: string;
    subtitle: string;
    placeholder: string;
    keyboardType?: 'default';
    helper?: string;
  }
  | {
    id: 'email';
    title: string;
    subtitle: string;
    placeholder: string;
    keyboardType?: 'email-address';
    helper?: string;
  }
  | {
    id: 'gender';
    title: string;
    subtitle: string;
    helper?: string;
  };

const GENDER_OPTIONS: { id: GenderOption; label: string }[] = [
  { id: 'male', label: 'Man' },
  { id: 'female', label: 'Woman' },
  { id: 'nonBinary', label: 'Beyond Binary' },
];

const GENDER_DETAILS: Record<GenderOption, GenderDetailOption[]> = {
  male: [
    { value: 'cis-man', label: 'Cis Man', description: 'A man whose gender aligns with the sex they were assigned at birth.' },
    { value: 'intersex-man', label: 'Intersex Man', description: "A man born with one or more variations in sex characteristics that don't fit binary ideas of male or female bodies." },
    { value: 'trans-man', label: 'Trans Man', description: 'A man whose gender is different from his sex assigned at birth.' },
    { value: 'transmasculine', label: 'Transmasculine', description: 'Assigned female at birth but presents as masculine; may see themselves as a man or transgender man.' },
    { value: 'not-listed-man', label: 'Not listed', description: "Tell us what's missing." },
  ],
  female: [
    { value: 'cis-woman', label: 'Cis Woman', description: 'A woman whose gender aligns with the sex they were assigned at birth.' },
    { value: 'intersex-woman', label: 'Intersex Woman', description: "A woman born with one or more variations in sex characteristics that don't fit binary ideas of male or female bodies." },
    { value: 'trans-woman', label: 'Trans Woman', description: 'A woman whose gender is different from her sex assigned at birth.' },
    { value: 'transfeminine', label: 'Transfeminine', description: 'Assigned male at birth but presents as feminine; may see themselves as a woman or transgender woman.' },
    { value: 'not-listed-woman', label: 'Not listed', description: "Tell us what's missing." },
  ],
  nonBinary: [
    { value: 'agender', label: 'Agender', description: 'A person who does not have a gender.' },
    { value: 'bigender', label: 'Bigender', description: 'A person whose gender has two or more forms.' },
    { value: 'genderfluid', label: 'Genderfluid', description: 'A person whose gender is not simply fixed.' },
    { value: 'gender-questioning', label: 'Gender Questioning', description: 'Questioning their current gender and/or exploring other genders.' },
    { value: 'genderqueer', label: 'Genderqueer', description: 'Does not identify or express their gender within the gender binary.' },
    { value: 'intersex', label: 'Intersex', description: 'Refers to people born with variations in sex characteristics.' },
    { value: 'nonbinary', label: 'Nonbinary', description: 'A gender beyond the exclusive categories of man and woman.' },
    { value: 'pangender', label: 'Pangender', description: 'Experiences multiple genders either simultaneously or over time.' },
    { value: 'trans-person', label: 'Trans Person', description: 'Transgender and their gender is different from the sex assigned at birth.' },
    { value: 'transfeminine', label: 'Transfeminine', description: 'Assigned male at birth, presents as feminine.' },
    { value: 'transmasculine', label: 'Transmasculine', description: 'Assigned female at birth, presents as masculine.' },
    { value: 'two-spirit', label: 'Two-Spirit', description: 'An umbrella term used across some Native communities for spiritual roles.' },
    { value: 'not-listed-nb', label: 'Not listed', description: "Tell us what's missing." },
  ],
};

const COLORS = {
  background: '#FFFFFF',
  textPrimary: '#1B1528',
  textSecondary: '#6B7280',
  accent: '#4B0082',
  accentLight: '#6A0DAD',
  accentSoft: '#F3ECFF',
  border: '#E5E7EB',
  success: '#10B981',
};

export default function BasicDetailsScreen() {
  const navigation: any = useNavigation();
  const params = useLocalSearchParams<{ phone: string }>();
  const [stepIndex, setStepIndex] = useState(0);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [location, setLocation] = useState('');
  const [gender, setGender] = useState<GenderOption | null>(null);
  const [genderDetail, setGenderDetail] = useState<string | null>(null);
  const [expandedGender, setExpandedGender] = useState<GenderOption | null>(null);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [thanksVisible, setThanksVisible] = useState(false);
  const [showManualEmail, setShowManualEmail] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLinkingGoogle, setIsLinkingGoogle] = useState(false);
  const isMountedRef = React.useRef(true);
  const { showAlert } = useAuthAlert();

  const phoneNumber = params.phone || '';

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const steps: StepConfig[] = useMemo(
    () => [
      {
        id: 'fullName',
        title: "What's your name?",
        subtitle: "This will be displayed on your profile.",
        placeholder: 'Your name',
      },
      {
        id: 'email',
        title: "What's your email?",
        subtitle: "We'll use this to keep your account secure and send important updates.",
        placeholder: 'your.email@example.com',
        keyboardType: 'email-address',
      },
      {
        id: 'gender',
        title: 'How do you identify?',
        subtitle: 'Select what describes you to help us show your profile to the right people.',
      },
      {
        id: 'location',
        title: 'Where are you based?',
        subtitle: 'Sharing your city helps us surface better local matches.',
        placeholder: 'City, Country',
        helper: 'This will be displayed on your profile.',
      },
    ],
    [],
  );

  const totalSteps = steps.length;
  const currentStep = steps[stepIndex];

  const getValueForStep = (step: StepConfig) => {
    switch (step.id) {
      case 'fullName':
        return fullName;
      case 'email':
        return email;
      case 'location':
        return location;
      case 'gender':
        return gender;
      default:
        return '';
    }
  };

  const isCurrentStepValid = () => {
    switch (currentStep.id) {
      case 'fullName':
        return fullName.trim().length > 1;
      case 'email': {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email.trim());
      }
      case 'location':
        return location.trim().length > 2;
      case 'gender':
        return Boolean(gender);
      default:
        return false;
    }
  };

  const handleContinue = async () => {
    if (!isCurrentStepValid()) {
      const nextErrors: Record<string, string> = {};
      switch (currentStep.id) {
        case 'fullName':
          nextErrors.fullName = 'Enter at least 5 characters.';
          break;
        case 'email':
          if (!email) {
             nextErrors.email = 'Please verify your email with Google to continue.';
          }
          break;
        case 'location':
          nextErrors.location = 'Let us know your city.';
          break;
        case 'gender':
          nextErrors.gender = 'Select the option that fits you best.';
          break;
      }
      setErrors(nextErrors);
      return;
    }

    setErrors({});

    if (stepIndex < totalSteps - 1) {
      if (currentStep.id === 'email') {
        // Just proceed to the next step, email is already validated and linked
        setStepIndex((prev) => prev + 1);
        return;
      }
      
      setStepIndex((prev) => prev + 1);
      return;
    }

    setIsSaving(true);
    try {
      // Save to AsyncStorage for backward compatibility
      await AsyncStorage.setItem(
        'userBasicDetails',
        JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          location: location.trim(),
          gender,
          genderDetail,
          genderFeedback: feedbackText.trim(),
        }),
      );

      // Save to database
      console.log('📝 Saving user profile to database...');
      const result = await saveUserProfile({
        phone_number: phoneNumber,
        full_name: fullName.trim(),
        email: email.trim(),
        gender: gender || undefined,
        gender_detail: genderDetail || undefined,
        location: location.trim(),
      });

      if (!result.success) {
        // Use console.warn instead of console.error to prevent Expo's duplicate error toast in dev mode
        console.warn('⚠️ Failed to save profile:', result.error);
        
        if (result.error?.includes('Phone number is required')) {
          showAlert(
            'Error',
            result.error,
            [
              {
                text: 'OK',
                onPress: () => {
                  if (isMountedRef.current) setIsSaving(false);
                  // Redirect to phone login screen to complete verification
                  router.replace('/onboarding/login');
                }
              }
            ]
          );
        } else {
          showAlert('Error', result.error || 'Failed to save profile. Please try again.');
          if (isMountedRef.current) setIsSaving(false);
        }
        return;
      }

      console.log('✅ Profile saved successfully');
      router.push('/onboarding/birth-details');
    } catch (error) {
      console.warn('Failed to persist basic details', error);
      showAlert('Error', 'Failed to save your details. Please try again.');
      if (isMountedRef.current) setIsSaving(false);
    } finally {
      if (isMountedRef.current) setIsSaving(false);
    }
  };

  const handleBack = async () => {
    if (stepIndex === 0) {
      if (router.canGoBack()) {
        router.back();
      } else {
        await supabase.auth.signOut();
        router.replace('/onboarding/welcome');
      }
      return;
    }
    setStepIndex((prev) => Math.max(prev - 1, 0));
  };

  const [locationLoading, setLocationLoading] = useState(false);

  const handleGetLocation = async () => {
    try {
      setLocationLoading(true);
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Permission denied', 'Location permission required to auto-fill.');
        if (isMountedRef.current) setLocationLoading(false);
        return;
      }
      let loc = await Location.getCurrentPositionAsync({});
      let geocode = await Location.reverseGeocodeAsync(loc.coords);
      if (geocode && geocode.length > 0) {
        const { city, region, country } = geocode[0];
        const cityLine = [city, region, country].filter(Boolean).join(', ');
        setLocation(cityLine);
      } else {
        showAlert('Location Error', 'Could not determine your city.');
      }
    } catch (e) {
      showAlert('Error', 'Failed to get location. Please try again.');
    } finally {
      if (isMountedRef.current) setLocationLoading(false);
    }
  };


  const handleSocialVerify = async (provider: 'google' | 'apple') => {
    try {
      setIsLinkingGoogle(true);

      // ── iOS Apple: use the native SDK (no web OAuth needed) ──────────────────
      if (provider === 'apple' && Platform.OS === 'ios') {
        const credential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
        });

        // Link this Apple identity to the current phone user so that
        // "Continue with Apple" on the login screen works for returning users.
        if (credential.identityToken) {
          try {
            const { data: { session: currentSession } } = await supabase.auth.getSession();
            if (currentSession?.access_token) {
              const res = await fetch(`${SUPABASE_URL}/functions/v1/link-apple-identity`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${currentSession.access_token}`,
                },
                body: JSON.stringify({ apple_identity_token: credential.identityToken }),
              });
              if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                console.warn('Apple identity link failed (non-blocking):', json.error);
              }
            }
          } catch (linkErr) {
            console.warn('Apple identity linking error (non-blocking):', linkErr);
          }
        }

        let foundEmail = credential.email;
        if (!foundEmail) {
          const { data: sessionData } = await supabase.auth.getSession();
          foundEmail = sessionData?.session?.user?.email;
        }

        if (foundEmail) {
          setEmail(foundEmail);
          setErrors((prev) => ({ ...prev, email: '' }));
          setStepIndex((prev) => prev + 1);
        } else {
          setShowManualEmail(true);
        }
        return;
      }

      // ── Google OAuth (and Apple web OAuth if ever enabled for Android) ────────
      const redirectUrl = Linking.createURL('auth/callback');
      console.log(`🔗 [auth] Starting ${provider} link with redirect:`, redirectUrl);

      const { data, error } = await supabase.auth.linkIdentity({
        provider,
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;
      if (!data?.url) return;

      // Processes the OAuth callback URL and extracts the linked email
      const processAuthUrl = async (url: string) => {
        console.log(`[auth] Processing auth URL for ${provider}`);

        if (url.includes('error=')) {
          let errorDesc: string | null = null;
          const part = url.includes('#') ? url.split('#')[1] : url.split('?')[1] || '';
          for (const pair of part.split('&')) {
            const [k, v] = pair.split('=');
            if ((k === 'error_description' || k === 'error') && v) { errorDesc = decodeURIComponent(v); break; }
          }
          if (errorDesc) throw new Error(errorDesc);
        }

        // Supabase already linked the identity server-side before redirecting back.
        // Fetch the updated user to confirm and get the email.
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;

        let linkedEmail = userData?.user?.email;
        if (userData?.user?.identities) {
          const pi = userData.user.identities.find((id: any) => id.provider === provider);
          if (pi?.identity_data?.email) linkedEmail = pi.identity_data.email;
        }

        if (linkedEmail && isMountedRef.current) {
          console.log(`[auth] Got email:`, linkedEmail);
          setEmail(linkedEmail);
          setErrors((prev) => ({ ...prev, email: '' }));
          setStepIndex((prev) => prev + 1);
        } else {
          throw new Error(`Could not find email in your ${provider} account.`);
        }
      };

      if (Platform.OS === 'android') {
        // On Android, open the full browser (not Custom Tab) so the OS can detect
        // and route the astrodate://auth/callback deep link back to the app.
        const linkingPromise = new Promise<string>((resolve, reject) => {
          const timeout = setTimeout(() => {
            sub.remove();
            reject(new Error('Sign-in timed out. Please try again.'));
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

        await Linking.openURL(data.url);
        const authUrl = await linkingPromise;
        await processAuthUrl(authUrl);
      } else {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
        console.log(`[auth] Browser result: ${result.type}`);
        if (result.type === 'success' && result.url) {
          await processAuthUrl(result.url);
        }
      }
    } catch (err: any) {
      if (err?.code === 'ERR_REQUEST_CANCELED') return;
      console.warn(`⚠️ ${provider} verify error:`, err);
      showAlert('Verification Failed', err.message || `Could not connect ${provider}. Please try again.`);
    } finally {
      if (isMountedRef.current) setIsLinkingGoogle(false);
    }
  };

  const renderStepInput = () => {
    if (currentStep.id === 'gender') {
      return (
        <View style={styles.genderOptions}>
          {GENDER_OPTIONS.map((option) => {
            const isSelected = gender === option.id;
            const isExpanded = expandedGender === option.id;
            return (
              <GenderOptionItem
                key={option.id}
                label={option.label}
                isSelected={isSelected}
                isExpanded={Boolean(isExpanded)}
                details={GENDER_DETAILS[option.id]}
                selectedDetail={genderDetail}
                onSelect={() => {
                  setGender(option.id);
                  setErrors((prev) => ({ ...prev, gender: '' }));
                  setGenderDetail(null);
                  setExpandedGender(option.id);
                }}
                onToggle={() =>
                  setExpandedGender((prev) => (prev === option.id ? null : option.id))
                }
                onSelectDetail={(detailValue) => {
                  setGenderDetail(detailValue);
                  if (detailValue.startsWith('not-listed')) {
                    setThanksVisible(false);
                    setFeedbackVisible(true);
                  }
                }}
              />
            );
          })}
          {errors.gender ? <Text style={styles.errorText}>{errors.gender}</Text> : null}
        </View>
      );
    }

    if (currentStep.id === 'location') {
      return (
        <View style={styles.inputWrapper}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TextInput
              style={[
                styles.textInput,
                { flex: 1 },
                errors[currentStep.id] && styles.textInputError,
              ]}
              placeholder={currentStep.placeholder}
              placeholderTextColor="rgba(107, 114, 128, 0.7)"
              keyboardType={currentStep.keyboardType ?? 'default'}
              autoCapitalize="words"
              value={location}
              onChangeText={(text) => {
                setLocation(text);
                setErrors((prev) => ({ ...prev, location: '' }));
              }}
            />
            <TouchableOpacity
              onPress={handleGetLocation}
              disabled={locationLoading}
              style={{ marginLeft: 8 }}
            >
              <MaterialIcons name="location-on" size={24} color="#4B0082" />
            </TouchableOpacity>
          </View>
          {errors[currentStep.id] ? <Text style={styles.errorText}>{errors[currentStep.id]}</Text> : null}
          {'helper' in currentStep && currentStep.helper ? (
            <Text style={styles.helperText}>{currentStep.helper}</Text>
          ) : null}
        </View>
      );
    }

    const shouldCapitalizeWords = currentStep.id === 'fullName';

    if (currentStep.id === 'email') {
      return (
        <View style={styles.inputWrapper}>
          {showManualEmail ? (
            <>
              <Text style={styles.helperText}>Please enter your email manually.</Text>
              <TextInput
                style={[styles.textInput, errors.email && styles.textInputError, { marginTop: 12 }]}
                placeholder="you@example.com"
                placeholderTextColor="rgba(107, 114, 128, 0.7)"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setErrors((prev) => ({ ...prev, email: '' }));
                }}
              />
            </>
          ) : email ? (
            <View style={{ alignItems: 'center', paddingVertical: 20 }}>
              <MaterialIcons name="check-circle" size={48} color={COLORS.success} />
              <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginTop: 12 }}>Email Verified</Text>
              <Text style={{ fontSize: 16, color: COLORS.textSecondary, marginTop: 4 }}>{email}</Text>
            </View>
          ) : (
            <>
              <Text style={styles.helperText}>Connect your account to securely verify your email address. We'll only use it for important updates.</Text>
              <View style={styles.authButtonsContainer}>
                {/* Apple Sign In — iOS only (web OAuth for Android requires a separate
                    Apple Service ID and is not supported in this build) */}
                {Platform.OS === 'ios' && (
                  <View style={{ width: '100%', pointerEvents: isLinkingGoogle ? 'none' : 'auto', opacity: isLinkingGoogle ? 0.5 : 1 }}>
                    <AppleAuthentication.AppleAuthenticationButton
                      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                      cornerRadius={25}
                      style={{ width: '100%', height: 50 }}
                      onPress={() => handleSocialVerify('apple')}
                    />
                    {isLinkingGoogle && (
                      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 25, justifyContent: 'center', alignItems: 'center' }]}>
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      </View>
                    )}
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.socialButton, styles.googleButton, isLinkingGoogle && styles.buttonDisabled]}
                  onPress={() => handleSocialVerify('google')}
                  disabled={isLinkingGoogle}
                >
                  {isLinkingGoogle ? (
                    <ActivityIndicator color="#000000" size="small" />
                  ) : (
                    <>
                      <Ionicons name="logo-google" size={20} color="#000000" style={styles.socialIcon} />
                      <Text style={styles.googleButtonText}>Verify with Google</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                onPress={() => setShowManualEmail(true)}
                style={{ marginTop: 16, alignItems: 'center' }}
              >
                <Text style={{ color: COLORS.accent, fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' }}>
                  Verify with email address instead
                </Text>
              </TouchableOpacity>
            </>
          )}
          {errors[currentStep.id] ? <Text style={[styles.errorText, { marginTop: 12, textAlign: 'center' }]}>{errors[currentStep.id]}</Text> : null}
        </View>
      );
    }

    return (
      <View style={styles.inputWrapper}>
        <TextInput
          style={[
            styles.textInput,
            errors[currentStep.id] && styles.textInputError,
          ]}
          placeholder={currentStep.placeholder}
          placeholderTextColor="rgba(107, 114, 128, 0.7)"
          keyboardType={currentStep.keyboardType ?? 'default'}
          autoCapitalize={shouldCapitalizeWords ? 'words' : 'none'}
          value={String(getValueForStep(currentStep))}
          onChangeText={(text) => {
            if (currentStep.id === 'fullName') {
              setFullName(text);
              setErrors((prev) => ({ ...prev, fullName: '' }));
            }
          }}
        />
        {errors[currentStep.id] ? <Text style={styles.errorText}>{errors[currentStep.id]}</Text> : null}
        {'helper' in currentStep && currentStep.helper ? (
          <Text style={styles.helperText}>{currentStep.helper}</Text>
        ) : null}
      </View>
    );
  };

  const progress = ((stepIndex + 1) / totalSteps) * 100;

  const handleFeedbackSubmit = () => {
    if (!feedbackText.trim()) return;
    setFeedbackVisible(false);
    setThanksVisible(true);
    setFeedbackText('');
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}>
          <View style={styles.flex}>
            <View style={styles.header}>
              <TouchableOpacity onPress={handleBack} style={styles.backIcon} hitSlop={10}>
                <MaterialIcons name="arrow-back" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress}%` }]} />
              </View>
              <Text style={styles.stepCount}>
                {stepIndex + 1}/{totalSteps}
              </Text>
            </View>

            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}>
              <View style={styles.content}>
                <Text style={styles.questionTitle}>{currentStep.title}</Text>
                <Text style={styles.questionSubtitle}>{currentStep.subtitle}</Text>
                {renderStepInput()}
              </View>
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity
                style={[
                  styles.fab,
                  (!isCurrentStepValid() || isSaving) && styles.fabDisabled,
                ]}
                activeOpacity={0.9}
                onPress={handleContinue}
                disabled={!isCurrentStepValid() || isSaving}>
                {isSaving ? (
                  <Text style={styles.fabText}>...</Text>
                ) : (
                  <MaterialIcons name="check" size={22} color={COLORS.background} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <Modal
        visible={feedbackVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFeedbackVisible(false)}>
        <View style={styles.feedbackOverlay}>
          <View style={styles.feedbackSheet}>
            <TouchableOpacity
              style={styles.feedbackClose}
              onPress={() => setFeedbackVisible(false)}>
              <MaterialIcons name="close" size={22} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.feedbackTitle}>Your feedback helps us</Text>
            <Text style={styles.feedbackSubtitle}>
              We try to be inclusive of all genders. Let us know if we missed yours so we can improve.
            </Text>
            <TextInput
              style={styles.feedbackInput}
              placeholder="Enter your feedback"
              placeholderTextColor="rgba(107,114,128,0.6)"
              multiline
              value={feedbackText}
              onChangeText={setFeedbackText}
            />
            <TouchableOpacity
              style={[
                styles.feedbackButton,
                !feedbackText.trim() && styles.feedbackButtonDisabled,
              ]}
              disabled={!feedbackText.trim()}
              onPress={handleFeedbackSubmit}>
              <Text style={styles.feedbackButtonText}>Submit</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={thanksVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setThanksVisible(false)}>
        <View style={styles.feedbackOverlay}>
          <View style={styles.feedbackSheet}>
            <TouchableOpacity
              style={styles.feedbackClose}
              onPress={() => setThanksVisible(false)}>
              <MaterialIcons name="close" size={22} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.feedbackTitle}>Thanks for sharing with us</Text>
            <Text style={styles.feedbackSubtitle}>
              We appreciate your response. Your suggestion helps us keep AstroDate inclusive for everyone.
            </Text>
            <TouchableOpacity
              style={styles.feedbackButton}
              onPress={() => setThanksVisible(false)}>
              <Text style={styles.feedbackButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 12,
  },
  backIcon: {
    width: 36,
    height: 36,
    justifyContent: 'center',
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.accent,
  },
  stepCount: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 120,
  },
  questionTitle: {
    fontSize: 30,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  questionSubtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 22,
    marginBottom: 32,
  },
  inputWrapper: {
    gap: 10,
  },
  textInput: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.textPrimary,
    fontSize: 20,
    paddingVertical: 12,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  textInputError: {
    borderBottomColor: '#DC2626',
  },
  helperText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  genderOptions: {
    gap: 12,
  },
  genderGroup: {
    gap: 8,
  },
  genderChip: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: COLORS.background,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  genderChipSelected: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accentSoft,
  },
  genderChipText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  genderChipTextSelected: {
    color: COLORS.accent,
  },
  genderCheck: {
    marginLeft: 12,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
  },
  authButtonsContainer: {
    gap: 12,
    marginTop: 16,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 12,
  },
  appleButton: {
    backgroundColor: '#000000',
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  socialIcon: {
    marginRight: 4,
  },
  appleButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  googleButtonText: {
    color: '#000000',
    fontSize: 17,
    fontWeight: '600',
  },
  detailContainer: {
    marginTop: 16,
  },
  detailToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  detailToggleText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  detailList: {
    gap: 12,
  },
  detailCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 16,
    backgroundColor: COLORS.background,
  },
  detailCardSelected: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accentSoft,
  },
  detailLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  detailDescription: {
    marginTop: 6,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  detailCheck: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  footer: {
    padding: 24,
    alignItems: 'flex-end',
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  fabDisabled: {
    opacity: 0.4,
  },
  fabText: {
    color: COLORS.background,
    fontSize: 16,
    fontWeight: '700',
  },
  feedbackOverlay: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'flex-end',
  },
  feedbackSheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 16,
  },
  feedbackClose: {
    alignSelf: 'flex-end',
  },
  feedbackTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  feedbackSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textSecondary,
  },
  feedbackInput: {
    minHeight: 80,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 12,
    fontSize: 15,
    color: COLORS.textPrimary,
    textAlignVertical: 'top',
  },
  feedbackButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 30,
    paddingVertical: 12,
    alignItems: 'center',
  },
  feedbackButtonDisabled: {
    opacity: 0.4,
  },
  feedbackButtonText: {
    color: COLORS.background,
    fontWeight: '700',
    fontSize: 16,
  },
});

type GenderOptionItemProps = {
  key?: React.Key;
  label: string;
  isSelected: boolean;
  isExpanded: boolean;
  details: GenderDetailOption[];
  selectedDetail: string | null;
  onSelect: () => void;
  onToggle: () => void;
  onSelectDetail: (detailValue: string) => void;
};

const GenderOptionItem = memo<GenderOptionItemProps>(({
  label,
  isSelected,
  isExpanded,
  details,
  selectedDetail,
  onSelect,
  onToggle,
  onSelectDetail,
}) => {
  return (
    <View style={styles.genderGroup}>
      <TouchableOpacity
        style={[styles.genderChip, isSelected && styles.genderChipSelected]}
        activeOpacity={0.85}
        onPress={onSelect}>
        <Text style={[styles.genderChipText, isSelected && styles.genderChipTextSelected]}>
          {label}
        </Text>
        {isSelected && (
          <MaterialIcons
            name="check"
            size={20}
            color={COLORS.accent}
            style={styles.genderCheck}
          />
        )}
      </TouchableOpacity>

      {isSelected && (
        <View style={styles.detailContainer}>
          <TouchableOpacity style={styles.detailToggle} activeOpacity={0.8} onPress={onToggle}>
            <Text style={styles.detailToggleText}>Add more about your gender (optional)</Text>
            <MaterialIcons
              name={isExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
              size={24}
              color={COLORS.textPrimary}
            />
          </TouchableOpacity>

          {isExpanded && (
            <View style={styles.detailList}>
              {details.map((detail) => {
                const selected = selectedDetail === detail.value;
                return (
                  <TouchableOpacity
                    key={detail.value}
                    style={[styles.detailCard, selected && styles.detailCardSelected]}
                    activeOpacity={0.85}
                    onPress={() => onSelectDetail(detail.value)}>
                    <Text style={styles.detailLabel}>{detail.label}</Text>
                    <Text style={styles.detailDescription}>{detail.description}</Text>
                    {selected && (
                      <MaterialIcons
                        name="check"
                        size={20}
                        color={COLORS.accent}
                        style={styles.detailCheck}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      )}
    </View>
  );
});