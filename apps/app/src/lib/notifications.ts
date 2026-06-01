import * as Notifications from 'expo-notifications';
import type { DevicePushToken } from 'expo-notifications';
import { Platform } from 'react-native';
import { api, apiErrorMessage, authHeaders } from './api';
import { APNS_ENVIRONMENT } from './config';

if (Platform.OS !== 'web') {
  void Notifications.setAutoServerRegistrationEnabledAsync(false).catch(() => undefined);

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
  | { status: 'error'; message: string };

type NotificationTestResponse = {
  sent: boolean;
  results: Array<{
    status: string;
    error?: string | null;
  }>;
};

const pushProvider = (devicePushToken: DevicePushToken) => {
  if (devicePushToken.type === 'ios') {
    return 'apns';
  }
  if (devicePushToken.type === 'android') {
    return 'fcm';
  }
  return null;
};

const apnsEnvironment = () => {
  if (Platform.OS !== 'ios') {
    return undefined;
  }
  if (APNS_ENVIRONMENT === 'sandbox' || APNS_ENVIRONMENT === 'production') {
    return APNS_ENVIRONMENT;
  }
  return __DEV__ ? 'sandbox' : 'production';
};

const registerDevicePushToken = async (
  token: string,
  devicePushToken: DevicePushToken
): Promise<NotificationRegistrationResult> => {
  const provider = pushProvider(devicePushToken);
  if (!provider || typeof devicePushToken.data !== 'string') {
    return {
      status: 'unsupported',
      message: 'Push notifications are not available on this platform.',
    };
  }

  await api.post(
    '/notification-devices',
    {
      push_token: devicePushToken.data,
      provider,
      platform: devicePushToken.type,
      environment: apnsEnvironment(),
    },
    { headers: authHeaders(token) }
  );

  return {
    status: 'registered',
    message: 'Notifications are enabled on this device.',
  };
};

export const registerForAccessNotifications = async (
  token: string
): Promise<NotificationRegistrationResult> => {
  if (Platform.OS === 'web') {
    return {
      status: 'unsupported',
      message: 'Push notifications are not available on web.',
    };
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
      return {
        status: 'denied',
        message: 'Notifications are disabled for this device.',
      };
    }

    const devicePushToken = await Notifications.getDevicePushTokenAsync();
    return await registerDevicePushToken(token, devicePushToken);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to enable notifications.';
    return { status: 'error', message };
  }
};

export const syncAccessNotificationRegistration = async (
  token: string
): Promise<NotificationRegistrationResult | null> => {
  if (Platform.OS === 'web') {
    return null;
  }

  try {
    const permissions = await Notifications.getPermissionsAsync();
    if (permissions.status !== 'granted') {
      return null;
    }

    const devicePushToken = await Notifications.getDevicePushTokenAsync();
    return await registerDevicePushToken(token, devicePushToken);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to sync notifications.';
    return { status: 'error', message };
  }
};

export const subscribeToAccessNotificationTokenUpdates = (token: string) => {
  if (Platform.OS === 'web') {
    return null;
  }

  return Notifications.addPushTokenListener((devicePushToken) => {
    void registerDevicePushToken(token, devicePushToken).catch(() => undefined);
  });
};

export const sendAccessNotificationTest = async (
  token: string
): Promise<NotificationRegistrationResult> => {
  try {
    const response = await api.post<NotificationTestResponse>(
      '/notification-devices/test',
      {},
      { headers: authHeaders(token) }
    );
    const results = response.data.results;
    const sentCount = results.filter((result) => result.status === 'sent').length;
    const failedCount = results.length - sentCount;

    if (sentCount > 0 && failedCount === 0) {
      return {
        status: 'registered',
        message: `Test notification sent to ${sentCount} device${sentCount === 1 ? '' : 's'}.`,
      };
    }

    if (sentCount > 0) {
      return {
        status: 'registered',
        message: `Test sent to ${sentCount} device${sentCount === 1 ? '' : 's'}; ${failedCount} failed.`,
      };
    }

    const firstError = results.find((result) => result.error)?.error;
    return {
      status: 'error',
      message: firstError || 'No active notification devices are registered for this account.',
    };
  } catch (error) {
    return {
      status: 'error',
      message: apiErrorMessage(error, 'Failed to send test notification.'),
    };
  }
};
