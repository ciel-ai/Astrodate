import { Audio, ResizeMode, Video } from 'expo-av';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MessageTimestamp } from './MessageTimestamp';

const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;

// ─── Media detection ─────────────────────────────────────────────────────────
function parseMediaMessage(text: string): { type: 'photo' | 'video' | 'audio' | 'text'; url: string } {
  if (text.startsWith('📷 Photo: http') || text.startsWith('📷 Photo: uploading'))
    return { type: 'photo', url: text.replace('📷 Photo: ', '') };
  if (text.startsWith('🎬 Video: http') || text.startsWith('🎬 Video: uploading'))
    return { type: 'video', url: text.replace('🎬 Video: ', '') };
  if (text.startsWith('🎤 Audio message: http') || text.startsWith('🎤 Audio message: uploading'))
    return { type: 'audio', url: text.replace('🎤 Audio message: ', '') };
  return { type: 'text', url: '' };
}

// ─── Fullscreen Photo ─────────────────────────────────────────────────────────
function FullscreenPhoto({ url, visible, onClose }: { url: string; visible: boolean; onClose: () => void }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: visible ? 1 : 0, duration: 220, useNativeDriver: true }).start();
  }, [visible]);
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[fsStyles.backdrop, { opacity: fadeAnim }]}>
        <SafeAreaView style={fsStyles.safe}>
          <TouchableOpacity style={fsStyles.closeBtn} onPress={onClose}>
            <Text style={fsStyles.closeX}>✕</Text>
          </TouchableOpacity>
          <Pressable style={fsStyles.imagePressable} onPress={onClose}>
            <Image source={{ uri: url }} style={fsStyles.fullImage} resizeMode="contain" />
          </Pressable>
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}

// ─── Fullscreen Video ─────────────────────────────────────────────────────────
function FullscreenVideo({ url, visible, onClose }: { url: string; visible: boolean; onClose: () => void }) {
  const videoRef = useRef<Video>(null);
  useEffect(() => { if (!visible) videoRef.current?.pauseAsync().catch(() => {}); }, [visible]);
  return (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={fsStyles.videoContainer}>
        <StatusBar hidden />
        <Video ref={videoRef} source={{ uri: url }} style={fsStyles.fullVideo}
          resizeMode={ResizeMode.CONTAIN} useNativeControls shouldPlay isLooping={false} />
        <TouchableOpacity style={fsStyles.videoCloseBtn} onPress={onClose}>
          <Text style={fsStyles.closeX}>✕</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const fsStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)', justifyContent: 'center', alignItems: 'center' },
  safe: { flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' },
  imagePressable: { width: SCREEN_W, height: SCREEN_H * 0.8, justifyContent: 'center', alignItems: 'center' },
  closeBtn: {
    position: 'absolute', top: Platform.OS === 'ios' ? 54 : 20, right: 16, zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 20,
    width: 36, height: 36, justifyContent: 'center', alignItems: 'center',
  },
  closeX: { color: '#fff', fontSize: 15, fontWeight: '700' },
  fullImage: { width: SCREEN_W, height: SCREEN_H * 0.78 },
  videoContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  fullVideo: { width: SCREEN_W, height: SCREEN_H },
  videoCloseBtn: {
    position: 'absolute', top: Platform.OS === 'ios' ? 54 : 32, right: 16, zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 20,
    width: 36, height: 36, justifyContent: 'center', alignItems: 'center',
  },
});

