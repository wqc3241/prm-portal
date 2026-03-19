import apiClient from './client';
import type {
  ApiResponse,
  Lead,
  LeadQueryParams,
  CreateLeadRequest,
  UpdateLeadRequest,
  AssignLeadRequest,
  BulkAssignRequest,
  BulkAssignResponse,
  ReturnLeadRequest,
  DisqualifyLeadRequest,
  ConvertLeadRequest,
  LeadHistoryEntry,
} from '../types';

export const leadsApi = {
  // ---- CRUD ----
  list(params?: LeadQueryParams) {
    return apiClient.get<ApiResponse<Lead[]>>('/leads', { params });
  },

  getById(id: string) {
    return apiClient.get<ApiResponse<Lead>>(`/leads/${id}`);
  },

  create(data: CreateLeadRequest) {
    return apiClient.post<ApiResponse<Lead>>('/leads', data);
  },

  update(id: string, data: UpdateLeadRequest) {
    return apiClient.patch<ApiResponse<Lead>>(`/leads/${id}`, data);
  },

  // ---- Assignment ----
  getUnassigned(params?: LeadQueryParams) {
    return apiClient.get<ApiResponse<Lead[]>>('/leads/unassigned', { params });
  },

  assign(id: string, data: AssignLeadRequest) {
    return apiClient.post<ApiResponse<Lead>>(`/leads/${id}/assign`, data);
  },

  bulkAssign(data: BulkAssignRequest) {
    return apiClient.post<ApiResponse<BulkAssignResponse>>(
      '/leads/bulk-assign',
      data
    );
  },

  // ---- Lifecycle transitions ----
  accept(id: string) {
    return apiClient.post<ApiResponse<Lead>>(`/leads/${id}/accept`);
  },

  return(id: string, data: ReturnLeadRequest) {
    return apiClient.post<ApiResponse<Lead>>(`/leads/${id}/return`, data);
  },

  convert(id: string, data?: ConvertLeadRequest) {
    return apiClient.post<ApiResponse<Lead & { converted_deal_id: string }>>(
      `/leads/${id}/convert`,
      data ?? {}
    );
  },

  disqualify(id: string, data: DisqualifyLeadRequest) {
    return apiClient.post<ApiResponse<Lead>>(`/leads/${id}/disqualify`, data);
  },

  // ---- History ----
  getHistory(id: string) {
    return apiClient.get<ApiResponse<LeadHistoryEntry[]>>(
      `/activity?entity_type=lead&entity_id=${id}&sort=created_at:desc`
    );
  },
};
