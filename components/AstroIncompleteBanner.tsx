import { saveAstroDetails } from '@/lib/astro-details';
import { getAstroDetails as getAstroDetailsLib } from '@/lib/astro';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface Props {
  /** Called after a successful re-computation so the parent can refresh its state */
  onSuccess: () => void;
}

/**
 * AstroIncompleteBanner
 *
 * Shown in the profile tab when the user's astro_details row exists but
 * western_sign / chart data is null — meaning the API call failed during
 * onboarding.  The banner lets them re-trigger the computation without
 * going through the full onboarding flow again.
 *
 * Flow:
 *   1. Fetch birth params from existing astro_details row.
 *   2. Call the astro-details Edge Function with those params.
 *   3. Save the result back via saveAstroDetails().
 *   4. Call onSuccess() so the parent re-fetches and hides the banner.
 */
export function AstroIncompleteBanner({ onSuccess }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const retrigger = async () => {
    setStatus('loading');
    setErrorMsg('');

    try {
      // 1. Get existing birth details stored during onboarding
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('Not authenticated');

      const { data: existing, error: fetchErr } = await supabase
        .from('astro_details')
        .select('birth_date, birth_time, birth_location, birth_latitude, birth_longitude')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchErr) throw new Error(fetchErr.message);
      if (!existing?.birth_date || !existing?.birth_time) {
        // No birth data saved at all — send them to re-enter it
        router.push('/onboarding/birth-details');
        setStatus('idle');
        return;
      }

      // 2. Parse stored birth values back into Edge Function params
      const [year, month, day] = existing.birth_date.split('-').map(Number);
      const [hour, min] = existing.birth_time.split(':').map(Number);
      const lat = existing.birth_latitude ?? 0;
      const lon = existing.birth_longitude ?? 0;
      const tzone = Math.round((lon / 15) * 10) / 10;

      // 3. Call the astro computation (same helper used in birth-details.tsx)
      const astroDetails = await getAstroDetailsLib({
        day, month, year, hour, min,
        lat, lon, tzone,
        language: 'en',
        mode: 'basic',
      });

      if (!astroDetails) throw new Error('api_failed');

      // 4. Persist the chart data
      await saveAstroDetails({
        birth_date: existing.birth_date,
        birth_time: existing.birth_time,
        birth_location: existing.birth_location ?? '',
        birth_latitude: lat,
        birth_longitude: lon,
        western_sign: astroDetails.western_sign ?? undefined,
        indian_sign: astroDetails.indian_sign ?? undefined,
        nakshatra_name: astroDetails.nakshatra_name ?? undefined,
        venus_sign: astroDetails.venus_sign ?? undefined,
        mars_sign: astroDetails.mars_sign ?? undefined,
        mercury_sign: astroDetails.mercury_sign ?? undefined,
        rising_sign: astroDetails.rising_sign ?? undefined,
        dominant_element: astroDetails.dominant_element ?? undefined,
        chart_json: astroDetails.chart_json ?? undefined,
      });

      setStatus('idle');
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'api_failed') {
        setErrorMsg('Astrology API unavailable. Please try again in a moment.');
      } else {
        setErrorMsg('Something went wrong. Please try again.');
      }
      setStatus('error');
    }
  };

  return (
    <View style={styles.banner}>
      <View style={styles.iconRow}>
        <Ionicons name="warning-outline" size={20} color="#F4D35E" />
        <Text style={styles.title}>Your cosmic profile is incomplete</Text>
      </View>

      <Text style={styles.body}>
        Your astrological profile is incomplete. Compatibility scores on the
        feed are showing as 0% until this is fixed.
      </Text>

      {status === 'error' && (
        <Text style={styles.errorText}>{errorMsg}</Text>
      )}

      <TouchableOpacity
        style={[styles.button, status === 'loading' && styles.buttonDisabled]}
        onPress={retrigger}
        disabled={status === 'loading'}
        activeOpacity={0.8}
      >
        {status === 'loading' ? (
          <ActivityIndicator size="small" color="#1E103A" />
        ) : (
          <Ionicons name="sparkles" size={16} color="#1E103A" />
        )}
        <Text style={styles.buttonText}>
          {status === 'loading' ? 'Computing your chart…' : 'Complete my astro profile'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 16,
    padding: 16,
    backgroundColor: 'rgba(244, 211, 94, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(244, 211, 94, 0.35)',
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  title: {
    color: '#F4D35E',
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  body: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  errorText: {
    color: '#F87171',
    fontSize: 12,
    marginBottom: 10,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F4D35E',
    borderRadius: 12,
    paddingVertical: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#1E103A',
    fontSize: 14,
    fontWeight: '700',
  },
});
