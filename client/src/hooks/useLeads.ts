import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { leadsApi } from '../api/leads';
import { getApiErrorMessage } from '../api/client';
import type {
  CreateLeadRequest,
  UpdateLeadRequest,
  AssignLeadRequest,
  BulkAssignRequest,
  ReturnLeadRequest,
  DisqualifyLeadRequest,
  ConvertLeadRequest,
  LeadQueryParams,
} from '../types';

// ---- Query Keys ----
const leadKeys = {
  all: ['leads'] as const,
  lists: () => [...leadKeys.all, 'list'] as const,
  list: (params: LeadQueryParams) => [...leadKeys.lists(), params] as const,
  unassigned: (params?: LeadQueryParams) =>
    [...leadKeys.all, 'unassigned', params] as const,
  details: () => [...leadKeys.all, 'detail'] as const,
  detail: (id: string) => [...leadKeys.details(), id] as const,
  history: (id: string) => [...leadKeys.all, 'history', id] as const,
};

// ---- Queries ----

export function useLeads(params: LeadQueryParams) {
  return useQuery({
    queryKey: leadKeys.list(params),
    queryFn: async () => {
      const { data } = await leadsApi.list(params);
      return data;
    },
  });
}

export function useLead(id: string | undefined) {
  return useQuery({
    queryKey: leadKeys.detail(id!),
    queryFn: async () => {
      const { data } = await leadsApi.getById(id!);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useUnassignedLeads(params?: LeadQueryParams) {
  return useQuery({
    queryKey: leadKeys.unassigned(params),
    queryFn: async () => {
      const { data } = await leadsApi.getUnassigned(params);
      return data;
    },
  });
}

export function useLeadHistory(id: string | undefined) {
  return useQuery({
    queryKey: leadKeys.history(id!),
    queryFn: async () => {
      const { data } = await leadsApi.getHistory(id!);
      return data.data;
    },
    enabled: !!id,
  });
}

// ---- Mutations ----

function useInvalidateLead(id?: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: leadKeys.lists() });
    queryClient.invalidateQueries({ queryKey: leadKeys.unassigned() });
    if (id) {
      queryClient.invalidateQueries({ queryKey: leadKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: leadKeys.history(id) });
    }
  };
}

export function useCreateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateLeadRequest) => leadsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadKeys.lists() });
      queryClient.invalidateQueries({ queryKey: leadKeys.unassigned() });
      toast.success('Lead created');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useUpdateLead(id: string) {
  const invalidate = useInvalidateLead(id);
  return useMutation({
    mutationFn: (data: UpdateLeadRequest) => leadsApi.update(id, data),
    onSuccess: () => {
      invalidate();
      toast.success('Lead updated');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useAssignLead(id: string) {
  const invalidate = useInvalidateLead(id);
  return useMutation({
    mutationFn: (data: AssignLeadRequest) => leadsApi.assign(id, data),
    onSuccess: () => {
      invalidate();
      toast.success('Lead assigned');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useBulkAssign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BulkAssignRequest) => leadsApi.bulkAssign(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: leadKeys.lists() });
      queryClient.invalidateQueries({ queryKey: leadKeys.unassigned() });
      const result = res.data.data;
      if (result.failed > 0) {
        toast.success(
          `${result.succeeded} of ${result.total} leads assigned. ${result.failed} failed.`
        );
      } else {
        toast.success(`${result.succeeded} leads assigned successfully`);
      }
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useAcceptLead(id: string) {
  const invalidate = useInvalidateLead(id);
  return useMutation({
    mutationFn: () => leadsApi.accept(id),
    onSuccess: () => {
      invalidate();
      toast.success('Lead accepted');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useReturnLead(id: string) {
  const invalidate = useInvalidateLead(id);
  return useMutation({
    mutationFn: (data: ReturnLeadRequest) => leadsApi.return(id, data),
    onSuccess: () => {
      invalidate();
      toast.success('Lead returned');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useConvertToDeal(id: string) {
  const invalidate = useInvalidateLead(id);
  return useMutation({
    mutationFn: (data?: ConvertLeadRequest) => leadsApi.convert(id, data),
    onSuccess: () => {
      invalidate();
      toast.success('Lead converted to deal');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useDisqualifyLead(id: string) {
  const invalidate = useInvalidateLead(id);
  return useMutation({
    mutationFn: (data: DisqualifyLeadRequest) => leadsApi.disqualify(id, data),
    onSuccess: () => {
      invalidate();
      toast.success('Lead disqualified');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}
