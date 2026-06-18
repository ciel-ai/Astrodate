import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { profileStyles as styles } from './profileStyles';
import type { ProfileData } from '../../hooks/useProfileData';

// Star positions computed once at module level
const STAR_DATA = Array.from({ length: 100 }).map((_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 2 + 0.5,
  opacity: Math.random() * 0.8 + 0.2,
}));

const InfoItem = ({ icon, label, value, fullWidth = false }: { icon: any, label: string, value: string, fullWidth?: boolean }) => (
  <View style={[styles.infoItem, fullWidth && styles.infoItemFull]}>
    <Ionicons name={icon} size={18} color="rgba(255, 255, 255, 0.6)" />
    <View style={styles.infoTextContainer}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

export function ProfileHeader({ data }: { data: ProfileData }) {
  const router = useRouter();

  const {
    editedProfile,
    primaryPhotoUri,
    loading,
    profileCompletion,
    setShowEditModal,
    membership,
    membershipLoading,
    showAgeSetting,
    vedicSign,
  } = data;

  const glowScale = useSharedValue(1);

  useEffect(() => {
    glowScale.value = withRepeat(
      withTiming(1.1, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const animatedGlowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: glowScale.value }],
  }));

  return (
    <>
      {/* Stars Background */}
      <View style={styles.starsContainer}>
        {STAR_DATA.map((star) => (
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

      {/* Header - matching reference image */}
      <View style={styles.header}>
        <View style={styles.headerButton} />
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={() => router.push('/settings')}
            activeOpacity={0.7}
          >
            <MaterialIcons name="settings" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Profile Completion CTA */}
      {profileCompletion < 100 && (
        <TouchableOpacity onPress={() => setShowEditModal(true)} activeOpacity={0.8} style={styles.completionContainer}>
          <LinearGradient colors={['rgba(168, 85, 247, 0.15)', 'rgba(236, 72, 153, 0.15)']} style={styles.completionGradient}>
            <View style={styles.completionHeaderRow}>
              <Ionicons name="sparkles" size={18} color="#F4D35E" />
              <Text style={styles.completionTitle}>Your profile is {profileCompletion}% complete</Text>
            </View>
            <View style={styles.completionTrack}>
              <Animated.View style={[styles.completionFill, { width: `${profileCompletion}%` }]} />
            </View>
            <Text style={styles.completionSubtitle}>Complete it to get more meaningful matches!</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Awesome Profile UI */}
      <View style={styles.profileHeaderSection}>
        {/* Glowing Profile Photo */}
        <View style={styles.photoWrapper}>
          <TouchableOpacity
            style={styles.profilePhotoContainer}
            onPress={() => setShowEditModal(true)}
            activeOpacity={0.8}
          >
            {loading ? (
              <View style={styles.profilePhotoPlaceholder}>
                <ActivityIndicator size="large" color="#7C3AED" />
              </View>
            ) : primaryPhotoUri || editedProfile.images[0] ? (
              <Image
                source={primaryPhotoUri ? { uri: primaryPhotoUri } : editedProfile.images[0]}
                style={styles.profilePhotoLarge}
                contentFit="cover"
                transition={500}
              />
            ) : (
              <View style={styles.profilePhotoPlaceholder}>
                <Ionicons name="person" size={48} color="rgba(255, 255, 255, 0.65)" />
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.editPhotoButtonLarge}
            onPress={() => setShowEditModal(true)}
            activeOpacity={0.9}
          >
            <MaterialIcons name="edit" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Name + Age + Membership */}
        <View style={styles.nameContentRow}>
          <Text style={styles.profileNameLarge}>
            {editedProfile.name || 'Your Profile'}
            {editedProfile.age && showAgeSetting ? `, ${editedProfile.age}` : ''}
          </Text>
          {membership?.is_active && (() => {
            const planSlug = String(membership?.plan_slug || '').toLowerCase();
            let tickColor = '#94A3B8'; // default grey for free
            if (planSlug === 'astro_x') {
              tickColor = '#60A5FA'; // blue for AstroX
            } else if (planSlug === 'astro_plus') {
              tickColor = '#A855F7'; // purple for Astro+
            }

            return (
              <View style={styles.membershipTickContainer}>
                <MaterialIcons name="verified" size={24} color={tickColor} />
                {membershipLoading && (
                  <ActivityIndicator size="small" color={tickColor} style={styles.membershipLoadingSpinner} />
                )}
              </View>
            );
          })()}
        </View>

        {/* Location Badge */}
        {editedProfile.location ? (
          <View style={styles.locationBadge}>
            <Ionicons name="location" size={16} color="#A855F7" />
            <Text style={styles.profileLocationText}>{editedProfile.location}</Text>
          </View>
        ) : null}

        {/* About Me Card */}
        {editedProfile.bio ? (
          <BlurView intensity={20} tint="dark" style={styles.awesomeCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="person" size={20} color="#F4D35E" />
              <Text style={styles.cardTitle}>About Me</Text>
            </View>
            <Text style={styles.bioText}>{editedProfile.bio}</Text>
          </BlurView>
        ) : null}

        {/* Astrological Info */}
        {editedProfile.sunSign || vedicSign ? (
          <BlurView intensity={20} tint="dark" style={styles.awesomeCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="star" size={20} color="#A855F7" />
              <Text style={styles.cardTitle}>Astrology</Text>
            </View>
            <View style={styles.astroGrid}>
              {editedProfile.sunSign ? (
                <View style={styles.astroItem}>
                  <Text style={styles.astroLabel}>Western</Text>
                  <Text style={styles.astroValue}>{editedProfile.sunSign}</Text>
                </View>
              ) : null}
              {vedicSign ? (
                <View style={styles.astroItem}>
                  <Text style={styles.astroLabel}>Vedic</Text>
                  <Text style={styles.astroValue}>{vedicSign}</Text>
                </View>
              ) : null}
            </View>
          </BlurView>
        ) : null}

        {/* Cosmic Insights Button */}
        <TouchableOpacity onPress={() => router.push('/cosmic-insights' as any)} activeOpacity={0.8}>
          <BlurView intensity={20} tint="dark" style={styles.cosmicInsightsBtn}>
            <LinearGradient
              colors={['rgba(139,92,246,0.25)', 'rgba(168,85,247,0.15)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.cosmicInsightsBtnInner}
            >
              <Text style={styles.cosmicInsightsBtnText}>✨  My Cosmic Insights</Text>
              <Ionicons name="chevron-forward" size={18} color="#C4B5FD" />
            </LinearGradient>
          </BlurView>
        </TouchableOpacity>

        {/* Prompts System Button */}
        <TouchableOpacity onPress={() => router.push('/profile-details/edit-prompts' as any)} activeOpacity={0.8}>
          <BlurView intensity={20} tint="dark" style={styles.cosmicInsightsBtn}>
            <LinearGradient
              colors={['rgba(236,72,153,0.25)', 'rgba(168,85,247,0.15)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.cosmicInsightsBtnInner}
            >
              <Text style={styles.cosmicInsightsBtnText}>✍️  Edit My Profile Prompts</Text>
              <Ionicons name="chevron-forward" size={18} color="#F5D0FE" />
            </LinearGradient>
          </BlurView>
        </TouchableOpacity>

        {/* Basic Info */}
        <BlurView intensity={20} tint="dark" style={styles.awesomeCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="information-circle" size={22} color="#EC4899" />
            <Text style={styles.cardTitle}>Basic Info</Text>
          </View>
          <View style={styles.infoGrid}>
            {editedProfile.height ? <InfoItem icon="body-outline" label="Height" value={editedProfile.height} /> : null}
            {editedProfile.education ? <InfoItem icon="school-outline" label="Education" value={editedProfile.education} /> : null}
            {editedProfile.drinking ? <InfoItem icon="wine-outline" label="Drinking" value={editedProfile.drinking} /> : null}
            {editedProfile.smoking ? <InfoItem icon="flame-outline" label="Smoking" value={editedProfile.smoking} /> : null}
          </View>
        </BlurView>

        {/* Looking For, Interests & Languages */}
        {((editedProfile.lookingFor && editedProfile.lookingFor.length > 0) || (editedProfile.interests && editedProfile.interests.length > 0) || (editedProfile.languages && editedProfile.languages.length > 0)) ? (
          <BlurView intensity={20} tint="dark" style={styles.awesomeCard}>
            {editedProfile.lookingFor && editedProfile.lookingFor.length > 0 ? (
              <View style={styles.traitsSection}>
                <View style={styles.cardHeader}>
                  <Ionicons name="search" size={20} color="#A78BFA" />
                  <Text style={styles.cardTitle}>Looking For</Text>
                </View>
                <View style={styles.traitChips}>
                  {editedProfile.lookingFor.map((item, i) => (
                    <View key={`looking-${i}`} style={[styles.traitChip, { backgroundColor: 'rgba(167, 139, 250, 0.16)', borderColor: 'rgba(167, 139, 250, 0.35)' }]}>
                      <Text style={[styles.traitChipText, { color: '#DDD6FE' }]}>{item}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {editedProfile.interests && editedProfile.interests.length > 0 ? (
              <View style={[styles.traitsSection, editedProfile.lookingFor && editedProfile.lookingFor.length > 0 ? { marginTop: 24 } : {}]}>
                <View style={styles.cardHeader}>
                  <Ionicons name="heart" size={20} color="#F87171" />
                  <Text style={styles.cardTitle}>Interests</Text>
                </View>
                <View style={styles.traitChips}>
                  {editedProfile.interests.map((interest, i) => (
                    <View key={`int-${i}`} style={styles.traitChip}>
                      <Text style={styles.traitChipText}>{interest}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {editedProfile.languages && editedProfile.languages.length > 0 ? (
              <View style={[styles.traitsSection, (editedProfile.lookingFor && editedProfile.lookingFor.length > 0) || (editedProfile.interests && editedProfile.interests.length > 0) ? { marginTop: 24 } : {}]}>
                <View style={styles.cardHeader}>
                  <Ionicons name="language" size={20} color="#3B82F6" />
                  <Text style={styles.cardTitle}>Languages</Text>
                </View>
                <View style={styles.traitChips}>
                  {editedProfile.languages.map((lang, i) => (
                    <View key={`lang-${i}`} style={[styles.traitChip, { backgroundColor: 'rgba(59, 130, 246, 0.15)', borderColor: 'rgba(59, 130, 246, 0.3)' }]}>
                      <Text style={[styles.traitChipText, { color: '#BFDBFE' }]}>{lang}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </BlurView>
        ) : null}
      </View>
    </>
  );
}
