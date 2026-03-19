import { useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  usePipelineAnalytics,
  usePartnerPerformance,
  useLeadConversion,
  useMdfRoi,
} from '../../hooks/useDashboard';
import { PageHeader } from '../../components/shared/PageHeader';
import { TierBadge } from '../../components/shared/TierBadge';
import {
  StatCard,
  BarChartWidget,
  LineChartWidget,
  DonutChart,
  formatCompactCurrency,
  formatPct,
  DEAL_STATUS_COLORS,
  CHART_COLORS,
} from '../../components/charts';
import { cn } from '../../utils/cn';
import { humanize } from '../../utils/formatters';
import {
  CurrencyDollarIcon,
  DocumentTextIcon,
  UserGroupIcon,
  BanknotesIcon,
  ChartBarIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';
import type {
  PipelineAnalyticsParams,
  PartnerPerformanceParams,
  LeadConversionParams,
  MdfRoiParams,
} from '../../types/dashboard';

type AnalyticsTab = 'pipeline' | 'performance' | 'leads' | 'mdf';

const TABS: { key: AnalyticsTab; label: string; icon: React.ElementType }[] = [
  { key: 'pipeline', label: 'Pipeline', icon: ChartBarIcon },
  { key: 'performance', label: 'Partner Performance', icon: DocumentTextIcon },
  { key: 'leads', label: 'Lead Conversion', icon: FunnelIcon },
  { key: 'mdf', label: 'MDF ROI', icon: BanknotesIcon },
];

export function AnalyticsPage() {
  const { hasRole } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<AnalyticsTab>(
    (searchParams.get('tab') as AnalyticsTab) || 'pipeline'
  );

  // Date range state
  const currentYear = new Date().getFullYear();
  const [startDate, setStartDate] = useState(
    searchParams.get('start_date') || `${currentYear}-01-01`
  );
  const [endDate, setEndDate] = useState(
    searchParams.get('end_date') || new Date().toISOString().split('T')[0]
  );
  const [orgId, setOrgId] = useState(searchParams.get('org_id') || '');
  const [groupBy, setGroupBy] = useState<PipelineAnalyticsParams['group_by']>(
    (searchParams.get('group_by') as PipelineAnalyticsParams['group_by']) || 'status'
  );

  const handleTabChange = useCallback(
    (tab: AnalyticsTab) => {
      setActiveTab(tab);
      setSearchParams((prev) => {
        prev.set('tab', tab);
        return prev;
      });
    },
    [setSearchParams]
  );

  // Only admin and channel_manager can access
  if (!hasRole('admin', 'channel_manager')) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-500">Analytics are available to admins and channel managers.</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Analytics"
        subtitle="Deep-dive into program performance metrics"
        breadcrumbs={[{ label: 'Analytics' }]}
      />

      {/* Tab navigation */}
      <div className="mb-6 flex flex-wrap gap-1 border-b border-gray-200 pb-3">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium transition-colors',
              activeTab === tab.key
                ? 'bg-panw-blue text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Date range filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500">From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-md border-0 py-1.5 px-2.5 text-sm text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-panw-blue"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500">To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-md border-0 py-1.5 px-2.5 text-sm text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-panw-blue"
          />
        </div>
        {activeTab === 'pipeline' && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-500">Group by</label>
            <select
              value={groupBy}
              onChange={(e) =>
                setGroupBy(e.target.value as PipelineAnalyticsParams['group_by'])
              }
              className="rounded-md border-0 py-1.5 px-2.5 text-sm text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-panw-blue"
            >
              <option value="status">Status</option>
              <option value="organization">Organization</option>
              <option value="product">Product</option>
              <option value="month">Month</option>
            </select>
          </div>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === 'pipeline' && (
        <PipelineTab
          startDate={startDate}
          endDate={endDate}
          orgId={orgId}
          groupBy={groupBy}
        />
      )}
      {activeTab === 'performance' && <PerformanceTab />}
      {activeTab === 'leads' && (
        <LeadsTab startDate={startDate} endDate={endDate} orgId={orgId} />
      )}
      {activeTab === 'mdf' && <MdfTab orgId={orgId} />}
    </div>
  );
}

