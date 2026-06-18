import { saveAstroDetails } from '@/lib/astro-details';
import { supabase } from '@/lib/supabase';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
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

// Western Zodiac Taglines
const WESTERN_TAGLINES: Record<string, string> = {
  'Aries': 'The Pioneer',
  'Taurus': 'The Anchor',
  'Gemini': 'The Alchemist',
  'Cancer': 'The Protector',
  'Leo': 'The Sovereign',
  'Virgo': 'The Perfectionist',
  'Libra': 'The Harmonizer',
  'Scorpio': 'The Mystic',
  'Sagittarius': 'The Seeker',
  'Capricorn': 'The Mastermind',
  'Aquarius': 'The Visionary',
  'Pisces': 'The Dreamer',
};

// Vedic Zodiac Taglines
const VEDIC_TAGLINES: Record<string, string> = {
  'Mesha': 'The Pioneer',
  'Vrishabha': 'The Anchor',
  'Mithuna': 'The Alchemist',
  'Karka': 'The Protector',
  'Simha': 'The Sovereign',
  'Kanya': 'The Perfectionist',
  'Tula': 'The Harmonizer',
  'Vrishchika': 'The Mystic',
  'Dhanu': 'The Seeker',
  'Makara': 'The Mastermind',
  'Kumbha': 'The Visionary',
  'Meena': 'The Dreamer',
};

// Nakshatra Taglines
const NAKSHATRA_TAGLINES: Record<string, string> = {
  'Ashwini': 'The Miracle Worker',
  'Bharani': 'The Bearer of Light',
  'Krittika': 'The Razor Sharp',
  'Rohini': 'The Star of Ascent',
  'Mrigashira': 'The Seeking Star',
  'Ardra': 'The Star of Destiny',
  'Punarvasu': 'The Return of Light',
  'Pushya': 'The Star of Nourishment',
  'Ashlesha': 'The Clinging Star',
  'Magha': 'The Royal Star',
  'Purva Phalguni': 'The Carefree Star',
  'Uttara Phalguni': 'The Patron Star',
  'Hasta': 'The Golden Hand',
  'Chitra': 'The Bright Star',
  'Swati': 'The Sword of Independence',
  'Vishakha': 'The Star of Triumph',
  'Anuradha': 'The Star of Devotion',
  'Jyeshta': 'The Chief Star',
  'Mula': 'The Root Star',
  'Purva Ashadha': 'The Invincible Star',
  'Uttara Ashadha': 'The Universal Star',
  'Shravana': 'The Star of Learning',
  'Dhanishta': 'The Star of Symphony',
  'Shatabhisha': 'The Hundred Healers',
  'Purva Bhadrapada': 'The Spiritual Fire',
  'Uttara Bhadrapada': 'The Cosmic Depth',
  'Revati': 'The Nourishing Guardian',
};

// Western Zodiac Traits
const WESTERN_TRAITS: Record<string, string[]> = {
  'Aries': ['Bold', 'Energetic', 'Passionate'],
  'Taurus': ['Reliable', 'Patient', 'Devoted'],
  'Gemini': ['Adaptable', 'Expressive', 'Curious'],
  'Cancer': ['Intuitive', 'Caring', 'Empathetic'],
  'Leo': ['Generous', 'Creative', 'Confident'],
  'Virgo': ['Loyal', 'Analytical', 'Kind'],
  'Libra': ['Diplomatic', 'Gracious', 'Fair'],
  'Scorpio': ['Brave', 'Passionate', 'Resourceful'],
  'Sagittarius': ['Generous', 'Idealistic', 'Adventurous'],
  'Capricorn': ['Disciplined', 'Ambitious', 'Persistent'],
  'Aquarius': ['Progressive', 'Original', 'Independent'],
  'Pisces': ['Intuitive', 'Compassionate', 'Artistic'],
};

// Vedic Zodiac Traits
const VEDIC_TRAITS: Record<string, string[]> = {
  'Mesha': ['Bold', 'Energetic', 'Leader'],
  'Vrishabha': ['Stable', 'Reliable', 'Artistic'],
  'Mithuna': ['Intellectual', 'Adaptable', 'Expressive'],
  'Karka': ['Intuitive', 'Nurturing', 'Emotional'],
  'Simha': ['Charismatic', 'Bold', 'Generous'],
  'Kanya': ['Practical', 'Analytical', 'Diligent'],
  'Tula': ['Diplomatic', 'Artistic', 'Balanced'],
  'Vrishchika': ['Intense', 'Intuitive', 'Resilient'],
  'Dhanu': ['Optimistic', 'Philosophical', 'Adventurous'],
  'Makara': ['Disciplined', 'Ambitious', 'Practical'],
  'Kumbha': ['Innovative', 'Independent', 'Humanitarian'],
  'Meena': ['Empathetic', 'Intuitive', 'Creative'],
};

