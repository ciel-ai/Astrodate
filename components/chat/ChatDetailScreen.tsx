import { deleteMatch } from '@/lib/matches';
import { deleteMessages, sendMessage } from '@/lib/messages';
import { releaseRealtimeChannel, trackRealtimeChannel } from '@/lib/realtime-channels';
import { createReport, isUserReportedInChannel } from '@/lib/reports';
import { signalMessageSent } from '@/lib/signals';
import { supabase } from '@/lib/supabase';
import { broadcastTypingStatus } from '@/lib/typing-status';
import { deleteUserLikes } from '@/lib/user-likes';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { Audio } from 'expo-av';
// Use legacy FS to avoid deprecation crash on some Android builds
import { ChatHeader } from '@/components/chat/ChatHeader';
import { MessageList, MessageListRef } from '@/components/chat/MessageList';
import { ErrorBoundary } from '@/components/error-boundary';
import { useChatMessages } from '@/hooks/useChatMessages';
import { useChatRouteParams } from '@/hooks/useChatRouteParams';
import { useChatSession } from '@/hooks/useChatSession';
import { useTypingStatus } from '@/hooks/useTypingStatus';
import { useAuthAlert } from '@/lib/auth-alert-context';
import { safeReleaseChatChannel } from '@/lib/chatRealtimeManager';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  AppState,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Keyboard
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

type Message = {
  id: string;
  text: string;
  senderId: string;
  timestamp: Date;
  isRead: boolean;
};

// MessageRow replaced by <MessageBubble> from @/components/chat/MessageBubble
// formatMessageTime replaced by <MessageTimestamp> from @/components/chat/MessageTimestamp
// The block below is a tombstone — remove on next cleanup pass

const getAvatarSource = (avatarUrl: string | null | undefined) => {
  if (avatarUrl) return { uri: avatarUrl };
  return require('@/assets/images/avatar-placeholder.png');
};

