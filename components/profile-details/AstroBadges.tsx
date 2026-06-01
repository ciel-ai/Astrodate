import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

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
      {westernSign && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>☀️ {westernSign}</Text>
        </View>
      )}
      {indianSign && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>🌙 {indianSign}</Text>
        </View>
      )}
      {sunSignHarmony && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>✨ Sun {sunSignHarmony}</Text>
        </View>
      )}
      {moonSignAlignment && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>🌊 Moon {moonSignAlignment}</Text>
        </View>
      )}
    </View>
  );
});

export default AstroBadges;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  badge: {
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.4)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E9D5FF',
  },
});
