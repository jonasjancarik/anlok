import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, authHeaders } from '../lib/api';
import { User } from '../types/entities';

const STORAGE_TOKEN = 'door-control/token';
const STORAGE_USER = 'door-control/user';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (nextToken: string, nextUser: User) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (nextUser: User) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const hydrate = async () => {
      try {
        const [savedToken, savedUser] = await Promise.all([
          AsyncStorage.getItem(STORAGE_TOKEN),
          AsyncStorage.getItem(STORAGE_USER),
        ]);

        if (savedToken && savedUser) {
          setToken(savedToken);
          setUser(JSON.parse(savedUser) as User);
        }
      } finally {
        setLoading(false);
      }
    };

    hydrate();
  }, []);

  const login = useCallback(async (nextToken: string, nextUser: User) => {
    setToken(nextToken);
    setUser(nextUser);
    await Promise.all([
      AsyncStorage.setItem(STORAGE_TOKEN, nextToken),
      AsyncStorage.setItem(STORAGE_USER, JSON.stringify(nextUser)),
    ]);
  }, []);

  const logout = useCallback(async () => {
    setToken(null);
    setUser(null);
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_TOKEN),
      AsyncStorage.removeItem(STORAGE_USER),
    ]);
  }, []);

  const updateUser = useCallback(async (nextUser: User) => {
    setUser(nextUser);
    await AsyncStorage.setItem(STORAGE_USER, JSON.stringify(nextUser));
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }

    let active = true;

    const verify = async () => {
      try {
        await api.post('/auth/verify', {}, { headers: authHeaders(token) });
      } catch {
        if (active) {
          await logout();
        }
      }
    };

    verify();

    return () => {
      active = false;
    };
  }, [token, logout]);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      login,
      logout,
      updateUser,
    }),
    [user, token, loading, login, logout, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
};
