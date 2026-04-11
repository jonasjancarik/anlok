import { MaterialIcons } from '@expo/vector-icons';
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

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const MainTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerTitleAlign: 'center',
        tabBarActiveTintColor: '#1d4ed8',
        tabBarInactiveTintColor: '#64748b',
        tabBarIcon: ({ color, size }) => {
          if (route.name === 'Unlock') {
            return <MaterialIcons name="lock-open" color={color} size={size} />;
          }

          return <MaterialIcons name="settings" color={color} size={size} />;
        },
      })}
    >
      <Tab.Screen name="Unlock" component={UnlockScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
};

const CenteredLoader = ({ label }: { label: string }) => (
  <View
    style={{
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f4f7ff',
      gap: 10,
      padding: 20,
    }}
  >
    <ActivityIndicator size="large" color="#1d4ed8" />
    <Text style={{ color: '#1e293b', fontWeight: '600' }}>{label}</Text>
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
      <Stack.Navigator key={apiUrl ? 'configured' : 'setup'} screenOptions={{ headerShown: false }}>
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
