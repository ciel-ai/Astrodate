import { cleanupChatChannels, safeReleaseChatChannel } from '@/lib/chatRealtimeManager';
import { getMessages, markMessagesAsReadDebounced, sendMessage } from '@/lib/messages';
import { releaseRealtimeChannel, trackRealtimeChannel } from '@/lib/realtime-channels';
import { supabase } from '@/lib/supabase';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

type Message = {
  id: string;
  text: string;
  senderId: string;
  timestamp: Date;
  isRead: boolean;
  isOptimistic?: boolean;
  isFailed?: boolean;
};

interface ChatMessagesState {
  messages: Message[];
  sending: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
}

type ChatMessagesAction =
  | { type: 'SET_MESSAGES'; payload: Message[] }
  | { type: 'ADD_MESSAGE'; payload: Message }
  | { type: 'UPDATE_MESSAGE'; payload: { id: string; isRead: boolean } }
  | { type: 'REMOVE_MESSAGE'; payload: string }
  | { type: 'MARK_FAILED'; payload: string }
  | { type: 'SET_SENDING'; payload: boolean }
  | { type: 'SET_CONNECTION_STATUS'; payload: 'connected' | 'disconnected' | 'connecting' }
  | { type: 'REPLACE_OPTIMISTIC'; payload: { tempId: string; confirmedMessage: Message } }
  | { type: 'MERGE_MESSAGES'; payload: Message[] };

function chatMessagesReducer(state: ChatMessagesState, action: ChatMessagesAction): ChatMessagesState {
  switch (action.type) {
    case 'SET_MESSAGES':
      return { ...state, messages: action.payload };
    case 'ADD_MESSAGE':
      // Prevent duplicate messages by checking if ID already exists
      if (state.messages.some((msg) => msg.id === action.payload.id)) {
        return state;
      }
      return { ...state, messages: [...state.messages, action.payload] };
    case 'UPDATE_MESSAGE':
      return {
        ...state,
        messages: state.messages.map((msg) =>
          msg.id === action.payload.id && msg.isRead !== action.payload.isRead
            ? { ...msg, isRead: action.payload.isRead }
            : msg
        ),
      };
    case 'REMOVE_MESSAGE':
      return { ...state, messages: state.messages.filter((m) => m.id !== action.payload) };
    case 'MARK_FAILED':
      return {
        ...state,
        messages: state.messages.map((msg) =>
          msg.id === action.payload ? { ...msg, isFailed: true, isOptimistic: false } : msg
        ),
      };
    case 'SET_SENDING':
      return { ...state, sending: action.payload };
    case 'SET_CONNECTION_STATUS':
      return { ...state, connectionStatus: action.payload };
    case 'REPLACE_OPTIMISTIC':
      return {
        ...state,
        messages: state.messages.map((msg) =>
          msg.id === action.payload.tempId ? action.payload.confirmedMessage : msg
        ),
      };
    case 'MERGE_MESSAGES': {
      // Merge into existing state — existing entries (incl. realtime-received) are preserved
      const mergedMap = new Map<string, Message>(
        state.messages.map((m) => [m.id, m])
      );
      action.payload.forEach((msg) => {
        mergedMap.set(msg.id, msg);
      });
      return { ...state, messages: Array.from(mergedMap.values()) };
    }
    default:
      return state;
  }
}

interface UseChatMessagesProps {
  chatId: string;
  channelId: string;
  currentUserId: string;
  isMatched: boolean | null;
  isMountedRef: React.RefObject<boolean>;
}

