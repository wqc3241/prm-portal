import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { dealsApi } from '../../api/deals';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { cn } from '../../utils/cn';
import { ClockIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import { Skeleton } from '../shared/LoadingSkeleton';

interface ExpiringDealsProps {
  days?: number;
  className?: string;
}

export function ExpiringDeals({ days = 14, className }: ExpiringDealsProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['deals-expiring', days],
    queryFn: async () => {
      const { data } = await dealsApi.getExpiring(days);
      return data.data;
    },
    refetchInterval: 5 * 60 * 1000, // refresh every 5 minutes
  });

  const deals = data ?? [];

  if (isLoading) {
    return (
      <div className={cn('bg-white rounded-lg shadow-sm border border-gray-200 p-5', className)}>
        <Skeleton className="h-5 w-40 mb-4" />
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-white rounded-lg shadow-sm border border-gray-200 p-5', className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <ClockIcon className="h-5 w-5 text-yellow-600" />
          Expiring Deals
        </h3>
        <Link
          to="/deals?status=approved"
          className="text-xs font-medium text-panw-navy hover:text-panw-blue inline-flex items-center gap-1"
        >
          View All
          <ArrowRightIcon className="h-3 w-3" />
        </Link>
      </div>

      {deals.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">
          No deals expiring within {days} days.
        </p>
      ) : (
        <div className="space-y-2">
          {deals.map((deal) => {
            const daysLeft = Math.ceil(
              (new Date(deal.registration_expires_at!).getTime() - Date.now()) /
                (1000 * 60 * 60 * 24)
            );
            const isUrgent = daysLeft <= 7;

            return (
              <Link
                key={deal.id}
                to={`/deals/${deal.id}`}
                className="block rounded-lg border border-gray-200 px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-900 truncate max-w-[60%]">
                    {deal.deal_name}
                  </span>
                  <span
                    className={cn(
                      'text-xs font-bold px-2 py-0.5 rounded-full',
                      isUrgent
                        ? 'bg-red-100 text-red-700'
                        : 'bg-yellow-100 text-yellow-700'
                    )}
                  >
                    {daysLeft}d left
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span className="font-mono">{deal.deal_number}</span>
                  <span>{formatCurrency(deal.estimated_value)}</span>
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  Expires {formatDate(deal.registration_expires_at)}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
