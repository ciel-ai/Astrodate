import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CircularProgress } from '@/components/feed/components/CircularProgress';

interface CosmicCompatibilityProps {
  overall: number;
  emotional: number;
  communication: number;
  values: number;
}

export default function CosmicCompatibility({
  overall,
  emotional,
  communication,
  values,
}: CosmicCompatibilityProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="sparkles" size={16} color="#D8B4FE" />
          <Text style={styles.title}>Cosmic Compatibility</Text>
        </View>
        <Text style={styles.subtitle}>How the stars align for us</Text>
      </View>

      <View style={styles.content}>
        {/* Left: Overall Circular Progress */}
        <View style={styles.overallContainer}>
          <CircularProgress
            percentage={overall}
            label="Overall Match"
            size={110}
            strokeWidth={8}
            color="#A855F7"
            innerBackgroundColor="transparent"
            textColor="#FFFFFF"
          />
        </View>

        {/* Right: Sub-scores Grid */}
        <View style={styles.subScoresContainer}>
          <View style={styles.subScoreCard}>
            <View style={styles.iconCircle}>
              <Ionicons name="heart" size={16} color="#F472B6" />
            </View>
            <Text style={styles.subScorePercentage}>{emotional}%</Text>
            <Text style={styles.subScoreLabel} numberOfLines={1} adjustsFontSizeToFit>Emotional</Text>
            <Text style={styles.subScoreDesc}>Deep emotional connection</Text>
          </View>

          <View style={styles.subScoreCard}>
            <View style={styles.iconCircle}>
              <Ionicons name="chatbubble-ellipses" size={16} color="#D8B4FE" />
            </View>
            <Text style={styles.subScorePercentage}>{communication}%</Text>
            <Text style={styles.subScoreLabel} numberOfLines={1} adjustsFontSizeToFit>Communication</Text>
            <Text style={styles.subScoreDesc}>Easy flow and understanding</Text>
          </View>

          <View style={styles.subScoreCard}>
            <View style={styles.iconCircle}>
              <Ionicons name="star" size={16} color="#FBBF24" />
            </View>
            <Text style={styles.subScorePercentage}>{values}%</Text>
            <Text style={styles.subScoreLabel} numberOfLines={1} adjustsFontSizeToFit>Values</Text>
            <Text style={styles.subScoreDesc}>Aligned in what truly matters</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginTop: 16,
  },
  header: {
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginLeft: 24,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    gap: 12,
  },
  overallContainer: {
    width: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subScoresContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  subScoreCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    paddingHorizontal: 4,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.15)',
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  subScorePercentage: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  subScoreLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
    textAlign: 'center',
  },
  subScoreDesc: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 11,
  },
});
