import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateLead } from '../../hooks/useLeads';
import {
  PageHeader,
  FormField,
  Input,
  Select,
  Textarea,
} from '../../components/shared';
import toast from 'react-hot-toast';
import type { CreateLeadRequest, LeadSource } from '../../types';

const LEAD_SOURCES: { label: string; value: LeadSource }[] = [
  { label: 'Marketing', value: 'marketing' },
  { label: 'Website', value: 'website' },
  { label: 'Event', value: 'event' },
  { label: 'Manual', value: 'manual' },
  { label: 'Referral', value: 'referral' },
];

const INDUSTRIES = [
  'Financial Services',
  'Healthcare',
  'Technology',
  'Manufacturing',
  'Retail',
  'Government',
  'Education',
  'Energy',
  'Telecommunications',
  'Media & Entertainment',
  'Transportation',
  'Real Estate',
  'Other',
];

const COMPANY_SIZES = [
  '1-50',
  '51-200',
  '201-500',
  '501-1000',
  '1000-5000',
  '5000+',
];

export function LeadCreate() {
  const navigate = useNavigate();
  const createMutation = useCreateLead();

  const [form, setForm] = useState<CreateLeadRequest>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    company_name: '',
    title: '',
    industry: '',
    company_size: '',
    city: '',
    state_province: '',
    country: '',
    source: undefined,
    campaign_name: '',
    score: 50,
    budget: undefined,
    timeline: '',
    interest_notes: '',
    tags: [],
  });

  const [tagInput, setTagInput] = useState('');

  const updateField = useCallback(
    <K extends keyof CreateLeadRequest>(
      key: K,
      value: CreateLeadRequest[K]
    ) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const addTag = useCallback(() => {
    const tag = tagInput.trim();
    if (!tag) return;
    setForm((prev) => ({
      ...prev,
      tags: [...(prev.tags ?? []), tag],
    }));
    setTagInput('');
  }, [tagInput]);

  const removeTag = useCallback((index: number) => {
    setForm((prev) => ({
      ...prev,
      tags: (prev.tags ?? []).filter((_, i) => i !== index),
    }));
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!form.first_name?.trim() || !form.last_name?.trim()) {
        toast.error('First name and last name are required');
        return;
      }

      // Clean up empty optional fields
      const payload: CreateLeadRequest = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
      };

      if (form.email?.trim()) payload.email = form.email.trim();
      if (form.phone?.trim()) payload.phone = form.phone.trim();
      if (form.company_name?.trim()) payload.company_name = form.company_name.trim();
      if (form.title?.trim()) payload.title = form.title.trim();
      if (form.industry) payload.industry = form.industry;
      if (form.company_size) payload.company_size = form.company_size;
      if (form.city?.trim()) payload.city = form.city.trim();
      if (form.state_province?.trim()) payload.state_province = form.state_province.trim();
      if (form.country?.trim()) payload.country = form.country.trim();
      if (form.source) payload.source = form.source;
      if (form.campaign_name?.trim()) payload.campaign_name = form.campaign_name.trim();
      if (form.score != null) payload.score = form.score;
      if (form.budget) payload.budget = form.budget;
      if (form.timeline?.trim()) payload.timeline = form.timeline.trim();
      if (form.interest_notes?.trim()) payload.interest_notes = form.interest_notes.trim();
      if (form.tags && form.tags.length > 0) payload.tags = form.tags;

      try {
        const response = await createMutation.mutateAsync(payload);
        const newLead = response.data.data;
        navigate(`/leads/${newLead.id}`);
      } catch {
        // handled by hook
      }
    },
    [form, createMutation, navigate]
  );

  return (
    <div>
      <PageHeader
        title="Create Lead"
        subtitle="Add a new lead for partner distribution"
        breadcrumbs={[
          { label: 'Leads', to: '/leads' },
          { label: 'New Lead' },
        ]}
      />

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-8">
        {/* Contact Information */}
        <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            Contact Information
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="First Name" htmlFor="first_name" required>
              <Input
                id="first_name"
                value={form.first_name}
                onChange={(e) => updateField('first_name', e.target.value)}
                placeholder="Jane"
              />
            </FormField>
            <FormField label="Last Name" htmlFor="last_name" required>
              <Input
                id="last_name"
                value={form.last_name}
                onChange={(e) => updateField('last_name', e.target.value)}
                placeholder="Doe"
              />
            </FormField>
            <FormField label="Email" htmlFor="email">
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder="jane.doe@acmecorp.com"
              />
            </FormField>
            <FormField label="Phone" htmlFor="phone">
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                placeholder="+1-555-0123"
              />
            </FormField>
            <FormField label="Title" htmlFor="title">
              <Input
                id="title"
                value={form.title}
                onChange={(e) => updateField('title', e.target.value)}
                placeholder="VP of IT Security"
              />
            </FormField>
          </div>
        </section>

        {/* Company Information */}
        <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            Company Information
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Company Name" htmlFor="company_name">
              <Input
                id="company_name"
                value={form.company_name}
                onChange={(e) => updateField('company_name', e.target.value)}
                placeholder="Acme Corp"
              />
            </FormField>
            <FormField label="Industry" htmlFor="industry">
              <Select
                id="industry"
                value={form.industry}
                onChange={(e) => updateField('industry', e.target.value)}
              >
                <option value="">Select industry...</option>
                {INDUSTRIES.map((ind) => (
                  <option key={ind} value={ind}>
                    {ind}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Company Size" htmlFor="company_size">
              <Select
                id="company_size"
                value={form.company_size}
                onChange={(e) => updateField('company_size', e.target.value)}
              >
                <option value="">Select size...</option>
                {COMPANY_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size} employees
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            <FormField label="City" htmlFor="city">
              <Input
                id="city"
                value={form.city}
                onChange={(e) => updateField('city', e.target.value)}
                placeholder="New York"
              />
            </FormField>
            <FormField label="State / Province" htmlFor="state_province">
              <Input
                id="state_province"
                value={form.state_province}
                onChange={(e) => updateField('state_province', e.target.value)}
                placeholder="NY"
              />
            </FormField>
            <FormField label="Country" htmlFor="country">
              <Input
                id="country"
                value={form.country}
                onChange={(e) => updateField('country', e.target.value)}
                placeholder="US"
              />
            </FormField>
          </div>
        </section>

        {/* Lead Source & Scoring */}
        <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            Source & Scoring
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Lead Source" htmlFor="source">
              <Select
                id="source"
                value={form.source ?? ''}
                onChange={(e) =>
                  updateField(
                    'source',
                    (e.target.value as LeadSource) || undefined
                  )
                }
              >
                <option value="">Select source...</option>
                {LEAD_SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Campaign Name" htmlFor="campaign_name">
              <Input
                id="campaign_name"
                value={form.campaign_name}
                onChange={(e) => updateField('campaign_name', e.target.value)}
                placeholder="Q1 Webinar Series"
              />
            </FormField>
            <FormField label="Lead Score (0-100)" htmlFor="score">
              <div className="flex items-center gap-3">
                <Input
                  id="score"
                  type="range"
                  min="0"
                  max="100"
                  value={form.score ?? 50}
                  onChange={(e) => updateField('score', Number(e.target.value))}
                  className="flex-1"
                />
                <span className="w-10 text-center text-sm font-semibold text-gray-900">
                  {form.score ?? 50}
                </span>
              </div>
            </FormField>
            <FormField label="Budget (USD)" htmlFor="budget">
              <Input
                id="budget"
                type="number"
                min="0"
                step="1000"
                value={form.budget ?? ''}
                onChange={(e) =>
                  updateField(
                    'budget',
                    e.target.value ? Number(e.target.value) : undefined
                  )
                }
                placeholder="150000"
              />
            </FormField>
            <FormField label="Timeline" htmlFor="timeline">
              <Input
                id="timeline"
                value={form.timeline}
                onChange={(e) => updateField('timeline', e.target.value)}
                placeholder="Q2 2026"
              />
            </FormField>
          </div>
        </section>

        {/* Notes & Tags */}
        <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            Notes & Tags
          </h3>
          <div className="space-y-4">
            <FormField label="Interest Notes" htmlFor="interest_notes">
              <Textarea
                id="interest_notes"
                value={form.interest_notes}
                onChange={(e) => updateField('interest_notes', e.target.value)}
                rows={4}
                placeholder="Interested in next-gen firewall for branch offices..."
              />
            </FormField>
            <FormField label="Tags" htmlFor="tag-input">
              <div className="flex gap-2">
                <Input
                  id="tag-input"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  placeholder="Add a tag and press Enter..."
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
                >
                  Add
                </button>
              </div>
              {form.tags && form.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {form.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-full"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(idx)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </FormField>
          </div>
        </section>

        {/* Actions */}
        <div className="flex justify-end gap-3 pb-8">
          <button
            type="button"
            onClick={() => navigate('/leads')}
            className="rounded-md bg-white px-4 py-2.5 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="rounded-md bg-panw-blue px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-panw-navy disabled:opacity-50 transition-colors"
          >
            {createMutation.isPending ? 'Creating...' : 'Create Lead'}
          </button>
        </div>
      </form>
    </div>
  );
}
