import React, { memo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

interface InterestsSectionProps {
  interests?: string[];
  hobbies?: string[];
}

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
    <View style={styles.infoCard}>
      <Text style={styles.sectionLabel}>Interests</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {tags.map((tag, index) => (
          <View key={index} style={styles.interestTag}>
            <Text style={styles.interestText}>{tag}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
});

export default InterestsSection;

const styles = StyleSheet.create({
  infoCard: {
    backgroundColor: 'transparent',
    marginHorizontal: 0,
    marginTop: 5,
    borderRadius: 0,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  sectionLabel: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  scrollContent: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 20,
  },
  interestTag: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  interestText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
});
