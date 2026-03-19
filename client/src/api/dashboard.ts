import apiClient from './client';
import type { ApiResponse } from '../types';
import type {
  PartnerDashboard,
  CMDashboard,
  AdminDashboard,
  PipelineAnalytics,
  PipelineAnalyticsParams,
  PartnerPerformanceData,
  PartnerPerformanceParams,
  LeadConversionData,
  LeadConversionParams,
  MdfRoiData,
  MdfRoiParams,
} from '../types/dashboard';

export const dashboardApi = {
  // ---- Dashboard Endpoints ----
  getPartnerDashboard() {
    return apiClient.get<ApiResponse<PartnerDashboard>>('/dashboard/partner');
  },

  getChannelManagerDashboard() {
    return apiClient.get<ApiResponse<CMDashboard>>('/dashboard/channel-manager');
  },

  getAdminDashboard() {
    return apiClient.get<ApiResponse<AdminDashboard>>('/dashboard/admin');
  },

  // ---- Analytics Endpoints ----
  getPipelineAnalytics(params?: PipelineAnalyticsParams) {
    return apiClient.get<ApiResponse<PipelineAnalytics>>('/analytics/pipeline', { params });
  },

  getPartnerPerformance(params?: PartnerPerformanceParams) {
    return apiClient.get<ApiResponse<PartnerPerformanceData>>('/analytics/partner-performance', { params });
  },

  getLeadConversion(params?: LeadConversionParams) {
    return apiClient.get<ApiResponse<LeadConversionData>>('/analytics/lead-conversion', { params });
  },

  getMdfRoi(params?: MdfRoiParams) {
    return apiClient.get<ApiResponse<MdfRoiData>>('/analytics/mdf-roi', { params });
  },
};
