import { useLocalSearchParams } from 'expo-router';

export type ProfileDetailsRouteParams = {
  userId?: string;
  profileId?: string;
  initialData?: string;
  source?: string;
};

export function useProfileRouteParams() {
  return useLocalSearchParams<ProfileDetailsRouteParams>();
}
