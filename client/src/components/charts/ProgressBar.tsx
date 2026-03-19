import { cn } from '../../utils/cn';
import { Skeleton } from '../shared/LoadingSkeleton';

interface ProgressMetric {
  label: string;
  current: number;
  target: number;
  unit?: string;
  formatValue?: (value: number) => string;
}

interface TierProgressBarProps {
  metrics: ProgressMetric[];
  loading?: boolean;
  title?: string;
}

export function TierProgressBar({
  metrics,
  loading = false,
  title,
}: TierProgressBarProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-panw border border-panw-gray-100 p-6">
        {title && <Skeleton className="h-5 w-40 mb-4" />}
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-panw border border-panw-gray-100 p-6">
      {title && (
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
          {title}
        </h3>
      )}
      <div className="space-y-5">
        {metrics.map((metric) => {
          const pct = metric.target > 0
            ? Math.min((metric.current / metric.target) * 100, 100)
            : 0;
          const displayCurrent = metric.formatValue
            ? metric.formatValue(metric.current)
            : metric.current.toLocaleString();
          const displayTarget = metric.formatValue
            ? metric.formatValue(metric.target)
            : metric.target.toLocaleString();

          return (
            <div key={metric.label}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-gray-700">
                  {metric.label}
                </span>
                <span className="text-sm text-gray-500">
                  {displayCurrent} / {displayTarget}
                  {metric.unit ? ` ${metric.unit}` : ''}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className={cn(
                    'h-2.5 rounded-full transition-all duration-500',
                    pct >= 100
                      ? 'bg-green-500'
                      : pct >= 60
                        ? 'bg-blue-500'
                        : pct >= 30
                          ? 'bg-amber-500'
                          : 'bg-red-500'
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{pct.toFixed(0)}% complete</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
