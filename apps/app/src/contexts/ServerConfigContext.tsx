import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_API_URL } from '../lib/config';
import { normalizeApiUrl, setApiBaseUrl } from '../lib/api';

const STORAGE_API_URL = 'door-control/api-url';

interface ServerConfigContextType {
  apiUrl: string;
  suggestedApiUrl: string;
  loading: boolean;
  saveApiUrl: (nextUrl: string) => Promise<void>;
}

const ServerConfigContext = createContext<ServerConfigContextType | undefined>(undefined);

export const ServerConfigProvider = ({ children }: { children: React.ReactNode }) => {
  const [apiUrl, setApiUrl] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const hydrate = async () => {
      try {
        const savedApiUrl = await AsyncStorage.getItem(STORAGE_API_URL);
        const normalized = normalizeApiUrl(savedApiUrl ?? '');
        setApiUrl(normalized);
        setApiBaseUrl(normalized);
      } finally {
        setLoading(false);
      }
    };

    void hydrate();
  }, []);

  const saveApiUrl = useCallback(async (nextUrl: string) => {
    const normalized = normalizeApiUrl(nextUrl);
    setApiUrl(normalized);
    setApiBaseUrl(normalized);
    await AsyncStorage.setItem(STORAGE_API_URL, normalized);
  }, []);

  const value = useMemo(
    () => ({
      apiUrl,
      suggestedApiUrl: normalizeApiUrl(DEFAULT_API_URL),
      loading,
      saveApiUrl,
    }),
    [apiUrl, loading, saveApiUrl]
  );

  return <ServerConfigContext.Provider value={value}>{children}</ServerConfigContext.Provider>;
};

export const useServerConfig = () => {
  const context = useContext(ServerConfigContext);
  if (!context) {
    throw new Error('useServerConfig must be used inside ServerConfigProvider');
  }

  return context;
};
