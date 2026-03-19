import { ChevronRightIcon } from '@heroicons/react/24/solid';
import { Link } from 'react-router-dom';
import { cn } from '../../utils/cn';
import type { ReactNode } from 'react';

interface Breadcrumb {
  label: string;
  to?: string;
}

interface PageHeaderProps {
  title: string;
  breadcrumbs?: Breadcrumb[];
  actions?: ReactNode;
  subtitle?: string;
  className?: string;
}

export function PageHeader({
  title,
  breadcrumbs,
  actions,
  subtitle,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('mb-6', className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex mb-2" aria-label="Breadcrumb">
          <ol className="flex items-center space-x-1 text-sm text-gray-500">
            {breadcrumbs.map((crumb, idx) => (
              <li key={idx} className="flex items-center">
                {idx > 0 && (
                  <ChevronRightIcon
                    className="h-4 w-4 mx-1 text-gray-400 flex-shrink-0"
                    aria-hidden="true"
                  />
                )}
                {crumb.to ? (
                  <Link
                    to={crumb.to}
                    className="hover:text-gray-700 transition-colors"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-gray-900 font-medium">
                    {crumb.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-panw-gray-800">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-sm text-panw-gray-400">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    </div>
  );
}
