import { Request } from 'express';

/**
 * Kürzt eine IP-Adresse auf Netzbereichsgenauigkeit.
 *
 * Gespeichert wird nur so viel, wie der Nutzer braucht, um eine Sitzung wiederzuerkennen
 * ("war das mein Anschluss zu Hause?") — nicht so viel, dass daraus ein Bewegungsprofil
 * entsteht. IPv4 verliert das letzte Oktett (/24), IPv6 alles ab dem vierten Segment (/48).
 */
export function truncateIp(ip: string | undefined): string | null {
  if (!ip) return null;

  // Express liefert IPv4-Adressen hinter einem Proxy teils als "::ffff:1.2.3.4"
  const normalized = ip.startsWith('::ffff:') ? ip.slice(7) : ip;

  if (normalized.includes('.')) {
    const parts = normalized.split('.');
    if (parts.length !== 4) return null;
    return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
  }

  if (normalized.includes(':')) {
    const segments = normalized.split(':').filter(Boolean);
    if (segments.length === 0) return null;
    return `${segments.slice(0, 3).join(':')}::`;
  }

  return null;
}

export interface SessionMetadata {
  userAgent: string | null;
  ipAddress: string | null;
}

/** Liest User-Agent und gekürzte IP aus dem Request. */
export function getSessionMetadata(req: Request): SessionMetadata {
  const rawUserAgent = req.headers['user-agent'];
  return {
    userAgent: typeof rawUserAgent === 'string' ? rawUserAgent.slice(0, 512) : null,
    ipAddress: truncateIp(req.ip),
  };
}

export type DeviceKind = 'mobile' | 'tablet' | 'desktop' | 'unknown';

export interface ParsedUserAgent {
  device: DeviceKind;
  browser: string;
  os: string;
}

/**
 * Minimaler User-Agent-Parser.
 *
 * Bewusst keine Fremdbibliothek: Der UA-String ist frei wählbar und damit ohnehin nur ein
 * Anhaltspunkt für den Nutzer, keine verlässliche Information. Ein paar Regex genügen.
 */
export function parseUserAgent(ua: string | null | undefined): ParsedUserAgent {
  if (!ua) return { device: 'unknown', browser: 'Unbekannt', os: 'Unbekannt' };

  const isTablet = /iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua);
  const isMobile = !isTablet && /Mobi|iPhone|iPod|Android|Windows Phone/i.test(ua);
  const device: DeviceKind = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop';

  let browser = 'Unbekannt';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Chrome\//i.test(ua)) browser = 'Chrome';
  else if (/Safari\//i.test(ua)) browser = 'Safari';
  else if (/KeyVault/i.test(ua)) browser = 'KeyVault App';

  let os = 'Unbekannt';
  if (/Windows NT 10/i.test(ua)) os = 'Windows';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  return { device, browser, os };
}
