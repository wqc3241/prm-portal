import { cn } from '../../utils/cn';
import { Skeleton } from '../shared/LoadingSkeleton';
import {
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
} from '@heroicons/react/24/solid';

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  color: string;
  loading?: boolean;
}

export function StatCard({
  icon: Icon,
  label,
  value,
  change,
  trend,
  color,
  loading = false,
}: StatCardProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-panw border border-panw-gray-100 p-5">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-24" />
          </div>
        </div>
        <Skeleton className="mt-2 h-3 w-16" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-panw border border-panw-gray-100 p-5">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg',
            color
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-panw-gray-500">{label}</p>
          <p className="text-xl font-bold text-panw-gray-800">{value}</p>
        </div>
      </div>
      {change && (
        <div className="mt-2 flex items-center gap-1">
          {trend === 'up' && (
            <ArrowTrendingUpIcon className="h-3.5 w-3.5 text-green-600" />
          )}
          {trend === 'down' && (
            <ArrowTrendingDownIcon className="h-3.5 w-3.5 text-red-600" />
          )}
          <p
            className={cn(
              'text-xs',
              trend === 'up'
                ? 'text-green-600'
                : trend === 'down'
                  ? 'text-red-600'
                  : 'text-gray-400'
            )}
          >
            {change}
          </p>
        </div>
      )}
    </div>
  );
}
