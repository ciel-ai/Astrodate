// lib/supabase.ts — single source of truth for the Supabase client.
// Credentials are read from environment variables so they are never
// hardcoded in source files or baked into the APK bundle.
//
// Add these to your .env file (and to EAS Secrets for CI/CD builds):
//   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
//   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from './database.types';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing Supabase credentials. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file.'
  );
}

export { SUPABASE_ANON_KEY, SUPABASE_URL };

export const supabase: SupabaseClient<Database> = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
