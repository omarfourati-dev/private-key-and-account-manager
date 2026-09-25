/**
 * Datensparsames Umami-Tracking für SecureVault.
 *
 * Das Tracker-Skript läuft mit data-auto-track="false": Es erfasst von sich
 * aus nichts. Seitenaufrufe werden ausschließlich hier gesendet, und zwar nur
 * mit einer festen, neutralen Seitenkategorie und einem festen Titel.
 * Echte Pfade (z. B. /invite/<token>), Query-Parameter (z. B. ?token= beim
 * OAuth-Callback), Tresor-Inhalte, IDs oder E-Mail-Adressen verlassen nie den
 * Browser.
 *
 * Zusätzlich ist sanitizeUmamiPayload als data-before-send-Hook registriert
 * und erzwingt diese Regeln für jede Übertragung des Trackers.
 */

export const NEUTRAL_TITLE = 'SecureVault';

export const PAGE_CATEGORIES = [
  '/',
  '/register',
  '/login',
  '/unlock',
  '/vault',
  '/settings',
  '/downloads',
  '/admin',
] as const;

export type PageCategory = (typeof PAGE_CATEGORIES)[number];

export interface AppViewState {
  pathname: string;
  isSetupComplete: boolean | null;
  hasUser: boolean;
  isLocked: boolean;
  isAuthenticated: boolean;
}

/** Leitet aus dem App-Zustand eine neutrale Kategorie ab, nie aus Nutzerdaten. */
export function pageCategoryFor(state: AppViewState): PageCategory | null {
  const { pathname } = state;
  if (pathname === '/auth/callback') return '/login';
  if (pathname.startsWith('/invite/')) return '/register';
  if (state.isSetupComplete === null) return null; // lädt noch
  if (!state.isSetupComplete) return '/register';
  if (!state.hasUser) return '/login';
  if (state.isLocked) return '/unlock';
  if (!state.isAuthenticated) return '/login';
  if (pathname === '/settings') return '/settings';
  if (pathname === '/downloads') return '/downloads';
  if (pathname === '/admin') return '/admin';
  return '/vault';
}

export interface UmamiPayload {
  website?: string;
  screen?: string;
  language?: string;
  title?: string;
  hostname?: string;
  url?: string;
  referrer?: string;
  [key: string]: unknown;
}

/** Nur Herkunft (Origin) fremder Seiten, eigene Seiten und Pfade entfallen. */
function neutralReferrer(referrer: unknown, ownHostname: unknown): string {
  if (typeof referrer !== 'string' || referrer === '') return '';
  try {
    const url = new URL(referrer);
    if (url.hostname === ownHostname) return '';
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    return url.origin;
  } catch {
    return '';
  }
}

/**
 * Baut die Nutzlast nach Whitelist neu auf. Alles andere (Event-Namen, data,
 * tag, id, echte URL, echter Titel) wird verworfen. Gibt null zurück, wenn es
 * kein Seitenaufruf mit gültiger Kategorie ist; der Tracker sendet dann nichts.
 */
export function sanitizeUmamiPayload(type: string, payload: UmamiPayload | null | undefined): UmamiPayload | null {
  if (type !== 'event' || !payload) return null;
  if (!(PAGE_CATEGORIES as readonly string[]).includes(String(payload.url))) return null;
  if ('name' in payload || 'data' in payload) return null;
  return {
    website: payload.website,
    screen: payload.screen,
    language: payload.language,
    hostname: payload.hostname,
    url: payload.url,
    title: NEUTRAL_TITLE,
    referrer: neutralReferrer(payload.referrer, payload.hostname),
  };
}

interface UmamiApi {
  track: (arg: (props: UmamiPayload) => UmamiPayload) => unknown;
}

declare global {
  interface Window {
    umami?: UmamiApi;
    svUmamiBeforeSend?: typeof sanitizeUmamiPayload;
  }
}

let lastCategory: PageCategory | null = null;

/** Sendet einen Seitenaufruf mit fester Kategorie; doppelte direkt hintereinander entfallen. */
export function trackPageview(category: PageCategory | null): void {
  if (!category || category === lastCategory) return;
  lastCategory = category;
  try {
    window.umami?.track((props) => ({
      website: props.website,
      screen: props.screen,
      language: props.language,
      hostname: props.hostname,
      referrer: props.referrer,
      url: category,
      title: NEUTRAL_TITLE,
    }));
  } catch {
    // Analytics darf die App nie stören.
  }
}

/** Nur für Tests. */
export function resetAnalyticsForTests(): void {
  lastCategory = null;
}

if (typeof window !== 'undefined') {
  window.svUmamiBeforeSend = sanitizeUmamiPayload;
}
