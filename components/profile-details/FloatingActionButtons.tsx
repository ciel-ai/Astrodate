import FontAwesome from '@expo/vector-icons/FontAwesome';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import React from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const { height: STATIC_HEIGHT } = Dimensions.get('window');
const BTN = STATIC_HEIGHT < 750 ? 60 : 66;

interface FloatingActionButtonsProps {
  onPass: () => void;
  onSuperLike: () => void;
  onLike: () => void;
  superLikeCount?: number | null;
}

export default function FloatingActionButtons({
  onPass,
  onSuperLike,
  onLike,
  superLikeCount,
}: FloatingActionButtonsProps) {
  const showBadge =
    superLikeCount !== null &&
    superLikeCount !== undefined &&
    superLikeCount <= 2 &&
    superLikeCount < 999;

  return (
    <View style={styles.container}>
      {/* Dislike / Pass */}
      <TouchableOpacity
        onPress={onPass}
        activeOpacity={0.7}
        style={styles.buttonWrapper}
        accessibilityLabel="Pass"
        accessibilityRole="button"
      >
        <View style={styles.button}>
          <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
          <FontAwesome name="close" size={28} color="#FFFFFF" />
        </View>
      </TouchableOpacity>

      {/* Super Like */}
      <TouchableOpacity
        onPress={onSuperLike}
        activeOpacity={0.7}
        style={styles.buttonWrapper}
        accessibilityLabel="Super Like"
        accessibilityRole="button"
      >
        <View style={styles.button}>
          <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
          <Image
            source={require('../../assets/images/zodiac-superlike.png')}
            style={styles.superLikeImage}
            contentFit="contain"
          />
        </View>
        {showBadge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{superLikeCount}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Like */}
      <TouchableOpacity
        onPress={onLike}
        activeOpacity={0.7}
        style={styles.buttonWrapper}
        accessibilityLabel="Like"
        accessibilityRole="button"
      >
        <View style={styles.button}>
          <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
          <MaterialIcons name="favorite" size={28} color="#EC4899" />
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: STATIC_HEIGHT < 750 ? 20 : 28,
    zIndex: 100,
  },
  buttonWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    width: BTN,
    height: BTN,
    borderRadius: BTN / 2,
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
  superLikeImage: {
    width: BTN - 6,
    height: BTN - 6,
  },
  badge: {
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
  badgeText: {
    color: '#1D0F38',
    fontSize: 9.5,
    fontWeight: '800',
  },
});
