import { supabase } from './supabase';
import type { TablesInsert, TablesUpdate } from './database.types';

export interface UserProfile {
  user_id?: string;
  phone_number: string;
  full_name: string;
  email: string;
  gender?: string | null;
  gender_detail?: string | null;
  location?: string;
}

/**
 * Normalizes phone number to E.164 format (+919080923457)
 * Removes spaces, dashes, parentheses, and ensures it starts with +
 * Handles both formats: with + prefix and without
 */
export const normalizePhoneToE164 = (phone: string): string => {
  if (!phone) return '';
  
  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // Remove leading + if present (we'll add it back)
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }
  
  // Ensure it starts with + for E.164 format
  return '+' + cleaned;
};

/**
 * Verifies if a phone number exists in user_profiles table
 * Checks with normalized E.164 format (+919080923457)
 * @param phoneNumber - Phone number in any format
 * @returns User profile if found, null otherwise
 */
export const verifyPhoneNumberExists = async (phoneNumber: string) => {
  try {
    // Normalize the input phone number to E.164 format
    const normalizedPhone = normalizePhoneToE164(phoneNumber);
    console.log('🔍 Verifying phone number:', {
      original: phoneNumber,
      normalized: normalizedPhone,
    });

    // Use RPC function to bypass RLS - this is more reliable
    const { data: rpcData, error: rpcError } = await supabase.rpc('check_phone_exists', {
      input_phone: normalizedPhone,
    });

    console.log('📊 RPC function result:', {
      found: rpcData && rpcData.length > 0,
      data: rpcData,
      error: rpcError?.message,
      errorCode: rpcError?.code,
    });

    // If RPC works and finds a match, return it
    if (rpcData && rpcData.length > 0) {
      const profile = rpcData[0];
      console.log('✅ User found via RPC:', {
        userId: profile.user_id,
        phoneInDb: profile.phone_number,
        name: profile.full_name,
      });
      return {
        success: true,
        data: {
          user_id: profile.user_id,
          phone_number: profile.phone_number,
          full_name: profile.full_name,
        },
        phoneNumberInDb: profile.phone_number,
      };
    }

    // If RPC doesn't exist or fails, fall back to direct query
    if (rpcError && rpcError.code === '42883') {
      console.warn('⚠️ RPC function not found, falling back to direct query');
      
      // Fallback to direct query
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('user_id, phone_number, full_name')
        .eq('phone_number', normalizedPhone);

      if (profileData && profileData.length > 0) {
        return {
          success: true,
          data: profileData[0],
          phoneNumberInDb: profileData[0].phone_number,
        };
      }

      return {
        success: false,
        data: null,
        error: profileError?.message || 'Phone number not found',
      };
    }

    // RPC returned no results
    return {
      success: false,
      data: null,
      error: rpcError?.message || 'Phone number not found',
    };
  } catch (error) {
    console.error('❌ Error verifying phone number:', error);
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * Saves or updates user profile in the database
 * Ensures phone_number is stored in E.164 format (+919080923457)
 * @param profile - User profile data to save
 * @returns Success status and profile data
 */
export const saveUserProfile = async (profile: UserProfile) => {
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

    // Normalize phone number to E.164 format before saving
    const hasPhoneInput = Boolean(profile.phone_number && profile.phone_number.trim().length > 0);
    const normalizedPhone = hasPhoneInput ? normalizePhoneToE164(profile.phone_number) : null;
    console.log('📱 Normalizing phone number for save:', {
      original: profile.phone_number,
      normalized: normalizedPhone,
      hasPhoneInput,
    });

    // Validate required fields (NOT NULL in DB)
    const missing: string[] = [];
    if (!profile.full_name || !profile.full_name.trim()) missing.push('full_name');
    if (!profile.email || !profile.email.trim()) missing.push('email');
    if (missing.length) {
      const msg = `Missing required fields: ${missing.join(', ')}`;
      console.error('❌ Validation error:', msg);
      return { success: false, error: msg };
    }

    // Check if profile already exists
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    let result;

    if (existingProfile) {
      // Update existing profile; only include phone_number when provided
      const updatePayload: TablesUpdate<'user_profiles'> = {
        full_name: profile.full_name,
        email: profile.email,
        gender: profile.gender || null,
        gender_detail: profile.gender_detail || null,
        location: profile.location || null,
        updated_at: new Date().toISOString(),
      };
      if (hasPhoneInput && normalizedPhone) {
        updatePayload.phone_number = normalizedPhone;
      }

      result = await supabase
        .from('user_profiles')
        .update(updatePayload)
        .eq('user_id', userId)
        .select()
        .single();
    } else {
      // Insert new profile; require phone_number only if provided
      const insertPayload: TablesInsert<'user_profiles'> = {
        user_id: userId,
        phone_number: normalizedPhone ?? '',
        full_name: profile.full_name,
        email: profile.email,
        gender: profile.gender || null,
        gender_detail: profile.gender_detail || null,
        location: profile.location || null,
      };
      if (hasPhoneInput && normalizedPhone) {
        insertPayload.phone_number = normalizedPhone;
      } else {
        // Social/OAuth users (Google, Apple) may not have a phone number.
        // Store empty string — the schema requires NOT NULL but allows ''.
        insertPayload.phone_number = '';
      }

      result = await supabase
        .from('user_profiles')
        .insert(insertPayload)
        .select()
        .single();
    }

    if (result.error) {
      console.error('❌ Error saving profile:', result.error);
      return {
        success: false,
        error: result.error.message,
      };
    }

    console.warn('✅ Profile saved successfully', { phone: normalizedPhone });
    return {
      success: true,
      data: result.data,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Exception saving profile:', errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
};

/**
 * Retrieves user profile by user ID
 * @param userId - Optional user ID (defaults to current user)
 * @returns User profile data
 */
export const getUserProfile = async (userId?: string) => {
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
      .from('user_profiles')
      .select('*')
      .eq('user_id', targetUserId)
      .maybeSingle();

    if (error) {
      console.error('❌ Error fetching profile:', error);
      return { success: false, error: error.message };
    }

    // data is null when no profile row exists yet — not an error condition
    return { success: true, data };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Exception fetching profile:', errorMessage);
    return { success: false, error: errorMessage };
  }
};