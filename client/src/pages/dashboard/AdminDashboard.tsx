import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useAdminDashboard } from '../../hooks/useDashboard';
import { PageHeader } from '../../components/shared/PageHeader';
import { TierBadge } from '../../components/shared/TierBadge';
import {
  StatCard,
  DonutChart,
  BarChartWidget,
  MDF_COLORS,
  formatCompactCurrency,
  formatPct,
} from '../../components/charts';
import { cn } from '../../utils/cn';
import {
  BuildingOfficeIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  ClipboardDocumentCheckIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

type TopTab = 'revenue' | 'deals' | 'conversion';

export function AdminDashboard() {
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useAdminDashboard();
  const [topTab, setTopTab] = useState<TopTab>('revenue');

  if (isError) {
    return (
      <div>
        <PageHeader title="Program Dashboard" subtitle="System Administration" />
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ExclamationTriangleIcon className="h-12 w-12 text-red-400 mb-4" />
          <h3 className="text-sm font-semibold text-gray-900">Failed to load dashboard</h3>
          <p className="mt-1 text-sm text-gray-500">Something went wrong while loading dashboard data.</p>
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

  // Tier distribution chart data
  const tierChartData = (data?.tier_distribution ?? []).map((t) => ({
    name: t.tier_name,
    Partners: t.partner_count,
    fill: t.color_hex,
  }));

  const tierBarColors = (data?.tier_distribution ?? []).map((t) => t.color_hex);

  // MDF utilization donut
  const mdfDonutData = data
    ? [
        { name: 'Spent', value: data.mdf_utilization.total_spent },
        { name: 'Remaining', value: data.mdf_utilization.total_remaining },
      ].filter((d) => d.value > 0)
    : [];

  // Cert coverage chart data
  const certCoverageData = (data?.certification_coverage.by_tier ?? []).map((t) => ({
    name: t.tier_name,
    'Meeting Req.': t.partners_meeting_requirement,
    'Not Meeting': t.partners_total - t.partners_meeting_requirement,
  }));

  return (
    <div>
      <PageHeader
        title="Program Dashboard"
        subtitle={`Welcome back, ${user?.first_name}`}
      />

      {/* Stat Cards - 5 columns on large screens */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard
          icon={BuildingOfficeIcon}
          label="Total Partners"
          value={String(data?.program_metrics.total_partners ?? 0)}
          change={`${data?.program_metrics.active_partners ?? 0} active`}
          color="text-blue-600 bg-blue-50"
          loading={isLoading}
        />
        <StatCard
          icon={CurrencyDollarIcon}
          label="Active Pipeline"
          value={formatCompactCurrency(data?.program_metrics.total_pipeline_value ?? 0)}
          color="text-green-600 bg-green-50"
          loading={isLoading}
        />
        <StatCard
          icon={ChartBarIcon}
          label="YTD Revenue"
          value={formatCompactCurrency(data?.program_metrics.total_ytd_revenue ?? 0)}
          color="text-emerald-600 bg-emerald-50"
          loading={isLoading}
        />
        <StatCard
          icon={DocumentTextIcon}
          label="Active Deals"
          value={String(data?.program_metrics.total_active_deals ?? 0)}
          color="text-purple-600 bg-purple-50"
          loading={isLoading}
        />
        <StatCard
          icon={ClipboardDocumentCheckIcon}
          label="Pending Approvals"
          value={String(data?.pending_approvals.total ?? 0)}
          change={`${data?.pending_approvals.deals ?? 0}D / ${data?.pending_approvals.quotes ?? 0}Q / ${data?.pending_approvals.mdf_requests ?? 0}M`}
          color="text-amber-600 bg-amber-50"
          loading={isLoading}
        />
      </div>

      {/* Row 1: Tier Distribution + MDF Utilization */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <BarChartWidget
          title="Tier Distribution"
          data={tierChartData}
          xKey="name"
          bars={[
            {
              dataKey: 'Partners',
              label: 'Partners',
              color: tierBarColors[0] ?? '#3B82F6',
            },
          ]}
          loading={isLoading}
        />
        <DonutChart
          title="MDF Utilization"
          data={mdfDonutData}
          colors={[MDF_COLORS.reimbursed, MDF_COLORS.remaining]}
          centerValue={formatPct(data?.mdf_utilization.utilization_pct ?? 0)}
          centerLabel="Utilized"
          loading={isLoading}
        />
      </div>

      {/* Row 2: Cert Coverage */}
      <div className="mb-6">
        <BarChartWidget
          title="Certification Coverage by Tier"
          data={certCoverageData}
          xKey="name"
          bars={[
            { dataKey: 'Meeting Req.', color: '#22C55E', label: 'Meeting Requirement' },
            { dataKey: 'Not Meeting', color: '#EF4444', label: 'Not Meeting' },
          ]}
          stacked
          loading={isLoading}
          height={250}
        />
      </div>

      {/* Row 3: Top Partners */}
      <div className="bg-white rounded-lg shadow-panw border border-panw-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
            Top Partners
          </h3>
          <div className="flex gap-1">
            {([
              { key: 'revenue' as TopTab, label: 'By Revenue' },
              { key: 'deals' as TopTab, label: 'By Deals' },
              { key: 'conversion' as TopTab, label: 'By Conversion' },
            ]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setTopTab(tab.key)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  topTab === tab.key
                    ? 'bg-panw-blue text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-10">
                    #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Partner
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Tier
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    {topTab === 'revenue'
                      ? 'YTD Revenue'
                      : topTab === 'deals'
                        ? 'Deal Count'
                        : 'Conversion Rate'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {topTab === 'revenue' &&
                  (data?.top_partners.by_revenue ?? []).map((p, idx) => (
                    <tr key={p.organization_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-500">{idx + 1}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.name}</td>
                      <td className="px-4 py-3"><TierBadge name={p.tier_name} size="sm" /></td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                        {formatCompactCurrency(p.ytd_revenue)}
                      </td>
                    </tr>
                  ))}
                {topTab === 'deals' &&
                  (data?.top_partners.by_deal_count ?? []).map((p, idx) => (
                    <tr key={p.organization_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-500">{idx + 1}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.name}</td>
                      <td className="px-4 py-3"><TierBadge name={p.tier_name} size="sm" /></td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                        {p.deal_count}
                      </td>
                    </tr>
                  ))}
                {topTab === 'conversion' &&
                  (data?.top_partners.by_lead_conversion ?? []).map((p, idx) => (
                    <tr key={p.organization_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-500">{idx + 1}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.name}</td>
                      <td className="px-4 py-3"><TierBadge name={p.tier_name} size="sm" /></td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                        {formatPct(p.conversion_rate)}
                      </td>
                    </tr>
                  ))}
                {/* Empty state */}
                {topTab === 'revenue' && (data?.top_partners.by_revenue ?? []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">
                      No partner data available
                    </td>
                  </tr>
                )}
                {topTab === 'deals' && (data?.top_partners.by_deal_count ?? []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">
                      No partner data available
                    </td>
                  </tr>
                )}
                {topTab === 'conversion' && (data?.top_partners.by_lead_conversion ?? []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">
                      No partner data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
