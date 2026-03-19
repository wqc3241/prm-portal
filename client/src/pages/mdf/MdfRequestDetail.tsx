import { useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import {
  useMdfRequest,
  useMdfRequestHistory,
  useSubmitMdfRequest,
  useApproveMdfRequest,
  useRejectMdfRequest,
  useCompleteMdfRequest,
  useSubmitClaim,
  useApproveClaim,
  useRejectClaim,
  useMarkReimbursed,
  useUploadProof,
} from '../../hooks/useMdf';
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
  humanize,
} from '../../utils/formatters';
import { cn } from '../../utils/cn';
import {
  PaperAirplaneIcon,
  CheckIcon,
  XMarkIcon,
  CheckCircleIcon,
  DocumentArrowUpIcon,
  BanknotesIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import type { MdfRequestStatus } from '../../types';

export function MdfRequestDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const isInternal = hasRole('admin', 'channel_manager');
  const isAdmin = hasRole('admin');
  const isPartner = hasRole('partner_admin', 'partner_rep');

  // Modals
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [approveClaimModalOpen, setApproveClaimModalOpen] = useState(false);
  const [rejectClaimModalOpen, setRejectClaimModalOpen] = useState(false);

  // Form state for modals
  const [approvedAmount, setApprovedAmount] = useState('');
  const [approveComments, setApproveComments] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [claimAmount, setClaimAmount] = useState('');
  const [claimNotes, setClaimNotes] = useState('');
  const [claimFiles, setClaimFiles] = useState<File[]>([]);
  const [uploadedProofUrls, setUploadedProofUrls] = useState<string[]>([]);
  const [reimbursementAmount, setReimbursementAmount] = useState('');
  const [approveClaimComments, setApproveClaimComments] = useState('');
  const [rejectClaimReason, setRejectClaimReason] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Queries
  const {
    data: request,
    isLoading,
    isError,
  } = useMdfRequest(id);

  const { data: history } = useMdfRequestHistory(id);

  // Mutations
  const submitMutation = useSubmitMdfRequest(id!);
  const approveMutation = useApproveMdfRequest(id!);
  const rejectMutation = useRejectMdfRequest(id!);
  const completeMutation = useCompleteMdfRequest(id!);
  const submitClaimMutation = useSubmitClaim(id!);
  const approveClaimMutation = useApproveClaim(id!);
  const rejectClaimMutation = useRejectClaim(id!);
  const reimburseMutation = useMarkReimbursed(id!);
  const uploadProofMutation = useUploadProof(id!);

  // Determine available actions based on status and role
  const canSubmit = isPartner && request?.status === 'draft';
  const canApproveReject =
    isInternal && request?.status === 'submitted';
  const canComplete = isPartner && request?.status === 'approved';
  const canSubmitClaim = isPartner && request?.status === 'completed';
  const canApproveRejectClaim =
    isInternal && request?.status === 'claim_submitted';
  const canReimburse = isAdmin && request?.status === 'claim_approved';

  // Handlers
  const handleSubmit = useCallback(() => {
    submitMutation.mutate();
  }, [submitMutation]);

  const handleApprove = useCallback(() => {
    approveMutation.mutate(
      {
        approved_amount: approvedAmount
          ? Number(approvedAmount)
          : undefined,
        comments: approveComments || undefined,
      },
      {
        onSuccess: () => {
          setApproveModalOpen(false);
          setApprovedAmount('');
          setApproveComments('');
        },
      }
    );
  }, [approveMutation, approvedAmount, approveComments]);

  const handleReject = useCallback(() => {
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
  }, [rejectMutation, rejectReason]);

  const handleComplete = useCallback(() => {
    completeMutation.mutate();
  }, [completeMutation]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      setClaimFiles((prev) => [...prev, ...files]);
    },
    []
  );

  const handleSubmitClaim = useCallback(async () => {
    if (!claimAmount || Number(claimAmount) <= 0) {
      toast.error('Claim amount is required');
      return;
    }

    let proofUrls = [...uploadedProofUrls];

    // Upload files if any
    if (claimFiles.length > 0) {
      try {
        const res = await uploadProofMutation.mutateAsync(claimFiles);
        proofUrls = [...proofUrls, ...(res.data.data ?? [])];
      } catch {
        return; // Error toast already shown by hook
      }
    }

    submitClaimMutation.mutate(
      {
        claim_amount: Number(claimAmount),
        claim_notes: claimNotes || undefined,
        proof_of_execution: proofUrls,
      },
      {
        onSuccess: () => {
          setClaimModalOpen(false);
          setClaimAmount('');
          setClaimNotes('');
          setClaimFiles([]);
          setUploadedProofUrls([]);
        },
      }
    );
  }, [
    claimAmount,
    claimNotes,
    claimFiles,
    uploadedProofUrls,
    uploadProofMutation,
    submitClaimMutation,
  ]);

  const handleApproveClaim = useCallback(() => {
    approveClaimMutation.mutate(
      {
        reimbursement_amount: reimbursementAmount
          ? Number(reimbursementAmount)
          : undefined,
        comments: approveClaimComments || undefined,
      },
      {
        onSuccess: () => {
          setApproveClaimModalOpen(false);
          setReimbursementAmount('');
          setApproveClaimComments('');
        },
      }
    );
  }, [approveClaimMutation, reimbursementAmount, approveClaimComments]);

  const handleRejectClaim = useCallback(() => {
    if (!rejectClaimReason.trim()) {
      toast.error('Rejection reason is required');
      return;
    }
    rejectClaimMutation.mutate(
      { rejection_reason: rejectClaimReason },
      {
        onSuccess: () => {
          setRejectClaimModalOpen(false);
          setRejectClaimReason('');
        },
      }
    );
  }, [rejectClaimMutation, rejectClaimReason]);

  const handleReimburse = useCallback(() => {
    reimburseMutation.mutate();
  }, [reimburseMutation]);

  // Loading state
  if (isLoading) {
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

  if (isError || !request) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Request not found
        </h2>
        <p className="text-gray-500 mb-4">
          This MDF request does not exist or you do not have access to it.
        </p>
        <button
          onClick={() => navigate('/mdf/requests')}
          className="text-sm font-medium text-panw-navy hover:text-panw-blue"
        >
          Back to Requests
        </button>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={request.activity_name}
        subtitle={request.request_number}
        breadcrumbs={[
          { label: 'MDF', to: '/mdf' },
          { label: 'Requests', to: '/mdf/requests' },
          { label: request.request_number },
        ]}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {/* Partner actions */}
            {canSubmit && (
              <button
                onClick={handleSubmit}
                disabled={submitMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-md bg-panw-blue px-3 py-2 text-sm font-semibold text-white hover:bg-panw-navy shadow-sm disabled:opacity-50"
              >
                <PaperAirplaneIcon className="h-4 w-4" />
                {submitMutation.isPending ? 'Submitting...' : 'Submit'}
              </button>
            )}
            {canComplete && (
              <button
                onClick={handleComplete}
                disabled={completeMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-md bg-green-700 px-3 py-2 text-sm font-semibold text-white hover:bg-green-600 shadow-sm disabled:opacity-50"
              >
                <CheckCircleIcon className="h-4 w-4" />
                {completeMutation.isPending ? 'Completing...' : 'Complete Activity'}
              </button>
            )}
            {canSubmitClaim && (
              <button
                onClick={() => {
                  setClaimAmount(
                    String(request.approved_amount ?? request.requested_amount)
                  );
                  setClaimModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-md bg-panw-blue px-3 py-2 text-sm font-semibold text-white hover:bg-panw-navy shadow-sm"
              >
                <DocumentArrowUpIcon className="h-4 w-4" />
                Submit Claim
              </button>
            )}

            {/* CM/Admin actions */}
            {canApproveReject && (
              <>
                <button
                  onClick={() => {
                    setApprovedAmount(String(request.requested_amount));
                    setApproveModalOpen(true);
                  }}
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
            {canApproveRejectClaim && (
              <>
                <button
                  onClick={() => {
                    setReimbursementAmount(
                      String(request.claim_amount ?? request.approved_amount ?? request.requested_amount)
                    );
                    setApproveClaimModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md bg-green-700 px-3 py-2 text-sm font-semibold text-white hover:bg-green-600 shadow-sm"
                >
                  <CheckIcon className="h-4 w-4" />
                  Approve Claim
                </button>
                <button
                  onClick={() => setRejectClaimModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-inset ring-red-300 hover:bg-red-50"
                >
                  <XMarkIcon className="h-4 w-4" />
                  Reject Claim
                </button>
              </>
            )}
            {canReimburse && (
              <button
                onClick={handleReimburse}
                disabled={reimburseMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-md bg-green-700 px-3 py-2 text-sm font-semibold text-white hover:bg-green-600 shadow-sm disabled:opacity-50"
              >
                <BanknotesIcon className="h-4 w-4" />
                {reimburseMutation.isPending ? 'Processing...' : 'Mark Reimbursed'}
              </button>
            )}
          </div>
        }
      />

      {/* Status badge */}
      <div className="flex items-center gap-3 mb-4 -mt-4">
        <StatusBadge status={request.status} size="md" />
      </div>

      {/* Rejection reason */}
      {(request.status === 'rejected' || request.status === 'claim_rejected') &&
        request.rejection_reason && (
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3">
            <XMarkIcon className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">
                Rejection Reason
              </p>
              <p className="text-sm text-red-700 mt-0.5">
                {request.rejection_reason}
              </p>
            </div>
          </div>
        )}

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Request details */}
          <InfoCard title="Request Details">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoField label="Activity Type" value={humanize(request.activity_type)} />
              <InfoField label="Activity Title" value={request.activity_name} />
              <InfoField label="Start Date" value={formatDate(request.start_date)} />
              <InfoField label="End Date" value={formatDate(request.end_date)} />
              <InfoField
                label="Requested Amount"
                value={formatCurrency(request.requested_amount)}
                highlight
              />
              {request.approved_amount !== null && (
                <InfoField
                  label="Approved Amount"
                  value={formatCurrency(request.approved_amount)}
                  highlight
                />
              )}
            </div>
            {request.description && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-500 mb-1">
                  Description
                </p>
                <p className="text-sm text-gray-700">{request.description}</p>
              </div>
            )}
          </InfoCard>

          {/* Approval section */}
          {(request.reviewed_by || request.reviewed_at) && (
            <InfoCard title="Approval Details">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoField
                  label="Reviewed By"
                  value={request.reviewed_by_name ?? request.reviewed_by}
                />
                <InfoField
                  label="Reviewed At"
                  value={formatDateTime(request.reviewed_at)}
                />
                {request.approved_amount !== null && (
                  <InfoField
                    label="Approved Amount"
                    value={formatCurrency(request.approved_amount)}
                    highlight
                  />
                )}
              </div>
            </InfoCard>
          )}

          {/* Claim section */}
          {(request.claim_amount !== null ||
            request.claim_submitted_at ||
            request.proof_of_execution) && (
            <InfoCard title="Claim Details">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoField
                  label="Claim Amount"
                  value={
                    request.claim_amount !== null
                      ? formatCurrency(request.claim_amount)
                      : null
                  }
                  highlight
                />
                <InfoField
                  label="Claim Submitted"
                  value={formatDateTime(request.claim_submitted_at)}
                />
                {request.actual_spend !== null && (
                  <InfoField
                    label="Actual Spend"
                    value={formatCurrency(request.actual_spend)}
                  />
                )}
                {request.reimbursement_amount !== null && (
                  <InfoField
                    label="Reimbursement Amount"
                    value={formatCurrency(request.reimbursement_amount)}
                    highlight
                  />
                )}
                {request.reimbursed_at && (
                  <InfoField
                    label="Reimbursed At"
                    value={formatDateTime(request.reimbursed_at)}
                  />
                )}
              </div>
              {request.claim_notes && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-500 mb-1">
                    Claim Notes
                  </p>
                  <p className="text-sm text-gray-700">{request.claim_notes}</p>
                </div>
              )}
              {request.proof_of_execution &&
                request.proof_of_execution.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs font-medium text-gray-500 mb-2">
                      Proof of Execution
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {request.proof_of_execution.map((url, idx) => (
                        <a
                          key={idx}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-panw-navy hover:text-panw-blue bg-gray-50 border border-gray-200 rounded px-2 py-1"
                        >
                          <DocumentArrowUpIcon className="h-4 w-4" />
                          File {idx + 1}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
            </InfoCard>
          )}

          {/* Partner/internal info */}
          {isInternal && (
            <InfoCard title="Partner Information">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoField
                  label="Partner Organization"
                  value={request.organization_name}
                />
                <InfoField
                  label="Submitted By"
                  value={request.submitted_by_name}
                />
              </div>
            </InfoCard>
          )}
        </div>

        {/* Right column - Timeline + Quick Info */}
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

          <InfoCard title="Quick Info">
            <div className="space-y-3">
              <InfoField
                label="Created"
                value={formatDateTime(request.created_at)}
              />
              <InfoField
                label="Last Updated"
                value={formatDateTime(request.updated_at)}
              />
              <InfoField label="Request ID" value={request.id} />
              {request.allocation_id && (
                <InfoField
                  label="Allocation ID"
                  value={request.allocation_id}
                />
              )}
            </div>
          </InfoCard>
        </div>
      </div>

      {/* ---- Modals ---- */}

      {/* Approve Request Modal */}
      <Modal
        open={approveModalOpen}
        onClose={() => setApproveModalOpen(false)}
        title="Approve MDF Request"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Review and approve this MDF request. You may adjust the approved
            amount if needed.
          </p>
          <FormField
            label="Approved Amount (USD)"
            htmlFor="approved-amount"
          >
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                $
              </span>
              <Input
                id="approved-amount"
                type="number"
                min="0"
                value={approvedAmount}
                onChange={(e) => setApprovedAmount(e.target.value)}
                className="pl-7"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Requested: {formatCurrency(request.requested_amount)}
            </p>
          </FormField>
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
              onClick={handleApprove}
              disabled={approveMutation.isPending}
              className="rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600 disabled:opacity-50"
            >
              {approveMutation.isPending ? 'Approving...' : 'Approve Request'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Reject Request Modal */}
      <Modal
        open={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Reject MDF Request"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Please provide a reason for rejecting this MDF request. The partner
            will be notified.
          </p>
          <FormField
            label="Rejection Reason"
            htmlFor="reject-reason"
            required
          >
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Explain why this request is being rejected..."
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
              onClick={handleReject}
              disabled={rejectMutation.isPending}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
            >
              {rejectMutation.isPending ? 'Rejecting...' : 'Reject Request'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Submit Claim Modal */}
      <Modal
        open={claimModalOpen}
        onClose={() => setClaimModalOpen(false)}
        title="Submit Claim"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Submit your claim for reimbursement. Include proof of execution
            (receipts, photos, event reports).
          </p>
          <FormField
            label="Claim Amount (USD)"
            htmlFor="claim-amount"
            required
          >
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                $
              </span>
              <Input
                id="claim-amount"
                type="number"
                min="0"
                value={claimAmount}
                onChange={(e) => setClaimAmount(e.target.value)}
                className="pl-7"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Approved: {formatCurrency(request.approved_amount ?? request.requested_amount)}
            </p>
          </FormField>
          <FormField label="Claim Notes" htmlFor="claim-notes">
            <Textarea
              id="claim-notes"
              value={claimNotes}
              onChange={(e) => setClaimNotes(e.target.value)}
              rows={3}
              placeholder="Describe outcomes, attendance, results..."
            />
          </FormField>
          <FormField label="Proof of Execution" htmlFor="proof-files">
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                id="proof-files"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-navy-50 file:text-panw-blue hover:file:bg-navy-100"
              />
              {claimFiles.length > 0 && (
                <div className="space-y-1">
                  {claimFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-gray-50 rounded px-3 py-1.5"
                    >
                      <span className="text-sm text-gray-700 truncate">
                        {file.name}
                      </span>
                      <button
                        onClick={() =>
                          setClaimFiles((prev) =>
                            prev.filter((_, i) => i !== idx)
                          )
                        }
                        className="text-red-400 hover:text-red-600 ml-2"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setClaimModalOpen(false)}
              className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitClaim}
              disabled={
                submitClaimMutation.isPending || uploadProofMutation.isPending
              }
              className="rounded-md bg-panw-blue px-4 py-2 text-sm font-semibold text-white hover:bg-panw-navy disabled:opacity-50"
            >
              {submitClaimMutation.isPending || uploadProofMutation.isPending
                ? 'Submitting...'
                : 'Submit Claim'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Approve Claim Modal */}
      <Modal
        open={approveClaimModalOpen}
        onClose={() => setApproveClaimModalOpen(false)}
        title="Approve Claim"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Approve this claim for reimbursement. You may adjust the
            reimbursement amount.
          </p>
          <FormField
            label="Reimbursement Amount (USD)"
            htmlFor="reimbursement-amount"
          >
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                $
              </span>
              <Input
                id="reimbursement-amount"
                type="number"
                min="0"
                value={reimbursementAmount}
                onChange={(e) => setReimbursementAmount(e.target.value)}
                className="pl-7"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Claimed: {formatCurrency(request.claim_amount)}
            </p>
          </FormField>
          <FormField
            label="Comments (optional)"
            htmlFor="approve-claim-comments"
          >
            <Textarea
              id="approve-claim-comments"
              value={approveClaimComments}
              onChange={(e) => setApproveClaimComments(e.target.value)}
              rows={3}
              placeholder="Add any notes..."
            />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setApproveClaimModalOpen(false)}
              className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleApproveClaim}
              disabled={approveClaimMutation.isPending}
              className="rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600 disabled:opacity-50"
            >
              {approveClaimMutation.isPending
                ? 'Approving...'
                : 'Approve Claim'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Reject Claim Modal */}
      <Modal
        open={rejectClaimModalOpen}
        onClose={() => setRejectClaimModalOpen(false)}
        title="Reject Claim"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Please provide a reason for rejecting this claim.
          </p>
          <FormField
            label="Rejection Reason"
            htmlFor="reject-claim-reason"
            required
          >
            <Textarea
              id="reject-claim-reason"
              value={rejectClaimReason}
              onChange={(e) => setRejectClaimReason(e.target.value)}
              rows={3}
              placeholder="Explain why this claim is being rejected..."
            />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setRejectClaimModalOpen(false)}
              className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleRejectClaim}
              disabled={rejectClaimMutation.isPending}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
            >
              {rejectClaimMutation.isPending
                ? 'Rejecting...'
                : 'Reject Claim'}
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

function StatusTimeline({
  history,
}: {
  history: Array<{
    id: string;
    action: string;
    actor_name?: string;
    changes?: Record<string, unknown>;
    created_at: string;
  }>;
}) {
  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {history.map((entry, idx) => {
          const isLast = idx === history.length - 1;
          const color = getTimelineColor(entry.action);

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
                        color
                      )}
                    >
                      <span className="h-2 w-2 rounded-full bg-white" />
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm">
                      <span className="font-medium text-gray-900">
                        {humanize(entry.action)}
                      </span>
                    </div>
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

function getTimelineColor(action: string): string {
  if (action.includes('approve') || action.includes('reimburse')) return 'bg-green-500';
  if (action.includes('reject')) return 'bg-red-500';
  if (action.includes('submit') || action.includes('claim')) return 'bg-yellow-500';
  if (action.includes('complete')) return 'bg-blue-500';
  if (action.includes('create')) return 'bg-gray-400';
  return 'bg-gray-400';
}
