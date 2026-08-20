import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BRAND_PRIMARY = '#00C853';
const BRAND_PRIMARY_DARK = '#00A844';
const BRAND_PRIMARY_LIGHT = '#69F0AE';

const lightTheme = {
  primary: BRAND_PRIMARY,
  primaryDark: BRAND_PRIMARY_DARK,
  primaryLight: '#E8FDF1',

  accent: BRAND_PRIMARY,
  accentLight: '#E8FDF1',

  greenDeep: '#087F5B',
  greenForest: '#15803D',
  greenTeal: '#0F8F70',
  greenMint: '#DFF7EA',
  greenSage: '#E8F3ED',
  greenSoft: '#F3FAF6',

  background: '#F5FBF7',
  surface: '#FFFFFF',
  surfaceLight: '#F0F8F3',
  surfaceRaised: '#FFFFFF',
  surfaceSoft: '#EEF8F2',
  card: '#FFFFFF',

  text: '#102A1A',
  textLight: '#4B6354',
  textLighter: '#718579',
  textMuted: '#9AAEA1',
  textInverse: '#FFFFFF',

  success: '#16A34A',
  successLight: '#DCFCE7',

  warning: '#D97706',
  warningLight: '#FEF3C7',

  error: '#DC2626',
  errorLight: '#FEE2E2',

  info: '#238B68',
  infoLight: '#E1F5EC',

  border: '#DCEBE1',
  borderLight: '#EEF6F1',
  divider: '#DCEBE1',

  icon: '#718579',
  iconActive: BRAND_PRIMARY,

  inputBackground: '#FFFFFF',
  inputBorder: '#CFE1D5',
  inputPlaceholder: '#9AAEA1',

  disabled: '#C8D8CE',
  disabledText: '#94A69A',

  overlay: 'rgba(0,0,0,0.45)',

  gradient1: '#00A844',
  gradient2: '#00C853',
  gradient3: '#69F0AE',

  glass: 'rgba(255,255,255,0.78)',
  glassStrong: 'rgba(255,255,255,0.92)',
  glassGreen: 'rgba(0,200,83,0.10)',
  glassGreenStrong: 'rgba(0,200,83,0.18)',

  whiteSoft: 'rgba(255,255,255,0.8)',

  cardShadow: 'rgba(0,200,83,0.16)',
  cardShadowOpacity: 0.16,

  glossyShadow: 'rgba(0,200,83,0.22)',
  glossyShadowOpacity: 0.22,

  tabBarActive: BRAND_PRIMARY,
  tabBarInactive: '#8AA095',

  statusBarStyle: 'dark-content',
};

const darkTheme = {
  primary: BRAND_PRIMARY,
  primaryDark: BRAND_PRIMARY_DARK,
  primaryLight: '#064E2A',

  accent: BRAND_PRIMARY,
  accentLight: '#064E2A',

  greenDeep: '#0B6B4F',
  greenForest: '#22A052',
  greenTeal: '#16A085',
  greenMint: '#0B3B29',
  greenSage: '#12271E',
  greenSoft: '#17231D',

  background: '#000000',
  surface: '#0F1114',
  surfaceLight: '#121A16',
  surfaceRaised: '#151A18',
  surfaceSoft: '#1A211E',
  card: '#0F1512',

  text: '#F2FFF6',
  textLight: '#A0AEC0',
  textLighter: '#718579',
  textMuted: '#687D70',
  textInverse: '#FFFFFF',

  success: '#00E676',
  successLight: '#063B20',

  warning: '#F59E0B',
  warningLight: '#451A03',

  error: '#EF4444',
  errorLight: '#450A0A',

  info: '#38B98B',
  infoLight: '#073B2B',

  border: '#1A2A21',
  borderLight: '#16231C',
  divider: '#1A2A21',

  icon: '#9BB0A2',
  iconActive: BRAND_PRIMARY,

  inputBackground: '#12161A',
  inputBorder: '#294033',
  inputPlaceholder: '#687D70',

  disabled: '#24382C',
  disabledText: '#607267',

  overlay: 'rgba(0,0,0,0.72)',

  gradient1: '#006B2D',
  gradient2: '#00C853',
  gradient3: '#69F0AE',

  glass: 'rgba(255,255,255,0.05)',
  glassStrong: 'rgba(255,255,255,0.08)',
  glassGreen: 'rgba(0,200,83,0.10)',
  glassGreenStrong: 'rgba(0,200,83,0.18)',

  whiteSoft: 'rgba(255,255,255,0.06)',

  cardShadow: 'rgba(0,0,0,0.35)',
  cardShadowOpacity: 0.35,

  glossyShadow: 'rgba(0,230,118,0.20)',
  glossyShadowOpacity: 0.20,

  tabBarActive: BRAND_PRIMARY,
  tabBarInactive: '#6F8578',

  statusBarStyle: 'light-content',
};

const ThemeContext = createContext(null);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};

export const ThemeProvider = ({ children }) => {
  const systemTheme = useColorScheme();

  const [themeMode, setThemeMode] = useState('light');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('themeMode');
        if (savedTheme === 'light' || savedTheme === 'dark') {
          setThemeMode(savedTheme);
        } else {
          setThemeMode(systemTheme === 'dark' ? 'dark' : 'light');
        }
      } catch (error) {
        console.warn('Failed to load theme:', error);
        setThemeMode(systemTheme === 'dark' ? 'dark' : 'light');
      } finally {
        setIsLoading(false);
      }
    };

    loadTheme();
  }, [systemTheme]);

  const toggleTheme = async () => {
    const newTheme = themeMode === 'light' ? 'dark' : 'light';
    setThemeMode(newTheme);
    try {
      await AsyncStorage.setItem('themeMode', newTheme);
    } catch (error) {
      console.warn('Failed to save theme:', error);
    }
  };

  const setTheme = async (mode) => {
    if (mode !== 'light' && mode !== 'dark') {
      console.warn(`Invalid theme mode: ${mode}`);
      return;
    }
    setThemeMode(mode);
    try {
      await AsyncStorage.setItem('themeMode', mode);
    } catch (error) {
      console.warn('Failed to save theme:', error);
    }
  };

  const colors = themeMode === 'dark' ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{
      theme: themeMode,
      colors,
      toggleTheme,
      setTheme,
      isDark: themeMode === 'dark',
      isLoading,
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;