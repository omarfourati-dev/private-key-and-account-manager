import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { safeExternalUrl } from '../utils/safeUrl';
import EntryCard from '../components/EntryCard';
import type { Entry } from '../types';

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

describe('safeExternalUrl', () => {
  it.each([
    ['https://example.com/login', 'https://example.com/login'],
    ['http://intranet.local:8080', 'http://intranet.local:8080/'],
    ['  https://example.com  ', 'https://example.com/'],
  ])('lässt %s durch', (input, expected) => {
    expect(safeExternalUrl(input)).toBe(expected);
  });

  it.each([
    'javascript:alert(1)',
    'JavaScript:alert(document.cookie)',
    ' javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'android://abc@com.example.app',
    'example.com',
    '',
    null,
    undefined,
  ])('blockiert %s', (input) => {
    expect(safeExternalUrl(input as string | null | undefined)).toBeNull();
  });
});

describe('EntryCard-Link', () => {
  const baseEntry: Entry = {
    id: 'e1',
    type: 'ACCOUNT',
    name: 'Test',
    icon: '🔑',
    service: null,
    username: null,
    url: null,
    note: null,
    expiresAt: null,
    isFavorite: false,
    lastUsedAt: null,
    encryptedData: 'blob',
    categories: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as unknown as Entry;

  const renderCard = (url: string) =>
    render(
      React.createElement(EntryCard, {
        entry: { ...baseEntry, url },
        masterPassword: 'pw',
        onEdit: vi.fn(),
        onDelete: vi.fn(),
        onDecrypt: vi.fn(),
        onToggleFavorite: vi.fn(),
        onUsed: vi.fn(),
      })
    );

  it('rendert einen Link für https-URLs', () => {
    const { container } = renderCard('https://example.com');
    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).toBe('https://example.com/');
    expect(link?.getAttribute('rel')).toContain('noopener');
  });

  it('rendert keinen Link für javascript:-URLs', () => {
    const { container } = renderCard('javascript:alert(1)');
    expect(container.querySelector('a')).toBeNull();
    expect(screen.queryByText('Öffnen')).toBeNull();
  });
});
