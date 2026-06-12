import { supabase } from '@/lib/supabase';
import { invokeSupabaseFunctionWithTimeout } from './network';

export async function searchBirthPlace(place: string): Promise<{ place_name: string, latitude: number, longitude: number, timezone_id: string }[] | null> {
  try {
    const { data, error } = await invokeSupabaseFunctionWithTimeout(
      () => supabase.functions.invoke('astro-geo', { body: { type: 'search', place } }),
      15000
    );
    if (error) return null;
    return data?.results || null;
  } catch (err) {
    return null;
  }
}

export async function getTimezoneOffset(latitude: number, longitude: number, date: Date): Promise<number | null> {
  try {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    const formattedDate = `${dd}-${mm}-${yyyy}`;

    const { data, error } = await invokeSupabaseFunctionWithTimeout(
      () => supabase.functions.invoke('astro-geo', { body: { type: 'timezone', latitude, longitude, date: formattedDate } }),
      15000
    );
    if (error) return null;
    return data?.tzone ?? null;
  } catch (err) {
    return null;
  }
}
