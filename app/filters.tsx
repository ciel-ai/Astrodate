import { fetchWithTimeout } from '@/lib/network';
import { supabase } from '@/lib/supabase';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuthAlert } from '@/lib/auth-alert-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function FiltersScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAuthAlert();

  // Age range state
  const [minAge, setMinAge] = useState(18);
  const [maxAge, setMaxAge] = useState(65);

  // Distance state
  const [maxDistance, setMaxDistance] = useState(50); // in km or miles

  // Discovery meta (moved from Profile)
  const [location, setLocation] = useState<string>('');
  const [genderPreferenceLabel, setGenderPreferenceLabel] = useState<string>('Select');
  const [sexualOrientation, setSexualOrientation] = useState<string>('Select');
  const [newMatchNotifications, setNewMatchNotifications] = useState<boolean>(true); // discovery notification toggle

  // Astro preference filters
  const [preferredElements, setPreferredElements] = useState<string[]>([]);
  const [blockedSigns, setBlockedSigns] = useState<string[]>([]);

  // Inline editor dialog state (we now expand sections inline)
  const [expandedSection, setExpandedSection] = useState<'location' | 'gender' | 'sexual_orientation' | 'age' | 'distance' | null>(null);
  const [tempLocation, setTempLocation] = useState<string>('');
  const [locationSuggestions, setLocationSuggestions] = useState<{ id: string; label: string }[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState<boolean>(false);
  const suggestionsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState<boolean>(false);
  const [tempGender, setTempGender] = useState<string>('');
  const [tempSexualOrientation, setTempSexualOrientation] = useState<string>('');
  const [savingDialog, setSavingDialog] = useState<boolean>(false);
  const [activeDialog, setActiveDialog] = useState<'location' | 'gender' | 'sexual_orientation' | 'age' | 'distance' | null>(null);

  // Temp state for numeric editing
  const [tempMinAge, setTempMinAge] = useState<number>(minAge);
  const [tempMaxAge, setTempMaxAge] = useState<number>(maxAge);
  const [tempDistance, setTempDistance] = useState<number>(maxDistance);

  // Other preferences (removed Show Me & Additional Filters UI) 

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draggingHandle, setDraggingHandle] = useState<'maxAge' | 'distance' | null>(null);
  const screenWidth = Dimensions.get('window').width;
  const sliderWidth = screenWidth - 80; // Account for padding

  // Helper function to calculate slider position (defined early so it can be used in shared values)
  const getSliderPosition = (value: number, min: number, max: number) => {
    return ((value - min) / (max - min)) * sliderWidth;
  };

  // Persist notification toggle immediately when it changes
  const handleNewMatchToggle = async (value: boolean) => {
    setNewMatchNotifications(value);
    try {
      const userResult = await supabase.auth.getUser();
      const user = userResult?.data?.user;
      if (!user) return;

      const { error } = await supabase
        .from('user_preferences')
        .upsert(
          {
            user_id: user.id,
            new_match_notifications: value,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );

      if (error) {
        console.error('Error saving new match notification preference:', error);
      }
    } catch (err) {
      console.error('Error saving new match notification preference:', err);
    }
  };

  // Shared values for smooth animations
  const minAgePosition = useSharedValue(getSliderPosition(18, 18, 100));
  const maxAgePosition = useSharedValue(getSliderPosition(65, 19, 100));
  const distancePosition = useSharedValue(getSliderPosition(50, 1, 100));

  // Shared value for dragging state (for animated styles)
  const draggingHandleValue = useSharedValue<'maxAge' | 'distance' | null>(null);

  // Shared values for starting positions during drag
  const minAgeStartPosition = useSharedValue(0);
  const maxAgeStartPosition = useSharedValue(0);
  const distanceStartPosition = useSharedValue(0);

  // Track container refs for position calculation
  const ageSliderRef = useRef<View>(null);
  const distanceSliderRef = useRef<View>(null);

  // Add a ref to the main ScrollView so menu rows can scroll to sections
  const scrollViewRef = useRef<ScrollView | null>(null);
  const ageSectionY = useRef<number>(0);
  const distanceSectionY = useRef<number>(0);

  // Store container positions
  const ageSliderPosition = useRef({ x: 0, width: 0 });
  const distanceSliderPosition = useRef({ x: 0, width: 0 });

  // Debounce slider updates for better performance
  const sliderUpdateTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  // Slider helper functions removed — logic handled via shared position update helpers

  // Measure slider positions
  const measureSliderPositions = () => {
    if (ageSliderRef.current) {
      ageSliderRef.current.measure((x, y, width, height, pageX, pageY) => {
        ageSliderPosition.current = { x: pageX, width };
      });
    }
    if (distanceSliderRef.current) {
      distanceSliderRef.current.measure((x, y, width, height, pageX, pageY) => {
        distanceSliderPosition.current = { x: pageX, width };
      });
    }
  };

  // Helper function to handle auto-save timeout - memoized for stability
  const handleAutoSave = useCallback(() => {
    if (sliderUpdateTimeout.current) {
      clearTimeout(sliderUpdateTimeout.current);
    }
    sliderUpdateTimeout.current = setTimeout(() => {
      savePreferencesSilently();
    }, 500);
  }, []);

  // Silent save for auto-save on slider release
  const savePreferencesSilently = async () => {
    try {
      const userResult = await supabase.auth.getUser();
      const user = userResult?.data?.user;
      if (!user) return;

      // Validate preferences
      if (minAge >= maxAge) return;

      // Check if preferences exist
      const { data: existing } = await supabase
        .from('user_preferences')
        .select('id')
        .eq('user_id', user.id)
        .single();

      const preferencesData = {
        user_id: user.id,
        min_age: minAge,
        max_age: maxAge,
        max_distance: maxDistance,
        new_match_notifications: newMatchNotifications,
        preferred_elements: preferredElements,
        blocked_signs: blockedSigns,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        await supabase
          .from('user_preferences')
          .update(preferencesData)
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('user_preferences')
          .insert(preferencesData);
      }
    } catch (error: any) {
      // If the preferences table is missing, advise running the migration (but remain silent in UI)
      if (error?.code === 'PGRST205' || (error?.message && error.message.includes('Could not find the table'))) {
        console.warn("Auto-save skipped: 'user_preferences' table not found. Run 'supabase/migrations/014_create_user_preferences_table.sql' to create it.");
      } else {
        console.error('Error auto-saving preferences:', error);
      }
      // Silent fail for auto-save
    }
  };


  const updateMinAgeFromPosition = (position: number) => {
    const ratio = Math.max(0, Math.min(1, position / sliderWidth));
    const value = Math.round(18 + ratio * 82); // 18-100 range
    // Collision guard: minAge must always stay at least 1 below maxAge
    const newMinAge = Math.min(value, maxAge - 1);
    if (newMinAge !== minAge) {
      setMinAge(newMinAge);
    }
  };

  const updateMaxAgeFromPosition = (position: number) => {
    const ratio = Math.max(0, Math.min(1, position / sliderWidth));
    const value = Math.round(18 + ratio * 82); // 18-100 range
    // Collision guard: maxAge must always stay at least 1 above minAge
    const newMaxAge = Math.max(value, minAge + 1);
    if (newMaxAge !== maxAge) {
      setMaxAge(newMaxAge);
    }
  };

  const updateDistanceFromPosition = (position: number) => {
    const ratio = Math.max(0, Math.min(1, position / sliderWidth));
    const value = Math.round(1 + ratio * 99); // 1-100 range
    const newDistance = Math.max(1, Math.min(100, value));
    if (newDistance !== maxDistance) {
      setMaxDistance(newDistance);
    }
  };

  // Shared values for container positions (updated from JS thread)
  const ageContainerX = useSharedValue(0);
  const ageContainerWidth = useSharedValue(sliderWidth);
  const distanceContainerX = useSharedValue(0);
  const distanceContainerWidth = useSharedValue(sliderWidth);

  // Update container positions (called from JS thread) - memoized for stability
  const updateContainerPositions = useCallback(() => {
    ageContainerX.value = ageSliderPosition.current.x;
    ageContainerWidth.value = ageSliderPosition.current.width || sliderWidth;
    distanceContainerX.value = distanceSliderPosition.current.x;
    distanceContainerWidth.value = distanceSliderPosition.current.width || sliderWidth;
  }, [sliderWidth]);

  // Clear suggestions when the location editor is closed to avoid showing stale results
  useEffect(() => {
    if (expandedSection !== 'location') {
      setLocationSuggestions([]);
    }
  }, [expandedSection]);

  // Gesture handler for min age slider - memoized to prevent recreation
  const minAgeGesture = useMemo(
    () =>
      Gesture.Pan()
        .onBegin(() => {
          'worklet';
          minAgeStartPosition.value = minAgePosition.value;
          draggingHandleValue.value = 'maxAge'; // reuse for styling
          runOnJS(measureSliderPositions)();
          runOnJS(updateContainerPositions)();
          runOnJS(setDraggingHandle)('maxAge');
        })
        .onUpdate((event) => {
          'worklet';
          const newPosition = Math.max(0, Math.min(maxAgePosition.value - 24, minAgeStartPosition.value + event.translationX));
          minAgePosition.value = newPosition;
          runOnJS(updateMinAgeFromPosition)(newPosition);
        })
        .onEnd(() => {
          'worklet';
          draggingHandleValue.value = null;
          runOnJS(setDraggingHandle)(null);
          runOnJS(handleAutoSave)();
        }),
    [] // Empty deps - shared values are stable references
  );

  // Gesture handler for max age slider - memoized to prevent recreation
  const maxAgeGesture = useMemo(
    () =>
      Gesture.Pan()
        .onBegin(() => {
          'worklet';
          maxAgeStartPosition.value = maxAgePosition.value;
          draggingHandleValue.value = 'maxAge';
          runOnJS(measureSliderPositions)();
          runOnJS(updateContainerPositions)();
          runOnJS(setDraggingHandle)('maxAge');
        })
        .onUpdate((event) => {
          'worklet';
          // Use translationX which is relative to the gesture start
          const newPosition = Math.max(0, Math.min(ageContainerWidth.value, maxAgeStartPosition.value + event.translationX));
          maxAgePosition.value = newPosition;
          runOnJS(updateMaxAgeFromPosition)(newPosition);
        })
        .onEnd(() => {
          'worklet';
          draggingHandleValue.value = null;
          runOnJS(setDraggingHandle)(null);
          runOnJS(handleAutoSave)();
        }),
    [] // Empty deps - shared values are stable references
  );

  // Gesture handler for distance slider - memoized to prevent recreation
  const distanceGesture = useMemo(
    () =>
      Gesture.Pan()
        .onBegin(() => {
          'worklet';
          distanceStartPosition.value = distancePosition.value;
          draggingHandleValue.value = 'distance';
          runOnJS(measureSliderPositions)();
          runOnJS(updateContainerPositions)();
          runOnJS(setDraggingHandle)('distance');
        })
        .onUpdate((event) => {
          'worklet';
          // Use translationX which is relative to the gesture start
          const newPosition = Math.max(0, Math.min(distanceContainerWidth.value, distanceStartPosition.value + event.translationX));
          distancePosition.value = newPosition;
          runOnJS(updateDistanceFromPosition)(newPosition);
        })
        .onEnd(() => {
          'worklet';
          draggingHandleValue.value = null;
          runOnJS(setDraggingHandle)(null);
          runOnJS(handleAutoSave)();
        }),
    [] // Empty deps - shared values are stable references
  );



  useEffect(() => {
    loadPreferences();

    // Cleanup timeouts on unmount
    return () => {
      if (sliderUpdateTimeout.current) {
        clearTimeout(sliderUpdateTimeout.current);
      }
      if (suggestionsTimeout.current) {
        clearTimeout(suggestionsTimeout.current);
      }
    };
  }, []);

  // Sync minAge shared value when minAge state changes (e.g. after loading prefs)
  useEffect(() => {
    if (draggingHandle !== 'maxAge') { // reuse flag — neither handle being dragged
      minAgePosition.value = withSpring(getSliderPosition(minAge, 18, 100));
    }
  }, [minAge, draggingHandle]);

  useEffect(() => {
    if (draggingHandle !== 'maxAge') {
      maxAgePosition.value = withSpring(getSliderPosition(maxAge, 19, 100));
    }
  }, [maxAge, draggingHandle]);

  useEffect(() => {
    if (draggingHandle !== 'distance') {
      distancePosition.value = withSpring(getSliderPosition(maxDistance, 1, 100));
    }
  }, [maxDistance, draggingHandle]);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const userResult = await supabase.auth.getUser();
      const user = userResult?.data?.user;
      if (!user) {
        setLoading(false);
        return;
      }

      // Try to load from a preferences table
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!error && data) {
        // Validate and set preferences
        const loadedMinAge = Math.max(18, Math.min(100, data.min_age || 18));
        const loadedMaxAge = Math.max(loadedMinAge + 1, Math.min(100, data.max_age || 65));
        const loadedDistance = Math.max(1, Math.min(100, data.max_distance || 50));
        const loadedNewMatchNotifications =
          typeof data.new_match_notifications === 'boolean'
            ? data.new_match_notifications
            : true;

        setMinAge(loadedMinAge);
        setMaxAge(loadedMaxAge);
        setMaxDistance(loadedDistance);
        setNewMatchNotifications(loadedNewMatchNotifications);

        setPreferredElements(Array.isArray(data.preferred_elements) ? data.preferred_elements : []);
        setBlockedSigns(Array.isArray(data.blocked_signs) ? data.blocked_signs : []);

        setLocation(data.location || '');
        setSexualOrientation(data.sexual_orientation || 'Select');
        setGenderPreferenceLabel(data.gender_preference || 'Select');

        // Update shared values
        minAgePosition.value = 0; // minAge is fixed at 18, so position is always 0
        maxAgePosition.value = getSliderPosition(loadedMaxAge, 19, 100);
        distancePosition.value = getSliderPosition(loadedDistance, 1, 100);
      } else if (error && (error.code === 'PGRST205' || (error.message && error.message.includes('Could not find the table')))) {
        // If the table is missing, attempt to sync any locally-saved preferences after the migration is applied
        try {
          const local = await AsyncStorage.getItem('unsaved_discovery_preferences');
          if (local) {
            const prefs = JSON.parse(local);
            const { error: upsertErr } = await supabase
              .from('user_preferences')
              .upsert(prefs, { onConflict: 'user_id' });
            if (!upsertErr) {
              await AsyncStorage.removeItem('unsaved_discovery_preferences');
              console.log('Synced local preferences to user_preferences table after migration');
              // Apply preferences locally
              const appliedMin = Math.max(18, Math.min(100, (typeof prefs.min_age === 'number' ? prefs.min_age : minAge)));
              const appliedMax = Math.max(appliedMin + 1, Math.min(100, (typeof prefs.max_age === 'number' ? prefs.max_age : maxAge)));
              const appliedDistance = Math.max(1, Math.min(100, (typeof prefs.max_distance === 'number' ? prefs.max_distance : maxDistance)));
              const appliedNewMatchNotifications =
                typeof prefs.new_match_notifications === 'boolean'
                  ? prefs.new_match_notifications
                  : true;

              setMinAge(appliedMin);
              setMaxAge(appliedMax);
              setMaxDistance(appliedDistance);
              setNewMatchNotifications(appliedNewMatchNotifications);
              minAgePosition.value = 0; // minAge is fixed at 18, so position is always 0
              maxAgePosition.value = getSliderPosition(appliedMax, 19, 100);
              distancePosition.value = getSliderPosition(appliedDistance, 1, 100);
            }
          }
        } catch (e) {
          // ignore
        }
      }

      // Backward-compatibility fallback: if no user_preferences row, try user_profiles once.
      if (error || !data) {
        try {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('location, sexual_orientation, gender, gender_detail')
            .eq('user_id', user.id)
            .single();
          if (profile) {
            setLocation(profile.location || '');
            setSexualOrientation(profile.sexual_orientation || 'Select');
            setGenderPreferenceLabel(profile.gender_detail || profile.gender || 'Select');
          }
        } catch (e) {
          // ignore missing profile
        }
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
      // Don't show alert on initial load failure, just use defaults
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    try {
      setSaving(true);
      const userResult = await supabase.auth.getUser();
      const user = userResult?.data?.user;
      if (!user) {
        showAlert('Error', 'User not authenticated');
        setSaving(false);
        return;
      }

      // Validate preferences
      if (minAge >= maxAge) {
        showAlert('Error', 'Minimum age must be less than maximum age');
        setSaving(false);
        return;
      }

      // Save all discovery fields to user_preferences
      // Use upsert to insert or update based on user_id (which is unique)
      const preferencesData = {
        user_id: user.id,
        min_age: minAge,
        max_age: maxAge,
        max_distance: maxDistance,
        location: location || null,
        gender_preference: genderPreferenceLabel && genderPreferenceLabel !== 'Select' ? genderPreferenceLabel : null,
        sexual_orientation: sexualOrientation && sexualOrientation !== 'Select' ? sexualOrientation : null,
        new_match_notifications: newMatchNotifications,
        preferred_elements: preferredElements,
        blocked_signs: blockedSigns,
        updated_at: new Date().toISOString(),
      };

      // Upsert will insert if record doesn't exist, or update if it does
      const result = await supabase
        .from('user_preferences')
        .upsert(preferencesData, {
          onConflict: 'user_id',
          ignoreDuplicates: false
        });

      if (result.error) {
        console.error('Error saving preferences:', result.error);
        const msg = result.error.message || '';
        if (result.error.code === 'PGRST205' || msg.includes('Could not find the table')) {
          // Store locally so user's changes feel saved and can be synced later
          try {
            await AsyncStorage.setItem('unsaved_discovery_preferences', JSON.stringify(preferencesData));
            showAlert(
              'Saved locally',
              "The 'user_preferences' table does not exist yet. Your preferences were saved locally and will be applied after the database migration. Please run 'supabase/migrations/014_create_user_preferences_table.sql'.",
              [{ text: 'OK', onPress: () => router.back() }]
            );
          } catch (e) {
            console.error('Failed to persist preferences locally:', e);
            showAlert(
              'Error',
              "Database migration required: The 'user_preferences' table doesn't exist on the database. Please run the migration file 'supabase/migrations/014_create_user_preferences_table.sql' and try again."
            );
          }
        } else {
          showAlert('Error', result.error.message || 'Failed to save preferences');
        }
        setSaving(false);
      } else {
        showAlert('Success', 'All preferences saved successfully!');
        router.back();
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save preferences';
      showAlert('Error', errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = async () => {
    showAlert(
      'Reset Preferences',
      'Are you sure you want to reset all preferences to default values?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              // Reset all state to defaults
              setMinAge(18);
              setMaxAge(65);
              setMaxDistance(50);
              setLocation('');
              setGenderPreferenceLabel('Select');
              setSexualOrientation('Select');
              setNewMatchNotifications(true);

              // Measure positions after reset for smooth slider updates
              setTimeout(() => {
                measureSliderPositions();
              }, 100);

              // Save defaults to database
              const userResult = await supabase.auth.getUser();
              const user = userResult?.data?.user;
              if (user) {
                // Reset all discovery fields in user_preferences
                const preferencesData = {
                  user_id: user.id,
                  min_age: 18,
                  max_age: 65,
                  max_distance: 50,
                  location: null,
                  gender_preference: null,
                  sexual_orientation: null,
                  new_match_notifications: true,
                  updated_at: new Date().toISOString(),
                };

                await supabase
                  .from('user_preferences')
                  .upsert(preferencesData, {
                    onConflict: 'user_id',
                    ignoreDuplicates: false
                  });

                showAlert('Success', 'All preferences have been reset to default values.');
              }
            } catch (error) {
              console.error('Error resetting preferences:', error);
              showAlert('Error', 'Failed to reset preferences. Please try again.');
            }
          },
        },
      ]
    );
  };

  // --- Location helpers: suggestions and device-based autofill ---------------------------------
  const fetchLocationSuggestions = async (query: string) => {
    // If query is empty, fetch popular locations
    if (!query || query.trim().length === 0) {
      try {
        setSuggestionsLoading(true);
        const popularLocations = [
          'Mumbai, Maharashtra, India',
          'Delhi, India',
          'Bangalore, Karnataka, India',
          'Hyderabad, Telangana, India',
          'Chennai, Tamil Nadu, India',
          'Kolkata, West Bengal, India'
        ];
        const items = popularLocations.map((location, idx) => ({ id: `popular_${idx}`, label: location }));
        setLocationSuggestions(items);
      } catch (e) {
        console.warn('Failed to fetch popular locations', e);
        setLocationSuggestions([]);
      } finally {
        setSuggestionsLoading(false);
      }
      return;
    }

    if (query.trim().length < 2) {
      setLocationSuggestions([]);
      return;
    }
    try {
      setSuggestionsLoading(true);
      // Use OpenStreetMap Nominatim public search for suggestions (no API key required)
      const resp = await fetchWithTimeout(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=6`,
        undefined,
        10000
      );
      const json = await resp.json();
      const items = (json || []).map((it: any) => ({ id: it.place_id?.toString() || it.osm_id?.toString() || it.lat + ',' + it.lon, label: it.display_name }));
      setLocationSuggestions(items);
    } catch (e) {
      console.warn('Failed to fetch location suggestions', e);
      setLocationSuggestions([]);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const useCurrentLocation = async () => {
    setIsGettingLocation(true);
    try {
      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showAlert(
          'Permission required',
          'Location permission is required to use your current location',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open settings', onPress: () => Linking.openSettings() },
          ]
        );
        setIsGettingLocation(false);
        return;
      }

      // Get current position with better accuracy options
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const latitude = pos.coords.latitude;
      const longitude = pos.coords.longitude;

      // Try expo reverse geocode first
      let label = '';
      try {
        const places = await Location.reverseGeocodeAsync({ latitude, longitude });
        const place = (places && places[0]) || null;
        if (place) {
          const parts = [place.city || place.subregion || place.region, place.country].filter(Boolean);
          label = parts.join(', ');
        }
      } catch (inner) {
        console.warn('expo reverseGeocode failed, will attempt remote reverse geocode', inner);
      }

      // Fallback to Nominatim reverse if no readable label
      if (!label) {
        try {
          const resp = await fetchWithTimeout(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            {
              headers: {
                'User-Agent': 'AstroDate-App/1.0',
              },
            },
            10000
          );
          const json = await resp.json();
          if (json && json.display_name) {
            label = json.display_name;
          }
        } catch (e) {
          console.warn('Nominatim reverse failed', e);
        }
      }

      // Final fallback to raw coords
      if (!label) {
        label = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      }

      // Update UI immediately and persist
      setTempLocation(label);
      setLocation(label);
      setLocationSuggestions([]);

      await saveLocationDirect(label);
    } catch (e: any) {
      console.error('Error using current location', e);
      const msg = e?.message || 'Failed to determine current location';
      showAlert('Error', msg);
    } finally {
      setIsGettingLocation(false);
    }
  };
  // Persist a location string directly to the user's profile and close the editor on success
  const saveLocationDirect = async (label: string) => {
    try {
      setSavingDialog(true);
      const userResult = await supabase.auth.getUser();
      const user = userResult?.data?.user;
      if (!user) {
        showAlert('Error', 'User not authenticated');
        return;
      }

      const { error } = await supabase
        .from('user_preferences')
        .upsert(
          {
            user_id: user.id,
            location: label,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );

      if (error) throw error;

      setLocation(label);
      setExpandedSection(null);
      showAlert('Saved', 'Location set to your current location');
    } catch (err: any) {
      console.error('Error saving location:', err);
      showAlert('Error', err?.message || 'Failed to save location');
    } finally {
      setSavingDialog(false);
    }
  };

  // Save inline dialog changes (location, gender, sexual orientation) to user_profiles
  const saveDialogChanges = async () => {
    try {
      setSavingDialog(true);
      const userResult = await supabase.auth.getUser();
      const user = userResult?.data?.user;
      if (!user) {
        showAlert('Error', 'User not authenticated');
        setSavingDialog(false);
        return;
      }

      // Validate sexual orientation selection
      if (activeDialog === 'sexual_orientation') {
        if (!tempSexualOrientation || tempSexualOrientation.trim() === '') {
          showAlert('Error', 'Please select a sexual orientation');
          setSavingDialog(false);
          return;
        }
      }

      if (activeDialog === 'location' || activeDialog === 'gender' || activeDialog === 'sexual_orientation') {
        const updates: any = { updated_at: new Date().toISOString() };
        if (activeDialog === 'location') {
          updates.location = tempLocation;
        } else if (activeDialog === 'gender') {
          updates.gender_preference = tempGender;
        } else if (activeDialog === 'sexual_orientation') {
          updates.sexual_orientation = tempSexualOrientation;
          console.log('[Save] Sexual orientation value:', tempSexualOrientation);
        }

        console.log('[Save] Updating user_preferences with:', updates);
        const { error } = await supabase
          .from('user_preferences')
          .upsert({ user_id: user.id, ...updates }, { onConflict: 'user_id' });

        if (error) {
          console.error('[Save] Database error:', error);
          throw error;
        }

        console.log('[Save] Update successful');

        // Update local state
        if (activeDialog === 'location') setLocation(tempLocation);
        if (activeDialog === 'gender') setGenderPreferenceLabel(tempGender);
        if (activeDialog === 'sexual_orientation') {
          console.log('[Save] Setting sexual orientation state to:', tempSexualOrientation);
          setSexualOrientation(tempSexualOrientation);
        }
      } else {
        // For age/distance, upsert into preferences
        const prefsUpdates: any = { updated_at: new Date().toISOString() };
        if (activeDialog === 'age') {
          prefsUpdates.min_age = tempMinAge;
          prefsUpdates.max_age = tempMaxAge;
        }
        if (activeDialog === 'distance') {
          prefsUpdates.max_distance = tempDistance;
        }

        const { error: prefErr } = await supabase
          .from('user_preferences')
          .upsert({ user_id: user.id, ...prefsUpdates }, { onConflict: 'user_id' });

        if (prefErr) throw prefErr;

        // Update local state
        if (activeDialog === 'age') {
          setMinAge(tempMinAge);
          setMaxAge(tempMaxAge);
        }
        if (activeDialog === 'distance') setMaxDistance(tempDistance);
      }

      setActiveDialog(null);
      showAlert('Saved', 'Changes saved successfully');
    } catch (err: any) {
      console.error('Error saving dialog changes:', err);
      showAlert('Error', err?.message || 'Failed to save changes');
    } finally {
      setSavingDialog(false);
    }
  };

  // Save for expanded inline sections
  const saveExpandedSection = async (section: 'location' | 'gender' | 'sexual_orientation' | 'age' | 'distance') => {
    try {
      setSavingDialog(true);
      const userResult = await supabase.auth.getUser();
      const user = userResult?.data?.user;
      if (!user) {
        showAlert('Error', 'User not authenticated');
        return;
      }

      if (section === 'location' || section === 'gender' || section === 'sexual_orientation') {
        const updates: any = { updated_at: new Date().toISOString() };
        if (section === 'location') updates.location = tempLocation;
        if (section === 'gender') updates.gender_preference = tempGender;
        if (section === 'sexual_orientation') updates.sexual_orientation = tempSexualOrientation;

        const { error } = await supabase
          .from('user_preferences')
          .upsert({ user_id: user.id, ...updates }, { onConflict: 'user_id' });

        if (error) throw error;

        if (section === 'location') setLocation(tempLocation);
        if (section === 'gender') setGenderPreferenceLabel(tempGender);
        if (section === 'sexual_orientation') setSexualOrientation(tempSexualOrientation);
      } else {
        const prefsUpdates: any = { updated_at: new Date().toISOString() };
        if (section === 'age') {
          prefsUpdates.min_age = tempMinAge;
          prefsUpdates.max_age = tempMaxAge;
        }
        if (section === 'distance') prefsUpdates.max_distance = tempDistance;

        const { error: prefErr } = await supabase
          .from('user_preferences')
          .upsert({ user_id: user.id, ...prefsUpdates }, { onConflict: 'user_id' });

        if (prefErr) throw prefErr;

        if (section === 'age') {
          setMinAge(tempMinAge);
          setMaxAge(tempMaxAge);
        }
        if (section === 'distance') setMaxDistance(tempDistance);
      }

      setExpandedSection(null);
      showAlert('Saved', 'Changes saved successfully');
    } catch (err: any) {
      console.error('Error saving expanded section:', err);
      showAlert('Error', err?.message || 'Failed to save changes');
    } finally {
      setSavingDialog(false);
    }
  };

  // Animated styles for slider thumbs
  const minAgeThumbStyle = useAnimatedStyle(() => ({
    left: minAgePosition.value - 12,
    transform: [{ scale: 1 }],
    backgroundColor: '#A855F7',
  }));

  const maxAgeThumbStyle = useAnimatedStyle(() => {
    const isActive = draggingHandleValue.value === 'maxAge';
    return {
      left: maxAgePosition.value - 12,
      transform: [{ scale: isActive ? 1.1 : 1 }],
      backgroundColor: isActive ? '#8B5CF6' : '#A855F7',
    };
  });

  const distanceThumbStyle = useAnimatedStyle(() => {
    const isActive = draggingHandleValue.value === 'distance';
    return {
      left: distancePosition.value - 12,
      transform: [{ scale: isActive ? 1.1 : 1 }],
      backgroundColor: isActive ? '#8B5CF6' : '#A855F7',
    };
  });

  // Animated styles for track fill
  const ageTrackFillStyle = useAnimatedStyle(() => ({
    width: maxAgePosition.value,
  }));

  const distanceTrackFillStyle = useAnimatedStyle(() => ({
    width: distancePosition.value,
  }));

  return (
    <LinearGradient
      colors={['#1a0d2e', '#2d1b4e', '#4a2c5a']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[styles.container, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.back()}
          activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Discovery Preferences</Text>
        <TouchableOpacity
          style={styles.resetButton}
          onPress={resetToDefaults}
          activeOpacity={0.7}>
          <Text style={styles.resetButtonText}>Reset</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Discovery quick actions (moved from Profile) */}
        <View style={styles.discoveryQuickActions}>
          <TouchableOpacity style={styles.menuRow} activeOpacity={0.8} onPress={() => {
            setTempLocation(location);
            setExpandedSection(expandedSection === 'location' ? null : 'location');
          }}>
            <View style={styles.menuLeft}>
              <View style={styles.menuIcon}><MaterialIcons name="place" size={18} color="#FFFFFF" /></View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>Location</Text>
                <Text style={styles.menuSubtitle}>{location || 'Set your city'}</Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={18} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Inline Location editor */}
          {expandedSection === 'location' && (
            <View style={styles.expandedCard}>
              <Text style={styles.expandedLabel}>Location</Text>

              <TextInput
                style={styles.expandedInput}
                value={tempLocation}
                onChangeText={(text) => {
                  setTempLocation(text);
                  // Debounce suggestions
                  if (suggestionsTimeout.current) clearTimeout(suggestionsTimeout.current);
                  suggestionsTimeout.current = setTimeout(() => {
                    fetchLocationSuggestions(text);
                  }, 400);
                }}
                onFocus={() => {
                  // Suggestions will appear as user types
                }}
                placeholder="Enter city or location"
                placeholderTextColor="rgba(255,255,255,0.4)"
              />

              {/* Quick action: use device location */}
              <TouchableOpacity style={styles.useCurrentLocation} onPress={isGettingLocation ? undefined : useCurrentLocation} activeOpacity={0.8}>
                {isGettingLocation ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <ActivityIndicator color="#FFFFFF" />
                    <Text style={[styles.useCurrentLocationText, { marginLeft: 10 }]}>Detecting…</Text>
                  </View>
                ) : (
                  <Text style={styles.useCurrentLocationText}>Use current location</Text>
                )}
              </TouchableOpacity>

              {/* Suggestions list */}
              {locationSuggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  {suggestionsLoading ? (
                    <Text style={styles.suggestionText}>Searching…</Text>
                  ) : (
                    locationSuggestions.map((s) => (
                      <TouchableOpacity key={s.id} style={styles.suggestionRow} onPress={() => {
                        setTempLocation(s.label);
                        setLocationSuggestions([]);
                      }} activeOpacity={0.7}>
                        <Text style={styles.suggestionText}>{s.label}</Text>
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              )}
              <View style={styles.expandedActions}>
                <TouchableOpacity style={styles.expandedCancel} onPress={() => setExpandedSection(null)} activeOpacity={0.7}>
                  <Text style={styles.expandedCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.expandedSave} onPress={() => saveExpandedSection('location')} activeOpacity={0.7}>
                  <Text style={styles.expandedSaveText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <TouchableOpacity style={styles.menuRow} activeOpacity={0.8} onPress={() => { setTempGender(genderPreferenceLabel); setActiveDialog('gender'); }}>
            <View style={styles.menuLeft}>
              <View style={styles.menuIcon}><MaterialIcons name="person" size={18} color="#FFFFFF" /></View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>Gender</Text>
                <Text style={styles.menuSubtitle}>{genderPreferenceLabel}</Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={18} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuRow} activeOpacity={0.8} onPress={() => { setTempSexualOrientation(sexualOrientation && sexualOrientation !== 'Select' ? sexualOrientation : ''); setActiveDialog('sexual_orientation'); }}>
            <View style={styles.menuLeft}>
              <View style={styles.menuIcon}><MaterialIcons name="favorite" size={18} color="#FFFFFF" /></View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>Sexual Orientation</Text>
                <Text style={styles.menuSubtitle}>{sexualOrientation || 'Select'}</Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={18} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={[styles.menuCard, expandedSection === 'age' && styles.menuCardExpanded]} onLayout={(e) => { if (expandedSection !== 'age') ageSectionY.current = e.nativeEvent.layout.y; }}>
            <TouchableOpacity style={styles.menuRowInner} activeOpacity={0.8} onPress={() => { setTempMinAge(minAge); setTempMaxAge(maxAge); setExpandedSection(expandedSection === 'age' ? null : 'age'); measureSliderPositions(); setTimeout(() => scrollViewRef.current?.scrollTo({ y: ageSectionY.current - 20, animated: true }), 50); }}>
              <View style={styles.menuLeft}>
                <View style={styles.menuIcon}><MaterialIcons name="calendar-today" size={18} color="#FFFFFF" /></View>
                <View style={styles.menuContent}>
                  <Text style={styles.menuTitle}>Age Range</Text>
                  <Text style={styles.menuSubtitle}>{minAge} - {maxAge}</Text>
                </View>
              </View>
              <MaterialIcons name={expandedSection === 'age' ? 'expand-less' : 'chevron-right'} size={18} color="#FFFFFF" />
            </TouchableOpacity>

            {expandedSection === 'age' && (
              <View style={styles.expandedContent}>
                <View style={styles.sliderValueContainer}>
                  <Text style={styles.sliderValueText}>{minAge} - {maxAge}</Text>
                </View>

                <View style={styles.sliderContainer}>
                  <View style={styles.sliderWrapper} ref={ageSliderRef}>
                    <View style={styles.sliderTrack}>
                      <View style={styles.sliderTrackBackground} />
                      <Animated.View style={[styles.sliderTrackFill, ageTrackFillStyle]} />

                      {/* Min age handle — was previously missing, causing minAge to be stuck at 18 */}
                      <GestureDetector gesture={minAgeGesture}>
                        <Animated.View style={[styles.sliderThumb, minAgeThumbStyle]} />
                      </GestureDetector>

                      <GestureDetector gesture={maxAgeGesture}>
                        <Animated.View style={[styles.sliderThumb, maxAgeThumbStyle]} />
                      </GestureDetector>
                    </View>
                  </View>
                </View>
              </View>
            )}
          </View>

          <View style={[styles.menuCard, expandedSection === 'distance' && styles.menuCardExpanded]} onLayout={(e) => { if (expandedSection !== 'distance') distanceSectionY.current = e.nativeEvent.layout.y; }}>
            <TouchableOpacity style={styles.menuRowInner} activeOpacity={0.8} onPress={() => { setTempDistance(maxDistance); setExpandedSection(expandedSection === 'distance' ? null : 'distance'); measureSliderPositions(); setTimeout(() => scrollViewRef.current?.scrollTo({ y: distanceSectionY.current - 20, animated: true }), 50); }}>
              <View style={styles.menuLeft}>
                <View style={styles.menuIcon}><MaterialIcons name="gps-fixed" size={18} color="#FFFFFF" /></View>
                <View style={styles.menuContent}>
                  <Text style={styles.menuTitle}>Distance</Text>
                  <Text style={styles.menuSubtitle}>{maxDistance} miles</Text>
                </View>
              </View>
              <MaterialIcons name={expandedSection === 'distance' ? 'expand-less' : 'chevron-right'} size={18} color="#FFFFFF" />
            </TouchableOpacity>

            {expandedSection === 'distance' && (
              <View style={styles.expandedContent}>
                <View style={styles.sliderValueContainer}>
                  <Text style={styles.sliderValueText}>{maxDistance} miles</Text>
                </View>

                <View style={styles.sliderContainer}>
                  <View style={styles.sliderWrapper} ref={distanceSliderRef}>
                    <View style={styles.sliderTrack}>
                      <View style={styles.sliderTrackBackground} />
                      <Animated.View style={[styles.sliderTrackFill, distanceTrackFillStyle]} />

                      <GestureDetector gesture={distanceGesture}>
                        <Animated.View style={[styles.sliderThumb, distanceThumbStyle]} />
                      </GestureDetector>
                    </View>
                  </View>
                </View>
              </View>
            )}
          </View>



          {/* ── Element Affinity ─────────────────────────────────────────── */}
          <View style={styles.menuCard}>
            <View style={styles.menuRowInner}>
              <View style={styles.menuLeft}>
                <View style={styles.menuIcon}>
                  <MaterialIcons name="whatshot" size={18} color="#FFFFFF" />
                </View>
                <View style={styles.menuContent}>
                  <Text style={styles.menuTitle}>Element Affinity</Text>
                  <Text style={styles.menuSubtitle}>
                    {preferredElements.length === 0
                      ? 'Show all elements'
                      : preferredElements.join(', ')}
                  </Text>
                </View>
              </View>
              {preferredElements.length > 0 && (
                <TouchableOpacity onPress={() => setPreferredElements([])} activeOpacity={0.7}>
                  <Text style={styles.resetButtonText}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.chipRow}>
              {[
                { label: '🔥 Fire', value: 'Fire' },
                { label: '🌍 Earth', value: 'Earth' },
                { label: '💨 Air', value: 'Air' },
                { label: '💧 Water', value: 'Water' },
              ].map((el) => {
                const active = preferredElements.includes(el.value);
                return (
                  <TouchableOpacity
                    key={el.value}
                    style={[styles.chip, active && styles.chipActive]}
                    activeOpacity={0.75}
                    onPress={() => {
                      setPreferredElements(
                        active
                          ? preferredElements.filter((e) => e !== el.value)
                          : [...preferredElements, el.value]
                      );
                    }}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {el.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── Sign Blocker ──────────────────────────────────────────────── */}
          <View style={styles.menuCard}>
            <View style={styles.menuRowInner}>
              <View style={styles.menuLeft}>
                <View style={styles.menuIcon}>
                  <MaterialIcons name="block" size={18} color="#FFFFFF" />
                </View>
                <View style={styles.menuContent}>
                  <Text style={styles.menuTitle}>Block Signs</Text>
                  <Text style={styles.menuSubtitle}>
                    {blockedSigns.length === 0
                      ? 'No signs blocked'
                      : `${blockedSigns.length} sign${blockedSigns.length > 1 ? 's' : ''} blocked`}
                  </Text>
                </View>
              </View>
              {blockedSigns.length > 0 && (
                <TouchableOpacity onPress={() => setBlockedSigns([])} activeOpacity={0.7}>
                  <Text style={styles.resetButtonText}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.chipRow}>
              {[
                { label: '♈ Aries',       value: 'Aries' },
                { label: '♉ Taurus',      value: 'Taurus' },
                { label: '♊ Gemini',      value: 'Gemini' },
                { label: '♋ Cancer',      value: 'Cancer' },
                { label: '♌ Leo',         value: 'Leo' },
                { label: '♍ Virgo',       value: 'Virgo' },
                { label: '♎ Libra',       value: 'Libra' },
                { label: '♏ Scorpio',     value: 'Scorpio' },
                { label: '♐ Sagittarius', value: 'Sagittarius' },
                { label: '♑ Capricorn',   value: 'Capricorn' },
                { label: '♒ Aquarius',    value: 'Aquarius' },
                { label: '♓ Pisces',      value: 'Pisces' },
              ].map((sign) => {
                const blocked = blockedSigns.includes(sign.value);
                return (
                  <TouchableOpacity
                    key={sign.value}
                    style={[styles.chip, blocked && styles.chipBlocked]}
                    activeOpacity={0.75}
                    onPress={() => {
                      setBlockedSigns(
                        blocked
                          ? blockedSigns.filter((s) => s !== sign.value)
                          : [...blockedSigns, sign.value]
                      );
                    }}
                  >
                    <Text style={[styles.chipText, blocked && styles.chipTextBlocked]}>
                      {sign.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.menuRow}>
            <View style={styles.menuLeft}>
              <View style={styles.menuIcon}><MaterialIcons name="notifications" size={18} color="#FFFFFF" /></View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>New Matches</Text>
                <Text style={styles.menuSubtitle}>When someone likes you</Text>
              </View>
            </View>
            <Switch
              value={newMatchNotifications}
              onValueChange={handleNewMatchToggle}
              trackColor={{ false: 'rgba(255,255,255,0.3)', true: '#A855F7' }}
              thumbColor={newMatchNotifications ? '#FFFFFF' : '#f4f3f4'}
            />
          </View>
        </View>







        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Inline edit dialogs */}
      <Modal visible={!!activeDialog} transparent animationType="slide" onRequestClose={() => setActiveDialog(null)}>
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogContent}>
            <Text style={styles.dialogTitle}>{activeDialog === 'location' ? 'Location' : activeDialog === 'gender' ? 'Gender' : 'Sexual Orientation'}</Text>

            {activeDialog === 'location' && (
              <View>
                <TextInput
                  style={styles.dialogInput}
                  value={tempLocation}
                  onChangeText={setTempLocation}
                  placeholder="Enter city or location"
                  placeholderTextColor="rgba(0,0,0,0.3)"
                />
              </View>
            )}

            {activeDialog === 'gender' && (
              <View>
                {['Male', 'Female', 'Non-binary', 'Prefer not to say'].map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.dialogOption, tempGender === opt && styles.dialogOptionActive]}
                    onPress={() => setTempGender(opt)}
                    activeOpacity={0.7}>
                    <Text style={[styles.dialogOptionText, tempGender === opt && styles.dialogOptionTextActive]}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {activeDialog === 'sexual_orientation' && (
              <View>
                {['Straight', 'Gay', 'Lesbian', 'Bisexual', 'Pansexual', 'Asexual', 'Prefer not to say'].map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.dialogOption, tempSexualOrientation === opt && styles.dialogOptionActive]}
                    onPress={() => setTempSexualOrientation(opt)}
                    activeOpacity={0.7}>
                    <Text style={[styles.dialogOptionText, tempSexualOrientation === opt && styles.dialogOptionTextActive]}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {activeDialog === 'age' && (
              <View>
                <View style={styles.dialogNumberRow}>
                  <Text style={styles.dialogNumberLabel}>Minimum Age</Text>
                  <View style={styles.dialogNumberControls}>
                    <TouchableOpacity onPress={() => setTempMinAge(Math.max(18, tempMinAge - 1))} style={styles.dialogNumberButton}><Text>-</Text></TouchableOpacity>
                    <Text style={styles.dialogNumberValue}>{tempMinAge}</Text>
                    <TouchableOpacity onPress={() => setTempMinAge(Math.min(tempMaxAge - 1, tempMinAge + 1))} style={styles.dialogNumberButton}><Text>+</Text></TouchableOpacity>
                  </View>
                </View>
                <View style={styles.dialogNumberRow}>
                  <Text style={styles.dialogNumberLabel}>Maximum Age</Text>
                  <View style={styles.dialogNumberControls}>
                    <TouchableOpacity onPress={() => setTempMaxAge(Math.max(tempMinAge + 1, tempMaxAge - 1))} style={styles.dialogNumberButton}><Text>-</Text></TouchableOpacity>
                    <Text style={styles.dialogNumberValue}>{tempMaxAge}</Text>
                    <TouchableOpacity onPress={() => setTempMaxAge(Math.min(100, tempMaxAge + 1))} style={styles.dialogNumberButton}><Text>+</Text></TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {activeDialog === 'distance' && (
              <View>
                <View style={styles.dialogNumberRow}>
                  <Text style={styles.dialogNumberLabel}>Maximum Distance (miles)</Text>
                  <View style={styles.dialogNumberControls}>
                    <TouchableOpacity onPress={() => setTempDistance(Math.max(1, tempDistance - 1))} style={styles.dialogNumberButton}><Text>-</Text></TouchableOpacity>
                    <Text style={styles.dialogNumberValue}>{tempDistance}</Text>
                    <TouchableOpacity onPress={() => setTempDistance(Math.min(500, tempDistance + 1))} style={styles.dialogNumberButton}><Text>+</Text></TouchableOpacity>
                  </View>
                </View>
              </View>
            )}



            <View style={styles.dialogActions}>
              <TouchableOpacity style={styles.dialogButton} onPress={() => setActiveDialog(null)} activeOpacity={0.7}>
                <Text style={styles.dialogButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.dialogButton, styles.dialogButtonPrimary]} onPress={saveDialogChanges} activeOpacity={0.7} disabled={savingDialog}>
                <Text style={[styles.dialogButtonText, styles.dialogButtonPrimaryText]}>{savingDialog ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Save Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, (saving || loading) && styles.saveButtonDisabled]}
          onPress={savePreferences}
          disabled={saving || loading}
          activeOpacity={0.7}>
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : 'Save Preferences'}
          </Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'transparent',
  },
  headerButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(168, 85, 247, 0.8)',
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
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 12,
  },
  resetButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  resetButtonText: {
    color: '#A855F7',
    fontSize: 12,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 12,
  },
  section: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },  /* Discovery quick actions (moved from profile) */
  discoveryQuickActions: { marginBottom: 16 },
  menuRow: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  /* Card container used for expandable rows */
  menuCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
  },
  menuCardExpanded: {
    paddingBottom: 16,
  },
  menuRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  expandedContent: {
    marginTop: 8,
    alignItems: 'stretch',
  },
  sliderValueContainer: {
    alignItems: 'center',
    marginBottom: 10,
    paddingVertical: 6,
  },
  sliderValueText: {
    color: '#A855F7',
    fontSize: 16,
    fontWeight: '700',
  },
  menuLeft: { flexDirection: 'row', alignItems: 'center' },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  menuContent: { justifyContent: 'center' },
  menuTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  menuSubtitle: { color: 'rgba(255,255,255,0.72)', fontSize: 12 }, sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  sectionSubtitle: {
    color: '#A855F7',
    fontSize: 16,
    fontWeight: '600',
  },
  sectionDescription: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    marginBottom: 16,
  },
  sliderContainer: {
    marginTop: 4,
    gap: 0,
  },
  sliderWrapper: {
    marginTop: 4,
  },
  sliderLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  sliderTrackContainer: {
    height: 32,
    position: 'relative',
    justifyContent: 'center',
    marginBottom: 8,
  },
  sliderTrack: {
    height: 32,
    position: 'relative',
    justifyContent: 'center',
    marginBottom: 8,
  },
  sliderTrackBackground: {
    height: 6,
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 3,
    position: 'absolute',
  },
  sliderTrackFill: {
    height: 6,
    backgroundColor: '#A855F7',
    borderRadius: 3,
    position: 'absolute',
    left: 0,
  },
  sliderThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#A855F7',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    position: 'absolute',
    ...Platform.select({
      ios: {
        shadowColor: '#A855F7',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 3,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  sliderThumbDraggable: {
    zIndex: 10,
  },
  sliderThumbActive: {
    transform: [{ scale: 1.15 }],
    backgroundColor: '#8B5CF6',
  },
  quickSelectContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  quickSelectButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  quickSelectButtonActive: {
    backgroundColor: '#A855F7',
    borderColor: '#A855F7',
  },
  quickSelectText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '500',
  },
  quickSelectTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  optionContent: {
    flex: 1,
    marginRight: 16,
  },
  optionLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  optionDescription: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
  },
  footer: {
    padding: 12,
    paddingBottom: 24,
    backgroundColor: 'transparent',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  saveButton: {
    backgroundColor: '#A855F7',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#A855F7',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  bottomSpacer: {
    height: 24,
  },
  dialogOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  dialogContent: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    minHeight: 220,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  dialogInput: {
    backgroundColor: 'rgba(0,0,0,0.04)',
    padding: 12,
    borderRadius: 8,
    color: '#111827',
  },
  dialogOption: {
    paddingVertical: 12,
  },
  dialogOptionActive: {
    backgroundColor: 'rgba(168,85,247,0.08)',
    borderRadius: 8,
  },
  dialogOptionText: {
    fontSize: 16,
    color: '#111827',
  },
  dialogOptionTextActive: {
    fontWeight: '700',
    color: '#7C3AED',
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
  },
  dialogButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  dialogButtonPrimary: {
    backgroundColor: '#7C3AED',
  },
  dialogButtonText: {
    color: '#111827',
    fontWeight: '600',
  },
  dialogButtonPrimaryText: {
    color: '#FFFFFF',
  },
  dialogNumberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 8,
  },
  dialogNumberLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  dialogNumberControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dialogNumberButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.04)',
    minWidth: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogNumberValue: {
    minWidth: 36,
    textAlign: 'center',
    fontWeight: '700',
  },
  expandedCard: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  expandedLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  expandedInput: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 10,
    borderRadius: 8,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  useCurrentLocation: {
    alignSelf: 'flex-start',
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.03)'
  },
  useCurrentLocationText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  suggestionsContainer: {
    marginTop: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.02)',
    paddingVertical: 6,
  },
  suggestionRow: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  suggestionText: {
    color: 'rgba(255,255,255,0.9)'
  },
  expandedActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  expandedCancel: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  expandedCancelText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  expandedSave: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#7C3AED',
  },
  expandedSaveText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  // ── Astro filter chips ──────────────────────────────────────────────────
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 4,
    paddingTop: 8,
    paddingBottom: 4,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  chipActive: {
    backgroundColor: 'rgba(124,58,237,0.35)',
    borderColor: '#A855F7',
  },
  chipBlocked: {
    backgroundColor: 'rgba(220,38,38,0.25)',
    borderColor: '#F87171',
  },
  chipText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#E9D5FF',
    fontWeight: '700',
  },
  chipTextBlocked: {
    color: '#FCA5A5',
    fontWeight: '700',
  },
});