import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useClipboard, __resetClipboardState } from '../hooks/useClipboard';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

interface ClipboardStub {
  value: string;
  writeText: ReturnType<typeof vi.fn>;
  readText: ReturnType<typeof vi.fn>;
}

function installClipboard(withReadText: boolean): ClipboardStub {
  const stub: ClipboardStub = {
    value: '',
    writeText: vi.fn(),
    readText: vi.fn(),
  };
  stub.writeText.mockImplementation(async (text: string) => {
    stub.value = text;
  });
  stub.readText.mockImplementation(async () => stub.value);

  Object.defineProperty(navigator, 'clipboard', {
    value: withReadText
      ? { writeText: stub.writeText, readText: stub.readText }
      : { writeText: stub.writeText },
    configurable: true,
    writable: true,
  });

  return stub;
}

describe('useClipboard — automatisches Leeren', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    __resetClipboardState();
  });

  afterEach(() => {
    vi.useRealTimers();
    __resetClipboardState();
  });

  it('leert die Zwischenablage nach Ablauf der Frist', async () => {
    const clipboard = installClipboard(true);
    const { result } = renderHook(() => useClipboard());

    await act(async () => {
      await result.current.copy('geheimes-passwort', 'Passwort');
    });
    expect(clipboard.value).toBe('geheimes-passwort');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(clipboard.value).toBe('');
  });

  it('leert nicht vorzeitig', async () => {
    const clipboard = installClipboard(true);
    const { result } = renderHook(() => useClipboard());

    await act(async () => {
      await result.current.copy('geheimes-passwort');
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(29_000);
    });
    expect(clipboard.value).toBe('geheimes-passwort');
  });

  it('lässt fremd kopierten Inhalt unangetastet', async () => {
    const clipboard = installClipboard(true);
    const { result } = renderHook(() => useClipboard());

    await act(async () => {
      await result.current.copy('geheimes-passwort');
    });

    // Der Nutzer kopiert zwischenzeitlich etwas anderes außerhalb der App
    clipboard.value = 'einkaufsliste';

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(clipboard.value).toBe('einkaufsliste');
  });

  it('leert auch ohne readText-Unterstützung', async () => {
    const clipboard = installClipboard(false);
    const { result } = renderHook(() => useClipboard());

    await act(async () => {
      await result.current.copy('geheimes-passwort');
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(clipboard.value).toBe('');
  });

  it('setzt den Timer bei erneutem Kopieren zurück, statt einen zweiten zu starten', async () => {
    const clipboard = installClipboard(true);
    const { result } = renderHook(() => useClipboard());

    await act(async () => {
      await result.current.copy('erstes-secret');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
      await result.current.copy('zweites-secret');
    });

    // Der erste Timer hätte hier gefeuert — darf das zweite Secret aber nicht löschen
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(clipboard.value).toBe('zweites-secret');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(clipboard.value).toBe('');
  });
});
