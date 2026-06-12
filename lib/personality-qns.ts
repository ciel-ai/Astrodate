import { invokeSupabaseFunctionWithTimeout } from './network';
import { supabase } from './supabase';

interface PersonalityQnsResponses {
  what_type_of_date_excites_you_the_most?: string[];
  how_do_you_feel_about_trying_unusual_foods_or_activities?: string;
  what_kind_of_conversations_do_you_enjoy_with_a_partner?: string;
  what_best_describes_your_planning_style?: string;
  how_do_you_handle_commitments_in_a_relationship?: string;
  your_room_or_workspace_usually_looks_like?: string;
  your_ideal_way_to_spend_time_with_a_partner?: string;
  your_energy_level_on_dates_is_usually?: string;
  you_prefer_a_partner_who_is?: string;
  during_arguments_you_usually?: string;
  how_do_you_show_care_in_a_relationship?: string;
  what_kind_of_partner_are_you?: string;
  when_your_partner_replies_late_you_feel?: string;
  how_do_you_handle_emotional_ups_and_downs?: string;
  how_often_do_you_overthink_relationships?: string;
}

/**
 * Save personality questionnaire responses to the database
 */
export async function savePersonalityQnsResponses(
  responses: PersonalityQnsResponses
): Promise<void> {
  try {
    const { data } = await supabase.auth.getUser();
    if (!data?.user) {
      console.error('No authenticated user found');
      throw new Error('User not authenticated');
    }

    const userId = data.user.id;

    const { error } = await supabase
      .from('personality_qns')
      .upsert(
        {
          user_id: userId,
          ...responses,
        },
        { onConflict: 'user_id' }
      )
      .select();

    if (error) {
      console.error('Error saving personality responses:', error);
      throw error;
    }

    console.log('✓ Personality questionnaire responses saved successfully');

    // Call personality compute Edge Function to calculate and store personality vector
    // This is critical for matching algorithm but non-blocking for better UX
    try {
      console.log('Invoking personality_compute function for user:', userId);

      const { data: fnData, error: fnError } = await invokeSupabaseFunctionWithTimeout(
        () => supabase.functions.invoke('personality_compute', {
          body: { user_id: userId },
        }),
        20000
      );

      if (fnError) {
        console.error('personality_compute function returned error:', fnError);
        console.error('Error details:', JSON.stringify(fnError, null, 2));
        // Log but don't throw - allow user to continue onboarding
      } else {
        console.log('✓ personality_compute function success:', fnData);
        if (fnData?.personality_vector) {
          console.log('Computed personality vector (OCEAN):', fnData.personality_vector);
        }
      }
    } catch (err) {
      console.error('Exception invoking personality_compute function:', err);
      console.error('Error message:', err instanceof Error ? err.message : String(err));
      // Non-blocking: continue without throwing to allow user progress
    }
  } catch (error) {
    console.error('Failed to save personality questionnaire responses:', error);
    throw error;
  }
}

/**
 * Retrieve personality questionnaire responses for a user
 * @param userId - Optional user ID (defaults to current user)
 */
export async function getPersonalityQnsResponses(userId?: string): Promise<PersonalityQnsResponses | null> {
  try {
    let targetUserId = userId;

    if (!targetUserId) {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        console.error('No authenticated user found');
        return null;
      }
      targetUserId = userData.user.id;
    }

    const { data, error } = await supabase
      .from('personality_qns')
      .select('*')
      .eq('user_id', targetUserId)
      .maybeSingle();

    if (error) {
      console.error('Error retrieving personality responses:', error);
      throw error;
    }

    return data as PersonalityQnsResponses;
  } catch (error) {
    console.error('Failed to retrieve personality questionnaire responses:', error);
    throw error;
  }
}

/**
 * Delete personality questionnaire responses for the current user
 */
export async function deletePersonalityQnsResponses(): Promise<void> {
  try {
    const { data } = await supabase.auth.getUser();
    if (!data?.user) {
      console.error('No authenticated user found');
      throw new Error('User not authenticated');
    }

    const { error } = await supabase
      .from('personality_qns')
      .delete()
      .eq('user_id', data.user.id);

    if (error) {
      console.error('Error deleting personality responses:', error);
      throw error;
    }

    console.warn('✓ Personality questionnaire responses deleted successfully');
  } catch (error) {
    console.error('Failed to delete personality questionnaire responses:', error);
    throw error;
  }
}
