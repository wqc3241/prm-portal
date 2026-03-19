import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api/dashboard';
import type {
  PipelineAnalyticsParams,
  PartnerPerformanceParams,
  LeadConversionParams,
  MdfRoiParams,
} from '../types/dashboard';

// ---- Query Keys ----
const dashboardKeys = {
  all: ['dashboard'] as const,
  partner: () => [...dashboardKeys.all, 'partner'] as const,
  channelManager: () => [...dashboardKeys.all, 'channel-manager'] as const,
  admin: () => [...dashboardKeys.all, 'admin'] as const,
};

const analyticsKeys = {
  all: ['analytics'] as const,
  pipeline: (params?: PipelineAnalyticsParams) =>
    [...analyticsKeys.all, 'pipeline', params] as const,
  partnerPerformance: (params?: PartnerPerformanceParams) =>
    [...analyticsKeys.all, 'partner-performance', params] as const,
  leadConversion: (params?: LeadConversionParams) =>
    [...analyticsKeys.all, 'lead-conversion', params] as const,
  mdfRoi: (params?: MdfRoiParams) =>
    [...analyticsKeys.all, 'mdf-roi', params] as const,
};

// ---- Dashboard Hooks ----

export function usePartnerDashboard() {
  return useQuery({
    queryKey: dashboardKeys.partner(),
    queryFn: async () => {
      const { data } = await dashboardApi.getPartnerDashboard();
      return data.data;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useChannelManagerDashboard() {
  return useQuery({
    queryKey: dashboardKeys.channelManager(),
    queryFn: async () => {
      const { data } = await dashboardApi.getChannelManagerDashboard();
      return data.data;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useAdminDashboard() {
  return useQuery({
    queryKey: dashboardKeys.admin(),
    queryFn: async () => {
      const { data } = await dashboardApi.getAdminDashboard();
      return data.data;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

// ---- Analytics Hooks ----

export function usePipelineAnalytics(params?: PipelineAnalyticsParams) {
  return useQuery({
    queryKey: analyticsKeys.pipeline(params),
    queryFn: async () => {
      const { data } = await dashboardApi.getPipelineAnalytics(params);
      return data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function usePartnerPerformance(params?: PartnerPerformanceParams) {
  return useQuery({
    queryKey: analyticsKeys.partnerPerformance(params),
    queryFn: async () => {
      const { data } = await dashboardApi.getPartnerPerformance(params);
      return data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useLeadConversion(params?: LeadConversionParams) {
  return useQuery({
    queryKey: analyticsKeys.leadConversion(params),
    queryFn: async () => {
      const { data } = await dashboardApi.getLeadConversion(params);
      return data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useMdfRoi(params?: MdfRoiParams) {
  return useQuery({
    queryKey: analyticsKeys.mdfRoi(params),
    queryFn: async () => {
      const { data } = await dashboardApi.getMdfRoi(params);
      return data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}
