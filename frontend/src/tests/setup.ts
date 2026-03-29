import '@testing-library/jest-dom';

// Mock Web Crypto API for tests
Object.defineProperty(globalThis, 'crypto', {
  value: {
    getRandomValues: (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
    subtle: {
      importKey: async () => ({ type: 'secret' }),
      deriveKey: async () => ({ type: 'secret' }),
      encrypt: async (_algo: unknown, _key: unknown, data: ArrayBuffer) => data,
      decrypt: async (_algo: unknown, _key: unknown, data: ArrayBuffer) => data,
    },
  },
  writable: true,
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
