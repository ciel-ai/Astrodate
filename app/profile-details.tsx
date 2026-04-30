import { getAstroDetails } from '@/lib/astro-details';
import { getSection1Responses } from '@/lib/onboarding-responses';
import { getPersonalityQnsResponses } from '@/lib/personality-qns';
import { supabase } from '@/lib/supabase';
import { checkMutualLike, hasUserSuperlikedMe, saveUserLike } from '@/lib/user-likes';
import { getUserPhotos } from '@/lib/user-photos';
import { getUserProfile } from '@/lib/user-profile';
import { FontAwesome, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming
} from 'react-native-reanimated';
type ProfileDetails = {
  id: string;
  name: string;
  age?: number;
  location?: string;
  image: any;
  compatibility?: number;
  astrology_score?: number;
  personality_score?: number;
  compatibility_note?: string;
  about_me?: string;
  interests?: string[];
  photos?: { uri: string }[];
  western_sign?: string;
  indian_sign?: string;
  sun_sign_harmony?: string;
  moon_sign_alignment?: string;
  indian_score?: number;
  western_score?: number;
  final_score?: number;
  western_report?: string | null;
  indian_recommendation?: string | null;
  // Section1 responses
  looking_for?: string;
  relationship_status?: string;
  hobbies?: string[];
  height?: string;
  introvert_extrovert?: string;
  partner_preference?: string[];
  gender?: string;
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

const PROFILE_CACHE_TTL_MS = 2 * 60 * 1000;
const profileDetailsCache = new Map<string, { data: ProfileDetails; cachedAt: number }>();

// Compatibility Score Card Component
const ScoreCard = ({ percentage, label }: { percentage: number; label: string }) => {
  const progress = Math.min(100, Math.max(0, percentage));

  // Animated value for smooth progress animation
  const progressValue = useSharedValue(0);
  const [displayProgress, setDisplayProgress] = useState(0);

  useEffect(() => {
    // Animate progress value smoothly
    progressValue.value = withTiming(progress, {
      duration: 1000,
      easing: Easing.out(Easing.ease),
    });
  }, [progress, progressValue]);

  // Derive display progress from animated value
  useDerivedValue(() => {
    const rounded = Math.round(progressValue.value);
    runOnJS(setDisplayProgress)(rounded);
  });

  const progressBarStyle = useAnimatedStyle(() => {
    return {
      width: `${progressValue.value}%`,
    };
  });

  return (
    <View style={styles.scoreCard}>
      <View style={styles.scoreCardHeader}>
        <Text style={styles.scoreCardLabel}>{label}</Text>
        <Text style={styles.scoreCardPercentage}>{displayProgress}%</Text>
      </View>
      <View style={styles.scoreCardBarContainer}>
        <Animated.View style={[styles.scoreCardBar, progressBarStyle]} />
      </View>
    </View>
  );
};

// Circular Progress Indicator Component - Clean implementation
const CircularProgress = ({
  percentage,
  label,
  size = 90,
  strokeWidth = 8,
  color = '#A855F7'
}: {
  percentage: number;
  label: string;
  size?: number;
  strokeWidth?: number;
  color?: string;
}) => {
  const progress = Math.min(100, Math.max(0, percentage));
  const radius = size / 2;

  // Animated value for smooth progress animation
  const progressValue = useSharedValue(0);
  const [displayProgress, setDisplayProgress] = useState(0);

  useEffect(() => {
    progressValue.value = withTiming(progress, {
      duration: 1200,
      easing: Easing.out(Easing.ease),
    });
  }, [progress, progressValue]);

  useDerivedValue(() => {
    const rounded = Math.round(progressValue.value);
    runOnJS(setDisplayProgress)(rounded);
  });

  // Calculate rotations for the two half-circles
  // First half covers 0-50%, second half covers 50-100%
  const firstHalfRotation = Math.min(progress, 50) * 3.6; // 0-180 degrees
  const secondHalfRotation = progress > 50 ? (progress - 50) * 3.6 : 0; // 0-180 degrees
  const showSecondHalf = progress > 50;

  return (
    <View style={[circularStyles.container, { width: size }]}>
      <View style={[circularStyles.circleContainer, { width: size, height: size }]}>
        {/* Background Circle Track */}
        <View style={[
          circularStyles.trackCircle,
          {
            width: size,
            height: size,
            borderRadius: radius,
            borderWidth: strokeWidth,
            borderColor: 'rgba(255, 255, 255, 0.2)',
          }
        ]} />

        {/* First Half - Right side (0% to 50%) */}
        <View style={[
          circularStyles.halfContainer,
          {
            width: radius,
            height: size,
            left: radius,
            overflow: 'hidden',
          }
        ]}>
          <View style={[
            circularStyles.rotatingHalf,
            {
              width: size,
              height: size,
              left: -radius,
              borderRadius: radius,
              borderWidth: strokeWidth,
              borderColor: color,
              borderLeftColor: 'transparent',
              borderBottomColor: 'transparent',
              transform: [{ rotate: `${firstHalfRotation - 135}deg` }],
            }
          ]} />
        </View>

        {/* Second Half - Left side (50% to 100%) */}
        <View style={[
          circularStyles.halfContainer,
          {
            width: radius,
            height: size,
            left: 0,
            overflow: 'hidden',
          }
        ]}>
          <View style={[
            circularStyles.rotatingHalf,
            {
              width: size,
              height: size,
              left: 0,
              borderRadius: radius,
              borderWidth: strokeWidth,
              borderColor: showSecondHalf ? color : 'transparent',
              borderRightColor: 'transparent',
              borderTopColor: 'transparent',
              transform: [{ rotate: `${secondHalfRotation - 135}deg` }],
            }
          ]} />
        </View>

        {/* Inner Circle with percentage */}
        <View style={[
          circularStyles.innerCircle,
          {
            width: size - strokeWidth * 2 - 6,
            height: size - strokeWidth * 2 - 6,
            borderRadius: (size - strokeWidth * 2 - 6) / 2,
            top: strokeWidth + 3,
            left: strokeWidth + 3,
          }
        ]}>
          <Text style={circularStyles.percentageText}>{displayProgress}%</Text>
        </View>
      </View>
      <Text style={circularStyles.labelText}>{label}</Text>
    </View>
  );
};

const circularStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  circleContainer: {
    position: 'relative',
  },
  trackCircle: {
    position: 'absolute',
  },
  halfContainer: {
    position: 'absolute',
    top: 0,
  },
  rotatingHalf: {
    position: 'absolute',
    top: 0,
  },
  innerCircle: {
    position: 'absolute',
    backgroundColor: '#1a0d2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  percentageText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  labelText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 8,
    textAlign: 'center',
  },
});

