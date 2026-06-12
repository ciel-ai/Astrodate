import { getDailyHoroscope, parseTzString } from '@/lib/astro';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface BirthDetails {
  dob: string;
  tob: string;
  pob: string;
  lat: string;
  lng: string;
  tz: string;
}

export default function InsightsScreen() {
  const router = useRouter();
  const [horoscope, setHoroscope] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const getBirthDetails = async (): Promise<BirthDetails | null> => {
    try {
      // Try to get from AsyncStorage first
      const stored = await AsyncStorage.getItem('userBirthDetails');
      if (stored) {
        return JSON.parse(stored);
      }
      return null;
    } catch (err) {
      console.error('Error getting birth details:', err);
      return null;
    }
  };

  const fetchHoroscope = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const birthDetails = await getBirthDetails();

      if (!birthDetails) {
        setError('Please complete your birth details in onboarding to view your daily horoscope.');
        return;
      }

      const dob = new Date(birthDetails.dob);
      const tob = new Date(birthDetails.tob);
      const lat = parseFloat(birthDetails.lat);
      const lon = parseFloat(birthDetails.lng);

      // Calculate timezone offset
      const timezoneHours = parseTzString(birthDetails.tz);

      const horoscopeData = await getDailyHoroscope({
        day: dob.getDate(),
        month: dob.getMonth() + 1,
        year: dob.getFullYear(),
        hour: tob.getHours(),
        min: tob.getMinutes(),
        lat: lat,
        lon: lon,
        tzone: timezoneHours,
        language: 'en',
      });

      if (horoscopeData === null) {
  setError('Horoscope service is currently unavailable. Please try again later.');
} else {
  setHoroscope(horoscopeData);
}
    } catch (err: any) {
      console.error('Error fetching horoscope:', err);
      setError(err.message || 'Failed to fetch daily horoscope. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHoroscope();
  }, []);

  const onRefresh = () => {
    fetchHoroscope(true);
  };

  // Category mapping for better display names
  const getCategoryDisplayName = (key: string): string => {
    const categoryMap: { [key: string]: string } = {
      health: 'Health & Wellness',
      emotions: 'Emotions & Feelings',
      profession: 'Profession & Career',
      professions: 'Profession & Career',
      career: 'Career',
      luck: 'Luck & Fortune',
      personal_life: 'Personal Life',
      personal: 'Personal Life',
      love: 'Love & Relationships',
      relationships: 'Love & Relationships',
      finance: 'Finance & Money',
      money: 'Finance & Money',
      family: 'Family',
      travel: 'Travel',
      education: 'Education & Learning',
      spirituality: 'Spirituality',
      creativity: 'Creativity',
      communication: 'Communication',
    };
    return categoryMap[key.toLowerCase()] || key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
  };

  // Render category-based predictions
  const renderCategoryPredictions = (data: any) => {
    if (!data || typeof data !== 'object') return null;

    // Common category keys to look for
    const categoryKeys = [
      'health', 'emotions', 'profession', 'professions', 'career', 'luck',
      'personal_life', 'personal', 'love', 'relationships', 'finance', 'money',
      'family', 'travel', 'education', 'spirituality', 'creativity', 'communication'
    ];

    const metadataKeys = [
      'sun_sign', 'moon_sign', 'date', 'timestamp', 'id', 'created_at', 'updated_at',
      'daily_horoscope', 'horoscope', 'prediction', 'daily_prediction', 'astro',
      'nakshatra', 'naksahtra', 'nakshatra_name', 'nakshatra_lord', 'nakshatra_deity',
      'rashi', 'sign', 'element', 'birth_date', 'prediction_date', 'horoscope_date',
      'dob', 'tob', 'pob', 'timezone', 'tzone', 'lat', 'lon', 'latitude', 'longitude'
    ];

    const categories: { key: string; value: any }[] = [];

    // First, check if prediction itself is an object with categories
    if (data.prediction && typeof data.prediction === 'object' && !Array.isArray(data.prediction)) {
      for (const key in data.prediction) {
        if (
          data.prediction.hasOwnProperty(key) &&
          data.prediction[key] !== null &&
          data.prediction[key] !== '' &&
          (categoryKeys.includes(key.toLowerCase()) ||
            (!metadataKeys.includes(key.toLowerCase()) &&
              (typeof data.prediction[key] === 'string' || Array.isArray(data.prediction[key]))))
        ) {
          categories.push({ key, value: data.prediction[key] });
        }
      }
    }

    // Check for category keys directly in the data
    for (const key of categoryKeys) {
      if (data[key] !== undefined && data[key] !== null && data[key] !== '') {
        // Avoid duplicates
        if (!categories.find(cat => cat.key === key)) {
          categories.push({ key, value: data[key] });
        }
      }
    }

    // Also check for any other keys that might be categories (not common metadata keys)
    for (const key in data) {
      if (
        data.hasOwnProperty(key) &&
        !metadataKeys.includes(key.toLowerCase()) &&
        !categoryKeys.includes(key.toLowerCase()) &&
        data[key] !== null &&
        data[key] !== '' &&
        (typeof data[key] === 'string' || Array.isArray(data[key]))
      ) {
        // Avoid duplicates
        if (!categories.find(cat => cat.key === key)) {
          categories.push({ key, value: data[key] });
        }
      }
    }

    if (categories.length === 0) return null;

    return (
      <View style={styles.categoriesContainer}>
        {categories.map((category, index) => (
          <View key={index} style={styles.categoryItem}>
            <Text style={styles.categoryTitle}>
              {getCategoryDisplayName(category.key)}
            </Text>
            <Text style={styles.categoryText}>
              {formatHoroscopeText(category.value)}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  const formatHoroscopeText = (text: any): string => {
    if (!text) return 'Horoscope data not available.';

    // Helper function to extract text from nested objects/arrays
    const extractTextFromObject = (obj: any, depth = 0): string => {
      if (depth > 3) return ''; // Prevent infinite recursion

      if (typeof obj === 'string') {
        return obj;
      }

      if (typeof obj === 'number' || typeof obj === 'boolean') {
        return String(obj);
      }

      if (Array.isArray(obj)) {
        return obj
          .map((item) => extractTextFromObject(item, depth + 1))
          .filter((item) => item.trim().length > 0)
          .join('\n\n');
      }

      if (typeof obj === 'object' && obj !== null) {
        // Try common text property names first
        const textKeys = ['text', 'content', 'message', 'description', 'prediction', 'horoscope', 'insight'];
        for (const key of textKeys) {
          if (obj[key] && typeof obj[key] === 'string') {
            return obj[key];
          }
        }

        // If no direct text property, try to combine all string values
        const stringValues: string[] = [];
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            const value = obj[key];
            if (typeof value === 'string' && value.trim().length > 0) {
              // Skip keys that look like metadata
              const skipKeys = [
                'id', 'date', 'timestamp', 'created_at', 'updated_at', 'birth_date',
                'prediction_date', 'horoscope_date', 'nakshatra', 'naksahtra', 'nakshatra_name',
                'nakshatra_lord', 'nakshatra_deity', 'dob', 'tob', 'pob', 'timezone', 'tzone'
              ];
              if (!skipKeys.includes(key.toLowerCase())) {
                stringValues.push(value);
              }
            } else if (typeof value === 'object' && value !== null) {
              const nestedText = extractTextFromObject(value, depth + 1);
              if (nestedText.trim().length > 0) {
                stringValues.push(nestedText);
              }
            }
          }
        }

        if (stringValues.length > 0) {
          return stringValues.join('\n\n');
        }
      }

      return '';
    };

    // Try to parse if it's a JSON string
    let parsed: any = text;
    if (typeof text === 'string') {
      // Check if it looks like JSON
      const trimmed = text.trim();
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
          parsed = JSON.parse(text);
        } catch (e) {
          // Not valid JSON, use as-is
          parsed = text;
        }
      } else {
        parsed = text;
      }
    }

    // Extract and format the text
    let formattedText = extractTextFromObject(parsed);

    // If extraction failed, try string conversion
    if (!formattedText || formattedText.trim().length === 0) {
      if (typeof parsed === 'string') {
        formattedText = parsed;
      } else {
        formattedText = JSON.stringify(parsed, null, 2);
      }
    }

    // Clean up the text
    formattedText = formattedText
      .replace(/\n{3,}/g, '\n\n') // Replace 3+ newlines with 2
      .replace(/\s+\./g, '.') // Remove spaces before periods
      .replace(/\s+,/g, ',') // Remove spaces before commas
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\n\s+/g, '\n') // Remove leading spaces on new lines
      .replace(/\s+\n/g, '\n') // Remove trailing spaces before newlines
      .trim();

    return formattedText;
  };

  return (
    <LinearGradient
      colors={['#1a0d2e', '#2d1b4e', '#4a2c5a']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#8B5CF6"
              colors={['#8B5CF6']}
            />
          }>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Daily Horoscope</Text>
            <Text style={styles.headerSubtitle}>
              Your personalized astrological insights for today
            </Text>
          </View>

          {loading && !refreshing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#8B5CF6" />
              <Text style={styles.loadingText}>Loading your horoscope...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : horoscope ? (
            <View style={styles.horoscopeContainer}>
              {/* Today's Date */}
              <Text style={styles.dateText}>
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </Text>

              {/* Moon Sign */}
              {horoscope.moon_sign && (
                <View style={styles.infoCard}>
                  <Ionicons name="moon-outline" size={24} color="#8B5CF6" />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Moon Sign</Text>
                    <Text style={styles.infoValue}>{horoscope.moon_sign}</Text>
                  </View>
                </View>
              )}

              {/* Today's Prediction with Categories */}
              <View style={styles.horoscopeCard}>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Today's Prediction</Text>

                </View>
                {renderCategoryPredictions(horoscope) || (
                  <View style={styles.section}>
                    <Text style={styles.horoscopeText}>
                      No category predictions available at this time.
                    </Text>
                  </View>
                )}
              </View>

              {/* Sun Sign */}
              {horoscope.sun_sign && (
                <View style={styles.infoCard}>
                  <Ionicons name="sunny-outline" size={24} color="#FFD700" />
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Sun Sign</Text>
                    <Text style={styles.infoValue}>{horoscope.sun_sign}</Text>
                  </View>
                </View>
              )}
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>

      {/* Floating Chatbot Icon */}
      <TouchableOpacity
        onPress={() => router.push('/chatbot')}
        activeOpacity={0.8}
        style={styles.chatbotFab}
      >
        <LottieView
          source={require('@/assets/images/robot-says-hello.json')}
          autoPlay
          loop
          style={styles.chatbotLottie}
        />
      </TouchableOpacity>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 32,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
    marginTop: 16,
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 24,
  },
  horoscopeContainer: {
    gap: 20,
  },
  dateText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: 8,
  },
  horoscopeCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  sectionSubtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  horoscopeText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 24,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
    gap: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  categoriesContainer: {
    gap: 20,
    marginTop: 4,
  },
  categoryItem: {
    marginBottom: 16,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#8B5CF6',
    textTransform: 'capitalize',
    marginBottom: 8,
  },
  categoryText: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 22,
  },
  chatbotFab: {
    position: 'absolute',
    right: -20,
    bottom: 80,
    zIndex: 100,
  },
  chatbotLottie: {
    width: 150,
    height: 150,
  },
});