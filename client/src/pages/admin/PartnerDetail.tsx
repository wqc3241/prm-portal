import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  usePartnerDetail,
  usePartnerUsers,
  usePartnerDeals,
  usePartnerQuotes,
  usePartnerLeads,
  usePartnerMdfRequests,
  usePartnerMdfAllocations,
  usePartnerCertifications,
} from '../../hooks/useAdmin';
import {
  PageHeader,
  StatusBadge,
  TierBadge,
  DataTable,
  Skeleton,
  CardSkeleton,
  type Column,
} from '../../components/shared';
import { StatCard } from '../../components/charts';
import { formatCurrency, formatDate, formatPercent, humanize } from '../../utils/formatters';
import { cn } from '../../utils/cn';
import {
  CurrencyDollarIcon,
  ChartBarIcon,
  UserGroupIcon,
  AcademicCapIcon,
  BuildingOfficeIcon,
  EnvelopeIcon,
  PhoneIcon,
  GlobeAltIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline';
import type {
  Deal,
  Quote,
  Lead,
  MdfRequest,
  MdfAllocation,
  User,
} from '../../types';
import type { Certification } from '../../types/course';

type Tab = 'overview' | 'deals' | 'quotes' | 'leads' | 'mdf' | 'users' | 'certifications';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'deals', label: 'Deals' },
  { key: 'quotes', label: 'Quotes' },
  { key: 'leads', label: 'Leads' },
  { key: 'mdf', label: 'MDF' },
  { key: 'users', label: 'Users' },
  { key: 'certifications', label: 'Certifications' },
];

