export { TabScreenFallback as ErrorBoundary } from '@/components/tab-screen-fallback';
import React from 'react';
import { useProfileData } from '@/hooks/useProfileData';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { ProfileSubscription } from '@/components/profile/ProfileSubscription';
import { ProfileEditModal } from '@/components/profile/ProfileEditModal';
import { AstroIncompleteBanner } from '@/components/AstroIncompleteBanner';
import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { profileStyles } from '@/components/profile/profileStyles';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const data = useProfileData();

  return (
    <LinearGradient
      colors={['#1a0d2e', '#2d1b4e', '#4a2c5a']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[profileStyles.container, { paddingTop: insets.top }]}>

      {/* Stars background is rendered inside ProfileHeader */}

      <ScrollView
        style={profileStyles.scrollView}
        contentContainerStyle={profileStyles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={data.refreshing}
            onRefresh={data.onRefresh}
            tintColor="#A855F7"
            colors={['#A855F7', '#7C3AED']}
            progressBackgroundColor="rgba(255, 255, 255, 0.1)"
          />
        }>

        {data.astroMissing && !data.loading && (
          <AstroIncompleteBanner
            onSuccess={() => {
              data.setAstroMissing(false);
              data.fetchUserData();
            }}
          />
        )}

        <ProfileHeader data={data} />
        <ProfileSubscription data={data} />
      </ScrollView>

      <ProfileEditModal data={data} />
    </LinearGradient>
  );
}