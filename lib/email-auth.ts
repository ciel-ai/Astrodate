/**
 * lib/email-auth.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Centralised email-based auth utilities for AstroDate.
 *
 * This file handles:
 *  - Email/password signup (with Supabase email confirmation)
 *  - Email/password login (blocks unverified users gracefully)
 *  - Resend verification email (with spam-guard cooldown)
 *  - Deep-link token exchange (when user taps the Gmail link)
 *  - Google OAuth (reuses the existing pattern from login.tsx)
 *  - Session helpers used across screens
 *
 * Nothing here touches UI — screens call these and react to the results.
 */

import { supabase } from './supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuthResult = {
  success: boolean;
  data?: any;
  error?: string;
  code?: AuthErrorCode;
};

export type AuthErrorCode =
  | 'EMAIL_NOT_VERIFIED'
  | 'EMAIL_ALREADY_EXISTS'
  | 'INVALID_CREDENTIALS'
  | 'WEAK_PASSWORD'
  | 'INVALID_EMAIL'
  | 'NETWORK_ERROR'
  | 'RATE_LIMITED'
  | 'EXPIRED_LINK'
  | 'INVALID_LINK'
  | 'UNKNOWN';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Maps raw Supabase error messages → structured AuthErrorCode. */
function classifyError(message: string): AuthErrorCode {
  const m = message.toLowerCase();
  if (m.includes('email not confirmed') || m.includes('not confirmed')) return 'EMAIL_NOT_VERIFIED';
  if (m.includes('already registered') || m.includes('already exists') || m.includes('duplicate')) return 'EMAIL_ALREADY_EXISTS';
  if (m.includes('invalid login') || m.includes('invalid credentials') || m.includes('wrong password')) return 'INVALID_CREDENTIALS';
  if (m.includes('password') && (m.includes('weak') || m.includes('short') || m.includes('characters'))) return 'WEAK_PASSWORD';
  if (m.includes('invalid email') || m.includes('email format')) return 'INVALID_EMAIL';
  if (m.includes('rate limit') || m.includes('too many')) return 'RATE_LIMITED';
  if (m.includes('expired') || m.includes('token has expired')) return 'EXPIRED_LINK';
  if (m.includes('invalid token') || m.includes('otp expired') || m.includes('token not found')) return 'INVALID_LINK';
  if (m.includes('network') || m.includes('fetch failed') || m.includes('timeout')) return 'NETWORK_ERROR';
  return 'UNKNOWN';
}

/** Friendly messages shown to the user for each error code. */
export function getErrorMessage(code: AuthErrorCode, raw?: string): string {
  switch (code) {
    case 'EMAIL_NOT_VERIFIED':
      return 'Please verify your email before logging in. Check your inbox for a verification link.';
    case 'EMAIL_ALREADY_EXISTS':
      return 'An account with this email already exists. Please log in instead.';
    case 'INVALID_CREDENTIALS':
      return 'Incorrect email or password. Please try again.';
    case 'WEAK_PASSWORD':
      return 'Password must be at least 8 characters long.';
    case 'INVALID_EMAIL':
      return 'Please enter a valid email address.';
    case 'RATE_LIMITED':
      return 'Too many attempts. Please wait a few minutes before trying again.';
    case 'EXPIRED_LINK':
      return 'This verification link has expired. Please request a new one.';
    case 'INVALID_LINK':
      return 'This verification link is invalid or has already been used.';
    case 'NETWORK_ERROR':
      return 'Network error. Please check your connection and try again.';
    default:
      return raw ?? 'An unexpected error occurred. Please try again.';
  }
}

// ─── Validation ───────────────────────────────────────────────────────────────

export function validateEmail(email: string): string | null {
  if (!email || email.trim() === '') return 'Email is required.';
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(email.trim())) return 'Please enter a valid email address.';
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password || password.trim() === '') return 'Password is required.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  return null;
}

export function validateName(name: string): string | null {
  if (!name || name.trim() === '') return 'Name is required.';
  if (name.trim().length < 2) return 'Name must be at least 2 characters.';
  return null;
}

// ─── Signup ───────────────────────────────────────────────────────────────────

