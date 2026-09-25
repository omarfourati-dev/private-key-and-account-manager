import React, { useEffect, useMemo, useState } from 'react';
import { Copy, ShieldAlert } from 'lucide-react';
import { useClipboard } from '../hooks/useClipboard';
import { useT } from '../i18n';
import { parseOtpAuth, generateTotp, totpTimeRemaining, formatTotpCode, TotpError } from '../utils/totp';

interface TotpCodeProps {
  /** otpauth://-URI oder nacktes Base32-Secret aus dem entschlüsselten Blob */
  otpAuth: string;
  /** Kompakte Darstellung ohne Copy-Button (z. B. in Listen) */
  compact?: boolean;
}

/**
 * Zeigt den laufenden 2FA-Code eines Eintrags mit Ablauf-Ring.
 *
 * Wird nur gerendert, wenn der Eintrag entschlüsselt vorliegt — das Secret selbst
 * verlässt diese Komponente nicht.
 */
export default function TotpCode({ otpAuth, compact = false }: TotpCodeProps): React.ReactElement | null {
  const { copy } = useClipboard();
  const { t } = useT();
  const [code, setCode] = useState<string>('');
  const [remaining, setRemaining] = useState<number>(30);

  const parsed = useMemo(() => {
    try {
      return { config: parseOtpAuth(otpAuth), error: null as TotpError | null };
    } catch (err) {
      return { config: null, error: err as TotpError };
    }
  }, [otpAuth]);

  useEffect(() => {
    if (!parsed.config) return;
    const config = parsed.config;
    let cancelled = false;

    const tick = async () => {
      const now = Date.now();
      const next = await generateTotp(config, now);
      if (!cancelled) {
        setCode(next);
        setRemaining(totpTimeRemaining(config.period, now));
      }
    };

    void tick();
    const interval = setInterval(() => void tick(), 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [parsed.config]);

  if (parsed.error) {
    return (
      <div className="flex items-center gap-2 text-xs text-error/80" title={parsed.error.code}>
        <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
        <span>{t('totp.invalid')}</span>
      </div>
    );
  }

  if (!parsed.config || !code) return null;

  const period = parsed.config.period;
  const isExpiring = remaining <= 5;
  const circumference = 2 * Math.PI * 7;
  const progress = (remaining / period) * circumference;

  return (
    <div className="flex items-center gap-2 bg-surface/60 border border-surface-100/50 rounded-xl px-3 py-2">
      <svg
        className="w-4 h-4 flex-shrink-0 -rotate-90"
        viewBox="0 0 16 16"
        role="img"
        aria-label={t('totp.expiresIn', { seconds: remaining })}
      >
        <circle cx="8" cy="8" r="7" fill="none" strokeWidth="2" className="stroke-surface-200" />
        <circle
          cx="8"
          cy="8"
          r="7"
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          className={isExpiring ? 'stroke-warning' : 'stroke-secondary'}
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>

      <span
        className={`flex-1 font-mono text-sm tracking-widest ${isExpiring ? 'text-warning' : 'text-secondary'}`}
      >
        {formatTotpCode(code)}
      </span>

      {!compact && (
        <>
          <span className="text-[10px] text-text-dim tabular-nums w-5 text-right">{remaining}s</span>
          <button
            onClick={() => void copy(code, t('totp.copied'))}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-secondary hover:bg-surface transition-colors flex-shrink-0"
            title={t('totp.copy')}
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </>
      )}
    </div>
  );
}
