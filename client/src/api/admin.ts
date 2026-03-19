import apiClient from './client';
import type {
  ApiResponse,
  Organization,
  User,
  Deal,
  Quote,
  Lead,
  MdfRequest,
  MdfAllocation,
  OrgQueryParams,
  DealQueryParams,
  QuoteQueryParams,
  LeadQueryParams,
  MdfRequestQueryParams,
  MdfAllocationQueryParams,
} from '../types';
import type { Certification, CertificationQueryParams } from '../types/course';

export interface PartnerScorecard {
  pipeline_value: number;
  ytd_revenue: number;
  win_rate: number | null;
  lead_conversion_rate: number;
  sla_compliance_pct: number;
  certified_reps: number;
  total_reps: number;
  active_deals: number;
  total_deals: number;
  total_leads: number;
  mdf_allocated: number;
  mdf_spent: number;
}

export interface PendingApproval {
  type: 'deal' | 'quote' | 'mdf';
  id: string;
  number: string;
  partner_name: string;
  organization_id: string;
  title: string;
  value: number;
  submitted_at: string;
  extra?: Record<string, unknown>;
}

export const adminApi = {
  // ---- Partner Management ----
  listPartners(params?: OrgQueryParams) {
    return apiClient.get<ApiResponse<Organization[]>>('/organizations', { params });
  },

  getPartnerDetail(id: string) {
    return apiClient.get<ApiResponse<Organization>>(`/organizations/${id}`);
  },

  getPartnerUsers(id: string) {
    return apiClient.get<ApiResponse<User[]>>(`/organizations/${id}/users`);
  },

  getPartnerDeals(id: string, params?: DealQueryParams) {
    return apiClient.get<ApiResponse<Deal[]>>('/deals', {
      params: { ...params, org_id: id },
    });
  },

  getPartnerQuotes(id: string, params?: QuoteQueryParams) {
    return apiClient.get<ApiResponse<Quote[]>>('/quotes', {
      params: { ...params, organization_id: id },
    });
  },

  getPartnerLeads(id: string, params?: LeadQueryParams) {
    return apiClient.get<ApiResponse<Lead[]>>('/leads', {
      params: { ...params, assigned_org_id: id },
    });
  },

  getPartnerMdfRequests(id: string, params?: MdfRequestQueryParams) {
    return apiClient.get<ApiResponse<MdfRequest[]>>('/mdf/requests', {
      params: { ...params, organization_id: id },
    });
  },

  getPartnerMdfAllocations(id: string, params?: MdfAllocationQueryParams) {
    return apiClient.get<ApiResponse<MdfAllocation[]>>('/mdf/allocations', {
      params: { ...params, organization_id: id },
    });
  },

  getPartnerCertifications(orgId: string, params?: CertificationQueryParams) {
    return apiClient.get<ApiResponse<Certification[]>>('/certifications', {
      params: { ...params, organization_id: orgId },
    });
  },

  // ---- Pending Approvals (aggregated) ----
  getPendingDeals(params?: DealQueryParams) {
    return apiClient.get<ApiResponse<Deal[]>>('/deals', {
      params: { ...params, status: 'submitted' },
    });
  },

  getPendingQuotes(params?: QuoteQueryParams) {
    return apiClient.get<ApiResponse<Quote[]>>('/quotes', {
      params: { ...params, status: 'pending_approval' },
    });
  },

  getPendingMdfRequests(params?: MdfRequestQueryParams) {
    return apiClient.get<ApiResponse<MdfRequest[]>>('/mdf/requests', {
      params: { ...params, status: 'submitted' },
    });
  },
};
