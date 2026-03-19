import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { documentsApi } from '../api/documents';
import { getApiErrorMessage } from '../api/client';
import type {
  DocumentQueryParams,
  UpdateDocumentRequest,
  CreateFolderRequest,
  UpdateFolderRequest,
} from '../types';

// ---- Query Keys ----
const docKeys = {
  all: ['documents'] as const,
  lists: () => [...docKeys.all, 'list'] as const,
  list: (params?: DocumentQueryParams) =>
    [...docKeys.lists(), params] as const,
  detail: (id: string) => [...docKeys.all, 'detail', id] as const,
  folders: () => [...docKeys.all, 'folders'] as const,
};

// ---- Document Queries ----

export function useDocuments(params?: DocumentQueryParams) {
  return useQuery({
    queryKey: docKeys.list(params),
    queryFn: async () => {
      const { data } = await documentsApi.list(params);
      return data;
    },
  });
}

export function useDocument(id: string | undefined) {
  return useQuery({
    queryKey: docKeys.detail(id!),
    queryFn: async () => {
      const { data } = await documentsApi.getById(id!);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useFolders() {
  return useQuery({
    queryKey: docKeys.folders(),
    queryFn: async () => {
      const { data } = await documentsApi.listFolders();
      return data.data;
    },
  });
}

// ---- Invalidation helper ----
function useInvalidateDocs() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: docKeys.all });
  };
}

// ---- Document Mutations ----

export function useUploadDocument() {
  const invalidate = useInvalidateDocs();
  return useMutation({
    mutationFn: (formData: FormData) => documentsApi.upload(formData),
    onSuccess: () => {
      invalidate();
      toast.success('Document uploaded');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useUpdateDocument(id: string) {
  const invalidate = useInvalidateDocs();
  return useMutation({
    mutationFn: (data: UpdateDocumentRequest) =>
      documentsApi.update(id, data),
    onSuccess: () => {
      invalidate();
      toast.success('Document updated');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useDeleteDocument() {
  const invalidate = useInvalidateDocs();
  return useMutation({
    mutationFn: (id: string) => documentsApi.delete(id),
    onSuccess: () => {
      invalidate();
      toast.success('Document deleted');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useDownloadDocument() {
  return useMutation({
    mutationFn: (id: string) => documentsApi.download(id),
    onSuccess: (res) => {
      const url = res.data.data.url;
      window.open(url, '_blank');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

// ---- Folder Mutations ----

export function useCreateFolder() {
  const invalidate = useInvalidateDocs();
  return useMutation({
    mutationFn: (data: CreateFolderRequest) => documentsApi.createFolder(data),
    onSuccess: () => {
      invalidate();
      toast.success('Folder created');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useUpdateFolder(id: string) {
  const invalidate = useInvalidateDocs();
  return useMutation({
    mutationFn: (data: UpdateFolderRequest) =>
      documentsApi.updateFolder(id, data),
    onSuccess: () => {
      invalidate();
      toast.success('Folder updated');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}
