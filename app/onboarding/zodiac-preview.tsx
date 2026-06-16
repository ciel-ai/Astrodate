import { saveAstroDetails } from '@/lib/astro-details';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthAlert } from '@/lib/auth-alert-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Western Zodiac Signs
const WESTERN_SIGNS = [
  { name: 'Aries', dates: 'Mar 21 - Apr 19', symbol: '♈', element: 'Fire' },
  { name: 'Taurus', dates: 'Apr 20 - May 20', symbol: '♉', element: 'Earth' },
  { name: 'Gemini', dates: 'May 21 - Jun 20', symbol: '♊', element: 'Air' },
  { name: 'Cancer', dates: 'Jun 21 - Jul 22', symbol: '♋', element: 'Water' },
  { name: 'Leo', dates: 'Jul 23 - Aug 22', symbol: '♌', element: 'Fire' },
  { name: 'Virgo', dates: 'Aug 23 - Sep 22', symbol: '♍', element: 'Earth' },
  { name: 'Libra', dates: 'Sep 23 - Oct 22', symbol: '♎', element: 'Air' },
  { name: 'Scorpio', dates: 'Oct 23 - Nov 21', symbol: '♏', element: 'Water' },
  { name: 'Sagittarius', dates: 'Nov 22 - Dec 21', symbol: '♐', element: 'Fire' },
  { name: 'Capricorn', dates: 'Dec 22 - Jan 19', symbol: '♑', element: 'Earth' },
  { name: 'Aquarius', dates: 'Jan 20 - Feb 18', symbol: '♒', element: 'Air' },
  { name: 'Pisces', dates: 'Feb 19 - Mar 20', symbol: '♓', element: 'Water' },
];

const getWesternSign = (date: Date): typeof WESTERN_SIGNS[0] => {
  const month = date.getMonth() + 1;
  const day = date.getDate();

  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return WESTERN_SIGNS[0];
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return WESTERN_SIGNS[1];
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return WESTERN_SIGNS[2];
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return WESTERN_SIGNS[3];
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return WESTERN_SIGNS[4];
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return WESTERN_SIGNS[5];
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return WESTERN_SIGNS[6];
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return WESTERN_SIGNS[7];
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return WESTERN_SIGNS[8];
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return WESTERN_SIGNS[9];
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return WESTERN_SIGNS[10];
  return WESTERN_SIGNS[11];
};

const formatSignLabel = (sign?: string | null) => {
  if (!sign) return null;
  const s = sign.trim();
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
};

// Personality Descriptions for Western Zodiac Signs
const WESTERN_PERSONALITY_DESCRIPTIONS: Record<string, string> = {
  'Aries': 'Bold, confident, and natural leader. Energetic and passionate with a pioneering spirit.',
  'Taurus': 'Stable, reliable, and sensual. Values comfort and security with a strong appreciation for beauty.',
  'Gemini': 'Curious, adaptable, and communicative. Quick-witted and loves learning and socializing.',
  'Cancer': 'Intuitive, nurturing, and deeply emotional. Values home and family with strong protective instincts.',
  'Leo': 'Bold, confident, and charismatic. Natural leader with a warm heart and generous spirit.',
  'Virgo': 'Analytical, practical, and detail-oriented. Perfectionist with a strong sense of duty.',
  'Libra': 'Diplomatic, balanced, and harmony-seeking. Values relationships and aesthetic beauty.',
  'Scorpio': 'Intense, passionate, and mysterious. Deeply emotional with strong intuition and determination.',
  'Sagittarius': 'Adventurous, optimistic, and freedom-loving. Philosophical with a love for exploration.',
  'Capricorn': 'Ambitious, disciplined, and responsible. Practical and goal-oriented with strong leadership qualities.',
  'Aquarius': 'Independent, innovative, and humanitarian. Forward-thinking with a unique perspective.',
  'Pisces': 'Compassionate, intuitive, and artistic. Dreamy and empathetic with strong creative abilities.',
};

