import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useRef } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── Section data ──────────────────────────────────────────────────────────────

const SECTIONS = [
  {
    id: 'intro',
    title: '1. Introduction',
    icon: 'info-outline' as const,
    content: `AstroDate ("we", "our", "us") is operated by AstroDate Technologies Private Limited, a company incorporated under the Companies Act, 2013. This Privacy Policy explains how we collect, use, store, share, and protect your personal data when you use our mobile application and related services.

This Policy is compliant with the Digital Personal Data Protection Act, 2023 (DPDP Act) and the Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011.

By using AstroDate, you ("Data Principal") consent to the collection and processing of your personal data as described in this Policy. If you do not agree, please discontinue use of the application.

Last updated: June 2025. Effective date: June 2025.`,
  },
  {
    id: 'collect',
    title: '2. Data We Collect',
    icon: 'storage' as const,
    content: `We collect the following categories of personal data:

Identity & Profile Data
• Full name, date of birth, gender, and profile photos
• Phone number and/or email address used for authentication
• Location (city/region level) for match discovery

Astrological Data (Sensitive)
• Birth date, birth time, and birth place — used exclusively to compute your astrological chart (Western sun/moon/rising signs, Vedic/Indian birth star, dominant element, and synastry compatibility scores)
• Astrological chart data derived from the above inputs
• This data is classified as Sensitive Personal Data under DPDP Act 2023

Usage & Behavioural Data
• Swipe actions (likes, dislikes, super-likes) — used for match recommendations and improving the algorithm
• In-app activity, session duration, feature interactions
• Push notification opt-in status and delivery logs

Device & Technical Data
• Device type, OS version, app version
• Expo push token (for notifications)
• IP address (for fraud prevention only)

Payment Data
• Subscription plan and payment status
• Razorpay transaction ID and order ID — we do not store card numbers or UPI credentials; payment processing is handled entirely by Razorpay`,
  },
  {
    id: 'use',
    title: '3. How We Use Your Data',
    icon: 'settings' as const,
    content: `We process your personal data for the following purposes, each grounded in a lawful basis under DPDP Act 2023:

Core Service (Contractual necessity)
• Computing astrological compatibility (AstroScore, synastry) between users
• Displaying your profile to potential matches
• Facilitating messaging between matched users
• Delivering your daily cosmic match, standouts, and astro-event features

Personalisation (Legitimate interest / Consent)
• Tailoring match recommendations based on your preferences and astrological profile
• Generating daily horoscope content relevant to your sun sign
• Sending push notifications for matches, messages, and cosmic events

Platform Safety (Legitimate interest)
• Detecting and preventing fraud, fake accounts, and abuse
• Processing user reports and enforcing community guidelines

Payments (Contractual necessity)
• Processing Stellar subscription purchases via Razorpay
• Managing subscription status, renewals, and cancellations

Analytics & Improvement (Legitimate interest)
• Understanding aggregate usage patterns to improve the app
• We use anonymised and aggregated data only — no individual profiling for analytics

We will never sell your personal data to third parties.`,
  },
  {
    id: 'astro',
    title: '4. Astrological API Usage',
    icon: 'auto-awesome' as const,
    content: `AstroDate uses third-party astrological computation services to generate your birth chart and compatibility scores. Specifically:

Data Shared with Astro APIs
• Birth date, birth time, and birth place are transmitted to our astrological computation provider(s) solely for the purpose of generating chart data
• No name, phone number, email, or photo is shared with these providers
• All API calls are made server-side via Supabase Edge Functions — your raw birth data is never transmitted directly from your device to a third-party API

Data Retention by Astro APIs
• Computed chart results (planetary positions, house placements) are cached in our database to avoid repeated API calls
• Raw birth details are stored only in our Supabase database under your user record, encrypted at rest

Google Gemini (AI Icebreaker)
• AstroDate uses Google Gemini AI to generate personalised conversation starters based on two users' astrological profiles
• Only anonymised astrological attributes (signs, elements, compatibility notes) are sent — no names, photos, or identifying information
• Gemini outputs are not used to train any model on your data

You may request deletion of all computed astrological data by deleting your account (Settings → Delete Account).`,
  },
  {
    id: 'sharing',
    title: '5. Data Sharing',
    icon: 'share' as const,
    content: `We share your data only in the following limited circumstances:

With Other Users
• Your profile (name, age, photos, astrological sign, bio) is visible to other users within your discovery preferences
• Swipe actions, like/dislike decisions, and chat messages are shared only with the relevant matched user

With Service Providers (Data Processors)
• Supabase — database, authentication, and real-time infrastructure (servers located in Singapore/US)
• Razorpay — payment processing for Stellar subscriptions (PCI-DSS compliant)
• Expo — push notification delivery infrastructure
• Google Gemini — AI-generated icebreaker suggestions (anonymised data only)
• Astrological computation API — birth chart calculation (anonymised data only)

All service providers are bound by data processing agreements and are prohibited from using your data for their own purposes.

Legal Disclosures
• We may disclose your data if required by Indian law, court order, or government authority under the DPDP Act 2023 or other applicable legislation
• We will notify you of any such disclosure to the extent permitted by law

We do not share your data with advertisers. AstroDate is ad-free.`,
  },
  {
    id: 'rights',
    title: '6. Your Rights (DPDP Act 2023)',
    icon: 'gavel' as const,
    content: `Under the Digital Personal Data Protection Act, 2023, you have the following rights as a Data Principal:

Right to Access
• Request a summary of the personal data we hold about you and the purposes for which it is processed

Right to Correction
• Request correction of inaccurate or incomplete personal data

Right to Erasure
• Request deletion of your personal data. You can initiate this directly via Settings → Delete Account. We will delete your data within 30 days, except where retention is required by law

Right to Grievance Redressal
• Raise a grievance with our Data Protection Officer (details below). We will respond within 30 days

Right to Nominate
• Nominate another individual to exercise your rights in the event of your death or incapacity (contact our DPO to set this up)

Right to Withdraw Consent
• You may withdraw consent for optional processing (e.g. push notifications, personalisation) at any time through app settings. Withdrawal does not affect prior processing

To exercise any of these rights, contact:
Data Protection Officer
Email: privacy@astrodate.app
Response time: 30 days`,
  },
  {
    id: 'retention',
    title: '7. Data Retention',
    icon: 'schedule' as const,
    content: `We retain your personal data for as long as your account is active or as needed to provide services.

Active Account
• All profile, astrological, and activity data is retained while your account is active

Account Deletion
• Upon account deletion, your profile is immediately hidden from discovery
• Personal data is permanently deleted within 30 days
• Anonymised, aggregated analytics data may be retained indefinitely as it cannot identify you
• Transaction records required for GST/tax compliance are retained for 7 years per Indian law

Inactive Accounts
• Accounts inactive for 24 consecutive months may be flagged for deletion. We will notify you before taking any action

Push Notification Logs
• Notification delivery logs are retained for 90 days for debugging purposes`,
  },
  {
    id: 'security',
    title: '8. Security',
    icon: 'security' as const,
    content: `We implement industry-standard security measures to protect your personal data:

• Encryption at rest — all data stored in Supabase is AES-256 encrypted at the database level
• Encryption in transit — all API communication uses TLS 1.2+
• Authentication — phone OTP and email magic link authentication; no passwords stored
• Row-Level Security (RLS) — Supabase RLS policies ensure users can only access their own data
• Access controls — internal team access to production data is role-restricted and logged
• Payment security — card and UPI data is handled exclusively by Razorpay (PCI-DSS Level 1 compliant); we store only order IDs and status

Despite these measures, no system is completely secure. In the event of a data breach affecting your rights, we will notify you as required under DPDP Act 2023.`,
  },
  {
    id: 'children',
    title: '9. Children\'s Privacy',
    icon: 'child-care' as const,
    content: `AstroDate is not intended for individuals under 18 years of age. We do not knowingly collect personal data from minors.

If you believe a minor has created an account on AstroDate, please contact us at privacy@astrodate.app. We will investigate and delete the account and associated data promptly.`,
  },
  {
    id: 'changes',
    title: '10. Changes to This Policy',
    icon: 'update' as const,
    content: `We may update this Privacy Policy from time to time to reflect changes in our practices, technology, or legal requirements.

When we make material changes, we will:
• Display an in-app notification before the changes take effect
• Update the "Last updated" date at the top of this Policy
• For significant changes, request your fresh consent where required by law

Continued use of AstroDate after changes take effect constitutes acceptance of the updated Policy.`,
  },
  {
    id: 'contact',
    title: '11. Contact Us',
    icon: 'mail' as const,
    content: `For privacy-related queries, requests, or grievances:

Data Protection Officer
AstroDate Technologies Private Limited
Email: privacy@astrodate.app

Grievance Officer (as required under IT Act 2000)
Email: grievance@astrodate.app
Response time: 30 days

For general support: support@astrodate.app

You also have the right to lodge a complaint with the Data Protection Board of India once it is constituted under the DPDP Act 2023.`,
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <LinearGradient
      colors={['#0d0718', '#160a2e', '#1e0f3a']}
      style={styles.container}
    >
      {/* Sticky header background on scroll */}
      <Animated.View
        style={[
          styles.stickyHeaderBg,
          { paddingTop: insets.top, opacity: headerOpacity },
        ]}
      />

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Privacy Policy</Text>
        <View style={styles.topBarRight} />
      </View>

      <Animated.ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <MaterialIcons name="privacy-tip" size={28} color="#a855f7" />
          </View>
          <Text style={styles.heroTitle}>Privacy Policy</Text>
          <Text style={styles.heroSubtitle}>
            AstroDate Technologies Private Limited
          </Text>
          <View style={styles.heroBadgeRow}>
            <View style={styles.heroBadge}>
              <MaterialIcons name="verified" size={11} color="#22c55e" />
              <Text style={styles.heroBadgeText}>DPDP Act 2023 compliant</Text>
            </View>
            <View style={styles.heroBadge}>
              <MaterialIcons name="schedule" size={11} color="#9b72d4" />
              <Text style={styles.heroBadgeText}>Updated June 2025</Text>
            </View>
          </View>
        </View>

        {/* Sections */}
        {SECTIONS.map((section, index) => (
          <View key={section.id} style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconContainer}>
                <MaterialIcons name={section.icon} size={16} color="#a855f7" />
              </View>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
            <Text style={styles.sectionBody}>{section.content}</Text>
            {index < SECTIONS.length - 1 && <View style={styles.sectionDivider} />}
          </View>
        ))}
      </Animated.ScrollView>
    </LinearGradient>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  stickyHeaderBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: 'rgba(13,7,24,0.97)',
    zIndex: 10,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    zIndex: 11,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  topBarRight: {
    width: 36,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  // Hero
  hero: {
    alignItems: 'center',
    paddingVertical: 28,
    marginBottom: 8,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(168,85,247,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    marginBottom: 14,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  heroBadgeText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
  },
  // Sections
  section: {
    marginBottom: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  sectionIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(168,85,247,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
  },
  sectionBody: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 21,
    paddingLeft: 38,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 20,
    marginLeft: 38,
  },
});
