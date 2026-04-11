import axios from 'axios';
import { DEFAULT_API_URL } from './config';

const trimTrailingSlashes = (value: string) => value.trim().replace(/\/+$/, '');

let currentApiUrl = '';

export const normalizeApiUrl = (value: string) => trimTrailingSlashes(value);

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
