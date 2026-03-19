import { clsx, type ClassValue } from 'clsx';

/**
 * Utility for conditionally joining class names.
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
