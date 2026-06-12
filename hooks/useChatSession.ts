import { getIcebreakerForMatch } from '@/lib/icebreaker';
import { getMatch } from '@/lib/matches';
import { getOnlineStatus } from '@/lib/online-status';
import { getUserById } from '@/lib/users';
import { useEffect, useState } from 'react';
import { useSynastry } from '@/hooks/useSynastry';
import { type SynastryDetail } from '@/lib/synastry';

const getAvatarSource = (avatarUrl: string | null | undefined) => {
  if (avatarUrl) return { uri: avatarUrl };
  return require('@/assets/images/avatar-placeholder.png');
};

interface UseChatSessionProps {
  chatId: string;
  currentUserId?: string | null;
  isMountedRef: React.RefObject<boolean>;
}

interface UseChatSessionReturn {
  user: { name: string; avatar: any; isOnline: boolean } | null;
  isMatched: boolean | null;
  channelId: string;
  icebreaker: string | null;
  loading: boolean;
  setUser: React.Dispatch<React.SetStateAction<{ name: string; avatar: any; isOnline: boolean } | null>>;
  synastryDetail?: SynastryDetail | null;
  synastryScore?: number | null;
  synastryLoading?: boolean;
}

export function useChatSession({ chatId, currentUserId, isMountedRef }: UseChatSessionProps): UseChatSessionReturn {
  const [user, setUser] = useState<{ name: string; avatar: any; isOnline: boolean } | null>(null);
  const [isMatched, setIsMatched] = useState<boolean | null>(null);
  const [channelId, setChannelId] = useState<string>('');
  const [icebreaker, setIcebreaker] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const { synastryDetail, derivedScore, isLoading: synastryLoading } = useSynastry(currentUserId || null, chatId || null);

  // Verify match and fetch user data and online status from backend
  useEffect(() => {
    const fetchUser = async () => {
      if (!chatId) {
        if (isMountedRef.current) setLoading(false);
        return;
      }

      if (isMountedRef.current) {
        setLoading(true);
        setIsMatched(null); // Reset match status
      }
      try {
        // First, verify that users are matched
        const matchResult = await getMatch(chatId);
        if (!isMountedRef.current) return;

        if (!matchResult.success || !matchResult.data) {
          console.error('❌ Users are not matched');
          setIsMatched(false);
          setUser({
            name: 'Unknown User',
            avatar: require('@/assets/images/avatar-placeholder.png'),
            isOnline: false,
          });
          setLoading(false);
          return;
        }

        setIsMatched(true);
        // Set channel_id from match
        if (matchResult.data.channel_id) {
          setChannelId(matchResult.data.channel_id);
        }

        // Fetch pre-generated icebreaker (no Gemini call — reads from DB only)
        if (matchResult.data.id) {
          getIcebreakerForMatch(matchResult.data.id)
            .then((text) => {
              if (text && isMountedRef.current) setIcebreaker(text);
            })
            .catch(() => { });
        }

        // If matched, fetch user data
        const [userResult, onlineResult] = await Promise.all([
          getUserById(chatId),
          getOnlineStatus(chatId),
        ]);

        if (!isMountedRef.current) return;
        if (userResult.success && userResult.data) {
          setUser({
            name: userResult.data.full_name,
            avatar: getAvatarSource(userResult.data.avatar),
            isOnline: onlineResult.isOnline || false,
          });
        } else {
          setUser({
            name: 'Unknown User',
            avatar: require('@/assets/images/avatar-placeholder.png'),
            isOnline: false,
          });
        }
      } catch (error) {
        console.error('Error fetching user:', error);
        if (isMountedRef.current) {
          setIsMatched(false);
          setUser({
            name: 'Unknown User',
            avatar: require('@/assets/images/avatar-placeholder.png'),
            isOnline: false,
          });
        }
      } finally {
        if (isMountedRef.current) setLoading(false);
      }
    };

    fetchUser();
  }, [chatId, isMountedRef]);

  return {
    user,
    isMatched,
    channelId,
    icebreaker,
    loading,
    setUser,
    synastryDetail,
    synastryScore: derivedScore,
    synastryLoading,
  };
}