// Nakshatra Traits
const NAKSHATRA_TRAITS: Record<string, string[]> = {
  'Ashwini': ['Fast-paced', 'Healing', 'Courageous'],
  'Bharani': ['Creative', 'Responsible', 'Transformative'],
  'Krittika': ['Determined', 'Sharp', 'Ambitious'],
  'Rohini': ['Charming', 'Artistic', 'Nurturing'],
  'Mrigashira': ['Curious', 'Adaptable', 'Seeker'],
  'Ardra': ['Intense', 'Resilient', 'Insightful'],
  'Punarvasu': ['Generous', 'Renewal', 'Optimistic'],
  'Pushya': ['Nurturing', 'Ethical', 'Dependable'],
  'Ashlesha': ['Shrewd', 'Intense', 'Perceptive'],
  'Magha': ['Regal', 'Loyal', 'Ambitious'],
  'Purva Phalguni': ['Artistic', 'Sociable', 'Joyful'],
  'Uttara Phalguni': ['Generous', 'Dutiful', 'Loving'],
  'Hasta': ['Skillful', 'Articulate', 'Creative'],
  'Chitra': ['Dynamic', 'Attractive', 'Creative'],
  'Swati': ['Independent', 'Intuitive', 'Fair'],
  'Vishakha': ['Focused', 'Determined', 'Competitive'],
  'Anuradha': ['Devoted', 'Resilient', 'Friendly'],
  'Jyeshta': ['Protective', 'Authoritative', 'Respected'],
  'Mula': ['Investigative', 'Direct', 'Transformative'],
  'Purva Ashadha': ['Confident', 'Optimistic', 'Adaptable'],
  'Uttara Ashadha': ['Noble', 'Patient', 'Virtuous'],
  'Shravana': ['Attentive', 'Learned', 'Ethical'],
  'Dhanishta': ['Rhythmic', 'Adaptable', 'Prosperous'],
  'Shatabhisha': ['Visionary', 'Independent', 'Healing'],
  'Purva Bhadrapada': ['Spiritual', 'Passionate', 'Unique'],
  'Uttara Bhadrapada': ['Wise', 'Charitable', 'Stable'],
  'Revati': ['Gentle', 'Empathetic', 'Spiritual'],
};

// Western Zodiac Poetic Descriptions
const WESTERN_DESCRIPTIONS: Record<string, string> = {
  'Aries': 'You initiate with fire, lead with passion and live fearlessly. Your pioneering spirit lights the path for others.',
  'Taurus': 'You build on solid ground, appreciate deep beauty and remain patient. Your loyalty is an unshakeable sanctuary.',
  'Gemini': 'You weave words with magic, seek endless wonder and adapt like the wind. Your mind is a canvas of infinite ideas.',
  'Cancer': 'You feel with tide-like depth, nurture with tenderness and protect fiercely. Your heart is a safe harbor in any storm.',
  'Leo': 'You shine like the summer sun, love with open arms and lead with dignity. Your presence warms and inspires everyone.',
  'Virgo': 'You seek quiet perfection, heal with meticulous care and serve with grace. Your intellect brings order to chaos.',
  'Libra': 'You seek ultimate harmony, charm with gentle grace and build bridges. Your soul dances in the search for balance.',
  'Scorpio': 'You walk through shadows, rise from ashes and feel with burning intensity. Your strength lies in your profound rebirth.',
  'Sagittarius': 'You shoot your arrow at the stars, travel with a free soul and seek truth. Your optimism is a guiding beacon.',
  'Capricorn': 'You climb the highest peaks, build lasting legacies and stand resilient. Your patience turns dreams into reality.',
  'Aquarius': 'You dream of a better tomorrow, think outside bounds and stand unique. Your vision is a catalyst for change.',
  'Pisces': 'You feel deeply, dream wildly and love unconditionally. Your intuition guides you like no other.',
};

