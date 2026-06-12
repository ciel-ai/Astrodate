import { useLocalSearchParams } from 'expo-router';

export function useChatRouteParams() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return {
    chatId: id || '',
  };
}
