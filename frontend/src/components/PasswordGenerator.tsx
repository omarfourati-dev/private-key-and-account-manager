import React, { useState, useCallback } from 'react';
import { RefreshCw, Copy } from 'lucide-react';
import { useClipboard } from '../hooks/useClipboard';
import type { PasswordStrength } from '../types';

interface PasswordGeneratorProps {
  onUse: (password: string) => void;
}

const CHARS = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
};

function generatePassword(
  length: number,
  options: { uppercase: boolean; lowercase: boolean; numbers: boolean; symbols: boolean; customSymbols: string }
): string {
  let charset = '';
  if (options.uppercase) charset += CHARS.uppercase;
  if (options.lowercase) charset += CHARS.lowercase;
  if (options.numbers) charset += CHARS.numbers;
  if (options.symbols) charset += options.customSymbols || CHARS.symbols;
  if (!charset) return '';
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, v => charset[v % charset.length]).join('');
}

function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return { score: 0, label: 'Very Weak', color: '#f87171' };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 1) return { score: 0, label: 'Very Weak', color: '#f87171' };
  if (score <= 2) return { score: 1, label: 'Weak', color: '#fbbf24' };
  if (score <= 3) return { score: 2, label: 'Fair', color: '#facc15' };
  if (score <= 4) return { score: 3, label: 'Strong', color: '#34d399' };
  return { score: 4, label: 'Very Strong', color: '#38bdf8' };
}

const OPTION_LABELS: Record<string, string> = {
  uppercase: 'A–Z',
  lowercase: 'a–z',
  numbers: '0–9',
  symbols: '!@#',
};

export default function PasswordGenerator({ onUse }: PasswordGeneratorProps): React.ReactElement {
  const { copy } = useClipboard();
  const [length, setLength] = useState(24);
  const [options, setOptions] = useState({
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true,
    customSymbols: CHARS.symbols,
  });
  const [generated, setGenerated] = useState(() => generatePassword(24, {
    uppercase: true, lowercase: true, numbers: true, symbols: true, customSymbols: CHARS.symbols,
  }));

  const regenerate = useCallback(() => {
    setGenerated(generatePassword(length, options));
  }, [length, options]);

  const strength = getPasswordStrength(generated);

  const toggleOption = (key: 'uppercase' | 'lowercase' | 'numbers' | 'symbols') => {
    setOptions(prev => {
      const updated = { ...prev, [key]: !prev[key] };
      const hasAny = updated.uppercase || updated.lowercase || updated.numbers || updated.symbols;
      if (!hasAny) return prev;
      setGenerated(generatePassword(length, updated));
      return updated;
    });
  };

  const handleLengthChange = (newLength: number) => {
    setLength(newLength);
    setGenerated(generatePassword(newLength, options));
  };

  return (
    <div className="space-y-3 p-3 rounded-xl border border-surface bg-base-100/60 animate-slide-down">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wide">Generator</h4>
        <button
          onClick={regenerate}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-primary hover:bg-surface transition-colors"
          title="Regenerate"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Generated password display */}
      <div className="flex items-center gap-2 bg-surface rounded-xl px-3 py-2.5">
        <span className="flex-1 font-mono text-xs break-all text-text leading-relaxed">{generated}</span>
        <button
          onClick={() => copy(generated, 'Password')}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text hover:bg-surface-100 transition-colors flex-shrink-0"
          title="Copy"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Strength bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-text-muted">Strength</span>
          <span className="font-medium" style={{ color: strength.color }}>{strength.label}</span>
        </div>
        <div className="flex gap-1">
          {[0, 1, 2, 3, 4].map(i => (
            <div
              key={i}
              className="flex-1 h-1.5 rounded-full transition-all duration-300"
              style={{ backgroundColor: i <= strength.score ? strength.color : 'rgba(255,255,255,0.06)' }}
            />
          ))}
        </div>
      </div>

      {/* Length slider */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-text-muted">Length</span>
          <span className="font-mono text-sm font-semibold text-text bg-surface px-2 py-0.5 rounded-md">{length}</span>
        </div>
        <input
          type="range"
          min={8}
          max={128}
          value={length}
          onChange={e => handleLengthChange(Number(e.target.value))}
          className="w-full h-1.5 accent-primary"
          style={{ cursor: 'pointer' }}
        />
        <div className="flex justify-between text-[10px] text-text-dim mt-1">
          <span>8</span>
          <span>128</span>
        </div>
      </div>

      {/* Character options — large tap targets */}
      <div className="grid grid-cols-4 gap-1.5">
        {(['uppercase', 'lowercase', 'numbers', 'symbols'] as const).map(key => (
          <button
            key={key}
            type="button"
            onClick={() => toggleOption(key)}
            className={`h-9 rounded-lg text-xs font-medium transition-all border ${
              options[key]
                ? 'bg-primary/20 text-primary border-primary/30'
                : 'bg-surface text-text-dim border-transparent hover:border-surface-200'
            }`}
          >
            {OPTION_LABELS[key]}
          </button>
        ))}
      </div>

      {/* Use button */}
      <button
        type="button"
        onClick={() => onUse(generated)}
        className="btn-primary w-full h-11 text-sm"
      >
        Use This Password
      </button>
    </div>
  );
}
