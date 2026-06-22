import React, { memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useWindowDimensions, Dimensions } from 'react-native';

interface ProfileHeroProps {
  name: string;
  age?: number;
  location?: string;
  image: any;
  photos?: { uri: string }[];
  isSuperlikedByProfile?: boolean;
  currentImageIndex: number;
  onPhotoTap: () => void;
  compatibility?: number; // New prop for Cosmic Match
}

const ProfileHero = memo(function ProfileHero({
  name,
  age,
  image,
  photos,
  isSuperlikedByProfile = false,
  currentImageIndex,
  onPhotoTap,
  compatibility = 87, // Mock default for now
}: ProfileHeroProps) {
  const { height: screenHeight } = useWindowDimensions();
  const IMAGE_HEIGHT = screenHeight * 0.55;

  const router = useRouter();

  const images =
    photos && photos.length > 0
      ? photos
      : image
      ? [image]
      : [require('@/assets/images/avatar-placeholder.png')];

  const currentPhoto = images[currentImageIndex] || images[0];

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPhotoTap}
      style={[styles.imageContainer, { height: IMAGE_HEIGHT }]}
    >
      <Image
        source={currentPhoto}
        style={styles.profileImage}
        contentFit="cover"
        transition={500}
      />
      


      {/* Cosmic Match Pill */}
      <View style={styles.matchPillContainer}>
        <LinearGradient
          colors={['rgba(168, 85, 247, 0.8)', 'rgba(216, 180, 254, 0.8)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.matchPill}
        >
          <Ionicons name="sparkles" size={14} color="#FFFFFF" />
          <Text style={styles.matchPillText}>{Math.round(compatibility ?? 0)}% Cosmic Match</Text>
        </LinearGradient>
      </View>

      <LinearGradient
        colors={['transparent', 'rgba(11, 4, 21, 0.6)', '#0B0415']}
        locations={[0, 0.6, 1]}
        style={styles.imageNameOverlay}
      >
        <View style={styles.imageNameBlock}>
          <View style={styles.imageNameHeaderRow}>
            <View style={styles.nameContainer}>
              <Text style={styles.imageNameText}>
                {name}{age ? `, ${age}` : ''}
              </Text>
              <Ionicons name="checkmark-circle" size={24} color="#A855F7" style={styles.verifiedIcon} />
            </View>
          </View>
          {isSuperlikedByProfile && (
            <View style={styles.superlikedBadge}>
              <MaterialIcons name="stars" size={14} color="#FFE08A" />
              <Text style={styles.superlikedBadgeText}>Superliked you</Text>
            </View>
          )}
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
});

export default ProfileHero;

const styles = StyleSheet.create({
  imageContainer: {
    marginHorizontal: 0,
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: '#0B0415',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },

  matchPillContainer: {
    position: 'absolute',
    bottom: 90,
    left: 20,
    zIndex: 10,
  },
  matchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  matchPillText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  imageNameOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 80,
  },
  imageNameBlock: {
    gap: 8,
  },
  imageNameHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  imageNameText: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  verifiedIcon: {
    marginTop: 6,
  },
  superlikedBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(168, 85, 247, 0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255, 224, 138, 0.45)',
  },
  superlikedBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
