/**
 * Gibt die URL nur zurück, wenn sie http(s) ist — sonst `null`.
 *
 * Einträge können aus Importen oder älteren Datenständen stammen, die das Backend noch
 * nicht validiert hat. `javascript:`, `data:` & Co. dürfen daher weder in `<a href>` noch
 * in `window.open` landen, unabhängig davon, was in der Datenbank steht.
 */
export function safeExternalUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null;
  } catch {
    return null;
  }
}
