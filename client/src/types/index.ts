// ============================================================
// API Envelope
// ============================================================
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta: PaginationMeta | null;
  errors: ApiError[] | null;
}

export interface PaginationMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface ApiError {
  code: string;
  message: string;
  field: string | null;
}

// ============================================================
// Enums
// ============================================================
export type UserRole = 'admin' | 'channel_manager' | 'partner_admin' | 'partner_rep';

export type OrgStatus = 'prospect' | 'pending_approval' | 'active' | 'suspended' | 'churned';

export type DealStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'won'
  | 'lost'
  | 'expired';

export type QuoteStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'sent_to_customer'
  | 'accepted'
  | 'expired';

export type LeadStatus =
  | 'new'
  | 'assigned'
  | 'accepted'
  | 'contacted'
  | 'qualified'
  | 'working'
  | 'converted'
  | 'returned'
  | 'disqualified';

export type LeadSource = 'marketing' | 'website' | 'event' | 'manual' | 'referral';

export type MdfRequestStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'completed'
  | 'claim_submitted'
  | 'claim_approved'
  | 'claim_rejected'
  | 'reimbursed';

export type ProductType = 'hardware' | 'software' | 'subscription' | 'service';

export type BillingCycle = 'one_time' | 'monthly' | 'annual' | 'multi_year';

// ============================================================
// Entities
// ============================================================
export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  organization_id: string | null;
  organization?: Organization;
  title: string | null;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  timezone: string | null;
  notification_prefs: Record<string, boolean> | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  domain: string | null;
  phone: string | null;
  website: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state_province: string | null;
  country: string | null;
  postal_code: string | null;
  industry: string | null;
  employee_count: number | null;
  logo_url: string | null;
  status: OrgStatus;
  tier_id: string;
  tier?: Tier;
  channel_manager_id: string | null;
  ytd_revenue: number;
  ytd_deals_closed: number;
  certified_rep_count: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Tier {
  id: string;
  name: string;
  rank: number;
  color_hex: string;
  description: string | null;
  min_annual_revenue: number;
  min_deals_closed: number;
  min_certified_reps: number;
  min_csat_score: number;
  default_discount_pct: number;
  max_discount_pct: number;
  mdf_budget_pct: number;
  lead_priority: number;
  dedicated_channel_mgr: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
  children?: ProductCategory[];
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category_id: string | null;
  category?: ProductCategory;
  list_price: number;
  cost: number | null;
  product_type: ProductType;
  billing_cycle: BillingCycle;
  is_active: boolean;
  available_to_partners: boolean;
  image_url: string | null;
  tier_pricing?: TierProductPricing[];
  created_at: string;
  updated_at: string;
}

export interface TierProductPricing {
  id: string;
  tier_id: string;
  product_id: string;
  discount_pct: number;
  special_price: number | null;
  tier?: Tier;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  created_at: string;
}

// ============================================================
// Auth
// ============================================================
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  company_name: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}

export interface AuthResponse {
  user: User;
  organization?: Organization;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
  password_confirmation: string;
}

// ============================================================
// Query Params
// ============================================================
export interface PaginationParams {
  page?: number;
  per_page?: number;
}

export interface ProductQueryParams extends PaginationParams {
  category_id?: string;
  product_type?: ProductType;
  is_active?: boolean;
  search?: string;
  sort?: string;
}

export interface TierQueryParams extends PaginationParams {
  // tiers don't have many filters
}

export interface UserQueryParams extends PaginationParams {
  role?: UserRole;
  organization_id?: string;
  is_active?: boolean;
  search?: string;
}

export interface OrgQueryParams extends PaginationParams {
  status?: OrgStatus;
  tier_id?: string;
  channel_manager_id?: string;
  search?: string;
}

// ============================================================
// Deal Registration
// ============================================================
export type DealSource = 'direct' | 'referral' | 'marketing' | 'partner_sourced' | 'web' | 'other';

export type ConflictMatchType = 'exact_email' | 'exact_company' | 'fuzzy_company' | 'same_product_customer';

