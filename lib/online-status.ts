import { supabase } from './supabase';

const isTransientNetworkError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error || '');
  return (
    message.includes('Network request failed') ||
    message.includes('AuthRetryableFetchError') ||
    message.includes('Failed to fetch')
  );
};

const isSessionMissingError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error || '');
  const errorName = typeof error === 'object' && error !== null && 'name' in error
    ? String(error.name)
    : '';
  return (
    message.includes('Auth session missing') ||
    message.includes('AuthSessionMissingError') ||
    errorName === 'AuthSessionMissingError'
  );
};

/**
 * Updates user's online status.
 * Silently skips if session is not yet restored (cold start race condition).
 */
export const updateOnlineStatus = async (
  isOnline: boolean
): Promise<{ success: boolean; error?: string }> => {
  try {
    // FIX: Use getSession() instead of getUser().
    // getUser() makes a network round-trip to Supabase auth server and throws
    // AuthSessionMissingError if AsyncStorage hasn't restored the session yet
    // (common on cold start). getSession() reads from the local cache first
    // and never throws — it just returns null if no session exists yet.
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;

    if (!userId) {
      // Session not ready yet — silent skip, not an error.
      // This is normal during cold start before AsyncStorage finishes loading.
      return { success: false, error: 'No session' };
    }

    const { error } = await supabase
      .from('user_online_status')
      .upsert(
        {
          user_id: userId,
          is_online: isOnline,
          last_seen: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      console.warn('⚠️ Could not update online status (table may not exist):', error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: unknown) {
    // Session missing during cold start — completely normal, silent skip
    if (isSessionMissingError(err)) {
      return { success: false, error: 'No session' };
    }
    if (isTransientNetworkError(err)) {
      console.warn('⚠️ Online status skipped (network unavailable)');
      return { success: false, error: 'Network unavailable' };
    }
    // Unexpected error — warn but never throw (non-fatal)
    console.warn('⚠️ updateOnlineStatus unexpected error (non-fatal):', err);
    return { success: false, error: String(err) };
  }
};

/**
 * Gets online status for a user.
 */
export const getOnlineStatus = async (
  userId: string
): Promise<{ success: boolean; isOnline?: boolean; error?: string }> => {
  try {
    const { data, error } = await supabase.rpc('get_user_presence', {
      p_target_user_id: userId,
    });

    if (error || !data) {
      return { success: true, isOnline: false };
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row || !row.is_online || !row.last_seen) {
      return { success: true, isOnline: false };
    }

    const diffMinutes = (Date.now() - new Date(row.last_seen).getTime()) / 60000;
    return { success: true, isOnline: diffMinutes < 5 };
  } catch (err) {
    return { success: true, isOnline: false };
  }
};

/**
 * Gets online status for multiple users at once (batch).
 */
export const getOnlineStatusBatch = async (
  userIds: string[]
): Promise<Map<string, boolean>> => {
  const offlineMap = () => {
    const m = new Map<string, boolean>();
    userIds.forEach((id) => m.set(id, false));
    return m;
  };

  if (userIds.length === 0) return new Map();

  try {
    const { data, error } = await supabase.rpc('get_matched_user_presence', {
      p_target_user_ids: userIds,
    });

    if (error || !data) {
      console.warn('⚠️ Could not fetch online statuses:', error?.message || 'unknown');
      return offlineMap();
    }

    const rows = Array.isArray(data) ? data : [data];
    const now = Date.now();
    const statusMap = new Map<string, boolean>();

    rows.forEach((record) => {
      let isOnline = false;
      if (record?.is_online && record?.last_seen) {
        const diffMinutes = (now - new Date(record.last_seen).getTime()) / 60000;
        isOnline = diffMinutes < 5;
      }
      if (record?.user_id) {
        statusMap.set(record.user_id, isOnline);
      }
    });

    userIds.forEach((id) => {
      if (!statusMap.has(id)) statusMap.set(id, false);
    });

    return statusMap;
  } catch (err) {
    console.warn('⚠️ getOnlineStatusBatch exception (non-fatal):', err);
    return offlineMap();
  }
};
