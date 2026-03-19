// ============================================================
// Partner Dashboard
// ============================================================
export interface PartnerDashboard {
  pipeline: {
    total_value: number;
    deal_count: number;
    by_status: Array<{
      status: string;
      count: number;
      value: number;
    }>;
  };
  revenue: {
    ytd_closed_won: number;
    tier_target: number;
    attainment_pct: number;
  };
  deals: {
    submitted: number;
    approved: number;
    rejected: number;
    expired: number;
    won: number;
    lost: number;
    total_active: number;
  };
  leads: {
    assigned: number;
    accepted: number;
    converted: number;
    disqualified: number;
    conversion_rate: number;
    avg_response_hours: number | null;
  };
  mdf: {
    current_quarter: {
      fiscal_year: number;
      fiscal_quarter: number;
      allocated: number;
      requested: number;
      approved: number;
      claimed: number;
      reimbursed: number;
      remaining: number;
    };
  };
  certifications: {
    total_certified: number;
    total_users: number;
    expiring_within_30_days: number;
    expiring_certs: Array<{
      user_id: string;
      user_name: string;
      course_name: string;
      expires_at: string;
    }>;
  };
  tier_progress: {
    current_tier: {
      id: string;
      name: string;
      rank: number;
    };
    next_tier: {
      id: string;
      name: string;
      rank: number;
      requirements: {
        min_annual_revenue: number;
        min_deals_closed: number;
        min_certified_reps: number;
        min_csat_score: number | null;
      };
    } | null;
    current_metrics: {
      ytd_revenue: number;
      ytd_deals_closed: number;
      certified_reps: number;
      csat_score: number | null;
    };
    gaps: {
      revenue_needed: number;
      deals_needed: number;
      certs_needed: number;
      csat_needed: number | null;
    } | null;
    progress_pct: {
      revenue: number;
      deals: number;
      certs: number;
      csat: number | null;
    };
  };
  recent_activity: ActivityItem[];
}

export interface ActivityItem {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  summary: string;
  created_at: string;
}

// ============================================================
// Channel Manager Dashboard
// ============================================================
export interface CMDashboard {
  summary: {
    total_partners: number;
    active_partners: number;
    total_pipeline_value: number;
    total_ytd_revenue: number;
    total_active_deals: number;
  };
  pending_approvals: {
    total: number;
    deals: number;
    quotes: number;
    mdf_requests: number;
  };
  partners: CMPartner[];
  lead_metrics: {
    total_unassigned: number;
    total_assigned_pending: number;
    avg_acceptance_hours: number | null;
    acceptance_rate_by_partner: Array<{
      organization_id: string;
      name: string;
      assigned: number;
      accepted: number;
      returned: number;
      acceptance_rate: number;
      avg_response_hours: number | null;
    }>;
  };
  recent_activity: ActivityItem[];
}

export interface CMPartner {
  organization_id: string;
  name: string;
  tier: {
    id: string;
    name: string;
    rank: number;
    color_hex: string;
  };
  status: string;
  pipeline_value: number;
  ytd_revenue: number;
  active_deals: number;
  open_leads: number;
  certified_reps: number;
  total_reps: number;
  health_score: number;
}

// ============================================================
// Admin Dashboard
// ============================================================
export interface AdminDashboard {
  program_metrics: {
    total_partners: number;
    active_partners: number;
    total_pipeline_value: number;
    total_ytd_revenue: number;
    total_active_deals: number;
    total_active_leads: number;
    total_active_quotes: number;
  };
  tier_distribution: Array<{
    tier_id: string;
    tier_name: string;
    rank: number;
    color_hex: string;
    partner_count: number;
  }>;
  mdf_utilization: {
    total_allocated: number;
    total_approved: number;
    total_spent: number;
    total_remaining: number;
    utilization_pct: number;
  };
  certification_coverage: {
    total_certified_users: number;
    total_partner_users: number;
    overall_pct: number;
    by_tier: Array<{
      tier_id: string;
      tier_name: string;
      required_certs: number;
      partners_meeting_requirement: number;
      partners_total: number;
      coverage_pct: number;
    }>;
  };
  top_partners: {
    by_revenue: TopPartner[];
    by_deal_count: TopPartnerDealCount[];
    by_lead_conversion: TopPartnerConversion[];
  };
  pending_approvals: {
    total: number;
    deals: number;
    quotes: number;
    mdf_requests: number;
  };
  recent_activity: ActivityItem[];
}

