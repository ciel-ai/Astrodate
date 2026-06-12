import { getStandouts, type Standout } from '@/lib/daily-picks';
import { getMembershipOrFree } from '@/lib/subscription';
import { supabase } from '@/lib/supabase';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ─── Types ────────────────────────────────────────────────────────────────────

type CosmicProfile = {
  id: string;
  name: string;
  age?: number;
  location: string;
  astroScore: number;
  westernSign: string | null;
  dominantElement: string | null;
  image: any;
};

type ElementFilter = 'All' | 'Fire' | 'Earth' | 'Air' | 'Water';

// ─── Constants ────────────────────────────────────────────────────────────────

const ELEMENT_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  Fire:  { bg: 'rgba(249,115,22,0.15)',  border: 'rgba(249,115,22,0.4)',  text: '#fb923c', dot: '#f97316' },
  Earth: { bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.35)',  text: '#4ade80', dot: '#22c55e' },
  Air:   { bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.35)', text: '#60a5fa', dot: '#3b82f6' },
  Water: { bg: 'rgba(139,92,246,0.15)',  border: 'rgba(139,92,246,0.4)',  text: '#a78bfa', dot: '#8b5cf6' },
};

const SCORE_GRADIENT: (score: number) => [string, string] = (score) => {
  if (score >= 90) return ['#7c3aed', '#4f46e5'];
  if (score >= 80) return ['#6d28d9', '#7c3aed'];
  if (score >= 75) return ['#5b21b6', '#6d28d9'];
  return ['#4c1d95', '#5b21b6'];
};

const STAR_DATA = Array.from({ length: 80 }).map((_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 2 + 0.5,
  opacity: Math.random() * 0.6 + 0.1,
}));

const FILTERS: ElementFilter[] = ['All', 'Fire', 'Earth', 'Air', 'Water'];

const PLACEHOLDER = require('@/assets/images/avatar-placeholder.png');

// ─── Helper ───────────────────────────────────────────────────────────────────

function calcAge(birthDate: string): number | undefined {
  const bd = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - bd.getFullYear();
  const m = today.getMonth() - bd.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) age--;
  return age;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const colors = SCORE_GRADIENT(score);
  return (
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.scoreBadge}
    >
      <MaterialIcons name="auto-awesome" size={9} color="rgba(255,255,255,0.9)" />
      <Text style={styles.scoreBadgeText}>{score}%</Text>
    </LinearGradient>
  );
}

function ElementPill({ element }: { element: string | null }) {
  if (!element) return null;
  const colors = ELEMENT_COLORS[element] ?? ELEMENT_COLORS['Air'];
  return (
    <View style={[styles.elementPill, { backgroundColor: colors.bg, borderColor: colors.border }]}>
      <View style={[styles.elementDot, { backgroundColor: colors.dot }]} />
      <Text style={[styles.elementPillText, { color: colors.text }]}>{element}</Text>
    </View>
  );
}

