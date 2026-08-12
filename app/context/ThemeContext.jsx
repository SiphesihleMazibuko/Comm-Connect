// app/context/ThemeContext.jsx

import React, { createContext, useState, useContext, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BRAND_PRIMARY = '#6C63FF';
const BRAND_PRIMARY_DARK = '#564DDB';

const lightTheme = {
  // =========================
  // BRAND
  // =========================
  primary: BRAND_PRIMARY,
  primaryDark: BRAND_PRIMARY_DARK,
  primaryLight: '#EEF2FF',

  accent: BRAND_PRIMARY,
  accentLight: '#EEF2FF',

  // =========================
  // BACKGROUNDS
  // =========================
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceLight: '#F1F5F9',
  card: '#FFFFFF',

  // =========================
  // TEXT
  // =========================
  text: '#111827',
  textLight: '#4B5563',
  textLighter: '#6B7280',
  textMuted: '#9CA3AF',
  textInverse: '#FFFFFF',

  // =========================
  // STATUS
  // =========================
  success: '#16A34A',
  successLight: '#DCFCE7',

  warning: '#F59E0B',
  warningLight: '#FEF3C7',

  error: '#DC2626',
  errorLight: '#FEE2E2',

  info: '#2563EB',
  infoLight: '#DBEAFE',

  // =========================
  // UI
  // =========================
  border: '#E5E7EB',
  borderLight: '#F3F4F6',

  divider: '#E5E7EB',

  icon: '#6B7280',
  iconActive: BRAND_PRIMARY,

  inputBackground: '#FFFFFF',
  inputBorder: '#D1D5DB',
  inputPlaceholder: '#9CA3AF',

  disabled: '#CBD5E1',
  disabledText: '#94A3B8',

  overlay: 'rgba(0,0,0,0.45)',

  // =========================
  // GRADIENTS
  // =========================
  gradient1: '#6C63FF',
  gradient2: '#8B83FF',

  // =========================
  // SHADOWS
  // =========================
  cardShadow: 'rgba(15,23,42,0.08)',
  cardShadowOpacity: 0.08,

  // =========================
  // TAB BAR
  // =========================
  tabBarActive: BRAND_PRIMARY,
  tabBarInactive: '#94A3B8',

  // =========================
  // STATUS BAR
  // =========================
  statusBarStyle: 'dark-content',
};

const darkTheme = {
  // =========================
  // BRAND
  // =========================
  primary: BRAND_PRIMARY,
  primaryDark: BRAND_PRIMARY_DARK,
  primaryLight: '#312E81',

  accent: BRAND_PRIMARY,
  accentLight: '#312E81',

  // =========================
  // BACKGROUNDS
  // =========================
  background: '#0F172A',
  surface: '#111827',
  surfaceLight: '#1F2937',
  card: '#111827',

  // =========================
  // TEXT
  // =========================
  text: '#F9FAFB',
  textLight: '#D1D5DB',
  textLighter: '#9CA3AF',
  textMuted: '#6B7280',
  textInverse: '#FFFFFF',

  // =========================
  // STATUS
  // =========================
  success: '#22C55E',
  successLight: '#052E16',

  warning: '#F59E0B',
  warningLight: '#451A03',

  error: '#EF4444',
  errorLight: '#450A0A',

  info: '#60A5FA',
  infoLight: '#172554',

  // =========================
  // UI
  // =========================
  border: '#374151',
  borderLight: '#4B5563',

  divider: '#374151',

  icon: '#9CA3AF',
  iconActive: BRAND_PRIMARY,

  inputBackground: '#1F2937',
  inputBorder: '#4B5563',
  inputPlaceholder: '#6B7280',

  disabled: '#374151',
  disabledText: '#6B7280',

  overlay: 'rgba(0,0,0,0.65)',

  // =========================
  // GRADIENTS
  // =========================
  gradient1: '#6C63FF',
  gradient2: '#8B83FF',

  // =========================
  // SHADOWS
  // =========================
  cardShadow: 'rgba(0,0,0,0.35)',
  cardShadowOpacity: 0.35,

  // =========================
  // TAB BAR
  // =========================
  tabBarActive: BRAND_PRIMARY,
  tabBarInactive: '#6B7280',

  // =========================
  // STATUS BAR
  // =========================
  statusBarStyle: 'light-content',
};

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }

  return context;
};

export const ThemeProvider = ({ children }) => {
  const systemTheme = useColorScheme();

  const [themeMode, setThemeMode] = useState('light');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('themeMode');

      if (savedTheme) {
        setThemeMode(savedTheme);
      } else {
        setThemeMode(systemTheme || 'light');
      }
    } catch (error) {
      console.warn('Failed to load theme:', error);
      setThemeMode('light');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTheme = async () => {
    try {
      const newTheme = themeMode === 'light' ? 'dark' : 'light';

      setThemeMode(newTheme);

      await AsyncStorage.setItem('themeMode', newTheme);
    } catch (error) {
      console.warn('Failed to save theme:', error);
    }
  };

  const setTheme = async (mode) => {
    try {
      setThemeMode(mode);
      await AsyncStorage.setItem('themeMode', mode);
    } catch (error) {
      console.warn('Failed to save theme:', error);
    }
  };

  const colors = themeMode === 'dark' ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider
      value={{
        theme: themeMode,
        colors,
        toggleTheme,
        setTheme,
        isDark: themeMode === 'dark',
        isLoading,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};