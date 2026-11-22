import React, { createContext, useContext, useEffect, useState } from 'react';

export type AppLanguage = 'en' | 'fr';

interface LanguageContextValue {
  lang: AppLanguage;
  setLang: (lang: AppLanguage) => void;
  toggleLang: () => void;
  t: (en: string, fr: string) => string;
}

const STORAGE_KEY = 'opesfuel_lang_v1';

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'en',
  setLang: () => {},
  toggleLang: () => {},
  t: (en) => en,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<AppLanguage>(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === 'fr' || saved === 'en') return saved;
    } catch {
      // ignore storage errors
    }
    return 'en';
  });

  const setLang = (next: AppLanguage) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore storage errors
    }
  };

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const toggleLang = () => setLang(lang === 'en' ? 'fr' : 'en');
  const t = (en: string, fr: string) => (lang === 'fr' ? fr : en);

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}
