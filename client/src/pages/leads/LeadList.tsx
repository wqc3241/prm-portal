import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useLeads, useBulkAssign } from '../../hooks/useLeads';
import {
  PageHeader,
  SearchBar,
  StatusBadge,
  DataTable,
  Modal,
  FormField,
  Select,
  type Column,
} from '../../components/shared';
import { ScoreBadge } from '../../components/leads/ScoreBadge';
import { SlaIndicator } from '../../components/leads/SlaIndicator';
import { formatDate } from '../../utils/formatters';
import { cn } from '../../utils/cn';
import { PlusIcon, ArrowsRightLeftIcon } from '@heroicons/react/24/solid';
import { useQuery } from '@tanstack/react-query';
import { organizationsApi } from '../../api/organizations';
import type { Lead, LeadStatus, LeadQueryParams } from '../../types';

const STATUS_TABS: { label: string; value: LeadStatus | 'all' | 'unassigned' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Unassigned', value: 'unassigned' },
  { label: 'Assigned', value: 'assigned' },
  { label: 'Accepted', value: 'accepted' },
  { label: 'Working', value: 'working' },
  { label: 'Converted', value: 'converted' },
  { label: 'Returned', value: 'returned' },
  { label: 'Disqualified', value: 'disqualified' },
];

export function LeadList() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const isInternal = hasRole('admin', 'channel_manager');

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<string>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Bulk assign state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [bulkOrgId, setBulkOrgId] = useState('');

  const params = useMemo<LeadQueryParams>(() => {
    const p: LeadQueryParams = {
      page,
      per_page: 25,
      sort: `${sortKey}:${sortDir}`,
    };
    if (statusFilter === 'unassigned') {
      p.status = 'new,returned';
    } else if (statusFilter !== 'all') {
      p.status = statusFilter;
    }
    if (search) p.search = search;
    return p;
  }, [page, sortKey, sortDir, statusFilter, search]);

  const { data: leadsResponse, isLoading } = useLeads(params);
  const leads = leadsResponse?.data ?? [];
  const meta = leadsResponse?.meta;

  // Orgs for bulk assign
  const { data: orgsData } = useQuery({
    queryKey: ['organizations-for-assign'],
    queryFn: async () => {
      const { data } = await organizationsApi.list({ status: 'active' as any, per_page: 200 });
      return data.data;
    },
    enabled: bulkAssignOpen,
  });

  const bulkAssignMutation = useBulkAssign();

  const handleSearch = useCallback((query: string) => {
    setSearch(query);
    setPage(1);
  }, []);

  const handleSort = useCallback((key: string, direction: 'asc' | 'desc') => {
    setSortKey(key);
    setSortDir(direction);
    setPage(1);
  }, []);

  const handleStatusChange = useCallback((status: string) => {
    setStatusFilter(status);
    setPage(1);
    setSelectedIds(new Set());
  }, []);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selectedIds.size === leads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(leads.map((l) => l.id)));
    }
  }, [leads, selectedIds.size]);

  const handleBulkAssign = useCallback(() => {
    if (!bulkOrgId || selectedIds.size === 0) return;
    bulkAssignMutation.mutate(
      {
        assignments: Array.from(selectedIds).map((lead_id) => ({
          lead_id,
          organization_id: bulkOrgId,
        })),
      },
      {
        onSuccess: () => {
          setBulkAssignOpen(false);
          setBulkOrgId('');
          setSelectedIds(new Set());
        },
      }
    );
  }, [bulkOrgId, selectedIds, bulkAssignMutation]);

  const columns = useMemo<Column<Lead>[]>(() => {
    const cols: Column<Lead>[] = [];

    // Checkbox column for internal users
    if (isInternal) {
      cols.push({
        key: '_select',
        header: '',
        render: (row) => (
          <input
            type="checkbox"
            checked={selectedIds.has(row.id)}
            onChange={(e) => {
              e.stopPropagation();
              toggleSelection(row.id);
            }}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 rounded border-gray-300 text-panw-navy focus:ring-panw-blue"
          />
        ),
      });
    }

    cols.push(
      {
        key: 'lead_number',
        header: 'Lead #',
        render: (row) => (
          <span className="font-mono text-xs text-gray-900">
            {row.lead_number}
          </span>
        ),
      },
      {
        key: 'company_name',
        header: 'Company',
        sortable: true,
        render: (row) => (
          <div>
            <span className="font-medium text-gray-900">
              {row.company_name || '-'}
            </span>
            <p className="text-xs text-gray-500 mt-0.5">
              {row.first_name} {row.last_name}
            </p>
          </div>
        ),
      },
      {
        key: 'score',
        header: 'Score',
        sortable: true,
        render: (row) => <ScoreBadge score={row.score} />,
      },
      {
        key: 'status',
        header: 'Status',
        sortable: true,
        render: (row) => <StatusBadge status={row.status} />,
      },
      {
        key: 'sla_deadline',
        header: 'SLA',
        render: (row) => <SlaIndicator deadline={row.sla_deadline} status={row.status} />,
      }
    );

    if (isInternal) {
      cols.push({
        key: 'assigned_org_name',
        header: 'Assigned Partner',
        render: (row) => (
          <span className="text-gray-600 text-sm">
            {row.assigned_org_name ?? '-'}
          </span>
        ),
      });
    }

    cols.push(
      {
        key: 'source',
        header: 'Source',
        render: (row) => (
          <span className="text-gray-500 text-xs capitalize">
            {row.source ?? '-'}
          </span>
        ),
      },
      {
        key: 'created_at',
        header: 'Created',
        sortable: true,
        render: (row) => (
          <span className="text-gray-500 text-xs">{formatDate(row.created_at)}</span>
        ),
      }
    );

    return cols;
  }, [isInternal, selectedIds, toggleSelection]);

  return (
    <div>
      <PageHeader
        title="Leads"
        subtitle="Manage and track partner lead distribution"
        breadcrumbs={[{ label: 'Leads' }]}
        actions={
          <div className="flex items-center gap-2">
            {isInternal && selectedIds.size > 0 && (
              <button
                onClick={() => setBulkAssignOpen(true)}
                className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors"
              >
                <ArrowsRightLeftIcon className="h-4 w-4" />
                Assign ({selectedIds.size})
              </button>
            )}
            {isInternal && (
              <button
                onClick={() => navigate('/leads/new')}
                className="inline-flex items-center gap-2 rounded-md bg-panw-blue px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-panw-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panw-blue transition-colors"
              >
                <PlusIcon className="h-4 w-4" />
                New Lead
              </button>
            )}
          </div>
        }
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

      {/* Search row */}
      <div className="mb-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <SearchBar
          placeholder="Search by name, company, email..."
          onSearch={handleSearch}
          className="w-full sm:max-w-md"
        />

        {isInternal && leads.length > 0 && (
          <button
            onClick={toggleAll}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            {selectedIds.size === leads.length ? 'Deselect all' : 'Select all'}
          </button>
        )}
      </div>

      {/* Data Table */}
      <DataTable<Lead>
        columns={columns}
        data={leads}
        loading={isLoading}
        meta={meta}
        onPageChange={setPage}
        onSort={handleSort}
        rowKey={(row) => row.id}
        onRowClick={(row) => navigate(`/leads/${row.id}`)}
        emptyTitle="No leads found"
        emptyDescription={
          search || statusFilter !== 'all'
            ? 'Try adjusting your filters or search query.'
            : 'No leads have been created yet.'
        }
        emptyAction={
          isInternal
            ? { label: 'Create Lead', onClick: () => navigate('/leads/new') }
            : undefined
        }
      />

      {/* Bulk Assign Modal */}
      <Modal
        open={bulkAssignOpen}
        onClose={() => setBulkAssignOpen(false)}
        title={`Assign ${selectedIds.size} Lead${selectedIds.size > 1 ? 's' : ''}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Select a partner organization to assign the selected leads to.
          </p>
          <FormField label="Partner Organization" htmlFor="bulk-org" required>
            <Select
              id="bulk-org"
              value={bulkOrgId}
              onChange={(e) => setBulkOrgId(e.target.value)}
            >
              <option value="">Select organization...</option>
              {(orgsData ?? []).map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name} {org.tier?.name ? `(${org.tier.name})` : ''}
                </option>
              ))}
            </Select>
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setBulkAssignOpen(false)}
              className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleBulkAssign}
              disabled={!bulkOrgId || bulkAssignMutation.isPending}
              className="rounded-md bg-panw-blue px-4 py-2 text-sm font-semibold text-white hover:bg-panw-navy disabled:opacity-50"
            >
              {bulkAssignMutation.isPending ? 'Assigning...' : 'Assign Leads'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
