import React, { createContext, useContext, useMemo } from 'react';
import { en, type TranslationKey } from './en';
import { de } from './de';
import type { Locale } from '../types';

const CATALOGS: Record<Locale, Record<TranslationKey, string>> = {
  en: en as unknown as Record<TranslationKey, string>,
  de,
};

export const SUPPORTED_LOCALES: Locale[] = ['de', 'en'];

/** Ermittelt die Startsprache aus der Browser-Einstellung. */
export function detectLocale(): Locale {
  const preferred = typeof navigator !== 'undefined' ? navigator.language : 'de';
  return preferred.toLowerCase().startsWith('en') ? 'en' : 'de';
}

export type TranslateValues = Record<string, string | number>;

/**
 * Übersetzt einen Schlüssel und ersetzt `{platzhalter}`.
 *
 * Plural: Ist `count` gesetzt, wird `<key>_one` bzw. `<key>_other` bevorzugt, sofern
 * vorhanden. Fällt ein Schlüssel ganz aus, wird er selbst zurückgegeben — sichtbar
 * genug, um im Test aufzufallen, aber ohne die Oberfläche zu zerstören.
 */
export function translate(locale: Locale, key: string, values?: TranslateValues): string {
  const catalog = CATALOGS[locale] ?? CATALOGS.de;
  const fallback = CATALOGS.en;

  let lookupKey = key;
  if (values && typeof values['count'] === 'number') {
    const pluralKey = `${key}_${values['count'] === 1 ? 'one' : 'other'}`;
    if (pluralKey in catalog || pluralKey in fallback) lookupKey = pluralKey;
  }

  const template =
    (catalog as Record<string, string>)[lookupKey] ??
    (fallback as Record<string, string>)[lookupKey] ??
    key;

  if (!values) return template;

  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match
  );
}

export interface I18nContextValue {
  locale: Locale;
  t: (key: TranslationKey | string, values?: TranslateValues) => string;
  formatDate: (value: string | Date, options?: Intl.DateTimeFormatOptions) => string;
  formatRelative: (value: string | Date) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['second', 60],
  ['minute', 60],
  ['hour', 24],
  ['day', 30],
  ['month', 12],
  ['year', Infinity],
];

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}): React.ReactElement {
  const value = useMemo<I18nContextValue>(() => ({
    locale,
    t: (key, values) => translate(locale, key, values),
    formatDate: (input, options) =>
      new Intl.DateTimeFormat(locale, options ?? { dateStyle: 'medium' }).format(
        typeof input === 'string' ? new Date(input) : input
      ),
    formatRelative: (input) => {
      const date = typeof input === 'string' ? new Date(input) : input;
      let delta = (date.getTime() - Date.now()) / 1000;
      for (const [unit, step] of RELATIVE_UNITS) {
        if (Math.abs(delta) < step) {
          return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
            Math.round(delta),
            unit
          );
        }
        delta /= step;
      }
      return new Intl.DateTimeFormat(locale).format(date);
    },
  }), [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * Liefert die Übersetzungsfunktionen. Ausserhalb des Providers wird auf Deutsch
 * zurückgefallen, damit einzeln gerenderte Komponenten (Tests) nicht abstürzen.
 */
export function useT(): I18nContextValue {
  const context = useContext(I18nContext);
  if (context) return context;

  return {
    locale: 'de',
    t: (key, values) => translate('de', key, values),
    formatDate: (input) =>
      new Intl.DateTimeFormat('de', { dateStyle: 'medium' }).format(
        typeof input === 'string' ? new Date(input) : input
      ),
    formatRelative: (input) =>
      new Intl.DateTimeFormat('de').format(typeof input === 'string' ? new Date(input) : input),
  };
}
