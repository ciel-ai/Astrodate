// lib/typing-status.ts
import { releaseRealtimeChannel, releaseRealtimeChannelsByTopicPrefix, safeReleaseExistingChannel, trackRealtimeChannel } from './realtime-channels';
import { supabase } from './supabase';

interface TypingStatusData {
    userId: string;
    channelId: string;
    isTyping: boolean;
    timestamp: number;
}

// Global typing channel - single channel for all typing events
const TYPING_CHANNEL = 'global-typing-status';

// Keep a reference to the global broadcast channel to reuse it
let globalBroadcastChannel: any = null;
let channelInitializing = false;

/**
 * Resets the global broadcast channel — call on app background or token refresh
 * so the next broadcastTypingStatus call re-subscribes on a fresh socket.
 */
export const resetGlobalTypingChannel = async (): Promise<void> => {
  try {
    if (globalBroadcastChannel) {
      const ch = globalBroadcastChannel;
      globalBroadcastChannel = null;  // null first to block new sends
      channelInitializing = false;
      // Small delay to let any in-flight httpSend resolve
      await new Promise(r => setTimeout(r, 150));
      console.log('[Realtime] unsubscribe', ch.topic);
      releaseRealtimeChannel(supabase, ch);
    }
  } catch (error) {
    console.warn('⚠️ [Typing] Error resetting global channel:', error);
    globalBroadcastChannel = null;
    channelInitializing = false;
  }
};

const isTransientNetworkError = (error: unknown): boolean => {
    const message = error instanceof Error ? error.message : String(error || '');
    return (
        message.includes('Network request failed') ||
        message.includes('AuthRetryableFetchError') ||
        message.includes('Failed to fetch')
    );
};

/**
 * Broadcast typing status using a single global channel (simplified approach)
 * @param currentUserId - The user who is typing
 * @param channelId - The chat channel ID
 * @param isTyping - Whether the user is typing
 */
export const broadcastTypingStatus = async (
    currentUserId: string,
    channelId: string,
    isTyping: boolean
) => {
    try {
        if (!channelId || !currentUserId) {
            console.warn('⚠️ Missing channelId or currentUserId for typing status');
            return null;
        }

        // Initialize channel if needed (non-blocking)
        if (!globalBroadcastChannel && !channelInitializing) {
            channelInitializing = true;
            console.log('[Realtime] subscribe', TYPING_CHANNEL);
            globalBroadcastChannel = trackRealtimeChannel(supabase.channel(TYPING_CHANNEL));

            globalBroadcastChannel.subscribe(() => {
                channelInitializing = false;
            });
        }

        // Send broadcast without waiting (non-blocking)
        if (globalBroadcastChannel) {
            const payload: TypingStatusData = {
                userId: currentUserId,
                channelId,
                isTyping,
                timestamp: Date.now(),
            };

            if (typeof (globalBroadcastChannel as any).httpSend === 'function') {
                (globalBroadcastChannel as any)
                    .httpSend('typing', payload)
                    .then((result: any) => {
                        if (result && result.success === false) {
                            const message = result.error || 'Unknown error';
                            if (isTransientNetworkError(message)) {
                                console.warn('⚠️ [Typing] Broadcast skipped (network unavailable)');
                                return;
                            }
                            console.error('❌ [Typing] Broadcast error:', message);
                        }
                    })
                    .catch((error: any) => {
                        if (isTransientNetworkError(error)) {
                            console.warn('⚠️ [Typing] Broadcast skipped (network unavailable)');
                            return;
                        }
                        console.error('❌ [Typing] Broadcast error:', error);
                    });
            } else {
                globalBroadcastChannel
                    .send({
                        type: 'broadcast',
                        event: 'typing',
                        payload,
                    })
                    .catch((error: any) => {
                        if (isTransientNetworkError(error)) {
                            console.warn('⚠️ [Typing] Broadcast skipped (network unavailable)');
                            return;
                        }
                        console.error('❌ [Typing] Broadcast error:', error);
                    });
            }
        }

        return globalBroadcastChannel;
    } catch (error) {
        console.error('❌ [Typing] Error broadcasting:', error);
        return null;
    }
};

/**
 * Subscribe to typing status updates for a specific channel (for chat detail screen)
 * @param channelId - The chat channel ID
 * @param callback - Callback function when typing status changes
 * @param currentUserId - The current user ID (to filter out own typing)
 */
