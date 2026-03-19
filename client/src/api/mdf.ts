import apiClient from './client';
import type {
  ApiResponse,
  MdfAllocation,
  MdfRequest,
  MdfAllocationQueryParams,
  MdfRequestQueryParams,
  CreateAllocationRequest,
  UpdateAllocationRequest,
  AutoAllocateRequest,
  AutoAllocateResponse,
  CreateMdfRequestPayload,
  UpdateMdfRequestPayload,
  ApproveMdfRequest,
  RejectMdfRequest,
  SubmitClaimRequest,
  ApproveClaimRequest,
  RejectClaimRequest,
} from '../types';

export const mdfApi = {
  // ---- Allocations ----
  listAllocations(params?: MdfAllocationQueryParams) {
    return apiClient.get<ApiResponse<MdfAllocation[]>>('/mdf/allocations', { params });
  },

  getAllocation(id: string) {
    return apiClient.get<ApiResponse<MdfAllocation>>(`/mdf/allocations/${id}`);
  },

  createAllocation(data: CreateAllocationRequest) {
    return apiClient.post<ApiResponse<MdfAllocation>>('/mdf/allocations', data);
  },

  updateAllocation(id: string, data: UpdateAllocationRequest) {
    return apiClient.patch<ApiResponse<MdfAllocation>>(`/mdf/allocations/${id}`, data);
  },

  autoAllocate(data: AutoAllocateRequest) {
    return apiClient.post<ApiResponse<AutoAllocateResponse>>(
      '/mdf/allocations/auto-allocate',
      data
    );
  },

  // ---- Requests ----
  listRequests(params?: MdfRequestQueryParams) {
    return apiClient.get<ApiResponse<MdfRequest[]>>('/mdf/requests', { params });
  },

  getRequest(id: string) {
    return apiClient.get<ApiResponse<MdfRequest>>(`/mdf/requests/${id}`);
  },

  createRequest(data: CreateMdfRequestPayload) {
    return apiClient.post<ApiResponse<MdfRequest>>('/mdf/requests', data);
  },

  updateRequest(id: string, data: UpdateMdfRequestPayload) {
    return apiClient.patch<ApiResponse<MdfRequest>>(`/mdf/requests/${id}`, data);
  },

  submitRequest(id: string) {
    return apiClient.post<ApiResponse<MdfRequest>>(`/mdf/requests/${id}/submit`);
  },

  approveRequest(id: string, data?: ApproveMdfRequest) {
    return apiClient.post<ApiResponse<MdfRequest>>(
      `/mdf/requests/${id}/approve`,
      data ?? {}
    );
  },

  rejectRequest(id: string, data: RejectMdfRequest) {
    return apiClient.post<ApiResponse<MdfRequest>>(
      `/mdf/requests/${id}/reject`,
      data
    );
  },

  completeRequest(id: string) {
    return apiClient.post<ApiResponse<MdfRequest>>(`/mdf/requests/${id}/complete`);
  },

  // ---- Claims ----
  submitClaim(id: string, data: SubmitClaimRequest) {
    return apiClient.post<ApiResponse<MdfRequest>>(
      `/mdf/requests/${id}/claim`,
      data
    );
  },

  approveClaim(id: string, data?: ApproveClaimRequest) {
    return apiClient.post<ApiResponse<MdfRequest>>(
      `/mdf/requests/${id}/approve-claim`,
      data ?? {}
    );
  },

  rejectClaim(id: string, data: RejectClaimRequest) {
    return apiClient.post<ApiResponse<MdfRequest>>(
      `/mdf/requests/${id}/reject-claim`,
      data
    );
  },

  markReimbursed(id: string) {
    return apiClient.post<ApiResponse<MdfRequest>>(
      `/mdf/requests/${id}/reimburse`
    );
  },

  // ---- File Upload ----
  uploadProof(id: string, files: File[]) {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    return apiClient.post<ApiResponse<string[]>>(
      `/mdf/requests/${id}/upload-proof`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      }
    );
  },

  // ---- History ----
  getHistory(id: string) {
    return apiClient.get<ApiResponse<Array<{
      id: string;
      action: string;
      actor_name?: string;
      changes?: Record<string, unknown>;
      created_at: string;
    }>>>(
      `/activity?entity_type=mdf_request&entity_id=${id}&sort=created_at:desc`
    );
  },
};
