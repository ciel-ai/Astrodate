import type { DailyPick } from '@/lib/daily-picks';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function CosmicMatchCard({ pick, onPress }: {
  pick: DailyPick; onPress: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88}>
      <LinearGradient
        colors={['#1a0533', '#6d28d9']}
        style={{ marginHorizontal: 16, marginTop: insets.top + 8, borderRadius: 16, padding: 16 }}>
        <Text style={{
          color: 'rgba(255,255,255,.5)', fontSize: 11,
          letterSpacing: 1
        }}>✦ COSMIC MATCH TODAY</Text>
        <Text style={{
          color: '#fff', fontSize: 18, fontWeight: '600',
          marginTop: 4
        }}>{pick.full_name}</Text>
        <Text style={{
          color: 'rgba(255,255,255,.7)', fontSize: 13,
          marginTop: 2
        }}>
          {pick.western_sign} · AstroScore {Math.round(pick.astro_score * 10)}/10
        </Text>
        <Text style={{
          color: '#a78bfa', fontSize: 12,
          marginTop: 8
        }}>Tap to see their chart →</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}