export default function ChatDetailScreen() {
  const { chatId } = useChatRouteParams();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [messageText, setMessageText] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string>('');

  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const [icebreakerDismissed, setIcebreakerDismissed] = useState(false);
  const [inputHeight, setInputHeight] = useState(42);

  const isMountedRef = useRef(true);
  const hasSignaledMessageSent = useRef(false);
  const hasSignaledMessageReplied = useRef(false);
  const messageListRef = useRef<MessageListRef>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  // Track whether the user is scrolled near the bottom of the message list
  const [isAtBottom, setIsAtBottom] = useState(true);

  // ── useChatSession owns: user, isMatched, channelId, icebreaker, loading ──
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

  // ── useTypingStatus owns: isOtherUserTyping, handleTyping ──
  const { isOtherUserTyping, handleTyping } = useTypingStatus({ currentUserId, chatId, channelId });

  // ── useChatMessages owns: messages, sending, connectionStatus, sendText, syncMessages, realtime subscriptions ──
  const { messages, sending, connectionStatus, sendText, syncMessages, addConfirmedMessage, markMessageFailed, removeMessage } = useChatMessages({
    chatId,
    channelId,
    currentUserId,
    isMatched,
    isMountedRef,
  });

  // Auto-scroll to newest message when user sends a message
  useEffect(() => {
    if (messages.length === 0) return;
    const lastMessage = messages[messages.length - 1];
    const userSentLast = lastMessage?.senderId === currentUserId;
    // Only auto-scroll if we're already at bottom or user just sent a message
    if (isAtBottom || userSentLast) {
      messageListRef.current?.scrollToStart(true);
    }
  }, [messages.length, currentUserId]);

  // Menu and modal states
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [showDidYouMeetModal, setShowDidYouMeetModal] = useState(false);
  const [showSeeAgainModal, setShowSeeAgainModal] = useState(false);
  const [showThanksModal, setShowThanksModal] = useState(false);
  const [showUnmatchModal, setShowUnmatchModal] = useState(false);
  const [showUnmatchReasonModal, setShowUnmatchReasonModal] = useState(false);
  const [selectedUnmatchReason, setSelectedUnmatchReason] = useState<string>('');
  const [isReportedAgainstMe, setIsReportedAgainstMe] = useState(false);

  // Audio recording states
  const [showRecordingModal, setShowRecordingModal] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  // Instagram-style recording bar animation
  const recordingBarAnim = useRef(new Animated.Value(0)).current; // 0=hidden, 1=shown
  const micScaleAnim = useRef(new Animated.Value(1)).current;
  const [recordingCancelled, setRecordingCancelled] = useState(false);

  // Report flow states
  const [showReportModal, setShowReportModal] = useState(false);
  const [showReportCategoryModal, setShowReportCategoryModal] = useState(false);
  const [showReportSubcategoryModal, setShowReportSubcategoryModal] = useState(false);
  const [showReportDetailsModal, setShowReportDetailsModal] = useState(false);
  const [selectedReportCategory, setSelectedReportCategory] = useState<string>('');
  const [selectedReportSubcategory, setSelectedReportSubcategory] = useState<string>('');
  const [reportDetails, setReportDetails] = useState<string>('');
  const [reportSaved, setReportSaved] = useState<boolean>(false);
  const [showReportConfirmationModal, setShowReportConfirmationModal] = useState(false);
  const { showAlert } = useAuthAlert();

  // Hide the default Expo Router header
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      // typingTimeoutRef cleanup is owned by useTypingStatus hook
    };
  }, []);

  // Android: track keyboard height and lift the chat container by exactly that
  // amount (see the `marginBottom` on the KeyboardAvoidingView below). With
  // edge-to-edge (Expo SDK 54) the window does NOT resize for the keyboard, so
  // we move the whole messages+input column up as a unit — this keeps the input
  // bar flush against the top of the keyboard with no gap. iOS uses the native
  // KeyboardAvoidingView `padding` behavior instead.
  const [androidKeyboardHeight, setAndroidKeyboardHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      const h = e.endCoordinates?.height ?? 0;
      // Ignore spurious small inset events (e.g. the gesture nav bar) that
      // aren't a real keyboard — otherwise a leftover lift keeps the input bar
      // floating above the bottom after the keyboard closes.
      const isRealKeyboard = h > 120;
      setAndroidKeyboardHeight(isRealKeyboard ? h : 0);
      // Opening the keyboard shrinks the list viewport from the bottom but does
      // NOT change content size, so onContentSizeChange won't fire and the
      // newest message can slip behind the input bar. Re-pin to the bottom once
      // the lift has settled — focusing the input should always reveal the
      // latest message (standard chat behavior).
      if (isRealKeyboard) {
        setTimeout(() => messageListRef.current?.scrollToStart(true), 100);
      }
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setAndroidKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Get current user ID (online status is now managed globally in _layout.tsx)
  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const userResult = await supabase.auth.getUser();
        const user = userResult?.data?.user;
        const error = userResult?.error;
        if (user && !error && isMountedRef.current) {
          setCurrentUserId(user.id);
        }
      } catch (error) {
        console.error('Error getting current user:', error);
      }
    };
    getCurrentUser();
  }, []);





  // Subscribe to online status changes
  useEffect(() => {
    if (!chatId) return;

    const onlineStatusChannelName = `online_status:${chatId}`;
    safeReleaseChatChannel(supabase, onlineStatusChannelName);
    console.log('[Realtime] subscribe', onlineStatusChannelName);

    const channel = supabase
      .channel(onlineStatusChannelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_online_status',
          filter: `user_id=eq.${chatId}`,
        },
        (payload) => {
          if (!isMountedRef.current) return;
          if (payload.new && typeof payload.new === 'object' && 'is_online' in payload.new) {
            const nextOnline = (payload.new as any).is_online as boolean;
            setUser((prev) =>
              prev && prev.isOnline !== nextOnline
                ? {
                  ...prev,
                  isOnline: nextOnline,
                }
                : prev
            );
          }
        }
      )
      .subscribe();
    trackRealtimeChannel(channel);

    return () => {
      console.log('[Realtime] unsubscribe', onlineStatusChannelName);
      releaseRealtimeChannel(supabase, channel);
    };
  }, [chatId]);

  // Force a sync when app comes back to foreground.
  // (The 4-second polling loop that previously lived here was removed — it
  //  duplicated the real-time subscription below, doubled network traffic,
  //  caused message flicker on every poll, and drained battery. The AppState
  //  listener below already handles recovery when the app returns to foreground.)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void syncMessages();
      }
    });

    return () => subscription.remove();
  }, [syncMessages]);



  // Scroll-to-bottom and typing channel lifecycle are now owned by
  // <MessageList> and useTypingStatus hook respectively.

  // Function to delete match and messages when unmatching (backend deletion)
  const handleUnmatchAndDelete = useCallback(async () => {
    if (!chatId || !currentUserId) return;

    try {
      // Delete operations in parallel for better performance
      // 1. Delete all messages between users
      // 2. Delete likes from user_likes table (both directions)
      // 3. Delete the match from user_matches table
      const [deleteMessagesResult, deleteLikesResult, deleteMatchResult] = await Promise.allSettled([
        deleteMessages(chatId),
        deleteUserLikes(chatId),
        deleteMatch(chatId),
      ]);

      // Check results
      if (deleteMessagesResult.status === 'rejected' ||
        (deleteMessagesResult.status === 'fulfilled' && !deleteMessagesResult.value.success)) {
        console.error('❌ Error deleting messages:',
          deleteMessagesResult.status === 'rejected'
            ? deleteMessagesResult.reason
            : deleteMessagesResult.value.error);
      }

      if (deleteLikesResult.status === 'rejected' ||
        (deleteLikesResult.status === 'fulfilled' && !deleteLikesResult.value.success)) {
        console.error('❌ Error deleting likes:',
          deleteLikesResult.status === 'rejected'
            ? deleteLikesResult.reason
            : deleteLikesResult.value.error);
      }

      if (deleteMatchResult.status === 'rejected' ||
        (deleteMatchResult.status === 'fulfilled' && !deleteMatchResult.value.success)) {
        console.error('❌ Error deleting match:',
          deleteMatchResult.status === 'rejected'
            ? deleteMatchResult.reason
            : deleteMatchResult.value.error);
        showAlert('Error', 'Failed to delete match. Please try again.');
        return;
      }

      // All deletions successful - navigate back to chats
      // The match will be automatically removed from "Your matches" section 
      // because getAllUsers() queries user_matches table, which no longer contains this match
      // useFocusEffect will trigger fetchUsers() when screen comes into focus
      router.replace('/(tabs)/chats');
    } catch (error) {
      console.error('❌ Error during unmatch/delete:', error);
      showAlert('Error', 'An error occurred while unmatching. Please try again.');
    }
  }, [chatId, currentUserId, router]);

  // Function to handle report - only removes from frontend, keeps in backend
  const handleReport = useCallback(async () => {
    if (!chatId) return;

    try {
      // Report is already saved to database with channel_id
      // Navigate away - the chats screen will refresh and filter out reported users
      // Chat will be removed from "Your matches" and "Chats" sections immediately
      // Messages will remain in backend and NOT be deleted after 5 minutes
      // Use push instead of replace to ensure navigation stack is updated
      router.push('/(tabs)/chats');
    } catch (error) {
      console.error('❌ Error during report:', error);
    }
  }, [chatId, router]);

  // Request media library permissions
  const requestMediaPermissions = useCallback(async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showAlert(
          'Permission Required',
          'Sorry, we need media library permissions to attach photos and videos.',
          [{ text: 'OK' }]
        );
        return false;
      }
    }
    return true;
  }, [showAlert]);

  // Request camera permissions
  const requestCameraPermissions = useCallback(async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        showAlert(
          'Permission Required',
          'Sorry, we need camera permissions to take photos.',
          [{ text: 'OK' }]
        );
        return false;
      }
    }
    return true;
  }, [showAlert]);

  // Upload media (photo/video) to storage and send as a message
  const uploadMediaAndSend = useCallback(async (
    asset: ImagePicker.ImagePickerAsset,
    type: 'photo' | 'video'
  ) => {
    if (!currentUserId || !chatId || sending || isMatched !== true) {
      return;
    }

    const prefix = type === 'photo' ? '📷 Photo' : '🎬 Video';
    const tempId = `temp-media-${Date.now()}`;
    // Add optimistic placeholder immediately so the user sees feedback during upload
    addConfirmedMessage({
      id: tempId,
      text: `${prefix}: uploading…`,
      senderId: currentUserId,
      timestamp: new Date(),
      isRead: false,
      isOptimistic: true,
    });

    try {

      const userResult = await supabase.auth.getUser();
      const user = userResult?.data?.user;
      if (!user) {
        throw new Error('User not authenticated');
      }

      const uri = asset.uri;
      const contentType =
        (asset as any).mimeType || (type === 'photo' ? 'image/jpeg' : 'video/mp4');

      // Derive extension
      const extFromMime =
        contentType === 'image/jpeg'
          ? 'jpg'
          : contentType === 'image/png'
            ? 'png'
            : contentType === 'video/mp4'
              ? 'mp4'
              : undefined;
      const uriExt = uri.split('.').pop();
      const ext = extFromMime || uriExt || (type === 'photo' ? 'jpg' : 'mp4');

      const fileName =
        asset.fileName ||
        uri.split('/').pop() ||
        `${type}_${Date.now()}.${ext}`;

      // Decode base64 to Uint8Array — avoids fetch(data:) failures on Android
      const base64Data = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });
      const binaryStr = atob(base64Data);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) { bytes[i] = binaryStr.charCodeAt(i); }

      const filePath = `${type}/${user.id}/${Date.now()}_${fileName}`;
      const { error: uploadError } = await supabase.storage
        .from('messages')
        .upload(filePath, bytes, { contentType });

      if (uploadError) {
        throw uploadError;
      }

      const publicUrlResult = supabase.storage
        .from('messages')
        .getPublicUrl(filePath);
      const publicUrl = publicUrlResult?.data?.publicUrl;

      const messageText = `${prefix}: ${publicUrl}`;

      const result = await sendMessage(chatId, messageText, channelId);
      if (!result.success) {
        throw new Error(result.error || 'Failed to send media message');
      }

      // Replace optimistic placeholder with the confirmed server message
      if (result.data) {
        addConfirmedMessage({
          id: result.data.id,
          text: result.data.message_text,
          senderId: result.data.sender_id,
          timestamp: result.data.created_at ? new Date(result.data.created_at) : new Date(),
          isRead: result.data.is_read,
        });
        // Remove the optimistic placeholder now that the real message is in state
        // (reducer dedup will block a duplicate if realtime also delivers it)
        removeMessage(tempId);
      }

    } catch (error) {
      // Mark the placeholder as failed so the user sees it rather than it disappearing
      markMessageFailed(tempId);
      console.error('❌ Error sending media:', error);
      showAlert(
        'Error',
        `Failed to send ${type}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }, [currentUserId, chatId, channelId, sending, isMatched, addConfirmedMessage, markMessageFailed, removeMessage, showAlert]);

  // Handle photo picker
  const handlePickPhoto = useCallback(async () => {
    setShowAttachmentModal(false);
    const hasPermission = await requestMediaPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const photo = result.assets[0];
        await uploadMediaAndSend(photo, 'photo');
      }
    } catch (error) {
      console.error('Error picking photo:', error);
      showAlert('Error', 'Failed to pick photo. Please try again.');
    }
  }, [requestMediaPermissions, uploadMediaAndSend, showAlert]);

  // Handle video picker
  const handlePickVideo = useCallback(async () => {
    setShowAttachmentModal(false);
    const hasPermission = await requestMediaPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["videos"],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const video = result.assets[0];
        await uploadMediaAndSend(video, 'video');
      }
    } catch (error) {
      console.error('Error picking video:', error);
      showAlert('Error', 'Failed to pick video. Please try again.');
    }
  }, [requestMediaPermissions, uploadMediaAndSend, showAlert]);

  // Request audio recording permissions
  const requestAudioPermissions = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'web') {
      try {
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== 'granted') {
          showAlert(
            'Permission Required',
            'Sorry, we need microphone permissions to record audio.',
            [{ text: 'OK' }]
          );
          return false;
        }
        return true;
      } catch (error) {
        console.error('Error requesting audio permissions:', error);
        return false;
      }
    }
    return true;
  }, [showAlert]);

  // Start audio recording
  const startRecording = useCallback(async () => {
    try {
      const hasPermission = await requestAudioPermissions();
      if (!hasPermission) return;

      // Set audio mode for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Custom preset: audio/mp4 container (AAC codec) — Supabase storage accepts
      // audio/mp4 but rejects audio/m4a which HIGH_QUALITY produces on Android.
      const RECORDING_OPTIONS = {
        android: {
          extension: '.mp4',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        ios: {
          extension: '.mp4',
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        },
      };

      const { recording: newRecording } = await Audio.Recording.createAsync(
        RECORDING_OPTIONS
      );

      // Update duration from recording status (more accurate than manual timer)
      newRecording.setOnRecordingStatusUpdate((status) => {
        if (status.isRecording) {
          const secs = Math.floor((status.durationMillis || 0) / 1000);
          setRecordingDuration(secs);
        }
      });
      await newRecording.setProgressUpdateInterval(500);

      recordingRef.current = newRecording;
      setRecording(newRecording);
      setIsRecording(true);
      setRecordingUri(null);
      setRecordingDuration(0);

    } catch (error) {
      console.error('Failed to start recording:', error);
      showAlert('Error', 'Failed to start recording. Please try again.');
    }
  }, [requestAudioPermissions, showAlert]);

  // Stop audio recording
  const stopRecording = useCallback(async () => {
    if (!recording) return;

    try {
      setIsRecording(false);

      await recording.stopAndUnloadAsync();
      recordingRef.current = null;
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      const uri = recording.getURI();
      setRecordingUri(uri);
      setRecording(null);

    } catch (error) {
      console.error('Failed to stop recording:', error);
      showAlert('Error', 'Failed to stop recording.');
    }
  }, [recording, showAlert]);

  // Cancel recording
  const cancelRecording = useCallback(async () => {
    if (recording) {
      try {
        await recording.stopAndUnloadAsync();
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
        });
      } catch (error) {
        console.error('Error canceling recording:', error);
      }
    }
    setRecording(null);
    recordingRef.current = null;
    setIsRecording(false);
    setRecordingUri(null);
    setRecordingDuration(0);
  }, [recording]);

  // Send recorded audio
  const sendRecordedAudio = useCallback(async () => {
    if (!recordingUri || !currentUserId || !chatId || sending || isMatched !== true) return;

    const tempId = `temp-audio-${Date.now()}`;
    // Add optimistic placeholder immediately so the user sees feedback during upload
    addConfirmedMessage({
      id: tempId,
      text: '🎤 Audio message: uploading…',
      senderId: currentUserId,
      timestamp: new Date(),
      isRead: false,
      isOptimistic: true,
    });

    try {
      // Upload audio to Supabase storage
      // Use audio/mp4 (not audio/m4a) — Supabase storage rejects audio/m4a
      const audioFileName = `audio_${Date.now()}.mp4`;

      // Decode base64 to Uint8Array — avoids fetch(data:) failures on Android
      const base64Data = await FileSystem.readAsStringAsync(recordingUri, {
        encoding: 'base64',
      });
      const binaryStr = atob(base64Data);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) { bytes[i] = binaryStr.charCodeAt(i); }

      // Upload to Supabase storage
      const userResult = await supabase.auth.getUser();
      const user = userResult?.data?.user;
      if (!user) {
        throw new Error('User not authenticated');
      }

      const filePath = `audio/${user.id}/${Date.now()}_${audioFileName}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('messages')
        .upload(filePath, bytes, {
          contentType: 'audio/mp4',
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const publicUrlResult = supabase.storage
        .from('messages')
        .getPublicUrl(filePath);
      const publicUrl = publicUrlResult?.data?.publicUrl;

      // Send message with audio URL
      const audioMessageText = `🎤 Audio message: ${publicUrl}`;
      const result = await sendMessage(chatId, audioMessageText, channelId);

      if (!result.success) {
        throw new Error(result.error || 'Failed to send audio message');
      }

      // Replace optimistic placeholder with the confirmed server message
      if (result.data) {
        addConfirmedMessage({
          id: result.data.id,
          text: result.data.message_text,
          senderId: result.data.sender_id,
          timestamp: result.data.created_at ? new Date(result.data.created_at) : new Date(),
          isRead: result.data.is_read,
        });
        removeMessage(tempId);
      }

      // Reset recording state
      setRecordingUri(null);
      setRecordingDuration(0);
      setShowRecordingModal(false);

    } catch (error) {
      // Mark placeholder as failed so the user sees it rather than it disappearing
      markMessageFailed(tempId);
      console.error('❌ Error sending audio:', error);
      showAlert('Error', `Failed to send audio: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [recordingUri, currentUserId, chatId, channelId, sending, isMatched, addConfirmedMessage, markMessageFailed, removeMessage, showAlert]);

  // Handle audio picker from attachment modal (legacy modal path)
  const handlePickAudio = useCallback(async () => {
    setShowAttachmentModal(false);
    setRecordingUri(null);
    setRecordingDuration(0);
    setShowRecordingModal(true);
  }, []);

  // Instagram-style: tap mic to start, tap stop to finish
  const handleMicPress = useCallback(async () => {
    if (isRecording) {
      // Stop and show send bar
      await stopRecording();
      Animated.spring(micScaleAnim, { toValue: 1, useNativeDriver: true }).start();
    } else {
      // Start recording — slide bar up
      setRecordingCancelled(false);
      setRecordingUri(null);
      setRecordingDuration(0);
      const hasPermission = await requestAudioPermissions();
      if (!hasPermission) return;
      await startRecording();
      Animated.parallel([
        Animated.spring(recordingBarAnim, { toValue: 1, friction: 7, tension: 50, useNativeDriver: true }),
        Animated.spring(micScaleAnim, { toValue: 1.2, useNativeDriver: true }),
      ]).start();
    }
  }, [isRecording, startRecording, stopRecording, requestAudioPermissions, recordingBarAnim, micScaleAnim]);

  const handleCancelRecording = useCallback(async () => {
    setRecordingCancelled(true);
    await cancelRecording();
    Animated.spring(recordingBarAnim, { toValue: 0, friction: 7, useNativeDriver: true }).start();
    Animated.spring(micScaleAnim, { toValue: 1, useNativeDriver: true }).start();
  }, [cancelRecording, recordingBarAnim, micScaleAnim]);

  const handleSendRecording = useCallback(async () => {
    Animated.spring(recordingBarAnim, { toValue: 0, friction: 7, useNativeDriver: true }).start();
    Animated.spring(micScaleAnim, { toValue: 1, useNativeDriver: true }).start();
    await sendRecordedAudio();
  }, [sendRecordedAudio, recordingBarAnim, micScaleAnim]);

  // Handle taking a new photo with camera
  const handleTakePhoto = useCallback(async () => {
    setShowAttachmentModal(false);
    const hasPermission = await requestCameraPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const photo = result.assets[0];
        await uploadMediaAndSend(photo, 'photo');
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      showAlert('Error', 'Failed to take photo. Please try again.');
    }
  }, [requestCameraPermissions, uploadMediaAndSend, showAlert]);

  // Format recording duration
  const formatRecordingDuration = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Cleanup recording on unmount using a ref so the closure always sees
  // the latest recording instance without re-registering the effect.
  useEffect(() => {
    recordingRef.current = recording;
  }, [recording]);

  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => { });
        recordingRef.current = null;
      }
    };
  }, []); // empty dep — runs only once on unmount

  // If current user has been reported in this channel, exit chat and show notice
  useEffect(() => {
    const checkReported = async () => {
      if (!channelId || !currentUserId) return;
      const res = await isUserReportedInChannel(channelId, currentUserId);
      if (res.success && res.reported) {
        setIsReportedAgainstMe(true);
        showAlert(
          'Reported',
          'You have been reported in this chat. The conversation is no longer available.',
          [
            {
              text: 'OK',
              onPress: () => router.replace('/(tabs)/chats'),
            },
          ],
        );
      }
    };
    checkReported();
  }, [channelId, currentUserId, router]);



  // Retry a failed message — removes the failed bubble and resends
  const handleRetryMessage = useCallback(async (failedMessage: any) => {
    if (!failedMessage?.text || failedMessage.text === failedMessage.id) return;
    // Remove the failed placeholder
    removeMessage(failedMessage.id);
    // Resend
    await sendText(failedMessage.text);
  }, [removeMessage, sendText]);

  const handleSendMessage = useCallback(async () => {
    if (!messageText.trim() || !currentUserId || !chatId || sending || isMatched !== true) return;

    const messageToSend = messageText.trim();
    setMessageText('');
    setInputHeight(42);

    // Stop typing indicator when message is sent (hook resets on next handleTyping timeout)
    broadcastTypingStatus(currentUserId, channelId, false).catch(() => { });

    await sendText(messageToSend);

    if (!hasSignaledMessageSent.current) {
      hasSignaledMessageSent.current = true;
      signalMessageSent(chatId);
    }
  }, [channelId, currentUserId, isMatched, messageText, sending, sendText]);

  const handleBackPress = useCallback(() => {
    router.back();
  }, [router]);

  const handleOpenMenu = useCallback(() => {
    setShowMenuModal(true);
  }, []);

  const handleMessageTextChange = useCallback((text: string) => {
    setMessageText(text);
    handleTyping();
  }, [handleTyping]);

  const handleUseIcebreaker = useCallback(() => {
    if (!icebreaker) return;
    setMessageText(icebreaker);
    setIcebreakerDismissed(true);
  }, [icebreaker]);

  const handleDismissIcebreaker = useCallback(() => {
    setIcebreakerDismissed(true);
  }, []);

  const messagesContentStyle = useMemo(
    () => styles.messagesContent,
    []
  );

  const isSendDisabled = useMemo(
    () => !messageText.trim() || sending || isMatched !== true,
    [isMatched, messageText, sending]
  );
  const sendIconColor = useMemo(
    () => messageText.trim() ? '#FFFFFF' : 'rgba(255, 255, 255, 0.3)',
    [messageText]
  );

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

  // Show error if users are not matched
  if (isMatched === false) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBackPress}
            activeOpacity={0.7}>
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
        {/* Header — extracted to ChatHeader component */}
        <ChatHeader
          user={user}
          isOtherUserTyping={isOtherUserTyping}
          connectionStatus={connectionStatus}
          onBackPress={handleBackPress}
          onMenuPress={handleOpenMenu}
          synastryDetail={synastryDetail}
          synastryScore={synastryScore}
        />

        {/* Messages + Input */}
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.bottom : 20}>
          {/* Android: lift messages + input above the keyboard as one unit.
              The lift lives on this plain inner View (like chatbot's
              innerContainer) — NOT on the KeyboardAvoidingView — so it doesn't
              fight the KAV's own layout and clip the input bar. */}
          <View style={[
            styles.keyboardView,
            Platform.OS === 'android' && { marginBottom: androidKeyboardHeight },
          ]}>
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
              activeOpacity={0.85}
            >
              <MaterialIcons name="keyboard-arrow-down" size={22} color="#fff" />
            </TouchableOpacity>
          )}

          {/* Icebreaker suggestion chip — only once messages exist (EmptyChatState handles the zero-message case) */}
          {icebreaker && !icebreakerDismissed && messages.length > 0 && messages.length <= 5 && (
            <View style={styles.icebreakerChipRow}>
              <TouchableOpacity
                style={styles.icebreakerChip}
                activeOpacity={0.75}
                onPress={handleUseIcebreaker}>
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

          {/* Instagram-style recording bar — slides up over the input when recording */}
          {(isRecording || (recordingUri && !recordingCancelled)) && (
            <Animated.View
              style={[
                styles.igRecordingBar,
                {
                  transform: [{
                    translateY: recordingBarAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [80, 0],
                    }),
                  }],
                  opacity: recordingBarAnim,
                },
              ]}
            >
              {isRecording ? (
                <>
                  {/* Live recording state */}
                  <TouchableOpacity onPress={handleCancelRecording} style={styles.igCancelBtn} activeOpacity={0.7}>
                    <MaterialIcons name="delete-outline" size={22} color="rgba(255,255,255,0.5)" />
                  </TouchableOpacity>
                  <View style={styles.igWaveformRow}>
                    <View style={styles.igRecDot} />
                    <Text style={styles.igRecDuration}>{formatRecordingDuration(recordingDuration)}</Text>
                    {/* Animated waveform bars */}
                    {[1, 0.5, 0.9, 0.3, 0.7, 0.4, 0.8, 0.2, 0.6, 0.5, 0.9, 0.4].map((h, i) => (
                      <View key={i} style={[styles.igWaveBar, { height: 8 + h * 16, opacity: 0.4 + h * 0.5 }]} />
                    ))}
                  </View>
                  <TouchableOpacity onPress={handleMicPress} style={styles.igStopBtn} activeOpacity={0.8}>
                    <MaterialIcons name="stop" size={20} color="#fff" />
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  {/* Preview / send state */}
                  <TouchableOpacity onPress={handleCancelRecording} style={styles.igCancelBtn} activeOpacity={0.7}>
                    <MaterialIcons name="delete-outline" size={22} color="rgba(255,255,255,0.5)" />
                  </TouchableOpacity>
                  <View style={styles.igWaveformRow}>
                    <MaterialIcons name="audiotrack" size={16} color="rgba(168,85,247,0.8)" />
                    <Text style={styles.igRecDuration}>{formatRecordingDuration(recordingDuration)}</Text>
                    <Text style={styles.igReadyText}>Ready to send</Text>
                  </View>
                  <TouchableOpacity
                    onPress={handleSendRecording}
                    style={styles.igSendAudioBtn}
                    disabled={sending}
                    activeOpacity={0.8}>
                    {sending
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <MaterialIcons name="send" size={18} color="#fff" />}
                  </TouchableOpacity>
                </>
              )}
            </Animated.View>
          )}

          {/* Input Area */}
          <View style={[styles.inputSafeArea, {
            // Always pad by the bottom safe-area inset, keyboard open OR closed.
            // On this platform `keyboardDidShow` reports endCoordinates.height
            // WITHOUT the navigation-bar inset, so the marginBottom lift alone
            // stops the input bar one nav-bar-height SHORT of the keyboard top
            // (the keyboard then crops the bottom of the bar). Keeping this
            // inset adds that missing strip back so the bar sits flush on the
            // keyboard — the same constant-inset + lift combo the chatbot
            // screen uses. (insets.bottom is ~0 on iOS, where the native
            // KeyboardAvoidingView padding handles the lift.)
            paddingBottom: insets.bottom
          }]}>
            <View style={styles.inputContainer}>
              {/* Left: attachment */}
              <TouchableOpacity
                style={styles.inputIconBtn}
                onPress={() => setShowAttachmentModal(true)}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialIcons name="add-circle-outline" size={26} color="rgba(168,85,247,0.8)" />
              </TouchableOpacity>

              {/* Text input — mic sits inside at the right */}
              <View style={styles.textInputWrapper}>
                <TextInput
                  style={[styles.textInput, { height: inputHeight }]}
                  placeholder="Type a message..."
                  placeholderTextColor="rgba(255, 255, 255, 0.35)"
                  value={messageText}
                  onChangeText={handleMessageTextChange}
                  onContentSizeChange={(e) => {
                    const h = e.nativeEvent.contentSize.height;
                    setInputHeight(Math.max(42, Math.min(120, h)));
                  }}
                  multiline
                  maxLength={500}
                  scrollEnabled={inputHeight >= 120}
                />
                {messageText.trim().length === 0 && (
                  <Animated.View style={[styles.inlineMicBtn, { transform: [{ scale: micScaleAnim }] }]}>
                    <TouchableOpacity onPress={handleMicPress} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <MaterialIcons name="mic" size={20} color={isRecording ? '#EF4444' : 'rgba(168,85,247,0.85)'} />
                    </TouchableOpacity>
                  </Animated.View>
                )}
              </View>

              {/* Right: camera OR send */}
              {messageText.trim().length === 0 ? (
                <TouchableOpacity
                  style={styles.inputIconBtn}
                  onPress={handleTakePhoto}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <MaterialIcons name="photo-camera" size={24} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.sendButton, isSendDisabled && styles.sendButtonDisabled]}
                  onPress={handleSendMessage}
                  disabled={isSendDisabled}
                  activeOpacity={0.7}>
                  {sending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <MaterialIcons name="send" size={20} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Modals */}
      {/* Attachment Options Modal */}
      <Modal
        visible={showAttachmentModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAttachmentModal(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAttachmentModal(false)}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={styles.attachmentModal}>
            <View style={styles.attachmentHeader}>
              <Text style={styles.attachmentTitle}>Attach</Text>
              <TouchableOpacity
                onPress={() => setShowAttachmentModal(false)}
                style={styles.closeButton}>
                <MaterialIcons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.attachmentGrid}>
              {/* Photo */}
              <TouchableOpacity
                style={styles.attachmentOption}
                onPress={handlePickPhoto}
                activeOpacity={0.7}>
                <View style={[styles.attachmentIcon, { backgroundColor: '#3B82F6' }]}>
                  <MaterialIcons name="photo-library" size={28} color="#FFFFFF" />
                </View>
                <Text style={styles.attachmentLabel}>Photo</Text>
              </TouchableOpacity>

              {/* Camera */}
              <TouchableOpacity
                style={styles.attachmentOption}
                onPress={handleTakePhoto}
                activeOpacity={0.7}>
                <View style={[styles.attachmentIcon, { backgroundColor: '#10B981' }]}>
                  <MaterialIcons name="photo-camera" size={28} color="#FFFFFF" />
                </View>
                <Text style={styles.attachmentLabel}>Camera</Text>
              </TouchableOpacity>

              {/* Video */}
              <TouchableOpacity
                style={styles.attachmentOption}
                onPress={handlePickVideo}
                activeOpacity={0.7}>
                <View style={[styles.attachmentIcon, { backgroundColor: '#EF4444' }]}>
                  <MaterialIcons name="videocam" size={28} color="#FFFFFF" />
                </View>
                <Text style={styles.attachmentLabel}>Video</Text>
              </TouchableOpacity>

              {/* Audio */}
              <TouchableOpacity
                style={styles.attachmentOption}
                onPress={handlePickAudio}
                activeOpacity={0.7}>
                <View style={[styles.attachmentIcon, { backgroundColor: '#F97316' }]}>
                  <MaterialIcons name="headphones" size={28} color="#FFFFFF" />
                </View>
                <Text style={styles.attachmentLabel}>Audio</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Audio Recording Modal */}
      <Modal
        visible={showRecordingModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!isRecording) {
            setShowRecordingModal(false);
            cancelRecording();
          }
        }}>
        <View style={styles.recordingModalOverlay}>
          <View style={styles.recordingModal}>
            <View style={styles.recordingHeader}>
              <Text style={styles.recordingTitle}>Record Audio</Text>
              <TouchableOpacity
                onPress={() => {
                  if (!isRecording) {
                    setShowRecordingModal(false);
                    cancelRecording();
                  }
                }}
                style={styles.recordingCloseButton}
                disabled={isRecording}>
                <MaterialIcons name="close" size={24} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>

            <View style={styles.recordingContent}>
              {!recordingUri ? (
                <>
                  {/* Recording Interface */}
                  <View style={styles.recordingVisualizer}>
                    {isRecording ? (
                      <>
                        <View style={styles.recordingIndicator}>
                          <View style={styles.recordingDot} />
                          <Text style={styles.recordingStatusText}>Recording...</Text>
                        </View>
                        <Text style={styles.recordingDurationText}>
                          {formatRecordingDuration(recordingDuration)}
                        </Text>
                      </>
                    ) : (
                      <>
                        <MaterialIcons name="mic" size={64} color="#6B7280" />
                        <Text style={styles.recordingPromptText}>
                          Tap the button below to start recording
                        </Text>
                      </>
                    )}
                  </View>

                  <View style={styles.recordingControls}>
                    {!isRecording ? (
                      <TouchableOpacity
                        style={styles.recordButton}
                        onPress={startRecording}
                        activeOpacity={0.8}>
                        <MaterialIcons name="fiber-manual-record" size={48} color="#EF4444" />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.stopButton}
                        onPress={stopRecording}
                        activeOpacity={0.8}>
                        <MaterialIcons name="stop" size={48} color="#FFFFFF" />
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              ) : (
                <>
                  {/* Playback Interface */}
                  <View style={styles.playbackContainer}>
                    <MaterialIcons name="audiotrack" size={64} color="#10B981" />
                    <Text style={styles.playbackText}>Recording Complete</Text>
                    <Text style={styles.playbackDuration}>
                      Duration: {formatRecordingDuration(recordingDuration)}
                    </Text>
                  </View>

                  <View style={styles.playbackControls}>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => {
                        cancelRecording();
                        setShowRecordingModal(false);
                      }}
                      activeOpacity={0.8}>
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.recordingSendButton}
                      onPress={sendRecordedAudio}
                      disabled={sending}
                      activeOpacity={0.8}>
                      {sending ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <MaterialIcons name="send" size={20} color="#FFFFFF" />
                          <Text style={styles.recordingSendButtonText}>Send</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Menu Modal */}
      <Modal
        visible={showMenuModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenuModal(false)}>
        <TouchableOpacity
          style={styles.menuModalOverlay}
          activeOpacity={1}
          onPress={() => setShowMenuModal(false)}>
          <View style={styles.menuModal}>
            <TouchableOpacity
              style={styles.menuOption}
              onPress={() => {
                setShowMenuModal(false);
                setShowDidYouMeetModal(true);
              }}
              activeOpacity={0.7}>
              <Text style={styles.menuOptionText}>Did you meet?</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.menuOption}
              onPress={() => {
                setShowMenuModal(false);
                setShowUnmatchModal(true);
              }}
              activeOpacity={0.7}>
              <Text style={styles.menuOptionText}>Unmatch</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.menuOption}
              onPress={() => {
                setShowMenuModal(false);
                // Reset report states when starting new report
                setReportSaved(false);
                setSelectedReportCategory('');
                setSelectedReportSubcategory('');
                setReportDetails('');
                setShowReportModal(true);
              }}
              activeOpacity={0.7}>
              <Text style={[styles.menuOptionText, styles.menuOptionTextDanger]}>Report</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Did You Meet Modal */}
      <Modal
        visible={showDidYouMeetModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDidYouMeetModal(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDidYouMeetModal(false)}>
          <View style={styles.didYouMeetModal}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowDidYouMeetModal(false)}
              activeOpacity={0.7}>
              <MaterialIcons name="close" size={24} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
            <Text style={styles.didYouMeetTitle}>
              Did you and {user?.name} meet?
            </Text>
            <Text style={styles.didYouMeetSubtitle}>
              We'll never share your answer. It just helps us learn more about the best people to show you.
            </Text>
            <TouchableOpacity
              style={styles.didYouMeetButton}
              onPress={() => {
                setShowDidYouMeetModal(false);
                setShowSeeAgainModal(true);
              }}
              activeOpacity={0.8}>
              <Text style={styles.didYouMeetButtonText}>Yes, we met</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.didYouMeetButtonSecondary}
              onPress={() => {
                setShowDidYouMeetModal(false);
              }}
              activeOpacity={0.8}>
              <Text style={styles.didYouMeetButtonTextSecondary}>No, we didn't meet</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* See Again Modal */}
      <Modal
        visible={showSeeAgainModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSeeAgainModal(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSeeAgainModal(false)}>
          <View style={styles.seeAgainModal}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowSeeAgainModal(false)}
              activeOpacity={0.7}>
              <MaterialIcons name="close" size={24} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalBackButton}
              onPress={() => {
                setShowSeeAgainModal(false);
                setShowDidYouMeetModal(true);
              }}
              activeOpacity={0.7}>
              <MaterialIcons name="arrow-back" size={24} color="#1B1528" />
            </TouchableOpacity>
            <Text style={styles.seeAgainTitle}>
              Is {user?.name} the kind of person you'd like to see again?
            </Text>
            <Text style={styles.seeAgainSubtitle}>
              We'll keep this answer private, too.
            </Text>
            <TouchableOpacity
              style={styles.seeAgainButton}
              onPress={() => {
                setShowSeeAgainModal(false);
                setShowThanksModal(true);
              }}
              activeOpacity={0.8}>
              <Text style={styles.seeAgainButtonText}>Yes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.seeAgainButtonSecondary}
              onPress={() => {
                setShowSeeAgainModal(false);
                setShowThanksModal(true);
              }}
              activeOpacity={0.8}>
              <Text style={styles.seeAgainButtonTextSecondary}>No</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Thanks Modal */}
      <Modal
        visible={showThanksModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowThanksModal(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowThanksModal(false)}>
          <View style={styles.thanksModal}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowThanksModal(false)}
              activeOpacity={0.7}>
              <MaterialIcons name="close" size={24} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
            <View style={styles.thanksIllustration}>
              <Text style={styles.thanksHeart}>🤝</Text>
            </View>
            <Text style={styles.thanksTitle}>Thanks for sharing!</Text>
            <Text style={styles.thanksSubtitle}>
              We love to hear that! Your answers help us find more great people for you to date.
            </Text>
            <TouchableOpacity
              style={styles.thanksButton}
              onPress={() => setShowThanksModal(false)}
              activeOpacity={0.8}>
              <Text style={styles.thanksButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Unmatch Modal */}
      <Modal
        visible={showUnmatchModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowUnmatchModal(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowUnmatchModal(false)}>
          <View style={styles.unmatchModal}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowUnmatchModal(false)}
              activeOpacity={0.7}>
              <MaterialIcons name="close" size={24} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
            <View style={styles.unmatchCheckmark}>
              <MaterialIcons name="check-circle" size={48} color="#10B981" />
            </View>
            <Text style={styles.unmatchTitle}>You've unmatched {user?.name}</Text>
            <Text style={styles.unmatchSubtitle}>
              Could you tell us why? Your reason will help us show you the right people. They won't know why you've unmatched.
            </Text>
            <View style={styles.unmatchReasonsList}>
              {[
                "We've moved off the app",
                "Different relationship goals",
                "They didn't reply",
                "They made me feel uncomfortable",
                "Something else"
              ].map((reason, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.unmatchReasonOption}
                  onPress={() => {
                    setSelectedUnmatchReason(reason);
                    setShowUnmatchModal(false);
                    setShowUnmatchReasonModal(true);
                  }}
                  activeOpacity={0.7}>
                  <Text style={styles.unmatchReasonText}>{reason}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Unmatch Reason Confirmation Modal */}
      <Modal
        visible={showUnmatchReasonModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUnmatchReasonModal(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowUnmatchReasonModal(false)}>
          <View style={styles.unmatchReasonModal}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowUnmatchReasonModal(false)}
              activeOpacity={0.7}>
              <MaterialIcons name="close" size={24} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
            <View style={styles.thanksIllustration}>
              <Text style={styles.thanksHeart}>🤝</Text>
            </View>
            <Text style={styles.thanksTitle}>Thanks for sharing!</Text>
            <Text style={styles.thanksSubtitle}>
              We love to hear that! Your answers help us find more great people for you to date.
            </Text>
            <TouchableOpacity
              style={styles.thanksButton}
              onPress={async () => {
                setShowUnmatchReasonModal(false);
                // Delete match and messages when unmatching
                await handleUnmatchAndDelete();
              }}
              activeOpacity={0.8}>
              <Text style={styles.thanksButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Report Modal - First Screen */}
      <Modal
        visible={showReportModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReportModal(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowReportModal(false)}>
          <View style={styles.reportModal}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowReportModal(false)}
              activeOpacity={0.7}>
              <MaterialIcons name="close" size={24} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
            <Text style={styles.reportTitle}>Report {user?.name}</Text>
            <Text style={styles.reportDescription}>
              Let us know when someone's broken our guidelines. They won't know that you've reported them, or why.
            </Text>

            <View style={styles.reportStepsContainer}>
              <View style={styles.reportStep}>
                <View style={styles.reportStepNumber}>
                  <Text style={styles.reportStepNumberText}>1</Text>
                </View>
                <Text style={styles.reportStepText}>Let us know what happened</Text>
              </View>
              <View style={styles.reportStep}>
                <View style={styles.reportStepNumber}>
                  <Text style={styles.reportStepNumberText}>2</Text>
                </View>
                <Text style={styles.reportStepText}>We'll investigate your report</Text>
              </View>
              <View style={styles.reportStep}>
                <View style={styles.reportStepNumber}>
                  <Text style={styles.reportStepNumberText}>3</Text>
                </View>
                <Text style={styles.reportStepText}>We'll keep you updated</Text>
              </View>
            </View>

            <View style={styles.unmatchSuggestion}>
              <MaterialIcons name="close" size={16} color="#6B7280" />
              <Text style={styles.unmatchSuggestionText}>
                Don't think they've broken our guidelines? Unmatch instead
              </Text>
            </View>

            <TouchableOpacity
              style={styles.reportStartButton}
              onPress={() => {
                setShowReportModal(false);
                setShowReportCategoryModal(true);
              }}
              activeOpacity={0.8}>
              <Text style={styles.reportStartButtonText}>Start report</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.reportUnmatchButton}
              onPress={() => {
                setShowReportModal(false);
                setShowUnmatchModal(true);
              }}
              activeOpacity={0.8}>
              <Text style={styles.reportUnmatchButtonText}>Unmatch instead</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Report Category Modal - Second Screen */}
      <Modal
        visible={showReportCategoryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReportCategoryModal(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowReportCategoryModal(false)}>
          <View style={styles.reportCategoryModal}>
            <TouchableOpacity
              style={styles.modalBackButton}
              onPress={() => {
                setShowReportCategoryModal(false);
                setShowReportModal(true);
              }}
              activeOpacity={0.7}>
              <MaterialIcons name="arrow-back" size={24} color="#1B1528" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowReportCategoryModal(false)}
              activeOpacity={0.7}>
              <MaterialIcons name="close" size={24} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
            <Text style={styles.reportCategoryTitle}>What do you want to report?</Text>
            <Text style={styles.reportCategorySubtitle}>
              We'll keep this private, and they won't know you've reported them. This helps us keep AstroDate safe.
            </Text>

            <View style={styles.reportCategoryList}>
              {[
                "Something on their profile",
                "Behavior on AstroDate",
                "They shouldn't be on AstroDate"
              ].map((category, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.reportCategoryOption}
                  onPress={() => {
                    setSelectedReportCategory(category);
                    setShowReportCategoryModal(false);
                    setShowReportSubcategoryModal(true);
                  }}
                  activeOpacity={0.7}>
                  <Text style={styles.reportCategoryOptionText}>{category}</Text>
                  <MaterialIcons name="chevron-right" size={24} color="#6B7280" />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Report Subcategory Modal - Third Screen */}
      <Modal
        visible={showReportSubcategoryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReportSubcategoryModal(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowReportSubcategoryModal(false)}>
          <View style={styles.reportSubcategoryModal}>
            <TouchableOpacity
              style={styles.modalBackButton}
              onPress={() => {
                setShowReportSubcategoryModal(false);
                setShowReportCategoryModal(true);
              }}
              activeOpacity={0.7}>
              <MaterialIcons name="arrow-back" size={24} color="#1B1528" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowReportSubcategoryModal(false)}
              activeOpacity={0.7}>
              <MaterialIcons name="close" size={24} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
            <Text style={styles.reportSubcategoryTitle}>{selectedReportCategory}</Text>

            <View style={styles.reportSubcategoryList}>
              {getSubcategoriesForCategory(selectedReportCategory).map((subcategory, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.reportSubcategoryOption}
                  onPress={async () => {
                    setSelectedReportSubcategory(subcategory);
                    setShowReportSubcategoryModal(false);
                    // Show describe page logic:
                    // - "Something on their profile": Always show describe page for all subcategories
                    // - "Behavior on AstroDate": Only show describe page for "Other" subcategory
                    // - "They shouldn't be on AstroDate": Only show describe page for "Other" subcategory
                    if (selectedReportCategory === "Something on their profile") {
                      // Always show describe page for "Something on their profile"
                      setShowReportDetailsModal(true);
                    } else if (selectedReportCategory === "Behavior on AstroDate") {
                      // Only show describe page if "Other" is selected
                      if (subcategory === "Other") {
                        setShowReportDetailsModal(true);
                      } else {
                        // For other subcategories, save report and go directly to confirmation
                        if (chatId && !reportSaved) {
                          const reportResult = await createReport(chatId, selectedReportCategory, subcategory, undefined, channelId);
                          if (reportResult.success) {
                            setReportSaved(true);
                          } else {
                            console.error('❌ Failed to save report:', reportResult.error);
                            showAlert('Error', 'Failed to save report. Please try again.');
                            return;
                          }
                        }
                        setTimeout(() => {
                          setShowReportConfirmationModal(true);
                        }, 300);
                      }
                    } else if (selectedReportCategory === "They shouldn't be on AstroDate") {
                      // Only show describe page if "Other" is selected
                      if (subcategory === "Other") {
                        setShowReportDetailsModal(true);
                      } else {
                        // For other subcategories, save report and go directly to confirmation
                        if (chatId && !reportSaved) {
                          const reportResult = await createReport(chatId, selectedReportCategory, subcategory, undefined, channelId);
                          if (reportResult.success) {
                            setReportSaved(true);
                          } else {
                            console.error('❌ Failed to save report:', reportResult.error);
                            showAlert('Error', 'Failed to save report. Please try again.');
                            return;
                          }
                        }
                        setTimeout(() => {
                          setShowReportConfirmationModal(true);
                        }, 300);
                      }
                    }
                  }}
                  activeOpacity={0.7}>
                  <Text style={styles.reportSubcategoryOptionText}>{subcategory}</Text>
                  <MaterialIcons name="chevron-right" size={24} color="#6B7280" />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Report Details Modal - Fourth Screen (Intermediate) */}
      <Modal
        visible={showReportDetailsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReportDetailsModal(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowReportDetailsModal(false)}>
          <View style={styles.reportDetailsModal}>
            <TouchableOpacity
              style={styles.modalBackButton}
              onPress={() => {
                setShowReportDetailsModal(false);
                setShowReportSubcategoryModal(true);
              }}
              activeOpacity={0.7}>
              <MaterialIcons name="arrow-back" size={24} color="#1B1528" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowReportDetailsModal(false)}
              activeOpacity={0.7}>
              <MaterialIcons name="close" size={24} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
            <Text style={styles.reportDetailsTitle}>
              Tell us more about {selectedReportSubcategory}
            </Text>
            <Text style={styles.reportDetailsSubtitle}>
              Please provide additional details to help us investigate your report.
            </Text>
            <TextInput
              style={styles.reportDetailsInput}
              placeholder="Describe what happened..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              value={reportDetails}
              onChangeText={setReportDetails}
            />
            <TouchableOpacity
              style={styles.reportSubmitButton}
              onPress={async () => {
                // Save report to database
                if (chatId && selectedReportCategory && selectedReportSubcategory && !reportSaved) {
                  const reportResult = await createReport(
                    chatId,
                    selectedReportCategory,
                    selectedReportSubcategory,
                    reportDetails,
                    channelId
                  );
                  if (reportResult.success) {
                    setReportSaved(true);
                  } else {
                    console.error('❌ Failed to save report:', reportResult.error);
                    showAlert('Error', 'Failed to save report. Please try again.');
                    return;
                  }
                }
                setShowReportDetailsModal(false);
                setTimeout(() => {
                  setShowReportConfirmationModal(true);
                }, 300);
              }}
              activeOpacity={0.8}>
              <Text style={styles.reportSubmitButtonText}>Submit Report</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Report Confirmation Modal - Fifth Screen (Final) */}
      <Modal
        visible={showReportConfirmationModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReportConfirmationModal(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowReportConfirmationModal(false)}>
          <View style={styles.reportConfirmationModal}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowReportConfirmationModal(false)}
              activeOpacity={0.7}>
              <MaterialIcons name="close" size={24} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
            <View style={styles.reportCheckmark}>
              <MaterialIcons name="check-circle" size={64} color="#10B981" />
            </View>
            <Text style={styles.reportConfirmationTitle}>
              You've blocked and reported {user?.name}
            </Text>
            <Text style={styles.reportConfirmationSubtitle}>
              Thanks for helping protect the AstroDate community. You'll receive updates on your report in the Help Hub on your profile page.
            </Text>
            <TouchableOpacity
              style={styles.reportDoneButton}
              onPress={async () => {
                setShowReportConfirmationModal(false);
                // Report should already be saved at this point
                // If for some reason it wasn't saved, try one more time
                if (!reportSaved && chatId && selectedReportCategory && selectedReportSubcategory) {
                  const reportResult = await createReport(
                    chatId,
                    selectedReportCategory,
                    selectedReportSubcategory,
                    reportDetails || undefined,
                    channelId
                  );
                  if (reportResult.success) {
                    setReportSaved(true);
                    // Wait a moment for the report to be saved, then navigate
                    await new Promise(resolve => setTimeout(resolve, 300));
                  } else {
                    console.error('❌ Failed to save report (fallback):', reportResult.error);
                    showAlert('Error', 'Failed to save report. Please try again.');
                    return;
                  }
                } else if (reportSaved) {
                  // Wait a moment to ensure backend has processed the report
                  await new Promise(resolve => setTimeout(resolve, 200));
                }
                // Only remove from frontend, keep in backend for review
                // Chat will be immediately removed from frontend (chats and matches)
                // Messages will remain in backend and NOT be deleted after 5 minutes
                await handleReport();
              }}
              activeOpacity={0.8}>
              <Text style={styles.reportDoneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </ErrorBoundary>
  );
}

// Helper function to get subcategories based on category
function getSubcategoriesForCategory(category: string): string[] {
  switch (category) {
    case "Something on their profile":
      return ["Photos or videos", "Profile text"];
    case "Behavior on AstroDate":
      return ["Inappropriate messages", "Harassment", "Spam", "Other"];
    case "They shouldn't be on AstroDate":
      return ["Underage", "Fake profile", "Scam", "Other"];
    default:
      return [];
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A0B2E',
  },
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
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#1A0B2E',
  },
  headerText: {
    flex: 1,
  },
  headerName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  headerStatus: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    marginTop: 2,
  },
  onlineStatus: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  connectionWarning: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  typingIndicatorContainer: {
    marginTop: 2,
    minHeight: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatTypingIndicatorDots: {
    color: '#A855F7',
    fontSize: 12,
    fontWeight: '500',
    fontStyle: 'italic',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  connectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  moreButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardView: {
    flex: 1,
    backgroundColor: '#130820',
  },
  messagesList: {
    flex: 1,
    backgroundColor: '#1A0B2E',
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1A0B2E',
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  myMessageContainer: {
    justifyContent: 'flex-end',
  },
  theirMessageContainer: {
    justifyContent: 'flex-start',
  },
  messageAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  myMessageBubble: {
    backgroundColor: '#A855F7',
    borderBottomRightRadius: 4,
  },
  theirMessageBubble: {
    backgroundColor: '#31214A',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#FFFFFF',
  },
  theirMessageText: {
    color: '#FFFFFF',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  messageTime: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
  },
  readIndicator: {
    marginLeft: 2,
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
  inputSafeArea: {
    backgroundColor: '#130820',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 9,
    paddingTop: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#130820',
    gap: 6,
  },
  inputIconBtn: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 19,
    marginBottom: 1,
  },
  textInputWrapper: {
    flex: 1,
    position: 'relative',
  },
  textInput: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(45,27,78,0.8)',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingRight: 40,
    paddingVertical: Platform.OS === 'ios' ? 10 : 9,
    color: '#FFFFFF',
    fontSize: 15,
    maxHeight: 120,
    minHeight: 42,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(168,85,247,0.25)',
    lineHeight: 20,
    textAlignVertical: 'top',
  },
  inlineMicBtn: {
    position: 'absolute',
    right: 11,
    bottom: 10,
    width: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#9333EA',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 0,
    shadowColor: '#9333EA',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(50,30,80,0.7)',
    shadowOpacity: 0,
    elevation: 0,
  },
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  attachmentModal: {
    backgroundColor: '#2D1B4E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    maxHeight: '60%',
  },
  attachmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  attachmentTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    justifyContent: 'space-between',
  },
  attachmentOption: {
    width: '22%',
    alignItems: 'center',
    marginBottom: 16,
  },
  attachmentIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  attachmentLabel: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
    textAlign: 'center',
  },
  // Menu Modal Styles
  menuModalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  menuModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 80,
    right: 16,
    minWidth: 220,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  menuOption: {
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  menuOptionText: {
    fontSize: 16,
    color: '#1B1528',
    fontWeight: '500',
  },
  menuOptionTextDanger: {
    color: '#EF4444',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 20,
  },
  // Did You Meet Modal Styles
  didYouMeetModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    marginTop: 'auto',
    maxHeight: '60%',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  modalBackButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  didYouMeetTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1B1528',
    marginTop: 40,
    marginBottom: 12,
  },
  didYouMeetSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 24,
  },
  didYouMeetButton: {
    backgroundColor: '#1B1528',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  didYouMeetButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  didYouMeetButtonSecondary: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#1B1528',
  },
  didYouMeetButtonTextSecondary: {
    color: '#1B1528',
    fontSize: 16,
    fontWeight: '600',
  },
  // See Again Modal Styles
  seeAgainModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    marginTop: 'auto',
    maxHeight: '60%',
  },
  seeAgainTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1B1528',
    marginTop: 40,
    marginBottom: 12,
  },
  seeAgainSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 24,
  },
  seeAgainButton: {
    backgroundColor: '#1B1528',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  seeAgainButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  seeAgainButtonSecondary: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#1B1528',
  },
  seeAgainButtonTextSecondary: {
    color: '#1B1528',
    fontSize: 16,
    fontWeight: '600',
  },
  // Thanks Modal Styles
  thanksModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    marginHorizontal: 20,
    alignItems: 'center',
    maxWidth: '90%',
  },
  thanksIllustration: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  thanksHeart: {
    fontSize: 80,
  },
  thanksTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1B1528',
    marginBottom: 12,
    textAlign: 'center',
  },
  thanksSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  thanksButton: {
    backgroundColor: '#1B1528',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    width: '100%',
  },
  thanksButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Unmatch Modal Styles
  unmatchModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    marginTop: 'auto',
    maxHeight: '80%',
  },
  unmatchCheckmark: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 16,
  },
  unmatchTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1B1528',
    textAlign: 'center',
    marginBottom: 12,
  },
  unmatchSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  unmatchReasonsList: {
    gap: 12,
  },
  unmatchReasonOption: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  unmatchReasonText: {
    fontSize: 16,
    color: '#1B1528',
    fontWeight: '500',
  },
  unmatchReasonModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    marginHorizontal: 20,
    alignItems: 'center',
    maxWidth: '90%',
  },
  // Report Modal Styles
  reportModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    marginTop: 'auto',
    maxHeight: '90%',
  },
  reportTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1B1528',
    marginBottom: 12,
  },
  reportDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 24,
  },
  reportStepsContainer: {
    marginBottom: 24,
    gap: 16,
  },
  reportStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reportStepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1B1528',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportStepNumberText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  reportStepText: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
  },
  unmatchSuggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
  },
  unmatchSuggestionText: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
  },
  reportStartButton: {
    backgroundColor: '#1B1528',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  reportStartButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  reportUnmatchButton: {
    backgroundColor: '#6B7280',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  reportUnmatchButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Report Category Modal Styles
  reportCategoryModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    marginTop: 'auto',
    maxHeight: '90%',
  },
  reportCategoryTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1B1528',
    marginTop: 40,
    marginBottom: 8,
  },
  reportCategorySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 24,
  },
  reportCategoryList: {
    gap: 0,
  },
  reportCategoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  reportCategoryOptionText: {
    fontSize: 16,
    color: '#1B1528',
    fontWeight: '500',
  },
  // Report Subcategory Modal Styles
  reportSubcategoryModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    marginTop: 'auto',
    maxHeight: '90%',
  },
  reportSubcategoryTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1B1528',
    marginTop: 40,
    marginBottom: 24,
  },
  reportSubcategoryList: {
    gap: 0,
  },
  reportSubcategoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  reportSubcategoryOptionText: {
    fontSize: 16,
    color: '#1B1528',
    fontWeight: '500',
  },
  // Report Confirmation Modal Styles
  reportConfirmationModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    marginHorizontal: 20,
    alignItems: 'center',
    maxWidth: '90%',
  },
  reportCheckmark: {
    marginBottom: 20,
  },
  reportConfirmationTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1B1528',
    textAlign: 'center',
    marginBottom: 12,
  },
  reportConfirmationSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  reportDoneButton: {
    backgroundColor: '#1B1528',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 48,
    alignItems: 'center',
    width: '100%',
  },
  reportDoneButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Report Details Modal Styles
  reportDetailsModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    marginTop: 'auto',
    maxHeight: '90%',
  },
  reportDetailsTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1B1528',
    marginTop: 40,
    marginBottom: 8,
  },
  reportDetailsSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 20,
  },
  reportDetailsInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1B1528',
    minHeight: 120,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  reportSubmitButton: {
    backgroundColor: '#1B1528',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  reportSubmitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Audio Recording Modal Styles
  // Instagram-style recording bar (inline, above input)
  igRecordingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E0F35',
    borderTopWidth: 1,
    borderTopColor: 'rgba(124,58,237,0.25)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  igCancelBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  igWaveformRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    overflow: 'hidden',
  },
  igRecDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginRight: 4,
  },
  igRecDuration: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EDE8FF',
    marginRight: 6,
    minWidth: 36,
  },
  igWaveBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: '#A855F7',
  },
  igReadyText: {
    fontSize: 13,
    color: 'rgba(168,85,247,0.8)',
    fontWeight: '500',
    marginLeft: 4,
  },
  igStopBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  igSendAudioBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Legacy modal (kept for attachment modal audio path)
  recordingModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  recordingModal: {
    backgroundColor: '#1E0F35',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    maxHeight: '70%',
    borderTopWidth: 1,
    borderColor: 'rgba(124,58,237,0.3)',
  },
  recordingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  recordingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#EDE8FF',
  },
  recordingCloseButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingContent: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  recordingVisualizer: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 160,
    width: '100%',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
    marginRight: 8,
  },
  recordingStatusText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#EF4444',
  },
  recordingDurationText: {
    fontSize: 44,
    fontWeight: '700',
    color: '#EDE8FF',
    marginTop: 8,
  },
  recordingPromptText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 12,
    textAlign: 'center',
  },
  recordingControls: {
    marginTop: 28,
    alignItems: 'center',
  },
  recordButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(239,68,68,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(239,68,68,0.4)',
  },
  stopButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playbackContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
    width: '100%',
  },
  playbackText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#EDE8FF',
    marginTop: 16,
  },
  playbackDuration: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
  },
  playbackControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 32,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#1B1528',
    fontSize: 16,
    fontWeight: '600',
  },
  recordingSendButton: {
    flex: 1,
    backgroundColor: '#1B1528',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  recordingSendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
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
});