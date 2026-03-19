import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { dealsApi } from '../../api/deals';
import { productsApi } from '../../api/products';
import { getApiErrorMessage } from '../../api/client';
import { PageHeader, FormField, Input, Select, Textarea } from '../../components/shared';
import { formatCurrency } from '../../utils/formatters';
import { cn } from '../../utils/cn';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  TrashIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  DocumentCheckIcon,
  BookmarkIcon,
} from '@heroicons/react/24/outline';
import type {
  CreateDealRequest,
  DealSource,
  DealConflict,
  Product,
  AddDealProductRequest,
} from '../../types';

const STEPS = [
  { label: 'Customer Info', key: 'customer' },
  { label: 'Deal Details', key: 'details' },
  { label: 'Products', key: 'products' },
  { label: 'Review & Submit', key: 'review' },
] as const;

const INDUSTRIES = [
  'Financial Services',
  'Healthcare',
  'Technology',
  'Manufacturing',
  'Retail',
  'Education',
  'Government',
  'Telecommunications',
  'Energy & Utilities',
  'Media & Entertainment',
  'Transportation',
  'Real Estate',
  'Other',
];

const SOURCE_OPTIONS: { value: DealSource; label: string }[] = [
  { value: 'direct', label: 'Direct Outreach' },
  { value: 'referral', label: 'Referral' },
  { value: 'marketing', label: 'Marketing Campaign' },
  { value: 'partner_sourced', label: 'Partner Sourced' },
  { value: 'web', label: 'Website / Inbound' },
  { value: 'other', label: 'Other' },
];

interface FormData {
  // Customer
  customer_company_name: string;
  customer_contact_name: string;
  customer_contact_email: string;
  customer_contact_phone: string;
  customer_industry: string;
  customer_address: string;
  // Deal
  deal_name: string;
  description: string;
  estimated_value: string;
  currency: string;
  win_probability: string;
  expected_close_date: string;
  source: DealSource | '';
  competitive_situation: string;
}

interface ProductLine {
  product_id: string;
  product_name: string;
  product_sku: string;
  quantity: number;
  unit_price: number;
  discount_pct: number;
  line_total: number;
}

const initialFormData: FormData = {
  customer_company_name: '',
  customer_contact_name: '',
  customer_contact_email: '',
  customer_contact_phone: '',
  customer_industry: '',
  customer_address: '',
  deal_name: '',
  description: '',
  estimated_value: '',
  currency: 'USD',
  win_probability: '50',
  expected_close_date: '',
  source: '',
  competitive_situation: '',
};

