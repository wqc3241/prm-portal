import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { dealsApi } from '../../api/deals';
import { getApiErrorMessage } from '../../api/client';
import {
  PageHeader,
  FormField,
  Input,
  Select,
  Textarea,
  FormSkeleton,
} from '../../components/shared';
import type { DealSource, UpdateDealRequest } from '../../types';

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
  customer_company_name: string;
  customer_contact_name: string;
  customer_contact_email: string;
  customer_contact_phone: string;
  customer_industry: string;
  customer_address: string;
  deal_name: string;
  description: string;
  estimated_value: string;
  currency: string;
  win_probability: string;
  expected_close_date: string;
  source: string;
}

export function DealEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<FormData | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  const { data: deal, isLoading } = useQuery({
    queryKey: ['deal', id],
    queryFn: async () => {
      const { data } = await dealsApi.getById(id!);
      return data.data;
    },
    enabled: !!id,
  });

  // Populate form when deal loads
  useEffect(() => {
    if (deal && !formData) {
      setFormData({
        customer_company_name: deal.customer_company_name ?? '',
        customer_contact_name: deal.customer_contact_name ?? '',
        customer_contact_email: deal.customer_contact_email ?? '',
        customer_contact_phone: deal.customer_contact_phone ?? '',
        customer_industry: deal.customer_industry ?? '',
        customer_address: deal.customer_address ?? '',
        deal_name: deal.deal_name ?? '',
        description: deal.description ?? '',
        estimated_value: deal.estimated_value ? String(deal.estimated_value) : '',
        currency: deal.currency ?? 'USD',
        win_probability: deal.win_probability != null ? String(deal.win_probability) : '50',
        expected_close_date: deal.expected_close_date
          ? deal.expected_close_date.split('T')[0]
          : '',
        source: deal.source ?? '',
      });
    }
  }, [deal, formData]);

  const updateField = useCallback(
    (field: keyof FormData, value: string) => {
      setFormData((prev) => (prev ? { ...prev, [field]: value } : null));
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

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!formData) return;
      const payload: UpdateDealRequest = {
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
      const { data } = await dealsApi.update(id!, payload);
      return data.data;
    },
    onSuccess: () => {
      toast.success('Deal updated successfully');
      queryClient.invalidateQueries({ queryKey: ['deal', id] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      navigate(`/deals/${id}`);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });

  const handleSave = useCallback(() => {
    if (!formData) return;
    const errs: Partial<Record<keyof FormData, string>> = {};
    if (!formData.customer_company_name.trim()) {
      errs.customer_company_name = 'Company name is required';
    }
    if (!formData.deal_name.trim()) errs.deal_name = 'Deal name is required';
    if (!formData.estimated_value || Number(formData.estimated_value) <= 0) {
      errs.estimated_value = 'Estimated value must be greater than 0';
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    updateMutation.mutate();
  }, [formData, updateMutation]);

  // Guard: only draft/rejected deals can be edited
  if (deal && deal.status !== 'draft' && deal.status !== 'rejected') {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Cannot edit this deal
        </h2>
        <p className="text-gray-500 mb-4">
          Only deals in draft or rejected status can be edited.
        </p>
        <button
          onClick={() => navigate(`/deals/${id}`)}
          className="text-sm font-medium text-panw-navy hover:text-panw-blue"
        >
          Back to Deal Detail
        </button>
      </div>
    );
  }

  if (isLoading || !formData) {
    return (
      <div>
        <PageHeader
          title="Edit Deal"
          breadcrumbs={[
            { label: 'Deals', to: '/deals' },
            { label: 'Edit' },
          ]}
        />
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <FormSkeleton fields={8} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`Edit: ${deal?.deal_name ?? 'Deal'}`}
        subtitle={deal?.deal_number}
        breadcrumbs={[
          { label: 'Deals', to: '/deals' },
          { label: deal?.deal_number ?? '', to: `/deals/${id}` },
          { label: 'Edit' },
        ]}
      />

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-8">
        {/* Customer Information */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Customer Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FormField
              label="Company Name"
              htmlFor="edit_company"
              required
              error={errors.customer_company_name}
            >
              <Input
                id="edit_company"
                value={formData.customer_company_name}
                onChange={(e) =>
                  updateField('customer_company_name', e.target.value)
                }
                hasError={!!errors.customer_company_name}
              />
            </FormField>
            <FormField label="Contact Name" htmlFor="edit_contact">
              <Input
                id="edit_contact"
                value={formData.customer_contact_name}
                onChange={(e) =>
                  updateField('customer_contact_name', e.target.value)
                }
              />
            </FormField>
            <FormField label="Contact Email" htmlFor="edit_email">
              <Input
                id="edit_email"
                type="email"
                value={formData.customer_contact_email}
                onChange={(e) =>
                  updateField('customer_contact_email', e.target.value)
                }
              />
            </FormField>
            <FormField label="Contact Phone" htmlFor="edit_phone">
              <Input
                id="edit_phone"
                type="tel"
                value={formData.customer_contact_phone}
                onChange={(e) =>
                  updateField('customer_contact_phone', e.target.value)
                }
              />
            </FormField>
            <FormField label="Industry" htmlFor="edit_industry">
              <Select
                id="edit_industry"
                value={formData.customer_industry}
                onChange={(e) =>
                  updateField('customer_industry', e.target.value)
                }
              >
                <option value="">Select industry...</option>
                {INDUSTRIES.map((ind) => (
                  <option key={ind} value={ind}>
                    {ind}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Address" htmlFor="edit_address">
              <Input
                id="edit_address"
                value={formData.customer_address}
                onChange={(e) =>
                  updateField('customer_address', e.target.value)
                }
              />
            </FormField>
          </div>
        </div>

        {/* Deal Details */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Deal Details
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FormField
              label="Deal Name"
              htmlFor="edit_deal_name"
              required
              error={errors.deal_name}
              className="md:col-span-2"
            >
              <Input
                id="edit_deal_name"
                value={formData.deal_name}
                onChange={(e) => updateField('deal_name', e.target.value)}
                hasError={!!errors.deal_name}
              />
            </FormField>
            <FormField
              label="Description"
              htmlFor="edit_description"
              className="md:col-span-2"
            >
              <Textarea
                id="edit_description"
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                rows={3}
              />
            </FormField>
            <FormField
              label="Estimated Value (USD)"
              htmlFor="edit_value"
              required
              error={errors.estimated_value}
            >
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                  $
                </span>
                <Input
                  id="edit_value"
                  type="number"
                  min="0"
                  step="1000"
                  value={formData.estimated_value}
                  onChange={(e) => updateField('estimated_value', e.target.value)}
                  hasError={!!errors.estimated_value}
                  className="pl-7"
                />
              </div>
            </FormField>
            <FormField
              label="Expected Close Date"
              htmlFor="edit_close_date"
            >
              <Input
                id="edit_close_date"
                type="date"
                value={formData.expected_close_date}
                onChange={(e) =>
                  updateField('expected_close_date', e.target.value)
                }
              />
            </FormField>
            <FormField label="Win Probability (%)" htmlFor="edit_prob">
              <div className="flex items-center gap-3">
                <input
                  id="edit_prob"
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={formData.win_probability}
                  onChange={(e) =>
                    updateField('win_probability', e.target.value)
                  }
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-navy-900"
                />
                <span className="text-sm font-semibold text-gray-700 w-12 text-right">
                  {formData.win_probability}%
                </span>
              </div>
            </FormField>
            <FormField label="Source" htmlFor="edit_source">
              <Select
                id="edit_source"
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
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
          <button
            onClick={() => navigate(`/deals/${id}`)}
            className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="rounded-md bg-panw-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-panw-navy shadow-sm disabled:opacity-50"
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