export const subscribeToTypingStatus = (
    channelId: string,
    callback: (isOtherUserTyping: boolean) => void,
    currentUserId: string
) => {
    try {
        if (!channelId) {
            console.warn('⚠️ Missing channelId for typing subscription');
            return null;
        }

        // IMPORTANT: Use the same global channel that broadcasts use
        const recvTopic = `${TYPING_CHANNEL}-recv-${channelId}`;
        safeReleaseExistingChannel(supabase, recvTopic);
        console.log('[Realtime] subscribe', recvTopic);
        const channel = trackRealtimeChannel(supabase.channel(recvTopic));
        // Track typing users in this channel
        const typingUsers = new Map<string, number>(); // userId -> timestamp
        let cleanupInterval: ReturnType<typeof setInterval>;

        // Listen for typing broadcasts
        channel
            .on('broadcast', { event: 'typing' }, ({ payload }) => {
                const data = payload as TypingStatusData;

                // Only process if it's for this channel and not from current user
                if (data.channelId === channelId && data.userId !== currentUserId) {
                    if (data.isTyping) {
                        typingUsers.set(data.userId, data.timestamp);
                    } else {
                        typingUsers.delete(data.userId);
                    }

                    const hasTyping = typingUsers.size > 0;
                    callback(hasTyping);
                }
            })
            .subscribe();

        // Auto-cleanup stale typing indicators (5 seconds)
        cleanupInterval = setInterval(() => {
            const now = Date.now();
            let changed = false;

            typingUsers.forEach((timestamp, userId) => {
                if (now - timestamp > 5000) {
                    typingUsers.delete(userId);
                    changed = true;
                }
            });

            if (changed) {
                callback(typingUsers.size > 0);
            }
        }, 1000);

        // Return channel with cleanup function
        return Object.assign(channel, {
            cleanup: () => {
                clearInterval(cleanupInterval);
                typingUsers.clear();
            }
        });
    } catch (error) {
        console.error('❌ [Typing] Error subscribing:', error);
        return null;
    }
};

/**
 * Subscribe to typing indicators for multiple channels (for chat list)
 * @param currentUserId - The current user ID
 * @param channelIds - Array of channel IDs to monitor
 * @param callback - Callback with map of channelId -> isTyping
 */
export const subscribeToMultipleTypingChannels = (
    currentUserId: string,
    channelIds: string[],
    callback: (typingMap: Map<string, boolean>) => void
) => {
    try {
        if (!channelIds || channelIds.length === 0) {
            console.warn('⚠️ No channel IDs provided for typing subscription');
            return [];
        }

        const typingMap = new Map<string, Map<string, number>>(); // channelId -> (userId -> timestamp)
        let cleanupInterval: ReturnType<typeof setInterval>;

        // Initialize map for each channel
        channelIds.forEach((channelId) => {
            typingMap.set(channelId, new Map());
        });

        // IMPORTANT: Use the same global channel that broadcasts use
        const listTopic = `${TYPING_CHANNEL}-list-${currentUserId}`;
        safeReleaseExistingChannel(supabase, listTopic);
        console.log('[Realtime] subscribe', listTopic);
        const channel = trackRealtimeChannel(supabase.channel(listTopic));

        // Listen for typing broadcasts
        channel
            .on('broadcast', { event: 'typing' }, ({ payload }) => {
                const data = payload as TypingStatusData;

                // Check if this is for one of our monitored channels and not from current user
                if (channelIds.includes(data.channelId) && data.userId !== currentUserId) {
                    const usersInChannel = typingMap.get(data.channelId);

                    if (usersInChannel) {
                        if (data.isTyping) {
                            usersInChannel.set(data.userId, data.timestamp);
                        } else {
                            usersInChannel.delete(data.userId);
                        }

                        // Build result map
                        const resultMap = new Map<string, boolean>();
                        typingMap.forEach((users, chanId) => {
                            resultMap.set(chanId, users.size > 0);
                        });

                        callback(resultMap);
                    }
                }
            })
            .subscribe();

        // Auto-cleanup stale typing indicators (5 seconds)
        cleanupInterval = setInterval(() => {
            const now = Date.now();
            let changed = false;

            typingMap.forEach((users, channelId) => {
                users.forEach((timestamp, userId) => {
                    if (now - timestamp > 5000) {
                        users.delete(userId);
                        changed = true;
                    }
                });
            });

            if (changed) {
                const resultMap = new Map<string, boolean>();
                typingMap.forEach((users, chanId) => {
                    resultMap.set(chanId, users.size > 0);
                });
                callback(resultMap);
            }
        }, 1000);

        // Return channel with cleanup
        const channelWithCleanup = Object.assign(channel, {
            cleanup: () => {
                clearInterval(cleanupInterval);
                typingMap.clear();
            }
        });

        return [channelWithCleanup];
    } catch (error) {
        console.error('❌ [Typing-Multi] Error subscribing:', error);
        return [];
    }
};

/**
 * Cleanup typing status subscriptions
 * @param channels - Array of channels to unsubscribe from
 */
export const cleanupTypingSubscriptions = (channels: any[]) => {
    try {
        channels.forEach((channel) => {
            if (channel) {
                // Call cleanup if it exists (to clear timeouts)
                if (typeof channel.cleanup === 'function') {
                    channel.cleanup();
                }
                console.log('[Realtime] unsubscribe', channel.topic);
                releaseRealtimeChannel(supabase, channel);
            }
        });
    } catch (error) {
        console.error('❌ Error cleaning up typing subscriptions:', error);
    }
};

export const cleanupAllTypingChannels = () => {
    releaseRealtimeChannelsByTopicPrefix(supabase, TYPING_CHANNEL);
    globalBroadcastChannel = null;
    channelInitializing = false;
};
