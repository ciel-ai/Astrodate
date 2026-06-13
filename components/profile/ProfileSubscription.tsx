import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SubscriptionStatusBanner } from '@/components/SubscriptionStatusBanner';
import { profileStyles as styles } from './profileStyles';
import type { ProfileData } from '../../hooks/useProfileData';

export function ProfileSubscription({ data }: { data: ProfileData }) {
  const {
    paymentStatus,
    paymentError,
    resetPayment,
    fetchMembership,
    membership,
    planCatalog,
    loadingPlanId,
    handleSubscribe,
  } = data;

  return (
    <>
      {/* Payment Verification Banner */}
      {paymentStatus !== 'idle' && (
        <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
          <SubscriptionStatusBanner status={paymentStatus as any} error={paymentError} />
          {paymentStatus === 'active' && (
            <TouchableOpacity
              onPress={() => {
                resetPayment();
                fetchMembership();
              }}
              activeOpacity={0.7}
              style={styles.subscriptionCtaButton}
            >
              <MaterialIcons name="check-circle" size={18} color="#1E103A" />
              <Text style={styles.subscriptionCtaButtonText}>Done</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Subscription Plans */}
      {!membership?.is_active && planCatalog && planCatalog.length > 0 && (
        <View style={[styles.subscriptionInlineSection, { paddingHorizontal: 16 }]}>
          <View style={styles.subscriptionHero}>
            <View style={styles.subscriptionLogoCircle}>
              <MaterialIcons name="auto-awesome" size={28} color="#F4D35E" />
            </View>
            <Text style={styles.subscriptionHeroTitle}>Unlock Premium</Text>
            <Text style={styles.subscriptionHeroSubtitle}>
              Get deeper astrological insights, unlimited likes, and see who liked you.
            </Text>
          </View>

          <View style={styles.subscriptionCards}>
            {planCatalog.map((plan) => {
              const isHighlighted = plan.plan_slug === 'astro_x';
              const priceRupees = (plan.amount_paise / 100).toLocaleString('en-IN');
              const intervalLabel =
                plan.interval === 'monthly' ? '/ month' :
                  plan.interval === 'annual' ? '/ year' :
                    plan.interval === 'lifetime' ? 'one-time' : '';
              const isThisPlanLoading = loadingPlanId === plan.id;

              return (
                <View
                  key={plan.id}
                  style={[styles.subscriptionCard, isHighlighted && styles.subscriptionCardActive]}
                >
                  <View style={styles.subscriptionCardHeader}>
                    <View style={styles.subscriptionCardTitleRow}>
                      <Text style={styles.subscriptionCardTitle}>{plan.plan_badge}</Text>
                      {isHighlighted && (
                        <View style={styles.subscriptionBadgeTag}>
                          <Text style={styles.subscriptionBadgeTagText}>BEST VALUE</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.subscriptionPrice}>₹{priceRupees} {intervalLabel}</Text>
                  </View>

                  <Text style={styles.subscriptionTagline}>{plan.plan_name}</Text>

                  <TouchableOpacity
                    style={[
                      styles.subscriptionCtaButton,
                      isThisPlanLoading && { opacity: 0.6 },
                    ]}
                    disabled={isThisPlanLoading}
                    onPress={() => handleSubscribe(plan.id, plan.plan_name, plan.amount_paise)}
                    activeOpacity={0.85}
                  >
                    {isThisPlanLoading ? (
                      <ActivityIndicator size="small" color="#1E103A" />
                    ) : (
                      <>
                        <MaterialIcons name="auto-awesome" size={18} color="#1E103A" />
                        <Text style={styles.subscriptionCtaButtonText}>Get {plan.plan_name}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

          <Text style={styles.subscriptionDisclaimer}>
            {Platform.OS === 'ios'
              ? 'Payments are processed via Apple In-App Purchase.'
              : 'Payments are processed securely via Razorpay. Subscriptions are non-refundable.'}
          </Text>
        </View>
      )}
    </>
  );
}