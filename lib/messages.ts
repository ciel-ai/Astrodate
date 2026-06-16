import { getMatch } from './matches';
import { drainPendingPushNotifications } from './notifications';
import { supabase } from './supabase';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ModerationStatus = 'SAFE' | 'SPAM' | 'HARASSMENT' | 'ILLEGAL';

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  message_text: string;
  is_read: boolean;
  channel_id: string;
  created_at: string;
  moderation_status?: ModerationStatus;
}

// ── Moderation helper ─────────────────────────────────────────────────────────

/**
 * Calls the moderate-message edge function to classify a message.
 * Fails open (returns 'SAFE') on network/service errors so a backend
 * misconfiguration never silently blocks legitimate users.
 */
const moderateMessage = async (messageText: string): Promise<ModerationStatus> => {
  try {
    const { data, error } = await supabase.functions.invoke<{ status: ModerationStatus }>(
      'moderate-message',
      { body: { messageText } }
    );

    if (error) {
      console.warn('⚠️ Moderation service error (failing open):', error.message);
      return 'SAFE';
    }

    const status = data?.status;
    if (status === 'SAFE' || status === 'SPAM' || status === 'HARASSMENT' || status === 'ILLEGAL') {
      return status;
    }

    console.warn('⚠️ Unexpected moderation status, defaulting to SAFE:', status);
    return 'SAFE';
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('⚠️ moderateMessage exception (failing open):', msg);
    return 'SAFE';
  }
};

// ── sendMessage ───────────────────────────────────────────────────────────────

/**
 * Moderates then sends a message to another user.
 * ILLEGAL messages are blocked before insert.
 * SPAM / HARASSMENT messages are stored with their classification for review.
 *
 * @param receiverId  - User ID of the message recipient
 * @param messageText - Text content of the message
 * @param channelId   - Optional channel_id (skips getMatch call if provided)
 */
export const sendMessage = async (
  receiverId: string,
  messageText: string,
  channelId?: string
): Promise<{ success: boolean; data?: Message; error?: string; blocked?: boolean }> => {
  try {
    // ── 1. Auth ────────────────────────────────────────────────────────────
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      if (userError?.name !== 'AuthSessionMissingError' && userError?.message !== 'Auth session missing!') { console.error('❌ Could not get current user:', userError); }
      return { success: false, error: 'User not authenticated' };
    }

    const senderId = user.id;

    // ── 2. Resolve channel ─────────────────────────────────────────────────
    let finalChannelId = channelId;
    if (!finalChannelId) {
      const matchResult = await getMatch(receiverId);
      if (!matchResult.success || !matchResult.data) {
        console.error('❌ Users are not matched');
        return { success: false, error: 'You can only message users you have matched with' };
      }
      finalChannelId = matchResult.data.channel_id;
    }

    // ── 3. Moderate ────────────────────────────────────────────────────────
    const moderationStatus = await moderateMessage(messageText);

    if (moderationStatus === 'ILLEGAL') {
      console.warn('🚫 Message blocked — classified as ILLEGAL');
      return {
        success: false,
        blocked: true,
        error: 'Message violates community guidelines and cannot be sent.',
      };
    }

    // ── 4. Insert ──────────────────────────────────────────────────────────
    console.log('📨 Inserting message:', {
      sender_id: senderId,
      receiver_id: receiverId,
      message_text: messageText,
      channel_id: finalChannelId,
      moderation_status: moderationStatus,
    });

    const { data, error } = await supabase
      .from('messages')
      .insert({
        sender_id: senderId,
        receiver_id: receiverId,
        message_text: messageText,
        is_read: false,
        channel_id: finalChannelId,
        moderation_status: moderationStatus,
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error sending message:', error);
      return { success: false, error: error.message };
    }

    drainPendingPushNotifications().catch(() => {});

    return { success: true, data: data as Message };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Exception sending message:', errorMessage);
    return { success: false, error: errorMessage };
  }
};

// ── getMessages ───────────────────────────────────────────────────────────────

/**
 * Fetches messages between current user and another user (optimized — uses channel_id)
 * @param otherUserId - User ID of the other participant
 * @param channelId   - Optional channel_id (skips getMatch call if provided)
 */
