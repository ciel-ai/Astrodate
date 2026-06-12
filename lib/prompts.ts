import { supabase } from './supabase';
import { sendMessageToGemini } from './gemini-chatbot';

export interface UserPrompt {
  id: string;
  user_id: string;
  prompt_id: string;
  question: string;
  answer: string;
  is_custom: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * Fetch prompts for a specific user ID
 */
export async function getUserPrompts(userId: string): Promise<{ success: boolean; data?: UserPrompt[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('user_prompts' as any)
      .select('*')
      .eq('user_id', userId)
      .order('prompt_id', { ascending: true });

    if (error) {
      console.error('Error fetching user prompts:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data as unknown as UserPrompt[] };
  } catch (error) {
    console.error('Unexpected error fetching user prompts:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Save user prompts (upsert based on user_id & prompt_id)
 */
export async function saveUserPrompts(
  prompts: Array<{ prompt_id: string; question: string; answer: string; is_custom: boolean }>
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;

    if (!userId) {
      return { success: false, error: 'User not authenticated' };
    }

    const upsertPayload = prompts.map((p) => ({
      user_id: userId,
      prompt_id: p.prompt_id,
      question: p.question,
      answer: p.answer,
      is_custom: p.is_custom,
      updated_at: new Date().toISOString(),
    }));

    // If payload is empty, do nothing
    if (upsertPayload.length === 0) {
      return { success: true };
    }

    const { error } = await supabase
      .from('user_prompts' as any)
      .upsert(upsertPayload as any, {
        onConflict: 'user_id,prompt_id',
      });

    if (error) {
      console.error('Error saving user prompts:', error);
      return { success: false, error: error.message };
    }

    // Trigger profile update to invalidate synastry cache (force stale check)
    // This replicates the behavior where a profile edit updates compatibility.
    await supabase
      .from('user_profiles')
      .update({ updated_at: new Date().toISOString() })
      .eq('user_id', userId);

    return { success: true };
  } catch (error) {
    console.error('Unexpected error saving user prompts:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Call the AI prompt optimizer (Google Gemini via edge function) to refine a draft answer
 */
export async function optimizePrompt(
  question: string,
  draftAnswer: string
): Promise<{ success: boolean; text?: string; error?: string }> {
  if (!draftAnswer || draftAnswer.trim().length === 0) {
    return { success: false, error: 'Draft answer is empty' };
  }

  const systemInstruction = `Optimize the following draft answer to a dating profile prompt to make it extremely engaging, witty, or charming, but keep it brief (under 250 characters).
Question: "${question}"
Draft answer: "${draftAnswer}"

Only return the polished, finalized answer, with no additional commentary, prefix, suffix, or quotation marks.`;

  try {
    const result = await sendMessageToGemini(systemInstruction);
    if (result.success && result.message) {
      let optimizedText = result.message.trim();
      // Remove surrounding quotes if model added them
      if (optimizedText.startsWith('"') && optimizedText.endsWith('"')) {
        optimizedText = optimizedText.substring(1, optimizedText.length - 1);
      }
      return { success: true, text: optimizedText };
    } else {
      return { success: false, error: result.error || 'Failed to refine prompt answer' };
    }
  } catch (error) {
    console.error('Unexpected error in optimizePrompt:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
