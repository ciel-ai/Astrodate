/**
 * SubscriptionStatusBanner
 *
 * Drop-in banner that reflects the current payment verification state
 * produced by useSubscriptionPayment(). Renders nothing when status is 'idle'.
 *
 * Usage:
 * ```tsx
 * const { paymentStatus, paymentError, startPayment } = useSubscriptionPayment();
 * ...
 * <SubscriptionStatusBanner status={paymentStatus} error={paymentError} />
 * ```
 */

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { PaymentStatus } from '@/lib/useSubscriptionPayment';

interface Props {
  status: PaymentStatus;
  error?: string | null;
}

export function SubscriptionStatusBanner({ status, error }: Props) {
  if (status === 'idle') return null;

  const isPending  = status === 'creating' || status === 'browser' || status === 'pending';
  const isActive   = status === 'active';
  const isFailed   = status === 'failed';

  return (
    <View style={[
      styles.banner,
      isActive && styles.bannerActive,
      isFailed && styles.bannerFailed,
    ]}>
      <View style={styles.row}>

        {isPending && (
          <>
            <ActivityIndicator size="small" color="#A855F7" style={styles.icon} />
            <View style={styles.textBlock}>
              <Text style={styles.title}>
                {status === 'creating' ? 'Preparing Payment…' : 'Verifying Payment…'}
              </Text>
              <Text style={styles.body}>
                {status === 'creating'
                  ? 'Setting up your secure payment link.'
                  : 'Your payment was received. Confirming with our servers — this usually takes a few seconds.'}
              </Text>
            </View>
          </>
        )}

        {isActive && (
          <>
            <MaterialIcons name="check-circle" size={24} color="#10B981" style={styles.icon} />
            <View style={styles.textBlock}>
              <Text style={[styles.title, styles.titleActive]}>Subscription Active 🎉</Text>
              <Text style={styles.body}>Your premium subscription is now active. Enjoy all features!</Text>
            </View>
          </>
        )}

        {isFailed && (
          <>
            <MaterialIcons name="warning" size={24} color="#F59E0B" style={styles.icon} />
            <View style={styles.textBlock}>
              <Text style={[styles.title, styles.titleFailed]}>Still Verifying</Text>
              <Text style={styles.body}>
                {error ??
                  'We couldn\'t confirm your subscription yet — it may take a little longer. ' +
                  'If you completed payment, please wait a moment and reopen this screen. ' +
                  'Contact support at hello@Astrodate.in if the issue persists.'}
              </Text>
            </View>
          </>
        )}

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: 'rgba(168, 85, 247, 0.08)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
    padding: 16,
    marginBottom: 12,
  },
  bannerActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  bannerFailed: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  icon: {
    marginRight: 12,
    marginTop: 2,
  },
  textBlock: {
    flex: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  titleActive: {
    color: '#10B981',
  },
  titleFailed: {
    color: '#F59E0B',
  },
  body: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 13,
    lineHeight: 19,
  },
});
