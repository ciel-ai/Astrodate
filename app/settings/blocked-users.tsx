import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getBlockedUserIds, unblockUser } from '@/lib/blocks';
import { useAuthAlert } from '@/lib/auth-alert-context';
import { supabase } from '@/lib/supabase';

const PLACEHOLDER = require('@/assets/images/avatar-placeholder.png');

type BlockedUser = {
  id: string;
  name: string;
  image: { uri: string } | number;
};

export default function BlockedUsersScreen() {
  const router = useRouter();
  const { showAlert } = useAuthAlert();
  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const blocked = await getBlockedUserIds();
      const ids = blocked.success ? (blocked.data ?? []) : [];
      if (ids.length === 0) {
        setUsers([]);
        return;
      }

      const [profilesRes, photosRes] = await Promise.all([
        supabase.rpc('get_users_display_info', { p_target_user_ids: ids }),
        supabase
          .from('user_photos')
          .select('user_id, photo_url, is_primary')
          .in('user_id', ids),
      ]);

      const profileMap: Record<string, any> = {};
      for (const p of (((profilesRes as any).data ?? []) as any[])) profileMap[p.user_id] = p;

      const photosMap: Record<string, any[]> = {};
      for (const ph of (((photosRes as any).data ?? []) as any[])) {
        if (!ph.user_id) continue;
        if (!photosMap[ph.user_id]) photosMap[ph.user_id] = [];
        photosMap[ph.user_id].push(ph);
      }

      const list: BlockedUser[] = ids.map((id) => {
        const profile = profileMap[id];
        const photos = photosMap[id] ?? [];
        const primary = photos.find((p) => p.is_primary) || photos[0] || null;
        return {
          id,
          name: profile?.full_name || 'User',
          image: primary?.photo_url ? { uri: primary.photo_url } : PLACEHOLDER,
        };
      });
      setUsers(list);
    } catch {
      showAlert('Error', 'Could not load blocked users. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  useEffect(() => { load(); }, [load]);

  const handleUnblock = useCallback(async (user: BlockedUser) => {
    setUnblockingId(user.id);
    try {
      const result = await unblockUser(user.id);
      if (result.success) {
        setUsers((prev) => prev.filter((u) => u.id !== user.id));
      } else {
        showAlert('Error', result.error ?? 'Failed to unblock. Please try again.');
      }
    } catch {
      showAlert('Error', 'Failed to unblock. Please try again.');
    } finally {
      setUnblockingId(null);
    }
  }, [showAlert]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Blocked Users</Text>
        <View style={styles.iconBtn} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#A855F7" />
        </View>
      ) : users.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="shield-checkmark-outline" size={48} color="rgba(255,255,255,0.3)" />
          <Text style={styles.emptyTitle}>No blocked users</Text>
          <Text style={styles.emptyText}>People you block will appear here.</Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Image source={item.image} style={styles.avatar} />
              <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
              <TouchableOpacity
                style={styles.unblockBtn}
                onPress={() => handleUnblock(item)}
                disabled={unblockingId === item.id}
                activeOpacity={0.8}
              >
                {unblockingId === item.id ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.unblockText}>Unblock</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#04020b' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#FFFFFF', marginTop: 8 },
  emptyText: { fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center' },
  listContent: { padding: 16, gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.15)',
  },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.1)' },
  name: { flex: 1, marginLeft: 12, fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  unblockBtn: {
    backgroundColor: '#A855F7',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 9,
    minWidth: 92,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unblockText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
});
