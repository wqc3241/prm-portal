import { cn } from '../../utils/cn';
import {
  ShieldCheckIcon,
  SparklesIcon,
  StarIcon,
  TrophyIcon,
} from '@heroicons/react/24/solid';

const TIER_CONFIG: Record<
  string,
  { color: string; bg: string; border: string; icon: typeof StarIcon }
> = {
  registered: {
    color: 'text-gray-700',
    bg: 'bg-gray-100',
    border: 'border-gray-300',
    icon: ShieldCheckIcon,
  },
  innovator: {
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    icon: SparklesIcon,
  },
  'platinum innovator': {
    color: 'text-purple-700',
    bg: 'bg-purple-50',
    border: 'border-purple-300',
    icon: StarIcon,
  },
  'diamond innovator': {
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    icon: TrophyIcon,
  },
};

function getTierConfig(name: string) {
  const key = name.toLowerCase();
  return (
    TIER_CONFIG[key] ??
    TIER_CONFIG.registered
  );
}

interface TierBadgeProps {
  name: string;
  colorHex?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function TierBadge({ name, size = 'sm', className }: TierBadgeProps) {
  const config = getTierConfig(name);
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-3 py-1 text-sm gap-1.5',
    lg: 'px-4 py-1.5 text-base gap-2',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-semibold rounded-full border',
        config.bg,
        config.color,
        config.border,
        sizeClasses[size],
        className
      )}
    >
      <Icon className={iconSizes[size]} aria-hidden="true" />
      {name}
    </span>
  );
}
