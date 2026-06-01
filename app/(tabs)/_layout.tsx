import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import React, { useState } from 'react';
import { Platform, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { TAB_BAR_BASE_STYLE } from '@/constants/tab-bar-style';
import { TabBarVisibilityContext } from '@/hooks/use-tab-bar-visibility';

export default function TabLayout() {
  const [isHidden, setHidden] = useState(false);

  return (
    <TabBarVisibilityContext.Provider value={{ isHidden, setHidden }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#A855F7',
          tabBarInactiveTintColor: 'rgba(255,255,255,0.4)',
          tabBarStyle: isHidden ? { display: 'none' } : TAB_BAR_BASE_STYLE,
          tabBarButton: HapticTab,
          tabBarBackground: () =>
            Platform.OS === 'ios' ? (
              <BlurView intensity={70} tint="dark" style={{ flex: 1, borderRadius: 30, overflow: 'hidden' }} />
            ) : (
              <View style={{ flex: 1, backgroundColor: 'rgba(26, 11, 46, 0.95)', borderRadius: 30, overflow: 'hidden' }} />
            ),
        }}>

        {/* 1 — Discover */}
        <Tabs.Screen
          name="index"
          options={{
            title: 'Discover',
            tabBarIcon: ({ color, size }) => <MaterialIcons name="auto-awesome" size={size} color={color} />,
          }}
        />

        {/* 2 — Standouts (replaces old Likes tab) */}
        <Tabs.Screen
          name="likes"
          options={{
            title: 'Standouts',
            tabBarIcon: ({ color, size }) => <MaterialIcons name="stars" size={size} color={color} />,
          }}
        />

        {/* 3 — Chats */}
        <Tabs.Screen
          name="chats"
          options={{
            title: 'Chats',
            tabBarIcon: ({ color, size }) => <MaterialIcons name="chat-bubble" size={size} color={color} />,
          }}
        />

        {/* 4 — Notifications (replaces Insights in tab bar) */}
        <Tabs.Screen
          name="notifications"
          options={{
            title: 'Alerts',
            tabBarIcon: ({ color, size }) => <MaterialIcons name="notifications" size={size} color={color} />,
          }}
        />

        {/* 5 — Profile */}
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => <MaterialIcons name="person" size={size} color={color} />,
          }}
        />

        {/* Hidden screens — accessible via router.push, not shown in tab bar */}
        <Tabs.Screen
          name="insights"
          options={{
            href: null, // hidden from tab bar, still navigable
          }}
        />
      </Tabs>
    </TabBarVisibilityContext.Provider>
  );
}