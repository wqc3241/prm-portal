import apiClient from './client';
import type {
  ApiResponse,
  Document,
  Folder,
  DocumentQueryParams,
  UpdateDocumentRequest,
  CreateFolderRequest,
  UpdateFolderRequest,
} from '../types';

export const documentsApi = {
  // ---- Documents ----
  list(params?: DocumentQueryParams) {
    return apiClient.get<ApiResponse<Document[]>>('/documents', { params });
  },

  getById(id: string) {
    return apiClient.get<ApiResponse<Document>>(`/documents/${id}`);
  },

  upload(formData: FormData) {
    return apiClient.post<ApiResponse<Document>>('/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    });
  },

  update(id: string, data: UpdateDocumentRequest) {
    return apiClient.patch<ApiResponse<Document>>(`/documents/${id}`, data);
  },

  delete(id: string) {
    return apiClient.delete<ApiResponse<null>>(`/documents/${id}`);
  },

  download(id: string) {
    return apiClient.get<ApiResponse<{ url: string }>>(
      `/documents/${id}/download`
    );
  },

  // ---- Folders ----
  listFolders() {
    return apiClient.get<ApiResponse<Folder[]>>('/documents/folders');
  },

  createFolder(data: CreateFolderRequest) {
    return apiClient.post<ApiResponse<Folder>>('/documents/folders', data);
  },

  updateFolder(id: string, data: UpdateFolderRequest) {
    return apiClient.patch<ApiResponse<Folder>>(
      `/documents/folders/${id}`,
      data
    );
  },
};
