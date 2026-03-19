import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { coursesApi } from '../api/courses';
import { getApiErrorMessage } from '../api/client';
import type {
  CourseQueryParams,
  CertificationQueryParams,
  CreateCourseRequest,
  UpdateCourseRequest,
  EnrollRequest,
  RecordCompletionRequest,
} from '../types';

// ---- Query Keys ----
const courseKeys = {
  all: ['courses'] as const,
  lists: () => [...courseKeys.all, 'list'] as const,
  list: (params?: CourseQueryParams) =>
    [...courseKeys.lists(), params] as const,
  detail: (id: string) => [...courseKeys.all, 'detail', id] as const,
  certifications: () => ['certifications'] as const,
  certList: (params?: CertificationQueryParams) =>
    [...courseKeys.certifications(), 'list', params] as const,
  expiring: (days: number) =>
    [...courseKeys.certifications(), 'expiring', days] as const,
  orgSummary: (orgId: string) =>
    [...courseKeys.certifications(), 'summary', orgId] as const,
};

// ---- Course Queries ----

export function useCourses(params?: CourseQueryParams) {
  return useQuery({
    queryKey: courseKeys.list(params),
    queryFn: async () => {
      const { data } = await coursesApi.list(params);
      return data;
    },
  });
}

export function useCourse(id: string | undefined) {
  return useQuery({
    queryKey: courseKeys.detail(id!),
    queryFn: async () => {
      const { data } = await coursesApi.getById(id!);
      return data.data;
    },
    enabled: !!id,
  });
}

// ---- Certification Queries ----

export function useCertifications(params?: CertificationQueryParams) {
  return useQuery({
    queryKey: courseKeys.certList(params),
    queryFn: async () => {
      const { data } = await coursesApi.listCertifications(params);
      return data;
    },
  });
}

export function useExpiringCerts(days: number = 30) {
  return useQuery({
    queryKey: courseKeys.expiring(days),
    queryFn: async () => {
      const { data } = await coursesApi.getExpiringCerts(days);
      return data.data;
    },
  });
}

export function useOrgCertSummary(orgId: string | undefined) {
  return useQuery({
    queryKey: courseKeys.orgSummary(orgId!),
    queryFn: async () => {
      const { data } = await coursesApi.getOrgCertSummary(orgId!);
      return data.data;
    },
    enabled: !!orgId,
  });
}

// ---- Invalidation helper ----
function useInvalidateCourses() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: courseKeys.all });
    queryClient.invalidateQueries({ queryKey: courseKeys.certifications() });
  };
}

// ---- Course Mutations ----

export function useCreateCourse() {
  const invalidate = useInvalidateCourses();
  return useMutation({
    mutationFn: (data: CreateCourseRequest) => coursesApi.create(data),
    onSuccess: () => {
      invalidate();
      toast.success('Course created');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useUpdateCourse(id: string) {
  const invalidate = useInvalidateCourses();
  return useMutation({
    mutationFn: (data: UpdateCourseRequest) => coursesApi.update(id, data),
    onSuccess: () => {
      invalidate();
      toast.success('Course updated');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useDeleteCourse() {
  const invalidate = useInvalidateCourses();
  return useMutation({
    mutationFn: (id: string) => coursesApi.delete(id),
    onSuccess: () => {
      invalidate();
      toast.success('Course deleted');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

// ---- Enrollment & Completion Mutations ----

export function useEnrollCourse() {
  const invalidate = useInvalidateCourses();
  return useMutation({
    mutationFn: ({
      courseId,
      data,
    }: {
      courseId: string;
      data?: EnrollRequest;
    }) => coursesApi.enroll(courseId, data),
    onSuccess: () => {
      invalidate();
      toast.success('Enrolled successfully');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useRecordCompletion() {
  const invalidate = useInvalidateCourses();
  return useMutation({
    mutationFn: ({
      certId,
      data,
    }: {
      certId: string;
      data: RecordCompletionRequest;
    }) => coursesApi.recordCompletion(certId, data),
    onSuccess: () => {
      invalidate();
      toast.success('Completion recorded');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}
