import { getAstroDetails } from '@/lib/astro-details';
import { getSection1Responses, saveSection1Responses } from '@/lib/onboarding-responses';
import { getMembershipOrFree, getPlanCatalog, type MembershipSummary } from '@/lib/subscription';
import { supabase } from '@/lib/supabase';
import { useSubscriptionPayment } from '@/lib/useSubscriptionPayment';
import { SubscriptionStatusBanner } from '@/components/SubscriptionStatusBanner';
import { deleteUserPhoto, getUserPhotos } from '@/lib/user-photos';
import { getUserProfile, saveUserProfile } from '@/lib/user-profile';
import { Ionicons } from '@expo/vector-icons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {  ActivityIndicator,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View
} from 'react-native';
import { useAuthAlert } from '@/lib/auth-alert-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Available options for selection
const availableInterests = [
  'Dancing', 'Basketball', 'Festivals', 'Cafe-hopping', 'Sense of adventure',
  'Astrology', 'Travel', 'Music', 'Reading', 'Cooking', 'Yoga', 'Fitness',
  'Photography', 'Art', 'Movies', 'Gaming', 'Hiking', 'Swimming', 'Tennis'
];

const availableLanguages = [
  'English',
  'Hindi',
  'Tamil',
  'Telugu',
  'Malayalam',
  'Spanish',
  'French',
  'German',
  'Italian',
  'Portuguese',
  'Chinese',
  'Japanese',
];

const educationOptions = ['High School', 'Bachelor', 'Master', 'PhD', 'Other'];

const heightOptions = [
  "150 cm (4'11\")", "155 cm (5'1\")", "160 cm (5'3\")", "165 cm (5'4\")",
  "170 cm (5'7\")", "175 cm (5'9\")", "180 cm (5'11\")", "185 cm (6'1\")"
];

const drinkingOptions = ['Never', 'Sometimes', 'Often', 'Socially'];

const smokingOptions = ['Never', 'Sometimes', 'Regularly', 'Trying to quit'];

const lookingForOptions = [
  "We'll see (if the feeling is right)",
  'Friendship',
  'Long-term relationship',
  'Short-term relationship',
  'Marriage',
  'Something casual'
];




const GOLD = '#F4D35E';
const TEXT_LIGHT = '#F7F3FF';
const TEXT_DIM = '#CFC6E5';

