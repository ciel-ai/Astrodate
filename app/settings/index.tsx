import { useAuthAlert } from '@/lib/auth-alert-context';
import { resendVerificationEmail } from '@/lib/email-auth';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { deactivateCurrentDevicePushToken, syncNotificationPreferences } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { useSubscriptionPayment } from '@/lib/useSubscriptionPayment';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AppleAuthentication from 'expo-apple-authentication';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRouter } from 'expo-router';
import { SUPABASE_URL } from '@/lib/supabase';
import { deleteSecureItem } from '@/lib/secure-storage';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import {
    ActivityIndicator,
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const { showAlert } = useAuthAlert();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { membership, refetch: refetchMembership } = useSubscriptionStatus();
  const { restorePurchases } = useSubscriptionPayment();
  const [cancellingSubscription, setCancellingSubscription] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // ─── Linked accounts state ──────────────────────────────────────────────────
  const [linkedProviders, setLinkedProviders] = useState<string[]>([]);
  const [linkingApple, setLinkingApple] = useState(false);

  // ─── Email account state ────────────────────────────────────────────────────
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);
  const [isEmailVerified, setIsEmailVerified] = useState<boolean | null>(null);
  const [emailAuthUser, setEmailAuthUser] = useState(false); // true if signed in with email+password
  // Update email flow
  const [showUpdateEmail, setShowUpdateEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [updateEmailLoading, setUpdateEmailLoading] = useState(false);
  // Resend verification
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isLoggingOutRef = useRef(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [matchNotifications, setMatchNotifications] = useState(true);
  const [messageNotifications, setMessageNotifications] = useState(true);
  const [showOnlineStatus, setShowOnlineStatus] = useState(true);
  const [showDistance, setShowDistance] = useState(true);
  const [showAge, setShowAge] = useState(true);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [expandedHelp, setExpandedHelp] = useState<string | null>(null);

  // Tracks whether the initial load from AsyncStorage has completed.
  // Prevents the save useEffect from overwriting stored values on first mount.
  const hasLoaded = useRef(false);

  const toggleHelp = (item: string) => {
    setExpandedHelp(expandedHelp === item ? null : item);
  };

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedSettingsStr = await AsyncStorage.getItem('@app_settings');
        if (storedSettingsStr) {
          const storedSettings = JSON.parse(storedSettingsStr);
          if (storedSettings.notificationsEnabled !== undefined) setNotificationsEnabled(storedSettings.notificationsEnabled);
          if (storedSettings.emailNotifications !== undefined) setEmailNotifications(storedSettings.emailNotifications);
          if (storedSettings.pushNotifications !== undefined) setPushNotifications(storedSettings.pushNotifications);
          if (storedSettings.matchNotifications !== undefined) setMatchNotifications(storedSettings.matchNotifications);
          if (storedSettings.messageNotifications !== undefined) setMessageNotifications(storedSettings.messageNotifications);
          if (storedSettings.showOnlineStatus !== undefined) setShowOnlineStatus(storedSettings.showOnlineStatus);
          if (storedSettings.showDistance !== undefined) setShowDistance(storedSettings.showDistance);
          if (storedSettings.showAge !== undefined) setShowAge(storedSettings.showAge);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      } finally {
        // Mark load complete so the save effect is now allowed to run
        hasLoaded.current = true;
      }
    };
    loadSettings();
  }, []);

  // Save settings when any state changes — but only after initial load is complete.
  // Without this guard the effect fires on mount (before loadSettings resolves)
  // and overwrites stored values with the default useState initializers.
  useEffect(() => {
    if (!hasLoaded.current) return;
    const saveSettings = async () => {
      try {
        const settingsToSave = {
          notificationsEnabled,
          emailNotifications,
          pushNotifications,
          matchNotifications,
          messageNotifications,
          showOnlineStatus,
          showDistance,
          showAge,
        };
        await AsyncStorage.setItem('@app_settings', JSON.stringify(settingsToSave));
        await syncNotificationPreferences({
          new_matches_enabled: notificationsEnabled && matchNotifications,
          new_messages_enabled: notificationsEnabled && messageNotifications,
          marketing_enabled: notificationsEnabled && pushNotifications,
        });
      } catch (error) {
        console.error('Error saving settings:', error);
      }
    };
    saveSettings();
  }, [
    notificationsEnabled,
    emailNotifications,
    pushNotifications,
    matchNotifications,
    messageNotifications,
    showOnlineStatus,
    showDistance,
    showAge,
  ]);

  // Load email account info on mount
  useEffect(() => {
    const loadEmailInfo = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setCurrentEmail(user.email ?? null);
        setIsEmailVerified(!!user.email_confirmed_at);
        const identities = user.identities ?? [];
        const hasEmailIdentity = identities.some((id: any) => id.provider === 'email');
        setEmailAuthUser(hasEmailIdentity);
        setLinkedProviders(identities.map((id: any) => id.provider as string));
      } catch (err) {
        console.warn('[settings] Could not load email info:', err);
      }
    };
    loadEmailInfo();
    return () => {
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    };
  }, []);

  const startCooldown = (seconds: number) => {
    setResendCooldown(seconds);
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    cooldownTimerRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) { clearInterval(cooldownTimerRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleResendVerification = async () => {
    if (resendLoading || resendCooldown > 0 || !currentEmail) return;
    setResendLoading(true);
    const result = await resendVerificationEmail(currentEmail, 'astrodate://auth/verify');
    setResendLoading(false);
    if (!result.success) {
      if (result.cooldownSeconds) startCooldown(result.cooldownSeconds);
      showAlert('Could Not Resend', result.error ?? 'Could not resend');
    } else {
      startCooldown(60);
      showAlert('Verification Email Sent ✅', `A new link has been sent to ${currentEmail}. Check your inbox and spam folder.`);
    }
  };

  const handleUpdateEmail = async () => {
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      showAlert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    if (trimmed === currentEmail) {
      showAlert('Same Email', 'The new email is the same as your current one.');
      return;
    }
    setUpdateEmailLoading(true);
    try {
      const { error } = await supabase.auth.updateUser(
        { email: trimmed },
        { emailRedirectTo: 'astrodate://auth/verify' }
      );
      if (error) {
        showAlert('Update Failed', error.message);
      } else {
        setShowUpdateEmail(false);
        setNewEmail('');
        showAlert(
          'Confirm Your New Email ✅',
          `We sent a confirmation link to ${trimmed}. Tap it to complete the change. Your current email stays active until confirmed.`
        );
      }
    } catch (err: any) {
      showAlert('Update Failed', err?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setUpdateEmailLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (Platform.OS === 'ios') {
      await Linking.openURL('itms-apps://apps.apple.com/account/subscriptions');
      return;
    }

    showAlert(
      'Cancel Subscription',
      'Your premium access will end immediately. This cannot be undone.',
      [
        { text: 'Keep Plan', style: 'cancel' },
        {
          text: 'Cancel Subscription',
          style: 'destructive',
          onPress: async () => {
            setCancellingSubscription(true);
            try {
              // Android only — Razorpay managed subscriptions
              const { error } = await supabase.rpc('cancel_my_subscription');
              if (error) throw error;
              await refetchMembership();
              showAlert('Subscription Cancelled', 'Your plan has been cancelled successfully.');
            } catch {
              showAlert('Error', 'Could not cancel subscription. Please contact support at support@astrodate.in.');
            } finally {
              setCancellingSubscription(false);
            }
          },
        },
      ]
    );
  };

  const handleLinkApple = async () => {
    if (linkingApple) return;
    setLinkingApple(true);
    try {
      // 1. Get the current user's session JWT
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not logged in');

      // 2. Native Apple auth — gets identity token without changing the current session
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) throw new Error('No identity token from Apple');

      // 3. Send token to Edge Function — it verifies with Apple and links the identity
      const res = await fetch(`${SUPABASE_URL}/functions/v1/link-apple-identity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ apple_identity_token: credential.identityToken }),
      });

      let json: any = {};
      try {
        json = await res.json();
      } catch {
        throw new Error(`HTTP ${res.status}: response was not JSON`);
      }

      if (!res.ok) {
        if (res.status === 409) {
          showAlert('Already Linked', json.error ?? 'This Apple ID is linked to a different account.');
        } else {
          throw new Error(`HTTP ${res.status}: ${json.error ?? 'Unknown error'}`);
        }
        return;
      }

      // 4. Refresh local identity list
      const { data: { user: updated } } = await supabase.auth.getUser();
      setLinkedProviders((updated?.identities ?? []).map((id: any) => id.provider as string));

      if (json.status === 'already_linked') {
        showAlert('Already Linked', 'Your Apple ID is already connected to this account.');
      } else {
        showAlert('Apple ID Linked', 'You can now sign in with your Apple ID next time.');
      }
    } catch (err: any) {
      if (err?.code === 'ERR_REQUEST_CANCELED') return; // user dismissed Apple sheet
      showAlert('Linking Failed', err?.message ?? 'Could not link Apple ID. Please try again.');
    } finally {
      setLinkingApple(false);
    }
  };

  const handleLogout = () => {
    showAlert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout', style: 'destructive',
        onPress: async () => {
          if (isLoggingOutRef.current) return;  // guard
          isLoggingOutRef.current = true;
          try {
            await deactivateCurrentDevicePushToken();
            await deleteSecureItem('userBasicDetails').catch(() => {});
            await deleteSecureItem('userBirthDetails').catch(() => {});
            await supabase.auth.signOut();
            // navigation handled by SIGNED_OUT listener
          } catch {
            isLoggingOutRef.current = false;
            showAlert('Logout Failed', 'Please try again.');
          }
        },
      },
    ]);
  };

  const getModalTitle = () => {
    switch (activeModal) {
      case 'helpCenter': return 'Help Center';
      case 'terms': return 'Terms of Service';
      case 'privacyPolicy': return 'Privacy Policy';
      case 'about': return 'About';
      default: return '';
    }
  };

  const renderModalContent = () => {
    switch (activeModal) {
      case 'helpCenter':
        return (
          <View style={styles.listContainer}>
            <TouchableOpacity style={[styles.listItem, expandedHelp === 'faq' && styles.listItemLast]} activeOpacity={0.7} onPress={() => toggleHelp('faq')}>
              <View style={styles.listItemLeft}>
                <MaterialIcons name="question-answer" size={24} color="#A855F7" />
                <Text style={styles.listItemText}>FAQs</Text>
              </View>
              <MaterialIcons name={expandedHelp === 'faq' ? "expand-less" : "expand-more"} size={24} color="#7C3AED" />
            </TouchableOpacity>
            {expandedHelp === 'faq' && (
              <View style={styles.expandedContent}>
                <Text style={styles.expandedText}>
                  • How does the astrological matching work?{'\n'}
                  We combine your Vedic and Western charts with your personal preferences to calculate a deep compatibility score.{'\n\n'}

                  • Is my exact birth time required?{'\n'}
                  While an exact birth time provides the most accurate chart, you can still find great matches using just your birth date and location.{'\n\n'}

                  • Can I change my profile photos?{'\n'}
                  Yes! Head to the Profile tab and tap "Edit Profile". From there, you can easily upload new photos or rearrange them.{'\n\n'}

                  • What do the different match scores mean?{'\n'}
                  The score reflects your elemental harmony and sign compatibility. A higher percentage indicates a deeper astrological connection.{'\n\n'}

                  • Can I hide my profile?{'\n'}
                  Yes, you can manage your profile visibility and discovery preferences directly from your Settings.
                </Text>
              </View>
            )}

            <TouchableOpacity style={[styles.listItem, expandedHelp === 'contact' && styles.listItemLast]} activeOpacity={0.7} onPress={() => toggleHelp('contact')}>
              <View style={styles.listItemLeft}>
                <MaterialIcons name="mail" size={24} color="#A855F7" />
                <Text style={styles.listItemText}>Contact Support</Text>
              </View>
              <MaterialIcons name={expandedHelp === 'contact' ? "expand-less" : "expand-more"} size={24} color="#7C3AED" />
            </TouchableOpacity>
            {expandedHelp === 'contact' && (
              <View style={styles.expandedContent}>
                <Text style={styles.expandedText}>
                  We're here to help! Please reach out to our team at:
                </Text>
                <Text style={styles.emailText}>hello@Astrodate.in</Text>
              </View>
            )}

            <TouchableOpacity style={[styles.listItem, styles.listItemLast]} activeOpacity={0.7} onPress={() => toggleHelp('report')}>
              <View style={styles.listItemLeft}>
                <MaterialIcons name="bug-report" size={24} color="#A855F7" />
                <Text style={styles.listItemText}>Report an Issue</Text>
              </View>
              <MaterialIcons name={expandedHelp === 'report' ? "expand-less" : "expand-more"} size={24} color="#7C3AED" />
            </TouchableOpacity>
            {expandedHelp === 'report' && (
              <View style={[styles.expandedContent, styles.expandedContentLast]}>
                <Text style={styles.expandedText}>
                  Found a bug or experiencing technical difficulties? Please email us details, including screenshots if possible, at:
                </Text>
                <Text style={styles.emailText}>hello@Astrodate.in</Text>
              </View>
            )}
          </View>
        );
      case 'terms':
        return (
          <View style={styles.policyContainer}>
            <Text style={styles.policyTitle}>Terms of Service</Text>
            <Text style={styles.policyText}>
              By using Astro Date, you agree to these terms. We may update them at any time.{'\n\n'}
              1. User Conduct: Treat others with respect and engage authentically.{'\n\n'}
              2. Content: Do not post inappropriate or illegal content.{'\n\n'}
              3. Privacy: We value your privacy. Read our Privacy Policy to understand how your data is used.{'\n\n'}
              4. Termination: We reserve the right to ban accounts that violate these guidelines.
            </Text>
          </View>
        );
      case 'privacyPolicy':
        return (
          <View style={styles.policyContainer}>
            <Text style={styles.policyTitle}>Privacy Policy</Text>
            <Text style={styles.policyText}>
              Your privacy is extremely important to us.{'\n\n'}
              Data Collection: We collect necessary information for matching (astrological data, preferences).{'\n\n'}
              Data Protection: Your data is encrypted and securely stored.{'\n\n'}
              Third Parties: We do not sell your personal data to non-affiliated third parties.
            </Text>
            <TouchableOpacity 
              style={{ marginTop: 24, padding: 16, backgroundColor: 'rgba(248,113,113,0.1)', borderRadius: 12, flexDirection: 'row', alignItems: 'center' }}
              onPress={() => { setActiveModal(null); router.push('/settings/delete-account'); }}
              activeOpacity={0.7}
            >
              <MaterialIcons name="delete-forever" size={24} color="#F87171" style={{ marginRight: 12 }} />
              <Text style={{ color: '#F87171', fontSize: 16, fontWeight: '600' }}>Request Account Deletion</Text>
            </TouchableOpacity>
          </View>
        );
      case 'about':
        return (
          <View style={styles.modalBodyContainer}>
            <LinearGradient colors={['#A855F7', '#EC4899', '#F4D35E']} style={styles.aboutLogoBg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <MaterialIcons name="auto-awesome" size={48} color="#FFFFFF" />
            </LinearGradient>
            <Text style={[styles.emptyTitle, { color: '#FFFFFF', marginTop: 16 }]}>Astro Date</Text>
            <Text style={styles.modalText}>Version 1.0.0 (Build 42)</Text>
            <Text style={[styles.modalText, { marginTop: 24, fontSize: 13, opacity: 0.5 }]}>
              © 2026 Astro Date Inc.{'\n'}All rights reserved.
            </Text>
          </View>
        );
      default:
        return null;
    }
  };

  if (activeModal !== null) {
    return (
      <LinearGradient
        colors={['#1a0d2e', '#2d1b4e', '#4a2c5a']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.container, { paddingTop: insets.top }]}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setActiveModal(null)}
            activeOpacity={0.7}>
            <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{getModalTitle()}</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {renderModalContent()}
        </ScrollView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={['#1a0d2e', '#2d1b4e', '#4a2c5a']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[styles.container, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.back()}
          activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.settingsCard}>
            <View style={!notificationsEnabled ? [styles.settingRow, styles.settingRowLast] : styles.settingRow}>
              <View style={styles.settingLeft}>
                <MaterialIcons name="notifications" size={24} color="#7C3AED" />
                <View style={styles.settingContent}>
                  <Text style={styles.settingTitle}>Push Notifications</Text>
                  <Text style={styles.settingSubtitle}>Receive notifications on your device</Text>
                </View>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: 'rgba(255, 255, 255, 0.2)', true: '#7C3AED' }}
                thumbColor={notificationsEnabled ? '#FFFFFF' : '#FFFFFF'}
              />
            </View>

            {notificationsEnabled && (
              <>
                <View style={styles.settingRow}>
                  <View style={styles.settingLeft}>
                    <MaterialIcons name="email" size={24} color="#7C3AED" />
                    <View style={styles.settingContent}>
                      <Text style={styles.settingTitle}>Email Notifications</Text>
                      <Text style={styles.settingSubtitle}>Get updates via email</Text>
                    </View>
                  </View>
                  <Switch
                    value={emailNotifications}
                    onValueChange={setEmailNotifications}
                    trackColor={{ false: 'rgba(255, 255, 255, 0.2)', true: '#7C3AED' }}
                    thumbColor={emailNotifications ? '#FFFFFF' : '#FFFFFF'}
                  />
                </View>

                <View style={styles.settingRow}>
                  <View style={styles.settingLeft}>
                    <MaterialIcons name="favorite" size={24} color="#EC4899" />
                    <View style={styles.settingContent}>
                      <Text style={styles.settingTitle}>New Matches</Text>
                      <Text style={styles.settingSubtitle}>When someone likes you</Text>
                    </View>
                  </View>
                  <Switch
                    value={matchNotifications}
                    onValueChange={setMatchNotifications}
                    trackColor={{ false: 'rgba(255, 255, 255, 0.2)', true: '#7C3AED' }}
                    thumbColor={matchNotifications ? '#FFFFFF' : '#FFFFFF'}
                  />
                </View>

                <View style={[styles.settingRow, styles.settingRowLast]}>
                  <View style={styles.settingLeft}>
                    <MaterialIcons name="chat-bubble" size={24} color="#4ADE80" />
                    <View style={styles.settingContent}>
                      <Text style={styles.settingTitle}>New Messages</Text>
                      <Text style={styles.settingSubtitle}>When you receive a message</Text>
                    </View>
                  </View>
                  <Switch
                    value={messageNotifications}
                    onValueChange={setMessageNotifications}
                    trackColor={{ false: 'rgba(255, 255, 255, 0.2)', true: '#7C3AED' }}
                    thumbColor={messageNotifications ? '#FFFFFF' : '#FFFFFF'}
                  />
                </View>
              </>
            )}
          </View>
        </View>

        {/* Privacy Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy</Text>
          <View style={styles.settingsCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <MaterialIcons name="location-on" size={24} color="#7C3AED" />
                <View style={styles.settingContent}>
                  <Text style={styles.settingTitle}>Show Distance</Text>
                  <Text style={styles.settingSubtitle}>Display your distance to others</Text>
                </View>
              </View>
              <Switch
                value={showDistance}
                onValueChange={setShowDistance}
                trackColor={{ false: 'rgba(255, 255, 255, 0.2)', true: '#7C3AED' }}
                thumbColor={showDistance ? '#FFFFFF' : '#FFFFFF'}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <MaterialIcons name="cake" size={24} color="#7C3AED" />
                <View style={styles.settingContent}>
                  <Text style={styles.settingTitle}>Show Age</Text>
                  <Text style={styles.settingSubtitle}>Display your age on profile</Text>
                </View>
              </View>
              <Switch
                value={showAge}
                onValueChange={setShowAge}
                trackColor={{ false: 'rgba(255, 255, 255, 0.2)', true: '#7C3AED' }}
                thumbColor={showAge ? '#FFFFFF' : '#FFFFFF'}
              />
            </View>

            <View style={[styles.settingRow, styles.settingRowLast]}>
              <View style={styles.settingLeft}>
                <MaterialIcons name="circle" size={24} color="#4ADE80" />
                <View style={styles.settingContent}>
                  <Text style={styles.settingTitle}>Show Online Status</Text>
                  <Text style={styles.settingSubtitle}>Let others see when you're online</Text>
                </View>
              </View>
              <Switch
                value={showOnlineStatus}
                onValueChange={setShowOnlineStatus}
                trackColor={{ false: 'rgba(255, 255, 255, 0.2)', true: '#7C3AED' }}
                thumbColor={showOnlineStatus ? '#FFFFFF' : '#FFFFFF'}
              />
            </View>
          </View>
        </View>



        {/* Linked Accounts Section — iOS only (Apple Sign In) */}
        {Platform.OS === 'ios' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Linked Accounts</Text>
            <View style={styles.settingsCard}>
              <View style={[styles.settingRow, styles.settingRowLast]}>
                <View style={styles.settingLeft}>
                  <Ionicons
                    name="logo-apple"
                    size={24}
                    color={linkedProviders.includes('apple') ? '#4ADE80' : '#7C3AED'}
                  />
                  <View style={styles.settingContent}>
                    <Text style={styles.settingTitle}>Apple ID</Text>
                    <Text style={styles.settingSubtitle}>
                      {linkedProviders.includes('apple')
                        ? 'Linked — you can sign in with Apple'
                        : 'Not linked — tap to connect your Apple ID'}
                    </Text>
                  </View>
                </View>
                {linkedProviders.includes('apple') ? (
                  <MaterialIcons name="check-circle" size={22} color="#4ADE80" />
                ) : (
                  <TouchableOpacity
                    style={styles.linkButton}
                    onPress={handleLinkApple}
                    disabled={linkingApple}
                    activeOpacity={0.8}
                  >
                    {linkingApple
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={styles.linkButtonText}>Link</Text>}
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Email & Account Security Section */}
        {!!(currentEmail || emailAuthUser) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Email & Security</Text>
            <View style={styles.settingsCard}>

              {/* Current email display */}
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <MaterialIcons name="email" size={24} color="#7C3AED" />
                  <View style={styles.settingContent}>
                    <Text style={styles.settingTitle}>Email Address</Text>
                    <Text style={styles.settingSubtitle} numberOfLines={1}>
                      {currentEmail ?? 'Not set'}
                    </Text>
                  </View>
                </View>
                {/* Verified / Unverified badge */}
                {isEmailVerified !== null && (
                  <View style={[
                    styles.verifiedBadge,
                    isEmailVerified ? styles.verifiedBadgeGreen : styles.verifiedBadgeAmber,
                  ]}>
                    <MaterialIcons
                      name={isEmailVerified ? 'verified' : 'warning'}
                      size={13}
                      color={isEmailVerified ? '#10B981' : '#F59E0B'}
                    />
                    <Text style={[
                      styles.verifiedBadgeText,
                      { color: isEmailVerified ? '#10B981' : '#F59E0B' },
                    ]}>
                      {isEmailVerified ? 'Verified' : 'Unverified'}
                    </Text>
                  </View>
                )}
              </View>

              {/* Resend verification — only shown when unverified */}
              {isEmailVerified === false && (
                <TouchableOpacity
                  style={styles.settingRow}
                  activeOpacity={0.7}
                  disabled={resendLoading || resendCooldown > 0}
                  onPress={handleResendVerification}
                >
                  <View style={styles.settingLeft}>
                    <MaterialIcons name="mark-email-unread" size={24} color="#F59E0B" />
                    <View style={styles.settingContent}>
                      <Text style={[styles.settingTitle, { color: '#F59E0B' }]}>
                        Resend Verification Email
                      </Text>
                      <Text style={styles.settingSubtitle}>
                        {resendCooldown > 0
                          ? `Wait ${resendCooldown}s before resending`
                          : 'Tap to send a new verification link'}
                      </Text>
                    </View>
                  </View>
                  {resendLoading
                    ? <ActivityIndicator size="small" color="#F59E0B" />
                    : <MaterialIcons name="chevron-right" size={24} color="#F59E0B" />}
                </TouchableOpacity>
              )}

              {/* Update email — only for email+password users */}
              {emailAuthUser && (
                <>
                  <TouchableOpacity
                    style={showUpdateEmail ? styles.settingRow : [styles.settingRow, styles.settingRowLast]}
                    activeOpacity={0.7}
                    onPress={() => { setShowUpdateEmail(!showUpdateEmail); setNewEmail(''); }}
                  >
                    <View style={styles.settingLeft}>
                      <MaterialIcons name="edit" size={24} color="#7C3AED" />
                      <View style={styles.settingContent}>
                        <Text style={styles.settingTitle}>Update Email Address</Text>
                        <Text style={styles.settingSubtitle}>Change the email on your account</Text>
                      </View>
                    </View>
                    <MaterialIcons
                      name={showUpdateEmail ? 'expand-less' : 'chevron-right'}
                      size={24}
                      color="#7C3AED"
                    />
                  </TouchableOpacity>

                  {showUpdateEmail && (
                    <View style={[styles.updateEmailForm, styles.settingRowLast]}>
                      <TextInput
                        value={newEmail}
                        onChangeText={(t) => setNewEmail(t.toLowerCase().trim())}
                        placeholder="New email address"
                        placeholderTextColor="rgba(255,255,255,0.35)"
                        style={styles.textInput}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoFocus
                      />
                      <View style={styles.updateEmailButtons}>
                        <TouchableOpacity
                          style={styles.cancelBtn}
                          onPress={() => { setShowUpdateEmail(false); setNewEmail(''); }}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.cancelBtnText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.confirmBtn, (!newEmail || updateEmailLoading) && styles.confirmBtnDisabled]}
                          onPress={handleUpdateEmail}
                          disabled={!newEmail || updateEmailLoading}
                          activeOpacity={0.8}
                        >
                          {updateEmailLoading
                            ? <ActivityIndicator size="small" color="#fff" />
                            : <Text style={styles.confirmBtnText}>Send Confirmation</Text>}
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.updateEmailHint}>
                        A confirmation link will be sent to your new address. Your current email remains active until confirmed.
                      </Text>
                    </View>
                  )}
                </>
              )}
            </View>
          </View>
        )}

        {/* Subscription Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subscription</Text>
          <View style={styles.settingsCard}>
            {membership?.plan_slug !== 'free' && membership?.status === 'active' && (
              <TouchableOpacity
                style={styles.settingRow}
                activeOpacity={0.7}
                disabled={cancellingSubscription}
                onPress={handleCancelSubscription}>
                <View style={styles.settingLeft}>
                  <MaterialIcons name="cancel" size={24} color="#EF4444" />
                  <View style={styles.settingContent}>
                    <Text style={[styles.settingTitle, { color: '#EF4444' }]}>Cancel Subscription</Text>
                    <Text style={styles.settingSubtitle}>End your {membership.plan_name ?? 'premium'} plan</Text>
                  </View>
                </View>
                {cancellingSubscription
                  ? <ActivityIndicator size="small" color="#EF4444" />
                  : <MaterialIcons name="chevron-right" size={24} color="#EF4444" />}
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.settingRow, styles.settingRowLast]}
              activeOpacity={0.7}
              disabled={restoring}
              onPress={async () => {
                setRestoring(true);
                try {
                  const found = await restorePurchases();
                  if (found) {
                    showAlert('Restored', 'Your subscription has been restored successfully.');
                  } else {
                    showAlert('Nothing to restore', 'No active subscription found for this account.');
                  }
                } catch (e) {
                  showAlert('Error', e instanceof Error ? e.message : 'Please try again.');
                } finally {
                  setRestoring(false);
                }
              }}
            >
              <View style={styles.settingLeft}>
                <MaterialIcons name="restore" size={24} color="#7C3AED" />
                <View style={styles.settingContent}>
                  {restoring ? (
                    <ActivityIndicator size="small" color="#7C3AED" style={{ alignSelf: 'flex-start' }} />
                  ) : (
                    <Text style={styles.settingTitle}>Restore purchases</Text>
                  )}
                  <Text style={styles.settingSubtitle}>Recover a previous subscription</Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={24} color="#7C3AED" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.settingsCard}>
            <TouchableOpacity style={styles.settingRow} activeOpacity={0.7} onPress={() => router.push('/(tabs)/profile?edit=true')}>
              <View style={styles.settingLeft}>
                <MaterialIcons name="person" size={24} color="#7C3AED" />
                <View style={styles.settingContent}>
                  <Text style={styles.settingTitle}>Edit Profile</Text>
                  <Text style={styles.settingSubtitle}>Update your profile information</Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={24} color="#7C3AED" />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.settingRow, styles.settingRowLast]} activeOpacity={0.7} onPress={() => router.push('/settings/delete-account')}>
              <View style={styles.settingLeft}>
                <MaterialIcons name="delete-forever" size={24} color="#EF4444" />
                <View style={styles.settingContent}>
                  <Text style={[styles.settingTitle, { color: '#EF4444' }]}>Delete Account</Text>
                  <Text style={styles.settingSubtitle}>Permanently delete your account and data</Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={24} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Support Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <View style={styles.settingsCard}>
            <TouchableOpacity style={styles.settingRow} activeOpacity={0.7} onPress={() => setActiveModal('helpCenter')}>
              <View style={styles.settingLeft}>
                <MaterialIcons name="help-outline" size={24} color="#7C3AED" />
                <View style={styles.settingContent}>
                  <Text style={styles.settingTitle}>Help Center</Text>
                  <Text style={styles.settingSubtitle}>Get help and support</Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={24} color="#7C3AED" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingRow} activeOpacity={0.7} onPress={() => router.push('/terms')}>
              <View style={styles.settingLeft}>
                <MaterialIcons name="description" size={24} color="#7C3AED" />
                <View style={styles.settingContent}>
                  <Text style={styles.settingTitle}>Terms of Service</Text>
                  <Text style={styles.settingSubtitle}>Read our terms and conditions</Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={24} color="#7C3AED" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingRow} activeOpacity={0.7} onPress={() => router.push('/privacy')}>
              <View style={styles.settingLeft}>
                <MaterialIcons name="privacy-tip" size={24} color="#7C3AED" />
                <View style={styles.settingContent}>
                  <Text style={styles.settingTitle}>Privacy Policy</Text>
                  <Text style={styles.settingSubtitle}>How we protect your data</Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={24} color="#7C3AED" />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.settingRow, styles.settingRowLast]} activeOpacity={0.7} onPress={() => setActiveModal('about')}>
              <View style={styles.settingLeft}>
                <MaterialIcons name="info-outline" size={24} color="#7C3AED" />
                <View style={styles.settingContent}>
                  <Text style={styles.settingTitle}>About</Text>
                  <Text style={styles.settingSubtitle}>App version 1.0.0</Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={24} color="#7C3AED" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.7}>
          <MaterialIcons name="logout" size={24} color="#F87171" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>

    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginTop: -30,
    backgroundColor: 'transparent',
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    flex: 1,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    paddingHorizontal: 4,
    letterSpacing: -0.3,
  },
  settingsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  settingRowLast: {
    borderBottomWidth: 0,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  settingContent: {
    flex: 1,
    gap: 4,
  },
  settingTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  settingSubtitle: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
    fontWeight: '400',
  },
  dangerText: {
    color: '#F87171',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.3)',
    gap: 12,
    marginTop: 8,
    marginBottom: 8,
  },
  logoutText: {
    color: '#F87171',
    fontSize: 16,
    fontWeight: '700',
  },
  bottomSpacer: {
    height: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 5, 20, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'rgba(26, 13, 46, 0.95)',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    height: '60%',
    overflow: 'hidden',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.4)',
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
    paddingTop: 32,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(168, 85, 247, 0.2)',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  modalBody: {
    padding: 24,
  },
  modalBodyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  modalText: {
    color: '#E9D5FF',
    opacity: 0.8,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  iconCircleRed: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.3)',
  },
  formContainer: {
    paddingVertical: 12,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    color: '#D1D5DB',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  textInput: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.4)',
    borderRadius: 16,
    padding: 16,
    color: '#FFFFFF',
    fontSize: 16,
  },
  primaryButton: {
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonGradient: {
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  listContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.2)',
    overflow: 'hidden',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  listItemLast: {
    borderBottomWidth: 0,
  },
  listItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  listItemText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  listItemSelected: {
    color: '#A855F7',
    fontWeight: '700',
  },
  expandedContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  expandedContentLast: {
    borderBottomWidth: 0,
  },
  expandedText: {
    color: '#D1D5DB',
    fontSize: 14,
    lineHeight: 22,
  },
  emailText: {
    color: '#A855F7',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 8,
  },
  policyContainer: {
    padding: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.2)',
  },
  policyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  policyText: {
    color: '#D1D5DB',
    fontSize: 15,
    lineHeight: 24,
  },
  aboutLogoBg: {
    width: 100,
    height: 100,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#EC4899',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  // Email & Security section
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  verifiedBadgeGreen: {
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderColor: 'rgba(16,185,129,0.3)',
  },
  verifiedBadgeAmber: {
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderColor: 'rgba(245,158,11,0.3)',
  },
  verifiedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  updateEmailForm: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  updateEmailButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  cancelBtnText: {
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
    fontSize: 14,
  },
  confirmBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#7C3AED',
  },
  confirmBtnDisabled: {
    opacity: 0.45,
  },
  confirmBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  updateEmailHint: {
    marginTop: 10,
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    lineHeight: 17,
  },
  linkButton: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});