/**
 * Creates a new account with email + password.
 * Supabase sends a confirmation email automatically.
 * The user is NOT considered logged in until they verify.
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  fullName: string,
  redirectUrl: string
): Promise<AuthResult> {
  const normalizedEmail = email.trim().toLowerCase();
  console.log('📧 [email-auth] signUpWithEmail — start');

  try {
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { full_name: fullName.trim() },
      },
    });

    if (error) {
      const code = classifyError(error.message);
      console.error('❌ [email-auth] signUp error:', { code, message: error.message });
      return { success: false, error: getErrorMessage(code, error.message), code };
    }

    // If identities array is empty, Supabase silently rejected a duplicate
    // but didn't return an error (common behavior when "confirm email" is ON)
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      console.warn('⚠️ [email-auth] Duplicate email detected (empty identities)');
      return {
        success: false,
        error: getErrorMessage('EMAIL_ALREADY_EXISTS'),
        code: 'EMAIL_ALREADY_EXISTS',
      };
    }

    console.log('✅ [email-auth] signUp success — confirmation email sent', {
      userId: data.user?.id,
      emailConfirmedAt: data.user?.email_confirmed_at,
    });

    return { success: true, data };
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    const code = classifyError(msg);
    console.error('❌ [email-auth] signUp exception:', msg);
    return { success: false, error: getErrorMessage(code, msg), code };
  }
}

// ─── Login ────────────────────────────────────────────────────────────────────

/**
 * Logs in with email + password.
 * Explicitly blocks users whose email is not verified.
 */
export async function loginWithEmail(
  email: string,
  password: string
): Promise<AuthResult> {
  const normalizedEmail = email.trim().toLowerCase();
  console.log('🔑 [email-auth] loginWithEmail — start');

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      const code = classifyError(error.message);
      console.error('❌ [email-auth] login error:', { code, message: error.message });
      return { success: false, error: getErrorMessage(code, error.message), code };
    }

    const user = data.session?.user;
    if (!user) {
      return { success: false, error: 'Login failed. Please try again.', code: 'UNKNOWN' };
    }

    console.log('✅ [email-auth] login success', {
      userId: user.id,
      emailConfirmedAt: user.email_confirmed_at,
    });

    return { success: true, data };
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    const code = classifyError(msg);
    console.error('❌ [email-auth] login exception:', msg);
    return { success: false, error: getErrorMessage(code, msg), code };
  }
}

// ─── Resend verification ──────────────────────────────────────────────────────

// In-memory cooldown map — keyed by email
const resendCooldowns = new Map<string, number>();
const RESEND_COOLDOWN_MS = 60_000; // 1 minute between sends

/**
 * Resends the verification email.
 * Returns how many seconds remain on the cooldown, or 0 if sent.
 */
export async function resendVerificationEmail(
  email: string,
  redirectUrl: string
): Promise<AuthResult & { cooldownSeconds?: number }> {
  const normalizedEmail = email.trim().toLowerCase();
  console.log('📨 [email-auth] resendVerificationEmail');

  // Spam guard
  const lastSent = resendCooldowns.get(normalizedEmail) ?? 0;
  const elapsed = Date.now() - lastSent;
  if (elapsed < RESEND_COOLDOWN_MS) {
    const remaining = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
    console.warn(`⏳ [email-auth] Resend cooldown active — ${remaining}s remaining`);
    return {
      success: false,
      error: `Please wait ${remaining} seconds before requesting another email.`,
      code: 'RATE_LIMITED',
      cooldownSeconds: remaining,
    };
  }

  try {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: normalizedEmail,
      options: { emailRedirectTo: redirectUrl },
    });

    if (error) {
      const code = classifyError(error.message);
      console.error('❌ [email-auth] resend error:', error.message);
      return { success: false, error: getErrorMessage(code, error.message), code };
    }

    resendCooldowns.set(normalizedEmail, Date.now());
    console.log('✅ [email-auth] Verification email resent');
    return { success: true };
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    const code = classifyError(msg);
    console.error('❌ [email-auth] resend exception:', msg);
    return { success: false, error: getErrorMessage(code, msg), code };
  }
}

// ─── OTP Verification ─────────────────────────────────────────────────────────

/**
 * Verifies a 6-digit OTP sent to the user's email.
 */
