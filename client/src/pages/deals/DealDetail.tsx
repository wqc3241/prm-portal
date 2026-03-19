import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { dealsApi } from '../../api/deals';
import { productsApi } from '../../api/products';
import { getApiErrorMessage } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import {
  PageHeader,
  StatusBadge,
  Modal,
  FormField,
  Input,
  Textarea,
  Skeleton,
  CardSkeleton,
} from '../../components/shared';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatPercent,
  humanize,
} from '../../utils/formatters';
import { cn } from '../../utils/cn';
import {
  PencilSquareIcon,
  PaperAirplaneIcon,
  CheckIcon,
  XMarkIcon,
  TrophyIcon,
  HandThumbDownIcon,
  ExclamationTriangleIcon,
  TrashIcon,
  PlusIcon,
  ClockIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import type {
  Deal,
  DealConflict,
  DealStatusHistory,
  DealStatus,
  Product,
  AddDealProductRequest,
} from '../../types';

export function DealDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, hasRole } = useAuth();
  const isInternal = hasRole('admin', 'channel_manager');
  const isPartner = hasRole('partner_admin', 'partner_rep');

  // Modals
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [wonModalOpen, setWonModalOpen] = useState(false);
  const [lostModalOpen, setLostModalOpen] = useState(false);
  const [addProductModalOpen, setAddProductModalOpen] = useState(false);

  // Form state for modals
  const [approveComments, setApproveComments] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [actualValue, setActualValue] = useState('');
  const [actualCloseDate, setActualCloseDate] = useState('');
  const [lossReason, setLossReason] = useState('');

  // Product add state
  const [productSearch, setProductSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [addQty, setAddQty] = useState('1');
  const [addPrice, setAddPrice] = useState('');
  const [addDiscount, setAddDiscount] = useState('0');

  // ---- Queries ----
  const {
    data: dealData,
    isLoading: dealLoading,
    isError: dealError,
  } = useQuery({
    queryKey: ['deal', id],
    queryFn: async () => {
      const { data } = await dealsApi.getById(id!);
      return data.data;
    },
    enabled: !!id,
  });

  const { data: conflicts } = useQuery({
    queryKey: ['deal-conflicts', id],
    queryFn: async () => {
      const { data } = await dealsApi.getConflicts(id!);
      return data.data;
    },
    enabled: !!id && !!dealData?.is_conflicting,
  });

  const { data: history } = useQuery({
    queryKey: ['deal-history', id],
    queryFn: async () => {
      const { data } = await dealsApi.getHistory(id!);
      return data.data;
    },
    enabled: !!id,
  });

  const { data: productsForAdd } = useQuery({
    queryKey: ['products-for-deal', productSearch],
    queryFn: async () => {
      const { data } = await productsApi.list({
        search: productSearch || undefined,
        is_active: true,
        per_page: 20,
      });
      return data.data;
    },
    enabled: addProductModalOpen,
  });

  const deal = dealData;
  const isEditable =
    deal?.status === 'draft' || deal?.status === 'rejected';
  const canSubmit =
    isPartner && deal?.status === 'draft';
  const canResubmit =
    isPartner && deal?.status === 'rejected';
  const canApproveReject =
    isInternal &&
    (deal?.status === 'submitted' || deal?.status === 'under_review');
  const canMarkWonLost =
    isPartner && deal?.status === 'approved';
  const canEditProducts = isEditable && isPartner;

  // ---- Mutations ----
  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['deal', id] });
    queryClient.invalidateQueries({ queryKey: ['deal-history', id] });
    queryClient.invalidateQueries({ queryKey: ['deal-conflicts', id] });
    queryClient.invalidateQueries({ queryKey: ['deals'] });
  }, [queryClient, id]);

  const submitMutation = useMutation({
    mutationFn: () => dealsApi.submit(id!),
    onSuccess: () => {
      toast.success('Deal submitted for review');
      invalidateAll();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const approveMutation = useMutation({
    mutationFn: () =>
      dealsApi.approve(id!, {
        comments: approveComments || undefined,
      }),
    onSuccess: () => {
      toast.success('Deal approved');
      setApproveModalOpen(false);
      setApproveComments('');
      invalidateAll();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const rejectMutation = useMutation({
    mutationFn: () =>
      dealsApi.reject(id!, { rejection_reason: rejectReason }),
    onSuccess: () => {
      toast.success('Deal rejected');
      setRejectModalOpen(false);
      setRejectReason('');
      invalidateAll();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const wonMutation = useMutation({
    mutationFn: () =>
      dealsApi.markWon(id!, {
        actual_value: Number(actualValue),
        actual_close_date: actualCloseDate || undefined,
      }),
    onSuccess: () => {
      toast.success('Deal marked as won! Tier recalculation triggered.');
      setWonModalOpen(false);
      invalidateAll();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const lostMutation = useMutation({
    mutationFn: () =>
      dealsApi.markLost(id!, { loss_reason: lossReason }),
    onSuccess: () => {
      toast.success('Deal marked as lost');
      setLostModalOpen(false);
      invalidateAll();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const addProductMutation = useMutation({
    mutationFn: (data: AddDealProductRequest) =>
      dealsApi.addProduct(id!, data),
    onSuccess: () => {
      toast.success('Product added');
      setAddProductModalOpen(false);
      setSelectedProduct(null);
      setProductSearch('');
      setAddQty('1');
      setAddPrice('');
      setAddDiscount('0');
      invalidateAll();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  const removeProductMutation = useMutation({
    mutationFn: (productId: string) => dealsApi.removeProduct(id!, productId),
    onSuccess: () => {
      toast.success('Product removed');
      invalidateAll();
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

  // ---- Loading/Error states ----
  if (dealLoading) {
    return (
      <div>
        <div className="mb-6">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  if (dealError || !deal) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Deal not found
        </h2>
        <p className="text-gray-500 mb-4">
          This deal does not exist or you do not have access to it.
        </p>
        <button
          onClick={() => navigate('/deals')}
          className="text-sm font-medium text-panw-navy hover:text-panw-blue"
        >
          Back to Deals
        </button>
      </div>
    );
  }

  const daysUntilExpiry = deal.registration_expires_at
    ? Math.ceil(
        (new Date(deal.registration_expires_at).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24)
      )
    : null;

  return (
    <div>
      <PageHeader
        title={deal.deal_name}
        subtitle={deal.deal_number}
        breadcrumbs={[
          { label: 'Deals', to: '/deals' },
          { label: deal.deal_number },
        ]}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {/* Partner actions */}
            {isEditable && isPartner && (
              <button
                onClick={() => navigate(`/deals/${id}/edit`)}
                className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
              >
                <PencilSquareIcon className="h-4 w-4" />
                Edit
              </button>
            )}
            {(canSubmit || canResubmit) && (
              <button
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-md bg-panw-blue px-3 py-2 text-sm font-semibold text-white hover:bg-panw-navy shadow-sm disabled:opacity-50"
              >
                <PaperAirplaneIcon className="h-4 w-4" />
                {submitMutation.isPending
                  ? 'Submitting...'
                  : canResubmit
                  ? 'Resubmit'
                  : 'Submit'}
              </button>
            )}
            {canMarkWonLost && (
              <>
                <button
                  onClick={() => {
                    setActualValue(String(deal.estimated_value));
                    setActualCloseDate(new Date().toISOString().split('T')[0]);
                    setWonModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md bg-green-700 px-3 py-2 text-sm font-semibold text-white hover:bg-green-600 shadow-sm"
                >
                  <TrophyIcon className="h-4 w-4" />
                  Mark Won
                </button>
                <button
                  onClick={() => setLostModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-inset ring-red-300 hover:bg-red-50"
                >
                  <HandThumbDownIcon className="h-4 w-4" />
                  Mark Lost
                </button>
              </>
            )}

            {/* CM/Admin actions */}
            {canApproveReject && (
              <>
                <button
                  onClick={() => setApproveModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-green-700 px-3 py-2 text-sm font-semibold text-white hover:bg-green-600 shadow-sm"
                >
                  <CheckIcon className="h-4 w-4" />
                  Approve
                </button>
                <button
                  onClick={() => setRejectModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-inset ring-red-300 hover:bg-red-50"
                >
                  <XMarkIcon className="h-4 w-4" />
                  Reject
                </button>
              </>
            )}
          </div>
        }
      />

      {/* Status + Conflict badges */}
      <div className="flex items-center gap-3 mb-4 -mt-4">
        <StatusBadge status={deal.status} size="md" />
        {deal.is_conflicting && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">
            <ExclamationTriangleIcon className="h-3.5 w-3.5" />
            Conflicts
          </span>
        )}
      </div>

      {/* Expiry warning */}
      {deal.status === 'approved' && daysUntilExpiry !== null && daysUntilExpiry <= 14 && (
        <div
          className={cn(
            'mb-4 flex items-center gap-2 rounded-lg border p-3',
            daysUntilExpiry <= 7
              ? 'bg-red-50 border-red-200'
              : 'bg-yellow-50 border-yellow-200'
          )}
        >
          <ClockIcon
            className={cn(
              'h-5 w-5 flex-shrink-0',
              daysUntilExpiry <= 7 ? 'text-red-600' : 'text-yellow-600'
            )}
          />
          <span
            className={cn(
              'text-sm font-medium',
              daysUntilExpiry <= 7 ? 'text-red-800' : 'text-yellow-800'
            )}
          >
            Deal protection expires in {daysUntilExpiry} day{daysUntilExpiry !== 1 ? 's' : ''}{' '}
            ({formatDate(deal.registration_expires_at)})
          </span>
        </div>
      )}

      {/* Rejection reason */}
      {deal.status === 'rejected' && deal.rejection_reason && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3">
          <XMarkIcon className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Rejection Reason</p>
            <p className="text-sm text-red-700 mt-0.5">{deal.rejection_reason}</p>
          </div>
        </div>
      )}

      {/* Conflict panel */}
      {deal.is_conflicting && conflicts && conflicts.length > 0 && (
        <div className="mb-4 rounded-lg bg-yellow-50 border border-yellow-200 p-4">
          <div className="flex items-start gap-2 mb-3">
            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-yellow-800">
                Channel Conflict Detected
              </p>
              <p className="text-xs text-yellow-700 mt-0.5">
                This deal has potential conflicts with existing registrations from other partners.
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {conflicts.map((c) => (
              <ConflictCard key={c.conflicting_deal_id} conflict={c} />
            ))}
          </div>
        </div>
      )}

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Info cards */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer info card */}
          <InfoCard title="Customer Information">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoField label="Company" value={deal.customer_company_name} />
              <InfoField label="Contact" value={deal.customer_contact_name} />
              <InfoField label="Email" value={deal.customer_contact_email} />
              <InfoField label="Phone" value={deal.customer_contact_phone} />
              <InfoField label="Industry" value={deal.customer_industry} />
              <InfoField label="Address" value={deal.customer_address} />
            </div>
          </InfoCard>

          {/* Deal details card */}
          <InfoCard title="Deal Details">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoField
                label="Estimated Value"
                value={formatCurrency(deal.estimated_value)}
                highlight
              />
              {deal.actual_value !== null && (
                <InfoField
                  label="Actual Value"
                  value={formatCurrency(deal.actual_value)}
                  highlight
                />
              )}
              <InfoField
                label="Expected Close"
                value={formatDate(deal.expected_close_date)}
              />
              {deal.actual_close_date && (
                <InfoField
                  label="Actual Close"
                  value={formatDate(deal.actual_close_date)}
                />
              )}
              <InfoField
                label="Win Probability"
                value={
                  deal.win_probability !== null
                    ? formatPercent(deal.win_probability)
                    : null
                }
              />
              <InfoField
                label="Source"
                value={deal.source ? humanize(deal.source) : null}
              />
              {deal.registration_expires_at && (
                <InfoField
                  label="Protection Expires"
                  value={formatDate(deal.registration_expires_at)}
                />
              )}
              <InfoField label="Currency" value={deal.currency} />
            </div>
            {deal.description && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-500 mb-1">
                  Description
                </p>
                <p className="text-sm text-gray-700">{deal.description}</p>
              </div>
            )}
          </InfoCard>

          {/* Products section */}
          <InfoCard
            title="Products"
            action={
              canEditProducts ? (
                <button
                  onClick={() => setAddProductModalOpen(true)}
                  className="inline-flex items-center gap-1 text-sm font-medium text-panw-navy hover:text-panw-blue"
                >
                  <PlusIcon className="h-4 w-4" />
                  Add Product
                </button>
              ) : undefined
            }
          >
            {deal.products && deal.products.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase pb-2">
                        Product
                      </th>
                      <th className="text-right text-xs font-semibold text-gray-500 uppercase pb-2">
                        Qty
                      </th>
                      <th className="text-right text-xs font-semibold text-gray-500 uppercase pb-2">
                        Price
                      </th>
                      <th className="text-right text-xs font-semibold text-gray-500 uppercase pb-2">
                        Discount
                      </th>
                      <th className="text-right text-xs font-semibold text-gray-500 uppercase pb-2">
                        Total
                      </th>
                      {canEditProducts && <th className="w-8 pb-2" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {deal.products.map((p) => (
                      <tr key={p.id}>
                        <td className="py-2">
                          <div className="text-sm font-medium text-gray-900">
                            {p.product_name}
                          </div>
                          {p.product_sku && (
                            <div className="text-xs text-gray-500 font-mono">
                              {p.product_sku}
                            </div>
                          )}
                        </td>
                        <td className="py-2 text-right text-sm text-gray-700">
                          {p.quantity}
                        </td>
                        <td className="py-2 text-right text-sm text-gray-700">
                          {formatCurrency(p.unit_price)}
                        </td>
                        <td className="py-2 text-right text-sm text-gray-700">
                          {p.discount_pct}%
                        </td>
                        <td className="py-2 text-right text-sm font-semibold text-gray-900">
                          {formatCurrency(p.line_total)}
                        </td>
                        {canEditProducts && (
                          <td className="py-2 text-center">
                            <button
                              onClick={() =>
                                removeProductMutation.mutate(p.product_id)
                              }
                              disabled={removeProductMutation.isPending}
                              className="text-red-400 hover:text-red-600"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                No products added to this deal.
              </p>
            )}
          </InfoCard>

          {/* Internal info (CM/admin) */}
          {isInternal && (
            <InfoCard title="Partner Information">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoField label="Partner Org" value={deal.organization_name} />
                <InfoField label="Submitted By" value={deal.submitted_by_name} />
                {deal.approved_by && (
                  <InfoField
                    label="Approved By"
                    value={deal.assigned_to_name ?? deal.approved_by}
                  />
                )}
                {deal.approved_at && (
                  <InfoField
                    label="Approved At"
                    value={formatDateTime(deal.approved_at)}
                  />
                )}
              </div>
            </InfoCard>
          )}
        </div>

        {/* Right column - Timeline */}
        <div className="space-y-6">
          <InfoCard title="Status History">
            {history && history.length > 0 ? (
              <StatusTimeline history={[...history].reverse()} />
            ) : (
              <div className="flex items-center justify-center py-8">
                <ArrowPathIcon className="h-5 w-5 text-gray-300 animate-spin" />
              </div>
            )}
          </InfoCard>

          {/* Quick info */}
          <InfoCard title="Quick Info">
            <div className="space-y-3">
              <InfoField label="Created" value={formatDateTime(deal.created_at)} />
              <InfoField label="Last Updated" value={formatDateTime(deal.updated_at)} />
              <InfoField label="Deal ID" value={deal.id} />
            </div>
          </InfoCard>
        </div>
      </div>

      {/* ---- Modals ---- */}

      {/* Approve Modal */}
      <Modal
        open={approveModalOpen}
        onClose={() => setApproveModalOpen(false)}
        title="Approve Deal Registration"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Approving this deal will grant 90-day protection to the partner for
            this customer.
          </p>
          {deal.is_conflicting && (
            <div className="flex items-start gap-2 rounded-lg bg-yellow-50 border border-yellow-200 p-3">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-800">
                This deal has conflicts. Please document your conflict resolution
                rationale in the comments.
              </p>
            </div>
          )}
          <FormField label="Comments (optional)" htmlFor="approve-comments">
            <Textarea
              id="approve-comments"
              value={approveComments}
              onChange={(e) => setApproveComments(e.target.value)}
              rows={3}
              placeholder="Add any notes about this approval..."
            />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setApproveModalOpen(false)}
              className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => approveMutation.mutate()}
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
        open={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Reject Deal Registration"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Please provide a reason for rejecting this deal registration. The
            partner will be notified with your feedback.
          </p>
          <FormField
            label="Rejection Reason"
            htmlFor="reject-reason"
            required
            error={
              rejectMutation.isError ? '' : undefined
            }
          >
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Explain why this deal is being rejected..."
              hasError={false}
            />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setRejectModalOpen(false)}
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
                rejectMutation.mutate();
              }}
              disabled={rejectMutation.isPending}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
            >
              {rejectMutation.isPending ? 'Rejecting...' : 'Reject Deal'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Mark Won Modal */}
      <Modal
        open={wonModalOpen}
        onClose={() => setWonModalOpen(false)}
        title="Mark Deal as Won"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Congratulations! Enter the actual deal value and close date to record
            this win.
          </p>
          <FormField
            label="Actual Value (USD)"
            htmlFor="actual-value"
            required
          >
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                $
              </span>
              <Input
                id="actual-value"
                type="number"
                min="0"
                value={actualValue}
                onChange={(e) => setActualValue(e.target.value)}
                className="pl-7"
              />
            </div>
          </FormField>
          <FormField label="Actual Close Date" htmlFor="actual-close-date">
            <Input
              id="actual-close-date"
              type="date"
              value={actualCloseDate}
              onChange={(e) => setActualCloseDate(e.target.value)}
            />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setWonModalOpen(false)}
              className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (!actualValue || Number(actualValue) <= 0) {
                  toast.error('Actual value is required');
                  return;
                }
                wonMutation.mutate();
              }}
              disabled={wonMutation.isPending}
              className="rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600 disabled:opacity-50"
            >
              {wonMutation.isPending ? 'Saving...' : 'Mark as Won'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Mark Lost Modal */}
      <Modal
        open={lostModalOpen}
        onClose={() => setLostModalOpen(false)}
        title="Mark Deal as Lost"
      >
        <div className="space-y-4">
          <FormField label="Loss Reason" htmlFor="loss-reason" required>
            <Textarea
              id="loss-reason"
              value={lossReason}
              onChange={(e) => setLossReason(e.target.value)}
              rows={3}
              placeholder="e.g., Customer chose competitor, budget cut..."
            />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setLostModalOpen(false)}
              className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (!lossReason.trim()) {
                  toast.error('Loss reason is required');
                  return;
                }
                lostMutation.mutate();
              }}
              disabled={lostMutation.isPending}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
            >
              {lostMutation.isPending ? 'Saving...' : 'Mark as Lost'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Add Product Modal */}
      <Modal
        open={addProductModalOpen}
        onClose={() => {
          setAddProductModalOpen(false);
          setSelectedProduct(null);
          setProductSearch('');
        }}
        title="Add Product to Deal"
        size="lg"
      >
        <div className="space-y-4">
          {!selectedProduct ? (
            <>
              <Input
                placeholder="Search products..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
              />
              <div className="max-h-60 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-lg">
                {(productsForAdd ?? [])
                  .filter(
                    (p) =>
                      p.available_to_partners &&
                      !deal.products?.some((dp) => dp.product_id === p.id)
                  )
                  .map((product) => (
                    <button
                      key={product.id}
                      onClick={() => {
                        setSelectedProduct(product);
                        setAddPrice(String(product.list_price));
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between"
                    >
                      <div>
                        <span className="text-sm font-medium text-gray-900">
                          {product.name}
                        </span>
                        <span className="ml-2 text-xs text-gray-500 font-mono">
                          {product.sku}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-gray-700">
                        {formatCurrency(product.list_price)}
                      </span>
                    </button>
                  ))}
                {(productsForAdd ?? []).length === 0 && (
                  <div className="p-4 text-sm text-gray-500 text-center">
                    No products found
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <span className="text-sm font-semibold text-gray-900">
                  {selectedProduct.name}
                </span>
                <span className="ml-2 text-xs text-gray-500 font-mono">
                  {selectedProduct.sku}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <FormField label="Quantity" htmlFor="modal-qty">
                  <Input
                    id="modal-qty"
                    type="number"
                    min="1"
                    value={addQty}
                    onChange={(e) => setAddQty(e.target.value)}
                  />
                </FormField>
                <FormField label="Unit Price" htmlFor="modal-price">
                  <Input
                    id="modal-price"
                    type="number"
                    min="0"
                    value={addPrice}
                    onChange={(e) => setAddPrice(e.target.value)}
                  />
                </FormField>
                <FormField label="Discount %" htmlFor="modal-disc">
                  <Input
                    id="modal-disc"
                    type="number"
                    min="0"
                    max="100"
                    value={addDiscount}
                    onChange={(e) => setAddDiscount(e.target.value)}
                  />
                </FormField>
              </div>
              <p className="text-sm text-gray-600">
                Line total:{' '}
                <span className="font-semibold">
                  {formatCurrency(
                    Number(addQty) *
                      Number(addPrice) *
                      (1 - Number(addDiscount) / 100)
                  )}
                </span>
              </p>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  onClick={() => {
                    if (Number(addQty) < 1) {
                      toast.error('Quantity must be at least 1');
                      return;
                    }
                    addProductMutation.mutate({
                      product_id: selectedProduct.id,
                      quantity: Number(addQty),
                      unit_price: Number(addPrice),
                      discount_pct: Number(addDiscount),
                    });
                  }}
                  disabled={addProductMutation.isPending}
                  className="rounded-md bg-panw-blue px-4 py-2 text-sm font-semibold text-white hover:bg-panw-navy disabled:opacity-50"
                >
                  {addProductMutation.isPending ? 'Adding...' : 'Add Product'}
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

// ---- Sub-components ----

function InfoCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function InfoField({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number | null | undefined;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p
        className={cn(
          'text-sm mt-0.5',
          highlight ? 'font-bold text-gray-900 text-lg' : 'text-gray-700'
        )}
      >
        {value ?? '-'}
      </p>
    </div>
  );
}

function ConflictCard({ conflict }: { conflict: DealConflict }) {
  return (
    <div className="flex items-center justify-between bg-white rounded border border-yellow-100 px-3 py-2">
      <div className="text-sm">
        <span className="font-mono text-xs text-gray-600">
          {conflict.conflicting_deal_number}
        </span>
        <span className="ml-2 text-gray-700">{conflict.conflicting_org_name}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 font-medium">
          {humanize(conflict.match_type)}
        </span>
        <span className="text-xs text-gray-500">
          {(conflict.similarity_score * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

function StatusTimeline({ history }: { history: DealStatusHistory[] }) {
  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {history.map((entry, idx) => {
          const isLast = idx === history.length - 1;
          const statusColor = getStatusTimelineColor(entry.to_status);

          return (
            <li key={entry.id}>
              <div className="relative pb-6">
                {!isLast && (
                  <span
                    className="absolute left-3 top-6 -ml-px h-full w-0.5 bg-gray-200"
                    aria-hidden="true"
                  />
                )}
                <div className="relative flex gap-3">
                  <div>
                    <span
                      className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white',
                        statusColor
                      )}
                    >
                      <span className="h-2 w-2 rounded-full bg-white" />
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm">
                      <span className="font-medium text-gray-900">
                        {entry.from_status
                          ? `${humanize(entry.from_status)} -> ${humanize(entry.to_status)}`
                          : `Created as ${humanize(entry.to_status)}`}
                      </span>
                    </div>
                    {entry.changed_by_name && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        by {entry.changed_by_name}
                      </p>
                    )}
                    {entry.notes && (
                      <p className="text-xs text-gray-600 mt-1 bg-gray-50 rounded px-2 py-1">
                        {entry.notes}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatDateTime(entry.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function getStatusTimelineColor(status: DealStatus): string {
  const map: Record<DealStatus, string> = {
    draft: 'bg-gray-400',
    submitted: 'bg-yellow-500',
    under_review: 'bg-blue-500',
    approved: 'bg-green-500',
    rejected: 'bg-red-500',
    won: 'bg-green-700',
    lost: 'bg-red-700',
    expired: 'bg-gray-600',
  };
  return map[status] ?? 'bg-gray-400';
}
