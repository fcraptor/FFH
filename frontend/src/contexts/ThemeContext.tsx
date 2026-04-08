import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
import { ThemeMode } from '../types';

const THEME_KEY = 'firefighter_theme';

export const colors = {
  light: {
    primary: '#C8102E',
    background: '#FFFFFF',
    surface: '#F5F5F5',
    card: '#FFFFFF',
    text: '#1A1A1A',
    textSecondary: '#666666',
    border: '#E0E0E0',
    accent: '#FFD700',
    success: '#4CAF50',
    error: '#F44336',
  },
  dark: {
    primary: '#C8102E',
    background: '#121212',
    surface: '#1E1E1E',
    card: '#2A2A2A',
    text: '#FFFFFF',
    textSecondary: '#B0B0B0',
    border: '#404040',
    accent: '#FFD700',
    success: '#4CAF50',
    error: '#F44336',
  },
};

interface ThemeContextType {
  theme: ThemeMode;
  colors: typeof colors.light;
  isSystemThemeEnabled: boolean;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const systemColorScheme = useColorScheme();
  const [themeOverride, setThemeOverride] = useState<ThemeMode | null>(null);

  const systemTheme: ThemeMode = systemColorScheme === 'dark' ? 'dark' : 'light';
  const theme = themeOverride ?? systemTheme;

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const stored = await AsyncStorage.getItem(THEME_KEY);
      if (stored === 'light' || stored === 'dark') {
        setThemeOverride(stored);
      } else {
        setThemeOverride(null);
      }
    } catch (error) {
      console.error('Error loading theme:', error);
    }
  };

  const saveThemePreference = async (mode: ThemeMode | null) => {
    try {
      if (mode) {
        await AsyncStorage.setItem(THEME_KEY, mode);
      } else {
        await AsyncStorage.removeItem(THEME_KEY);
      }
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    const nextOverride = newTheme === systemTheme ? null : newTheme;
    setThemeOverride(nextOverride);
    saveThemePreference(nextOverride);
  };

  const setTheme = (mode: ThemeMode) => {
    const nextOverride = mode === systemTheme ? null : mode;
    setThemeOverride(nextOverride);
    saveThemePreference(nextOverride);
  };

  const currentColors = useMemo(() => colors[theme], [theme]);

  return (
    <ThemeContext.Provider value={{ theme, colors: currentColors, isSystemThemeEnabled: themeOverride === null, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
