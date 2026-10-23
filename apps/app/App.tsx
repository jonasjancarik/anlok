import 'react-native-gesture-handler';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/contexts/AuthContext';
import { PreferencesProvider } from './src/contexts/PreferencesContext';
import { ServerConfigProvider } from './src/contexts/ServerConfigContext';
import { AppNavigator } from './src/navigation/AppNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <ServerConfigProvider>
        <AuthProvider>
          <PreferencesProvider>
            <AppNavigator />
          </PreferencesProvider>
        </AuthProvider>
      </ServerConfigProvider>
    </SafeAreaProvider>
  );
}
