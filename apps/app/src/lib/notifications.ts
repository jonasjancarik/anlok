import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api, authHeaders } from './api';
import { EAS_PROJECT_ID } from './config';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export type NotificationRegistrationResult =
  | { status: 'registered'; message: string }
  | { status: 'unsupported'; message: string }
  | { status: 'denied'; message: string }
  | { status: 'missing-project-id'; message: string }
  | { status: 'error'; message: string };

const projectIdFromConstants = () =>
  EAS_PROJECT_ID ||
  Constants.easConfig?.projectId ||
  Constants.expoConfig?.extra?.eas?.projectId;

export const registerForAccessNotifications = async (
  token: string
): Promise<NotificationRegistrationResult> => {
  if (Platform.OS === 'web') {
    return { status: 'unsupported', message: 'Push notifications are not available on web.' };
  }

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('door-activity', {
        name: 'Door activity',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const existingPermissions = await Notifications.getPermissionsAsync();
    let finalStatus = existingPermissions.status;

    if (finalStatus !== 'granted') {
      const requestedPermissions = await Notifications.requestPermissionsAsync();
      finalStatus = requestedPermissions.status;
    }

    if (finalStatus !== 'granted') {
      return { status: 'denied', message: 'Notifications are disabled for this device.' };
    }

    const projectId = projectIdFromConstants();
    if (!projectId) {
      return {
        status: 'missing-project-id',
        message: 'Missing EAS project id for push notifications.',
      };
    }

    const expoPushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await api.post(
      '/notification-devices',
      {
        expo_push_token: expoPushToken,
        platform: Platform.OS,
      },
      { headers: authHeaders(token) }
    );

    return { status: 'registered', message: 'Notifications are enabled on this device.' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to enable notifications.';
    return { status: 'error', message };
  }
};
