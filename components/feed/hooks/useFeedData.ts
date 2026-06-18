import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { Image } from 'expo-image';
import { getMyDailyPick, type DailyPick } from '@/lib/daily-picks';
import { fetchFinalMatches, getDiscoveryPreferences, hasCompletedOnboarding, type DiscoveryPreferences, type FinalMatchResult } from '@/lib/matching';
import { getSection1Responses } from '@/lib/onboarding-responses';
import { trackRealtimeChannel } from '@/lib/realtime-channels';
import { getReportedUserIds } from '@/lib/reports';
import { signalViewProfile, startViewLongTimer, stopViewLongTimer } from '@/lib/signals';
import { supabase } from '@/lib/supabase';
import { getActiveAstroEvents, type AstroEvent } from '@/lib/synastry';
import { hasUserSuperlikedMe } from '@/lib/user-likes';
import { getUserPhotos } from '@/lib/user-photos';
import { cleanupFeedChannel, removeFeedChannelsByTopicPrefix } from '../realtime/feedRealtimeManager';
import { formatHobby } from '../utils/profileHelpers';
import type { Profile } from '../utils/profileHelpers';

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

  return true;
};

export function useFeedData() {
  const [currentProfileIndex, setCurrentProfileIndex] = useState(0);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [dailyPick, setDailyPick] = useState<DailyPick | null>(null);

  // Cache for astrology tables
  const [astroTables, setAstroTables] = useState<{ western: any[]; indian: any[] }>({ western: [], indian: [] });
  const astroTablesRef = useRef<{ western: any[]; indian: any[] }>({ western: [], indian: [] });
  // Store current user's astro details for accurate comparison
  const [currentUserAstro, setCurrentUserAstro] = useState<any>(null);
  const currentUserAstroRef = useRef<any>(null);
  const [currentUserPhoto, setCurrentUserPhoto] = useState<any>(require('@/assets/images/avatar-placeholder.png'));
  const [superlikedProfiles, setSuperlikedProfiles] = useState<Set<string>>(new Set());
  const [selectedInsightTab, setSelectedInsightTab] = useState<'western' | 'indian'>('western');
  const [profilePhotoIndex, setProfilePhotoIndex] = useState<Record<string, number>>({});
  const [currentUserInterest, setCurrentUserInterest] = useState<string[] | undefined>(undefined);
  const [superLikesRemaining, setSuperLikesRemaining] = useState<number | null>(null);
  const [likesRemaining, setLikesRemaining] = useState<number | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [reportedUserIds, setReportedUserIds] = useState<Set<string>>(new Set());
  const [isFallbackFeed, setIsFallbackFeed] = useState(false);
  // Astro Events banner
  const [activeAstroEvent, setActiveAstroEvent] = useState<AstroEvent | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const tutorialCheckedRef = useRef(false);

  const { membership } = useSubscriptionStatus();

  const fetchSuperLikesRemaining = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase.rpc('get_super_likes_remaining', { p_user_id: user.id });
      if (!error && data !== null) setSuperLikesRemaining(data as number);
    } catch (err) {
      console.error('Error fetching super likes remaining:', err);
    }
  }, []);

  const fetchLikesRemaining = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase.rpc('get_likes_remaining', { p_user_id: user.id });
      if (!error && data !== null) setLikesRemaining(data as number);
    } catch (err) {
      console.error('Error fetching likes remaining:', err);
    }
  }, []);

  useEffect(() => {
    void fetchSuperLikesRemaining();
    void fetchLikesRemaining();
  }, [fetchSuperLikesRemaining, fetchLikesRemaining]);

  // When the subscription plan changes (e.g. after purchase), refresh quota counters
  // so the badge and upgrade modal reflect the new plan limits immediately.
  useEffect(() => {
    if (!membership) return;
    void fetchSuperLikesRemaining();
    void fetchLikesRemaining();
  }, [membership, fetchSuperLikesRemaining, fetchLikesRemaining]);

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
          if (primary?.photo_url && mounted) {
            setCurrentUserPhoto({ 
              uri: primary.photo_url, 
              thumbnail: primary.thumbnail_url ?? undefined 
            });
          }
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
          setActiveAstroEvent(events[0]);
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
      const [photosBatch, astroBatch, section1Batch, onboardingBatch, personalityBatch, promptsBatch] = await Promise.all([
        (supabase.rpc as any)('get_user_photos_batch', { p_user_ids: userIds }),
        supabase.from('astro_details').select('*').in('user_id', userIds),
        supabase.from('section1_qns').select('*').in('user_id', userIds),
        supabase.from('onboarding_responses').select('*').in('user_id', userIds),
        supabase.from('personality_qns').select('*').in('user_id', userIds),
        supabase.from('user_prompts').select('*').in('user_id', userIds),
      ]);

      const allPhotos: { user_id: string; photo_url: string; thumbnail_url?: string; is_primary: boolean }[] = photosBatch.data || [];
      const allAstro = astroBatch.data || [];
      const allSection1 = section1Batch.data || [];
      const allOnboarding = onboardingBatch.data || [];
      const allPersonality = personalityBatch.data || [];
      const allPrompts = (promptsBatch.data || []) as any[];

      return results.map((m: any, idx: number) => {
        const userId = m.match_user_id;
        const userPhotos = allPhotos.filter(p => p.user_id === userId);
        const astroData = allAstro.find(a => a.user_id === userId);
        const section1Data = allSection1.find(s => s.user_id === userId);
        const onboardingData = allOnboarding.find(o => o.user_id === userId);
        const personalityData = allPersonality.find(p => p.user_id === userId);
        const userPrompts = allPrompts.filter((p: any) => p.user_id === userId);

        let primaryPhoto = null;
        let photos: { uri: string }[] = [];

        if (userPhotos.length > 0) {
          const primary = userPhotos.find(p => p.is_primary) || userPhotos[0];
          if (primary?.photo_url) {
            primaryPhoto = { 
              uri: primary.photo_url, 
              thumbnail: primary.thumbnail_url ?? undefined 
            };
          }
          photos = userPhotos.map(p => ({ 
            uri: p.photo_url, 
            thumbnail: p.thumbnail_url ?? undefined 
          }));
        }

        const rawPersonality = m.personality_score != null ? Number(m.personality_score) : undefined;
        const personality = rawPersonality === undefined ? undefined : rawPersonality <= 1 ? rawPersonality * 100 : rawPersonality;

        let interests: string[] = [];
        if (section1Data?.hobbies && Array.isArray(section1Data.hobbies) && section1Data.hobbies.length > 0) {
          interests = section1Data.hobbies;
        } else if (onboardingData?.interests) {
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
          prompts: userPrompts.map((p: any) => ({
            prompt_id: p.prompt_id,
            question: p.question,
            answer: p.answer,
            is_custom: p.is_custom,
          })),
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
      if (!tutorialCheckedRef.current) {
        tutorialCheckedRef.current = true;
        AsyncStorage.getItem('hasSeenSwipeTutorial').then((seen) => {
          if (!seen) setShowTutorial(true);
        }).catch(() => {});
      }
    }
  }, [mapMatchesToProfiles]);

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

      removeFeedChannelsByTopicPrefix(supabase, 'new-onboarding-completions');

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

            if (newPhotoUserId === user.id) {
              return;
            }

            if (reportedUserIds.has(newPhotoUserId)) {
              return;
            }

            const isComplete = await hasCompletedOnboarding(newPhotoUserId);
            if (!isComplete) {
              return;
            }

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
              setCurrentUserPhoto({ 
                uri: primary.photo_url, 
                thumbnail: primary.thumbnail_url ?? undefined 
              });
            }
          }
        }
      } catch (error) {
        console.error('Error fetching current user photo:', error);
      }
    })();
  }, []);

  return {
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
    mapMatchesToProfiles,
    loadDiscoverProfiles,
    selectedInsightTab,
    setSelectedInsightTab,
    profilePhotoIndex,
    setProfilePhotoIndex,
    showTutorial,
    setShowTutorial,
  };
}
