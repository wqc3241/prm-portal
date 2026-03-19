// ============================================================
// Notification Types (extended)
// ============================================================

export type NotificationType =
  | 'deal_submitted'
  | 'deal_approved'
  | 'deal_rejected'
  | 'deal_expired'
  | 'quote_approved'
  | 'quote_rejected'
  | 'lead_assigned'
  | 'lead_sla_warning'
  | 'mdf_approved'
  | 'mdf_rejected'
  | 'cert_expiring'
  | 'cert_completed'
  | 'tier_changed'
  | 'system'
  | 'info';

export interface NotificationQueryParams {
  page?: number;
  per_page?: number;
  is_read?: boolean;
  type?: string;
  sort?: string;
}
