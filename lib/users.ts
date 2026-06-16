import { getOtherUserIdFromMatch } from './matches';
import { supabase } from './supabase';

export interface User {
  user_id: string;
  full_name: string;
  phone_number: string;
  email: string;
  avatar?: string | null;
  isOnline?: boolean;
  channel_id?: string; // Add channel_id for matched users
  matched_at?: string; // Add matched_at timestamp
}

/**
 * Fetches all matched users from the database (only users who have matched with current user)
 * @returns Array of matched user profiles
 */
export const getAllUsers = async (): Promise<{ success: boolean; data?: User[]; error?: string }> => {
  try {
    // Get current user ID
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      if (userError?.name !== 'AuthSessionMissingError' && userError?.message !== 'Auth session missing!') { console.error('❌ Could not get current user:', userError); }
      return {
        success: false,
        error: 'User not authenticated',
      };
    }

    const currentUserId = user.id;

    // Get ALL matches for this user
    const [matchesResult] = await Promise.all([
      supabase
        .from('user_matches')
        .select('*')
        .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`)
        .order('matched_at', { ascending: false }),
    ]);

    if (matchesResult.error || !matchesResult.data || matchesResult.data.length === 0) {
      return {
        success: true,
        data: [],
      };
    }

    const filteredMatches = matchesResult.data; // No more report-based filtering here, handled by UI layer

    // Extract all matched user IDs
    const matchedUserIds = filteredMatches.map((match) => 
      getOtherUserIdFromMatch(match, currentUserId)
    );

    // Create a map of user_id to channel_id and matchedAt
    const matchInfoMap = new Map<string, { channelId: string; matchedAt: string }>();
    filteredMatches.forEach((match) => {
      const otherUserId = getOtherUserIdFromMatch(match, currentUserId);
      matchInfoMap.set(otherUserId, { 
        channelId: match.channel_id ?? '', 
        matchedAt: match.matched_at ?? new Date().toISOString()
      });
    });

    if (matchedUserIds.length === 0) {
      return {
        success: true,
        data: [],
      };
    }

    // Fetch user profiles and photos in parallel
    const [profilesResult, photosResult, onlineStatusResult] = await Promise.all([
      supabase
        .from('user_profiles')
        .select('user_id, full_name, phone_number, email')
        .in('user_id', matchedUserIds),
      supabase
        .from('user_photos')
        .select('user_id, photo_url, is_primary')
        .in('user_id', matchedUserIds)
        .order('is_primary', { ascending: false }), // Get primary first if it exists
      (async () => {
        const { getOnlineStatusBatch } = await import('./online-status');
        return getOnlineStatusBatch(matchedUserIds);
      })(),
    ]);

    if (profilesResult.error) {
      console.error('❌ Error fetching matched users:', profilesResult.error);
      return {
        success: false,
        error: profilesResult.error.message,
      };
    }

    const profiles = profilesResult.data || [];
    if (profiles.length === 0) {
      return {
        success: true,
        data: [],
      };
    }

    // Create a map of user_id to photo_url (picks the first photo, which will be the primary due to sorting)
    const photoMap = new Map<string, string>();
    if (photosResult.data && !photosResult.error) {
      photosResult.data.forEach((photo) => {
        // If map already has a photo for this user, don't overwrite it
        // Since we ordered by is_primary DESC, the first one we see is the primary
        if (photo.user_id && !photoMap.has(photo.user_id)) {
          photoMap.set(photo.user_id, photo.photo_url ?? '');
        }
      });
    }

    const onlineStatusMap = onlineStatusResult || new Map<string, boolean>();

    // Combine profiles with photos, online status, and channel_id
    const usersWithStatus = profiles.map((profile) => ({
      user_id: profile.user_id,
      full_name: profile.full_name,
      phone_number: profile.phone_number,
      email: profile.email,
      avatar: photoMap.get(profile.user_id) || null,
      isOnline: onlineStatusMap.get(profile.user_id) || false,
      channel_id: matchInfoMap.get(profile.user_id)?.channelId,
      matched_at: matchInfoMap.get(profile.user_id)?.matchedAt,
    }));

    const users: User[] = usersWithStatus;

    return {
      success: true,
      data: users,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Exception fetching matched users:', errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * Fetches a single user by user_id
 * @param userId - User ID to fetch
 * @returns User profile with photo
 */
export const getUserById = async (userId: string): Promise<{ success: boolean; data?: User; error?: string }> => {
  try {
    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('user_id, full_name, phone_number, email')
      .eq('user_id', userId)
      .maybeSingle();

    if (profileError || !profile) {
      console.error('❌ Error fetching user:', profileError);
      return {
        success: false,
        error: profileError?.message || 'User not found',
      };
    }

    // Fetch primary photo
    const { data: photo, error: photoError } = await supabase
      .from('user_photos')
      .select('photo_url')
      .eq('user_id', userId)
      .eq('is_primary', true)
      .maybeSingle();

    const user: User = {
      user_id: profile.user_id,
      full_name: profile.full_name,
      phone_number: profile.phone_number,
      email: profile.email,
      avatar: photo?.photo_url || null,
      isOnline: false, // TODO: Implement online status tracking
    };

    return {
      success: true,
      data: user,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Exception fetching user:', errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
};