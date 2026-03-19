import apiClient from './client';
import type {
  ApiResponse,
  Course,
  Certification,
  CertSummary,
  CourseQueryParams,
  CertificationQueryParams,
  CreateCourseRequest,
  UpdateCourseRequest,
  EnrollRequest,
  RecordCompletionRequest,
} from '../types';

export const coursesApi = {
  // ---- Courses ----
  list(params?: CourseQueryParams) {
    return apiClient.get<ApiResponse<Course[]>>('/courses', { params });
  },

  getById(id: string) {
    return apiClient.get<ApiResponse<Course>>(`/courses/${id}`);
  },

  create(data: CreateCourseRequest) {
    return apiClient.post<ApiResponse<Course>>('/courses', data);
  },

  update(id: string, data: UpdateCourseRequest) {
    return apiClient.patch<ApiResponse<Course>>(`/courses/${id}`, data);
  },

  delete(id: string) {
    return apiClient.delete<ApiResponse<null>>(`/courses/${id}`);
  },

  // ---- Enrollment & Completion ----
  enroll(courseId: string, data?: EnrollRequest) {
    return apiClient.post<ApiResponse<Certification>>(
      `/courses/${courseId}/enroll`,
      data ?? {}
    );
  },

  recordCompletion(certId: string, data: RecordCompletionRequest) {
    return apiClient.post<ApiResponse<Certification>>(
      `/certifications/${certId}/complete`,
      data
    );
  },

  // ---- Certifications ----
  listCertifications(params?: CertificationQueryParams) {
    return apiClient.get<ApiResponse<Certification[]>>('/certifications', {
      params,
    });
  },

  getExpiringCerts(days: number = 30) {
    return apiClient.get<ApiResponse<Certification[]>>(
      '/certifications/expiring',
      { params: { days } }
    );
  },

  getOrgCertSummary(orgId: string) {
    return apiClient.get<ApiResponse<CertSummary>>(
      `/certifications/summary/${orgId}`
    );
  },
};