function EmptyState({ filter, onReset }: { filter: ElementFilter; onReset: () => void }) {
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>🔮</Text>
      <Text style={styles.emptyTitle}>
        {filter === 'All' ? 'No cosmic fits yet' : `No ${filter} sign matches`}
      </Text>
      <Text style={styles.emptySubtitle}>
        {filter === 'All'
          ? 'Check back tomorrow — the stars align daily'
          : 'Try a different element filter'}
      </Text>
      {filter !== 'All' && (
        <TouchableOpacity style={styles.emptyBtn} onPress={onReset} activeOpacity={0.8}>
          <Text style={styles.emptyBtnText}>Show all</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Profile Card (2-col grid) ────────────────────────────────────────────────

function CosmicCard({
  profile,
  onPress,
  index,
}: {
  profile: CosmicProfile;
  onPress: () => void;
  index: number;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        delay: index * 60,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 350,
        delay: index * 60,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <TouchableOpacity
        style={styles.card}
        onPress={onPress}
        activeOpacity={0.88}
      >
        <View style={styles.cardImageContainer}>
          <Image
            source={profile.image}
            style={styles.cardImage}
            contentFit="cover"
            transition={400}
          />
          {/* Score badge top-right */}
          <View style={styles.scoreBadgeWrapper}>
            <ScoreBadge score={profile.astroScore} />
          </View>
          {/* Gradient overlay bottom */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.75)']}
            style={styles.cardOverlay}
          >
            <Text style={styles.cardName} numberOfLines={1}>
              {profile.name}{profile.age ? `, ${profile.age}` : ''}
            </Text>
            <View style={styles.cardBottom}>
              <ElementPill element={profile.dominantElement} />
              {profile.westernSign && (
                <Text style={styles.cardSign}>{profile.westernSign}</Text>
              )}
            </View>
          </LinearGradient>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CosmicScreen() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<CosmicProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<ElementFilter>('All');
  const [isStellar, setIsStellar] = useState(false);

  const headerFade = useRef(new Animated.Value(0)).current;

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchProfiles = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) return;

      // Membership check
      const membership = await getMembershipOrFree();
      setIsStellar(membership.is_active);

      // Fetch standouts
      const standouts: Standout[] = await getStandouts(userId);
      if (!standouts.length) {
        setProfiles([]);
        return;
      }

      const userIds = standouts.map((s) => s.match_user_id);

      // Batch fetch astro + photos
      const [astroRes, photosRes] = await Promise.all([
        supabase
          .from('astro_details')
          .select('user_id, birth_date')
          .in('user_id', userIds),
        supabase
          .from('user_photos')
          .select('user_id, photo_url, is_primary')
          .in('user_id', userIds),
      ]);

      const astroMap: Record<string, any> = {};
      for (const a of astroRes.data ?? []) astroMap[a.user_id] = a;

      const photosMap: Record<string, any[]> = {};
      for (const ph of photosRes.data ?? []) {
        if (!ph.user_id) continue;
        if (!photosMap[ph.user_id]) photosMap[ph.user_id] = [];
        photosMap[ph.user_id].push(ph);
      }

      const mapped: CosmicProfile[] = standouts.map((s) => {
        const astro = astroMap[s.match_user_id];
        const photos = photosMap[s.match_user_id] ?? [];
        const primary = photos.find((p) => p.is_primary) || photos[0] || null;
        return {
          id: s.match_user_id,
          name: s.full_name || 'Unknown',
          age: astro?.birth_date ? calcAge(astro.birth_date) : undefined,
          location: s.location || '',
          astroScore: Math.round(s.astro_score * 100),
          westernSign: s.western_sign,
          dominantElement: s.dominant_element,
          image: primary?.photo_url ? { uri: primary.photo_url } : PLACEHOLDER,
        };
      });

      // Sort by score descending
      mapped.sort((a, b) => b.astroScore - a.astroScore);
      setProfiles(mapped);

      // Animate header in
      Animated.timing(headerFade, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();

    } catch (err) {
      console.error('CosmicScreen fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchProfiles(); }, []);

  // ── Filtered list ──────────────────────────────────────────────────────────

  const filtered = activeFilter === 'All'
    ? profiles
    : profiles.filter((p) => p.dominantElement === activeFilter);

  // ── Render ─────────────────────────────────────────────────────────────────

  const renderCard = ({ item, index }: { item: CosmicProfile; index: number }) => (
    <CosmicCard
      profile={item}
      index={index}
      onPress={() =>
        router.push({
          pathname: '/profile-details',
          params: { userId: item.id },
        })
      }
    />
  );

  const ListHeader = (
    <Animated.View style={{ opacity: headerFade }}>
      {/* Hero stat row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{profiles.length}</Text>
          <Text style={styles.statLabel}>Cosmic fits</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>
            {profiles.length ? Math.max(...profiles.map((p) => p.astroScore)) : '—'}
            {profiles.length ? '%' : ''}
          </Text>
          <Text style={styles.statLabel}>Top match</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>
            {profiles.length
              ? Math.round(profiles.reduce((acc, p) => acc + p.astroScore, 0) / profiles.length)
              : '—'}
            {profiles.length ? '%' : ''}
          </Text>
          <Text style={styles.statLabel}>Avg score</Text>
        </View>
      </View>

      {/* Element filter pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersScrollContent}
        style={styles.filtersScroll}
      >
        {FILTERS.map((f) => {
          const isActive = activeFilter === f;
          const elColors = f !== 'All' ? ELEMENT_COLORS[f] : null;
          return (
            <TouchableOpacity
              key={f}
              style={[
                styles.filterPill,
                isActive && (elColors
                  ? { backgroundColor: elColors.bg, borderColor: elColors.border }
                  : styles.filterPillActiveAll),
              ]}
              onPress={() => setActiveFilter(f)}
              activeOpacity={0.75}
            >
              {f !== 'All' && elColors && (
                <View style={[styles.filterDot, { backgroundColor: elColors.dot }]} />
              )}
              <Text
                style={[
                  styles.filterPillText,
                  isActive && (elColors
                    ? { color: elColors.text }
                    : styles.filterPillTextActiveAll),
                ]}
              >
                {f}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Section label */}
      <View style={styles.sectionLabelRow}>
        <Text style={styles.sectionLabel}>
          {activeFilter === 'All' ? 'All cosmic fits' : `${activeFilter} signs`}
          {'  '}
          <Text style={styles.sectionCount}>{filtered.length}</Text>
        </Text>
        <Text style={styles.sectionSub}>sorted by AstroScore</Text>
      </View>
    </Animated.View>
  );

  return (
    <LinearGradient
      colors={['#0d0718', '#160a2e', '#1e0f3a']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.3, y: 1 }}
      style={styles.container}
    >
      {/* Stars background */}
      <View style={styles.starsContainer} pointerEvents="none">
        {STAR_DATA.map((star) => (
          <View
            key={star.id}
            style={[
              styles.star,
              {
                left: `${star.x}%` as any,
                top: `${star.y}%` as any,
                width: star.size,
                height: star.size,
                opacity: star.opacity,
              },
            ]}
          />
        ))}
      </View>

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>🔮 Cosmic</Text>
            <Text style={styles.headerSubtitle}>Your highest astro matches</Text>
          </View>
          {!isStellar && (
            <TouchableOpacity
              style={styles.upgradeChip}
              onPress={() => router.push('/(tabs)/profile')}
              activeOpacity={0.8}
            >
              <MaterialIcons name="auto-awesome" size={12} color="#fbbf24" />
              <Text style={styles.upgradeChipText}>Go Stellar</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#A855F7" />
            <Text style={styles.loadingText}>Reading the stars…</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={renderCard}
            numColumns={2}
            columnWrapperStyle={styles.columnWrapper}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={ListHeader}
            ListEmptyComponent={
              <EmptyState
                filter={activeFilter}
                onReset={() => setActiveFilter('All')}
              />
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => fetchProfiles(true)}
                tintColor="#A855F7"
              />
            }
            showsVerticalScrollIndicator={false}
          />
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  starsContainer: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 0,
  },
  star: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 50,
  },
  safeArea: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 6,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#9b72d4',
    marginTop: 2,
  },
  upgradeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.3)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  upgradeChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fbbf24',
  },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 18,
    marginTop: 14,
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 14,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },

  // Filters
  filtersScroll: {
    flexGrow: 0,
  },
  filtersScrollContent: {
    paddingHorizontal: 18,
    gap: 8,
    flexDirection: 'row',
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  filterPillActiveAll: {
    backgroundColor: 'rgba(168,85,247,0.2)',
    borderColor: 'rgba(168,85,247,0.5)',
  },
  filterDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  filterPillTextActiveAll: {
    color: '#c084fc',
  },

  // Section label
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    marginTop: 16,
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
  },
  sectionCount: {
    color: '#a855f7',
  },
  sectionSub: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
  },

  // Grid
  listContent: {
    paddingHorizontal: 18,
    paddingBottom: 100,
  },
  columnWrapper: {
    gap: 10,
    marginBottom: 10,
  },

  // Card
  card: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  cardImageContainer: {
    height: 220,
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  scoreBadgeWrapper: {
    position: 'absolute',
    top: 9,
    right: 9,
    zIndex: 2,
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
  },
  scoreBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 24,
    paddingBottom: 10,
    paddingHorizontal: 10,
  },
  cardName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'wrap',
  },
  elementPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  elementDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  elementPillText: {
    fontSize: 9,
    fontWeight: '700',
  },
  cardSign: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.55)',
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
  },

  // Empty
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    lineHeight: 19,
  },
  emptyBtn: {
    marginTop: 8,
    backgroundColor: 'rgba(168,85,247,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.4)',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  emptyBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#c084fc',
  },
});
