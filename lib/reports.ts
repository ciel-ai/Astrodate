import { supabase } from './supabase';

export interface Report {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  channel_id?: string;
  category: string;
  subcategory?: string;
  details?: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  created_at: string;
  updated_at: string;
}

/**
 * Creates a report for a user
 * @param reportedUserId - User ID of the reported user
 * @param category - Report category (e.g., "Something on their profile", "Behavior on AstroDate")
 * @param subcategory - Report subcategory (e.g., "Photos or videos", "Inappropriate messages")
 * @param details - Additional details about the report
 * @param channelId - Channel ID of the conversation (remains constant, better for identification)
 * @returns Success status and report data
 */
export const createReport = async (
  reportedUserId: string,
  category: string,
  subcategory?: string,
  details?: string,
  channelId?: string
): Promise<{ success: boolean; data?: Report; error?: string }> => {
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

    const reporterId = user.id;

    // Get channel_id from the match if not provided
    let finalChannelId = channelId;
    if (!finalChannelId) {
      const { getMatch } = await import('./matches');
      const matchResult = await getMatch(reportedUserId);
      if (matchResult.success && matchResult.data) {
        finalChannelId = matchResult.data.channel_id;
      }
    }

    // Insert report into database with channel_id
    const { data, error } = await supabase
      .from('reports')
      .insert({
        reporter_id: reporterId,
        reported_user_id: reportedUserId,
        channel_id: finalChannelId || null,
        category: category,
        subcategory: subcategory || null,
        details: details || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating report:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    // Mark messages as reported (keep in backend for admin review, but hide from frontend)
    // Messages are NOT deleted - they remain in the database for review purposes
    // Frontend will filter them out using getReportedUserIds()
    if (finalChannelId) {
      try {
        const { error: updateError, data: updatedMessages } = await supabase
          .from('messages')
          .update({ is_reported: true })
          .eq('channel_id', finalChannelId)
          .select('id');
        
        if (updateError) {
          // Log error but don't fail the report creation
          console.error('❌ Error updating is_reported flag on messages:', updateError);
          console.error('❌ Update error details:', JSON.stringify(updateError, null, 2));
        } else {
          const messageCount = updatedMessages?.length || 0;
          console.log(`✅ Marked ${messageCount} messages as reported (kept in backend for review)`);
        }
      } catch (err) {
        console.error('❌ Exception updating is_reported flag:', err);
      }
    } else {
      console.warn('⚠️ No channel_id available to mark messages as reported');
    }

    // Delete likes between the users when reporting (remove from user_likes)
    try {
      const { deleteUserLikes } = await import('./user-likes');
      const deleteLikesResult = await deleteUserLikes(reportedUserId);
      if (!deleteLikesResult.success) {
        console.error('❌ Error deleting likes after report:', deleteLikesResult.error);
      } else {
        console.log('✅ Likes deleted between users after report');
      }
    } catch (err) {
      console.error('❌ Exception deleting likes after report:', err);
    }

    console.log('✅ Report created successfully');
    return {
      success: true,
      data: data as Report,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Exception creating report:', errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * Gets all reported user IDs for the current user
 * @returns Array of reported user IDs
 */
export const getReportedUserIds = async (): Promise<{ success: boolean; data?: string[]; error?: string }> => {
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

    const reporterId = user.id;

    // Fetch ALL reports by current user (regardless of status)
    // Once a user is reported, they should remain hidden from "your matches" 
    // even if the report status changes or is deleted from backend
    // No status filter - include all reports (pending, reviewed, resolved, dismissed)
    const { data, error } = await supabase
      .from('reports')
      .select('reported_user_id')
      .eq('reporter_id', reporterId);

    if (error) {
      console.error('❌ Error fetching reported users:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    const reportedUserIds = (data?.map((report) => report.reported_user_id) || []).filter((id): id is string => id !== null);

    return {
      success: true,
      data: reportedUserIds,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Exception fetching reported users:', errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * Returns active report channel_ids involving the current user
 * (either they reported someone or were reported) with pending/reviewed status.
 */
export const getActiveReportChannelIdsForCurrentUser = async (): Promise<{ success: boolean; data?: string[]; error?: string }> => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: 'User not authenticated' };
    }

    const { data, error } = await supabase
      .from('reports')
      .select('channel_id')
      .in('status', ['pending', 'reviewed'])
      .not('channel_id', 'is', null)
      .or(`reporter_id.eq.${user.id},reported_user_id.eq.${user.id}`);

    if (error) {
      return { success: false, error: error.message };
    }

    const channelIds = (data || []).map((r) => r.channel_id as string);
    return { success: true, data: channelIds };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
};

/**
 * Checks if current user is reported in a given channel (pending/reviewed).
 */
export const isUserReportedInChannel = async (
  channelId: string,
  userId: string
): Promise<{ success: boolean; reported?: boolean; error?: string }> => {
  try {
    const { data, error } = await supabase
      .from('reports')
      .select('id')
      .eq('channel_id', channelId)
      .eq('reported_user_id', userId)
      .in('status', ['pending', 'reviewed'])
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      return { success: false, error: error.message };
    }

    return { success: true, reported: !!data };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
};