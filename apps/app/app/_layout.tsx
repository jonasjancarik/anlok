import 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { palette } from '../src/components/common/ui';
import { AuthProvider, useAuth } from '../src/contexts/AuthContext';
import { PreferencesProvider } from '../src/contexts/PreferencesContext';
import { ServerConfigProvider, useServerConfig } from '../src/contexts/ServerConfigContext';

const CenteredLoader = ({ label }: { label: string }) => (
  <View style={styles.loader}>
    <ActivityIndicator size="large" color={palette.primary} />
    <Text style={styles.loaderLabel}>{label}</Text>
  </View>
);

const RootNavigator = () => {
  const { loading, user } = useAuth();
  const { loading: serverConfigLoading, apiUrl } = useServerConfig();
  const isWeb = Platform.OS === 'web';

  // Guards need the stored server and session first, or the first render
  // redirects to server setup and stays there.
  if (serverConfigLoading) {
    return <CenteredLoader label="Connecting…" />;
  }

  if (loading) {
    return <CenteredLoader label="Loading…" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.canvas } }}>
      <Stack.Protected guard={!!apiUrl && !!user}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      <Stack.Protected guard={!!apiUrl && !user}>
        <Stack.Screen name="login" />
      </Stack.Protected>
      <Stack.Protected guard={!apiUrl && isWeb}>
        <Stack.Screen name="web-config-missing" />
      </Stack.Protected>
      <Stack.Protected guard={!isWeb}>
        <Stack.Screen name="server-setup" />
      </Stack.Protected>
    </Stack>
  );
};

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ServerConfigProvider>
        <AuthProvider>
          <PreferencesProvider>
            <RootNavigator />
          </PreferencesProvider>
        </AuthProvider>
      </ServerConfigProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.canvas,
    gap: 16,
    padding: 20,
  },
  loaderLabel: {
    color: palette.muted,
    fontWeight: '700',
    fontSize: 15,
  },
});
