import { supabase } from '@/lib/supabase';
import { getUserPhotos } from '@/lib/user-photos';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type NotificationItem = {
  id: string;
  type: 'new_match' | 'new_message' | 'new_like' | 'new_superlike' | 'marketing';
  title: string;
  body: string;
  created_at: string;
  status: string;
  payload: {
    sender_id?: string;
    chat_id?: string;
    match_id?: string;
  };
  senderPhoto?: string | null;
  senderName?: string | null;
  read?: boolean;
};

const AVATAR_PLACEHOLDER = require('@/assets/images/avatar-placeholder.png');

const STAR_DATA = Array.from({ length: 60 }).map((_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 1.5 + 0.5,
  opacity: Math.random() * 0.5 + 0.1,
}));

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function getIconForType(type: NotificationItem['type']) {
  switch (type) {
    case 'new_match': return { name: 'favorite' as const, color: '#EC4899' };
    case 'new_message': return { name: 'chat-bubble' as const, color: '#A855F7' };
    case 'new_like': return { name: 'thumb-up' as const, color: '#F59E0B' };
    case 'new_superlike': return { name: 'stars' as const, color: '#FFD700' };
    default: return { name: 'notifications' as const, color: '#6B7280' };
  }
}

function getGradientForType(type: NotificationItem['type']): [string, string] {
  switch (type) {
    case 'new_match': return ['rgba(236,72,153,0.15)', 'rgba(236,72,153,0.03)'];
    case 'new_message': return ['rgba(168,85,247,0.15)', 'rgba(168,85,247,0.03)'];
    case 'new_like': return ['rgba(245,158,11,0.15)', 'rgba(245,158,11,0.03)'];
    case 'new_superlike': return ['rgba(255,215,0,0.15)', 'rgba(255,215,0,0.03)'];
    default: return ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.01)'];
  }
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const loadNotifications = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch notification delivery logs for this user
      const { data, error } = await supabase
        .from('notification_delivery_logs')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['sent', 'pending'])
        .order('created_at', { ascending: false })
        .limit(50);

      if (error || !data) {
        // Fallback: build notifications from matches and likes
        await loadFallbackNotifications(user.id);
        return;
      }

      // Enrich with sender photos
      const enriched: NotificationItem[] = await Promise.all(
        data.map(async (n: any) => {
          const senderId = n.payload?.sender_id;
          let senderPhoto = null;
          let senderName = null;
          if (senderId) {
            try {
              const [photoRes, nameRes] = await Promise.all([
                getUserPhotos(senderId),
                supabase.rpc('get_user_display_name', { p_target_user_id: senderId }),
              ]);
              if (photoRes.success && photoRes.data?.length) {
                const primary = photoRes.data.find((p: any) => p.is_primary) || photoRes.data[0];
                senderPhoto = primary?.photo_url ?? null;
              }
              senderName = nameRes.data?.[0]?.full_name ?? null;
            } catch { /* ignore */ }
          }
          return { ...n, senderPhoto, senderName };
        })
      );

      setNotifications(enriched);
    } catch (e) {
      console.error('[notifications screen] load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fallback: build a notification feed from matches + likes if delivery logs aren't populated yet
  const loadFallbackNotifications = async (userId: string) => {
    try {
      const [matchRes, likeRes] = await Promise.all([
        supabase
          .from('user_matches')
          .select('id, created_at, user1_id, user2_id')
          .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('user_likes')
          .select('id, created_at, user_id, liked_user_id, action_type')
          .eq('liked_user_id', userId)
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      const items: NotificationItem[] = [];

      // Matches
      for (const m of matchRes.data || []) {
        const otherId = m.user1_id === userId ? m.user2_id : m.user1_id;
        let senderPhoto = null;
        let senderName = null;
        try {
          const [photoRes, nameRes] = await Promise.all([
            getUserPhotos(otherId),
            supabase.rpc('get_user_display_name', { p_target_user_id: otherId }),
          ]);
          if (photoRes.success && photoRes.data?.length) {
            const primary = photoRes.data.find((p: any) => p.is_primary) || photoRes.data[0];
            senderPhoto = primary?.photo_url ?? null;
          }
          senderName = nameRes.data?.[0]?.full_name ?? null;
        } catch { /* ignore */ }

        items.push({
          id: `match-${m.id}`,
          type: 'new_match',
          title: '🎉 New Match!',
          body: senderName ? `You and ${senderName} liked each other` : 'You have a new match',
          created_at: m.created_at ?? new Date().toISOString(),
          status: 'sent',
          payload: { sender_id: otherId, match_id: m.id ?? undefined },
          senderPhoto,
          senderName,
        });
      }

      // Likes received
      for (const l of likeRes.data || []) {
        const type: NotificationItem['type'] = l.action_type === 'super_like' ? 'new_superlike' : 'new_like';
        let senderPhoto = null;
        let senderName = null;
        try {
          const [photoRes, nameRes] = await Promise.all([
            getUserPhotos(l.user_id),
            supabase.rpc('get_user_display_name', { p_target_user_id: l.user_id }),
          ]);
          if (photoRes.success && photoRes.data?.length) {
            const primary = photoRes.data.find((p: any) => p.is_primary) || photoRes.data[0];
            senderPhoto = primary?.photo_url ?? null;
          }
          senderName = nameRes.data?.[0]?.full_name ?? null;
        } catch { /* ignore */ }

        items.push({
          id: `like-${l.id ?? Math.random()}`,
          type,
          title: l.action_type === 'super_like' ? '⭐ Superlike!' : '💜 Someone liked you',
          body: senderName
            ? `${senderName} ${l.action_type === 'super_like' ? 'superliked' : 'liked'} you`
            : 'Someone liked your profile',
          created_at: l.created_at ?? new Date().toISOString(),
          status: 'sent',
          payload: { sender_id: l.user_id ?? undefined },
          senderPhoto,
          senderName,
        });
      }

      // Sort by date
      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setNotifications(items);
    } catch (e) {
      console.error('[notifications fallback] error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handlePress = (item: NotificationItem) => {
    setReadIds(prev => new Set([...prev, item.id]));
    const senderId = item.payload?.sender_id;
    const chatId = item.payload?.chat_id;
    if ((item.type === 'new_match' || item.type === 'new_message') && (chatId || senderId)) {
      router.push({ pathname: '/chat/[id]', params: { id: (chatId || senderId) as string } });
    } else if ((item.type === 'new_like' || item.type === 'new_superlike') && senderId) {
      router.push({ pathname: '/profile-details', params: { userId: senderId } });
    }
  };

  const unreadCount = notifications.filter(n => !readIds.has(n.id)).length;

  const renderItem = ({ item }: { item: NotificationItem }) => {
    const icon = getIconForType(item.type);
    const gradient = getGradientForType(item.type);
    const isUnread = !readIds.has(item.id);

    return (
      <TouchableOpacity
        onPress={() => handlePress(item)}
        activeOpacity={0.75}
        style={styles.notifWrapper}
      >
        <LinearGradient
          colors={isUnread ? gradient : ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.01)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.notifCard, isUnread && styles.notifCardUnread]}
        >
          {/* Unread dot */}
          {isUnread && <View style={styles.unreadDot} />}

          {/* Avatar */}
          <View style={styles.avatarWrap}>
            <Image
              source={item.senderPhoto ? { uri: item.senderPhoto } : AVATAR_PLACEHOLDER}
              style={styles.avatar}
              contentFit="cover"
            />
            <View style={[styles.iconBadge, { backgroundColor: icon.color + '22', borderColor: icon.color + '55' }]}>
              <MaterialIcons name={icon.name} size={12} color={icon.color} />
            </View>
          </View>

          {/* Text */}
          <View style={styles.notifText}>
            <Text style={[styles.notifTitle, isUnread && styles.notifTitleUnread]}>
              {item.title}
            </Text>
            <Text style={styles.notifBody} numberOfLines={1}>
              {item.body}
            </Text>
            <Text style={styles.notifTime}>{timeAgo(item.created_at)}</Text>
          </View>

          {/* Chevron */}
          <MaterialIcons name="chevron-right" size={18} color="rgba(255,255,255,0.25)" />
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyWrap}>
      <LinearGradient
        colors={['rgba(168,85,247,0.15)', 'rgba(168,85,247,0.0)']}
        style={styles.emptyOrb}
      />
      <MaterialIcons name="notifications-none" size={56} color="rgba(168,85,247,0.4)" />
      <Text style={styles.emptyTitle}>All caught up</Text>
      <Text style={styles.emptySubtitle}>Matches, likes and messages{'\n'}will appear here</Text>
    </View>
  );

  const renderSectionHeader = (label: string) => (
    <Text style={styles.sectionLabel}>{label}</Text>
  );

  // Group into Today / Earlier
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayItems = notifications.filter(n => new Date(n.created_at) >= today);
  const earlierItems = notifications.filter(n => new Date(n.created_at) < today);

  const grouped = [
    ...(todayItems.length ? [{ type: 'header', label: 'Today', id: 'h-today' }, ...todayItems] : []),
    ...(earlierItems.length ? [{ type: 'header', label: 'Earlier', id: 'h-earlier' }, ...earlierItems] : []),
  ] as any[];

  return (
    <View style={styles.screen}>
      {/* Starfield */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {STAR_DATA.map(s => (
          <View key={s.id} style={{
            position: 'absolute', left: `${s.x}%` as any, top: `${s.y}%` as any,
            width: s.size, height: s.size, borderRadius: s.size / 2,
            backgroundColor: '#fff', opacity: s.opacity,
          }} />
        ))}
      </View>

      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Notifications</Text>
            {unreadCount > 0 && (
              <Text style={styles.headerSub}>{unreadCount} new</Text>
            )}
          </View>
          {unreadCount > 0 && (
            <TouchableOpacity
              onPress={() => {
                setReadIds(new Set(notifications.map(n => n.id)));
              }}
              style={styles.markAllBtn}
            >
              <Text style={styles.markAllText}>Mark all read</Text>
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#A855F7" />
          </View>
        ) : (
          <FlatList
            data={grouped}
            keyExtractor={item => item.id}
            renderItem={({ item }) =>
              item.type === 'header'
                ? renderSectionHeader(item.label)
                : renderItem({ item })
            }
            ListEmptyComponent={renderEmpty}
            contentContainerStyle={[
              styles.listContent,
              notifications.length === 0 && styles.listContentEmpty,
            ]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); loadNotifications(); }}
                tintColor="#A855F7"
                colors={['#A855F7']}
              />
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0D0618',
  },
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 13,
    color: '#A855F7',
    fontWeight: '600',
    marginTop: 2,
  },
  markAllBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(168,85,247,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.3)',
  },
  markAllText: {
    color: '#A855F7',
    fontSize: 12,
    fontWeight: '600',
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  listContentEmpty: {
    flex: 1,
  },
  sectionLabel: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
  },
  notifWrapper: {
    marginBottom: 8,
  },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  notifCardUnread: {
    borderColor: 'rgba(168,85,247,0.2)',
  },
  unreadDot: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#A855F7',
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  iconBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A0B2E',
  },
  notifText: {
    flex: 1,
    gap: 2,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  notifTitleUnread: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  notifBody: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 18,
  },
  notifTime: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 2,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 80,
  },
  emptyOrb: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    alignSelf: 'center',
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    lineHeight: 22,
  },
});