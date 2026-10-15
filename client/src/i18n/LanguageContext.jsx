import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

// The citizen pages can be read in English, Filipino or Bisaya (Cebuano, widely
// understood in Cantilan). The choice is remembered on this device. Staff and admin
// pages stay in English.
export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fil', label: 'Filipino' },
  { code: 'ceb', label: 'Bisaya' },
];
const STORAGE_KEY = 'civix_lang';

const LanguageContext = createContext({ lang: 'en', setLang: () => {} });

function savedLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return LANGUAGES.some(l => l.code === saved) ? saved : 'en';
  } catch {
    return 'en';
  }
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(savedLanguage);
  const setLang = useCallback(code => {
    setLangState(code);
    try { localStorage.setItem(STORAGE_KEY, code); } catch { /* storage unavailable */ }
  }, []);
  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLang() {
  return useContext(LanguageContext);
}

// The wording for the current language from a { en, fil, ceb } table. Anything a
// language doesn't have falls back to English. Entries may be functions, for
// wording with numbers or names in it.
export function useText(table) {
  const { lang } = useLang();
  return useMemo(() => ({ ...table.en, ...(table[lang] || {}) }), [table, lang]);
}