export default function ProfileDetailsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ userId?: string; profileId?: string; initialData?: string }>();

  const [profile, setProfile] = useState<ProfileDetails | null>(() => {
    if (params.initialData) {
      try {
        return JSON.parse(params.initialData);
      } catch (e) {
        console.error("Failed to parse initial data", e);
        return null;
      }
    }
    return null;
  });

  const [loading, setLoading] = useState(() => {
    return !params.initialData;
  });

  const [error, setError] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isMovingForward, setIsMovingForward] = useState(true);
  const [selectedInsightTab, setSelectedInsightTab] = useState<'western' | 'indian'>('western');
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchedProfile, setMatchedProfile] = useState<ProfileDetails | null>(null);
  const [matchedUserId, setMatchedUserId] = useState<string | null>(null);
  const [currentUserPhoto, setCurrentUserPhoto] = useState<any>(require('@/assets/images/avatar-placeholder.png'));
  const [isSuperlikedByProfile, setIsSuperlikedByProfile] = useState(false);

  // Fetch current user's primary photo
  useEffect(() => {
    (async () => {
      try {
        const photosResult = await getUserPhotos(); // No userId = current user
        if (photosResult.success && photosResult.data) {
          const primary = photosResult.data.find((p: any) => p.is_primary) || photosResult.data[0];
          if (primary?.photo_url) {
            setCurrentUserPhoto({ uri: primary.photo_url });
          }
        }
      } catch (error) {
        console.error('Error fetching current user photo:', error);
      }
    })();
  }, []);

  // Stars for background
  const stars = useMemo(() => {
    return Array.from({ length: 100 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 0.5,
      opacity: Math.random() * 0.8 + 0.2,
    }));
  }, []);

  // All hooks MUST be called before any conditional returns
  const detailsOpacity = useSharedValue(0);
  const detailsTranslateY = useSharedValue(50);


  const animatedDetailsStyle = useAnimatedStyle(() => {
    return {
      opacity: detailsOpacity.value,
      transform: [{ translateY: detailsTranslateY.value }],
    };
  });

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  // Clear the module-level profile cache when the user signs out.
  // The cache lives at module scope so it persists across sessions — without
  // this, user B logging in after user A could see user A's cached profile cards
  // until the 2-minute TTL expires.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event) => {
      if (_event === 'SIGNED_OUT') {
        profileDetailsCache.clear();
      }
    });
    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    // If we already have profile data from initialData, we don't need to show loading
    // But we still want to fetch fresh data in the background
    const shouldShowLoading = !profile;
    fetchProfileDetails(shouldShowLoading);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.userId, params.profileId]);

  useEffect(() => {
    // Set details section visibility based on profile state
    if (profile && !loading) {
      // Smooth entry animation
      detailsOpacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
      detailsTranslateY.value = withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) });
    } else {
      // Hide details when loading or no profile
      detailsOpacity.value = 0;
      detailsTranslateY.value = 50;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, loading]);

  const fetchProfileDetails = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const userId = params.userId || params.profileId;

      if (!userId) {
        console.error('No user ID provided');
        setIsSuperlikedByProfile(false);
        setLoading(false);
        return;
      }

      // Bypass database fetch for mock profiles
      if (userId.startsWith('fake_')) {
        console.log('Skipping DB fetch for mock profile:', userId);
        setIsSuperlikedByProfile(false);
        setLoading(false);
        return;
      }

      const cachedProfile = profileDetailsCache.get(userId);
      if (cachedProfile && Date.now() - cachedProfile.cachedAt < PROFILE_CACHE_TTL_MS) {
        setProfile(cachedProfile.data);
        setError(null);
        if (showLoading) setLoading(false);
        return;
      }

      // Get current user first (needed for match data)
      const { data: { user } } = await supabase.auth.getUser();

      // Fetch all independent data in parallel for better performance
      const [
        profileResult,
        astroResult,
        photosResult,
        onboardingDataResult,
        section1Result,
        personalityResult,
        matchDataResult,
        superlikeResult,
      ] = await Promise.all([
        getUserProfile(userId),
        getAstroDetails(userId),
        getUserPhotos(userId),
        supabase
          .from('onboarding_responses')
          .select('*')
          .eq('user_id', userId)
          .single(),
        getSection1Responses(userId),
        getPersonalityQnsResponses(userId),
        user
          ? supabase.rpc('get_final_matches', {
            input_user_id: user.id,
          })
          : Promise.resolve({ data: null }),
        hasUserSuperlikedMe(userId),
      ]);

      setIsSuperlikedByProfile(superlikeResult.success && superlikeResult.isSuperliked);

      if (!profileResult.success || !profileResult.data) {
        const errorMessage = profileResult.error || 'Failed to load profile';
        console.error('Failed to fetch profile:', errorMessage);
        setError(errorMessage);
        setLoading(false);
        return;
      }

      setError(null); // Clear any previous errors

      const photosData = photosResult.success && photosResult.data
        ? photosResult.data.sort((a: any, b: any) => {
          // Primary photo first, then by display_order
          if (a.is_primary && !b.is_primary) return -1;
          if (!a.is_primary && b.is_primary) return 1;
          return a.display_order - b.display_order;
        })
        : [];

      const onboardingData = onboardingDataResult.data;
      const matchData = matchDataResult.data;
      const match = (matchData as any[])?.find((m: any) => m.match_user_id === userId);

      // Calculate age from birth_date in astro_details
      let calculatedAge: number | undefined = undefined;
      if (astroResult.success && astroResult.data?.birth_date) {
        try {
          const birthDate = new Date(astroResult.data.birth_date);
          const today = new Date();
          let age = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
          }
          if (age > 0) {
            calculatedAge = age;
          }
        } catch (error) {
          console.error('Error calculating age:', error);
        }
      }

      const profileData: ProfileDetails = {
        id: userId,
        name: profileResult.data.full_name || '',
        age: calculatedAge,
        location: profileResult.data.location || undefined,
        gender: profileResult.data.gender || profileResult.data.gender_detail || undefined,
        image: photosData && photosData.length > 0
          ? { uri: photosData.find((p: any) => p.is_primary)?.photo_url || photosData[0].photo_url }
          : require('@/assets/images/avatar-placeholder.png'),
        photos: photosData && photosData.length > 0
          ? photosData.map((p: any) => ({ uri: p.photo_url }))
          : undefined,
        compatibility: match ? Number(match.final_match_score ?? 0) : undefined,
        astrology_score: match?.indian_score ? Number(match.indian_score) : undefined,
        personality_score: match?.personality_score !== undefined && match?.personality_score != null ? Number(match.personality_score) : undefined,
        compatibility_note: match?.indian_recommendation || match?.western_report || undefined,
        about_me: onboardingData?.about_me || undefined,
        interests: section1Result.success && section1Result.data?.interest
          ? (Array.isArray(section1Result.data.interest) ? section1Result.data.interest : [])
          : (onboardingData?.interests
            ? (() => {
              try {
                return typeof onboardingData.interests === 'string'
                  ? JSON.parse(onboardingData.interests)
                  : Array.isArray(onboardingData.interests)
                    ? onboardingData.interests
                    : [];
              } catch {
                return [];
              }
            })()
            : []),
        western_sign: astroResult.success && astroResult.data?.western_sign ? astroResult.data.western_sign : undefined,
        indian_sign: astroResult.success && astroResult.data?.indian_sign ? astroResult.data.indian_sign : undefined,
        sun_sign_harmony: match?.indian_score != null
          ? Number(match.indian_score) >= 7 ? 'High'
            : Number(match.indian_score) >= 5 ? 'Medium' : 'Low'
          : undefined,
        moon_sign_alignment: match?.western_score != null
          ? Number(match.western_score) >= 7 ? 'High'
            : Number(match.western_score) >= 5 ? 'Medium' : 'Low'
          : undefined,
        indian_score: match?.indian_score != null ? Number(match.indian_score) : undefined,
        western_score: match?.western_score != null ? Number(match.western_score) : undefined,
        final_score: match?.final_match_score != null ? Number(match.final_match_score) : undefined,
        western_report: match?.western_report ?? null,
        indian_recommendation: match?.indian_recommendation ?? null,
        // Section1 responses
        looking_for: section1Result.success && section1Result.data?.looking_for ? section1Result.data.looking_for : undefined,
        relationship_status: section1Result.success && section1Result.data?.relationship_status ? section1Result.data.relationship_status : undefined,
        hobbies: section1Result.success && section1Result.data?.hobbies
          ? (Array.isArray(section1Result.data.hobbies) ? section1Result.data.hobbies : [])
          : undefined,
        height: section1Result.success && section1Result.data?.height ? section1Result.data.height : undefined,
        introvert_extrovert: section1Result.success && section1Result.data?.introvert_extrovert ? section1Result.data.introvert_extrovert : undefined,
        partner_preference: section1Result.success && section1Result.data?.partner_preference
          ? (Array.isArray(section1Result.data.partner_preference) ? section1Result.data.partner_preference : [])
          : undefined,
        personality_detail: personalityResult ? {
          date_type: personalityResult.what_type_of_date_excites_you_the_most,
          unusual_foods: personalityResult.how_do_you_feel_about_trying_unusual_foods_or_activities,
          conversations: personalityResult.what_kind_of_conversations_do_you_enjoy_with_a_partner,
          planning_style: personalityResult.what_best_describes_your_planning_style,
          commitments: personalityResult.how_do_you_handle_commitments_in_a_relationship,
          workspace: personalityResult.your_room_or_workspace_usually_looks_like,
          spend_time: personalityResult.your_ideal_way_to_spend_time_with_a_partner,
          energy_level: personalityResult.your_energy_level_on_dates_is_usually,
          partner_energy: personalityResult.you_prefer_a_partner_who_is,
          arguments: personalityResult.during_arguments_you_usually,
          show_care: personalityResult.how_do_you_show_care_in_a_relationship,
          partner_type: personalityResult.what_kind_of_partner_are_you,
          late_reply: personalityResult.when_your_partner_replies_late_you_feel,
          emotional_handling: personalityResult.how_do_you_handle_emotional_ups_and_downs,
          overthink: personalityResult.how_often_do_you_overthink_relationships,
        } : undefined,
      };

      setProfile(profileData);
      profileDetailsCache.set(userId, { data: profileData, cachedAt: Date.now() });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      console.error('Error fetching profile details:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
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

  if (!profile && !loading) {
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
          <Text style={styles.errorText}>
            {error || 'Failed to load profile'}
          </Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => {
              setError(null);
              fetchProfileDetails();
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </LinearGradient>
      </View>
    );
  }

  // Type guard: profile must exist at this point
  if (!profile) {
    return null;
  }

  const images = profile.photos && profile.photos.length > 0
    ? profile.photos
    : profile.image
      ? [profile.image]
      : [require('@/assets/images/avatar-placeholder.png')];
  const totalImages = images.length;

  // Handle photo tap to cycle through photos: forward (1->2->3) then backward (3->2->1)
  const handlePhotoTap = () => {
    if (totalImages <= 1) return;

    setCurrentImageIndex((prev) => {
      if (isMovingForward) {
        // Moving forward: if at last image, reverse direction and go to previous
        if (prev === totalImages - 1) {
          setIsMovingForward(false);
          return prev - 1;
        }
        // Otherwise, move to next
        return prev + 1;
      } else {
        // Moving backward: if at first image, reverse direction and go to next
        if (prev === 0) {
          setIsMovingForward(true);
          return prev + 1;
        }
        // Otherwise, move to previous
        return prev - 1;
      }
    });
  };


  // Get current photo
  const getCurrentPhoto = () => {
    return images[currentImageIndex] || images[0];
  };

  const distance = profile?.location ? profile.location : undefined;

  // Get compatibility score (zodiac/astro score) - already in 0-10 scale
  const compatibilityScore = profile.final_score !== undefined
    ? profile.final_score.toFixed(1)
    : profile.indian_score !== undefined
      ? profile.indian_score.toFixed(1)
      : profile.western_score !== undefined
        ? profile.western_score.toFixed(1)
        : undefined; // Don't show default score if no data available

  // Get interests - prefer interests, fallback to hobbies, or empty array
  const interests = profile.interests && profile.interests.length > 0
    ? profile.interests
    : profile.hobbies && profile.hobbies.length > 0
      ? profile.hobbies
      : [];

  // Collect all profile items for grid display
  const profileItems: { label: string; value: string }[] = [];

  if (profile.age) {
    profileItems.push({ label: 'Age', value: String(profile.age) });
  }
  if (profile.height) {
    profileItems.push({ label: 'Height', value: profile.height });
  }
  if (profile.looking_for) {
    profileItems.push({ label: 'Interested In', value: profile.looking_for });
  }
  if (profile.western_sign) {
    profileItems.push({ label: 'Zodiac', value: profile.western_sign });
  }
  if (profile.indian_sign) {
    profileItems.push({ label: 'Zodiac', value: profile.indian_sign });
  }
  if (profile.hobbies && profile.hobbies.length > 0) {
    profile.hobbies.forEach((hobby) => {
      profileItems.push({ label: 'Hobby', value: hobby });
    });
  }
  if (profile.relationship_status) {
    profileItems.push({ label: 'Status', value: profile.relationship_status });
  }
  if (profile.partner_preference && profile.partner_preference.length > 0) {
    profileItems.push({ label: 'Preference', value: profile.partner_preference.join(' • ') });
  }

  // Calculate overall percentage for compatibility display
  // Handle both 0-10 scale and 0-100 scale scores
  const getCompatibilityPercentage = (score: number | undefined): { value: number; display: string } | null => {
    if (score === undefined || score === null) return null;
    const numScore = Number(score);
    // If score is already in 0-100 range (greater than 10), use it directly
    // Otherwise, convert from 0-10 scale to 0-100
    const percentage = numScore > 10 ? numScore : numScore * 10;
    return {
      value: percentage,
      display: percentage.toFixed(1)
    };
  };

  const compatibilityData = profile?.final_score !== undefined
    ? getCompatibilityPercentage(profile.final_score)
    : profile?.indian_score !== undefined
      ? getCompatibilityPercentage(profile.indian_score)
      : profile?.western_score !== undefined
        ? getCompatibilityPercentage(profile.western_score)
        : null;

  const compatibilityPercentage = compatibilityData?.value ?? null;

  const getHarmonyLevel = () => {
    if (profile?.sun_sign_harmony) return profile.sun_sign_harmony;
    return compatibilityPercentage != null
      ? compatibilityPercentage >= 80 ? 'High'
        : compatibilityPercentage >= 60 ? 'Medium' : 'Low'
      : 'Low';
  };

  const getAlignmentLevel = () => {
    if (profile?.moon_sign_alignment) return profile.moon_sign_alignment;
    return compatibilityPercentage != null
      ? compatibilityPercentage >= 80 ? 'High'
        : compatibilityPercentage >= 60 ? 'Medium' : 'Low'
      : 'Low';
  };

  // Helper function to check for match and show modal if matched
  const checkAndShowMatch = async (likedUserId: string) => {
    try {
      const result = await checkMutualLike(likedUserId);
      if (result.isMatch) {
        console.log('💕 Match found! Channel ID:', result.channelId);

        // Trigger haptic vibration for match success
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        setMatchedProfile(profile);
        setMatchedUserId(String(likedUserId));
        setShowMatchModal(true);
      }
    } catch (error) {
      console.error('Error checking for match:', error);
    }
  };

  const handleSendMessageFromMatchModal = async () => {
    const chatUserId = matchedUserId || (matchedProfile?.id ? String(matchedProfile.id) : null);

    setShowMatchModal(false);
    setMatchedProfile(null);
    setMatchedUserId(null);

    if (!chatUserId) return;

    // Ensure match row/channel exists before opening the chat screen.
    await checkMutualLike(chatUserId);

    router.push({
      pathname: '/chat/[id]' as any,
      params: { id: chatUserId },
    });
  };

  // Handle like action
  const handleLike = async () => {
    if (!profile) return;

    // Immediate physical feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      console.log('✅ Like action triggered for user:', profile.id);
      const result = await saveUserLike(profile.id, 'like');
      if (result.success) {
        await checkAndShowMatch(profile.id);
        if (!showMatchModal) {
          // Navigate back after like if no match (with slight delay for feedback)
          setTimeout(() => {
            router.back();
          }, 300);
        }
      } else if (result.error === 'THE_USER_NO_LONGER_EXISTS') {
        console.warn(`⚠️ User ${profile.id} no longer exists.`);
      }
    } catch (error) {
      console.error('Error in handleLike backend:', error);
    }
  };

  // Handle dislike action
  const handleDislike = async () => {
    if (!profile) return;

    // Immediate physical feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      console.log('❌ Dislike action triggered for user:', profile.id);
      const result = await saveUserLike(profile.id, 'dislike');
      if (result.success || result.error === 'THE_USER_NO_LONGER_EXISTS') {
        // Navigate back after dislike
        setTimeout(() => {
          router.back();
        }, 300);
      }
    } catch (error) {
      console.error('Error saving dislike in backend:', error);
    }
  };

  // Handle superlike action
  const handleSuperLike = async () => {
    if (!profile) return;

    // Immediate physical feedback
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      console.log('⭐ Superlike action triggered for user:', profile.id);
      const result = await saveUserLike(profile.id, 'super_like');
      if (result.success) {
        await checkAndShowMatch(profile.id);
        if (!showMatchModal) {
          // Navigate back after superlike if no match
          setTimeout(() => {
            router.back();
          }, 400);
        }
      } else if (result.error === 'THE_USER_NO_LONGER_EXISTS') {
        console.warn(`⚠️ User ${profile.id} no longer exists, skipping...`);
      }
    } catch (error) {
      console.error('Error in handleSuperLike backend:', error);
    }
  };

  return (
    <LinearGradient
      colors={['#1a0d2e', '#2d1b4e', '#4a2c5a']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.gradientContainer}
    >
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
          {/* 1. Large Profile Photo with Name & Age Overlay */}
          {profile && (
            <View style={styles.imageContainer}>
              <Image
                source={getCurrentPhoto()}
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
                    <Text style={styles.imageNameText}>{profile.name} {profile.age || ''}</Text>
                    <TouchableOpacity style={styles.imageDownArrowIcon} onPress={() => router.back()}>
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
            </View>
          )}

          {/* 2. Looking For & Relationship Section */}
          {(profile.looking_for || profile.relationship_status) && (
            <View style={styles.infoCard}>
              <Text style={styles.sectionLabel}>Looking for</Text>

              {profile.looking_for && (
                <View style={styles.lookingForContent}>
                  <Text style={styles.lookingForEmoji}>{LOOKING_FOR_EMOJIS[profile.looking_for] || '💘'}</Text>
                  <Text style={styles.lookingForText}>{profile.looking_for}</Text>
                </View>
              )}

              {profile.relationship_status && (
                <View style={{ marginTop: 15 }}>
                  <Text style={[styles.sectionLabel, { fontSize: 16, marginBottom: 8, opacity: 0.8 }]}>Relationship</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <Ionicons
                      name={
                        profile.relationship_status.toLowerCase() === 'single'
                          ? 'person-outline'
                          : profile.relationship_status.toLowerCase().includes('monogamy') ||
                            profile.relationship_status.toLowerCase().includes('relationship')
                            ? 'heart-outline'
                            : 'people-outline'
                      }
                      size={20}
                      color="#FFFFFF"
                      style={{ marginRight: 10 }}
                    />
                    <Text style={[styles.monogamyText, { fontSize: 18 }]}>{profile.relationship_status}</Text>
                  </View>
                  <View style={styles.separator} />
                </View>
              )}
            </View>
          )}

          {/* 3. Essentials Section */}
          <View style={styles.infoCard}>
            <Text style={styles.sectionLabel}>Essentials</Text>
            <View style={styles.essentialsList}>
              {profile.compatibility !== undefined && (
                <>
                  <View style={styles.essentialItem}>
                    <Ionicons name="location-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.essentialText}>Nearby</Text>
                  </View>
                  <View style={styles.separator} />
                </>
              )}

              {profile.height && (
                <>
                  <View style={styles.essentialItem}>
                    <MaterialIcons name="straighten" size={20} color="#FFFFFF" />
                    <Text style={styles.essentialText}>{profile.height} cm</Text>
                  </View>
                  <View style={styles.separator} />
                </>
              )}

              {profile.location && (
                <>
                  <View style={styles.essentialItem}>
                    <Ionicons name="home-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.essentialText}>Lives in {profile.location}</Text>
                  </View>
                  <View style={styles.separator} />
                </>
              )}

              {profile.gender && (
                <>
                  <View style={styles.essentialItem}>
                    <Ionicons name="person-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.essentialText}>{profile.gender}</Text>
                  </View>
                  <View style={styles.separator} />
                </>
              )}

              {profile.introvert_extrovert && (
                <>
                  <View style={styles.essentialItem}>
                    <Ionicons name="pulse-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.essentialText}>{profile.introvert_extrovert}</Text>
                  </View>
                  <View style={styles.separator} />
                </>
              )}

              {/* Added Partner Preference (Traits) here to keep essentials grouped */}
              {profile.partner_preference && profile.partner_preference.length > 0 && (
                <>
                  <View style={styles.essentialItem}>
                    <Ionicons name="star-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.essentialText}>Prefer: {profile.partner_preference.join(', ')}</Text>
                  </View>
                  <View style={styles.separator} />
                </>
              )}
            </View>
          </View>
          {/* 4. Lifestyle (Hobbies) Section */}
          {(profile.hobbies && profile.hobbies.length > 0) && (
            <View style={styles.infoCard}>
              <Text style={styles.sectionLabel}>Lifestyle</Text>
              <View style={styles.hobbiesList}>
                {profile.hobbies.map((hobby, index) => (
                  <View key={index} style={styles.hobbyItem}>
                    <Ionicons name="star-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.hobbyItemText}>{hobby}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* 5. Deeper Insights Section */}
          {profile.personality_detail && (
            <View style={[styles.infoCard, { marginBottom: 150 }]}>
              <Text style={styles.sectionLabel}>Deeper Insights</Text>
              <View style={styles.essentialsList}>
                {profile.personality_detail.date_type && profile.personality_detail.date_type.length > 0 && (
                  <>
                    <View style={styles.essentialItem}>
                      <Ionicons name="heart-outline" size={20} color="#FFFFFF" />
                      <Text style={styles.essentialText}>
                        Ideal Date: {profile.personality_detail.date_type.map(d => PERSONALITY_LABELS[d] || d).join(', ')}
                      </Text>
                    </View>
                    <View style={styles.separator} />
                  </>
                )}

                {profile.personality_detail.spend_time && (
                  <>
                    <View style={styles.essentialItem}>
                      <Ionicons name="time-outline" size={20} color="#FFFFFF" />
                      <Text style={styles.essentialText}>
                        Loves to: {PERSONALITY_LABELS[profile.personality_detail.spend_time] || profile.personality_detail.spend_time}
                      </Text>
                    </View>
                    <View style={styles.separator} />
                  </>
                )}

                {profile.personality_detail.conversations && (
                  <>
                    <View style={styles.essentialItem}>
                      <Ionicons name="chatbubbles-outline" size={20} color="#FFFFFF" />
                      <Text style={styles.essentialText}>
                        Conversation: {PERSONALITY_LABELS[profile.personality_detail.conversations] || profile.personality_detail.conversations}
                      </Text>
                    </View>
                    <View style={styles.separator} />
                  </>
                )}

                {profile.personality_detail.planning_style && (
                  <>
                    <View style={styles.essentialItem}>
                      <Ionicons name="calendar-outline" size={20} color="#FFFFFF" />
                      <Text style={styles.essentialText}>
                        Planning: {PERSONALITY_LABELS[profile.personality_detail.planning_style] || profile.personality_detail.planning_style}
                      </Text>
                    </View>
                    <View style={styles.separator} />
                  </>
                )}

                {profile.personality_detail.overthink && (
                  <>
                    <View style={styles.essentialItem}>
                      <Ionicons name="analytics-outline" size={20} color="#FFFFFF" />
                      <Text style={styles.essentialText}>
                        Mindset: {PERSONALITY_LABELS[profile.personality_detail.overthink] || profile.personality_detail.overthink}
                      </Text>
                    </View>
                    <View style={styles.separator} />
                  </>
                )}

                {profile.personality_detail.show_care && (
                  <>
                    <View style={styles.essentialItem}>
                      <Ionicons name="rose-outline" size={20} color="#FFFFFF" />
                      <Text style={styles.essentialText}>
                        Caring Style: {PERSONALITY_LABELS[profile.personality_detail.show_care] || profile.personality_detail.show_care}
                      </Text>
                    </View>
                    <View style={styles.separator} />
                  </>
                )}

                {profile.personality_detail.partner_type && (
                  <>
                    <View style={styles.essentialItem}>
                      <Ionicons name="body-outline" size={20} color="#FFFFFF" />
                      <Text style={styles.essentialText}>
                        As a Partner: {PERSONALITY_LABELS[profile.personality_detail.partner_type] || profile.personality_detail.partner_type}
                      </Text>
                    </View>
                    <View style={styles.separator} />
                  </>
                )}

                {profile.personality_detail.emotional_handling && (
                  <>
                    <View style={styles.essentialItem}>
                      <Ionicons name="water-outline" size={20} color="#FFFFFF" />
                      <Text style={styles.essentialText}>
                        Emotional: {PERSONALITY_LABELS[profile.personality_detail.emotional_handling] || profile.personality_detail.emotional_handling}
                      </Text>
                    </View>
                    <View style={styles.separator} />
                  </>
                )}

                {profile.personality_detail.workspace && (
                  <>
                    <View style={styles.essentialItem}>
                      <Ionicons name="home-outline" size={20} color="#FFFFFF" />
                      <Text style={styles.essentialText}>
                        Organisation: {PERSONALITY_LABELS[profile.personality_detail.workspace] || profile.personality_detail.workspace}
                      </Text>
                    </View>
                    <View style={styles.separator} />
                  </>
                )}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Action Buttons: Dislike / Superlike / Like - Pinned to Bottom */}
        {profile && (
          <View style={styles.actionIconsContainer}>
            <TouchableOpacity activeOpacity={0.7} style={styles.actionButtonSmallWrapper} onPress={handleDislike}>
              <View style={styles.actionIconGlassy}>
                <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
                <FontAwesome name="close" size={28} color="#FFFFFF" style={{ opacity: 0.8 }} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={0.7} style={styles.actionButtonSmallWrapper} onPress={handleSuperLike}>
              <View style={styles.actionIconGlassy}>
                <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
                <Ionicons name="paper-plane" size={28} color="#FFFFFF" style={{ opacity: 0.8 }} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={0.7} style={styles.actionButtonSmallWrapper} onPress={handleLike}>
              <View style={styles.actionIconGlassy}>
                <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
                <MaterialIcons name="favorite" size={28} color="#FFFFFF" style={{ opacity: 0.8 }} />
              </View>
            </TouchableOpacity>
          </View>
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
            {/* Starfield background */}
            <View style={{ ...StyleSheet.absoluteFillObject, overflow: 'hidden' }}>
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
              android_ripple={{ color: 'rgba(255, 255, 255, 0.2)', borderless: true }}
            >
              <MaterialIcons name="close" size={24} color="#FFFFFF" />
            </Pressable>


            {/* Match Cards - Planetary Spheres */}
            <View style={styles.matchCardsContainer}>
              <View style={[styles.matchProfileCard, styles.matchCardLeft, styles.planetarySphere]}>
                <Image
                  source={typeof currentUserPhoto === 'string' ? { uri: currentUserPhoto } : currentUserPhoto}
                  style={styles.matchProfileImage}
                  contentFit="cover"
                />
              </View>

              <View style={[styles.matchProfileCard, styles.matchCardRight, styles.planetarySphere]}>
                <Image
                  source={typeof matchedProfile.image === 'string' ? { uri: matchedProfile.image } : matchedProfile.image}
                  style={styles.matchProfileImage}
                  contentFit="cover"
                />
              </View>

              <View style={styles.matchHeartIcon}>
                <MaterialIcons name="favorite" size={44} color="#EC4899" />
              </View>
            </View>

            {/* Match Text */}
            <View style={styles.matchTextContainer}>
              <Text style={[styles.matchTitle, { color: '#FFFFFF' }]}>It's a Match!</Text>
              <Text style={[styles.matchSubtitle, { color: 'rgba(255, 255, 255, 0.8)' }]}>
                You and {matchedProfile.name} liked each other. Start a conversation!
              </Text>
            </View>

            {/* Send Message Button */}
            <Pressable
              style={styles.matchSendButton}
              onPress={handleSendMessageFromMatchModal}
              android_ripple={{ color: 'rgba(255, 255, 255, 0.2)', borderless: false }}
            >
              <MaterialIcons name="chat" size={24} color="#FFFFFF" />
              <Text style={styles.matchSendButtonText}>Send Message</Text>
            </Pressable>
          </LinearGradient>
        )}
      </Modal>
    </LinearGradient>
  );
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_HEIGHT = SCREEN_WIDTH * 1.2; // Reduced height for better proportions

const LOOKING_FOR_EMOJIS: Record<string, string> = {
  'casual': '🎉',
  'long-term': '💘',
  'long-open-short': '😍',
  'short-open-long': '🥂',
  'friends': '👋',
  'not-sure': '🤔',
};

const PERSONALITY_LABELS: Record<string, string> = {
  // Date Type
  'cafe-talk': 'Cozy cafés & hours of talk',
  'explore': 'Exploring random new places',
  'movie-dinner': 'Simple movie or dinner',
  'road-trip': 'Spontaneous road trips',

  // Unusual Foods
  'stick-to-known': 'Sticks to known favorites',
  'try-if-encouraged': 'Needs a little push to try new things',
  'open-to-it': 'Open to unusual experiences',
  'suggest-crazy': 'Always suggesting crazy ideas',

  // Conversations
  'everyday-talks': 'Cute, simple everyday talks',
  'goals-life': 'Goal & life-related discussions',
  'deep-philosophical': 'Deep & philosophical chats',
  'creative-brainstorm': 'Creative midnight brainstorming',

  // Planning Style
  'go-with-flow': 'Go-with-the-flow',
  'plan-little': 'Plans a little',
  'organise-things': 'Likes to organise things',
  'plan-dates-project': 'Plans dates like projects',

  // Commitments
  'forget-sometimes': 'Forgets sometimes',
  'try-best': 'Tries their best to remember',
  'responsible-steady': 'Responsible & steady',
  'promise-do-it': 'No excuses, just action',

  // Workspace
  'disaster-zone': 'Disaster zone',
  'manageable': 'Manageable',
  'clean-most-time': 'Clean most of the time',
  'organised-pinterest': 'Pinterest-perfect organisation',

  // Spend Time
  'chill-home': 'Chill at home',
  'quiet-date': 'Quiet dates',
  'fun-activities': 'Fun activities',
  'big-social': 'Big social plans',

  // Energy Level
  'low-key': 'Low-key and calm',
  'balanced': 'Balanced energy',
  'fun-energetic': 'Fun & energetic',
  'hyper-excitement': 'Full hyper excitement',

  // Arguments
  'avoid-talking': 'Avoids talking',
  'calm-discuss': 'Calms down then discusses',
  'understand-view': 'Tries to understand your view',
  'solve-immediately': 'Solves it with patience',

  // Show Care
  'small-gestures': 'Prefers small gestures',
  'listening': 'Is a good listener',
  'emotional-support': 'Provides emotional support',
  'going-out-way': 'Goes out of their way for love',

  // Partner Type
  'independent': 'Independent partner',
  'supportive': 'Supportive partner',
  'empathetic': 'Empathetic partner',
  'soft-kind': 'Soft, kind, and comforting',

  // Late Reply
  'totally-fine': 'Totally fine with late replies',
  'slightly-curious': 'Slightly curious when you\'re late',
  'overthinking': 'A bit overthinking about replies',
  'very-anxious': 'Anxious about late replies',

  // Emotional Handling
  'rarely-stressed': 'Rarely feels stressed',
  'handle-okay': 'Handles stress okay',
  'emotional-sometimes': 'Gets emotional sometimes',
  'feel-deeply': 'Feels things very deeply',

  // Overthink
  'almost-never': 'Almost never overthinks',
  'occasionally': 'Occasionally overthinks',
  'quite-often': 'Often overthinks',
  'all-time': 'Overthinks all the time',
};

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
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
  contentWrapper: {
    flex: 1,
    position: 'relative',
  },
  scrollView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 100,
  },
  paginationContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  paginationDot: {
    width: 10,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 4,
  },
  paginationDotActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    width: 30,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 20,
  },
  backButtonContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(74, 44, 90, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  nameSection: {
    marginBottom: 12,
  },
  nameText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  ageText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  detailsContainer: {
    backgroundColor: 'transparent',
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    minHeight: 400,
  },
  compatibilitySection: {
    marginBottom: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.2)',
  },
  compatibilityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  compatibilityLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E9D5FF',
    letterSpacing: 0.5,
  },
  compatibilityBadge: {
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.4)',
  },
  compatibilityValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  compatibilityText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 8,
  },
  progressBarContainer: {
    height: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 6,
  },
  circularScoresSection: {
    marginBottom: 24,
    marginTop: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.2)',
  },
  circularScoresSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E9D5FF',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  circularScoresRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    paddingHorizontal: 10,
  },
  insightsTabsContainer: {
    marginBottom: 20,
  },
  pillContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 25,
    padding: 4,
    gap: 4,
  },
  pillButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pillText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  pillTextActive: {
    color: '#7C3AED',
    fontWeight: '600',
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
  headerSection: {
    marginBottom: 16,
    marginTop: 0,
  },
  profileItemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  profileItemContainer: {
    minWidth: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileItemLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 4,
    textAlign: 'center',
  },
  profileItemValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  profileItemsLinearContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 4,
  },
  profileItemText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
    marginRight: 0,
  },
  interestsScrollView: {
    flex: 1,
  },
  compatibilityCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'visible',
  },
  compatibilityArc: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: '#34C759',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#34C759',
    transform: [{ rotate: '-90deg' }],
  },
  compatibilityScore: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  locationText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginLeft: 4,
  },
  interestsSection: {
    marginBottom: 16,
  },
  interestsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  interestsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  interestsScrollContent: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 20,
  },
  interestTag: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  interestText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  detailSection: {
    marginBottom: 24,
  },
  detailSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#A855F7',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  detailSectionContent: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 22,
    fontWeight: '400',
  },
  insightCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  insightContent: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 22,
    fontWeight: '400',
  },
  zodiacRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  zodiacTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  zodiacText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  scoresContainer: {
    gap: 16,
    paddingVertical: 8,
  },
  scoreCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  scoreCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  scoreCardLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  scoreCardPercentage: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scoreCardBarContainer: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  scoreCardBar: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
  },
  circularProgressContainer: {
    alignItems: 'center',
  },
  circularProgressWrapper: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  circularProgressBackground: {
    position: 'absolute',
    borderColor: '#4FD1C7',
    opacity: 0.4,
  },
  circularProgressClip: {
    position: 'absolute',
    overflow: 'hidden',
  },
  circularProgressMask: {
    position: 'absolute',
    overflow: 'hidden',
  },
  circularProgressSegment: {
    position: 'absolute',
    top: 0,
  },
  circularProgressTextContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  circularProgressText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  circularProgressLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
    marginTop: 10,
    textAlign: 'center',
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  starryBackground: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
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
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
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
  actionButtonSmallWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
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
  imageContainer: {
    marginHorizontal: 0,
    borderRadius: 0,
    overflow: 'hidden',
    height: Dimensions.get('window').height * 0.55,
    backgroundColor: '#000000',
  },
  premiumHeaderCard: {
    backgroundColor: 'transparent',
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginTop: -5,
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
  infoCard: {
    backgroundColor: 'transparent',
    marginHorizontal: 0,
    marginTop: 5,
    borderRadius: 0,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
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
  lookingForEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  lookingForText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  monogamyTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  monogamyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  essentialsList: {
    marginTop: 5,
  },
  essentialItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 15,
  },
  essentialText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    width: '100%',
  },
  hobbiesList: {
    marginTop: 5,
    gap: 10,
  },
  hobbyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  hobbyItemText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  profileImage: {
    width: '100%',
    height: '100%',
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
  matchButtonsContainer: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
    paddingHorizontal: 20,
  },
  matchButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
  },
  matchButtonPrimary: {
    backgroundColor: '#EC4899',
    borderColor: '#EC4899',
  },
  matchButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  matchButtonTextPrimary: {
    color: '#FFFFFF',
  },
});