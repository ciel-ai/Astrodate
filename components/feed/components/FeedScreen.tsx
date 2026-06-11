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
} from '../utils/profileHelpers';

const { width: STATIC_WIDTH, height: STATIC_HEIGHT } = Dimensions.get('window');
// Tab bar: 60 height + marginBottom (28 iOS / 20 Android)
const TAB_BAR_OFFSET = Platform.OS === 'ios' ? 88 : 80;
// Responsively adjust card height based on screen size
const CARD_HEIGHT = Math.round(STATIC_HEIGHT * (STATIC_HEIGHT < 750 ? 0.72 : 0.75));
// Give the action buttons a bit more breathing room on small screens
const ACTION_BUTTONS_BOTTOM = TAB_BAR_OFFSET + (STATIC_HEIGHT < 750 ? 12 : 20);

const AnimatedBlurView = createAnimatedComponent(BlurView);
const AnimatedMaterialIcons = createAnimatedComponent(MaterialIcons);
const AnimatedFontAwesome = createAnimatedComponent(FontAwesome);
const AnimatedIonicons = createAnimatedComponent(Ionicons);
const AnimatedPressable = createAnimatedComponent(Pressable);

const SWIPE_THRESHOLD = 90;

type Profile = {
  id: string | number;
  name: string;
  age?: number;
  location?: string;
  image: any;
  photos?: { uri: string }[];
  compatibility?: number;
  indian_score?: number;
  western_score?: number;
  personality_score?: number;
  indian_recommendation?: string | null;
  western_report?: string | null;
  about_me?: string;
  interests?: string[];
  western_sign?: string;
  indian_sign?: string;
  sun_sign_harmony?: string;
  moon_sign_alignment?: string;
  final_score?: number;
  looking_for?: string;
  relationship_status?: string;
  hobbies?: string[];
  height?: string;
  introvert_extrovert?: string;
  partner_preference?: string[];
  gender?: string;
  gender_detail?: string;
  personality_detail?: {
    date_type?: string[];
    unusual_foods?: string;
    conversations?: string;
    planning_style?: string;
    commitments?: string;
    workspace?: string;
    spend_time?: string;
    energy_level?: string;
    partner_energy?: string;
    arguments?: string;
    show_care?: string;
    partner_type?: string;
    late_reply?: string;
    emotional_handling?: string;
    overthink?: string;
  };
};

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

  const [isFlipped, setIsFlipped] = useState(false);
  const [currentProfileIndex, setCurrentProfileIndex] = useState(0);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [showCompatibilityModal, setShowCompatibilityModal] = useState(false);
  const [compProfile, setCompProfile] = useState<Profile | null>(null);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchedProfile, setMatchedProfile] = useState<Profile | null>(null);
  const [matchedUserId, setMatchedUserId] = useState<string | null>(null);
  const [dailyPick, setDailyPick] = useState<DailyPick | null>(null);

  // Cache for astrology tables
  const [astroTables, setAstroTables] = useState<{ western: any[], indian: any[] }>({ western: [], indian: [] });
  const astroTablesRef = useRef<{ western: any[], indian: any[] }>({ western: [], indian: [] });
  // Store current user's astro details for accurate comparison
  const [currentUserAstro, setCurrentUserAstro] = useState<any>(null);
  const currentUserAstroRef = useRef<any>(null);
  const [currentUserPhoto, setCurrentUserPhoto] = useState<any>(require('@/assets/images/avatar-placeholder.png'));
  const [superlikedProfiles, setSuperlikedProfiles] = useState<Set<string>>(new Set());
  const [selectedInsightTab, setSelectedInsightTab] = useState<'western' | 'indian'>('western');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isMovingForward, setIsMovingForward] = useState(true);
  const [profilePhotoIndex, setProfilePhotoIndex] = useState<Record<string, number>>({});
  const [currentUserInterest, setCurrentUserInterest] = useState<string[] | undefined>(undefined);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showReportReasonModal, setShowReportReasonModal] = useState(false);
  const [showUpgradeSheet, setShowUpgradeSheet] = useState(false);
  const [superLikesRemaining, setSuperLikesRemaining] = useState<number | null>(null);
  const [reportingProfile, setReportingProfile] = useState<Profile | null>(null);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [reportedUserIds, setReportedUserIds] = useState<Set<string>>(new Set());
  const [isFallbackFeed, setIsFallbackFeed] = useState(false);
  // Astro Events banner
  const [activeAstroEvent, setActiveAstroEvent] = useState<AstroEvent | null>(null);

  // Match modal icebreaker (fetched from DB after match fires)
  const [matchIcebreaker, setMatchIcebreaker] = useState<string | null>(null);
  const [matchAstroScore, setMatchAstroScore] = useState<number | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);

  // ── Swipe tutorial ──────────────────────────────────────────────────────────
  const [showTutorial, setShowTutorial] = useState(false);
  const tutorialCheckedRef = useRef(false);

  const rotateY = useSharedValue(0);
  const lastScrollY = useSharedValue(0);
  const { isHidden: isTabBarHidden, setHidden: setTabBarHidden } = useTabBarVisibility();
  const scrollY = useSharedValue(0);
  const isTabBarHiddenShared = useSharedValue(isTabBarHidden);
  const parallaxScrollRef = useAnimatedRef<Animated.ScrollView>();
  const nextCardBlur = useSharedValue(0);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(1);
  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);

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

  // Fetch remaining super-likes for the badge
  const fetchSuperLikesRemaining = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await (supabase.rpc as any)('get_super_likes_remaining', { p_user_id: user.id });
      if (!error && data !== null) setSuperLikesRemaining(data as number);
    } catch (err) {
      console.error('Error fetching super likes remaining:', err);
    }
  }, []);

  useEffect(() => {
    void fetchSuperLikesRemaining();
  }, [fetchSuperLikesRemaining]);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || !mounted) return;
      supabase
        .from('notification_delivery_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .in('status', ['sent', 'pending'])
        .then(({ count }) => {
          if (mounted) setUnreadCount(count ?? 0);
        });
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const photosResult = await getUserPhotos();
        if (mounted && photosResult.success && photosResult.data) {
          const primary = photosResult.data.find((p: any) => p.is_primary) || photosResult.data[0];
          if (primary?.photo_url && mounted) setCurrentUserPhoto({ uri: primary.photo_url });
        }
      } catch (error) { console.error('Error fetching current user photo:', error); }
    })();

    // Fetch full astrology tables and current user astro
    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.user?.id) {
          const { data: astroData } = await supabase.from('astro_details')
            .select('*').eq('user_id', sessionData.session.user.id).single();
          if (mounted && astroData) {
            setCurrentUserAstro(astroData);
            currentUserAstroRef.current = astroData;
          }
        }

        const [wRes, iRes] = await Promise.all([
          supabase.from('western_zodiac_compatibility').select('*'),
          supabase.from('Indian_zodiac_match_scores').select('*')
        ]);

        if (mounted) {
          const tables = { western: wRes.data || [], indian: iRes.data || [] };
          setAstroTables(tables);
          astroTablesRef.current = tables;
        }
      } catch (e) {
        console.error('Error fetching astrology match tables:', e);
      }
    })();

    // Load active astro event for the dynamic banner
    (async () => {
      try {
        const events = await getActiveAstroEvents();
        if (mounted && events.length > 0) {
          setActiveAstroEvent(events[0]); // Show the first active event
        }
      } catch (e) {
        console.warn('[index] Could not load astro events:', e);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (profiles.length === 0) return;
    const prefetchImages = async () => {
      const primaryCovers = profiles.map(p => typeof p.image === 'string' ? p.image : (p.image as any)?.uri).filter(Boolean);
      if (primaryCovers.length > 0) Image.prefetch(primaryCovers).catch(() => { });

      const range = 5;
      const upcoming = profiles.slice(currentProfileIndex, currentProfileIndex + range);
      const albumUris: string[] = [];
      upcoming.forEach(p => {
        if (p.photos) p.photos.forEach(ph => ph.uri && albumUris.push(ph.uri));
      });
      if (albumUris.length > 0) Image.prefetch(albumUris).catch(() => { });
    };
    prefetchImages();
  }, [profiles, currentProfileIndex]);

  useEffect(() => {
    const currentProfile = profiles[currentProfileIndex];
    if (currentProfile?.id) {
      signalViewProfile(String(currentProfile.id));
      startViewLongTimer(String(currentProfile.id));
    }
    return () => {
      if (currentProfile?.id) stopViewLongTimer(String(currentProfile.id));
    };
  }, [currentProfileIndex, profiles]);

  const mapMatchesToProfiles = useCallback(async (results: any[]): Promise<Profile[]> => {
    if (!results || results.length === 0) return [];
    const userIds = results.map(m => m.match_user_id).filter(Boolean);
    if (userIds.length === 0) return [];

    try {
      const [photosBatch, astroBatch, section1Batch, onboardingBatch, personalityBatch] = await Promise.all([
        (supabase.rpc as any)('get_user_photos_batch', { p_user_ids: userIds }),
        supabase.from('astro_details').select('*').in('user_id', userIds),
        supabase.from('section1_qns').select('*').in('user_id', userIds),
        supabase.from('onboarding_responses').select('*').in('user_id', userIds),
        supabase.from('personality_qns').select('*').in('user_id', userIds),
      ]);

      const allPhotos: { user_id: string; photo_url: string; is_primary: boolean }[] = photosBatch.data || [];
      const allAstro = astroBatch.data || [];
      const allSection1 = section1Batch.data || [];
      const allOnboarding = onboardingBatch.data || [];
      const allPersonality = personalityBatch.data || [];

      return results.map((m: any, idx: number) => {
        const userId = m.match_user_id;
        const userPhotos = allPhotos.filter(p => p.user_id === userId);
        const astroData = allAstro.find(a => a.user_id === userId);
        const section1Data = allSection1.find(s => s.user_id === userId);
        const onboardingData = allOnboarding.find(o => o.user_id === userId);
        const personalityData = allPersonality.find(p => p.user_id === userId);

        let primaryPhoto = null;
        let photos: { uri: string }[] = [];

        if (userPhotos.length > 0) {
          const primary = userPhotos.find(p => p.is_primary) || userPhotos[0];
          if (primary?.photo_url) primaryPhoto = { uri: primary.photo_url };
          photos = userPhotos.map(p => ({ uri: p.photo_url }));
        }

        const rawPersonality = m.personality_score != null ? Number(m.personality_score) : undefined;
        const personality = rawPersonality === undefined ? undefined : rawPersonality <= 1 ? rawPersonality * 100 : rawPersonality;

        let interests: string[] = [];
        if (onboardingData?.interests) {
          try { interests = typeof onboardingData.interests === 'string' ? JSON.parse(onboardingData.interests) : Array.isArray(onboardingData.interests) ? onboardingData.interests : []; }
          catch { interests = []; }
        }

        return {
          id: userId ?? idx,
          name: m.full_name ?? 'Match',
          age: m.age ?? undefined,
          location: m.location ?? undefined,
          image: primaryPhoto || require('@/assets/images/avatar-placeholder.png'),
          photos: photos.length > 0 ? photos : undefined,
          compatibility: Number(m.final_match_score ?? 0),
          indian_score: m.indian_score != null ? Number(m.indian_score) : undefined,
          western_score: m.western_score != null ? Number(m.western_score) : undefined,
          personality_score: personality,
          indian_recommendation: m.indian_recommendation ?? null,
          western_report: m.western_report ?? null,
          final_score: m.final_match_score != null ? Number(m.final_match_score) : undefined,
          about_me: onboardingData?.about_me || undefined,
          interests,
          western_sign: astroData?.western_sign || undefined,
          indian_sign: astroData?.indian_sign || undefined,
          looking_for: section1Data?.looking_for || undefined,
          relationship_status: section1Data?.relationship_status || undefined,
          hobbies: section1Data?.hobbies ? (Array.isArray(section1Data.hobbies) ? section1Data.hobbies : []) : undefined,
          height: section1Data?.height || undefined,
          introvert_extrovert: section1Data?.introvert_extrovert || undefined,
          partner_preference: section1Data?.partner_preference ? (Array.isArray(section1Data.partner_preference) ? section1Data.partner_preference : []) : undefined,
          gender: m.gender || undefined,
          personality_detail: personalityData ? {
            date_type: personalityData.what_type_of_date_excites_you_the_most || undefined,
            unusual_foods: personalityData.how_do_you_feel_about_trying_unusual_foods_or_activities || undefined,
            conversations: personalityData.what_kind_of_conversations_do_you_enjoy_with_a_partner || undefined,
            planning_style: personalityData.what_best_describes_your_planning_style || undefined,
            commitments: personalityData.how_do_you_handle_commitments_in_a_relationship || undefined,
            workspace: personalityData.your_room_or_workspace_usually_looks_like || undefined,
            spend_time: personalityData.your_ideal_way_to_spend_time_with_a_partner || undefined,
            energy_level: personalityData.your_energy_level_on_dates_is_usually || undefined,
            partner_energy: personalityData.you_prefer_a_partner_who_is || undefined,
            arguments: personalityData.during_arguments_you_usually || undefined,
            show_care: personalityData.how_do_you_show_care_in_a_relationship || undefined,
            partner_type: personalityData.what_kind_of_partner_are_you || undefined,
            late_reply: personalityData.when_your_partner_replies_late_you_feel || undefined,
            emotional_handling: personalityData.how_do_you_handle_emotional_ups_and_downs || undefined,
            overthink: personalityData.how_often_do_you_overthink_relationships || undefined,
          } : undefined
        };
      });
    } catch (error) {
      console.error('❌ Error during batch profile load:', error);
      return [];
    }
  }, []);

  // Removed duplicated animation values (pinned at the top of component)


  const loadDiscoverProfiles = useCallback(async () => {
    try {
      setLoadingProfiles(true);
      const [highQualityMatchesResult, section1Response, discoveryPrefs, reportedResult] = await Promise.all([
        fetchFinalMatches(),
        getSection1Responses(),
        getDiscoveryPreferences(),
        getReportedUserIds(),
      ]);

      const highQualityMatches = highQualityMatchesResult.data;
      setIsFallbackFeed(highQualityMatchesResult.isFallback);

      const reportedSet = new Set<string>((reportedResult.success ? reportedResult.data : []) || []);
      setReportedUserIds(reportedSet);

      const interest = section1Response.success && section1Response.data?.interest ? section1Response.data.interest : undefined;
      setCurrentUserInterest(interest);

      // Normalize null → undefined to satisfy FinalMatchResult type
      const normalizedMatches: FinalMatchResult[] = highQualityMatches.map((u: any) => ({
        ...u,
        personality_vector: u.personality_vector ?? undefined,
        indian_recommendation: u.indian_recommendation ?? undefined,
        western_report: u.western_report ?? undefined,
      }));

      const filteredHighQualityMatches = normalizedMatches
        .filter((u: FinalMatchResult) => !reportedSet.has(String(u.match_user_id || '')))
        .filter((u: FinalMatchResult) => candidateMatchesInterest(u, interest))
        .filter((u: FinalMatchResult) => candidateWithinDiscoveryPreferences(u, discoveryPrefs));

      const baseHighQualityMatches = filteredHighQualityMatches.length > 0
        ? filteredHighQualityMatches
        : normalizedMatches
          .filter((u: FinalMatchResult) => !reportedSet.has(String(u.match_user_id || '')))
          .filter((u: FinalMatchResult) => candidateWithinDiscoveryPreferences(u, discoveryPrefs));

      // Scores (western_score, indian_score, western_report, indian_recommendation) are
      // already computed server-side by get_final_matches / get_fallback_feed RPCs.
      const nonReportedFinalResults = baseHighQualityMatches.filter(
        (u) => !reportedSet.has(String((u as any)?.match_user_id || ''))
      );

      if (nonReportedFinalResults.length > 0) {
        const mapped = await mapMatchesToProfiles(nonReportedFinalResults);
        setProfiles(mapped);
      } else {
        setProfiles([]);
      }

      getMyDailyPick().then(setDailyPick).catch(() => { });
    } catch (e) {
      console.error('Failed to load matches:', e);
      setProfiles([]);
    } finally {
      setLoadingProfiles(false);
      // Show one-time swipe tutorial on first feed load
      if (!tutorialCheckedRef.current) {
        tutorialCheckedRef.current = true;
        AsyncStorage.getItem('hasSeenSwipeTutorial').then((seen) => {
          if (!seen) setShowTutorial(true);
        }).catch(() => {});
      }
    }
  }, [mapMatchesToProfiles]); // stable — astro data read from refs, not state

  useFocusEffect(
    useCallback(() => {
      void loadDiscoverProfiles();
    }, [loadDiscoverProfiles])
  );

  // Check for superlikes when profiles change
  useEffect(() => {
    if (profiles.length === 0) return;

    (async () => {
      const superlikedSet = new Set<string>();

      // Check each profile to see if they superliked the current user
      await Promise.all(
        profiles.map(async (profile) => {
          const userId = String(profile.id);
          if (!userId) return;

          try {
            const result = await hasUserSuperlikedMe(userId);
            if (result.success && result.isSuperliked) {
              superlikedSet.add(userId);
            }
          } catch (error) {
            console.error(`Error checking superlike for user ${userId}:`, error);
          }
        })
      );

      setSuperlikedProfiles(superlikedSet);
    })();
  }, [profiles]);

  // Realtime subscription for new users completing onboarding
  useEffect(() => {
    let mounted = true;
    let channel: any = null;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mounted) return;

      // Defensive cleanup: remove any stale onboarding channels that may still be subscribed.
      removeFeedChannelsByTopicPrefix(supabase, 'new-onboarding-completions');

      // Subscribe to new photos being uploaded (indicates potential onboarding completion)
      const channelName = `new-onboarding-completions-${user.id}-${Date.now()}`;
      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'user_photos',
          },
          async (payload) => {
            if (!mounted) return;

            const newPhotoUserId = (payload.new as any).user_id;

            // Don't add current user's own profile
            if (newPhotoUserId === user.id) {
              return;
            }

            // Never re-add users this user has already reported
            if (reportedUserIds.has(newPhotoUserId)) {
              return;
            }

            // Check if this user has completed onboarding
            const isComplete = await hasCompletedOnboarding(newPhotoUserId);
            if (!isComplete) {
              return;
            }

            // Fetch this user's match data and add to list
            try {
              const results = await fetchFinalMatches();
              const newUserMatch = results.data.find((m: any) => m.match_user_id === newPhotoUserId);

              if (newUserMatch && mounted) {
                if (!candidateMatchesInterest(newUserMatch, currentUserInterest)) {
                  return;
                }

                const newProfile = await mapMatchesToProfiles([newUserMatch]);

                if (newProfile.length > 0 && mounted) {
                  setProfiles((current) => {
                    // Check if this user is already in the profiles list
                    const existingProfile = current.find((p) => p.id === newPhotoUserId);
                    if (existingProfile) {
                      return current;
                    }
                    return [...current, newProfile[0]];
                  });
                }
              }
            } catch (error) {
              console.error('Error fetching new user profile:', error);
            }
          }
        )
        .subscribe();
      trackRealtimeChannel(channel);
    })();

    return () => {
      mounted = false;
      if (channel) {
        cleanupFeedChannel(supabase, channel);
      }
    };
  }, [mapMatchesToProfiles, currentUserInterest, reportedUserIds]);

  useEffect(() => {
    isTabBarHiddenShared.value = isTabBarHidden;
  }, [isTabBarHidden, isTabBarHiddenShared]);

  // Fetch current user's primary photo for compatibility display
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const photosResult = await getUserPhotos(user.id);
          if (photosResult.success && photosResult.data) {
            const primary = photosResult.data.find((p: any) => p.is_primary) || photosResult.data[0];
            if (primary?.photo_url) {
              setCurrentUserPhoto({ uri: primary.photo_url });
            }
          }
        }
      } catch (error) {
        console.error('Error fetching current user photo:', error);
      }
    })();
  }, []);


  // Removed missed-match popup logic

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


  const checkAndShowMatch = useCallback(async (likedUserId: string, profile: Profile) => {
    try {
      const result = await checkMutualLike(likedUserId);
      if (result.isMatch) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        setMatchedProfile(profile);
        setMatchedUserId(String(likedUserId));
        setMatchId(result.matchData?.id ?? null);

        // Fetch synastry score and icebreaker in background — don't block modal open
        const { data: sessionData } = await supabase.auth.getSession();
        const currentUserId = sessionData?.session?.user?.id;

        if (currentUserId) {
          // AstroScore ring
          getSynastryDetail(currentUserId, likedUserId).then(({ data }) => {
            if (data) setMatchAstroScore(derivedAstroScore(data));
          }).catch(() => { });
        }

        // Icebreaker — wait a beat so the background write has a head start
        if (result.matchData?.id) {
          setTimeout(async () => {
            const text = await getIcebreakerForMatch(result.matchData.id);
            setMatchIcebreaker(text);
          }, 1500);
        }

        setShowMatchModal(true);
      }
    } catch (error) {
      console.error('Error checking for match:', error);
    }
  }, []);

  const handleSendMessageFromMatchModal = useCallback(async () => {
    const chatUserId = matchedUserId || (matchedProfile?.id ? String(matchedProfile.id) : null);

    setShowMatchModal(false);
    setMatchedProfile(null);
    setMatchedUserId(null);
    setMatchIcebreaker(null);
    setMatchAstroScore(null);
    setMatchId(null);

    if (!chatUserId) return;

    // Ensure match row/channel exists before opening the chat screen.
    await checkMutualLike(chatUserId);

    router.push({
      pathname: '/chat/[id]/index' as any,
      params: { id: chatUserId },
    });
  }, [matchedProfile, matchedUserId, router]);

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

  const handleLike = useCallback(async () => {
    if (isFlipped || isTransitioning || profiles.length === 0 || currentProfileIndex >= profiles.length) return;

    setIsTransitioning(true);

    // Immediate visual and physical feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setNextCardBlurActive();

    // Start animation immediately (Optimistic UI)
    const toX = SCREEN_WIDTH + 120;
    translateX.value = withTiming(toX, { duration: 220 }, (finished) => {
      if (finished) {
        runOnJS(updateProfileIndex)();
      }
    });
    translateY.value = withTiming(translateY.value + 20, { duration: 220 });
    opacity.value = withTiming(0, { duration: 200 });

    const currentProfile = profiles[currentProfileIndex];
    const likedUserId = currentProfile?.id ? String(currentProfile.id) : undefined;

    // Save like to database in background
    if (likedUserId) {
      try {
        const result = await saveUserLike(likedUserId, 'like');
        if (result.success) {
          signalLike(likedUserId);
          await checkAndShowMatch(likedUserId, currentProfile);
        } else if (result.error === 'THE_USER_NO_LONGER_EXISTS') {
          console.warn(`⚠️ User ${likedUserId} no longer exists.`);
        }
      } catch (error) {
        console.error('Error in handleLike backend:', error);
      }
    }
  }, [isFlipped, isTransitioning, profiles, currentProfileIndex, checkAndShowMatch, updateProfileIndex, resetNextCardBlur, setNextCardBlurActive, SCREEN_WIDTH, translateX, translateY, opacity]);

  const handleDislike = useCallback(async () => {
    if (isFlipped || isTransitioning || profiles.length === 0 || currentProfileIndex >= profiles.length) return;

    setIsTransitioning(true);

    // Immediate visual and physical feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setNextCardBlurActive();

    // Start animation immediately (Optimistic UI)
    const toX = -(SCREEN_WIDTH + 120);
    translateX.value = withTiming(toX, { duration: 220 }, (finished) => {
      if (finished) {
        runOnJS(updateProfileIndex)();
      }
    });
    translateY.value = withTiming(translateY.value + 20, { duration: 220 });
    opacity.value = withTiming(0, { duration: 200 });

    const currentProfile = profiles[currentProfileIndex];
    const likedUserId = currentProfile?.id ? String(currentProfile.id) : undefined;

    // Save dislike to database in background
    if (likedUserId) {
      try {
        const result = await saveUserLike(likedUserId, 'dislike');
        if (result.success) {
          signalDislike(likedUserId);
        }
        if (!result.success && result.error !== 'THE_USER_NO_LONGER_EXISTS') {
          console.error('Error saving dislike:', result.error);
        }
      } catch (error) {
        console.error('Error saving dislike in backend:', error);
      }
    }
  }, [isFlipped, isTransitioning, profiles, currentProfileIndex, updateProfileIndex, setNextCardBlurActive, SCREEN_WIDTH, translateX, translateY, opacity]);

  const handleSuperLike = useCallback(async () => {
    if (isFlipped || isTransitioning || profiles.length === 0 || currentProfileIndex >= profiles.length) return;

    setIsTransitioning(true);

    // Immediate visual and physical feedback
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNextCardBlurActive();

    // Start animation immediately (Optimistic UI)
    const toY = -SCREEN_WIDTH;
    translateY.value = withTiming(toY, { duration: 260 }, (finished) => {
      if (finished) {
        runOnJS(updateProfileIndex)();
      }
    });
    opacity.value = withTiming(0, { duration: 200 });

    const currentProfile = profiles[currentProfileIndex];
    const likedUserId = currentProfile?.id ? String(currentProfile.id) : undefined;

    // Save super like to database in background
    if (likedUserId) {
      try {
        const result = await saveUserLike(likedUserId, 'super_like');
        if (result.success) {
          signalSuperLike(likedUserId);
          await checkAndShowMatch(likedUserId, currentProfile);
          void fetchSuperLikesRemaining();
        } else if (result.error === 'THE_USER_NO_LONGER_EXISTS') {
          console.warn(`⚠️ User ${likedUserId} no longer exists, skipping...`);
        } else if (result.error === 'QUOTA_EXCEEDED' || result.error === 'SUPER_LIKE_QUOTA_EXCEEDED') {
          // Show upgrade sheet instead of generic error
          resetCardPosition();
          setShowUpgradeSheet(true);
          return; // do not call updateProfileIndex — keep card visible
        } else {
          console.error('Error saving super like:', result.error);
        }
      } catch (error) {
        console.error('Error in handleSuperLike backend:', error);
      }
    }
  }, [isFlipped, isTransitioning, profiles, currentProfileIndex, checkAndShowMatch, updateProfileIndex, setNextCardBlurActive, SCREEN_WIDTH, translateY, opacity, fetchSuperLikesRemaining]);

  const resetCardPosition = () => {
    'worklet';
    translateX.value = withSpring(0, { damping: 12, stiffness: 120 });
    translateY.value = withSpring(0, { damping: 12, stiffness: 120 });
    rotate.value = withSpring(0, { damping: 12, stiffness: 120 });
  };

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

  const handleScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      const currentScrollY = event.contentOffset.y;
      const scrollDiff = currentScrollY - lastScrollY.value;

      // Update scroll position for animations
      scrollY.value = currentScrollY;

      // Hide tab bar when scrolling up, show when scrolling down
      if (Math.abs(scrollDiff) > 1) {
        // Scrolling up - hide tab bar completely
        if (scrollDiff > 0 && currentScrollY > 10) {
          if (!isTabBarHiddenShared.value) {
            runOnJS(updateTabBarVisibility)(true);
          }
        }
        // Scrolling down - show tab bar
        else if (scrollDiff < 0) {
          if (isTabBarHiddenShared.value) {
            runOnJS(updateTabBarVisibility)(false);
          }
        }
        // At the top, always show tab bar
        else if (currentScrollY <= 10) {
          if (isTabBarHiddenShared.value) {
            runOnJS(updateTabBarVisibility)(false);
          }
        }
      }

      lastScrollY.value = currentScrollY;
    },
  });

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

  // Helper function to save swipe action
  const saveSwipeAction = useCallback(async (direction: 'left' | 'right') => {
    if (profiles.length === 0 || currentProfileIndex >= profiles.length) return;

    const currentProfile = profiles[currentProfileIndex];
    const likedUserId = currentProfile?.id ? String(currentProfile.id) : undefined;

    if (likedUserId) {
      const actionType = direction === 'right' ? 'like' : 'dislike';
      try {
        const result = await saveUserLike(likedUserId, actionType);
        if (result.success) {
          if (actionType === 'like') signalLike(likedUserId);
          else if (actionType === 'dislike') signalDislike(likedUserId);
        }
        if (result.success && actionType === 'like') {
          // Check for match only on like (not dislike)
          await checkAndShowMatch(likedUserId, currentProfile);
        }
      } catch (error) {
        console.error(`Error saving ${actionType} from swipe:`, error);
      }
    }
  }, [profiles, currentProfileIndex, checkAndShowMatch]);


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

  // Removed swipe complete handler (no like/dislike actions)

  // Removed like/dislike action handlers

  // Global photo tap handler wired to current profile's photoIndex
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

  const submitReport = useCallback(
    async (reason: string) => {
      if (!reportingProfile?.id || isSubmittingReport) return;

      const reportedUserId = String(reportingProfile.id);
      setIsSubmittingReport(true);

      try {
        const result = await createReport(
          reportedUserId,
          'Discover profile report',
          reason,
          `Reported from discover card for user ${reportedUserId}`
        );

        if (!result.success) {
          console.error('❌ Failed to save report:', result.error);
          return;
        }

        setProfiles((current) => {
          const filtered = current.filter((p) => String(p.id) !== reportedUserId);
          if (filtered.length === 0) {
            setCurrentProfileIndex(0);
            return filtered;
          }

          const removedBeforeCurrent = current
            .slice(0, currentProfileIndex)
            .some((p) => String(p.id) === reportedUserId);
          const nextIndex = removedBeforeCurrent
            ? Math.max(0, currentProfileIndex - 1)
            : Math.min(currentProfileIndex, filtered.length - 1);
          setCurrentProfileIndex(nextIndex);

          return filtered;
        });

        setShowReportReasonModal(false);
        setReportingProfile(null);
        setReportedUserIds((prev) => {
          const next = new Set(prev);
          next.add(reportedUserId);
          return next;
        });
      } catch (error) {
        console.error('❌ Error while reporting user:', error);
      } finally {
        setIsSubmittingReport(false);
      }
    },
    [reportingProfile, isSubmittingReport, currentProfileIndex]
  );

  const doubleTapGesture = Gesture.Tap()
    .enabled(!isFlipped && !isTransitioning)
    .numberOfTaps(2)
    .maxDelay(250)
    .onEnd((_event, success) => {
      if (success) {
        runOnJS(handleSuperLike)();
      }
    });

  const panGesture = Gesture.Pan()
    .enabled(!isFlipped && !isTransitioning)
    .activeOffsetX([-20, 20])
    .failOffsetY([-20, 20])
    .onBegin(() => {
      'worklet';
      panStartX.value = translateX.value;
      panStartY.value = translateY.value;
      nextCardBlur.value = withTiming(30, { duration: 180 });
    })
    .onUpdate((event) => {
      'worklet';
      translateX.value = panStartX.value + event.translationX;
      translateY.value = panStartY.value + event.translationY * 0.2;
      rotate.value = translateX.value / 12;
    })
    .onEnd((event) => {
      'worklet';
      const velocityX = event.velocityX;
      const shouldDismiss = Math.abs(translateX.value) > SWIPE_THRESHOLD || Math.abs(velocityX) > 800;
      if (shouldDismiss) {
        runOnJS(setIsTransitioning)(true);
        const direction = translateX.value !== 0 ? Math.sign(translateX.value) : Math.sign(velocityX || 1);
        const toX = (SCREEN_WIDTH + 120) * direction;

        // Save like/dislike based on swipe direction
        const swipeDirection = direction > 0 ? 'right' : 'left';
        runOnJS(saveSwipeAction)(swipeDirection);

        translateX.value = withTiming(toX, { duration: 220 }, (finished) => {
          if (finished) {
            runOnJS(updateProfileIndex)();
          }
        });
        translateY.value = withTiming(translateY.value + 20, { duration: 220 });
        opacity.value = withTiming(0, { duration: 200 });
      } else {
        nextCardBlur.value = withTiming(0, { duration: 150 });
        resetCardPosition();
      }
    })
    .onFinalize((_, success) => {
      'worklet';
      if (!success) {
        nextCardBlur.value = withTiming(0, { duration: 150 });
        resetCardPosition();
      }
    });

  const photoTapGesture = Gesture.Tap()
    .enabled(!isFlipped && !isTransitioning)
    .numberOfTaps(1)
    .maxDuration(250)
    .onEnd((_event, success) => {
      if (success) {
        runOnJS(handlePhotoTapGlobal)();
      }
    });

  const tapGesture = Gesture.Exclusive(doubleTapGesture, photoTapGesture);
  const composedGesture = Gesture.Race(panGesture, tapGesture);
  const swipeAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate.value}deg` },
      ] as any,
      opacity: opacity.value,
    };
  });

  // Like/Dislike/Superlike Overlay Opacities
  const likeOpacity = useDerivedValue(() => {
    return interpolate(translateX.value, [0, SCREEN_WIDTH / 4], [0, 1], 'clamp');
  });

  const dislikeOpacity = useDerivedValue(() => {
    return interpolate(translateX.value, [0, -SCREEN_WIDTH / 4], [0, 1], 'clamp');
  });

  const superLikeOpacity = useDerivedValue(() => {
    return interpolate(translateY.value, [0, -SCREEN_WIDTH / 4], [0, 1], 'clamp');
  });

  const likeOverlayStyle = useAnimatedStyle(() => ({ opacity: likeOpacity.value }));
  const dislikeOverlayStyle = useAnimatedStyle(() => ({ opacity: dislikeOpacity.value }));
  const superLikeOverlayStyle = useAnimatedStyle(() => ({ opacity: superLikeOpacity.value }));

  // Action Button Scales
  const likeButtonScale = useAnimatedStyle(() => {
    return {
      transform: [{ scale: interpolate(translateX.value, [0, SCREEN_WIDTH / 4], [1, 1.2], 'clamp') }],
    };
  });

  const dislikeButtonScale = useAnimatedStyle(() => {
    return {
      transform: [{ scale: interpolate(translateX.value, [0, -SCREEN_WIDTH / 4], [1, 1.2], 'clamp') }],
    };
  });

  const superLikeButtonScale = useAnimatedStyle(() => {
    return {
      transform: [{ scale: interpolate(translateY.value, [0, -SCREEN_WIDTH / 4], [1, 1.2], 'clamp') }],
    };
  });

  // Action Button Colors with Glow Effect
  const likeButtonColorStyle = useAnimatedStyle(() => {
    const inputValue = translateX.value;
    const thresh = 20;
    const backgroundColor = interpolateColor(inputValue, [0, thresh], ['rgba(255, 255, 255, 0.1)', '#22C55E']);
    const borderColor = interpolateColor(inputValue, [0, thresh], ['rgba(255, 255, 255, 0.25)', '#22C55E']);
    const shadowColor = interpolateColor(inputValue, [0, thresh], ['#000000', '#22C55E']);
    const shadowOpacity = interpolate(inputValue, [0, thresh], [0.2, 0.8]);
    const shadowRadius = interpolate(inputValue, [0, thresh], [6, 15]);
    const elevation = interpolate(inputValue, [0, thresh], [8, 10]);

    return { backgroundColor, borderColor, shadowColor, shadowOpacity, shadowRadius, elevation };
  });

  const dislikeButtonColorStyle = useAnimatedStyle(() => {
    const inputValue = translateX.value;
    const thresh = -20;
    const backgroundColor = interpolateColor(inputValue, [0, thresh], ['rgba(255, 255, 255, 0.1)', '#FF3B30']);
    const borderColor = interpolateColor(inputValue, [0, thresh], ['rgba(255, 255, 255, 0.25)', '#FF3B30']);
    const shadowColor = interpolateColor(inputValue, [0, thresh], ['#000000', '#FF3B30']);
    const shadowOpacity = interpolate(inputValue, [0, thresh], [0.2, 0.8]);
    const shadowRadius = interpolate(inputValue, [0, thresh], [6, 15]);
    const elevation = interpolate(inputValue, [0, thresh], [8, 10]);

    return { backgroundColor, borderColor, shadowColor, shadowOpacity, shadowRadius, elevation };
  });

  const superLikeButtonColorStyle = useAnimatedStyle(() => {
    const inputValue = translateY.value;
    const thresh = -20;
    const backgroundColor = interpolateColor(inputValue, [0, thresh], ['rgba(255, 255, 255, 0.1)', '#A855F7']);
    const borderColor = interpolateColor(inputValue, [0, thresh], ['rgba(255, 255, 255, 0.25)', '#A855F7']);
    const shadowColor = interpolateColor(inputValue, [0, thresh], ['#000000', '#A855F7']);
    const shadowOpacity = interpolate(inputValue, [0, thresh], [0.2, 0.8]);
    const shadowRadius = interpolate(inputValue, [0, thresh], [6, 15]);
    const elevation = interpolate(inputValue, [0, thresh], [8, 10]);

    return { backgroundColor, borderColor, shadowColor, shadowOpacity, shadowRadius, elevation };
  });

  const likeIconStyle = useAnimatedStyle(() => {
    const opacity = interpolate(translateX.value, [0, 20], [0.8, 1], 'clamp');
    return { color: '#FFFFFF', opacity };
  });

  const dislikeIconStyle = useAnimatedStyle(() => {
    const opacity = interpolate(translateX.value, [0, -20], [0.8, 1], 'clamp');
    return { color: '#FFFFFF', opacity };
  });

  const superLikeIconStyle = useAnimatedStyle(() => {
    const opacity = interpolate(translateY.value, [0, -20], [0.8, 1], 'clamp');
    return { color: '#FFFFFF', opacity };
  });

  // Next Card Animation
  const nextCardStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: interpolate(Math.abs(translateX.value), [0, SCREEN_WIDTH], [0.95, 1], 'clamp') },
      ],
    };
  });

  // Animated style for profile details sections - hide when scrollY is 0
  const profileDetailsAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, 50],
      [0, 1],
      'clamp'
    );
    return {
      opacity,
    };
  });

  // Animated style for action icons container - adds shadow/elevation on scroll
  // Removed action buttons animations and missed popup style

  // Animated style for individual action icons - adds shadow on scroll
  const actionIconShadowStyle = useAnimatedStyle(() => {
    const shadowOpacity = interpolate(
      scrollY.value,
      [0, 50],
      [0, 0.4],
      'clamp'
    );
    const shadowRadius = interpolate(
      scrollY.value,
      [0, 50],
      [0, 8],
      'clamp'
    );
    const elevation = interpolate(
      scrollY.value,
      [0, 50],
      [0, 6],
      'clamp'
    );
    return {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity,
      shadowRadius,
      elevation,
    };
  });

  const nextCardBlurAnimatedProps = useAnimatedProps(() => ({
    intensity: nextCardBlur.value,
    tint: 'dark' as const,
  }));

  const frontAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotateY: `${rotateY.value}deg` }],
      opacity: interpolate(rotateY.value, [0, 90, 180], [1, 0, 0]),
    };
  });

  const backAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotateY: `${rotateY.value - 180}deg` }],
      opacity: interpolate(rotateY.value, [0, 90, 180], [0, 0, 1]),
    };
  });

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
            marginHorizontal: 16,
            marginTop: insets.top + 8,
            borderRadius: 12,
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
      {isFallbackFeed && profiles.length > 0 && (
        <View style={{
          marginHorizontal: 16,
          marginTop: insets.top + 8,
          borderRadius: 12,
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
              <View key={`${String(profile.id)}-${isTop ? 'top' : 'next'}`} style={isTop ? styles.currentProfileWrapper : styles.nextProfileWrapper}>
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
            <Text style={styles.upgradeSheetTitle}>⭐ Shooting Stars Used Up</Text>
            <Text style={styles.upgradeSheetMessage}>
              You've used all your Shooting Stars. Upgrade to Stellar or Cosmic for more.
            </Text>
            {superLikesRemaining !== null && superLikesRemaining < 999 && (
              <Text style={styles.upgradeSheetRemainingText}>
                {superLikesRemaining === 0
                  ? '0 left this week'
                  : `${superLikesRemaining} left this week`}
              </Text>
            )}
            <TouchableOpacity
              style={styles.upgradeButton}
              onPress={() => {
                setShowUpgradeSheet(false);
                router.push('/(tabs)/profile');
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
    paddingTop: 60,
    zIndex: 10,
    backgroundColor: 'transparent',
    marginTop: 0,
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
  topNavCategories: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  categoryPillActive: {
    backgroundColor: '#8B5CF6',
  },
  categoryText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 15,
    fontWeight: '600',
  },
  categoryTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  overlayFull: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '55%',
    paddingBottom: 20,
    justifyContent: 'flex-end',
  },
  profileInfoContent: {
    paddingHorizontal: 18,
    paddingBottom: 4,
    gap: 7,
  },
  activeTag: {
    backgroundColor: '#E0F2FE',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeTagText: {
    color: '#0369A1',
    fontWeight: '700',
    fontSize: 12,
  },
  superlikedBadgeOnCard: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(168, 85, 247, 0.4)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 224, 138, 0.7)',
  },
  superlikedBadgeOnCardText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  nameText: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  ageText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 26,
    fontWeight: '300',
  },
  verifiedIcon: {
    marginLeft: 4,
  },
  upArrowButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(168, 85, 247, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.6)',
  },
  interestsSection: {
    marginTop: 8,
    gap: 8,
  },
  interestsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  interestsTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  interestChipText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
  },
  actionButtonSmall: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonSmallWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionIconsFixed: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: ACTION_BUTTONS_BOTTOM,
    paddingHorizontal: 40,
    zIndex: 10,
  },
  actionIconsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: STATIC_HEIGHT < 750 ? 20 : 28,
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
  actionIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
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
  customHeader: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  headerTextContainer: {
    justifyContent: 'center',
  },
  headerGreeting: {
    color: '#A1A1AA',
    fontSize: 14,
    fontWeight: '500',
  },
  headerLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  headerLocation: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  headerSearchButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  matchPillStyle: {
    position: 'absolute',
    top: 20,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 10,
  },
  matchPillTextStyle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4ADE80',
    marginTop: 6,
  },
  container: {
    flex: 1,
    paddingHorizontal: 0,
    gap: 16,
    paddingBottom: 200,
    position: 'relative',
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
  profileContentWrapper: {
    width: '100%',
    height: '100%',
  },
  profileCardContainer: {
    width: STATIC_WIDTH,
    height: STATIC_HEIGHT,
    position: 'relative',
    alignSelf: 'center',
  },
  cardWrapper: {
    width: STATIC_WIDTH,
    height: STATIC_HEIGHT,
  },
  cardFace: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    backfaceVisibility: 'hidden',
  },
  cardFront: {
    zIndex: 2,
  },
  cardBack: {
    transform: [{ rotateY: '180deg' }],
  },
  profileCard: {
    width: '100%',
    height: '100%',
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: '#0D0618',
  },
  profileImageContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  photoIndicators: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    zIndex: 10,
  },
  photoIndicatorDot: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  photoIndicatorDotActive: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 'auto',
    minHeight: '25%',
    justifyContent: 'flex-end',
    paddingBottom: 0,
  },
  nextCardBlurOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
  },
  profileInfo: {
    padding: 16,
    paddingBottom: 8,
    gap: 4,
    zIndex: 2,
    position: 'relative',
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  name: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
  },
  superlikeIcon: {
    marginLeft: 4,
  },
  superlikeBadge: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 10,
    borderWidth: 2,
    borderColor: '#FFD700',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 10,
  },
  superlikeText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: 'bold',
  },
  compatibilityBadge: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    zIndex: 10,
    borderRadius: 40,
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  compatibilityBlur: {
    padding: 4,
    borderRadius: 40,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  compatibilityScore: {
    color: '#A855F7',
    fontSize: 24,
    fontWeight: '800',
    textShadowColor: 'rgba(168, 85, 247, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  compatibilityLabel: {
    color: '#E9D5FF',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  location: {
    color: '#FFFFFF',
    fontSize: 16,
  },

  sectionCard: {
    backgroundColor: 'rgba(26, 11, 46, 0.8)',
    borderRadius: 24,
    padding: 20,
    gap: 12,
    width: '120%',
    marginLeft: -30,
  },
  photoCard: {
    width: '120%',
    marginLeft: -30,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  photoImage: {
    width: '100%',
    height: 400,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  chipPrimary: {
    backgroundColor: '#C084FC',
  },
  chipNeutral: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  chipTextOnPrimary: {
    color: '#1A0B2E',
  },
  chipTextNeutral: {
    color: '#FFFFFF',
  },
  chipIcon: {
    marginRight: 6,
  },
  galleryRow: {
    gap: 12,
    paddingVertical: 12,
  },
  galleryImage: {
    width: 220,
    height: 260,
    borderRadius: 24,
  },
  detailsCardBack: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(26, 11, 46, 0.95)',
    borderRadius: 20,
    padding: 20,
    gap: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  buttonContainer: {
    position: 'absolute',
    top: 20,
    left: 20,
    zIndex: 100,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 15,
  },
  flipBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContainer: {
    flex: 1,
    marginTop: 50,
  },
  detailsScrollView: {
    flex: 1,
  },
  detailsContent: {
    gap: 20,
    paddingBottom: 40,
    flexGrow: 1,
  },
  scoreList: {
    gap: 12,
  },
  scoreRow: {
    gap: 8,
  },
  scoreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.8,
  },
  scoreValueChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  scoreValue: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: 'bold',
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#A855F7',
    borderRadius: 3,
  },
  zodiacRow: {
    gap: 16,
  },
  zodiacCard: {
    gap: 12,
  },
  zodiacChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  zodiacLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    opacity: 0.7,
  },
  zodiacValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  zodiacDescription: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 20,
    opacity: 0.8,
    paddingHorizontal: 4,
  },

  heartIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(60, 60, 60, 1)',
    borderWidth: 1,
    borderColor: '#4ADE80',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  actionIconLarge: {
    width: 75,
    height: 75,
    borderRadius: 37.5,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(60, 60, 60, 1)',
    borderWidth: 1,
    borderColor: '#3B82F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  lightningGlow: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  lightningGlowLarge: {
    width: 75,
    height: 75,
    borderRadius: 37.5,
  },
  compatibilityCardWrapper: {
    width: '100%',
    position: 'relative',
    marginTop: 4,
  },
  compatibilityCardBehind: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  compatibilityCardFront: {
    position: 'relative',
    zIndex: 2,
  },
  compatibilityCard: {
    backgroundColor: 'rgb(55, 36, 65)',
    borderRadius: 20,
    padding: 16,
    gap: 12,
    borderWidth: 2,
    borderColor: '#A855F7',
    width: '120%',
    marginLeft: -30,
    overflow: 'hidden',
  },
  compatibilityTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    opacity: 0.8,
  },
  compatibilityContent: {
    gap: 12,
  },
  compatibilityInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  compatibilityText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  compatibilityPercentage: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  tapToView: {
    color: '#FFFFFF',
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
  },
  swipeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  swipeOverlayContent: {
    alignItems: 'center',
    gap: 8,
  },
  swipeOverlayText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  popupOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  popupContainer: {
    backgroundColor: '#1A0B2E',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    minWidth: 280,
    maxWidth: '80%',
    borderWidth: 2,
    borderColor: '#A855F7',
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 20,
  },
  popupTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 24,
    letterSpacing: 0.5,
  },
  popupButton: {
    backgroundColor: '#A855F7',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 20,
    minWidth: 120,
  },
  popupButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  matchOverlay: {
    flex: 1,
    width: '100%',
    backgroundColor: '#FFFFFF',
    position: 'relative',
  },
  matchHeartsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
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
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
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
    borderRadius: 105, // Full circle for planetary look
    backgroundColor: 'transparent',
    overflow: 'hidden',
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#FFD700', // Golden border for celestial feel
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 12,
  },
  planetarySphere: {
    // Ensuring the circle looks like a celestial body
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
  matchProfileImage: {
    width: '100%',
    height: '100%',
  },
  matchProfilePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  matchHeartIcon: {
    position: 'absolute',
    bottom: 25, // Placed precisely at the base of the planetary spheres
    left: '50%',
    marginLeft: -40,
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  matchCardHeartSmall: {
    position: 'absolute',
    top: 15,
    right: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
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
    gap: 8,
    backgroundColor: '#A855F7',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 50,
    marginHorizontal: 20,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1,
  },
  matchSendButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  sparklingHeart: {
    position: 'absolute',
    right: 20,
    top: '50%',
    zIndex: 1000,
  },
  toastText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
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
  missedPopupWrapper: {
    position: 'absolute',
    bottom: 180,
    left: 20,
    right: 20,
    zIndex: 20,
    alignItems: 'center',
  },
  missedPopupCard: {
    width: '100%',
    borderRadius: 24,
    backgroundColor: 'rgba(20, 8, 32, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(162, 85, 247, 0.5)',
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
  missedPopupTextGroup: {
    flex: 1,
    gap: 4,
  },
  missedPopupTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  missedPopupSubtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    lineHeight: 18,
  },
  chatbotFab: {
    position: 'absolute',
    bottom: 100,
    right: 16,
    zIndex: 100,
  },
  chatbotFabCard: {
    position: 'absolute',
    bottom: -15, // Pushed right to the floor
    right: -17, // Moved closer to the right edge from 25
    zIndex: 100,
  },
  chatbotLottie: {
    width: 120,
    height: 120,
  },
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
  // Profile Details Section Styles - Matching profile-details.tsx
  profileDetailsSection: {
    backgroundColor: 'transparent',
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    minHeight: 400,
    width: STATIC_WIDTH,
    alignSelf: 'center',
    marginLeft: -16,
    marginRight: -16,
  },
  profileNameSection: {
    marginBottom: 12,
  },
  profileNameText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  profileAgeText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  profileLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  profileLocationText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginLeft: 4,
  },
  // Photo Gallery Styles - Matching profile-details.tsx (edge-to-edge)
  photoGalleryContainer: {
    width: STATIC_WIDTH,
    alignSelf: 'center',
    marginLeft: -16,
    marginRight: -16,
    height: STATIC_WIDTH * 1.2,
    position: 'relative',
    backgroundColor: '#000',
    borderBottomLeftRadius: 35,
    borderBottomRightRadius: 35,
    overflow: 'hidden',
    marginTop: 16,
    marginBottom: -30,
  },
  photoGalleryPressable: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  photoGalleryWrapper: {
    width: '100%',
    height: '100%',
  },
  photoGalleryImage: {
    width: '100%',
    height: '100%',
  },
  photoGalleryPaginationContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  photoGalleryPaginationDot: {
    width: 10,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 4,
  },
  photoGalleryPaginationDotActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    width: 30,
  },
  overallCompatibilitySection: {
    marginBottom: 20,
  },
  overallCompatibilityText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 8,
  },
  overallProgressBarContainer: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  overallProgressBarFill: {
    height: '100%',
    backgroundColor: '#A855F7',
    borderRadius: 4,
  },
  circularScoresSection: {
    marginBottom: 24,
    marginTop: 8,
  },
  circularScoresSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 16,
    textAlign: 'center',
  },
  profileDetailsSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#A855F7',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  circularScoresRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    paddingHorizontal: 10,
  },
  insightsSection: {
    marginBottom: 20,
  },
  insightsPillContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 25,
    padding: 4,
    gap: 4,
  },
  insightsPillButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightsPillButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  insightsPillText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  insightsPillTextActive: {
    color: '#7C3AED',
    fontWeight: '600',
  },
  insightsContentSection: {
    marginTop: 16,
    marginBottom: 24,
  },
  insightContentText: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 22,
    fontWeight: '400',
  },
  harmonySection: {
    marginBottom: 24,
    gap: 12,
  },
  harmonyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  harmonyLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  harmonyValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  aboutMeSection: {
    marginBottom: 24,
  },
  aboutMeContent: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 22,
    fontWeight: '400',
  },

  detailsButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(60, 60, 60, 1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    alignSelf: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  detailsButtonInline: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(168, 85, 247, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 6,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  detailsGridSection: {
    marginBottom: 24,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  detailItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 12,
    minWidth: 100,
    flex: 1,
    maxWidth: '48%',
  },
  detailItemLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 4,
  },
  detailItemValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  preferencesSection: {
    marginTop: 16,
  },
  preferencesLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 8,
  },
  preferencesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  preferenceTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  preferenceText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  hobbiesSection: {
    marginTop: 16,
  },
  hobbiesLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 8,
  },
  hobbiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  hobbyTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  hobbyText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  overlayLabelContainer: {
    position: 'absolute',
    top: 40,
    zIndex: 100,
    borderWidth: 4,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  likeOverlay: {
    left: 40,
    borderColor: '#4ADE80', // Green
    backgroundColor: 'rgba(74, 222, 128, 0.2)',
    transform: [{ rotate: '-30deg' }],
  },
  dislikeOverlay: {
    right: 40,
    borderColor: '#EF4444', // Red
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    transform: [{ rotate: '30deg' }],
  },
  superLikeOverlay: {
    bottom: 100,
    alignSelf: 'center',
    borderColor: '#3B82F6', // Blue
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    transform: [{ rotate: '0deg' }],
  },
  overlayLabelText: {
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  likeLabelText: {
    color: '#4ADE80',
  },
  dislikeLabelText: {
    color: '#EF4444',
  },
  superLikeLabelText: {
    color: '#3B82F6',
  },
  zodiacRowRef: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  zodiacChipRef: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  zodiacChipActiveRef: {
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
    borderWidth: 1,
    borderColor: '#A855F7',
  },
  zodiacChipTextRef: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  zodiacChipSecondRef: {
    backgroundColor: 'rgba(236, 72, 153, 0.1)',
    borderWidth: 1,
    borderColor: '#EC4899',
  },
  zodiacChipTextSecondRef: {
    color: '#EC4899',
    fontSize: 14,
    fontWeight: '700',
  },
  zodiacChipTextActiveRef: {
    color: '#A855F7',
    fontSize: 14,
    fontWeight: '700',
  },
  zodiacChipMatchRef: {
    backgroundColor: 'rgba(255, 193, 7, 0.18)',
    borderWidth: 1.5,
    borderColor: '#FFC107',
  },
  zodiacChipTextMatchRef: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '800',
  },
  compatibilityRefBlock: {
    marginTop: 6,
    gap: 3,
  },
  compatibilityRefText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    lineHeight: 17,
  },
  compatibilityRefBold: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  viewCompatibilityRefText: {
    color: '#C084FC',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
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
  compCard: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    padding: 24,
    width: Dimensions.get('window').width * 0.85,
    marginRight: 16,
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
  compPagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 32,
  },
  compDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  compDotActive: {
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#EC4899', // Pinkish-red
    borderRadius: 4,
  },
  compElementGrid: {
    paddingHorizontal: 20,
    marginBottom: 40,
  },
  compElementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  compElementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
    gap: 12,
  },
  compElementIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  compElementBadge: {
    position: 'absolute',
    bottom: -6,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#2d1b4e',
  },
  compElementBadgeTxt: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000000',
  },
  compElementTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  compElementDesc: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
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
  superLikeCountBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#000',
  },
  superLikeCountBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 13,
  },
  upgradeSheetRemainingText: {
    fontSize: 13,
    color: '#FBBF24',
    textAlign: 'center',
    fontWeight: '600',
    marginTop: -16,
    marginBottom: 20,
  },
  profileCardScrollContent: {
    flexGrow: 1,
    backgroundColor: '#0D0618',
  },
  newProfileImageContainer: {
    width: '100%',
    height: STATIC_HEIGHT * 0.52,
    position: 'relative',
    backgroundColor: '#000000',
  },
  newProfileImage: {
    width: '100%',
    height: '100%',
  },
  newImageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '45%',
    justifyContent: 'flex-end',
    paddingBottom: 16,
  },
  newNameLocationContainer: {
    paddingHorizontal: 20,
    gap: 4,
  },
  newNameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  newNameText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  newAgeText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 24,
    fontWeight: '300',
  },
  newLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  newLocationText: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '500',
  },
  newDotSeparator: {
    color: 'rgba(203, 213, 225, 0.4)',
    marginHorizontal: 6,
    fontSize: 14,
  },
  newActiveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#4ADE80',
    marginRight: 6,
  },
  newActiveText: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '500',
  },
  constellationOverlay: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  constellationRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(168, 85, 247, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
  },
  constellationSymbol: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: 'bold',
    textShadowColor: 'rgba(168, 85, 247, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  scrollDetailsContainer: {
    paddingHorizontal: 12,
    paddingTop: 16,
    backgroundColor: '#1A0B2E',
  },
  newTagsRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 6,
    marginBottom: 14,
  },
  newTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  purpleTag: {
    backgroundColor: 'rgba(168, 85, 247, 0.12)',
    borderColor: 'rgba(168, 85, 247, 0.45)',
  },
  pinkTag: {
    backgroundColor: 'rgba(236, 72, 153, 0.12)',
    borderColor: 'rgba(236, 72, 153, 0.45)',
  },
  newTagText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  newCosmicMatchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 11, 46, 0.7)',
    borderWidth: 1.5,
    borderColor: 'rgba(168, 85, 247, 0.25)',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  cosmicLeftCol: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  cosmicCenterCol: {
    flex: 1,
    marginLeft: 14,
    marginRight: 8,
  },
  cosmicMatchTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 3,
  },
  cosmicMatchDesc: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  cosmicRightCol: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cosmicLottie: {
    width: 60,
    height: 60,
  },
  aboutCardFullWidth: {
    backgroundColor: 'rgba(26, 11, 46, 0.7)',
    borderWidth: 1.5,
    borderColor: 'rgba(168, 85, 247, 0.25)',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 20,
    position: 'relative',
  },
  aboutCardHalf: {
    backgroundColor: 'rgba(26, 11, 46, 0.7)',
    borderWidth: 1.5,
    borderColor: 'rgba(168, 85, 247, 0.25)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 14,
    position: 'relative',
    minHeight: 180,
  },
  aboutBodyFullWidth: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    marginBottom: 24,
  },
  newMoreButtonFullWidth: {
    position: 'absolute',
    bottom: 16,
    right: 20,
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.3)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: 'rgba(168, 85, 247, 0.06)',
  },
  newMoreButtonHalf: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.3)',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(168, 85, 247, 0.06)',
  },
  interestsCardFullWidth: {
    backgroundColor: 'rgba(26, 11, 46, 0.7)',
    borderWidth: 1.5,
    borderColor: 'rgba(168, 85, 247, 0.25)',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  interestsCardHalf: {
    backgroundColor: 'rgba(26, 11, 46, 0.7)',
    borderWidth: 1.5,
    borderColor: 'rgba(168, 85, 247, 0.25)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 14,
    minHeight: 180,
  },
  interestsWrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  newCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  newCardHeaderText: {
    color: '#C084FC',
    fontSize: 14,
    fontWeight: '700',
  },
  newAboutBody: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '400',
  },
  newMoreButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.3)',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(168, 85, 247, 0.06)',
  },
  newMoreButtonText: {
    color: '#C084FC',
    fontSize: 11,
    fontWeight: '700',
  },
  newInterestsGrid: {
    width: '100%',
    flexDirection: 'column',
    gap: 6,
  },
  interestsChipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  newInterestItemChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.25)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 5,
    justifyContent: 'flex-start',
    alignSelf: 'flex-start',
  },
  newInterestItemText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
  mockupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
    backgroundColor: '#13072E',
  },
  mockupHeaderLeft: {
    flex: 1,
    gap: 4,
  },
  mockupNameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  mockupNameText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  mockupAgeText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '400',
  },
  mockupLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  mockupLocationText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '500',
  },
  mockupDotSeparator: {
    color: 'rgba(255, 255, 255, 0.4)',
    marginHorizontal: 8,
    fontSize: 16,
  },
  mockupZodiacBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mockupZodiacSymbol: {
    fontSize: 16,
    color: '#C084FC',
  },
  mockupZodiacText: {
    color: '#C084FC',
    fontSize: 14,
    fontWeight: '600',
  },
  mockupMatchPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#C084FC',
    backgroundColor: 'rgba(192, 132, 252, 0.1)',
  },
  mockupMatchPillText: {
    color: '#C084FC',
    fontSize: 13,
    fontWeight: '700',
  },
  mockupFlowContainer: {
    paddingHorizontal: 16,
    gap: 16,
  },
  mockupPhotoContainer: {
    width: '100%',
    height: STATIC_HEIGHT * 0.45,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  mockupPhotoContainerFull: {
    width: '100%',
    height: STATIC_HEIGHT * 0.65,
    position: 'relative',
    backgroundColor: '#000000',
  },
  mockupPhotoOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 40,
  },
  mockupPhotoOverlayContent: {
    gap: 8,
  },
  mockupMatchPillOverlay: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  bottomOverlayGradientContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 220,
    zIndex: 9,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ADE80',
    marginRight: 6,
  },
  activeText: {
    color: '#4ADE80',
    fontSize: 13,
    fontWeight: '600',
  },
  mockupImage: {
    width: '100%',
    height: '100%',
  },
  mockupPromptCard: {
    backgroundColor: '#1A0B2E',
    borderWidth: 1.5,
    borderColor: 'rgba(168, 85, 247, 0.15)',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 16,
  },
  mockupPromptQuestion: {
    color: '#EC4899',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mockupPromptAnswer: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 28,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  mockupTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    marginBottom: 20,
    justifyContent: 'flex-start',
  },
  mockupTagPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  mockupTagText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
  },
});