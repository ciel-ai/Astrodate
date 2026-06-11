import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

// Circular Progress Indicator Component
export const CircularProgress = ({
  percentage,
  label,
  size = 90,
  strokeWidth = 8,
  color = '#A855F7',
  innerBackgroundColor = '#1a0d2e',
  textColor = '#FFFFFF',
  subLabel = ''
}: {
  percentage: number;
  label: string;
  size?: number;
  strokeWidth?: number;
  color?: string;
  innerBackgroundColor?: string;
  textColor?: string;
  subLabel?: string;
}) => {
  const progress = Math.min(100, Math.max(0, percentage));
  const radius = size / 2;

  const progressValue = useSharedValue(0);

  useEffect(() => {
    progressValue.value = withTiming(progress, {
      duration: 1200,
      easing: Easing.out(Easing.ease),
    });
  }, [progress, progressValue]);

  // Drive arc rotation from the Reanimated shared value so the ring
  // actually animates smoothly. The previous code used static JS values
  // (firstHalfRotation, secondHalfRotation) computed from `progress` once —
  // the number counter animated but the arc geometry never moved.
  const firstHalfStyle = useAnimatedStyle(() => {
    'worklet';
    const deg = Math.min(progressValue.value, 50) * 3.6 - 135;
    return { transform: [{ rotate: `${deg}deg` }] };
  });

  const secondHalfStyle = useAnimatedStyle(() => {
    'worklet';
    const deg = progressValue.value > 50 ? (progressValue.value - 50) * 3.6 - 135 : -135;
    const arcColor = progressValue.value > 50 ? color : 'transparent';
    return {
      transform: [{ rotate: `${deg}deg` }],
      borderColor: arcColor,
      borderRightColor: 'transparent',
      borderTopColor: 'transparent',
    };
  });

  return (
    <View style={[circularStyles.container, { width: size }]}>
      <View style={[circularStyles.circleContainer, { width: size, height: size }]}>
        <View style={[
          circularStyles.trackCircle,
          {
            width: size,
            height: size,
            borderRadius: radius,
            borderWidth: strokeWidth,
            borderColor: 'rgba(255, 255, 255, 0.2)',
          }
        ]} />

        <View style={[
          circularStyles.halfContainer,
          {
            width: radius,
            height: size,
            left: radius,
            overflow: 'hidden',
          }
        ]}>
          <Animated.View style={[
            circularStyles.rotatingHalf,
            {
              width: size,
              height: size,
              left: -radius,
              borderRadius: radius,
              borderWidth: strokeWidth,
              borderColor: color,
              borderLeftColor: 'transparent',
              borderBottomColor: 'transparent',
            },
            firstHalfStyle,
          ]} />
        </View>

        <View style={[
          circularStyles.halfContainer,
          {
            width: radius,
            height: size,
            left: 0,
            overflow: 'hidden',
          }
        ]}>
          <Animated.View style={[
            circularStyles.rotatingHalf,
            {
              width: size,
              height: size,
              left: 0,
              borderRadius: radius,
              borderWidth: strokeWidth,
            },
            secondHalfStyle,
          ]} />
        </View>

        <View style={[
          circularStyles.innerCircle,
          {
            width: size - strokeWidth * 2 - 6,
            height: size - strokeWidth * 2 - 6,
            borderRadius: (size - strokeWidth * 2 - 6) / 2,
            top: strokeWidth + 3,
            left: strokeWidth + 3,
            backgroundColor: innerBackgroundColor,
          }
        ]}>
          <Text style={[circularStyles.percentageText, { color: textColor }]}>{progress}%</Text>
          {subLabel ? (
            <Text style={{ fontSize: 8, fontWeight: 'bold', color: textColor, opacity: 0.6, marginTop: 2 }}>
              {subLabel}
            </Text>
          ) : null}
        </View>
      </View>
      {label ? <Text style={circularStyles.labelText}>{label}</Text> : null}
    </View>
  );
};

const circularStyles = StyleSheet.create({
  container: { alignItems: 'center' },
  circleContainer: { position: 'relative' },
  trackCircle: { position: 'absolute' },
  halfContainer: { position: 'absolute', top: 0 },
  rotatingHalf: { position: 'absolute', top: 0 },
  innerCircle: { position: 'absolute', backgroundColor: '#1a0d2e', justifyContent: 'center', alignItems: 'center' },
  percentageText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  labelText: { fontSize: 12, fontWeight: '600', color: 'rgba(255, 255, 255, 0.9)', marginTop: 8, textAlign: 'center' },
});
