import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getCurrentUser, getUserProfile, updateRow } from '../../config/supabase';
import i18n, { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, getSupportedLanguage } from '../../Utils/i18n';

const LANGUAGE_STORAGE_KEY = 'comm-connect.language';
const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const { t } = useTranslation();
  const [language, setLanguageState] = useState(i18n.language || DEFAULT_LANGUAGE);

  useEffect(() => {
    let mounted = true;

    const applyLanguage = async (nextLanguage) => {
      const normalizedLanguage = getSupportedLanguage(nextLanguage).code;
      await i18n.changeLanguage(normalizedLanguage);
      if (mounted) setLanguageState(normalizedLanguage);
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, normalizedLanguage);
    };

    const loadLanguage = async () => {
      try {
        const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (savedLanguage) await applyLanguage(savedLanguage);

        const user = await getCurrentUser();
        if (!user?.id || !mounted) return;

        const profile = await getUserProfile(user.id);
        if (profile?.language) await applyLanguage(profile.language);
      } catch (error) {
        console.warn('[LANGUAGE] Failed to load preferred language:', error);
      }
    };

    loadLanguage();

    return () => {
      mounted = false;
    };
  }, []);

  const setLanguage = useCallback(async (nextLanguage, options = {}) => {
    const normalizedLanguage = getSupportedLanguage(nextLanguage).code;

    await i18n.changeLanguage(normalizedLanguage);
    setLanguageState(normalizedLanguage);
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, normalizedLanguage);

    if (options.persistProfile !== false) {
      try {
        const user = await getCurrentUser();
        if (user?.id) await updateRow('users', user.id, { language: normalizedLanguage });
      } catch (error) {
        console.warn('[LANGUAGE] Failed to save preferred language:', error);
      }
    }
  }, []);

  const value = useMemo(() => ({
    language,
    languageLabel: getSupportedLanguage(language).label,
    languages: SUPPORTED_LANGUAGES,
    setLanguage,
    t,
  }), [language, setLanguage, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider');
  return context;
};
