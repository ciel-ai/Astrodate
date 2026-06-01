import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Profile } from '@/types/profile';

interface PersonalityTraitsProps {
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

const TraitRow = ({
  iconName,
  prefix,
  value,
}: {
  iconName: React.ComponentProps<typeof Ionicons>['name'];
  prefix: string;
  value: string | null | undefined;
}) => {
  if (!value) return null;
  return (
    <>
      <View style={styles.essentialItem}>
        <Ionicons name={iconName} size={20} color="#FFFFFF" />
        <Text style={styles.essentialText}>
          {prefix}: {value}
        </Text>
      </View>
      <View style={styles.separator} />
    </>
  );
};

const PersonalityTraits = memo(function PersonalityTraits({
  personalityDetail,
}: PersonalityTraitsProps) {
  if (!personalityDetail) return null;

  const dateTypes =
    personalityDetail.date_type && personalityDetail.date_type.length > 0
      ? personalityDetail.date_type.map((d) => label(d) || d).join(', ')
      : null;

  return (
    <View style={styles.infoCard}>
      <Text style={styles.sectionLabel}>Deeper Insights</Text>
      <View style={styles.essentialsList}>
        {dateTypes && (
          <>
            <View style={styles.essentialItem}>
              <Ionicons name="heart-outline" size={20} color="#FFFFFF" />
              <Text style={styles.essentialText}>Ideal Date: {dateTypes}</Text>
            </View>
            <View style={styles.separator} />
          </>
        )}
        <TraitRow
          iconName="time-outline"
          prefix="Loves to"
          value={label(personalityDetail.spend_time)}
        />
        <TraitRow
          iconName="chatbubbles-outline"
          prefix="Conversation"
          value={label(personalityDetail.conversations)}
        />
        <TraitRow
          iconName="calendar-outline"
          prefix="Planning"
          value={label(personalityDetail.planning_style)}
        />
        <TraitRow
          iconName="analytics-outline"
          prefix="Mindset"
          value={label(personalityDetail.overthink)}
        />
        <TraitRow
          iconName="rose-outline"
          prefix="Caring Style"
          value={label(personalityDetail.show_care)}
        />
        <TraitRow
          iconName="body-outline"
          prefix="As a Partner"
          value={label(personalityDetail.partner_type)}
        />
        <TraitRow
          iconName="water-outline"
          prefix="Emotional"
          value={label(personalityDetail.emotional_handling)}
        />
        <TraitRow
          iconName="home-outline"
          prefix="Organisation"
          value={label(personalityDetail.workspace)}
        />
      </View>
    </View>
  );
});

export default PersonalityTraits;

const styles = StyleSheet.create({
  infoCard: {
    backgroundColor: 'transparent',
    marginHorizontal: 0,
    marginTop: 5,
    borderRadius: 0,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginBottom: 150,
  },
  sectionLabel: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  essentialsList: {
    marginTop: 5,
  },
  essentialItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 15,
  },
  essentialText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
    flex: 1,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    width: '100%',
  },
});
