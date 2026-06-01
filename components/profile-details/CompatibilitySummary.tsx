import React, { memo, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

// ─── ScoreCard (bar progress) ─────────────────────────────────────────────────
const ScoreCard = ({ percentage, label }: { percentage: number; label: string }) => {
  const progress = Math.min(100, Math.max(0, percentage));
  const progressValue = useSharedValue(0);
  const [displayProgress, setDisplayProgress] = useState(0);

  useEffect(() => {
    progressValue.value = withTiming(progress, {
      duration: 1000,
      easing: Easing.out(Easing.ease),
    });
  }, [progress, progressValue]);

  useDerivedValue(() => {
    const rounded = Math.round(progressValue.value);
    runOnJS(setDisplayProgress)(rounded);
  });

  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${progressValue.value}%`,
  }));

  return (
    <View style={styles.scoreCard}>
      <View style={styles.scoreCardHeader}>
        <Text style={styles.scoreCardLabel}>{label}</Text>
        <Text style={styles.scoreCardPercentage}>{displayProgress}%</Text>
      </View>
      <View style={styles.scoreCardBarContainer}>
        <Animated.View style={[styles.scoreCardBar, progressBarStyle]} />
      </View>
    </View>
  );
};

// ─── CompatibilitySummary ─────────────────────────────────────────────────────
interface CompatibilitySummaryProps {
  indianScore?: number;
  westernScore?: number;
  finalScore?: number;
  personalityScore?: number;
}

const toPercentage = (score: number | undefined): number | null => {
  if (score === undefined || score === null) return null;
  const n = Number(score);
  return n > 10 ? n : n * 10;
};

const CompatibilitySummary = memo(function CompatibilitySummary({
  indianScore,
  westernScore,
  finalScore,
  personalityScore,
}: CompatibilitySummaryProps) {
  const overallPct = toPercentage(finalScore ?? indianScore ?? westernScore);
  const indianPct = toPercentage(indianScore);
  const westernPct = toPercentage(westernScore);
  const personalityPct = toPercentage(personalityScore);

  const hasAny =
    overallPct !== null ||
    indianPct !== null ||
    westernPct !== null ||
    personalityPct !== null;

  if (!hasAny) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>Compatibility</Text>
      <View style={styles.scoresContainer}>
        {overallPct !== null && (
          <ScoreCard percentage={overallPct} label="Overall Match" />
        )}
        {indianPct !== null && (
          <ScoreCard percentage={indianPct} label="Vedic Astro" />
        )}
        {westernPct !== null && (
          <ScoreCard percentage={westernPct} label="Western Astro" />
        )}
        {personalityPct !== null && (
          <ScoreCard percentage={personalityPct} label="Personality" />
        )}
      </View>
    </View>
  );
});

export default CompatibilitySummary;

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 20,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.2)',
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E9D5FF',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  scoresContainer: {
    gap: 16,
    paddingVertical: 8,
  },
  scoreCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  scoreCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  scoreCardLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.85)',
  },
  scoreCardPercentage: {
    fontSize: 16,
    fontWeight: '700',
    color: '#A855F7',
  },
  scoreCardBarContainer: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  scoreCardBar: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#A855F7',
  },
});
