import { useState, type FormEvent, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { authApi } from '../../api/auth';
import { organizationsApi } from '../../api/organizations';
import { getApiErrorMessage } from '../../api/client';
import {
  PageHeader,
  FormField,
  Input,
  Textarea,
  Select,
  StatusBadge,
  TierBadge,
} from '../../components/shared';
import { FormSkeleton } from '../../components/shared/LoadingSkeleton';
import toast from 'react-hot-toast';
import type { Organization } from '../../types';

export function SettingsPage() {
  const { user, hasRole, refreshUser } = useAuth();

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Manage your profile and organization settings"
        breadcrumbs={[{ label: 'Settings' }]}
      />

      <div className="max-w-3xl space-y-8">
        {/* Profile Section */}
        <ProfileSection />

        {/* Organization Section -- only for partner_admin */}
        {user?.organization_id && hasRole('partner_admin') && (
          <OrganizationSection orgId={user.organization_id} onUpdate={refreshUser} />
        )}

        {/* Organization info (read-only for non-admins) */}
        {user?.organization_id && !hasRole('partner_admin') && (
          <OrganizationReadOnly orgId={user.organization_id} />
        )}
      </div>
    </div>
  );
}

function ProfileSection() {
  const { user, refreshUser } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [title, setTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [timezone, setTimezone] = useState('');

  useEffect(() => {
    if (user) {
      setFirstName(user.first_name ?? '');
      setLastName(user.last_name ?? '');
      setTitle(user.title ?? '');
      setPhone(user.phone ?? '');
      setTimezone(user.timezone ?? '');
    }
  }, [user]);

  const mutation = useMutation({
    mutationFn: () =>
      authApi.updateMe({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        title: title.trim() || null,
        phone: phone.trim() || null,
        timezone: timezone || null,
      }),
    onSuccess: async () => {
      await refreshUser();
      toast.success('Profile updated');
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Profile</h2>
        <p className="text-sm text-gray-500">Your personal information</p>
      </div>
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="First Name" htmlFor="prof-fn" required>
            <Input
              id="prof-fn"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </FormField>
          <FormField label="Last Name" htmlFor="prof-ln" required>
            <Input
              id="prof-ln"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </FormField>
        </div>

        <FormField label="Email" htmlFor="prof-email">
          <Input id="prof-email" value={user?.email ?? ''} disabled />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Title" htmlFor="prof-title">
            <Input
              id="prof-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Sales Engineer"
            />
          </FormField>
          <FormField label="Phone" htmlFor="prof-phone">
            <Input
              id="prof-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 000-0000"
            />
          </FormField>
        </div>

        <FormField label="Timezone" htmlFor="prof-tz">
          <Select
            id="prof-tz"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
          >
            <option value="">Select timezone</option>
            <option value="America/New_York">Eastern (US)</option>
            <option value="America/Chicago">Central (US)</option>
            <option value="America/Denver">Mountain (US)</option>
            <option value="America/Los_Angeles">Pacific (US)</option>
            <option value="Europe/London">London (GMT)</option>
            <option value="Europe/Berlin">Berlin (CET)</option>
            <option value="Asia/Tokyo">Tokyo (JST)</option>
            <option value="Asia/Singapore">Singapore (SGT)</option>
            <option value="Australia/Sydney">Sydney (AEST)</option>
          </Select>
        </FormField>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="rounded-md bg-panw-blue px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-panw-navy disabled:opacity-50"
          >
            {mutation.isPending ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </form>
    </div>
  );
}

function OrganizationSection({
  orgId,
  onUpdate,
}: {
  orgId: string;
  onUpdate: () => void;
}) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['organization', orgId],
    queryFn: async () => {
      const { data: res } = await organizationsApi.getById(orgId);
      return res.data;
    },
  });

  const [form, setForm] = useState<Partial<Organization>>({});

  useEffect(() => {
    if (data) {
      setForm({
        name: data.name,
        phone: data.phone,
        website: data.website,
        address_line1: data.address_line1,
        city: data.city,
        state_province: data.state_province,
        country: data.country,
        postal_code: data.postal_code,
        industry: data.industry,
        notes: data.notes,
      });
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: () => organizationsApi.update(orgId, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', orgId] });
      onUpdate();
      toast.success('Organization updated');
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <FormSkeleton fields={5} />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Organization</h2>
          <p className="text-sm text-gray-500">Your company information</p>
        </div>
        <div className="flex items-center gap-2">
          {data?.tier && <TierBadge name={data.tier.name} />}
          {data?.status && <StatusBadge status={data.status} />}
        </div>
      </div>
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        <FormField label="Company Name" htmlFor="org-name" required>
          <Input
            id="org-name"
            value={form.name ?? ''}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Phone" htmlFor="org-phone">
            <Input
              id="org-phone"
              type="tel"
              value={form.phone ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            />
          </FormField>
          <FormField label="Website" htmlFor="org-web">
            <Input
              id="org-web"
              type="url"
              value={form.website ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))}
              placeholder="https://..."
            />
          </FormField>
        </div>

        <FormField label="Address" htmlFor="org-addr">
          <Input
            id="org-addr"
            value={form.address_line1 ?? ''}
            onChange={(e) =>
              setForm((p) => ({ ...p, address_line1: e.target.value }))
            }
          />
        </FormField>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <FormField label="City" htmlFor="org-city">
            <Input
              id="org-city"
              value={form.city ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
            />
          </FormField>
          <FormField label="State" htmlFor="org-state">
            <Input
              id="org-state"
              value={form.state_province ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, state_province: e.target.value }))}
            />
          </FormField>
          <FormField label="Country" htmlFor="org-country">
            <Input
              id="org-country"
              value={form.country ?? ''}
              onChange={(e) =>
                setForm((p) => ({ ...p, country: e.target.value }))
              }
            />
          </FormField>
          <FormField label="Postal Code" htmlFor="org-zip">
            <Input
              id="org-zip"
              value={form.postal_code ?? ''}
              onChange={(e) =>
                setForm((p) => ({ ...p, postal_code: e.target.value }))
              }
            />
          </FormField>
        </div>

        <FormField label="Industry" htmlFor="org-ind">
          <Input
            id="org-ind"
            value={form.industry ?? ''}
            onChange={(e) =>
              setForm((p) => ({ ...p, industry: e.target.value }))
            }
            placeholder="e.g. Cybersecurity, IT Services"
          />
        </FormField>

        <FormField label="Notes" htmlFor="org-notes">
          <Textarea
            id="org-notes"
            rows={3}
            value={form.notes ?? ''}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          />
        </FormField>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="rounded-md bg-panw-blue px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-panw-navy disabled:opacity-50"
          >
            {mutation.isPending ? 'Saving...' : 'Save Organization'}
          </button>
        </div>
      </form>
    </div>
  );
}

function OrganizationReadOnly({ orgId }: { orgId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['organization', orgId],
    queryFn: async () => {
      const { data: res } = await organizationsApi.getById(orgId);
      return res.data;
    },
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <FormSkeleton fields={3} />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Organization</h2>
          <p className="text-sm text-gray-500">Your company information (read-only)</p>
        </div>
        <div className="flex items-center gap-2">
          {data.tier && <TierBadge name={data.tier.name} />}
          <StatusBadge status={data.status} />
        </div>
      </div>
      <div className="p-6">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
          <InfoRow label="Company" value={data.name} />
          <InfoRow label="Industry" value={data.industry} />
          <InfoRow label="Phone" value={data.phone} />
          <InfoRow label="Website" value={data.website} />
          <InfoRow
            label="Address"
            value={[data.address_line1, data.city, data.state_province, data.country]
              .filter(Boolean)
              .join(', ')}
          />
        </dl>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900">{value || '-'}</dd>
    </div>
  );
}
