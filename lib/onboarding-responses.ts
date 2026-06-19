import { supabase } from './supabase';

export interface Section1Responses {
  user_id?: string;
  
  // Section 1: Basic Preferences Questions
  interest?: string[];
  looking_for?: string;
  relationship_status?: string;
  hobbies?: string[];
  height?: string;
  introvert_extrovert?: string;
  partner_preference?: string[];
}

/**
 * Saves or updates Section 1 responses in the database
 * @param responses - Section 1 response data to save
 * @returns Success status and response data
 */
export const saveSection1Responses = async (responses: Section1Responses) => {
  try {
    // Get current user ID
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      if (userError?.name !== 'AuthSessionMissingError' && userError?.message !== 'Auth session missing!') { console.error('❌ Could not get current user:', userError); }
      return {
        success: false,
        error: 'User not authenticated',
      };
    }

    const userId = user.id;

    // Check if responses already exist
    const { data: existingResponses, error: checkError } = await supabase
      .from('section1_qns')
      .select('id')
      .eq('user_id', userId)
      .single();

    let result;

    if (existingResponses) {
      // Update existing responses
      result = await supabase
        .from('section1_qns')
        .update({
          interest: responses.interest || [],
          looking_for: responses.looking_for || null,
          relationship_status: responses.relationship_status || null,
          hobbies: responses.hobbies || [],
          height: responses.height || null,
          introvert_extrovert: responses.introvert_extrovert || null,
          partner_preference: responses.partner_preference || [],
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .select()
        .single();
    } else {
      // Insert new responses
      result = await supabase
        .from('section1_qns')
        .insert({
          user_id: userId,
          interest: responses.interest || [],
          looking_for: responses.looking_for || null,
          relationship_status: responses.relationship_status || null,
          hobbies: responses.hobbies || [],
          height: responses.height || null,
          introvert_extrovert: responses.introvert_extrovert || null,
          partner_preference: responses.partner_preference || [],
        })
        .select()
        .single();
    }

    if (result.error) {
      console.error('❌ Error saving section1 responses:', result.error);
      return {
        success: false,
        error: result.error.message,
      };
    }

    // Sync onboarding interest array to user_preferences.gender_preference
    if (responses.interest !== undefined) {
      let genderPref = 'Everyone';
      const interestList = responses.interest || [];
      if (interestList.includes('everyone')) {
        genderPref = 'Everyone';
      } else if (interestList.length === 1) {
        if (interestList[0] === 'women') genderPref = 'Female';
        else if (interestList[0] === 'men') genderPref = 'Male';
        else if (interestList[0] === 'beyond-binary') genderPref = 'Non-binary';
      } else if (interestList.length > 1) {
        genderPref = 'Everyone';
      }

      const { error: prefError } = await supabase.from('user_preferences').upsert({
        user_id: userId,
        gender_preference: genderPref,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
      
      if (prefError) {
        console.error('❌ Error updating user_preferences gender_preference:', prefError);
      }
    }

    console.warn('✅ Section 1 responses saved successfully');
    return {
      success: true,
      data: result.data,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Exception saving section1 responses:', errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * Retrieves Section 1 responses by user ID
 * @param userId - Optional user ID (defaults to current user)
 * @returns Section 1 responses data
 */
export const getSection1Responses = async (userId?: string) => {
  try {
    let targetUserId = userId;

    if (!targetUserId) {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        if (userError?.name !== 'AuthSessionMissingError' && userError?.message !== 'Auth session missing!') { console.error('❌ Could not get current user:', userError); }
        return { success: false, error: 'User not authenticated' };
      }
      targetUserId = user.id;
    }

    const { data, error } = await supabase
      .from('section1_qns')
      .select('*')
      .eq('user_id', targetUserId)
      .maybeSingle();

    if (error) {
      console.error('❌ Error fetching section1 responses:', error);
      return { success: false, error: error.message };
    }

    if (!data) {
      // User hasn't filled out section 1 yet – return success with null data
      return { success: true, data: null };
    }

    return { success: true, data };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Exception fetching section1 responses:', errorMessage);
    return { success: false, error: errorMessage };
  }
};

/**
 * Deletes Section 1 responses for current user
 * @returns Success status
 */
export const deleteSection1Responses = async () => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      if (userError?.name !== 'AuthSessionMissingError' && userError?.message !== 'Auth session missing!') { console.error('❌ Could not get current user:', userError); }
      return {
        success: false,
        error: 'User not authenticated',
      };
    }

    const { error } = await supabase
      .from('section1_qns')
      .delete()
      .eq('user_id', user.id);

    if (error) {
      console.error('❌ Error deleting section1 responses:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    console.warn('✅ Section 1 responses deleted successfully');
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Exception deleting section1 responses:', errorMessage);
    return { success: false, error: errorMessage };
  }
};