export const getMessages = async (
  otherUserId: string,
  channelId?: string
): Promise<{ success: boolean; data?: Message[]; error?: string }> => {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      if (userError?.name !== 'AuthSessionMissingError' && userError?.message !== 'Auth session missing!') { console.error('❌ Could not get current user:', userError); }
      return { success: false, error: 'User not authenticated' };
    }

    let finalChannelId = channelId;
    if (!finalChannelId) {
      const matchResult = await getMatch(otherUserId);
      if (!matchResult.success || !matchResult.data) {
        console.error('❌ Users are not matched');
        return { success: false, error: 'You can only view messages with users you have matched with' };
      }
      finalChannelId = matchResult.data.channel_id;
    }

    // Limit to latest 200 messages — prevents full-history fetch from blocking the UI.
    // Older message pagination can be added later via cursor/offset when needed.
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('channel_id', finalChannelId)
      .order('created_at', { ascending: false })
      .limit(200);

    // Results are newest-first from DB; reverse to get oldest-first for state
    // (MessageList re-sorts to newest-first for the inverted FlatList)
    if (data) data.reverse();

    if (error) {
      console.error('❌ Error fetching messages:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: (data || []) as Message[] };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Exception fetching messages:', errorMessage);
    return { success: false, error: errorMessage };
  }
};

// ── getLastMessage (deprecated) ───────────────────────────────────────────────

/**
 * @deprecated
 * Do not use. This query is not channel-scoped.
 * Use getLastMessagesBatch instead.
 */
