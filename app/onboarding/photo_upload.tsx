import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector, TouchableOpacity as GHTouchableOpacity } from 'react-native-gesture-handler';
import * as ImagePicker from 'expo-image-picker';
import { router, useNavigation } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  default as ReAnimated,
} from 'react-native-reanimated';
import { useAuthAlert } from '@/lib/auth-alert-context';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { uploadUserPhotos } from '../../lib/user-photos';

const MAX_PHOTOS = 6;
const MIN_PHOTOS = 3;

// Grid layout — kept in sync with styles.photoSlot width/height
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_H_PAD = 20;
const SLOT_GAP = 12;
const GRID_WIDTH = SCREEN_WIDTH - GRID_H_PAD * 2;
const SLOT_WIDTH = (GRID_WIDTH - SLOT_GAP * 2) / 3;
const SLOT_HEIGHT = SLOT_WIDTH * 1.5; // aspect ratio 3 / 4.5

interface Photo {
  uri: string;
  id: string;
  isVerified?: boolean;
  isVerifying?: boolean;
  verificationError?: string;
}

const createPhotoId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

// ─── Draggable photo slot ─────────────────────────────────────────────────────

interface DraggablePhotoSlotProps {
  photo: Photo;
  slotIndex: number;
  isBeingDragged: boolean;
  isHoverTarget: boolean;
  onDragStart: (index: number) => void;
  onDragMove: (absX: number, absY: number) => void;
  onDragEnd: () => void;
  onRemove: (id: string) => void;
}

