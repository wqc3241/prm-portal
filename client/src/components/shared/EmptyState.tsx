import { cn } from '../../utils/cn';
import { InboxIcon } from '@heroicons/react/24/outline';

interface EmptyStateProps {
  icon?: React.ElementType;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon = InboxIcon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 px-4 text-center',
        className
      )}
    >
      <Icon className="h-12 w-12 text-gray-400 mb-4" aria-hidden="true" />
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-gray-500 max-w-sm">{description}</p>
      )}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-4 inline-flex items-center rounded-md bg-panw-blue px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-panw-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panw-blue"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