// ─── Photo Bubble ─────────────────────────────────────────────────────────────
function PhotoBubble({ url }: { url: string }) {
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const onPress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start(() => setOpen(true));
  };

  return (
    <>
      <TouchableOpacity onPress={onPress} activeOpacity={1}>
        <Animated.View style={[thumbStyles.container, { transform: [{ scale: scaleAnim }] }]}>
          {!loaded && (
            <View style={thumbStyles.placeholder}>
              <ActivityIndicator color="#A855F7" size="small" />
            </View>
          )}
          <Image source={{ uri: url }} style={thumbStyles.image} resizeMode="cover" onLoad={() => setLoaded(true)} />
          {loaded && (
            <View style={thumbStyles.photoOverlay}>
              <Text style={thumbStyles.expandIcon}>⛶</Text>
            </View>
          )}
        </Animated.View>
      </TouchableOpacity>
      <FullscreenPhoto url={url} visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

// ─── Video Bubble ─────────────────────────────────────────────────────────────
function VideoBubble({ url }: { url: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TouchableOpacity onPress={() => setOpen(true)} activeOpacity={0.88}>
        <View style={thumbStyles.container}>
          <Video source={{ uri: url }} style={thumbStyles.image} resizeMode={ResizeMode.COVER}
            shouldPlay={false} isMuted positionMillis={500} />
          <View style={thumbStyles.playOverlay}>
            <View style={thumbStyles.playCircle}>
              <Text style={thumbStyles.playIcon}>▶</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
      <FullscreenVideo url={url} visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const thumbStyles = StyleSheet.create({
  container: { width: 220, height: 220, borderRadius: 16, overflow: 'hidden', backgroundColor: '#1a0a2e' },
  placeholder: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  image: { width: 220, height: 220 },
  photoOverlay: { position: 'absolute', top: 7, right: 7, backgroundColor: 'rgba(0,0,0,0.38)', borderRadius: 8, padding: 4 },
  expandIcon: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  playOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.28)' },
  playCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)', justifyContent: 'center', alignItems: 'center' },
  playIcon: { color: '#fff', fontSize: 20, marginLeft: 3 },
});

// ─── Audio Player ─────────────────────────────────────────────────────────────
function AudioPlayer({ url, isMyMessage }: { url: string; isMyMessage: boolean }) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const playScaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => () => { soundRef.current?.unloadAsync().catch(() => {}); }, []);

  const animatePlayBtn = () => {
    Animated.sequence([
      Animated.timing(playScaleAnim, { toValue: 0.88, duration: 80, useNativeDriver: true }),
      Animated.timing(playScaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
  };

  const togglePlay = useCallback(async () => {
    animatePlayBtn();
    try {
      if (!soundRef.current) {
        setIsLoading(true);
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound } = await Audio.Sound.createAsync({ uri: url }, { shouldPlay: true }, (status) => {
          if (status.isLoaded) {
            setPosition(status.positionMillis || 0);
            setDuration(status.durationMillis || 0);
            if (status.didJustFinish) { setIsPlaying(false); setPosition(0); }
          }
        });
        soundRef.current = sound;
        setIsLoading(false);
        setIsPlaying(true);
      } else if (isPlaying) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
      } else {
        await soundRef.current.playAsync();
        setIsPlaying(true);
      }
    } catch (e) { setIsLoading(false); console.error('Audio playback error:', e); }
  }, [url, isPlaying]);

  const fmt = (ms: number) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const progress = duration > 0 ? position / duration : 0;
  const tint = isMyMessage ? 'rgba(255,255,255,0.9)' : '#C084FC';
  const trackBg = isMyMessage ? 'rgba(255,255,255,0.2)' : 'rgba(168,85,247,0.18)';
  const trackFill = isMyMessage ? 'rgba(255,255,255,0.85)' : '#A855F7';

  return (
    <View style={audioStyles.row}>
      <TouchableOpacity onPress={togglePlay} activeOpacity={1}>
        <Animated.View style={[audioStyles.playBtn, { backgroundColor: isMyMessage ? 'rgba(255,255,255,0.18)' : 'rgba(168,85,247,0.2)', transform: [{ scale: playScaleAnim }] }]}>
          {isLoading
            ? <ActivityIndicator size={16} color={tint} />
            : <Text style={[audioStyles.playIcon, { color: tint }]}>{isPlaying ? '⏸' : '▶'}</Text>}
        </Animated.View>
      </TouchableOpacity>
      <View style={audioStyles.waveArea}>
        <View style={audioStyles.waveRow}>
          {[0.35, 0.6, 0.45, 0.9, 0.55, 0.75, 0.28, 0.85, 0.5, 0.68, 0.38, 0.58, 0.72, 0.45, 0.3].map((h, i) => {
            const filled = (i + 1) / 15 <= progress;
            return <View key={i} style={[audioStyles.waveBar, { height: 4 + h * 20, backgroundColor: filled ? trackFill : trackBg }]} />;
          })}
        </View>
        <Text style={[audioStyles.durationText, { color: isMyMessage ? 'rgba(255,255,255,0.55)' : 'rgba(200,180,255,0.55)' }]}>
          {position > 0 ? fmt(position) : duration > 0 ? fmt(duration) : '0:00'}
        </Text>
      </View>
    </View>
  );
}

const audioStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 190, paddingVertical: 2 },
  playBtn: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  playIcon: { fontSize: 16, marginLeft: 2 },
  waveArea: { flex: 1, gap: 5 },
  waveRow: { flexDirection: 'row', alignItems: 'center', gap: 2.5, height: 28 },
  waveBar: { width: 3, borderRadius: 2 },
  durationText: { fontSize: 10, fontWeight: '500' },
});

