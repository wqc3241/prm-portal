import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useMdfAllocations, useAutoAllocate } from '../../hooks/useMdf';
import {
  PageHeader,
  DataTable,
  Skeleton,
  CardSkeleton,
  type Column,
} from '../../components/shared';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { cn } from '../../utils/cn';
import {
  PlusIcon,
  ClipboardDocumentListIcon,
  BoltIcon,
} from '@heroicons/react/24/outline';
import type { MdfAllocation } from '../../types';

function getCurrentQuarter(): { year: number; quarter: number } {
  const now = new Date();
  const month = now.getMonth();
  return {
    year: now.getFullYear(),
    quarter: Math.floor(month / 3) + 1,
  };
}

export function MdfOverview() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const isInternal = hasRole('admin', 'channel_manager');
  const isAdmin = hasRole('admin');

  const { year, quarter } = getCurrentQuarter();

  const { data: allocationsData, isLoading } = useMdfAllocations({
    fiscal_year: year,
    fiscal_quarter: quarter,
    per_page: 100,
  });

  const autoAllocate = useAutoAllocate();

  const allocations = allocationsData?.data ?? [];

  // Compute summary totals
  const summary = useMemo(() => {
    let totalAllocated = 0;
    let totalSpent = 0;
    let totalRemaining = 0;

    for (const a of allocations) {
      totalAllocated += a.allocated_amount;
      totalSpent += a.spent_amount;
      totalRemaining += a.remaining_amount;
    }

    // For partner users, there should typically be 1 allocation
    const totalRequested = totalAllocated - totalSpent - totalRemaining;

    return {
      totalAllocated,
      totalSpent,
      totalRemaining,
      totalRequested: totalRequested > 0 ? totalRequested : 0,
      utilizationPct:
        totalAllocated > 0
          ? ((totalSpent / totalAllocated) * 100).toFixed(1)
          : '0',
    };
  }, [allocations]);

  const columns = useMemo<Column<MdfAllocation>[]>(() => {
    const cols: Column<MdfAllocation>[] = [
      {
        key: 'organization_name',
        header: 'Partner',
        sortable: true,
        render: (row) => (
          <span className="font-medium text-gray-900">
            {row.organization_name ?? '-'}
          </span>
        ),
      },
      {
        key: 'fiscal_quarter',
        header: 'Quarter',
        render: (row) => (
          <span className="text-gray-700">
            Q{row.fiscal_quarter} {row.fiscal_year}
          </span>
        ),
      },
      {
        key: 'allocated_amount',
        header: 'Allocated',
        sortable: true,
        className: 'text-right',
        render: (row) => (
          <span className="font-semibold text-gray-900">
            {formatCurrency(row.allocated_amount)}
          </span>
        ),
      },
      {
        key: 'spent_amount',
        header: 'Spent',
        className: 'text-right',
        render: (row) => (
          <span className="text-gray-700">
            {formatCurrency(row.spent_amount)}
          </span>
        ),
      },
      {
        key: 'remaining_amount',
        header: 'Remaining',
        className: 'text-right',
        render: (row) => (
          <span
            className={cn(
              'font-semibold',
              row.remaining_amount > 0 ? 'text-green-700' : 'text-red-600'
            )}
          >
            {formatCurrency(row.remaining_amount)}
          </span>
        ),
      },
      {
        key: 'utilization',
        header: 'Utilization',
        render: (row) => {
          const pct =
            row.allocated_amount > 0
              ? (row.spent_amount / row.allocated_amount) * 100
              : 0;
          return (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden max-w-[80px]">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    pct > 90
                      ? 'bg-red-500'
                      : pct > 70
                      ? 'bg-yellow-500'
                      : 'bg-green-500'
                  )}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
              <span className="text-xs text-gray-500">{pct.toFixed(0)}%</span>
            </div>
          );
        },
      },
      {
        key: 'created_at',
        header: 'Created',
        sortable: true,
        render: (row) => (
          <span className="text-gray-500 text-xs">
            {formatDate(row.created_at)}
          </span>
        ),
      },
    ];

    return cols;
  }, []);

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

  const utilizationPct = Number(summary.utilizationPct);

  return (
    <div>
      <PageHeader
        title="Market Development Funds"
        subtitle={`Q${quarter} ${year} MDF Allocation Overview`}
        breadcrumbs={[{ label: 'MDF' }]}
        actions={
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={() =>
                  autoAllocate.mutate({
                    fiscal_year: year,
                    fiscal_quarter: quarter,
                  })
                }
                disabled={autoAllocate.isPending}
                className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                <BoltIcon className="h-4 w-4" />
                {autoAllocate.isPending ? 'Allocating...' : 'Auto-Allocate'}
              </button>
            )}
            <button
              onClick={() => navigate('/mdf/requests')}
              className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors"
            >
              <ClipboardDocumentListIcon className="h-4 w-4" />
              View Requests
            </button>
            {hasRole('partner_admin', 'partner_rep') && (
              <button
                onClick={() => navigate('/mdf/requests/new')}
                className="inline-flex items-center gap-2 rounded-md bg-panw-blue px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-panw-navy transition-colors"
              >
                <PlusIcon className="h-4 w-4" />
                New Request
              </button>
            )}
          </div>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <SummaryCard
          label="Total Allocated"
          value={formatCurrency(summary.totalAllocated)}
          color="blue"
        />
        <SummaryCard
          label="Spent"
          value={formatCurrency(summary.totalSpent)}
          color="green"
        />
        <SummaryCard
          label="Pending Requests"
          value={formatCurrency(summary.totalRequested)}
          color="yellow"
        />
        <SummaryCard
          label="Remaining"
          value={formatCurrency(summary.totalRemaining)}
          color={summary.totalRemaining > 0 ? 'emerald' : 'red'}
        />
      </div>

      {/* Utilization bar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-900">
            Budget Utilization
          </h3>
          <span className="text-sm font-medium text-gray-600">
            {summary.utilizationPct}% used
          </span>
        </div>
        <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              utilizationPct > 90
                ? 'bg-red-500'
                : utilizationPct > 70
                ? 'bg-yellow-500'
                : 'bg-green-500'
            )}
            style={{ width: `${Math.min(utilizationPct, 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-500">
          <span>$0</span>
          <span>{formatCurrency(summary.totalAllocated)}</span>
        </div>
      </div>

      {/* Allocations table (visible for admin/CM, also partner can see their own) */}
      {isInternal && allocations.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Partner Allocations
          </h3>
          <DataTable<MdfAllocation>
            columns={columns}
            data={allocations}
            loading={false}
            rowKey={(row) => row.id}
            emptyTitle="No allocations found"
            emptyDescription="No MDF allocations exist for this quarter."
            emptyAction={
              isAdmin
                ? {
                    label: 'Auto-Allocate',
                    onClick: () =>
                      autoAllocate.mutate({
                        fiscal_year: year,
                        fiscal_quarter: quarter,
                      }),
                  }
                : undefined
            }
          />
        </div>
      )}

      {/* Partner view: show their allocation details */}
      {!isInternal && allocations.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <p className="text-gray-500 text-sm">
            No MDF allocation has been assigned for this quarter. Please contact
            your channel manager.
          </p>
        </div>
      )}

      {!isInternal && allocations.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            Your Allocation Details
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {allocations.map((a) => (
              <div key={a.id} className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-gray-500">Quarter</p>
                  <p className="text-sm text-gray-700 mt-0.5">
                    Q{a.fiscal_quarter} {a.fiscal_year}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">Allocated</p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5">
                    {formatCurrency(a.allocated_amount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">Spent</p>
                  <p className="text-sm text-gray-700 mt-0.5">
                    {formatCurrency(a.spent_amount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">Remaining</p>
                  <p
                    className={cn(
                      'text-sm font-semibold mt-0.5',
                      a.remaining_amount > 0 ? 'text-green-700' : 'text-red-600'
                    )}
                  >
                    {formatCurrency(a.remaining_amount)}
                  </p>
                </div>
                {a.notes && (
                  <div>
                    <p className="text-xs font-medium text-gray-500">Notes</p>
                    <p className="text-sm text-gray-600 mt-0.5">{a.notes}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Sub-components ----

const colorClasses: Record<string, string> = {
  blue: 'bg-blue-50 border-blue-200',
  green: 'bg-green-50 border-green-200',
  yellow: 'bg-yellow-50 border-yellow-200',
  emerald: 'bg-emerald-50 border-emerald-200',
  red: 'bg-red-50 border-red-200',
};

const colorTextClasses: Record<string, string> = {
  blue: 'text-blue-900',
  green: 'text-green-900',
  yellow: 'text-yellow-900',
  emerald: 'text-emerald-900',
  red: 'text-red-900',
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
