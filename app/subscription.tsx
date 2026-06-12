/**
 * app/subscription.tsx
 *
 * AstroDate subscription screen.
 * Registered automatically as /subscription by Expo Router
 * because it lives in the app/ directory.
 *
 * Three tiers driven by plan_catalog rows in Supabase:
 *   free       — Stardust  (₹0)
 *   astro_plus — Astro+    (₹299/mo)
 *   astro_x    — AstroX    (₹599/mo)
 */

import { SubscriptionStatusBanner } from '@/components/SubscriptionStatusBanner';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { REVENUECAT_API_KEY_IOS, REVENUECAT_CONSUMABLE_IDS, type RevenueCatPlanSlug } from '@/lib/iap-products';
import { getPlanCatalog } from '@/lib/subscription';
import { supabase } from '@/lib/supabase';
import { useSubscriptionPayment } from '@/lib/useSubscriptionPayment';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Purchases, { PURCHASES_ERROR_CODE } from 'react-native-purchases';
import { SafeAreaView } from 'react-native-safe-area-context';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Static plan display definitions ─────────────────────────────────────────
// These drive the UI only. Prices shown are fallbacks — the real
// amount_paise is always fetched from plan_catalog in Supabase.
const PLANS: PlanDef[] = [
  {
    slug: 'free',
    name: 'Stardust',
    badge: '✦ Free',
    tagline: 'Start your cosmic journey',
    fallbackPaise: 0,
    gradientColors: ['#1e1033', '#0f0a1e'] as [string, string],
    accentColor: '#94A3B8',
    badgeColor: '#475569',
    features: [
      { label: '10 likes per day',                    included: true  },
      { label: 'Daily horoscope & cosmic insights',   included: true  },
      { label: '1 peek at who liked you',             included: true  },
      { label: '1 Star (super-like) per week',        included: true  },
      { label: 'See 5+ profiles who liked you',       included: false },
      { label: 'Advanced filters & dealbreakers',     included: false },
      { label: 'Full synastry breakdown',             included: false },
      { label: 'AI compatibility readings',           included: false },
      { label: 'Weekly profile Boost',                included: false },
    ],
  },
  {
    slug: 'astro_plus',
    name: 'Astro+',
    badge: '✦ Astro+',
    tagline: 'See every heart aligned with yours',
    fallbackPaise: 29900,
    gradientColors: ['#3b0764', '#581c87'] as [string, string],
    accentColor: '#A855F7',
    badgeColor: '#7C3AED',
    popular: true,
    features: [
      { label: 'Unlimited likes',                          included: true, highlight: true },
      { label: 'See 5 profiles who liked you',             included: true, highlight: true },
      { label: 'Advanced filters & dealbreakers',          included: true, highlight: true },
      { label: '3 Stars (super-likes) per week',           included: true },
      { label: 'Daily horoscope & cosmic insights',        included: true },
      { label: 'See ALL profiles who liked you',           included: false },
      { label: 'Full synastry (Venus / Mars / Mercury)',   included: false },
      { label: 'AI compatibility readings',                included: false },
      { label: 'Weekly profile Boost',                     included: false },
    ],
  },
  {
    slug: 'astro_x',
    name: 'AstroX',
    badge: '✦ AstroX',
    tagline: 'The stars — and the algorithm — work for you',
    fallbackPaise: 59900,
    gradientColors: ['#0c1a2e', '#1e3a5f'] as [string, string],
    accentColor: '#60A5FA',
    badgeColor: '#1D4ED8',
    features: [
      { label: 'Everything in Astro+',                          included: true, highlight: true },
      { label: 'See ALL profiles who liked you',                included: true, highlight: true },
      { label: 'Full synastry (Venus / Mars / Mercury)',        included: true, highlight: true },
      { label: 'Vedic Ashtakoota (36-guna) breakdown',         included: true, highlight: true },
      { label: 'AI compatibility readings in-chat',            included: true },
      { label: '5 Stars (super-likes) per week',               included: true },
      { label: '1 weekly profile Boost',                       included: true },
      { label: 'Priority likes (7-day pin)',                    included: true },
      { label: 'Enhanced recommendations',                     included: true },
    ],
  },
];

