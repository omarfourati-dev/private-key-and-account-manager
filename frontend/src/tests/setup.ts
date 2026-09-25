import '@testing-library/jest-dom';
import { webcrypto } from 'node:crypto';

// Use the real Web Crypto implementation from Node so that crypto-dependent
// modules (crypto.ts, totp.ts) are exercised for real instead of against a stub.
Object.defineProperty(globalThis, 'crypto', {
  value: webcrypto,
  writable: true,
  configurable: true,
});

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
