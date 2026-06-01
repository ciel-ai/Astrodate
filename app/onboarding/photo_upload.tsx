import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useNavigation } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {  ActivityIndicator,
  Animated,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuthAlert } from '@/lib/auth-alert-context';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { uploadUserPhotos } from '../../lib/user-photos';

const MAX_PHOTOS = 6;
const MIN_PHOTOS = 3;

interface Photo {
  uri: string;
  id: string;
  isVerified?: boolean;
  isVerifying?: boolean;
  verificationError?: string;
}

const createPhotoId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export default function PhotoUploadScreen() {
  const navigation = useNavigation();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<{
    allVerified: boolean;
    error?: string;
  }>({ allVerified: false });
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const isMountedRef = useRef(true);
  const { showAlert } = useAuthAlert();

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const requestPermission = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showAlert(
          'Permission Required',
          'Sorry, we need camera roll permissions to upload photos.',
          [{ text: 'OK' }]
        );
        return false;
      }
    }
    return true;
  };

  const pickImage = async () => {
    if (photos.length >= MAX_PHOTOS) {
      showAlert('Maximum Photos Reached', `You can only upload up to ${MAX_PHOTOS} photos.`);
      return;
    }

    // Show action sheet to choose between camera and gallery
    showAlert(
      'Add Photo',
      'Choose where to get your photo from',
      [
        {
          text: 'Take Photo',
          onPress: () => takePhoto(),
        },
        {
          text: 'Choose from Gallery',
          onPress: () => selectFromGallery(),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
    );
  };

  const verifyPhoto = async (photoUri: string, photoId: string) => {
    // Skip verification API and automatically mark as verified
    setPhotos((prevPhotos) =>
      prevPhotos.map((p) =>
        p.id === photoId
          ? { ...p, isVerifying: false, isVerified: true, verificationError: undefined }
          : p
      )
    );
    return true;
  };

  const verifyAllPhotosTogether = async (photosToVerify?: Photo[]) => {
    // Skip verification API
    setVerificationStatus({ allVerified: true });
    setIsVerifying(false);
  };

  const addPhotoToState = async (uri: string) => {
    const newPhoto: Photo = {
      uri,
      id: createPhotoId(),
      isVerifying: true,
    };

    setPhotos((prevPhotos) => {
      if (prevPhotos.length >= MAX_PHOTOS) {
        return prevPhotos;
      }
      return [...prevPhotos, newPhoto];
    });

    await verifyPhoto(newPhoto.uri, newPhoto.id);
  };

  const selectFromGallery = async () => {
    const hasPermission = await requestPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
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
      showAlert(
        'Permission Required',
        'Sorry, we need camera permissions to take photos.',
        [{ text: 'OK' }]
      );
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

  const removePhoto = (id: string) => {
    setPhotos(photos.filter((photo) => photo.id !== id));
  };

  // Check if all photos are verified
  const areAllPhotosVerified = () => {
    if (photos.length < MIN_PHOTOS) return false;
    if (photos.length === 0) return false;
    // All photos must be verified and not currently verifying
    return photos.every((p) => p.isVerified === true && !p.isVerifying);
  };

  // Check if can continue (all photos verified)
  const canContinue = () => {
    return areAllPhotosVerified();
  };

  const handleContinue = async () => {
    if (photos.length < MIN_PHOTOS) {
      showAlert(
        'More Photos Needed',
        `Please add at least ${MIN_PHOTOS} photos to continue.`,
        [{ text: 'OK' }]
      );
      return;
    }

    // Check if all photos are verified (they should be verified during upload)
    const unverifiedPhotos = photos.filter((p) => !p.isVerified);
    if (unverifiedPhotos.length > 0) {
      const errorMessages = unverifiedPhotos
        .map((p) => p.verificationError || 'Verification failed')
        .filter((msg) => msg)
        .join('\n\n');

      showAlert(
        'Photo Verification Required',
        `Some photos are still being verified or failed verification:\n\n${errorMessages}\n\nPlease wait for verification to complete or replace these photos with:\n• Clear photos showing your face\n• Photos with good lighting\n• Photos containing only you (one person)\n• Recent photos that look like you`,
        [
          {
            text: 'OK',
            onPress: () => {
              // User can review and fix photos
            },
          },
        ]
      );
      return;
    }

    // All photos are verified, proceed directly to upload
    setIsUploading(true);
    try {
      // Get current user ID
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error('❌ Could not get current user:', userError);
        showAlert(
          'Authentication Error',
          'Please log in to upload photos.',
          [{ text: 'OK' }]
        );
        setIsUploading(false);
        return;
      }

      // Get URIs of verified photos
      const verifiedPhotos = photos.filter((p) => p.isVerified === true);
      const photoUris = verifiedPhotos.map((p) => p.uri);

      if (photoUris.length === 0) {
        showAlert(
          'No Photos to Upload',
          'Please add at least one verified photo.',
          [{ text: 'OK' }]
        );
        setIsUploading(false);
        return;
      }

      console.log('📤 Uploading photos to Supabase...', {
        userId: user.id,
        photoCount: photoUris.length,
      });

      // Upload photos to Supabase Storage and save metadata
      const uploadResult = await uploadUserPhotos(photoUris, user.id);

      if (!uploadResult.success) {
        console.error('❌ Photo upload failed:', uploadResult.error);
        showAlert(
          'Upload Failed',
          uploadResult.error || 'Failed to upload photos. Please try again.',
          [{ text: 'OK' }]
        );
        setIsUploading(false);
        return;
      }

      console.log('✅ Photos uploaded successfully:', uploadResult.photos?.length);

      // Navigate to congratulations screen
      router.push('/onboarding/congratulations');
    } catch (error) {
      console.error('❌ Exception uploading photos:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      showAlert(
        'Upload Error',
        `Failed to upload photos: ${errorMessage}\n\nPlease try again.`,
        [{ text: 'OK' }]
      );
    } finally {
      if (isMountedRef.current) setIsUploading(false);
    }
  };

  const handleSkip = () => {
    showAlert(
      'Skip Photo Upload?',
      'Adding photos significantly improves your chances of matching. Are you sure you want to skip?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Skip',
          style: 'destructive',
          onPress: () => router.push('/onboarding/congratulations'),
        },
      ]
    );
  };

  const renderPhotoSlot = (index: number) => {
    const photo = photos[index];
    const isEmpty = !photo;

    // Only enable the next slot in sequence after all current photos are verified.
    const allCurrentPhotosReady = photos.every((p) => p.isVerified === true && !p.isVerifying);
    const isEnabled = isEmpty && index === photos.length && allCurrentPhotosReady;

    return (
      <TouchableOpacity
        key={index}
        style={[
          styles.photoSlot,
          isEmpty && styles.photoSlotEmpty,
        ]}
        onPress={isEmpty && isEnabled ? pickImage : undefined}
        activeOpacity={isEmpty && !isEnabled ? 1 : 0.8}
        disabled={isEmpty && !isEnabled}>
        {photo ? (
          <>
            <Image source={{ uri: photo.uri }} style={styles.photoImage} />
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => removePhoto(photo.id)}
              activeOpacity={0.8}>
              <Ionicons name="close-circle" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            {index === 0 && (
              <View style={styles.primaryBadge}>
                <Text style={styles.primaryBadgeText}>Primary</Text>
              </View>
            )}
            {/* Verification Status Indicator */}
            {photo.isVerifying && (
              <View style={styles.verificationOverlay}>
                <ActivityIndicator size="small" color="#4B0082" />
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
          </>
        ) : (
          <View style={styles.emptySlotContent}>
            <Ionicons name="add-circle-outline" size={40} color="#4B0082" />
            <Text style={styles.emptySlotText}>
              {index === 0 ? 'Add Primary Photo' : 'Add Photo'}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Add Your Photos</Text>
          <Text style={styles.subtitle}>
            Show your best self! Add at least {MIN_PHOTOS} photos to continue.
          </Text>

          {/* Constraint Message */}
          <View style={styles.constraintContainer}>
            <Ionicons name="information-circle" size={18} color="#4B0082" />
            <Text style={styles.constraintText}>
              All photos must be of the same person (yourself)
            </Text>
          </View>

          <View style={styles.progressIndicator}>
            <Text style={styles.progressText}>
              {photos.length} / {MAX_PHOTOS} photos
            </Text>
            <View style={styles.progressBarContainer}>
              <View
                style={[
                  styles.progressBar,
                  {
                    width: `${(photos.length / MAX_PHOTOS) * 100}%`,
                    backgroundColor:
                      photos.length >= MIN_PHOTOS ? '#10B981' : '#4B0082',
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
          showsVerticalScrollIndicator={false}>
          <View style={styles.photoGrid}>
            {Array.from({ length: MAX_PHOTOS }).map((_, index) =>
              renderPhotoSlot(index)
            )}
          </View>

          {/* Upload Options - Removed */}

          {/* Verification Status Message */}
          {photos.length >= 2 && verificationStatus.error && (
            <View style={styles.verificationStatusContainer}>
              <Ionicons name="alert-circle" size={20} color="#EF4444" />
              <Text style={styles.verificationStatusText}>
                {verificationStatus.error}
              </Text>
            </View>
          )}

          {/* Continue Button */}
          <TouchableOpacity
            style={[
              styles.continueButton,
              (!canContinue() || isUploading) && styles.continueButtonDisabled,
            ]}
            onPress={handleContinue}
            activeOpacity={0.8}
            disabled={!canContinue() || isUploading}>
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
                {canContinue() && (
                  <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
                )}
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: 'center',
  },
  skipButtonTop: {
    position: 'absolute',
    top: -10,
    right: 34,
    zIndex: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  skipButtonTopText: {
    color: '#6A0DAD',
    fontSize: 17,
    fontWeight: '600',
  },
  title: {
    color: '#1B1528',
    fontSize: 36,
    fontWeight: '800',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: '#6B7280',
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
    backgroundColor: '#F3ECFF',
    borderColor: '#E5E7EB',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 20,
    gap: 8,
  },
  constraintText: {
    color: '#4B0082',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
  },
  progressIndicator: {
    gap: 10,
    width: '100%',
  },
  progressText: {
    color: '#1B1528',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  progressBarContainer: {
    height: 10,
    backgroundColor: '#E5E7EB',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: 'rgba(75, 0, 130, 0.1)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  progressBar: {
    height: '100%',
    borderRadius: 20,
    shadowColor: '#4B0082',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 8,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 28,
  },
  photoSlot: {
    width: '31%',
    aspectRatio: 3 / 4.5,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#F3ECFF',
    borderWidth: 2.5,
    borderColor: '#4B0082',
    shadowColor: 'rgba(75, 0, 130, 0.1)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  photoSlotEmpty: {
    borderStyle: 'dashed',
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
  },
  photoImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  emptySlotContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptySlotText: {
    color: '#6B7280',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  removeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
  },
  primaryBadge: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    backgroundColor: '#4B0082',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: '#4B0082',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
  primaryBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  uploadOptions: {
    gap: 14,
    marginBottom: 28,
  },
  uploadButton: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  uploadButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 14,
  },
  uploadButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  tipsContainer: {
    backgroundColor: '#F3ECFF',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    shadowColor: 'rgba(75, 0, 130, 0.1)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  tipsTitle: {
    color: '#1B1528',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 18,
    letterSpacing: 0.3,
  },
  tipsList: {
    gap: 14,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingVertical: 2,
  },
  tipText: {
    color: '#6B7280',
    fontSize: 15,
    lineHeight: 22,
    flex: 1,
    fontWeight: '500',
  },
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1.5,
    borderTopColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  continueButton: {
    borderRadius: 30,
    backgroundColor: '#4B0082',
    shadowColor: 'rgba(75, 0, 130, 0.1)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
    marginTop: 20,
    marginBottom: 20,
    paddingVertical: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  continueButtonDisabled: {
    backgroundColor: '#E5E7EB',
    shadowOpacity: 0,
  },
  continueButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 10,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  verificationOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(75, 0, 130, 0.7)',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  verificationText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  verificationErrorOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(239, 68, 68, 0.95)',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  verificationErrorText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  verificationStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  verificationStatusText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    lineHeight: 20,
  },
});