// Personality Descriptions for Vedic Zodiac Signs (Rashi)
const VEDIC_PERSONALITY_DESCRIPTIONS: Record<string, string> = {
  'Mesha': 'Bold, confident, and natural leader. Energetic and passionate with a pioneering spirit.',
  'Vrishabha': 'Stable, reliable, and sensual. Values comfort and security with a strong appreciation for beauty.',
  'Mithuna': 'Curious, adaptable, and communicative. Quick-witted and loves learning and socializing.',
  'Karka': 'Intuitive, nurturing, and deeply emotional. Values home and family with strong protective instincts.',
  'Simha': 'Bold, confident, and charismatic. Natural leader with a warm heart and generous spirit.',
  'Kanya': 'Analytical, practical, and detail-oriented. Perfectionist with a strong sense of duty.',
  'Tula': 'Diplomatic, balanced, and harmony-seeking. Values relationships and aesthetic beauty.',
  'Vrishchika': 'Intense, passionate, and mysterious. Deeply emotional with strong intuition and determination.',
  'Dhanu': 'Adventurous, optimistic, and freedom-loving. Philosophical with a love for exploration.',
  'Makara': 'Ambitious, disciplined, and responsible. Practical and goal-oriented with strong leadership qualities.',
  'Kumbha': 'Independent, innovative, and humanitarian. Forward-thinking with a unique perspective.',
  'Meena': 'Compassionate, intuitive, and artistic. Dreamy and empathetic with strong creative abilities.',
};

// Personality Descriptions for Nakshatras
const NAKSHATRA_PERSONALITY_DESCRIPTIONS: Record<string, string> = {
  'Ashwini': 'Energetic and quick-acting. Natural healer with a pioneering spirit and strong willpower.',
  'Bharani': 'Intense and passionate. Strong sense of responsibility with creative and transformative energy.',
  'Krittika': 'Sharp and focused. Ambitious with a cutting-edge approach and strong determination.',
  'Rohini': 'Charming and materialistic. Values beauty and comfort with strong sensual nature.',
  'Mrigashira': 'Curious and restless. Seeker of knowledge with a wandering and exploring spirit.',
  'Ardra': 'Intense and transformative. Emotional depth with the ability to overcome challenges.',
  'Punarvasu': 'Optimistic and resourceful. Ability to renew and restore with a philosophical nature.',
  'Pushya': 'Nurturing and protective. Strong sense of duty with caring and supportive qualities.',
  'Ashlesha': 'Intense and mysterious. Deep emotional intelligence with transformative power.',
  'Magha': 'Regal and ambitious. Strong leadership qualities with respect for tradition and authority.',
  'Purva Phalguni': 'Creative and romantic. Loves pleasure and beauty with an artistic nature.',
  'Uttara Phalguni': 'Generous and noble. Strong sense of duty with leadership and service qualities.',
  'Hasta': 'Skillful and dexterous. Quick-witted with excellent communication and creative abilities.',
  'Chitra': 'Artistic and charismatic. Loves beauty and perfection with strong creative expression.',
  'Swati': 'Independent and freedom-loving. Diplomatic with a strong need for personal space.',
  'Vishakha': 'Ambitious and determined. Strong willpower with the ability to achieve goals.',
  'Anuradha': 'Loyal and devoted. Strong sense of friendship and commitment with spiritual depth.',
  'Jyeshta': 'Intense and powerful. Strong leadership with protective and authoritative qualities.',
  'Mula': 'Deep and transformative. Strong connection to roots with the ability to destroy and rebuild.',
  'Purva Ashadha': 'Ambitious and determined. Strong willpower with the ability to overcome obstacles.',
  'Uttara Ashadha': 'Noble and victorious. Strong leadership with the ability to achieve great success.',
  'Shravana': 'Learner and listener. Strong desire for knowledge with excellent communication skills.',
  'Dhanishta': 'Musical and prosperous. Strong sense of rhythm with the ability to create harmony.',
  'Shatabhisha': 'Mysterious and healing. Strong intuition with the ability to see beyond the surface.',
  'Purva Bhadrapada': 'Spiritual and transformative. Strong connection to higher consciousness.',
  'Uttara Bhadrapada': 'Stable and nurturing. Strong sense of duty with protective and caring nature.',
  'Revati': 'Compassionate and nurturing. Strong connection to spirituality with healing abilities.',
};

