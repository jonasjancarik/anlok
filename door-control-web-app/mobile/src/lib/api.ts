import axios from 'axios';
import { API_URL } from './config';

export const api = axios.create({
  baseURL: API_URL || undefined,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  if (!API_URL) {
    throw new Error('Missing EXPO_PUBLIC_API_URL environment variable.');
  }

  return config;
});

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
