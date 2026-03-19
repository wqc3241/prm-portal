import { useState, useEffect, useMemo } from 'react';
import { cn } from '../../utils/cn';
import { ClockIcon } from '@heroicons/react/24/outline';

interface SlaIndicatorProps {
  deadline: string | null;
  status: string;
  size?: 'sm' | 'md';
  showLabel?: boolean;
  className?: string;
}

/**
 * SLA countdown indicator with live updating.
 * - GREEN: > 24 hours remaining
 * - YELLOW: < 24 hours remaining
 * - RED: SLA breached (past deadline)
 *
 * Only shows for leads in 'assigned' status.
 */
export function SlaIndicator({
  deadline,
  status,
  size = 'sm',
  showLabel = false,
  className,
}: SlaIndicatorProps) {
  const [now, setNow] = useState(() => Date.now());

  // Update every 60 seconds for live countdown
  useEffect(() => {
    if (!deadline || status !== 'assigned') return;
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, [deadline, status]);

  const slaInfo = useMemo(() => {
    if (!deadline) return null;

    // Only show SLA for assigned leads
    if (status !== 'assigned') return null;

    const deadlineMs = new Date(deadline).getTime();
    const remainingMs = deadlineMs - now;
    const remainingHours = remainingMs / (1000 * 60 * 60);

    if (remainingMs <= 0) {
      const breachedHours = Math.abs(remainingHours);
      return {
        color: 'red' as const,
        label: 'Breached',
        detail: breachedHours < 1
          ? `${Math.ceil(Math.abs(remainingMs / (1000 * 60)))}m ago`
          : `${Math.floor(breachedHours)}h ago`,
      };
    }

    const hours = Math.floor(remainingHours);
    const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

    if (remainingHours <= 24) {
      return {
        color: 'yellow' as const,
        label: 'Urgent',
        detail: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`,
      };
    }

    return {
      color: 'green' as const,
      label: 'On Track',
      detail: `${hours}h ${minutes}m`,
    };
  }, [deadline, status, now]);

  if (!slaInfo) {
    return <span className="text-xs text-gray-400">-</span>;
  }

  const colorMap = {
    green: {
      bg: 'bg-green-50',
      text: 'text-green-700',
      icon: 'text-green-500',
      ring: 'ring-green-600/20',
      dot: 'bg-green-500',
    },
    yellow: {
      bg: 'bg-yellow-50',
      text: 'text-yellow-700',
      icon: 'text-yellow-500',
      ring: 'ring-yellow-600/20',
      dot: 'bg-yellow-500',
    },
    red: {
      bg: 'bg-red-50',
      text: 'text-red-700',
      icon: 'text-red-500',
      ring: 'ring-red-600/20',
      dot: 'bg-red-500',
    },
  };

  const colors = colorMap[slaInfo.color];

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full ring-1 ring-inset',
        colors.bg,
        colors.text,
        colors.ring,
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        className
      )}
      title={`SLA Deadline: ${deadline ? new Date(deadline).toLocaleString() : 'N/A'}`}
    >
      <ClockIcon className={cn('flex-shrink-0', colors.icon, size === 'sm' ? 'h-3 w-3' : 'h-4 w-4')} />
      <span className="font-medium">{slaInfo.detail}</span>
      {showLabel && (
        <span className="font-normal opacity-75">({slaInfo.label})</span>
      )}
    </div>
  );
}
