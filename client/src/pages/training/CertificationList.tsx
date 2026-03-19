import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  useCertifications,
  useExpiringCerts,
  useOrgCertSummary,
} from '../../hooks/useCourses';
import {
  PageHeader,
  DataTable,
  StatusBadge,
  Skeleton,
  CardSkeleton,
  type Column,
} from '../../components/shared';
import { formatDate, humanize } from '../../utils/formatters';
import { cn } from '../../utils/cn';
import {
  ExclamationTriangleIcon,
  AcademicCapIcon,
} from '@heroicons/react/24/outline';
import type {
  Certification,
  CertificationStatus,
  CertificationQueryParams,
} from '../../types';

const STATUS_TABS: { label: string; value: CertificationStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Enrolled', value: 'enrolled' },
  { label: 'Passed', value: 'passed' },
  { label: 'Failed', value: 'failed' },
  { label: 'Expired', value: 'expired' },
];

export function CertificationList() {
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const isPartnerAdmin = hasRole('partner_admin');

  const [statusFilter, setStatusFilter] = useState<
    CertificationStatus | 'all'
  >('all');
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<string>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const params = useMemo<CertificationQueryParams>(() => {
    const p: CertificationQueryParams = {
      page,
      per_page: 25,
      sort: `${sortKey}:${sortDir}`,
    };
    if (statusFilter !== 'all') p.status = statusFilter;
    if (isPartnerAdmin && user?.organization_id) {
      p.organization_id = user.organization_id;
    }
    return p;
  }, [page, sortKey, sortDir, statusFilter, isPartnerAdmin, user]);

  const { data: certsData, isLoading } = useCertifications(params);
  const certifications = certsData?.data ?? [];
  const meta = certsData?.meta;

  // Expiring certs (30 days)
  const { data: expiringCerts } = useExpiringCerts(30);

  // Org summary for partner_admin
  const { data: orgSummary } = useOrgCertSummary(
    isPartnerAdmin ? user?.organization_id ?? undefined : undefined
  );

  const handleStatusChange = useCallback(
    (status: CertificationStatus | 'all') => {
      setStatusFilter(status);
      setPage(1);
    },
    []
  );

  const handleSort = useCallback(
    (key: string, direction: 'asc' | 'desc') => {
      setSortKey(key);
      setSortDir(direction);
      setPage(1);
    },
    []
  );

  const columns = useMemo<Column<Certification>[]>(() => {
    const cols: Column<Certification>[] = [
      {
        key: 'user_name',
        header: 'User',
        sortable: true,
        render: (row) => (
          <span className="font-medium text-gray-900">
            {row.user_name ?? '-'}
          </span>
        ),
      },
      {
        key: 'course_title',
        header: 'Course',
        sortable: true,
        render: (row) => (
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/training/${row.course_id}`);
            }}
            className="text-sm font-medium text-panw-navy hover:text-panw-blue"
          >
            {row.course_title ?? '-'}
          </button>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        sortable: true,
        render: (row) => <StatusBadge status={row.status} />,
      },
      {
        key: 'score',
        header: 'Score',
        className: 'text-right',
        render: (row) => (
          <span className="text-sm text-gray-700">
            {row.score !== null ? `${row.score}%` : '-'}
          </span>
        ),
      },
      {
        key: 'certified_at',
        header: 'Certified',
        sortable: true,
        render: (row) => (
          <span className="text-gray-500 text-xs">
            {row.certified_at ? formatDate(row.certified_at) : '-'}
          </span>
        ),
      },
      {
        key: 'expires_at',
        header: 'Expires',
        sortable: true,
        render: (row) => {
          if (!row.expires_at) return <span className="text-gray-400 text-xs">-</span>;
          const daysLeft = Math.ceil(
            (new Date(row.expires_at).getTime() - Date.now()) /
              (1000 * 60 * 60 * 24)
          );
          return (
            <span
              className={cn(
                'text-xs',
                daysLeft <= 30 && daysLeft > 0
                  ? 'text-yellow-700 font-medium'
                  : daysLeft <= 0
                  ? 'text-red-600 font-medium'
                  : 'text-gray-500'
              )}
            >
              {formatDate(row.expires_at)}
              {daysLeft <= 30 && daysLeft > 0 && ` (${daysLeft}d)`}
            </span>
          );
        },
      },
    ];

    if (isAdmin) {
      cols.splice(1, 0, {
        key: 'organization_name',
        header: 'Organization',
        render: (row) => (
          <span className="text-gray-600 text-sm">
            {row.organization_name ?? '-'}
          </span>
        ),
      });
    }

    return cols;
  }, [isAdmin, navigate]);

  if (isLoading) {
    return (
      <div>
        <div className="mb-6">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Certifications"
        subtitle="Track partner training certifications and compliance"
        breadcrumbs={[
          { label: 'Training', to: '/training' },
          { label: 'Certifications' },
        ]}
      />

      {/* Summary cards (for partner_admin with org summary) */}
      {orgSummary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <SummaryCard
            label="Total Enrolled"
            value={String(orgSummary.total_enrolled)}
            color="blue"
          />
          <SummaryCard
            label="Passed"
            value={String(orgSummary.total_passed)}
            color="green"
          />
          <SummaryCard
            label="Failed"
            value={String(orgSummary.total_failed)}
            color="red"
          />
          <SummaryCard
            label="Completion Rate"
            value={`${orgSummary.completion_rate.toFixed(1)}%`}
            color="emerald"
          />
        </div>
      )}

      {/* Expiring soon section */}
      {expiringCerts && expiringCerts.length > 0 && (
        <div className="mb-6 rounded-lg bg-yellow-50 border border-yellow-200 p-4">
          <div className="flex items-start gap-2 mb-3">
            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-yellow-800">
                Certifications Expiring Soon
              </p>
              <p className="text-xs text-yellow-700 mt-0.5">
                {expiringCerts.length} certification
                {expiringCerts.length !== 1 ? 's' : ''} expiring within 30 days
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {expiringCerts.slice(0, 5).map((cert) => (
              <div
                key={cert.id}
                className="flex items-center justify-between bg-white rounded border border-yellow-100 px-3 py-2"
              >
                <div className="text-sm">
                  <span className="font-medium text-gray-900">
                    {cert.user_name}
                  </span>
                  <span className="mx-2 text-gray-400">-</span>
                  <span className="text-gray-700">{cert.course_title}</span>
                </div>
                <span className="text-xs text-yellow-700 font-medium">
                  Expires {formatDate(cert.expires_at)}
                </span>
              </div>
            ))}
            {expiringCerts.length > 5 && (
              <p className="text-xs text-yellow-700 text-center pt-1">
                and {expiringCerts.length - 5} more...
              </p>
            )}
          </div>
        </div>
      )}

      {/* Status filter tabs */}
      <div className="mb-4 flex flex-wrap gap-1 border-b border-gray-200 pb-3">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => handleStatusChange(tab.value)}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              statusFilter === tab.value
                ? 'bg-panw-blue text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Data Table */}
      <DataTable<Certification>
        columns={columns}
        data={certifications}
        loading={false}
        meta={meta}
        onPageChange={setPage}
        onSort={handleSort}
        rowKey={(row) => row.id}
        emptyTitle="No certifications found"
        emptyDescription={
          statusFilter !== 'all'
            ? 'Try adjusting your filters.'
            : 'No certifications have been recorded yet.'
        }
        emptyAction={{
          label: 'Browse Courses',
          onClick: () => navigate('/training'),
        }}
      />
    </div>
  );
}

// ---- Sub-components ----

const colorClasses: Record<string, string> = {
  blue: 'bg-blue-50 border-blue-200',
  green: 'bg-green-50 border-green-200',
  red: 'bg-red-50 border-red-200',
  emerald: 'bg-emerald-50 border-emerald-200',
};

const colorTextClasses: Record<string, string> = {
  blue: 'text-blue-900',
  green: 'text-green-900',
  red: 'text-red-900',
  emerald: 'text-emerald-900',
};

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border p-4',
        colorClasses[color] ?? 'bg-gray-50 border-gray-200'
      )}
    >
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p
        className={cn(
          'text-xl font-bold mt-1',
          colorTextClasses[color] ?? 'text-gray-900'
        )}
      >
        {value}
      </p>
    </div>
  );
}
