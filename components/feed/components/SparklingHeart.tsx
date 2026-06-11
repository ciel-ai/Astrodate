import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

export function SparklingHeart({ id, delay }: { id: number; delay: number }) {
  const translateY = useSharedValue(Math.random() * 400 - 200);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 200 });
    scale.value = withSpring(1, { damping: 8, stiffness: 100 });
    const timeout = setTimeout(() => {
      opacity.value = withTiming(0, { duration: 400 });
      scale.value = withTiming(0, { duration: 400 });
      translateY.value = withTiming(translateY.value - 100, { duration: 400 });
    }, 300 + delay);
    return () => clearTimeout(timeout);
  }, [delay, opacity, scale, translateY]);

  const heartAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }] as any,
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[sparklingStyles.sparklingHeart, heartAnimatedStyle as any]}>
      <MaterialIcons name="favorite" size={24} color="#EC4899" />
    </Animated.View>
  );
}

// Inlined from the main FeedScreen StyleSheet (line 4008)
const sparklingStyles = StyleSheet.create({
  sparklingHeart: {
    position: 'absolute',
    right: 20,
    top: '50%',
    zIndex: 1000,
  },
});
