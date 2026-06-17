import { useSharedValue, useAnimatedRef, withSpring } from 'react-native-reanimated';
import type Animated from 'react-native-reanimated';

export function useFeedSharedValues(initialTabBarHidden: boolean = false) {
  // Swipe card
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(1);
  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);

  // Scroll / tab-bar
  const lastScrollY = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const isTabBarHiddenShared = useSharedValue(initialTabBarHidden);
  const nextCardBlur = useSharedValue(0);

  // Flip
  const rotateY = useSharedValue(0);

  // Animated scroll ref
  const parallaxScrollRef = useAnimatedRef<Animated.ScrollView>();

  // Worklet — lives here because it only touches the above shared values
  const resetCardPosition = () => {
    'worklet';
    translateX.value = withSpring(0, { damping: 12, stiffness: 120 });
    translateY.value = withSpring(0, { damping: 12, stiffness: 120 });
    rotate.value = withSpring(0, { damping: 12, stiffness: 120 });
    opacity.value = withSpring(1, { damping: 12, stiffness: 120 });
  };

  return {
    translateX,
    translateY,
    rotate,
    opacity,
    panStartX,
    panStartY,
    lastScrollY,
    scrollY,
    isTabBarHiddenShared,
    nextCardBlur,
    rotateY,
    parallaxScrollRef,
    resetCardPosition,
  };
}
export type FeedSharedValues = ReturnType<typeof useFeedSharedValues>;
