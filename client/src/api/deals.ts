import apiClient from './client';
import type {
  ApiResponse,
  Deal,
  DealProduct,
  DealStatusHistory,
  DealConflict,
  CreateDealRequest,
  UpdateDealRequest,
  ApproveDealRequest,
  RejectDealRequest,
  MarkWonRequest,
  MarkLostRequest,
  AddDealProductRequest,
  ConflictCheckParams,
  DealQueryParams,
  TierRecalculation,
} from '../types';

export const dealsApi = {
  // ---- CRUD ----
  list(params?: DealQueryParams) {
    return apiClient.get<ApiResponse<Deal[]>>('/deals', { params });
  },

  getById(id: string) {
    return apiClient.get<ApiResponse<Deal>>(`/deals/${id}`);
  },

  create(data: CreateDealRequest) {
    return apiClient.post<ApiResponse<Deal>>('/deals', data);
  },

  update(id: string, data: UpdateDealRequest) {
    return apiClient.patch<ApiResponse<Deal>>(`/deals/${id}`, data);
  },

  // ---- Status transitions ----
  submit(id: string) {
    return apiClient.post<ApiResponse<Deal>>(`/deals/${id}/submit`);
  },

  approve(id: string, data?: ApproveDealRequest) {
    return apiClient.post<ApiResponse<Deal>>(`/deals/${id}/approve`, data ?? {});
  },

  reject(id: string, data: RejectDealRequest) {
    return apiClient.post<ApiResponse<Deal>>(`/deals/${id}/reject`, data);
  },

  markWon(id: string, data: MarkWonRequest) {
    return apiClient.post<
      ApiResponse<Deal & { tier_recalculation?: TierRecalculation }>
    >(`/deals/${id}/mark-won`, data);
  },

  markLost(id: string, data: MarkLostRequest) {
    return apiClient.post<ApiResponse<Deal>>(`/deals/${id}/mark-lost`, data);
  },

  // ---- Conflict detection ----
  checkConflicts(params: ConflictCheckParams) {
    return apiClient.get<ApiResponse<DealConflict[]>>('/deals/conflict-check', {
      params,
    });
  },

  getConflicts(id: string) {
    return apiClient.get<ApiResponse<DealConflict[]>>(`/deals/${id}/conflicts`);
  },

  // ---- Status history ----
  getHistory(id: string) {
    return apiClient.get<ApiResponse<DealStatusHistory[]>>(
      `/deals/${id}/history`
    );
  },

  // ---- Deal products ----
  addProduct(dealId: string, data: AddDealProductRequest) {
    return apiClient.post<
      ApiResponse<DealProduct & { deal_estimated_value: number }>
    >(`/deals/${dealId}/products`, data);
  },

  removeProduct(dealId: string, productId: string) {
    return apiClient.delete<ApiResponse<null>>(
      `/deals/${dealId}/products/${productId}`
    );
  },

  // ---- Expiring deals ----
  getExpiring(days?: number) {
    return apiClient.get<ApiResponse<Deal[]>>('/deals/expiring', {
      params: days ? { days } : undefined,
    });
  },
};
