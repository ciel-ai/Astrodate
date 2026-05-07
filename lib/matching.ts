import { getAstroDetails } from './astro-details';
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

export interface DiscoveryPreferences {
  min_age: number;
  max_age: number;
  max_distance: number;
  location?: string | null;
  gender_preference?: string | null;
  sexual_orientation?: string | null;
}

export async function fetchPersonalityMatches(targetUserId?: string) {
  try {
    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData?.session?.user?.id) {
      console.log('❌ No user session found');
      return null;
    }

    const userId = sessionData.session.user.id;
    const bodyPayload: any = { input_user_id: userId, user_id: userId };
    if (targetUserId) {
      bodyPayload.target_user_id = targetUserId;
    }

    const { data, error } = await supabase.functions.invoke('personality_compute', {
      body: bodyPayload,
    });

    if (error) {
      console.log('❌ Edge Function Error:', error);
      return null;
    }

    return data || null;
  } catch (error) {
    console.error('❌ Unexpected error fetching personality matches:', error);
    return null;
  }
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

export async function fetchFinalMatches(userIdOverride?: string) {
  try {
    const { data: sessionData } = await supabase.auth.getSession();

    const sessionUserId = sessionData?.session?.user?.id;
    const userId = userIdOverride || sessionUserId;

    if (!userId) {
      console.log('❌ No user session found');
      return [] as FinalMatchResult[];
    }

    // Verify user has astro details before calling RPC
    const astroCheck = await getAstroDetails(userId);
    if (!(astroCheck.success && astroCheck.data)) {
      console.warn('⚠️ [fetchFinalMatches] User astro details missing or error:', astroCheck.error);
    }

    // Call using the expected parameter name from your SQL: input_user_id
    const { data, error } = await supabase.rpc('get_final_matches', {
      input_user_id: userId,
    });
    if (error) {
      console.log('❌ RPC ERROR (get_final_matches):', error.message, error);
      return [] as FinalMatchResult[];
    }

    // Skip the RLS-failing hasCompletedOnboarding check and directly return the fetched matches.
    const completedOnboarding = data || [];

    return completedOnboarding;
  } catch (error) {
    console.error('❌ Unexpected error fetching final matches:', error);
    return [] as FinalMatchResult[];
  }
}

export async function fetchAllRegisteredUsers() {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const currentUserId = sessionData?.session?.user?.id;

    // Grab all users from user_profiles table
    const { data: profiles, error } = await supabase
      .from('user_profiles')
      .select('user_id, full_name, gender, location, created_at, personality_vector');

    if (error) {
      console.error('❌ Error fetching registered users:', error);
      return [] as FinalMatchResult[];
    }

    const profileList = profiles || [];

    // Fetch birth dates for age calculation
    const profileUserIds = profileList.map((p: any) => p.user_id).filter(Boolean);
    const ageMap = new Map<string, number>();

    if (profileUserIds.length > 0) {
      const { data: astroRows, error: astroError } = await supabase
        .from('astro_details')
        .select('user_id, birth_date')
        .in('user_id', profileUserIds);

      if (astroError) {
        console.warn('⚠️ Error fetching astro_details for ages:', astroError);
      } else if (astroRows) {
        const today = new Date();
        for (const row of astroRows as any[]) {
          if (!row.birth_date) continue;
          const birth = new Date(row.birth_date);
          if (Number.isNaN(birth.getTime())) continue;
          let age = today.getFullYear() - birth.getFullYear();
          const m = today.getMonth() - birth.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
            age--;
          }
          ageMap.set(row.user_id, age);
        }
      }
    }

    // Fetch IDs the current user has already acted on
    const actedUserIds = new Set<string>();
    if (currentUserId) {
      const { data: swipes } = await supabase
        .from('swipe_actions')
        .select('target_user_id')
        .eq('user_id', currentUserId);
      if (swipes) {
        for (const s of swipes as any[]) {
          if (s.target_user_id) actedUserIds.add(s.target_user_id);
        }
      }
    }

    const registeredUsers: FinalMatchResult[] = [];

    for (const p of profileList) {
      // Exclude self if possible
      if (currentUserId && p.user_id === currentUserId) continue;

      // Exclude users already acted upon (liked, disliked, superliked)
      if (actedUserIds.has(p.user_id)) continue;

      const computedAge = ageMap.get(p.user_id);

      registeredUsers.push({
        match_user_id: p.user_id,
        full_name: p.full_name,
        gender: p.gender || 'Unknown',
        age: typeof computedAge === 'number' ? computedAge : undefined as any,
        location: p.location || 'Unknown',
        personality_score: 0,
        indian_score: 0,
        western_score: 0,
        final_match_score: 0,
        indian_recommendation: null,
        western_report: null,
        personality_vector: p.personality_vector,
      });
    }

    return registeredUsers;
  } catch (err) {
    console.error('❌ Unexpected error fetching all registered users:', err);
    return [] as FinalMatchResult[];
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

    const prefs = prefsResult.data as any | null;
    const profile = profileResult.data as any | null;

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