// ---- Pipeline Tab ----
function PipelineTab({
  startDate,
  endDate,
  orgId,
  groupBy,
}: {
  startDate: string;
  endDate: string;
  orgId: string;
  groupBy: PipelineAnalyticsParams['group_by'];
}) {
  const params = useMemo<PipelineAnalyticsParams>(
    () => ({
      start_date: startDate,
      end_date: endDate,
      org_id: orgId || undefined,
      group_by: groupBy,
    }),
    [startDate, endDate, orgId, groupBy]
  );

  const { data, isLoading } = usePipelineAnalytics(params);

  const groupChartData = (data?.groups ?? []).map((g) => ({
    name: g.label,
    'Deal Count': g.deal_count,
    'Total Value': g.total_value,
  }));

  const groupColors = groupBy === 'status'
    ? (data?.groups ?? []).map((g) => DEAL_STATUS_COLORS[g.key] ?? CHART_COLORS[0])
    : undefined;

  const trendData = (data?.trend ?? []).map((t) => ({
    name: t.period,
    Deals: t.deal_count,
    Value: t.total_value,
  }));

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          icon={CurrencyDollarIcon}
          label="Total Pipeline"
          value={formatCompactCurrency(data?.total_pipeline_value ?? 0)}
          color="text-green-600 bg-green-50"
          loading={isLoading}
        />
        <StatCard
          icon={DocumentTextIcon}
          label="Total Deals"
          value={String(data?.total_deal_count ?? 0)}
          color="text-blue-600 bg-blue-50"
          loading={isLoading}
        />
        <StatCard
          icon={ChartBarIcon}
          label="Avg Deal Value"
          value={
            data && data.total_deal_count > 0
              ? formatCompactCurrency(data.total_pipeline_value / data.total_deal_count)
              : '$0'
          }
          color="text-purple-600 bg-purple-50"
          loading={isLoading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BarChartWidget
          title={`Pipeline by ${humanize(groupBy)}`}
          data={groupChartData}
          xKey="name"
          bars={[
            {
              dataKey: 'Total Value',
              color: groupColors?.[0] ?? '#3B82F6',
              label: 'Value ($)',
            },
          ]}
          loading={isLoading}
          formatTooltip={(v) => formatCompactCurrency(v)}
        />
        <LineChartWidget
          title="Monthly Trend"
          data={trendData}
          xKey="name"
          lines={[
            { dataKey: 'Value', color: '#3B82F6', label: 'Pipeline Value' },
            { dataKey: 'Deals', color: '#22C55E', label: 'Deal Count' },
          ]}
          loading={isLoading}
        />
      </div>
    </div>
  );
}

