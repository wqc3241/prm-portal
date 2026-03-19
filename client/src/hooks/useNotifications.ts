import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { notificationsApi } from '../api/notifications';
import { getApiErrorMessage } from '../api/client';
import type { NotificationQueryParams } from '../types/notification';

// ---- Query Keys ----
const notifKeys = {
  all: ['notifications'] as const,
  lists: () => [...notifKeys.all, 'list'] as const,
  list: (params?: NotificationQueryParams) =>
    [...notifKeys.lists(), params] as const,
  unreadCount: () => [...notifKeys.all, 'unread-count'] as const,
};

// ---- Queries ----

export function useNotifications(params?: NotificationQueryParams) {
  return useQuery({
    queryKey: notifKeys.list(params),
    queryFn: async () => {
      const { data } = await notificationsApi.list(params);
      return data;
    },
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: notifKeys.unreadCount(),
    queryFn: async () => {
      const { data } = await notificationsApi.getUnreadCount();
      return data.data.count;
    },
    refetchInterval: 30000, // Poll every 30 seconds
  });
}

// ---- Mutations ----

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notifKeys.all });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notifKeys.all });
      toast.success('All notifications marked as read');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useDismissNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.dismiss(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notifKeys.all });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}
