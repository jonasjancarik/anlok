import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';
import { palette } from '../components/common/ui';

export const WebConfigMissingScreen = () => (
  <View
    style={{
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.canvas,
      gap: 10,
      padding: 24,
    }}
  >
    <Feather name="server" size={36} color={palette.danger} />
    <Text style={{ color: palette.text, fontWeight: '800', fontSize: 20, textAlign: 'center' }}>
      This app isn&apos;t connected to a door server yet
    </Text>
    <Text style={{ color: palette.muted, fontSize: 15, textAlign: 'center', lineHeight: 22, maxWidth: 420 }}>
      Ask your building administrator to finish setting up the web app.
    </Text>
  </View>
);
