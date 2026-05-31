import { Feather } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { ActivityIndicator, Platform, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useServerConfig } from '../contexts/ServerConfigContext';
import { LoginScreen } from '../screens/LoginScreen';
import { ActivityScreen } from '../screens/ActivityScreen';
import { ServerSetupScreen } from '../screens/ServerSetupScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { UnlockScreen } from '../screens/UnlockScreen';
import { palette } from '../components/common/ui';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const TAB_BAR_BASE_HEIGHT = 64;
const TAB_BAR_BASE_BOTTOM_PADDING = 10;
const TAB_BAR_SAFE_AREA_GAP = 8;
const TAB_BAR_COMPACT_SAFE_AREA_MAX = 16;
const ANDROID_LARGE_BOTTOM_SYSTEM_BAR_MIN_INSET = 40;

const MainTabs = () => {
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const showTabLabels = width >= 520;
  const hasLargeAndroidBottomSystemBar =
    Platform.OS === 'android' &&
    insets.bottom >= ANDROID_LARGE_BOTTOM_SYSTEM_BAR_MIN_INSET;
  const compactBottomInset = Math.min(insets.bottom, TAB_BAR_COMPACT_SAFE_AREA_MAX);
  const tabBarBottomPadding = hasLargeAndroidBottomSystemBar
    ? insets.bottom + TAB_BAR_SAFE_AREA_GAP
    : Math.max(
        TAB_BAR_BASE_BOTTOM_PADDING,
        Platform.OS === 'android' ? compactBottomInset : insets.bottom
      );
  const tabBarHeight =
    TAB_BAR_BASE_HEIGHT + Math.max(0, tabBarBottomPadding - TAB_BAR_BASE_BOTTOM_PADDING);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerTitleAlign: 'center',
        headerShadowVisible: false,
        headerStyle: { backgroundColor: palette.canvas },
        headerTitleStyle: { fontWeight: '800', color: palette.text, fontSize: 18 },
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.muted,
        tabBarLabelPosition: showTabLabels ? 'beside-icon' : 'below-icon',
        tabBarShowLabel: showTabLabels,
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: palette.border,
          elevation: 0,
          backgroundColor: palette.card,
          height: tabBarHeight,
          paddingBottom: tabBarBottomPadding,
          paddingTop: 8,
        },
        tabBarItemStyle: {
          paddingHorizontal: 4,
        },
        tabBarLabelStyle: {
          fontWeight: '600',
          fontSize: 12,
          lineHeight: 14,
        },
        tabBarIcon: ({ color, size }) => {
          if (route.name === 'Unlock') {
            return <Feather name="unlock" color={color} size={size} />;
          }

          if (route.name === 'Activity') {
            return <Feather name="activity" color={color} size={size} />;
          }

          if (route.name === 'Users') {
            return <Feather name="users" color={color} size={size} />;
          }

          if (route.name === 'Apartments') {
            return <Feather name="home" color={color} size={size} />;
          }

          return <Feather name="user" color={color} size={size} />;
        },
      })}
    >
      <Tab.Screen name="Unlock" component={UnlockScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Activity" component={ActivityScreen} options={{ headerShown: false }} />
      <Tab.Screen
        name="Users"
        component={SettingsScreen}
        initialParams={{ tab: 'users', hideTabSwitcher: true }}
        options={{ headerShown: false }}
      />
      {user?.role === 'admin' ? (
        <Tab.Screen
          name="Apartments"
          component={SettingsScreen}
          initialParams={{ tab: 'apartments', hideTabSwitcher: true }}
          options={{ headerShown: false, tabBarLabel: 'Apts' }}
        />
      ) : null}
      <Tab.Screen
        name="Profile"
        component={SettingsScreen}
        initialParams={{ tab: 'profile', hideTabSwitcher: true }}
        options={{ headerShown: false }}
      />
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

const WebConfigMissing = () => (
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
      Server URL is not configured
    </Text>
    <Text style={{ color: palette.muted, fontSize: 15, textAlign: 'center', lineHeight: 22, maxWidth: 420 }}>
      Set EXPO_PUBLIC_API_URL for this hosted web app.
    </Text>
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
        {!apiUrl && Platform.OS === 'web' ? (
          <Stack.Screen name="WebConfigMissing" component={WebConfigMissing} />
        ) : !apiUrl ? (
          <Stack.Screen name="ServerSetup" component={ServerSetupScreen} />
        ) : user ? (
          <Stack.Screen name="Main" component={MainTabs} />
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            {Platform.OS !== 'web' ? (
              <Stack.Screen name="ServerSetup" component={ServerSetupScreen} />
            ) : null}
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