export const getLastMessage = async (
  otherUserId: string
): Promise<{
  success: boolean;
  data?: { message: string; timestamp: Date; isRead: boolean; isSentByMe: boolean } | null;
  error?: string;
}> => {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: 'User not authenticated' };
    }

    const currentUserId = user.id;

    const matchResult = await getMatch(otherUserId);
    if (!matchResult.success || !matchResult.data) {
      return { success: true, data: null };
    }

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${currentUserId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUserId})`
      )
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('❌ Error fetching last message:', error);
      return { success: false, error: error.message };
    }

    if (!data || data.length === 0) {
      return { success: true, data: null };
    }

    const conversationMessage = data[0];
    return {
      success: true,
      data: {
        message: conversationMessage.message_text ?? '',
        timestamp: new Date(conversationMessage.created_at ?? Date.now()),
        isRead: conversationMessage.is_read ?? false,
        isSentByMe: conversationMessage.sender_id === currentUserId,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Exception fetching last message:', errorMessage);
    return { success: false, error: errorMessage };
  }
};

// ── getUnreadCount ────────────────────────────────────────────────────────────

export const getUnreadCount = async (
  otherUserId: string
): Promise<{ success: boolean; count?: number; error?: string }> => {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: 'User not authenticated' };
    }

    const currentUserId = user.id;

    const matchResult = await getMatch(otherUserId);
    if (!matchResult.success || !matchResult.data) {
      return { success: true, count: 0 };
    }

    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('sender_id', otherUserId)
      .eq('receiver_id', currentUserId)
      .eq('is_read', false);

    if (error) {
      console.error('❌ Error fetching unread count:', error);
      return { success: false, error: error.message };
    }

    return { success: true, count: count || 0 };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Exception fetching unread count:', errorMessage);
    return { success: false, error: errorMessage };
  }
};

// ── cleanupOldMessages ────────────────────────────────────────────────────────

export const cleanupOldMessages = async (): Promise<{
  success: boolean;
  deleted?: { messages: number; conversations: number };
  error?: string;
}> => {
  try {
    const { data, error } = await supabase.rpc('delete_old_messages');

    if (error) {
      console.error('❌ Error cleaning up old messages:', error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      deleted: {
        messages: data?.[0]?.deleted_count || 0,
        conversations: data?.[0]?.conversations_processed || 0,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Exception cleaning up old messages:', errorMessage);
    return { success: false, error: errorMessage };
  }
};

// ── markMessagesAsRead ────────────────────────────────────────────────────────

export const markMessagesAsRead = async (
  senderId: string,
  channelId?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      if (userError?.name !== 'AuthSessionMissingError' && userError?.message !== 'Auth session missing!') { console.error('❌ Could not get current user:', userError); }
      return { success: false, error: 'User not authenticated' };
    }

    const currentUserId = user.id;

    if (channelId) {
      const { error } = await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('channel_id', channelId)
        .eq('receiver_id', currentUserId)
        .eq('is_read', false);

      if (error) {
        console.error('❌ Error marking messages as read:', error);
        return { success: false, error: error.message };
      }
    } else {
      const { error } = await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('sender_id', senderId)
        .eq('receiver_id', currentUserId)
        .eq('is_read', false);

      if (error) {
        console.error('❌ Error marking messages as read:', error);
        return { success: false, error: error.message };
      }
    }

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Exception marking messages as read:', errorMessage);
    return { success: false, error: errorMessage };
  }
};

// ── markMessagesAsReadDebounced ───────────────────────────────────────────────

const markReadTimers = new Map<string, ReturnType<typeof setTimeout>>();

export const markMessagesAsReadDebounced = (senderId: string, channelId?: string): void => {
  const key = channelId || senderId;

  const existing = markReadTimers.get(key);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    markReadTimers.delete(key);
    markMessagesAsRead(senderId, channelId).catch((error) => {
      console.error('Error in debounced mark as read:', error);
    });
  }, 500);

  markReadTimers.set(key, timer);
};

// ── deleteMessages ────────────────────────────────────────────────────────────

export const deleteMessages = async (
  otherUserId: string,
  channelId?: string
): Promise<{ success: boolean; deletedCount?: number; error?: string }> => {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      if (userError?.name !== 'AuthSessionMissingError' && userError?.message !== 'Auth session missing!') { console.error('❌ Could not get current user:', userError); }
      return { success: false, error: 'User not authenticated' };
    }

    const currentUserId = user.id;

    if (channelId) {
      const { error } = await supabase.from('messages').delete().eq('channel_id', channelId);

      if (error) {
        console.error('❌ Error deleting messages by channel_id:', error);
        return { success: false, error: error.message };
      }
    } else {
      const { error: error1 } = await supabase
        .from('messages')
        .delete()
        .eq('sender_id', currentUserId)
        .eq('receiver_id', otherUserId);

      if (error1) {
        console.error('❌ Error deleting messages (sender):', error1);
        return { success: false, error: error1.message };
      }

      const { error: error2 } = await supabase
        .from('messages')
        .delete()
        .eq('sender_id', otherUserId)
        .eq('receiver_id', currentUserId);

      if (error2) {
        console.error('❌ Error deleting messages (receiver):', error2);
        return { success: false, error: error2.message };
      }
    }

    console.log('✅ Messages deleted successfully');
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Exception deleting messages:', errorMessage);
    return { success: false, error: errorMessage };
  }
};

// ── getLastMessagesBatch ──────────────────────────────────────────────────────

export const getLastMessagesBatch = async (
  otherUserIds: string[],
  channelIdMap?: Map<string, string>
): Promise<{
  success: boolean;
  data?: Map<string, { message: string; timestamp: Date; isRead: boolean; isSentByMe: boolean }>;
  error?: string;
}> => {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: 'User not authenticated' };
    }

    const currentUserId = user.id;

    if (otherUserIds.length === 0) {
      return { success: true, data: new Map() };
    }

    const messageMap = new Map<string, { message: string; timestamp: Date; isRead: boolean; isSentByMe: boolean }>();

    const results = await Promise.allSettled(
      otherUserIds.map((otherUserId) => {
        const channelId = channelIdMap?.get(otherUserId);
        if (channelId) {
          return supabase
            .from('messages')
            .select('sender_id, receiver_id, message_text, created_at, is_read')
            .eq('channel_id', channelId)
            .order('created_at', { ascending: false })
            .limit(1);
        }
        return supabase
          .from('messages')
          .select('sender_id, receiver_id, message_text, created_at, is_read')
          .or(
            `and(sender_id.eq.${currentUserId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUserId})`
          )
          .order('created_at', { ascending: false })
          .limit(1);
      })
    );

    results.forEach((result, index) => {
      const otherUserId = otherUserIds[index];
      if (
        result.status === 'fulfilled' &&
        !result.value.error &&
        result.value.data &&
        result.value.data.length > 0
      ) {
        const msg = result.value.data[0];
        messageMap.set(otherUserId, {
          message: msg.message_text ?? '',
          timestamp: new Date(msg.created_at ?? Date.now()),
          isRead: msg.is_read ?? false,
          isSentByMe: msg.sender_id === currentUserId,
        });
      }
    });

    return { success: true, data: messageMap };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Exception fetching last messages batch:', errorMessage);
    return { success: false, error: errorMessage };
  }
};

// ── getUnreadCountsBatch ──────────────────────────────────────────────────────

export const getUnreadCountsBatch = async (
  otherUserIds: string[]
): Promise<{ success: boolean; data?: Map<string, number>; error?: string }> => {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: 'User not authenticated' };
    }

    const currentUserId = user.id;

    if (otherUserIds.length === 0) {
      return { success: true, data: new Map() };
    }

    const { data, error } = await supabase
      .from('messages')
      .select('sender_id')
      .eq('receiver_id', currentUserId)
      .in('sender_id', otherUserIds)
      .eq('is_read', false);

    if (error) {
      console.error('❌ Error fetching unread counts batch:', error);
      return { success: false, error: error.message };
    }

    const countMap = new Map<string, number>();
    otherUserIds.forEach((userId) => {
      countMap.set(userId, 0);
    });

    if (data) {
      data.forEach((msg) => {
        if (!msg.sender_id) return;
        const count = countMap.get(msg.sender_id) || 0;
        countMap.set(msg.sender_id, count + 1);
      });
    }

    return { success: true, data: countMap };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Exception fetching unread counts batch:', errorMessage);
    return { success: false, error: errorMessage };
  }
};