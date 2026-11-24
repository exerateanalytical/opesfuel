import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DICTS, detectDeviceLang, format, type Lang } from './i18n.shared';

export type { Lang };
const KEY = 'opesfuel_mobile_lang_v1';

interface Ctx { lang: Lang; setLang: (l: Lang) => void; t: (key: string, vars?: Record<string, string | number>) => string }
const LangContext = createContext<Ctx>({ lang: 'fr', setLang: () => {}, t: (k) => k });

export function LangProvider({ children, initial }: { children: React.ReactNode; initial?: Lang }) {
  const [lang, setLangState] = useState<Lang>(initial ?? detectDeviceLang());
  useEffect(() => {
    void AsyncStorage.getItem(KEY).then((v) => { if (v === 'fr' || v === 'en') setLangState(v); }).catch(() => {});
  }, []);
  const setLang = useCallback((l: Lang) => { setLangState(l); void AsyncStorage.setItem(KEY, l).catch(() => {}); }, []);
  const t = useCallback((key: string, vars?: Record<string, string | number>) => format(DICTS[lang][key] ?? DICTS.fr[key] ?? key, vars), [lang]);
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export const useT = () => useContext(LangContext);