export interface Deal {
  id: string;
  deal_number: string;
  organization_id: string;
  organization_name?: string;
  submitted_by: string;
  submitted_by_name?: string;
  assigned_to: string | null;
  assigned_to_name?: string | null;
  customer_company_name: string;
  customer_contact_name: string | null;
  customer_contact_email: string | null;
  customer_contact_phone: string | null;
  customer_industry: string | null;
  customer_address: string | null;
  deal_name: string;
  description: string | null;
  status: DealStatus;
  estimated_value: number;
  actual_value: number | null;
  currency: string;
  win_probability: number | null;
  expected_close_date: string | null;
  actual_close_date: string | null;
  registration_expires_at: string | null;
  primary_product_id: string | null;
  is_conflicting: boolean;
  conflict_deal_id: string | null;
  conflict_notes: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  source: DealSource | null;
  tags: string[];
  custom_fields: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  products: DealProduct[];
  product_count?: number;
}

export interface DealProduct {
  id: string;
  deal_id: string;
  product_id: string;
  product_name?: string;
  product_sku?: string;
  quantity: number;
  unit_price: number;
  discount_pct: number;
  line_total: number;
}

export interface DealStatusHistory {
  id: string;
  deal_id: string;
  from_status: DealStatus | null;
  to_status: DealStatus;
  changed_by: string;
  changed_by_name?: string;
  notes: string | null;
  created_at: string;
}

export interface DealConflict {
  conflicting_deal_id: string;
  conflicting_deal_number: string;
  conflicting_org_name: string;
  match_type: ConflictMatchType;
  similarity_score: number;
}

// Deal Request types
export interface CreateDealRequest {
  customer_company_name: string;
  customer_contact_name?: string;
  customer_contact_email?: string;
  customer_contact_phone?: string;
  customer_industry?: string;
  customer_address?: string;
  deal_name: string;
  description?: string;
  estimated_value: number;
  currency?: string;
  win_probability?: number;
  expected_close_date?: string;
  primary_product_id?: string;
  source?: DealSource;
  tags?: string[];
}

export interface UpdateDealRequest extends Partial<CreateDealRequest> {}

export interface ApproveDealRequest {
  comments?: string;
}

export interface RejectDealRequest {
  rejection_reason: string;
}

export interface MarkWonRequest {
  actual_value: number;
  actual_close_date?: string;
}

export interface MarkLostRequest {
  loss_reason: string;
}

export interface AddDealProductRequest {
  product_id: string;
  quantity: number;
  unit_price: number;
  discount_pct?: number;
}

export interface ConflictCheckParams {
  customer_company: string;
  customer_email?: string;
  product_id?: string;
}

export interface DealQueryParams extends PaginationParams {
  status?: string;
  org_id?: string;
  submitted_by?: string;
  customer_company?: string;
  min_value?: number;
  max_value?: number;
  expected_close_before?: string;
  expected_close_after?: string;
  is_conflicting?: boolean;
  search?: string;
  sort?: string;
}

export interface TierRecalculation {
  organization_id: string;
  old_tier: { id: string; name: string; rank: number };
  new_tier: { id: string; name: string; rank: number };
  changed: boolean;
}

// ============================================================
// CPQ (Configure, Price, Quote)
// ============================================================
export type DiscountType = 'percentage' | 'fixed_amount';

export interface Quote {
  id: string;
  quote_number: string;
  deal_id: string | null;
  organization_id: string;
  organization_name?: string;
  created_by: string;
  created_by_name?: string;
  customer_name: string;
  customer_email: string | null;
  subtotal: number;
  total_discount: number;
  tax_amount: number;
  total_amount: number;
  currency: string;
  status: QuoteStatus;
  requires_approval: boolean;
  approved_by: string | null;
  approved_by_name?: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  valid_from: string;
  valid_until: string;
  payment_terms: string | null;
  notes: string | null;
  terms_and_conditions: string | null;
  pdf_url: string | null;
  line_items: QuoteLineItem[];
  created_at: string;
  updated_at: string;
}

