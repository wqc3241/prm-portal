import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { mdfApi } from '../api/mdf';
import { getApiErrorMessage } from '../api/client';
import type {
  MdfAllocationQueryParams,
  MdfRequestQueryParams,
  CreateAllocationRequest,
  UpdateAllocationRequest,
  AutoAllocateRequest,
  CreateMdfRequestPayload,
  UpdateMdfRequestPayload,
  ApproveMdfRequest,
  RejectMdfRequest,
  SubmitClaimRequest,
  ApproveClaimRequest,
  RejectClaimRequest,
} from '../types';

// ---- Query Keys ----
const mdfKeys = {
  all: ['mdf'] as const,
  allocations: () => [...mdfKeys.all, 'allocations'] as const,
  allocationList: (params?: MdfAllocationQueryParams) =>
    [...mdfKeys.allocations(), 'list', params] as const,
  allocationDetail: (id: string) =>
    [...mdfKeys.allocations(), 'detail', id] as const,
  requests: () => [...mdfKeys.all, 'requests'] as const,
  requestList: (params?: MdfRequestQueryParams) =>
    [...mdfKeys.requests(), 'list', params] as const,
  requestDetail: (id: string) =>
    [...mdfKeys.requests(), 'detail', id] as const,
  requestHistory: (id: string) =>
    [...mdfKeys.requests(), 'history', id] as const,
};

// ---- Allocation Queries ----

export function useMdfAllocations(params?: MdfAllocationQueryParams) {
  return useQuery({
    queryKey: mdfKeys.allocationList(params),
    queryFn: async () => {
      const { data } = await mdfApi.listAllocations(params);
      return data;
    },
  });
}

export function useMdfAllocation(id: string | undefined) {
  return useQuery({
    queryKey: mdfKeys.allocationDetail(id!),
    queryFn: async () => {
      const { data } = await mdfApi.getAllocation(id!);
      return data.data;
    },
    enabled: !!id,
  });
}

// ---- Request Queries ----

export function useMdfRequests(params?: MdfRequestQueryParams) {
  return useQuery({
    queryKey: mdfKeys.requestList(params),
    queryFn: async () => {
      const { data } = await mdfApi.listRequests(params);
      return data;
    },
  });
}

export function useMdfRequest(id: string | undefined) {
  return useQuery({
    queryKey: mdfKeys.requestDetail(id!),
    queryFn: async () => {
      const { data } = await mdfApi.getRequest(id!);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useMdfRequestHistory(id: string | undefined) {
  return useQuery({
    queryKey: mdfKeys.requestHistory(id!),
    queryFn: async () => {
      const { data } = await mdfApi.getHistory(id!);
      return data.data;
    },
    enabled: !!id,
  });
}

// ---- Invalidation helper ----
function useInvalidateMdf(requestId?: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: mdfKeys.allocations() });
    queryClient.invalidateQueries({ queryKey: mdfKeys.requests() });
    if (requestId) {
      queryClient.invalidateQueries({
        queryKey: mdfKeys.requestDetail(requestId),
      });
      queryClient.invalidateQueries({
        queryKey: mdfKeys.requestHistory(requestId),
      });
    }
  };
}

// ---- Allocation Mutations ----

export function useCreateAllocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAllocationRequest) =>
      mdfApi.createAllocation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mdfKeys.allocations() });
      toast.success('Allocation created');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useUpdateAllocation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateAllocationRequest) =>
      mdfApi.updateAllocation(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mdfKeys.allocations() });
      toast.success('Allocation updated');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useAutoAllocate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AutoAllocateRequest) => mdfApi.autoAllocate(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: mdfKeys.allocations() });
      const result = res.data.data;
      toast.success(
        `Auto-allocation complete: ${result.created} created, ${result.skipped_existing} skipped`
      );
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

// ---- Request Mutations ----

export function useCreateMdfRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateMdfRequestPayload) => mdfApi.createRequest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mdfKeys.requests() });
      toast.success('MDF request created');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useUpdateMdfRequest(id: string) {
  const invalidate = useInvalidateMdf(id);
  return useMutation({
    mutationFn: (data: UpdateMdfRequestPayload) =>
      mdfApi.updateRequest(id, data),
    onSuccess: () => {
      invalidate();
      toast.success('MDF request updated');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useSubmitMdfRequest(id: string) {
  const invalidate = useInvalidateMdf(id);
  return useMutation({
    mutationFn: () => mdfApi.submitRequest(id),
    onSuccess: () => {
      invalidate();
      toast.success('MDF request submitted for approval');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useApproveMdfRequest(id: string) {
  const invalidate = useInvalidateMdf(id);
  return useMutation({
    mutationFn: (data?: ApproveMdfRequest) => mdfApi.approveRequest(id, data),
    onSuccess: () => {
      invalidate();
      toast.success('MDF request approved');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useRejectMdfRequest(id: string) {
  const invalidate = useInvalidateMdf(id);
  return useMutation({
    mutationFn: (data: RejectMdfRequest) => mdfApi.rejectRequest(id, data),
    onSuccess: () => {
      invalidate();
      toast.success('MDF request rejected');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useCompleteMdfRequest(id: string) {
  const invalidate = useInvalidateMdf(id);
  return useMutation({
    mutationFn: () => mdfApi.completeRequest(id),
    onSuccess: () => {
      invalidate();
      toast.success('Activity marked as completed');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

// ---- Claim Mutations ----

export function useSubmitClaim(id: string) {
  const invalidate = useInvalidateMdf(id);
  return useMutation({
    mutationFn: (data: SubmitClaimRequest) => mdfApi.submitClaim(id, data),
    onSuccess: () => {
      invalidate();
      toast.success('Claim submitted');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useApproveClaim(id: string) {
  const invalidate = useInvalidateMdf(id);
  return useMutation({
    mutationFn: (data?: ApproveClaimRequest) => mdfApi.approveClaim(id, data),
    onSuccess: () => {
      invalidate();
      toast.success('Claim approved');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useRejectClaim(id: string) {
  const invalidate = useInvalidateMdf(id);
  return useMutation({
    mutationFn: (data: RejectClaimRequest) => mdfApi.rejectClaim(id, data),
    onSuccess: () => {
      invalidate();
      toast.success('Claim rejected');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useMarkReimbursed(id: string) {
  const invalidate = useInvalidateMdf(id);
  return useMutation({
    mutationFn: () => mdfApi.markReimbursed(id),
    onSuccess: () => {
      invalidate();
      toast.success('Reimbursement confirmed');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useUploadProof(id: string) {
  return useMutation({
    mutationFn: (files: File[]) => mdfApi.uploadProof(id, files),
    onSuccess: () => {
      toast.success('Files uploaded');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}
