/**
 * FeedEmptyState
 * Shown when profiles.length === 0 and not loading.
 * Compact, device-responsive layout. Pure RN Animated — no Lottie.
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface Props {
  onExpandFilters: () => void;
}

const { height: SCREEN_H } = Dimensions.get('window');

// Scale illustration down on small screens (< 700 logical px tall)
const SMALL = SCREEN_H < 700;
const PLANET_SIZE  = SMALL ? 64  : 80;
const ORBIT_1      = SMALL ? 56  : 70;
const ORBIT_2      = SMALL ? 78  : 96;
const ORBIT_3      = SMALL ? 100 : 122;
const SCENE_SIZE   = SMALL ? 220 : 260;
const ILLUSTRATION_MB = SMALL ? 12 : 20;

// ─── Twinkling star ──────────────────────────────────────────────────────────

function Star({ x, y, size, delay }: { x: number; y: number; size: number; delay: number }) {
  const opacity = useRef(new Animated.Value(0.2)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800 + delay * 3, delay, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.2, duration: 800 + delay * 3, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, delay]);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: `${x}%` as any,
        top: `${y}%` as any,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#FFFFFF',
        opacity,
      }}
    />
  );
}

// ─── Orbiting dot ────────────────────────────────────────────────────────────

function OrbitRing({ radius, duration, color, dotSize, delay }: {
  radius: number; duration: number; color: string; dotSize: number; delay: number;
}) {
  const angle = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(angle, { toValue: 1, duration, delay, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [angle, duration, delay]);

  const dotX = angle.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [radius, 0, -radius, 0, radius] });
  const dotY = angle.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, radius, 0, -radius, 0] });
  const size = radius * 2;

  return (
    <View style={{ position: 'absolute', width: size, height: size, borderRadius: radius, borderWidth: 1, borderColor: `${color}30`, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ position: 'absolute', width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: color, transform: [{ translateX: dotX }, { translateY: dotY }] }} />
    </View>
  );
}

// Sparse but deterministic star positions
const STARS = [
  { x: 8,  y: 10, size: 2,   delay: 0    },
  { x: 78, y: 7,  size: 1.5, delay: 300  },
  { x: 90, y: 30, size: 2,   delay: 600  },
  { x: 5,  y: 65, size: 1.5, delay: 450  },
  { x: 88, y: 70, size: 2,   delay: 900  },
  { x: 45, y: 4,  size: 2.5, delay: 150  },
  { x: 20, y: 85, size: 1.5, delay: 750  },
];

// ─── Main component ──────────────────────────────────────────────────────────

export default function FeedEmptyState({ onExpandFilters }: Props) {
  const fadeIn     = useRef(new Animated.Value(0)).current;
  const floatY     = useRef(new Animated.Value(0)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();

    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, { toValue: -8, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(floatY, { toValue: 8,  duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    floatLoop.start();

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseScale, { toValue: 1.12, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulseScale, { toValue: 1,    duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    pulseLoop.start();

    return () => { floatLoop.stop(); pulseLoop.stop(); };
  }, [fadeIn, floatY, pulseScale]);

  return (
    <Animated.View style={[styles.root, { opacity: fadeIn }]}>
      {/* Sparse starfield */}
      {STARS.map((s, i) => <Star key={i} {...s} />)}

      {/* Compact illustration */}
      <View style={[styles.scene, { width: SCENE_SIZE, height: SCENE_SIZE, marginBottom: ILLUSTRATION_MB }]}>
        {/* Pulsing glow */}
        <Animated.View style={[styles.glowRing, {
          width: PLANET_SIZE + 40,
          height: PLANET_SIZE + 40,
          borderRadius: (PLANET_SIZE + 40) / 2,
          transform: [{ scale: pulseScale }],
        }]} />

        {/* Orbit rings */}
        <OrbitRing radius={ORBIT_1} duration={5500}  color="#A855F7" dotSize={5} delay={0}    />
        <OrbitRing radius={ORBIT_2} duration={9000}  color="#EC4899" dotSize={4} delay={1000} />
        <OrbitRing radius={ORBIT_3} duration={14000} color="#38BDF8" dotSize={3} delay={500}  />

        {/* Planet */}
        <Animated.View style={[styles.planetWrapper, { transform: [{ translateY: floatY }] }]}>
          <View style={[styles.planet, { width: PLANET_SIZE, height: PLANET_SIZE, borderRadius: PLANET_SIZE / 2 }]}>
            <View style={styles.planetHighlight} />
            <View style={styles.planetBand} />
            <Text style={[styles.planetEmoji, { fontSize: SMALL ? 20 : 24 }]}>✦</Text>
          </View>
          {/* Saturn ring */}
          <View style={[styles.saturnRingWrapper, { width: PLANET_SIZE + 50, height: 24 }]}>
            <View style={[styles.saturnRing, { width: PLANET_SIZE + 50 }]} />
          </View>
        </Animated.View>
      </View>

      {/* Copy */}
      <View style={styles.copyBlock}>
        <Text style={styles.headline}>Your cosmos is quiet</Text>
        <Text style={styles.subtext}>
          No profiles matched your filters.{'\n'}Widen your search to discover more souls.
        </Text>
      </View>

      {/* Primary CTA — full-width on small screens */}
      <TouchableOpacity style={styles.ctaButton} onPress={onExpandFilters} activeOpacity={0.82}>
        <Text style={styles.ctaIcon}>⚙</Text>
        <Text style={styles.ctaText}>Expand My Filters</Text>
      </TouchableOpacity>

      {/* Secondary nudge — inline, no box */}
      <View style={styles.nudgeRow}>
        <Text style={styles.nudgeIcon}>🌙</Text>
        <Text style={styles.nudgeText}>New matches arrive daily — check back tomorrow</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
  },

  // ── Illustration ──
  scene: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute',
    backgroundColor: 'rgba(168, 85, 247, 0.16)',
  },
  planetWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  planet: {
    backgroundColor: '#5B21B6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 22,
    elevation: 16,
    overflow: 'hidden',
  },
  planetHighlight: {
    position: 'absolute',
    top: 10,
    left: 12,
    width: 22,
    height: 16,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.15)',
    transform: [{ rotate: '-25deg' }],
  },
  planetBand: {
    position: 'absolute',
    top: '45%',
    left: 0,
    right: 0,
    height: 8,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  planetEmoji: {
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  saturnRingWrapper: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saturnRing: {
    height: 16,
    borderRadius: 50,
    borderWidth: 2.5,
    borderColor: 'rgba(168, 85, 247, 0.5)',
    backgroundColor: 'transparent',
    transform: [{ rotateX: '72deg' }],
  },

  // ── Copy ──
  copyBlock: {
    alignItems: 'center',
    marginBottom: 28,
    gap: 8,
  },
  headline: {
    fontSize: SMALL ? 20 : 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  subtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 20,
  },

  // ── CTA ──
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#A855F7',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    marginBottom: 16,
    alignSelf: 'stretch',           // full-width so it's easy to tap
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 9,
  },
  ctaIcon: {
    fontSize: 15,
    color: '#FFFFFF',
  },
  ctaText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },

  // ── Nudge (inline, no box) ──
  nudgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nudgeIcon: {
    fontSize: 14,
  },
  nudgeText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    flex: 1,
    lineHeight: 17,
  },
});
