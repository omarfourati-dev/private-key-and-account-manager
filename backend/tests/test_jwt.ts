import { describe, it, expect } from 'vitest';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  getRefreshTokenExpiry,
} from '../src/utils/jwt';

describe('JWT utilities', () => {
  const payload = { userId: 'user-123', email: 'test@example.com' };

  describe('generateAccessToken', () => {
    it('generates a valid JWT string', () => {
      const token = generateAccessToken(payload);
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });
  });

  describe('verifyAccessToken', () => {
    it('verifies a valid access token and returns payload', () => {
      const token = generateAccessToken(payload);
      const decoded = verifyAccessToken(token);
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
    });

    it('throws on invalid token', () => {
      expect(() => verifyAccessToken('invalid.token.here')).toThrow();
    });

    it('throws on empty string', () => {
      expect(() => verifyAccessToken('')).toThrow();
    });

    it('throws on tampered token', () => {
      const token = generateAccessToken(payload);
      const tampered = token.slice(0, -5) + 'XXXXX';
      expect(() => verifyAccessToken(tampered)).toThrow();
    });
  });

  describe('generateRefreshToken', () => {
    it('generates token and jti', () => {
      const { token, jti } = generateRefreshToken(payload);
      expect(typeof token).toBe('string');
      expect(typeof jti).toBe('string');
      expect(jti).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('generates unique jtis for each call', () => {
      const { jti: jti1 } = generateRefreshToken(payload);
      const { jti: jti2 } = generateRefreshToken(payload);
      expect(jti1).not.toBe(jti2);
    });
  });

  describe('verifyRefreshToken', () => {
    it('verifies valid refresh token', () => {
      const { token } = generateRefreshToken(payload);
      const decoded = verifyRefreshToken(token);
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.jti).toBeDefined();
    });

    it('throws on invalid token', () => {
      expect(() => verifyRefreshToken('bad.token.here')).toThrow();
    });
  });

  describe('getRefreshTokenExpiry', () => {
    it('returns a date ~30 days in the future', () => {
      const expiry = getRefreshTokenExpiry();
      const now = new Date();
      const diff = expiry.getTime() - now.getTime();
      const days = diff / (1000 * 60 * 60 * 24);
      expect(days).toBeGreaterThan(29);
      expect(days).toBeLessThan(31);
    });
  });
});
