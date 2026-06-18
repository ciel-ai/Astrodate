import { saveSection1Responses } from '@/lib/onboarding-responses';
import { savePersonalityQnsResponses } from '@/lib/personality-qns';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

type QuestionnaireStep = {
  id: string;
  title: string;
  subtitle: string;
  multiple?: boolean;
  limit?: number;
  optional?: boolean;
  icon?: IconName;
  options?: { value: string; label: string; description: string; icon?: IconName; emoji?: string }[];
    subQuestions?: {
      id: string;
      title: string;
      icon?: IconName;
      multiple?: boolean;
      options: { value: string; label: string }[];
    }[];
  info?: {
    variant: 'mid-break';
    title: string;
    subtitle?: string;
    description?: string;
  };
};

const COMPLETION_KEY = 'astro_onboarding_complete';
const QUESTIONS_PER_PAGE = 3;

const QUESTIONNAIRE: QuestionnaireStep[] = [
  {
    id: 'interest',
    title: 'Who are you interested in seeing?',
    subtitle: 'Select all that apply to help us recommend the right people for you.',
    multiple: true,
    options: [
      { value: 'men', label: 'Men', description: '' },
      { value: 'women', label: 'Women', description: '' },
      { value: 'beyond-binary', label: 'Beyond Binary', description: '' },
      { value: 'everyone', label: 'Everyone', description: '' },
    ],
  },
  {
    id: 'looking-for',
    title: 'What are you looking for?',
    subtitle: 'All good if it changes. There\'s something for everyone.',
    options: [
      { value: 'casual', label: 'Something casual', description: '', emoji: '🎉' },
      { value: 'long-term', label: 'Long-term relationship', description: '', emoji: '💘' },
      { value: 'long-open-short', label: 'Long-term, open to short', description: '', emoji: '😍' },
      { value: 'short-open-long', label: 'Short-term, open to long', description: '', emoji: '🥂' },
      { value: 'friends', label: 'Making friends', description: '', emoji: '👋' },
      { value: 'not-sure', label: 'Not sure yet', description: '', emoji: '🤔' },
    ],
  },
  {
    id: 'relationship-status',
    title: 'What\'s your relationship status?',
    subtitle: 'This helps us match you better.',
    options: [
      { value: 'single', label: 'Single', description: '', icon: 'person' },
      { value: 'divorced', label: 'Divorced', description: '', icon: 'person-outline' },
      { value: 'separated', label: 'Separated', description: '', icon: 'people-outline' },
      { value: 'prefer-not-say', label: 'Prefer not to say', description: '', icon: 'lock-outline' },
    ],
  },
  {
    id: 'hobbies',
    title: 'What are your hobbies?',
    subtitle: 'Select all that apply.',
    multiple: true,
    options: [
      { value: 'movies', label: 'Movies/series', description: '', icon: 'movie' },
      { value: 'travel', label: 'Travel', description: '', icon: 'flight-takeoff' },
      { value: 'music', label: 'Music', description: '', icon: 'music-note' },
      { value: 'gym', label: 'Gym/fitness', description: '', icon: 'fitness-center' },
      { value: 'reading', label: 'Reading', description: '', icon: 'menu-book' },
      { value: 'gaming', label: 'Gaming', description: '', icon: 'sports-esports' },
    ],
  },
  {
    id: 'height',
    title: 'How tall are you?',
    subtitle: 'This helps us find compatible matches.',
    options: [
      { value: 'under-150', label: '<150 cm', description: '', icon: 'height' },
      { value: '150-165', label: '150–165 cm', description: '', icon: 'height' },
      { value: '165-180', label: '165–180 cm', description: '', icon: 'height' },
      { value: 'over-180', label: '180 cm+', description: '', icon: 'height' },
    ],
  },
  {
    id: 'introvert-extrovert',
    title: 'What is your introvert–extrovert level?',
    subtitle: 'Help us understand your social energy.',
    options: [
      { value: 'introvert', label: 'Introvert', description: '', icon: 'self-improvement' },
      { value: 'ambivert', label: 'Ambivert', description: '', icon: 'contrast' },
      { value: 'extrovert', label: 'Extrovert', description: '', icon: 'celebration' },
      { value: 'depends', label: 'Depends on my mood', description: '', icon: 'waves' },
    ],
  },
  {
    id: 'partner-preference',
    title: 'What kind of partner do you prefer?',
    subtitle: 'Select the traits that matter most to you.',
    multiple: true,
    options: [
      { value: 'calm-mature', label: 'Calm & mature', description: '', icon: 'spa' },
      { value: 'fun-outgoing', label: 'Fun & outgoing', description: '', icon: 'celebration' },
      { value: 'ambitious', label: 'Ambitious', description: '', icon: 'trending-up' },
      { value: 'caring-soft', label: 'Caring & soft', description: '', icon: 'favorite' },
    ],
  },
  {
    id: 'mid-break',
    title: '',
    subtitle: '',
    optional: true,
    icon: undefined,
    options: [],
    info: {
      variant: 'mid-break',
      title: 'Tell us a little.',
      subtitle: 'We’ll find someone who understands a lot.',
      description: 'Just a few honest answers help us understand the rhythm you move with.',
    },
  },
  {
    id: 'lifestyle-habits',
    title: 'Let\'s talk lifestyle habits',
    subtitle: 'Do their habits match yours? You go first.',
    multiple: false,
    subQuestions: [
      {
        id: 'date-type',
        title: 'What type of date excites you the most?',
        icon: 'favorite',
        options: [
          { value: 'cafe-talk', label: 'A cozy café where we talk for hours' },
          { value: 'explore', label: 'A random new place we decide to explore' },
          { value: 'movie-dinner', label: 'A movie or simple dinner, nothing too wild' },
          { value: 'road-trip', label: 'A totally spontaneous road trip' },
        ],
      },
      {
        id: 'unusual-foods',
        title: 'How do you feel about trying unusual foods or activities?',
        icon: 'restaurant',
        options: [
          { value: 'stick-to-known', label: 'Nope, I like sticking to what I know' },
          { value: 'try-if-encouraged', label: 'I\'ll try if someone encourages me' },
          { value: 'open-to-it', label: 'Sounds fun, I\'m open to it' },
          { value: 'suggest-crazy', label: 'I\'m the one who suggests crazy ideas first' },
        ],
      },
      {
        id: 'conversations',
        title: 'What kind of conversations do you enjoy with a partner?',
        icon: 'chat',
        options: [
          { value: 'everyday-talks', label: 'Cute, simple, everyday talks' },
          { value: 'goals-life', label: 'Goal & life-related discussions' },
          { value: 'deep-philosophical', label: 'Deep emotional & philosophical chats' },
          { value: 'creative-brainstorm', label: 'Random creative brainstorming at midnight' },
        ],
      },
      {
        id: 'planning-style',
        title: 'What best describes your planning style?',
        icon: 'event',
        options: [
          { value: 'go-with-flow', label: 'Go-with-the-flow' },
          { value: 'plan-little', label: 'I plan a little' },
          { value: 'organise-things', label: 'I like to organise things' },
          { value: 'plan-dates-project', label: 'I plan dates like a mini project' },
        ],
      },
      {
        id: 'commitments',
        title: 'How do you handle commitments in a relationship?',
        icon: 'handshake',
        options: [
          { value: 'forget-sometimes', label: 'I forget sometimes' },
          { value: 'try-best', label: 'I try my best to remember' },
          { value: 'responsible-steady', label: 'I\'m responsible and steady' },
          { value: 'promise-do-it', label: 'If I promise, I\'ll do it—no excuses' },
        ],
      },
    ],
  },
  {
    id: 'personality-traits',
    title: 'Let\'s understand your personality',
    subtitle: 'Help us match you with compatible personalities.',
    multiple: false,
    subQuestions: [
      {
        id: 'workspace',
        title: 'Your room or workspace usually looks like…',
        icon: 'home',
        options: [
          { value: 'disaster-zone', label: 'A disaster zone' },
          { value: 'manageable', label: 'Manageable' },
          { value: 'clean-most-time', label: 'Clean most of the time' },
          { value: 'organised-pinterest', label: 'Organised like Pinterest' },
        ],
      },
      {
        id: 'spend-time',
        title: 'Your ideal way to spend time with a partner:',
        icon: 'favorite',
        options: [
          { value: 'chill-home', label: 'Chill at home doing our own thing' },
          { value: 'quiet-date', label: 'Quiet date with just the two of us' },
          { value: 'fun-activities', label: 'Going out for fun activities' },
          { value: 'big-social', label: 'Big social plans with friends' },
        ],
      },
      {
        id: 'energy-level',
        title: 'Your energy level on dates is usually…',
        icon: 'bolt',
        options: [
          { value: 'low-key', label: 'Low-key, calm' },
          { value: 'balanced', label: 'Balanced' },
          { value: 'fun-energetic', label: 'Fun & energetic' },
          { value: 'hyper-excitement', label: 'Hyper, full excitement' },
        ],
      },
      {
        id: 'partner-preference-energy',
        title: 'You prefer a partner who is…',
        icon: 'people',
        options: [
          { value: 'calm-introverted', label: 'Calm and introverted' },
          { value: 'balanced-partner', label: 'Balanced' },
          { value: 'outgoing', label: 'Outgoing' },
          { value: 'super-social', label: 'Super social and lively' },
        ],
      },
      {
        id: 'arguments',
        title: 'During arguments, you usually…',
        icon: 'forum',
        options: [
          { value: 'avoid-talking', label: 'Avoid talking' },
          { value: 'calm-discuss', label: 'Calm down & then discuss' },
          { value: 'understand-view', label: 'Try to understand their view' },
          { value: 'solve-immediately', label: 'Solve it immediately with patience' },
        ],
      },
    ],
  },
  {
    id: 'relationship-dynamics',
    title: 'Let\'s understand your relationship style',
    subtitle: 'Help us match you with compatible partners.',
    multiple: false,
    subQuestions: [
      {
        id: 'show-care',
        title: 'How do you show care in a relationship?',
        icon: 'favorite',
        options: [
          { value: 'small-gestures', label: 'Small gestures' },
          { value: 'listening', label: 'Listening when needed' },
          { value: 'emotional-support', label: 'Supporting them emotionally' },
          { value: 'going-out-way', label: 'Going out of my way to make them feel loved' },
        ],
      },
      {
        id: 'partner-type',
        title: 'What kind of partner are you?',
        icon: 'people',
        options: [
          { value: 'independent', label: 'Independent' },
          { value: 'supportive', label: 'Supportive' },
          { value: 'empathetic', label: 'Empathetic' },
          { value: 'soft-kind', label: 'Soft, kind, and comforting' },
        ],
      },
      {
        id: 'late-reply',
        title: 'When your partner replies late, you feel…',
        icon: 'schedule',
        options: [
          { value: 'totally-fine', label: 'Totally fine' },
          { value: 'slightly-curious', label: 'Slightly curious' },
          { value: 'overthinking', label: 'A bit overthinking' },
          { value: 'very-anxious', label: 'Very anxious' },
        ],
      },
      {
        id: 'emotional-handling',
        title: 'How do you handle emotional ups and downs?',
        icon: 'mood',
        options: [
          { value: 'rarely-stressed', label: 'I rarely feel stressed' },
          { value: 'handle-okay', label: 'I handle things okay' },
          { value: 'emotional-sometimes', label: 'I get emotional sometimes' },
          { value: 'feel-deeply', label: 'I feel things very deeply' },
        ],
      },
      {
        id: 'overthink',
        title: 'How often do you overthink relationships?',
        icon: 'psychology',
        options: [
          { value: 'almost-never', label: 'Almost never' },
          { value: 'occasionally', label: 'Occasionally' },
          { value: 'quite-often', label: 'Quite often' },
          { value: 'all-time', label: 'All the time' },
        ],
      },
    ],
  },
];

