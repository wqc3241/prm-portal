import { cn } from '../../utils/cn';

interface ScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Color-coded lead score badge.
 * - 80+: green (hot)
 * - 50-79: yellow (warm)
 * - <50: red (cold)
 */
export function ScoreBadge({ score, size = 'sm', className }: ScoreBadgeProps) {
  let colorClasses: string;
  let label: string;

  if (score >= 80) {
    colorClasses = 'bg-green-100 text-green-800 ring-green-600/20';
    label = 'Hot';
  } else if (score >= 50) {
    colorClasses = 'bg-yellow-100 text-yellow-800 ring-yellow-600/20';
    label = 'Warm';
  } else {
    colorClasses = 'bg-red-100 text-red-800 ring-red-600/20';
    label = 'Cold';
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-semibold rounded-full ring-1 ring-inset',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        colorClasses,
        className
      )}
      title={`Score: ${score}/100 (${label})`}
    >
      {score}
    </span>
  );
}
