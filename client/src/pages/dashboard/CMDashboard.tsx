import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useChannelManagerDashboard } from '../../hooks/useDashboard';
import { PageHeader } from '../../components/shared/PageHeader';
import { TierBadge } from '../../components/shared/TierBadge';
import { EmptyState } from '../../components/shared/EmptyState';
import {
  StatCard,
  BarChartWidget,
  getHealthScoreBg,
  formatCompactCurrency,
} from '../../components/charts';
import { formatDate } from '../../utils/formatters';
import { cn } from '../../utils/cn';
import {
  BuildingOfficeIcon,
  CurrencyDollarIcon,
  ClipboardDocumentCheckIcon,
  UserGroupIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import type { CMPartner } from '../../types/dashboard';

type SortKey = 'name' | 'pipeline_value' | 'ytd_revenue' | 'active_deals' | 'health_score';

export function CMDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useChannelManagerDashboard();
  const [sortKey, setSortKey] = useState<SortKey>('health_score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const sortedPartners = useMemo(() => {
    if (!data?.partners) return [];
    return [...data.partners].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      const numA = Number(aVal) || 0;
      const numB = Number(bVal) || 0;
      return sortDir === 'asc' ? numA - numB : numB - numA;
    });
  }, [data?.partners, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' ? 'asc' : 'desc');
    }
  };

  // Prepare lead acceptance chart data
  const leadAcceptanceData = (data?.lead_metrics.acceptance_rate_by_partner ?? [])
    .slice(0, 10)
    .map((p) => ({
      name: p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name,
      'Acceptance Rate': p.acceptance_rate,
    }));

  if (isError) {
    return (
      <div>
        <PageHeader title="Portfolio Overview" subtitle="Channel Manager Dashboard" />
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ExclamationTriangleIcon className="h-12 w-12 text-red-400 mb-4" />
          <h3 className="text-sm font-semibold text-gray-900">Failed to load dashboard</h3>
          <p className="mt-1 text-sm text-gray-500">Something went wrong while loading your dashboard data.</p>
          <button
            onClick={() => refetch()}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-panw-blue px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-panw-navy"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Portfolio Overview"
        subtitle={`Welcome back, ${user?.first_name}`}
      />

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={BuildingOfficeIcon}
          label="Total Partners"
          value={String(data?.summary.total_partners ?? 0)}
          change={`${data?.summary.active_partners ?? 0} active`}
          color="text-blue-600 bg-blue-50"
          loading={isLoading}
        />
        <StatCard
          icon={CurrencyDollarIcon}
          label="Total Pipeline"
          value={formatCompactCurrency(data?.summary.total_pipeline_value ?? 0)}
          change={`${data?.summary.total_active_deals ?? 0} active deals`}
          color="text-green-600 bg-green-50"
          loading={isLoading}
        />
        <StatCard
          icon={ClipboardDocumentCheckIcon}
          label="Pending Approvals"
          value={String(data?.pending_approvals.total ?? 0)}
          change={`${data?.pending_approvals.deals ?? 0} deals, ${data?.pending_approvals.quotes ?? 0} quotes, ${data?.pending_approvals.mdf_requests ?? 0} MDF`}
          color="text-amber-600 bg-amber-50"
          loading={isLoading}
        />
        <StatCard
          icon={UserGroupIcon}
          label="Unassigned Leads"
          value={String(data?.lead_metrics.total_unassigned ?? 0)}
          change={`${data?.lead_metrics.total_assigned_pending ?? 0} pending acceptance`}
          color="text-purple-600 bg-purple-50"
          loading={isLoading}
        />
      </div>

      {/* Pending Approvals Banner */}
      {(data?.pending_approvals.total ?? 0) > 0 && (
        <div className="mb-6 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardDocumentCheckIcon className="h-5 w-5 text-amber-600" />
            <span className="text-sm font-medium text-amber-800">
              You have {data!.pending_approvals.total} items awaiting review
            </span>
          </div>
          <button
            onClick={() => navigate('/deals?status=submitted')}
            className="text-sm font-semibold text-amber-700 hover:text-amber-900 transition-colors"
          >
            Review now
          </button>
        </div>
      )}

      {/* Partner Portfolio Table */}
      <div className="bg-white rounded-lg shadow-panw border border-panw-gray-100 mb-6 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
            Partner Portfolio
          </h3>
        </div>
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : sortedPartners.length === 0 ? (
          <EmptyState
            icon={BuildingOfficeIcon}
            title="No partners assigned"
            description="No partners are currently assigned to you."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {([
                    { key: 'name' as SortKey, label: 'Partner' },
                    { key: null, label: 'Tier' },
                    { key: 'pipeline_value' as SortKey, label: 'Pipeline' },
                    { key: 'ytd_revenue' as SortKey, label: 'YTD Revenue' },
                    { key: 'active_deals' as SortKey, label: 'Deals' },
                    { key: null, label: 'Leads' },
                    { key: null, label: 'Certs' },
                    { key: 'health_score' as SortKey, label: 'Health' },
                  ] as Array<{ key: SortKey | null; label: string }>).map((col) => (
                    <th
                      key={col.label}
                      className={cn(
                        'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider',
                        col.key && 'cursor-pointer hover:text-gray-700 select-none'
                      )}
                      onClick={col.key ? () => handleSort(col.key!) : undefined}
                    >
                      <div className="flex items-center gap-1">
                        {col.label}
                        {col.key && sortKey === col.key && (
                          sortDir === 'asc' ? (
                            <ChevronUpIcon className="h-3 w-3" />
                          ) : (
                            <ChevronDownIcon className="h-3 w-3" />
                          )
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedPartners.map((partner: CMPartner) => (
                  <tr
                    key={partner.organization_id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/deals?org_id=${partner.organization_id}`)}
                  >
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-gray-900">
                        {partner.name}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {partner.tier ? (
                        <TierBadge name={partner.tier.name} size="sm" />
                      ) : (
                        <span className="text-xs text-gray-400">Untiered</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {formatCompactCurrency(partner.pipeline_value)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {formatCompactCurrency(partner.ytd_revenue)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {partner.active_deals}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {partner.open_leads}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {partner.certified_reps}/{partner.total_reps}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
                          getHealthScoreBg(partner.health_score)
                        )}
                      >
                        {partner.health_score}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <BarChartWidget
          title="Lead Acceptance Rate by Partner"
          data={leadAcceptanceData}
          xKey="name"
          bars={[
            { dataKey: 'Acceptance Rate', color: '#3B82F6', label: 'Acceptance Rate (%)' },
          ]}
          loading={isLoading}
          formatTooltip={(v) => `${v.toFixed(1)}%`}
        />

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow-panw border border-panw-gray-100 p-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Recent Activity
          </h3>
          {isLoading ? (
            <div className="animate-pulse space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <div className="h-2 w-2 mt-1.5 rounded-full bg-gray-200" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 bg-gray-200 rounded w-3/4" />
                    <div className="h-2 bg-gray-200 rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : (data?.recent_activity ?? []).length > 0 ? (
            <div className="space-y-3">
              {data!.recent_activity.slice(0, 10).map((item) => (
                <div key={item.id} className="flex gap-3">
                  <div className="h-2 w-2 mt-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-gray-700 truncate">{item.summary}</p>
                    <p className="text-xs text-gray-400">{formatDate(item.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">No recent activity</p>
          )}
        </div>
      </div>
    </div>
  );
}
