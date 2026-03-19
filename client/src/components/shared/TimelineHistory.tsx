import { cn } from '../../utils/cn';
import { formatDateTime, humanize } from '../../utils/formatters';

export interface TimelineItem {
  id: string;
  date: string;
  from_status?: string | null;
  to_status: string;
  user?: string | null;
  notes?: string | null;
}

interface TimelineHistoryProps {
  items: TimelineItem[];
  className?: string;
}

const STATUS_COLORS: Record<string, string> = {
  // General positive
  approved: 'bg-green-500',
  won: 'bg-green-700',
  accepted: 'bg-green-500',
  converted: 'bg-green-500',
  completed: 'bg-green-600',
  passed: 'bg-green-500',
  claim_approved: 'bg-green-500',
  reimbursed: 'bg-green-700',
  active: 'bg-green-500',
  // General negative
  rejected: 'bg-red-500',
  lost: 'bg-red-700',
  expired: 'bg-gray-600',
  failed: 'bg-red-500',
  claim_rejected: 'bg-red-500',
  disqualified: 'bg-red-500',
  suspended: 'bg-red-600',
  churned: 'bg-red-700',
  returned: 'bg-red-400',
  // In-progress / neutral
  draft: 'bg-gray-400',
  submitted: 'bg-yellow-500',
  under_review: 'bg-blue-500',
  pending_approval: 'bg-yellow-500',
  sent_to_customer: 'bg-blue-500',
  new: 'bg-blue-400',
  assigned: 'bg-yellow-500',
  working: 'bg-blue-500',
  contacted: 'bg-blue-400',
  qualified: 'bg-blue-600',
  claim_submitted: 'bg-yellow-500',
  enrolled: 'bg-blue-400',
};

function getStatusColor(status: string): string {
  return STATUS_COLORS[status] ?? 'bg-gray-400';
}

export function TimelineHistory({ items, className }: TimelineHistoryProps) {
  if (!items || items.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-6">
        No history available.
      </p>
    );
  }

  return (
    <div className={cn('flow-root', className)}>
      <ul className="-mb-8">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          const color = getStatusColor(item.to_status);

          return (
            <li key={item.id}>
              <div className="relative pb-6">
                {!isLast && (
                  <span
                    className="absolute left-3 top-6 -ml-px h-full w-0.5 bg-gray-200"
                    aria-hidden="true"
                  />
                )}
                <div className="relative flex gap-3">
                  <div>
                    <span
                      className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white',
                        color
                      )}
                    >
                      <span className="h-2 w-2 rounded-full bg-white" />
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm">
                      <span className="font-medium text-gray-900">
                        {item.from_status
                          ? `${humanize(item.from_status)} -> ${humanize(item.to_status)}`
                          : `Created as ${humanize(item.to_status)}`}
                      </span>
                    </div>
                    {item.user && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        by {item.user}
                      </p>
                    )}
                    {item.notes && (
                      <p className="text-xs text-gray-600 mt-1 bg-gray-50 rounded px-2 py-1">
                        {item.notes}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatDateTime(item.date)}
                    </p>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
