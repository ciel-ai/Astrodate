import { supabase } from './supabase';

export interface Match {
  id: string;
  user1_id: string;
  user2_id: string;
  channel_id: string;
  matched_at: string | null;
  created_at: string | null;
}

/**
 * Gets the match between current user and another user
 * @param otherUserId - The other user's ID
 * @returns Match data if exists, null otherwise
 */
export const getMatch = async (
  otherUserId: string
): Promise<{ success: boolean; data?: Match; error?: string }> => {
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

    // Check for match where current user is user1 and other is user2
    const { data: match1, error: error1 } = await supabase
      .from('user_matches')
      .select('*')
      .eq('user1_id', currentUserId)
      .eq('user2_id', otherUserId)
      .maybeSingle();

    // If not found, check where current user is user2 and other is user1
    if (error1 || !match1) {
      const { data: match2, error: error2 } = await supabase
        .from('user_matches')
        .select('*')
        .eq('user1_id', otherUserId)
        .eq('user2_id', currentUserId)
        .maybeSingle();

      if (error2 || !match2) {
        // No match found
        return {
          success: true,
          data: undefined,
        };
      }

      return {
        success: true,
        data: match2 as Match,
      };
    }

    return {
      success: true,
      data: match1 as Match,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Exception getting match:', errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * Gets all matches for the current user
 * @returns Array of matches with the other user's ID
 */
export const getAllMatches = async (): Promise<{ success: boolean; data?: Match[]; error?: string }> => {
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

    // Fetch all matches where current user is user1 or user2
    const { data: matches, error } = await supabase
      .from('user_matches')
      .select('*')
      .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`)
      .order('matched_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching matches:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    if (!matches || matches.length === 0) {
      return {
        success: true,
        data: [],
      };
    }

    // Get reports involving current user only (either as reporter or reported)
    // Filtering server-side avoids leaking other users' report data to the client
    const { data: reports } = await supabase
      .from('reports')
      .select('reported_user_id, reporter_id, channel_id')
      .in('status', ['pending', 'reviewed'])
      .or(`reported_user_id.eq.${currentUserId},reporter_id.eq.${currentUserId}`);

    const reportedChannelIds =
      reports?.filter((r) => r.channel_id).map((r) => r.channel_id as string) || [];
    const reportedUserIds = new Set<string>();
    (reports || []).forEach((r) => {
      if (r.reported_user_id) reportedUserIds.add(r.reported_user_id);
      if (r.reporter_id) reportedUserIds.add(r.reporter_id);
    });

    // Hide matches with users the current user has blocked. Blocking keeps the
    // match (so it can be restored on unblock), so we filter it out here while
    // the block is active. Unblocking removes the block → the match reappears.
    const { getBlockedUserIds } = await import('./blocks');
    const blockedResult = await getBlockedUserIds();
    const blockedUserIds = new Set<string>(
      blockedResult.success ? (blockedResult.data ?? []) : []
    );

    // Filter out matches whose channel_id is reported OR whose other user is reported/blocked
    const filteredMatches = matches.filter((match) => {
      if (reportedChannelIds.includes(match.channel_id)) return false;
      const otherUserId = match.user1_id === currentUserId ? match.user2_id : match.user1_id;
      if (reportedUserIds.has(otherUserId)) return false;
      if (blockedUserIds.has(otherUserId)) return false;
      return true;
    });

    console.log(`✅ Fetched ${filteredMatches.length} matches for user ${currentUserId} (filtered ${matches.length - filteredMatches.length} reported)`);
    return {
      success: true,
      data: filteredMatches as Match[],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Exception fetching matches:', errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * Gets the other user's ID from a match
 * @param match - The match object
 * @param currentUserId - Current user's ID
 * @returns The other user's ID
 */
export const getOtherUserIdFromMatch = (match: Match, currentUserId: string): string => {
  return match.user1_id === currentUserId ? match.user2_id : match.user1_id;
};

/**
 * Deletes a match between current user and another user
 * @param otherUserId - The other user's ID
 * @returns Success status
 */
export const deleteMatch = async (
  otherUserId: string
): Promise<{ success: boolean; error?: string }> => {
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

    // Ensure user1_id < user2_id for consistency (as per table constraint)
    const [user1, user2] = [currentUserId, otherUserId].sort();

    console.log('🔍 Attempting to delete match:', { currentUserId, otherUserId, user1, user2 });

    // First, check if the match exists and get channel_id for cleanup
    const { data: existingMatch, error: checkError } = await supabase
      .from('user_matches')
      .select('id, user1_id, user2_id, channel_id')
      .eq('user1_id', user1)
      .eq('user2_id', user2)
      .maybeSingle();

    if (checkError) {
      console.error('❌ Error checking for match:', checkError);
    } else if (!existingMatch) {
      console.warn('⚠️ Match not found. It may have already been deleted.');
      // Still return success since the goal (no match) is achieved
      return {
        success: true,
      };
    } else {
      console.log('✅ Match found, proceeding with deletion:', existingMatch);
    }

    // Delete match from user_matches table
    // Since the table constraint ensures user1_id < user2_id, we know user1 < user2
    const { data, error } = await supabase
      .from('user_matches')
      .delete()
      .eq('user1_id', user1)
      .eq('user2_id', user2)
      .select();

    if (error) {
      console.error('❌ Error deleting match:', error);
      console.error('❌ Error code:', error.code);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error details:', JSON.stringify(error, null, 2));
      return {
        success: false,
        error: error.message || 'Failed to delete match. Please check if DELETE policy is applied.',
      };
    }

    // Check if anything was actually deleted
    if (!data || data.length === 0) {
      console.warn('⚠️ Delete query succeeded but no rows were deleted.');
      console.warn('⚠️ This might indicate an RLS policy issue.');
      return {
        success: false,
        error: 'Match not deleted. Please verify DELETE policy is applied in Supabase.',
      };
    } else {
      console.log(`✅ Successfully deleted ${data.length} match(es) from user_matches table`);
    }

    console.log('✅ Match deleted successfully');
    return {
      success: true,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Exception deleting match:', errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
};