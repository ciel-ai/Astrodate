import { useTabBarVisibility } from '@/hooks/use-tab-bar-visibility';
import { getMyDailyPick, type DailyPick } from '@/lib/daily-picks';
import { getIcebreakerForMatch } from '@/lib/icebreaker';
import { fetchFinalMatches, getDiscoveryPreferences, hasCompletedOnboarding, type DiscoveryPreferences, type FinalMatchResult } from '@/lib/matching';
import { getSection1Responses } from '@/lib/onboarding-responses';
import { trackRealtimeChannel } from '@/lib/realtime-channels';
import { createReport, getReportedUserIds } from '@/lib/reports';
import { signalDislike, signalLike, signalSuperLike, signalViewProfile, startViewLongTimer, stopViewLongTimer } from '@/lib/signals';
import { supabase } from '@/lib/supabase';
import { derivedAstroScore, getActiveAstroEvents, getSynastryDetail, type AstroEvent } from '@/lib/synastry';
import { checkMutualLike, hasUserSuperlikedMe, saveUserLike } from '@/lib/user-likes';
import { getUserPhotos } from '@/lib/user-photos';
import AntDesign from '@expo/vector-icons/AntDesign';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    type NativeScrollEvent,
    type NativeSyntheticEvent
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { AnimatedRef } from 'react-native-reanimated';
import Animated, {
    createAnimatedComponent,
    Easing,
    interpolate,
    interpolateColor,
    runOnJS,
    runOnUI,
    scrollTo,
    useAnimatedProps,
    useAnimatedRef,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useDerivedValue,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFeedViewport } from '../hooks/useFeedViewport';
import { useFeedData } from '../hooks/useFeedData';
import { useFeedActions } from '../hooks/useFeedActions';
import { useFeedSharedValues } from '../hooks/useFeedSharedValues';
import { useFeedGestures } from '../hooks/useFeedGestures';
import { cleanupFeedChannel, removeFeedChannelsByTopicPrefix } from '../realtime/feedRealtimeManager';
import { CircularProgress } from './CircularProgress';
import FeedEmptyState from './FeedEmptyState';
import { SparklingHeart } from './SparklingHeart';
import SwipeTutorialOverlay from './SwipeTutorialOverlay';
import { CosmicMatchCard } from './CosmicMatchCard';
import { ProfileCard } from './ProfileCard';
import { CardActionBar } from './CardActionBar';
import { MatchModal } from './MatchModal';
import {
  getDynamicBio,
  formatHobby,
  getPromptsForProfile,
  getTagsForProfile,
  getLabelForValue,
  type Profile,
} from '../utils/profileHelpers';

import {
  STATIC_WIDTH,
  STATIC_HEIGHT,
  TAB_BAR_OFFSET,
  CARD_HEIGHT,
  ACTION_BUTTONS_BOTTOM,
  SWIPE_THRESHOLD,
} from '../utils/feedTypes';

const AnimatedBlurView = createAnimatedComponent(BlurView);
const AnimatedMaterialIcons = createAnimatedComponent(MaterialIcons);
const AnimatedFontAwesome = createAnimatedComponent(FontAwesome);
const AnimatedIonicons = createAnimatedComponent(Ionicons);
const AnimatedPressable = createAnimatedComponent(Pressable);

// SWIPE_THRESHOLD imported from ../utils/feedTypes

// Profile type is now imported from ../utils/profileHelpers

const normalizeGenderValue = (value?: string) => {
  return String(value || '').trim().toLowerCase().replace(/[_\s-]+/g, '');
};

const candidateMatchesInterest = (candidate: { gender?: string; gender_detail?: string }, interest?: string[]) => {
  const interestSet = new Set((interest || []).map((item) => String(item || '').trim().toLowerCase()));
  if (interestSet.size === 0 || interestSet.has('everyone')) {
    return true;
  }

  const gender = normalizeGenderValue(candidate.gender);
  const detail = normalizeGenderValue(candidate.gender_detail);

  const isMale = ['male', 'man', 'cisman', 'transman', 'intersexman'].some((value) => gender === value || detail.includes(value));
  const isFemale = ['female', 'woman', 'ciswoman', 'transwoman', 'intersexwoman'].some((value) => gender === value || detail.includes(value));
  const isNonBinary = [
    'nonbinary',
    'beyondbinary',
    'genderfluid',
    'genderqueer',
    'agender',
    'pangender',
    'twospirit',
    'intersex',
    'questioning',
    'transfeminine',
    'transmasculine',
    'notlisted',
  ].some((value) => gender === value || detail.includes(value));

  if (interestSet.has('men') && isMale) return true;
  if (interestSet.has('women') && isFemale) return true;
  if (interestSet.has('beyond-binary') && isNonBinary) return true;

  return false;
};

