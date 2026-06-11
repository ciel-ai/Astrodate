import FontAwesome from '@expo/vector-icons/FontAwesome';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { BlurView } from 'expo-blur';
import React from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';

const { height: STATIC_HEIGHT } = Dimensions.get('window');

const AnimatedFontAwesome = Animated.createAnimatedComponent(FontAwesome);
const AnimatedIonicons = Animated.createAnimatedComponent(Ionicons);
const AnimatedMaterialIcons = Animated.createAnimatedComponent(MaterialIcons);

interface CardActionBarProps {
  onLike: () => void;
  onDislike: () => void;
  onSuperLike: () => void;
  isTransitioning: boolean;
  superLikesRemaining: number | null;
  bottom: number;
  // Animated styles passed from main screen/gestures
  dislikeButtonScale: any;
  dislikeButtonColorStyle: any;
  dislikeIconStyle: any;
  superLikeButtonScale: any;
  superLikeButtonColorStyle: any;
  superLikeIconStyle: any;
  likeButtonScale: any;
  likeButtonColorStyle: any;
  likeIconStyle: any;
}

export function CardActionBar({
  onLike,
  onDislike,
  onSuperLike,
  isTransitioning,
  superLikesRemaining,
  bottom,
  dislikeButtonScale,
  dislikeButtonColorStyle,
  dislikeIconStyle,
  superLikeButtonScale,
  superLikeButtonColorStyle,
  superLikeIconStyle,
  likeButtonScale,
  likeButtonColorStyle,
  likeIconStyle,
}: CardActionBarProps) {
  return (
    <Animated.View style={[styles.actionIconsFixed, { bottom }]}>
      <View style={styles.actionIconsContainer}>
        {/* Dislike Button */}
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.actionButtonSmallWrapper}
          onPress={onDislike}
          disabled={isTransitioning}
        >
          <Animated.View style={[styles.actionIconGlassy, dislikeButtonScale, dislikeButtonColorStyle]}>
            <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
            <AnimatedFontAwesome name="close" size={28} style={dislikeIconStyle} />
          </Animated.View>
        </TouchableOpacity>

        {/* Super Like Button */}
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.actionButtonSmallWrapper}
          onPress={onSuperLike}
          disabled={isTransitioning}
        >
          <Animated.View style={[styles.actionIconGlassy, superLikeButtonScale, superLikeButtonColorStyle]}>
            <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
            <AnimatedIonicons name="star" size={28} style={superLikeIconStyle} />
          </Animated.View>
          {superLikesRemaining !== null && superLikesRemaining <= 2 && superLikesRemaining < 999 && (
            <View style={styles.superLikeCountBadge}>
              <Text style={styles.superLikeCountBadgeText}>{superLikesRemaining}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Like Button */}
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.actionButtonSmallWrapper}
          onPress={onLike}
          disabled={isTransitioning}
        >
          <Animated.View style={[styles.actionIconGlassy, likeButtonScale, likeButtonColorStyle]}>
            <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
            <AnimatedMaterialIcons name="favorite" size={28} style={likeIconStyle} />
          </Animated.View>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  actionIconsFixed: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 40,
    zIndex: 10,
  },
  actionIconsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: STATIC_HEIGHT < 750 ? 20 : 28,
  },
  actionButtonSmallWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionIconGlassy: {
    width: STATIC_HEIGHT < 750 ? 60 : 66,
    height: STATIC_HEIGHT < 750 ? 60 : 66,
    borderRadius: STATIC_HEIGHT < 750 ? 30 : 33,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 11, 46, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  superLikeCountBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#F59E0B',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#1D0F38',
  },
  superLikeCountBadgeText: {
    color: '#1D0F38',
    fontSize: 9.5,
    fontWeight: '800',
  },
});
