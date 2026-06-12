import React, { memo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

interface InterestsSectionProps {
  interests?: string[];
  hobbies?: string[];
}

import { Ionicons } from '@expo/vector-icons';

// Simple mapping for common interests
const INTEREST_ICONS: Record<string, string> = {
  travel: 'airplane-outline',
  coffee: 'cafe-outline',
  music: 'musical-notes-outline',
  astrology: 'moon-outline',
  fitness: 'barbell-outline',
  photography: 'camera-outline',
  art: 'color-palette-outline',
  food: 'restaurant-outline',
  movies: 'film-outline',
  reading: 'book-outline',
  gaming: 'game-controller-outline',
};

const getIconForTag = (tag: string) => {
  const normalized = tag.toLowerCase();
  for (const [key, icon] of Object.entries(INTEREST_ICONS)) {
    if (normalized.includes(key)) return icon as keyof typeof Ionicons.glyphMap;
  }
  return 'star-outline';
};

const InterestsSection = memo(function InterestsSection({
  interests,
  hobbies,
}: InterestsSectionProps) {
  const tags =
    interests && interests.length > 0
      ? interests
      : hobbies && hobbies.length > 0
      ? hobbies
      : [];

  if (tags.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Ionicons name="sparkles" size={16} color="#D8B4FE" />
        <Text style={styles.title}>Interests</Text>
      </View>
      <View style={styles.tagsContainer}>
        {tags.map((tag, index) => (
          <View key={index} style={styles.interestTag}>
            <Ionicons name={getIconForTag(tag)} size={14} color="#D8B4FE" />
            <Text style={styles.interestText}>{tag}</Text>
          </View>
        ))}
      </View>
    </View>
  );
});

export default InterestsSection;

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 100, // padding for floating action bar
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
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.15)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  interestText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#E9D5FF',
  },
});