export function useChatMessages({
  chatId,
  channelId,
  currentUserId,
  isMatched,
  isMountedRef,
}: UseChatMessagesProps) {
  const [state, dispatch] = useReducer(chatMessagesReducer, {
    messages: [],
    sending: false,
    connectionStatus: 'connecting',
  });

  const [retryKey, setRetryKey] = useState(0);

  const messageDedupeRef = useRef<Set<string>>(new Set());
  const tempIdCounterRef = useRef(0);
  const messagesRef = useRef<Message[]>([]);
  const isSyncingRef = useRef(false);
  messagesRef.current = state.messages;

  // Clear dedupe Set when chat changes
  useEffect(() => {
    messageDedupeRef.current.clear();
    tempIdCounterRef.current = 0;
  }, [chatId, channelId]);

  // Sync messages from database
  const syncMessages = useCallback(async () => {
    if (!currentUserId || !chatId || isMatched !== true || !channelId) return;
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;

    try {
      const result = await getMessages(chatId, channelId);
      if (!isMountedRef.current) return;

      if (result.success && result.data) {
        const uiMessages: Message[] = result.data.map((msg) => {
          const ts = msg.created_at ? new Date(msg.created_at) : new Date();
          return {
            id: msg.id,
            text: msg.message_text,
            senderId: msg.sender_id,
            timestamp: isNaN(ts.getTime()) ? new Date() : ts,
            isRead: msg.is_read,
          };
        });

        // Preserve optimistic messages during sync, dedupe by ID
        const existingIds = new Set(uiMessages.map((msg) => msg.id));
        const optimisticMessages = messagesRef.current.filter((msg) => msg.isOptimistic && !existingIds.has(msg.id));
        const mergedMessages = [...uiMessages, ...optimisticMessages];
        dispatch({ type: 'MERGE_MESSAGES', payload: mergedMessages });
        markMessagesAsReadDebounced(chatId, channelId);
      } else {
        console.error('❌ Failed to sync messages:', result.error);
      }
    } catch (error) {
      console.error('❌ Error syncing messages:', error);
    } finally {
      isSyncingRef.current = false;
    }
  }, [chatId, currentUserId, isMatched, channelId]);

  // Stabilize syncMessages ref to avoid circular dependency
  const syncMessagesRef = useRef<(() => Promise<void>) | null>(null);
  syncMessagesRef.current = syncMessages;

  // Send text message with optimistic update
  const sendText = useCallback(async (text: string) => {
    if (!currentUserId || !chatId || !channelId || !text.trim()) return;

    const tempId = `temp-${Date.now()}-${tempIdCounterRef.current++}`;
    const optimisticMessage: Message = {
      id: tempId,
      text: text.trim(),
      senderId: currentUserId,
      timestamp: new Date(),
      isRead: false,
      isOptimistic: true,
    };

    // Add optimistic message
    dispatch({ type: 'ADD_MESSAGE', payload: optimisticMessage });
    // Add temp ID to dedupe Set to prevent duplicate from realtime
    messageDedupeRef.current.add(tempId);
    dispatch({ type: 'SET_SENDING', payload: true });

    try {
      const result = await sendMessage(chatId, text.trim(), channelId);
      if (!isMountedRef.current) return;

      if (result.success && result.data) {
        const confirmedMessage: Message = {
          id: result.data.id,
          text: result.data.message_text,
          senderId: result.data.sender_id,
          timestamp: result.data.created_at ? new Date(result.data.created_at) : new Date(),
          isRead: result.data.is_read,
        };
        dispatch({ type: 'REPLACE_OPTIMISTIC', payload: { tempId, confirmedMessage } });
        // Remove temp ID from dedupe Set
        messageDedupeRef.current.delete(tempId);
      } else {
        // Mark as failed
        dispatch({ type: 'REMOVE_MESSAGE', payload: tempId });
        // Remove temp ID from dedupe Set
        messageDedupeRef.current.delete(tempId);
        console.error('❌ Failed to send message:', result.error);
      }
    } catch (error) {
      if (isMountedRef.current) {
        dispatch({ type: 'REMOVE_MESSAGE', payload: tempId });
        // Remove temp ID from dedupe Set
        messageDedupeRef.current.delete(tempId);
        console.error('❌ Error sending message:', error);
      }
    } finally {
      if (isMountedRef.current) {
        dispatch({ type: 'SET_SENDING', payload: false });
      }
    }
  }, [currentUserId, chatId, channelId]);

  // Subscribe to realtime message updates
  useEffect(() => {
    if (!currentUserId || !channelId || isMatched !== true) return;

    let isActive = true;

    const channels: any[] = [];
    const messageChannelName = `messages:${channelId}:${currentUserId}`;
    
    safeReleaseChatChannel(supabase, messageChannelName);
    
    dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'connecting' });
    console.log('[Realtime] subscribe', messageChannelName);

    // Subscribe to messages by channel_id
    const messageChannel = supabase
      .channel(messageChannelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          const newMessage = payload.new as any;
          if (!isMountedRef.current) return;

          // Only process if it's for this conversation
          if (newMessage.channel_id === channelId &&
            (newMessage.sender_id === currentUserId || newMessage.receiver_id === currentUserId)) {

            // Deduplication check - check both dedupe Set and current state
            if (messageDedupeRef.current.has(newMessage.id)) {
              return;
            }
            // Also check if message already exists in current state
            if (messagesRef.current.some((msg) => msg.id === newMessage.id)) {
              return;
            }
            messageDedupeRef.current.add(newMessage.id);

            const insertTs = newMessage.created_at ? new Date(newMessage.created_at) : new Date();
            const uiMessage: Message = {
              id: newMessage.id,
              text: newMessage.message_text,
              senderId: newMessage.sender_id,
              timestamp: isNaN(insertTs.getTime()) ? new Date() : insertTs,
              isRead: newMessage.is_read,
            };

            dispatch({ type: 'ADD_MESSAGE', payload: uiMessage });

            // Mark as read for received messages
            if (newMessage.receiver_id === currentUserId) {
              markMessagesAsReadDebounced(chatId, channelId);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          const updatedMessage = payload.new as any;
          if (!isMountedRef.current) return;
          if (updatedMessage.channel_id === channelId) {
            dispatch({ type: 'UPDATE_MESSAGE', payload: { id: updatedMessage.id, isRead: updatedMessage.is_read } });
          }
        }
      )
      .subscribe((status) => {
        if (!isMountedRef.current || !isActive) return;
        if (status === 'SUBSCRIBED') {
          dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'connected' });
          // Sync messages when subscription is established
          syncMessagesRef.current?.();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'disconnected' });
          // Release the failed channel and trigger re-subscription via retryKey
          releaseRealtimeChannel(supabase, messageChannel);
          setRetryKey((k) => k + 1);
        } else if (status === 'CLOSED') {
          dispatch({ type: 'SET_CONNECTION_STATUS', payload: 'disconnected' });
        }
      });
    trackRealtimeChannel(messageChannel);
    channels.push(messageChannel);

    return () => {
      isActive = false;
      console.log('[Realtime] unsubscribe', messageChannelName);
      cleanupChatChannels(supabase, channels);
    };
  }, [chatId, currentUserId, channelId, isMatched, retryKey]);

  // Allows media/audio sends in the screen to register a confirmed message
  // without bypassing reducer dedup (ADD_MESSAGE checks ID existence)
  const addConfirmedMessage = useCallback((message: Message) => {
    dispatch({ type: 'ADD_MESSAGE', payload: message });
  }, []);

  // Allows callers (e.g. media upload paths) to mark a message as failed
  // rather than silently removing it
  const markMessageFailed = useCallback((id: string) => {
    dispatch({ type: 'MARK_FAILED', payload: id });
  }, []);

  // Allows callers to remove a specific message by ID (e.g. removing an optimistic
  // placeholder once the confirmed server message has been added)
  const removeMessage = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_MESSAGE', payload: id });
  }, []);

  return {
    messages: state.messages,
    sending: state.sending,
    connectionStatus: state.connectionStatus,
    sendText,
    syncMessages,
    addConfirmedMessage,
    markMessageFailed,
    removeMessage,
  };
}