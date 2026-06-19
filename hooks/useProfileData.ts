import { getAstroDetails } from '@/lib/astro-details';
import { getSection1Responses, saveSection1Responses } from '@/lib/onboarding-responses';
import { getMembershipOrFree, getPlanCatalog, type MembershipSummary } from '@/lib/subscription';
import { supabase } from '@/lib/supabase';
import { useSubscriptionPayment } from '@/lib/useSubscriptionPayment';
import { deleteUserPhoto, getUserPhotos, setPrimaryPhoto, uploadUserPhotos } from '@/lib/user-photos';
import * as ImagePicker from 'expo-image-picker';
import { getUserProfile, saveUserProfile } from '@/lib/user-profile';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useAuthAlert } from '@/lib/auth-alert-context';

export const initialProfile = {
  name: '',
  age: 0,
  location: '',
  images: [] as any[],
  bio: '',
  sunSign: '',
  moonSign: '',
  interests: [] as string[],
  languages: [] as string[],
  education: '',
  height: '',
  smoking: '',
  drinking: '',
  lookingFor: [] as string[],
  planType: 'Free',
  hobbies: [] as string[],
};

export type ProfileState = typeof initialProfile;

const calculateProfileCompletion = (profile: ProfileState): number => {
  let completedFields = 0;
  const totalFields = 12;

  if (profile.name && profile.name.trim().length > 0) completedFields++;
  if (profile.age && profile.age > 0) completedFields++;
  if (profile.location) completedFields++;
  if (profile.images && profile.images.length > 0) completedFields++;
  if (profile.bio && profile.bio.trim().length > 0) completedFields++;
  if (profile.lookingFor && profile.lookingFor.length > 0) completedFields++;
  if (profile.interests && profile.interests.length > 0) completedFields++;
  if (profile.languages && profile.languages.length > 0) completedFields++;
  if (profile.education) completedFields++;
  if (profile.height) completedFields++;
  if (profile.drinking) completedFields++;
  if (profile.smoking) completedFields++;

  return Math.round((completedFields / totalFields) * 100);
};

export interface ProfileData {
  editedProfile: ProfileState;
  setEditedProfile: React.Dispatch<React.SetStateAction<ProfileState>>;
  profileDbFields: { phone_number: string; email: string; gender?: string | null; gender_detail?: string | null } | null;
  userPhotos: Array<{ id: string; photo_url: string; thumbnail_url?: string; is_primary: boolean; display_order: number }>;
  primaryPhotoUri: string | null;

  profileCompletion: number;

  vedicSign: string;
  gender: string;
  sexualOrientation: string;
  astroMissing: boolean;
  setAstroMissing: (v: boolean) => void;

  showAgeSetting: boolean;
  ageRange: string;
  distance: string;
  newMatchNotifications: boolean;

  membership: MembershipSummary | null;
  membershipLoading: boolean;
  planCatalog: Awaited<ReturnType<typeof getPlanCatalog>> | null;
  loadingPlanId: string | null;

  paymentStatus: string;
  paymentError: string | null;
  resetPayment: () => void;

  loading: boolean;
  refreshing: boolean;
  locationLoading: boolean;

  showEditModal: boolean;
  setShowEditModal: (v: boolean) => void;
  showInterestPicker: boolean;
  setShowInterestPicker: (v: boolean) => void;
  showLanguagePicker: boolean;
  setShowLanguagePicker: (v: boolean) => void;
  showEducationPicker: boolean;
  setShowEducationPicker: (v: boolean) => void;
  showHeightPicker: boolean;
  setShowHeightPicker: (v: boolean) => void;
  showDrinkingPicker: boolean;
  setShowDrinkingPicker: (v: boolean) => void;
  showSmokingPicker: boolean;
  setShowSmokingPicker: (v: boolean) => void;
  showLookingForPicker: boolean;
  setShowLookingForPicker: (v: boolean) => void;

