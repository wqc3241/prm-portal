/**
 * Format a number as USD currency.
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
}

/**
 * Format a date string to a human-readable format.
 */
export function formatDate(
  dateStr: string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  });
}

/**
 * Format a date string to include time.
 */
export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format a percentage.
 */
export function formatPercent(value: number | null | undefined): string {
  if (value == null) return '0%';
  return `${value.toFixed(1)}%`;
}

/**
 * Capitalize the first letter and replace underscores with spaces.
 */
export function humanize(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Get user initials from first and last name.
 */
export function getInitials(firstName?: string | null, lastName?: string | null): string {
  const f = firstName?.charAt(0)?.toUpperCase() ?? '';
  const l = lastName?.charAt(0)?.toUpperCase() ?? '';
  return f + l || '?';
}
