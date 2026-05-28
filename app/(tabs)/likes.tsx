import { getAstroDetails } from '@/lib/astro-details';
import { fetchFinalMatches } from '@/lib/matching';
import { supabase } from '@/lib/supabase';
import { getUserPhotos } from '@/lib/user-photos';
import { getUserProfile } from '@/lib/user-profile';
import { getMembershipOrFree } from '@/lib/subscription';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type LikeProfile = {
  id: string;
  name: string;
  age?: number;
  distance?: string;
  likedTime?: string;
  compatibility?: number;
  isSuperlikeSent?: boolean;
  image: any;
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

export default function LikesScreen() {
  const router = useRouter();
  const [selectedTab, setSelectedTab] = useState<'likes' | 'superlikes' | 'sent'>('likes');
  const [likesData, setLikesData] = useState<LikeProfile[]>([]);
  const [superlikesData, setSuperlikesData] = useState<LikeProfile[]>([]);
  const [likesSentData, setLikesSentData] = useState<LikeProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [canSeeWhoLikedMe, setCanSeeWhoLikedMe] = useState(false);

  // Stars are defined at module level as STAR_DATA — no useMemo needed
  const stars = STAR_DATA;

  // Format time ago
  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const batchFetchProfilesForRefresh = async (
    userIds: string[],
    matchesResult: any[]
  ): Promise<Record<string, any>> => {
    if (userIds.length === 0) return {};

    const calcAge = (birthDate: string): number | undefined => {
      const bd = new Date(birthDate);
      const today = new Date();
      let age = today.getFullYear() - bd.getFullYear();
      const m = today.getMonth() - bd.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) age--;
      return age;
    };

    const [profilesRes, astroRes, photosRes] = await Promise.all([
      supabase
        .from('user_profiles')
        .select('user_id, full_name, location')
        .in('user_id', userIds),
      supabase
        .from('astro_details')
        .select('user_id, birth_date')
        .in('user_id', userIds),
      supabase
        .from('user_photos')
        .select('user_id, photo_url, is_primary')
        .in('user_id', userIds),
    ]);

    const profileMap: Record<string, any> = {};
    for (const p of (profilesRes.data ?? [])) profileMap[p.user_id] = p;

    const astroMap: Record<string, any> = {};
    for (const a of (astroRes.data ?? [])) astroMap[a.user_id] = a;

    const photosMap: Record<string, any[]> = {};
    for (const ph of (photosRes.data ?? [])) {
      if (!ph.user_id) continue;
      if (!photosMap[ph.user_id]) photosMap[ph.user_id] = [];
      photosMap[ph.user_id].push(ph);
    }

    const result: Record<string, any> = {};
    for (const userId of userIds) {
      const profile = profileMap[userId];
      if (!profile) continue;
      const astro = astroMap[userId];
      const photos = photosMap[userId] ?? [];
      const primaryPhoto = photos.find((p) => p.is_primary) || photos[0] || null;
      const match = matchesResult.find((m: any) => m.match_user_id === userId);

      result[userId] = {
        id: userId,
        name: profile.full_name || 'User',
        age: astro?.birth_date ? calcAge(astro.birth_date) : undefined,
        distance: profile.location || 'Location not set',
        compatibility: match ? Math.round(Number(match.final_match_score ?? 0)) : undefined,
        image: primaryPhoto?.photo_url
          ? { uri: primaryPhoto.photo_url }
          : require('@/assets/images/avatar-placeholder.png'),
      };
    }
    return result;
  };

  // Fetch likes data
  useEffect(() => {
    let mounted = true;

    getMembershipOrFree().then((m) => {
      const features = m.features as any;
      if (mounted) setCanSeeWhoLikedMe(!!features?.see_who_liked_me && m.is_active);
    }).catch(() => {});

    // Helper: calculate age from ISO birth_date string
    const calcAge = (birthDate: string): number | undefined => {
      const bd = new Date(birthDate);
      const today = new Date();
      let age = today.getFullYear() - bd.getFullYear();
      const m = today.getMonth() - bd.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) age--;
      return age;
    };

    // Helper: batch-fetch profiles, astro details, and photos for a list of userIds.
    // Replaces the previous N+1 pattern (3 sequential calls per user) with 3 parallel
    // batch queries, reducing network calls from 3×N to 3 regardless of user count.
    const batchFetchProfiles = async (
      userIds: string[],
      matchesResult: any[]
    ): Promise<Record<string, any>> => {
      if (userIds.length === 0) return {};

      // 3 parallel batch queries instead of 3×N sequential calls
      const [profilesRes, astroRes, photosRes] = await Promise.all([
        supabase
          .from('user_profiles')
          .select('user_id, full_name, location')
          .in('user_id', userIds),
        supabase
          .from('astro_details')
          .select('user_id, birth_date')
          .in('user_id', userIds),
        supabase
          .from('user_photos')
          .select('user_id, photo_url, is_primary')
          .in('user_id', userIds),
      ]);

      // Index results by user_id for O(1) lookup
      const profileMap: Record<string, any> = {};
      for (const p of (profilesRes.data ?? [])) profileMap[p.user_id] = p;

      const astroMap: Record<string, any> = {};
      for (const a of (astroRes.data ?? [])) astroMap[a.user_id] = a;

      const photosMap: Record<string, any[]> = {};
      for (const ph of (photosRes.data ?? [])) {
        if (!ph.user_id) continue;
        if (!photosMap[ph.user_id]) photosMap[ph.user_id] = [];
        photosMap[ph.user_id].push(ph);
      }

      // Build final profile objects
      const result: Record<string, any> = {};
      for (const userId of userIds) {
        const profile = profileMap[userId];
        if (!profile) continue;
        const astro = astroMap[userId];
        const photos = photosMap[userId] ?? [];
        const primaryPhoto = photos.find((p) => p.is_primary) || photos[0] || null;
        const match = matchesResult.find((m: any) => m.match_user_id === userId);

        result[userId] = {
          id: userId,
          name: profile.full_name || 'User',
          age: astro?.birth_date ? calcAge(astro.birth_date) : undefined,
          distance: profile.location || 'Location not set',
          compatibility: match ? Math.round(Number(match.final_match_score ?? 0)) : undefined,
          image: primaryPhoto?.photo_url
            ? { uri: primaryPhoto.photo_url }
            : require('@/assets/images/avatar-placeholder.png'),
        };
      }
      return result;
    };

    const fetchLikesData = async () => {
      try {
        if (mounted) setLoading(true);
        const { data: sessionData } = await supabase.auth.getSession();
        const currentUserId = sessionData?.session?.user?.id;
        const matchesResult = await fetchFinalMatches();

        if (!currentUserId) return;

        // Fetch all three like-type rows in parallel
        const [likedRows, superlikedRows, sentRows] = await Promise.all([
          supabase
            .from('user_likes')
            .select('user_id, created_at')
            .eq('liked_user_id', currentUserId)
            .eq('action_type', 'like')
            .order('created_at', { ascending: false }),
          supabase
            .from('user_likes')
            .select('user_id, created_at')
            .eq('liked_user_id', currentUserId)
            .eq('action_type', 'super_like')
            .order('created_at', { ascending: false }),
          supabase
            .from('user_likes')
            .select('liked_user_id, action_type, updated_at, created_at')
            .eq('user_id', currentUserId)
            .in('action_type', ['like', 'super_like'])
            .order('updated_at', { ascending: false }),
        ]);

        // Deduplicate to latest per user
        const latestLikeMap = new Map<string, string>();
        for (const row of (likedRows.data ?? []) as any[]) {
          if (!latestLikeMap.has(row.user_id)) latestLikeMap.set(row.user_id, row.created_at);
        }

        const latestSuperlikeMap = new Map<string, string>();
        for (const row of (superlikedRows.data ?? []) as any[]) {
          if (!latestSuperlikeMap.has(row.user_id)) latestSuperlikeMap.set(row.user_id, row.created_at);
        }

        const latestSentMap = new Map<string, { actionType: string; createdAt?: string }>();
        for (const row of (sentRows.data ?? []) as any[]) {
          if (!latestSentMap.has(row.liked_user_id)) {
            latestSentMap.set(row.liked_user_id, { actionType: row.action_type, createdAt: row.created_at });
          }
        }

        // Collect all unique user IDs and batch-fetch in one pass
        const allUserIds = Array.from(new Set([
          ...latestLikeMap.keys(),
          ...latestSuperlikeMap.keys(),
          ...latestSentMap.keys(),
        ]));

        const profileData = await batchFetchProfiles(allUserIds, matchesResult);

        // Map likes received
        const likesProfiles = Array.from(latestLikeMap.entries())
          .map(([userId, createdAt]) => {
            const p = profileData[userId];
            if (!p) return null;
            return { ...p, likedTime: createdAt ? formatTimeAgo(createdAt) : undefined };
          })
          .filter(Boolean) as LikeProfile[];
        if (mounted) setLikesData(likesProfiles);

        // Map superlikes received
        const superlikedProfiles = Array.from(latestSuperlikeMap.entries())
          .map(([userId, createdAt]) => {
            const p = profileData[userId];
            if (!p) return null;
            return { ...p, likedTime: createdAt ? formatTimeAgo(createdAt) : undefined };
          })
          .filter(Boolean) as LikeProfile[];
        if (mounted) setSuperlikesData(superlikedProfiles);

        // Map sent likes/superlikes
        const sentProfiles = Array.from(latestSentMap.entries())
          .map(([userId, sentMeta]) => {
            const p = profileData[userId];
            if (!p) return null;
            return {
              ...p,
              likedTime: sentMeta.createdAt ? formatTimeAgo(sentMeta.createdAt) : undefined,
              isSuperlikeSent: sentMeta.actionType === 'super_like',
            };
          })
          .filter(Boolean) as LikeProfile[];
        if (mounted) setLikesSentData(sentProfiles);

      } catch (error) {
        console.error('Error fetching likes data:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchLikesData();
    return () => { mounted = false; };
  }, []);

  // Refresh Likes sent every time the tab is opened
  useEffect(() => {
    if (selectedTab !== 'sent') return;
    let mounted = true;

    const fetchLatestSentLikes = async () => {
      try {
        if (mounted) setLoading(true);

        const { data: sessionData } = await supabase.auth.getSession();
        const currentUserId = sessionData?.session?.user?.id;
        if (!currentUserId) {
          if (mounted) setLikesSentData([]);
          return;
        }

        const matchesResult = await fetchFinalMatches();
        const { data: sentRows, error: sentRowsError } = await supabase
          .from('user_likes')
          .select('liked_user_id, action_type, updated_at, created_at')
          .eq('user_id', currentUserId)
          .in('action_type', ['like', 'super_like'])
          .order('updated_at', { ascending: false });

        if (sentRowsError || !sentRows) {
          if (mounted) setLikesSentData([]);
          return;
        }

        // Keep latest action per liked user (upsert can update action_type)
        const latestSentByUser = new Map<string, { actionType: string; createdAt?: string }>();
        for (const row of sentRows as any[]) {
          if (!latestSentByUser.has(row.liked_user_id)) {
            latestSentByUser.set(row.liked_user_id, {
              actionType: row.action_type,
              createdAt: row.created_at,
            });
          }
        }

        // Use batch fetch instead of N+1 per-user calls
        const sentUserIds = Array.from(latestSentByUser.keys());
        const profileData = await batchFetchProfilesForRefresh(sentUserIds, matchesResult);

        const sentProfiles = Array.from(latestSentByUser.entries())
          .map(([userId, sentMeta]) => {
            const p = profileData[userId];
            if (!p) return null;
            return {
              ...p,
              likedTime: sentMeta.createdAt ? formatTimeAgo(sentMeta.createdAt) : undefined,
              isSuperlikeSent: sentMeta.actionType === 'super_like',
            };
          })
          .filter(Boolean) as LikeProfile[];

        if (mounted) setLikesSentData(sentProfiles);
      } catch (error) {
        console.error('Error refreshing likes sent data:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchLatestSentLikes();
    return () => { mounted = false; };
  }, [selectedTab]);

  return (
    <LinearGradient
      colors={['#1a0d2e', '#2d1b4e', '#4a2c5a']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.gradientContainer}>
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
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}>
          <View style={styles.container}>
            {/* Title Section */}
            <View style={styles.titleSection}>
              <Text style={styles.title}>Likes You</Text>
            </View>

            {/* Filter/Tab Navigation Section - Pill Style */}
            <View style={styles.filterSection}>
              <View style={styles.pillContainer}>
                <TouchableOpacity
                  style={[
                    styles.pillButton,
                    selectedTab === 'likes' && styles.pillButtonActive,
                  ]}
                  onPress={() => setSelectedTab('likes')}
                  activeOpacity={0.7}>
                  <Text
                    style={[
                      styles.pillText,
                      selectedTab === 'likes' && styles.pillTextActive,
                    ]}>
                    Likes
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.pillButton,
                    selectedTab === 'superlikes' && styles.pillButtonActive,
                  ]}
                  onPress={() => setSelectedTab('superlikes')}
                  activeOpacity={0.7}>
                  <Text
                    style={[
                      styles.pillText,
                      selectedTab === 'superlikes' && styles.pillTextActive,
                    ]}>
                    Superlikes
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.pillButton,
                    selectedTab === 'sent' && styles.pillButtonActive,
                  ]}
                  onPress={() => setSelectedTab('sent')}
                  activeOpacity={0.7}>
                  <Text
                    style={[
                      styles.pillText,
                      selectedTab === 'sent' && styles.pillTextActive,
                    ]}>
                    Likes sent
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Content based on selected tab */}
            {selectedTab === 'likes' && (
              <>
                {/* Likes Grid */}
                {loading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#A855F7" />
                  </View>
                ) : likesData.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No likes yet</Text>
                  </View>
                ) : (
                  <View style={styles.grid}>
                    {likesData.map((like) => (
                      <TouchableOpacity
                        key={like.id}
                        style={styles.card}
                        onPress={() => {
                          router.push({
                            pathname: '/profile-details',
                            params: { userId: like.id },
                          });
                        }}
                        activeOpacity={0.9}
                      >
                        <View style={styles.imageContainer}>
                          <Image
                            source={like.image}
                            style={styles.profileImage}
                            contentFit="cover"
                            transition={500}
                          />
                          {!canSeeWhoLikedMe && (
                            <View style={{
                              ...StyleSheet.absoluteFillObject,
                              backgroundColor: 'rgba(10, 0, 30, 0.75)',
                              borderRadius: 12,
                              justifyContent: 'center',
                              alignItems: 'center',
                              zIndex: 10,
                            }}>
                              <Text style={{ color: '#FFD700', fontSize: 18, fontWeight: 'bold' }}>⭐</Text>
                              <Text style={{ color: '#FFFFFF', fontSize: 13, marginTop: 4, textAlign: 'center', paddingHorizontal: 12 }}>
                                Upgrade to see who liked you
                              </Text>
                              <TouchableOpacity
                                onPress={() => router.push('/(tabs)/profile')}
                                style={{ marginTop: 10, backgroundColor: '#7C3AED', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 }}
                                activeOpacity={0.8}>
                                <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600' }}>View Plans</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                          {like.compatibility !== undefined && canSeeWhoLikedMe && (
                            <View style={styles.compatibilityBadge}>
                              <Text style={styles.compatibilityText}>{like.compatibility}%</Text>
                            </View>
                          )}
                          <View style={styles.overlay}>
                            <View style={styles.infoSection}>
                              <Text style={styles.nameText}>
                                {canSeeWhoLikedMe ? like.name : 'Hidden User'}{canSeeWhoLikedMe && like.age ? `, ${like.age}` : ''}
                              </Text>
                              {like.distance && canSeeWhoLikedMe && (
                                <View style={styles.locationRow}>
                                  <MaterialIcons name="location-on" size={14} color="#FFFFFF" />
                                  <Text style={styles.locationText}>{like.distance}</Text>
                                </View>
                              )}
                            </View>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}

            {selectedTab === 'superlikes' && (
              <>
                {/* Superlikes Received Grid */}
                {loading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#A855F7" />
                  </View>
                ) : superlikesData.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No superlikes yet</Text>
                  </View>
                ) : (
                  <View style={styles.grid}>
                    {superlikesData.map((like) => (
                      <TouchableOpacity
                        key={like.id}
                        style={styles.card}
                        onPress={() => {
                          router.push({
                            pathname: '/profile-details',
                            params: { userId: like.id },
                          });
                        }}
                        activeOpacity={0.9}
                      >
                        <View style={styles.imageContainer}>
                          <Image
                            source={like.image}
                            style={styles.profileImage}
                            contentFit="cover"
                            transition={500}
                          />
                          {!canSeeWhoLikedMe && (
                            <View style={{
                              ...StyleSheet.absoluteFillObject,
                              backgroundColor: 'rgba(10, 0, 30, 0.75)',
                              borderRadius: 12,
                              justifyContent: 'center',
                              alignItems: 'center',
                              zIndex: 10,
                            }}>
                              <Text style={{ color: '#FFD700', fontSize: 18, fontWeight: 'bold' }}>⭐</Text>
                              <Text style={{ color: '#FFFFFF', fontSize: 13, marginTop: 4, textAlign: 'center', paddingHorizontal: 12 }}>
                                Upgrade to see who liked you
                              </Text>
                              <TouchableOpacity
                                onPress={() => router.push('/(tabs)/profile')}
                                style={{ marginTop: 10, backgroundColor: '#7C3AED', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 }}
                                activeOpacity={0.8}>
                                <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600' }}>View Plans</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                          {like.compatibility !== undefined && canSeeWhoLikedMe && (
                            <View style={styles.compatibilityBadge}>
                              <Text style={styles.compatibilityText}>{like.compatibility}%</Text>
                            </View>
                          )}
                          <View style={styles.overlay}>
                            <View style={styles.superlikeBadge}>
                              <MaterialIcons name="stars" size={12} color="#FFE08A" />
                              <Text style={styles.superlikeBadgeText}>Superliked you</Text>
                            </View>
                            <View style={styles.infoSection}>
                              <Text style={styles.nameText}>
                                {canSeeWhoLikedMe ? like.name : 'Hidden User'}{canSeeWhoLikedMe && like.age ? `, ${like.age}` : ''}
                              </Text>
                              {like.distance && canSeeWhoLikedMe && (
                                <View style={styles.locationRow}>
                                  <MaterialIcons name="location-on" size={14} color="#FFFFFF" />
                                  <Text style={styles.locationText}>{like.distance}</Text>
                                </View>
                              )}
                            </View>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}

            {selectedTab === 'sent' && (
              <>
                {/* Likes Sent Grid */}
                {loading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#A855F7" />
                  </View>
                ) : likesSentData.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No likes sent yet</Text>
                  </View>
                ) : (
                  <View style={styles.grid}>
                    {likesSentData.map((like) => (
                      <TouchableOpacity
                        key={like.id}
                        style={styles.card}
                        onPress={() => {
                          router.push({
                            pathname: '/profile-details',
                            params: { userId: like.id },
                          });
                        }}
                        activeOpacity={0.9}
                      >
                        <View style={styles.imageContainer}>
                          <Image
                            source={like.image}
                            style={styles.profileImage}
                            contentFit="cover"
                            transition={500}
                          />
                          {like.compatibility !== undefined && (
                            <View style={styles.compatibilityBadge}>
                              <Text style={styles.compatibilityText}>{like.compatibility}%</Text>
                            </View>
                          )}
                          <View style={styles.overlay}>
                            {like.isSuperlikeSent && (
                              <View style={styles.sentSuperlikeBadge}>
                                <Ionicons name="paper-plane" size={14} color="#FFD700" style={styles.sentSuperlikeIcon} />
                              </View>
                            )}
                            <View style={styles.infoSection}>
                              <Text style={styles.nameText}>
                                {like.name}{like.age ? `, ${like.age}` : ''}
                              </Text>
                              {like.distance && (
                                <View style={styles.locationRow}>
                                  <MaterialIcons name="location-on" size={14} color="#FFFFFF" />
                                  <Text style={styles.locationText}>{like.distance}</Text>
                                </View>
                              )}
                            </View>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}

          </View>
        </ScrollView>

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
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientContainer: {
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
  scrollView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingTop: 20,
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 20,
  },
  // Title Section Styles
  titleSection: {
    marginBottom: 15,
    marginTop: 5,
  },
  title: {
    fontSize: 28,
    paddingTop: 30,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginLeft: 1,
  },
  // Filter/Tab Navigation Section Styles - Pill Style
  filterSection: {
    marginBottom: 20,
    marginLeft: -16,
    marginRight: -16,
    paddingHorizontal: 16,
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
  pillButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pillText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  pillTextActive: {
    color: '#7C3AED',
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  card: {
    width: '50%',
    borderRadius: 16,
    overflow: 'hidden',
    marginLeft: -5,
    marginRight: -5,
    backgroundColor: 'transparent',
    marginBottom: 1,
  },
  imageContainer: {
    width: '100%',
    height: 240,
    position: 'relative',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingTop: 8,
    paddingBottom: 12,
    paddingHorizontal: 12,
  },
  compatibilityBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#4A148C',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  superlikeBadge: {
    position: 'absolute',
    bottom: '100%',
    marginBottom: 20,
    marginLeft: -5,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(76, 29, 149, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255, 224, 138, 0.55)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    zIndex: 2,
  },
  superlikeBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  sentSuperlikeBadge: {
    position: 'absolute',
    bottom: '100%',
    marginBottom: 15,
    left: 10,
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    borderWidth: 1.5,
    borderColor: '#FFD700',
    borderRadius: 17,
    zIndex: 2,
  },
  sentSuperlikeIcon: {
    marginLeft: 1,
  },
  compatibilityText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  infoSection: {
    gap: 4,
  },
  nameText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 12,
    color: '#FFFFFF'
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.7,
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