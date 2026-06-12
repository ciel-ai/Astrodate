import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Profile } from '@/types/profile';

interface DeeperInsightsProps {
  personalityDetail?: Profile['personality_detail'];
}

export default function DeeperInsights({ personalityDetail }: DeeperInsightsProps) {
  if (!personalityDetail || Object.keys(personalityDetail).length === 0) {
    return null;
  }

  const renderCard = (title: string, value: string | string[] | undefined, iconName: keyof typeof Ionicons.glyphMap) => {
    if (!value || (Array.isArray(value) && value.length === 0)) return null;

    const displayValue = Array.isArray(value) ? value.join(', ') : value;

    return (
      <View style={styles.card}>
        <Ionicons name={iconName} size={20} color="#D8B4FE" style={styles.icon} />
        <View style={styles.textContainer}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardValue}>{displayValue}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Ionicons name="sparkles" size={16} color="#D8B4FE" />
        <Text style={styles.title}>Deeper Insights</Text>
      </View>

      <View style={styles.grid}>
        <View style={styles.column}>
          {renderCard('Ideal Date', personalityDetail.date_type, 'heart-outline')}
          {renderCard('Conversation Style', personalityDetail.conversations, 'chatbubble-outline')}
          {renderCard('Mindset', personalityDetail.overthink, 'trending-up')}
          {renderCard('As a Partner', personalityDetail.partner_type, 'people-outline')}
        </View>
        
        <View style={styles.column}>
          {renderCard('Loves To', personalityDetail.spend_time, 'cafe-outline')}
          {renderCard('Planning Style', personalityDetail.planning_style, 'calendar-outline')}
          {renderCard('Caring Style', personalityDetail.show_care, 'gift-outline')}
        </View>
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
    justifyContent: 'space-between',
    gap: 12,
  },
  column: {
    flex: 1,
    gap: 12,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.15)',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  icon: {
    marginTop: 2,
  },
  textContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#D8B4FE',
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 13,
    color: '#FFFFFF',
    lineHeight: 18,
    opacity: 0.9,
  },
});
