import { checkMutualLike, saveUserLike, withdrawUserLike } from '@/lib/user-likes';
import { cosmicActedIds } from '@/lib/cosmic-acted-ids';
import { getUserPhotos } from '@/lib/user-photos';
import { getZodiacCompatibility } from '@/lib/astro';
import { supabase } from '@/lib/supabase';
import { FontAwesome, FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ErrorBoundary } from '@/components/error-boundary';
import { useNavigation, useRouter } from 'expo-router';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { useProfileRouteParams } from '@/hooks/useProfileRouteParams';
import { useProfileDetails, clearProfileCache } from '@/hooks/useProfileDetails';
import { useSynastry } from '@/hooks/useSynastry';
import ProfileHero from '@/components/profile-details/ProfileHero';
import AstroBadges from '@/components/profile-details/AstroBadges';
import InterestsSection from '@/components/profile-details/InterestsSection';
import CompatibilitySummary from '@/components/profile-details/CompatibilitySummary';
import CosmicCompatibility from '@/components/profile-details/CosmicCompatibility';
import EssentialsGrid from '@/components/profile-details/EssentialsGrid';
import DeeperInsights from '@/components/profile-details/DeeperInsights';
import AstrologyInsights from '@/components/profile-details/AstrologyInsights';
import FloatingActionButtons from '@/components/profile-details/FloatingActionButtons';
import SynastryBreakdown from '@/components/profile-details/SynastryBreakdown';
import { getCompatibilitySubScores, getAstrologyInsights } from '@/lib/profile-mappers';
import { createReport } from '@/lib/reports';
import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { Profile } from '@/types/profile';

