import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';
import { useColorScheme as useNativeWindColorScheme } from 'nativewind';
import { themeStorage, ThemeMode } from '@/lib/themeStorage';

export interface ThemeColors {
  background: string;
  card: string;
  text: string;
  subtext: string;
  border: string;
  primary: string;
  icon: string;
  modalBg: string;
  inputBg: string;
  inputBorder: string;
  tabBarBg: string;
  tabBarActive: string;
  tabBarInactive: string;
  danger: string;
  dangerBg: string;
}

export const lightColors: ThemeColors = {
  background: '#FFFFFF',
  card: '#F9FAFB',
  text: '#111827',
  subtext: '#6B7280',
  border: '#E5E7EB',
  primary: '#000000',
  icon: '#374151',
  modalBg: '#FFFFFF',
  inputBg: '#F3F4F6',
  inputBorder: '#E5E7EB',
  tabBarBg: '#FFFFFF',
  tabBarActive: '#000000',
  tabBarInactive: '#9CA3AF',
  danger: '#EF4444',
  dangerBg: '#FEF2F2',
};

export const darkColors: ThemeColors = {
  background: '#090D16',
  card: '#151D2A',
  text: '#F9FAFB',
  subtext: '#9CA3AF',
  border: '#1F2937',
  primary: '#FFFFFF',
  icon: '#D1D5DB',
  modalBg: '#090D16',
  inputBg: '#151D2A',
  inputBorder: '#374151',
  tabBarBg: '#090D16',
  tabBarActive: '#FFFFFF',
  tabBarInactive: '#6B7280',
  danger: '#F87171',
  dangerBg: '#2D1517',
};

interface ThemeContextType {
  themeMode: ThemeMode;
  activeTheme: 'light' | 'dark';
  isDark: boolean;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  colors: ThemeColors;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const rnColorScheme = useRNColorScheme();
  const { setColorScheme: setNWColorScheme } = useNativeWindColorScheme();

  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    themeStorage.getThemeMode().then((mode) => {
      setThemeModeState(mode);
      setIsLoaded(true);
    });
  }, []);

  const activeTheme: 'light' | 'dark' = useMemo(() => {
    if (themeMode === 'system') {
      return rnColorScheme === 'dark' ? 'dark' : 'light';
    }
    return themeMode;
  }, [themeMode, rnColorScheme]);

  useEffect(() => {
    if (isLoaded) {
      setNWColorScheme(themeMode);
    }
  }, [themeMode, isLoaded, setNWColorScheme]);

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    await themeStorage.setThemeMode(mode);
    setNWColorScheme(mode);
  };

  const isDark = activeTheme === 'dark';
  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        activeTheme,
        isDark,
        setThemeMode,
        colors,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
