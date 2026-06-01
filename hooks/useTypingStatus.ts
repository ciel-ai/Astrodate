import { broadcastTypingStatus, cleanupTypingSubscriptions, subscribeToTypingStatus } from '@/lib/typing-status';
import { useCallback, useEffect, useRef, useState } from 'react';

interface UseTypingStatusProps {
  currentUserId: string;
  chatId: string;
  channelId: string;
}

export function useTypingStatus({ currentUserId, chatId, channelId }: UseTypingStatusProps) {
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const typingChannels = useRef<any[]>([]);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingBroadcastRef = useRef(0);
  // Always reflects the latest channelId so cleanup never uses a stale closure value
  const channelIdRef = useRef(channelId);
  channelIdRef.current = channelId;

  // Set up typing indicator channel
  useEffect(() => {
    if (!currentUserId || !chatId || !channelId) return;

    const typingStatusChannel = subscribeToTypingStatus(
      channelId,
      (isOtherUserTyping) => {
        setIsOtherUserTyping((prev) => prev === isOtherUserTyping ? prev : isOtherUserTyping);
      },
      currentUserId
    );

    if (typingStatusChannel) {
      typingChannels.current = [typingStatusChannel];
    }

    return () => {
      cleanupTypingSubscriptions(typingChannels.current);
      typingChannels.current = [];

      // Clear typing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Cleanup: stop typing before leaving — use ref so we always hit the live channelId
      const activeChannelId = channelIdRef.current;
      if (currentUserId && activeChannelId) {
        broadcastTypingStatus(currentUserId, activeChannelId, false).catch(() => { });
      }
    };
  }, [currentUserId, chatId, channelId]);

  // Handle typing indicator - broadcast typing status to other user
  const handleTyping = useCallback(() => {
    if (!currentUserId || !channelId) {
      return;
    }

    // Broadcast typing status (non-blocking - don't await)
    const now = Date.now();
    if (now - lastTypingBroadcastRef.current > 1200) {
      lastTypingBroadcastRef.current = now;
      broadcastTypingStatus(currentUserId, channelId, true).catch((error) => {
        console.error('❌ Error broadcasting typing status:', error);
      });
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing indicator after 3 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      lastTypingBroadcastRef.current = 0;
      broadcastTypingStatus(currentUserId, channelId, false).catch(() => { });
    }, 3000);
  }, [currentUserId, channelId]);

  return {
    isOtherUserTyping,
    handleTyping,
  };
}