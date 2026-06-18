import { deleteMatch } from '@/lib/matches';
import { deleteMessages } from '@/lib/messages';
import { releaseRealtimeChannel, trackRealtimeChannel } from '@/lib/realtime-channels';
import { isUserReportedInChannel } from '@/lib/reports';
import { signalMessageSent } from '@/lib/signals';
import { supabase } from '@/lib/supabase';
import { deleteUserLikes } from '@/lib/user-likes';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { ChatHeader } from '@/components/chat/ChatHeader';
import InputBar, { InputBarRef } from '@/components/chat/InputBar';
import ChatModals, { ChatModalsRef } from '@/components/chat/ChatModals';
import { MessageList, MessageListRef } from '@/components/chat/MessageList';
import { ErrorBoundary } from '@/components/error-boundary';
import { useChatMessages } from '@/hooks/useChatMessages';
import { useChatRouteParams } from '@/hooks/useChatRouteParams';
import { useChatSession } from '@/hooks/useChatSession';
import { useTypingStatus } from '@/hooks/useTypingStatus';
import { useAuthAlert } from '@/lib/auth-alert-context';
import { safeReleaseChatChannel } from '@/lib/chatRealtimeManager';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Keyboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

export default function ChatDetailScreen() {
  const { chatId } = useChatRouteParams();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [icebreakerDismissed, setIcebreakerDismissed] = useState(false);

  const isMountedRef = useRef(true);
  const hasSignaledMessageSent = useRef(false);
  const messageListRef = useRef<MessageListRef>(null);
  const inputBarRef = useRef<InputBarRef>(null);
  const chatModalsRef = useRef<ChatModalsRef>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const {
    user,
    isMatched,
    channelId,
    icebreaker,
    loading,
    setUser,
    synastryDetail,
    synastryScore,
  } = useChatSession({ chatId, currentUserId, isMountedRef });

  const { isOtherUserTyping, handleTyping } = useTypingStatus({ currentUserId, chatId, channelId });

  const { messages, sending, connectionStatus, sendText, syncMessages, addConfirmedMessage, markMessageFailed, removeMessage } = useChatMessages({
    chatId,
    channelId,
    currentUserId,
    isMatched,
    isMountedRef,
  });

  const { showAlert } = useAuthAlert();

  // Auto-scroll when user sends a message
  useEffect(() => {
    if (messages.length === 0) return;
    const lastMessage = messages[messages.length - 1];
    if (isAtBottom || lastMessage?.senderId === currentUserId) {
      messageListRef.current?.scrollToStart(true);
    }
  }, [messages.length, currentUserId]);

  // Hide Expo Router header
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  // Android keyboard lift
  const [androidKeyboardHeight, setAndroidKeyboardHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      const h = e.endCoordinates?.height ?? 0;
      const isRealKeyboard = h > 120;
      setAndroidKeyboardHeight(isRealKeyboard ? h : 0);
      if (isRealKeyboard) setTimeout(() => messageListRef.current?.scrollToStart(true), 100);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setAndroidKeyboardHeight(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  // Fetch current user ID
  useEffect(() => {
    const fetch = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (user && !error && isMountedRef.current) setCurrentUserId(user.id);
      } catch {}
    };
    fetch();
  }, []);

  // Online status subscription
  useEffect(() => {
    if (!chatId) return;
    const channelName = `online_status:${chatId}`;
    safeReleaseChatChannel(supabase, channelName);

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_online_status', filter: `user_id=eq.${chatId}` }, (payload) => {
        if (!isMountedRef.current) return;
        if (payload.new && typeof payload.new === 'object' && 'is_online' in payload.new) {
          const nextOnline = (payload.new as any).is_online as boolean;
          setUser((prev) => prev && prev.isOnline !== nextOnline ? { ...prev, isOnline: nextOnline } : prev);
        }
      })
      .subscribe();
    trackRealtimeChannel(channel);
    return () => { releaseRealtimeChannel(supabase, channel); };
  }, [chatId]);

  // Sync on foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void syncMessages();
    });
    return () => sub.remove();
  }, [syncMessages]);

  // Check if reported
  useEffect(() => {
    const check = async () => {
      if (!channelId || !currentUserId) return;
      const res = await isUserReportedInChannel(channelId, currentUserId);
      if (res.success && res.reported) {
        showAlert('Reported', 'You have been reported in this chat. The conversation is no longer available.', [{ text: 'OK', onPress: () => router.replace('/(tabs)/chats') }]);
      }
    };
    check();
  }, [channelId, currentUserId, router]);

  const handleUnmatchAndDelete = useCallback(async () => {
    if (!chatId || !currentUserId) return;
    try {
      const [deleteMessagesResult, deleteLikesResult, deleteMatchResult] = await Promise.allSettled([
        deleteMessages(chatId),
        deleteUserLikes(chatId),
        deleteMatch(chatId),
      ]);

      if (deleteMatchResult.status === 'rejected' ||
        (deleteMatchResult.status === 'fulfilled' && !deleteMatchResult.value.success)) {
        showAlert('Error', 'Failed to delete match. Please try again.');
        return;
      }

      router.replace('/(tabs)/chats');
    } catch {
      showAlert('Error', 'An error occurred while unmatching. Please try again.');
    }
  }, [chatId, currentUserId, router, showAlert]);

  const handleReport = useCallback(async () => {
    try {
      router.push('/(tabs)/chats');
    } catch {}
  }, [router]);

  const handleBlock = useCallback(async () => {
    if (!chatId) return;
    try {
      const { blockUser } = await import('@/lib/blocks');
      await blockUser(chatId);
      router.replace('/(tabs)/chats');
    } catch {
      showAlert('Error', 'Failed to block user. Please try again.');
    }
  }, [chatId, router, showAlert]);

  const handleRetryMessage = useCallback(async (failedMessage: any) => {
    if (!failedMessage?.text || failedMessage.text === failedMessage.id) return;
    removeMessage(failedMessage.id);
    await sendText(failedMessage.text);
  }, [removeMessage, sendText]);

  const handleSendMessage = useCallback(async (text: string) => {
    await sendText(text);
    if (!hasSignaledMessageSent.current) {
      hasSignaledMessageSent.current = true;
      signalMessageSent(chatId);
    }
  }, [sendText, chatId]);

  const handleBackPress = useCallback(() => { router.back(); }, [router]);
  const handleOpenMenu = useCallback(() => { chatModalsRef.current?.openMenu(); }, []);

  const handleUseIcebreaker = useCallback(() => {
    if (!icebreaker) return;
    inputBarRef.current?.setText(icebreaker);
    setIcebreakerDismissed(true);
  }, [icebreaker]);

  const handleDismissIcebreaker = useCallback(() => { setIcebreakerDismissed(true); }, []);

  const messagesContentStyle = useMemo(() => styles.messagesContent, []);

  if (loading || !user) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#A855F7" />
          <Text style={styles.loadingText}>Loading chat...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isMatched === false) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBackPress} activeOpacity={0.7}>
            <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <View style={styles.avatarContainer}>
              <Image source={user.avatar} style={styles.headerAvatar} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.headerName}>{user.name}</Text>
            </View>
          </View>
        </View>
        <View style={styles.errorContainer}>
          <MaterialIcons name="block" size={64} color="#EF4444" />
          <Text style={styles.errorTitle}>Cannot Start Chat</Text>
          <Text style={styles.errorMessage}>
            You can only chat with users you have matched with. Please match with this user first.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="light" />
        <ChatHeader
          user={user}
          isOtherUserTyping={isOtherUserTyping}
          connectionStatus={connectionStatus}
          onBackPress={handleBackPress}
          onMenuPress={handleOpenMenu}
          synastryDetail={synastryDetail}
          synastryScore={synastryScore}
        />

        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.bottom : 20}>
          <View style={[styles.keyboardView, Platform.OS === 'android' && { marginBottom: androidKeyboardHeight }]}>
            <MessageList
              ref={messageListRef}
              messages={messages}
              currentUserId={currentUserId}
              avatar={user?.avatar}
              onRetry={handleRetryMessage}
              icebreaker={icebreaker}
              icebreakerDismissed={icebreakerDismissed}
              onUseIcebreaker={handleUseIcebreaker}
              onDismissIcebreaker={handleDismissIcebreaker}
              contentContainerStyle={messagesContentStyle}
              onAtBottomChange={setIsAtBottom}
            />

            {/* Scroll-to-bottom FAB */}
            {!isAtBottom && (
              <TouchableOpacity
                style={styles.scrollFab}
                onPress={() => messageListRef.current?.scrollToStart(true)}
                activeOpacity={0.85}>
                <MaterialIcons name="keyboard-arrow-down" size={22} color="#fff" />
              </TouchableOpacity>
            )}

            {/* Icebreaker chip (shown only while there are a few messages) */}
            {icebreaker && !icebreakerDismissed && messages.length > 0 && messages.length <= 5 && (
              <View style={styles.icebreakerChipRow}>
                <TouchableOpacity style={styles.icebreakerChip} activeOpacity={0.75} onPress={handleUseIcebreaker}>
                  <Text style={styles.icebreakerChipEmoji}>✨</Text>
                  <Text style={styles.icebreakerChipText} numberOfLines={1}>{icebreaker}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.icebreakerDismissButton}
                  activeOpacity={0.7}
                  onPress={handleDismissIcebreaker}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <MaterialIcons name="close" size={16} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>
              </View>
            )}

            <InputBar
              ref={inputBarRef}
              sending={sending}
              isMatched={isMatched}
              channelId={channelId ?? ''}
              chatId={chatId}
              currentUserId={currentUserId}
              onSendMessage={handleSendMessage}
              onTyping={handleTyping}
              addConfirmedMessage={addConfirmedMessage}
              markMessageFailed={markMessageFailed}
              removeMessage={removeMessage}
              bottomInset={insets.bottom}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <ChatModals
        ref={chatModalsRef}
        chatId={chatId}
        channelId={channelId}
        userName={user?.name ?? ''}
        onUnmatch={handleUnmatchAndDelete}
        onReport={handleReport}
        onBlock={handleBlock}
      />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A0B2E',
  },
  keyboardView: {
    flex: 1,
    backgroundColor: '#130820',
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1A0B2E',
  },
  scrollFab: {
    position: 'absolute',
    bottom: 80,
    right: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(124,58,237,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 8,
  },
  icebreakerChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  icebreakerChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(168, 85, 247, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.45)',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 6,
  },
  icebreakerChipEmoji: {
    fontSize: 14,
  },
  icebreakerChipText: {
    flex: 1,
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
  },
  icebreakerDismissButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Loading / error
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  errorTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorMessage: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  // Not-matched error header (reuses ChatHeader layout minimally)
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 8,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  headerText: {
    flex: 1,
  },
  headerName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
