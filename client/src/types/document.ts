// ============================================================
// Content Library Types
// ============================================================

export type FileType =
  | 'pdf'
  | 'doc'
  | 'docx'
  | 'xls'
  | 'xlsx'
  | 'ppt'
  | 'pptx'
  | 'png'
  | 'jpg'
  | 'gif'
  | 'mp4'
  | 'zip'
  | 'other';

export interface Document {
  id: string;
  title: string;
  description: string | null;
  folder_id: string | null;
  folder_name?: string;
  file_name: string;
  file_type: FileType;
  file_size: number;
  file_url: string | null;
  uploaded_by: string;
  uploaded_by_name?: string;
  download_count: number;
  tags: string[];
  is_active: boolean;
  tier_restricted: boolean;
  min_tier_rank: number | null;
  created_at: string;
  updated_at: string;
}

export interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  description: string | null;
  sort_order: number;
  document_count?: number;
  children?: Folder[];
  created_at: string;
  updated_at: string;
}

// Query Params
export interface DocumentQueryParams {
  page?: number;
  per_page?: number;
  folder_id?: string;
  file_type?: FileType;
  tags?: string;
  search?: string;
  sort?: string;
}

// Request types
export interface UploadDocumentRequest {
  title: string;
  description?: string;
  folder_id?: string;
  tags?: string[];
  tier_restricted?: boolean;
  min_tier_rank?: number;
}

export interface UpdateDocumentRequest {
  title?: string;
  description?: string;
  folder_id?: string;
  tags?: string[];
  is_active?: boolean;
  tier_restricted?: boolean;
  min_tier_rank?: number;
}

export interface CreateFolderRequest {
  name: string;
  parent_id?: string;
  description?: string;
  sort_order?: number;
}

export interface UpdateFolderRequest {
  name?: string;
  description?: string;
  sort_order?: number;
}
