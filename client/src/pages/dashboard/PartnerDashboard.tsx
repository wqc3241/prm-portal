import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePartnerDashboard } from '../../hooks/useDashboard';
import { PageHeader } from '../../components/shared/PageHeader';
import { TierBadge } from '../../components/shared/TierBadge';
import {
  StatCard,
  DonutChart,
  BarChartWidget,
  TierProgressBar,
  DEAL_STATUS_COLORS,
  MDF_COLORS,
  formatCompactCurrency,
} from '../../components/charts';
import { formatDate } from '../../utils/formatters';
import {
  CurrencyDollarIcon,
  DocumentTextIcon,
  UserGroupIcon,
  BanknotesIcon,
  PlusIcon,
  EyeIcon,
  AcademicCapIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

export function PartnerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = usePartnerDashboard();

  if (isError) {
    return (
      <div>
        <PageHeader
          title={`Welcome back, ${user?.first_name}`}
          subtitle="Partner Portal Dashboard"
        />
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ExclamationTriangleIcon className="h-12 w-12 text-red-400 mb-4" />
          <h3 className="text-sm font-semibold text-gray-900">
            Failed to load dashboard
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Something went wrong while loading your dashboard data.
          </p>
          <button
            onClick={() => refetch()}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-panw-blue px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-panw-navy transition-colors"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Prepare chart data
  const dealStatusData = (data?.pipeline.by_status ?? [])
    .filter((s) => s.count > 0)
    .map((s) => ({
      name: s.status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      value: s.count,
    }));

  const dealStatusColors = (data?.pipeline.by_status ?? [])
    .filter((s) => s.count > 0)
    .map((s) => DEAL_STATUS_COLORS[s.status] ?? '#94A3B8');

  const leadChartData = data
    ? [
        {
          name: 'Leads',
          Assigned: data.leads.assigned,
          Accepted: data.leads.accepted,
          Converted: data.leads.converted,
          Disqualified: data.leads.disqualified,
        },
      ]
    : [];

  const mdfData = data
    ? [
        { name: 'Approved', value: data.mdf.current_quarter.approved },
        { name: 'Claimed', value: data.mdf.current_quarter.claimed },
        { name: 'Remaining', value: data.mdf.current_quarter.remaining },
      ].filter((d) => d.value > 0)
    : [];

  const mdfColors = [MDF_COLORS.approved, MDF_COLORS.claimed, MDF_COLORS.remaining];

  const tierProgressMetrics = data?.tier_progress?.next_tier
    ? [
        {
          label: 'Revenue',
          current: data.tier_progress.current_metrics.ytd_revenue,
          target: data.tier_progress.next_tier.requirements.min_annual_revenue,
          formatValue: formatCompactCurrency,
        },
        {
          label: 'Deals Closed',
          current: data.tier_progress.current_metrics.ytd_deals_closed,
          target: data.tier_progress.next_tier.requirements.min_deals_closed,
        },
        {
          label: 'Certified Reps',
          current: data.tier_progress.current_metrics.certified_reps,
          target: data.tier_progress.next_tier.requirements.min_certified_reps,
        },
      ]
    : [];

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${user?.first_name}`}
        subtitle={
          user?.role === 'partner_admin'
            ? 'Partner Administration Dashboard'
            : 'Partner Portal Dashboard'
        }
      />

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={CurrencyDollarIcon}
          label="Pipeline Value"
          value={formatCompactCurrency(data?.pipeline.total_value ?? 0)}
          change={`${data?.pipeline.deal_count ?? 0} active deals`}
          color="text-green-600 bg-green-50"
          loading={isLoading}
        />
        <StatCard
          icon={DocumentTextIcon}
          label="Active Deals"
          value={String(data?.deals.total_active ?? 0)}
          change={`${data?.deals.submitted ?? 0} pending`}
          color="text-blue-600 bg-blue-50"
          loading={isLoading}
        />
        <StatCard
          icon={UserGroupIcon}
          label="Open Leads"
          value={String(data?.leads.assigned ?? 0)}
          change={`${data?.leads.conversion_rate ?? 0}% conversion`}
          color="text-purple-600 bg-purple-50"
          loading={isLoading}
        />
        <StatCard
          icon={BanknotesIcon}
          label="MDF Remaining"
          value={formatCompactCurrency(data?.mdf.current_quarter.remaining ?? 0)}
          change={`Q${data?.mdf.current_quarter.fiscal_quarter ?? ''} ${data?.mdf.current_quarter.fiscal_year ?? ''}`}
          color="text-amber-600 bg-amber-50"
          loading={isLoading}
        />
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => navigate('/deals/new')}
            className="inline-flex items-center gap-2 rounded-md bg-panw-blue px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-panw-navy transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
            New Deal
          </button>
          <button
            onClick={() => navigate('/quotes/new')}
            className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
            New Quote
          </button>
          <button
            onClick={() => navigate('/leads')}
            className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors"
          >
            <EyeIcon className="h-4 w-4" />
            View Leads
          </button>
          <button
            onClick={() => navigate('/mdf/requests/new')}
            className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors"
          >
            <BanknotesIcon className="h-4 w-4" />
            MDF Request
          </button>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <DonutChart
          title="Deal Status Breakdown"
          data={dealStatusData}
          colors={dealStatusColors}
          centerValue={String(data?.pipeline.deal_count ?? 0)}
          centerLabel="Total Deals"
          loading={isLoading}
        />
        <BarChartWidget
          title="Lead Performance"
          data={leadChartData}
          xKey="name"
          bars={[
            { dataKey: 'Assigned', color: '#3B82F6', label: 'Assigned' },
            { dataKey: 'Accepted', color: '#22C55E', label: 'Accepted' },
            { dataKey: 'Converted', color: '#059669', label: 'Converted' },
            { dataKey: 'Disqualified', color: '#EF4444', label: 'Disqualified' },
          ]}
          loading={isLoading}
        />
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <DonutChart
          title="MDF Utilization"
          data={mdfData}
          colors={mdfColors}
          centerValue={formatCompactCurrency(data?.mdf.current_quarter.allocated ?? 0)}
          centerLabel="Allocated"
          loading={isLoading}
        />

        {/* Tier Progress */}
        {data?.tier_progress?.next_tier ? (
          <TierProgressBar
            title={
              `Tier Progress: ${data.tier_progress.current_tier.name} → ${data.tier_progress.next_tier.name}`
            }
            metrics={tierProgressMetrics}
            loading={isLoading}
          />
        ) : (
          <div className="bg-white rounded-lg shadow-panw border border-panw-gray-100 p-6">
            <h3 className="text-sm font-semibold text-panw-gray-500 uppercase tracking-wider mb-4">
              Tier Status
            </h3>
            {isLoading ? (
              <div className="animate-pulse space-y-3">
                <div className="h-6 bg-gray-200 rounded w-24" />
                <div className="h-4 bg-gray-200 rounded w-48" />
              </div>
            ) : (
              <div className="flex flex-col items-center py-4">
                <TierBadge
                  name={data?.tier_progress?.current_tier?.name ?? 'Unknown'}
                  size="lg"
                />
                <p className="text-sm text-gray-500 mt-3">
                  You are at the highest tier level.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom row: Certifications + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expiring Certifications */}
        <div className="bg-white rounded-lg shadow-panw border border-panw-gray-100 p-6">
          <h3 className="text-sm font-semibold text-panw-gray-500 uppercase tracking-wider mb-4">
            Certifications
          </h3>
          {isLoading ? (
            <div className="animate-pulse space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-4 bg-gray-200 rounded" />
              ))}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <AcademicCapIcon className="h-5 w-5 text-green-500" />
                  <span className="text-sm font-medium text-gray-700">
                    {data?.certifications.total_certified ?? 0} / {data?.certifications.total_users ?? 0} certified
                  </span>
                </div>
                {(data?.certifications.expiring_within_30_days ?? 0) > 0 && (
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                    {data?.certifications.expiring_within_30_days} expiring soon
                  </span>
                )}
              </div>
              {(data?.certifications.expiring_certs ?? []).length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {data!.certifications.expiring_certs.map((cert) => {
                    const daysLeft = Math.ceil(
                      (new Date(cert.expires_at).getTime() - Date.now()) /
                        (1000 * 60 * 60 * 24)
                    );
                    return (
                      <div
                        key={`${cert.user_id}-${cert.course_name}`}
                        className="py-2 flex items-center justify-between"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {cert.user_name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {cert.course_name}
                          </p>
                        </div>
                        <span
                          className={`text-xs font-medium ${
                            daysLeft <= 7 ? 'text-red-600' : 'text-amber-600'
                          }`}
                        >
                          {daysLeft > 0 ? `${daysLeft}d left` : 'Expired'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">
                  No certifications expiring soon
                </p>
              )}
            </>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow-panw border border-panw-gray-100 p-6">
          <h3 className="text-sm font-semibold text-panw-gray-500 uppercase tracking-wider mb-4">
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
                    <p className="text-sm text-gray-700 truncate">
                      {item.summary}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatDate(item.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">
              No recent activity
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
