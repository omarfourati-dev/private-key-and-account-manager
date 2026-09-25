import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import Layout from '../components/Layout';
import { AuthContext, type AuthContextValue } from '../hooks/useAuth';
import { pageCategoryFor, PAGE_CATEGORIES } from '../utils/analytics';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

function authState(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    user: null,
    isAuthenticated: false,
    isLocked: false,
    isSetupComplete: true,
    masterPassword: null,
    settings: { id: 's', autoLockMins: 15, theme: 'dark', clipboardClearSecs: 30, locale: 'de' },
    login: vi.fn(),
    setup: vi.fn(),
    loginWithOAuthToken: vi.fn(),
    logout: vi.fn(),
    lock: vi.fn(),
    unlock: vi.fn(),
    updateSettings: vi.fn(),
    refreshSettings: vi.fn(),
    ...overrides,
  };
}

function renderAt(path: string, auth: AuthContextValue = authState()) {
  window.history.replaceState({}, '', path);
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

function expectLegalLinks() {
  expect(screen.getByRole('link', { name: 'Impressum' }).getAttribute('href')).toBe('/impressum');
  expect(screen.getByRole('link', { name: 'Datenschutz' }).getAttribute('href')).toBe('/datenschutz');
}

describe('Rechtstexte', () => {
  afterEach(() => {
    cleanup();
    document.head.querySelectorAll('meta[name="robots"]').forEach(m => m.remove());
  });

  it('zeigt das Impressum ohne Anmeldung mit den Betreiberangaben', () => {
    renderAt('/impressum');
    expect(screen.getByRole('heading', { level: 1, name: 'Impressum' })).toBeTruthy();
    expect(screen.getByText(/Angaben gemäß § 5 DDG/)).toBeTruthy();
    expect(screen.getAllByText(/Am Sandberg 28/).length).toBeGreaterThan(0);
  });

  it('zeigt die Datenschutzerklärung ohne Anmeldung', () => {
    renderAt('/datenschutz');
    expect(screen.getByRole('heading', { level: 1, name: 'Datenschutz' })).toBeTruthy();
    expect(screen.getByText(/Landesbeauftragten für Datenschutz und Informationsfreiheit Nordrhein-Westfalen/)).toBeTruthy();
    expect(screen.getByText('refresh_token')).toBeTruthy();
    expect(screen.getByText('oauth_state')).toBeTruthy();
  });

  it('ist auch bei gesperrtem Tresor erreichbar', () => {
    renderAt('/datenschutz', authState({ isLocked: true, user: { id: 'u', email: 'a@b.c' } as never }));
    expect(screen.getByRole('heading', { level: 1, name: 'Datenschutz' })).toBeTruthy();
  });

  it('setzt noindex, solange die Seite angezeigt wird', () => {
    const { unmount } = renderAt('/impressum');
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex');
    unmount();
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
  });

  it('verlinkt Impressum und Datenschutz auf der Login-Seite', () => {
    renderAt('/');
    expect(screen.getByRole('button', { name: /unlock vault/i })).toBeTruthy();
    expectLegalLinks();
  });

  it('verlinkt Impressum und Datenschutz auf der Registrierungsseite', () => {
    renderAt('/', authState({ isSetupComplete: false }));
    expectLegalLinks();
  });

  it('verlinkt Impressum und Datenschutz auf der Einladungsseite', () => {
    renderAt('/invite/abc');
    expectLegalLinks();
  });

  it('verlinkt Impressum und Datenschutz im Footer der App', () => {
    render(
      <AuthContext.Provider value={authState({ isAuthenticated: true, user: { id: 'u', email: 'a@b.c', isAdmin: false } as never })}>
        <MemoryRouter initialEntries={['/']}>
          <Layout><p>Inhalt</p></Layout>
        </MemoryRouter>
      </AuthContext.Provider>
    );
    expectLegalLinks();
  });

  it('meldet an Umami nur die neutrale Kategorie /legal', () => {
    const base = { isSetupComplete: true, hasUser: false, isLocked: false, isAuthenticated: false };
    expect(pageCategoryFor({ ...base, pathname: '/impressum' })).toBe('/legal');
    expect(pageCategoryFor({ ...base, pathname: '/datenschutz' })).toBe('/legal');
    expect(PAGE_CATEGORIES).toContain('/legal');
  });
});
