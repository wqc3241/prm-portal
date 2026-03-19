import apiClient from './client';
import type { ApiResponse, Tier, Organization, PaginationParams } from '../types';

export const tiersApi = {
  list() {
    return apiClient.get<ApiResponse<Tier[]>>('/tiers');
  },

  getById(id: string) {
    return apiClient.get<ApiResponse<Tier>>(`/tiers/${id}`);
  },

  create(data: Omit<Tier, 'id' | 'created_at' | 'updated_at'>) {
    return apiClient.post<ApiResponse<Tier>>('/tiers', data);
  },

  update(id: string, data: Partial<Tier>) {
    return apiClient.patch<ApiResponse<Tier>>(`/tiers/${id}`, data);
  },

  delete(id: string) {
    return apiClient.delete<ApiResponse<null>>(`/tiers/${id}`);
  },

  getOrganizations(id: string, params?: PaginationParams) {
    return apiClient.get<ApiResponse<Organization[]>>(`/tiers/${id}/organizations`, {
      params,
    });
  },
};
