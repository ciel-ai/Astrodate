import { getStandouts } from '@/lib/daily-picks';
import { getAstroDetails } from './astro-details';
import type { Tables } from './database.types';
import { supabase } from './supabase';
import { getUserPhotos } from './user-photos';

export interface FinalMatchResult {
  match_user_id: string;
  full_name: string;
  gender: string;
  age: number;
  location: string;
  // PostgreSQL returns numeric types as strings in JSON
  personality_score: string | number;
  indian_score: string | number;
  western_score: string | number;
  final_match_score: string | number;
  indian_recommendation: string | null;
  western_report: string | null;
  personality_vector?: string | number[];
}

type UserPreferenceFields = Pick<Tables<'user_preferences'>, 'min_age' | 'max_age' | 'max_distance' | 'location' | 'gender_preference' | 'sexual_orientation'>;
type ProfileLocationField = Pick<Tables<'user_profiles'>, 'location'>;

export interface DiscoveryPreferences {
  min_age: number;
  max_age: number;
  max_distance: number;
  location?: string | null;
  gender_preference?: string | null;
  sexual_orientation?: string | null;
}


/**
 * Checks if a user has completed the full onboarding flow
 * Requirements: user_profiles, astro_details, section1_qns (onboarding responses), and at least one photo
 */
export async function hasCompletedOnboarding(userId: string): Promise<boolean> {
  try {
    // Check user_profiles
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('user_id')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      return false;
    }

    // Check astro_details
    const astroCheck = await getAstroDetails(userId);
    if (!astroCheck.success || !astroCheck.data) {
      return false;
    }

    // Check section1_qns (onboarding responses)
    const { data: section1Data, error: section1Error } = await supabase
      .from('section1_qns')
      .select('user_id')
      .eq('user_id', userId)
      .single();

    if (section1Error || !section1Data) {
      return false;
    }

    // Check if user has at least one photo
    const photosResult = await getUserPhotos(userId);
    if (!photosResult.success || !photosResult.data || photosResult.data.length === 0) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Error checking onboarding completion:', error);
    return false;
  }
}

export async function fetchFinalMatches(userIdOverride?: string): Promise<{ data: FinalMatchResult[]; isFallback: boolean }> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();

    const sessionUserId = sessionData?.session?.user?.id;
    const userId = userIdOverride || sessionUserId;

    if (!userId) {
      console.log('❌ No user session found');
      return { data: [], isFallback: true };
    }

    // Verify user has astro details before calling RPC
    const astroCheck = await getAstroDetails(userId);
    if (!(astroCheck.success && astroCheck.data)) {
      console.warn('⚠️ [fetchFinalMatches] User astro details missing or error:', astroCheck.error);
    }

    const { data, error } = await supabase.rpc('get_final_matches', {
      input_user_id: userId,
    });

    if (error || !data || data.length === 0) {
      if (error) console.log('❌ RPC ERROR (get_final_matches):', error.message, error);

      const { data: fallbackData } = await supabase.rpc('get_fallback_feed', {
        input_user_id: userId,
      });
      // Normalize null → undefined to satisfy FinalMatchResult type
      const normalizedFallback: FinalMatchResult[] = (fallbackData ?? []).map((u: any) => ({
        ...u,
        personality_vector: u.personality_vector ?? undefined,
        indian_recommendation: u.indian_recommendation ?? undefined,
        western_report: u.western_report ?? undefined,
      }));
      return { data: normalizedFallback, isFallback: true };
    }

    // Normalize null → undefined to satisfy FinalMatchResult type
    const normalizedData: FinalMatchResult[] = data.map((u: any) => ({
      ...u,
      personality_vector: u.personality_vector ?? undefined,
      indian_recommendation: u.indian_recommendation ?? undefined,
      western_report: u.western_report ?? undefined,
    }));
    return { data: normalizedData, isFallback: false };
  } catch (error) {
    console.error('❌ Unexpected error fetching final matches:', error);
    return { data: [], isFallback: true };
  }
}



export async function getDiscoveryPreferences(): Promise<DiscoveryPreferences | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('❌ No user session found when loading discovery preferences');
      return null;
    }

    const [prefsResult, profileResult] = await Promise.all([
      supabase
        .from('user_preferences')
        .select('min_age, max_age, max_distance, location, gender_preference, sexual_orientation')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('user_profiles')
        .select('location')
        .eq('user_id', user.id)
        .maybeSingle(),
    ]);

    const prefs: UserPreferenceFields | null = prefsResult.data;
    const profile: ProfileLocationField | null = profileResult.data;

    const min_age = prefs?.min_age ?? 18;
    const max_age = prefs?.max_age ?? 65;
    const max_distance = prefs?.max_distance ?? 50;

    return {
      min_age,
      max_age,
      max_distance,
      location: prefs?.location ?? profile?.location ?? null,
      gender_preference: prefs?.gender_preference ?? null,
      sexual_orientation: prefs?.sexual_orientation ?? null,
    };
  } catch (error) {
    console.error('❌ Error fetching discovery preferences:', error);
    return null;
  }
}

export { getStandouts };

