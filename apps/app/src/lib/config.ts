export const DEFAULT_API_URL = process.env.EXPO_PUBLIC_API_URL?.trim() ?? '';
export const APP_TITLE = process.env.EXPO_PUBLIC_APP_TITLE ?? 'Anlok';
export const APP_SUBTITLE = process.env.EXPO_PUBLIC_APP_SUBTITLE ?? 'Apartment access';
export const SENDER_EMAIL = process.env.EXPO_PUBLIC_SENDER_EMAIL?.trim() ?? '';
export const EAS_PROJECT_ID = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim() ?? '';
export const REQUIRED_PIN_LENGTH =
  Number.parseInt(process.env.EXPO_PUBLIC_REQUIRED_PIN_LENGTH ?? '4', 10) || 4;
