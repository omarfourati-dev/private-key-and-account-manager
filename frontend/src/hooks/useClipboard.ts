import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';

export function useClipboard(timeoutMs = 2000): {
  copy: (text: string, label?: string) => Promise<void>;
  isCopied: boolean;
} {
  const [isCopied, setIsCopied] = useState(false);

  const copy = useCallback(async (text: string, label = 'Copied') => {
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      toast.success(`${label} to clipboard`);
      setTimeout(() => setIsCopied(false), timeoutMs);
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
        setIsCopied(true);
        toast.success(`${label} to clipboard`);
        setTimeout(() => setIsCopied(false), timeoutMs);
      } catch {
        toast.error('Failed to copy to clipboard');
      } finally {
        document.body.removeChild(textarea);
      }
    }
  }, [timeoutMs]);

  return { copy, isCopied };
}
