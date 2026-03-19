import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  usePendingDeals,
  usePendingQuotes,
  usePendingMdfRequests,
} from '../../hooks/useAdmin';
import { dealsApi } from '../../api/deals';
import { quotesApi } from '../../api/quotes';
import { mdfApi } from '../../api/mdf';
import { getApiErrorMessage } from '../../api/client';
import {
  PageHeader,
  StatusBadge,
  Modal,
  FormField,
  Input,
  Textarea,
  DataTable,
  type Column,
} from '../../components/shared';
import { formatCurrency, formatDate, humanize } from '../../utils/formatters';
import { cn } from '../../utils/cn';
import {
  CheckIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline';
import type { Deal, Quote, MdfRequest } from '../../types';

type ApprovalTab = 'deals' | 'quotes' | 'mdf';

const TABS: { key: ApprovalTab; label: string; icon: React.ElementType }[] = [
  { key: 'deals', label: 'Deal Approvals', icon: CurrencyDollarIcon },
  { key: 'quotes', label: 'Quote Approvals', icon: DocumentTextIcon },
  { key: 'mdf', label: 'MDF Approvals', icon: BanknotesIcon },
];

export function ApprovalsPage() {
  const [activeTab, setActiveTab] = useState<ApprovalTab>('deals');

  const { data: dealsData } = usePendingDeals({ per_page: 1 });
  const { data: quotesData } = usePendingQuotes({ per_page: 1 });
  const { data: mdfData } = usePendingMdfRequests({ per_page: 1 });

  const counts: Record<ApprovalTab, number> = {
    deals: dealsData?.meta?.total ?? 0,
    quotes: quotesData?.meta?.total ?? 0,
    mdf: mdfData?.meta?.total ?? 0,
  };

  return (
    <div>
      <PageHeader
        title="Approvals"
        subtitle="Review and approve pending submissions"
        breadcrumbs={[{ label: 'Admin', to: '/' }, { label: 'Approvals' }]}
      />

      {/* Tab navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6 -mb-px" aria-label="Approval tabs">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'inline-flex items-center gap-2 whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium transition-colors',
                  activeTab === tab.key
                    ? 'border-navy-900 text-panw-navy'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                {counts[tab.key] > 0 && (
                  <span
                    className={cn(
                      'ml-1 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold',
                      activeTab === tab.key
                        ? 'bg-navy-100 text-panw-navy'
                        : 'bg-gray-100 text-gray-600'
                    )}
                  >
                    {counts[tab.key]}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {activeTab === 'deals' && <DealApprovalsTab />}
      {activeTab === 'quotes' && <QuoteApprovalsTab />}
      {activeTab === 'mdf' && <MdfApprovalsTab />}
    </div>
  );
}

// ============================================================
// Deal Approvals Tab
// ============================================================
function DealApprovalsTab() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const { data: dealsData, isLoading } = usePendingDeals({
    page,
    per_page: 20,
    sort: 'created_at:asc',
  });

  const deals = dealsData?.data ?? [];
  const meta = dealsData?.meta;

  // Approve/Reject modals
  const [approveTarget, setApproveTarget] = useState<Deal | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Deal | null>(null);
  const [comments, setComments] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['admin'] });
    queryClient.invalidateQueries({ queryKey: ['deals'] });
  }, [queryClient]);

  const approveMutation = useMutation({
    mutationFn: (id: string) =>
      dealsApi.approve(id, { comments: comments || undefined }),
    onSuccess: () => {
      toast.success('Deal approved');
      setApproveTarget(null);
      setComments('');
      invalidate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) =>
      dealsApi.reject(id, { rejection_reason: rejectReason }),
    onSuccess: () => {
      toast.success('Deal rejected');
      setRejectTarget(null);
      setRejectReason('');
      invalidate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

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
        key: 'organization_name',
        header: 'Partner',
        render: (row) => (
          <span className="text-gray-600">{row.organization_name ?? '-'}</span>
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
        key: 'is_conflicting',
        header: 'Conflicts',
        render: (row) =>
          row.is_conflicting ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">
              <ExclamationTriangleIcon className="h-3.5 w-3.5" />
              Yes
            </span>
          ) : (
            <span className="text-xs text-gray-400">None</span>
          ),
      },
      {
        key: 'created_at',
        header: 'Submitted',
        render: (row) => (
          <span className="text-gray-500 text-xs">{formatDate(row.created_at)}</span>
        ),
      },
      {
        key: 'actions',
        header: '',
        className: 'text-right',
        render: (row) => (
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setApproveTarget(row);
              }}
              className="inline-flex items-center gap-1 rounded-md bg-green-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-green-600"
            >
              <CheckIcon className="h-3.5 w-3.5" />
              Approve
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setRejectTarget(row);
              }}
              className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-300 hover:bg-red-50"
            >
              <XMarkIcon className="h-3.5 w-3.5" />
              Reject
            </button>
          </div>
        ),
      },
    ],
    []
  );

  return (
    <>
      <DataTable<Deal>
        columns={columns}
        data={deals}
        loading={isLoading}
        meta={meta}
        onPageChange={setPage}
        rowKey={(row) => row.id}
        onRowClick={(row) => navigate(`/deals/${row.id}`)}
        emptyTitle="No pending deal approvals"
        emptyDescription="All deals have been reviewed."
      />

      {/* Approve Modal */}
      <Modal
        open={!!approveTarget}
        onClose={() => setApproveTarget(null)}
        title="Approve Deal Registration"
      >
        <div className="space-y-4">
          {approveTarget && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <p>
                <span className="font-semibold">{approveTarget.deal_number}</span> -{' '}
                {approveTarget.customer_company_name}
              </p>
              <p className="text-gray-600 mt-0.5">
                Value: {formatCurrency(approveTarget.estimated_value)} | Partner:{' '}
                {approveTarget.organization_name}
              </p>
            </div>
          )}
          {approveTarget?.is_conflicting && (
            <div className="flex items-start gap-2 rounded-lg bg-yellow-50 border border-yellow-200 p-3">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-800">
                This deal has conflicts. Document your conflict resolution rationale
                in the comments.
              </p>
            </div>
          )}
          <FormField label="Comments (optional)" htmlFor="deal-approve-comments">
            <Textarea
              id="deal-approve-comments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={3}
              placeholder="Add any notes..."
            />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setApproveTarget(null)}
              className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => approveTarget && approveMutation.mutate(approveTarget.id)}
              disabled={approveMutation.isPending}
              className="rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600 disabled:opacity-50"
            >
              {approveMutation.isPending ? 'Approving...' : 'Approve Deal'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title="Reject Deal Registration"
      >
        <div className="space-y-4">
          {rejectTarget && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <p>
                <span className="font-semibold">{rejectTarget.deal_number}</span> -{' '}
                {rejectTarget.customer_company_name}
              </p>
            </div>
          )}
          <FormField label="Rejection Reason" htmlFor="deal-reject-reason" required>
            <Textarea
              id="deal-reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Explain why this deal is being rejected..."
            />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setRejectTarget(null)}
              className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (!rejectReason.trim()) {
                  toast.error('Rejection reason is required');
                  return;
                }
                if (rejectTarget) rejectMutation.mutate(rejectTarget.id);
              }}
              disabled={rejectMutation.isPending}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
            >
              {rejectMutation.isPending ? 'Rejecting...' : 'Reject Deal'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

// ============================================================
// Quote Approvals Tab
// ============================================================
function QuoteApprovalsTab() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const { data: quotesData, isLoading } = usePendingQuotes({
    page,
    per_page: 20,
    sort: 'created_at:asc',
  });

  const quotes = quotesData?.data ?? [];
  const meta = quotesData?.meta;

  const [approveTarget, setApproveTarget] = useState<Quote | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Quote | null>(null);
  const [comments, setComments] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['admin'] });
    queryClient.invalidateQueries({ queryKey: ['quotes'] });
  }, [queryClient]);

  const approveMutation = useMutation({
    mutationFn: (id: string) =>
      quotesApi.approve(id, { comments: comments || undefined }),
    onSuccess: () => {
      toast.success('Quote approved');
      setApproveTarget(null);
      setComments('');
      invalidate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) =>
      quotesApi.reject(id, { rejection_reason: rejectReason }),
    onSuccess: () => {
      toast.success('Quote rejected');
      setRejectTarget(null);
      setRejectReason('');
      invalidate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

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
        key: 'organization_name',
        header: 'Partner',
        render: (row) => (
          <span className="text-gray-600">{row.organization_name ?? '-'}</span>
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
        key: 'discount_pct',
        header: 'Discount',
        className: 'text-right',
        render: (row) => {
          const pct = row.subtotal > 0 ? (row.total_discount / row.subtotal) * 100 : 0;
          return (
            <span
              className={cn(
                'font-medium',
                pct > 30 ? 'text-red-600' : pct > 20 ? 'text-amber-600' : 'text-gray-700'
              )}
            >
              {pct.toFixed(1)}%
            </span>
          );
        },
      },
      {
        key: 'created_at',
        header: 'Submitted',
        render: (row) => (
          <span className="text-gray-500 text-xs">{formatDate(row.created_at)}</span>
        ),
      },
      {
        key: 'actions',
        header: '',
        className: 'text-right',
        render: (row) => (
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setApproveTarget(row);
              }}
              className="inline-flex items-center gap-1 rounded-md bg-green-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-green-600"
            >
              <CheckIcon className="h-3.5 w-3.5" />
              Approve
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setRejectTarget(row);
              }}
              className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-300 hover:bg-red-50"
            >
              <XMarkIcon className="h-3.5 w-3.5" />
              Reject
            </button>
          </div>
        ),
      },
    ],
    []
  );

  return (
    <>
      <DataTable<Quote>
        columns={columns}
        data={quotes}
        loading={isLoading}
        meta={meta}
        onPageChange={setPage}
        rowKey={(row) => row.id}
        onRowClick={(row) => navigate(`/quotes/${row.id}`)}
        emptyTitle="No pending quote approvals"
        emptyDescription="All quotes have been reviewed."
      />

      {/* Approve Modal */}
      <Modal
        open={!!approveTarget}
        onClose={() => setApproveTarget(null)}
        title="Approve Quote"
      >
        <div className="space-y-4">
          {approveTarget && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <p>
                <span className="font-semibold">{approveTarget.quote_number}</span> -{' '}
                {approveTarget.customer_name}
              </p>
              <p className="text-gray-600 mt-0.5">
                Total: {formatCurrency(approveTarget.total_amount)} | Partner:{' '}
                {approveTarget.organization_name}
              </p>
            </div>
          )}
          <FormField label="Comments (optional)" htmlFor="quote-approve-comments">
            <Textarea
              id="quote-approve-comments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={3}
              placeholder="Add any notes..."
            />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setApproveTarget(null)}
              className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => approveTarget && approveMutation.mutate(approveTarget.id)}
              disabled={approveMutation.isPending}
              className="rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600 disabled:opacity-50"
            >
              {approveMutation.isPending ? 'Approving...' : 'Approve Quote'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title="Reject Quote"
      >
        <div className="space-y-4">
          {rejectTarget && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <p>
                <span className="font-semibold">{rejectTarget.quote_number}</span> -{' '}
                {rejectTarget.customer_name}
              </p>
            </div>
          )}
          <FormField label="Rejection Reason" htmlFor="quote-reject-reason" required>
            <Textarea
              id="quote-reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Explain why this quote is being rejected..."
            />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setRejectTarget(null)}
              className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (!rejectReason.trim()) {
                  toast.error('Rejection reason is required');
                  return;
                }
                if (rejectTarget) rejectMutation.mutate(rejectTarget.id);
              }}
              disabled={rejectMutation.isPending}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
            >
              {rejectMutation.isPending ? 'Rejecting...' : 'Reject Quote'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

// ============================================================
// MDF Approvals Tab
// ============================================================
function MdfApprovalsTab() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const { data: mdfData, isLoading } = usePendingMdfRequests({
    page,
    per_page: 20,
    sort: 'created_at:asc',
  });

  const requests = mdfData?.data ?? [];
  const meta = mdfData?.meta;

  const [approveTarget, setApproveTarget] = useState<MdfRequest | null>(null);
  const [rejectTarget, setRejectTarget] = useState<MdfRequest | null>(null);
  const [approvedAmount, setApprovedAmount] = useState('');
  const [comments, setComments] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['admin'] });
    queryClient.invalidateQueries({ queryKey: ['mdf'] });
  }, [queryClient]);

  const approveMutation = useMutation({
    mutationFn: (id: string) =>
      mdfApi.approveRequest(id, {
        approved_amount: approvedAmount ? Number(approvedAmount) : undefined,
        comments: comments || undefined,
      }),
    onSuccess: () => {
      toast.success('MDF request approved');
      setApproveTarget(null);
      setApprovedAmount('');
      setComments('');
      invalidate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) =>
      mdfApi.rejectRequest(id, { rejection_reason: rejectReason }),
    onSuccess: () => {
      toast.success('MDF request rejected');
      setRejectTarget(null);
      setRejectReason('');
      invalidate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const columns = useMemo<Column<MdfRequest>[]>(
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
        key: 'organization_name',
        header: 'Partner',
        render: (row) => (
          <span className="text-gray-600">{row.organization_name ?? '-'}</span>
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
        key: 'start_date',
        header: 'Dates',
        render: (row) => (
          <span className="text-gray-500 text-xs">
            {formatDate(row.start_date)} - {formatDate(row.end_date)}
          </span>
        ),
      },
      {
        key: 'actions',
        header: '',
        className: 'text-right',
        render: (row) => (
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setApprovedAmount(String(row.requested_amount));
                setApproveTarget(row);
              }}
              className="inline-flex items-center gap-1 rounded-md bg-green-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-green-600"
            >
              <CheckIcon className="h-3.5 w-3.5" />
              Approve
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setRejectTarget(row);
              }}
              className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-300 hover:bg-red-50"
            >
              <XMarkIcon className="h-3.5 w-3.5" />
              Reject
            </button>
          </div>
        ),
      },
    ],
    []
  );

  return (
    <>
      <DataTable<MdfRequest>
        columns={columns}
        data={requests}
        loading={isLoading}
        meta={meta}
        onPageChange={setPage}
        rowKey={(row) => row.id}
        onRowClick={(row) => navigate(`/mdf/requests/${row.id}`)}
        emptyTitle="No pending MDF approvals"
        emptyDescription="All MDF requests have been reviewed."
      />

      {/* Approve Modal */}
      <Modal
        open={!!approveTarget}
        onClose={() => setApproveTarget(null)}
        title="Approve MDF Request"
      >
        <div className="space-y-4">
          {approveTarget && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <p>
                <span className="font-semibold">{approveTarget.request_number}</span> -{' '}
                {approveTarget.activity_name}
              </p>
              <p className="text-gray-600 mt-0.5">
                Requested: {formatCurrency(approveTarget.requested_amount)} | Partner:{' '}
                {approveTarget.organization_name}
              </p>
            </div>
          )}
          <FormField label="Approved Amount (USD)" htmlFor="mdf-approved-amount">
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                $
              </span>
              <Input
                id="mdf-approved-amount"
                type="number"
                min="0"
                value={approvedAmount}
                onChange={(e) => setApprovedAmount(e.target.value)}
                className="pl-7"
              />
            </div>
          </FormField>
          <FormField label="Comments (optional)" htmlFor="mdf-approve-comments">
            <Textarea
              id="mdf-approve-comments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={3}
              placeholder="Add any notes..."
            />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setApproveTarget(null)}
              className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => approveTarget && approveMutation.mutate(approveTarget.id)}
              disabled={approveMutation.isPending}
              className="rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600 disabled:opacity-50"
            >
              {approveMutation.isPending ? 'Approving...' : 'Approve Request'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title="Reject MDF Request"
      >
        <div className="space-y-4">
          {rejectTarget && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <p>
                <span className="font-semibold">{rejectTarget.request_number}</span> -{' '}
                {rejectTarget.activity_name}
              </p>
            </div>
          )}
          <FormField label="Rejection Reason" htmlFor="mdf-reject-reason" required>
            <Textarea
              id="mdf-reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Explain why this request is being rejected..."
            />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setRejectTarget(null)}
              className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (!rejectReason.trim()) {
                  toast.error('Rejection reason is required');
                  return;
                }
                if (rejectTarget) rejectMutation.mutate(rejectTarget.id);
              }}
              disabled={rejectMutation.isPending}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
            >
              {rejectMutation.isPending ? 'Rejecting...' : 'Reject Request'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
