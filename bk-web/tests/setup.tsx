import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { server } from './msw/server';

// Pass-through i18n: t(key, opts) → if `opts` has interpolation values, do a
// minimal {{var}} substitution so tests can assert on rendered text. Otherwise
// return the key — assertions target keys / aria-labels rather than locale text.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (!opts) return key;
      let out = key;
      for (const [k, v] of Object.entries(opts)) {
        out = out.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
      }
      return out;
    },
    i18n: { changeLanguage: () => Promise.resolve(), language: 'vi' },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
  I18nextProvider: ({ children }: { children: React.ReactNode }) => children,
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

// Stub next/image to a plain <img>. The real component requires the Next
// runtime / image optimizer plumbing that doesn't exist under vitest.
vi.mock('next/image', () => ({
  default: ({ src, alt, ...rest }: { src: string; alt?: string }) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt ?? ''} {...rest} />;
  },
}));

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  localStorage.clear();
  sessionStorage.clear();
});
afterAll(() => server.close());

if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

if (typeof window !== 'undefined' && !window.speechSynthesis) {
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: {
      paused: false,
      speaking: false,
      pending: false,
      cancel: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      speak: vi.fn(),
      getVoices: () => [],
      addEventListener: () => {},
      removeEventListener: () => {},
    },
  });
}

if (typeof window !== 'undefined' && !window.SpeechSynthesisUtterance) {
  // jsdom doesn't ship Web Speech APIs; provide a no-op constructor that
  // captures `text` so consumers can introspect it in tests.
  class SSU {
    text: string;
    voice: unknown = null;
    lang = '';
    rate = 1;
    pitch = 1;
    volume = 1;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(text: string) {
      this.text = text;
    }
  }
  Object.defineProperty(window, 'SpeechSynthesisUtterance', {
    configurable: true,
    value: SSU,
  });
}
