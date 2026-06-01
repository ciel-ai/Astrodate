import { supabase } from './supabase';
import type { Json } from './database.types';

export type DailyPick = {
  picked_user_id: string;
  astro_score: number;
  pick_date: string;
  full_name: string;
  gender: string;
  location: string;
  western_sign: string | null;
  indian_sign: string | null;
  dominant_element: string | null;
};

export type Standout = {
  match_user_id: string;
  full_name: string;
  gender: string;
  location: string;
  astro_score: number;
  western_sign: string | null;
  dominant_element: string | null;
};

export async function getMyDailyPick(): Promise<DailyPick | null> {
  try {
    const { data, error } = await supabase.rpc('get_my_daily_pick');
    if (error || !data) return null;
    return isDailyPick(data) ? data : null;
  } catch {
    return null;
  }
}

export async function getStandouts(userId: string): Promise<Standout[]> {
  try {
    const { data, error } = await supabase.rpc('get_standouts', { input_user_id: userId });
    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}

function isDailyPick(value: Json): value is DailyPick {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const row = value as Record<string, Json | undefined>;
  return typeof row.picked_user_id === 'string'
    && typeof row.full_name === 'string'
    && typeof row.gender === 'string'
    && typeof row.location === 'string';
}