export function PartnerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const { data: org, isLoading: orgLoading, isError } = usePartnerDetail(id!);

  if (orgLoading) {
    return (
      <div>
        <div className="mb-6">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  if (isError || !org) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Partner not found
        </h2>
        <p className="text-gray-500 mb-4">
          This organization does not exist or you do not have access.
        </p>
        <button
          onClick={() => navigate('/admin/partners')}
          className="text-sm font-medium text-panw-navy hover:text-panw-blue"
        >
          Back to Partners
        </button>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={org.name}
        breadcrumbs={[
          { label: 'Admin', to: '/' },
          { label: 'Partners', to: '/admin/partners' },
          { label: org.name },
        ]}
        actions={
          <div className="flex items-center gap-3">
            {org.tier && <TierBadge name={org.tier.name} size="md" />}
            <StatusBadge status={org.status} size="md" />
          </div>
        }
      />

      {/* Contact info bar */}
      <div className="mb-6 flex flex-wrap gap-4 text-sm text-gray-600">
        {org.website && (
          <span className="inline-flex items-center gap-1">
            <GlobeAltIcon className="h-4 w-4 text-gray-400" />
            {org.website}
          </span>
        )}
        {org.phone && (
          <span className="inline-flex items-center gap-1">
            <PhoneIcon className="h-4 w-4 text-gray-400" />
            {org.phone}
          </span>
        )}
        {org.domain && (
          <span className="inline-flex items-center gap-1">
            <EnvelopeIcon className="h-4 w-4 text-gray-400" />
            {org.domain}
          </span>
        )}
        {(org.city || org.state_province || org.country) && (
          <span className="inline-flex items-center gap-1">
            <MapPinIcon className="h-4 w-4 text-gray-400" />
            {[org.city, org.state_province, org.country].filter(Boolean).join(', ')}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6 -mb-px" aria-label="Tabs">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium transition-colors',
                activeTab === tab.key
                  ? 'border-navy-900 text-panw-navy'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && <OverviewTab orgId={id!} org={org} />}
      {activeTab === 'deals' && <DealsTab orgId={id!} />}
      {activeTab === 'quotes' && <QuotesTab orgId={id!} />}
      {activeTab === 'leads' && <LeadsTab orgId={id!} />}
      {activeTab === 'mdf' && <MdfTab orgId={id!} />}
      {activeTab === 'users' && <UsersTab orgId={id!} />}
      {activeTab === 'certifications' && <CertificationsTab orgId={id!} />}
    </div>
  );
}

// ============================================================
// Overview Tab
// ============================================================
function OverviewTab({ orgId, org }: { orgId: string; org: NonNullable<ReturnType<typeof usePartnerDetail>['data']> }) {
  const { data: dealsData } = usePartnerDeals(orgId, { per_page: 1 });
  const { data: leadsData } = usePartnerLeads(orgId, { per_page: 1 });
  const { data: usersData } = usePartnerUsers(orgId);
  const { data: allocData } = usePartnerMdfAllocations(orgId);

  const totalDeals = dealsData?.meta?.total ?? 0;
  const totalLeads = leadsData?.meta?.total ?? 0;
  const totalUsers = usersData?.length ?? 0;
  const totalMdfAllocated = (allocData?.data ?? []).reduce(
    (sum, a) => sum + a.allocated_amount,
    0
  );
  const totalMdfSpent = (allocData?.data ?? []).reduce(
    (sum, a) => sum + a.spent_amount,
    0
  );

  return (
    <div className="space-y-6">
      {/* Scorecard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={CurrencyDollarIcon}
          label="YTD Revenue"
          value={formatCurrency(org.ytd_revenue)}
          change={`${org.ytd_deals_closed} deals closed`}
          color="text-green-600 bg-green-50"
        />
        <StatCard
          icon={ChartBarIcon}
          label="Total Deals"
          value={String(totalDeals)}
          change={`${org.ytd_deals_closed} won this year`}
          color="text-blue-600 bg-blue-50"
        />
        <StatCard
          icon={UserGroupIcon}
          label="Team Size"
          value={String(totalUsers)}
          change={`${org.certified_rep_count} certified`}
          color="text-purple-600 bg-purple-50"
        />
        <StatCard
          icon={AcademicCapIcon}
          label="MDF Allocated"
          value={formatCurrency(totalMdfAllocated)}
          change={`${formatCurrency(totalMdfSpent)} spent`}
          color="text-amber-600 bg-amber-50"
        />
      </div>

      {/* Organization info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <InfoCard title="Organization Details">
          <div className="grid grid-cols-2 gap-4">
            <InfoField label="Industry" value={org.industry} />
            <InfoField label="Employee Count" value={org.employee_count ? String(org.employee_count) : null} />
            <InfoField label="Address" value={[org.address_line1, org.address_line2].filter(Boolean).join(', ') || null} />
            <InfoField label="Postal Code" value={org.postal_code} />
            <InfoField label="Channel Manager" value={org.channel_manager_id ? 'Assigned' : 'Unassigned'} />
            <InfoField label="Member Since" value={formatDate(org.created_at)} />
          </div>
          {org.notes && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-500 mb-1">Notes</p>
              <p className="text-sm text-gray-700">{org.notes}</p>
            </div>
          )}
        </InfoCard>

        {/* Tier Progress */}
        <InfoCard title="Tier Information">
          <div className="grid grid-cols-2 gap-4">
            <InfoField
              label="Current Tier"
              value={org.tier?.name ?? 'Untiered'}
            />
            <InfoField
              label="Default Discount"
              value={org.tier ? `${org.tier.default_discount_pct}%` : '-'}
            />
            <InfoField
              label="Max Discount"
              value={org.tier ? `${org.tier.max_discount_pct}%` : '-'}
            />
            <InfoField
              label="MDF Budget %"
              value={org.tier ? `${org.tier.mdf_budget_pct}%` : '-'}
            />
            <InfoField
              label="Lead Priority"
              value={org.tier ? String(org.tier.lead_priority) : '-'}
            />
            <InfoField
              label="Dedicated CM"
              value={org.tier?.dedicated_channel_mgr ? 'Yes' : 'No'}
            />
          </div>
        </InfoCard>
      </div>
    </div>
  );
}

// ============================================================
// Deals Tab
// ============================================================
function DealsTab({ orgId }: { orgId: string }) {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const { data: dealsData, isLoading } = usePartnerDeals(orgId, {
    page,
    per_page: 15,
    sort: 'created_at:desc',
  });

  const deals = dealsData?.data ?? [];
  const meta = dealsData?.meta;

  const columns = useMemo<Column<Deal>[]>(
    () => [
      {
        key: 'deal_number',
        header: 'Deal #',
        render: (row) => (
          <span className="font-mono text-xs text-gray-900">{row.deal_number}</span>
        ),
      },
      {
        key: 'customer_company_name',
        header: 'Customer',
        render: (row) => (
          <span className="font-medium text-gray-900">{row.customer_company_name}</span>
        ),
      },
      {
        key: 'estimated_value',
        header: 'Value',
        className: 'text-right',
        render: (row) => (
          <span className="font-semibold text-gray-900">
            {formatCurrency(row.estimated_value)}
          </span>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (row) => <StatusBadge status={row.status} />,
      },
      {
        key: 'created_at',
        header: 'Created',
        render: (row) => (
          <span className="text-gray-500 text-xs">{formatDate(row.created_at)}</span>
        ),
      },
    ],
    []
  );

  return (
    <DataTable<Deal>
      columns={columns}
      data={deals}
      loading={isLoading}
      meta={meta}
      onPageChange={setPage}
      rowKey={(row) => row.id}
      onRowClick={(row) => navigate(`/deals/${row.id}`)}
      emptyTitle="No deals"
      emptyDescription="This partner has no deal registrations."
    />
  );
}

// ============================================================
// Quotes Tab
// ============================================================
function QuotesTab({ orgId }: { orgId: string }) {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const { data: quotesData, isLoading } = usePartnerQuotes(orgId, {
    page,
    per_page: 15,
    sort: 'created_at:desc',
  });

  const quotes = quotesData?.data ?? [];
  const meta = quotesData?.meta;

  const columns = useMemo<Column<Quote>[]>(
    () => [
      {
        key: 'quote_number',
        header: 'Quote #',
        render: (row) => (
          <span className="font-mono text-xs text-gray-900">{row.quote_number}</span>
        ),
      },
      {
        key: 'customer_name',
        header: 'Customer',
        render: (row) => (
          <span className="font-medium text-gray-900">{row.customer_name}</span>
        ),
      },
      {
        key: 'total_amount',
        header: 'Total',
        className: 'text-right',
        render: (row) => (
          <span className="font-semibold text-gray-900">
            {formatCurrency(row.total_amount)}
          </span>
        ),
      },
      {
        key: 'total_discount',
        header: 'Discount',
        className: 'text-right',
        render: (row) => {
          const pct = row.subtotal > 0 ? (row.total_discount / row.subtotal) * 100 : 0;
          return <span className="text-gray-700">{pct.toFixed(1)}%</span>;
        },
      },
      {
        key: 'status',
        header: 'Status',
        render: (row) => <StatusBadge status={row.status} />,
      },
      {
        key: 'created_at',
        header: 'Created',
        render: (row) => (
          <span className="text-gray-500 text-xs">{formatDate(row.created_at)}</span>
        ),
      },
    ],
    []
  );

  return (
    <DataTable<Quote>
      columns={columns}
      data={quotes}
      loading={isLoading}
      meta={meta}
      onPageChange={setPage}
      rowKey={(row) => row.id}
      onRowClick={(row) => navigate(`/quotes/${row.id}`)}
      emptyTitle="No quotes"
      emptyDescription="This partner has no quotes."
    />
  );
}

// ============================================================
// Leads Tab
// ============================================================
function LeadsTab({ orgId }: { orgId: string }) {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const { data: leadsData, isLoading } = usePartnerLeads(orgId, {
    page,
    per_page: 15,
    sort: 'created_at:desc',
  });

  const leads = leadsData?.data ?? [];
  const meta = leadsData?.meta;

  const columns = useMemo<Column<Lead>[]>(
    () => [
      {
        key: 'lead_number',
        header: 'Lead #',
        render: (row) => (
          <span className="font-mono text-xs text-gray-900">{row.lead_number}</span>
        ),
      },
      {
        key: 'name',
        header: 'Name',
        render: (row) => (
          <span className="font-medium text-gray-900">
            {row.first_name} {row.last_name}
          </span>
        ),
      },
      {
        key: 'company_name',
        header: 'Company',
        render: (row) => (
          <span className="text-gray-700">{row.company_name ?? '-'}</span>
        ),
      },
      {
        key: 'score',
        header: 'Score',
        className: 'text-right',
        render: (row) => (
          <span className="font-semibold text-gray-900">{row.score}</span>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (row) => <StatusBadge status={row.status} />,
      },
      {
        key: 'created_at',
        header: 'Created',
        render: (row) => (
          <span className="text-gray-500 text-xs">{formatDate(row.created_at)}</span>
        ),
      },
    ],
    []
  );

  return (
    <DataTable<Lead>
      columns={columns}
      data={leads}
      loading={isLoading}
      meta={meta}
      onPageChange={setPage}
      rowKey={(row) => row.id}
      onRowClick={(row) => navigate(`/leads/${row.id}`)}
      emptyTitle="No leads"
      emptyDescription="This partner has no assigned leads."
    />
  );
}

// ============================================================
// MDF Tab
// ============================================================
function MdfTab({ orgId }: { orgId: string }) {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const { data: allocData, isLoading: allocLoading } = usePartnerMdfAllocations(orgId);
  const { data: reqData, isLoading: reqLoading } = usePartnerMdfRequests(orgId, {
    page,
    per_page: 15,
    sort: 'created_at:desc',
  });

  const allocations = allocData?.data ?? [];
  const requests = reqData?.data ?? [];
  const reqMeta = reqData?.meta;

  const allocColumns = useMemo<Column<MdfAllocation>[]>(
    () => [
      {
        key: 'period',
        header: 'Period',
        render: (row) => (
          <span className="font-medium text-gray-900">
            FY{row.fiscal_year} Q{row.fiscal_quarter}
          </span>
        ),
      },
      {
        key: 'allocated_amount',
        header: 'Allocated',
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
          <span className="text-gray-700">{formatCurrency(row.spent_amount)}</span>
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
              row.remaining_amount > 0 ? 'text-green-700' : 'text-gray-500'
            )}
          >
            {formatCurrency(row.remaining_amount)}
          </span>
        ),
      },
    ],
    []
  );

  const reqColumns = useMemo<Column<MdfRequest>[]>(
    () => [
      {
        key: 'request_number',
        header: 'Request #',
        render: (row) => (
          <span className="font-mono text-xs text-gray-900">{row.request_number}</span>
        ),
      },
      {
        key: 'activity_name',
        header: 'Activity',
        render: (row) => (
          <span className="font-medium text-gray-900">{row.activity_name}</span>
        ),
      },
      {
        key: 'activity_type',
        header: 'Type',
        render: (row) => (
          <span className="text-gray-700">{humanize(row.activity_type)}</span>
        ),
      },
      {
        key: 'requested_amount',
        header: 'Amount',
        className: 'text-right',
        render: (row) => (
          <span className="font-semibold text-gray-900">
            {formatCurrency(row.requested_amount)}
          </span>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (row) => <StatusBadge status={row.status} />,
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      {/* Allocation Summary */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">
          MDF Allocations
        </h3>
        <DataTable<MdfAllocation>
          columns={allocColumns}
          data={allocations}
          loading={allocLoading}
          rowKey={(row) => row.id}
          emptyTitle="No allocations"
          emptyDescription="No MDF allocations for this partner."
        />
      </div>

      {/* Requests */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">
          MDF Requests
        </h3>
        <DataTable<MdfRequest>
          columns={reqColumns}
          data={requests}
          loading={reqLoading}
          meta={reqMeta}
          onPageChange={setPage}
          rowKey={(row) => row.id}
          onRowClick={(row) => navigate(`/mdf/requests/${row.id}`)}
          emptyTitle="No requests"
          emptyDescription="No MDF requests from this partner."
        />
      </div>
    </div>
  );
}

// ============================================================
// Users Tab
// ============================================================
function UsersTab({ orgId }: { orgId: string }) {
  const { data: users, isLoading } = usePartnerUsers(orgId);

  const columns = useMemo<Column<User>[]>(
    () => [
      {
        key: 'name',
        header: 'Name',
        render: (row) => (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-100 text-navy-800 text-xs font-bold">
              {row.first_name.charAt(0)}
              {row.last_name.charAt(0)}
            </div>
            <div>
              <span className="font-medium text-gray-900 block">
                {row.first_name} {row.last_name}
              </span>
              <span className="text-xs text-gray-500">{row.email}</span>
            </div>
          </div>
        ),
      },
      {
        key: 'role',
        header: 'Role',
        render: (row) => (
          <StatusBadge status={row.role} variant="info" />
        ),
      },
      {
        key: 'title',
        header: 'Title',
        render: (row) => (
          <span className="text-gray-700">{row.title ?? '-'}</span>
        ),
      },
      {
        key: 'is_active',
        header: 'Active',
        render: (row) => (
          <StatusBadge
            status={row.is_active ? 'active' : 'suspended'}
          />
        ),
      },
      {
        key: 'last_login_at',
        header: 'Last Login',
        render: (row) => (
          <span className="text-gray-500 text-xs">
            {row.last_login_at ? formatDate(row.last_login_at) : 'Never'}
          </span>
        ),
      },
    ],
    []
  );

  return (
    <DataTable<User>
      columns={columns}
      data={users ?? []}
      loading={isLoading}
      rowKey={(row) => row.id}
      emptyTitle="No users"
      emptyDescription="This partner has no registered users."
    />
  );
}

// ============================================================
// Certifications Tab
// ============================================================
function CertificationsTab({ orgId }: { orgId: string }) {
  const [page, setPage] = useState(1);
  const { data: certData, isLoading } = usePartnerCertifications(orgId, {
    page,
    per_page: 15,
    sort: 'created_at:desc',
  });

  const certs = certData?.data ?? [];
  const meta = certData?.meta;

  const totalPassed = certs.filter((c) => c.status === 'passed').length;
  const totalEnrolled = certs.length;

  const columns = useMemo<Column<Certification>[]>(
    () => [
      {
        key: 'user_name',
        header: 'User',
        render: (row) => (
          <span className="font-medium text-gray-900">{row.user_name ?? '-'}</span>
        ),
      },
      {
        key: 'course_title',
        header: 'Course',
        render: (row) => (
          <span className="text-gray-700">{row.course_title ?? '-'}</span>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (row) => <StatusBadge status={row.status} />,
      },
      {
        key: 'score',
        header: 'Score',
        className: 'text-right',
        render: (row) => (
          <span className="text-gray-700">{row.score != null ? `${row.score}%` : '-'}</span>
        ),
      },
      {
        key: 'expires_at',
        header: 'Expires',
        render: (row) => (
          <span className="text-gray-500 text-xs">
            {row.expires_at ? formatDate(row.expires_at) : 'N/A'}
          </span>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="flex gap-6 text-sm">
        <div>
          <span className="text-gray-500">Total Enrollments:</span>{' '}
          <span className="font-semibold text-gray-900">{totalEnrolled}</span>
        </div>
        <div>
          <span className="text-gray-500">Passed:</span>{' '}
          <span className="font-semibold text-green-700">{totalPassed}</span>
        </div>
      </div>

      <DataTable<Certification>
        columns={columns}
        data={certs}
        loading={isLoading}
        meta={meta}
        onPageChange={setPage}
        rowKey={(row) => row.id}
        emptyTitle="No certifications"
        emptyDescription="This partner has no certification records."
      />
    </div>
  );
}

// ============================================================
// Shared sub-components
// ============================================================
function InfoCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">{title}</h3>
      {children}
    </div>
  );
}

function InfoField({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="text-sm text-gray-700 mt-0.5">{value ?? '-'}</p>
    </div>
  );
}
