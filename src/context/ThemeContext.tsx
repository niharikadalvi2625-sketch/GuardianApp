import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { ThemeColors, DarkTheme, LightTheme } from '../theme/colors';
import { StorageService } from '../services/storageService';

export type ThemePreference = 'system' | 'light' | 'dark';

export interface ThemeContextType {
  theme: ThemeColors;
  isDark: boolean;
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => Promise<void>;
  toggleTheme: () => Promise<void>;
}

const STORAGE_KEY = 'user_theme_preference';

const ThemeContext = createContext<ThemeContextType>({
  theme: DarkTheme,
  isDark: true,
  themePreference: 'system',
  setThemePreference: async () => {},
  toggleTheme: async () => {},
});

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const systemColorScheme = useColorScheme();
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>('system');
  const [loaded, setLoaded] = useState<boolean>(false);

  useEffect(() => {
    loadPreference();
  }, []);

  const loadPreference = async () => {
    try {
      const saved = await StorageService.getItem(STORAGE_KEY);
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setThemePreferenceState(saved as ThemePreference);
      }
    } catch {
      // Default to system
    } finally {
      setLoaded(true);
    }
  };

  const setThemePreference = async (pref: ThemePreference) => {
    setThemePreferenceState(pref);
    try {
      await StorageService.setItem(STORAGE_KEY, pref);
    } catch {
      // Storage write error tolerated
    }
  };

  const isDark = useMemo(() => {
    if (themePreference === 'dark') return true;
    if (themePreference === 'light') return false;
    // 'system'
    return systemColorScheme === 'dark';
  }, [themePreference, systemColorScheme]);

  const theme = useMemo(() => {
    return isDark ? DarkTheme : LightTheme;
  }, [isDark]);

  const toggleTheme = async () => {
    const nextPref: ThemePreference = isDark ? 'light' : 'dark';
    await setThemePreference(nextPref);
  };

  const value = useMemo(
    () => ({
      theme,
      isDark,
      themePreference,
      setThemePreference,
      toggleTheme,
    }),
    [theme, isDark, themePreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default ThemeContext;
