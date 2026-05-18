import axios from 'axios';
import { DEFAULT_API_URL } from './config';

const trimTrailingSlashes = (value: string) => value.trim().replace(/\/+$/, '');
const hasExplicitScheme = (value: string) => /^[a-z][a-z\d+.-]*:\/\//i.test(value);

const shouldUseHttpByDefault = (hostname: string) => {
  const normalizedHost = hostname.toLowerCase();
  const secondOctet = Number.parseInt(normalizedHost.split('.')[1] ?? '', 10);

  return (
    normalizedHost === 'localhost' ||
    normalizedHost === '::1' ||
    normalizedHost.startsWith('127.') ||
    normalizedHost.startsWith('10.') ||
    normalizedHost.startsWith('192.168.') ||
    (normalizedHost.startsWith('172.') && secondOctet >= 16 && secondOctet <= 31)
  );
};

const addDefaultScheme = (value: string) => {
  const trimmed = value.trim();

  if (!trimmed || hasExplicitScheme(trimmed)) {
    return trimmed;
  }

  try {
    const parsed = new URL(`https://${trimmed}`);
    const protocol = shouldUseHttpByDefault(parsed.hostname) ? 'http' : 'https';
    return `${protocol}://${trimmed}`;
  } catch {
    return `https://${trimmed}`;
  }
};

let currentApiUrl = '';

export const normalizeApiUrl = (value: string) => trimTrailingSlashes(addDefaultScheme(value));

export const isSupportedApiUrl = (value: string) => {
  try {
    const url = new URL(normalizeApiUrl(value));
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

export const setApiBaseUrl = (value: string) => {
  currentApiUrl = normalizeApiUrl(value);
  api.defaults.baseURL = currentApiUrl || undefined;
};

export const getApiBaseUrl = () => currentApiUrl;

export const api = axios.create({
  baseURL: undefined,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  if (!currentApiUrl) {
    throw new Error('Missing server URL. Configure the server during onboarding.');
  }

  config.baseURL = currentApiUrl;
  return config;
});

if (DEFAULT_API_URL) {
  setApiBaseUrl(DEFAULT_API_URL);
}

export const authHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
});

export const apiErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    const detail =
      (error.response?.data as { error?: { detail?: string }; detail?: string } | undefined)
        ?.error?.detail ??
      (error.response?.data as { error?: { detail?: string }; detail?: string } | undefined)
        ?.detail;

    if (detail) {
      return detail;
    }

    if (error.message === 'Network Error') {
      return 'Network error. Check server and connection.';
    }

    if (error.response?.status === 401) {
      return 'Unauthorized. Please log in again.';
    }

    if (error.response?.status === 403) {
      return 'Forbidden for this account.';
    }
  }

  return fallback;
};
