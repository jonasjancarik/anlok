import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_UNLOCK_BUTTON_STYLE = 'door-control/unlock-button-style';

export type UnlockButtonStyle = 'green' | 'minimal';

const DEFAULT_UNLOCK_BUTTON_STYLE: UnlockButtonStyle = 'green';

interface PreferencesContextType {
  unlockButtonStyle: UnlockButtonStyle;
  setUnlockButtonStyle: (next: UnlockButtonStyle) => Promise<void>;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

const isUnlockButtonStyle = (value: string | null): value is UnlockButtonStyle =>
  value === 'green' || value === 'minimal';

export const PreferencesProvider = ({ children }: { children: React.ReactNode }) => {
  const [unlockButtonStyle, setStyle] = useState<UnlockButtonStyle>(DEFAULT_UNLOCK_BUTTON_STYLE);

  useEffect(() => {
    const hydrate = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_UNLOCK_BUTTON_STYLE);
        if (isUnlockButtonStyle(stored)) {
          setStyle(stored);
        }
      } catch {
        // Keep the default style if storage is unavailable.
      }
    };

    void hydrate();
  }, []);

  const setUnlockButtonStyle = useCallback(async (next: UnlockButtonStyle) => {
    setStyle(next);
    await AsyncStorage.setItem(STORAGE_UNLOCK_BUTTON_STYLE, next);
  }, []);

  const value = useMemo(
    () => ({ unlockButtonStyle, setUnlockButtonStyle }),
    [unlockButtonStyle, setUnlockButtonStyle]
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
};

export const usePreferences = () => {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used inside PreferencesProvider');
  }

  return context;
};
