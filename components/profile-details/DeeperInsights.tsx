import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Profile } from '@/types/profile';

interface DeeperInsightsProps {
  personalityDetail?: Profile['personality_detail'];
}

const PERSONALITY_LABELS: Record<string, string> = {
  'cafe-talk': 'Cozy cafés & hours of talk',
  'explore': 'Exploring random new places',
  'movie-dinner': 'Simple movie or dinner',
  'road-trip': 'Spontaneous road trips',
  'stick-to-known': 'Sticks to known favorites',
  'try-if-encouraged': 'Needs a little push to try new things',
  'open-to-it': 'Open to unusual experiences',
  'suggest-crazy': 'Always suggesting crazy ideas',
  'everyday-talks': 'Cute, simple everyday talks',
  'goals-life': 'Goal & life-related discussions',
  'deep-philosophical': 'Deep & philosophical chats',
  'creative-brainstorm': 'Creative midnight brainstorming',
  'go-with-flow': 'Go-with-the-flow',
  'plan-little': 'Plans a little',
  'organise-things': 'Likes to organise things',
  'plan-dates-project': 'Plans dates like projects',
  'forget-sometimes': 'Forgets sometimes',
  'try-best': 'Tries their best to remember',
  'responsible-steady': 'Responsible & steady',
  'promise-do-it': 'No excuses, just action',
  'disaster-zone': 'Disaster zone',
  'manageable': 'Manageable',
  'clean-most-time': 'Clean most of the time',
  'organised-pinterest': 'Pinterest-perfect organisation',
  'chill-home': 'Chill at home',
  'quiet-date': 'Quiet dates',
  'fun-activities': 'Fun activities',
  'big-social': 'Big social plans',
  'low-key': 'Low-key and calm',
  'balanced': 'Balanced energy',
  'fun-energetic': 'Fun & energetic',
  'hyper-excitement': 'Full hyper excitement',
  'calm-introverted': 'Calm and introverted',
  'balanced-partner': 'Balanced partner',
  'outgoing': 'Outgoing',
  'super-social': 'Super social and lively',
  'avoid-talking': 'Avoids talking',
  'calm-discuss': 'Calms down then discusses',
  'understand-view': 'Tries to understand your view',
  'solve-immediately': 'Solves it with patience',
  'small-gestures': 'Prefers small gestures',
  'listening': 'Is a good listener',
  'emotional-support': 'Provides emotional support',
  'going-out-way': 'Goes out of their way for love',
  'independent': 'Independent partner',
  'supportive': 'Supportive partner',
  'empathetic': 'Empathetic partner',
  'soft-kind': 'Soft, kind, and comforting',
  'totally-fine': 'Totally fine with late replies',
  'slightly-curious': 'Slightly curious when you\'re late',
  'overthinking': 'A bit overthinking about replies',
  'very-anxious': 'Anxious about late replies',
  'rarely-stressed': 'Rarely feels stressed',
  'handle-okay': 'Handles stress okay',
  'emotional-sometimes': 'Gets emotional sometimes',
  'feel-deeply': 'Feels things very deeply',
  'almost-never': 'Almost never overthinks',
  'occasionally': 'Occasionally overthinks',
  'quite-often': 'Often overthinks',
  'all-time': 'Overthinks all the time',
};

const label = (key?: string) =>
  key ? PERSONALITY_LABELS[key] || key : null;

export default function DeeperInsights({ personalityDetail }: DeeperInsightsProps) {
  if (!personalityDetail || Object.keys(personalityDetail).length === 0) {
    return null;
  }

  const renderCard = (title: string, rawValue: string | string[] | undefined, iconName: keyof typeof Ionicons.glyphMap) => {
    if (!rawValue || (Array.isArray(rawValue) && rawValue.length === 0)) return null;

    const displayValue = Array.isArray(rawValue)
      ? rawValue.map((v) => label(v) || v).join(', ')
      : label(rawValue) || rawValue;

    return (
      <View key={title} style={styles.card}>
        <Ionicons name={iconName} size={20} color="#D8B4FE" style={styles.icon} />
        <View style={styles.textContainer}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardValue}>{displayValue}</Text>
        </View>
      </View>
    );
  };

  const insightsData = [
    { title: 'Ideal Date', value: personalityDetail.date_type, icon: 'heart-outline' as const },
    { title: 'New Experiences', value: personalityDetail.unusual_foods, icon: 'restaurant-outline' as const },
    { title: 'Conversation Style', value: personalityDetail.conversations, icon: 'chatbubble-outline' as const },
    { title: 'Planning Style', value: personalityDetail.planning_style, icon: 'calendar-outline' as const },
    { title: 'Commitments', value: personalityDetail.commitments, icon: 'shield-checkmark-outline' as const },
    { title: 'Organisation', value: personalityDetail.workspace, icon: 'home-outline' as const },
    { title: 'Loves To', value: personalityDetail.spend_time, icon: 'cafe-outline' as const },
    { title: 'Date Energy', value: personalityDetail.energy_level, icon: 'flash-outline' as const },
    { title: 'Partner Energy', value: personalityDetail.partner_energy, icon: 'flame-outline' as const },
    { title: 'In Arguments', value: personalityDetail.arguments, icon: 'megaphone-outline' as const },
    { title: 'Caring Style', value: personalityDetail.show_care, icon: 'gift-outline' as const },
    { title: 'As a Partner', value: personalityDetail.partner_type, icon: 'people-outline' as const },
    { title: 'Late Replies', value: personalityDetail.late_reply, icon: 'time-outline' as const },
    { title: 'Emotional', value: personalityDetail.emotional_handling, icon: 'water-outline' as const },
    { title: 'Mindset', value: personalityDetail.overthink, icon: 'trending-up' as const },
  ];

  const validInsights = insightsData.filter((item) => {
    return item.value && (!Array.isArray(item.value) || item.value.length > 0);
  });

  const leftColumn = validInsights.filter((_, index) => index % 2 === 0);
  const rightColumn = validInsights.filter((_, index) => index % 2 !== 0);

  if (validInsights.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Ionicons name="sparkles" size={16} color="#D8B4FE" />
        <Text style={styles.title}>Deeper Insights</Text>
      </View>

      <View style={styles.grid}>
        <View style={styles.column}>
          {leftColumn.map((item) => renderCard(item.title, item.value, item.icon))}
        </View>
        <View style={styles.column}>
          {rightColumn.map((item) => renderCard(item.title, item.value, item.icon))}
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
    flexShrink: 1,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#D8B4FE',
    marginBottom: 4,
    flexShrink: 1,
  },
  cardValue: {
    fontSize: 13,
    color: '#FFFFFF',
    lineHeight: 18,
    opacity: 0.9,
    flexShrink: 1,
  },
});