export interface TopPartner {
  organization_id: string;
  name: string;
  tier_name: string;
  ytd_revenue: number;
}

export interface TopPartnerDealCount {
  organization_id: string;
  name: string;
  tier_name: string;
  deal_count: number;
}

export interface TopPartnerConversion {
  organization_id: string;
  name: string;
  tier_name: string;
  conversion_rate: number;
}

// ============================================================
// Analytics
// ============================================================
export interface PipelineAnalytics {
  total_pipeline_value: number;
  total_deal_count: number;
  groups: Array<{
    key: string;
    label: string;
    deal_count: number;
    total_value: number;
    avg_value: number;
    avg_win_probability: number | null;
  }>;
  trend: Array<{
    period: string;
    deal_count: number;
    total_value: number;
  }>;
}

export interface PartnerPerformanceData {
  partners: Array<{
    organization_id: string;
    name: string;
    tier: { id: string; name: string; rank: number };
    metrics: {
      ytd_revenue: number;
      revenue_attainment_pct: number;
      total_deals: number;
      won_deals: number;
      lost_deals: number;
      win_rate: number | null;
      avg_deal_size: number;
      avg_deal_cycle_days: number | null;
      total_leads_assigned: number;
      leads_converted: number;
      lead_conversion_rate: number;
      avg_lead_response_hours: number | null;
      sla_compliance_pct: number;
      mdf_allocated: number;
      mdf_spent: number;
      mdf_utilization_pct: number;
      certified_reps: number;
      total_reps: number;
      cert_coverage_pct: number;
      health_score: number;
    };
  }>;
  total: number;
}

export interface LeadConversionData {
  funnel: Array<{
    stage: string;
    count: number;
    pct_of_total: number;
  }>;
  drop_off: Array<{
    from: string;
    to: string;
    count: number;
  }>;
  by_source: Array<{
    source: string;
    total: number;
    converted: number;
    conversion_rate: number;
  }>;
  avg_time_between_stages: {
    new_to_assigned_hours: number | null;
    assigned_to_accepted_hours: number | null;
    accepted_to_converted_days: number | null;
  };
  trend: Array<{
    period: string;
    new: number;
    converted: number;
    conversion_rate: number;
  }>;
}

export interface MdfRoiData {
  summary: {
    total_allocated: number;
    total_approved: number;
    total_claimed: number;
    total_reimbursed: number;
    associated_revenue: number;
    roi_ratio: number | null;
  };
  by_activity_type: Array<{
    activity_type: string;
    request_count: number;
    total_approved: number;
    total_reimbursed: number;
    associated_revenue: number;
    roi_ratio: number | null;
  }>;
  by_quarter: Array<{
    fiscal_year: number;
    fiscal_quarter: number;
    allocated: number;
    approved: number;
    reimbursed: number;
    associated_revenue: number;
    roi_ratio: number | null;
  }>;
  by_partner: Array<{
    organization_id: string;
    name: string;
    tier_name: string;
    total_allocated: number;
    total_reimbursed: number;
    associated_revenue: number;
    roi_ratio: number | null;
  }>;
}

// ============================================================
// Analytics Query Params
// ============================================================
export interface PipelineAnalyticsParams {
  start_date?: string;
  end_date?: string;
  org_id?: string;
  product_id?: string;
  group_by?: 'status' | 'organization' | 'product' | 'month';
}

export interface PartnerPerformanceParams {
  org_id?: string;
  tier_id?: string;
  sort_by?: 'revenue' | 'deal_count' | 'win_rate' | 'lead_conversion' | 'health_score';
  sort_order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface LeadConversionParams {
  start_date?: string;
  end_date?: string;
  org_id?: string;
  source?: string;
}

export interface MdfRoiParams {
  fiscal_year?: number;
  fiscal_quarter?: number;
  org_id?: string;
  activity_type?: string;
}