const candidateWithinDiscoveryPreferences = (
  candidate: { age?: number; location?: string; gender?: string; gender_detail?: string },
  prefs?: DiscoveryPreferences | null
) => {
  if (!prefs) return true;

  const { min_age, max_age, gender_preference } = prefs;

  if (typeof candidate.age === 'number' && !Number.isNaN(candidate.age)) {
    if (candidate.age < min_age || candidate.age > max_age) {
      return false;
    }
  }

  const normalizedPreference = String(gender_preference || '').trim().toLowerCase();
  const candidateGender = normalizeGenderValue(candidate.gender);
  const candidateGenderDetail = normalizeGenderValue(candidate.gender_detail);

  // Apply gender preference filtering from backend preferences.
  // "Select" / "Prefer not to say" mean no gender filter.
  if (
    normalizedPreference &&
    normalizedPreference !== 'select' &&
    normalizedPreference !== 'prefer not to say'
  ) {
    const isMale =
      ['male', 'man', 'cisman', 'transman', 'intersexman'].some(
        (value) => candidateGender === value || candidateGenderDetail.includes(value)
      );
    const isFemale =
      ['female', 'woman', 'ciswoman', 'transwoman', 'intersexwoman'].some(
        (value) => candidateGender === value || candidateGenderDetail.includes(value)
      );
    const isNonBinary =
      [
        'nonbinary',
        'non-binary',
        'genderfluid',
        'genderqueer',
        'agender',
        'pangender',
        'twospirit',
        'intersex',
        'questioning',
        'transfeminine',
        'transmasculine',
      ].some((value) => candidateGender.includes(value.replace('-', '')) || candidateGenderDetail.includes(value.replace('-', '')));

    if (normalizedPreference === 'male' && !isMale) return false;
    if (normalizedPreference === 'female' && !isFemale) return false;
    if (normalizedPreference === 'non-binary' && !isNonBinary) return false;
  }

  // Location / distance based filtering can be added here once
  // accurate coordinates are available for users and preferences.

  return true;
};

// CircularProgress and SparklingHeart are extracted to their own files (Step 1)

// Utility functions are extracted to utils/profileHelpers.ts (Step 2)


