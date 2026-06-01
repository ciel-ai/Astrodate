import { getLastMessagesBatch, getUnreadCountsBatch } from '@/lib/messages';
import { releaseRealtimeChannel, releaseRealtimeChannelsByTopicPrefix, trackRealtimeChannel } from '@/lib/realtime-channels';
import { getReportedUserIds } from '@/lib/reports';
import { supabase } from '@/lib/supabase';
import { cleanupTypingSubscriptions, subscribeToMultipleTypingChannels } from '@/lib/typing-status';
import { getAllUsers } from '@/lib/users';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Reusable Circular Avatar with Gradient Border
function GradientAvatar({
  uri,
  size = 56,
  showGradient = true,
  isOnline = false
}: {
  uri?: string | any;
  size?: number;
  showGradient?: boolean;
  isOnline?: boolean
}) {
  const avatarSource = typeof uri === 'string' ? { uri } : uri;

  return (
    <View style={{ width: size + 8, height: size + 8, alignItems: 'center', justifyContent: 'center' }}>
      {showGradient ? (
        <LinearGradient
          colors={['#FF2D78', '#A855F7']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: size + 6,
            height: size + 6,
            borderRadius: (size + 6) / 2,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View style={{
            width: size + 2,
            height: size + 2,
            borderRadius: (size + 2) / 2,
            backgroundColor: '#000',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <ExpoImage
              source={avatarSource || require('@/assets/images/avatar-placeholder.png')}
              style={{ width: size, height: size, borderRadius: size / 2 }}
              contentFit="cover"
            />
          </View>
        </LinearGradient>
      ) : (
        <ExpoImage
          source={avatarSource || require('@/assets/images/avatar-placeholder.png')}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          contentFit="cover"
        />
      )}
      {isOnline && <View style={styles.onlineIndicator} />}
    </View>
  );
}

type ChatItem = {
  id: string;
  name: string;
  lastMessage: string;
  time: string;
  unreadCount?: number;
  isRead?: boolean;
  hasConversation?: boolean;
  isOnline: boolean;
  isPinned?: boolean;
  isTyping?: boolean;
  isArchived?: boolean;
  avatar: any;
  channelId?: string;
  timestamp?: Date;
  matchedAt?: Date;
};


const CHAT_PREFERENCES_KEY = '@chat_preferences';

interface ChatPreferences {
  pinned: string[];
  archived: string[];
  deleted: string[];
}

// Helper function to format time
const formatTime = (date?: Date) => {
  if (!date) return 'now';
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString();
};

function ChatItemComponent({
  chat,
  onLongPress,
}: {
  chat: ChatItem;
  onLongPress: (chat: ChatItem, event: any) => void;
}) {
  const router = useRouter();

  return (
    <TouchableOpacity
      style={styles.chatItem}
      activeOpacity={0.7}
      onPress={() => {
        router.push({
          pathname: '/chat/[id]',
          params: { id: chat.id },
        });
      }}
      onLongPress={(event) => onLongPress(chat, event)}>
      <View style={styles.avatarContainer}>
        <GradientAvatar
          uri={chat.avatar}
          size={56}
          showGradient={chat.unreadCount ? chat.unreadCount > 0 : false}
          isOnline={false} // Match image: online indicator not shown in main list usually
        />
      </View>
      <View style={styles.chatContent}>
        <View style={styles.chatHeader}>
          <Text style={styles.chatName}>{chat.name}</Text>
        </View>
        {chat.isTyping ? (
          <View style={styles.chatFooter}>
            <Text style={styles.typingText}>Typing...</Text>
          </View>
        ) : chat.hasConversation && chat.lastMessage ? (
          <View style={styles.chatFooter}>
            <Text
              style={[
                styles.chatMessage,
                chat.unreadCount && chat.unreadCount > 0 ? styles.unreadMessage : null,
              ]}
              numberOfLines={1}>
              {chat.lastMessage}
            </Text>
          </View>
        ) : (
          <View style={styles.chatFooter}>
            <Text style={[styles.chatMessage, { fontStyle: 'italic', opacity: 0.7 }]}>
              New match! Start a conversation
            </Text>
          </View>
        )}
      </View>
      <View style={styles.chatRight}>
        {(chat.hasConversation && chat.time) || chat.isTyping ? (
          <Text style={styles.chatTime}>{chat.isTyping ? 'now' : chat.time}</Text>
        ) : null}
        <View style={styles.chatIndicators}>
          {chat.unreadCount && chat.unreadCount > 0 ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{chat.unreadCount}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ChatsScreen() {
  const router = useRouter();
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [filteredChats, setFilteredChats] = useState<ChatItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChat, setSelectedChat] = useState<ChatItem | null>(null);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [typingStatus, setTypingStatus] = useState<Map<string, boolean>>(new Map());
  const [modalPosition, setModalPosition] = useState({ top: 0, right: 16 });
  const [chatPreferences, setChatPreferences] = useState<ChatPreferences>({
    pinned: [],
    archived: [],
    deleted: [],
  });
  const [onlineStatus, setOnlineStatus] = useState<Map<string, boolean>>(new Map());
  const authRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatsCountRef = useRef(0);
  const chatsRef = useRef<ChatItem[]>([]);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    chatsCountRef.current = chats.length;
    chatsRef.current = chats;
  }, [chats.length]);

  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  const STAR_DATA = Array.from({ length: 100 }).map((_, i) => ({
    id: i,
    x: (i * 53 + 8) % 93,
    y: (i * 37 + 5) % 95,
    size: (i % 3) * 0.5 + 0.5,
    opacity: 0.2 + (i % 5) * 0.12,
  }));

  const StarField = React.memo(function StarField() {
    return (
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        {STAR_DATA.map(s => (
          <View key={s.id} style={{
            position: 'absolute', left: `${s.x}%`, top: `${s.y}%`,
            width: s.size, height: s.size, borderRadius: s.size,
            backgroundColor: '#fff', opacity: s.opacity
          }} />
        ))}
      </View>
    );
  });
  // const stars = React.useMemo(() => {
  //   return Array.from({ length: 100 }).map((_, i) => ({
  //     id: i,
  //     x: Math.random() * 100,
  //     y: Math.random() * 100,
  //     size: Math.random() * 2 + 0.5,
  //     opacity: Math.random() * 0.8 + 0.2,
  //   }));
  // }, []);

  // Format timestamp for display
  const formatTimestamp = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    // Show time in 12-hour format (e.g., "4:01 pm", "3:50 pm")
    if (diffDays === 0) {
      // Today - show time
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
    } else if (diffDays === 1) {
      // Yesterday
      return 'Yesterday';
    } else if (diffDays < 7) {
      // This week - show day name
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return days[date.getDay()];
    } else {
      // Older - show date
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  // Load chat preferences from storage
  const loadChatPreferences = useCallback(async (): Promise<ChatPreferences> => {
    try {
      const stored = await AsyncStorage.getItem(CHAT_PREFERENCES_KEY);
      if (stored) {
        const preferences: ChatPreferences = JSON.parse(stored);
        if (isMountedRef.current) setChatPreferences(preferences);
        return preferences;
      }
    } catch (error) {
      console.error('Error loading chat preferences:', error);
    }
    const defaultPrefs = { pinned: [], archived: [], deleted: [] };
    if (isMountedRef.current) setChatPreferences(defaultPrefs);
    return defaultPrefs;
  }, []);

  // Save chat preferences to storage
  const saveChatPreferences = useCallback(async (preferences: ChatPreferences) => {
    try {
      await AsyncStorage.setItem(CHAT_PREFERENCES_KEY, JSON.stringify(preferences));
      if (isMountedRef.current) setChatPreferences(preferences);
    } catch (error) {
      console.error('Error saving chat preferences:', error);
    }
  }, []);

  const isFetchingRef = useRef(false);
  const sortedUserIds = chats.map((c) => c.id).sort().join(',');
  const chatChannelIds = chats.map((c) => c.channelId).filter(Boolean).sort().join(',');

  // Fetch users from backend with last messages
  const fetchUsers = useCallback(async (isRefresh = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    if (isRefresh) {
      setRefreshing(true);
    } else if (chatsCountRef.current === 0) {
      setLoading(true);
    }

    try {
      // Load preferences first (fast, local storage)
      const preferences = await loadChatPreferences();

      // Run all independent queries in parallel
      const [result, reportedUsersResult] = await Promise.all([
        getAllUsers(),
        getReportedUserIds(),
      ]);

      if (result.success && result.data) {
        const reportedUserIds = reportedUsersResult.success && reportedUsersResult.data
          ? reportedUsersResult.data
          : [];

        // Filter out deleted chats and reported users
        // Reported users should be removed from frontend immediately (like unmatch)
        const filteredUsers = result.data.filter((user) => {
          if (preferences.deleted.includes(user.user_id)) {
            return false; // Always filter deleted
          }
          // Filter out reported users - they should not appear in frontend
          if (reportedUserIds.includes(user.user_id)) {
            return false; // Remove reported users from frontend
          }
          return true; // Allow other users
        });

        // Batch fetch last messages and unread counts for all users at once (much faster!)
        const userIds = filteredUsers.map((u) => u.user_id);
        const [lastMessagesResult, unreadCountsResult] = await Promise.all([
          getLastMessagesBatch(userIds),
          getUnreadCountsBatch(userIds),
        ]);

        const lastMessagesMap = lastMessagesResult.success && lastMessagesResult.data
          ? lastMessagesResult.data
          : new Map();
        const unreadCountsMap = unreadCountsResult.success && unreadCountsResult.data
          ? unreadCountsResult.data
          : new Map();

        // Map users to chat items using batch data
        const chatItemsWithTimestamps = filteredUsers.map((user) => {
          const lastMsg = lastMessagesMap.get(user.user_id);
          const unreadCount = unreadCountsMap.get(user.user_id) || 0;

          let lastMessage = '';
          let time = '';
          let timestamp: Date | null = null;
          let isRead = true;
          let hasConversation = false;

          if (lastMsg) {
            hasConversation = true;
            // Show "You: " prefix for sent messages
            lastMessage = lastMsg.isSentByMe ? `You: ${lastMsg.message}` : lastMsg.message;
            timestamp = lastMsg.timestamp;
            time = formatTimestamp(lastMsg.timestamp);
            isRead = lastMsg.isRead;
          }

          // Get online status from fetched data or from state
          const fetchedOnlineStatus = user.isOnline || false;
          const currentOnlineStatus = onlineStatus.get(user.user_id) ?? fetchedOnlineStatus;

          return {
            id: user.user_id,
            name: user.full_name,
            lastMessage,
            time,
            timestamp,
            isRead,
            unreadCount,
            hasConversation,
            isOnline: currentOnlineStatus,
            isPinned: preferences.pinned.includes(user.user_id),
            isArchived: preferences.archived.includes(user.user_id),
            channelId: user.channel_id,
            matchedAt: user.matched_at ? new Date(user.matched_at) : undefined,
            avatar: user.avatar
              ? { uri: user.avatar }
              : require('@/assets/images/avatar-placeholder.png'), // Fallback avatar
          };
        });

        // Sort: 
        // 1. Users with unread messages first
        // 2. Users with conversations by message timestamp
        // 3. New matches by matchedAt timestamp
        chatItemsWithTimestamps.sort((a, b) => {
          // Unread matches first
          const aUnread = (a.unreadCount && a.unreadCount > 0);
          const bUnread = (b.unreadCount && b.unreadCount > 0);
          if (aUnread && !bUnread) return -1;
          if (!aUnread && bUnread) return 1;

          // Then both have conversations (or both don't)
          if (a.hasConversation && b.hasConversation) {
            if (a.timestamp && b.timestamp) {
              return b.timestamp.getTime() - a.timestamp.getTime();
            }
          }

          // Then conversations vs new matches
          if (a.hasConversation && !b.hasConversation) return -1;
          if (!a.hasConversation && b.hasConversation) return 1;

          // Finally, sort by matched date (newest first)
          const timeA = a.timestamp?.getTime() || a.matchedAt?.getTime() || 0;
          const timeB = b.timestamp?.getTime() || b.matchedAt?.getTime() || 0;
          return timeB - timeA;
        });

        // Remove timestamp from final items (not needed in UI)
        const finalChatItems = chatItemsWithTimestamps.map(({ timestamp, ...rest }) => rest);

        if (isMountedRef.current) {
          setChats(finalChatItems);
          setFilteredChats(finalChatItems);
        }
      } else {
        console.error('❌ Failed to fetch users:', result.error);

        // On cold app start auth restoration can lag; retry instead of showing permanent empty state.
        const authRetryCountRef = useRef(0);
        const MAX_AUTH_RETRIES = 5;

        // Inside fetchUsers, replace the retry logic:
        if (result.error === 'User not authenticated') {
          if (authRetryCountRef.current >= MAX_AUTH_RETRIES) {
            console.warn('[Chats] Max auth retries reached');
            authRetryCountRef.current = 0;
            return;  // stop retrying
          }
          authRetryCountRef.current++;
          authRetryTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) void fetchUsers();
          }, 900);
          return;
        }

        // Reset counter on success:
        authRetryCountRef.current = 0;

        if (isMountedRef.current) {
          setChats([]);
          setFilteredChats([]);
        }
      }
    } catch (error) {
      console.error('❌ Error fetching users:', error);
      if (isMountedRef.current) {
        setChats([]);
        setFilteredChats([]);
      }
    } finally {
      if (isMountedRef.current) {
        setRefreshing(false);
        setLoading(false);
      }
      isFetchingRef.current = false;
    }
  }, [loadChatPreferences]);

  // Subscribe to online status changes for all matched users
  useEffect(() => {
    if (chats.length === 0) return;

    const userIds = chats.map(chat => chat.id);
    if (userIds.length === 0) return;

    // Helper: resolve online status from row data
    const resolveStatus = (isOnline: boolean, lastSeen: string | null): boolean => {
      if (!lastSeen) return isOnline;
      const diffMinutes = (Date.now() - new Date(lastSeen).getTime()) / 60000;
      return isOnline && diffMinutes < 5;
    };

    // Helper: apply a status update to all three state slices at once
    const applyStatusUpdate = (userId: string, status: boolean) => {
      setOnlineStatus((prev) => { const m = new Map(prev); m.set(userId, status); return m; });
      setChats((prev) => prev.map((c) => c.id === userId ? { ...c, isOnline: status } : c));
      setFilteredChats((prev) => prev.map((c) => c.id === userId ? { ...c, isOnline: status } : c));
    };

    // Use a single filtered channel that listens only to matched users' status.
    // This avoids broad presence leaks while preserving low subscription counts.
    const userIdSet = new Set(userIds);
    const filterString = `user_id=in.(${userIds.join(',')})`;
    const onlineChannel = supabase
      .channel(`online_status_bulk:${userIds.slice(0, 5).join('_')}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_online_status',
          filter: filterString,
        },
        (payload) => {
          const statusData = (payload.new || payload.old) as any;
          if (!statusData || !('user_id' in statusData) || !('is_online' in statusData)) return;
          const userId = statusData.user_id as string;
          applyStatusUpdate(userId, resolveStatus(statusData.is_online, statusData.last_seen ?? null));
        }
      )
      .subscribe();
    trackRealtimeChannel(onlineChannel);

    // Periodic backup refresh: single batch RPC instead of direct table reads.
    const refreshInterval = setInterval(async () => {
      try {
        const { data, error } = await supabase.rpc('get_matched_user_presence', {
          p_target_user_ids: userIds,
        });

        if (error || !data) return;

        const rows = Array.isArray(data) ? data : [data];
        for (const row of rows) {
          applyStatusUpdate(row.user_id, resolveStatus(row.is_online, row.last_seen ?? null));
        }
      } catch (err) {
        console.error('Error refreshing online status batch:', err);
      }
    }, 30 * 1000);

    return () => {
      clearInterval(refreshInterval);
      releaseRealtimeChannel(supabase, onlineChannel);
    };
  }, [sortedUserIds]);

  // Set up real-time typing indicators for all chats using the new typing system
  useEffect(() => {
    if (chats.length === 0) return;

    let typingChannels: any[] = [];
    let isActive = true;
    let hasCleanedUp = false;

    // Get current user ID
    supabase.auth.getUser().then((result) => {
      const user = result?.data?.user;
      if (!user || !isActive) return;

      const currentUserId = user.id;

      // Get all channel IDs from chats
      const channelIds = chats
        .map((chat) => chat.channelId)
        .filter((id) => id !== undefined && id !== null) as string[];

      if (channelIds.length === 0) {
        return;
      }

      // Use the typing status utility (statically imported)
      if (!isActive) return;
      typingChannels = subscribeToMultipleTypingChannels(
        currentUserId,
        channelIds,
        (typingMap) => {
          if (!isActive) return;
          // Convert channel-based typing map to user-based typing map
          const userTypingMap = new Map<string, boolean>();
          chatsRef.current.forEach((chat) => {
            if (chat.channelId) {
              const isTyping = typingMap.get(chat.channelId) || false;
              userTypingMap.set(chat.id, isTyping);
            }
          });
          setTypingStatus(userTypingMap);
        }
      );

      if (hasCleanedUp && typingChannels.length > 0) {
        cleanupTypingSubscriptions(typingChannels);
        typingChannels = [];
      }
    });

    return () => {
      isActive = false;
      hasCleanedUp = true;
      cleanupTypingSubscriptions(typingChannels);
    };
  }, [chatChannelIds]);

  // Subscribe to new messages to update last message and unread count in real-time
  useEffect(() => {
    let messagesChannel: any = null;
    let isMounted = true;

    const setupSubscription = async () => {
      const userResult = await supabase.auth.getUser();
      const user = userResult?.data?.user;
      if (!user || !isMounted) return;

      const currentUserId = user.id;
      releaseRealtimeChannelsByTopicPrefix(supabase, `chats_list_messages:${currentUserId}`);

      const listChannelName = `chats_list_messages:${currentUserId}:${Date.now()}`;

      // Helper function to update chat state directly from the Realtime payload.
      // No extra DB round-trips — all needed data is already in payload.new.
      const updateChatFromPayload = (
        userId: string,
        messageText: string,
        createdAt: string,
        isReceived: boolean,
        isRead: boolean
      ) => {
        const timestamp = new Date(createdAt);
        const time = formatTimestamp(timestamp);
        const lastMessage = isReceived ? messageText : `You: ${messageText}`;

        const applyUpdate = (prevChats: typeof chats) => {
          const chatExists = prevChats.some((chat) => chat.id === userId);
          if (!chatExists) return prevChats;
          return prevChats.map((chat) =>
            chat.id === userId
              ? {
                ...chat,
                lastMessage,
                time,
                timestamp,
                hasConversation: true,
                // Increment unread only for received messages not yet read
                unreadCount: isReceived && !isRead
                  ? (chat.unreadCount || 0) + 1
                  : chat.unreadCount,
              }
              : chat
          );
        };

        setChats(applyUpdate);
        setFilteredChats(applyUpdate);
      };

      // Subscribe to all messages where current user is receiver
      messagesChannel = supabase
        .channel(listChannelName)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `receiver_id=eq.${currentUserId}`,
          },
          (payload) => {
            const msg = payload.new as any;
            updateChatFromPayload(msg.sender_id, msg.message_text, msg.created_at, true, msg.is_read);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `sender_id=eq.${currentUserId}`,
          },
          (payload) => {
            const msg = payload.new as any;
            updateChatFromPayload(msg.receiver_id, msg.message_text, msg.created_at, false, msg.is_read);
          }
        )
        .subscribe();
      trackRealtimeChannel(messagesChannel);
    };

    setupSubscription();

    return () => {
      isMounted = false;
      if (messagesChannel) {
        releaseRealtimeChannel(supabase, messagesChannel);
      }
    };
  }, [fetchUsers]);

  // Update chats with typing status and online status
  useEffect(() => {
    setChats((prevChats) =>
      prevChats.map((chat) => {
        const isTyping = typingStatus.get(chat.id) || false;
        return {
          ...chat,
          isTyping,
          isOnline: onlineStatus.get(chat.id) ?? chat.isOnline ?? false,
        };
      })
    );
    setFilteredChats((prevChats) =>
      prevChats.map((chat) => ({
        ...chat,
        isTyping: typingStatus.get(chat.id) || false,
        isOnline: onlineStatus.get(chat.id) ?? chat.isOnline ?? false,
      }))
    );
  }, [typingStatus, onlineStatus]);

  // Filter chats based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredChats(chats);
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    const filtered = chats.filter((chat) => chat.name.toLowerCase().includes(query));
    setFilteredChats(filtered);
  }, [searchQuery, chats]);

  // Fetch users on mount and when screen comes into focus


  // Keep inbox synced with auth session readiness and app resume events.
  useEffect(() => {
    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        void fetchUsers();
      }
    });

    let lastAppState = AppState.currentState;
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === lastAppState) return;
      lastAppState = state;
      if (state === 'active') {
        void fetchUsers();
      }
    });

    return () => {
      authSub.subscription.unsubscribe();
      appStateSub.remove();
      if (authRetryTimeoutRef.current) {
        clearTimeout(authRetryTimeoutRef.current);
        authRetryTimeoutRef.current = null;
      }
    };
  }, [fetchUsers]);

  // Refresh users when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchUsers();
    }, [fetchUsers])
  );



  // Handle pull to refresh
  const onRefresh = useCallback(() => {
    fetchUsers(true);
  }, [fetchUsers]);

  // Separate chats into pinned and recent (use filteredChats for search)
  // Show ALL matches in the main list to prevent them from "disappearing"
  const pinnedChats = filteredChats.filter((chat) => chat.isPinned && !chat.isArchived);
  const recentChats = filteredChats.filter((chat) => !chat.isPinned && !chat.isArchived);

  const handleLongPress = (chat: ChatItem, event: any) => {
    setSelectedChat(chat);

    // Get the position of the long press
    if (event?.nativeEvent) {
      const { pageY } = event.nativeEvent;
      // Position modal near the pressed item, but keep it on the right side
      setModalPosition({
        top: pageY - 50, // Adjust to position near the item
        right: 16,
      });
    }

    setShowOptionsModal(true);
  };

  const handlePin = async () => {
    if (!selectedChat) return;
    const updatedPreferences: ChatPreferences = {
      ...chatPreferences,
      pinned: [...chatPreferences.pinned.filter(id => id !== selectedChat.id), selectedChat.id],
      archived: chatPreferences.archived.filter(id => id !== selectedChat.id),
    };
    await saveChatPreferences(updatedPreferences);

    const updatedChats = chats.map((chat) =>
      chat.id === selectedChat.id ? { ...chat, isPinned: true, isArchived: false } : chat
    );
    setChats(updatedChats);
    setFilteredChats(updatedChats);
    setShowOptionsModal(false);
    setSelectedChat(null);
  };

  const handleUnpin = async () => {
    if (!selectedChat) return;
    const updatedPreferences: ChatPreferences = {
      ...chatPreferences,
      pinned: chatPreferences.pinned.filter(id => id !== selectedChat.id),
    };
    await saveChatPreferences(updatedPreferences);

    const updatedChats = chats.map((chat) =>
      chat.id === selectedChat.id ? { ...chat, isPinned: false } : chat
    );
    setChats(updatedChats);
    setFilteredChats(updatedChats);
    setShowOptionsModal(false);
    setSelectedChat(null);
  };

  const handleArchive = async () => {
    if (!selectedChat) return;
    const updatedPreferences: ChatPreferences = {
      ...chatPreferences,
      archived: [...chatPreferences.archived.filter(id => id !== selectedChat.id), selectedChat.id],
      pinned: chatPreferences.pinned.filter(id => id !== selectedChat.id),
    };
    await saveChatPreferences(updatedPreferences);

    const updatedChats = chats.map((chat) =>
      chat.id === selectedChat.id ? { ...chat, isArchived: true, isPinned: false } : chat
    );
    setChats(updatedChats);
    setFilteredChats(updatedChats);
    setShowOptionsModal(false);
    setSelectedChat(null);
  };

  const handleDelete = async () => {
    if (!selectedChat) return;
    const updatedPreferences: ChatPreferences = {
      ...chatPreferences,
      deleted: [...chatPreferences.deleted.filter(id => id !== selectedChat.id), selectedChat.id],
      pinned: chatPreferences.pinned.filter(id => id !== selectedChat.id),
      archived: chatPreferences.archived.filter(id => id !== selectedChat.id),
    };
    await saveChatPreferences(updatedPreferences);

    const updatedChats = chats.filter((chat) => chat.id !== selectedChat.id);
    setChats(updatedChats);
    setFilteredChats(updatedChats);
    setShowOptionsModal(false);
    setSelectedChat(null);
  };

  const closeModal = () => {
    setShowOptionsModal(false);
    setSelectedChat(null);
  };

  return (
    <LinearGradient
      colors={['#1a0d2e', '#2d1b4e', '#4a2c5a']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.gradientContainer}>
      <View style={styles.starsContainer}>
        {STAR_DATA.map((star) => (
          <View
            key={star.id}
            style={[
              styles.star,
              {
                left: `${star.x}%`,
                top: `${star.y}%`,
                width: star.size,
                height: star.size,
                opacity: star.opacity,
              },
            ]}
          />
        ))}
      </View>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Search Header */}
        <View style={styles.topSearchContainer}>
          <View style={styles.searchBarWrapper}>
            <MaterialIcons name="search" size={24} color="rgba(255, 255, 255, 0.6)" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search"
              placeholderTextColor="rgba(255, 255, 255, 0.4)"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <TouchableOpacity
            style={styles.filterButton}
            activeOpacity={0.7}
            onPress={() => router.push('/filters')}>
            <MaterialIcons name="tune" size={22} color="rgba(255, 255, 255, 0.8)" />
          </TouchableOpacity>
        </View>

        <FlatList
          style={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          data={filteredChats}
          keyExtractor={(item) => `${item.isPinned ? 'pinned' : 'recent'}-${item.id}`}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={10}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />
          }
          ListHeaderComponent={
            <View style={styles.messagesHeader}>
              <Text style={styles.messagesTitle}>Messages</Text>
            </View>
          }
          ListEmptyComponent={
            loading ? (
              <View style={styles.emptyContainer}>
                <ActivityIndicator size="large" color="#A855F7" />
                <Text style={[styles.emptyText, { marginTop: 14 }]}>Loading chats...</Text>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <MaterialIcons name="chat-bubble-outline" size={64} color="rgba(255, 255, 255, 0.3)" />
                <Text style={styles.emptyText}>
                  {searchQuery.trim() ? 'No matches found' : 'No matches yet'}
                </Text>
                <Text style={styles.emptySubtext}>
                  {searchQuery.trim()
                    ? 'Try a different search term'
                    : 'Start matching to see conversations here'}
                </Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <ChatItemComponent chat={item} onLongPress={handleLongPress} />
          )}
          ListFooterComponent={<View style={{ height: 100 }} />}
        />

        {/* Options Modal */}
        <Modal
          visible={showOptionsModal}
          transparent={true}
          animationType="fade"
          onRequestClose={closeModal}>
          <TouchableWithoutFeedback onPress={closeModal}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
                <View style={[styles.modalContent, { top: modalPosition.top, right: modalPosition.right }]}>
                  <View style={styles.optionsList}>
                    {selectedChat?.isPinned ? (
                      <TouchableOpacity
                        style={styles.optionItem}
                        onPress={handleUnpin}
                        activeOpacity={0.7}>
                        <MaterialIcons name="push-pin" size={18} color="#FFFFFF" />
                        <Text style={styles.optionText}>Unpin</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.optionItem}
                        onPress={handlePin}
                        activeOpacity={0.7}>
                        <MaterialIcons name="push-pin" size={18} color="#FFFFFF" />
                        <Text style={styles.optionText}>Pin</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={styles.optionItem}
                      onPress={handleDelete}
                      activeOpacity={0.7}>
                      <MaterialIcons name="delete" size={18} color="#EF4444" />
                      <Text style={[styles.optionText, styles.deleteText]}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  starsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  star: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 50,
  },
  container: {
    flex: 1,
  },
  topSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    gap: 12,
  },
  searchBarWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 25,
    paddingHorizontal: 15,
    height: 50,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 16,
    height: '100%',
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flex: 1,
  },
  matchesSection: {
    marginBottom: 25,
  },
  matchesScrollContent: {
    paddingHorizontal: 20,
    gap: 15,
  },
  matchItem: {
    alignItems: 'center',
    width: 85,
  },
  matchNameText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 6,
    textAlign: 'center',
  },
  messagesHeader: {
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  messagesTitle: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '700',
  },
  chatsContainer: {
    flex: 1,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  avatarContainer: {
    position: 'relative',
  },
  chatContent: {
    flex: 1,
    justifyContent: 'center',
  },
  chatHeader: {
    marginBottom: 2,
  },
  chatName: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '600',
  },
  chatFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatMessage: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 15,
    flex: 1,
  },
  unreadMessage: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  typingText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 15,
  },
  chatRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 6,
  },
  chatTime: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 13,
  },
  chatIndicators: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unreadBadge: {
    backgroundColor: '#FF2D78',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4ADE80',
    borderWidth: 2,
    borderColor: '#000',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 20,
    textAlign: 'center',
  },
  emptySubtext: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  modalContent: {
    position: 'absolute',
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    minWidth: 140,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  optionsList: {
    gap: 0,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  optionText: {
    color: '#FFF',
    fontSize: 15,
  },
  deleteText: {
    color: '#FF453A',
  },
});