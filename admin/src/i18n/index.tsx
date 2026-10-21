import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ru, type TranslationKey } from './dictionaries/ru';
import { uz } from './dictionaries/uz';

export type Lang = 'ru' | 'uz';

/** Сигнатура переводчика — для чистых функций (period.ts, dashboard.ts). */
export type TFunc = (key: TranslationKey, vars?: Record<string, string | number>) => string;

const DICTS: Record<Lang, Record<TranslationKey, string>> = { ru, uz };
const STORAGE_KEY = 'komfort-admin-lang';

interface LangContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: TFunc;
}

const LangContext = createContext<LangContextValue | null>(null);

/** Сохранённый язык или 'ru' по умолчанию. localStorage — это обычное app, не артефакт. */
function readInitialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'ru' || saved === 'uz') return saved;
  } catch {
    // localStorage недоступен (приватный режим и т.п.) — тихо откатываемся на ru.
  }
  return 'ru';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readInitialLang);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // не критично: язык просто не запомнится между сессиями
    }
  }, []);

  const t = useCallback<TFunc>(
    (key, vars) => {
      let text: string = DICTS[lang][key] ?? ru[key] ?? key;
      if (vars) {
        for (const [name, value] of Object.entries(vars)) {
          text = text.split(`{${name}}`).join(String(value));
        }
      }
      return text;
    },
    [lang],
  );

  const value = useMemo<LangContextValue>(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used within LanguageProvider');
  return ctx;
}

/** Короткий доступ к переводчику. */
export function useT(): TFunc {
  return useLang().t;
}
