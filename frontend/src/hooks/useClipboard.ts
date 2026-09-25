import { useState, useCallback, useContext } from 'react';
import toast from 'react-hot-toast';
import { AuthContext } from './useAuth';
import { useT } from '../i18n';

/**
 * Globaler Zustand statt Zustand pro Hook-Instanz: Jede Eintragskarte hat ihre eigene
 * useClipboard-Instanz, es gibt aber nur eine Zwischenablage. Ein Timer pro Instanz
 * würde beim Kopieren aus einer zweiten Karte den ersten Timer nicht abräumen.
 */
let clearTimer: ReturnType<typeof setTimeout> | null = null;
let lastWrittenValue: string | null = null;

/**
 * Leert die Zwischenablage, sofern dort noch der von uns geschriebene Wert steht.
 *
 * `readText()` ist nicht überall verfügbar (Firefox kennt es ohne Erweiterung gar nicht,
 * Safari nur nach Nutzergeste). Wo es fehlt, wird trotzdem geleert: Ein zurückgelassenes
 * Passwort in der Zwischenablage wiegt schwerer als ein verlorener fremder Kopiervorgang.
 */
async function clearClipboard(expectedValue: string): Promise<void> {
  try {
    if (typeof navigator.clipboard?.readText === 'function') {
      try {
        const current = await navigator.clipboard.readText();
        if (current !== expectedValue) return; // Nutzer hat inzwischen etwas anderes kopiert
      } catch {
        // Keine Leseberechtigung — konservativ trotzdem leeren
      }
    }
    await navigator.clipboard.writeText('');
  } catch {
    // Zwischenablage nicht erreichbar (z. B. Tab im Hintergrund) — still hinnehmen
  } finally {
    if (lastWrittenValue === expectedValue) lastWrittenValue = null;
  }
}

function scheduleClear(value: string, afterMs: number): void {
  if (clearTimer) clearTimeout(clearTimer);
  lastWrittenValue = value;

  if (afterMs <= 0) {
    clearTimer = null;
    return;
  }

  clearTimer = setTimeout(() => {
    clearTimer = null;
    void clearClipboard(value);
  }, afterMs);
}

/** Nur für Tests: setzt den modulweiten Timer-Zustand zurück. */
export function __resetClipboardState(): void {
  if (clearTimer) clearTimeout(clearTimer);
  clearTimer = null;
  lastWrittenValue = null;
}

const DEFAULT_CLEAR_SECS = 30;

export function useClipboard(timeoutMs = 2000): {
  copy: (text: string, label?: string) => Promise<void>;
  isCopied: boolean;
} {
  const [isCopied, setIsCopied] = useState(false);
  // Bewusst useContext statt useAuth: Der Hook soll auch außerhalb des Providers
  // funktionieren (Tests, öffentliche Seiten) und fällt dann auf den Default zurück.
  const auth = useContext(AuthContext);
  const { t } = useT();
  const clearSecs = auth?.settings?.clipboardClearSecs ?? DEFAULT_CLEAR_SECS;

  const copy = useCallback(async (text: string, label = 'Copied') => {
    const announce = () => {
      setIsCopied(true);
      toast.success(
        clearSecs > 0
          ? t('clipboard.copiedWithClear', { label, seconds: clearSecs })
          : t('clipboard.copied', { label })
      );
      setTimeout(() => setIsCopied(false), timeoutMs);
      scheduleClear(text, clearSecs * 1000);
    };

    try {
      await navigator.clipboard.writeText(text);
      announce();
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      try {
        document.execCommand('copy');
        announce();
      } catch {
        toast.error(t('clipboard.failed'));
      } finally {
        document.body.removeChild(textarea);
      }
    }
  }, [timeoutMs, clearSecs, t]);

  return { copy, isCopied };
}
