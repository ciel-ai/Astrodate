import { getAstroDetails } from '@/lib/astro-details';
import { getDailyHoroscope, parseTzString } from '@/lib/astro';
import { getActiveAstroEvents, type AstroEvent } from '@/lib/synastry';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
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

interface PlanetCard {
  label: string;
  value: string;
  icon: string;
  color: string;
}

export default function CosmicInsightsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [astroDetails, setAstroDetails] = useState<any>(null);
  const [horoscope, setHoroscope] = useState<any>(null);
  const [events, setEvents] = useState<AstroEvent[]>([]);

  const fetchAll = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // Fetch astro details from DB
      const astroResult = user ? await getAstroDetails(user.id) : null;
      if (astroResult?.success && astroResult.data) {
        setAstroDetails(astroResult.data);
      }

      // Fetch active astro events
      const activeEvents = await getActiveAstroEvents();
      setEvents(activeEvents);

      // Fetch horoscope — prefer AsyncStorage, fall back to DB astro_details
      let horoParams: Parameters<typeof getDailyHoroscope>[0] | null = null;

      const stored = await AsyncStorage.getItem('userBirthDetails');
      if (stored) {
        const bd = JSON.parse(stored);
        const dob = new Date(bd.dob);
        const tob = new Date(bd.tob);
        horoParams = {
          day: dob.getDate(),
          month: dob.getMonth() + 1,
          year: dob.getFullYear(),
          hour: tob.getHours(),
          min: tob.getMinutes(),
          lat: parseFloat(bd.lat),
          lon: parseFloat(bd.lng),
          tzone: parseTzString(bd.tz),
          language: 'en',
        };
      } else if (astroResult?.success && astroResult.data) {
        // Fallback: build params from DB row (covers users who onboarded before
        // AsyncStorage saving was added, or after a fresh app install)
        const d = astroResult.data;
        if (d.birth_date && d.birth_time && d.birth_latitude != null && d.birth_longitude != null) {
          const dob = new Date(d.birth_date);
          const [h = 0, m = 0] = String(d.birth_time).split(':').map(Number);
          const lon: number = d.birth_longitude;
          const tz = Math.round((lon / 15) * 10) / 10;
          horoParams = {
            day: dob.getDate(),
            month: dob.getMonth() + 1,
            year: dob.getFullYear(),
            hour: h,
            min: m,
            lat: d.birth_latitude,
            lon,
            tzone: tz,
            language: 'en',
          };
        }
      }

      if (horoParams) {
        const horoData = await getDailyHoroscope(horoParams);
        if (horoData) setHoroscope(horoData);
      }
    } catch (err) {
      console.warn('[CosmicInsights] fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  // Build planet cards from DB astro details
  const buildPlanetCards = (): PlanetCard[] => {
    if (!astroDetails) return [];
    const cards: PlanetCard[] = [];
    if (astroDetails.western_sign) cards.push({ label: 'Sun Sign', value: astroDetails.western_sign, icon: '☀️', color: '#FFD700' });
    if (astroDetails.indian_sign)  cards.push({ label: 'Moon / Vedic', value: astroDetails.indian_sign, icon: '🌙', color: '#C4B5FD' });
    if (astroDetails.rising_sign)  cards.push({ label: 'Rising Sign', value: astroDetails.rising_sign, icon: '⬆️', color: '#34D399' });
    if (astroDetails.venus_sign)   cards.push({ label: 'Venus', value: astroDetails.venus_sign, icon: '♀️', color: '#F9A8D4' });
    if (astroDetails.mars_sign)    cards.push({ label: 'Mars', value: astroDetails.mars_sign, icon: '♂️', color: '#FCA5A5' });
    if (astroDetails.mercury_sign) cards.push({ label: 'Mercury', value: astroDetails.mercury_sign, icon: '☿', color: '#93C5FD' });
    if (astroDetails.nakshatra_name) cards.push({ label: 'Nakshatra', value: astroDetails.nakshatra_name, icon: '⭐', color: '#FDE68A' });
    if (astroDetails.dominant_element) cards.push({ label: 'Element', value: astroDetails.dominant_element, icon: '🌿', color: '#6EE7B7' });
    return cards;
  };

  const planetCards = buildPlanetCards();

  // Extract today's horoscope highlights
  const getHoroscopeCategories = (): { key: string; value: string }[] => {
    if (!horoscope) return [];
    const metaKeys = new Set(['sun_sign','moon_sign','date','timestamp','id','created_at','updated_at','nakshatra','rashi','sign','dob','tob','pob','timezone','tzone','lat','lon']);
    const results: { key: string; value: string }[] = [];
    const walk = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;
      for (const [k, v] of Object.entries(obj)) {
        if (metaKeys.has(k.toLowerCase())) continue;
        if (typeof v === 'string' && v.trim().length > 20) {
          results.push({ key: k, value: v.trim() });
        } else if (typeof v === 'object') {
          walk(v);
        }
      }
    };
    walk(horoscope);
    return results.slice(0, 6); // cap at 6 sections
  };

  const horoCategories = getHoroscopeCategories();

  const formatKey = (k: string) =>
    k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' ');

  const formatEventDates = (start: string, end: string) => {
    const s = new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const e = new Date(end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${s} – ${e}`;
  };

  return (
    <LinearGradient
      colors={['#1a0d2e', '#2d1b4e', '#4a2c5a']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.container}
    >
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>✨ My Cosmic Blueprint</Text>
            <Text style={styles.headerSub}>Your personalised astrological profile</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#8B5CF6" />
            <Text style={styles.loadingText}>Reading the stars…</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => fetchAll(true)} tintColor="#8B5CF6" colors={['#8B5CF6']} />
            }
          >
            {/* ── Planetary Blueprint ── */}
            {planetCards.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🪐 Your Planetary Signs</Text>
                <View style={styles.planetGrid}>
                  {planetCards.map((card, i) => (
                    <BlurView key={i} intensity={20} tint="dark" style={styles.planetCard}>
                      <Text style={styles.planetEmoji}>{card.icon}</Text>
                      <Text style={[styles.planetValue, { color: card.color }]}>{card.value}</Text>
                      <Text style={styles.planetLabel}>{card.label}</Text>
                    </BlurView>
                  ))}
                </View>
              </View>
            )}

            {/* ── Daily Horoscope ── */}
            {horoCategories.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🔮 Today's Forecast</Text>
                <Text style={styles.dateText}>
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </Text>
                {horoCategories.map((cat, i) => (
                  <BlurView key={i} intensity={20} tint="dark" style={styles.horoCard}>
                    <Text style={styles.horoKey}>{formatKey(cat.key)}</Text>
                    <Text style={styles.horoText}>{cat.value}</Text>
                  </BlurView>
                ))}
              </View>
            )}

            {/* ── Astro Events ── */}
            {events.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>🌌 Active Cosmic Events</Text>
                {events.map((ev) => {
                  const gradStart = ev.ui_config?.gradient_start ?? '#3B1F6A';
                  const gradEnd   = ev.ui_config?.gradient_end   ?? '#6D28D9';
                  const textColor = ev.ui_config?.text_color      ?? '#FFFFFF';
                  return (
                    <LinearGradient
                      key={ev.id}
                      colors={[gradStart, gradEnd]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.eventCard}
                    >
                      <View style={styles.eventRow}>
                        <Text style={styles.eventEmoji}>{ev.ui_config?.emoji ?? '🌠'}</Text>
                        <View style={styles.eventBody}>
                          <Text style={[styles.eventName, { color: textColor }]}>{ev.event_name}</Text>
                          <Text style={[styles.eventDates, { color: textColor, opacity: 0.8 }]}>
                            {formatEventDates(ev.start_date, ev.end_date)}
                          </Text>
                          {ev.description ? (
                            <Text style={[styles.eventDesc, { color: textColor, opacity: 0.9 }]}>{ev.description}</Text>
                          ) : null}
                        </View>
                      </View>
                    </LinearGradient>
                  );
                })}
              </View>
            )}

            {/* Empty state */}
            {planetCards.length === 0 && horoCategories.length === 0 && events.length === 0 && (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyEmoji}>🌠</Text>
                <Text style={styles.emptyTitle}>No data yet</Text>
                <Text style={styles.emptyText}>Complete your birth details in onboarding to unlock your cosmic blueprint.</Text>
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { color: 'rgba(255,255,255,0.7)', fontSize: 16 },
  scroll: { paddingHorizontal: 16, paddingBottom: 40, gap: 24 },
  section: { gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 4 },
  dateText: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 4 },

  // Planet grid
  planetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  planetCard: {
    width: '30%',
    flexGrow: 1,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  planetEmoji: { fontSize: 22 },
  planetValue: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  planetLabel: { fontSize: 11, color: 'rgba(255,255,255,0.55)', textAlign: 'center' },

  // Horoscope
  horoCard: {
    borderRadius: 16,
    padding: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  horoKey: { fontSize: 15, fontWeight: '700', color: '#A78BFA' },
  horoText: { fontSize: 14, color: 'rgba(255,255,255,0.88)', lineHeight: 21 },

  // Events
  eventCard: { borderRadius: 16, padding: 16 },
  eventRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  eventEmoji: { fontSize: 28, marginTop: 2 },
  eventBody: { flex: 1, gap: 4 },
  eventName: { fontSize: 16, fontWeight: '700' },
  eventDates: { fontSize: 12 },
  eventDesc: { fontSize: 14, lineHeight: 20, marginTop: 4 },

  // Empty
  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  emptyText: { fontSize: 14, color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 22, paddingHorizontal: 20 },
});