import type { ClassValue } from 'clsx';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility for merging Tailwind CSS class names.
 * Combines clsx for conditional classes and tailwind-merge for deduplication.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Format a duration in minutes to a human-readable string.
 * Example: 142 → "2h 22m"
 */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * Format a price (number) to a currency string.
 * Example: 280 → "฿280.00"
 */
export function formatPrice(amount: number, currency = '฿'): string {
  return `${currency}${amount.toFixed(2)}`;
}
