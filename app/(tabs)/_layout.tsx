import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import React, { useState } from 'react';
import { Platform, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { TAB_BAR_BASE_STYLE } from '@/constants/tab-bar-style';
import { TabBarVisibilityContext } from '@/hooks/use-tab-bar-visibility';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const [isHidden, setHidden] = useState(false);
  const insets = useSafeAreaInsets();

  return (
    <TabBarVisibilityContext.Provider value={{ isHidden, setHidden }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#A855F7',
          tabBarInactiveTintColor: 'rgba(255,255,255,0.4)',
          tabBarStyle: isHidden ? { display: 'none' } : { ...TAB_BAR_BASE_STYLE, paddingBottom: insets.bottom, height: 60 + insets.bottom },
          tabBarButton: HapticTab,
          tabBarBackground: () =>
            Platform.OS === 'ios' ? (
              <BlurView intensity={70} tint="dark" style={{ flex: 1 }} />
            ) : (
              <View style={{ flex: 1, backgroundColor: 'rgba(26, 11, 46, 0.95)' }} />
            ),
          tabBarShowLabel: false,
          tabBarIconStyle: {
            marginBottom: 0,
          },
        }}>

        {/* 1 — Discover (swipe feed) */}
        <Tabs.Screen
          name="index"
          options={{
            title: 'Discover',
            tabBarAccessibilityLabel: 'Discover feed',
            tabBarIcon: ({ color }) => <MaterialIcons name="auto-awesome" size={28} color={color} />,
          }}
        />

        {/* 2 — Cosmic (Standouts equivalent) */}
        <Tabs.Screen
          name="cosmic"
          options={{
            title: 'Cosmic',
            tabBarAccessibilityLabel: 'Cosmic standouts',
            tabBarIcon: ({ color }) => <MaterialIcons name="nights-stay" size={28} color={color} />,
          }}
        />

        {/* 3 — Likes */}
        <Tabs.Screen
          name="likes"
          options={{
            title: 'Likes',
            tabBarAccessibilityLabel: 'Who likes you',
            tabBarIcon: ({ color }) => <MaterialIcons name="favorite" size={28} color={color} />,
          }}
        />

        {/* 4 — Chats (Messages) */}
        <Tabs.Screen
          name="chats"
          options={{
            title: 'Chats',
            tabBarAccessibilityLabel: 'Messages and chats',
            tabBarIcon: ({ color }) => <MaterialIcons name="chat-bubble" size={28} color={color} />,
          }}
        />

        {/* 5 — Profile */}
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarAccessibilityLabel: 'Your profile settings',
            tabBarIcon: ({ color }) => <MaterialIcons name="person" size={28} color={color} />,
          }}
        />

        {/* Hidden — accessible via router.push, not shown in tab bar */}
        <Tabs.Screen name="insights" options={{ href: null }} />
        <Tabs.Screen name="notifications" options={{ href: null }} />
      </Tabs>
    </TabBarVisibilityContext.Provider>
  );
}
