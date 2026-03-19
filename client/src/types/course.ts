// ============================================================
// Training & Certification Types
// ============================================================

export type CourseCategory = 'sales' | 'technical' | 'product' | 'compliance' | 'onboarding';

export type CourseDifficulty = 'beginner' | 'intermediate' | 'advanced';

export type CertificationStatus = 'enrolled' | 'passed' | 'failed' | 'expired';

export interface Course {
  id: string;
  title: string;
  description: string | null;
  category: CourseCategory;
  difficulty: CourseDifficulty;
  duration_minutes: number;
  passing_score: number;
  certification_valid_months: number | null;
  is_active: boolean;
  is_required: boolean;
  sort_order: number;
  image_url: string | null;
  created_by: string;
  created_by_name?: string;
  enrollment_count?: number;
  pass_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Certification {
  id: string;
  course_id: string;
  course_title?: string;
  course_category?: CourseCategory;
  user_id: string;
  user_name?: string;
  user_email?: string;
  organization_id: string | null;
  organization_name?: string;
  status: CertificationStatus;
  score: number | null;
  enrolled_at: string;
  completed_at: string | null;
  certified_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CertSummary {
  total_enrolled: number;
  total_passed: number;
  total_failed: number;
  total_expired: number;
  completion_rate: number;
  courses: Array<{
    course_id: string;
    course_title: string;
    enrolled: number;
    passed: number;
    failed: number;
  }>;
}

// Query Params
export interface CourseQueryParams {
  page?: number;
  per_page?: number;
  category?: CourseCategory;
  difficulty?: CourseDifficulty;
  is_active?: boolean;
  search?: string;
  sort?: string;
}

export interface CertificationQueryParams {
  page?: number;
  per_page?: number;
  course_id?: string;
  user_id?: string;
  organization_id?: string;
  status?: CertificationStatus;
  sort?: string;
}

// Request types
export interface CreateCourseRequest {
  title: string;
  description?: string;
  category: CourseCategory;
  difficulty: CourseDifficulty;
  duration_minutes: number;
  passing_score: number;
  certification_valid_months?: number;
  is_required?: boolean;
  sort_order?: number;
}

export interface UpdateCourseRequest extends Partial<CreateCourseRequest> {
  is_active?: boolean;
}

export interface EnrollRequest {
  user_id?: string;
}

export interface RecordCompletionRequest {
  score: number;
}
