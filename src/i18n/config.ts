export type SupportedLocale =
  | 'tr-TR'
  | 'en-US'
  | 'es-ES'
  | 'ko-KR'
  | 'ar-SA'
  | 'pt-BR'
  | 'ja-JP'
  | 'ru-RU'
  | 'de-DE'
  | 'fr-FR';

export const DEFAULT_LOCALE: SupportedLocale = 'tr-TR';
export const FALLBACK_LOCALE: SupportedLocale = 'en-US';

export const supportedLocaleCodes: SupportedLocale[] = [
  'tr-TR',
  'en-US',
  'es-ES',
  'ko-KR',
  'ar-SA',
  'pt-BR',
  'ja-JP',
  'ru-RU',
  'de-DE',
  'fr-FR',
];

export const isSupportedLocale = (value: unknown): value is SupportedLocale =>
  typeof value === 'string' && supportedLocaleCodes.includes(value as SupportedLocale);

export const normalizeLocale = (value: unknown): SupportedLocale =>
  isSupportedLocale(value) ? value : DEFAULT_LOCALE;
