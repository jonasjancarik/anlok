import { Feather } from '@expo/vector-icons';
import { Icon, Label, NativeTabs, VectorIcon } from 'expo-router/unstable-native-tabs';
import React from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette, TabBarInsetContext } from '../../src/components/common/ui';

// Material bottom navigation height, not counting the system navigation bar.
const ANDROID_TAB_BAR_HEIGHT = 80;

// iOS keeps the system bar background so it renders as Liquid Glass on iOS 26+.
const androidColors =
  Platform.OS === 'ios'
    ? {}
    : { backgroundColor: palette.card, indicatorColor: palette.primarySoft };

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const tabBarInset = Platform.OS === 'android' ? ANDROID_TAB_BAR_HEIGHT + insets.bottom : 0;

  return (
    <TabBarInsetContext.Provider value={tabBarInset}>
      <NativeTabs
        tintColor={palette.primary}
        iconColor={{ default: palette.muted, selected: palette.primary }}
        labelStyle={{
          default: { color: palette.muted, fontWeight: '700' },
          selected: { color: palette.primary, fontWeight: '700' },
        }}
        {...androidColors}
      >
        <NativeTabs.Trigger name="index">
          <Label>Unlock</Label>
          <Icon
            sf={{ default: 'lock.open', selected: 'lock.open.fill' }}
            androidSrc={<VectorIcon family={Feather} name="unlock" />}
          />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="activity">
          <Label>Activity</Label>
          <Icon sf="waveform.path.ecg" androidSrc={<VectorIcon family={Feather} name="activity" />} />
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="settings">
          <Label>Settings</Label>
          <Icon
            sf={{ default: 'gearshape', selected: 'gearshape.fill' }}
            androidSrc={<VectorIcon family={Feather} name="settings" />}
          />
        </NativeTabs.Trigger>
      </NativeTabs>
    </TabBarInsetContext.Provider>
  );
}
