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
    title: '1. Acceptance of Terms',
    icon: 'handshake' as const,
    content: `These Terms of Service ("Terms") constitute a legally binding agreement between you ("User") and AstroDate Technologies Private Limited ("AstroDate", "we", "our", "us"), a company incorporated under the Companies Act, 2013.

By downloading, installing, or using the AstroDate mobile application, you confirm that:
• You are at least 18 years of age
• You have the legal capacity to enter into this agreement
• You agree to be bound by these Terms and our Privacy Policy

If you do not agree to these Terms, you must immediately stop using AstroDate. We reserve the right to update these Terms at any time. Continued use after updates constitutes acceptance.

Last updated: June 2025.`,
  },
  {
    id: 'eligibility',
    title: '2. Eligibility',
    icon: 'person-pin' as const,
    content: `To use AstroDate, you must:

• Be at least 18 years of age (or the age of majority in your jurisdiction, whichever is higher)
• Be a human individual — accounts created by bots, scripts, or automated methods are prohibited
• Not be legally prohibited from using dating or social applications in your jurisdiction
• Not have been previously banned from AstroDate for violations of these Terms

By using AstroDate, you represent and warrant that you meet all of the above eligibility requirements. If we discover that you do not, we reserve the right to immediately terminate your account without notice or refund.`,
  },
  {
    id: 'account',
    title: '3. Account & Registration',
    icon: 'account-circle' as const,
    content: `Account Creation
• You may register using your phone number (OTP verification) or email address
• You must provide accurate, current, and complete information during registration
• You are responsible for maintaining the confidentiality of your account

Profile Content
• Your profile must represent you as an individual — no impersonation, fake identities, or use of another person's photos
• Profile photos must be recent photos of yourself. AI-generated photos, stock images, and photos of other people are prohibited
• You are solely responsible for all content you post, including photos, bio text, and messages

Account Security
• You must notify us immediately at support@astrodate.app if you suspect unauthorised access to your account
• You are responsible for all activity that occurs under your account
• One account per person — creating multiple accounts is prohibited`,
  },
  {
    id: 'conduct',
    title: '4. Acceptable Use',
    icon: 'rule' as const,
    content: `You agree not to use AstroDate to:

Prohibited Content
• Post, share, or transmit any content that is defamatory, obscene, pornographic, hateful, or discriminatory
• Harass, threaten, bully, or intimidate other users
• Solicit money, gifts, or financial assistance from other users
• Advertise products, services, or third-party platforms

Prohibited Actions
• Attempt to reverse-engineer, decompile, or extract source code from the application
• Use automated tools to scrape, crawl, or extract user data
• Circumvent any security or authentication mechanism
• Engage in fraud, misrepresentation, or any illegal activity
• Create multiple accounts to evade a ban or limitation
• Share another user's personal information without their consent (doxxing)

Astrological Data
• You must provide accurate birth details — deliberately providing false birth data to manipulate compatibility scores is a violation of these Terms

Violations may result in immediate account suspension or permanent ban without refund.`,
  },
  {
    id: 'subscription',
    title: '5. Subscriptions & Payments',
    icon: 'card-membership' as const,
    content: `Astro+ / AstroX Subscription Plans
AstroDate offers optional paid subscriptions ("Astro+" and "AstroX") that unlock premium features including unlimited likes, seeing who liked you, advanced filters, and priority match visibility.

Pricing & Billing
• Subscription prices are displayed in Indian Rupees (INR) inclusive of applicable GST
• Billing occurs through Razorpay at the start of each subscription period
• Subscriptions auto-renew unless cancelled at least 24 hours before the renewal date

Cancellation
• You may cancel your subscription at any time through the app (Profile → Manage Subscription)
• Cancellation takes effect at the end of the current billing period — you retain access until then
• Cancellation does not entitle you to a refund for the current period

Refund Policy
• All subscription purchases are final and non-refundable, except as required by applicable Indian consumer protection law
• If you experience a technical error that prevents access to paid features, contact support@astrodate.app within 7 days for investigation
• Refunds, if applicable, will be processed to the original payment method within 5–7 business days

Free Trial
• Where a free trial is offered, it automatically converts to a paid subscription at the end of the trial unless cancelled beforehand

Price Changes
• We reserve the right to change subscription pricing. We will give at least 30 days' notice of any price increase before it affects existing subscribers.

GST
• All prices include GST as applicable under Indian tax law. A GST invoice is available on request.`,
  },
  {
    id: 'content',
    title: '6. User Content & Intellectual Property',
    icon: 'copyright' as const,
    content: `Your Content
• You retain ownership of all content you submit to AstroDate (photos, bio, messages)
• By submitting content, you grant AstroDate a non-exclusive, royalty-free, worldwide licence to use, display, and process your content solely to operate and improve the service
• This licence ends when you delete your content or account, subject to reasonable technical delays

AstroDate's Intellectual Property
• The AstroDate application, including its design, algorithms (including the AstroScore and synastry engine), branding, and all proprietary content, is the exclusive property of AstroDate Technologies Private Limited
• You may not reproduce, distribute, or create derivative works from AstroDate's IP without express written permission

Astrological Compatibility
• AstroScore and synastry compatibility scores are proprietary algorithms. They are provided for entertainment and self-reflection purposes only and do not constitute relationship advice or guarantees`,
  },
  {
    id: 'safety',
    title: '7. Safety & Reporting',
    icon: 'health-and-safety' as const,
    content: `Your Safety
• AstroDate does not conduct criminal background checks on users. You are responsible for exercising caution when meeting people you connect with through the app
• We strongly recommend meeting matches for the first time in public places
• Never share financial information, home addresses, or workplace details with someone you have just matched with

Reporting
• You can report any user or message directly within the app
• Reports are reviewed by our Trust & Safety team within 48 hours
• False or malicious reports may result in action against the reporting account

Emergency
• If you are in immediate danger, contact emergency services (India: 112) immediately
• AstroDate is not an emergency service

Zero Tolerance
AstroDate has zero tolerance for:
• Sexual content involving minors (CSAM) — immediately reported to law enforcement
• Non-consensual intimate image sharing
• Coordinated harassment or hate speech`,
  },
  {
    id: 'disclaimer',
    title: '8. Disclaimers & Limitation of Liability',
    icon: 'warning-amber' as const,
    content: `Service Disclaimer
• AstroDate is provided "as is" and "as available" without warranties of any kind, express or implied
• We do not guarantee that the service will be uninterrupted, error-free, or secure
• Astrological compatibility scores are for entertainment purposes only. AstroDate makes no scientific claims about the accuracy or predictive value of astrology

No Guarantee of Matches
• We do not guarantee that you will find a romantic partner or make any specific connection through AstroDate

Limitation of Liability
To the maximum extent permitted by applicable Indian law:
• AstroDate's total liability for any claim arising from your use of the service shall not exceed the amount you paid us in the 3 months preceding the claim
• We are not liable for any indirect, incidental, special, consequential, or punitive damages
• We are not liable for any content posted by users or for interactions between users that occur on or off the platform

Nothing in these Terms limits our liability for death, personal injury, or fraud caused by our negligence.`,
  },
  {
    id: 'termination',
    title: '9. Termination',
    icon: 'cancel' as const,
    content: `By You
• You may delete your account at any time through Settings → Delete Account
• Deletion is permanent and irreversible

By AstroDate
• We may suspend or terminate your account at any time, with or without notice, if:
  — You violate these Terms or our community guidelines
  — We are required to do so by law or court order
  — We discontinue the service

Effect of Termination
• Upon termination, your right to use AstroDate immediately ceases
• Active subscriptions are not refunded upon termination for cause
• We will delete your personal data within 30 days of account deletion, per our Privacy Policy`,
  },
  {
    id: 'governing',
    title: '10. Governing Law & Disputes',
    icon: 'gavel' as const,
    content: `Governing Law
• These Terms are governed by and construed in accordance with the laws of India, without regard to conflict of law principles

Dispute Resolution
• In the event of any dispute arising from these Terms or your use of AstroDate, you agree to first attempt to resolve the dispute informally by contacting us at legal@astrodate.app
• If the dispute cannot be resolved informally within 30 days, either party may pursue formal legal remedies

Jurisdiction
• For any formal legal proceedings, both parties submit to the exclusive jurisdiction of the courts of Chennai, Tamil Nadu, India

Consumer Rights
• Nothing in these Terms affects your statutory rights as a consumer under Indian law, including under the Consumer Protection Act, 2019`,
  },
  {
    id: 'contact',
    title: '11. Contact',
    icon: 'mail' as const,
    content: `For questions about these Terms:

Legal & Compliance
AstroDate Technologies Private Limited
Email: legal@astrodate.app

General Support: support@astrodate.app
Privacy / Data: privacy@astrodate.app
Grievance Officer: grievance@astrodate.app

Response time: 30 business days for legal queries, 5 business days for general support.`,
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function TermsOfServiceScreen() {
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
      <Animated.View
        style={[
          styles.stickyHeaderBg,
          { paddingTop: insets.top, opacity: headerOpacity },
        ]}
      />

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Terms of Service</Text>
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
            <MaterialIcons name="description" size={28} color="#a855f7" />
          </View>
          <Text style={styles.heroTitle}>Terms of Service</Text>
          <Text style={styles.heroSubtitle}>
            AstroDate Technologies Private Limited
          </Text>
          <View style={styles.heroBadgeRow}>
            <View style={styles.heroBadge}>
              <MaterialIcons name="gavel" size={11} color="#22c55e" />
              <Text style={styles.heroBadgeText}>Indian law compliant</Text>
            </View>
            <View style={styles.heroBadge}>
              <MaterialIcons name="schedule" size={11} color="#9b72d4" />
              <Text style={styles.heroBadgeText}>Updated June 2025</Text>
            </View>
          </View>
        </View>

        {/* Summary box */}
        <View style={styles.summaryBox}>
          <MaterialIcons name="info-outline" size={16} color="#a855f7" style={{ marginTop: 1 }} />
          <Text style={styles.summaryText}>
            Plain-language summary: You must be 18+, be yourself, treat others with respect, and not misuse the platform. Paid subscriptions are non-refundable except where required by law. Astrological scores are for fun — not scientific relationship advice.
          </Text>
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  stickyHeaderBg: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
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
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center', alignItems: 'center',
  },
  topBarTitle: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  topBarRight: { width: 36 },
  content: { paddingHorizontal: 20, paddingTop: 8 },
  hero: { alignItems: 'center', paddingVertical: 28, marginBottom: 4 },
  heroIcon: {
    width: 56, height: 56, borderRadius: 18,
    backgroundColor: 'rgba(168,85,247,0.15)',
    borderWidth: 1, borderColor: 'rgba(168,85,247,0.3)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 14,
  },
  heroTitle: { fontSize: 24, fontWeight: '700', color: '#FFFFFF', marginBottom: 4 },
  heroSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 14 },
  heroBadgeRow: { flexDirection: 'row', gap: 8 },
  heroBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)',
  },
  heroBadgeText: { fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },
  summaryBox: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: 'rgba(168,85,247,0.08)',
    borderWidth: 1, borderColor: 'rgba(168,85,247,0.2)',
    borderRadius: 12, padding: 14, marginBottom: 24,
  },
  summaryText: { flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 19 },
  section: { marginBottom: 4 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  sectionIconContainer: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: 'rgba(168,85,247,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', flex: 1 },
  sectionBody: { fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 21, paddingLeft: 38 },
  sectionDivider: {
    height: 1, backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 20, marginLeft: 38,
  },
});