const TOTAL_QUESTION_COUNT = QUESTIONNAIRE.filter((question) => !question.info).length;

const COLORS = {
  background: '#FFFFFF',
  textPrimary: '#1B1528',
  textSecondary: '#6B7280',
  accent: '#4B0082',
  accentLight: '#6A0DAD',
  accentSoft: '#F3ECFF',
  border: '#E5E7EB',
  success: '#10B981',
  shadow: 'rgba(75, 0, 130, 0.1)',
};

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [pageIndex, setPageIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const totalQuestions = TOTAL_QUESTION_COUNT;
  // Intro page + every entry in QUESTIONNAIRE (including info breaks)
  const totalPages = QUESTIONNAIRE.length + 1;
  const isLastPage = pageIndex === totalPages - 1;
  const isIntroPage = pageIndex === 0;
  const currentPageEntry = !isIntroPage && pageIndex - 1 >= 0 ? QUESTIONNAIRE[pageIndex - 1] : undefined;
  const currentPageQuestions = currentPageEntry ? [currentPageEntry] : [];
  const questionIsInfo = !!currentPageEntry?.info;
  const questionsBeforeCount = !isIntroPage
    ? QUESTIONNAIRE.slice(0, Math.max(pageIndex - 1, 0)).filter((question) => !question.info).length
    : 0;
  const currentQuestionNumber = questionIsInfo ? questionsBeforeCount : questionsBeforeCount + (currentPageEntry && !questionIsInfo ? 1 : 0);
  const progress =
    totalQuestions === 0
      ? 0
      : questionIsInfo || isIntroPage
        ? (questionsBeforeCount / totalQuestions) * 100
        : (currentQuestionNumber / totalQuestions) * 100;


  const updateAnswer = useCallback(
    (questionId: string, value: string) => {
      setAnswers((prev) => {
        // Check if this is a subQuestion
        const parentQuestion = QUESTIONNAIRE.find((q) => 
          q.subQuestions?.some((sq) => sq.id === questionId)
        );
        
        if (parentQuestion) {
          // Handle subQuestion - check if multiple selection is allowed
          const subQuestion = parentQuestion.subQuestions?.find((sq) => sq.id === questionId);
          const existing = prev[questionId] ?? [];
          
          if (subQuestion?.multiple || parentQuestion.multiple) {
            // Multiple selection allowed
            const alreadySelected = existing.includes(value);
            if (alreadySelected) {
              return {
                ...prev,
                [questionId]: existing.filter((item) => item !== value),
              };
            }
            return {
              ...prev,
              [questionId]: [...existing, value],
            };
          } else {
            // Single selection
            return {
              ...prev,
              [questionId]: [value],
            };
          }
        }

        // Handle regular question
        const question = QUESTIONNAIRE.find((q) => q.id === questionId);
        if (!question) return prev;

        const existing = prev[questionId] ?? [];

        if (!question.multiple) {
          return {
            ...prev,
            [questionId]: [value],
          };
        }

        const alreadySelected = existing.includes(value);
        if (alreadySelected) {
          return {
            ...prev,
            [questionId]: existing.filter((item) => item !== value),
          };
        }

        if (question.limit && existing.length >= question.limit) {
          return prev;
        }

        return {
          ...prev,
          [questionId]: [...existing, value],
        };
      });
    },
    [],
  );

  const canContinue = useMemo(() => {
    if (isIntroPage || questionIsInfo) return true;
    return currentPageQuestions.every((question) => {
      if (question.info) return true;
      if (question.optional) return true;
      if (question.subQuestions) {
        // For multi-question pages, check all subQuestions
        return question.subQuestions.every((subQ) => {
          const subAnswers = answers[subQ.id] ?? [];
          return subAnswers.length > 0;
        });
      }
      const questionAnswers = answers[question.id] ?? [];
      return questionAnswers.length > 0;
    });
  }, [currentPageQuestions, answers, isIntroPage]);

  const persistCompletion = useCallback(async () => {
    try {
      await AsyncStorage.setItem(COMPLETION_KEY, 'true');
    } catch {
      // Swallow storage errors
    }
  }, []);

  const finishOnboarding = useCallback(async () => {
    setSaving(true);
    try {
      // Save Section 1 responses
      const section1Data = {
        interest: answers['interest'] || [],
        looking_for: answers['looking-for']?.[0],
        relationship_status: answers['relationship-status']?.[0],
        hobbies: answers['hobbies'] || [],
        height: answers['height']?.[0],
        introvert_extrovert: answers['introvert-extrovert']?.[0],
        partner_preference: answers['partner-preference'] || [],
      };
      await saveSection1Responses(section1Data);

      // Save Personality questionnaire responses (all 15 questions)
      const personalityData = {
        what_type_of_date_excites_you_the_most: answers['date-type'] || [],
        how_do_you_feel_about_trying_unusual_foods_or_activities: answers['unusual-foods']?.[0],
        what_kind_of_conversations_do_you_enjoy_with_a_partner: answers['conversations']?.[0],
        what_best_describes_your_planning_style: answers['planning-style']?.[0],
        how_do_you_handle_commitments_in_a_relationship: answers['commitments']?.[0],
        your_room_or_workspace_usually_looks_like: answers['workspace']?.[0],
        your_ideal_way_to_spend_time_with_a_partner: answers['spend-time']?.[0],
        your_energy_level_on_dates_is_usually: answers['energy-level']?.[0],
        you_prefer_a_partner_who_is: answers['partner-preference-energy']?.[0],
        during_arguments_you_usually: answers['arguments']?.[0],
        how_do_you_show_care_in_a_relationship: answers['show-care']?.[0],
        what_kind_of_partner_are_you: answers['partner-type']?.[0],
        when_your_partner_replies_late_you_feel: answers['late-reply']?.[0],
        how_do_you_handle_emotional_ups_and_downs: answers['emotional-handling']?.[0],
        how_often_do_you_overthink_relationships: answers['overthink']?.[0],
      };
      console.log('Saving personality questionnaire responses...');
      await savePersonalityQnsResponses(personalityData);
      console.log('✓ Personality responses saved and vector computation triggered');

      await persistCompletion();
      router.push('/onboarding/photo_upload');
    } catch (error) {
      console.error('Error saving onboarding responses:', error);
      console.error('Error details:', error instanceof Error ? error.message : String(error));
      setSaving(false);
      // Show alert to user
      if (error instanceof Error) {
        alert(`Failed to save responses: ${error.message}`);
      }
    }
  }, [persistCompletion, router, answers]);

  const handleContinue = () => {
    if (!isLastPage) {
      // Check if we're leaving a multi-question page (lifestyle-habits, personality-traits, relationship-dynamics)
      const currentQuestion = currentPageEntry;
      if (currentQuestion && (currentQuestion.id === 'lifestyle-habits' || 
          currentQuestion.id === 'personality-traits' || 
          currentQuestion.id === 'relationship-dynamics')) {
        // Scroll to top after page transition
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        }, 100);
      }
      
      setPageIndex((prev) => Math.min(prev + 1, totalPages - 1));
      return;
    }
    finishOnboarding();
  };

  const handleBack = () => {
    if (isIntroPage || pageIndex === 0) {
      router.replace('/(tabs)');
      return;
    }
    setPageIndex((prev) => Math.max(prev - 1, 0));
  };

  const handleSkip = () => {
    finishOnboarding();
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        {!isIntroPage && !questionIsInfo && (
          <View style={styles.header}>
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${progress}%` }]} />
              </View>
              <Text style={styles.progressText}>
                Page {Math.max(currentQuestionNumber, 1)} of {totalQuestions}
              </Text>
            </View>
          </View>
        )}

        {isIntroPage ? (
          <View style={styles.introContainer}>
            <View style={styles.introContent}>
              <Text style={styles.introTitle}>
                Let’s start simple —{'\n'}
                who are you beyond{'\n'}
                the profile?{'\n'}
                <Text style={styles.introTitleAccent}>Show us.</Text>
              </Text>
            </View>
            <View style={styles.introFooter}>
              <Pressable
                style={[styles.introArrowButton, { bottom: insets.bottom > 0 ? insets.bottom + 16 : 24 }]}
                onPress={handleContinue}
                hitSlop={10}>
                <MaterialIcons
                  name="arrow-forward"
                  size={24}
                  color={COLORS.background}
                />
              </Pressable>
            </View>
          </View>
        ) : questionIsInfo ? (
          <View style={styles.midInfoContainer}>
            <Text style={styles.midInfoTitle}>
              Tell us a little.{'\n'}
              We'll find someone{'\n'}
              who understands <Text style={styles.midInfoTitleAccent}>a lot.</Text>
            </Text>
            <Pressable
              style={[styles.midInfoArrowButton, { bottom: insets.bottom > 0 ? insets.bottom + 16 : 24 }]}
              onPress={handleContinue}
              hitSlop={10}>
              <MaterialIcons name="arrow-forward" size={24} color={COLORS.background} />
            </Pressable>
          </View>
        ) : (
          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
            {/* Questions for current page */}
            {currentPageQuestions.map((question, qIndex) => {
              if (question.info?.variant === 'mid-break') {
                return (
                  <View key={question.id} style={styles.midInfoContainer}>
                    <Text style={styles.midInfoTitle}>
                      Tell us a little.{'\n'}
                      We'll find someone{'\n'}
                      who understands <Text style={styles.midInfoTitleAccent}>a lot.</Text>
                    </Text>
                    <Pressable
                      style={[styles.midInfoArrowButton, { bottom: insets.bottom > 0 ? insets.bottom + 16 : 24 }]}
                      onPress={handleContinue}
                      hitSlop={10}>
                      <MaterialIcons name="arrow-forward" size={24} color={COLORS.background} />
                    </Pressable>
                  </View>
                );
              }
            const currentAnswers = answers[question.id] ?? [];

            return (
              <View key={question.id} style={styles.questionBlock}>
                <View style={styles.questionSection}>
                  <Text style={styles.questionTitle}>{question.title}</Text>
                  {question.subtitle && (
                    <Text style={styles.questionSubtitle}>{question.subtitle}</Text>
                  )}
                  {question.limit && (
                    <View style={styles.limitBadge}>
                      <Text style={styles.limitText}>
                        Select up to {question.limit}
                      </Text>
                    </View>
                  )}
                </View>

                {question.id === 'interest' ? (
                  <View style={styles.optionsList}>
                    {question.options?.map((option) => {
                      const isSelected = currentAnswers.includes(option.value);

                      return (
                        <Pressable
                          key={option.value}
                          style={[
                            styles.optionListItem,
                            isSelected && styles.optionListItemSelected,
                          ]}
                          onPress={() => updateAnswer(question.id, option.value)}>
                          <Text
                            style={[
                              styles.optionListLabel,
                              isSelected && styles.optionListLabelSelected,
                            ]}>
                            {option.label}
                          </Text>
                          {isSelected && (
                            <MaterialIcons
                              name="check"
                              size={20}
                              color={COLORS.accent}
                            />
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                ) : question.id === 'looking-for' ? (
                  <View style={styles.optionsGrid2Col}>
                    {question.options?.map((option) => {
                      const isSelected = currentAnswers.includes(option.value);

                      return (
                        <Pressable
                          key={option.value}
                          style={[
                            styles.optionCard2Col,
                            isSelected && styles.optionCard2ColSelected,
                          ]}
                          onPress={() => updateAnswer(question.id, option.value)}>
                          <Text style={styles.optionEmoji2Col}>
                            {option.emoji}
                          </Text>
                          <Text
                            style={[
                              styles.optionLabel2Col,
                              isSelected && styles.optionLabel2ColSelected,
                            ]}>
                            {option.label}
                          </Text>
                          {isSelected && (
                            <View style={styles.checkBadge2Col}>
                              <MaterialIcons
                                name="check-circle"
                                size={20}
                                color={COLORS.accent}
                              />
                            </View>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                ) : question.subQuestions ? (
                  <View style={styles.multiQuestionContainer}>
                    {question.subQuestions.map((subQ) => {
                      const subAnswers = answers[subQ.id] ?? [];
                      const answeredCount = question.subQuestions?.filter((sq) => {
                        const sa = answers[sq.id] ?? [];
                        return sa.length > 0;
                      }).length ?? 0;

                      return (
                        <View key={subQ.id} style={styles.subQuestionBlock}>
                          <View style={styles.subQuestionHeader}>
                            {subQ.icon && (
                              <MaterialIcons
                                name={subQ.icon}
                                size={20}
                                color={COLORS.textPrimary}
                                style={styles.subQuestionIcon}
                              />
                            )}
                            <Text style={styles.subQuestionTitle}>{subQ.title}</Text>
                          </View>
                          <View style={styles.ovalOptionsContainer}>
                            {subQ.options.map((option) => {
                              const isSelected = subAnswers.includes(option.value);

                              return (
                                <Pressable
                                  key={option.value}
                                  style={[
                                    styles.ovalOption,
                                    isSelected && styles.ovalOptionSelected,
                                  ]}
                                  onPress={() => updateAnswer(subQ.id, option.value)}>
                                  <Text
                                    style={[
                                      styles.ovalOptionLabel,
                                      isSelected && styles.ovalOptionLabelSelected,
                                    ]}>
                                    {option.label}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <View style={styles.optionsList}>
                    {question.options?.map((option) => {
                      const isSelected = currentAnswers.includes(option.value);
                      const limitReached =
                        question.multiple &&
                        !!question.limit &&
                        currentAnswers.length >= question.limit &&
                        !isSelected;

                      return (
                        <Pressable
                          key={option.value}
                          style={[
                            styles.optionListItem,
                            isSelected && styles.optionListItemSelected,
                            limitReached && styles.optionListItemDisabled,
                          ]}
                          onPress={() => updateAnswer(question.id, option.value)}
                          disabled={limitReached}>
                          <Text
                            style={[
                              styles.optionListLabel,
                              isSelected && styles.optionListLabelSelected,
                            ]}>
                            {option.label}
                          </Text>
                          {isSelected && (
                            <MaterialIcons
                              name="check"
                              size={20}
                              color={COLORS.accent}
                            />
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
          </ScrollView>
        )}

        {/* Footer */}
        {!isIntroPage && !questionIsInfo && (
          <View style={[styles.footer, { paddingBottom: insets.bottom > 0 ? insets.bottom + 8 : 24 }]}>
          <Pressable
            style={styles.backButton}
            onPress={handleBack}
            hitSlop={10}
            disabled={saving}>
            <View style={styles.backButtonCircle}>
              <MaterialIcons
                name="arrow-back"
                size={20}
                color="#000000"
              />
            </View>
          </Pressable>

          <Pressable
            style={[
              styles.continueButton,
              (!canContinue || saving) && styles.continueButtonDisabled,
            ]}
            onPress={handleContinue}
            disabled={!canContinue || saving}>
            {saving ? (
              <ActivityIndicator color={COLORS.background} size="small" />
            ) : (
              <>
                <Text style={styles.continueButtonText}>
                  {(currentPageEntry?.id === 'lifestyle-habits' ||
                    currentPageEntry?.id === 'personality-traits' ||
                    currentPageEntry?.id === 'relationship-dynamics')
                    ? `Next ${currentPageQuestions[0]?.subQuestions?.filter((sq) => {
                        const sa = answers[sq.id] ?? [];
                        return sa.length > 0;
                      }).length ?? 0} / ${currentPageQuestions[0]?.subQuestions?.length ?? 0}`
                    : isLastPage 
                    ? 'See matches' 
                    : 'Continue'}
                </Text>
                <MaterialIcons
                  name={isLastPage ? 'favorite' : 'arrow-forward'}
                  size={20}
                  color={COLORS.background}
                />
              </>
            )}
          </Pressable>
        </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressContainer: {
    flex: 1,
    marginRight: 16,
  },
  progressBar: {
    height: 3,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.accent,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  skipText: {
    fontSize: 14,
    color: COLORS.accentLight,
    fontWeight: '600',
  },
  multiQuestionContainer: {
    gap: 32,
  },
  subQuestionBlock: {
    marginBottom: 24,
  },
  subQuestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  subQuestionIcon: {
    marginRight: 4,
  },
  subQuestionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    flex: 1,
  },
  ovalOptionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  ovalOption: {
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  ovalOptionSelected: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
    borderWidth: 2,
  },
  ovalOptionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  ovalOptionLabelSelected: {
    color: COLORS.background,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  questionBlock: {
    marginBottom: 32,
  },
  questionSection: {
    marginBottom: 16,
  },
  questionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 10,
    lineHeight: 32,
  },
  questionSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 10,
  },
  limitBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: COLORS.accentSoft,
    borderRadius: 10,
  },
  limitText: {
    fontSize: 11,
    color: COLORS.accent,
    fontWeight: '600',
  },
  optionsList: {
    gap: 12,
  },
  optionListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  optionListItemSelected: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accentSoft,
  },
  optionListItemDisabled: {
    opacity: 0.4,
  },
  optionListLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  optionListLabelSelected: {
    color: COLORS.accent,
    fontWeight: '600',
  },
  optionsGrid: {
    gap: 10,
  },
  optionsGrid2Col: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  optionCard2Col: {
    width: '48%',
    backgroundColor: COLORS.background,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 140,
    position: 'relative',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  optionCard2ColSelected: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accentSoft,
    borderWidth: 3,
    shadowColor: COLORS.accent,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  optionEmoji2Col: {
    fontSize: 40,
    marginBottom: 12,
  },
  optionLabel2Col: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    textAlign: 'center',
    lineHeight: 20,
  },
  optionLabel2ColSelected: {
    color: COLORS.accent,
    fontWeight: '700',
  },
  checkBadge2Col: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  optionsGrid3Col: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  optionCard3Col: {
    width: '48%',
    backgroundColor: COLORS.background,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
    position: 'relative',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  optionCard3ColSelected: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accentSoft,
    borderWidth: 3,
    shadowColor: COLORS.accent,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  optionEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  optionEmojiInline: {
    fontSize: 24,
    marginBottom: 8,
  },
  optionLabel3Col: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary,
    textAlign: 'center',
    lineHeight: 16,
  },
  optionLabel3ColSelected: {
    color: COLORS.accent,
    fontWeight: '700',
  },
  checkBadge3Col: {
    position: 'absolute',
    top: 6,
    right: 6,
  },
  optionCard: {
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 1,
  },
  optionCardSelected: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accentSoft,
    shadowColor: COLORS.accent,
    shadowOpacity: 0.15,
  },
  optionCardDisabled: {
    opacity: 0.4,
  },
  optionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionIconSelected: {
    backgroundColor: COLORS.accent,
  },
  optionContent: {
    flex: 1,
    justifyContent: 'center',
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  optionLabelSelected: {
    color: COLORS.accent,
  },
  checkBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 10,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  backButtonCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#000000',
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.accent,
  },
  backButtonTextDisabled: {
    color: COLORS.border,
  },
  continueButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    borderRadius: 40,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.background,
  },
  introContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  introContent: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingHorizontal: 15,
    paddingTop: 100,
  },
  introTitle: {
    fontSize: 34,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'left',
    alignSelf: 'stretch',
    lineHeight: 44,
    letterSpacing: -0.4,
  },
  introTitleAccent: {
    color: COLORS.accent,
    fontWeight: '800',
  },
  introFooter: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  introArrowButton: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  midInfoContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: 100,
    paddingHorizontal: 15,
    paddingBottom: 40,
  },
  midInfoContent: {
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  midInfoTitle: {
    fontSize: 34,
    lineHeight: 45,
    fontWeight: '700',
    paddingRight: 25,
    paddingHorizontal: 1,
    paddingTop: -10,
    color: COLORS.textPrimary,
    marginBottom: 1,
    textAlign: 'left',
  },
  midInfoTitleAccent: {
    color: COLORS.accent,
  },
  midInfoSubtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: COLORS.accent,
    textAlign: 'center',
    opacity: 0.85,
  },
  midInfoArrowButton: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});
