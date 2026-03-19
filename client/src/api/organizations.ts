import apiClient from './client';
import type { ApiResponse, Organization, OrgQueryParams, User } from '../types';

export const organizationsApi = {
  list(params?: OrgQueryParams) {
    return apiClient.get<ApiResponse<Organization[]>>('/organizations', { params });
  },

  getById(id: string) {
    return apiClient.get<ApiResponse<Organization>>(`/organizations/${id}`);
  },

  create(data: Partial<Organization>) {
    return apiClient.post<ApiResponse<Organization>>('/organizations', data);
  },

  update(id: string, data: Partial<Organization>) {
    return apiClient.patch<ApiResponse<Organization>>(`/organizations/${id}`, data);
  },

  getUsers(id: string) {
    return apiClient.get<ApiResponse<User[]>>(`/organizations/${id}/users`);
  },

  recalculateTier(id: string) {
    return apiClient.post<ApiResponse<{ old_tier: string; new_tier: string }>>(
      `/organizations/${id}/recalculate-tier`
    );
  },
};
