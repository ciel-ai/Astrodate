/**
 * SwipeTutorialOverlay
 *
 * One-time tutorial shown on the first feed load.
 * AsyncStorage key: 'hasSeenSwipeTutorial'
 *
 * Shows four gesture hints in sequence:
 *   1. Swipe right  → Like
 *   2. Swipe left   → Pass
 *   3. Swipe up     → Super Like
 *   4. Tap          → Flip card
 *
 * Dismisses on tap or automatically after all hints complete.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const { width: SW, height: SH } = Dimensions.get('window');

const STORAGE_KEY = 'hasSeenSwipeTutorial';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Hint {
  label: string;
  sublabel: string;
  emoji: string;
  color: string;
  // where the hand travels to
  toX: number;
  toY: number;
}

const HINTS: Hint[] = [
  {
    label: 'Swipe right to like',
    sublabel: 'Send a cosmic spark ✨',
    emoji: '💜',
    color: '#A855F7',
    toX: 100,
    toY: 0,
  },
  {
    label: 'Swipe left to pass',
    sublabel: 'Not every star aligns',
    emoji: '👋',
    color: '#64748B',
    toX: -100,
    toY: 0,
  },
  {
    label: 'Tap to flip the card',
    sublabel: 'Discover their cosmic profile',
    emoji: '🔮',
    color: '#38BDF8',
    toX: 0,
    toY: 0,
  },
];

const HINT_DURATION = 2200; // ms per hint (animation + pause)

// ─── Hand cursor ─────────────────────────────────────────────────────────────

function HandCursor({
  toX,
  toY,
  isTap,
  color,
}: {
  toX: number;
  toY: number;
  isTap: boolean;
  color: string;
}) {
  const posX = useRef(new Animated.Value(0)).current;
  const posY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    posX.setValue(0);
    posY.setValue(0);
    scale.setValue(1);
    opacity.setValue(0);

    if (isTap) {
      // Tap animation: appear, press down, lift
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(scale, {
          toValue: 0.75,
          duration: 250,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 250,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(600),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    } else {
      // Swipe animation: appear at origin, travel to destination
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.parallel([
          Animated.timing(posX, {
            toValue: toX,
            duration: 600,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(posY, {
            toValue: toY,
            duration: 600,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(400),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [toX, toY, isTap, posX, posY, scale, opacity]);

  return (
    <Animated.View
      style={[
        styles.handContainer,
        {
          opacity,
          transform: [{ translateX: posX }, { translateY: posY }, { scale }],
        },
      ]}>
      {/* Ripple ring */}
      <View style={[styles.handRipple, { borderColor: color }]} />
      {/* Hand emoji */}
      <Text style={styles.handEmoji}>{isTap ? '👆' : '👋'}</Text>
    </Animated.View>
  );
}

// ─── Direction arrow ──────────────────────────────────────────────────────────

function Arrow({ toX, toY, color }: { toX: number; toY: number; color: string }) {
  if (toX === 0 && toY === 0) return null; // tap hint — no arrow

  let symbol = '→';
  if (toX > 0) symbol = '→';
  else if (toX < 0) symbol = '←';
  else if (toY < 0) symbol = '↑';

  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  const translateArrow = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, toX !== 0 ? (toX > 0 ? 8 : -8) : toY < 0 ? -8 : 8],
  });

  return (
    <Animated.Text
      style={[
        styles.arrow,
        { color, transform: [{ translateX: toX !== 0 ? translateArrow : 0 }, { translateY: toY !== 0 ? translateArrow : 0 }] },
      ]}>
      {symbol}
    </Animated.Text>
  );
}

// ─── Main overlay ─────────────────────────────────────────────────────────────

interface Props {
  onDismiss: () => void;
}

export default function SwipeTutorialOverlay({ onDismiss }: Props) {
  const [hintIndex, setHintIndex] = useState(0);
  const [handKey, setHandKey] = useState(0); // force re-mount hand on each hint

  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.88)).current;

  // Fade in
  useEffect(() => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 400,
        delay: 100,
        useNativeDriver: true,
      }),
      Animated.spring(cardScale, {
        toValue: 1,
        damping: 16,
        stiffness: 160,
        useNativeDriver: true,
      }),
    ]).start();
  }, [backdropOpacity, cardOpacity, cardScale]);

  // Cycle through hints automatically
  useEffect(() => {
    const timer = setTimeout(() => {
      if (hintIndex < HINTS.length - 1) {
        setHintIndex((i) => i + 1);
        setHandKey((k) => k + 1);
      } else {
        // All hints done — auto-dismiss after a beat
        setTimeout(handleDismiss, 800);
      }
    }, HINT_DURATION);
    return () => clearTimeout(timer);
  }, [hintIndex]);

  const handleDismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      AsyncStorage.setItem(STORAGE_KEY, 'true').catch(() => {});
      onDismiss();
    });
  }, [backdropOpacity, cardOpacity, onDismiss]);

  const hint = HINTS[hintIndex];

  return (
    <TouchableOpacity
      style={StyleSheet.absoluteFill}
      activeOpacity={1}
      onPress={handleDismiss}>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />

      {/* Central instruction card */}
      <Animated.View
        style={[
          styles.card,
          {
            opacity: cardOpacity,
            transform: [{ scale: cardScale }],
          },
        ]}>
        {/* Hint emoji badge */}
        <View style={[styles.emojiRing, { borderColor: `${hint.color}50` }]}>
          <Text style={styles.hintEmoji}>{hint.emoji}</Text>
        </View>

        {/* Label */}
        <Text style={[styles.hintLabel, { color: hint.color }]}>{hint.label}</Text>
        <Text style={styles.hintSublabel}>{hint.sublabel}</Text>

        {/* Hand gesture demonstration */}
        <View style={styles.gestureArea}>
          <HandCursor
            key={handKey}
            toX={hint.toX}
            toY={hint.toY}
            isTap={hint.toX === 0 && hint.toY === 0}
            color={hint.color}
          />
          <Arrow toX={hint.toX} toY={hint.toY} color={hint.color} />
        </View>

        {/* Progress dots */}
        <View style={styles.dotsRow}>
          {HINTS.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === hintIndex && { backgroundColor: hint.color, width: 20 },
              ]}
            />
          ))}
        </View>

        {/* Skip */}
        <TouchableOpacity onPress={handleDismiss} style={styles.skipButton}>
          <Text style={styles.skipText}>Got it  ✓</Text>
        </TouchableOpacity>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 4, 20, 0.78)',
  },
  card: {
    position: 'absolute',
    left: SW / 2 - 155,
    top: SH / 2 - 220,
    width: 310,
    backgroundColor: 'rgba(30, 15, 50, 0.96)',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
    paddingVertical: 32,
    paddingHorizontal: 28,
    alignItems: 'center',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
    elevation: 30,
  },

  // ── Emoji badge ──
  emojiRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(168, 85, 247, 0.08)',
    marginBottom: 16,
  },
  hintEmoji: {
    fontSize: 32,
  },

  // ── Labels ──
  hintLabel: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: 0.2,
    textAlign: 'center',
    marginBottom: 6,
  },
  hintSublabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },

  // ── Gesture area ──
  gestureArea: {
    width: 120,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  handContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  handRipple: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    opacity: 0.4,
  },
  handEmoji: {
    fontSize: 32,
  },
  arrow: {
    position: 'absolute',
    fontSize: 28,
    fontWeight: '700',
    right: -10,
    top: 22,
  },

  // ── Dots ──
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  // ── Skip ──
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  skipText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