// ---- Performance Tab ----
function PerformanceTab() {
  const [sortBy, setSortBy] = useState<PartnerPerformanceParams['sort_by']>('revenue');
  const params = useMemo<PartnerPerformanceParams>(
    () => ({ sort_by: sortBy, sort_order: 'desc', limit: 25 }),
    [sortBy]
  );
  const { data, isLoading } = usePartnerPerformance(params);

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <label className="text-xs font-medium text-gray-500">Sort by</label>
        <select
          value={sortBy}
          onChange={(e) =>
            setSortBy(e.target.value as PartnerPerformanceParams['sort_by'])
          }
          className="rounded-md border-0 py-1.5 px-2.5 text-sm text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-panw-blue"
        >
          <option value="revenue">Revenue</option>
          <option value="deal_count">Deal Count</option>
          <option value="win_rate">Win Rate</option>
          <option value="lead_conversion">Lead Conversion</option>
          <option value="health_score">Health Score</option>
        </select>
      </div>

      <div className="bg-white rounded-lg shadow-panw border border-panw-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Partner</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tier</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Revenue</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Win Rate</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Lead Conv.</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">MDF Util.</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Health</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(data?.partners ?? []).map((p) => (
                  <tr key={p.organization_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.name}</td>
                    <td className="px-4 py-3"><TierBadge name={p.tier.name} size="sm" /></td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                      {formatCompactCurrency(p.metrics.ytd_revenue)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                      {p.metrics.win_rate != null ? formatPct(p.metrics.win_rate) : 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                      {formatPct(p.metrics.lead_conversion_rate)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                      {formatPct(p.metrics.mdf_utilization_pct)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                      {p.metrics.health_score}
                    </td>
                  </tr>
                ))}
                {(data?.partners ?? []).length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">
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

// ---- Leads Tab ----
function LeadsTab({
  startDate,
  endDate,
  orgId,
}: {
  startDate: string;
  endDate: string;
  orgId: string;
}) {
  const params = useMemo<LeadConversionParams>(
    () => ({
      start_date: startDate,
      end_date: endDate,
      org_id: orgId || undefined,
    }),
    [startDate, endDate, orgId]
  );
  const { data, isLoading } = useLeadConversion(params);

  const funnelData = (data?.funnel ?? []).map((s) => ({
    name: humanize(s.stage),
    Count: s.count,
    '% of Total': s.pct_of_total,
  }));

  const sourceData = (data?.by_source ?? []).map((s) => ({
    name: humanize(s.source),
    value: s.converted,
  }));

  const trendData = (data?.trend ?? []).map((t) => ({
    name: t.period,
    New: t.new,
    Converted: t.converted,
    'Conv. Rate': t.conversion_rate,
  }));

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          icon={UserGroupIcon}
          label="Total Leads"
          value={String(data?.funnel?.[0]?.count ?? 0)}
          color="text-blue-600 bg-blue-50"
          loading={isLoading}
        />
        <StatCard
          icon={FunnelIcon}
          label="Converted"
          value={String(data?.funnel?.find((s) => s.stage === 'converted')?.count ?? 0)}
          color="text-green-600 bg-green-50"
          loading={isLoading}
        />
        <StatCard
          icon={ChartBarIcon}
          label="Avg Time to Accept"
          value={
            data?.avg_time_between_stages.assigned_to_accepted_hours != null
              ? `${data.avg_time_between_stages.assigned_to_accepted_hours.toFixed(1)}h`
              : 'N/A'
          }
          color="text-purple-600 bg-purple-50"
          loading={isLoading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <BarChartWidget
          title="Lead Funnel"
          data={funnelData}
          xKey="name"
          bars={[{ dataKey: 'Count', color: '#3B82F6', label: 'Leads' }]}
          loading={isLoading}
        />
        <DonutChart
          title="Conversions by Source"
          data={sourceData}
          loading={isLoading}
        />
      </div>

      <LineChartWidget
        title="Monthly Trend"
        data={trendData}
        xKey="name"
        lines={[
          { dataKey: 'New', color: '#3B82F6', label: 'New Leads' },
          { dataKey: 'Converted', color: '#22C55E', label: 'Converted' },
        ]}
        loading={isLoading}
      />
    </div>
  );
}

// ---- MDF Tab ----
function MdfTab({ orgId }: { orgId: string }) {
  const currentYear = new Date().getFullYear();
  const params = useMemo<MdfRoiParams>(
    () => ({ fiscal_year: currentYear, org_id: orgId || undefined }),
    [currentYear, orgId]
  );
  const { data, isLoading } = useMdfRoi(params);

  const activityData = (data?.by_activity_type ?? []).map((a) => ({
    name: humanize(a.activity_type),
    Approved: a.total_approved,
    Reimbursed: a.total_reimbursed,
    Revenue: a.associated_revenue,
  }));

  const quarterData = (data?.by_quarter ?? []).map((q) => ({
    name: `Q${q.fiscal_quarter}`,
    Allocated: q.allocated,
    Reimbursed: q.reimbursed,
    Revenue: q.associated_revenue,
  }));

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={BanknotesIcon}
          label="Total Allocated"
          value={formatCompactCurrency(data?.summary.total_allocated ?? 0)}
          color="text-blue-600 bg-blue-50"
          loading={isLoading}
        />
        <StatCard
          icon={CurrencyDollarIcon}
          label="Total Reimbursed"
          value={formatCompactCurrency(data?.summary.total_reimbursed ?? 0)}
          color="text-green-600 bg-green-50"
          loading={isLoading}
        />
        <StatCard
          icon={ChartBarIcon}
          label="Assoc. Revenue"
          value={formatCompactCurrency(data?.summary.associated_revenue ?? 0)}
          color="text-purple-600 bg-purple-50"
          loading={isLoading}
        />
        <StatCard
          icon={DocumentTextIcon}
          label="ROI Ratio"
          value={data?.summary.roi_ratio != null ? `${data.summary.roi_ratio.toFixed(1)}x` : 'N/A'}
          color="text-amber-600 bg-amber-50"
          loading={isLoading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <BarChartWidget
          title="MDF by Activity Type"
          data={activityData}
          xKey="name"
          bars={[
            { dataKey: 'Approved', color: '#3B82F6', label: 'Approved' },
            { dataKey: 'Reimbursed', color: '#22C55E', label: 'Reimbursed' },
          ]}
          loading={isLoading}
          formatTooltip={(v) => formatCompactCurrency(v)}
        />
        <BarChartWidget
          title="MDF by Quarter"
          data={quarterData}
          xKey="name"
          bars={[
            { dataKey: 'Allocated', color: '#3B82F6', label: 'Allocated' },
            { dataKey: 'Reimbursed', color: '#22C55E', label: 'Reimbursed' },
          ]}
          loading={isLoading}
          formatTooltip={(v) => formatCompactCurrency(v)}
        />
      </div>

      {/* Partner ROI table */}
      <div className="bg-white rounded-lg shadow-panw border border-panw-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
            MDF ROI by Partner
          </h3>
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Partner</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tier</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Allocated</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Reimbursed</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Revenue</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">ROI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(data?.by_partner ?? []).map((p) => (
                  <tr key={p.organization_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.name}</td>
                    <td className="px-4 py-3"><TierBadge name={p.tier_name} size="sm" /></td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                      {formatCompactCurrency(p.total_allocated)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                      {formatCompactCurrency(p.total_reimbursed)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                      {formatCompactCurrency(p.associated_revenue)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                      {p.roi_ratio != null ? `${p.roi_ratio.toFixed(1)}x` : 'N/A'}
                    </td>
                  </tr>
                ))}
                {(data?.by_partner ?? []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                      No MDF data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {data?.summary.roi_ratio != null && (
          <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
            <p className="text-xs text-gray-400">
              Revenue correlated within 90 days of MDF activity. Not a causal measurement.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
