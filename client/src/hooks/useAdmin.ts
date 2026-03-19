import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../api/admin';
import type {
  OrgQueryParams,
  DealQueryParams,
  QuoteQueryParams,
  LeadQueryParams,
  MdfRequestQueryParams,
  MdfAllocationQueryParams,
} from '../types';
import type { CertificationQueryParams } from '../types/course';

// ---- Query Keys ----
const adminKeys = {
  all: ['admin'] as const,
  partners: (params?: OrgQueryParams) => [...adminKeys.all, 'partners', params] as const,
  partnerDetail: (id: string) => [...adminKeys.all, 'partner', id] as const,
  partnerUsers: (id: string) => [...adminKeys.all, 'partner', id, 'users'] as const,
  partnerDeals: (id: string, params?: DealQueryParams) =>
    [...adminKeys.all, 'partner', id, 'deals', params] as const,
  partnerQuotes: (id: string, params?: QuoteQueryParams) =>
    [...adminKeys.all, 'partner', id, 'quotes', params] as const,
  partnerLeads: (id: string, params?: LeadQueryParams) =>
    [...adminKeys.all, 'partner', id, 'leads', params] as const,
  partnerMdfRequests: (id: string, params?: MdfRequestQueryParams) =>
    [...adminKeys.all, 'partner', id, 'mdf-requests', params] as const,
  partnerMdfAllocations: (id: string, params?: MdfAllocationQueryParams) =>
    [...adminKeys.all, 'partner', id, 'mdf-allocations', params] as const,
  partnerCerts: (id: string, params?: CertificationQueryParams) =>
    [...adminKeys.all, 'partner', id, 'certs', params] as const,
  pendingDeals: (params?: DealQueryParams) =>
    [...adminKeys.all, 'pending-deals', params] as const,
  pendingQuotes: (params?: QuoteQueryParams) =>
    [...adminKeys.all, 'pending-quotes', params] as const,
  pendingMdf: (params?: MdfRequestQueryParams) =>
    [...adminKeys.all, 'pending-mdf', params] as const,
};

// ---- Partner List ----
export function usePartnerList(params?: OrgQueryParams) {
  return useQuery({
    queryKey: adminKeys.partners(params),
    queryFn: async () => {
      const { data } = await adminApi.listPartners(params);
      return data;
    },
  });
}

// ---- Partner Detail ----
export function usePartnerDetail(id: string) {
  return useQuery({
    queryKey: adminKeys.partnerDetail(id),
    queryFn: async () => {
      const { data } = await adminApi.getPartnerDetail(id);
      return data.data;
    },
    enabled: !!id,
  });
}

// ---- Partner Users ----
export function usePartnerUsers(id: string) {
  return useQuery({
    queryKey: adminKeys.partnerUsers(id),
    queryFn: async () => {
      const { data } = await adminApi.getPartnerUsers(id);
      return data.data;
    },
    enabled: !!id,
  });
}

// ---- Partner Deals ----
export function usePartnerDeals(id: string, params?: DealQueryParams) {
  return useQuery({
    queryKey: adminKeys.partnerDeals(id, params),
    queryFn: async () => {
      const { data } = await adminApi.getPartnerDeals(id, params);
      return data;
    },
    enabled: !!id,
  });
}

// ---- Partner Quotes ----
export function usePartnerQuotes(id: string, params?: QuoteQueryParams) {
  return useQuery({
    queryKey: adminKeys.partnerQuotes(id, params),
    queryFn: async () => {
      const { data } = await adminApi.getPartnerQuotes(id, params);
      return data;
    },
    enabled: !!id,
  });
}

// ---- Partner Leads ----
export function usePartnerLeads(id: string, params?: LeadQueryParams) {
  return useQuery({
    queryKey: adminKeys.partnerLeads(id, params),
    queryFn: async () => {
      const { data } = await adminApi.getPartnerLeads(id, params);
      return data;
    },
    enabled: !!id,
  });
}

// ---- Partner MDF Requests ----
export function usePartnerMdfRequests(id: string, params?: MdfRequestQueryParams) {
  return useQuery({
    queryKey: adminKeys.partnerMdfRequests(id, params),
    queryFn: async () => {
      const { data } = await adminApi.getPartnerMdfRequests(id, params);
      return data;
    },
    enabled: !!id,
  });
}

// ---- Partner MDF Allocations ----
export function usePartnerMdfAllocations(id: string, params?: MdfAllocationQueryParams) {
  return useQuery({
    queryKey: adminKeys.partnerMdfAllocations(id, params),
    queryFn: async () => {
      const { data } = await adminApi.getPartnerMdfAllocations(id, params);
      return data;
    },
    enabled: !!id,
  });
}

// ---- Partner Certifications ----
export function usePartnerCertifications(orgId: string, params?: CertificationQueryParams) {
  return useQuery({
    queryKey: adminKeys.partnerCerts(orgId, params),
    queryFn: async () => {
      const { data } = await adminApi.getPartnerCertifications(orgId, params);
      return data;
    },
    enabled: !!orgId,
  });
}

// ---- Pending Approvals ----
export function usePendingDeals(params?: DealQueryParams) {
  return useQuery({
    queryKey: adminKeys.pendingDeals(params),
    queryFn: async () => {
      const { data } = await adminApi.getPendingDeals(params);
      return data;
    },
  });
}

export function usePendingQuotes(params?: QuoteQueryParams) {
  return useQuery({
    queryKey: adminKeys.pendingQuotes(params),
    queryFn: async () => {
      const { data } = await adminApi.getPendingQuotes(params);
      return data;
    },
  });
}

export function usePendingMdfRequests(params?: MdfRequestQueryParams) {
  return useQuery({
    queryKey: adminKeys.pendingMdf(params),
    queryFn: async () => {
      const { data } = await adminApi.getPendingMdfRequests(params);
      return data;
    },
  });
}
