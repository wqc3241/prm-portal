import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  useQuote,
  useQuoteHistory,
  useSubmitQuote,
  useApproveQuote,
  useRejectQuote,
  useSendQuote,
  useAcceptQuote,
  useCloneQuote,
  useRecalculateQuote,
  useAddLine,
  useUpdateLine,
  useRemoveLine,
} from '../../hooks/useQuotes';
import { quotesApi } from '../../api/quotes';
import { productsApi } from '../../api/products';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
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
import { LineItemRow } from '../../components/quotes/LineItemRow';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  humanize,
} from '../../utils/formatters';
import { cn } from '../../utils/cn';
import {
  PaperAirplaneIcon,
  CheckIcon,
  XMarkIcon,
  DocumentDuplicateIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
  PlusIcon,
  EnvelopeIcon,
  HandThumbUpIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import type { Product, QuoteStatus, AddLineItemRequest } from '../../types';

export function QuoteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const isInternal = hasRole('admin', 'channel_manager');
  const isPartner = hasRole('partner_admin', 'partner_rep');
  const isAdmin = hasRole('admin');

  // Modals
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [addProductOpen, setAddProductOpen] = useState(false);

  // Form state
  const [approveComments, setApproveComments] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  // Product add state
  const [productSearch, setProductSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [addQty, setAddQty] = useState('1');
  const [addDiscountType, setAddDiscountType] = useState<'percentage' | 'fixed_amount'>('percentage');
  const [addDiscountValue, setAddDiscountValue] = useState('0');

  // --- Queries ---
  const {
    data: quote,
    isLoading: quoteLoading,
    isError: quoteError,
  } = useQuote(id);

  const { data: history } = useQuoteHistory(id);

  const { data: productsForAdd } = useQuery({
    queryKey: ['products-for-quote-detail', productSearch],
    queryFn: async () => {
      const { data } = await productsApi.list({
        search: productSearch || undefined,
        is_active: true,
        per_page: 20,
      });
      return data.data;
    },
    enabled: addProductOpen,
  });

  // --- Computed state ---
  const isEditable = quote?.status === 'draft' || quote?.status === 'rejected';
  const isCreator = quote?.created_by === user?.id;
  const canEdit = isEditable && (isCreator || hasRole('partner_admin', 'admin'));
  const canSubmit =
    isPartner &&
    isEditable &&
    (isCreator || hasRole('partner_admin'));
  const canApproveReject = isInternal && quote?.status === 'pending_approval';
  const canSend = (isCreator || hasRole('partner_admin')) && quote?.status === 'approved';
  const canAccept =
    (isCreator || hasRole('partner_admin', 'admin')) &&
    quote?.status === 'sent_to_customer';

  // --- Mutations ---
  const submitMutation = useSubmitQuote(id!);
  const approveMutation = useApproveQuote(id!);
  const rejectMutation = useRejectQuote(id!);
  const sendMutation = useSendQuote(id!);
  const acceptMutation = useAcceptQuote(id!);
  const cloneMutation = useCloneQuote();
  const recalculateMutation = useRecalculateQuote(id!);
  const addLineMutation = useAddLine(id!);
  const updateLineMutation = useUpdateLine(id!);
  const removeLineMutation = useRemoveLine(id!);

  const handleClone = useCallback(async () => {
    try {
      const response = await cloneMutation.mutateAsync(id!);
      const newQuote = response.data.data;
      navigate(`/quotes/${newQuote.id}`);
    } catch {
      // Error handled
    }
  }, [cloneMutation, id, navigate]);

  const handleAddLine = useCallback(async () => {
    if (!selectedProduct) return;
    if (Number(addQty) < 1) {
      toast.error('Quantity must be at least 1');
      return;
    }
    const payload: AddLineItemRequest = {
      product_id: selectedProduct.id,
      quantity: Number(addQty),
      discount_type: addDiscountType,
      discount_value: Number(addDiscountValue),
    };
    try {
      await addLineMutation.mutateAsync(payload);
      setAddProductOpen(false);
      setSelectedProduct(null);
      setProductSearch('');
      setAddQty('1');
      setAddDiscountValue('0');
    } catch {
      // handled
    }
  }, [selectedProduct, addQty, addDiscountType, addDiscountValue, addLineMutation]);

  const handleUpdateLine = useCallback(
    (lineId: string, field: string, value: number | string) => {
      updateLineMutation.mutate({ lineId, data: { [field]: value } });
    },
    [updateLineMutation]
  );

  const handleRemoveLine = useCallback(
    (lineId: string) => {
      removeLineMutation.mutate(lineId);
    },
    [removeLineMutation]
  );

  // --- Loading/Error ---
  if (quoteLoading) {
    return (
      <div>
        <div className="mb-6">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <CardSkeleton />
            <CardSkeleton />
          </div>
          <CardSkeleton />
        </div>
      </div>
    );
  }

  if (quoteError || !quote) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Quote not found
        </h2>
        <p className="text-gray-500 mb-4">
          This quote does not exist or you do not have access to it.
        </p>
        <button
          onClick={() => navigate('/quotes')}
          className="text-sm font-medium text-panw-navy hover:text-panw-blue"
        >
          Back to Quotes
        </button>
      </div>
    );
  }

  const lineItems = quote.line_items ?? [];
  const validUntilDate = new Date(quote.valid_until);
  const isExpiringSoon =
    quote.status !== 'accepted' &&
    quote.status !== 'expired' &&
    validUntilDate < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  return (
    <div>
      <PageHeader
        title={`Quote ${quote.quote_number}`}
        subtitle={quote.customer_name}
        breadcrumbs={[
          { label: 'Quotes', to: '/quotes' },
          { label: quote.quote_number },
        ]}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {/* Partner actions */}
            {canSubmit && (
              <button
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-md bg-panw-blue px-3 py-2 text-sm font-semibold text-white hover:bg-panw-navy shadow-sm disabled:opacity-50"
              >
                <PaperAirplaneIcon className="h-4 w-4" />
                {submitMutation.isPending
                  ? 'Submitting...'
                  : quote.status === 'rejected'
                  ? 'Resubmit'
                  : 'Submit Quote'}
              </button>
            )}

            {canSend && (
              <button
                onClick={() => sendMutation.mutate()}
                disabled={sendMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-md bg-panw-blue px-3 py-2 text-sm font-semibold text-white hover:bg-panw-navy shadow-sm disabled:opacity-50"
              >
                <EnvelopeIcon className="h-4 w-4" />
                {sendMutation.isPending ? 'Sending...' : 'Send to Customer'}
              </button>
            )}

            {canAccept && (
              <button
                onClick={() => acceptMutation.mutate()}
                disabled={acceptMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-md bg-green-700 px-3 py-2 text-sm font-semibold text-white hover:bg-green-600 shadow-sm disabled:opacity-50"
              >
                <HandThumbUpIcon className="h-4 w-4" />
                {acceptMutation.isPending ? 'Accepting...' : 'Mark Accepted'}
              </button>
            )}

            {/* CM/Admin approval actions */}
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

            {/* Recalculate */}
            {canEdit && (
              <button
                onClick={() => recalculateMutation.mutate()}
                disabled={recalculateMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
              >
                <ArrowPathIcon className={cn('h-4 w-4', recalculateMutation.isPending && 'animate-spin')} />
                Recalculate
              </button>
            )}

            {/* Clone */}
            <button
              onClick={handleClone}
              disabled={cloneMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
            >
              <DocumentDuplicateIcon className="h-4 w-4" />
              {cloneMutation.isPending ? 'Cloning...' : 'Clone'}
            </button>

            {/* PDF download */}
            {quote.pdf_url && (
              <a
                href={quotesApi.getPdfUrl(id!)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
              >
                <ArrowDownTrayIcon className="h-4 w-4" />
                PDF
              </a>
            )}
          </div>
        }
      />

      {/* Status + Badges */}
      <div className="flex items-center gap-3 mb-4 -mt-4">
        <StatusBadge status={quote.status} size="md" />
        {quote.requires_approval && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">
            Requires Approval
          </span>
        )}
        {quote.deal_id && (
          <button
            onClick={() => navigate(`/deals/${quote.deal_id}`)}
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full hover:bg-blue-200"
          >
            Linked to Deal
          </button>
        )}
      </div>

      {/* Validity warning */}
      {isExpiringSoon && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border bg-red-50 border-red-200 p-3">
          <span className="text-sm font-medium text-red-800">
            Quote validity expires {formatDate(quote.valid_until)}
          </span>
        </div>
      )}

      {/* Rejection reason */}
      {quote.status === 'rejected' && quote.rejection_reason && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3">
          <XMarkIcon className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Rejection Reason</p>
            <p className="text-sm text-red-700 mt-0.5">{quote.rejection_reason}</p>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer info */}
          <InfoCard title="Customer Information">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoField label="Customer Name" value={quote.customer_name} />
              <InfoField label="Customer Email" value={quote.customer_email} />
              <InfoField label="Payment Terms" value={quote.payment_terms} />
              <InfoField label="Currency" value={quote.currency} />
            </div>
          </InfoCard>

          {/* Line Items */}
          <InfoCard
            title={`Line Items (${lineItems.length})`}
            action={
              canEdit ? (
                <button
                  onClick={() => {
                    setAddProductOpen(true);
                    setSelectedProduct(null);
                  }}
                  className="inline-flex items-center gap-1 text-sm font-medium text-panw-navy hover:text-panw-blue"
                >
                  <PlusIcon className="h-4 w-4" />
                  Add Product
                </button>
              ) : undefined
            }
          >
            {lineItems.length > 0 ? (
              <div className="overflow-x-auto -mx-5 -mb-5">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500 uppercase w-10">#</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Product</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500 uppercase w-20">Qty</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">List Price</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Tier Disc.</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Partner Disc.</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Unit Price</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Line Total</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500 uppercase w-16">Appr.</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500 uppercase w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {lineItems.map((line, idx) => (
                      <LineItemRow
                        key={line.id}
                        line={line}
                        index={idx}
                        editable={canEdit}
                        onUpdate={handleUpdateLine}
                        onRemove={handleRemoveLine}
                        isUpdating={updateLineMutation.isPending}
                        isRemoving={removeLineMutation.isPending}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-6">
                No line items in this quote.
              </p>
            )}
          </InfoCard>

          {/* Totals */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 max-w-sm ml-auto">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Quote Totals
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-mono text-gray-700">{formatCurrency(quote.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total Discount</span>
                <span className="font-mono text-green-600">-{formatCurrency(quote.total_discount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Tax</span>
                <span className="font-mono text-gray-700">{formatCurrency(quote.tax_amount)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold border-t border-gray-200 pt-2">
                <span className="text-gray-900">Total Amount</span>
                <span className="font-mono text-gray-900 text-lg">{formatCurrency(quote.total_amount)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {(quote.notes || quote.terms_and_conditions) && (
            <InfoCard title="Notes & Terms">
              {quote.notes && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-gray-500 mb-1">Notes</p>
                  <p className="text-sm text-gray-700">{quote.notes}</p>
                </div>
              )}
              {quote.terms_and_conditions && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Terms & Conditions</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {quote.terms_and_conditions}
                  </p>
                </div>
              )}
            </InfoCard>
          )}

          {/* Internal info */}
          {isInternal && (
            <InfoCard title="Partner Information">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoField label="Partner Org" value={quote.organization_name} />
                <InfoField label="Created By" value={quote.created_by_name} />
                {quote.approved_by_name && (
                  <InfoField label="Approved By" value={quote.approved_by_name} />
                )}
                {quote.approved_at && (
                  <InfoField label="Approved At" value={formatDateTime(quote.approved_at)} />
                )}
              </div>
            </InfoCard>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Quick info */}
          <InfoCard title="Quote Details">
            <div className="space-y-3">
              <InfoField label="Quote Number" value={quote.quote_number} />
              <InfoField label="Valid From" value={formatDate(quote.valid_from)} />
              <InfoField
                label="Valid Until"
                value={formatDate(quote.valid_until)}
              />
              <InfoField label="Created" value={formatDateTime(quote.created_at)} />
              <InfoField label="Last Updated" value={formatDateTime(quote.updated_at)} />
            </div>
          </InfoCard>

          {/* Activity timeline */}
          <InfoCard title="Activity History">
            {history && history.length > 0 ? (
              <StatusTimeline history={history} />
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">No activity yet</p>
            )}
          </InfoCard>
        </div>
      </div>

      {/* ---- Modals ---- */}

      {/* Approve Modal */}
      <Modal
        open={approveModalOpen}
        onClose={() => setApproveModalOpen(false)}
        title="Approve Quote"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Approve all line item discounts and mark this quote as approved.
          </p>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm">
              <span className="text-gray-500">Total amount:</span>{' '}
              <span className="font-semibold">{formatCurrency(quote.total_amount)}</span>
            </p>
            <p className="text-sm">
              <span className="text-gray-500">Total discount:</span>{' '}
              <span className="font-semibold text-green-600">
                {formatCurrency(quote.total_discount)}
              </span>
            </p>
          </div>
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
              onClick={() => {
                approveMutation.mutate(
                  { comments: approveComments || undefined },
                  {
                    onSuccess: () => {
                      setApproveModalOpen(false);
                      setApproveComments('');
                    },
                  }
                );
              }}
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
        open={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Reject Quote"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Please provide a reason for rejecting this quote. The partner will be
            notified with your feedback.
          </p>
          <FormField label="Rejection Reason" htmlFor="reject-reason" required>
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Explain why this quote is being rejected..."
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
                rejectMutation.mutate(
                  { rejection_reason: rejectReason },
                  {
                    onSuccess: () => {
                      setRejectModalOpen(false);
                      setRejectReason('');
                    },
                  }
                );
              }}
              disabled={rejectMutation.isPending}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
            >
              {rejectMutation.isPending ? 'Rejecting...' : 'Reject Quote'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Add Product Modal */}
      <Modal
        open={addProductOpen}
        onClose={() => {
          setAddProductOpen(false);
          setSelectedProduct(null);
          setProductSearch('');
        }}
        title="Add Product to Quote"
        size="lg"
      >
        <div className="space-y-4">
          {!selectedProduct ? (
            <>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search products..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="max-h-60 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-lg">
                {(productsForAdd ?? [])
                  .filter((p) => p.available_to_partners)
                  .map((product) => (
                    <button
                      key={product.id}
                      onClick={() => setSelectedProduct(product)}
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
                      <span className="text-sm font-medium text-gray-700 font-mono">
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
                <p className="text-sm text-gray-600 mt-1">
                  List Price: {formatCurrency(selectedProduct.list_price)}
                </p>
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
                <FormField label="Discount Type" htmlFor="modal-disc-type">
                  <select
                    id="modal-disc-type"
                    value={addDiscountType}
                    onChange={(e) =>
                      setAddDiscountType(e.target.value as 'percentage' | 'fixed_amount')
                    }
                    className="block w-full rounded-md border-0 py-2 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-panw-blue sm:text-sm"
                  >
                    <option value="percentage">%</option>
                    <option value="fixed_amount">$</option>
                  </select>
                </FormField>
                <FormField label="Discount" htmlFor="modal-disc">
                  <Input
                    id="modal-disc"
                    type="number"
                    min="0"
                    max={addDiscountType === 'percentage' ? '100' : undefined}
                    step="0.1"
                    value={addDiscountValue}
                    onChange={(e) => setAddDiscountValue(e.target.value)}
                  />
                </FormField>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  onClick={handleAddLine}
                  disabled={addLineMutation.isPending}
                  className="rounded-md bg-panw-blue px-4 py-2 text-sm font-semibold text-white hover:bg-panw-navy disabled:opacity-50"
                >
                  {addLineMutation.isPending ? 'Adding...' : 'Add Product'}
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
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="text-sm text-gray-700 mt-0.5">{value ?? '-'}</p>
    </div>
  );
}

function StatusTimeline({
  history,
}: {
  history: { id: string; action: string; actor_name?: string; changes?: Record<string, unknown>; created_at: string }[];
}) {
  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {history.map((entry, idx) => {
          const isLast = idx === history.length - 1;
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
                        getActionColor(entry.action)
                      )}
                    >
                      <span className="h-2 w-2 rounded-full bg-white" />
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {humanize(entry.action)}
                    </p>
                    {entry.actor_name && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        by {entry.actor_name}
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

function getActionColor(action: string): string {
  const map: Record<string, string> = {
    created: 'bg-gray-400',
    updated: 'bg-blue-500',
    submitted: 'bg-yellow-500',
    approved: 'bg-green-500',
    rejected: 'bg-red-500',
    sent: 'bg-blue-600',
    accepted: 'bg-green-700',
    cloned: 'bg-purple-500',
  };
  return map[action] ?? 'bg-gray-400';
}