const getPersonalityDescription = (type: 'western' | 'vedic' | 'nakshatra', signName: string | null | undefined): string | null => {
  if (!signName) return null;
  
  const normalizedName = signName.trim();
  
  if (type === 'western') {
    return WESTERN_PERSONALITY_DESCRIPTIONS[normalizedName] || null;
  } else if (type === 'vedic') {
    // Try both original and formatted name
    const formatted = formatSignLabel(normalizedName);
    if (formatted) {
      return VEDIC_PERSONALITY_DESCRIPTIONS[normalizedName] || VEDIC_PERSONALITY_DESCRIPTIONS[formatted] || null;
    }
    return VEDIC_PERSONALITY_DESCRIPTIONS[normalizedName] || null;
  } else if (type === 'nakshatra') {
    return NAKSHATRA_PERSONALITY_DESCRIPTIONS[normalizedName] || null;
  }
  
  return null;
};

const enqueueSynastryPrewarm = (userId: string) => {
  void (async () => {
    try {
      const { data, error } = await supabase.rpc('enqueue_synastry_prewarm', { p_user_id: userId });

      if (error) {
        console.warn('Synastry prewarm enqueue failed:', error.message);
        return;
      }

      console.log('Synastry prewarm enqueue requested:', data);

      const { error: invokeError } = await supabase.functions.invoke('process-synastry-prewarm', {
        body: { batch_size: 10 },
      });

      if (invokeError) {
        console.warn('Synastry prewarm processor trigger failed:', invokeError.message);
      }
    } catch (error: unknown) {
      console.warn(
        'Synastry prewarm enqueue threw:',
        error instanceof Error ? error.message : String(error)
      );
    }
  })();
};

const getVedicSymbol = (signName: string | null | undefined): string => {
  if (!signName) return '♈';
  const sign = signName.toLowerCase().trim();
  
  if (sign.includes('mesha') || sign.includes('aries')) return '♈';
  if (sign.includes('vrishabha') || sign.includes('taurus')) return '♉';
  if (sign.includes('mithuna') || sign.includes('gemini')) return '♊';
  if (sign.includes('karka') || sign.includes('cancer')) return '♋';
  if (sign.includes('simha') || sign.includes('leo')) return '♌';
  if (sign.includes('kanya') || sign.includes('virgo')) return '♍';
  if (sign.includes('tula') || sign.includes('libra')) return '♎';
  if (sign.includes('vrishchika') || sign.includes('scorpio')) return '♏';
  if (sign.includes('dhanu') || sign.includes('sagittarius')) return '♐';
  if (sign.includes('makara') || sign.includes('capricorn')) return '♑';
  if (sign.includes('kumbha') || sign.includes('aquarius')) return '♒';
  if (sign.includes('meena') || sign.includes('pisces')) return '♓';
  
  return '♈';
};

const COLORS = {
  background: '#FFFFFF',
  textPrimary: '#1B1528',
  textSecondary: '#6B7280',
  accent: '#4B0082',
};

