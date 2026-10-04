import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { LANGS, STRINGS } from '../i18n/strings';

const LANG_KEY = 'sd_lang';

const LanguageContext = createContext(null);

const initialLang = () => {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved && STRINGS[saved]) return saved;
  } catch (err) {
    /* storage unavailable */
  }
  return 'en';
};

export const LanguageProvider = ({ children }) => {
  const [lang, setLangState] = useState(initialLang);

  const setLang = useCallback((next) => {
    if (!STRINGS[next]) return;
    setLangState(next);
    try {
      localStorage.setItem(LANG_KEY, next);
    } catch (err) {
      /* persistence is best-effort */
    }
    document.documentElement.lang = next === 'hi' ? 'hi' : next === 'ta' ? 'ta' : 'en';
  }, []);

  const t = useCallback((key) => STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key, [lang]);

  const value = useMemo(() => ({ lang, setLang, t, langs: LANGS }), [lang, setLang, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider');
  return ctx;
};
