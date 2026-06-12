/**
 * Gemini AI Chatbot Service for Astrology
 * 
 * This module provides functions to interact with Google Gemini API
 * for astrology-related conversations via Supabase Edge Functions
 */

import { fetchWithTimeout, invokeSupabaseFunctionWithTimeout } from './network';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from './supabase';

/**
 * Lists available Gemini models
 * Note: This function still calls Gemini API directly as it's a read-only operation
 * For production, you may want to create a separate Edge Function for this
 */
export const listAvailableModels = async (): Promise<{
  success: boolean;
  models?: Array<{ name: string; displayName: string; supportedGenerationMethods: string[] }>;
  error?: string;
}> => {
  // Direct Gemini API calls are disabled — EXPO_PUBLIC_ keys are baked
  // into the APK bundle at build time and exposed to anyone who decompiles it.
  // Route through the Supabase Edge Function if model listing is needed.
  return {
    success: false,
    error: 'Model listing is disabled. Use the Edge Function endpoint instead.',
  };
};

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}

export interface ChatResponse {
  success: boolean;
  message?: string;
  error?: string;
}

type SerializedChatMessage = {
  role: ChatMessage['role'];
  content: string;
  timestamp?: string;
};

type GeminiFunctionResponse = ChatResponse;

type FunctionErrorLike = {
  name?: string;
  message?: string;
  context?: { status?: number };
};

/**
 * Sends a message to Gemini API via Supabase Edge Function and gets a response
 */
export const sendMessageToGemini = async (
  userMessage: string,
  conversationHistory: ChatMessage[] = []
): Promise<ChatResponse> => {
  try {
    // Prepare conversation history for the Edge Function
    // Convert Date objects to ISO strings for JSON serialization
    const serializedHistory = conversationHistory.map((msg) => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp?.toISOString(),
    }));

    // Call the Supabase Edge Function
    // Try using supabase.functions.invoke() first, with fallback to direct fetch
    let data: GeminiFunctionResponse | null = null;
    let error: FunctionErrorLike | Error | null = null;

    try {
      // First try using supabase.functions.invoke() (automatically includes auth token)
      const result = await invokeSupabaseFunctionWithTimeout(
        () => supabase.functions.invoke('gemini-chatbot', {
          body: {
            message: userMessage,
            conversationHistory: serializedHistory satisfies SerializedChatMessage[],
          },
        }),
        20000
      );

      data = asGeminiFunctionResponse(result.data);
      error = result.error;
    } catch (invokeError) {
      // If invoke fails, try direct fetch as fallback
      console.warn('supabase.functions.invoke() failed, trying direct fetch:', invokeError);

      try {
        // Get the session token for authentication
        const sessionResult = await supabase.auth.getSession();
        const session = sessionResult?.data?.session;
        const authToken = session?.access_token || SUPABASE_ANON_KEY;

        const response = await fetchWithTimeout(
          `${SUPABASE_URL}/functions/v1/gemini-chatbot`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify({
              message: userMessage,
            conversationHistory: serializedHistory satisfies SerializedChatMessage[],
            }),
          },
          20000
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          error = {
            name: 'FunctionsHttpError',
            message: errorData.error || `HTTP ${response.status}`,
            context: { status: response.status },
          };
        } else {
          data = asGeminiFunctionResponse(await response.json());
        }
      } catch (fetchError) {
        error = fetchError as Error;
      }
    }

    if (error) {
      console.error('Edge function error:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));

      // Try to extract the actual error message from the response
      let errorMessage = 'Failed to call chatbot service';

      // Check if error has context with status
      const status = getFunctionErrorStatus(error);
      if (status === 401) {
        errorMessage = 'Authentication failed. Please make sure the Edge Function is deployed and the apikey is configured correctly.';
      } else if (status === 404) {
        errorMessage = 'Edge Function not found. Please deploy the "gemini-chatbot" function in your Supabase project.';
      } else if (error.message) {
        errorMessage = error.message;
      } else if (error.name === 'FunctionsHttpError') {
        // Try to get error from response body if available
        if (status === 401) {
          errorMessage = 'Unauthorized. The Edge Function requires proper authentication. Make sure it is deployed and configured.';
        } else if (status === 500) {
          errorMessage = 'Server error. Check the Edge Function logs in Supabase dashboard for details.';
        } else {
          errorMessage = `The chatbot service returned an error (status: ${status || 'unknown'}). Please check the Edge Function logs.`;
        }
      }

      return {
        success: false,
        error: errorMessage,
      };
    }

    // The Edge Function returns { success: boolean, message?: string, error?: string }
    if (data?.success && data.message) {
      return {
        success: true,
        message: data.message,
      };
    } else {
      // If data exists but success is false, return the error from the function
      const errorMsg = data?.error || 'No response from chatbot service';
      console.error('Edge function returned error:', errorMsg);
      return {
        success: false,
        error: errorMsg,
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Exception in Gemini chatbot:', errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * Get a welcome message for the chatbot
 */
export const getWelcomeMessage = (): string => {
  return "Hello! I'm your astrology guide for AstroDate. 🌟\n\nI can help you with:\n• Understanding astrological compatibility\n• Relationship insights based on zodiac signs\n• Dating advice from an astrological perspective\n• Your personal astrological profile\n• General astrology questions\n\nWhat would you like to know?";
};

function asGeminiFunctionResponse(value: unknown): GeminiFunctionResponse {
  if (typeof value !== 'object' || value === null) {
    return { success: false, error: 'Invalid chatbot response' };
  }

  const response = value as Partial<Record<keyof GeminiFunctionResponse, unknown>>;
  return {
    success: response.success === true,
    message: typeof response.message === 'string' ? response.message : undefined,
    error: typeof response.error === 'string' ? response.error : undefined,
  };
}

function getFunctionErrorStatus(error: FunctionErrorLike | Error): number | undefined {
  return 'context' in error ? error.context?.status : undefined;
}