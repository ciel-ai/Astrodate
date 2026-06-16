import { useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { withTiming, runOnJS } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';
import { checkMutualLike, saveUserLike } from '@/lib/user-likes';
import { getSynastryDetail, derivedAstroScore } from '@/lib/synastry';
import { getIcebreakerForMatch } from '@/lib/icebreaker';
import { createReport } from '@/lib/reports';
import { signalLike, signalDislike, signalSuperLike } from '@/lib/signals';
import type { Profile } from '../utils/profileHelpers';

export interface UseFeedActionsProps {
  profiles: Profile[];
  currentProfileIndex: number;
  isFlipped: boolean;
  isTransitioning: boolean;
  setIsTransitioning: (val: boolean) => void;
  updateProfileIndex: () => void;
  SCREEN_WIDTH: number;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  opacity: SharedValue<number>;
  nextCardBlur: SharedValue<number>;
  resetCardPosition: () => void;
  fetchSuperLikesRemaining: () => Promise<void>;
  setShowUpgradeSheet: (val: boolean) => void;
  router: ReturnType<typeof useRouter>;
  setMatchedProfile: (profile: Profile | null) => void;
  setMatchedUserId: (id: string | null) => void;
  setMatchId: (id: string | null) => void;
  setMatchIcebreaker: (text: string | null) => void;
  setMatchAstroScore: (score: number | null) => void;
  setShowMatchModal: (val: boolean) => void;
  setProfiles: React.Dispatch<React.SetStateAction<Profile[]>>;
  setCurrentProfileIndex: React.Dispatch<React.SetStateAction<number>>;
  setReportedUserIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setReportingProfile: (profile: Profile | null) => void;
  setShowReportReasonModal: (val: boolean) => void;
  isSubmittingReport: boolean;
  setIsSubmittingReport: (val: boolean) => void;
  reportingProfile: Profile | null;
  matchedProfile: Profile | null;
  matchedUserId: string | null;
}

export function useFeedActions({
  profiles,
  currentProfileIndex,
  isFlipped,
  isTransitioning,
  setIsTransitioning,
  updateProfileIndex,
  SCREEN_WIDTH,
  translateX,
  translateY,
  opacity,
  nextCardBlur,
  resetCardPosition,
  fetchSuperLikesRemaining,
  setShowUpgradeSheet,
  router,
  setMatchedProfile,
  setMatchedUserId,
  setMatchId,
  setMatchIcebreaker,
  setMatchAstroScore,
  setShowMatchModal,
  setProfiles,
  setCurrentProfileIndex,
  setReportedUserIds,
  setReportingProfile,
  setShowReportReasonModal,
  isSubmittingReport,
  setIsSubmittingReport,
  reportingProfile,
  matchedProfile,
  matchedUserId,
}: UseFeedActionsProps) {

  const setNextCardBlurActive = useCallback(() => {
    nextCardBlur.value = withTiming(30, { duration: 180 });
  }, [nextCardBlur]);

  const checkAndShowMatch = useCallback(async (likedUserId: string, profile: Profile) => {
    try {
      const result = await checkMutualLike(likedUserId);
      if (result.isMatch) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        setMatchedProfile(profile);
        setMatchedUserId(String(likedUserId));
        setMatchId(result.matchData?.id ?? null);

        const { data: sessionData } = await supabase.auth.getSession();
        const currentUserId = sessionData?.session?.user?.id;

        if (currentUserId) {
          getSynastryDetail(currentUserId, likedUserId).then(({ data }) => {
            if (data) setMatchAstroScore(derivedAstroScore(data));
          }).catch(() => { });
        }

        if (result.matchData?.id) {
          setTimeout(async () => {
            const text = await getIcebreakerForMatch(result.matchData.id);
            setMatchIcebreaker(text);
          }, 1500);
        }

        setShowMatchModal(true);
      }
    } catch (error) {
      console.error('Error checking for match:', error);
    }
  }, [
    setMatchedProfile,
    setMatchedUserId,
    setMatchId,
    setMatchAstroScore,
    setMatchIcebreaker,
    setShowMatchModal,
  ]);

  const handleLike = useCallback(async (promptId?: string, comment?: string) => {
    if (isFlipped || isTransitioning || profiles.length === 0 || currentProfileIndex >= profiles.length) return;

    const currentProfile = profiles[currentProfileIndex];
    const likedUserId = currentProfile?.id ? String(currentProfile.id) : undefined;
    if (!likedUserId) return;

    setIsTransitioning(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setNextCardBlurActive();

    try {
      const result = await saveUserLike(likedUserId, 'like', promptId, comment);

      if (result.success) {
        signalLike(likedUserId);
        const toX = SCREEN_WIDTH + 120;
        translateX.value = withTiming(toX, { duration: 220 }, (finished) => {
          if (finished) runOnJS(updateProfileIndex)();
        });
        translateY.value = withTiming(translateY.value + 20, { duration: 220 });
        opacity.value = withTiming(0, { duration: 200 });
        await checkAndShowMatch(likedUserId, currentProfile);
      } else if (result.error === 'LIKE_QUOTA_EXCEEDED') {
        resetCardPosition();
        setIsTransitioning(false);
        setShowUpgradeSheet(true);
      } else if (result.error === 'THE_USER_NO_LONGER_EXISTS') {
        console.warn(`⚠️ User ${likedUserId} no longer exists.`);
        const toX = SCREEN_WIDTH + 120;
        translateX.value = withTiming(toX, { duration: 220 }, (finished) => {
          if (finished) runOnJS(updateProfileIndex)();
        });
        translateY.value = withTiming(translateY.value + 20, { duration: 220 });
        opacity.value = withTiming(0, { duration: 200 });
      } else {
        console.error('Error in handleLike:', result.error);
        resetCardPosition();
        setIsTransitioning(false);
      }
    } catch (error) {
      console.error('Error in handleLike backend:', error);
      resetCardPosition();
      setIsTransitioning(false);
    }
  }, [
    isFlipped,
    isTransitioning,
    profiles,
    currentProfileIndex,
    checkAndShowMatch,
    updateProfileIndex,
    setNextCardBlurActive,
    SCREEN_WIDTH,
    translateX,
    translateY,
    opacity,
    resetCardPosition,
    setIsTransitioning,
    setShowUpgradeSheet,
  ]);

  const handleDislike = useCallback(async () => {
    if (isFlipped || isTransitioning || profiles.length === 0 || currentProfileIndex >= profiles.length) return;

    setIsTransitioning(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setNextCardBlurActive();

    const toX = -(SCREEN_WIDTH + 120);
    translateX.value = withTiming(toX, { duration: 220 }, (finished) => {
      if (finished) {
        runOnJS(updateProfileIndex)();
      }
    });
    translateY.value = withTiming(translateY.value + 20, { duration: 220 });
    opacity.value = withTiming(0, { duration: 200 });

    const currentProfile = profiles[currentProfileIndex];
    const likedUserId = currentProfile?.id ? String(currentProfile.id) : undefined;

    if (likedUserId) {
      try {
        const result = await saveUserLike(likedUserId, 'dislike');
        if (result.success) {
          signalDislike(likedUserId);
        }
        if (!result.success && result.error !== 'THE_USER_NO_LONGER_EXISTS') {
          console.error('Error saving dislike:', result.error);
        }
      } catch (error) {
        console.error('Error saving dislike in backend:', error);
      }
    }
  }, [
    isFlipped,
    isTransitioning,
    profiles,
    currentProfileIndex,
    updateProfileIndex,
    setNextCardBlurActive,
    SCREEN_WIDTH,
    translateX,
    translateY,
    opacity,
    setIsTransitioning,
  ]);

  const handleSuperLike = useCallback(async () => {
    if (isFlipped || isTransitioning || profiles.length === 0 || currentProfileIndex >= profiles.length) return;

    const currentProfile = profiles[currentProfileIndex];
    const likedUserId = currentProfile?.id ? String(currentProfile.id) : undefined;
    if (!likedUserId) return;

    setIsTransitioning(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNextCardBlurActive();

    try {
      const result = await saveUserLike(likedUserId, 'super_like');

      if (result.success) {
        signalSuperLike(likedUserId);
        const toY = -SCREEN_WIDTH;
        translateY.value = withTiming(toY, { duration: 260 }, (finished) => {
          if (finished) runOnJS(updateProfileIndex)();
        });
        opacity.value = withTiming(0, { duration: 200 });
        await checkAndShowMatch(likedUserId, currentProfile);
        void fetchSuperLikesRemaining();
      } else if (result.error === 'SUPER_LIKE_QUOTA_EXCEEDED') {
        resetCardPosition();
        setIsTransitioning(false);
        setShowUpgradeSheet(true);
      } else if (result.error === 'THE_USER_NO_LONGER_EXISTS') {
        console.warn(`⚠️ User ${likedUserId} no longer exists, skipping...`);
        const toY = -SCREEN_WIDTH;
        translateY.value = withTiming(toY, { duration: 260 }, (finished) => {
          if (finished) runOnJS(updateProfileIndex)();
        });
        opacity.value = withTiming(0, { duration: 200 });
      } else {
        console.error('Error saving super like:', result.error);
        resetCardPosition();
        setIsTransitioning(false);
      }
    } catch (error) {
      console.error('Error in handleSuperLike backend:', error);
      resetCardPosition();
      setIsTransitioning(false);
    }
  }, [
    isFlipped,
    isTransitioning,
    profiles,
    currentProfileIndex,
    checkAndShowMatch,
    updateProfileIndex,
    setNextCardBlurActive,
    SCREEN_WIDTH,
    translateY,
    opacity,
    fetchSuperLikesRemaining,
    resetCardPosition,
    setShowUpgradeSheet,
    setIsTransitioning,
  ]);

  const handleSendMessageFromMatchModal = useCallback(async () => {
    const chatUserId = matchedUserId || (matchedProfile?.id ? String(matchedProfile.id) : null);

    setShowMatchModal(false);
    setMatchedProfile(null);
    setMatchedUserId(null);
    setMatchIcebreaker(null);
    setMatchAstroScore(null);
    setMatchId(null);

    if (!chatUserId) return;

    await checkMutualLike(chatUserId);

    router.push({
      pathname: '/chat/[id]/index' as any,
      params: { id: chatUserId },
    });
  }, [matchedProfile, matchedUserId, router, setShowMatchModal, setMatchedProfile, setMatchedUserId, setMatchIcebreaker, setMatchAstroScore, setMatchId]);

  const saveSwipeAction = useCallback(async (direction: 'left' | 'right' | 'up') => {
    if (profiles.length === 0 || currentProfileIndex >= profiles.length) return;

    const currentProfile = profiles[currentProfileIndex];
    const likedUserId = currentProfile?.id ? String(currentProfile.id) : undefined;
    if (!likedUserId) return;

    if (direction === 'up') {
      try {
        const result = await saveUserLike(likedUserId, 'super_like');
        if (result.success) {
          signalSuperLike(likedUserId);
          await checkAndShowMatch(likedUserId, currentProfile);
          void fetchSuperLikesRemaining();
        } else if (result.error === 'SUPER_LIKE_QUOTA_EXCEEDED') {
          setShowUpgradeSheet(true);
        } else if (result.error !== 'THE_USER_NO_LONGER_EXISTS') {
          console.error('Error saving super_like from swipe-up:', result.error);
        }
      } catch (error) {
        console.error('Error in swipe-up super_like:', error);
      }
      return;
    }

    const actionType = direction === 'right' ? 'like' : 'dislike';
    try {
      const result = await saveUserLike(likedUserId, actionType);
      if (result.success) {
        if (actionType === 'like') {
          signalLike(likedUserId);
          await checkAndShowMatch(likedUserId, currentProfile);
        } else {
          signalDislike(likedUserId);
        }
      } else if (result.error === 'LIKE_QUOTA_EXCEEDED') {
        setShowUpgradeSheet(true);
      } else if (result.error !== 'THE_USER_NO_LONGER_EXISTS') {
        console.error(`Error saving ${actionType} from swipe:`, result.error);
      }
    } catch (error) {
      console.error(`Error saving ${actionType} from swipe:`, error);
    }
  }, [profiles, currentProfileIndex, checkAndShowMatch, fetchSuperLikesRemaining, setShowUpgradeSheet]);

  const submitReport = useCallback(
    async (reason: string) => {
      if (!reportingProfile?.id || isSubmittingReport) return;

      const reportedUserId = String(reportingProfile.id);
      setIsSubmittingReport(true);

      try {
        const result = await createReport(
          reportedUserId,
          'Discover profile report',
          reason,
          `Reported from discover card for user ${reportedUserId}`
        );

        if (!result.success) {
          console.error('❌ Failed to save report:', result.error);
          return;
        }

        setProfiles((current) => {
          const filtered = current.filter((p) => String(p.id) !== reportedUserId);
          if (filtered.length === 0) {
            setCurrentProfileIndex(0);
            return filtered;
          }

          const removedBeforeCurrent = current
            .slice(0, currentProfileIndex)
            .some((p) => String(p.id) === reportedUserId);
          const nextIndex = removedBeforeCurrent
            ? Math.max(0, currentProfileIndex - 1)
            : Math.min(currentProfileIndex, filtered.length - 1);
          setCurrentProfileIndex(nextIndex);

          return filtered;
        });

        setShowReportReasonModal(false);
        setReportingProfile(null);
        setReportedUserIds((prev) => {
          const next = new Set(prev);
          next.add(reportedUserId);
          return next;
        });
      } catch (error) {
        console.error('❌ Error while reporting user:', error);
      } finally {
        setIsSubmittingReport(false);
      }
    },
    [
      reportingProfile,
      isSubmittingReport,
      currentProfileIndex,
      setIsSubmittingReport,
      setProfiles,
      setCurrentProfileIndex,
      setShowReportReasonModal,
      setReportingProfile,
      setReportedUserIds,
    ]
  );

  return {
    handleLike,
    handleDislike,
    handleSuperLike,
    handleSendMessageFromMatchModal,
    saveSwipeAction,
    submitReport,
    checkAndShowMatch,
  };
}