// Vedic Zodiac Poetic Descriptions
const VEDIC_DESCRIPTIONS: Record<string, string> = {
  'Mesha': 'You initiate with fire, lead with passion and live fearlessly. Your pioneering spirit lights the path for others.',
  'Vrishabha': 'You build on solid ground, appreciate deep beauty and remain patient. Your loyalty is an unshakeable sanctuary.',
  'Mithuna': 'You weave words with magic, seek endless wonder and adapt like the wind. Your mind is a canvas of infinite ideas.',
  'Karka': 'You feel with tide-like depth, nurture with tenderness and protect fiercely. Your heart is a safe harbor in any storm.',
  'Simha': 'You shine like the summer sun, love with open arms and lead with dignity. Your presence warms and inspires everyone.',
  'Kanya': 'You seek quiet perfection, heal with meticulous care and serve with grace. Your intellect brings order to chaos.',
  'Tula': 'You seek ultimate harmony, charm with gentle grace and build bridges. Your soul dances in the search for balance.',
  'Vrishchika': 'You walk through shadows, rise from ashes and feel with burning intensity. Your strength lies in your profound rebirth.',
  'Dhanu': 'You shoot your arrow at the stars, travel with a free soul and seek truth. Your optimism is a guiding beacon.',
  'Makara': 'You climb the highest peaks, build lasting legacies and stand resilient. Your patience turns dreams into reality.',
  'Kumbha': 'You dream of a better tomorrow, think outside bounds and stand unique. Your vision is a catalyst for change.',
  'Meena': 'You feel deeply, dream wildly and love unconditionally. Your intuition guides you like no other.',
};

// Nakshatra Poetic Descriptions
const NAKSHATRA_DESCRIPTIONS: Record<string, string> = {
  'Ashwini': 'You run like the wind, heal with swift touch and bring swift miracles. Your speed and spirit open new horizons.',
  'Bharani': 'You bear the weight of change, create with passionate intensity and rise transformed. Your journey is one of fire and rebirth.',
  'Krittika': 'You cut through illusion with laser-like focus, speak truth with courage and shape destiny. Your will is a sacred fire.',
  'Rohini': 'You attract beauty like a magnetic force, nurture life and flourish. Your presence is a garden of fertility and charm.',
  'Mrigashira': 'You chase the silver deer, ask the deep questions and search the wild. Your curiosity is a sacred quest.',
  'Ardra': 'You cry the tears of clearing storms, stand resilient in trials and transform the dark. Your strength is forged in truth.',
  'Punarvasu': 'You return with the arrow of light, renew what was lost and find hope. Your path is a cycle of eternal return.',
  'Pushya': 'You flow like warm milk, nurture with infinite grace and stand as a guide. Your soul is a sanctuary of protection.',
  'Ashlesha': 'You see through the hidden veils, bind with magnetic intensity and rise wise. Your intuition is a deep serpent pool.',
  'Magha': 'You carry the mantle of ancestors, rule with a generous heart and stand proud. Your honor is a royal crest.',
  'Purva Phalguni': 'You rest in the shade of joy, love with playful warmth and create art. Your life is a celebration of ease.',
  'Uttara Phalguni': 'You stand by your solemn word, serve with devoted love and guide families. Your friendship is a lifetime covenant.',
  'Hasta': 'You mold reality with clever hands, speak with sparkling wit and play. Your dexterity is a craft of pure magic.',
  'Chitra': 'You design diamonds from dust, shine with dazzling charm and build wonders. Your eye is a lens of absolute beauty.',
  'Swati': 'You float like a solitary leaf in the breeze, seek absolute freedom and think fair. Your independence is your strength.',
  'Vishakha': 'You target the golden gate, compete with relentless power and win. Your triumph is written in your patience.',
  'Anuradha': 'You build bridges across oceans, remain loyal through ages and seek the divine. Your love is a devotion of stars.',
  'Jyeshta': 'You protect the sacred lineage, rule with silent power and stand mature. Your wisdom is the crown of the elders.',
  'Mula': 'You pull up the roots of illusion, look into the core truth and rebuild from zero. Your destruction is a clean slate.',
  'Purva Ashadha': 'You conquer the undefeated, shine with endless hope and flow. Your invincibility is born of self-belief.',
  'Uttara Ashadha': 'You stand as a pillar of truth, win with universal alliance and remain quiet. Your virtue is unshakeable.',
  'Shravana': 'You listen to the silent whisper of the cosmos, speak truth and teach. Your mind is a repository of ancient lore.',
  'Dhanishta': 'You march to the drumbeat of prosperity, harmonize opposing forces and build. Your soul is a symphony of rhythm.',
  'Shatabhisha': 'You heal with a hundred secret herbs, look into the dark void and know. Your path is a mystery of restoration.',
  'Purva Bhadrapada': 'You burn with double fire, dream of the deep cosmos and stand apart. Your journey is a bridge of stars.',
  'Uttara Bhadrapada': 'You sleep in the cosmic ocean, watch the worlds turn and protect. Your peace is a silent mountain.',
  'Revati': 'You guide the lost traveler home, protect the small and love all. Your compass is a direct link to the divine.',
};