export interface QuoteLineItem {
  id: string;
  quote_id: string;
  product_id: string;
  product_name?: string;
  product_sku?: string;
  sort_order: number;
  quantity: number;
  list_price: number;
  tier_discount_pct?: number;
  partner_discount_pct?: number;
  effective_discount_pct?: number;
  discount_type: DiscountType;
  discount_value: number;
  unit_price: number;
  line_total: number;
  discount_approved: boolean;
  discount_approved_by: string | null;
  approval_level?: 'auto' | 'channel_manager' | 'admin';
  notes: string | null;
  created_at: string;
}

export interface QuoteStatusHistory {
  id: string;
  entity_id: string;
  action: string;
  actor_name?: string;
  changes?: Record<string, unknown>;
  created_at: string;
}

// Quote request types
export interface CreateQuoteRequest {
  deal_id?: string;
  customer_name?: string;
  customer_email?: string;
  valid_until?: string;
  payment_terms?: string;
  notes?: string;
  terms_and_conditions?: string;
}

export interface UpdateQuoteRequest {
  customer_name?: string;
  customer_email?: string;
  valid_from?: string;
  valid_until?: string;
  payment_terms?: string;
  notes?: string;
  terms_and_conditions?: string;
  tax_amount?: number;
}

export interface AddLineItemRequest {
  product_id: string;
  quantity: number;
  discount_type?: DiscountType;
  discount_value?: number;
  sort_order?: number;
  notes?: string;
}

export interface UpdateLineItemRequest {
  quantity?: number;
  discount_type?: DiscountType;
  discount_value?: number;
  sort_order?: number;
  notes?: string;
}

export interface ApproveQuoteRequest {
  comments?: string;
}

export interface RejectQuoteRequest {
  rejection_reason: string;
}

export interface QuoteQueryParams extends PaginationParams {
  status?: string;
  deal_id?: string;
  customer_name?: string;
  min_amount?: number;
  max_amount?: number;
  created_after?: string;
  created_before?: string;
  created_by?: string;
  search?: string;
  sort?: string;
}

