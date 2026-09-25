import { describe, it, expect } from 'vitest';
import { truncateIp, parseUserAgent, getSessionMetadata } from '../src/utils/session';
import type { Request } from 'express';

describe('truncateIp', () => {
  it('kürzt IPv4 auf /24', () => {
    expect(truncateIp('192.168.13.37')).toBe('192.168.13.0');
    expect(truncateIp('8.8.8.8')).toBe('8.8.8.0');
  });

  it('entfernt das IPv4-mapped-IPv6-Präfix', () => {
    expect(truncateIp('::ffff:203.0.113.42')).toBe('203.0.113.0');
  });

  it('kürzt IPv6 auf /48', () => {
    expect(truncateIp('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe('2001:0db8:85a3::');
    expect(truncateIp('fe80::1')).toBe('fe80:1::');
  });

  it('gibt null für fehlende oder unbrauchbare Werte zurück', () => {
    expect(truncateIp(undefined)).toBeNull();
    expect(truncateIp('')).toBeNull();
    expect(truncateIp('kaputt')).toBeNull();
    expect(truncateIp('1.2.3')).toBeNull();
  });

  it('speichert niemals das vollständige letzte IPv4-Oktett', () => {
    for (const ip of ['10.0.0.1', '172.16.254.99', '203.0.113.255']) {
      expect(truncateIp(ip)!.endsWith('.0')).toBe(true);
    }
  });
});

describe('parseUserAgent', () => {
  it('erkennt Desktop-Browser', () => {
    const chrome = parseUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    expect(chrome).toEqual({ device: 'desktop', browser: 'Chrome', os: 'Windows' });

    const firefox = parseUserAgent('Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0');
    expect(firefox.browser).toBe('Firefox');
    expect(firefox.os).toBe('Linux');
  });

  it('unterscheidet Edge und Opera von Chrome', () => {
    expect(parseUserAgent('Mozilla/5.0 (Windows NT 10.0) Chrome/120.0.0.0 Safari/537.36 Edg/120.0').browser).toBe('Edge');
    expect(parseUserAgent('Mozilla/5.0 (Windows NT 10.0) Chrome/120.0.0.0 Safari/537.36 OPR/106.0').browser).toBe('Opera');
  });

  it('erkennt Mobilgeräte', () => {
    const iphone = parseUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1'
    );
    expect(iphone.device).toBe('mobile');
    expect(iphone.os).toBe('iOS');

    const android = parseUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36');
    expect(android.device).toBe('mobile');
    expect(android.os).toBe('Android');
  });

  it('erkennt Tablets', () => {
    expect(parseUserAgent('Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) Safari/604.1').device).toBe('tablet');
    expect(parseUserAgent('Mozilla/5.0 (Linux; Android 14; SM-X200) AppleWebKit/537.36 Safari/537.36').device).toBe('tablet');
  });

  it('kommt mit fehlendem User-Agent zurecht', () => {
    expect(parseUserAgent(null)).toEqual({ device: 'unknown', browser: 'Unbekannt', os: 'Unbekannt' });
    expect(parseUserAgent(undefined).device).toBe('unknown');
    expect(parseUserAgent('').device).toBe('unknown');
  });
});

describe('getSessionMetadata', () => {
  const makeReq = (ua: string | undefined, ip: string | undefined) =>
    ({ headers: ua === undefined ? {} : { 'user-agent': ua }, ip }) as unknown as Request;

  it('liest User-Agent und gekürzte IP', () => {
    const meta = getSessionMetadata(makeReq('Mozilla/5.0 Chrome/120', '192.168.1.55'));
    expect(meta.userAgent).toBe('Mozilla/5.0 Chrome/120');
    expect(meta.ipAddress).toBe('192.168.1.0');
  });

  it('begrenzt überlange User-Agent-Strings', () => {
    const meta = getSessionMetadata(makeReq('x'.repeat(2000), '1.2.3.4'));
    expect(meta.userAgent).toHaveLength(512);
  });

  it('liefert null-Werte statt zu werfen', () => {
    const meta = getSessionMetadata(makeReq(undefined, undefined));
    expect(meta.userAgent).toBeNull();
    expect(meta.ipAddress).toBeNull();
  });
});
