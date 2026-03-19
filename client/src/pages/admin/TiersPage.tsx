import { useState, useCallback, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tiersApi } from '../../api/tiers';
import { getApiErrorMessage } from '../../api/client';
import {
  PageHeader,
  DataTable,
  TierBadge,
  Modal,
  ConfirmDialog,
  FormField,
  Input,
  Textarea,
} from '../../components/shared';
import type { Column } from '../../components/shared/DataTable';
import type { Tier } from '../../types';
import { formatPercent, formatCurrency } from '../../utils/formatters';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const emptyTier: Partial<Tier> = {
  name: '',
  rank: 1,
  color_hex: '#6B7280',
  description: '',
  min_annual_revenue: 0,
  min_deals_closed: 0,
  min_certified_reps: 0,
  min_csat_score: 0,
  default_discount_pct: 0,
  max_discount_pct: 0,
  mdf_budget_pct: 0,
  lead_priority: 1,
  dedicated_channel_mgr: false,
};

export function TiersPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<Partial<Tier>>(emptyTier);
  const [isEditing, setIsEditing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Tier | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['tiers'],
    queryFn: async () => {
      const { data: res } = await tiersApi.list();
      return res;
    },
  });

  const createMutation = useMutation({
    mutationFn: (tier: Partial<Tier>) =>
      tiersApi.create(tier as Omit<Tier, 'id' | 'created_at' | 'updated_at'>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tiers'] });
      setModalOpen(false);
      toast.success('Tier created successfully');
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Tier> }) =>
      tiersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tiers'] });
      setModalOpen(false);
      toast.success('Tier updated successfully');
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tiersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tiers'] });
      setDeleteTarget(null);
      toast.success('Tier deleted successfully');
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err));
      setDeleteTarget(null);
    },
  });

  const openCreate = useCallback(() => {
    setEditingTier({ ...emptyTier });
    setIsEditing(false);
    setFormErrors({});
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((tier: Tier) => {
    setEditingTier({ ...tier });
    setIsEditing(true);
    setFormErrors({});
    setModalOpen(true);
  }, []);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!editingTier.name?.trim()) errs.name = 'Name is required';
    if (editingTier.rank == null || editingTier.rank < 1) errs.rank = 'Rank must be >= 1';
    if (
      editingTier.max_discount_pct != null &&
      editingTier.default_discount_pct != null &&
      editingTier.max_discount_pct < editingTier.default_discount_pct
    ) {
      errs.max_discount_pct = 'Max discount must be >= default discount';
    }
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    if (isEditing && editingTier.id) {
      const { id, created_at, updated_at, ...rest } = editingTier as Tier;
      updateMutation.mutate({ id, data: rest });
    } else {
      createMutation.mutate(editingTier);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const columns: Column<Tier>[] = [
    {
      key: 'rank',
      header: 'Rank',
      sortable: true,
      className: 'w-16',
      render: (tier) => (
        <span className="font-mono text-gray-500">#{tier.rank}</span>
      ),
    },
    {
      key: 'name',
      header: 'Tier',
      sortable: true,
      render: (tier) => <TierBadge name={tier.name} size="md" />,
    },
    {
      key: 'min_annual_revenue',
      header: 'Min Revenue',
      sortable: true,
      render: (tier) => formatCurrency(tier.min_annual_revenue),
    },
    {
      key: 'min_deals_closed',
      header: 'Min Deals',
      render: (tier) => tier.min_deals_closed,
    },
    {
      key: 'min_certified_reps',
      header: 'Min Certs',
      render: (tier) => tier.min_certified_reps,
    },
    {
      key: 'default_discount_pct',
      header: 'Default Discount',
      render: (tier) => formatPercent(tier.default_discount_pct),
    },
    {
      key: 'max_discount_pct',
      header: 'Max Discount',
      render: (tier) => formatPercent(tier.max_discount_pct),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-24',
      render: (tier) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              openEdit(tier);
            }}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
            aria-label={`Edit ${tier.name}`}
          >
            <PencilIcon className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeleteTarget(tier);
            }}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-red-600"
            aria-label={`Delete ${tier.name}`}
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Partner Tiers"
        subtitle="Manage partner program tiers, requirements, and benefits"
        breadcrumbs={[
          { label: 'Admin', to: '/' },
          { label: 'Tiers' },
        ]}
        actions={
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-md bg-panw-blue px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-panw-navy transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
            Add Tier
          </button>
        }
      />

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        loading={isLoading}
        meta={data?.meta ?? null}
        rowKey={(tier) => tier.id}
        emptyTitle="No tiers configured"
        emptyDescription="Create your first partner tier to get started."
        emptyAction={{ label: 'Add Tier', onClick: openCreate }}
      />

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={isEditing ? 'Edit Tier' : 'Create Tier'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Name" htmlFor="tier-name" error={formErrors.name} required>
              <Input
                id="tier-name"
                value={editingTier.name ?? ''}
                onChange={(e) =>
                  setEditingTier((prev) => ({ ...prev, name: e.target.value }))
                }
                hasError={!!formErrors.name}
                placeholder="e.g. Diamond Innovator"
              />
            </FormField>

            <FormField label="Rank" htmlFor="tier-rank" error={formErrors.rank} required>
              <Input
                id="tier-rank"
                type="number"
                min={1}
                value={editingTier.rank ?? 1}
                onChange={(e) =>
                  setEditingTier((prev) => ({
                    ...prev,
                    rank: parseInt(e.target.value) || 1,
                  }))
                }
                hasError={!!formErrors.rank}
              />
            </FormField>
          </div>

          <FormField label="Description" htmlFor="tier-desc">
            <Textarea
              id="tier-desc"
              rows={2}
              value={editingTier.description ?? ''}
              onChange={(e) =>
                setEditingTier((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="Optional tier description"
            />
          </FormField>

          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Requirements</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Min Annual Revenue ($)" htmlFor="tier-rev">
                <Input
                  id="tier-rev"
                  type="number"
                  min={0}
                  value={editingTier.min_annual_revenue ?? 0}
                  onChange={(e) =>
                    setEditingTier((prev) => ({
                      ...prev,
                      min_annual_revenue: parseFloat(e.target.value) || 0,
                    }))
                  }
                />
              </FormField>

              <FormField label="Min Deals Closed" htmlFor="tier-deals">
                <Input
                  id="tier-deals"
                  type="number"
                  min={0}
                  value={editingTier.min_deals_closed ?? 0}
                  onChange={(e) =>
                    setEditingTier((prev) => ({
                      ...prev,
                      min_deals_closed: parseInt(e.target.value) || 0,
                    }))
                  }
                />
              </FormField>

              <FormField label="Min Certified Reps" htmlFor="tier-certs">
                <Input
                  id="tier-certs"
                  type="number"
                  min={0}
                  value={editingTier.min_certified_reps ?? 0}
                  onChange={(e) =>
                    setEditingTier((prev) => ({
                      ...prev,
                      min_certified_reps: parseInt(e.target.value) || 0,
                    }))
                  }
                />
              </FormField>

              <FormField label="Min CSAT Score" htmlFor="tier-csat">
                <Input
                  id="tier-csat"
                  type="number"
                  min={0}
                  max={5}
                  step={0.1}
                  value={editingTier.min_csat_score ?? 0}
                  onChange={(e) =>
                    setEditingTier((prev) => ({
                      ...prev,
                      min_csat_score: parseFloat(e.target.value) || 0,
                    }))
                  }
                />
              </FormField>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Benefits</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField label="Default Discount (%)" htmlFor="tier-def-disc">
                <Input
                  id="tier-def-disc"
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={editingTier.default_discount_pct ?? 0}
                  onChange={(e) =>
                    setEditingTier((prev) => ({
                      ...prev,
                      default_discount_pct: parseFloat(e.target.value) || 0,
                    }))
                  }
                />
              </FormField>

              <FormField
                label="Max Discount (%)"
                htmlFor="tier-max-disc"
                error={formErrors.max_discount_pct}
              >
                <Input
                  id="tier-max-disc"
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={editingTier.max_discount_pct ?? 0}
                  onChange={(e) =>
                    setEditingTier((prev) => ({
                      ...prev,
                      max_discount_pct: parseFloat(e.target.value) || 0,
                    }))
                  }
                  hasError={!!formErrors.max_discount_pct}
                />
              </FormField>

              <FormField label="MDF Budget (%)" htmlFor="tier-mdf">
                <Input
                  id="tier-mdf"
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={editingTier.mdf_budget_pct ?? 0}
                  onChange={(e) =>
                    setEditingTier((prev) => ({
                      ...prev,
                      mdf_budget_pct: parseFloat(e.target.value) || 0,
                    }))
                  }
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <FormField label="Lead Priority" htmlFor="tier-lead">
                <Input
                  id="tier-lead"
                  type="number"
                  min={1}
                  value={editingTier.lead_priority ?? 1}
                  onChange={(e) =>
                    setEditingTier((prev) => ({
                      ...prev,
                      lead_priority: parseInt(e.target.value) || 1,
                    }))
                  }
                />
              </FormField>

              <FormField label="Dedicated Channel Manager" htmlFor="tier-dcm">
                <label className="flex items-center gap-2 mt-2">
                  <input
                    id="tier-dcm"
                    type="checkbox"
                    checked={editingTier.dedicated_channel_mgr ?? false}
                    onChange={(e) =>
                      setEditingTier((prev) => ({
                        ...prev,
                        dedicated_channel_mgr: e.target.checked,
                      }))
                    }
                    className="rounded border-gray-300 text-panw-navy focus:ring-panw-blue"
                  />
                  <span className="text-sm text-gray-700">Enabled</span>
                </label>
              </FormField>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-md bg-panw-blue px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-panw-navy disabled:opacity-50"
            >
              {isSaving
                ? 'Saving...'
                : isEditing
                  ? 'Update Tier'
                  : 'Create Tier'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Delete Tier"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone. Tiers with assigned organizations cannot be deleted.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
