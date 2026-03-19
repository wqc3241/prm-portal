export const CHART_COLORS = [
  '#3B82F6', // blue-500
  '#22C55E', // green-500
  '#F59E0B', // amber-500
  '#EF4444', // red-500
  '#A855F7', // purple-500
  '#06B6D4', // cyan-500
  '#F97316', // orange-500
  '#EC4899', // pink-500
  '#14B8A6', // teal-500
  '#6366F1', // indigo-500
];

export const DEAL_STATUS_COLORS: Record<string, string> = {
  draft: '#94A3B8',
  submitted: '#3B82F6',
  under_review: '#F59E0B',
  approved: '#22C55E',
  won: '#059669',
  lost: '#EF4444',
  rejected: '#F97316',
  expired: '#64748B',
};

export const MDF_COLORS = {
  approved: '#3B82F6',
  claimed: '#F59E0B',
  remaining: '#E2E8F0',
  reimbursed: '#22C55E',
};

export const HEALTH_SCORE_COLORS = {
  critical: '#EF4444',
  warning: '#F59E0B',
  good: '#3B82F6',
  excellent: '#22C55E',
};

export function getHealthScoreColor(score: number): string {
  if (score <= 40) return HEALTH_SCORE_COLORS.critical;
  if (score <= 60) return HEALTH_SCORE_COLORS.warning;
  if (score <= 80) return HEALTH_SCORE_COLORS.good;
  return HEALTH_SCORE_COLORS.excellent;
}

export function getHealthScoreBg(score: number): string {
  if (score <= 40) return 'bg-red-100 text-red-800';
  if (score <= 60) return 'bg-yellow-100 text-yellow-800';
  if (score <= 80) return 'bg-blue-100 text-blue-800';
  return 'bg-green-100 text-green-800';
}

/**
 * Format a large currency value compactly: $2.4M, $150K, $42.00
 */
export function formatCompactCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(value);
}

/**
 * Format a percentage with one decimal place.
 */
export function formatPct(value: number | null | undefined): string {
  if (value == null) return 'N/A';
  return `${value.toFixed(1)}%`;
}

/**
 * Format a number compactly: 2.4M, 150K, 42
 */
export function formatCompactNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toLocaleString();
}
