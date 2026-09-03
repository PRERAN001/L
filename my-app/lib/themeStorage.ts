import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const THEME_KEY = 'app_user_theme_mode';

export type ThemeMode = 'light' | 'dark' | 'system';

export const themeStorage = {
  async getThemeMode(): Promise<ThemeMode> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          const stored = window.localStorage.getItem(THEME_KEY);
          if (stored === 'light' || stored === 'dark' || stored === 'system') {
            return stored;
          }
        }
        return 'system';
      }

      const stored = await SecureStore.getItemAsync(THEME_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        return stored as ThemeMode;
      }
      return 'system';
    } catch (e) {
      console.warn('Failed to load theme preference from storage:', e);
      return 'system';
    }
  },

  async setThemeMode(mode: ThemeMode): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(THEME_KEY, mode);
        }
        return;
      }

      await SecureStore.setItemAsync(THEME_KEY, mode);
    } catch (e) {
      console.warn('Failed to save theme preference to storage:', e);
    }
  },
};
