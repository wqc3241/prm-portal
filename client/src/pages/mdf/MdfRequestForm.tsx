import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useMdfAllocations, useCreateMdfRequest } from '../../hooks/useMdf';
import {
  PageHeader,
  FormField,
  Input,
  Select,
  Textarea,
} from '../../components/shared';
import { formatCurrency } from '../../utils/formatters';
import { cn } from '../../utils/cn';
import {
  BookmarkIcon,
  PaperAirplaneIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import type { MdfActivityType, CreateMdfRequestPayload } from '../../types';

const ACTIVITY_TYPES: { value: MdfActivityType; label: string }[] = [
  { value: 'event', label: 'Event' },
  { value: 'trade_show', label: 'Trade Show' },
  { value: 'webinar', label: 'Webinar' },
  { value: 'digital_campaign', label: 'Digital Campaign' },
  { value: 'content_syndication', label: 'Content Syndication' },
  { value: 'email_campaign', label: 'Email Campaign' },
  { value: 'print_collateral', label: 'Print Collateral' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'other', label: 'Other' },
];

interface FormData {
  allocation_id: string;
  activity_type: MdfActivityType | '';
  activity_name: string;
  description: string;
  start_date: string;
  end_date: string;
  requested_amount: string;
}

const initialFormData: FormData = {
  allocation_id: '',
  activity_type: '',
  activity_name: '',
  description: '',
  start_date: '',
  end_date: '',
  requested_amount: '',
};

export function MdfRequestForm() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  // Fetch current allocations for the user's org
  const { data: allocationsData, isLoading: allocationsLoading } = useMdfAllocations({
    per_page: 50,
  });

  const allocations = allocationsData?.data ?? [];

  const createRequest = useCreateMdfRequest();

  // Selected allocation details
  const selectedAllocation = useMemo(
    () => allocations.find((a) => a.id === formData.allocation_id),
    [allocations, formData.allocation_id]
  );

  // Auto-select allocation if only one available
  useMemo(() => {
    if (allocations.length === 1 && !formData.allocation_id) {
      setFormData((prev) => ({ ...prev, allocation_id: allocations[0].id }));
    }
  }, [allocations, formData.allocation_id]);

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

  // Validation
  const validate = useCallback(
    (isDraft: boolean): boolean => {
      const errs: Partial<Record<keyof FormData, string>> = {};

      if (!formData.allocation_id) {
        errs.allocation_id = 'Please select a quarterly allocation';
      }
      if (!formData.activity_type) {
        errs.activity_type = 'Activity type is required';
      }
      if (!formData.activity_name.trim()) {
        errs.activity_name = 'Activity title is required';
      }

      if (!isDraft) {
        if (!formData.requested_amount || Number(formData.requested_amount) <= 0) {
          errs.requested_amount = 'Amount must be greater than 0';
        }
        if (!formData.start_date) {
          errs.start_date = 'Start date is required';
        }
        if (!formData.end_date) {
          errs.end_date = 'End date is required';
        }

        // Validate start date is at least 14 days from now
        if (formData.start_date) {
          const startDate = new Date(formData.start_date);
          const minDate = new Date();
          minDate.setDate(minDate.getDate() + 14);
          if (startDate < minDate) {
            errs.start_date = 'Start date must be at least 14 days from today';
          }
        }

        // Validate end date is after start date
        if (formData.start_date && formData.end_date) {
          if (new Date(formData.end_date) <= new Date(formData.start_date)) {
            errs.end_date = 'End date must be after start date';
          }
        }

        // Validate amount against remaining allocation
        if (selectedAllocation && Number(formData.requested_amount) > selectedAllocation.remaining_amount) {
          errs.requested_amount = `Amount exceeds remaining balance of ${formatCurrency(selectedAllocation.remaining_amount)}`;
        }

        // Validate amount <= 50% of quarterly allocation
        if (
          selectedAllocation &&
          Number(formData.requested_amount) > selectedAllocation.allocated_amount * 0.5
        ) {
          errs.requested_amount = `Amount cannot exceed 50% of quarterly allocation (${formatCurrency(selectedAllocation.allocated_amount * 0.5)})`;
        }
      }

      setErrors(errs);
      return Object.keys(errs).length === 0;
    },
    [formData, selectedAllocation]
  );

  const buildPayload = useCallback((): CreateMdfRequestPayload => {
    return {
      allocation_id: formData.allocation_id,
      activity_type: formData.activity_type as MdfActivityType,
      activity_name: formData.activity_name,
      description: formData.description || undefined,
      start_date: formData.start_date,
      end_date: formData.end_date,
      requested_amount: Number(formData.requested_amount),
    };
  }, [formData]);

  const handleSaveDraft = useCallback(() => {
    if (!validate(true)) return;
    createRequest.mutate(buildPayload(), {
      onSuccess: (res) => {
        navigate(`/mdf/requests/${res.data.data.id}`);
      },
    });
  }, [validate, buildPayload, createRequest, navigate]);

  const handleSubmit = useCallback(() => {
    if (!validate(false)) return;
    createRequest.mutate(buildPayload(), {
      onSuccess: (res) => {
        navigate(`/mdf/requests/${res.data.data.id}`);
      },
    });
  }, [validate, buildPayload, createRequest, navigate]);

  const isSubmitting = createRequest.isPending;

  // Minimum start date (14 days from now)
  const minStartDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  }, []);

  return (
    <div>
      <PageHeader
        title="New MDF Request"
        breadcrumbs={[
          { label: 'MDF', to: '/mdf' },
          { label: 'Requests', to: '/mdf/requests' },
          { label: 'New Request' },
        ]}
      />

      {/* Remaining balance banner */}
      {selectedAllocation && (
        <div
          className={cn(
            'mb-6 rounded-lg border p-4 flex items-center justify-between',
            selectedAllocation.remaining_amount > 0
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          )}
        >
          <div>
            <p className="text-sm font-medium text-gray-700">
              Q{selectedAllocation.fiscal_quarter} {selectedAllocation.fiscal_year} Remaining Balance
            </p>
            <p
              className={cn(
                'text-2xl font-bold mt-0.5',
                selectedAllocation.remaining_amount > 0
                  ? 'text-green-800'
                  : 'text-red-800'
              )}
            >
              {formatCurrency(selectedAllocation.remaining_amount)}
            </p>
          </div>
          <div className="text-right text-sm text-gray-500">
            <p>
              Allocated: {formatCurrency(selectedAllocation.allocated_amount)}
            </p>
            <p>
              Spent: {formatCurrency(selectedAllocation.spent_amount)}
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="space-y-5">
          <h2 className="text-lg font-semibold text-gray-900">
            Request Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Allocation selector */}
            <FormField
              label="Quarterly Allocation"
              htmlFor="allocation_id"
              required
              error={errors.allocation_id}
            >
              <Select
                id="allocation_id"
                value={formData.allocation_id}
                onChange={(e) => updateField('allocation_id', e.target.value)}
                hasError={!!errors.allocation_id}
              >
                <option value="">Select allocation...</option>
                {allocations.map((a) => (
                  <option key={a.id} value={a.id}>
                    Q{a.fiscal_quarter} {a.fiscal_year}
                    {a.organization_name ? ` - ${a.organization_name}` : ''} (
                    {formatCurrency(a.remaining_amount)} remaining)
                  </option>
                ))}
              </Select>
              {allocationsLoading && (
                <p className="text-xs text-gray-400 mt-1">
                  Loading allocations...
                </p>
              )}
            </FormField>

            {/* Activity type */}
            <FormField
              label="Activity Type"
              htmlFor="activity_type"
              required
              error={errors.activity_type}
            >
              <Select
                id="activity_type"
                value={formData.activity_type}
                onChange={(e) => updateField('activity_type', e.target.value)}
                hasError={!!errors.activity_type}
              >
                <option value="">Select activity type...</option>
                {ACTIVITY_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </FormField>

            {/* Activity title */}
            <FormField
              label="Activity Title"
              htmlFor="activity_name"
              required
              error={errors.activity_name}
              className="md:col-span-2"
            >
              <Input
                id="activity_name"
                value={formData.activity_name}
                onChange={(e) => updateField('activity_name', e.target.value)}
                hasError={!!errors.activity_name}
                placeholder="e.g., Q1 Partner Summit 2026"
              />
            </FormField>

            {/* Description */}
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
                placeholder="Describe the planned marketing activity, target audience, and expected outcomes..."
              />
            </FormField>

            {/* Requested amount */}
            <FormField
              label="Requested Amount (USD)"
              htmlFor="requested_amount"
              required
              error={errors.requested_amount}
            >
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                  $
                </span>
                <Input
                  id="requested_amount"
                  type="number"
                  min="0"
                  step="100"
                  value={formData.requested_amount}
                  onChange={(e) => updateField('requested_amount', e.target.value)}
                  hasError={!!errors.requested_amount}
                  className="pl-7"
                  placeholder="0"
                />
              </div>
              {selectedAllocation && (
                <p className="text-xs text-gray-400 mt-1">
                  Max single request: {formatCurrency(selectedAllocation.allocated_amount * 0.5)} (50% of allocation)
                </p>
              )}
            </FormField>

            {/* Placeholder for alignment */}
            <div />

            {/* Start date */}
            <FormField
              label="Start Date"
              htmlFor="start_date"
              required
              error={errors.start_date}
            >
              <Input
                id="start_date"
                type="date"
                min={minStartDate}
                value={formData.start_date}
                onChange={(e) => updateField('start_date', e.target.value)}
                hasError={!!errors.start_date}
              />
              <p className="text-xs text-gray-400 mt-1">
                Must be at least 14 days from today
              </p>
            </FormField>

            {/* End date */}
            <FormField
              label="End Date"
              htmlFor="end_date"
              required
              error={errors.end_date}
            >
              <Input
                id="end_date"
                type="date"
                min={formData.start_date || minStartDate}
                value={formData.end_date}
                onChange={(e) => updateField('end_date', e.target.value)}
                hasError={!!errors.end_date}
              />
            </FormField>
          </div>

          {/* Validation warnings */}
          {selectedAllocation && selectedAllocation.remaining_amount <= 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 p-3">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-600 flex-shrink-0" />
              <span className="text-sm text-red-800">
                No remaining balance in this allocation. Your request will likely
                be rejected.
              </span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-between mt-8 pt-5 border-t border-gray-200">
          <button
            onClick={() => navigate('/mdf/requests')}
            className="text-sm font-medium text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveDraft}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
            >
              <BookmarkIcon className="h-4 w-4" />
              Save Draft
            </button>

            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-md bg-panw-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-panw-navy shadow-sm disabled:opacity-50"
            >
              <PaperAirplaneIcon className="h-4 w-4" />
              {isSubmitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