export default function ProfileDetailsScreen() {
  const { membership } = useSubscriptionStatus();
  // AstroX tier unlocks full synastry (Venus / Mars / Mercury planet bars).
  // Feature key must match plan_catalog.features JSON key exactly.
  const isPremiumUser =
    membership?.features?.full_synastry_report === true ||
    membership?.plan_slug === 'astro_x';
  const router = useRouter();
  const navigation = useNavigation();
  const params = useProfileRouteParams();

  const userId = params.userId || params.profileId || null;

  // ─── Parse optional initial data from route params ──────────────────────────
  const initialProfile = useMemo<Profile | null>(() => {
    if (!params.initialData) return null;
    try {
      return JSON.parse(params.initialData);
    } catch {
      return null;
    }
  }, [params.initialData]);

  // ─── Data hooks ─────────────────────────────────────────────────────────────
  const {
    profile: fetchedProfile,
    isSuperlikedByProfile,
    isLoading,
    error,
    refetch,
  } = useProfileDetails(userId);

  // Prefer fetched data; fall back to initial data while loading
  const profile = fetchedProfile ?? initialProfile;

  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [westernReport, setWesternReport] = useState<string | undefined>(undefined);
  const [zodiacScore, setZodiacScore] = useState<number | undefined>(undefined);
  const [superLikesRemaining, setSuperLikesRemaining] = useState<number | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data?.user?.id ?? null;
      if (isMountedRef.current) setCurrentUserId(uid);
      if (uid) {
        supabase.rpc('get_super_likes_remaining', { p_user_id: uid }).then(({ data: count, error }) => {
          if (!error && count !== null && isMountedRef.current) setSuperLikesRemaining(count as number);
        });
      }
    });
  }, []);

  // Fetch zodiac compatibility report when both signs are known
  useEffect(() => {
    if (!currentUserId || !profile?.western_sign) return;
    // Reset stale data for new profile
    setWesternReport(undefined);
    setZodiacScore(undefined);
    let cancelled = false;
    (async () => {
      try {
        const { data: myAstro } = await supabase
          .from('astro_details')
          .select('western_sign')
          .eq('user_id', currentUserId)
          .maybeSingle();
        if (cancelled) return;
        if (myAstro?.western_sign && profile.western_sign) {
          const result = await getZodiacCompatibility(
            myAstro.western_sign,
            profile.western_sign as string,
          );
          if (cancelled) return;
          if (result) {
            if (isMountedRef.current) {
              if (result.compatibility_report) setWesternReport(result.compatibility_report);
              if (result.compatibility_percentage != null) setZodiacScore(result.compatibility_percentage);
            }
          }
        }
      } catch { /* non-fatal */ }
    })();
    return () => { cancelled = true; };
  }, [currentUserId, profile?.western_sign]);

  const { synastryDetail, isLoading: synastryLoading } = useSynastry(
    currentUserId,
    profile?.id ? String(profile.id) : null,
  );

  // ─── Current user photo (for match modal) ───────────────────────────────────
  const [currentUserPhoto, setCurrentUserPhoto] = useState<any>(
    require('@/assets/images/avatar-placeholder.png'),
  );

  useEffect(() => {
    (async () => {
      try {
        const photosResult = await getUserPhotos();
        if (photosResult.success && photosResult.data) {
          const primary =
            photosResult.data.find((p: any) => p.is_primary) ||
            photosResult.data[0];
          if (primary?.photo_url) {
            if (isMountedRef.current) setCurrentUserPhoto({ uri: primary.photo_url });
          }
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  // ─── Clear cache on sign-out ─────────────────────────────────────────────────
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event) => {
      if (_event === 'SIGNED_OUT') {
        clearProfileCache();
      }
    });
    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // ─── UI state ────────────────────────────────────────────────────────────────
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isMovingForward, setIsMovingForward] = useState(true);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchedProfile, setMatchedProfile] = useState<Profile | null>(null);
  const [matchedUserId, setMatchedUserId] = useState<string | null>(null);

  // ─── Navigation header ───────────────────────────────────────────────────────
  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  // ─── Entry animation ─────────────────────────────────────────────────────────
  const detailsOpacity = useSharedValue(0);
  const detailsTranslateY = useSharedValue(50);

  const animatedDetailsStyle = useAnimatedStyle(() => ({
    opacity: detailsOpacity.value,
    transform: [{ translateY: detailsTranslateY.value }],
  }));

  useEffect(() => {
    if (profile && !isLoading) {
      detailsOpacity.value = withTiming(1, {
        duration: 600,
        easing: Easing.out(Easing.cubic),
      });
      detailsTranslateY.value = withTiming(0, {
        duration: 600,
        easing: Easing.out(Easing.cubic),
      });
    } else {
      detailsOpacity.value = 0;
      detailsTranslateY.value = 50;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, isLoading]);

  // ─── Stars background ────────────────────────────────────────────────────────
  const stars = useMemo(
    () =>
      Array.from({ length: 100 }).map((_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 2 + 0.5,
        opacity: Math.random() * 0.8 + 0.2,
      })),
    [],
  );

  // ─── Photo cycling ───────────────────────────────────────────────────────────
  const images =
    profile?.photos && profile.photos.length > 0
      ? profile.photos
      : profile?.image
      ? [profile.image]
      : [require('@/assets/images/avatar-placeholder.png')];
  const totalImages = images.length;

  const handlePhotoTap = () => {
    if (totalImages <= 1) return;
    setCurrentImageIndex((prev) => {
      if (isMovingForward) {
        if (prev === totalImages - 1) {
          setIsMovingForward(false);
          return prev - 1;
        }
        return prev + 1;
      } else {
        if (prev === 0) {
          setIsMovingForward(true);
          return prev + 1;
        }
        return prev - 1;
      }
    });
  };

  // ─── Action handlers ─────────────────────────────────────────────────────────
  const checkAndShowMatch = async (likedUserId: string): Promise<boolean> => {
    try {
      const result = await checkMutualLike(likedUserId);
      if (result.isMatch) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (isMountedRef.current) {
          setMatchedProfile(profile);
          setMatchedUserId(String(likedUserId));
          setShowMatchModal(true);
        }
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const handleSendMessageFromMatchModal = async () => {
    const chatUserId =
      matchedUserId || (matchedProfile?.id ? String(matchedProfile.id) : null);
    setShowMatchModal(false);
    setMatchedProfile(null);
    setMatchedUserId(null);
    if (!chatUserId) return;
    await checkMutualLike(chatUserId);
    router.push({ pathname: '/chat/[id]' as any, params: { id: chatUserId } });
  };

  const handleLike = async () => {
    if (!profile) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const result = await saveUserLike(String(profile.id), 'like');
      if (result.success) {
        if (params.source === 'cosmic') cosmicActedIds.add(String(profile.id));
        const matchFound = await checkAndShowMatch(String(profile.id));
        if (!matchFound) {
          setTimeout(() => router.back(), 300);
        }
      } else if (result.error === 'THE_USER_NO_LONGER_EXISTS') {
        console.warn(`⚠️ User ${profile.id} no longer exists.`);
      }
    } catch (err) {
      console.error('Error in handleLike:', err);
    }
  };

  const handleDislike = async () => {
    if (!profile) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const result = await saveUserLike(String(profile.id), 'dislike');
      if (result.success || result.error === 'THE_USER_NO_LONGER_EXISTS') {
        if (params.source === 'cosmic') cosmicActedIds.add(String(profile.id));
        setTimeout(() => router.back(), 300);
      }
    } catch (err) {
      console.error('Error in handleDislike:', err);
    }
  };

  const handleSuperLike = async () => {
    if (!profile) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (params.source === 'likes') {
      router.push({
        pathname: '/chat/[id]' as any,
        params: { id: profile.id },
      });
      return;
    }
    try {
      const result = await saveUserLike(String(profile.id), 'super_like');
      if (result.success) {
        if (params.source === 'cosmic') cosmicActedIds.add(String(profile.id));
        setSuperLikesRemaining(prev => (prev !== null ? Math.max(0, prev - 1) : null));
        await checkAndShowMatch(String(profile.id));
        if (!showMatchModal) {
          setTimeout(() => router.back(), 400);
        }
      } else if (result.error === 'THE_USER_NO_LONGER_EXISTS') {
        console.warn(`⚠️ User ${profile.id} no longer exists.`);
      }
    } catch (err) {
      console.error('Error in handleSuperLike:', err);
    }
  };

  const handleReportUser = () => {
    if (!profile) return;
    Alert.alert('Report Profile', 'Report this profile for inappropriate content?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Report',
        style: 'destructive',
        onPress: async () => {
          const result = await createReport(
            String(profile.id),
            'Something on their profile',
            'Inappropriate profile content',
            ''
          );
          Alert.alert(
            result.success ? 'Reported' : 'Error',
            result.success
              ? 'Thank you. Our team will review this profile.'
              : 'Failed to submit report. Please try again.'
          );
        },
      },
    ]);
  };

  // ─── Withdraw sent like ──────────────────────────────────────────────────────
  const handleWithdraw = async () => {
    if (!profile) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const result = await withdrawUserLike(String(profile.id));
      if (result.success) {
        setTimeout(() => router.back(), 300);
      }
    } catch (err) {
      console.error('Error withdrawing like:', err);
    }
  };

  // ─── Derived display data ────────────────────────────────────────────────────
  const LOOKING_FOR_EMOJIS: Record<string, string> = {
    casual: '🎉',
    'long-term': '💘',
    'long-open-short': '😍',
    'short-open-long': '🥂',
    friends: '👋',
    'not-sure': '🤔',
  };

  // ─── Loading state ───────────────────────────────────────────────────────────
  if (isLoading && !initialProfile) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.starryBackground} pointerEvents="none">
          {Array.from({ length: 50 }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.star,
                {
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  opacity: Math.random() * 0.5 + 0.3,
                },
              ]}
            />
          ))}
        </View>
        <ActivityIndicator size="large" color="#A855F7" style={{ zIndex: 1 }} />
      </View>
    );
  }

  // ─── Error state ─────────────────────────────────────────────────────────────
  if (!profile && !isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient
          colors={['#1a0d2e', '#2d1b4e', '#4a2c5a']}
          style={StyleSheet.absoluteFill}
        >
          <View style={styles.starryBackground} pointerEvents="none">
            {Array.from({ length: 50 }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.star,
                  {
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    opacity: Math.random() * 0.5 + 0.3,
                  },
                ]}
              />
            ))}
          </View>
          <Text style={styles.errorText}>{error || 'Failed to load profile'}</Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => refetch()}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </LinearGradient>
      </View>
    );
  }

  if (!profile) return null;

  // ─── Main render ─────────────────────────────────────────────────────────────
  return (
    <ErrorBoundary>
      <LinearGradient
        colors={['#0B0415', '#160B2A', '#1C0E35']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.gradientContainer}
      >
        {/* Starfield */}
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

        <View style={styles.contentWrapper}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={true}
          >
            {/* 1. Hero photo */}
            <View>
              <ProfileHero
                name={profile.name}
                age={profile.age}
                location={profile.location}
                image={profile.image}
                photos={profile.photos}
                isSuperlikedByProfile={isSuperlikedByProfile}
                currentImageIndex={currentImageIndex}
                onPhotoTap={handlePhotoTap}
                compatibility={getCompatibilitySubScores(profile).overall}
              />
              
              <View style={[styles.topRightFloatingButtonContainer, { top: params.source === 'sent' ? 110 : 50 }]}>
                <TouchableOpacity onPress={handleReportUser} style={[styles.withdrawButton, { backgroundColor: 'rgba(11, 4, 21, 0.6)' }]} accessibilityLabel="Report profile" accessibilityRole="button">
                  <View style={styles.withdrawInner}>
                    <Ionicons name="warning-outline" size={24} color="#EF4444" />
                  </View>
                </TouchableOpacity>
              </View>
              
              {/* Withdraw Button positioned at top right over the hero image */}
              {params.source === 'sent' && (
                <View style={styles.topRightFloatingButtonContainer}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={styles.withdrawButton}
                    onPress={handleWithdraw}
                  >
                    <LinearGradient
                      colors={['rgba(192, 132, 252, 0.15)', 'rgba(11, 4, 21, 0.9)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    
                    <View style={styles.withdrawInner}>
                      <FontAwesome5 name="heart-broken" size={24} color="#E879F9" />
                    </View>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* 2. Astro badges */}
            <AstroBadges
              westernSign={profile.western_sign}
              indianSign={profile.indian_sign}
              sunSignHarmony={profile.sun_sign_harmony}
              moonSignAlignment={profile.moon_sign_alignment}
            />

            {/* 3. Cosmic Compatibility */}
            {profile && (
              <CosmicCompatibility
                {...getCompatibilitySubScores(profile)}
              />
            )}

            {/* 4. Essentials Grid */}
            <EssentialsGrid profile={profile} />

            {/* 5. Deeper Insights */}
            <DeeperInsights personalityDetail={profile.personality_detail} />

            {/* 6. Astrology Insights */}
            {profile && (
              <AstrologyInsights
                {...getAstrologyInsights(profile.western_sign)}
              />
            )}

            {/* 7. Deep Synastry (Premium) */}
            <SynastryBreakdown
              detail={synastryDetail}
              isLoading={synastryLoading}
              isPremium={isPremiumUser}
              onUpgradePress={() => router.push('/subscription')}
            />

            {/* 8. Interests */}
            <InterestsSection
              interests={profile.interests}
              hobbies={profile.hobbies}
            />

            {/* Likes sent: Withdraw button moved to top of image */}
          </ScrollView>

          {/* Action buttons — only for feed/discover context */}
          {params.source !== 'likes' && params.source !== 'sent' && (
            <FloatingActionButtons
              onPass={handleDislike}
              onSuperLike={handleSuperLike}
              onLike={handleLike}
              superLikeCount={superLikesRemaining}
            />
          )}

          {/* Likes received: Pass or Like back */}
          {params.source === 'likes' && (
            <FloatingActionButtons
              onPass={handleDislike}
              onSuperLike={handleSuperLike}
              onLike={handleLike}
              superLikeCount={superLikesRemaining}
            />
          )}
        </View>

        {/* Match Modal */}
        <Modal
          visible={showMatchModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => {
            setShowMatchModal(false);
            setMatchedProfile(null);
            setMatchedUserId(null);
          }}
        >
          {matchedProfile && (
            <LinearGradient
              colors={['#1a0d2e', '#2d1b4e', '#4a2c5a']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.matchOverlay}
            >
              <View
                style={{ ...StyleSheet.absoluteFillObject, overflow: 'hidden' }}
              >
                {stars.map((star) => (
                  <View
                    key={`match-star-${star.id}`}
                    style={{
                      position: 'absolute',
                      backgroundColor: '#FFFFFF',
                      borderRadius: star.size / 2,
                      left: `${star.x}%`,
                      top: `${star.y}%`,
                      width: star.size,
                      height: star.size,
                      opacity: star.opacity,
                    }}
                  />
                ))}
              </View>

              <Pressable
                style={styles.matchBackButton}
                onPress={() => {
                  setShowMatchModal(false);
                  setMatchedProfile(null);
                  setMatchedUserId(null);
                  router.back();
                }}
                android_ripple={{
                  color: 'rgba(255, 255, 255, 0.2)',
                  borderless: true,
                }}
              >
                <MaterialIcons name="close" size={24} color="#FFFFFF" />
              </Pressable>

              <View style={styles.matchCardsContainer}>
                <View
                  style={[
                    styles.matchProfileCard,
                    styles.matchCardLeft,
                    styles.planetarySphere,
                  ]}
                >
                  <Image
                    source={
                      currentUserPhoto?.thumbnail
                        ? { uri: currentUserPhoto.thumbnail }
                        : typeof currentUserPhoto === 'string'
                        ? { uri: currentUserPhoto }
                        : currentUserPhoto
                    }
                    style={styles.matchProfileImage}
                    contentFit="cover"
                  />
                </View>
                <View
                  style={[
                    styles.matchProfileCard,
                    styles.matchCardRight,
                    styles.planetarySphere,
                  ]}
                >
                  <Image
                    source={
                      matchedProfile?.photos?.[0]?.thumbnail
                        ? { uri: matchedProfile.photos[0].thumbnail }
                        : typeof matchedProfile.image === 'string'
                        ? { uri: matchedProfile.image }
                        : matchedProfile.image
                    }
                    style={styles.matchProfileImage}
                    contentFit="cover"
                  />
                </View>
                <View style={styles.matchHeartIcon}>
                  <MaterialIcons name="favorite" size={44} color="#EC4899" />
                </View>
              </View>

              <View style={styles.matchTextContainer}>
                <Text style={[styles.matchTitle, { color: '#FFFFFF' }]}>
                  It's a Match!
                </Text>
                <Text
                  style={[
                    styles.matchSubtitle,
                    { color: 'rgba(255, 255, 255, 0.8)' },
                  ]}
                >
                  You and {matchedProfile.name} liked each other. Start a
                  conversation!
                </Text>
              </View>

              <Pressable
                style={styles.matchSendButton}
                onPress={handleSendMessageFromMatchModal}
                android_ripple={{
                  color: 'rgba(255, 255, 255, 0.2)',
                  borderless: false,
                }}
              >
                <MaterialIcons name="chat" size={24} color="#FFFFFF" />
                <Text style={styles.matchSendButtonText}>Send Message</Text>
              </Pressable>
            </LinearGradient>
          )}
        </Modal>
      </LinearGradient>
    </ErrorBoundary>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  gradientContainer: { flex: 1 },
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
  contentWrapper: { flex: 1, position: 'relative' },
  scrollView: { flex: 1, backgroundColor: 'transparent' },
  scrollContent: { flexGrow: 1, paddingBottom: 200 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  starryBackground: { ...StyleSheet.absoluteFillObject, zIndex: 0 },
  errorText: {
    color: '#FFFFFF',
    fontSize: 16,
    zIndex: 1,
    marginBottom: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  retryButton: {
    backgroundColor: '#EC4899',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    zIndex: 1,
  },
  retryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  infoCard: {
    backgroundColor: 'transparent',
    marginHorizontal: 0,
    marginTop: 5,
    borderRadius: 0,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  sectionLabel: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  lookingForContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  lookingForEmoji: { fontSize: 24, marginRight: 12 },
  lookingForText: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  monogamyText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    width: '100%',
  },
  essentialsList: { marginTop: 5 },
  essentialItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 15,
  },
  essentialText: { fontSize: 16, color: '#FFFFFF', fontWeight: '500' },
  hobbiesList: { marginTop: 5, gap: 10 },
  hobbyItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hobbyItemText: { fontSize: 16, color: '#FFFFFF', fontWeight: '500' },
  actionIconsContainer: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    gap: 32,
  },
  actionButtonSmallWrapper: { justifyContent: 'center', alignItems: 'center' },
  actionIconGlassy: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 8,
  },
  topRightFloatingButtonContainer: {
    position: 'absolute',
    top: 50,
    right: 16,
    zIndex: 20,
  },
  withdrawButton: {
    height: 56,
    width: 56,
    backgroundColor: 'transparent',
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: 'rgba(192, 132, 252, 0.6)',
    padding: 4,
    overflow: 'hidden',
    shadowColor: '#C084FC',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 8,
  },
  withdrawInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(192, 132, 252, 0.3)',
    borderStyle: 'dashed',
  },
  matchOverlay: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  matchBackButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  matchCardsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 40,
    height: 300,
    position: 'relative',
    zIndex: 1,
    width: '100%',
  },
  matchProfileCard: {
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: 'transparent',
    overflow: 'hidden',
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#FFD700',
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 12,
  },
  planetarySphere: {
    borderWidth: 3,
    borderColor: 'rgba(255, 215, 0, 0.7)',
  },
  matchCardLeft: {
    left: '5%',
    transform: [{ rotate: '-10deg' }],
    zIndex: 1,
  },
  matchCardRight: {
    right: '5%',
    transform: [{ rotate: '10deg' }],
    zIndex: 2,
  },
  matchProfileImage: { width: '100%', height: '100%' },
  matchHeartIcon: {
    position: 'absolute',
    bottom: 20,
    left: '50%',
    marginLeft: -25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3,
  },
  matchTextContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
    zIndex: 1,
  },
  matchTitle: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 12,
    textAlign: 'center',
  },
  matchSubtitle: {
    fontSize: 16,
    color: 'rgba(0, 0, 0, 0.7)',
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 22,
  },
  matchSendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EC4899',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    gap: 12,
    width: '100%',
    shadowColor: '#EC4899',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  matchSendButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});