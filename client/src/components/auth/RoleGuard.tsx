import { useAuth } from '../../hooks/useAuth';
import { ShieldExclamationIcon } from '@heroicons/react/24/outline';
import type { UserRole } from '../../types';

interface RoleGuardProps {
  roles: UserRole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RoleGuard({ roles, children, fallback }: RoleGuardProps) {
  const { hasRole } = useAuth();

  if (!hasRole(...roles)) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <ShieldExclamationIcon className="h-16 w-16 text-red-400 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Access Denied
        </h2>
        <p className="text-gray-500 max-w-md">
          You do not have permission to access this page. Contact your
          administrator if you believe this is an error.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
