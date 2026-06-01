import React, { memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Dimensions } from 'react-native';

interface ProfileHeroProps {
  name: string;
  age?: number;
  location?: string;
  image: any;
  photos?: { uri: string }[];
  isSuperlikedByProfile?: boolean;
  currentImageIndex: number;
  onPhotoTap: () => void;
}

const ProfileHero = memo(function ProfileHero({
  name,
  age,
  image,
  photos,
  isSuperlikedByProfile = false,
  currentImageIndex,
  onPhotoTap,
}: ProfileHeroProps) {
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
      style={styles.imageContainer}
    >
      <Image
        source={currentPhoto}
        style={styles.profileImage}
        contentFit="cover"
        transition={500}
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.8)']}
        style={styles.imageNameOverlay}
      >
        <View style={styles.imageNameBlock}>
          <View style={styles.imageNameHeaderRow}>
            <Text style={styles.imageNameText}>
              {name} {age || ''}
            </Text>
            <TouchableOpacity
              style={styles.imageDownArrowIcon}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-down-circle" size={38} color="#FFFFFF" />
            </TouchableOpacity>
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

const IMAGE_HEIGHT = Dimensions.get('window').height * 0.55;

const styles = StyleSheet.create({
  imageContainer: {
    marginHorizontal: 0,
    borderRadius: 0,
    overflow: 'hidden',
    height: IMAGE_HEIGHT,
    backgroundColor: '#000000',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  imageNameOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 60,
  },
  imageNameBlock: {
    gap: 8,
  },
  imageNameHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  imageNameText: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  imageDownArrowIcon: {
    padding: 2,
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
