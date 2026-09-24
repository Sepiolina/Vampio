import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { SupportedLocale, TranslationDictionary, TranslationKey, SUPPORTED_LOCALES, LocaleInfo } from './types';
import { en } from './locales/en';
import { th } from './locales/th';
import { ja } from './locales/ja';
import { zh } from './locales/zh';
import { es } from './locales/es';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';

export * from './types';

const TRANSLATIONS: Record<SupportedLocale, TranslationDictionary> = {
  en,
  th,
  ja,
  zh,
  es,
};

interface I18nContextType {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  t: (key: TranslationKey | string, params?: Record<string, string | number>) => string;
  currentLocaleInfo: LocaleInfo;
  availableLocales: LocaleInfo[];
}

const I18nContext = createContext<I18nContextType | null>(null);

const STORAGE_KEY = 'vampio-locale';

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<SupportedLocale>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY) as SupportedLocale;
      if (saved && TRANSLATIONS[saved]) {
        return saved;
      }
      const navLang = navigator.language.slice(0, 2);
      if (navLang in TRANSLATIONS) {
        return navLang as SupportedLocale;
      }
    }
    return 'en';
  });

  const setLocale = useCallback((newLocale: SupportedLocale) => {
    setLocaleState(newLocale);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, newLocale);
      document.documentElement.lang = newLocale;
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const t = useCallback(
    (key: TranslationKey | string, params?: Record<string, string | number>): string => {
      const dict = TRANSLATIONS[locale] || TRANSLATIONS.en;
      const keys = key.split('.');

      let value: unknown = dict;
      for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
          value = (value as Record<string, unknown>)[k];
        } else {
          // Fallback to English
          let fallback: unknown = TRANSLATIONS.en;
          for (const fbKey of keys) {
            if (fallback && typeof fallback === 'object' && fbKey in fallback) {
              fallback = (fallback as Record<string, unknown>)[fbKey];
            } else {
              fallback = undefined;
              break;
            }
          }
          value = fallback || key;
          break;
        }
      }

      if (typeof value !== 'string') {
        return key;
      }

      if (params) {
        return Object.entries(params).reduce((str, [paramKey, paramValue]) => {
          return str.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue));
        }, value);
      }

      return value;
    },
    [locale]
  );

  const currentLocaleInfo = useMemo(() => {
    return SUPPORTED_LOCALES.find((l) => l.code === locale) || SUPPORTED_LOCALES[0];
  }, [locale]);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
      currentLocaleInfo,
      availableLocales: SUPPORTED_LOCALES,
    }),
    [locale, setLocale, t, currentLocaleInfo]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};

/**
 * Reusable Language Selector Dropdown Component
 */
export const LanguageSelectDropdown: React.FC<{ className?: string; compact?: boolean }> = ({
  className,
  compact = false,
}) => {
  const { locale, setLocale, currentLocaleInfo, availableLocales } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div ref={dropdownRef} className={cn('relative inline-block text-left', className)}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary hover:bg-tertiary border border-border-subtle text-content text-xs font-semibold transition shadow-xs cursor-pointer"
        title="Change Language"
      >
        <span className="text-sm leading-none">{currentLocaleInfo.flag}</span>
        {!compact && (
          <span className="truncate max-w-[80px] font-sans text-xs">
            {currentLocaleInfo.nativeName}
          </span>
        )}
        <ChevronDown
          size={12}
          className={cn('text-content-muted transition-transform duration-150', isOpen && 'rotate-180 text-accent')}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 w-44 bg-secondary border border-border-subtle rounded-xl shadow-xl z-50 p-1 space-y-0.5 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100">
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-content-muted border-b border-border-subtle/50 mb-1 flex items-center gap-1.5">
            <Globe size={11} className="text-accent" />
            <span>Select Language</span>
          </div>
          {availableLocales.map((item) => {
            const isSelected = item.code === locale;
            return (
              <button
                key={item.code}
                type="button"
                onClick={() => {
                  setLocale(item.code);
                  setIsOpen(false);
                }}
                className={cn(
                  'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left text-xs transition cursor-pointer',
                  isSelected
                    ? 'bg-accent text-white font-semibold shadow-xs'
                    : 'text-content hover:bg-primary'
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm leading-none">{item.flag}</span>
                  <div>
                    <div className="leading-tight">{item.nativeName}</div>
                    <div className={cn('text-[10px]', isSelected ? 'text-white/80' : 'text-content-muted')}>
                      {item.name}
                    </div>
                  </div>
                </div>
                {isSelected && <Check size={13} className="text-white font-bold" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
