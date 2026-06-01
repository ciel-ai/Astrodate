import { derivedAstroScore, getSynastryDetail, type SynastryDetail } from '@/lib/synastry';
import { useEffect, useState } from 'react';

export interface UseSynastryResult {
  synastryDetail: SynastryDetail | null;
  derivedScore: number | null;
  isLoading: boolean;
  error: string | null;
}

export function useSynastry(
  currentUserId: string | null,
  targetUserId: string | null,
): UseSynastryResult {
  const [synastryDetail, setSynastryDetail] = useState<SynastryDetail | null>(null);
  const [derivedScore, setDerivedScore] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUserId || !targetUserId) return;

    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await getSynastryDetail(currentUserId, targetUserId);
        if (cancelled) return;
        if (result.success && result.data) {
          setSynastryDetail(result.data);
          setDerivedScore(derivedAstroScore(result.data));
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Synastry fetch failed');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUserId, targetUserId]);

  return { synastryDetail, derivedScore, isLoading, error };
}