// Backend-first profile state. Keep empty defaults so UI doesn't show fake hardcoded user data.
const initialProfile = {
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

// Calculate profile completion percentage
const calculateProfileCompletion = (profile: typeof initialProfile): number => {
  let completedFields = 0;
  const totalFields = 12;

  // Check each field
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

// Star positions computed once at module level — hoisted out of the component
// so they survive tab switches without re-running 100 Math.random() calls per mount.
const STAR_DATA = Array.from({ length: 100 }).map((_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 2 + 0.5,
  opacity: Math.random() * 0.8 + 0.2,
}));

export default function ProfileScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
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
    is_primary: boolean;
    display_order: number;
  }>>([]);

  useEffect(() => {
    if (params.edit === 'true') {
      setShowEditModal(true);
      // Wait a tick then clear the param so it doesn't reopen if they close it and navigate back
      router.setParams({ edit: undefined });
    }
  }, [params.edit]);
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
  const [showAgeSetting, setShowAgeSetting] = useState(true);
  const [section1InterestValues, setSection1InterestValues] = useState<string[]>([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const isMountedRef = useRef(true);
  const { showAlert } = useAuthAlert();

  // ── BUG-07: subscription payment with race-condition-safe verification ──────
  const { paymentStatus, paymentError, startPayment, resetPayment } =
    useSubscriptionPayment();

  const [planCatalog, setPlanCatalog] = useState<
    Awaited<ReturnType<typeof getPlanCatalog>>
  >(null);

  useEffect(() => {
    getPlanCatalog().then(setPlanCatalog);
  }, []);

  const handleSubscribe = async (planId: string, planName: string, amountPaise: number) => {
    const userResult = await supabase.auth.getUser();
    const user = userResult?.data?.user;
    if (!user) {
      showAlert('Not Signed In', 'Please sign in to subscribe.');
      return;
    }
    await startPayment({
      planId,
      planName,
      amountPaise,
      userId: user.id,
      userEmail: user.email,
    });
    // On success, refresh membership badge
    if (paymentStatus === 'active') {
      fetchMembership();
    }
  };
  // ────────────────────────────────────────────────────────────────────────────

  // Floating animation for photo glow
  const glowScale = useSharedValue(1);

  // Stars are defined at module level as STAR_DATA — no useMemo needed
  const stars = STAR_DATA;

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    glowScale.value = withRepeat(
      withTiming(1.1, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const animatedGlowStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: glowScale.value }],
    };
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const [editedProfile, setEditedProfile] = useState(initialProfile);

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

  // Handle pull-to-refresh
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

      // Fetch all data in parallel for better performance
      const [profileResult, photosResult, astroResult, section1Result] = await Promise.all([
        getUserProfile(),
        getUserPhotos(),
        getAstroDetails(),
        getSection1Responses(),
      ]);
      if (!isMountedRef.current) return;

      // Fetch user profile
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
        // Set gender from profile - prefer gender_detail if available
        if (profile.gender_detail) {
          setGender(profile.gender_detail);
        } else if (profile.gender) {
          setGender(profile.gender);
        }
      }

      // Process photos result
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
            is_primary: Boolean(photo.is_primary),
            display_order: Number(photo.display_order ?? 0),
          }))
        );

        const primaryPhoto = sortedPhotos.find((photo: any) => photo.is_primary) || sortedPhotos[0];
        if (primaryPhoto && primaryPhoto.photo_url) {
          setPrimaryPhotoUri(primaryPhoto.photo_url);
        }

        // Update images array with all photos from database
        const photoSources = sortedPhotos.map((photo: any) => ({ uri: photo.photo_url }));
        setEditedProfile(prev => ({
          ...prev,
          images: photoSources.length > 0 ? photoSources : prev.images,
        }));
      } else {
        setUserPhotos([]);
        setPrimaryPhotoUri(null);
        setEditedProfile(prev => ({ ...prev, images: [] }));
      }

      // Process astro details for western and vedic signs
      if (astroResult.success && astroResult.data) {
        const astro = astroResult.data;
        setEditedProfile(prev => ({
          ...prev,
          sunSign: astro.western_sign || prev.sunSign,
        }));
        // Set vedic sign from indian_sign
        setVedicSign(astro.indian_sign || '');
      }

      // Process section1 responses (interests, looking_for, hobbies, height, etc.)
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
          // Note: drinking and smoking might be in a different table
        }));

        // Format sexual orientation from interest array
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

      // Fetch onboarding responses for bio/about me
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

        // Only update if data exists and no error (error is expected if table doesn't exist or no data)
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

      // Fetch user profile for additional fields like age, education, drinking, smoking
      // These might be in user_profiles or other tables
      if (profileResult.success && profileResult.data) {
        const profile = profileResult.data;
        // Age might need to be calculated from birth_date in astro_details
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
  const [showInterestPicker, setShowInterestPicker] = useState(false);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [showEducationPicker, setShowEducationPicker] = useState(false);
  const [showHeightPicker, setShowHeightPicker] = useState(false);
  const [showDrinkingPicker, setShowDrinkingPicker] = useState(false);
  const [showSmokingPicker, setShowSmokingPicker] = useState(false);
  const [showLookingForPicker, setShowLookingForPicker] = useState(false);

  const profileCompletion = calculateProfileCompletion(editedProfile);

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

      // Get current user
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

      // Save user profile (name, location) while preserving required DB fields
      if (!profileDbFields?.phone_number || !profileDbFields?.email) {
        if (isMountedRef.current) {
          showAlert('Profile data missing', 'Phone number or email is missing in your account. Please complete onboarding first.');
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

      // Save section1 responses (interests, looking_for, height, etc.)
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

      // Save extended profile fields that are not part of user_profiles
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
        // Fallback for environments where onboarding_responses has fewer columns.
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

      // Refresh data from database after saving
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
      const result = await deleteUserPhoto(photoId);
      if (!isMountedRef.current) return;
      if (!result.success) {
        showAlert('Error', result.error || 'Failed to remove photo');
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

  const InfoItem = ({ icon, label, value, fullWidth = false }: { icon: any, label: string, value: string, fullWidth?: boolean }) => (
    <View style={[styles.infoItem, fullWidth && styles.infoItemFull]}>
      <Ionicons name={icon} size={18} color="rgba(255, 255, 255, 0.6)" />
      <View style={styles.infoTextContainer}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );

  const renderPickerModal = (
    title: string,
    options: string[],
    selected: string | string[],
    onSelect: (value: string) => void,
    visible: boolean,
    setVisible: (visible: boolean) => void,
    isMultiSelect: boolean = false,
    onMultiToggle?: (value: string, isSelected: boolean) => void,
  ) => {
    if (!visible) {
      return null;
    }

    return (
      <View style={styles.inlinePickerOverlay} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.inlinePickerBackdrop}
          activeOpacity={1}
          onPress={() => setVisible(false)}
        />
        <BlurView intensity={40} tint="dark" style={styles.pickerOverlay}>
          <LinearGradient colors={['rgba(26, 13, 46, 0.9)', 'rgba(45, 27, 78, 0.95)']} style={styles.pickerModal}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>{title}</Text>
              <TouchableOpacity onPress={() => setVisible(false)}>
                <MaterialIcons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerContent}>
              {options.map((option) => {
                const isSelected = isMultiSelect
                  ? (selected as string[]).includes(option)
                  : selected === option;
                return (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.pickerOption,
                      isSelected && styles.pickerOptionSelected,
                    ]}
                    onPress={() => {
                      if (isMultiSelect) {
                        if (onMultiToggle) {
                          onMultiToggle(option, isSelected);
                        } else {
                          onSelect(option);
                        }
                      } else {
                        onSelect(option);
                        setVisible(false);
                      }
                    }}>
                    <Text
                      style={[
                        styles.pickerOptionText,
                        isSelected && styles.pickerOptionTextSelected,
                      ]}>
                      {option}
                    </Text>
                    {isSelected && (
                      <MaterialIcons name="check" size={20} color="#7C3AED" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </LinearGradient>
        </BlurView>
      </View>
    );
  };

  return (
    <LinearGradient
      colors={['#1a0d2e', '#2d1b4e', '#4a2c5a']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[styles.container, { paddingTop: insets.top }]}>

      <View style={styles.starsContainer}>
        {stars.map((star) => (
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

      {/* Header - matching reference image */}
      <View style={styles.header}>
        <View style={styles.headerButton} />
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={() => router.push('/filters')}
            activeOpacity={0.7}>
            <MaterialIcons name="tune" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={() => router.push('/settings')}
            activeOpacity={0.7}>
            <MaterialIcons name="settings" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#A855F7"
            colors={['#A855F7', '#7C3AED']}
            progressBackgroundColor="rgba(255, 255, 255, 0.1)"
          />
        }>



        {/* Profile Completion CTA */}
        {profileCompletion < 100 && (
          <TouchableOpacity onPress={() => setShowEditModal(true)} activeOpacity={0.8} style={styles.completionContainer}>
            <LinearGradient colors={['rgba(168, 85, 247, 0.15)', 'rgba(236, 72, 153, 0.15)']} style={styles.completionGradient}>
              <View style={styles.completionHeaderRow}>
                <Ionicons name="sparkles" size={18} color="#F4D35E" />
                <Text style={styles.completionTitle}>Your profile is {profileCompletion}% complete</Text>
              </View>
              <View style={styles.completionTrack}>
                <Animated.View style={[styles.completionFill, { width: `${profileCompletion}%` }]} />
              </View>
              <Text style={styles.completionSubtitle}>Complete it to get more meaningful matches!</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Awesome Profile UI */}
        <View style={styles.profileHeaderSection}>
          {/* Glowing Profile Photo */}
          <View style={styles.photoWrapper}>

            <TouchableOpacity
              style={styles.profilePhotoContainer}
              onPress={() => setShowEditModal(true)}
              activeOpacity={0.8}>
              {loading ? (
                <View style={styles.profilePhotoPlaceholder}>
                  <ActivityIndicator size="large" color="#7C3AED" />
                </View>
              ) : (
                primaryPhotoUri || editedProfile.images[0] ? (
                  <Image
                    source={primaryPhotoUri ? { uri: primaryPhotoUri } : editedProfile.images[0]}
                    style={styles.profilePhotoLarge}
                    contentFit="cover"
                    transition={500}
                  />
                ) : (
                  <View style={styles.profilePhotoPlaceholder}>
                    <Ionicons name="person" size={48} color="rgba(255, 255, 255, 0.65)" />
                  </View>
                )
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.editPhotoButtonLarge}
              onPress={() => setShowEditModal(true)}
              activeOpacity={0.9}>
              <MaterialIcons name="edit" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Name + Age + Membership */}
          <View style={styles.nameContentRow}>
            <Text style={styles.profileNameLarge}>
              {editedProfile.name || 'Your Profile'}{editedProfile.age && showAgeSetting ? `, ${editedProfile.age}` : ''}
            </Text>
            {membership?.is_active && (() => {
              const planSlug = String(membership?.plan_slug || '').toLowerCase();
              let tickColor = '#3B82F6';

              if (planSlug.includes('annual') || planSlug.includes('cosmic')) {
                tickColor = '#D1D5DB';
              } else if (planSlug.includes('lifetime') || planSlug.includes('galaxy')) {
                tickColor = '#F4D35E';
              } else if (planSlug.includes('monthly') || planSlug.includes('stellar')) {
                tickColor = '#3B82F6';
              }

              return (
                <View style={styles.membershipTickContainer}>
                  <MaterialIcons name="verified" size={24} color={tickColor} />
                  {membershipLoading ? (
                    <ActivityIndicator size="small" color={tickColor} style={styles.membershipLoadingSpinner} />
                  ) : null}
                </View>
              );
            })()}
          </View>

          {/* Location Badge */}
          {editedProfile.location ? (
            <View style={styles.locationBadge}>
              <Ionicons name="location" size={16} color="#A855F7" />
              <Text style={styles.profileLocationText}>
                {editedProfile.location}
              </Text>
            </View>
          ) : null}

          {/* About Me Card */}
          {editedProfile.bio ? (
            <BlurView intensity={20} tint="dark" style={styles.awesomeCard}>
              <View style={styles.cardHeader}>
                <Ionicons name="person" size={20} color="#F4D35E" />
                <Text style={styles.cardTitle}>About Me</Text>
              </View>
              <Text style={styles.bioText}>{editedProfile.bio}</Text>
            </BlurView>
          ) : null}

          {/* Astrological Info */}
          {(editedProfile.sunSign || vedicSign) ? (
            <BlurView intensity={20} tint="dark" style={styles.awesomeCard}>
              <View style={styles.cardHeader}>
                <Ionicons name="star" size={20} color="#A855F7" />
                <Text style={styles.cardTitle}>Astrology</Text>
              </View>
              <View style={styles.astroGrid}>
                {editedProfile.sunSign ? (
                  <View style={styles.astroItem}>
                    <Text style={styles.astroLabel}>Western</Text>
                    <Text style={styles.astroValue}>{editedProfile.sunSign}</Text>
                  </View>
                ) : null}
                {vedicSign ? (
                  <View style={styles.astroItem}>
                    <Text style={styles.astroLabel}>Vedic</Text>
                    <Text style={styles.astroValue}>{vedicSign}</Text>
                  </View>
                ) : null}
              </View>
            </BlurView>
          ) : null}

          {/* Basic Info */}
          <BlurView intensity={20} tint="dark" style={styles.awesomeCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="information-circle" size={22} color="#EC4899" />
              <Text style={styles.cardTitle}>Basic Info</Text>
            </View>
            <View style={styles.infoGrid}>
              {editedProfile.height ? <InfoItem icon="body-outline" label="Height" value={editedProfile.height} /> : null}
              {editedProfile.education ? <InfoItem icon="school-outline" label="Education" value={editedProfile.education} /> : null}
              {editedProfile.drinking ? <InfoItem icon="wine-outline" label="Drinking" value={editedProfile.drinking} /> : null}
              {editedProfile.smoking ? <InfoItem icon="flame-outline" label="Smoking" value={editedProfile.smoking} /> : null}
            </View>
          </BlurView>

          {/* Looking For, Interests & Languages */}
          {((editedProfile.lookingFor && editedProfile.lookingFor.length > 0) || (editedProfile.interests && editedProfile.interests.length > 0) || (editedProfile.languages && editedProfile.languages.length > 0)) ? (
            <BlurView intensity={20} tint="dark" style={styles.awesomeCard}>
              {editedProfile.lookingFor && editedProfile.lookingFor.length > 0 ? (
                <View style={styles.traitsSection}>
                  <View style={styles.cardHeader}>
                    <Ionicons name="search" size={20} color="#A78BFA" />
                    <Text style={styles.cardTitle}>Looking For</Text>
                  </View>
                  <View style={styles.traitChips}>
                    {editedProfile.lookingFor.map((item, i) => (
                      <View key={`looking-${i}`} style={[styles.traitChip, { backgroundColor: 'rgba(167, 139, 250, 0.16)', borderColor: 'rgba(167, 139, 250, 0.35)' }]}>
                        <Text style={[styles.traitChipText, { color: '#DDD6FE' }]}>{item}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {editedProfile.interests && editedProfile.interests.length > 0 ? (
                <View style={[styles.traitsSection, editedProfile.lookingFor && editedProfile.lookingFor.length > 0 ? { marginTop: 24 } : {}]}>
                  <View style={styles.cardHeader}>
                    <Ionicons name="heart" size={20} color="#F87171" />
                    <Text style={styles.cardTitle}>Interests</Text>
                  </View>
                  <View style={styles.traitChips}>
                    {editedProfile.interests.map((interest, i) => (
                      <View key={`int-${i}`} style={styles.traitChip}>
                        <Text style={styles.traitChipText}>{interest}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {editedProfile.languages && editedProfile.languages.length > 0 ? (
                <View style={[styles.traitsSection, (editedProfile.lookingFor && editedProfile.lookingFor.length > 0) || (editedProfile.interests && editedProfile.interests.length > 0) ? { marginTop: 24 } : {}]}>
                  <View style={styles.cardHeader}>
                    <Ionicons name="language" size={20} color="#3B82F6" />
                    <Text style={styles.cardTitle}>Languages</Text>
                  </View>
                  <View style={styles.traitChips}>
                    {editedProfile.languages.map((lang, i) => (
                      <View key={`lang-${i}`} style={[styles.traitChip, { backgroundColor: 'rgba(59, 130, 246, 0.15)', borderColor: 'rgba(59, 130, 246, 0.3)' }]}>
                        <Text style={[styles.traitChipText, { color: '#BFDBFE' }]}>{lang}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </BlurView>
          ) : null}
        </View>

        {/* ── BUG-07: Payment verification banner ─────────────────────────────
             Appears only while a Razorpay payment is in flight or just settled.
             'creating' / 'browser' / 'pending' → spinner + "Verifying…"
             'active'  → green success (then resetPayment() to dismiss)
             'failed'  → amber "Still Verifying" with support contact
        ──────────────────────────────────────────────────────────────────── */}
        {paymentStatus !== 'idle' && (
          <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
            <SubscriptionStatusBanner status={paymentStatus} error={paymentError} />
            {paymentStatus === 'active' && (
              <TouchableOpacity
                onPress={() => { resetPayment(); fetchMembership(); }}
                activeOpacity={0.7}
                style={styles.subscriptionCtaButton}>
                <MaterialIcons name="check-circle" size={18} color="#1E103A" />
                <Text style={styles.subscriptionCtaButtonText}>Done</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Subscription Plans ───────────────────────────────────────────────
             Shown only when the user is not yet on an active paid plan.
             Renders the live plan_catalog rows fetched from Supabase.
        ──────────────────────────────────────────────────────────────────── */}
        {!membership?.is_active && planCatalog && planCatalog.length > 0 && (
          <View style={[styles.subscriptionInlineSection, { paddingHorizontal: 16 }]}>
            <View style={styles.subscriptionHero}>
              <View style={styles.subscriptionLogoCircle}>
                <MaterialIcons name="auto-awesome" size={28} color="#F4D35E" />
              </View>
              <Text style={styles.subscriptionHeroTitle}>Unlock Premium</Text>
              <Text style={styles.subscriptionHeroSubtitle}>
                Get deeper astrological insights, unlimited likes, and see who liked you.
              </Text>
            </View>

            <View style={styles.subscriptionCards}>
              {planCatalog.map((plan, idx) => {
                const isHighlighted = plan.plan_slug === 'cosmic-annual';
                const priceRupees = (plan.amount_paise / 100).toLocaleString('en-IN');
                const intervalLabel =
                  plan.interval === 'monthly' ? '/ month' :
                  plan.interval === 'annual'  ? '/ year'  :
                  plan.interval === 'lifetime' ? 'one-time' : '';
                const isThisPlanLoading =
                  (paymentStatus === 'creating' || paymentStatus === 'browser' || paymentStatus === 'pending');

                return (
                  <View
                    key={plan.id}
                    style={[styles.subscriptionCard, isHighlighted && styles.subscriptionCardActive]}>
                    <View style={styles.subscriptionCardHeader}>
                      <View style={styles.subscriptionCardTitleRow}>
                        <Text style={styles.subscriptionCardTitle}>{plan.plan_badge}</Text>
                        {isHighlighted && (
                          <View style={styles.subscriptionBadgeTag}>
                            <Text style={styles.subscriptionBadgeTagText}>BEST VALUE</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.subscriptionPrice}>₹{priceRupees} {intervalLabel}</Text>
                    </View>

                    <Text style={styles.subscriptionTagline}>{plan.plan_name}</Text>

                    <TouchableOpacity
                      style={[
                        styles.subscriptionCtaButton,
                        isThisPlanLoading && { opacity: 0.6 },
                      ]}
                      disabled={isThisPlanLoading}
                      onPress={() => handleSubscribe(plan.id, plan.plan_name, plan.amount_paise)}
                      activeOpacity={0.85}>
                      {isThisPlanLoading ? (
                        <ActivityIndicator size="small" color="#1E103A" />
                      ) : (
                        <>
                          <MaterialIcons name="auto-awesome" size={18} color="#1E103A" />
                          <Text style={styles.subscriptionCtaButtonText}>Get {plan.plan_name}</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>

            <Text style={styles.subscriptionDisclaimer}>
              Payments are processed securely via Razorpay. Subscriptions are non-refundable.
            </Text>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Comprehensive Edit Profile Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditModal(false)}>
        <BlurView intensity={40} tint="dark" style={styles.modalOverlay}>
          <LinearGradient colors={['rgba(26, 13, 46, 0.9)', 'rgba(45, 27, 78, 0.95)']} style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity
                onPress={() => setShowEditModal(false)}
                activeOpacity={0.7}>
                <MaterialIcons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
              {/* Photos Section */}
              <View style={styles.modalSection}>
                <Text style={styles.modalLabel}>Photos</Text>
                <Text style={styles.modalHint}>Add or remove photos (tap to remove)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoGallery}>
                  {userPhotos.map((photo, index) => (
                    <View key={photo.id} style={styles.photoItem}>
                      <Image
                        source={{ uri: photo.photo_url }}
                        style={styles.photoThumbnail}
                        contentFit="cover"
                      />
                      {index !== 0 && (
                        <TouchableOpacity
                          style={styles.removePhotoButton}
                          onPress={() => handleRemovePhoto(photo.id)}>
                          <MaterialIcons name="close" size={18} color="#FFFFFF" />
                        </TouchableOpacity>
                      )}
                      {index === 0 && (
                        <View style={styles.mainPhotoBadge}>
                          <Text style={styles.mainPhotoBadgeText}>Main</Text>
                        </View>
                      )}
                    </View>
                  ))}
                  <TouchableOpacity
                    style={styles.addPhotoItem}
                    activeOpacity={0.7}
                    onPress={() => router.push('/onboarding/photo_upload')}>
                    <MaterialIcons name="add-circle-outline" size={40} color="#7C3AED" />
                    <Text style={styles.addPhotoText}>Add Photo</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>

              {/* Basic Info */}
              <View style={styles.modalSection}>
                <Text style={styles.modalLabel}>Basic Information</Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Name</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editedProfile.name}
                    onChangeText={(text) => setEditedProfile({ ...editedProfile, name: text })}
                    placeholder="Enter your name"
                    placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Age</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editedProfile.age.toString()}
                    onChangeText={() => { }}
                    placeholder="Age comes from birth details"
                    placeholderTextColor="rgba(255, 255, 255, 0.5)"
                    keyboardType="numeric"
                    editable={false}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Location</Text>
                  <View style={styles.modalInputRow}>
                    <TextInput
                      style={[styles.modalInput, styles.modalInputWithAction]}
                      value={editedProfile.location}
                      onChangeText={(text) => setEditedProfile({ ...editedProfile, location: text })}
                      placeholder="Enter your location"
                      placeholderTextColor="rgba(255, 255, 255, 0.5)"
                    />
                    <TouchableOpacity
                      style={styles.modalLocationButton}
                      onPress={handleGetLocation}
                      disabled={locationLoading}
                      activeOpacity={0.7}>
                      {locationLoading ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <MaterialIcons name="my-location" size={18} color="#FFFFFF" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Bio */}
              <View style={styles.modalSection}>
                <Text style={styles.modalLabel}>Bio</Text>
                <Text style={styles.modalHint}>Tell others about yourself</Text>
                <TextInput
                  style={[styles.modalInput, styles.modalTextArea]}
                  value={editedProfile.bio}
                  onChangeText={(text) => setEditedProfile({ ...editedProfile, bio: text })}
                  placeholder="Write a bio about yourself..."
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  multiline
                  numberOfLines={4}
                />
              </View>

              {/* Astrology Signs (Read-only) */}
              <View style={styles.modalSection}>
                <Text style={styles.modalLabel}>Astrology</Text>
                <Text style={styles.modalHint}>These cannot be changed</Text>
                <View style={styles.readOnlyContainer}>
                  <View style={styles.readOnlyItem}>
                    <MaterialIcons name="wb-sunny" size={20} color="#FFD700" />
                    <View style={styles.readOnlyContent}>
                      <Text style={styles.readOnlyLabel}>Western</Text>
                      <Text style={styles.readOnlyValue}>{editedProfile.sunSign || 'Not set'}</Text>
                    </View>
                  </View>
                  <View style={styles.readOnlyItem}>
                    <MaterialIcons name="nights-stay" size={20} color="#E0E0E0" />
                    <View style={styles.readOnlyContent}>
                      <Text style={styles.readOnlyLabel}>Vedic</Text>
                      <Text style={styles.readOnlyValue}>{vedicSign || 'Not set'}</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Looking For */}
              <View style={styles.modalSection}>
                <Text style={styles.modalLabel}>Looking For</Text>
                <Text style={styles.modalHint}>Tap to add or remove options</Text>
                <View style={styles.chipContainer}>
                  {editedProfile.lookingFor.map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[styles.chip, styles.chipSelected]}
                      onPress={() => handleRemoveLookingFor(option)}
                      activeOpacity={0.7}>
                      <Text style={styles.chipText}>{option}</Text>
                      <MaterialIcons name="close" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={() => setShowLookingForPicker(true)}
                  activeOpacity={0.7}>
                  <MaterialIcons name="add" size={20} color="#7C3AED" />
                  <Text style={styles.addButtonText}>Add Looking For</Text>
                </TouchableOpacity>
              </View>

              {/* Interests */}
              <View style={styles.modalSection}>
                <Text style={styles.modalLabel}>Interests</Text>
                <Text style={styles.modalHint}>Tap to add or remove interests</Text>
                <View style={styles.chipContainer}>
                  {editedProfile.interests.map((interest) => (
                    <TouchableOpacity
                      key={interest}
                      style={[styles.chip, styles.chipSelected]}
                      onPress={() => handleRemoveInterest(interest)}
                      activeOpacity={0.7}>
                      <Text style={styles.chipText}>{interest}</Text>
                      <MaterialIcons name="close" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={() => setShowInterestPicker(true)}
                  activeOpacity={0.7}>
                  <MaterialIcons name="add" size={20} color="#7C3AED" />
                  <Text style={styles.addButtonText}>Add Interest</Text>
                </TouchableOpacity>
              </View>

              {/* More About Me */}
              <View style={styles.modalSection}>
                <Text style={styles.modalLabel}>More About Me</Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Height</Text>
                  <TouchableOpacity
                    style={styles.selectButton}
                    onPress={() => setShowHeightPicker(true)}
                    activeOpacity={0.7}>
                    <Text style={styles.selectButtonText}>{editedProfile.height || 'Select height'}</Text>
                    <MaterialIcons name="chevron-right" size={24} color="#7C3AED" />
                  </TouchableOpacity>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Education</Text>
                  <TouchableOpacity
                    style={styles.selectButton}
                    onPress={() => setShowEducationPicker(true)}
                    activeOpacity={0.7}>
                    <Text style={styles.selectButtonText}>{editedProfile.education || 'Select education'}</Text>
                    <MaterialIcons name="chevron-right" size={24} color="#7C3AED" />
                  </TouchableOpacity>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Drinking</Text>
                  <TouchableOpacity
                    style={styles.selectButton}
                    onPress={() => setShowDrinkingPicker(true)}
                    activeOpacity={0.7}>
                    <Text style={styles.selectButtonText}>{editedProfile.drinking || 'Select drinking preference'}</Text>
                    <MaterialIcons name="chevron-right" size={24} color="#7C3AED" />
                  </TouchableOpacity>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Smoking</Text>
                  <TouchableOpacity
                    style={styles.selectButton}
                    onPress={() => setShowSmokingPicker(true)}
                    activeOpacity={0.7}>
                    <Text style={styles.selectButtonText}>{editedProfile.smoking || 'Select smoking preference'}</Text>
                    <MaterialIcons name="chevron-right" size={24} color="#7C3AED" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Languages */}
              <View style={styles.modalSection}>
                <Text style={styles.modalLabel}>Languages</Text>
                <Text style={styles.modalHint}>Tap to add or remove languages</Text>
                <View style={styles.chipContainer}>
                  {editedProfile.languages.map((language) => (
                    <TouchableOpacity
                      key={language}
                      style={[styles.chip, styles.chipSelected]}
                      onPress={() => handleRemoveLanguage(language)}
                      activeOpacity={0.7}>
                      <Text style={styles.chipText}>{language}</Text>
                      <MaterialIcons name="close" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={() => setShowLanguagePicker(true)}
                  activeOpacity={0.7}>
                  <MaterialIcons name="add" size={20} color="#7C3AED" />
                  <Text style={styles.addButtonText}>Add Language</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowEditModal(false)}
                activeOpacity={0.7}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={handleSave}
                activeOpacity={0.7}>
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>

            {renderPickerModal(
              'Select Looking For',
              lookingForOptions,
              editedProfile.lookingFor,
              (value) => handleAddLookingFor(value),
              showLookingForPicker,
              setShowLookingForPicker,
              true,
              (value) =>
                toggleArrayValue(
                  editedProfile.lookingFor,
                  value,
                  handleAddLookingFor,
                  handleRemoveLookingFor
                )
            )}

            {renderPickerModal(
              'Select Height',
              heightOptions,
              editedProfile.height,
              (value) => setEditedProfile({ ...editedProfile, height: value }),
              showHeightPicker,
              setShowHeightPicker
            )}

            {renderPickerModal(
              'Select Education',
              educationOptions,
              editedProfile.education,
              (value) => setEditedProfile({ ...editedProfile, education: value }),
              showEducationPicker,
              setShowEducationPicker
            )}

            {renderPickerModal(
              'Select Drinking',
              drinkingOptions,
              editedProfile.drinking,
              (value) => setEditedProfile({ ...editedProfile, drinking: value }),
              showDrinkingPicker,
              setShowDrinkingPicker
            )}

            {renderPickerModal(
              'Select Smoking',
              smokingOptions,
              editedProfile.smoking,
              (value) => setEditedProfile({ ...editedProfile, smoking: value }),
              showSmokingPicker,
              setShowSmokingPicker
            )}

            {renderPickerModal(
              'Add Interests',
              availableInterests,
              editedProfile.interests,
              (value) => handleAddInterest(value),
              showInterestPicker,
              setShowInterestPicker,
              true,
              (value) =>
                toggleArrayValue(
                  editedProfile.interests,
                  value,
                  handleAddInterest,
                  handleRemoveInterest
                )
            )}

            {renderPickerModal(
              'Add Languages',
              availableLanguages,
              editedProfile.languages,
              (value) => handleAddLanguage(value),
              showLanguagePicker,
              setShowLanguagePicker,
              true,
              (value) =>
                toggleArrayValue(
                  editedProfile.languages,
                  value,
                  handleAddLanguage,
                  handleRemoveLanguage
                )
            )}
          </LinearGradient>
        </BlurView>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'transparent',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  headerButton: {
    width: 84, // Changed to match the total width of headerRight (36 + 12 + 36 = 84) to exactly center the title
    height: 36,
    borderRadius: 18,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 16,
  },
  profileHeaderSection: {
    marginBottom: 24,
    alignItems: 'center',
  },
  profilePhotoContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  profilePhotoLarge: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  profilePhotoPlaceholder: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  editPhotoButtonLarge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#1a0d2e',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  profileNameLarge: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 8,
    textAlign: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 8,
  },
  membershipTickContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  membershipLoadingSpinner: {
    marginLeft: 4,
  },
  profileLocation: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '400',
    marginBottom: 6,
    textAlign: 'center',
  },
  profileAstro: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '400',
    marginBottom: 20,
    textAlign: 'center',
  },
  subscriptionSection: {
    marginTop: 8,
    marginBottom: 20,
    marginLeft: -16,
    marginRight: -16,
    paddingHorizontal: 16,
    width: '100%',
  },
  pillContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 25,
    padding: 4,
    gap: 4,
  },
  pillButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  pillText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  pillButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pillTextActive: {
    color: '#7C3AED',
    fontWeight: '600',
  },
  subscriptionCtaCard: {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.25)',
  },
  subscriptionCtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subscriptionCtaLeft: {
    flex: 1,
  },
  subscriptionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F4ECFF',
  },
  subscriptionBadgeText: {
    color: '#7C3AED',
    fontSize: 12,
    fontWeight: '700',
  },
  subscriptionCtaTitle: {
    marginTop: 6,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  subscriptionCtaSubtitle: {
    marginTop: 4,
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
    lineHeight: 18,
  },
  // Subscription Inline Section Styles
  subscriptionInlineSection: {
    marginTop: 20,
    width: '100%',
  },
  subscriptionHero: {
    alignItems: 'center',
    marginBottom: 18,
  },
  subscriptionLogoCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(244, 211, 94, 0.35)',
  },
  subscriptionHeroTitle: {
    color: TEXT_LIGHT,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 12,
    textAlign: 'center',
  },
  subscriptionHeroSubtitle: {
    color: TEXT_DIM,
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
  },
  subscriptionCards: {
    gap: 14,
    marginBottom: 18,
  },
  subscriptionCard: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.25)',
  },
  subscriptionCardActive: {
    backgroundColor: 'rgba(124, 58, 237, 0.22)',
    borderColor: GOLD,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  subscriptionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  subscriptionCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subscriptionCardTitle: {
    color: TEXT_LIGHT,
    fontSize: 18,
    fontWeight: '700',
  },
  subscriptionBadgeTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(244, 211, 94, 0.2)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(244, 211, 94, 0.5)',
  },
  subscriptionBadgeTagText: {
    color: GOLD,
    fontSize: 12,
    fontWeight: '700',
  },
  subscriptionPrice: {
    color: TEXT_LIGHT,
    fontSize: 16,
    fontWeight: '700',
  },
  subscriptionTagline: {
    color: TEXT_DIM,
    fontSize: 13,
    marginBottom: 10,
    lineHeight: 18,
  },
  subscriptionFeatures: {
    gap: 8,
    marginBottom: 10,
  },
  subscriptionFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subscriptionFeatureIcon: {
    marginRight: 8,
  },
  subscriptionFeatureText: {
    color: TEXT_LIGHT,
    fontSize: 14,
  },
  subscriptionExpandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  subscriptionExpandText: {
    color: GOLD,
    fontSize: 12,
    fontWeight: '600',
  },
  subscriptionCtaButton: {
    marginTop: 4,
    backgroundColor: GOLD,
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  subscriptionCtaButtonText: {
    color: '#1E103A',
    fontSize: 16,
    fontWeight: '800',
  },
  subscriptionDisclaimer: {
    marginTop: 12,
    color: TEXT_DIM,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  premiumFeaturesSection: {
    marginTop: 20,
    marginBottom: 20,
    gap: 16,
    paddingHorizontal: 16,
    width: '100%',
  },
  premiumFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  premiumFeatureContent: {
    flex: 1,
  },
  premiumFeatureTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  premiumFeatureSubtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    fontWeight: '400',
  },
  editProfileButton: {
    backgroundColor: 'rgba(168, 85, 247, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.5)',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 20,
    alignSelf: 'center',
    marginTop: 8,
  },
  editProfileButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Settings Section Styles
  settingsSection: {
    marginBottom: 24,
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 12,
    marginTop: 8,
    textTransform: 'uppercase',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
    borderRadius: 0,
    marginBottom: 0,
    gap: 12,
  },
  settingIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingLabel: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  settingValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '400',
    marginRight: 8,
    flex: 1,
    textAlign: 'right',
  },
  toggleContainer: {
    marginLeft: 'auto',
  },
  toggle: {
    width: 56,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  toggleActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
    ...Platform.select({
      ios: {
        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  featureCardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  featureCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    minHeight: 140,
    justifyContent: 'center',
  },
  featureCardIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureCardTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  featureCardSubtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    fontWeight: '500',
  },
  premiumCardsSection: {
    marginBottom: 24,
  },
  premiumCardsTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  premiumCardsContainer: {
    gap: 10,
    paddingHorizontal: 4,
    paddingRight: 20,
  },
  premiumCard: {
    width: 320,
    height: 220,
    borderRadius: 24,
    overflow: 'hidden',
    marginRight: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  premiumCardStandard: {
    width: 320,
    height: 220,
    borderRadius: 24,
    overflow: 'hidden',
    marginRight: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  boostCard: {
    width: 320,
    height: 220,
    borderRadius: 24,
    overflow: 'hidden',
    marginRight: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#EC4899',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  premiumCardGradient: {
    width: '100%',
    height: '100%',
    padding: 24,
    gap: 16,
    justifyContent: 'space-between',
  },
  premiumCardTitle: {
    color: '#000000',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 1,
  },
  premiumCardDescription: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
    opacity: 0.9,
  },
  premiumCardButton: {
    backgroundColor: '#000000',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  premiumCardButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  premiumCardTitleStandard: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 1,
  },
  premiumCardDescriptionStandard: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
    opacity: 0.95,
  },
  premiumCardButtonStandard: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  premiumCardButtonTextStandard: {
    color: '#7C3AED',
    fontSize: 16,
    fontWeight: '700',
  },
  boostCardTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 1,
  },
  boostCardDescription: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
    opacity: 0.95,
  },
  boostCardButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  boostCardButtonText: {
    color: '#EC4899',
    fontSize: 16,
    fontWeight: '700',
  },
  featuresComparisonSection: {
    marginBottom: 24,
  },
  featuresComparisonTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  featuresTable: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  featuresTableHeader: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    gap: 16,
  },
  featuresTableHeaderSpacer: {
    flex: 1,
  },
  featuresTableHeaderText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    width: 80,
    textAlign: 'center',
  },
  featuresTableHeaderTextSecondary: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '600',
  },
  featuresTableRow: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    gap: 16,
  },
  featuresTableRowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featuresTableRowText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  featuresTableCheck: {
    width: 80,
    alignItems: 'center',
  },
  // Tab Content Styles
  tabContentSection: {
    gap: 20,
    marginBottom: 24,
  },
  // Astro Advice Styles
  astroHeader: {
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
  },
  astroHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  astroHeaderSubtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 24,
  },
  astroCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  astroCardTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  astroSignsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  astroSignCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 12,
  },
  astroSignIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  astroSignLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  astroSignValue: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  astroSignDescription: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  insightItem: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  insightItemLast: {
    borderBottomWidth: 0,
    marginBottom: 0,
    paddingBottom: 0,
  },
  insightContent: {
    flex: 1,
    gap: 6,
  },
  insightTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  insightText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    lineHeight: 20,
  },
  horoscopeCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  horoscopeDate: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  horoscopeText: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 24,
  },
  astroActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    gap: 12,
    marginTop: 8,
  },
  astroActionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  // Safety & Wellbeing Styles
  safetyHeader: {
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
  },
  safetyHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  safetyHeaderSubtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 24,
  },
  safetyCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  safetyCardTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
  },
  safetyTipItem: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  safetyTipItemLast: {
    borderBottomWidth: 0,
    marginBottom: 0,
    paddingBottom: 0,
  },
  safetyTipIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  safetyTipContent: {
    flex: 1,
    gap: 6,
  },
  safetyTipTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  safetyTipText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    lineHeight: 20,
  },
  safetyActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 12,
    gap: 12,
  },
  safetyActionContent: {
    flex: 1,
    gap: 4,
  },
  safetyActionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  safetyActionText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
  },
  emergencyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F87171',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    gap: 12,
    marginBottom: 12,
  },
  emergencyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  sectionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  sectionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionContent: {
    flex: 1,
    gap: 4,
  },
  sectionSubtitle: {
    color: '#FFFFFF',
    fontSize: 14,
    opacity: 0.7,
    fontWeight: '400',
  },
  optionsSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    gap: 12,
  },
  optionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.3)',
    gap: 10,
    marginTop: 8,
  },
  logoutText: {
    color: '#F87171',
    fontSize: 16,
    fontWeight: '600',
  },

  // Premium Subscription Styles
  premiumBanner: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  premiumBannerEmoji: {
    fontSize: 28,
  },
  premiumBannerText: {
    color: GOLD,
    fontSize: 18,
    fontWeight: '700',
  },

  // Current Plan Section
  currentPlanSection: {
    marginBottom: 28,
  },
  currentPlanCard: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
  },
  currentPlanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  currentPlanName: {
    color: TEXT_LIGHT,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  currentPlanPrice: {
    color: GOLD,
    fontSize: 18,
    fontWeight: '600',
  },
  activeBadge: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  planStatusRow: {
    marginBottom: 12,
  },
  planStatusText: {
    color: TEXT_DIM,
    fontSize: 12,
    marginBottom: 4,
    fontWeight: '500',
  },
  currentPlanFeatures: {
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(207, 198, 229, 0.2)',
  },
  currentPlanFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  currentPlanFeatureText: {
    color: TEXT_LIGHT,
    fontSize: 14,
    fontWeight: '500',
  },
  expandButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(207, 198, 229, 0.1)',
  },
  expandButtonText: {
    color: GOLD,
    fontSize: 13,
    fontWeight: '600',
  },

  // Features Grid
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  featureItem: {
    width: '48%',
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.25)',
  },
  featureIconBg: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(244, 211, 94, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureLabel: {
    color: TEXT_LIGHT,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Upgrade Section
  upgradeSection: {
    marginBottom: 28,
  },
  upgradeCard: {
    backgroundColor: 'rgba(244, 211, 94, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(244, 211, 94, 0.25)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  upgradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  upgradePlanName: {
    color: TEXT_LIGHT,
    fontSize: 16,
    fontWeight: '700',
  },
  savingsBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  savingsText: {
    color: '#22C55E',
    fontSize: 11,
    fontWeight: '600',
  },
  upgradePriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  upgradeOriginalPrice: {
    color: TEXT_DIM,
    fontSize: 13,
    fontWeight: '500',
    textDecorationLine: 'line-through',
  },
  upgradeNewPrice: {
    color: GOLD,
    fontSize: 16,
    fontWeight: '700',
  },
  upgradeButton: {
    backgroundColor: GOLD,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  upgradeButtonText: {
    color: '#1E103A',
    fontSize: 14,
    fontWeight: '700',
  },

  // Management Section
  managementSection: {
    marginBottom: 24,
  },
  managementButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  mgmtButton: {
    flex: 1,
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.25)',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  mgmtButtonText: {
    color: TEXT_LIGHT,
    fontSize: 11,
    fontWeight: '600',
  },

  bottomSpacer: {
    height: 40,
  },
  // Modal Styles

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
    paddingTop: 32,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(168, 85, 247, 0.2)',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  modalScrollView: {
    maxHeight: '75%',
    padding: 20,
  },
  modalSection: {
    marginBottom: 32,
  },
  modalLabel: {
    color: '#E9D5FF',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  modalHint: {
    color: '#FFFFFF',
    fontSize: 13,
    opacity: 0.6,
    marginBottom: 12,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    opacity: 0.9,
  },
  photoGallery: {
    marginTop: 12,
  },
  photoItem: {
    marginRight: 12,
    position: 'relative',
  },
  photoThumbnail: {
    width: 100,
    height: 120,
    borderRadius: 18,
  },
  removePhotoButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(248, 113, 113, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainPhotoBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(124, 58, 237, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  mainPhotoBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },

  modalTextArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  readOnlyContainer: {
    gap: 12,
    marginTop: 12,
  },
  readOnlyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 12,
  },
  readOnlyContent: {
    flex: 1,
  },
  readOnlyLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 4,
  },
  readOnlyValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  selectButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    flex: 1,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    marginBottom: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 8,
  },
  chipSelected: {
    backgroundColor: 'rgba(124, 58, 237, 0.3)',
    borderColor: '#A855F7',
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  chipText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    borderWidth: 1,
    borderColor: '#A855F7',
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
    gap: 8,
  },
  addButtonText: {
    color: '#E9D5FF',
    fontSize: 14,
    fontWeight: '700',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 16,
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(168, 85, 247, 0.2)',
    backgroundColor: 'rgba(26, 13, 46, 0.95)',
  },

  modalSaveText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  // Picker Modal Styles
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  pickerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  pickerContent: {
    maxHeight: 400,
    padding: 20,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  pickerOptionSelected: {
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    borderWidth: 1,
    borderColor: '#7C3AED',
  },
  pickerOptionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  pickerOptionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  // Awesome UI Styles
  awesomeCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 24,
    padding: 20,
    width: '100%',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  bioText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 15,
    lineHeight: 24,
  },
  astroGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  astroItem: {
    flex: 1,
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.2)',
    alignItems: 'center',
  },
  astroLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  astroValue: {
    color: '#F4D35E',
    fontSize: 16,
    fontWeight: '700',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  infoItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  infoItemFull: {
    width: '100%',
  },
  infoTextContainer: {
    flex: 1,
  },
  infoLabel: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  infoValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  traitsSection: {
    width: '100%',
  },
  traitChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  traitChip: {
    backgroundColor: 'rgba(244, 211, 94, 0.15)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(244, 211, 94, 0.3)',
  },
  traitChipText: {
    color: '#F4D35E',
    fontSize: 13,
    fontWeight: '600',
  },
  photoWrapper: {
    position: 'relative',
    marginBottom: 16,
    width: 156,
    height: 156,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoGlow: {
    position: 'absolute',
    width: 156,
    height: 156,
    borderRadius: 78,
    opacity: 0.8,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 24,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
  },
  profileLocationText: {
    color: '#E9D5FF',
    fontSize: 14,
    fontWeight: '600',
  },
  nameContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  // New "Rocks" UI Styles
  ambientOrb: {
    position: 'absolute',
    borderRadius: 200,
    opacity: 0.15,
  },
  orb1: {
    width: 300,
    height: 300,
    backgroundColor: '#A855F7',
    top: -50,
    left: -100,
  },
  orb2: {
    width: 350,
    height: 350,
    backgroundColor: '#EC4899',
    top: 200,
    right: -150,
  },
  orb3: {
    width: 250,
    height: 250,
    backgroundColor: '#F4D35E',
    top: 500,
    left: -100,
  },
  completionContainer: {
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.3)',
  },
  completionGradient: {
    padding: 16,
  },
  completionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  completionTitle: {
    color: '#F4D35E',
    fontSize: 16,
    fontWeight: '700',
  },
  completionTrack: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    marginBottom: 10,
    overflow: 'hidden',
  },
  completionFill: {
    height: '100%',
    backgroundColor: '#A855F7',
    borderRadius: 3,
  },
  completionSubtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
  },
  photoGlowContainer: {
    position: 'absolute',
    width: 156,
    height: 156,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Overriding Modal Styles for "Rock" UI
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 5, 20, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'rgba(26, 13, 46, 0.95)',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    height: '92%',
    overflow: 'hidden',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.4)',
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  pickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  inlinePickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    justifyContent: 'flex-end',
  },
  inlinePickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 5, 20, 0.65)',
  },
  pickerModal: {
    backgroundColor: 'rgba(26, 13, 46, 0.95)',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    maxHeight: '75%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.4)',
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  modalInput: {
    backgroundColor: 'rgba(168, 85, 247, 0.08)',
    borderRadius: 20,
    padding: 16,
    color: '#FFFFFF',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
  },
  modalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalInputWithAction: {
    flex: 1,
  },
  modalLocationButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(124, 58, 237, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(168, 85, 247, 0.08)',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 18,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
  },
  modalSaveButton: {
    flex: 1,
    paddingVertical: 18,
    borderRadius: 20,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  addPhotoItem: {
    width: 100,
    height: 120,
    borderRadius: 20,
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    borderWidth: 2,
    borderColor: '#A855F7',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  addPhotoText: {
    color: '#E9D5FF',
    fontSize: 13,
    fontWeight: '700',
  },
  modalCancelText: {
    color: '#E9D5FF',
    fontSize: 16,
    fontWeight: '700',
  },
});