export default function ZodiacPreviewScreen() {
  const navigation = useNavigation();
  const params = useLocalSearchParams();
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [selectedZodiacType, setSelectedZodiacType] = useState<'vedic' | 'western' | 'nakshatra'>('vedic');
  const { showAlert } = useAuthAlert();
  
  // Animation values for transitions
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const nameFadeAnim = useRef(new Animated.Value(1)).current;
  const descFadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  const dob = params.dob ? new Date(params.dob as string) : null;
  const tob = params.tob ? new Date(params.tob as string) : null;
  const pob = params.pob as string;
  const lat = params.lat ? parseFloat(params.lat as string) : undefined;
  const lng = params.lng ? parseFloat(params.lng as string) : undefined;

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  // Animate planet card when zodiac type changes
  useEffect(() => {
    // Reset animation values
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.8);
    rotateAnim.setValue(0);
    nameFadeAnim.setValue(0);
    descFadeAnim.setValue(0);
    slideAnim.setValue(-20);
    
    // Staggered animations: Planet circle first
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    // Then name slides in and fades
    Animated.parallel([
      Animated.timing(nameFadeAnim, {
        toValue: 1,
        duration: 400,
        delay: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Finally description fades in
    Animated.timing(descFadeAnim, {
      toValue: 1,
      duration: 400,
      delay: 400,
      useNativeDriver: true,
    }).start();
  }, [selectedZodiacType, fadeAnim, scaleAnim, rotateAnim, nameFadeAnim, descFadeAnim, slideAnim]);

  // Continuous pulse animation for planet circle
  useEffect(() => {
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );
    pulseAnimation.start();
    return () => pulseAnimation.stop();
  }, [pulseAnim]);

  const astroData = useMemo(() => {
    if (!params.astro) return null;
    try {
      return JSON.parse(decodeURIComponent(params.astro as string));
    } catch (error) {
      console.warn('Failed to parse astro payload:', error);
      return null;
    }
  }, [params.astro]);

  const westernSign = useMemo(() => (dob ? getWesternSign(dob) : null), [dob]);

  const indianSignName =
    astroData?.indian_sign ||
    astroData?.vedic_sign ||
    astroData?.sign ||
    astroData?.Sign ||
    astroData?.moon_sign ||
    astroData?.sun_sign ||
    null;

  const indianElement =
    astroData?.indian_element ||
    astroData?.vedic_element ||
    astroData?.tatva ||
    astroData?.element ||
    astroData?.Element ||
    null;

  const astroNakshatraName =
    astroData?.nakshatra?.name ||
    astroData?.nakshatra_name ||
    astroData?.Naksahtra ||
    astroData?.nakshatra ||
    null;

  const astroNakshatraSymbol =
    astroData?.nakshatra?.symbol ||
    astroData?.nakshatra_symbol ||
    '✨';

  const nakshatra = astroNakshatraName
    ? {
        name: astroNakshatraName,
        symbol: astroNakshatraSymbol,
      }
    : null;


  const handleContinue = async () => {
    if (hasSaved) return;
    setIsSaving(true);
    try {
      // Format the data for saving
      const birthDate = dob ? dob.toISOString().split('T')[0] : ''; // YYYY-MM-DD
      const birthTime = tob 
        ? `${String(tob.getHours()).padStart(2, '0')}:${String(tob.getMinutes()).padStart(2, '0')}:${String(tob.getSeconds()).padStart(2, '0')}`
        : '00:00:00'; // HH:MM:SS

      // Save astro details to database
      const result = await saveAstroDetails({
        birth_date: birthDate,
        birth_time: birthTime,
        birth_location: pob || '',
        birth_latitude: lat,
        birth_longitude: lng,
        birth_timezone: (params.tz as string) || undefined,
        western_sign: westernSign?.name || undefined,
        indian_sign: indianSignName || undefined,
        nakshatra_name: astroNakshatraName || undefined,
        venus_sign: astroData?.venus_sign || undefined,
        mars_sign: astroData?.mars_sign || undefined,
        mercury_sign: astroData?.mercury_sign || undefined,
        rising_sign: astroData?.rising_sign || undefined,
        dominant_element: astroData?.dominant_element || undefined,
        chart_json: astroData?.chart_json || undefined,
      });

      if (!result.success) {
        showAlert('Error', result.error || 'Failed to save astro details');
        setIsSaving(false);
        return;
      }

      console.log('✨ Astro details saved successfully');
      setHasSaved(true);
      const savedUserId = result.data?.user_id;
      if (savedUserId) {
        enqueueSynastryPrewarm(savedUserId);
      }
      router.replace('/onboarding/onboarding_ques');
    } catch (error) {
      console.error('❌ Error saving astro details:', error);
      showAlert('Error', 'Failed to save your details. Please try again.');
      setIsSaving(false);
    }
  };


  if (!dob || !westernSign) {
    return (
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Invalid birth details</Text>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Text style={styles.backButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Your Cosmic Identity</Text>
            <Text style={styles.headerSubtitle}>Discover your signs</Text>
          </View>

          {/* Zodiac Type Toggle */}
          <View style={styles.toggleContainer}>
            <LinearGradient
              colors={['#1A0B2E', '#2D1B4E', '#4A2C5A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.toggleBackground}
            >
              <TouchableOpacity
                style={[
                  styles.toggleOption,
                  selectedZodiacType === 'vedic' && styles.toggleOptionActive,
                  !indianSignName && styles.toggleOptionDisabled,
                ]}
                onPress={() => {
                  setSelectedZodiacType('vedic');
                }}
                disabled={!indianSignName}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.toggleOptionText,
                    selectedZodiacType === 'vedic' && styles.toggleOptionTextActive,
                    !indianSignName && styles.toggleOptionTextDisabled,
                  ]}
                >
                  Vedic
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.toggleOption,
                  selectedZodiacType === 'western' && styles.toggleOptionActive,
                  !westernSign && styles.toggleOptionDisabled,
                ]}
                onPress={() => {
                  setSelectedZodiacType('western');
                }}
                disabled={!westernSign}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.toggleOptionText,
                    selectedZodiacType === 'western' && styles.toggleOptionTextActive,
                    !westernSign && styles.toggleOptionTextDisabled,
                  ]}
                >
                  Western
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.toggleOption,
                  selectedZodiacType === 'nakshatra' && styles.toggleOptionActive,
                  !nakshatra && styles.toggleOptionDisabled,
                ]}
                onPress={() => {
                  setSelectedZodiacType('nakshatra');
                }}
                disabled={!nakshatra}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.toggleOptionText,
                    selectedZodiacType === 'nakshatra' && styles.toggleOptionTextActive,
                    !nakshatra && styles.toggleOptionTextDisabled,
                  ]}
                >
                  Nakshatra
                </Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>

          {/* Single Planet Card - Centered */}
          <View style={styles.planetCardContainer}>
            <LinearGradient
              colors={['#1A0B2E', '#2D1B4E', '#4A2C5A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.planetCard}
            >
              {/* Animated Planet Circle with Rotation and Pulse */}
              <Animated.View
                style={[
                  styles.planetGlowContainer,
                  {
                    opacity: fadeAnim,
                    transform: [
                      { scale: Animated.multiply(scaleAnim, pulseAnim) },
                      {
                        rotate: rotateAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '360deg'],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <View style={styles.planetSphere}>
                  {selectedZodiacType === 'vedic' && indianSignName && (
                    <Text style={styles.planetIcon}>{getVedicSymbol(indianSignName)}</Text>
                  )}
                  {selectedZodiacType === 'western' && westernSign && (
                    <Text style={styles.planetIcon}>{westernSign.symbol}</Text>
                  )}
                  {selectedZodiacType === 'nakshatra' && nakshatra && (
                    <Text style={styles.planetIcon}>{nakshatra.symbol}</Text>
                  )}
                </View>
              </Animated.View>

              {/* Animated Zodiac Name with Slide */}
              <Animated.View
                style={[
                  styles.zodiacNameContainer,
                  {
                    opacity: nameFadeAnim,
                    transform: [
                      {
                        translateY: slideAnim,
                      },
                    ],
                  },
                ]}
              >
                {selectedZodiacType === 'western' && westernSign && (
                  <Text style={styles.zodiacName}>{westernSign.name}</Text>
                )}
                {selectedZodiacType === 'vedic' && (
                  indianSignName ? (
                    <Text style={styles.zodiacName}>{formatSignLabel(indianSignName)}</Text>
                  ) : (
                    <Text style={styles.zodiacNamePlaceholder}>Vedic sign not available</Text>
                  )
                )}
                {selectedZodiacType === 'nakshatra' && (
                  nakshatra ? (
                    <Text style={styles.zodiacName}>{nakshatra.name}</Text>
                  ) : (
                    <Text style={styles.zodiacNamePlaceholder}>Nakshatra not available</Text>
                  )
                )}
              </Animated.View>

              {/* Animated Personality Description */}
              <Animated.View
                style={[
                  styles.personalityDescriptionContainer,
                  {
                    opacity: descFadeAnim,
                  },
                ]}
              >
                {selectedZodiacType === 'western' && westernSign && (
                  <Text style={styles.personalityDescription}>
                    {getPersonalityDescription('western', westernSign.name) || 'Personality description not available'}
                  </Text>
                )}
                {selectedZodiacType === 'vedic' && indianSignName && (
                  <Text style={styles.personalityDescription}>
                    {getPersonalityDescription('vedic', indianSignName) || 'Personality description not available'}
                  </Text>
                )}
                {selectedZodiacType === 'nakshatra' && nakshatra && (
                  <Text style={styles.personalityDescription}>
                    {getPersonalityDescription('nakshatra', nakshatra.name) || 'Personality description not available'}
                  </Text>
                )}
              </Animated.View>

              {/* Arrow Button - On Planet Card Below Text */}
              <View style={styles.arrowButtonContainer}>
                <TouchableOpacity
                  style={[styles.arrowButton, isSaving && styles.arrowButtonDisabled]}
                  onPress={handleContinue}
                  activeOpacity={0.9}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.arrowButtonText}>›</Text>
                  )}
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>

        </View>
      </SafeAreaView>
    </View>
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
    paddingHorizontal: 24,
    paddingTop: -15,
    paddingBottom: 32,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 8,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    fontWeight: '400',
    textAlign: 'center',
  },
  planetCardContainer: {
    marginTop: 24,
    marginBottom: 24,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planetCard: {
    width: SCREEN_WIDTH - 5,
    height: 700,
    marginHorizontal: 0,
    borderTopLeftRadius: 190,
    borderTopRightRadius: 190,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#A855F7',
  },
  starTopLeft: {
    position: 'absolute',
    top: 15,
    left: 15,
    zIndex: 1,
  },
  starTopRight: {
    position: 'absolute',
    top: 15,
    right: 15,
    zIndex: 1,
  },
  starBottomLeft: {
    position: 'absolute',
    bottom: 15,
    left: 15,
    zIndex: 1,
  },
  starBottomRight: {
    position: 'absolute',
    bottom: 15,
    right: 15,
    zIndex: 1,
  },
  starIcon: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  topArchContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    alignItems: 'center',
    justifyContent: 'flex-start',
    zIndex: 2,
  },
  topArch: {
    width: '90%',
    height: 80,
    borderTopWidth: 2,
    borderTopColor: '#4FD1C7',
    borderTopLeftRadius: 150,
    borderTopRightRadius: 150,
    marginTop: 10,
    shadowColor: '#4FD1C7',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  titleContainer: {
    position: 'absolute',
    top: 100,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
    gap: 10,
  },
  planetTitle: {
    fontSize: 36,
    fontWeight: '700',
    color: '#4FD1C7',
    letterSpacing: 2,
  },
  planetSymbol: {
    fontSize: 28,
    color: '#FFFFFF',
  },
  planetGlowContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 30,
    position: 'relative',
    height: 220,
    overflow: 'visible',
  },
  planetSphere: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#A855F7',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 40,
    elevation: 15,
  },
  planetIcon: {
    fontSize: 70,
  },
  toggleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  toggleBackground: {
    flexDirection: 'row',
    borderRadius: 30,
    padding: 4,
    width: '100%',
    maxWidth: 350,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  toggleOption: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleOptionActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  toggleOptionDisabled: {
    opacity: 0.4,
  },
  toggleOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  toggleOptionTextActive: {
    color: '#1A0B2E',
    fontWeight: '700',
  },
  toggleOptionTextDisabled: {
    color: 'rgba(255, 255, 255, 0.3)',
  },
  zodiacNameContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    paddingBottom: 40,
  },
  zodiacName: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
    textAlign: 'center',
  },
  zodiacNamePlaceholder: {
    fontSize: 18,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.5)',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  personalityDescriptionContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 8,
    paddingBottom: 20,
  },
  personalityDescription: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 20,
    letterSpacing: 0.3,
  },
  subtitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    gap: 10,
  },
  subtitleDecorLeft: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  subtitleDecorRight: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  subtitleBox: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#4FD1C7',
    borderRadius: 6,
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
  },
  planetSubtitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    gap: 8,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D1D5DB',
  },
  paginationDotActive: {
    width: 24,
    backgroundColor: COLORS.accent,
  },
  cardTypeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  elementBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  elementEmoji: {
    fontSize: 16,
  },
  elementBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'capitalize',
    letterSpacing: 0.5,
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    color: COLORS.textPrimary,
    fontSize: 18,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  arrowButtonContainer: {
    width: '100%',
    paddingHorizontal: 310,
    paddingTop: 85,
    paddingBottom: 24,
  },
  arrowButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  arrowButtonDisabled: {
    opacity: 0.6,
  },
  arrowButtonText: {
  color: COLORS.accent,
  fontSize: 28,
  fontWeight: '700',
  lineHeight: 30,
  textAlign: 'center',
  textAlignVertical: 'center',
  includeFontPadding: false,
},
});
