import { getAstroDetails } from '@/lib/astro-details';
import { getSection1Responses } from '@/lib/onboarding-responses';
import { getPersonalityQnsResponses } from '@/lib/personality-qns';
import { supabase } from '@/lib/supabase';
import { hasUserSuperlikedMe } from '@/lib/user-likes';
import { getUserPhotos } from '@/lib/user-photos';
import { getUserProfile } from '@/lib/user-profile';
import type { Profile } from '@/types/profile';
import { useCallback, useEffect, useState } from 'react';

// ─── Module-level cache ────────────────────────────────────────────────────────
// Lives at module scope so it persists across component mounts within a session.
// Cleared on SIGNED_OUT in the screen via the exported clearProfileCache helper.
const PROFILE_CACHE_TTL_MS = 2 * 60 * 1000;
const profileDetailsCache = new Map<string, { data: Profile; cachedAt: number }>();

export function clearProfileCache() {
  profileDetailsCache.clear();
}

// ─── Hook ──────────────────────────────────────────────────────────────────────
export interface UseProfileDetailsResult {
  profile: Profile | null;
  isSuperlikedByProfile: boolean;
  isLoading: boolean;
  error: string | null;
  refetch: (showLoading?: boolean) => Promise<void>;
}

export function useProfileDetails(userId: string | null): UseProfileDetailsResult {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isSuperlikedByProfile, setIsSuperlikedByProfile] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfileDetails = useCallback(
    async (showLoading = true) => {
      if (!userId) {
        setIsLoading(false);
        return;
      }

      // Skip DB fetch for mock profiles
      if (userId.startsWith('fake_')) {
        setIsSuperlikedByProfile(false);
        setIsLoading(false);
        return;
      }

      // Cache hit
      const cached = profileDetailsCache.get(userId);
      if (cached && Date.now() - cached.cachedAt < PROFILE_CACHE_TTL_MS) {
        setProfile(cached.data);
        setError(null);
        if (showLoading) setIsLoading(false);
        return;
      }

      if (showLoading) setIsLoading(true);

      try {
        const userResult = await supabase.auth.getUser();
        const user = userResult?.data?.user;
        if (!user) {
          setIsLoading(false);
          return;
        }

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
          supabase.rpc('get_final_matches', { input_user_id: user.id }),
          hasUserSuperlikedMe(userId),
        ]);

        setIsSuperlikedByProfile(
          superlikeResult.success && superlikeResult.isSuperliked,
        );

        if (!profileResult.success || !profileResult.data) {
          const msg = profileResult.error || 'Failed to load profile';
          setError(msg);
          setIsLoading(false);
          return;
        }

        setError(null);

        const photosData =
          photosResult.success && photosResult.data
            ? photosResult.data.sort((a: any, b: any) => {
                if (a.is_primary && !b.is_primary) return -1;
                if (!a.is_primary && b.is_primary) return 1;
                return a.display_order - b.display_order;
              })
            : [];

        const onboardingData = onboardingDataResult.data;
        const matchData = matchDataResult.data;
        const match = (matchData as any[])?.find(
          (m: any) => m.match_user_id === userId,
        );

        // Calculate age from birth_date
        let calculatedAge: number | undefined;
        if (astroResult.success && astroResult.data?.birth_date) {
          try {
            const birthDate = new Date(astroResult.data.birth_date);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            if (
              monthDiff < 0 ||
              (monthDiff === 0 && today.getDate() < birthDate.getDate())
            ) {
              age--;
            }
            if (age > 0) calculatedAge = age;
          } catch {
            // ignore
          }
        }

        const profileData: Profile = {
          id: userId,
          name: profileResult.data.full_name || '',
          age: calculatedAge,
          location: profileResult.data.location || undefined,
          gender:
            profileResult.data.gender ||
            profileResult.data.gender_detail ||
            undefined,
          image:
            photosData.length > 0
              ? {
                  uri:
                    photosData.find((p: any) => p.is_primary)?.photo_url ||
                    photosData[0].photo_url,
                }
              : require('@/assets/images/avatar-placeholder.png'),
          photos:
            photosData.length > 0
              ? photosData.map((p: any) => ({ uri: p.photo_url }))
              : undefined,
          compatibility: match ? Number(match.final_match_score ?? 0) : undefined,
          astrology_score: match?.indian_score
            ? Number(match.indian_score)
            : undefined,
          personality_score:
            match?.personality_score != null
              ? Number(match.personality_score)
              : undefined,
          compatibility_note:
            match?.indian_recommendation || match?.western_report || undefined,
          about_me: onboardingData?.about_me || undefined,
          interests:
            section1Result.success && section1Result.data?.interest
              ? Array.isArray(section1Result.data.interest)
                ? section1Result.data.interest
                : []
              : onboardingData?.interests
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
              : [],
          western_sign:
            astroResult.success && astroResult.data?.western_sign
              ? astroResult.data.western_sign
              : undefined,
          indian_sign:
            astroResult.success && astroResult.data?.indian_sign
              ? astroResult.data.indian_sign
              : undefined,
          sun_sign_harmony:
            match?.indian_score != null
              ? Number(match.indian_score) >= 7
                ? 'High'
                : Number(match.indian_score) >= 5
                ? 'Medium'
                : 'Low'
              : undefined,
          moon_sign_alignment:
            match?.western_score != null
              ? Number(match.western_score) >= 7
                ? 'High'
                : Number(match.western_score) >= 5
                ? 'Medium'
                : 'Low'
              : undefined,
          indian_score:
            match?.indian_score != null ? Number(match.indian_score) : undefined,
          western_score:
            match?.western_score != null
              ? Number(match.western_score)
              : undefined,
          final_score:
            match?.final_match_score != null
              ? Number(match.final_match_score)
              : undefined,
          western_report: match?.western_report ?? null,
          indian_recommendation: match?.indian_recommendation ?? null,
          looking_for:
            section1Result.success && section1Result.data?.looking_for
              ? section1Result.data.looking_for
              : undefined,
          relationship_status:
            section1Result.success && section1Result.data?.relationship_status
              ? section1Result.data.relationship_status
              : undefined,
          hobbies:
            section1Result.success && section1Result.data?.hobbies
              ? Array.isArray(section1Result.data.hobbies)
                ? section1Result.data.hobbies
                : []
              : undefined,
          height:
            section1Result.success && section1Result.data?.height
              ? section1Result.data.height
              : undefined,
          introvert_extrovert:
            section1Result.success && section1Result.data?.introvert_extrovert
              ? section1Result.data.introvert_extrovert
              : undefined,
          partner_preference:
            section1Result.success && section1Result.data?.partner_preference
              ? Array.isArray(section1Result.data.partner_preference)
                ? section1Result.data.partner_preference
                : []
              : undefined,
          personality_detail: personalityResult
            ? {
                date_type:
                  personalityResult.what_type_of_date_excites_you_the_most,
                unusual_foods:
                  personalityResult.how_do_you_feel_about_trying_unusual_foods_or_activities,
                conversations:
                  personalityResult.what_kind_of_conversations_do_you_enjoy_with_a_partner,
                planning_style:
                  personalityResult.what_best_describes_your_planning_style,
                commitments:
                  personalityResult.how_do_you_handle_commitments_in_a_relationship,
                workspace:
                  personalityResult.your_room_or_workspace_usually_looks_like,
                spend_time:
                  personalityResult.your_ideal_way_to_spend_time_with_a_partner,
                energy_level: personalityResult.your_energy_level_on_dates_is_usually,
                partner_energy: personalityResult.you_prefer_a_partner_who_is,
                arguments: personalityResult.during_arguments_you_usually,
                show_care:
                  personalityResult.how_do_you_show_care_in_a_relationship,
                partner_type: personalityResult.what_kind_of_partner_are_you,
                late_reply:
                  personalityResult.when_your_partner_replies_late_you_feel,
                emotional_handling:
                  personalityResult.how_do_you_handle_emotional_ups_and_downs,
                overthink:
                  personalityResult.how_often_do_you_overthink_relationships,
              }
            : undefined,
        };

        setProfile(profileData);
        profileDetailsCache.set(userId, { data: profileData, cachedAt: Date.now() });
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'An unexpected error occurred';
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    fetchProfileDetails(!profile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return { profile, isSuperlikedByProfile, isLoading, error, refetch: fetchProfileDetails };
}