export function DealForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [productLines, setProductLines] = useState<ProductLine[]>([]);
  const [conflicts, setConflicts] = useState<DealConflict[]>([]);
  const [conflictsChecked, setConflictsChecked] = useState(false);

  // Product search/selection state
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [addingProduct, setAddingProduct] = useState<{
    product: Product;
    quantity: string;
    unit_price: string;
    discount_pct: string;
  } | null>(null);

  // Fetch products for the product selector
  const { data: productsData } = useQuery({
    queryKey: ['products', { search: productSearch, is_active: true, per_page: 20 }],
    queryFn: async () => {
      const { data } = await productsApi.list({
        search: productSearch || undefined,
        is_active: true,
        per_page: 20,
      });
      return data;
    },
    enabled: step === 2,
  });

  const availableProducts = productsData?.data ?? [];

  const updateField = useCallback(
    (field: keyof FormData, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      if (errors[field]) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }
    },
    [errors]
  );

  // ---- Validation ----
  const validateStep = useCallback(
    (stepIndex: number): boolean => {
      const errs: Partial<Record<keyof FormData, string>> = {};

      if (stepIndex === 0) {
        if (!formData.customer_company_name.trim()) {
          errs.customer_company_name = 'Company name is required';
        }
      }

      if (stepIndex === 1) {
        if (!formData.deal_name.trim()) errs.deal_name = 'Deal name is required';
        if (!formData.estimated_value || Number(formData.estimated_value) <= 0) {
          errs.estimated_value = 'Estimated value must be greater than 0';
        }
      }

      setErrors(errs);
      return Object.keys(errs).length === 0;
    },
    [formData]
  );

  // ---- Validate entire form for submission ----
  const validateAll = useCallback((): boolean => {
    const errs: Partial<Record<keyof FormData, string>> = {};
    if (!formData.customer_company_name.trim()) {
      errs.customer_company_name = 'Company name is required';
    }
    if (!formData.deal_name.trim()) errs.deal_name = 'Deal name is required';
    if (!formData.estimated_value || Number(formData.estimated_value) <= 0) {
      errs.estimated_value = 'Estimated value must be greater than 0';
    }
    if (!formData.expected_close_date) {
      errs.expected_close_date = 'Expected close date is required for submission';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [formData]);

  // ---- Navigation ----
  const goNext = useCallback(() => {
    if (validateStep(step)) {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }
  }, [step, validateStep]);

  const goBack = useCallback(() => {
    setStep((s) => Math.max(s - 1, 0));
  }, []);

  // ---- Products ----
  const productTotal = useMemo(
    () => productLines.reduce((sum, p) => sum + p.line_total, 0),
    [productLines]
  );

  const handleAddProduct = useCallback(
    (product: Product) => {
      if (productLines.some((p) => p.product_id === product.id)) {
        toast.error('This product is already added to the deal');
        return;
      }
      setAddingProduct({
        product,
        quantity: '1',
        unit_price: String(product.list_price),
        discount_pct: '0',
      });
      setShowProductDropdown(false);
      setProductSearch('');
    },
    [productLines]
  );

  const confirmAddProduct = useCallback(() => {
    if (!addingProduct) return;
    const qty = Number(addingProduct.quantity);
    const price = Number(addingProduct.unit_price);
    const disc = Number(addingProduct.discount_pct);

    if (qty < 1) {
      toast.error('Quantity must be at least 1');
      return;
    }
    if (disc < 0 || disc > 100) {
      toast.error('Discount must be between 0 and 100');
      return;
    }

    const lineTotal = qty * price * (1 - disc / 100);
    setProductLines((prev) => [
      ...prev,
      {
        product_id: addingProduct.product.id,
        product_name: addingProduct.product.name,
        product_sku: addingProduct.product.sku,
        quantity: qty,
        unit_price: price,
        discount_pct: disc,
        line_total: lineTotal,
      },
    ]);
    setAddingProduct(null);
  }, [addingProduct]);

  const removeProduct = useCallback((productId: string) => {
    setProductLines((prev) => prev.filter((p) => p.product_id !== productId));
  }, []);

  // ---- Conflict check ----
  const conflictCheckMutation = useMutation({
    mutationFn: () =>
      dealsApi.checkConflicts({
        customer_company: formData.customer_company_name,
        customer_email: formData.customer_contact_email || undefined,
      }),
    onSuccess: ({ data }) => {
      setConflicts(data.data ?? []);
      setConflictsChecked(true);
    },
    onError: () => {
      setConflictsChecked(true);
      setConflicts([]);
    },
  });

  // ---- Create deal (save as draft) ----
  const createDealMutation = useMutation({
    mutationFn: async (andSubmit: boolean) => {
      const payload: CreateDealRequest = {
        customer_company_name: formData.customer_company_name,
        customer_contact_name: formData.customer_contact_name || undefined,
        customer_contact_email: formData.customer_contact_email || undefined,
        customer_contact_phone: formData.customer_contact_phone || undefined,
        customer_industry: formData.customer_industry || undefined,
        customer_address: formData.customer_address || undefined,
        deal_name: formData.deal_name,
        description: formData.description || undefined,
        estimated_value: Number(formData.estimated_value),
        currency: formData.currency,
        win_probability: formData.win_probability
          ? Number(formData.win_probability)
          : undefined,
        expected_close_date: formData.expected_close_date || undefined,
        source: (formData.source as DealSource) || undefined,
      };

      // Create the deal
      const { data: createRes } = await dealsApi.create(payload);
      const deal = createRes.data;

      // Add products if any
      for (const line of productLines) {
        const productPayload: AddDealProductRequest = {
          product_id: line.product_id,
          quantity: line.quantity,
          unit_price: line.unit_price,
          discount_pct: line.discount_pct,
        };
        await dealsApi.addProduct(deal.id, productPayload);
      }

      // Submit if requested
      if (andSubmit) {
        const { data: submitRes } = await dealsApi.submit(deal.id);
        return submitRes.data;
      }

      return deal;
    },
    onSuccess: (deal, andSubmit) => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      if (andSubmit) {
        toast.success('Deal submitted for review');
      } else {
        toast.success('Deal saved as draft');
      }
      navigate(`/deals/${deal.id}`);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });

  const handleSaveDraft = useCallback(() => {
    if (!formData.customer_company_name.trim() || !formData.deal_name.trim()) {
      toast.error('Company name and deal name are required to save');
      return;
    }
    if (!formData.estimated_value || Number(formData.estimated_value) <= 0) {
      toast.error('Estimated value must be greater than 0');
      return;
    }
    createDealMutation.mutate(false);
  }, [formData, createDealMutation]);

  const handleSubmit = useCallback(() => {
    if (!validateAll()) {
      toast.error('Please fix the validation errors before submitting');
      return;
    }
    createDealMutation.mutate(true);
  }, [validateAll, createDealMutation]);

  const isSubmitting = createDealMutation.isPending;

  return (
    <div>
      <PageHeader
        title="Register New Deal"
        breadcrumbs={[
          { label: 'Deals', to: '/deals' },
          { label: 'Register Deal' },
        ]}
      />

      {/* Step indicator */}
      <nav aria-label="Progress" className="mb-8">
        <ol className="flex items-center">
          {STEPS.map((s, idx) => (
            <li
              key={s.key}
              className={cn('flex items-center', idx < STEPS.length - 1 && 'flex-1')}
            >
              <button
                onClick={() => {
                  if (idx < step) setStep(idx);
                }}
                disabled={idx > step}
                className={cn(
                  'flex items-center gap-2 text-sm font-medium transition-colors',
                  idx === step && 'text-panw-navy',
                  idx < step && 'text-green-600 hover:text-green-700',
                  idx > step && 'text-gray-400 cursor-not-allowed'
                )}
              >
                <span
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold',
                    idx === step && 'bg-panw-blue text-white',
                    idx < step && 'bg-green-100 text-green-700',
                    idx > step && 'bg-gray-100 text-gray-400'
                  )}
                >
                  {idx < step ? (
                    <CheckCircleIcon className="h-5 w-5" />
                  ) : (
                    idx + 1
                  )}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {idx < STEPS.length - 1 && (
                <div
                  className={cn(
                    'mx-3 h-0.5 flex-1',
                    idx < step ? 'bg-green-500' : 'bg-gray-200'
                  )}
                />
              )}
            </li>
          ))}
        </ol>
      </nav>

      {/* Form content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        {/* Step 1: Customer Info */}
        {step === 0 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-gray-900">Customer Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FormField
                label="Company Name"
                htmlFor="customer_company_name"
                required
                error={errors.customer_company_name}
              >
                <Input
                  id="customer_company_name"
                  value={formData.customer_company_name}
                  onChange={(e) => updateField('customer_company_name', e.target.value)}
                  hasError={!!errors.customer_company_name}
                  placeholder="e.g., Acme Corporation"
                />
              </FormField>

              <FormField
                label="Contact Name"
                htmlFor="customer_contact_name"
              >
                <Input
                  id="customer_contact_name"
                  value={formData.customer_contact_name}
                  onChange={(e) => updateField('customer_contact_name', e.target.value)}
                  placeholder="e.g., John Smith"
                />
              </FormField>

              <FormField
                label="Contact Email"
                htmlFor="customer_contact_email"
              >
                <Input
                  id="customer_contact_email"
                  type="email"
                  value={formData.customer_contact_email}
                  onChange={(e) => updateField('customer_contact_email', e.target.value)}
                  placeholder="e.g., john@acme.com"
                />
              </FormField>

              <FormField
                label="Contact Phone"
                htmlFor="customer_contact_phone"
              >
                <Input
                  id="customer_contact_phone"
                  type="tel"
                  value={formData.customer_contact_phone}
                  onChange={(e) => updateField('customer_contact_phone', e.target.value)}
                  placeholder="e.g., +1-555-0100"
                />
              </FormField>

              <FormField label="Industry" htmlFor="customer_industry">
                <Select
                  id="customer_industry"
                  value={formData.customer_industry}
                  onChange={(e) => updateField('customer_industry', e.target.value)}
                >
                  <option value="">Select industry...</option>
                  {INDUSTRIES.map((ind) => (
                    <option key={ind} value={ind}>
                      {ind}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Address" htmlFor="customer_address">
                <Input
                  id="customer_address"
                  value={formData.customer_address}
                  onChange={(e) => updateField('customer_address', e.target.value)}
                  placeholder="e.g., 123 Main St, New York, NY 10001"
                />
              </FormField>
            </div>
          </div>
        )}

        {/* Step 2: Deal Details */}
        {step === 1 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-gray-900">Deal Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FormField
                label="Deal Name"
                htmlFor="deal_name"
                required
                error={errors.deal_name}
                className="md:col-span-2"
              >
                <Input
                  id="deal_name"
                  value={formData.deal_name}
                  onChange={(e) => updateField('deal_name', e.target.value)}
                  hasError={!!errors.deal_name}
                  placeholder="e.g., Acme Corp - Network Refresh"
                />
              </FormField>

              <FormField
                label="Description"
                htmlFor="description"
                className="md:col-span-2"
              >
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  rows={3}
                  placeholder="Describe the opportunity..."
                />
              </FormField>

              <FormField
                label="Estimated Value (USD)"
                htmlFor="estimated_value"
                required
                error={errors.estimated_value}
              >
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                    $
                  </span>
                  <Input
                    id="estimated_value"
                    type="number"
                    min="0"
                    step="1000"
                    value={formData.estimated_value}
                    onChange={(e) => updateField('estimated_value', e.target.value)}
                    hasError={!!errors.estimated_value}
                    className="pl-7"
                    placeholder="0"
                  />
                </div>
              </FormField>

              <FormField
                label="Expected Close Date"
                htmlFor="expected_close_date"
                error={errors.expected_close_date}
              >
                <Input
                  id="expected_close_date"
                  type="date"
                  value={formData.expected_close_date}
                  onChange={(e) => updateField('expected_close_date', e.target.value)}
                  hasError={!!errors.expected_close_date}
                />
              </FormField>

              <FormField
                label="Win Probability (%)"
                htmlFor="win_probability"
                hint="Estimated likelihood of winning this deal"
              >
                <div className="flex items-center gap-3">
                  <input
                    id="win_probability"
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={formData.win_probability}
                    onChange={(e) => updateField('win_probability', e.target.value)}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-navy-900"
                  />
                  <span className="text-sm font-semibold text-gray-700 w-12 text-right">
                    {formData.win_probability}%
                  </span>
                </div>
              </FormField>

              <FormField label="Source" htmlFor="source">
                <Select
                  id="source"
                  value={formData.source}
                  onChange={(e) => updateField('source', e.target.value)}
                >
                  <option value="">Select source...</option>
                  {SOURCE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField
                label="Competitive Situation"
                htmlFor="competitive_situation"
                className="md:col-span-2"
                hint="Describe any competitive threats or incumbents"
              >
                <Textarea
                  id="competitive_situation"
                  value={formData.competitive_situation}
                  onChange={(e) => updateField('competitive_situation', e.target.value)}
                  rows={2}
                  placeholder="e.g., Customer currently uses Cisco ASA..."
                />
              </FormField>
            </div>
          </div>
        )}

        {/* Step 3: Products */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Products</h2>
              <span className="text-sm text-gray-500">
                Running Total: <span className="font-bold text-gray-900">{formatCurrency(productTotal)}</span>
              </span>
            </div>

            {/* Product search */}
            <div className="relative">
              <Input
                placeholder="Search products to add..."
                value={productSearch}
                onChange={(e) => {
                  setProductSearch(e.target.value);
                  setShowProductDropdown(true);
                }}
                onFocus={() => setShowProductDropdown(true)}
              />
              {showProductDropdown && productSearch && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {availableProducts.length === 0 ? (
                    <div className="p-3 text-sm text-gray-500">
                      No products found
                    </div>
                  ) : (
                    availableProducts
                      .filter(
                        (p) =>
                          p.available_to_partners &&
                          !productLines.some((pl) => pl.product_id === p.id)
                      )
                      .map((product) => (
                        <button
                          key={product.id}
                          onClick={() => handleAddProduct(product)}
                          className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center justify-between border-b border-gray-100 last:border-0"
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
                      ))
                  )}
                </div>
              )}
            </div>

            {/* Product being added */}
            {addingProduct && (
              <div className="border border-navy-200 bg-navy-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-gray-900">
                    {addingProduct.product.name}{' '}
                    <span className="text-xs text-gray-500 font-mono">
                      ({addingProduct.product.sku})
                    </span>
                  </span>
                  <button
                    onClick={() => setAddingProduct(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <FormField label="Quantity" htmlFor="add_qty">
                    <Input
                      id="add_qty"
                      type="number"
                      min="1"
                      value={addingProduct.quantity}
                      onChange={(e) =>
                        setAddingProduct((p) =>
                          p ? { ...p, quantity: e.target.value } : null
                        )
                      }
                    />
                  </FormField>
                  <FormField label="Unit Price" htmlFor="add_price">
                    <Input
                      id="add_price"
                      type="number"
                      min="0"
                      value={addingProduct.unit_price}
                      onChange={(e) =>
                        setAddingProduct((p) =>
                          p ? { ...p, unit_price: e.target.value } : null
                        )
                      }
                    />
                  </FormField>
                  <FormField label="Discount %" htmlFor="add_disc">
                    <Input
                      id="add_disc"
                      type="number"
                      min="0"
                      max="100"
                      value={addingProduct.discount_pct}
                      onChange={(e) =>
                        setAddingProduct((p) =>
                          p ? { ...p, discount_pct: e.target.value } : null
                        )
                      }
                    />
                  </FormField>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-sm text-gray-600">
                    Line total:{' '}
                    <span className="font-semibold">
                      {formatCurrency(
                        Number(addingProduct.quantity) *
                          Number(addingProduct.unit_price) *
                          (1 - Number(addingProduct.discount_pct) / 100)
                      )}
                    </span>
                  </span>
                  <button
                    onClick={confirmAddProduct}
                    className="inline-flex items-center gap-1 rounded-md bg-panw-blue px-3 py-1.5 text-sm font-semibold text-white hover:bg-panw-navy"
                  >
                    <PlusIcon className="h-4 w-4" />
                    Add Product
                  </button>
                </div>
              </div>
            )}

            {/* Product lines table */}
            {productLines.length > 0 ? (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                        Product
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                        Qty
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                        Unit Price
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                        Discount
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                        Line Total
                      </th>
                      <th className="px-4 py-3 w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {productLines.map((line) => (
                      <tr key={line.product_id}>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-900">
                            {line.product_name}
                          </div>
                          <div className="text-xs text-gray-500 font-mono">
                            {line.product_sku}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-700">
                          {line.quantity}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-700">
                          {formatCurrency(line.unit_price)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-700">
                          {line.discount_pct}%
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                          {formatCurrency(line.line_total)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => removeProduct(line.product_id)}
                            className="text-red-400 hover:text-red-600"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-3 text-right text-sm font-semibold text-gray-700"
                      >
                        Total
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                        {formatCurrency(productTotal)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 text-sm">
                No products added yet. Search above to add products to this deal.
              </div>
            )}
          </div>
        )}

        {/* Step 4: Review & Submit */}
        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">Review & Submit</h2>

            {/* Conflict check */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700">
                  Conflict Pre-Check
                </h3>
                <button
                  onClick={() => conflictCheckMutation.mutate()}
                  disabled={conflictCheckMutation.isPending}
                  className="text-sm font-medium text-panw-navy hover:text-panw-blue disabled:opacity-50"
                >
                  {conflictCheckMutation.isPending
                    ? 'Checking...'
                    : conflictsChecked
                    ? 'Re-check'
                    : 'Run Check'}
                </button>
              </div>
              {conflictsChecked && conflicts.length === 0 && (
                <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 p-3">
                  <CheckCircleIcon className="h-5 w-5 text-green-600 flex-shrink-0" />
                  <span className="text-sm text-green-800">
                    No conflicts detected.
                  </span>
                </div>
              )}
              {conflictsChecked && conflicts.length > 0 && (
                <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4 space-y-2">
                  <div className="flex items-start gap-2">
                    <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-yellow-800">
                        Potential conflicts detected ({conflicts.length})
                      </p>
                      <p className="text-xs text-yellow-700 mt-0.5">
                        Conflicts are flagged but do not block submission. Your channel manager will review them.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1.5 mt-2">
                    {conflicts.map((c) => (
                      <div
                        key={c.conflicting_deal_id}
                        className="flex items-center justify-between bg-white rounded border border-yellow-100 px-3 py-2 text-sm"
                      >
                        <div>
                          <span className="font-mono text-xs text-gray-700">
                            {c.conflicting_deal_number}
                          </span>
                          <span className="ml-2 text-gray-600">
                            {c.conflicting_org_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800">
                            {c.match_type.replace(/_/g, ' ')}
                          </span>
                          <span className="text-xs text-gray-500">
                            {(c.similarity_score * 100).toFixed(0)}% match
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!conflictsChecked && (
                <p className="text-xs text-gray-500">
                  Click "Run Check" to see if any existing deals conflict with this registration.
                </p>
              )}
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Customer info summary */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  Customer Information
                </h3>
                <dl className="space-y-2 text-sm">
                  <SummaryField label="Company" value={formData.customer_company_name} />
                  <SummaryField label="Contact" value={formData.customer_contact_name} />
                  <SummaryField label="Email" value={formData.customer_contact_email} />
                  <SummaryField label="Phone" value={formData.customer_contact_phone} />
                  <SummaryField label="Industry" value={formData.customer_industry} />
                  <SummaryField label="Address" value={formData.customer_address} />
                </dl>
              </div>

              {/* Deal details summary */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  Deal Details
                </h3>
                <dl className="space-y-2 text-sm">
                  <SummaryField label="Deal Name" value={formData.deal_name} />
                  <SummaryField
                    label="Estimated Value"
                    value={
                      formData.estimated_value
                        ? formatCurrency(Number(formData.estimated_value))
                        : ''
                    }
                  />
                  <SummaryField label="Expected Close" value={formData.expected_close_date} />
                  <SummaryField
                    label="Win Probability"
                    value={formData.win_probability ? `${formData.win_probability}%` : ''}
                  />
                  <SummaryField
                    label="Source"
                    value={
                      SOURCE_OPTIONS.find((s) => s.value === formData.source)?.label ?? ''
                    }
                  />
                </dl>
              </div>
            </div>

            {/* Products summary */}
            {productLines.length > 0 && (
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  Products ({productLines.length})
                </h3>
                <div className="space-y-2">
                  {productLines.map((line) => (
                    <div
                      key={line.product_id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-gray-700">
                        {line.product_name} x{line.quantity}
                      </span>
                      <span className="font-medium text-gray-900">
                        {formatCurrency(line.line_total)}
                      </span>
                    </div>
                  ))}
                  <div className="border-t border-gray-200 pt-2 flex items-center justify-between text-sm font-bold">
                    <span>Total</span>
                    <span>{formatCurrency(productTotal)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Validation warnings */}
            {!formData.expected_close_date && (
              <div className="flex items-center gap-2 rounded-lg bg-yellow-50 border border-yellow-200 p-3">
                <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 flex-shrink-0" />
                <span className="text-sm text-yellow-800">
                  Expected close date is required to submit. You can still save as draft.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex items-center justify-between mt-8 pt-5 border-t border-gray-200">
          <div>
            {step > 0 && (
              <button
                onClick={goBack}
                className="inline-flex items-center gap-1.5 rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
              >
                <ArrowLeftIcon className="h-4 w-4" />
                Back
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveDraft}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
            >
              <BookmarkIcon className="h-4 w-4" />
              Save Draft
            </button>

            {step < STEPS.length - 1 ? (
              <button
                onClick={goNext}
                className="inline-flex items-center gap-1.5 rounded-md bg-panw-blue px-4 py-2 text-sm font-semibold text-white hover:bg-panw-navy shadow-sm"
              >
                Next
                <ArrowRightIcon className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 rounded-md bg-green-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-600 shadow-sm disabled:opacity-50"
              >
                <DocumentCheckIcon className="h-4 w-4" />
                {isSubmitting ? 'Submitting...' : 'Submit for Review'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-900 font-medium text-right max-w-[60%] truncate">
        {value || '-'}
      </dd>
    </div>
  );
}
