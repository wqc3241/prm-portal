import apiClient from './client';
import type { ApiResponse, Notification } from '../types';
import type { NotificationQueryParams } from '../types/notification';

export const notificationsApi = {
  list(params?: NotificationQueryParams) {
    return apiClient.get<ApiResponse<Notification[]>>('/notifications', {
      params,
    });
  },

  getUnreadCount() {
    return apiClient.get<ApiResponse<{ count: number }>>(
      '/notifications/unread-count'
    );
  },

  markRead(id: string) {
    return apiClient.patch<ApiResponse<null>>(`/notifications/${id}/read`);
  },

  markAllRead() {
    return apiClient.post<ApiResponse<null>>('/notifications/mark-all-read');
  },

  dismiss(id: string) {
    return apiClient.delete<ApiResponse<null>>(`/notifications/${id}`);
  },
};