function DraggablePhotoSlot({
  photo,
  slotIndex,
  isBeingDragged,
  isHoverTarget,
  onDragStart,
  onDragMove,
  onDragEnd,
  onRemove,
}: DraggablePhotoSlotProps) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const sc = useSharedValue(1);

  const panGesture = Gesture.Pan()
    .activateAfterLongPress(350)
    .onBegin(() => {
      sc.value = withSpring(1.08, { damping: 12, stiffness: 200 });
      runOnJS(onDragStart)(slotIndex);
    })
    .onUpdate((e) => {
      tx.value = e.translationX;
      ty.value = e.translationY;
      runOnJS(onDragMove)(e.absoluteX, e.absoluteY);
    })
    .onFinalize(() => {
      tx.value = withSpring(0, { damping: 15 });
      ty.value = withSpring(0, { damping: 15 });
      sc.value = withSpring(1);
      runOnJS(onDragEnd)();
    });

  const animStyle = useAnimatedStyle(() => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: sc.value },
    ] as any,
    zIndex: sc.value > 1.01 ? 999 : 1,
    elevation: sc.value > 1.01 ? 20 : 4,
    shadowRadius: sc.value > 1.01 ? 16 : 8,
    shadowOpacity: sc.value > 1.01 ? 0.45 : 0.15,
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <ReAnimated.View
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        style={[styles.photoSlot, animStyle as any, isBeingDragged && styles.photoSlotDragging, isHoverTarget && !isBeingDragged && styles.photoSlotHoverTarget] as any}
      >
        <Image source={{ uri: photo.uri }} style={styles.photoImage} />

        {/* Remove — quick tap, won't trigger 350 ms long-press drag */}
        <GHTouchableOpacity
          style={styles.removeButton}
          onPress={() => onRemove(photo.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.8}
        >
          <Ionicons name="close" size={16} color="#FFFFFF" />
        </GHTouchableOpacity>

        {slotIndex === 0 && (
          <View style={styles.primaryBadge}>
            <Text style={styles.primaryBadgeText}>Primary</Text>
          </View>
        )}

        {/* Drag handle hint */}
        <View style={styles.dragHandle}>
          <Ionicons name="reorder-three" size={18} color="rgba(255,255,255,0.8)" />
        </View>

        {photo.isVerifying && (
          <View style={styles.verificationOverlay}>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text style={styles.verificationText}>Verifying...</Text>
          </View>
        )}
        {photo.isVerified === false && photo.verificationError && (
          <View style={styles.verificationErrorOverlay}>
            <Ionicons name="alert-circle" size={24} color="#EF4444" />
            <Text style={styles.verificationErrorText} numberOfLines={2}>
              {photo.verificationError}
            </Text>
          </View>
        )}
      </ReAnimated.View>
    </GestureDetector>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PhotoUploadScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [verificationStatus] = useState<{ allVerified: boolean; error?: string }>({ allVerified: false });
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const isMountedRef = useRef(true);
  const { showAlert } = useAuthAlert();

  // ── drag-to-reorder state ──────────────────────────────────────────────────
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [hoverIdx, setHoverIdx]       = useState<number | null>(null);
  // refs so gesture callbacks see current values without stale closures
  const draggingIdxRef = useRef<number | null>(null);
  const hoverIdxRef    = useRef<number | null>(null);
  const gridRef        = useRef<View>(null);
  const gridOrigin     = useRef({ x: 0, y: 0 });

  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
    ]).start();
  }, []);

  // ── drag handlers ──────────────────────────────────────────────────────────

  const handleDragStart = useCallback((index: number) => {
    // Re-measure just before drag so scroll offset is accounted for
    gridRef.current?.measureInWindow((x, y) => { gridOrigin.current = { x, y }; });
    draggingIdxRef.current = index;
    hoverIdxRef.current    = index;
    setDraggingIdx(index);
    setHoverIdx(index);
  }, []);

  const handleDragMove = useCallback((absX: number, absY: number) => {
    const relX = absX - gridOrigin.current.x;
    const relY = absY - gridOrigin.current.y;
    let newHover: number | null = null;
    if (relX >= 0 && relY >= 0) {
      const col = Math.max(0, Math.min(2, Math.floor(relX / (SLOT_WIDTH + SLOT_GAP))));
      const row = Math.max(0, Math.min(1, Math.floor(relY / (SLOT_HEIGHT + SLOT_GAP))));
      newHover = row * 3 + col;
    }
    if (newHover !== hoverIdxRef.current) {
      hoverIdxRef.current = newHover;
      setHoverIdx(newHover);
    }
  }, []);

  const handleDragEnd = useCallback(() => {
    const from = draggingIdxRef.current;
    const to   = hoverIdxRef.current;
    draggingIdxRef.current = null;
    hoverIdxRef.current    = null;
    setDraggingIdx(null);
    setHoverIdx(null);
    if (from !== null && to !== null && from !== to) {
      setPhotos(prev => {
        if (from >= prev.length || to >= prev.length) return prev;
        const next = [...prev];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        return next;
      });
    }
  }, []);

  // ── photo picking ──────────────────────────────────────────────────────────

  const requestPermission = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Permission Required', 'Sorry, we need camera roll permissions to upload photos.', [{ text: 'OK' }]);
        return false;
      }
    }
    return true;
  };

  const verifyPhoto = async (_photoUri: string, photoId: string) => {
    setPhotos(prev => prev.map(p =>
      p.id === photoId ? { ...p, isVerifying: false, isVerified: true, verificationError: undefined } : p
    ));
    return true;
  };

  const addPhotoToState = async (uri: string) => {
    const newPhoto: Photo = { uri, id: createPhotoId(), isVerifying: true };
    setPhotos(prev => prev.length >= MAX_PHOTOS ? prev : [...prev, newPhoto]);
    await verifyPhoto(newPhoto.uri, newPhoto.id);
  };

  const selectFromGallery = async () => {
    const hasPermission = await requestPermission();
    if (!hasPermission) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'] as ImagePicker.MediaType[],
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        await addPhotoToState(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      showAlert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const takePhoto = async () => {
    if (photos.length >= MAX_PHOTOS) {
      showAlert('Maximum Photos Reached', `You can only upload up to ${MAX_PHOTOS} photos.`);
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permission Required', 'Sorry, we need camera permissions to take photos.', [{ text: 'OK' }]);
      return;
    }
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        await addPhotoToState(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      showAlert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const pickImage = () => {
    if (photos.length >= MAX_PHOTOS) {
      showAlert('Maximum Photos Reached', `You can only upload up to ${MAX_PHOTOS} photos.`);
      return;
    }
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Take Photo', 'Choose from Gallery'], cancelButtonIndex: 0 },
        (buttonIndex) => {
          if (buttonIndex === 1) takePhoto();
          else if (buttonIndex === 2) selectFromGallery();
        }
      );
    } else {
      showAlert(
        'Add Photo',
        'Choose where to get your photo from',
        [
          { text: 'Take Photo', onPress: () => takePhoto() },
          { text: 'Choose from Gallery', onPress: () => selectFromGallery() },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
    }
  };

  const removePhoto = (id: string) => {
    setPhotos(photos.filter(p => p.id !== id));
  };

  // ── rendering ──────────────────────────────────────────────────────────────

  const areAllPhotosVerified = () =>
    photos.length >= MIN_PHOTOS && photos.every(p => p.isVerified === true && !p.isVerifying);

  const canContinue = () => areAllPhotosVerified();

  const renderPhotoSlot = (index: number) => {
    const photo = photos[index];

    if (photo) {
      return (
        <DraggablePhotoSlot
          key={photo.id}
          photo={photo}
          slotIndex={index}
          isBeingDragged={draggingIdx === index}
          isHoverTarget={hoverIdx === index}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          onRemove={removePhoto}
        />
      );
    }

    // Empty slot
    const allReady = photos.every(p => p.isVerified === true && !p.isVerifying);
    const isEnabled = index === photos.length && allReady && draggingIdx === null;

    return (
      <TouchableOpacity
        key={`empty-${index}`}
        style={[
          styles.photoSlot,
          styles.photoSlotEmpty,
          hoverIdx === index && draggingIdx !== null && styles.photoSlotHoverTarget,
        ]}
        onPress={isEnabled ? pickImage : undefined}
        activeOpacity={isEnabled ? 0.8 : 1}
        disabled={!isEnabled}
      >
        <View style={styles.emptySlotContent}>
          <Ionicons name="add-circle-outline" size={40} color="#A855F7" />
          <Text style={styles.emptySlotText}>
            {index === 0 ? 'Add Primary Photo' : 'Add Photo'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const handleContinue = async () => {
    if (photos.length < MIN_PHOTOS) {
      showAlert('More Photos Needed', `Please add at least ${MIN_PHOTOS} photos to continue.`, [{ text: 'OK' }]);
      return;
    }
    const unverified = photos.filter(p => !p.isVerified);
    if (unverified.length > 0) {
      showAlert('Photo Verification Required', 'Please wait for all photos to be verified.', [{ text: 'OK' }]);
      return;
    }
    setIsUploading(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        showAlert('Authentication Error', 'Please log in to upload photos.', [{ text: 'OK' }]);
        return;
      }
      const photoUris = photos.filter(p => p.isVerified).map(p => p.uri);
      if (photoUris.length === 0) {
        showAlert('No Photos to Upload', 'Please add at least one verified photo.', [{ text: 'OK' }]);
        return;
      }
      const uploadResult = await uploadUserPhotos(photoUris, user.id);
      if (!uploadResult.success) {
        showAlert('Upload Failed', uploadResult.error || 'Failed to upload photos. Please try again.', [{ text: 'OK' }]);
        return;
      }
      router.push('/onboarding/congratulations');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      showAlert('Upload Error', `Failed to upload photos: ${msg}`, [{ text: 'OK' }]);
    } finally {
      if (isMountedRef.current) setIsUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Ionicons name="sparkles" size={18} color="#C084FC" style={styles.sparkleIcon} />
            <Text style={styles.title}>Add Your Photos</Text>
            <Ionicons name="sparkles" size={18} color="#C084FC" style={styles.sparkleIcon} />
          </View>
          <Text style={styles.subtitle}>
            Show your best self! Add at least {MIN_PHOTOS} photos to continue.
          </Text>
          <View style={styles.constraintContainer}>
            <Ionicons name="information-circle" size={18} color="#C084FC" />
            <Text style={styles.constraintText}>All photos must be of the same person (yourself)</Text>
          </View>
          <View style={styles.progressIndicator}>
            <Text style={styles.progressText}>{photos.length} / {MAX_PHOTOS} photos</Text>
            <View style={styles.progressBarContainer}>
              <View
                style={[
                  styles.progressBar,
                  {
                    width: `${(photos.length / MAX_PHOTOS) * 100}%`,
                    backgroundColor: photos.length >= MIN_PHOTOS ? '#10B981' : '#A855F7',
                  },
                ]}
              />
            </View>
          </View>
        </View>

        {/* Photo Grid */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          scrollEnabled={draggingIdx === null}
        >
          <View
            ref={gridRef}
            style={styles.photoGrid}
            onLayout={() => {
              gridRef.current?.measureInWindow((x, y) => {
                gridOrigin.current = { x, y };
              });
            }}
          >
            {/* Render non-dragging slots first so the dragged item renders on top */}
            {Array.from({ length: MAX_PHOTOS }).map((_, index) => {
              if (index === draggingIdx) return null;
              return renderPhotoSlot(index);
            })}
            {draggingIdx !== null && renderPhotoSlot(draggingIdx)}
          </View>

          {photos.length >= 2 && verificationStatus.error && (
            <View style={styles.verificationStatusContainer}>
              <Ionicons name="alert-circle" size={20} color="#EF4444" />
              <Text style={styles.verificationStatusText}>{verificationStatus.error}</Text>
            </View>
          )}
        </ScrollView>

        {/* Bottom Button Container */}
        <View style={[styles.bottomButtonContainer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity
            style={[styles.continueButton, (!canContinue() || isUploading) && styles.continueButtonDisabled]}
            onPress={handleContinue}
            activeOpacity={0.8}
            disabled={!canContinue() || isUploading}
          >
            {isUploading ? (
              <>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.continueButtonText}>Uploading...</Text>
              </>
            ) : (
              <>
                <Text style={styles.continueButtonText}>
                  {canContinue()
                    ? 'Continue'
                    : photos.length < MIN_PHOTOS
                      ? `Add ${MIN_PHOTOS - photos.length} More`
                      : !areAllPhotosVerified()
                        ? 'Verifying Photos...'
                        : 'Continue'}
                </Text>
                {canContinue() && <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />}
              </>
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#04020b' },
  content:   { flex: 1 },
  header: {
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: 'center',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sparkleIcon: {
    marginTop: -4,
  },
  title: {
    color: '#EDE8FF',
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: '#A89BC2',
    fontSize: 17,
    lineHeight: 26,
    marginBottom: 16,
    textAlign: 'center',
    fontWeight: '400',
  },
  constraintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(168,85,247,0.12)',
    borderColor: 'rgba(168,85,247,0.3)',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 20,
    gap: 8,
  },
  constraintText: {
    color: '#C084FC',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
  },
  progressIndicator: { gap: 10, width: '100%' },
  progressText: {
    color: '#EDE8FF',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  progressBarContainer: {
    height: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    overflow: 'hidden',
  },
  progressBar: { height: '100%', borderRadius: 20 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: GRID_H_PAD, paddingBottom: 40, paddingTop: 8 },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: SLOT_GAP,
    marginBottom: 28,
  },
  photoSlot: {
    width: SLOT_WIDTH,
    height: SLOT_HEIGHT,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(168,85,247,0.1)',
    borderWidth: 2.5,
    borderColor: '#A855F7',
    shadowColor: 'rgba(168,85,247,0.3)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  photoSlotEmpty: {
    borderStyle: 'dashed',
    borderColor: 'rgba(168, 85, 247, 0.4)',
    backgroundColor: 'rgba(168, 85, 247, 0.03)',
    borderWidth: 2,
  },
  photoSlotDragging: {
    opacity: 0.72,
  },
  photoSlotHoverTarget: {
    borderColor: '#A855F7',
    borderWidth: 2.5,
    borderStyle: 'solid',
    backgroundColor: 'rgba(168, 85, 247, 0.12)',
  },
  photoImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  emptySlotContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptySlotText: {
    color: '#A89BC2',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(4, 2, 11, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  primaryBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(168, 85, 247, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 8,
  },
  primaryBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  dragHandle: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(4, 2, 11, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    zIndex: 8,
  },
  continueButton: {
    borderRadius: 30,
    backgroundColor: '#A855F7',
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  continueButtonDisabled: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    shadowOpacity: 0,
  },
  bottomButtonContainer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    backgroundColor: '#04020b',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  verificationOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(168,85,247,0.7)',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  verificationText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  verificationErrorOverlay: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(239, 68, 68, 0.95)',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  verificationErrorText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600', flex: 1 },
  verificationStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderColor: 'rgba(239,68,68,0.3)',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  verificationStatusText: {
    color: '#FF6B6B',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    lineHeight: 20,
  },
});