// ─── Bubble entrance animation ────────────────────────────────────────────────
function AnimatedBubbleWrapper({ isMyMessage, children }: { isMyMessage: boolean; children: React.ReactNode }) {
  const translateX = useRef(new Animated.Value(isMyMessage ? 30 : -30)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(translateX, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={{ opacity, transform: [{ translateX }] }}>
      {children}
    </Animated.View>
  );
}

// ─── Main bubble ──────────────────────────────────────────────────────────────
interface Message {
  id: string; text: string; senderId: string; timestamp: Date;
  isRead?: boolean; isOptimistic?: boolean; isFailed?: boolean;
}
interface MessageBubbleProps {
  message: Message; currentUserId: string;
  avatar?: { uri: string }; onRetry?: (message: Message) => void;
}

function MessageBubbleComponent({ message, currentUserId, avatar, onRetry }: MessageBubbleProps) {
  const isMyMessage = message.senderId === currentUserId;
  const isOptimistic = message.isOptimistic && !message.isFailed;
  const isFailed = message.isFailed;
  const media = parseMediaMessage(message.text);
  const isUploading = message.text.endsWith('uploading…') || message.text.endsWith('uploading...');
  const isImageBubble = (media.type === 'photo' || media.type === 'video') && !isUploading;

  const renderContent = () => {
    if (isUploading || media.type === 'text') {
      return (
        <Text style={[styles.messageText, isMyMessage ? styles.myMessageText : styles.theirMessageText, isFailed && styles.failedText]}>
          {message.text}
        </Text>
      );
    }
    if (media.type === 'photo') return <PhotoBubble url={media.url} />;
    if (media.type === 'video') return <VideoBubble url={media.url} />;
    if (media.type === 'audio') return <AudioPlayer url={media.url} isMyMessage={isMyMessage} />;
    return null;
  };

  return (
    <AnimatedBubbleWrapper isMyMessage={isMyMessage}>
      <View style={[styles.messageContainer, isMyMessage ? styles.myMessageContainer : styles.theirMessageContainer]}>
        {!isMyMessage && (
          avatar
            ? <Image source={avatar} style={styles.messageAvatar} />
            : <View style={styles.messageAvatarSpacer} />
        )}

        <View style={{ alignItems: isMyMessage ? 'flex-end' : 'flex-start', maxWidth: '78%' }}>
          <TouchableOpacity
            activeOpacity={isFailed ? 0.7 : 1}
            onPress={isFailed && onRetry ? () => onRetry(message) : undefined}
            disabled={!isFailed}>
            <View style={[
              styles.messageBubble,
              isMyMessage ? styles.myMessageBubble : styles.theirMessageBubble,
              isOptimistic && styles.optimisticBubble,
              isFailed && styles.failedBubble,
              isImageBubble && styles.imageBubble,
            ]}>
              {renderContent()}
              <View style={[
                styles.messageFooter,
                isMyMessage ? styles.messageFooterRight : styles.messageFooterLeft,
                isImageBubble && styles.imageFooter,
              ]}>
                {isOptimistic ? (
                  <ActivityIndicator size={10} color="rgba(255,255,255,0.4)" />
                ) : isFailed ? (
                  <Text style={styles.failedLabel}>⚠ Tap to retry</Text>
                ) : (
                  <MessageTimestamp
                    timestamp={message.timestamp}
                    isRead={isMyMessage ? (message.isRead ?? false) : false}
                    showTicks={isMyMessage}
                  />
                )}
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </AnimatedBubbleWrapper>
  );
}

export const MessageBubble = memo(MessageBubbleComponent, (prev, next) =>
  prev.message.id === next.message.id &&
  prev.message.text === next.message.text &&
  prev.message.timestamp.getTime() === next.message.timestamp.getTime() &&
  prev.message.isRead === next.message.isRead &&
  prev.message.isOptimistic === next.message.isOptimistic &&
  prev.message.isFailed === next.message.isFailed &&
  prev.currentUserId === next.currentUserId
);

const styles = StyleSheet.create({
  messageContainer: { flexDirection: 'row', alignItems: 'flex-end' },
  myMessageContainer: { justifyContent: 'flex-end' },
  theirMessageContainer: { justifyContent: 'flex-start' },
  messageAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 8, marginBottom: 2 },
  messageAvatarSpacer: { width: 36, marginRight: 8 },
  messageBubble: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 3, elevation: 2,
  },
  imageBubble: { paddingHorizontal: 0, paddingVertical: 0, overflow: 'hidden', borderRadius: 16 },
  myMessageBubble: { backgroundColor: '#9333EA', borderBottomRightRadius: 4 },
  theirMessageBubble: { backgroundColor: '#2D1B4E', borderBottomLeftRadius: 4 },
  optimisticBubble: { opacity: 0.65 },
  failedBubble: { backgroundColor: '#3D1010', borderWidth: 1, borderColor: 'rgba(239,68,68,0.45)' },
  messageText: { fontSize: 15, lineHeight: 21 },
  myMessageText: { color: '#FFFFFF' },
  theirMessageText: { color: 'rgba(255,255,255,0.92)' },
  failedText: { color: 'rgba(255,200,200,0.9)' },
  messageFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 3 },
  messageFooterRight: { justifyContent: 'flex-end' },
  messageFooterLeft: { justifyContent: 'flex-start' },
  imageFooter: {
    position: 'absolute', bottom: 7, right: 9, marginTop: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2,
  },
  failedLabel: { fontSize: 10, color: '#EF4444', fontWeight: '600' },
});