import { cn } from '../../utils/cn';
import { humanize } from '../../utils/formatters';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const variantClasses: Record<BadgeVariant, string> = {
  success: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20',
  warning: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20',
  danger: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20',
  info: 'bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-600/20',
  neutral: 'bg-panw-gray-100 text-panw-gray-600 ring-1 ring-inset ring-panw-gray-500/20',
};

// Map common statuses to variants
const STATUS_VARIANT_MAP: Record<string, BadgeVariant> = {
  // Org statuses
  active: 'success',
  prospect: 'neutral',
  pending_approval: 'warning',
  suspended: 'danger',
  churned: 'danger',
  // Deal statuses
  draft: 'neutral',
  submitted: 'warning',
  under_review: 'info',
  approved: 'success',
  rejected: 'danger',
  won: 'success',
  lost: 'danger',
  expired: 'danger',
  // Quote statuses
  pending_approval_quote: 'warning',
  sent_to_customer: 'info',
  accepted: 'success',
  // Lead statuses
  new: 'info',
  assigned: 'warning',
  working: 'info',
  converted: 'success',
  returned: 'danger',
  disqualified: 'danger',
  // MDF statuses
  completed: 'success',
  claim_submitted: 'warning',
  claim_approved: 'success',
  claim_rejected: 'danger',
  reimbursed: 'success',
  // Generic
  true: 'success',
  false: 'danger',
};

interface StatusBadgeProps {
  status: string;
  variant?: BadgeVariant;
  className?: string;
  size?: 'sm' | 'md';
}

export function StatusBadge({
  status,
  variant,
  className,
  size = 'sm',
}: StatusBadgeProps) {
  const resolvedVariant = variant ?? STATUS_VARIANT_MAP[status] ?? 'neutral';

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full',
        size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        variantClasses[resolvedVariant],
        className
      )}
    >
      {humanize(status)}
    </span>
  );
}
