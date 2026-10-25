import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette } from '../../src/components/common/ui';

// Native tabs float at the top of the page on web and crowd the screen
// headers, so the web build keeps a regular bottom tab bar.
const tabIcon =
  (name: React.ComponentProps<typeof Feather>['name']) =>
  ({ color, size }: { color: string; size: number }) => <Feather name={name} color={color} size={size} />;

export default function TabsLayout() {
  // Leaves room for the home indicator when the web app runs from the home screen.
  const bottomPadding = Math.max(10, useSafeAreaInsets().bottom);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.muted,
        tabBarLabelPosition: 'below-icon',
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: palette.border,
          backgroundColor: palette.card,
          height: 62 + bottomPadding,
          paddingBottom: bottomPadding,
          paddingTop: 6,
        },
        tabBarItemStyle: {
          paddingHorizontal: 4,
        },
        tabBarLabelStyle: {
          fontWeight: '700',
          fontSize: 12,
          lineHeight: 16,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Unlock', tabBarIcon: tabIcon('unlock') }} />
      <Tabs.Screen name="activity" options={{ title: 'Activity', tabBarIcon: tabIcon('activity') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: tabIcon('settings') }} />
    </Tabs>
  );
}
