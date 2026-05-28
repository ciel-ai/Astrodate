import { getMatch } from './matches';
import { drainPendingPushNotifications } from './notifications';
import { supabase } from './supabase';
export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  message_text: string;
  is_read: boolean;
  channel_id: string;
  created_at: string;
}

/**
 * Sends a message to another user (optimized - accepts channel_id to avoid extra query)
 * @param receiverId - User ID of the message recipient
 * @param messageText - Text content of the message
 * @param channelId - Optional channel_id (if provided, skips getMatch call for better performance)
 * @returns Success status and message data
 */
export const sendMessage = async (
  receiverId: string,
  messageText: string,
  channelId?: string
): Promise<{ success: boolean; data?: Message; error?: string }> => {
  try {
    // Get current user ID
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('❌ Could not get current user:', userError);
      return {
        success: false,
        error: 'User not authenticated',
      };
    }

    const senderId = user.id;

    // Use provided channel_id or fetch it (cached channel_id is faster)
    let finalChannelId = channelId;
    if (!finalChannelId) {
      const matchResult = await getMatch(receiverId);
      if (!matchResult.success || !matchResult.data) {
        console.error('❌ Users are not matched');
        return {
          success: false,
          error: 'You can only message users you have matched with',
        };
      }
      finalChannelId = matchResult.data.channel_id;
    }

    // Insert message into database with channel_id (optimized - no extra queries)
    console.log('📨 Inserting message:', {
      sender_id: senderId,
      receiver_id: receiverId,
      message_text: messageText,
      channel_id: finalChannelId,
    });

    const { data, error } = await supabase
      .from('messages')
      .insert({
        sender_id: senderId,
        receiver_id: receiverId,
        message_text: messageText,
        is_read: false,
        channel_id: finalChannelId,
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error sending message:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    console.log('✅ Message stored in Supabase:', {
      id: data?.id,
      created_at: data?.created_at,
      message_text: data?.message_text,
    });
    drainPendingPushNotifications().catch(() => { });

    return {
      success: true,
      data: data as Message,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Exception sending message:', errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * Fetches messages between current user and another user (optimized - uses channel_id)
 * @param otherUserId - User ID of the other participant
 * @param channelId - Optional channel_id (if provided, skips getMatch call for better performance)
 * @returns Array of messages
 */
export const getMessages = async (
  otherUserId: string,
  channelId?: string
): Promise<{ success: boolean; data?: Message[]; error?: string }> => {
  try {
    // Get current user ID
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('❌ Could not get current user:', userError);
      return {
        success: false,
        error: 'User not authenticated',
      };
    }

    const currentUserId = user.id;

    // Use provided channel_id or fetch it (cached channel_id is faster)
    let finalChannelId = channelId;
    if (!finalChannelId) {
      const matchResult = await getMatch(otherUserId);
      if (!matchResult.success || !matchResult.data) {
        console.error('❌ Users are not matched');
        return {
          success: false,
          error: 'You can only view messages with users you have matched with',
        };
      }
      finalChannelId = matchResult.data.channel_id;
    }

    // Query by channel_id only — avoids leaking messages from old channels
    // after an unmatch + rematch cycle creates a new channel_id.
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('channel_id', finalChannelId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('❌ Error fetching messages:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      data: (data || []) as Message[],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Exception fetching messages:', errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * @deprecated
 * Do not use. This query is not channel-scoped.
 * Use getLastMessagesBatch instead.
 */
export const getLastMessage = async (
  otherUserId: string
): Promise<{ success: boolean; data?: { message: string; timestamp: Date; isRead: boolean; isSentByMe: boolean } | null; error?: string }> => {
  try {
    // Get current user ID
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        success: false,
        error: 'User not authenticated',
      };
    }

    const currentUserId = user.id;

    // Verify that users are matched (only check if we need to fetch messages)
    // If no match, return null (no last message)
    const matchResult = await getMatch(otherUserId);
    if (!matchResult.success || !matchResult.data) {
      return {
        success: true,
        data: null,
      };
    }

    // Fetch messages between current user and other user
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUserId})`)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('❌ Error fetching last message:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    if (!data || data.length === 0) {
      return {
        success: true,
        data: null,
      };
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
    return {
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * Gets unread message count for a conversation
 * @param otherUserId - User ID of the other participant
 * @returns Unread message count
 */
export const getUnreadCount = async (
  otherUserId: string
): Promise<{ success: boolean; count?: number; error?: string }> => {
  try {
    // Get current user ID
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        success: false,
        error: 'User not authenticated',
      };
    }

    const currentUserId = user.id;

    // Verify that users are matched (if no match, return 0 unread)
    const matchResult = await getMatch(otherUserId);
    if (!matchResult.success || !matchResult.data) {
      return {
        success: true,
        count: 0,
      };
    }

    // Count unread messages from other user to current user
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('sender_id', otherUserId)
      .eq('receiver_id', currentUserId)
      .eq('is_read', false);

    if (error) {
      console.error('❌ Error fetching unread count:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      count: count || 0,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Exception fetching unread count:', errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * Calls the delete_old_messages function to clean up messages older than 5 minutes
 * This is called periodically from the client to ensure automatic deletion
 * @returns Success status and deletion statistics
 */
export const cleanupOldMessages = async (): Promise<{ success: boolean; deleted?: { messages: number; conversations: number }; error?: string }> => {
  try {
    const { data, error } = await supabase.rpc('delete_old_messages');

    if (error) {
      console.error('❌ Error cleaning up old messages:', error);
      return {
        success: false,
        error: error.message,
      };
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
    return {
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * Marks messages as read (optimized - uses channel_id for faster query)
 * @param senderId - User ID of the message sender
 * @param channelId - Optional channel_id (if provided, skips getMatch call for better performance)
 * @returns Success status
 */
export const markMessagesAsRead = async (
  senderId: string,
  channelId?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Get current user ID
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('❌ Could not get current user:', userError);
      return {
        success: false,
        error: 'User not authenticated',
      };
    }

    const currentUserId = user.id;

    // OPTIMIZED: Use channel_id if provided, otherwise use sender_id/receiver_id
    if (channelId) {
      // Fast path: use channel_id (uses index)
      const { error } = await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('channel_id', channelId)
        .eq('receiver_id', currentUserId)
        .eq('is_read', false);

      if (error) {
        console.error('❌ Error marking messages as read:', error);
        return {
          success: false,
          error: error.message,
        };
      }
    } else {
      // Fallback: use sender_id/receiver_id
      const { error } = await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('sender_id', senderId)
        .eq('receiver_id', currentUserId)
        .eq('is_read', false);

      if (error) {
        console.error('❌ Error marking messages as read:', error);
        return {
          success: false,
          error: error.message,
        };
      }
    }

    return {
      success: true,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Exception marking messages as read:', errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
};

// Keyed debounce map — one independent timer per channelId.
// Avoids module-level globals that break when multiple chat screens are mounted.
const markReadTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Debounced version of markMessagesAsRead - batches read receipts for better performance.
 * Safe for concurrent use across multiple open chat screens.
 * @param senderId - User ID of the message sender
 * @param channelId - Optional channel_id (used as debounce key)
 */
export const markMessagesAsReadDebounced = (
  senderId: string,
  channelId?: string
): void => {
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

/**
 * Deletes all messages between current user and another user
 * @param otherUserId - User ID of the other participant
 * @returns Success status and count of deleted messages
 */
export const deleteMessages = async (
  otherUserId: string,
  channelId?: string
): Promise<{ success: boolean; deletedCount?: number; error?: string }> => {
  try {
    // Get current user ID
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('❌ Could not get current user:', userError);
      return { success: false, error: 'User not authenticated' };
    }

    const currentUserId = user.id;

    if (channelId) {
      // Fast path — delete entire conversation by channel_id in one query.
      // Unambiguous even after unmatch + rematch cycles.
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('channel_id', channelId);

      if (error) {
        console.error('❌ Error deleting messages by channel_id:', error);
        return { success: false, error: error.message };
      }
    } else {
      // Fallback — delete by both directions when channel_id is unavailable.
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

/**
 * Batch fetch last messages for multiple users
 * @param otherUserIds - Array of user IDs
 * @returns Map of user_id to last message data
 */
export const getLastMessagesBatch = async (
  otherUserIds: string[]
): Promise<{ success: boolean; data?: Map<string, { message: string; timestamp: Date; isRead: boolean; isSentByMe: boolean }>; error?: string }> => {
  try {
    // Get current user ID
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        success: false,
        error: 'User not authenticated',
      };
    }

    const currentUserId = user.id;

    if (otherUserIds.length === 0) {
      return {
        success: true,
        data: new Map(),
      };
    }

    // Fetch the single latest message per conversation by querying each
    // conversation partner's channel directly — one targeted query per user
    // instead of scanning 2000 rows client-side.
    const messageMap = new Map<string, { message: string; timestamp: Date; isRead: boolean; isSentByMe: boolean }>();

    const results = await Promise.allSettled(
      otherUserIds.map((otherUserId) =>
        supabase
          .from('messages')
          .select('sender_id, receiver_id, message_text, created_at, is_read')
          .or(
            `and(sender_id.eq.${currentUserId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUserId})`
          )
          .order('created_at', { ascending: false })
          .limit(1)
      )
    );

    results.forEach((result, index) => {
      const otherUserId = otherUserIds[index];
      if (result.status === 'fulfilled' && !result.value.error && result.value.data && result.value.data.length > 0) {
        const msg = result.value.data[0];
        messageMap.set(otherUserId, {
          message: msg.message_text ?? '',
          timestamp: new Date(msg.created_at ?? Date.now()),
          isRead: msg.is_read ?? false,
          isSentByMe: msg.sender_id === currentUserId,
        });
      }
    });

    return {
      success: true,
      data: messageMap,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Exception fetching last messages batch:', errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * Batch fetch unread counts for multiple users
 * @param otherUserIds - Array of user IDs
 * @returns Map of user_id to unread count
 */
export const getUnreadCountsBatch = async (
  otherUserIds: string[]
): Promise<{ success: boolean; data?: Map<string, number>; error?: string }> => {
  try {
    // Get current user ID
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        success: false,
        error: 'User not authenticated',
      };
    }

    const currentUserId = user.id;

    if (otherUserIds.length === 0) {
      return {
        success: true,
        data: new Map(),
      };
    }

    // Fetch all unread messages in one query
    const { data, error } = await supabase
      .from('messages')
      .select('sender_id')
      .eq('receiver_id', currentUserId)
      .in('sender_id', otherUserIds)
      .eq('is_read', false);

    if (error) {
      console.error('❌ Error fetching unread counts batch:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    // Count unread messages per user
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

    return {
      success: true,
      data: countMap,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Exception fetching unread counts batch:', errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
};