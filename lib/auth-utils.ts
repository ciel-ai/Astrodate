import { supabase } from './supabase';

/**
 * Checks if a phone number already exists by querying the user_profiles table.
 *
 * Previously this called supabase.auth.signInWithOtp(phone) as a "check" —
 * which fired a real SMS OTP to the user, wasted SMS credits, and always
 * returned false regardless of the result (completely broken).
 *
 * The correct approach is to query user_profiles directly. We store the phone
 * number there during onboarding, so a match means the user already has an account.
 *
 * @param phone - Phone number in E.164 format (e.g. +919876543210)
 * @returns true if an account exists for this number, false if it is new
 */
export const checkPhoneNumberExists = async (phone: string): Promise<boolean> => {
  try {
    console.log('🔍 Checking if phone number exists');

    const { data, error } = await supabase
      .from('user_profiles')
      .select('user_id')
      .eq('phone_number', phone)
      .maybeSingle();

    if (error) {
      console.error('❌ Error checking phone in user_profiles:', error);
      // Fail safe — assume new user so signup can proceed normally
      return false;
    }

    const exists = !!data;
    console.log(exists ? '✅ Phone found — existing user' : '✅ Phone not found — new user');
    return exists;
  } catch (error) {
    console.error('❌ Exception checking phone:', error);
    return false;
  }
};

/**
 * Generates OTP for signup (only for new users).
 *
 * @param phone - Phone number in E.164 format
 * @returns Object with success status and user data
 */
export const generateSignupOTP = async (phone: string) => {
  try {
    console.log('📱 Generating signup OTP');

    const { data, error } = await supabase.auth.signInWithOtp({
      phone,
    });

    if (error) {
      console.error('❌ OTP generation error:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    if (!data || !data.user) {
      console.error('❌ No data returned from OTP generation');
      return {
        success: false,
        error: 'No response from server',
      };
    }

    console.log('OTP generation response received');

    return {
      success: true,
      data,
      isExistingUser: true,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Exception generating OTP:', errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
};
