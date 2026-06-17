import { supabase } from './supabase';
import type { Json } from './database.types';
import { drainPendingPushNotifications } from './notifications';
import { generateAndSaveIcebreaker } from './icebreaker';

export type LikeActionType = 'like' | 'dislike' | 'super_like';

export interface UserLike {
  id: string;
  user_id: string;
  liked_user_id: string;
  action_type: LikeActionType;
  created_at: string;
  updated_at: string;
}

/**
 * Save a like, dislike, or super like action
 * @param likedUserId - The user ID of the person being liked/disliked
 * @param actionType - The type of action: 'like', 'dislike', or 'super_like'
 * @returns Success status and any error
 */
export async function saveUserLike(
  likedUserId: string,
  actionType: LikeActionType,
  promptId?: string,
  comment?: string
): Promise<{ success: boolean; error?: string; data?: UserLike }> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;

    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }

    if (!likedUserId) {
      return { success: false, error: 'Liked user ID is required' };
    }

    if (userId === likedUserId) {
      return { success: false, error: 'Cannot like yourself' };
    }

    if (actionType === 'like') {
      const { data: allowed, error: rpcError } = await supabase
        .rpc('consume_like', { p_user_id: userId });

      if (rpcError) {
        throw new Error(rpcError.message || 'RPC consume_like failed');
      }

      if (!allowed) {
        return { success: false, error: 'LIKE_QUOTA_EXCEEDED' };
      }
    }

    if (actionType === 'super_like') {
      const { data: allowed, error: rpcError } = await supabase
        .rpc('consume_super_like', { p_user_id: userId });

      if (rpcError) {
        throw new Error(rpcError.message || 'RPC consume_super_like failed');
      }

      if (!allowed) {
        return { success: false, error: 'SUPER_LIKE_QUOTA_EXCEEDED' };
      }
    }

    // Use upsert to handle both insert and update cases
    // If a record exists, it will be updated; otherwise, a new one will be created
    const { data, error } = await supabase
      .from('user_likes')
      .upsert(
        {
          user_id: userId,
          liked_user_id: likedUserId,
          action_type: actionType,
          prompt_id: promptId || null,
          comment: comment || null,
          updated_at: new Date().toISOString(),
        } as any,
        {
          onConflict: 'user_id,liked_user_id',
        }
      )
      .select();

    if (error) {
      console.error('❌ Database error saving user like:', error);

      // Handle foreign key violation (23503) - target user doesn't exist in auth.users
      if ((error as any).code === '23503') {
        return { 
          success: false, 
          error: 'THE_USER_NO_LONGER_EXISTS',
          data: undefined
        };
      }

      return { success: false, error: error.message || 'Database error' };
    }

    return { success: true, data: data?.[0] as UserLike };
  } catch (error) {
    console.error('Unexpected error saving user like:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Generate a unique channel ID for two users
 * Channel ID is deterministic based on user IDs (same pair always gets same channel)
 * @param userId1 - First user ID
 * @param userId2 - Second user ID
 * @returns Channel ID string
 */
function generateChannelId(userId1: string, userId2: string): string {
  // Sort user IDs to ensure consistent channel ID regardless of order
  const [user1, user2] = [userId1, userId2].sort();
  // Create a deterministic channel ID from the sorted user IDs
  // Using a simple format: match_{sorted_user1}_{sorted_user2}
  return `match_${user1}_${user2}`;
}

/**
 * Withdraw a previously sent like (delete from user_likes).
 * Used from the "Likes Sent" tab to undo a pending like.
 */
export async function withdrawUserLike(
  likedUserId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) return { success: false, error: 'User not authenticated' };

    const { error } = await supabase
      .from('user_likes')
      .delete()
      .eq('user_id', userId)
      .eq('liked_user_id', likedUserId)
      .in('action_type', ['like', 'super_like']);

    if (error) {
      console.error('❌ Error withdrawing like:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('❌ Unexpected error withdrawing like:', err);
    return { success: false, error: err?.message ?? 'Unknown error' };
  }
}

/**
 * Save a match to the user_matches table
 * @param user1Id - First user ID
 * @param user2Id - Second user ID
 * @returns Success status and match data
 */
export async function saveMatch(
  user1Id: string,
  user2Id: string
): Promise<{ success: boolean; error?: string; data?: any; channelId?: string }> {
  try {
    // Ensure user1_id < user2_id for consistency (as per table constraint)
    const [user1, user2] = [user1Id, user2Id].sort();
    const channelId = generateChannelId(user1Id, user2Id);

    // Check if match already exists
    const { data: existingMatch, error: checkError } = await supabase
      .from('user_matches')
      .select('id, channel_id')
      .eq('user1_id', user1)
      .eq('user2_id', user2)
      .single();

    if (existingMatch && !checkError) {
      // Match already exists, return existing match
      console.log('✅ Match already exists:', existingMatch.channel_id);
      return {
        success: true,
        data: existingMatch,
        channelId: existingMatch.channel_id,
      };
    }

    // Insert new match
    const { data, error } = await supabase
      .from('user_matches')
      .insert({
        user1_id: user1,
        user2_id: user2,
        channel_id: channelId,
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving match:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Match saved successfully with channel ID:', channelId);
    return {
      success: true,
      data: data,
      channelId: channelId,
    };
  } catch (error) {
    console.error('Unexpected error saving match:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check if there's a mutual like (match) and save it if found
 * @param likedUserId - The user ID to check for mutual like
 * @returns Match status, channel ID, and any error
 */
export async function checkMutualLike(
  likedUserId: string
): Promise<{ isMatch: boolean; error?: string; channelId?: string; matchData?: any }> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;

    if (!userId) {
      return { isMatch: false, error: 'User not authenticated' };
    }

    // Check if the other user has liked the current user
    const { data, error } = await supabase
      .from('user_likes')
      .select('action_type')
      .eq('user_id', likedUserId)
      .eq('liked_user_id', userId)
      .in('action_type', ['like', 'super_like'])
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "no rows returned", which is expected if no match
      console.error('Error checking mutual like:', error);
      return { isMatch: false, error: error.message };
    }

    const isMatch = !!data;

    if (isMatch) {
      // Save the match to user_matches table with channel ID
      console.log('💕 Mutual like detected! Saving match...');
      const matchResult = await saveMatch(userId, likedUserId);

      if (matchResult.success) {
        // Kick off icebreaker generation in the background.
        // We deliberately do NOT await this — the match modal should open
        // immediately. By the time the user taps into chat, the icebreaker
        // will already be stored in user_matches.icebreaker_text.
        if (matchResult.data?.id) {
          generateAndSaveIcebreaker(matchResult.data.id).catch((err) => {
            // Swallow — failure here never blocks the match flow
            console.warn('[checkMutualLike] Icebreaker generation failed:', err);
          });
        }

        return {
          isMatch: true,
          channelId: matchResult.channelId,
          matchData: matchResult.data,
        };
      } else {
        // Match detected but failed to save - still return isMatch: true
        console.warn('⚠️ Match detected but failed to save:', matchResult.error);
        return {
          isMatch: true,
          error: matchResult.error,
        };
      }
    }

    return { isMatch: false };
  } catch (error) {
    console.error('Unexpected error checking mutual like:', error);
    return {
      isMatch: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get all matches for the current user
 * @returns Array of match data with channel IDs
 */
export async function getUserMatches(): Promise<{
  success: boolean;
  data?: Array<{
    id: string;
    user1_id: string;
    user2_id: string;
    channel_id: string;
    matched_at: string;
    other_user_id: string;
  }>;
  error?: string;
}> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;

    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }

    // Get matches where user is either user1 or user2
    const { data, error } = await supabase
      .from('user_matches')
      .select('id, user1_id, user2_id, channel_id, matched_at')
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .order('matched_at', { ascending: false });

    if (error) {
      console.error('Error getting user matches:', error);
      return { success: false, error: error.message };
    }

    // Map the results to include the other user's ID
    const matches = (data || []).map((match) => ({
      ...match,
      matched_at: match.matched_at ?? new Date().toISOString(),
      other_user_id: match.user1_id === userId ? match.user2_id : match.user1_id,
    }));

    return { success: true, data: matches };
  } catch (error) {
    console.error('Unexpected error getting user matches:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get channel ID for a match between two users
 * @param otherUserId - The other user's ID
 * @returns Channel ID if match exists
 */
export async function getChannelId(
  otherUserId: string
): Promise<{ success: boolean; channelId?: string; error?: string }> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;

    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }

    // Ensure consistent ordering
    const [user1, user2] = [userId, otherUserId].sort();

    const { data, error } = await supabase
      .from('user_matches')
      .select('channel_id')
      .eq('user1_id', user1)
      .eq('user2_id', user2)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No match found
        return { success: false, error: 'No match found' };
      }
      console.error('Error getting channel ID:', error);
      return { success: false, error: error.message };
    }

    return { success: true, channelId: data.channel_id };
  } catch (error) {
    console.error('Unexpected error getting channel ID:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get all users who liked the current user
 * @returns Array of user IDs who liked the current user
 */
export async function getUsersWhoLikedMe(): Promise<{
  success: boolean;
  data?: string[];
  error?: string;
}> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;

    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }

    const { data, error } = await supabase
      .from('user_likes')
      .select('user_id')
      .eq('liked_user_id', userId)
      .in('action_type', ['like', 'super_like']);

    if (error) {
      console.error('Error getting users who liked me:', error);
      return { success: false, error: error.message };
    }

    const userIds = (data || []).map((item) => item.user_id);
    return { success: true, data: userIds };
  } catch (error) {
    console.error('Unexpected error getting users who liked me:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get all users the current user has liked
 * @returns Array of user IDs the current user has liked
 */
export async function getUsersILiked(): Promise<{
  success: boolean;
  data?: string[];
  error?: string;
}> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;

    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }

    const { data, error } = await supabase
      .from('user_likes')
      .select('liked_user_id')
      .eq('user_id', userId)
      .in('action_type', ['like', 'super_like']);

    if (error) {
      console.error('Error getting users I liked:', error);
      return { success: false, error: error.message };
    }

    const userIds = (data || []).map((item) => item.liked_user_id);
    return { success: true, data: userIds };
  } catch (error) {
    console.error('Unexpected error getting users I liked:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Delete likes between two users (both directions)
 * This removes the like relationship completely when unmatching
 * @param otherUserId - The other user's ID
 * @returns Success status
 */
export async function deleteUserLikes(
  otherUserId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;

    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }

    if (!otherUserId) {
      return { success: false, error: 'Other user ID is required' };
    }

    // Delete likes in both directions:
    // 1. Current user's like of the other user
    // 2. Other user's like of the current user
    const [delete1Result, delete2Result] = await Promise.all([
      supabase
        .from('user_likes')
        .delete()
        .eq('user_id', userId)
        .eq('liked_user_id', otherUserId),
      supabase
        .from('user_likes')
        .delete()
        .eq('user_id', otherUserId)
        .eq('liked_user_id', userId),
    ]);

    if (delete1Result.error) {
      console.error('Error deleting user likes (direction 1):', delete1Result.error);
      // Continue even if one direction fails
    }

    if (delete2Result.error) {
      console.error('Error deleting user likes (direction 2):', delete2Result.error);
      // Continue even if one direction fails
    }

    // If both directions had errors, return failure
    if (delete1Result.error && delete2Result.error) {
      return {
        success: false,
        error: `Failed to delete likes: ${delete1Result.error.message}, ${delete2Result.error.message}`,
      };
    }

    console.log(`✅ Successfully deleted likes between ${userId} and ${otherUserId}`);
    return { success: true };
  } catch (error) {
    console.error('Unexpected error deleting user likes:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check if a specific user has superliked the current user
 * @param otherUserId - The user ID to check if they superliked you
 * @returns Success status and whether they superliked you
 */
export async function hasUserSuperlikedMe(
  otherUserId: string
): Promise<{ success: boolean; isSuperliked: boolean; error?: string }> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;

    if (!userId) {
      return { success: false, isSuperliked: false, error: 'User not authenticated' };
    }

    if (!otherUserId) {
      return { success: false, isSuperliked: false, error: 'Other user ID is required' };
    }

    // Check if the other user has superliked the current user
    const { data, error } = await supabase
      .from('user_likes')
      .select('*')
      .eq('user_id', otherUserId)
      .eq('liked_user_id', userId)
      .eq('action_type', 'super_like')
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "not found" - that's expected if no superlike exists
      console.error('Error checking superlike:', error);
      return { success: false, isSuperliked: false, error: error.message };
    }

    // If data exists, the user has superliked; if no data, they haven't
    const isSuperliked = !!data;

    return { success: true, isSuperliked };
  } catch (error) {
    console.error('Unexpected error checking superlike:', error);
    return {
      success: false,
      isSuperliked: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check if the current user has already acted on a specific profile (like/dislike/super_like)
 * @param targetUserId - The user ID to check
 * @returns Object indicating if action was taken and what type
 */
export async function hasActedOnProfile(
  targetUserId: string
): Promise<{ hasActed: boolean; actionType?: LikeActionType; error?: string }> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;

    if (!userId) {
      return { hasActed: false, error: 'User not authenticated' };
    }

    if (!targetUserId) {
      return { hasActed: false, error: 'Target user ID is required' };
    }

    const { data, error } = await supabase
      .from('user_likes')
      .select('action_type')
      .eq('user_id', userId)
      .eq('liked_user_id', targetUserId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No row found, means no action taken
        return { hasActed: false };
      }
      console.error('Error checking profile action:', error);
      return { hasActed: false, error: error.message };
    }

    return {
      hasActed: true,
      actionType: data.action_type as LikeActionType
    };
  } catch (error) {
    console.error('Unexpected error checking profile action:', error);
    return {
      hasActed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}