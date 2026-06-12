import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Profile } from '@/types/profile';

interface EssentialsGridProps {
  profile: Profile;
}

export default function EssentialsGrid({ profile }: EssentialsGridProps) {
  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Ionicons name="sparkles" size={16} color="#D8B4FE" />
        <Text style={styles.title}>Essentials</Text>
      </View>

      <View style={styles.grid}>
        {profile.compatibility !== undefined && (
          <View style={styles.card}>
            <View style={styles.cardIcon}>
              <Ionicons name="location-outline" size={18} color="#D8B4FE" />
            </View>
            <View>
              <Text style={styles.cardLabel}>Nearby</Text>
              <Text style={styles.cardValue}>5 km away</Text> {/* TODO: Make dynamic based on actual distance if available */}
            </View>
          </View>
        )}

        {profile.location && (
          <View style={styles.card}>
            <View style={styles.cardIcon}>
              <Ionicons name="home-outline" size={18} color="#D8B4FE" />
            </View>
            <View>
              <Text style={styles.cardLabel}>Lives in</Text>
              <Text style={styles.cardValue} numberOfLines={2}>
                {profile.location}
              </Text>
            </View>
          </View>
        )}

        {profile.gender && (
          <View style={styles.card}>
            <View style={styles.cardIcon}>
              <Ionicons name="person-outline" size={18} color="#D8B4FE" />
            </View>
            <View>
              <Text style={styles.cardLabel}>Gender</Text>
              <Text style={styles.cardValue}>{profile.gender}</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginTop: 24,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  card: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.15)',
    gap: 8,
  },
  cardIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 2,
  },
  cardValue: {
    fontSize: 12,
    color: '#FFFFFF',
    lineHeight: 16,
  },
});
