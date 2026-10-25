import { Feather } from '@expo/vector-icons';
import { Icon, Label, NativeTabs, VectorIcon } from 'expo-router/unstable-native-tabs';
import React from 'react';
import { Platform } from 'react-native';
import { palette } from '../../src/components/common/ui';

// iOS keeps the system bar background so it renders as Liquid Glass on iOS 26+.
const androidColors =
  Platform.OS === 'ios'
    ? {}
    : { backgroundColor: palette.card, indicatorColor: palette.primarySoft };

export default function TabsLayout() {
  return (
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
  );
}
