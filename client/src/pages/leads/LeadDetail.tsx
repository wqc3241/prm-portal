import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  useLead,
  useLeadHistory,
  useAssignLead,
  useAcceptLead,
  useReturnLead,
  useConvertToDeal,
  useDisqualifyLead,
} from '../../hooks/useLeads';
import { useQuery } from '@tanstack/react-query';
import { organizationsApi } from '../../api/organizations';
import toast from 'react-hot-toast';
import {
  PageHeader,
  StatusBadge,
  Modal,
  FormField,
  Select,
  Textarea,
  Skeleton,
  CardSkeleton,
} from '../../components/shared';
import { ScoreBadge } from '../../components/leads/ScoreBadge';
import { SlaIndicator } from '../../components/leads/SlaIndicator';
import {
  formatDate,
  formatDateTime,
  humanize,
} from '../../utils/formatters';
import { cn } from '../../utils/cn';
import {
  CheckIcon,
  ArrowUturnLeftIcon,
  ArrowPathRoundedSquareIcon,
  XMarkIcon,
  NoSymbolIcon,
  UserPlusIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';

export function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const isInternal = hasRole('admin', 'channel_manager');
  const isPartner = hasRole('partner_admin', 'partner_rep');

  // Modals
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [disqualifyModalOpen, setDisqualifyModalOpen] = useState(false);
  const [convertModalOpen, setConvertModalOpen] = useState(false);

  // Form state
  const [assignOrgId, setAssignOrgId] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [disqualifyReason, setDisqualifyReason] = useState('');

  // Queries
  const {
    data: lead,
    isLoading: leadLoading,
    isError: leadError,
  } = useLead(id);

  const { data: history } = useLeadHistory(id);

  const { data: orgsData } = useQuery({
    queryKey: ['organizations-for-assign'],
    queryFn: async () => {
      const { data } = await organizationsApi.list({ status: 'active' as any, per_page: 200 });
      return data.data;
    },
    enabled: assignModalOpen,
  });

  // Computed permissions
  const isAssignedToMyOrg =
    lead?.assigned_org_id != null &&
    lead.assigned_org_id === user?.organization_id;

  const canAssign =
    isInternal &&
    lead != null &&
    (lead.status === 'new' || lead.status === 'returned');

  const canReassign =
    isInternal &&
    lead != null &&
    lead.status === 'assigned';

  const canAccept =
    isPartner &&
    isAssignedToMyOrg &&
    lead?.status === 'assigned';

  const canReturn =
    isPartner &&
    isAssignedToMyOrg &&
    (lead?.status === 'assigned' || lead?.status === 'accepted');

  const canConvert =
    isPartner &&
    isAssignedToMyOrg &&
    (lead?.status === 'accepted' ||
      lead?.status === 'contacted' ||
      lead?.status === 'qualified');

  const canDisqualify =
    lead != null &&
    lead.status !== 'converted' &&
    lead.status !== 'disqualified' &&
    (isInternal || isAssignedToMyOrg);

  // Mutations
  const assignMutation = useAssignLead(id!);
  const acceptMutation = useAcceptLead(id!);
  const returnMutation = useReturnLead(id!);
  const convertMutation = useConvertToDeal(id!);
  const disqualifyMutation = useDisqualifyLead(id!);

  const handleAssign = useCallback(() => {
    if (!assignOrgId) {
      toast.error('Please select an organization');
      return;
    }
    assignMutation.mutate(
      { organization_id: assignOrgId },
      {
        onSuccess: () => {
          setAssignModalOpen(false);
          setAssignOrgId('');
        },
      }
    );
  }, [assignOrgId, assignMutation]);

  const handleReturn = useCallback(() => {
    if (!returnReason.trim()) {
      toast.error('Return reason is required');
      return;
    }
    returnMutation.mutate(
      { return_reason: returnReason },
      {
        onSuccess: () => {
          setReturnModalOpen(false);
          setReturnReason('');
        },
      }
    );
  }, [returnReason, returnMutation]);

  const handleConvert = useCallback(async () => {
    try {
      const response = await convertMutation.mutateAsync({});
      const dealId = response.data.data?.converted_deal_id;
      setConvertModalOpen(false);
      if (dealId) {
        navigate(`/deals/${dealId}`);
      }
    } catch {
      // handled by hook
    }
  }, [convertMutation, navigate]);

  const handleDisqualify = useCallback(() => {
    if (!disqualifyReason.trim()) {
      toast.error('Disqualification reason is required');
      return;
    }
    disqualifyMutation.mutate(
      { disqualify_reason: disqualifyReason },
      {
        onSuccess: () => {
          setDisqualifyModalOpen(false);
          setDisqualifyReason('');
        },
      }
    );
  }, [disqualifyReason, disqualifyMutation]);

  // Loading / Error
  if (leadLoading) {
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

  if (leadError || !lead) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Lead not found
        </h2>
        <p className="text-gray-500 mb-4">
          This lead does not exist or you do not have access to it.
        </p>
        <button
          onClick={() => navigate('/leads')}
          className="text-sm font-medium text-panw-navy hover:text-panw-blue"
        >
          Back to Leads
        </button>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`Lead ${lead.lead_number}`}
        subtitle={lead.company_name || `${lead.first_name} ${lead.last_name}`}
        breadcrumbs={[
          { label: 'Leads', to: '/leads' },
          { label: lead.lead_number },
        ]}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {/* Assign / Reassign */}
            {(canAssign || canReassign) && (
              <button
                onClick={() => setAssignModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md bg-panw-blue px-3 py-2 text-sm font-semibold text-white hover:bg-panw-navy shadow-sm"
              >
                <UserPlusIcon className="h-4 w-4" />
                {canReassign ? 'Reassign' : 'Assign'}
              </button>
            )}

            {/* Accept */}
            {canAccept && (
              <button
                onClick={() => acceptMutation.mutate()}
                disabled={acceptMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-md bg-green-700 px-3 py-2 text-sm font-semibold text-white hover:bg-green-600 shadow-sm disabled:opacity-50"
              >
                <CheckIcon className="h-4 w-4" />
                {acceptMutation.isPending ? 'Accepting...' : 'Accept Lead'}
              </button>
            )}

            {/* Return */}
            {canReturn && (
              <button
                onClick={() => setReturnModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-2 text-sm font-medium text-yellow-700 ring-1 ring-inset ring-yellow-300 hover:bg-yellow-50"
              >
                <ArrowUturnLeftIcon className="h-4 w-4" />
                Return
              </button>
            )}

            {/* Convert to Deal */}
            {canConvert && (
              <button
                onClick={() => setConvertModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md bg-panw-blue px-3 py-2 text-sm font-semibold text-white hover:bg-panw-navy shadow-sm"
              >
                <ArrowPathRoundedSquareIcon className="h-4 w-4" />
                Convert to Deal
              </button>
            )}

            {/* Disqualify */}
            {canDisqualify && (
              <button
                onClick={() => setDisqualifyModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-inset ring-red-300 hover:bg-red-50"
              >
                <NoSymbolIcon className="h-4 w-4" />
                Disqualify
              </button>
            )}
          </div>
        }
      />

      {/* Status + Score + SLA badges row */}
      <div className="flex items-center gap-3 mb-4 -mt-4 flex-wrap">
        <StatusBadge status={lead.status} size="md" />
        <ScoreBadge score={lead.score} size="md" />
        <SlaIndicator
          deadline={lead.sla_deadline}
          status={lead.status}
          size="md"
          showLabel
        />
        {lead.tags?.includes('multiple_returns') && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">
            Multiple Returns
          </span>
        )}
      </div>

      {/* Return reason alert */}
      {lead.status === 'returned' && lead.return_reason && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-yellow-50 border border-yellow-200 p-3">
          <ArrowUturnLeftIcon className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-800">Return Reason</p>
            <p className="text-sm text-yellow-700 mt-0.5">{lead.return_reason}</p>
          </div>
        </div>
      )}

      {/* Disqualify reason alert */}
      {lead.status === 'disqualified' && lead.disqualify_reason && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3">
          <NoSymbolIcon className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Disqualification Reason</p>
            <p className="text-sm text-red-700 mt-0.5">{lead.disqualify_reason}</p>
          </div>
        </div>
      )}

      {/* Conversion info */}
      {lead.status === 'converted' && lead.converted_deal_id && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 p-3">
          <CheckIcon className="h-5 w-5 text-green-600 flex-shrink-0" />
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-green-800">
              Converted to Deal
            </span>
            {lead.converted_deal_number && (
              <button
                onClick={() => navigate(`/deals/${lead.converted_deal_id}`)}
                className="inline-flex items-center gap-1 text-sm font-medium text-green-700 hover:text-green-900 underline"
              >
                {lead.converted_deal_number}
                <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
              </button>
            )}
            {lead.converted_at && (
              <span className="text-xs text-green-600">
                on {formatDateTime(lead.converted_at)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Info */}
          <InfoCard title="Contact Information">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoField
                label="Full Name"
                value={`${lead.first_name} ${lead.last_name}`}
              />
              <InfoField label="Email" value={lead.email} />
              <InfoField label="Phone" value={lead.phone} />
              <InfoField label="Title" value={lead.title} />
              <InfoField label="Company" value={lead.company_name} />
              <InfoField label="Company Size" value={lead.company_size} />
            </div>
          </InfoCard>

          {/* Lead Details */}
          <InfoCard title="Lead Details">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoField label="Source" value={lead.source ? humanize(lead.source) : null} />
              <InfoField label="Campaign" value={lead.campaign_name} />
              <InfoField label="Industry" value={lead.industry} />
              <InfoField
                label="Location"
                value={
                  [lead.city, lead.state_province, lead.country]
                    .filter(Boolean)
                    .join(', ') || null
                }
              />
              <InfoField
                label="Budget"
                value={
                  lead.budget
                    ? new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                      }).format(lead.budget)
                    : null
                }
              />
              <InfoField label="Timeline" value={lead.timeline} />
            </div>
            {lead.interest_notes && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-500 mb-1">
                  Interest Notes
                </p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {lead.interest_notes}
                </p>
              </div>
            )}
            {lead.tags && lead.tags.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-500 mb-2">Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {lead.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </InfoCard>

          {/* Assignment Info (internal view) */}
          {(isInternal || isAssignedToMyOrg) && lead.assigned_org_id && (
            <InfoCard title="Assignment Information">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoField label="Assigned Partner" value={lead.assigned_org_name} />
                <InfoField label="Assigned User" value={lead.assigned_user_name} />
                <InfoField
                  label="Assigned At"
                  value={formatDateTime(lead.assigned_at)}
                />
                <InfoField
                  label="SLA Deadline"
                  value={formatDateTime(lead.sla_deadline)}
                />
                {lead.accepted_at && (
                  <InfoField
                    label="Accepted At"
                    value={formatDateTime(lead.accepted_at)}
                  />
                )}
              </div>
            </InfoCard>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Quick Info */}
          <InfoCard title="Lead Summary">
            <div className="space-y-3">
              <InfoField label="Lead Number" value={lead.lead_number} />
              <div>
                <p className="text-xs font-medium text-gray-500">Score</p>
                <div className="mt-1">
                  <ScoreBadge score={lead.score} size="md" />
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Status</p>
                <div className="mt-1">
                  <StatusBadge status={lead.status} size="md" />
                </div>
              </div>
              {lead.sla_deadline && lead.status === 'assigned' && (
                <div>
                  <p className="text-xs font-medium text-gray-500">SLA Countdown</p>
                  <div className="mt-1">
                    <SlaIndicator
                      deadline={lead.sla_deadline}
                      status={lead.status}
                      size="md"
                      showLabel
                    />
                  </div>
                </div>
              )}
              <InfoField label="Created" value={formatDateTime(lead.created_at)} />
              <InfoField label="Last Updated" value={formatDateTime(lead.updated_at)} />
            </div>
          </InfoCard>

          {/* Activity Timeline */}
          <InfoCard title="Activity History">
            {history && history.length > 0 ? (
              <StatusTimeline history={history} />
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                No activity yet
              </p>
            )}
          </InfoCard>
        </div>
      </div>

      {/* ---- Modals ---- */}

      {/* Assign Modal */}
      <Modal
        open={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        title={canReassign ? 'Reassign Lead' : 'Assign Lead'}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Select a partner organization to assign this lead to.
            The partner admin will be notified and will have 48 hours to accept.
          </p>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm">
              <span className="text-gray-500">Lead:</span>{' '}
              <span className="font-semibold">{lead.lead_number}</span>
              {lead.company_name && (
                <span className="text-gray-500"> - {lead.company_name}</span>
              )}
            </p>
          </div>
          <FormField label="Partner Organization" htmlFor="assign-org" required>
            <Select
              id="assign-org"
              value={assignOrgId}
              onChange={(e) => setAssignOrgId(e.target.value)}
            >
              <option value="">Select organization...</option>
              {(orgsData ?? []).map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name} {org.tier?.name ? `(${org.tier.name})` : ''}
                </option>
              ))}
            </Select>
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setAssignModalOpen(false)}
              className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleAssign}
              disabled={!assignOrgId || assignMutation.isPending}
              className="rounded-md bg-panw-blue px-4 py-2 text-sm font-semibold text-white hover:bg-panw-navy disabled:opacity-50"
            >
              {assignMutation.isPending ? 'Assigning...' : 'Assign Lead'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Return Modal */}
      <Modal
        open={returnModalOpen}
        onClose={() => setReturnModalOpen(false)}
        title="Return Lead"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Returning this lead will send it back to the unassigned pool.
            Please provide a reason for the return.
          </p>
          <FormField label="Return Reason" htmlFor="return-reason" required>
            <Textarea
              id="return-reason"
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              rows={3}
              placeholder="Explain why this lead is being returned..."
            />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setReturnModalOpen(false)}
              className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleReturn}
              disabled={returnMutation.isPending}
              className="rounded-md bg-yellow-600 px-4 py-2 text-sm font-semibold text-white hover:bg-yellow-500 disabled:opacity-50"
            >
              {returnMutation.isPending ? 'Returning...' : 'Return Lead'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Convert to Deal Modal */}
      <Modal
        open={convertModalOpen}
        onClose={() => setConvertModalOpen(false)}
        title="Convert Lead to Deal"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            This will create a new deal registration pre-populated with the
            lead's contact and company information. The lead will be marked as
            converted.
          </p>
          <div className="bg-gray-50 rounded-lg p-3 space-y-1">
            <p className="text-sm">
              <span className="text-gray-500">Company:</span>{' '}
              <span className="font-medium">{lead.company_name || 'N/A'}</span>
            </p>
            <p className="text-sm">
              <span className="text-gray-500">Contact:</span>{' '}
              <span className="font-medium">
                {lead.first_name} {lead.last_name}
              </span>
            </p>
            {lead.email && (
              <p className="text-sm">
                <span className="text-gray-500">Email:</span>{' '}
                <span className="font-medium">{lead.email}</span>
              </p>
            )}
            {lead.budget && (
              <p className="text-sm">
                <span className="text-gray-500">Budget:</span>{' '}
                <span className="font-medium">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                  }).format(lead.budget)}
                </span>
              </p>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setConvertModalOpen(false)}
              className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConvert}
              disabled={convertMutation.isPending}
              className="rounded-md bg-panw-blue px-4 py-2 text-sm font-semibold text-white hover:bg-panw-navy disabled:opacity-50"
            >
              {convertMutation.isPending ? 'Converting...' : 'Convert to Deal'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Disqualify Modal */}
      <Modal
        open={disqualifyModalOpen}
        onClose={() => setDisqualifyModalOpen(false)}
        title="Disqualify Lead"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Disqualifying this lead will mark it as invalid. This action cannot
            be undone. Please provide a reason.
          </p>
          <FormField
            label="Disqualification Reason"
            htmlFor="disqualify-reason"
            required
          >
            <Textarea
              id="disqualify-reason"
              value={disqualifyReason}
              onChange={(e) => setDisqualifyReason(e.target.value)}
              rows={3}
              placeholder="Explain why this lead is being disqualified..."
            />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setDisqualifyModalOpen(false)}
              className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleDisqualify}
              disabled={disqualifyMutation.isPending}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
            >
              {disqualifyMutation.isPending
                ? 'Disqualifying...'
                : 'Disqualify Lead'}
            </button>
          </div>
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
  history: {
    id: string;
    action: string;
    actor_name?: string;
    summary?: string;
    changes?: Record<string, unknown>;
    created_at: string;
  }[];
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
                    {entry.summary && (
                      <p className="text-xs text-gray-600 mt-0.5">
                        {entry.summary}
                      </p>
                    )}
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
    assigned: 'bg-blue-600',
    accepted: 'bg-green-500',
    contacted: 'bg-blue-400',
    qualified: 'bg-indigo-500',
    returned: 'bg-yellow-500',
    converted: 'bg-green-700',
    disqualified: 'bg-red-500',
    sla_warning_sent: 'bg-yellow-400',
    sla_breach: 'bg-red-600',
    multiple_return_warning: 'bg-orange-500',
  };
  return map[action] ?? 'bg-gray-400';
}
