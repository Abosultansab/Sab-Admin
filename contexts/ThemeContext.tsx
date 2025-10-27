import { useState, useEffect, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { LightColors, DarkColors } from '@/constants/colors';

export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  secondary: string;
  secondaryDark: string;
  secondaryLight: string;
  success: string;
  successDark: string;
  successLight: string;
  warning: string;
  warningDark: string;
  warningLight: string;
  danger: string;
  dangerDark: string;
  dangerLight: string;
  background: string;
  backgroundDark: string;
  card: string;
  cardBorder: string;
  text: string;
  textSecondary: string;
  textLight: string;
  border: string;
  borderLight: string;
  white: string;
  black: string;
  overlay: string;
  overlayLight: string;
}

const THEME_STORAGE_KEY = '@app_theme_mode';

export const [ThemeProvider, useTheme] = createContextHook(() => {
  const [themeMode, setThemeMode] = useState<ThemeMode>('light');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme === 'dark' || savedTheme === 'light') {
        setThemeMode(savedTheme);
      }
    } catch (error) {
      console.log('[ThemeContext] Error loading theme:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTheme = useCallback(async () => {
    const newTheme: ThemeMode = themeMode === 'light' ? 'dark' : 'light';
    setThemeMode(newTheme);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch (error) {
      console.log('[ThemeContext] Error saving theme:', error);
    }
  }, [themeMode]);

  const colors: ThemeColors = themeMode === 'light' ? LightColors : DarkColors;
  const isDark = themeMode === 'dark';

  return useMemo(() => ({
    themeMode,
    colors,
    isDark,
    isLoading,
    toggleTheme,
  }), [themeMode, colors, isDark, isLoading, toggleTheme]);
});
