import { useState } from 'react';
import { optimizePrompt } from '@/lib/prompts';

export function usePromptOptimizer() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refineAnswer = async (question: string, draftAnswer: string): Promise<string | null> => {
    if (!draftAnswer.trim()) {
      setError('Please write a draft answer first.');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await optimizePrompt(question, draftAnswer);
      if (result.success && result.text) {
        return result.text;
      } else {
        setError(result.error || 'Failed to refine answer.');
        return null;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    refineAnswer,
    loading,
    error,
    setError,
  };
}
