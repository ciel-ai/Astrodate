import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CircularProgress } from '@/components/feed/components/CircularProgress';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
} from 'react-native-reanimated';

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
  const [hasSwiped, setHasSwiped] = useState(false);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);

  React.useEffect(() => {
    translateX.value = withRepeat(
      withSequence(
        withTiming(4, { duration: 600 }),
        withTiming(-2, { duration: 600 })
      ),
      -1, // Infinite repeat
      true // Reverse
    );
  }, []);

  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    if (offsetX > 10 && !hasSwiped) {
      setHasSwiped(true);
      opacity.value = withTiming(0, { duration: 300 });
    } else if (offsetX <= 10 && hasSwiped) {
      setHasSwiped(false);
      opacity.value = withTiming(1, { duration: 300 });
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <View style={styles.titleRow}>
            <Ionicons name="sparkles" size={16} color="#D8B4FE" />
            <Text style={styles.title}>Cosmic Compatibility</Text>
          </View>
          <Text style={styles.subtitle}>How the stars align for us</Text>
        </View>

      </View>

      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
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
            <Ionicons name="heart" size={20} color="#F472B6" style={styles.iconTop} />
            <CircularProgress
              percentage={emotional}
              label=""
              size={48}
              strokeWidth={3.5}
              color="#A855F7"
              innerBackgroundColor="transparent"
              textColor="#FFFFFF"
            />
            <Text style={[styles.subScoreLabel, { color: '#F472B6' }]} numberOfLines={1} adjustsFontSizeToFit>Emotional</Text>
            <Text style={styles.subScoreDesc}>Deep emotional connection</Text>
          </View>

          <View style={styles.subScoreCard}>
            <Ionicons name="chatbubble-ellipses" size={20} color="#D8B4FE" style={styles.iconTop} />
            <CircularProgress
              percentage={communication}
              label=""
              size={48}
              strokeWidth={3.5}
              color="#A855F7"
              innerBackgroundColor="transparent"
              textColor="#FFFFFF"
            />
            <Text style={[styles.subScoreLabel, { color: '#D8B4FE' }]} numberOfLines={1} adjustsFontSizeToFit>Communication</Text>
            <Text style={styles.subScoreDesc}>Easy flow and understanding</Text>
          </View>

          <View style={styles.subScoreCard}>
            <Ionicons name="star" size={20} color="#FBBF24" style={styles.iconTop} />
            <CircularProgress
              percentage={values}
              label=""
              size={48}
              strokeWidth={3.5}
              color="#A855F7"
              innerBackgroundColor="transparent"
              textColor="#FFFFFF"
            />
            <Text style={[styles.subScoreLabel, { color: '#FBBF24' }]} numberOfLines={1} adjustsFontSizeToFit>Values</Text>
            <Text style={styles.subScoreDesc}>Aligned in what truly matters</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.swipeIndicatorBottom}>
        <Animated.View style={[styles.swipeIndicator, animatedStyle]} pointerEvents="none">
          <Text style={styles.swipeText}>Swipe</Text>
          <Ionicons name="arrow-forward" size={12} color="rgba(255,255,255,0.6)" />
        </Animated.View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
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
  swipeIndicatorBottom: {
    alignItems: 'flex-end',
    marginTop: 12,
  },
  swipeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  swipeText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingRight: 20,
  },
  overallContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 110,
  },
  subScoresContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  subScoreCard: {
    width: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.15)',
  },
  iconTop: {
    marginBottom: 8,
  },
  subScoreLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4,
    marginTop: 8,
    textAlign: 'center',
  },
  subScoreDesc: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 11,
  },
});
