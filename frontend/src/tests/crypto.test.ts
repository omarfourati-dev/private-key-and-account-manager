import { describe, it, expect } from 'vitest';

// Test pure utility functions that don't require DOM or crypto
describe('Utility Functions', () => {
  it('should validate password strength criteria', () => {
    const hasUppercase = (s: string) => /[A-Z]/.test(s);
    const hasLowercase = (s: string) => /[a-z]/.test(s);
    const hasNumber = (s: string) => /\d/.test(s);
    const hasSpecial = (s: string) => /[!@#$%^&*()_+\-=[\]{}|;':",./<>?]/.test(s);

    const weakPw = 'password';
    expect(hasUppercase(weakPw)).toBe(false);
    expect(hasLowercase(weakPw)).toBe(true);
    expect(hasNumber(weakPw)).toBe(false);
    expect(hasSpecial(weakPw)).toBe(false);

    const strongPw = 'P@ssw0rd!123';
    expect(hasUppercase(strongPw)).toBe(true);
    expect(hasLowercase(strongPw)).toBe(true);
    expect(hasNumber(strongPw)).toBe(true);
    expect(hasSpecial(strongPw)).toBe(true);
  });

  it('should calculate password strength score correctly', () => {
    const getScore = (pw: string): number => {
      let score = 0;
      if (pw.length >= 8) score++;
      if (pw.length >= 16) score++;
      if (/[A-Z]/.test(pw)) score++;
      if (/[a-z]/.test(pw)) score++;
      if (/\d/.test(pw)) score++;
      if (/[^A-Za-z0-9]/.test(pw)) score++;
      return score;
    };

    expect(getScore('pass')).toBeLessThan(3);
    expect(getScore('password123')).toBeGreaterThanOrEqual(3);
    expect(getScore('P@ssw0rd!Xyz#2024')).toBeGreaterThanOrEqual(5);
  });

  it('should generate password with correct length', () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const generate = (length: number) =>
      Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

    expect(generate(12).length).toBe(12);
    expect(generate(32).length).toBe(32);
    expect(generate(64).length).toBe(64);
  });

  it('should properly format masked values', () => {
    const mask = (value: string) => '•'.repeat(Math.min(value.length, 12));
    expect(mask('my-api-key')).toBe('••••••••••');
    expect(mask('short')).toBe('•••••');
    expect(mask('a-very-long-api-key-that-is-too-long')).toBe('••••••••••••');
  });

  it('should validate email format', () => {
    const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('user@domain.io')).toBe(true);
    expect(isValidEmail('invalid-email')).toBe(false);
    expect(isValidEmail('@nodomain.com')).toBe(false);
    expect(isValidEmail('user@')).toBe(false);
  });

  it('should correctly identify expiration status', () => {
    const now = new Date();
    const past = new Date(now.getTime() - 86400000).toISOString();
    const future = new Date(now.getTime() + 86400000).toISOString();
    const soonDate = new Date(now.getTime() + 20 * 86400000).toISOString();

    const isExpired = (date: string) => new Date(date) < now;
    const isExpiringSoon = (date: string) => {
      const d = new Date(date);
      return d > now && d < new Date(now.getTime() + 30 * 86400000);
    };

    expect(isExpired(past)).toBe(true);
    expect(isExpired(future)).toBe(false);
    expect(isExpiringSoon(soonDate)).toBe(true);
    expect(isExpiringSoon(past)).toBe(false);
  });
});
