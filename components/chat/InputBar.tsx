import { sendMessage } from '@/lib/messages';
import { supabase } from '@/lib/supabase';
import { broadcastTypingStatus } from '@/lib/typing-status';
import { useAuthAlert } from '@/lib/auth-alert-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export type InputBarRef = {
  setText: (text: string) => void;
};

type OptimisticMessage = {
  id: string;
  text: string;
  senderId: string;
  timestamp: Date;
  isRead: boolean;
  isOptimistic?: boolean;
};

type InputBarProps = {
  sending: boolean;
  isMatched: boolean | null;
  channelId: string;
  chatId: string;
  currentUserId: string;
  onSendMessage: (text: string) => Promise<void>;
  onTyping: () => void;
  addConfirmedMessage: (msg: OptimisticMessage) => void;
  markMessageFailed: (id: string) => void;
  removeMessage: (id: string) => void;
  bottomInset: number;
};

const InputBar = forwardRef<InputBarRef, InputBarProps>(function InputBar(
  {
    sending,
    isMatched,
    channelId,
    chatId,
    currentUserId,
    onSendMessage,
    onTyping,
    addConfirmedMessage,
    markMessageFailed,
    removeMessage,
    bottomInset,
  },
  ref,
) {
  const [messageText, setMessageText] = useState('');
  const [inputHeight, setInputHeight] = useState(42);
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const [showRecordingModal, setShowRecordingModal] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingCancelled, setRecordingCancelled] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingBarAnim = useRef(new Animated.Value(0)).current;
  const micScaleAnim = useRef(new Animated.Value(1)).current;
  const { showAlert } = useAuthAlert();

  useImperativeHandle(ref, () => ({
    setText: (text: string) => setMessageText(text),
  }));

  useEffect(() => {
    recordingRef.current = recording;
  }, [recording]);

  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
        recordingRef.current = null;
      }
    };
  }, []);

  const requestMediaPermissions = useCallback(async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Permission Required', 'Sorry, we need media library permissions to attach photos and videos.', [{ text: 'OK' }]);
        return false;
      }
    }
    return true;
  }, [showAlert]);

  const requestCameraPermissions = useCallback(async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Permission Required', 'Sorry, we need camera permissions to take photos.', [{ text: 'OK' }]);
        return false;
      }
    }
    return true;
  }, [showAlert]);

  const requestAudioPermissions = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'web') {
      try {
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== 'granted') {
          showAlert('Permission Required', 'Sorry, we need microphone permissions to record audio.', [{ text: 'OK' }]);
          return false;
        }
        return true;
      } catch {
        return false;
      }
    }
    return true;
  }, [showAlert]);

  const uploadMediaAndSend = useCallback(async (
    asset: ImagePicker.ImagePickerAsset,
    type: 'photo' | 'video',
  ) => {
    if (!currentUserId || !chatId || sending || isMatched !== true) return;

    const prefix = type === 'photo' ? '📷 Photo' : '🎬 Video';
    const tempId = `temp-media-${Date.now()}`;
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
      if (!user) throw new Error('User not authenticated');

      const uri = asset.uri;
      const contentType = (asset as any).mimeType || (type === 'photo' ? 'image/jpeg' : 'video/mp4');
      const extFromMime =
        contentType === 'image/jpeg' ? 'jpg'
          : contentType === 'image/png' ? 'png'
          : contentType === 'video/mp4' ? 'mp4'
          : undefined;
      const uriExt = uri.split('.').pop();
      const ext = extFromMime || uriExt || (type === 'photo' ? 'jpg' : 'mp4');
      const fileName = asset.fileName || uri.split('/').pop() || `${type}_${Date.now()}.${ext}`;

      const base64Data = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      const binaryStr = atob(base64Data);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

      const filePath = `${type}/${user.id}/${Date.now()}_${fileName}`;
      const { error: uploadError } = await supabase.storage
        .from('messages')
        .upload(filePath, bytes, { contentType });

      if (uploadError) throw uploadError;

      const publicUrl = supabase.storage.from('messages').getPublicUrl(filePath).data?.publicUrl;
      const result = await sendMessage(chatId, `${prefix}: ${publicUrl}`, channelId);
      if (!result.success) throw new Error(result.error || 'Failed to send media message');

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
    } catch (error) {
      markMessageFailed(tempId);
      showAlert('Error', `Failed to send ${type}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [currentUserId, chatId, channelId, sending, isMatched, addConfirmedMessage, markMessageFailed, removeMessage, showAlert]);

  const handlePickPhoto = useCallback(async () => {
    setShowAttachmentModal(false);
    if (!await requestMediaPermissions()) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.8 });
      if (!result.canceled && result.assets[0]) await uploadMediaAndSend(result.assets[0], 'photo');
    } catch {
      showAlert('Error', 'Failed to pick photo. Please try again.');
    }
  }, [requestMediaPermissions, uploadMediaAndSend, showAlert]);

  const handlePickVideo = useCallback(async () => {
    setShowAttachmentModal(false);
    if (!await requestMediaPermissions()) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], allowsEditing: true, quality: 0.8 });
      if (!result.canceled && result.assets[0]) await uploadMediaAndSend(result.assets[0], 'video');
    } catch {
      showAlert('Error', 'Failed to pick video. Please try again.');
    }
  }, [requestMediaPermissions, uploadMediaAndSend, showAlert]);

  const handleTakePhoto = useCallback(async () => {
    setShowAttachmentModal(false);
    if (!await requestCameraPermissions()) return;
    try {
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 });
      if (!result.canceled && result.assets[0]) await uploadMediaAndSend(result.assets[0], 'photo');
    } catch {
      showAlert('Error', 'Failed to take photo. Please try again.');
    }
  }, [requestCameraPermissions, uploadMediaAndSend, showAlert]);

  const handlePickAudio = useCallback(() => {
    setShowAttachmentModal(false);
    setRecordingUri(null);
    setRecordingDuration(0);
    setShowRecordingModal(true);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      if (!await requestAudioPermissions()) return;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

      const RECORDING_OPTIONS = {
        android: { extension: '.mp4', outputFormat: Audio.AndroidOutputFormat.MPEG_4, audioEncoder: Audio.AndroidAudioEncoder.AAC, sampleRate: 44100, numberOfChannels: 2, bitRate: 128000 },
        ios: { extension: '.mp4', outputFormat: Audio.IOSOutputFormat.MPEG4AAC, audioQuality: Audio.IOSAudioQuality.HIGH, sampleRate: 44100, numberOfChannels: 2, bitRate: 128000, linearPCMBitDepth: 16, linearPCMIsBigEndian: false, linearPCMIsFloat: false },
        web: { mimeType: 'audio/webm', bitsPerSecond: 128000 },
      };

      const { recording: newRecording } = await Audio.Recording.createAsync(RECORDING_OPTIONS);
      newRecording.setOnRecordingStatusUpdate((status) => {
        if (status.isRecording) setRecordingDuration(Math.floor((status.durationMillis || 0) / 1000));
      });
      await newRecording.setProgressUpdateInterval(500);

      recordingRef.current = newRecording;
      setRecording(newRecording);
      setIsRecording(true);
      setRecordingUri(null);
      setRecordingDuration(0);
    } catch {
      showAlert('Error', 'Failed to start recording. Please try again.');
    }
  }, [requestAudioPermissions, showAlert]);

  const stopRecording = useCallback(async () => {
    if (!recording) return;
    try {
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      recordingRef.current = null;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      setRecordingUri(recording.getURI());
      setRecording(null);
    } catch {
      showAlert('Error', 'Failed to stop recording.');
    }
  }, [recording, showAlert]);

  const cancelRecording = useCallback(async () => {
    if (recording) {
      try {
        await recording.stopAndUnloadAsync();
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      } catch {}
    }
    setRecording(null);
    recordingRef.current = null;
    setIsRecording(false);
    setRecordingUri(null);
    setRecordingDuration(0);
  }, [recording]);

  const sendRecordedAudio = useCallback(async () => {
    if (!recordingUri || !currentUserId || !chatId || sending || isMatched !== true) return;

    const tempId = `temp-audio-${Date.now()}`;
    addConfirmedMessage({ id: tempId, text: '🎤 Audio message: uploading…', senderId: currentUserId, timestamp: new Date(), isRead: false, isOptimistic: true });

    try {
      const userResult = await supabase.auth.getUser();
      const user = userResult?.data?.user;
      if (!user) throw new Error('User not authenticated');

      const base64Data = await FileSystem.readAsStringAsync(recordingUri, { encoding: 'base64' });
      const binaryStr = atob(base64Data);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

      const filePath = `audio/${user.id}/${Date.now()}_audio_${Date.now()}.mp4`;
      const { error: uploadError } = await supabase.storage.from('messages').upload(filePath, bytes, { contentType: 'audio/mp4' });
      if (uploadError) throw uploadError;

      const publicUrl = supabase.storage.from('messages').getPublicUrl(filePath).data?.publicUrl;
      const result = await sendMessage(chatId, `🎤 Audio message: ${publicUrl}`, channelId);
      if (!result.success) throw new Error(result.error || 'Failed to send audio message');

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

      setRecordingUri(null);
      setRecordingDuration(0);
      setShowRecordingModal(false);
    } catch (error) {
      markMessageFailed(tempId);
      showAlert('Error', `Failed to send audio: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [recordingUri, currentUserId, chatId, channelId, sending, isMatched, addConfirmedMessage, markMessageFailed, removeMessage, showAlert]);

  const formatRecordingDuration = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const handleMicPress = useCallback(async () => {
    if (isRecording) {
      await stopRecording();
      Animated.spring(micScaleAnim, { toValue: 1, useNativeDriver: true }).start();
    } else {
      setRecordingCancelled(false);
      setRecordingUri(null);
      setRecordingDuration(0);
      if (!await requestAudioPermissions()) return;
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

  const handleSend = useCallback(async () => {
    const text = messageText.trim();
    if (!text || sending || isMatched !== true) return;
    setMessageText('');
    setInputHeight(42);
    broadcastTypingStatus(currentUserId, channelId, false).catch(() => {});
    await onSendMessage(text);
  }, [messageText, sending, isMatched, currentUserId, channelId, onSendMessage]);

  const handleTextChange = useCallback((text: string) => {
    setMessageText(text);
    onTyping();
  }, [onTyping]);

  const isSendDisabled = !messageText.trim() || sending || isMatched !== true;

  return (
    <>
      {/* Instagram-style recording bar */}
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
              <TouchableOpacity onPress={handleCancelRecording} style={styles.igCancelBtn} activeOpacity={0.7}>
                <MaterialIcons name="delete-outline" size={22} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
              <View style={styles.igWaveformRow}>
                <View style={styles.igRecDot} />
                <Text style={styles.igRecDuration}>{formatRecordingDuration(recordingDuration)}</Text>
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
              <TouchableOpacity onPress={handleCancelRecording} style={styles.igCancelBtn} activeOpacity={0.7}>
                <MaterialIcons name="delete-outline" size={22} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
              <View style={styles.igWaveformRow}>
                <MaterialIcons name="audiotrack" size={16} color="rgba(168,85,247,0.8)" />
                <Text style={styles.igRecDuration}>{formatRecordingDuration(recordingDuration)}</Text>
                <Text style={styles.igReadyText}>Ready to send</Text>
              </View>
              <TouchableOpacity onPress={handleSendRecording} style={styles.igSendAudioBtn} disabled={sending} activeOpacity={0.8}>
                {sending ? <ActivityIndicator size="small" color="#fff" /> : <MaterialIcons name="send" size={18} color="#fff" />}
              </TouchableOpacity>
            </>
          )}
        </Animated.View>
      )}

      {/* Input area */}
      <View style={[styles.inputSafeArea, { paddingBottom: bottomInset }]}>
        <View style={styles.inputContainer}>
          <TouchableOpacity
            style={styles.inputIconBtn}
            onPress={() => setShowAttachmentModal(true)}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialIcons name="add-circle-outline" size={26} color="rgba(168,85,247,0.8)" />
          </TouchableOpacity>

          <View style={styles.textInputWrapper}>
            <TextInput
              style={[styles.textInput, { height: inputHeight }]}
              placeholder="Type a message..."
              placeholderTextColor="rgba(255, 255, 255, 0.35)"
              value={messageText}
              onChangeText={handleTextChange}
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
              onPress={handleSend}
              disabled={isSendDisabled}
              activeOpacity={0.7}>
              {sending
                ? <ActivityIndicator size="small" color="#FFFFFF" />
                : <MaterialIcons name="send" size={20} color="#FFFFFF" />}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Attachment modal */}
      <Modal visible={showAttachmentModal} transparent animationType="slide" onRequestClose={() => setShowAttachmentModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowAttachmentModal(false)}>
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()} style={styles.attachmentModal}>
            <View style={styles.attachmentHeader}>
              <Text style={styles.attachmentTitle}>Attach</Text>
              <TouchableOpacity onPress={() => setShowAttachmentModal(false)} style={styles.closeButton}>
                <MaterialIcons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <View style={styles.attachmentGrid}>
              <TouchableOpacity style={styles.attachmentOption} onPress={handlePickPhoto} activeOpacity={0.7}>
                <View style={[styles.attachmentIcon, { backgroundColor: '#3B82F6' }]}>
                  <MaterialIcons name="photo-library" size={28} color="#FFFFFF" />
                </View>
                <Text style={styles.attachmentLabel}>Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.attachmentOption} onPress={handleTakePhoto} activeOpacity={0.7}>
                <View style={[styles.attachmentIcon, { backgroundColor: '#10B981' }]}>
                  <MaterialIcons name="photo-camera" size={28} color="#FFFFFF" />
                </View>
                <Text style={styles.attachmentLabel}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.attachmentOption} onPress={handlePickVideo} activeOpacity={0.7}>
                <View style={[styles.attachmentIcon, { backgroundColor: '#EF4444' }]}>
                  <MaterialIcons name="videocam" size={28} color="#FFFFFF" />
                </View>
                <Text style={styles.attachmentLabel}>Video</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.attachmentOption} onPress={handlePickAudio} activeOpacity={0.7}>
                <View style={[styles.attachmentIcon, { backgroundColor: '#F97316' }]}>
                  <MaterialIcons name="headphones" size={28} color="#FFFFFF" />
                </View>
                <Text style={styles.attachmentLabel}>Audio</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Audio recording modal */}
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
                  <View style={styles.recordingVisualizer}>
                    {isRecording ? (
                      <>
                        <View style={styles.recordingIndicator}>
                          <View style={styles.recordingDot} />
                          <Text style={styles.recordingStatusText}>Recording...</Text>
                        </View>
                        <Text style={styles.recordingDurationText}>{formatRecordingDuration(recordingDuration)}</Text>
                      </>
                    ) : (
                      <>
                        <MaterialIcons name="mic" size={64} color="#6B7280" />
                        <Text style={styles.recordingPromptText}>Tap the button below to start recording</Text>
                      </>
                    )}
                  </View>
                  <View style={styles.recordingControls}>
                    {!isRecording ? (
                      <TouchableOpacity style={styles.recordButton} onPress={startRecording} activeOpacity={0.8}>
                        <MaterialIcons name="fiber-manual-record" size={48} color="#EF4444" />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity style={styles.stopButton} onPress={stopRecording} activeOpacity={0.8}>
                        <MaterialIcons name="stop" size={48} color="#FFFFFF" />
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.playbackContainer}>
                    <MaterialIcons name="audiotrack" size={64} color="#10B981" />
                    <Text style={styles.playbackText}>Recording Complete</Text>
                    <Text style={styles.playbackDuration}>Duration: {formatRecordingDuration(recordingDuration)}</Text>
                  </View>
                  <View style={styles.playbackControls}>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => { cancelRecording(); setShowRecordingModal(false); }}
                      activeOpacity={0.8}>
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.recordingSendButton} onPress={sendRecordedAudio} disabled={sending} activeOpacity={0.8}>
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
    </>
  );
});

export default InputBar;

const styles = StyleSheet.create({
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
  // Instagram recording bar
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
  // Modals
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
});
