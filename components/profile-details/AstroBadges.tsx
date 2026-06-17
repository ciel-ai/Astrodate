import React, { memo } from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface AstroBadgesProps {
  westernSign?: string;
  indianSign?: string;
  sunSignHarmony?: string;
  moonSignAlignment?: string;
}

const AstroBadges = memo(function AstroBadges({
  westernSign,
  indianSign,
  sunSignHarmony,
  moonSignAlignment,
}: AstroBadgesProps) {
  const hasBadges = westernSign || indianSign || sunSignHarmony || moonSignAlignment;
  if (!hasBadges) return null;

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {!!westernSign && (
          <View style={styles.badge}>
            <Ionicons name="moon-outline" size={12} color="#D8B4FE" />
            <Text style={styles.badgeText}>{westernSign}</Text>
          </View>
        )}
        {!!sunSignHarmony && (
          <View style={styles.badge}>
            <Ionicons name="sunny-outline" size={14} color="#FBBF24" />
            <Text style={styles.badgeText}>{sunSignHarmony}</Text>
          </View>
        )}
        {!!moonSignAlignment && (
          <View style={styles.badge}>
            <Ionicons name="moon" size={12} color="#FBBF24" />
            <Text style={styles.badgeText}>{moonSignAlignment}</Text>
          </View>
        )}
        {!!indianSign && (
          <View style={styles.badge}>
            <Ionicons name="sparkles" size={12} color="#D8B4FE" />
            <Text style={styles.badgeText}>High Energy</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
});

export default AstroBadges;

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
  },
  scrollContent: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.4)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E9D5FF',
  },
});
