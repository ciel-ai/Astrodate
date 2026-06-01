import { LinearGradient } from 'expo-linear-gradient';
import type { PropsWithChildren, ReactElement } from 'react';
import { useMemo } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';
import Animated, {
    interpolate,
    useAnimatedRef,
    useAnimatedStyle,
    useScrollOffset,
    withTiming,
    type AnimatedRef,
} from 'react-native-reanimated';

import AppHeader from '@/components/app-header';
import { useColorScheme } from '@/hooks/use-color-scheme';

const HEADER_HEIGHT = 250;

type Props = PropsWithChildren<{
  headerImage?: ReactElement;
  headerBackgroundColor: { dark: string; light: string };
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  animatedScrollHandler?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollRef?: AnimatedRef<Animated.ScrollView>;
  hideHeaderOnScroll?: boolean;
  showAppHeader?: boolean;
}>;

export default function ParallaxScrollView({
  children,
  headerImage,
  headerBackgroundColor,
  onScroll,
  animatedScrollHandler,
  scrollRef: externalScrollRef,
  hideHeaderOnScroll = false,
  showAppHeader = true,
}: Props) {
  const colorScheme = useColorScheme() ?? 'light';
  const internalScrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollRef = externalScrollRef ?? internalScrollRef;
  const scrollOffset = useScrollOffset(scrollRef);
  const headerAnimatedStyle = useAnimatedStyle<ViewStyle>(() => {
    const transform: NonNullable<ViewStyle['transform']> = [
      {
        translateY: interpolate(
          scrollOffset.value,
          [-HEADER_HEIGHT, 0, HEADER_HEIGHT],
          [-HEADER_HEIGHT / 2, 0, HEADER_HEIGHT * 0.75]
        ),
      },
      {
        scale: interpolate(scrollOffset.value, [-HEADER_HEIGHT, 0, HEADER_HEIGHT], [2, 1, 1]),
      },
    ];

    return {
      transform,
    };
  });

  const stars = useMemo(() => {
    return Array.from({ length: 100 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 0.5,
      opacity: Math.random() * 0.8 + 0.2,
    }));
  }, []);

  const headerVisibilityStyle = useAnimatedStyle(
    () => {
      if (!hideHeaderOnScroll) {
        return {
          opacity: 1,
          transform: [{ translateY: 0 }],
        };
      }

      const isAtTop = scrollOffset.value <= 5;

      return {
        opacity: withTiming(isAtTop ? 1 : 0, { duration: 180 }),
        transform: [
          {
            translateY: withTiming(isAtTop ? 0 : -60, { duration: 180 }),
          },
        ],
      };
    },
    [hideHeaderOnScroll]
  );

  return (
    <LinearGradient
      colors={['#1a0d2e', '#2d1b4e', '#4a2c5a']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.container}>
      <View style={styles.starsContainer}>
        {stars.map((star) => (
          <View
            key={star.id}
            style={[
              styles.star,
              {
                left: `${star.x}%`,
                top: `${star.y}%`,
                width: star.size,
                height: star.size,
                opacity: star.opacity,
              },
            ]}
          />
        ))}
      </View>
      {showAppHeader ? (
        <Animated.View style={[styles.headerContainer, headerVisibilityStyle]}>
          <AppHeader />
        </Animated.View>
      ) : null}
      <Animated.ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: showAppHeader ? 90 : 0 },
        ]}
        scrollEventThrottle={16}
        bounces={false}
        bouncesZoom={false}
        decelerationRate="fast"
        onScroll={animatedScrollHandler || onScroll}>
        {headerImage && (
          <Animated.View
            style={[
              styles.header,
              { backgroundColor: headerBackgroundColor[colorScheme] },
              headerAnimatedStyle as any,
            ]}>
            {headerImage}
          </Animated.View>
        )}
        <View style={styles.content}>{children}</View>
      </Animated.ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  starsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  star: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 50,
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  scrollView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingTop: 90,
  },
  header: {
    height: HEADER_HEIGHT,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    padding: 32,
    gap: 16,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
});
