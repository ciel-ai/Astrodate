import { supabase } from './supabase';

/**
 * Blocks a user using the block_user RPC.
 * This also automatically unmatches them (removes from matches table).
 * @param blockedUserId - User ID of the user to block
 * @returns Success status and error message if any
 */
export const blockUser = async (
  blockedUserId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Call .rpc as a method on `supabase` so its internal `this` is preserved.
    // (Extracting it into a variable detaches `this` → "Cannot read property 'rest' of undefined".)
    const { error } = await (supabase as any).rpc('block_user', {
      p_blocked_id: blockedUserId,
    });

    if (error) {
      console.error('❌ Error blocking user:', error);
      return { success: false, error: error.message };
    }



    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Exception blocking user:', errorMessage);
    return { success: false, error: errorMessage };
  }
};

/**
 * Unblocks a user by deleting the block row.
 * There is no unblock RPC; the "Users can delete own blocks" RLS policy
 * (blocker_id = auth.uid()) restricts this delete to the current user's own
 * block of this person, so we only need to match on blocked_id.
 * @param blockedUserId - User ID of the user to unblock
 * @returns Success status and error message if any
 */
export const unblockUser = async (
  blockedUserId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await (supabase as any)
      .from('block_users')
      .delete()
      .eq('blocked_id', blockedUserId);

    if (error) {
      console.error('❌ Error unblocking user:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Exception unblocking user:', errorMessage);
    return { success: false, error: errorMessage };
  }
};

/**
 * Gets all blocked user IDs for the current user using get_blocked_user_ids RPC
 * @returns Array of blocked user IDs
 */
export const getBlockedUserIds = async (): Promise<{ success: boolean; data?: string[]; error?: string }> => {
  try {
    const { data, error } = await (supabase as any).rpc('get_blocked_user_ids');

    if (error) {
      console.error('❌ Error fetching blocked users:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data as unknown as string[] };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Exception fetching blocked users:', errorMessage);
    return { success: false, error: errorMessage };
  }
};
