import React, { createContext, useContext, useEffect, useMemo } from 'react';
import enUS from '@/i18n/locales/en-US';
import trTR from '@/i18n/locales/tr-TR';
import esES from '@/i18n/locales/es-ES';
import koKR from '@/i18n/locales/ko-KR';
import arSA from '@/i18n/locales/ar-SA';
import ptBR from '@/i18n/locales/pt-BR';
import jaJP from '@/i18n/locales/ja-JP';
import ruRU from '@/i18n/locales/ru-RU';
import deDE from '@/i18n/locales/de-DE';
import frFR from '@/i18n/locales/fr-FR';
import { useUserProfile } from '@/hooks/use-user-profile';
import { setTmdbLocale } from '@/services/tmdb';
import {
  FALLBACK_LOCALE,
  normalizeLocale,
  type SupportedLocale,
} from '@/i18n/config';

export type { SupportedLocale } from '@/i18n/config';

export const supportedLocales: { code: SupportedLocale; labelKey: TranslationKey; nativeName: string }[] = [
  { code: 'tr-TR', labelKey: 'languages.turkish', nativeName: 'Türkçe' },
  { code: 'en-US', labelKey: 'languages.english', nativeName: 'English' },
  { code: 'es-ES', labelKey: 'languages.spanish', nativeName: 'Español' },
  { code: 'ko-KR', labelKey: 'languages.korean', nativeName: '한국어' },
  { code: 'ar-SA', labelKey: 'languages.arabic', nativeName: 'العربية' },
  { code: 'pt-BR', labelKey: 'languages.portuguese', nativeName: 'Português' },
  { code: 'ja-JP', labelKey: 'languages.japanese', nativeName: '日本語' },
  { code: 'ru-RU', labelKey: 'languages.russian', nativeName: 'Русский' },
  { code: 'de-DE', labelKey: 'languages.german', nativeName: 'Deutsch' },
  { code: 'fr-FR', labelKey: 'languages.french', nativeName: 'Français' },
];

const dictionaries = {
  'en-US': enUS,
  'tr-TR': trTR,
  'es-ES': esES,
  'ko-KR': koKR,
  'ar-SA': arSA,
  'pt-BR': ptBR,
  'ja-JP': jaJP,
  'ru-RU': ruRU,
  'de-DE': deDE,
  'fr-FR': frFR,
} satisfies Record<SupportedLocale, typeof enUS>;

type Dictionary = typeof enUS;
type Join<K, P> = K extends string ? (P extends string ? `${K}.${P}` : never) : never;
type Leaves<T> = T extends string
  ? never
  : {
      [K in keyof T]: T[K] extends string ? K & string : Join<K & string, Leaves<T[K]>>;
    }[keyof T];

export type TranslationKey = Leaves<Dictionary>;

interface I18nContextValue {
  locale: SupportedLocale;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  formatDate: (value: string | Date, options?: Intl.DateTimeFormatOptions) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const getNestedValue = (dictionary: Dictionary, key: TranslationKey) =>
  key.split('.').reduce<unknown>((current, part) => {
    if (current && typeof current === 'object' && part in current) {
      return (current as Record<string, unknown>)[part];
    }
    return undefined;
  }, dictionary);

const interpolate = (value: string, params?: Record<string, string | number>) => {
  if (!params) return value;
  return Object.entries(params).reduce(
    (text, [key, replacement]) => text.replaceAll(`{${key}}`, String(replacement)),
    value
  );
};

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useUserProfile();
  const locale = normalizeLocale(profile.language);

  useEffect(() => {
    setTmdbLocale(locale);
  }, [locale]);

  const value = useMemo<I18nContextValue>(() => {
    const dictionary = dictionaries[locale];
    const fallback = dictionaries[FALLBACK_LOCALE];
    return {
      locale,
      t: (key, params) => {
        const translated = getNestedValue(dictionary, key);
        const fallbackValue = getNestedValue(fallback, key);
        const raw = typeof translated === 'string'
          ? translated
          : typeof fallbackValue === 'string'
            ? fallbackValue
            : key;
        return interpolate(raw, params);
      },
      formatDate: (valueToFormat, options) => {
        const date = valueToFormat instanceof Date ? valueToFormat : new Date(valueToFormat);
        if (Number.isNaN(date.getTime())) return String(valueToFormat);
        return date.toLocaleDateString(locale, options);
      },
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used within LanguageProvider');
  return context;
}