export default function DiscoverScreen() {
  const router = useRouter();
  const { screenWidth: SCREEN_WIDTH, screenHeight: SCREEN_HEIGHT, cardHeight } = useFeedViewport();
  const insets = useSafeAreaInsets();
  const dynamicActionButtonsBottom = 60 + insets.bottom + (STATIC_HEIGHT < 750 ? 12 : 20);

  const {
    profiles,
    setProfiles,
    loadingProfiles,
    currentProfileIndex,
    setCurrentProfileIndex,
    currentUserInterest,
    reportedUserIds,
    setReportedUserIds,
    superlikedProfiles,
    superLikesRemaining,
    likesRemaining,
    unreadCount,
    currentUserPhoto,
    currentUserAstro,
    dailyPick,
    isFallbackFeed,
    activeAstroEvent,
    setActiveAstroEvent,
    fetchSuperLikesRemaining,
    fetchLikesRemaining,
    loadDiscoverProfiles,
    selectedInsightTab,
    setSelectedInsightTab,
    profilePhotoIndex,
    setProfilePhotoIndex,
    showTutorial,
    setShowTutorial,
  } = useFeedData();

  const [isFlipped, setIsFlipped] = useState(false);
  const [showCompatibilityModal, setShowCompatibilityModal] = useState(false);
  const [compProfile, setCompProfile] = useState<Profile | null>(null);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchedProfile, setMatchedProfile] = useState<Profile | null>(null);
  const [matchedUserId, setMatchedUserId] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isMovingForward, setIsMovingForward] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showReportReasonModal, setShowReportReasonModal] = useState(false);
  const [showUpgradeSheet, setShowUpgradeSheet] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<'likes' | 'super_likes'>('super_likes');
  const [reportingProfile, setReportingProfile] = useState<Profile | null>(null);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  // Match modal icebreaker (fetched from DB after match fires)
  const [matchIcebreaker, setMatchIcebreaker] = useState<string | null>(null);
  const [matchAstroScore, setMatchAstroScore] = useState<number | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);

  // Prompt liking comment modal states
  const [showLikePromptModal, setShowLikePromptModal] = useState(false);
  const [likePromptId, setLikePromptId] = useState<string | null>(null);
  const [likePromptQuestion, setLikePromptQuestion] = useState<string | null>(null);
  const [likePromptComment, setLikePromptComment] = useState('');

  // ── Swipe tutorial ──────────────────────────────────────────────────────────
  const { isHidden: isTabBarHidden, setHidden: setTabBarHidden } = useTabBarVisibility();
  const {
    translateX,
    translateY,
    rotate,
    opacity,
    panStartX,
    panStartY,
    lastScrollY,
    scrollY,
    isTabBarHiddenShared,
    nextCardBlur,
    rotateY,
    parallaxScrollRef,
    resetCardPosition,
  } = useFeedSharedValues(isTabBarHidden);

  const stars = useMemo(() => Array.from({ length: 100 }).map((_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2 + 0.5,
    opacity: Math.random() * 0.8 + 0.2,
  })), []);

  useFocusEffect(
    useCallback(() => {
      setTabBarHidden(false);
      return () => setTabBarHidden(false);
    }, [setTabBarHidden])
  );

  useEffect(() => {
    isTabBarHiddenShared.value = isTabBarHidden;
  }, [isTabBarHidden, isTabBarHiddenShared]);


  const setNextCardBlurActive = useCallback(() => {
    runOnUI(() => {
      'worklet';
      nextCardBlur.value = withTiming(30, { duration: 180 });
    })();
  }, [nextCardBlur]);
  const resetNextCardBlur = useCallback(() => {
    runOnUI(() => {
      'worklet';
      nextCardBlur.value = withTiming(0, { duration: 160 });
    })();
  }, [nextCardBlur]);

  const updateProfileIndex = useCallback(() => {
    if (!profiles || profiles.length === 0) return;

    setCurrentProfileIndex((prev) => {
      const len = profiles.length;
      if (len === 0) return 0;
      const nextIndex = prev + 1;

      // Stop at the end of the deck; do not loop back to first profile.
      if (nextIndex >= len) {
        return len;
      }

      // Reset photo index for the new profile
      if (profiles[nextIndex]?.id) {
        setProfilePhotoIndex(prevIndices => ({
          ...prevIndices,
          [String(profiles[nextIndex].id)]: 0
        }));
      }
      return nextIndex;
    });
    setIsFlipped(false);
    setCurrentImageIndex(0);
    setIsMovingForward(true);
    rotateY.value = 0;
    resetNextCardBlur();
    setIsTransitioning(false);
  }, [profiles, resetNextCardBlur, rotateY]);



  const {
    handleLike,
    handleDislike,
    handleSuperLike,
    handleSendMessageFromMatchModal,
    saveSwipeAction,
    submitReport,
    checkAndShowMatch,
  } = useFeedActions({
    profiles,
    currentProfileIndex,
    isFlipped,
    isTransitioning,
    setIsTransitioning,
    updateProfileIndex,
    SCREEN_WIDTH,
    translateX,
    translateY,
    opacity,
    nextCardBlur,
    resetCardPosition,
    fetchSuperLikesRemaining,
    fetchLikesRemaining,
    setShowUpgradeSheet,
    setUpgradeReason,
    router,
    setMatchedProfile,
    setMatchedUserId,
    setMatchId,
    setMatchIcebreaker,
    setMatchAstroScore,
    setShowMatchModal,
    setProfiles,
    setCurrentProfileIndex,
    setReportedUserIds,
    setReportingProfile,
    setShowReportReasonModal,
    isSubmittingReport,
    setIsSubmittingReport,
    reportingProfile,
    matchedProfile,
    matchedUserId,
  });

  // Removed missed-match popup logic

  const handleLikePrompt = useCallback((promptId: string, question: string) => {
    setLikePromptId(promptId);
    setLikePromptQuestion(question);
    setLikePromptComment('');
    setShowLikePromptModal(true);
  }, []);

  const submitLikePrompt = useCallback(async () => {
    setShowLikePromptModal(false);
    if (likePromptId) {
      await handleLike(likePromptId, likePromptComment);
    }
  }, [likePromptId, likePromptComment, handleLike]);

  // Fixed heart positions for match modal
  const matchHearts = useMemo(() => {
    return Array.from({ length: 20 }).map((_, i) => ({
      id: i,
      left: (i * 37) % 100,
      top: (i * 23 + 17) % 100,
      size: (i % 3) * 5 + 15,
      opacity: (i % 4) * 0.1 + 0.3,
    }));
  }, []);

  const updateTabBarVisibility = useCallback((shouldHide: boolean) => {
    if (isTabBarHiddenShared.value !== shouldHide) {
      isTabBarHiddenShared.value = shouldHide;
      setTabBarHidden(shouldHide);
    }
  }, [isTabBarHiddenShared, setTabBarHidden]);

  // Removed match modal and missed popup triggers

  const isNavigatingRef = useRef(false);


  useFocusEffect(
    useCallback(() => {
      // Reset scroll position when screen comes into focus
      if (parallaxScrollRef && parallaxScrollRef.current && (parallaxScrollRef.current as any) !== -1) {
        runOnUI(() => {
          'worklet';
          try {
            scrollTo(parallaxScrollRef, 0, 0, false);
          } catch (e) {
            // ignore uninitialized ref errors
          }
        })();
      }
      isNavigatingRef.current = false;
    }, [parallaxScrollRef])
  );

  const navigateToDetails = useCallback(() => {
    if (isNavigatingRef.current) return;

    if (profiles.length > 0 && currentProfileIndex < profiles.length) {
      const profile = profiles[currentProfileIndex];
      if (profile?.id) {
        isNavigatingRef.current = true;
        router.push({
          pathname: '/profile-details',
          params: {
            userId: String(profile.id),
            initialData: JSON.stringify(profile)
          },
        });
        // Reset flag after navigation
        setTimeout(() => { isNavigatingRef.current = false; }, 1000);
      }
    }
  }, [profiles, currentProfileIndex, router]);

  const handleDetailsScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    const scrollDiff = currentScrollY - lastScrollY.value;

    if (Math.abs(scrollDiff) > 3) {
      updateTabBarVisibility(scrollDiff > 0);
    }

    lastScrollY.value = currentScrollY;
  }, [lastScrollY, updateTabBarVisibility]);

  const handleFlip = () => {
    const newFlippedState = !isFlipped;
    setIsFlipped(newFlippedState);
    rotateY.value = withTiming(newFlippedState ? 180 : 0, { duration: 600 });
  };

  useEffect(() => {
    // Avoid calling scrollTo when the card stack isn't mounted
    if (profiles.length === 0) return;
    translateX.value = 0;
    translateY.value = 0;
    rotate.value = 0;
    opacity.value = 1;
    runOnUI((ref: AnimatedRef<Animated.ScrollView> | null) => {
      'worklet';
      if (ref && ref.current && (ref.current as any) !== -1) {
        try {
          scrollTo(ref, 0, 0, true);
        } catch (e) {
          // ignore uninitialized ref errors
        }
      }
    })(parallaxScrollRef as AnimatedRef<Animated.ScrollView>);
  }, [
    currentProfileIndex,
    profiles.length,
    translateX,
    translateY,
    rotate,
    opacity,
    parallaxScrollRef,
  ]);

  const handlePhotoTapGlobal = useCallback(() => {
    const profile = profiles[currentProfileIndex];
    if (!profile) return;
    const profileId = String(profile.id);
    const photos = profile.photos && profile.photos.length > 0
      ? profile.photos
      : profile.image ? [profile.image] : [];
    if (photos.length <= 1) return;
    setProfilePhotoIndex(prev => {
      const currentIdx = prev[profileId] || 0;
      const nextIdx = (currentIdx + 1) % photos.length;
      return { ...prev, [profileId]: nextIdx };
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [profiles, currentProfileIndex]);

  const reportReasons = useMemo(
    () => [
      'Inappropriate photos or bio',
      'Harassment or hate speech',
      'Spam or scam',
      'Fake profile',
      'Other',
    ],
    []
  );

  const openReportModalForProfile = useCallback((profile: Profile) => {
    setReportingProfile(profile);
    setShowReportReasonModal(true);
  }, []);

  const gestures = useFeedGestures({
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
    onSuperLike: handleSuperLike,
    onSwipe: saveSwipeAction,
    onPhotoTap: handlePhotoTapGlobal,
    updateProfileIndex,
    setIsTransitioning,
    isFlipped,
    isTransitioning,
    SCREEN_WIDTH,
    setTabBarHidden,
  });

  const {
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
  } = gestures;

  // renderProfileContent is now delegated to ProfileCard (Step 2)
  const renderProfileContent = (profileIndex: number) => {
    if (!profiles || profiles.length === 0) return null;
    if (profileIndex < 0 || profileIndex >= profiles.length) return null;
    const profile = profiles[profileIndex];
    if (!profile) return null;
    return (
      <ProfileCard
        profile={profile}
        insets={insets}
        parallaxScrollRef={parallaxScrollRef}
        navigateToDetails={navigateToDetails}
        onRouteToDetails={(p) =>
          router.push({ pathname: '/profile-details', params: { userId: p.id, initialData: JSON.stringify(p) } })
        }
        onLikePrompt={handleLikePrompt}
      />
    );
  };


  return (
    <View style={styles.screen}>
      {/* ── Dynamic Astro Event Banner ─────────────────────────────────── */}
      {activeAstroEvent && (
        <LinearGradient
          colors={[
            activeAstroEvent.ui_config?.gradient_start ?? '#1a1a2e',
            activeAstroEvent.ui_config?.gradient_end ?? '#e94560',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            marginHorizontal: 16,
            marginTop: insets.top + 72,
            borderRadius: 12,
            zIndex: 110,
            padding: 12,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 18, marginRight: 8 }}>
            {activeAstroEvent.ui_config?.emoji ?? '✨'}
          </Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: activeAstroEvent.ui_config?.text_color ?? '#fff', fontWeight: '700', fontSize: 13 }}>
              {activeAstroEvent.ui_config?.banner_text ?? activeAstroEvent.event_name}
            </Text>
            {activeAstroEvent.ui_config?.cta ? (
              <Text style={{ color: activeAstroEvent.ui_config?.text_color ?? '#fff', opacity: 0.85, fontSize: 12, marginTop: 2 }}>
                {activeAstroEvent.ui_config.cta}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity onPress={() => setActiveAstroEvent(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialIcons name="close" size={16} color={activeAstroEvent.ui_config?.text_color ?? '#fff'} />
          </TouchableOpacity>
        </LinearGradient>
      )}
      {/* ── Cosmic Match of the Day ─────────────────────────────────────── */}
      {dailyPick && profiles.length > 0 && (
        <CosmicMatchCard
          pick={dailyPick}
          onPress={() => router.push({
            pathname: '/profile-details',
            params: { userId: dailyPick.picked_user_id }
          })}
        />
      )}
      {/* ── Fallback Feed Banner ─────────────────────────────────────────── */}
      {false && isFallbackFeed && profiles.length > 0 && (
        <View style={{
          position: 'absolute',
          left: 0,
          right: 0,
          marginHorizontal: 16,
          marginTop: insets.top + 72,
          borderRadius: 12,
          zIndex: 110,
          padding: 12,
          backgroundColor: 'rgba(255, 193, 7, 0.15)',
          borderWidth: 1,
          borderColor: 'rgba(255, 193, 7, 0.3)',
          flexDirection: 'row',
          alignItems: 'center',
        }}>
          <Text style={{ fontSize: 16, marginRight: 8 }}>
            ⚡
          </Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#FFC107', fontWeight: '600', fontSize: 13 }}>
              Showing nearby profiles — your cosmic feed is loading
            </Text>
          </View>
        </View>
      )}
      {/* Profiles Stack (Behind everything) */}
      {loadingProfiles && profiles.length === 0 ? (
        <View style={{ position: 'absolute', top: '45%', left: 0, right: 0, alignItems: 'center', zIndex: 100 }}>
          <ActivityIndicator size="large" color="#A855F7" />
        </View>
      ) : profiles.length === 0 ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200, justifyContent: 'center', backgroundColor: '#080412' }}>
          <FeedEmptyState onExpandFilters={() => router.push('/filters')} />
        </View>
      ) : (
        <View style={styles.profileStackWrapper}>
          {profiles.slice(currentProfileIndex, currentProfileIndex + 2).reverse().map((profile, reverseIdx, arr) => {
            const isTop = reverseIdx === arr.length - 1;
            const index = isTop ? currentProfileIndex : currentProfileIndex + 1;
            return (
              <View 
                key={`${String(profile.id)}-${isTop ? 'top' : 'next'}`} 
                style={isTop ? styles.currentProfileWrapper : styles.nextProfileWrapper}
                accessibilityActions={isTop ? [
                  { name: 'pass', label: 'Pass' },
                  { name: 'like', label: 'Like' },
                  { name: 'superlike', label: 'Super Like' }
                ] : undefined}
                onAccessibilityAction={isTop ? (event) => {
                  switch (event.nativeEvent.actionName) {
                    case 'pass': handleDislike(); break;
                    case 'like': handleLike(); break;
                    case 'superlike': handleSuperLike(); break;
                  }
                } : undefined}
              >
                {isTop ? (
                  <GestureDetector gesture={composedGesture}>
                    <Animated.View style={[swipeAnimatedStyle as any, frontAnimatedStyle]}>
                      {renderProfileContent(index)}
                    </Animated.View>
                  </GestureDetector>
                ) : (
                  <Animated.View style={nextCardStyle}>
                    {renderProfileContent(index)}
                  </Animated.View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Top Navigation Bar Overlay */}
      <View style={[styles.topNavContainer, { paddingTop: insets.top + 16, justifyContent: 'space-between' }]}>
        <TouchableOpacity
          style={styles.topNavIconButton}
          onPress={() => router.push('/filters')}
          activeOpacity={0.7}>
          <MaterialIcons name="tune" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {/* Bell icon — notifications */}
          <TouchableOpacity
            style={[styles.topNavIconButton, { marginRight: 8 }]}
            onPress={() => router.push('/(tabs)/notifications')}
            activeOpacity={0.7}
          >
            <MaterialIcons name="notifications-none" size={24} color="#FFFFFF" />
            {unreadCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Report icon — only visible when a profile is showing */}
          {profiles.length > 0 && currentProfileIndex < profiles.length && (
            <TouchableOpacity
              style={styles.topNavIconButton}
              onPress={() => {
                const profile = profiles[currentProfileIndex];
                if (profile) openReportModalForProfile(profile);
              }}
              activeOpacity={0.7}
            >
              <MaterialIcons name="flag" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>

      </View>

      {/* Bottom fade gradient overlay */}
      {profiles.length > 0 && currentProfileIndex < profiles.length && !isFlipped && (
        <View style={styles.bottomOverlayGradientContainer} pointerEvents="none">
          <LinearGradient
            colors={['transparent', 'rgba(13, 6, 24, 0.85)', '#0D0618']}
            style={StyleSheet.absoluteFill}
          />
        </View>
      )}

      {/* Action buttons Overlay */}
      {profiles.length > 0 && currentProfileIndex < profiles.length && !isFlipped && (
        <CardActionBar
          onLike={handleLike}
          onDislike={handleDislike}
          onSuperLike={handleSuperLike}
          isTransitioning={isTransitioning}
          superLikesRemaining={superLikesRemaining}
          likesRemaining={likesRemaining}
          bottom={dynamicActionButtonsBottom}
          dislikeButtonScale={dislikeButtonScale}
          dislikeButtonColorStyle={dislikeButtonColorStyle}
          dislikeIconStyle={dislikeIconStyle}
          superLikeButtonScale={superLikeButtonScale}
          superLikeButtonColorStyle={superLikeButtonColorStyle}
          superLikeIconStyle={superLikeIconStyle}
          likeButtonScale={likeButtonScale}
          likeButtonColorStyle={likeButtonColorStyle}
          likeIconStyle={likeIconStyle}
        />
      )}

      {/* Match Modal */}
      <MatchModal
        visible={showMatchModal}
        onRequestClose={() => {
          setShowMatchModal(false);
          setMatchedProfile(null);
          setMatchedUserId(null);
          setMatchIcebreaker(null);
          setMatchAstroScore(null);
          setMatchId(null);
        }}
        matchedProfile={matchedProfile}
        currentUserPhoto={currentUserPhoto}
        matchAstroScore={matchAstroScore}
        matchIcebreaker={matchIcebreaker}
        onSendMessage={handleSendMessageFromMatchModal}
      />

      {/* Prompt Like Comment Modal */}
      <Modal
        visible={showLikePromptModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLikePromptModal(false)}
      >
        <View style={styles.promptLikeModalOverlay}>
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.promptLikeModalContent}>
            <Text style={styles.promptLikeModalTitle}>Like this Prompt?</Text>
            
            {likePromptQuestion && (
              <View style={styles.promptLikeQuestionBox}>
                <Text style={styles.promptLikeQuestionText}>{likePromptQuestion}</Text>
              </View>
            )}

            <TextInput
              style={styles.promptLikeInput}
              placeholder="Add a comment... (optional)"
              placeholderTextColor="rgba(255, 255, 255, 0.4)"
              value={likePromptComment}
              onChangeText={setLikePromptComment}
              maxLength={200}
              multiline={true}
            />

            <View style={styles.promptLikeButtonRow}>
              <TouchableOpacity
                style={[styles.promptLikeBtn, styles.promptLikeCancelBtn]}
                onPress={() => setShowLikePromptModal(false)}
              >
                <Text style={styles.promptLikeBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.promptLikeBtn, styles.promptLikeSendBtn]}
                onPress={submitLikePrompt}
              >
                <Text style={[styles.promptLikeBtnText, { color: '#000000', fontWeight: '700' }]}>Send Like</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Compatibility Detail Modal */}
      <Modal
        visible={showCompatibilityModal}
        presentationStyle="pageSheet"
        animationType="slide"
        onRequestClose={() => setShowCompatibilityModal(false)}
      >
        <LinearGradient
          colors={['#1a0d2e', '#2d1b4e', '#4a2c5a']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.compModalOverlayFullscreen}
        >
          {/* Starfield to match Likes screen */}
          <View style={{ ...StyleSheet.absoluteFillObject, overflow: 'hidden' }}>
            {stars.map((star) => (
              <View
                key={`modal-star-${star.id}`}
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

          {/* View Container instead of SafeAreaView for manual control over layout */}
          <View style={{ flex: 1 }}>
            {/* Header Row */}
            <View style={styles.compHeaderRow}>
              <TouchableOpacity style={styles.compIconBtn} onPress={() => setShowCompatibilityModal(false)}>
                <MaterialIcons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.compIconBtn}>
                <MaterialIcons name="info-outline" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} bounces={false} style={{ flex: 1 }}>
              {/* Title Section */}
              <View style={styles.compTitleRow}>
                <View style={{ flex: 1 }}>
                  <View style={styles.compAppTitleRow}>
                    <MaterialIcons name="local-fire-department" size={14} color="#FFFFFF" />
                    <Text style={styles.compAppTitle}>Astrology</Text>
                  </View>
                  <Text style={styles.compMainTitle}>You and {compProfile?.name || 'User'}</Text>
                </View>
                <View style={styles.compAvatars}>
                  {/* Current User Photo (Left) */}
                  <Image
                    source={typeof currentUserPhoto === 'string' ? { uri: currentUserPhoto } : currentUserPhoto}
                    style={[styles.compAvatar, { zIndex: 2 }]}
                    contentFit="cover"
                  />
                  {/* Matched User Photo (Right) */}
                  <Image
                    source={typeof compProfile?.image === 'string' ? { uri: compProfile?.image } : compProfile?.image}
                    style={[styles.compAvatar, { marginLeft: -20, zIndex: 1 }]}
                    contentFit="cover"
                  />
                </View>
              </View>


              {/* Your Cosmic Spark */}
              <Text style={styles.compSectionTitle}>Your Cosmic Spark</Text>
              <View style={styles.compSparkGrid}>
                <View style={styles.compSparkCol}>
                  <Text style={styles.compSparkLabel}>Overall {(compProfile as any)?.final_score || (compProfile as any)?.compatibility || 0}%</Text>
                  <View style={styles.compSparkBarContainer}>
                    <View style={[styles.compSparkBarFill, { width: `${(compProfile as any)?.final_score || (compProfile as any)?.compatibility || 0}%` }]} />
                  </View>
                  <Text style={[styles.compSparkLabel, { marginTop: 16 }]}>Western {(compProfile as any)?.western_score || 0}%</Text>
                  <View style={styles.compSparkBarContainer}>
                    <View style={[styles.compSparkBarFill, { width: `${(compProfile as any)?.western_score || 0}%` }]} />
                  </View>
                </View>
                <View style={styles.compSparkCol}>
                  <Text style={styles.compSparkLabel}>Personality {(compProfile as any)?.personality_score || 0}%</Text>
                  <View style={styles.compSparkBarContainer}>
                    <View style={[styles.compSparkBarFill, { width: `${(compProfile as any)?.personality_score || 0}%` }]} />
                  </View>
                  <Text style={[styles.compSparkLabel, { marginTop: 16 }]}>Indian {
                    (compProfile as any)?.indian_score ?
                      ((compProfile as any).indian_score <= 36 ? Math.round(((compProfile as any).indian_score / 36) * 100) : (compProfile as any).indian_score)
                      : 0
                  }%</Text>
                  <View style={styles.compSparkBarContainer}>
                    <View style={[styles.compSparkBarFill, {
                      width: `${(compProfile as any)?.indian_score ?
                        ((compProfile as any).indian_score <= 36 ? Math.round(((compProfile as any).indian_score / 36) * 100) : (compProfile as any).indian_score)
                        : 0
                        }%`
                    }]} />
                  </View>
                </View>
              </View>

              {/* Western Insight Section - Only show if report exists */}
              {!!(compProfile as any)?.western_report && (
                <View style={{ paddingHorizontal: 20, marginTop: 32 }}>
                  <View style={styles.compCardHeaderRow}>
                    <MaterialIcons name="wb-sunny" size={24} color="#A855F7" />
                    <Text style={styles.compCardHeaderTitle}>Western Compatibility</Text>
                  </View>
                  <Text style={styles.compCardSubtitle}>Sun Signs: {currentUserAstro?.western_sign || 'User'} ♋ & {(compProfile as any)?.zodiac_sign || (compProfile as any)?.western_sign || 'Aquarius'} ♒</Text>
                  <Text style={[styles.compCardBody, { fontSize: 15, lineHeight: 22 }]}>{(compProfile as any)?.western_report}</Text>
                </View>
              )}

              {/* Indian Insight Section - Only show if recommendation exists */}
              {!!(compProfile as any)?.indian_recommendation && (
                <View style={{ paddingHorizontal: 20, marginTop: 32 }}>
                  <View style={styles.compCardHeaderRow}>
                    <MaterialIcons name="nightlight-round" size={24} color="#EC4899" />
                    <Text style={styles.compCardHeaderTitle}>Indian Compatibility</Text>
                  </View>
                  <Text style={styles.compCardSubtitle}>Moons: {currentUserAstro?.indian_sign || 'User'} ♓ & {(compProfile as any)?.indian_sign || 'Kumbha'} ♒</Text>
                  <Text style={[styles.compCardBody, { fontSize: 15, lineHeight: 22 }]}>{(compProfile as any)?.indian_recommendation}</Text>
                </View>
              )}

              <View style={{ height: 120 }} />
            </ScrollView>

            {/* Locked Footer - Only show if astrological details are missing or incomplete */}
            {(!(compProfile as any)?.western_report && !(compProfile as any)?.indian_recommendation) && (
              <View style={styles.compFooterBar}>
                <MaterialIcons name="lock" size={18} color="rgba(255,255,255,0.6)" style={{ marginRight: 8, marginTop: 2 }} />
                <Text style={styles.compFooterText}>{compProfile?.name || 'User'} needs to add more information to reveal your complete compatibility.</Text>
              </View>
            )}
          </View>
        </LinearGradient>
      </Modal>

      {/* Upgrade Sheet Modal */}
      <Modal
        visible={showUpgradeSheet}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowUpgradeSheet(false)}
      >
        <View style={styles.upgradeSheetOverlay}>
          <View style={styles.upgradeSheetContainer}>
            {upgradeReason === 'likes' ? (
              <>
                <Text style={styles.upgradeSheetTitle}>❤️ Daily Likes Used Up</Text>
                <Text style={styles.upgradeSheetMessage}>
                  You've used all your free daily likes. Upgrade to Astro+ or AstroX for unlimited likes.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.upgradeSheetTitle}>⭐ Shooting Stars Used Up</Text>
                <Text style={styles.upgradeSheetMessage}>
                  You've used all your Shooting Stars for today. Upgrade to Astro+ or AstroX for more.
                </Text>
              </>
            )}
            <TouchableOpacity
              style={styles.upgradeButton}
              onPress={() => {
                setShowUpgradeSheet(false);
                router.push('/subscription');
              }}
            >
              <Text style={styles.upgradeButtonText}>View Plans</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowUpgradeSheet(false)}
            >
              <Text style={styles.cancelButtonText}>Not Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Report Reason Modal */}
      <Modal
        visible={showReportReasonModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isSubmittingReport) {
            setShowReportReasonModal(false);
            setReportingProfile(null);
          }
        }}
      >
        <View style={styles.reportModalOverlay}>
          <View style={styles.reportModalCard}>
            <View style={styles.reportModalHeader}>
              <Text style={styles.reportModalTitle}>
                Report {reportingProfile?.name || 'this user'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  if (!isSubmittingReport) {
                    setShowReportReasonModal(false);
                    setReportingProfile(null);
                  }
                }}
                disabled={isSubmittingReport}
              >
                <MaterialIcons name="close" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.reportModalSubtitle}>
              Select a reason. This will be saved in backend for review.
            </Text>

            {reportReasons.map((reason) => (
              <TouchableOpacity
                key={reason}
                style={styles.reportReasonItem}
                activeOpacity={0.8}
                onPress={() => void submitReport(reason)}
                disabled={isSubmittingReport}
              >
                <Text style={styles.reportReasonText}>{reason}</Text>
              </TouchableOpacity>
            ))}

            {isSubmittingReport ? (
              <View style={styles.reportSubmittingRow}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.reportSubmittingText}>Saving report...</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* Removed like animation hearts */}

      {/* Removed missed match popup */}

      {/* Removed like/dislike action buttons */}

      {/* One-time swipe tutorial overlay */}
      {showTutorial && (
        <SwipeTutorialOverlay onDismiss={() => setShowTutorial(false)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0D0618',
  },
  topNavContainer: {
    ...StyleSheet.absoluteFillObject,
    height: 120,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
    marginTop: 0,
    zIndex: 100,
  },
  topNavIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(13, 6, 24, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.25)',
  },
  bellBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    borderWidth: 1.5,
    borderColor: 'rgba(13, 6, 24, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  bellBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  bottomOverlayGradientContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 220,
    zIndex: 9,
  },
  profileStackWrapper: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-start',
  },
  nextProfileWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  currentProfileWrapper: {
    zIndex: 2,
  },

  // Compatibility Detail Modal
  compModalOverlayFullscreen: {
    flex: 1,
  },
  compHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    marginBottom: 20,
    zIndex: 10,
  },
  compIconBtn: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  compAppTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  compAppTitle: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
    opacity: 0.9,
  },
  compMainTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
  },
  compAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  compSectionTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  compSparkGrid: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 24,
    marginBottom: 32,
  },
  compSparkCol: {
    flex: 1,
  },
  compSparkLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 8,
  },
  compSparkBarContainer: {
    height: 8,
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
  },
  compSparkBarFill: {
    height: '100%',
    backgroundColor: '#EC4899',
    borderRadius: 4,
  },
  compCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  compCardHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  compCardSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginBottom: 12,
  },
  compCardBody: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  compFooterBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    flexDirection: 'row',
    padding: 20,
    paddingBottom: 40,
    alignItems: 'flex-start',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  compFooterText: {
    color: '#FFFFFF',
    flex: 1,
    lineHeight: 20,
    fontSize: 14,
  },

  // Upgrade Sheet Modal
  upgradeSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  upgradeSheetContainer: {
    backgroundColor: '#1a0d2e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    alignItems: 'center',
  },
  upgradeSheetTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  upgradeSheetMessage: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginBottom: 24,
  },
  upgradeSheetRemainingText: {
    fontSize: 13,
    color: '#FBBF24',
    textAlign: 'center',
    fontWeight: '600',
    marginTop: -16,
    marginBottom: 20,
  },
  upgradeButton: {
    backgroundColor: '#A855F7',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 30,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    fontWeight: 'bold',
  },

  // Report Modal
  reportModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  reportModalCard: {
    width: '100%',
    backgroundColor: '#1A0B2E',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  reportModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reportModalTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '700',
  },
  reportModalSubtitle: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    marginTop: 8,
    marginBottom: 14,
    lineHeight: 18,
  },
  reportReasonItem: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  reportReasonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  reportSubmittingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    gap: 8,
  },
  reportSubmittingText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
  },

  // Prompt targeted liking comment modal styles
  promptLikeModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  promptLikeModalContent: {
    width: '100%',
    backgroundColor: '#1C0F38',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(168, 85, 247, 0.35)',
    padding: 24,
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    gap: 16,
  },
  promptLikeModalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  promptLikeQuestionBox: {
    backgroundColor: '#13082B',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.25)',
  },
  promptLikeQuestionText: {
    color: '#EC4899',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  promptLikeInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    padding: 16,
    color: '#FFFFFF',
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  promptLikeButtonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  promptLikeBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  promptLikeCancelBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  promptLikeSendBtn: {
    backgroundColor: '#C084FC',
  },
  promptLikeBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
