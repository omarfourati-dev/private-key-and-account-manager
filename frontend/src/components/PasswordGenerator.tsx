import React, { useState, useCallback } from 'react';
import { RefreshCw, Copy, Check } from 'lucide-react';
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
  if (!password) return { score: 0, label: 'Very Weak', color: '#f38ba8' };

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score: 0, label: 'Very Weak', color: '#f38ba8' };
  if (score <= 2) return { score: 1, label: 'Weak', color: '#fab387' };
  if (score <= 3) return { score: 2, label: 'Fair', color: '#f9e2af' };
  if (score <= 4) return { score: 3, label: 'Strong', color: '#a6e3a1' };
  return { score: 4, label: 'Very Strong', color: '#89b4fa' };
}

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

  const toggleOption = (key: keyof typeof options) => {
    if (key === 'customSymbols') return;
    setOptions(prev => {
      const updated = { ...prev, [key]: !prev[key] };
      // Ensure at least one charset is selected
      const hasAny = updated.uppercase || updated.lowercase || updated.numbers || updated.symbols;
      if (!hasAny) return prev;
      const newPwd = generatePassword(length, updated);
      setGenerated(newPwd);
      return updated;
    });
  };

  const handleLengthChange = (newLength: number) => {
    setLength(newLength);
    setGenerated(generatePassword(newLength, options));
  };

  return (
    <div className="space-y-3 p-3 bg-surface rounded-lg">
      <h4 className="text-sm font-medium text-text">Password Generator</h4>

      {/* Generated Password */}
      <div className="flex items-center gap-2 bg-base-100 rounded-lg px-3 py-2">
        <span className="flex-1 font-mono text-sm break-all text-text">{generated}</span>
        <button onClick={regenerate} className="text-text-muted hover:text-text flex-shrink-0" title="Regenerate">
          <RefreshCw className="w-4 h-4" />
        </button>
        <button onClick={() => copy(generated, 'Password')} className="text-text-muted hover:text-text flex-shrink-0" title="Copy">
          <Copy className="w-4 h-4" />
        </button>
      </div>

      {/* Strength indicator */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-text-muted">Strength</span>
          <span style={{ color: strength.color }}>{strength.label}</span>
        </div>
        <div className="flex gap-1">
          {[0, 1, 2, 3, 4].map(i => (
            <div
              key={i}
              className="flex-1 h-1 rounded-full transition-colors"
              style={{ backgroundColor: i <= strength.score ? strength.color : '#313244' }}
            />
          ))}
        </div>
      </div>

      {/* Length slider */}
      <div>
        <div className="flex justify-between text-xs text-text-muted mb-1">
          <span>Length</span>
          <span className="font-mono">{length}</span>
        </div>
        <input
          type="range"
          min={8}
          max={128}
          value={length}
          onChange={e => handleLengthChange(Number(e.target.value))}
          className="w-full accent-primary"
        />
      </div>

      {/* Options */}
      <div className="flex flex-wrap gap-2">
        {(['uppercase', 'lowercase', 'numbers', 'symbols'] as const).map(key => (
          <label key={key} className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={options[key] as boolean}
              onChange={() => toggleOption(key)}
              className="w-3.5 h-3.5 accent-primary"
            />
            <span className="text-xs text-text-muted capitalize">{key}</span>
          </label>
        ))}
      </div>

      {/* Use button */}
      <button
        onClick={() => onUse(generated)}
        className="btn-primary w-full py-1.5 text-sm"
      >
        <Check className="w-3.5 h-3.5" />
        Use This Password
      </button>
    </div>
  );
}