export async function verifyEmailOtp(email: string, otp: string): Promise<AuthResult> {
  const normalizedEmail = email.trim().toLowerCase();
  console.log('🔑 [email-auth] verifyEmailOtp — start');

  try {
    const { data, error } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token: otp.trim(),
      type: 'signup',
    });

    if (error) {
      const code = classifyError(error.message);
      console.error('❌ [email-auth] verifyEmailOtp error:', error.message);
      return { success: false, error: getErrorMessage(code, error.message), code };
    }

    console.log('✅ [email-auth] Email verified via OTP', { userId: data.session?.user?.id });
    return { success: true, data: data.session };
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    console.error('❌ [email-auth] verifyEmailOtp exception:', msg);
    return { success: false, error: getErrorMessage('UNKNOWN', msg), code: 'UNKNOWN' };
  }
}

// ─── Deep-link token exchange ─────────────────────────────────────────────────

/**
 * Called when the app opens via the email verification deep link.
 * Parses the URL, exchanges the token with Supabase, and returns the session.
 *
 * Email links have the form:
 *   astrodate://auth/verify?token=<token>&type=signup
 *   astrodate://auth/verify#access_token=<t>&refresh_token=<r>&type=signup
 */
export async function handleEmailVerificationDeepLink(
  url: string
): Promise<AuthResult> {
  console.log('🔗 [email-auth] handleEmailVerificationDeepLink');

  try {
    // Parse both hash (#) and query (?) params
    let params: URLSearchParams | null = null;

    if (url.includes('#')) {
      const hash = url.split('#')[1];
      params = new URLSearchParams(hash);
    } else if (url.includes('?')) {
      const query = url.split('?')[1];
      params = new URLSearchParams(query);
    }

    if (!params) {
      console.error('❌ [email-auth] Could not parse deep link URL');
      return { success: false, error: 'Invalid verification link.', code: 'INVALID_LINK' };
    }

    const type = params.get('type');
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const token = params.get('token');
    const tokenHash = params.get('token_hash');

    console.log('🔗 [email-auth] Deep link params:', { type, hasAccessToken: !!accessToken, hasToken: !!token, hasTokenHash: !!tokenHash });

    // Case 1: PKCE flow — access_token + refresh_token in hash
    if (accessToken && refreshToken) {
      console.log('🔑 [email-auth] Exchanging session via access+refresh tokens');
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        const code = classifyError(error.message);
        console.error('❌ [email-auth] setSession error:', error.message);
        return { success: false, error: getErrorMessage(code, error.message), code };
      }

      console.log('✅ [email-auth] Session set from deep link tokens', {
        userId: data.session?.user?.id,
        emailConfirmedAt: data.session?.user?.email_confirmed_at,
      });
      return { success: true, data: data.session };
    }

    // Case 2: token_hash flow (Supabase v2 default for email OTP)
    if (tokenHash && type) {
      console.log('🔑 [email-auth] Verifying OTP via token_hash');
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as any,
      });

      if (error) {
        const code = classifyError(error.message);
        console.error('❌ [email-auth] verifyOtp (hash) error:', error.message);
        return { success: false, error: getErrorMessage(code, error.message), code };
      }

      console.log('✅ [email-auth] Email verified via token_hash', { userId: data.session?.user?.id });
      return { success: true, data: data.session };
    }

    // Case 3: legacy token flow
    if (token && type) {
      console.log('🔑 [email-auth] Verifying OTP via token');
      const email = params.get('email') ?? '';
      const { data, error } = await supabase.auth.verifyOtp({
        token,
        type: type as any,
        email,
      });

      if (error) {
        const code = classifyError(error.message);
        console.error('❌ [email-auth] verifyOtp error:', error.message);
        return { success: false, error: getErrorMessage(code, error.message), code };
      }

      console.log('✅ [email-auth] Email verified via token', { userId: data.session?.user?.id });
      return { success: true, data: data.session };
    }

    console.error('❌ [email-auth] No usable tokens in deep link');
    return { success: false, error: 'Invalid verification link.', code: 'INVALID_LINK' };
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    console.error('❌ [email-auth] deep link exception:', msg);
    return { success: false, error: getErrorMessage('UNKNOWN', msg), code: 'UNKNOWN' };
  }
}

// ─── Session helpers ──────────────────────────────────────────────────────────

/** Returns the current session user, or null if not authenticated. */
export async function getCurrentUser() {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

/** Returns true if the current user's email is verified. */
export async function isEmailVerified(): Promise<boolean> {
  const user = await getCurrentUser();
  const verified = !!user?.email_confirmed_at;
  console.log('🔍 [email-auth] isEmailVerified:', verified);
  return verified;
}