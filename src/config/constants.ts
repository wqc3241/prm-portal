export const USER_ROLES = ['admin', 'channel_manager', 'partner_admin', 'partner_rep'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ORG_STATUSES = ['prospect', 'pending_approval', 'active', 'suspended', 'churned'] as const;
export type OrgStatus = (typeof ORG_STATUSES)[number];

export const DEAL_STATUSES = ['draft', 'submitted', 'under_review', 'approved', 'rejected', 'won', 'lost', 'expired'] as const;
export const LEAD_STATUSES = ['new', 'assigned', 'accepted', 'contacted', 'qualified', 'converted', 'disqualified', 'returned'] as const;
export const QUOTE_STATUSES = ['draft', 'pending_approval', 'approved', 'rejected', 'sent_to_customer', 'accepted', 'expired'] as const;
export const MDF_REQUEST_STATUSES = ['draft', 'submitted', 'approved', 'rejected', 'completed', 'claim_submitted', 'claim_approved', 'claim_rejected', 'reimbursed'] as const;
export const MDF_ACTIVITY_TYPES = ['event', 'webinar', 'digital_campaign', 'print_collateral', 'trade_show', 'training', 'other'] as const;
export const NOTIFICATION_TYPES = ['deal_update', 'lead_assigned', 'quote_approval', 'mdf_update', 'tier_change', 'certification_expiring', 'document_shared', 'system_announcement'] as const;
export const APPROVAL_ACTIONS = ['approve', 'reject', 'request_changes'] as const;
export const DISCOUNT_TYPES = ['percentage', 'fixed_amount'] as const;

export const VALID_ORG_TRANSITIONS: Record<string, string[]> = {
  prospect: ['pending_approval', 'active'],
  pending_approval: ['active', 'prospect'],
  active: ['suspended'],
  suspended: ['active', 'churned'],
  churned: [],
};

export const PAGINATION = {
  defaultPage: 1,
  defaultPerPage: 25,
  maxPerPage: 100,
};

export const PARTNER_ROLES: UserRole[] = ['partner_admin', 'partner_rep'];
export const INTERNAL_ROLES: UserRole[] = ['admin', 'channel_manager'];

export const VALID_DEAL_TRANSITIONS: Record<string, string[]> = {
  draft: ['submitted'],
  submitted: ['under_review', 'approved', 'rejected'],
  under_review: ['approved', 'rejected'],
  approved: ['won', 'lost', 'expired'],
  rejected: ['submitted'], // resubmit
  won: [],
  lost: [],
  expired: [],
};

export const VALID_QUOTE_TRANSITIONS: Record<string, string[]> = {
  draft: ['pending_approval', 'approved'],     // approved if no approval needed
  pending_approval: ['approved', 'rejected'],
  approved: ['sent_to_customer'],
  rejected: ['pending_approval', 'approved'],  // resubmit
  sent_to_customer: ['accepted', 'expired'],
  accepted: [],
  expired: [],
};

export const QUOTE_VALIDITY_DAYS = 30;
export const DISCOUNT_CM_BUFFER_PCT = 15;  // CM can approve up to tier_max + 15%
export const ALLOWED_QUOTE_CREATION_DEAL_STATUSES = ['approved', 'won'];

export const DEAL_PROTECTION_DAYS = 90;
export const DEAL_EXPIRATION_REMINDER_DAYS = [14, 7];
export const SYSTEM_USER_EMAIL = 'system@prm-portal.internal';
export const LEAD_SLA_HOURS = 48;
export const LEAD_SLA_WARNING_HOURS = 24;

export const VALID_LEAD_TRANSITIONS: Record<string, string[]> = {
  new:           ['assigned', 'disqualified'],
  assigned:      ['accepted', 'returned', 'disqualified'],
  accepted:      ['contacted', 'qualified', 'converted', 'returned', 'disqualified'],
  contacted:     ['qualified', 'converted', 'returned', 'disqualified'],
  qualified:     ['converted', 'returned', 'disqualified'],
  converted:     [],  // terminal
  disqualified:  [],  // terminal
  returned:      ['assigned', 'disqualified'],  // can be re-assigned
};

export const LEAD_SOURCES = ['marketing', 'website', 'event', 'manual', 'referral'] as const;

export const LEAD_MAX_ACTIVE_BY_TIER_RANK: Record<number, number> = {
  1: 5,    // Registered
  2: 15,   // Innovator
  3: 30,   // Platinum Innovator
  4: 50,   // Diamond Innovator
};

export const LEAD_BULK_ASSIGN_MAX = 50;

export const LEAD_MULTIPLE_RETURN_THRESHOLD = 3;

export const LEAD_ASSIGNMENT_WEIGHTS = {
  tier: 0.40,
  geo: 0.25,
  industry: 0.20,
  load: 0.15,
};

export const GEO_REGIONS: Record<string, string[]> = {
  AMERICAS: ['US', 'CA', 'MX', 'BR', 'AR', 'CL', 'CO'],
  EMEA: ['GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'SE', 'NO', 'IL', 'AE', 'SA', 'ZA'],
  APAC: ['JP', 'KR', 'AU', 'NZ', 'SG', 'IN', 'TH', 'MY', 'ID', 'PH'],
};

export const RELATED_INDUSTRIES: Record<string, string[]> = {
  'Financial Services': ['Banking', 'Insurance', 'Fintech'],
  'Healthcare': ['Pharmaceuticals', 'Medical Devices', 'Biotech'],
  'Technology': ['Software', 'SaaS', 'Cloud Services', 'IT Services'],
  'Manufacturing': ['Industrial', 'Automotive', 'Aerospace'],
  'Retail': ['E-commerce', 'Consumer Goods', 'Hospitality'],
  'Government': ['Federal', 'State/Local', 'Defense', 'Education'],
};

export const MDF_CLAIM_DEADLINE_DAYS = 60;
export const MDF_MIN_LEAD_TIME_DAYS = 14;
export const MDF_MAX_REQUEST_PCT = 50;       // single request max % of quarterly allocation
export const MDF_TOP_PERFORMER_BONUS_PCT = 20;
export const MDF_TOP_PERFORMER_THRESHOLD = 0.10;  // top 10%
export const MDF_SINGLE_REQUEST_CAP_PCT = 50;     // max 50% of allocation per request

export const MDF_TIER_CAPS: Record<string, number> = {
  'Registered': 0,
  'Innovator': 10000,
  'Platinum Innovator': 50000,
  'Diamond Innovator': 200000,
};

export const MDF_PROOF_ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];
export const MDF_PROOF_MAX_FILE_SIZE = 10 * 1024 * 1024;  // 10 MB
export const MDF_PROOF_MAX_FILES = 10;

export const MDF_CLAIM_WARNING_DAYS = [45, 30, 14, 7];

export const VALID_MDF_TRANSITIONS: Record<string, string[]> = {
  draft:            ['submitted'],
  submitted:        ['approved', 'rejected'],
  approved:         ['completed'],
  rejected:         ['submitted'],            // resubmit after edit
  completed:        ['claim_submitted'],
  claim_submitted:  ['claim_approved', 'claim_rejected'],
  claim_rejected:   ['claim_submitted'],      // resubmit claim
  claim_approved:   ['reimbursed'],
  reimbursed:       [],                       // terminal
};

export const CERT_WARNING_DAYS = [30, 7, 1];

export const CERT_STATUSES = ['enrolled', 'in_progress', 'passed', 'failed', 'expired'] as const;
export const COURSE_TYPES = ['online', 'instructor_led', 'exam'] as const;

export const VALID_CERT_TRANSITIONS: Record<string, string[]> = {
  enrolled:     ['in_progress', 'passed', 'failed'],
  in_progress:  ['passed', 'failed'],
  passed:       ['expired'],          // only via background job
  failed:       ['enrolled'],         // re-enrollment
  expired:      ['enrolled'],         // renewal
};

export const DOCUMENT_ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'image/png',
  'image/jpeg',
  'image/gif',
  'video/mp4',
  'application/zip',
];
export const DOCUMENT_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
export const DOCUMENT_PRESIGN_EXPIRY_SECONDS = 300; // 5 minutes

export const NOTIFICATION_MAX_AGE_DAYS = 90;

// ─── Dashboard Health Score ─────────────────────────────────────────────────

export const HEALTH_SCORE_WEIGHTS = {
  revenue_attainment: 0.30,
  deal_win_rate: 0.20,
  lead_acceptance_rate: 0.15,
  lead_response_time: 0.15,
  cert_coverage: 0.10,
  mdf_utilization: 0.10,
};

export const HEALTH_SCORE_THRESHOLDS = {
  lead_response_excellent_hours: 4,
  lead_response_poor_hours: 48,
};
