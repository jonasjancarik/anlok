export const DEFAULT_API_URL = process.env.EXPO_PUBLIC_API_URL?.trim() ?? '';
export const APP_TITLE = process.env.EXPO_PUBLIC_APP_TITLE ?? 'Anlok';
export const APP_SUBTITLE = process.env.EXPO_PUBLIC_APP_SUBTITLE ?? 'Apartment access';
export const SENDER_EMAIL = process.env.EXPO_PUBLIC_SENDER_EMAIL?.trim() ?? '';
export const APNS_ENVIRONMENT =
  process.env.EXPO_PUBLIC_APNS_ENVIRONMENT?.trim().toLowerCase() ?? '';
export const REQUIRED_PIN_LENGTH =
  Number.parseInt(process.env.EXPO_PUBLIC_REQUIRED_PIN_LENGTH ?? '4', 10) || 4;
export const GUEST_PIN_MODE =
  process.env.EXPO_PUBLIC_GUEST_PIN_MODE?.trim().toLowerCase() ?? 'generated';
export const ALLOW_UNSCHEDULED_GUEST_CUSTOM_PINS =
  GUEST_PIN_MODE === 'custom_until_scheduled';
