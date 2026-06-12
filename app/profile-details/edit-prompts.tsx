import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { getUserPrompts, saveUserPrompts } from '@/lib/prompts';
import { usePromptOptimizer } from '@/components/feed/hooks/usePromptOptimizer';

// Library of preset prompt questions
const promptLibrary = [
  "My perfect first date involves...",
  "My favorite late-night talks are...",
  "When trying unusual foods or crazy ideas...",
  "Our ideal quality time together would be...",
  "In a relationship, I show care by...",
  "A secret talent I have is...",
  "Together we could...",
  "Dating me is like...",
  "My zodiac green flag...",
  "You should message me if...",
];

interface PromptState {
  prompt_id: string;
  question: string;
  answer: string;
  is_custom: boolean;
}

export default function EditPromptsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { refineAnswer, loading: aiLoading, error: aiError, setError: setAiError } = usePromptOptimizer();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // States for three prompts
  const [prompts, setPrompts] = useState<PromptState[]>([
    { prompt_id: 'prompt_1', question: '', answer: '', is_custom: false },
    { prompt_id: 'prompt_2', question: '', answer: '', is_custom: false },
    { prompt_id: 'prompt_3', question: '', answer: '', is_custom: false },
  ]);

  // States for dropdown selectors
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  // Fetch prompts on mount
  useEffect(() => {
    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData?.session?.user?.id;
        if (!userId) {
          Alert.alert('Error', 'Please sign in first.');
          router.back();
          return;
        }

        const result = await getUserPrompts(userId);
        if (result.success && result.data && result.data.length > 0) {
          const loadedPrompts = [...prompts];
          result.data.forEach((p) => {
            const index = loadedPrompts.findIndex((slot) => slot.prompt_id === p.prompt_id);
            if (index !== -1) {
              loadedPrompts[index] = {
                prompt_id: p.prompt_id,
                question: p.question,
                answer: p.answer,
                is_custom: p.is_custom,
              };
            }
          });
          setPrompts(loadedPrompts);
        }
      } catch (err) {
        console.error('Error fetching prompts:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSelectQuestion = (slotIndex: number, question: string) => {
    const isCustom = question === 'custom';
    const updated = [...prompts];
    updated[slotIndex] = {
      ...updated[slotIndex],
      question: isCustom ? '' : question,
      is_custom: isCustom,
    };
    setPrompts(updated);
    setShowPicker(false);
    setActiveSlotIndex(null);
  };

  const handleUpdateAnswer = (slotIndex: number, text: string) => {
    const updated = [...prompts];
    updated[slotIndex] = {
      ...updated[slotIndex],
      answer: text,
    };
    setPrompts(updated);
  };

  const handleUpdateCustomQuestion = (slotIndex: number, text: string) => {
    const updated = [...prompts];
    updated[slotIndex] = {
      ...updated[slotIndex],
      question: text,
    };
    setPrompts(updated);
  };

  // AI Refine caller
  const handleAIRefine = async (slotIndex: number) => {
    const prompt = prompts[slotIndex];
    if (!prompt.question.trim()) {
      Alert.alert('Prompt Question Missing', 'Please select or type a prompt question first.');
      return;
    }
    if (!prompt.answer.trim()) {
      Alert.alert('Draft Answer Missing', 'Please type a quick draft answer so the AI can refine it.');
      return;
    }

    const optimized = await refineAnswer(prompt.question, prompt.answer);
    if (optimized) {
      const updated = [...prompts];
      updated[slotIndex] = {
        ...updated[slotIndex],
        answer: optimized.substring(0, 300), // Enforce limit
      };
      setPrompts(updated);
      Alert.alert('AI Success', 'Your prompt answer has been beautifully optimized! ✨');
    } else {
      Alert.alert('AI Optimization Failed', aiError || 'Could not optimize draft at this time.');
    }
  };

  const handleSave = async () => {
    // Basic validations
    const activePrompts = prompts.filter((p) => p.question.trim().length > 0 && p.answer.trim().length > 0);
    if (activePrompts.length === 0) {
      Alert.alert('No Prompts', 'Please configure at least one prompt with a question and answer before saving.');
      return;
    }

    setSaving(true);
    try {
      const result = await saveUserPrompts(activePrompts);
      if (result.success) {
        Alert.alert('Success', 'Prompts saved successfully!');
        router.back();
      } else {
        Alert.alert('Error', result.error || 'Failed to save prompts');
      }
    } catch (error) {
      console.error('Error saving prompts:', error);
      Alert.alert('Error', 'An unexpected error occurred.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#C084FC" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Starry background */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <LinearGradient
          colors={['#0F061E', '#1A0C2F', '#080310']}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* Header bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Prompts</Text>
        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color="#C084FC" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitleText}>
          Select questions that tell your story. Write your answers, or use our secure ✨ AI Optimizer to polish them.
        </Text>

        {prompts.map((prompt, idx) => (
          <View key={prompt.prompt_id} style={styles.promptSlotCard}>
            <View style={styles.promptSlotHeader}>
              <Text style={styles.promptSlotTitle}>Prompt Slot {idx + 1}</Text>
              {prompt.question.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    const updated = [...prompts];
                    updated[idx] = { prompt_id: prompt.prompt_id, question: '', answer: '', is_custom: false };
                    setPrompts(updated);
                  }}
                >
                  <Text style={styles.clearBtnText}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Question Selector Trigger */}
            <TouchableOpacity
              style={styles.pickerSelector}
              onPress={() => {
                setActiveSlotIndex(idx);
                setShowPicker(true);
              }}
            >
              <Text style={[styles.pickerSelectorText, !prompt.question && { color: 'rgba(255, 255, 255, 0.4)' }]}>
                {prompt.is_custom
                  ? 'Custom Question Selected'
                  : prompt.question || 'Select a question...'}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#C084FC" />
            </TouchableOpacity>

            {/* Custom Question Text Input */}
            {prompt.is_custom && (
              <View style={styles.customQuestionBox}>
                <TextInput
                  style={styles.customQuestionInput}
                  placeholder="Type your custom question..."
                  placeholderTextColor="rgba(255, 255, 255, 0.4)"
                  value={prompt.question}
                  onChangeText={(text) => handleUpdateCustomQuestion(idx, text)}
                  maxLength={100}
                />
                <Text style={styles.charCounter}>
                  {prompt.question.length} / 100
                </Text>
              </View>
            )}

            {/* Answer Text Input */}
            {(prompt.question.length > 0 || prompt.is_custom) && (
              <View style={styles.answerBox}>
                <TextInput
                  style={styles.answerInput}
                  placeholder="Type your answer here..."
                  placeholderTextColor="rgba(255, 255, 255, 0.3)"
                  value={prompt.answer}
                  onChangeText={(text) => handleUpdateAnswer(idx, text)}
                  maxLength={300}
                  multiline={true}
                />
                <View style={styles.answerFooter}>
                  {/* AI Optimize Button */}
                  <TouchableOpacity
                    style={[
                      styles.aiOptimizeButton,
                      aiLoading && { opacity: 0.6 }
                    ]}
                    onPress={() => handleAIRefine(idx)}
                    disabled={aiLoading}
                  >
                    {aiLoading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.aiButtonText}>✨ Refine with AI</Text>
                    )}
                  </TouchableOpacity>

                  <Text style={styles.charCounter}>
                    {prompt.answer.length} / 300
                  </Text>
                </View>
              </View>
            )}
          </View>
        ))}

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* Dropdown Library Picker Modal */}
      <Modal
        visible={showPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose a Prompt Question</Text>
              <TouchableOpacity onPress={() => setShowPicker(false)}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.pickerScrollContent as any} showsVerticalScrollIndicator={false}>
              {/* Custom question option */}
              <TouchableOpacity
                style={[styles.pickerItem as any, { borderColor: 'rgba(236, 72, 153, 0.3)', borderWidth: 1 }]}
                onPress={() => activeSlotIndex !== null && handleSelectQuestion(activeSlotIndex, 'custom')}
              >
                <Text style={[styles.pickerItemText as any, { color: '#EC4899' }]}>✍️ Write my own question...</Text>
              </TouchableOpacity>

              {promptLibrary.map((q) => (
                <TouchableOpacity
                  key={q}
                  style={styles.pickerItem as any}
                  onPress={() => activeSlotIndex !== null && handleSelectQuestion(activeSlotIndex, q)}
                >
                  <Text style={styles.pickerItemText as any}>{q}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F061E',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0F061E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBar: {
    flexDirection: 'row',
    height: 56,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(192, 132, 252, 0.15)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#C084FC',
  },
  saveButtonText: {
    color: '#C084FC',
    fontSize: 14,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
  },
  subtitleText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 24,
  },
  promptSlotCard: {
    backgroundColor: 'rgba(26, 11, 46, 0.55)',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(168, 85, 247, 0.2)',
    padding: 16,
    marginBottom: 20,
    gap: 12,
  },
  promptSlotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  promptSlotTitle: {
    color: '#C084FC',
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  clearBtnText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 12,
    fontWeight: '600',
  },
  pickerSelector: {
    flexDirection: 'row',
    height: 52,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  pickerSelectorText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  customQuestionBox: {
    gap: 6,
  },
  customQuestionInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.3)',
    height: 48,
    paddingHorizontal: 12,
    color: '#FFFFFF',
    fontSize: 14,
  },
  answerBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.15)',
    padding: 12,
    gap: 12,
  },
  answerInput: {
    color: '#FFFFFF',
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
    padding: 4,
  },
  answerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  aiOptimizeButton: {
    backgroundColor: 'rgba(236, 72, 153, 0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(236, 72, 153, 0.55)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 6,
    shadowColor: '#EC4899',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  aiButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  charCounter: {
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: 12,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    height: '65%',
    backgroundColor: '#1C0F38',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(168, 85, 247, 0.25)',
    padding: 20,
    gap: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    paddingBottom: 12,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  pickerScrollContent: {
    gap: 10,
    paddingBottom: 40,
  },
  pickerItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  pickerItemText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
