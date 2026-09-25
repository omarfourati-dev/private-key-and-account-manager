import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  NEUTRAL_TITLE,
  PAGE_CATEGORIES,
  pageCategoryFor,
  resetAnalyticsForTests,
  sanitizeUmamiPayload,
  trackPageview,
  type AppViewState,
  type UmamiPayload,
} from '../utils/analytics';

const loggedIn: AppViewState = {
  pathname: '/',
  isSetupComplete: true,
  hasUser: true,
  isLocked: false,
  isAuthenticated: true,
};

describe('pageCategoryFor', () => {
  it('liefert für Einladungslinks nie den Token im Pfad', () => {
    expect(pageCategoryFor({ ...loggedIn, pathname: '/invite/geheimer-einladungstoken-123' })).toBe('/register');
  });

  it('bildet den OAuth-Callback neutral ab', () => {
    expect(pageCategoryFor({ ...loggedIn, pathname: '/auth/callback' })).toBe('/login');
  });

  it('unterscheidet Zustände statt Pfade', () => {
    expect(pageCategoryFor({ ...loggedIn, isSetupComplete: null })).toBeNull();
    expect(pageCategoryFor({ ...loggedIn, isSetupComplete: false })).toBe('/register');
    expect(pageCategoryFor({ ...loggedIn, hasUser: false, isAuthenticated: false })).toBe('/login');
    expect(pageCategoryFor({ ...loggedIn, isLocked: true, isAuthenticated: false })).toBe('/unlock');
    expect(pageCategoryFor({ ...loggedIn, pathname: '/settings' })).toBe('/settings');
    expect(pageCategoryFor({ ...loggedIn, pathname: '/downloads' })).toBe('/downloads');
    expect(pageCategoryFor({ ...loggedIn, pathname: '/admin' })).toBe('/admin');
    expect(pageCategoryFor(loggedIn)).toBe('/vault');
  });

  it('fasst unbekannte Pfade als /vault zusammen', () => {
    expect(pageCategoryFor({ ...loggedIn, pathname: '/entry/3f2a-uuid/user@example.com' })).toBe('/vault');
  });

  it('lässt nicht angemeldete Besucher auf beliebigen Pfaden als /login erscheinen', () => {
    expect(
      pageCategoryFor({ ...loggedIn, pathname: '/settings', hasUser: false, isAuthenticated: false }),
    ).toBe('/login');
  });
});

describe('sanitizeUmamiPayload', () => {
  const base: UmamiPayload = {
    website: 'site-id',
    screen: '1920x1080',
    language: 'de-DE',
    hostname: 'securevault.omarfourati.de',
    url: '/vault',
    title: 'Mein Bankkonto – max@example.com',
    referrer: 'https://mail.example.org/inbox/12345?q=secret',
  };

  it('erzwingt festen Titel und kürzt den Referrer auf die Herkunft', () => {
    expect(sanitizeUmamiPayload('event', base)).toEqual({
      website: 'site-id',
      screen: '1920x1080',
      language: 'de-DE',
      hostname: 'securevault.omarfourati.de',
      url: '/vault',
      title: NEUTRAL_TITLE,
      referrer: 'https://mail.example.org',
    });
  });

  it('verwirft eigene Seiten als Referrer', () => {
    const result = sanitizeUmamiPayload('event', {
      ...base,
      referrer: 'https://securevault.omarfourati.de/invite/token',
    });
    expect(result?.referrer).toBe('');
  });

  it('blockiert echte URLs statt Kategorien', () => {
    expect(sanitizeUmamiPayload('event', { ...base, url: 'https://securevault.omarfourati.de/invite/abc' })).toBeNull();
    expect(sanitizeUmamiPayload('event', { ...base, url: '/auth/callback?token=abc' })).toBeNull();
  });

  it('blockiert Custom-Events, identify und Performance-Daten', () => {
    expect(sanitizeUmamiPayload('event', { ...base, name: 'copy-password', data: { entry: 'x' } })).toBeNull();
    expect(sanitizeUmamiPayload('identify', base)).toBeNull();
    expect(sanitizeUmamiPayload('performance', base)).toBeNull();
    expect(sanitizeUmamiPayload('event', null)).toBeNull();
  });

  it('übernimmt keine unbekannten Felder', () => {
    const result = sanitizeUmamiPayload('event', { ...base, tag: 'x', id: 'user@example.com' });
    expect(result).not.toHaveProperty('tag');
    expect(result).not.toHaveProperty('id');
  });

  it('akzeptiert alle definierten Kategorien', () => {
    for (const url of PAGE_CATEGORIES) {
      expect(sanitizeUmamiPayload('event', { ...base, url })?.url).toBe(url);
    }
  });

  it('ist als globaler before-send-Hook registriert', () => {
    expect(window.svUmamiBeforeSend).toBe(sanitizeUmamiPayload);
  });
});

describe('trackPageview', () => {
  const track = vi.fn();

  beforeEach(() => {
    resetAnalyticsForTests();
    track.mockReset();
    window.umami = { track };
  });

  afterEach(() => {
    delete window.umami;
  });

  it('ersetzt URL und Titel durch neutrale Werte', () => {
    trackPageview('/vault');
    expect(track).toHaveBeenCalledTimes(1);
    const build = track.mock.calls[0][0] as (p: UmamiPayload) => UmamiPayload;
    const sent = build({
      website: 'site-id',
      hostname: 'securevault.omarfourati.de',
      url: 'https://securevault.omarfourati.de/invite/geheim',
      title: 'Eintrag: Bank',
      referrer: '',
      tag: 'x',
    });
    expect(sent.url).toBe('/vault');
    expect(sent.title).toBe(NEUTRAL_TITLE);
    expect(sent).not.toHaveProperty('tag');
    expect(JSON.stringify(sent)).not.toContain('geheim');
    expect(JSON.stringify(sent)).not.toContain('Bank');
  });

  it('sendet nichts ohne Kategorie und keine direkten Duplikate', () => {
    trackPageview(null);
    trackPageview('/login');
    trackPageview('/login');
    trackPageview('/vault');
    expect(track).toHaveBeenCalledTimes(2);
  });

  it('bleibt ohne geladenen Tracker still', () => {
    delete window.umami;
    expect(() => trackPageview('/vault')).not.toThrow();
  });
});

describe('Tracker-Einbindung in index.html', () => {
  const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf-8');
  const tag = html.match(/<script[^>]*analytics\.omarfourati\.de\/s\.js[^>]*>/s)?.[0] ?? '';

  it('enthält alle Schutz-Attribute', () => {
    expect(tag).toMatch(/integrity="sha384-[A-Za-z0-9+/=]+"/);
    for (const attr of [
      'crossorigin="anonymous"',
      'defer',
      'data-website-id="9cbe11c3-10c0-44ab-b426-2d714dd9fac1"',
      'data-domains="securevault.omarfourati.de"',
      'data-do-not-track="true"',
      'data-exclude-search="true"',
      'data-exclude-hash="true"',
      'data-auto-track="false"',
      'data-before-send="svUmamiBeforeSend"',
    ]) {
      expect(tag).toContain(attr);
    }
  });
});
