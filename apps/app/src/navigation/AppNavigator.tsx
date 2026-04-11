import { Feather } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useServerConfig } from '../contexts/ServerConfigContext';
import { LoginScreen } from '../screens/LoginScreen';
import { ServerSetupScreen } from '../screens/ServerSetupScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { UnlockScreen } from '../screens/UnlockScreen';
import { palette } from '../components/common/ui';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const MainTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerTitleAlign: 'center',
        headerShadowVisible: false,
        headerStyle: { backgroundColor: palette.canvas },
        headerTitleStyle: { fontWeight: '800', color: palette.text, fontSize: 18 },
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.muted,
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: palette.border,
          elevation: 0,
          backgroundColor: palette.card,
          height: 64,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontWeight: '600',
          fontSize: 12,
        },
        tabBarIcon: ({ color, size }) => {
          if (route.name === 'Unlock') {
            return <Feather name="unlock" color={color} size={24} />;
          }

          return <Feather name="settings" color={color} size={24} />;
        },
      })}
    >
      <Tab.Screen name="Unlock" component={UnlockScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ headerShown: false }} />
    </Tab.Navigator>
  );
};

const CenteredLoader = ({ label }: { label: string }) => (
  <View
    style={{
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: palette.canvas,
      gap: 16,
      padding: 20,
    }}
  >
    <ActivityIndicator size="large" color={palette.primary} />
    <Text style={{ color: palette.text, fontWeight: '700', fontSize: 16 }}>{label}</Text>
  </View>
);

export const AppNavigator = () => {
  const { loading, user } = useAuth();
  const { loading: serverConfigLoading, apiUrl } = useServerConfig();

  if (serverConfigLoading) {
    return <CenteredLoader label="Loading server config..." />;
  }

  if (loading) {
    return <CenteredLoader label="Restoring session..." />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator key={apiUrl ? 'configured' : 'setup'} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.canvas } }}>
        {!apiUrl ? (
          <Stack.Screen name="ServerSetup" component={ServerSetupScreen} />
        ) : user ? (
          <Stack.Screen name="Main" component={MainTabs} />
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="ServerSetup" component={ServerSetupScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
