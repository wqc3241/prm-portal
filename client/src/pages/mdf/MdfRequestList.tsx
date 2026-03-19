import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useMdfRequests } from '../../hooks/useMdf';
import {
  PageHeader,
  SearchBar,
  StatusBadge,
  DataTable,
  type Column,
} from '../../components/shared';
import { formatCurrency, formatDate, humanize } from '../../utils/formatters';
import { cn } from '../../utils/cn';
import { PlusIcon, CurrencyDollarIcon } from '@heroicons/react/24/solid';
import type { MdfRequest, MdfRequestStatus, MdfRequestQueryParams } from '../../types';

const STATUS_TABS: { label: string; value: MdfRequestStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Submitted', value: 'submitted' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Completed', value: 'completed' },
  { label: 'Claim Submitted', value: 'claim_submitted' },
  { label: 'Claim Approved', value: 'claim_approved' },
  { label: 'Reimbursed', value: 'reimbursed' },
];

export function MdfRequestList() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const isInternal = hasRole('admin', 'channel_manager');

  const [statusFilter, setStatusFilter] = useState<MdfRequestStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<string>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [showAmountFilter, setShowAmountFilter] = useState(false);

  const params = useMemo<MdfRequestQueryParams>(() => {
    const p: MdfRequestQueryParams = {
      page,
      per_page: 25,
      sort: `${sortKey}:${sortDir}`,
    };
    if (statusFilter !== 'all') p.status = statusFilter;
    if (search) p.search = search;
    return p;
  }, [page, sortKey, sortDir, statusFilter, search]);

  const { data: requestsData, isLoading } = useMdfRequests(params);
  const requests = requestsData?.data ?? [];
  const meta = requestsData?.meta;

  const handleSearch = useCallback((query: string) => {
    setSearch(query);
    setPage(1);
  }, []);

  const handleSort = useCallback((key: string, direction: 'asc' | 'desc') => {
    setSortKey(key);
    setSortDir(direction);
    setPage(1);
  }, []);

  const handleStatusChange = useCallback((status: MdfRequestStatus | 'all') => {
    setStatusFilter(status);
    setPage(1);
  }, []);

  // Filter by amount on the client side (if API doesn't support it directly)
  const filteredRequests = useMemo(() => {
    let data = requests;
    if (minAmount) {
      data = data.filter((r) => r.requested_amount >= Number(minAmount));
    }
    if (maxAmount) {
      data = data.filter((r) => r.requested_amount <= Number(maxAmount));
    }
    return data;
  }, [requests, minAmount, maxAmount]);

  // Count pending items for CM/admin
  const pendingCount = useMemo(
    () => requests.filter((r) => r.status === 'submitted' || r.status === 'claim_submitted').length,
    [requests]
  );

  const columns = useMemo<Column<MdfRequest>[]>(() => {
    const cols: Column<MdfRequest>[] = [
      {
        key: 'request_number',
        header: 'Request #',
        render: (row) => (
          <span className="font-mono text-xs text-gray-900">
            {row.request_number}
          </span>
        ),
      },
      {
        key: 'activity_type',
        header: 'Activity Type',
        sortable: true,
        render: (row) => (
          <span className="text-gray-700">{humanize(row.activity_type)}</span>
        ),
      },
      {
        key: 'activity_name',
        header: 'Title',
        render: (row) => (
          <span className="font-medium text-gray-900 max-w-[200px] truncate block">
            {row.activity_name}
          </span>
        ),
      },
      {
        key: 'requested_amount',
        header: 'Amount',
        sortable: true,
        className: 'text-right',
        render: (row) => (
          <div className="text-right">
            <span className="font-semibold text-gray-900">
              {formatCurrency(row.requested_amount)}
            </span>
            {row.approved_amount !== null && row.approved_amount !== row.requested_amount && (
              <p className="text-xs text-green-700">
                Approved: {formatCurrency(row.approved_amount)}
              </p>
            )}
          </div>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        sortable: true,
        render: (row) => <StatusBadge status={row.status} />,
      },
      {
        key: 'start_date',
        header: 'Activity Dates',
        sortable: true,
        render: (row) => (
          <span className="text-gray-500 text-xs">
            {formatDate(row.start_date)} - {formatDate(row.end_date)}
          </span>
        ),
      },
    ];

    if (isInternal) {
      cols.splice(2, 0, {
        key: 'organization_name',
        header: 'Partner',
        sortable: true,
        render: (row) => (
          <span className="text-gray-600">{row.organization_name ?? '-'}</span>
        ),
      });
    }

    cols.push({
      key: 'created_at',
      header: 'Created',
      sortable: true,
      render: (row) => (
        <span className="text-gray-500 text-xs">{formatDate(row.created_at)}</span>
      ),
    });

    return cols;
  }, [isInternal]);

  return (
    <div>
      <PageHeader
        title="MDF Requests"
        subtitle="Manage market development fund requests"
        breadcrumbs={[
          { label: 'MDF', to: '/mdf' },
          { label: 'Requests' },
        ]}
        actions={
          hasRole('partner_admin', 'partner_rep') ? (
            <button
              onClick={() => navigate('/mdf/requests/new')}
              className="inline-flex items-center gap-2 rounded-md bg-panw-blue px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-panw-navy transition-colors"
            >
              <PlusIcon className="h-4 w-4" />
              New Request
            </button>
          ) : undefined
        }
      />

      {/* Pending approvals banner for CM/admin */}
      {isInternal && pendingCount > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-yellow-50 border border-yellow-200 p-3">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-yellow-500 text-white text-xs font-bold">
            {pendingCount}
          </span>
          <span className="text-sm font-medium text-yellow-800">
            {pendingCount} request{pendingCount !== 1 ? 's' : ''} awaiting your review
          </span>
          <button
            onClick={() => handleStatusChange('submitted')}
            className="ml-auto text-sm font-medium text-yellow-900 underline hover:no-underline"
          >
            View pending
          </button>
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

      {/* Search and filters row */}
      <div className="mb-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <SearchBar
          placeholder="Search by request number, activity name..."
          onSearch={handleSearch}
          className="w-full sm:max-w-md"
        />

        <button
          onClick={() => setShowAmountFilter((v) => !v)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium ring-1 ring-inset ring-gray-300 transition-colors',
            showAmountFilter
              ? 'bg-navy-50 text-panw-navy ring-navy-300'
              : 'bg-white text-gray-700 hover:bg-gray-50'
          )}
        >
          <CurrencyDollarIcon className="h-4 w-4" />
          Amount Filter
        </button>

        {showAmountFilter && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="Min"
              value={minAmount}
              onChange={(e) => {
                setMinAmount(e.target.value);
                setPage(1);
              }}
              className="w-28 rounded-md border-0 py-1.5 px-2.5 text-sm text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-panw-blue"
            />
            <span className="text-gray-400 text-sm">to</span>
            <input
              type="number"
              placeholder="Max"
              value={maxAmount}
              onChange={(e) => {
                setMaxAmount(e.target.value);
                setPage(1);
              }}
              className="w-28 rounded-md border-0 py-1.5 px-2.5 text-sm text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-panw-blue"
            />
          </div>
        )}
      </div>

      {/* Data Table */}
      <DataTable<MdfRequest>
        columns={columns}
        data={filteredRequests}
        loading={isLoading}
        meta={meta}
        onPageChange={setPage}
        onSort={handleSort}
        rowKey={(row) => row.id}
        onRowClick={(row) => navigate(`/mdf/requests/${row.id}`)}
        emptyTitle="No MDF requests found"
        emptyDescription={
          search || statusFilter !== 'all'
            ? 'Try adjusting your filters or search query.'
            : 'Get started by creating your first MDF request.'
        }
        emptyAction={
          hasRole('partner_admin', 'partner_rep')
            ? { label: 'New Request', onClick: () => navigate('/mdf/requests/new') }
            : undefined
        }
      />
    </div>
  );
}
