import { describe, it, expect } from 'vitest';
import { cn, formatDuration, formatPrice } from '@/lib/utils';

// ============================================================
// TDD — Phase 1: Utils Unit Tests
// Red → Green → Refactor
// ============================================================

describe('cn() — Tailwind class merging utility', () => {
  it('returns a single class unchanged', () => {
    expect(cn('text-red-500')).toBe('text-red-500');
  });

  it('merges multiple classes into a single string', () => {
    expect(cn('px-4', 'py-2')).toBe('px-4 py-2');
  });

  it('deduplicates conflicting Tailwind classes (tailwind-merge behavior)', () => {
    // tailwind-merge should resolve conflicts: last one wins
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('handles conditional classes (clsx behavior)', () => {
    const isActive = true;
    const isDisabled = false;
    expect(cn('base-class', isActive && 'active', isDisabled && 'disabled')).toBe(
      'base-class active'
    );
  });

  it('filters out falsy values', () => {
    expect(cn('valid', undefined, null, false, '')).toBe('valid');
  });

  it('handles object syntax from clsx', () => {
    expect(cn({ 'text-white': true, 'text-black': false })).toBe('text-white');
  });
});

describe('formatDuration() — minutes to human-readable string', () => {
  it('formats minutes-only duration correctly', () => {
    expect(formatDuration(45)).toBe('45m');
  });

  it('formats hours and minutes correctly', () => {
    expect(formatDuration(142)).toBe('2h 22m');
  });

  it('formats exactly 60 minutes as 1h 0m', () => {
    expect(formatDuration(60)).toBe('1h 0m');
  });

  it('formats exactly 120 minutes as 2h 0m', () => {
    expect(formatDuration(120)).toBe('2h 0m');
  });
});

describe('formatPrice() — price formatting utility', () => {
  it('formats a whole number price correctly', () => {
    expect(formatPrice(280)).toBe('฿280.00');
  });

  it('formats a decimal price correctly', () => {
    expect(formatPrice(150.5)).toBe('฿150.50');
  });

  it('accepts a custom currency symbol', () => {
    expect(formatPrice(9.99, '$')).toBe('$9.99');
  });

  it('formats zero correctly', () => {
    expect(formatPrice(0)).toBe('฿0.00');
  });
});
