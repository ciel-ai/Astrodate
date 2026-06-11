import { useCallback } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  interpolate,
  interpolateColor,
  useAnimatedScrollHandler,
  useAnimatedProps,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

export interface UseFeedGesturesProps {
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  rotate: SharedValue<number>;
  opacity: SharedValue<number>;
  panStartX: SharedValue<number>;
  panStartY: SharedValue<number>;
  scrollY: SharedValue<number>;
  lastScrollY: SharedValue<number>;
  isTabBarHiddenShared: SharedValue<boolean>;
  nextCardBlur: SharedValue<number>;
  rotateY: SharedValue<number>;
  resetCardPosition: () => void;
  // Action callbacks
  onSuperLike: () => void;
  onSwipe: (direction: 'left' | 'right') => void;
  onPhotoTap: () => void;
  updateProfileIndex: () => void;
  setIsTransitioning: (val: boolean) => void;
  // Gesture enable flags
  isFlipped: boolean;
  isTransitioning: boolean;
  // Viewport / Tab bar
  SCREEN_WIDTH: number;
  setTabBarHidden: (val: boolean) => void;
}

export function useFeedGestures({
  translateX,
  translateY,
  rotate,
  opacity,
  panStartX,
  panStartY,
  scrollY,
  lastScrollY,
  isTabBarHiddenShared,
  nextCardBlur,
  rotateY,
  resetCardPosition,
  onSuperLike,
  onSwipe,
  onPhotoTap,
  updateProfileIndex,
  setIsTransitioning,
  isFlipped,
  isTransitioning,
  SCREEN_WIDTH,
  setTabBarHidden,
}: UseFeedGesturesProps) {

  const updateTabBarVisibility = useCallback((shouldHide: boolean) => {
    if (isTabBarHiddenShared.value !== shouldHide) {
      isTabBarHiddenShared.value = shouldHide;
      setTabBarHidden(shouldHide);
    }
  }, [isTabBarHiddenShared, setTabBarHidden]);

  // Gestures
  const doubleTapGesture = Gesture.Tap()
    .enabled(!isFlipped && !isTransitioning)
    .numberOfTaps(2)
    .maxDelay(250)
    .onEnd((_event, success) => {
      if (success) {
        runOnJS(onSuperLike)();
      }
    });

  const panGesture = Gesture.Pan()
    .enabled(!isFlipped && !isTransitioning)
    .activeOffsetX([-20, 20])
    .failOffsetY([-20, 20])
    .onBegin(() => {
      'worklet';
      panStartX.value = translateX.value;
      panStartY.value = translateY.value;
      nextCardBlur.value = withTiming(30, { duration: 180 });
    })
    .onUpdate((event) => {
      'worklet';
      translateX.value = panStartX.value + event.translationX;
      translateY.value = panStartY.value + event.translationY * 0.2;
      rotate.value = translateX.value / 12;
    })
    .onEnd((event) => {
      'worklet';
      const velocityX = event.velocityX;
      const shouldDismiss = Math.abs(translateX.value) > 90 || Math.abs(velocityX) > 800; // SWIPE_THRESHOLD = 90
      if (shouldDismiss) {
        runOnJS(setIsTransitioning)(true);
        const direction = translateX.value !== 0 ? Math.sign(translateX.value) : Math.sign(velocityX || 1);
        const toX = (SCREEN_WIDTH + 120) * direction;

        const swipeDirection = direction > 0 ? 'right' : 'left';
        runOnJS(onSwipe)(swipeDirection);

        translateX.value = withTiming(toX, { duration: 220 }, (finished) => {
          if (finished) {
            runOnJS(updateProfileIndex)();
          }
        });
        translateY.value = withTiming(translateY.value + 20, { duration: 220 });
        opacity.value = withTiming(0, { duration: 200 });
      } else {
        nextCardBlur.value = withTiming(0, { duration: 150 });
        resetCardPosition();
      }
    })
    .onFinalize((_, success) => {
      'worklet';
      if (!success) {
        nextCardBlur.value = withTiming(0, { duration: 150 });
        resetCardPosition();
      }
    });

  const photoTapGesture = Gesture.Tap()
    .enabled(!isFlipped && !isTransitioning)
    .numberOfTaps(1)
    .maxDuration(250)
    .onEnd((_event, success) => {
      if (success) {
        runOnJS(onPhotoTap)();
      }
    });

  const tapGesture = Gesture.Exclusive(doubleTapGesture, photoTapGesture);
  const composedGesture = Gesture.Race(panGesture, tapGesture);

  // Animated styles
  const swipeAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate.value}deg` },
      ] as any,
      opacity: opacity.value,
    };
  });

  const likeOpacity = useDerivedValue(() => {
    return interpolate(translateX.value, [0, SCREEN_WIDTH / 4], [0, 1], 'clamp');
  });

  const dislikeOpacity = useDerivedValue(() => {
    return interpolate(translateX.value, [0, -SCREEN_WIDTH / 4], [0, 1], 'clamp');
  });

  const superLikeOpacity = useDerivedValue(() => {
    return interpolate(translateY.value, [0, -SCREEN_WIDTH / 4], [0, 1], 'clamp');
  });

  const likeOverlayStyle = useAnimatedStyle(() => ({ opacity: likeOpacity.value }));
  const dislikeOverlayStyle = useAnimatedStyle(() => ({ opacity: dislikeOpacity.value }));
  const superLikeOverlayStyle = useAnimatedStyle(() => ({ opacity: superLikeOpacity.value }));

  const likeButtonScale = useAnimatedStyle(() => {
    return {
      transform: [{ scale: interpolate(translateX.value, [0, SCREEN_WIDTH / 4], [1, 1.2], 'clamp') }],
    };
  });

  const dislikeButtonScale = useAnimatedStyle(() => {
    return {
      transform: [{ scale: interpolate(translateX.value, [0, -SCREEN_WIDTH / 4], [1, 1.2], 'clamp') }],
    };
  });

  const superLikeButtonScale = useAnimatedStyle(() => {
    return {
      transform: [{ scale: interpolate(translateY.value, [0, -SCREEN_WIDTH / 4], [1, 1.2], 'clamp') }],
    };
  });

  const likeButtonColorStyle = useAnimatedStyle(() => {
    const inputValue = translateX.value;
    const thresh = 20;
    const backgroundColor = interpolateColor(inputValue, [0, thresh], ['rgba(255, 255, 255, 0.1)', '#22C55E']);
    const borderColor = interpolateColor(inputValue, [0, thresh], ['rgba(255, 255, 255, 0.25)', '#22C55E']);
    const shadowColor = interpolateColor(inputValue, [0, thresh], ['#000000', '#22C55E']);
    const shadowOpacity = interpolate(inputValue, [0, thresh], [0.2, 0.8]);
    const shadowRadius = interpolate(inputValue, [0, thresh], [6, 15]);
    const elevation = interpolate(inputValue, [0, thresh], [8, 10]);

    return { backgroundColor, borderColor, shadowColor, shadowOpacity, shadowRadius, elevation };
  });

  const dislikeButtonColorStyle = useAnimatedStyle(() => {
    const inputValue = translateX.value;
    const thresh = -20;
    const backgroundColor = interpolateColor(inputValue, [0, thresh], ['rgba(255, 255, 255, 0.1)', '#FF3B30']);
    const borderColor = interpolateColor(inputValue, [0, thresh], ['rgba(255, 255, 255, 0.25)', '#FF3B30']);
    const shadowColor = interpolateColor(inputValue, [0, thresh], ['#000000', '#FF3B30']);
    const shadowOpacity = interpolate(inputValue, [0, thresh], [0.2, 0.8]);
    const shadowRadius = interpolate(inputValue, [0, thresh], [6, 15]);
    const elevation = interpolate(inputValue, [0, thresh], [8, 10]);

    return { backgroundColor, borderColor, shadowColor, shadowOpacity, shadowRadius, elevation };
  });

  const superLikeButtonColorStyle = useAnimatedStyle(() => {
    const inputValue = translateY.value;
    const thresh = -20;
    const backgroundColor = interpolateColor(inputValue, [0, thresh], ['rgba(255, 255, 255, 0.1)', '#A855F7']);
    const borderColor = interpolateColor(inputValue, [0, thresh], ['rgba(255, 255, 255, 0.25)', '#A855F7']);
    const shadowColor = interpolateColor(inputValue, [0, thresh], ['#000000', '#A855F7']);
    const shadowOpacity = interpolate(inputValue, [0, thresh], [0.2, 0.8]);
    const shadowRadius = interpolate(inputValue, [0, thresh], [6, 15]);
    const elevation = interpolate(inputValue, [0, thresh], [8, 10]);

    return { backgroundColor, borderColor, shadowColor, shadowOpacity, shadowRadius, elevation };
  });

  const likeIconStyle = useAnimatedStyle(() => {
    const opacityVal = interpolate(translateX.value, [0, 20], [0.8, 1], 'clamp');
    return { color: '#FFFFFF', opacity: opacityVal };
  });

  const dislikeIconStyle = useAnimatedStyle(() => {
    const opacityVal = interpolate(translateX.value, [0, -20], [0.8, 1], 'clamp');
    return { color: '#FFFFFF', opacity: opacityVal };
  });

  const superLikeIconStyle = useAnimatedStyle(() => {
    const opacityVal = interpolate(translateY.value, [0, -20], [0.8, 1], 'clamp');
    return { color: '#FFFFFF', opacity: opacityVal };
  });

  const nextCardStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: interpolate(Math.abs(translateX.value), [0, SCREEN_WIDTH], [0.95, 1], 'clamp') },
      ],
    };
  });

  const profileDetailsAnimatedStyle = useAnimatedStyle(() => {
    const opacityVal = interpolate(
      scrollY.value,
      [0, 50],
      [0, 1],
      'clamp'
    );
    return {
      opacity: opacityVal,
    };
  });

  const actionIconShadowStyle = useAnimatedStyle(() => {
    const shadowOpacity = interpolate(
      scrollY.value,
      [0, 50],
      [0, 0.4],
      'clamp'
    );
    const shadowRadius = interpolate(
      scrollY.value,
      [0, 50],
      [0, 8],
      'clamp'
    );
    const elevation = interpolate(
      scrollY.value,
      [0, 50],
      [0, 6],
      'clamp'
    );
    return {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity,
      shadowRadius,
      elevation,
    };
  });

  const nextCardBlurAnimatedProps = useAnimatedProps(() => ({
    intensity: nextCardBlur.value,
    tint: 'dark' as const,
  }));

  const frontAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotateY: `${rotateY.value}deg` }],
      opacity: interpolate(rotateY.value, [0, 90, 180], [1, 0, 0]),
    };
  });

  const backAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotateY: `${rotateY.value - 180}deg` }],
      opacity: interpolate(rotateY.value, [0, 90, 180], [0, 0, 1]),
    };
  });

  const handleScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      const currentScrollY = event.contentOffset.y;
      const scrollDiff = currentScrollY - lastScrollY.value;

      scrollY.value = currentScrollY;

      if (Math.abs(scrollDiff) > 1) {
        if (scrollDiff > 0 && currentScrollY > 10) {
          if (!isTabBarHiddenShared.value) {
            runOnJS(updateTabBarVisibility)(true);
          }
        }
        else if (scrollDiff < 0) {
          if (isTabBarHiddenShared.value) {
            runOnJS(updateTabBarVisibility)(false);
          }
        }
        else if (currentScrollY <= 10) {
          if (isTabBarHiddenShared.value) {
            runOnJS(updateTabBarVisibility)(false);
          }
        }
      }

      lastScrollY.value = currentScrollY;
    },
  });

  return {
    composedGesture,
    swipeAnimatedStyle,
    likeOverlayStyle,
    dislikeOverlayStyle,
    superLikeOverlayStyle,
    likeButtonScale,
    dislikeButtonScale,
    superLikeButtonScale,
    likeButtonColorStyle,
    dislikeButtonColorStyle,
    superLikeButtonColorStyle,
    likeIconStyle,
    dislikeIconStyle,
    superLikeIconStyle,
    nextCardStyle,
    profileDetailsAnimatedStyle,
    actionIconShadowStyle,
    nextCardBlurAnimatedProps,
    frontAnimatedStyle,
    backAnimatedStyle,
    handleScroll,
  };
}
