export const API_URL = process.env.EXPO_PUBLIC_API_URL?.trim() ?? '';
export const APP_TITLE = process.env.EXPO_PUBLIC_APP_TITLE ?? 'Door Control';
export const APP_SUBTITLE = process.env.EXPO_PUBLIC_APP_SUBTITLE ?? 'Unlock access';
export const REQUIRED_PIN_LENGTH =
  Number.parseInt(process.env.EXPO_PUBLIC_REQUIRED_PIN_LENGTH ?? '4', 10) || 4;
