import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePartnerList } from '../../hooks/useAdmin';
import {
  PageHeader,
  SearchBar,
  StatusBadge,
  TierBadge,
  DataTable,
  type Column,
} from '../../components/shared';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { cn } from '../../utils/cn';
import { BuildingOfficeIcon } from '@heroicons/react/24/outline';
import type { Organization, OrgQueryParams, OrgStatus } from '../../types';

const STATUS_TABS: { label: string; value: OrgStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Pending', value: 'pending_approval' },
  { label: 'Prospect', value: 'prospect' },
  { label: 'Suspended', value: 'suspended' },
  { label: 'Churned', value: 'churned' },
];

export function PartnerList() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<OrgStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<string>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const params = useMemo<OrgQueryParams>(() => {
    const p: OrgQueryParams = {
      page,
      per_page: 25,
    };
    if (statusFilter !== 'all') p.status = statusFilter;
    if (search) p.search = search;
    return p;
  }, [page, statusFilter, search]);

  const { data: orgsData, isLoading } = usePartnerList(params);
  const organizations = orgsData?.data ?? [];
  const meta = orgsData?.meta;

  const handleSearch = useCallback((query: string) => {
    setSearch(query);
    setPage(1);
  }, []);

  const handleSort = useCallback((key: string, direction: 'asc' | 'desc') => {
    setSortKey(key);
    setSortDir(direction);
    setPage(1);
  }, []);

  const handleStatusChange = useCallback((status: OrgStatus | 'all') => {
    setStatusFilter(status);
    setPage(1);
  }, []);

  const columns = useMemo<Column<Organization>[]>(
    () => [
      {
        key: 'name',
        header: 'Partner Name',
        sortable: true,
        render: (row) => (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-100 text-navy-800 text-xs font-bold">
              {row.name.charAt(0).toUpperCase()}
            </div>
            <span className="font-medium text-gray-900">{row.name}</span>
          </div>
        ),
      },
      {
        key: 'tier',
        header: 'Tier',
        render: (row) =>
          row.tier ? (
            <TierBadge name={row.tier.name} size="sm" />
          ) : (
            <span className="text-xs text-gray-400">Untiered</span>
          ),
      },
      {
        key: 'status',
        header: 'Status',
        sortable: true,
        render: (row) => <StatusBadge status={row.status} />,
      },
      {
        key: 'ytd_revenue',
        header: 'YTD Revenue',
        sortable: true,
        className: 'text-right',
        render: (row) => (
          <span className="font-semibold text-gray-900">
            {formatCurrency(row.ytd_revenue)}
          </span>
        ),
      },
      {
        key: 'ytd_deals_closed',
        header: 'Deals Closed',
        sortable: true,
        className: 'text-right',
        render: (row) => (
          <span className="text-gray-700">{row.ytd_deals_closed}</span>
        ),
      },
      {
        key: 'certified_rep_count',
        header: 'Certified Reps',
        className: 'text-right',
        render: (row) => (
          <span className="text-gray-700">{row.certified_rep_count}</span>
        ),
      },
      {
        key: 'created_at',
        header: 'Joined',
        sortable: true,
        render: (row) => (
          <span className="text-gray-500 text-xs">{formatDate(row.created_at)}</span>
        ),
      },
    ],
    []
  );

  return (
    <div>
      <PageHeader
        title="Partner Management"
        subtitle="View and manage all partner organizations"
        breadcrumbs={[{ label: 'Admin', to: '/' }, { label: 'Partners' }]}
      />

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

      {/* Search */}
      <div className="mb-4">
        <SearchBar
          placeholder="Search partners by name..."
          onSearch={handleSearch}
          className="w-full sm:max-w-md"
        />
      </div>

      {/* Data Table */}
      <DataTable<Organization>
        columns={columns}
        data={organizations}
        loading={isLoading}
        meta={meta}
        onPageChange={setPage}
        onSort={handleSort}
        rowKey={(row) => row.id}
        onRowClick={(row) => navigate(`/admin/partners/${row.id}`)}
        emptyTitle="No partners found"
        emptyDescription={
          search || statusFilter !== 'all'
            ? 'Try adjusting your filters or search query.'
            : 'No partner organizations exist yet.'
        }
      />
    </div>
  );
}