// ============================================================
// Lead Distribution
// ============================================================
export interface Lead {
  id: string;
  lead_number: string;
  source: LeadSource | null;
  campaign_name: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  title: string | null;
  industry: string | null;
  company_size: string | null;
  city: string | null;
  state_province: string | null;
  country: string | null;
  status: LeadStatus;
  assigned_org_id: string | null;
  assigned_org_name?: string | null;
  assigned_user_id: string | null;
  assigned_user_name?: string | null;
  assigned_at: string | null;
  accepted_at: string | null;
  sla_deadline: string | null;
  score: number;
  budget: number | null;
  timeline: string | null;
  interest_notes: string | null;
  converted_deal_id: string | null;
  converted_deal_number?: string | null;
  converted_at: string | null;
  return_reason: string | null;
  disqualify_reason: string | null;
  tags: string[];
  custom_fields: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateLeadRequest {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  company_name?: string;
  title?: string;
  industry?: string;
  company_size?: string;
  city?: string;
  state_province?: string;
  country?: string;
  source?: LeadSource;
  campaign_name?: string;
  score?: number;
  budget?: number;
  timeline?: string;
  interest_notes?: string;
  tags?: string[];
}

export interface UpdateLeadRequest extends Partial<CreateLeadRequest> {}

export interface AssignLeadRequest {
  organization_id: string;
  user_id?: string;
}

export interface BulkAssignRequest {
  assignments: Array<{
    lead_id: string;
    organization_id: string;
    user_id?: string;
  }>;
}

export interface BulkAssignResponse {
  total: number;
  succeeded: number;
  failed: number;
  results: Array<{
    lead_id: string;
    success: boolean;
    lead_number?: string;
    error?: { code: string; message: string };
  }>;
}

export interface ReturnLeadRequest {
  return_reason: string;
}

export interface DisqualifyLeadRequest {
  disqualify_reason: string;
}

export interface ConvertLeadRequest {
  deal_name?: string;
  estimated_value?: number;
  expected_close_date?: string;
}

export interface LeadHistoryEntry {
  id: string;
  action: string;
  actor_name?: string;
  summary?: string;
  changes?: Record<string, unknown>;
  created_at: string;
}

export interface LeadQueryParams extends PaginationParams {
  status?: string;
  score_min?: number;
  score_max?: number;
  source?: string;
  assigned_org_id?: string;
  assigned_user_id?: string;
  search?: string;
  created_after?: string;
  created_before?: string;
  sort?: string;
}

// ============================================================
// MDF (Market Development Funds)
// ============================================================
export type MdfActivityType =
  | 'event'
  | 'trade_show'
  | 'webinar'
  | 'digital_campaign'
  | 'content_syndication'
  | 'email_campaign'
  | 'print_collateral'
  | 'social_media'
  | 'other';

export interface MdfAllocation {
  id: string;
  organization_id: string;
  organization_name?: string;
  fiscal_year: number;
  fiscal_quarter: number;
  allocated_amount: number;
  spent_amount: number;
  remaining_amount: number;
  currency: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MdfRequest {
  id: string;
  request_number: string;
  allocation_id: string;
  organization_id: string;
  organization_name?: string;
  submitted_by: string;
  submitted_by_name?: string;
  activity_type: MdfActivityType;
  activity_name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  requested_amount: number;
  approved_amount: number | null;
  actual_spend: number | null;
  status: MdfRequestStatus;
  reviewed_by: string | null;
  reviewed_by_name?: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  claim_submitted_at: string | null;
  claim_amount: number | null;
  proof_of_execution: string[] | null;
  claim_notes: string | null;
  reimbursement_amount: number | null;
  reimbursed_at: string | null;
  created_at: string;
  updated_at: string;
  allocation?: MdfAllocation;
}

export interface CreateAllocationRequest {
  organization_id: string;
  fiscal_year: number;
  fiscal_quarter: number;
  allocated_amount: number;
  notes?: string;
}

export interface UpdateAllocationRequest {
  allocated_amount?: number;
  notes?: string;
}

export interface AutoAllocateRequest {
  fiscal_year: number;
  fiscal_quarter: number;
}

export interface AutoAllocateResponse {
  created: number;
  skipped_no_mdf: number;
  skipped_existing: number;
  allocations: Array<{
    organization_id: string;
    organization_name: string;
    allocated_amount: number;
  }>;
}

export interface CreateMdfRequestPayload {
  allocation_id: string;
  activity_type: MdfActivityType;
  activity_name: string;
  description?: string;
  start_date: string;
  end_date: string;
  requested_amount: number;
}

export interface UpdateMdfRequestPayload {
  activity_type?: MdfActivityType;
  activity_name?: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  requested_amount?: number;
}

export interface ApproveMdfRequest {
  approved_amount?: number;
  comments?: string;
}

export interface RejectMdfRequest {
  rejection_reason: string;
}

export interface SubmitClaimRequest {
  claim_amount: number;
  claim_notes?: string;
  proof_of_execution: string[];
}

export interface ApproveClaimRequest {
  reimbursement_amount?: number;
  comments?: string;
}

export interface RejectClaimRequest {
  rejection_reason: string;
}

// ============================================================
// Re-exports: Training, Content Library, Notifications
// ============================================================
export type {
  CourseCategory,
  CourseDifficulty,
  CertificationStatus,
  Course,
  Certification,
  CertSummary,
  CourseQueryParams,
  CertificationQueryParams,
  CreateCourseRequest,
  UpdateCourseRequest,
  EnrollRequest,
  RecordCompletionRequest,
} from './course';

export type {
  FileType,
  Document,
  Folder,
  DocumentQueryParams,
  UploadDocumentRequest,
  UpdateDocumentRequest,
  CreateFolderRequest,
  UpdateFolderRequest,
} from './document';

export type {
  NotificationType,
  NotificationQueryParams,
} from './notification';

export interface MdfAllocationQueryParams extends PaginationParams {
  organization_id?: string;
  fiscal_year?: number;
  fiscal_quarter?: number;
  sort?: string;
}

export interface MdfRequestQueryParams extends PaginationParams {
  status?: string;
  organization_id?: string;
  allocation_id?: string;
  activity_type?: string;
  submitted_by?: string;
  search?: string;
  sort?: string;
}