  fetchUserData: () => Promise<void>;
  fetchMembership: () => Promise<void>;
  onRefresh: () => Promise<void>;
  handleSave: () => Promise<void>;
  handleGetLocation: () => Promise<void>;
  handleAddPhotos: () => Promise<void>;
  handleRemovePhoto: (id: string) => Promise<void>;
  handleSetMainPhoto: (id: string) => Promise<void>;
  handleSubscribe: (planId: string, planName: string, amountPaise: number) => Promise<void>;
  handleAddInterest: (v: string) => void;
  handleRemoveInterest: (v: string) => void;
  handleAddLookingFor: (v: string) => void;
  handleRemoveLookingFor: (v: string) => void;
  handleAddLanguage: (v: string) => void;
  handleRemoveLanguage: (v: string) => void;
  toggleArrayValue: (values: string[], value: string, onAdd: (v: string) => void, onRemove: (v: string) => void) => void;
}

export function useProfileData(): ProfileData {
  const [showEditModal, setShowEditModal] = useState(false);
  const [profileDbFields, setProfileDbFields] = useState<{
    phone_number: string;
    email: string;
    gender?: string | null;
    gender_detail?: string | null;
  } | null>(null);
  const [userPhotos, setUserPhotos] = useState<Array<{
    id: string;
    photo_url: string;
    thumbnail_url?: string;
    is_primary: boolean;
    display_order: number;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [primaryPhotoUri, setPrimaryPhotoUri] = useState<string | null>(null);
  const [gender, setGender] = useState<string>('');
  const [vedicSign, setVedicSign] = useState<string>('');
  const [sexualOrientation, setSexualOrientation] = useState<string>('');
  const [ageRange, setAgeRange] = useState<string>('');
  const [distance, setDistance] = useState<string>('');
  const [newMatchNotifications, setNewMatchNotifications] = useState(false);
  const [membership, setMembership] = useState<MembershipSummary | null>(null);
  const [membershipLoading, setMembershipLoading] = useState(false);
  const [astroMissing, setAstroMissing] = useState(false);
  const [showAgeSetting, setShowAgeSetting] = useState(true);
  const [section1InterestValues, setSection1InterestValues] = useState<string[]>([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const isMountedRef = useRef(true);
  const { showAlert } = useAuthAlert();

  const { paymentStatus, paymentError, startPayment, resetPayment } = useSubscriptionPayment();

  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
  const [planCatalog, setPlanCatalog] = useState<Awaited<ReturnType<typeof getPlanCatalog>> | null>(null);

  useEffect(() => {
    getPlanCatalog().then(setPlanCatalog);
  }, []);

  const fetchMembership = async () => {
    try {
      if (isMountedRef.current) setMembershipLoading(true);
      const current = await getMembershipOrFree();
      if (isMountedRef.current) setMembership(current);
    } catch (err) {
      console.error('Error fetching membership:', err);
    } finally {
      if (isMountedRef.current) setMembershipLoading(false);
    }
  };

  const handleSubscribe = async (planId: string, planName: string, amountPaise: number) => {
    const userResult = await supabase.auth.getUser();
    const user = userResult?.data?.user;
    if (!user) {
      showAlert('Not Signed In', 'Please sign in to subscribe.');
      return;
    }
    setLoadingPlanId(planId);
    try {
      await startPayment({
        planId,
        planName,
        amountPaise,
        userId: user.id,
        userEmail: user.email,
      });
      if (paymentStatus === 'active') {
        fetchMembership();
      }
    } finally {
      setLoadingPlanId(null);
    }
  };

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const [editedProfile, setEditedProfile] = useState<ProfileState>(initialProfile);

  const profileCompletion = useMemo(() => calculateProfileCompletion(editedProfile), [editedProfile]);

  const parseStringArray = (value: unknown): string[] => {
    if (Array.isArray(value)) {
      return value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
    }
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return parsed.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
        }
      } catch {
        return value
          .split(',')
          .map((v) => v.trim())
          .filter((v) => v.length > 0);
      }
    }
    return [];
  };

  const parseLookingFor = (value: unknown): string[] => {
    if (Array.isArray(value)) {
      return value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
    }
    if (typeof value === 'string' && value.trim().length > 0) {
      return value
        .split(',')
        .map((v) => v.trim())
        .filter((v) => v.length > 0);
    }
    return [];
  };

  const loadSettings = async () => {
    try {
      const storedSettingsStr = await AsyncStorage.getItem('@app_settings');
      if (storedSettingsStr) {
        const storedSettings = JSON.parse(storedSettingsStr);
        if (storedSettings.showAge !== undefined) {
          if (isMountedRef.current) setShowAgeSetting(storedSettings.showAge);
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const fetchUserData = async () => {
    try {
      if (isMountedRef.current) setLoading(true);

      const [profileResult, photosResult, astroResult, section1Result] = await Promise.all([
        getUserProfile(),
        getUserPhotos(),
        getAstroDetails(),
        getSection1Responses(),
      ]);
      if (!isMountedRef.current) return;

      if (profileResult.success && profileResult.data) {
        const profile = profileResult.data;
        setProfileDbFields({
          phone_number: profile.phone_number || '',
          email: profile.email || '',
          gender: profile.gender || null,
          gender_detail: profile.gender_detail || null,
        });
        setEditedProfile(prev => ({
          ...prev,
          name: profile.full_name || prev.name,
          location: profile.location || prev.location,
        }));
        if (profile.gender_detail) {
          setGender(profile.gender_detail);
        } else if (profile.gender) {
          setGender(profile.gender);
        }
      }

      if (photosResult.success && photosResult.data && photosResult.data.length > 0) {
        const sortedPhotos = photosResult.data.sort((a: any, b: any) => {
          if (a.is_primary && !b.is_primary) return -1;
          if (!a.is_primary && b.is_primary) return 1;
          return a.display_order - b.display_order;
        });
        setUserPhotos(
          sortedPhotos.map((photo: any) => ({
            id: photo.id,
            photo_url: photo.photo_url,
            thumbnail_url: photo.thumbnail_url ?? undefined,
            is_primary: Boolean(photo.is_primary),
            display_order: Number(photo.display_order ?? 0),
          }))
        );

        const primaryPhoto = sortedPhotos.find((photo: any) => photo.is_primary) || sortedPhotos[0];
        if (primaryPhoto && primaryPhoto.photo_url) {
          setPrimaryPhotoUri(primaryPhoto.photo_url);
        }

        const photoSources = sortedPhotos.map((photo: any) => ({ uri: photo.photo_url, thumbnail: photo.thumbnail_url ?? undefined }));
        setEditedProfile(prev => ({
          ...prev,
          images: photoSources.length > 0 ? photoSources : prev.images,
        }));
      } else {
        setUserPhotos([]);
        setPrimaryPhotoUri(null);
        setEditedProfile(prev => ({ ...prev, images: [] }));
      }

      if (astroResult.success && astroResult.data) {
        const astro = astroResult.data;
        setEditedProfile(prev => ({
          ...prev,
          sunSign: astro.western_sign || prev.sunSign,
        }));
        setVedicSign(astro.indian_sign || '');
        setAstroMissing(!astro.western_sign && !astro.indian_sign);
      } else {
        setAstroMissing(true);
      }

      if (section1Result.success && section1Result.data) {
        const section1 = section1Result.data;

        const hobbiesAsInterests =
          Array.isArray(section1.hobbies) && section1.hobbies.length > 0
            ? section1.hobbies
            : [];

        const orientationInterests =
          Array.isArray(section1.interest) && section1.interest.length > 0
            ? section1.interest
            : [];

        setSection1InterestValues(orientationInterests);

        setEditedProfile(prev => ({
          ...prev,
          interests: hobbiesAsInterests.length > 0 ? hobbiesAsInterests : prev.interests,
          lookingFor: parseLookingFor(section1.looking_for),
          hobbies: hobbiesAsInterests,
          height: section1.height || prev.height,
        }));

        if (orientationInterests.length > 0) {
          const interestLabels: { [key: string]: string } = {
            'men': 'Men',
            'women': 'Women',
            'beyond-binary': 'Beyond Binary',
            'everyone': 'Everyone'
          };
          const formatted = orientationInterests
            .map((i: string) => interestLabels[i] || i)
            .join(', ');
          setSexualOrientation(formatted);
        }
      }

      const userResult = await supabase.auth.getUser();
      const user = userResult?.data?.user;
      if (!isMountedRef.current) return;
      if (user) {
        const { data: onboardingData, error: onboardingError } = await supabase
          .from('onboarding_responses')
          .select('*')
          .eq('user_id', user.id)
          .single();
        if (!isMountedRef.current) return;

        if (!onboardingError && onboardingData) {
          const onboardingLanguages = parseStringArray(
            onboardingData.languages ?? onboardingData.language
          );

          setEditedProfile(prev => ({
            ...prev,
            bio: onboardingData.about_me || prev.bio,
            languages: onboardingLanguages.length > 0 ? onboardingLanguages : prev.languages,
            education:
              typeof onboardingData.education === 'string' && onboardingData.education.trim().length > 0
                ? onboardingData.education
                : prev.education,
            drinking:
              typeof onboardingData.drinking === 'string' && onboardingData.drinking.trim().length > 0
                ? onboardingData.drinking
                : prev.drinking,
            smoking:
              typeof onboardingData.smoking === 'string' && onboardingData.smoking.trim().length > 0
                ? onboardingData.smoking
                : prev.smoking,
          }));
        }
      }

      if (profileResult.success && profileResult.data) {
        if (astroResult.success && astroResult.data && astroResult.data.birth_date) {
          const birthDate = new Date(astroResult.data.birth_date);
          const today = new Date();
          const age = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          const calculatedAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())
            ? age - 1
            : age;

          if (calculatedAge > 0) {
            setEditedProfile(prev => ({
              ...prev,
              age: calculatedAge,
            }));
          }
        }
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      if (isMountedRef.current) showAlert('Error', 'Failed to load profile data. Please try again.');
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  const onRefresh = async () => {
    try {
      if (isMountedRef.current) setRefreshing(true);
      await Promise.all([fetchUserData(), fetchMembership(), loadSettings()]);
    } catch (err) {
      console.error('Refresh error:', err);
    } finally {
      if (isMountedRef.current) setRefreshing(false);
    }
  };

  const [showInterestPicker, setShowInterestPicker] = useState(false);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [showEducationPicker, setShowEducationPicker] = useState(false);
  const [showHeightPicker, setShowHeightPicker] = useState(false);
  const [showDrinkingPicker, setShowDrinkingPicker] = useState(false);
  const [showSmokingPicker, setShowSmokingPicker] = useState(false);
  const [showLookingForPicker, setShowLookingForPicker] = useState(false);

  const handleGetLocation = async () => {
    try {
      if (isMountedRef.current) setLocationLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (!isMountedRef.current) return;

      if (status !== 'granted') {
        if (isMountedRef.current) {
          showAlert('Permission denied', 'Location permission is required to auto-fill your location.');
        }
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      const geocode = await Location.reverseGeocodeAsync(loc.coords);
      if (!isMountedRef.current) return;

      if (geocode && geocode.length > 0) {
        const first = geocode[0];
        const cityLine = [
          first.city || first.district || first.subregion,
          first.region,
          first.country,
        ]
          .filter(Boolean)
          .join(', ');

        setEditedProfile((prev) => ({
          ...prev,
          location: cityLine || `${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(4)}`,
        }));
      } else if (isMountedRef.current) {
        showAlert('Location Error', 'Could not determine your city.');
      }
    } catch (error) {
      console.error('Error getting location:', error);
      if (isMountedRef.current) showAlert('Error', 'Failed to get location. Please try again.');
    } finally {
      if (isMountedRef.current) setLocationLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (isMountedRef.current) setLoading(true);

      const userResult = await supabase.auth.getUser();
      const user = userResult?.data?.user;
      const userError = userResult?.error;
      if (!isMountedRef.current) return;
      if (userError || !user) {
        if (isMountedRef.current) {
          showAlert('Error', 'User not authenticated');
          setLoading(false);
        }
        return;
      }

      if (!profileDbFields?.email) {
        if (isMountedRef.current) {
          showAlert('Profile data missing', 'Email is missing in your account. Please complete onboarding first.');
          setLoading(false);
        }
        return;
      }

      const profileResult = await saveUserProfile({
        phone_number: profileDbFields.phone_number,
        full_name: editedProfile.name,
        email: profileDbFields.email,
        gender: profileDbFields.gender || undefined,
        gender_detail: profileDbFields.gender_detail || undefined,
        location: editedProfile.location || undefined,
      });
      if (!isMountedRef.current) return;

      if (!profileResult.success) {
        if (isMountedRef.current) {
          showAlert('Error', profileResult.error || 'Failed to save profile');
          setLoading(false);
        }
        return;
      }

      const section1Result = await saveSection1Responses({
        interest: section1InterestValues,
        looking_for: editedProfile.lookingFor.length > 0 ? editedProfile.lookingFor.join(', ') : undefined,
        height: editedProfile.height || undefined,
        hobbies: editedProfile.interests || [],
      });
      if (!isMountedRef.current) return;

      if (!section1Result.success) {
        console.warn('Warning: Failed to save some preferences:', section1Result.error);
      }

      const onboardingPayload: Record<string, any> = {
        user_id: user.id,
        updated_at: new Date().toISOString(),
        about_me: editedProfile.bio || null,
        languages: editedProfile.languages || [],
        education: editedProfile.education || null,
        drinking: editedProfile.drinking || null,
        smoking: editedProfile.smoking || null,
      };

      const { error: onboardingError } = await supabase
        .from('onboarding_responses')
        .upsert(onboardingPayload, {
          onConflict: 'user_id'
        });
      if (!isMountedRef.current) return;

      if (onboardingError) {
        const { error: fallbackError } = await supabase
          .from('onboarding_responses')
          .upsert({
            user_id: user.id,
            updated_at: new Date().toISOString(),
            about_me: editedProfile.bio || null,
          }, {
            onConflict: 'user_id'
          });
        if (!isMountedRef.current) return;
        if (fallbackError) {
          console.warn('Warning: Failed to save onboarding profile fields:', fallbackError);
        }
      }

      if (isMountedRef.current) {
        showAlert('Success', 'Profile updated successfully!');
        setShowEditModal(false);
      }

      await fetchUserData();
    } catch (error) {
      console.error('Error saving profile:', error);
      if (isMountedRef.current) showAlert('Error', 'Failed to save profile. Please try again.');
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchUserData();
      fetchMembership();
      loadSettings();
    }, [])
  );

  useEffect(() => {
    fetchUserData();
    fetchMembership();
    loadSettings();
  }, []);

  const handleRemovePhoto = async (photoId: string) => {
    try {
      if (isMountedRef.current) setLoading(true);

      // If we're removing the primary photo, auto-promote the next one first
      const photoToRemove = userPhotos.find(p => p.id === photoId);
      const isPrimaryBeingRemoved = photoToRemove?.is_primary ?? false;

      const result = await deleteUserPhoto(photoId);
      if (!isMountedRef.current) return;
      if (!result.success) {
        showAlert('Error', result.error || 'Failed to remove photo');
        return;
      }

      if (isPrimaryBeingRemoved) {
        const remaining = userPhotos.filter(p => p.id !== photoId);
        if (remaining.length > 0) {
          await setPrimaryPhoto(remaining[0].id);
        }
      }

      await fetchUserData();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (isMountedRef.current) showAlert('Error', message);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  const handleAddPhotos = async () => {
    try {
      const remaining = 6 - userPhotos.length;
      if (remaining <= 0) {
        showAlert('Limit Reached', 'You can have at most 6 photos. Remove one first.');
        return;
      }

      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 0.8,
      });

      if (pickerResult.canceled || pickerResult.assets.length === 0) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (isMountedRef.current) setLoading(true);

      const uris = pickerResult.assets.map(a => a.uri);
      const result = await uploadUserPhotos(uris, user.id);
      if (!isMountedRef.current) return;

      if (!result.success) {
        showAlert('Error', result.error || 'Failed to upload photos');
        return;
      }

      await fetchUserData();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (isMountedRef.current) showAlert('Error', message);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  const handleSetMainPhoto = async (photoId: string) => {
    try {
      if (isMountedRef.current) setLoading(true);
      const result = await setPrimaryPhoto(photoId);
      if (!isMountedRef.current) return;
      if (!result.success) {
        showAlert('Error', result.error || 'Failed to set main photo');
        return;
      }
      await fetchUserData();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (isMountedRef.current) showAlert('Error', message);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  const handleAddInterest = (interest: string) => {
    if (!editedProfile.interests.includes(interest)) {
      setEditedProfile({
        ...editedProfile,
        interests: [...editedProfile.interests, interest],
      });
    }
  };

  const handleRemoveInterest = (interest: string) => {
    setEditedProfile({
      ...editedProfile,
      interests: editedProfile.interests.filter((i) => i !== interest),
    });
  };

  const handleAddLookingFor = (option: string) => {
    if (!editedProfile.lookingFor.includes(option)) {
      setEditedProfile({
        ...editedProfile,
        lookingFor: [...editedProfile.lookingFor, option],
      });
    }
  };

  const handleRemoveLookingFor = (option: string) => {
    setEditedProfile({
      ...editedProfile,
      lookingFor: editedProfile.lookingFor.filter((o) => o !== option),
    });
  };

  const handleAddLanguage = (language: string) => {
    if (!editedProfile.languages.includes(language)) {
      setEditedProfile({
        ...editedProfile,
        languages: [...editedProfile.languages, language],
      });
    }
  };

  const handleRemoveLanguage = (language: string) => {
    setEditedProfile({
      ...editedProfile,
      languages: editedProfile.languages.filter((l) => l !== language),
    });
  };

  const toggleArrayValue = (
    values: string[],
    value: string,
    onAdd: (selectedValue: string) => void,
    onRemove: (selectedValue: string) => void,
  ) => {
    if (values.includes(value)) {
      onRemove(value);
      return;
    }
    onAdd(value);
  };

  return {
    editedProfile,
    setEditedProfile,
    profileDbFields,
    userPhotos,
    primaryPhotoUri,
    profileCompletion,
    vedicSign,
    gender,
    sexualOrientation,
    astroMissing,
    setAstroMissing,
    showAgeSetting,
    ageRange,
    distance,
    newMatchNotifications,
    membership,
    membershipLoading,
    planCatalog,
    loadingPlanId,
    paymentStatus,
    paymentError,
    resetPayment,
    loading,
    refreshing,
    locationLoading,
    showEditModal,
    setShowEditModal,
    showInterestPicker,
    setShowInterestPicker,
    showLanguagePicker,
    setShowLanguagePicker,
    showEducationPicker,
    setShowEducationPicker,
    showHeightPicker,
    setShowHeightPicker,
    showDrinkingPicker,
    setShowDrinkingPicker,
    showSmokingPicker,
    setShowSmokingPicker,
    showLookingForPicker,
    setShowLookingForPicker,
    fetchUserData,
    fetchMembership,
    onRefresh,
    handleSave,
    handleGetLocation,
    handleAddPhotos,
    handleRemovePhoto,
    handleSetMainPhoto,
    handleSubscribe,
    handleAddInterest,
    handleRemoveInterest,
    handleAddLookingFor,
    handleRemoveLookingFor,
    handleAddLanguage,
    handleRemoveLanguage,
    toggleArrayValue,
  };
}
