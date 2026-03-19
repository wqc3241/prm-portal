import { useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { dealsApi } from '../../api/deals';
import { productsApi } from '../../api/products';
import { useCreateQuote, useAddLine, useRemoveLine, useUpdateLine } from '../../hooks/useQuotes';
import {
  PageHeader,
  FormField,
  Input,
  Textarea,
  Skeleton,
} from '../../components/shared';
import { LineItemRow } from '../../components/quotes/LineItemRow';
import { formatCurrency } from '../../utils/formatters';
import { PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import type {
  Quote,
  Product,
  CreateQuoteRequest,
  AddLineItemRequest,
} from '../../types';

export function QuoteForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dealId = searchParams.get('deal_id');

  // --- Form state (header) ---
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [validUntil, setValidUntil] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [paymentTerms, setPaymentTerms] = useState('Net 30');
  const [notes, setNotes] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState('');

  // Created quote (after initial save)
  const [createdQuote, setCreatedQuote] = useState<Quote | null>(null);

  // Product search
  const [productSearch, setProductSearch] = useState('');
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [selectedProductForAdd, setSelectedProductForAdd] = useState<Product | null>(null);
  const [addQty, setAddQty] = useState('1');
  const [addDiscountType, setAddDiscountType] = useState<'percentage' | 'fixed_amount'>('percentage');
  const [addDiscountValue, setAddDiscountValue] = useState('0');

  // Pre-populate from deal
  const { data: dealData, isLoading: dealLoading } = useQuery({
    queryKey: ['deal-for-quote', dealId],
    queryFn: async () => {
      const { data } = await dealsApi.getById(dealId!);
      return data.data;
    },
    enabled: !!dealId,
  });

  // If deal loaded and we haven't populated yet
  if (dealData && !customerName && !createdQuote) {
    setCustomerName(dealData.customer_company_name);
    if (dealData.customer_contact_email) {
      setCustomerEmail(dealData.customer_contact_email);
    }
  }

  // Product search query
  const { data: searchProducts } = useQuery({
    queryKey: ['products-for-quote', productSearch],
    queryFn: async () => {
      const { data } = await productsApi.list({
        search: productSearch || undefined,
        is_active: true,
        per_page: 20,
      });
      return data.data;
    },
    enabled: showProductPicker,
  });

  // --- Mutations ---
  const createQuoteMutation = useCreateQuote();

  const handleCreateQuote = useCallback(async () => {
    if (!customerName.trim()) {
      toast.error('Customer name is required');
      return;
    }

    const payload: CreateQuoteRequest = {
      customer_name: customerName.trim(),
      customer_email: customerEmail.trim() || undefined,
      valid_until: validUntil || undefined,
      payment_terms: paymentTerms || undefined,
      notes: notes || undefined,
      terms_and_conditions: termsAndConditions || undefined,
      deal_id: dealId || undefined,
    };

    try {
      const response = await createQuoteMutation.mutateAsync(payload);
      const quote = response.data.data;
      setCreatedQuote(quote);
    } catch {
      // Error handled by mutation
    }
  }, [
    customerName,
    customerEmail,
    validUntil,
    paymentTerms,
    notes,
    termsAndConditions,
    dealId,
    createQuoteMutation,
  ]);

  // After quote is created, we can add lines
  const addLineMutation = useAddLine(createdQuote?.id ?? '');
  const updateLineMutation = useUpdateLine(createdQuote?.id ?? '');
  const removeLineMutation = useRemoveLine(createdQuote?.id ?? '');

  // Re-fetch the quote to get updated totals after line changes
  const { data: latestQuote } = useQuery({
    queryKey: ['quote', createdQuote?.id],
    queryFn: async () => {
      const { data } = await (await import('../../api/quotes')).quotesApi.getById(createdQuote!.id);
      return data.data;
    },
    enabled: !!createdQuote?.id,
  });

  const quote = latestQuote ?? createdQuote;

  const handleAddLine = useCallback(async () => {
    if (!selectedProductForAdd) {
      toast.error('Select a product');
      return;
    }
    if (Number(addQty) < 1) {
      toast.error('Quantity must be at least 1');
      return;
    }

    const payload: AddLineItemRequest = {
      product_id: selectedProductForAdd.id,
      quantity: Number(addQty),
      discount_type: addDiscountType,
      discount_value: Number(addDiscountValue),
    };

    try {
      await addLineMutation.mutateAsync(payload);
      setSelectedProductForAdd(null);
      setAddQty('1');
      setAddDiscountValue('0');
      setShowProductPicker(false);
      setProductSearch('');
    } catch {
      // Error handled by mutation
    }
  }, [selectedProductForAdd, addQty, addDiscountType, addDiscountValue, addLineMutation]);

  const handleUpdateLine = useCallback(
    (lineId: string, field: string, value: number | string) => {
      updateLineMutation.mutate({
        lineId,
        data: { [field]: value },
      });
    },
    [updateLineMutation]
  );

  const handleRemoveLine = useCallback(
    (lineId: string) => {
      removeLineMutation.mutate(lineId);
    },
    [removeLineMutation]
  );

  if (dealLoading) {
    return (
      <div>
        <div className="mb-6">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-5 w-40" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  // --- Step 1: Create quote header ---
  if (!createdQuote) {
    return (
      <div>
        <PageHeader
          title="New Quote"
          subtitle={dealData ? `From deal ${dealData.deal_number}` : 'Standalone quote'}
          breadcrumbs={[
            { label: 'Quotes', to: '/quotes' },
            { label: 'New Quote' },
          ]}
        />

        <div className="max-w-2xl">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
            <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-200 pb-3">
              Customer Information
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Customer Name" htmlFor="customer-name" required>
                <Input
                  id="customer-name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Acme Corp"
                />
              </FormField>

              <FormField label="Customer Email" htmlFor="customer-email">
                <Input
                  id="customer-email"
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="procurement@acme.com"
                />
              </FormField>
            </div>

            <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-200 pb-3 pt-2">
              Quote Settings
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Valid Until" htmlFor="valid-until">
                <Input
                  id="valid-until"
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
              </FormField>

              <FormField label="Payment Terms" htmlFor="payment-terms">
                <Input
                  id="payment-terms"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  placeholder="Net 30"
                />
              </FormField>
            </div>

            <FormField label="Notes" htmlFor="notes">
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Internal notes about this quote..."
              />
            </FormField>

            <FormField label="Terms & Conditions" htmlFor="terms">
              <Textarea
                id="terms"
                value={termsAndConditions}
                onChange={(e) => setTermsAndConditions(e.target.value)}
                rows={3}
                placeholder="Standard partner terms apply..."
              />
            </FormField>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                onClick={() => navigate('/quotes')}
                className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateQuote}
                disabled={createQuoteMutation.isPending}
                className="rounded-md bg-panw-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-panw-navy shadow-sm disabled:opacity-50"
              >
                {createQuoteMutation.isPending
                  ? 'Creating...'
                  : 'Create Quote & Add Products'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Step 2: Add line items ---
  const lineItems = quote?.line_items ?? [];

  return (
    <div>
      <PageHeader
        title={`Quote ${quote?.quote_number ?? ''}`}
        subtitle="Add products and configure pricing"
        breadcrumbs={[
          { label: 'Quotes', to: '/quotes' },
          { label: quote?.quote_number ?? 'New' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(`/quotes/${quote?.id}`)}
              className="rounded-md bg-panw-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-panw-navy shadow-sm"
            >
              Done - View Quote
            </button>
          </div>
        }
      />

      {/* Quote summary bar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-500">Customer</p>
            <p className="text-sm font-semibold text-gray-900">{quote?.customer_name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Subtotal</p>
            <p className="text-sm font-mono text-gray-700">{formatCurrency(quote?.subtotal)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Total Discount</p>
            <p className="text-sm font-mono text-green-600">-{formatCurrency(quote?.total_discount)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Total Amount</p>
            <p className="text-lg font-bold text-gray-900 font-mono">{formatCurrency(quote?.total_amount)}</p>
          </div>
        </div>
      </div>

      {/* Line Items Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">
            Line Items ({lineItems.length})
          </h3>
          <button
            onClick={() => {
              setShowProductPicker(true);
              setSelectedProductForAdd(null);
            }}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-panw-navy hover:text-panw-blue"
          >
            <PlusIcon className="h-4 w-4" />
            Add Product
          </button>
        </div>

        {lineItems.length > 0 ? (
          <div className="overflow-x-auto">
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
                    editable
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
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <PlusIcon className="h-10 w-10 text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-900">No line items yet</p>
            <p className="text-sm text-gray-500 mt-1">
              Add products to build your quote
            </p>
            <button
              onClick={() => {
                setShowProductPicker(true);
                setSelectedProductForAdd(null);
              }}
              className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-panw-blue px-3 py-2 text-sm font-semibold text-white hover:bg-panw-navy"
            >
              <PlusIcon className="h-4 w-4" />
              Add Product
            </button>
          </div>
        )}
      </div>

      {/* Totals */}
      {lineItems.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 max-w-sm ml-auto">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Quote Totals</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal (before discounts)</span>
              <span className="font-mono text-gray-700">{formatCurrency(quote?.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total Discount</span>
              <span className="font-mono text-green-600">
                -{formatCurrency(quote?.total_discount)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Tax</span>
              <span className="font-mono text-gray-700">{formatCurrency(quote?.tax_amount)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold border-t border-gray-200 pt-2">
              <span className="text-gray-900">Total Amount</span>
              <span className="font-mono text-gray-900 text-lg">
                {formatCurrency(quote?.total_amount)}
              </span>
            </div>
          </div>

          {quote?.requires_approval && (
            <div className="mt-3 flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-md px-3 py-2">
              <span className="text-xs text-yellow-800 font-medium">
                One or more discounts exceed your self-approval threshold and will
                require approval upon submission.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Product Picker Slide-over / Modal */}
      {showProductPicker && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div
            className="fixed inset-0 bg-gray-500/50"
            onClick={() => {
              setShowProductPicker(false);
              setSelectedProductForAdd(null);
            }}
          />
          <div className="relative w-full max-w-md bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {selectedProductForAdd ? 'Configure Line Item' : 'Select Product'}
              </h3>
              <button
                onClick={() => {
                  setShowProductPicker(false);
                  setSelectedProductForAdd(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="sr-only">Close</span>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {!selectedProductForAdd ? (
                <>
                  {/* Search */}
                  <div className="relative mb-4">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Search products by name or SKU..."
                      className="w-full rounded-md border-0 py-2 pl-9 pr-3 text-sm text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-panw-blue"
                      autoFocus
                    />
                  </div>

                  {/* Product list */}
                  <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
                    {(searchProducts ?? [])
                      .filter((p) => p.available_to_partners)
                      .map((product) => (
                        <button
                          key={product.id}
                          onClick={() => setSelectedProductForAdd(product)}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {product.name}
                              </p>
                              <p className="text-xs text-gray-500 font-mono">{product.sku}</p>
                            </div>
                            <span className="text-sm font-semibold text-gray-700 font-mono">
                              {formatCurrency(product.list_price)}
                            </span>
                          </div>
                          {product.category?.name && (
                            <p className="text-xs text-gray-400 mt-0.5">{product.category.name}</p>
                          )}
                        </button>
                      ))}
                    {(searchProducts ?? []).length === 0 && (
                      <div className="p-6 text-center text-sm text-gray-500">
                        No products found
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Selected product config */}
                  <div className="bg-gray-50 rounded-lg p-4 mb-5">
                    <p className="text-sm font-semibold text-gray-900">
                      {selectedProductForAdd.name}
                    </p>
                    <p className="text-xs text-gray-500 font-mono">
                      {selectedProductForAdd.sku}
                    </p>
                    <p className="text-sm font-medium text-gray-700 mt-1">
                      List Price: {formatCurrency(selectedProductForAdd.list_price)}
                    </p>
                  </div>

                  <div className="space-y-4">
                    <FormField label="Quantity" htmlFor="add-qty" required>
                      <Input
                        id="add-qty"
                        type="number"
                        min="1"
                        value={addQty}
                        onChange={(e) => setAddQty(e.target.value)}
                      />
                    </FormField>

                    <FormField label="Discount Type" htmlFor="add-disc-type">
                      <select
                        id="add-disc-type"
                        value={addDiscountType}
                        onChange={(e) =>
                          setAddDiscountType(e.target.value as 'percentage' | 'fixed_amount')
                        }
                        className="block w-full rounded-md border-0 py-2 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-panw-blue sm:text-sm"
                      >
                        <option value="percentage">Percentage (%)</option>
                        <option value="fixed_amount">Fixed Amount ($)</option>
                      </select>
                    </FormField>

                    <FormField
                      label={
                        addDiscountType === 'percentage'
                          ? 'Discount Percentage'
                          : 'Discount Amount (per unit)'
                      }
                      htmlFor="add-disc-value"
                      hint={
                        addDiscountType === 'percentage'
                          ? 'Applied on top of your tier discount'
                          : 'Dollar amount subtracted from tier-discounted price per unit'
                      }
                    >
                      <Input
                        id="add-disc-value"
                        type="number"
                        min="0"
                        max={addDiscountType === 'percentage' ? '100' : undefined}
                        step="0.1"
                        value={addDiscountValue}
                        onChange={(e) => setAddDiscountValue(e.target.value)}
                      />
                    </FormField>
                  </div>

                  <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => setSelectedProductForAdd(null)}
                      className="flex-1 rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleAddLine}
                      disabled={addLineMutation.isPending}
                      className="flex-1 rounded-md bg-panw-blue px-4 py-2 text-sm font-semibold text-white hover:bg-panw-navy disabled:opacity-50"
                    >
                      {addLineMutation.isPending ? 'Adding...' : 'Add to Quote'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