// ─── Consumables ─────────────────────────────────────────────────────────────
const CONSUMABLES = [
  { id: 'stars_3',    emoji: '⭐', name: '3 Stars',               desc: 'Jump to the top of their likes',      price: '₹149' },
  { id: 'boost_1',   emoji: '🚀', name: 'Profile Boost',         desc: '30 min of top-of-stack visibility',   price: '₹199' },
  { id: 'synastry_1',emoji: '🔭', name: 'Synastry Report',       desc: 'Deep compatibility read for one match',price: '₹99'  },
  { id: 'ai_1',      emoji: '🔮', name: 'AI Compatibility Read', desc: 'Instant AI insight on any match',      price: '₹49'  },
];

// ─── Types ────────────────────────────────────────────────────────────────────
type FeatureItem = { label: string; included: boolean; highlight?: boolean };
type PlanSlug = 'free' | RevenueCatPlanSlug;
type PlanDef = {
  slug: PlanSlug;
  name: string;
  badge: string;
  tagline: string;
  fallbackPaise: number;
  gradientColors: [string, string];
  accentColor: string;
  badgeColor: string;
  popular?: boolean;
  features: FeatureItem[];
};
type LivePlan = {
  id: string;
  plan_slug: string;
  plan_name: string;
  plan_badge: string;
  amount_paise: number;
  interval: string | null;
};

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function SubscriptionScreen() {
  const router = useRouter();
  const { membership, refetch } = useSubscriptionStatus();
  const { paymentStatus, paymentError, startPayment, resetPayment, restorePurchases } = useSubscriptionPayment();

  const [livePlans, setLivePlans]     = useState<LivePlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [userId, setUserId]           = useState<string | null>(null);
  const [userEmail, setUserEmail]     = useState<string | undefined>(undefined);

  // Auth
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
      setUserEmail(data.user?.email ?? undefined);
    });
  }, []);

  // Fetch live plans from Supabase (excludes free row via getPlanCatalog)
  useEffect(() => {
    (async () => {
      setLoadingPlans(true);
      const data = await getPlanCatalog();
      if (data) setLivePlans(data as LivePlan[]);
      setLoadingPlans(false);
    })();
  }, []);

  // Refetch membership after successful payment
  useEffect(() => {
    if (paymentStatus === 'active') refetch();
  }, [paymentStatus]);

  const currentSlug = membership?.plan_slug ?? 'free';
  const isCurrentPlan = (slug: string) =>
    currentSlug === slug && (slug === 'free' || membership?.is_active === true);

  const handleSubscribe = async (plan: PlanDef) => {
    if (!userId) return;
    const live = livePlans.find(p => p.plan_slug === plan.slug);
    if (!live) return;
    setSelectedSlug(plan.slug);
    resetPayment();
    await startPayment({
      planId:      live.id,
      planName:    live.plan_name,
      planSlug:    plan.slug === 'free' ? undefined : plan.slug,
      amountPaise: live.amount_paise,
      userId,
      userEmail,
      currency: 'INR',
    });
  };

  const formatPrice = (paise: number) =>
    paise === 0 ? 'Free forever' : `₹${(paise / 100).toFixed(0)} / mo`;

  const handleConsumablePurchase = async (consumableId: string) => {
    if (Platform.OS === 'ios') {
      try {
        if (!REVENUECAT_API_KEY_IOS) {
          Alert.alert('Error', 'RevenueCat iOS API key is missing.');
          return;
        }
        Purchases.configure({ apiKey: REVENUECAT_API_KEY_IOS });
        
        const rcId = REVENUECAT_CONSUMABLE_IDS[consumableId as keyof typeof REVENUECAT_CONSUMABLE_IDS];
        if (!rcId) {
          Alert.alert('Error', 'Invalid product configuration.');
          return;
        }

        const products = await Purchases.getProducts([rcId]);
        if (products && products.length > 0) {
          const product = products[0];
          await Purchases.purchaseStoreProduct(product);
          Alert.alert('Success', 'Purchase completed successfully!');
        } else {
          Alert.alert('Error', 'Product not found on the App Store.');
        }
      } catch (error: any) {
        if (error.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
          Alert.alert('Cancelled', 'Purchase was cancelled.');
        } else {
          Alert.alert('Error', error.message || 'An error occurred during purchase.');
        }
      }
    } else if (Platform.OS === 'android') {
      Alert.alert('Coming soon', 'À la carte purchases on Android coming soon.');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Choose Your Plan</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroStar}>✦</Text>
          <Text style={styles.heroTitle}>
            The stars know{'\n'}
            <Text style={styles.heroPurple}>who's compatible.</Text>
          </Text>
          <Text style={styles.heroSub}>
            Unlock deeper matching, astrology insights,{'\n'}and expert guidance.
          </Text>
        </View>

        {/* Payment status banner */}
        {paymentStatus !== 'idle' && (
          <View style={styles.bannerWrap}>
            <SubscriptionStatusBanner status={paymentStatus} error={paymentError} />
            {paymentStatus === 'active' && (
              <TouchableOpacity
                onPress={() => { resetPayment(); router.back(); }}
                style={styles.doneBtn}
                activeOpacity={0.8}
              >
                <Text style={styles.doneBtnText}>✓ Done</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Plan cards */}
        {loadingPlans ? (
          <ActivityIndicator color="#A855F7" style={{ marginVertical: 40 }} />
        ) : (
          PLANS.map(plan => {
            const live     = livePlans.find(p => p.plan_slug === plan.slug);
            const paise    = live ? live.amount_paise : plan.fallbackPaise;
            const isCurrent = isCurrentPlan(plan.slug);
            const isPaying  = selectedSlug === plan.slug &&
                              paymentStatus !== 'idle' && paymentStatus !== 'active';

            return (
              <View key={plan.slug} style={styles.cardOuter}>
                {plan.popular && (
                  <View style={styles.popularPill}>
                    <Text style={styles.popularText}>✦ Most Popular</Text>
                  </View>
                )}

                <LinearGradient
                  colors={plan.gradientColors}
                  style={[
                    styles.card,
                    isCurrent && { borderColor: plan.accentColor, borderWidth: 2 },
                    plan.popular && styles.cardPopular,
                  ]}
                >
                  {/* Card header */}
                  <View style={styles.cardTop}>
                    <View style={{ flex: 1 }}>
                      <View style={[
                        styles.badgePill,
                        { backgroundColor: plan.badgeColor + '33', borderColor: plan.badgeColor + '66' }
                      ]}>
                        <Text style={[styles.badgeText, { color: plan.accentColor }]}>
                          {plan.badge}
                        </Text>
                      </View>
                      <Text style={styles.planName}>{plan.name}</Text>
                      <Text style={styles.planTagline}>{plan.tagline}</Text>
                    </View>
                    <View style={styles.priceBlock}>
                      <Text style={[styles.price, { color: plan.accentColor }]}>
                        {formatPrice(paise)}
                      </Text>
                    </View>
                  </View>

                  {/* Divider */}
                  <View style={[styles.divider, { backgroundColor: plan.accentColor + '30' }]} />

                  {/* Features */}
                  <View style={styles.featureList}>
                    {plan.features.map((f, i) => (
                      <View key={i} style={styles.featureRow}>
                        <Text style={[
                          styles.featureDot,
                          { color: f.included ? plan.accentColor : '#475569' }
                        ]}>
                          {f.included ? '✦' : '○'}
                        </Text>
                        <Text style={[
                          styles.featureLabel,
                          !f.included && styles.featureDimmed,
                          f.included && f.highlight && { color: '#FFFFFF', fontWeight: '600' },
                        ]}>
                          {f.label}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* CTA */}
                  {plan.slug === 'free' ? (
                    isCurrent ? (
                      <View style={styles.currentPill}>
                        <Text style={styles.currentPillText}>✓ Your current plan</Text>
                      </View>
                    ) : null
                  ) : isCurrent ? (
                    <View style={[styles.currentPill, { borderColor: plan.accentColor + '60' }]}>
                      <Text style={[styles.currentPillText, { color: plan.accentColor }]}>
                        ✓ Active plan
                      </Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={() => handleSubscribe(plan)}
                      disabled={isPaying || !live}
                      activeOpacity={0.85}
                      style={styles.ctaOuter}
                    >
                      <LinearGradient
                        colors={
                          plan.slug === 'astro_plus'
                            ? ['#A855F7', '#7C3AED']
                            : ['#3B82F6', '#1D4ED8']
                        }
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.ctaBtn}
                      >
                        {isPaying ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Text style={styles.ctaText}>
                            {!live ? 'Coming soon' : `Get ${plan.name}`}
                          </Text>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  )}
                </LinearGradient>
              </View>
            );
          })
        )}

        {/* À la carte consumables */}
        <View style={styles.consumablesCard}>
          <Text style={styles.consumablesTitle}>✦ À la carte</Text>
          <Text style={styles.consumablesSub}>
            No subscription? Buy exactly what you need.
          </Text>
          {CONSUMABLES.map(c => (
            <TouchableOpacity key={c.id} style={styles.consumableRow} onPress={() => handleConsumablePurchase(c.id)} activeOpacity={0.7}>
              <Text style={styles.consumableEmoji}>{c.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.consumableName}>{c.name}</Text>
                <Text style={styles.consumableDesc}>{c.desc}</Text>
              </View>
              <Text style={styles.consumablePrice}>{c.price}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          {Platform.OS === 'ios' ? (
            <>
              <Text style={styles.footerText}>
                Subscriptions managed by Apple. Cancel anytime in iOS Settings → [Your Name] → Subscriptions.
              </Text>
              <TouchableOpacity
                onPress={async () => {
                  const ok = await restorePurchases();
                  if (ok) {
                    Alert.alert('Restored', 'Your purchases have been restored.');
                  } else {
                    Alert.alert('Nothing to Restore', 'No previous purchases were found for this Apple ID.');
                  }
                }}
                style={styles.restoreButton}
              >
                <Text style={styles.footerLink}>Restore Purchases</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => Linking.openURL('itms-apps://apps.apple.com/account/subscriptions')}>
                <Text style={styles.footerLink}>Manage subscription in iOS Settings ↗</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.footerText}>
              Payments secured by Razorpay. Cancel anytime from Settings → Subscription.
            </Text>
          )}
          <TouchableOpacity onPress={() => Linking.openURL('https://astrodate.in/terms')}>
            <Text style={styles.footerLink}>Terms of Service</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#04020b',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    color: '#fff',
    fontSize: 22,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Scroll
  scrollContent: {
    paddingBottom: 60,
  },

  // Hero
  hero: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 24,
  },
  heroStar: {
    color: '#A855F7',
    fontSize: 20,
    marginBottom: 12,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 36,
    marginBottom: 12,
  },
  heroPurple: {
    color: '#A855F7',
  },
  heroSub: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Banner
  bannerWrap: {
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  doneBtn: {
    marginTop: 8,
    alignSelf: 'center',
    backgroundColor: '#10B981',
    borderRadius: 20,
    paddingHorizontal: 28,
    paddingVertical: 10,
  },
  doneBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },

  // Plan cards
  cardOuter: {
    marginHorizontal: 16,
    marginBottom: 20,
  },
  popularPill: {
    alignSelf: 'center',
    backgroundColor: '#A855F7',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: -14,
    zIndex: 10,
  },
  popularText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  card: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardPopular: {
    borderColor: '#A855F7',
    borderWidth: 1.5,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    marginTop: 8,
  },
  badgePill: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  planName: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  planTagline: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    maxWidth: 180,
    lineHeight: 17,
  },
  priceBlock: {
    alignItems: 'flex-end',
    paddingTop: 4,
  },
  price: {
    fontSize: 16,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    marginBottom: 16,
  },
  featureList: {
    gap: 10,
    marginBottom: 20,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureDot: {
    fontSize: 12,
    width: 16,
    textAlign: 'center',
  },
  featureLabel: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 14,
    flex: 1,
  },
  featureDimmed: {
    color: 'rgba(255,255,255,0.25)',
    textDecorationLine: 'line-through',
  },
  ctaOuter: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  ctaBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  ctaText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  currentPill: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 12,
    alignItems: 'center',
  },
  currentPillText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    fontWeight: '600',
  },

  // Consumables
  consumablesCard: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 24,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 20,
  },
  consumablesTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  consumablesSub: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    marginBottom: 16,
  },
  consumableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  consumableEmoji: {
    fontSize: 22,
  },
  consumableName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  consumableDesc: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    marginTop: 2,
  },
  consumablePrice: {
    color: '#A855F7',
    fontSize: 15,
    fontWeight: '700',
  },

  // Footer
  footer: {
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },
  footerText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 20,
  },
  footerLink: {
    color: 'rgba(168,85,247,0.6)',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  restoreButton: {
    marginTop: 4,
  },
});