import { getAstroDetails, parseTzString } from '@/lib/astro';
import { getTimezoneOffset } from '@/lib/astro-geo';
import { Ionicons } from '@expo/vector-icons';
import { setSecureItem } from '@/lib/secure-storage';
import * as Location from 'expo-location';
import { router, useNavigation } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuthAlert } from '@/lib/auth-alert-context';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function BirthDetailsScreen() {
  const navigation = useNavigation();
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [timeOfBirth, setTimeOfBirth] = useState<Date | null>(null);
  const [placeOfBirth, setPlaceOfBirth] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showAgeModal, setShowAgeModal] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());
  const [tempTime, setTempTime] = useState(new Date());
  const [dateInputs, setDateInputs] = useState({ year: '', month: '', day: '' });
  const [timeInputs, setTimeInputs] = useState({ hour: '', minute: '' });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [placeCoordinates, setPlaceCoordinates] = useState<{
    latitude: number;
    longitude: number;
    timezone: string;
  } | null>(null);
  const geocodeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geocodeAbortControllerRef = useRef<AbortController | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [isSubmittingProfile, setIsSubmittingProfile] = useState(false);
  const isMountedRef = useRef(true);
  const insets = useSafeAreaInsets();
  const { showAlert } = useAuthAlert();

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Cleanup: Cancel pending geocoding requests on unmount
  useEffect(() => {
    return () => {
      if (geocodeAbortControllerRef.current) {
        geocodeAbortControllerRef.current.abort();
      }
      if (geocodeTimeoutRef.current) {
        clearTimeout(geocodeTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  // Format date for display
  const formatDate = (date: Date | null): string => {
    if (!date) return 'Select date';
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  // Format time for display
  const formatTime = (date: Date | null): string => {
    if (!date) return 'Select time';
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  // Calculate maximum allowed date (18 years ago from today)
  const getMaxAllowedDate = (): Date => {
    const today = new Date();
    const maxDate = new Date(today);
    maxDate.setFullYear(today.getFullYear() - 18);
    return maxDate;
  };

  // Calculate age from date of birth
  const calculateAge = (dob: Date): number => {
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age;
  };

  // Handle date picker
  const handleDatePickerOpen = () => {
    const initialDate = dateOfBirth || new Date();
    setTempDate(initialDate);
    setDateInputs({
      year: initialDate.getFullYear().toString(),
      month: (initialDate.getMonth() + 1).toString(),
      day: initialDate.getDate().toString(),
    });
    setShowDatePicker(true);
  };

  const handleDatePickerCancel = () => {
    // Restore original date when cancelled
    if (dateOfBirth) {
      setTempDate(dateOfBirth);
      setDateInputs({
        year: dateOfBirth.getFullYear().toString(),
        month: (dateOfBirth.getMonth() + 1).toString(),
        day: dateOfBirth.getDate().toString(),
      });
    }
    setShowDatePicker(false);
  };

  const handleDatePickerConfirm = () => {
    const selectedDate = new Date(tempDate);
    const maxDate = getMaxAllowedDate();

    // Validate: ensure selected date is not after max allowed date
    if (selectedDate > maxDate) {
      setErrors((prev) => ({ ...prev, dateOfBirth: 'Please enter a valid year. You must be at least 18 years old to use this app.' }));
      setShowDatePicker(false);
      return;
    }

    setDateOfBirth(selectedDate);
    setErrors((prev) => ({ ...prev, dateOfBirth: '' }));
    setShowDatePicker(false);

    // Show age modal after DOB is confirmed
    setTimeout(() => setShowAgeModal(true), 300);
  };

  // Handle time picker
  const handleTimePickerOpen = () => {
    const initialTime = timeOfBirth || new Date();
    setTempTime(initialTime);
    setTimeInputs({
      hour: initialTime.getHours().toString(),
      minute: initialTime.getMinutes().toString(),
    });
    setShowTimePicker(true);
  };

  const handleTimePickerCancel = () => {
    // Restore original time when cancelled
    if (timeOfBirth) {
      setTempTime(timeOfBirth);
      setTimeInputs({
        hour: timeOfBirth.getHours().toString(),
        minute: timeOfBirth.getMinutes().toString(),
      });
    }
    setShowTimePicker(false);
  };

  const handleTimePickerConfirm = () => {
    setTimeOfBirth(new Date(tempTime));
    setErrors((prev) => ({ ...prev, timeOfBirth: '' }));
    setShowTimePicker(false);
  };

  // Update date components safely (no auto-correction)
  const updateDateComponent = (component: 'year' | 'month' | 'day', value: number) => {
    const newDate = new Date(tempDate);
    if (component === 'year') {
      newDate.setFullYear(value);
    } else if (component === 'month') {
      newDate.setMonth(value - 1);
    } else if (component === 'day') {
      newDate.setDate(value);
    }
    setTempDate(newDate);
  };

  // Update time components safely
  const updateTimeComponent = (component: 'hour' | 'minute', value: number) => {
    const newTime = new Date(tempTime);
    if (component === 'hour') {
      newTime.setHours(value);
    } else if (component === 'minute') {
      newTime.setMinutes(value);
    }
    setTempTime(newTime);
  };

  // Helper function to create a fetch with timeout
  const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 8000): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  };

  // Calculate timezone from longitude (faster than API call)
  const calculateTimezoneFromLongitude = (longitude: number): string => {
    // More accurate timezone calculation based on longitude
    // Each timezone is roughly 15 degrees of longitude
    const hoursOffset = Math.round(longitude / 15);
    return `UTC${hoursOffset >= 0 ? '+' : ''}${hoursOffset}`;
  };

  // Geocode place of birth to get coordinates and timezone
  const geocodePlaceOfBirth = async (placeName: string) => {
    if (!placeName.trim()) {
      setPlaceCoordinates(null);
      return;
    }

    // Cancel previous request if still pending
    if (geocodeAbortControllerRef.current) {
      geocodeAbortControllerRef.current.abort();
    }

    // Create new AbortController for this request
    const abortController = new AbortController();
    geocodeAbortControllerRef.current = abortController;

    setIsGeocoding(true);

    try {
      // Use OpenStreetMap Nominatim API for geocoding (free, no API key needed)
      // Added addressdetails=1 for better results
      const encodedPlace = encodeURIComponent(placeName);
      const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedPlace}&limit=1&addressdetails=1`;

      const response = await fetchWithTimeout(
        geocodeUrl,
        {
          headers: {
            'User-Agent': 'AstroDate-App', // Required by Nominatim
          },
          signal: abortController.signal,
        },
        8000 // 8 second timeout
      );

      if (!response.ok) {
        throw new Error('Geocoding failed');
      }

      const data = await response.json();

      // Check if request was aborted
      if (abortController.signal.aborted) {
        return;
      }

      if (data && data.length > 0) {
        const result = data[0];
        const latitude = parseFloat(result.lat);
        const longitude = parseFloat(result.lon);

        // Use timezone_with_dst API for DST-aware offset; fall back to lon/15 if it fails
        let timezone = calculateTimezoneFromLongitude(longitude);
        try {
          const tzOffset = await getTimezoneOffset(latitude, longitude, dateOfBirth || new Date());
          if (tzOffset !== null) {
            timezone = tzOffset >= 0 ? `UTC+${tzOffset}` : `UTC${tzOffset}`;
          }
        } catch { /* keep fallback */ }

        setPlaceCoordinates({ latitude, longitude, timezone });
        setErrors((prev) => ({ ...prev, placeOfBirth: '' }));
      } else {
        setPlaceCoordinates(null);
        setErrors((prev) => ({ ...prev, placeOfBirth: 'Place not found. Please try a more specific location.' }));
      }
    } catch (error) {
      // Don't show error if request was aborted (user typed again)
      if (abortController.signal.aborted) {
        return;
      }

      console.error('Geocoding error:', error);
      setPlaceCoordinates(null);

      // Show user-friendly error message
      if (error instanceof Error && error.message === 'Request timeout') {
        setErrors((prev) => ({ ...prev, placeOfBirth: 'Request timed out. Please try again or use a more specific location.' }));
      } else {
        setErrors((prev) => ({ ...prev, placeOfBirth: 'Unable to find location. Please check the place name.' }));
      }
    } finally {
      // Only update loading state if this request wasn't aborted
      if (!abortController.signal.aborted) {
        setIsGeocoding(false);
      }
    }
  };

  const getCombinedBirthDate = () => {
    if (!dateOfBirth || !timeOfBirth) return null;
    const combined = new Date(dateOfBirth);
    combined.setHours(timeOfBirth.getHours());
    combined.setMinutes(timeOfBirth.getMinutes());
    combined.setSeconds(timeOfBirth.getSeconds());
    combined.setMilliseconds(0);
    return combined;
  };

  const handleUseCurrentLocation = async () => {
    setIsGettingLocation(true);
    setErrors((prev) => ({ ...prev, placeOfBirth: '' }));
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrors((prev) => ({ ...prev, placeOfBirth: 'Location permission denied. Please enter your birth place manually.' }));
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = pos.coords;

      const res = await fetchWithTimeout(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`,
        { headers: { 'User-Agent': 'AstroDate-App' } },
        8000
      );
      const geo = await res.json();
      const addr = geo.address ?? {};
      const placeName = [
        addr.city || addr.town || addr.village || addr.county,
        addr.state,
        addr.country,
      ].filter(Boolean).join(', ');

      let timezone = calculateTimezoneFromLongitude(longitude);
      try {
        const tzOffset = await getTimezoneOffset(latitude, longitude, dateOfBirth || new Date());
        if (tzOffset !== null) timezone = tzOffset >= 0 ? `UTC+${tzOffset}` : `UTC${tzOffset}`;
      } catch { /* keep fallback */ }

      setPlaceOfBirth(placeName || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
      setPlaceCoordinates({ latitude, longitude, timezone });
    } catch (err) {
      setErrors((prev) => ({ ...prev, placeOfBirth: 'Could not detect location. Please enter manually.' }));
    } finally {
      setIsGettingLocation(false);
    }
  };

  const getTimezoneOffsetHours = (date: Date, longitude?: number) => {
    if (typeof longitude === 'number') {
      return Math.round((longitude / 15) * 10) / 10;
    }
    return -date.getTimezoneOffset() / 60;
  };

  const fetchAstroDetails = async () => {
    if (!dateOfBirth || !timeOfBirth || !placeCoordinates) {
      throw new Error('Missing birth details or location coordinates.');
    }

    const birthDateTime = getCombinedBirthDate();
    if (!birthDateTime) {
      throw new Error('Invalid birth date/time.');
    }

    // Use the DST-aware timezone already resolved when the place was geocoded.
    // Fall back to lon/15 only if the string is missing.
    const timezoneHours = placeCoordinates.timezone
      ? parseTzString(placeCoordinates.timezone)
      : getTimezoneOffsetHours(birthDateTime, placeCoordinates?.longitude);

    return await getAstroDetails({
      day: dateOfBirth.getDate(),
      month: dateOfBirth.getMonth() + 1,
      year: dateOfBirth.getFullYear(),
      hour: timeOfBirth.getHours(),
      min: timeOfBirth.getMinutes(),
      lat: placeCoordinates.latitude,
      lon: placeCoordinates.longitude,
      tzone: timezoneHours,
      language: 'en',
      mode: "basic",
    });
  };

  // Validate and proceed
  const handleGenerateProfile = async () => {
    const newErrors: { [key: string]: string } = {};

    if (!dateOfBirth) {
      newErrors.dateOfBirth = 'Date of birth is required';
    } else {
      if (calculateAge(dateOfBirth) < 18) {
        newErrors.dateOfBirth = 'You must be at least 18 years old to use Astrodate';
      }
    }

    if (!timeOfBirth) {
      newErrors.timeOfBirth = 'Time of birth is required';
    }

    if (!placeOfBirth.trim()) {
      newErrors.placeOfBirth = 'Place of birth is required';
    } else if (!placeCoordinates) {
      newErrors.placeOfBirth = 'Please select a valid place so we can fetch coordinates';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0 && dateOfBirth && timeOfBirth && placeCoordinates) {
      setIsSubmittingProfile(true);
      try {
        const astroDetails = await fetchAstroDetails();

        // Navigate to zodiac preview page with coordinates & astro data if available
        const params: Record<string, string> = {
          dob: dateOfBirth.toISOString(),
          tob: timeOfBirth.toISOString(),
          pob: placeOfBirth,
        };

        if (placeCoordinates) {
          params.lat = placeCoordinates.latitude.toString();
          params.lng = placeCoordinates.longitude.toString();
          params.tz = placeCoordinates.timezone;
        }

        if (astroDetails) {
          params.astro = encodeURIComponent(JSON.stringify(astroDetails));
        }

        // Store birth details in SecureStore for later use (e.g., horoscope)
        try {
          await setSecureItem(
            'userBirthDetails',
            JSON.stringify({
              dob: dateOfBirth.toISOString(),
              tob: timeOfBirth.toISOString(),
              pob: placeOfBirth,
              lat: placeCoordinates.latitude.toString(),
              lng: placeCoordinates.longitude.toString(),
              tz: placeCoordinates.timezone,
            })
          );
        } catch (storageError) {
          console.error('Error storing birth details:', storageError);
          // Continue even if storage fails
        }

        router.push({
          pathname: '/onboarding/zodiac-preview',
          params,
        });
      } catch (error) {
        console.error('Astro details error:', error);
        showAlert(
          'Astro Profile',
          'We could not generate your astro details. Please check your birth information and try again.'
        );
      } finally {
        if (isMountedRef.current) setIsSubmittingProfile(false);
      }
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 20 : 24}
          style={styles.keyboardView}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            bounces={Platform.OS === 'ios'}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerTopRow}>
                <TouchableOpacity
                  onPress={() => router.back()}
                  style={styles.backButton}
                  activeOpacity={0.7}>
                  <Ionicons name="arrow-back" size={24} color="#000000" />
                </TouchableOpacity>
              </View>
              <Text style={styles.headerTitle}>Your Birth Details</Text>
              <Text style={styles.headerSubtitle}>
                Help us create your personalized astro profile
              </Text>
            </View>

            {/* Form */}
            <View style={styles.formContainer}>
              {/* Date of Birth */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Date of Birth</Text>
                <TouchableOpacity
                  style={[styles.inputField, errors.dateOfBirth && styles.inputError]}
                  onPress={handleDatePickerOpen}
                  activeOpacity={0.7}>
                  <Text style={[styles.inputText, !dateOfBirth && styles.placeholderText]}>
                    {formatDate(dateOfBirth)}
                  </Text>
                  <Ionicons name="calendar-outline" size={24} color={COLORS.accent} />
                </TouchableOpacity>
                {errors.dateOfBirth && (
                  <Text style={styles.errorText}>{errors.dateOfBirth}</Text>
                )}
                <View style={styles.helperTextContainer}>
                  <Ionicons name="information-circle" size={16} color="rgba(0, 0, 0, 0.6)" />
                  <Text style={styles.helperText}>
                    Please enter your correct date of birth, it ensures precise astrological calculations and compatibility matching.
                  </Text>
                </View>
              </View>

              {/* Time of Birth */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Time of Birth</Text>
                <TouchableOpacity
                  style={[styles.inputField, errors.timeOfBirth && styles.inputError]}
                  onPress={handleTimePickerOpen}
                  activeOpacity={0.7}>
                  <Text style={[styles.inputText, !timeOfBirth && styles.placeholderText]}>
                    {formatTime(timeOfBirth)}
                  </Text>
                  <Ionicons name="time-outline" size={24} color={COLORS.accent} />
                </TouchableOpacity>
                {errors.timeOfBirth && (
                  <Text style={styles.errorText}>{errors.timeOfBirth}</Text>
                )}
                <Text style={styles.helperText}>
                  <Ionicons name="information-circle" size={16} color="rgba(0, 0, 0, 0.6)" />
                  Your exact birth time helps us generate accurate astrological insights
                </Text>
              </View>

              {/* Place of Birth */}
              <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Place of Birth</Text>
                  <TouchableOpacity
                    style={styles.geoBtn}
                    onPress={handleUseCurrentLocation}
                    activeOpacity={0.75}
                    disabled={isGettingLocation}
                  >
                    {isGettingLocation
                      ? <ActivityIndicator size="small" color="#8B5CF6" />
                      : <Ionicons name="locate" size={13} color="#8B5CF6" />
                    }
                    <Text style={styles.geoBtnText}>
                      {isGettingLocation ? 'Detecting…' : 'Use Current Location'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={[styles.textInput, errors.placeOfBirth && styles.inputError]}
                  placeholder="Enter city, state, country"
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                  value={placeOfBirth}
                  onChangeText={(text) => {
                    setPlaceOfBirth(text);
                    setErrors((prev) => ({ ...prev, placeOfBirth: '' }));

                    // Cancel previous geocoding request
                    if (geocodeAbortControllerRef.current) {
                      geocodeAbortControllerRef.current.abort();
                      setIsGeocoding(false);
                    }

                    // Clear previous timeout
                    if (geocodeTimeoutRef.current) {
                      clearTimeout(geocodeTimeoutRef.current);
                    }

                    // Debounce geocoding - wait 800ms after user stops typing (reduced from 1000ms)
                    geocodeTimeoutRef.current = setTimeout(() => {
                      if (text.trim()) {
                        geocodePlaceOfBirth(text.trim());
                      } else {
                        setPlaceCoordinates(null);
                      }
                    }, 800);
                  }}
                  autoCapitalize="words"
                />
                {errors.placeOfBirth && (
                  <Text style={styles.errorText}>{errors.placeOfBirth}</Text>
                )}
                {isGeocoding && (
                  <View style={styles.geocodingIndicator}>
                    <ActivityIndicator size="small" color="#8B5CF6" />
                    <Text style={[styles.geocodingText, { color: 'rgba(0, 0, 0, 0.6)' }]}>Finding location...</Text>
                  </View>
                )}
                {placeCoordinates && !isGeocoding && (
                  <View style={styles.coordinatesInfo}>
                    <Ionicons name="checkmark-circle" size={16} color="#8B5CF6" />
                    <Text style={[styles.coordinatesText, { color: '#8B5CF6' }]}>
                      Found: {placeCoordinates.latitude.toFixed(4)}, {placeCoordinates.longitude.toFixed(4)} • {placeCoordinates.timezone}
                    </Text>
                  </View>
                )}
              </View>
            </View>
            </ScrollView>

            {/* Generate Button */}
             <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.generateButton, isSubmittingProfile && styles.generateButtonDisabled]}
              onPress={handleGenerateProfile}
              activeOpacity={0.9}
              disabled={isSubmittingProfile}>
              {isSubmittingProfile ? (
                <>
                  <ActivityIndicator color="#FFFFFF" />
                  <Text style={styles.generateButtonText}>Generating Profile...</Text>
                </>
              ) : (
                <>
                  <Text style={styles.generateButtonText}>Generate Your Astro Profile ✨</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Date Picker Modal */}
      <Modal
        visible={showDatePicker}
        transparent
        animationType="slide"
        onRequestClose={handleDatePickerCancel}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.pickerOverlay}>
          <View style={styles.pickerModal}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Date of Birth</Text>
              <TouchableOpacity
                onPress={handleDatePickerCancel}
                activeOpacity={0.7}>
                <Ionicons name="close" size={24} color="#000000" />
              </TouchableOpacity>
            </View>
            <View style={styles.pickerContent}>
              <View style={styles.datePickerContainer}>
                <View style={styles.datePickerRow}>
                  <Text style={styles.datePickerLabel}>Year:</Text>
                  <TextInput
                    style={styles.datePickerInput}
                    value={dateInputs.year}
                    onChangeText={(text) => {
                      setDateInputs((prev) => ({ ...prev, year: text }));
                      if (text !== '') {
                        const year = parseInt(text);
                        if (!isNaN(year)) {
                          updateDateComponent('year', year);
                        }
                      }
                    }}
                    keyboardType="numeric"
                    maxLength={4}
                  />
                </View>
                <View style={styles.datePickerRow}>
                  <Text style={styles.datePickerLabel}>Month:</Text>
                  <TextInput
                    style={styles.datePickerInput}
                    value={dateInputs.month}
                    onChangeText={(text) => {
                      setDateInputs((prev) => ({ ...prev, month: text }));
                      if (text !== '') {
                        const month = parseInt(text);
                        if (!isNaN(month)) {
                          const constrainedMonth = Math.max(1, Math.min(12, month));
                          updateDateComponent('month', constrainedMonth);
                        }
                      }
                    }}
                    keyboardType="numeric"
                    maxLength={2}
                  />
                </View>
                <View style={styles.datePickerRow}>
                  <Text style={styles.datePickerLabel}>Day:</Text>
                  <TextInput
                    style={styles.datePickerInput}
                    value={dateInputs.day}
                    onChangeText={(text) => {
                      setDateInputs((prev) => ({ ...prev, day: text }));
                      if (text !== '') {
                        const day = parseInt(text);
                        if (!isNaN(day)) {
                          const constrainedDay = Math.max(1, Math.min(31, day));
                          updateDateComponent('day', constrainedDay);
                        }
                      }
                    }}
                    keyboardType="numeric"
                    maxLength={2}
                  />
                </View>
              </View>
            </View>
            <View style={styles.pickerFooter}>
              <TouchableOpacity
                style={styles.pickerConfirmButtonCentered}
                onPress={handleDatePickerConfirm}
                activeOpacity={0.7}>
                <Text style={styles.pickerButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Time Picker Modal */}
      <Modal
        visible={showTimePicker}
        transparent
        animationType="slide"
        onRequestClose={handleTimePickerCancel}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.pickerOverlay}>
          <View style={styles.pickerModal}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Time of Birth</Text>
              <TouchableOpacity
                onPress={handleTimePickerCancel}
                activeOpacity={0.7}>
                <Ionicons name="close" size={24} color="#000000" />
              </TouchableOpacity>
            </View>
            <View style={styles.pickerContent}>
              <View style={styles.datePickerContainer}>
                <View style={styles.datePickerRow}>
                  <Text style={styles.datePickerLabel}>Hour:</Text>
                  <TextInput
                    style={styles.datePickerInput}
                    value={timeInputs.hour}
                    onChangeText={(text) => {
                      setTimeInputs((prev) => ({ ...prev, hour: text }));
                      if (text !== '') {
                        const hour = parseInt(text);
                        if (!isNaN(hour)) {
                          const constrainedHour = Math.max(0, Math.min(23, hour));
                          updateTimeComponent('hour', constrainedHour);
                        }
                      }
                    }}
                    keyboardType="numeric"
                    maxLength={2}
                  />
                </View>
                <View style={styles.datePickerRow}>
                  <Text style={styles.datePickerLabel}>Minute:</Text>
                  <TextInput
                    style={styles.datePickerInput}
                    value={timeInputs.minute}
                    onChangeText={(text) => {
                      setTimeInputs((prev) => ({ ...prev, minute: text }));
                      if (text !== '') {
                        const minute = parseInt(text);
                        if (!isNaN(minute)) {
                          const constrainedMinute = Math.max(0, Math.min(59, minute));
                          updateTimeComponent('minute', constrainedMinute);
                        }
                      }
                    }}
                    keyboardType="numeric"
                    maxLength={2}
                  />
                </View>
              </View>
            </View>
            <View style={styles.pickerFooter}>
              <TouchableOpacity
                style={styles.pickerConfirmButtonCentered}
                onPress={handleTimePickerConfirm}
                activeOpacity={0.7}>
                <Text style={styles.pickerButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Age Confirmation Modal */}
      <Modal
        visible={showAgeModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          // Only allow dismissal if user is 18+
          if (dateOfBirth && calculateAge(dateOfBirth) >= 18) {
            setShowAgeModal(false);
          }
        }}>
        <View style={styles.ageModalOverlay}>
          <View style={styles.ageModalContent}>
            {dateOfBirth && calculateAge(dateOfBirth) >= 18 ? (
              // ── PASS: user is 18+ ──────────────────────────────────────
              <>
                <View style={styles.ageModalHeader}>
                  <Ionicons name="checkmark-circle" size={32} color="#8B5CF6" />
                  <Text style={styles.ageModalTitle}>Age Confirmed</Text>
                </View>
                <View style={styles.ageModalBody}>
                  <Text style={styles.ageText}>
                    You are <Text style={styles.ageNumber}>{calculateAge(dateOfBirth)}</Text> years old
                  </Text>
                  <Text style={styles.ageSubtext}>You meet the minimum age requirement.</Text>
                </View>
                <TouchableOpacity
                  style={styles.ageModalButton}
                  onPress={() => setShowAgeModal(false)}
                  activeOpacity={0.7}>
                  <Text style={styles.ageModalButtonText}>Continue</Text>
                </TouchableOpacity>
              </>
            ) : (
              // ── BLOCK: user is under 18 ────────────────────────────────
              <>
                <View style={styles.ageModalHeader}>
                  <Ionicons name="close-circle" size={40} color="#EF4444" />
                  <Text style={[styles.ageModalTitle, { color: '#EF4444' }]}>Age Restricted</Text>
                </View>
                <View style={styles.ageModalBody}>
                  <Text style={styles.ageText}>
                    You must be at least{' '}
                    <Text style={[styles.ageNumber, { color: '#EF4444' }]}>18</Text> years old
                    {'\n'}to use Astrodate.
                  </Text>
                  <Text style={styles.ageSubtext}>
                    This app is intended for adults only. Please come back when you meet the age requirement.
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.ageModalButton, { backgroundColor: '#EF4444' }]}
                  onPress={() => {
                    setShowAgeModal(false);
                    setDateOfBirth(null);
                    setDateInputs({ year: '', month: '', day: '' });
                    setErrors((prev) => ({ ...prev, dateOfBirth: 'You must be at least 18 years old to use Astrodate' }));
                  }}
                  activeOpacity={0.7}>
                  <Text style={styles.ageModalButtonText}>Go Back</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const COLORS = {
  background: '#FFFFFF',
  textPrimary: '#1B1528',
  textSecondary: '#6B7280',
  accent: '#4B0082',
  accentLight: '#6A0DAD',
  accentSoft: '#F3ECFF',
  border: '#E5E7EB',
  success: '#10B981',
  shadow: 'rgba(75, 0, 130, 0.1)',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
  },
  buttonContainer: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    paddingTop: 12,
    backgroundColor: COLORS.background,
  },
  formContainer: {
    gap: 24,
    marginBottom: 32,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  inputField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  inputError: {
    borderColor: '#EF4444',
  },
  inputText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    flex: 1,
    fontWeight: '500',
  },
  placeholderText: {
    color: COLORS.textSecondary,
  },
  textInput: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    color: COLORS.textPrimary,
    fontSize: 16,
  },
  helperTextContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 4,
  },
  helperText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    flex: 1,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    marginTop: 4,
    fontWeight: '500',
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    borderRadius: 40,
    gap: 6,
    marginTop: 16,
    shadowColor: COLORS.accent,
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 3,
  },
  generateButtonText: {
    color: COLORS.background,
    fontSize: 15,
    fontWeight: '700',
  },
  generateButtonDisabled: {
    opacity: 0.5,
  },
  // Picker Modal Styles
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    paddingBottom: Platform.OS === 'ios' ? 0 : 0,
  },
  pickerModal: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  pickerTitle: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: '700',
  },
  pickerContent: {
    padding: 20,
  },
  pickerFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    alignItems: 'center',
  },
  pickerConfirmButtonCentered: {
    paddingVertical: 14,
    paddingHorizontal: 60,
    borderRadius: 40,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    shadowColor: COLORS.accent,
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 3,
  },
  pickerButtonText: {
    color: COLORS.background,
    fontSize: 16,
    fontWeight: '700',
  },
  datePickerContainer: {
    gap: 16,
  },
  datePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  datePickerLabel: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    width: 80,
  },
  datePickerInput: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 16,
    color: COLORS.textPrimary,
    fontSize: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  geocodingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  geocodingText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  coordinatesInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    backgroundColor: COLORS.accentSoft,
    padding: 8,
    borderRadius: 8,
  },
  coordinatesText: {
    color: COLORS.accent,
    fontSize: 12,
    flex: 1,
    fontWeight: '500',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  geoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(139,92,246,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.3)',
  },
  geoBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  header: {
    marginBottom: 32,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
    letterSpacing: -0.4,
    lineHeight: 44,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Age Modal Styles
  ageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  ageModalContent: {
    backgroundColor: COLORS.background,
    borderRadius: 20,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  ageModalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  ageModalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 12,
  },
  ageModalBody: {
    alignItems: 'center',
    marginBottom: 24,
  },
  ageText: {
    fontSize: 18,
    color: COLORS.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  ageNumber: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.accent,
  },
  ageSubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  ageModalButton: {
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  ageModalButtonText: {
    color: COLORS.background,
    fontSize: 16,
    fontWeight: '700',
  },
});