const getZodiacTagline = (type: 'western' | 'vedic' | 'nakshatra', signName: string | null | undefined): string => {
  if (!signName) return '';
  const name = signName.trim();
  const formatted = formatSignLabel(name);
  
  if (type === 'western') {
    return WESTERN_TAGLINES[name] || WESTERN_TAGLINES[formatted || ''] || '';
  } else if (type === 'vedic') {
    return VEDIC_TAGLINES[name] || VEDIC_TAGLINES[formatted || ''] || '';
  } else if (type === 'nakshatra') {
    return NAKSHATRA_TAGLINES[name] || NAKSHATRA_TAGLINES[formatted || ''] || '';
  }
  return '';
};

const getZodiacTraits = (type: 'western' | 'vedic' | 'nakshatra', signName: string | null | undefined): string[] => {
  if (!signName) return [];
  const name = signName.trim();
  const formatted = formatSignLabel(name);
  
  if (type === 'western') {
    return WESTERN_TRAITS[name] || WESTERN_TRAITS[formatted || ''] || [];
  } else if (type === 'vedic') {
    return VEDIC_TRAITS[name] || VEDIC_TRAITS[formatted || ''] || [];
  } else if (type === 'nakshatra') {
    return NAKSHATRA_TRAITS[name] || NAKSHATRA_TRAITS[formatted || ''] || [];
  }
  return [];
};

const getPersonalityDescription = (type: 'western' | 'vedic' | 'nakshatra', signName: string | null | undefined): string | null => {
  if (!signName) return null;
  
  const name = signName.trim();
  const formatted = formatSignLabel(name);
  
  if (type === 'western') {
    return WESTERN_DESCRIPTIONS[name] || WESTERN_DESCRIPTIONS[formatted || ''] || null;
  } else if (type === 'vedic') {
    return VEDIC_DESCRIPTIONS[name] || VEDIC_DESCRIPTIONS[formatted || ''] || null;
  } else if (type === 'nakshatra') {
    return NAKSHATRA_DESCRIPTIONS[name] || NAKSHATRA_DESCRIPTIONS[formatted || ''] || null;
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

const getElementGradient = (element?: string | null): readonly [string, string] => {
  const el = element?.toLowerCase().trim();
  if (el === 'fire') return ['#FF416C', '#FF4B2B'];
  if (el === 'earth') return ['#11998e', '#38ef7d'];
  if (el === 'air') return ['#00c6ff', '#0072ff'];
  if (el === 'water') return ['#f857a6', '#ff5858'];
  return ['#A855F7', '#EC4899']; // default purple-pink gradient
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

  const activeSign = useMemo(() => {
    if (selectedZodiacType === 'vedic') {
      let el = indianElement;
      if (!el && indianSignName) {
        const sign = indianSignName.toLowerCase().trim();
        if (sign.includes('mesha') || sign.includes('aries') || sign.includes('simha') || sign.includes('leo') || sign.includes('dhanu') || sign.includes('sagittarius')) {
          el = 'Fire';
        } else if (sign.includes('vrishabha') || sign.includes('taurus') || sign.includes('kanya') || sign.includes('virgo') || sign.includes('makara') || sign.includes('capricorn')) {
          el = 'Earth';
        } else if (sign.includes('mithuna') || sign.includes('gemini') || sign.includes('tula') || sign.includes('libra') || sign.includes('kumbha') || sign.includes('aquarius')) {
          el = 'Air';
        } else {
          el = 'Water';
        }
      }
      return {
        name: indianSignName ? formatSignLabel(indianSignName) : 'Vedic Sign',
        symbol: getVedicSymbol(indianSignName),
        element: el,
        tagline: getZodiacTagline('vedic', indianSignName),
        traits: getZodiacTraits('vedic', indianSignName),
        description: getPersonalityDescription('vedic', indianSignName) || 'Personality description not available',
      };
    } else if (selectedZodiacType === 'western') {
      return {
        name: westernSign?.name || 'Western Sign',
        symbol: westernSign?.symbol || '♈',
        element: westernSign?.element || 'Fire',
        tagline: getZodiacTagline('western', westernSign?.name),
        traits: getZodiacTraits('western', westernSign?.name),
        description: getPersonalityDescription('western', westernSign?.name) || 'Personality description not available',
      };
    } else {
      return {
        name: nakshatra?.name || 'Nakshatra',
        symbol: nakshatra?.symbol || '✨',
        element: 'Celestial',
        tagline: getZodiacTagline('nakshatra', nakshatra?.name),
        traits: getZodiacTraits('nakshatra', nakshatra?.name),
        description: getPersonalityDescription('nakshatra', nakshatra?.name) || 'Personality description not available',
      };
    }
  }, [selectedZodiacType, indianSignName, indianElement, westernSign, nakshatra]);


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
      {/* Background Sparkles */}
      <Ionicons name="sparkles" size={14} color="rgba(168, 85, 247, 0.15)" style={[styles.bgSparkle, { top: 80, left: 30 }]} />
      <Ionicons name="sparkles" size={16} color="rgba(168, 85, 247, 0.1)" style={[styles.bgSparkle, { top: 120, right: 40 }]} />
      <Ionicons name="sparkles" size={12} color="rgba(168, 85, 247, 0.15)" style={[styles.bgSparkle, { bottom: 180, left: 45 }]} />
      <Ionicons name="sparkles" size={15} color="rgba(168, 85, 247, 0.1)" style={[styles.bgSparkle, { bottom: 100, right: 35 }]} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="sparkles" size={18} color="#A855F7" style={{ marginRight: 8 }} />
              <Text style={styles.headerTitle}>Your Cosmic Identity</Text>
              <Ionicons name="sparkles" size={18} color="#A855F7" style={{ marginLeft: 8 }} />
            </View>
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
                <View style={styles.toggleOptionContent}>
                  <Ionicons
                    name="sparkles"
                    size={14}
                    color={selectedZodiacType === 'vedic' ? '#1A0B2E' : 'rgba(255, 255, 255, 0.5)'}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.toggleOptionText,
                      selectedZodiacType === 'vedic' && styles.toggleOptionTextActive,
                      !indianSignName && styles.toggleOptionTextDisabled,
                    ]}
                  >
                    Vedic
                  </Text>
                </View>
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
                <View style={styles.toggleOptionContent}>
                  <Ionicons
                    name="moon-outline"
                    size={14}
                    color={selectedZodiacType === 'western' ? '#1A0B2E' : 'rgba(255, 255, 255, 0.5)'}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.toggleOptionText,
                      selectedZodiacType === 'western' && styles.toggleOptionTextActive,
                      !westernSign && styles.toggleOptionTextDisabled,
                    ]}
                  >
                    Western
                  </Text>
                </View>
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
                <View style={styles.toggleOptionContent}>
                  <Ionicons
                    name="sunny-outline"
                    size={14}
                    color={selectedZodiacType === 'nakshatra' ? '#1A0B2E' : 'rgba(255, 255, 255, 0.5)'}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.toggleOptionText,
                      selectedZodiacType === 'nakshatra' && styles.toggleOptionTextActive,
                      !nakshatra && styles.toggleOptionTextDisabled,
                    ]}
                  >
                    Nakshatra
                  </Text>
                </View>
              </TouchableOpacity>
            </LinearGradient>
          </View>

          {/* Single Planet Card - Centered Floating Card */}
          <View style={styles.planetCardContainer}>
            <LinearGradient
              colors={['#1A0B2E', '#2D1B4E', '#4A2C5A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.planetCard}
            >
              {/* Star sparkles inside the card */}
              <Ionicons name="sparkles" size={14} color="#A855F7" style={styles.starTopLeft} />
              <Ionicons name="sparkles" size={12} color="rgba(168, 85, 247, 0.6)" style={styles.starTopRight} />
              <Ionicons name="sparkles" size={10} color="#D946EF" style={styles.starBottomLeft} />
              <Ionicons name="sparkles" size={13} color="rgba(217, 70, 239, 0.5)" style={styles.starBottomRight} />

              {/* Animated Planet Circle with Rotation, Pulse and Zodiac Backdrop Halo */}
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
                {/* Zodiac Backdrop Halo */}
                <Image
                  source={require('../../assets/images/zodiac-superlike.png')}
                  style={styles.cardZodiacBackdrop}
                  contentFit="contain"
                />
                
                {/* Glowing Outer Sphere */}
                <View style={styles.planetSphere}>
                  {/* Custom Inner Gradient Badge */}
                  <LinearGradient
                    colors={getElementGradient(activeSign.element)}
                    style={styles.zodiacSymbolBadge}
                  >
                    <Text style={styles.zodiacSymbolText}>{activeSign.symbol}</Text>
                  </LinearGradient>
                </View>
              </Animated.View>

              {/* Animated Zodiac Name & Tagline */}
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
                <Text style={styles.zodiacName}>{activeSign.name}</Text>
                {activeSign.tagline ? (
                  <Text style={styles.zodiacTagline}>✦ {activeSign.tagline} ✦</Text>
                ) : null}

                {/* Traits Pill Row */}
                {activeSign.traits.length > 0 ? (
                  <View style={styles.traitsContainer}>
                    {activeSign.traits.map((trait, index) => (
                      <React.Fragment key={trait}>
                        {index > 0 && <Text style={styles.traitsSeparator}>•</Text>}
                        <Text style={styles.traitText}>{trait}</Text>
                      </React.Fragment>
                    ))}
                  </View>
                ) : null}
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
                <Text style={styles.personalityDescription}>
                  {activeSign.description}
                </Text>
              </Animated.View>
            </LinearGradient>
          </View>

          {/* Centered Next Button at the Bottom */}
          <View style={styles.bottomNavContainer}>
            <TouchableOpacity
              style={[styles.gradientNextButton, isSaving && styles.gradientNextButtonDisabled]}
              onPress={handleContinue}
              activeOpacity={0.8}
              disabled={isSaving}
            >
              <LinearGradient
                colors={['#8B5CF6', '#EC4899']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradientNextButtonFill}
              >
                {isSaving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <MaterialCommunityIcons name="chevron-right" size={32} color="#FFFFFF" />
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9FC',
  },
  bgSparkle: {
    position: 'absolute',
    zIndex: 0,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '400',
    textAlign: 'center',
    marginTop: 2,
  },
  toggleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  toggleBackground: {
    flexDirection: 'row',
    borderRadius: 30,
    padding: 4,
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    backgroundColor: '#24133B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  toggleOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleOptionActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  toggleOptionDisabled: {
    opacity: 0.4,
  },
  toggleOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
    letterSpacing: 0.3,
  },
  toggleOptionTextActive: {
    color: '#1A0B2E',
    fontWeight: '700',
  },
  toggleOptionTextDisabled: {
    color: 'rgba(255, 255, 255, 0.3)',
  },
  planetCardContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  planetCard: {
    width: '100%',
    height: 490,
    borderRadius: 32,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1.5,
    borderColor: 'rgba(168, 85, 247, 0.25)',
    paddingTop: 16,
    paddingBottom: 24,
  },
  starTopLeft: {
    position: 'absolute',
    top: 20,
    left: 20,
    zIndex: 2,
  },
  starTopRight: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 2,
  },
  starBottomLeft: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    zIndex: 2,
  },
  starBottomRight: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    zIndex: 2,
  },
  planetGlowContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 8,
    position: 'relative',
    height: 190,
  },
  cardZodiacBackdrop: {
    position: 'absolute',
    width: 250,
    height: 250,
    opacity: 0.1,
    tintColor: '#A855F7',
  },
  planetSphere: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(168, 85, 247, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.25)',
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 8,
  },
  zodiacSymbolBadge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  zodiacSymbolText: {
    fontSize: 44,
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
  },
  zodiacNameContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  zodiacName: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  zodiacTagline: {
    fontSize: 14,
    fontWeight: '600',
    color: '#B088FF',
    marginTop: 4,
    letterSpacing: 1,
    textAlign: 'center',
  },
  traitsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.25)',
    borderRadius: 18,
    paddingVertical: 5,
    paddingHorizontal: 14,
    marginTop: 12,
    backgroundColor: 'rgba(168, 85, 247, 0.04)',
  },
  traitText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    opacity: 0.95,
  },
  traitsSeparator: {
    fontSize: 12,
    color: '#B088FF',
    marginHorizontal: 6,
  },
  personalityDescriptionContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    marginTop: 14,
  },
  personalityDescription: {
    fontSize: 13.5,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.75)',
    textAlign: 'center',
    lineHeight: 21,
    letterSpacing: 0.2,
  },
  bottomNavContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  gradientNextButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
    overflow: 'hidden',
  },
  gradientNextButtonFill: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradientNextButtonDisabled: {
    opacity: 0.6,
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
});
