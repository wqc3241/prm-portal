# Product Requirements Document: Phase 6 — Dashboards & Analytics

**Version:** 1.0
**Last Updated:** 2026-03-19
**Document Owner:** PRM Portal Product Team
**Status:** Approved

---

## 1. Executive Summary and Vision

### Vision Statement
Every PRM Portal user sees a role-appropriate home screen with live metrics, actionable charts, and quick-access navigation — turning raw transactional data from Phases 1-5 into decision-driving insight without leaving the portal.

### Executive Summary
Phase 6 replaces the current placeholder dashboard (`DashboardPage.tsx`, 165 lines of hardcoded zeros) with three role-specific dashboard endpoints and four analytics endpoints. The partner dashboard surfaces pipeline, revenue, lead, MDF, and tier-progress data for a single organization. The channel manager dashboard aggregates portfolio health, pending approvals, and partner scorecards across assigned organizations. The admin dashboard provides program-wide KPIs, tier distribution, MDF utilization, and certification coverage. Four analytics endpoints (`pipeline`, `partner-performance`, `lead-conversion`, `mdf-roi`) power filterable deep-dive views for internal users.

On the frontend, the existing `DashboardPage.tsx` is replaced with a role-routing wrapper that renders one of three sub-pages, each composed of reusable Recharts-based chart components (`BarChart`, `PieChart`, `RadialBarChart`, `LineChart`, `ProgressBar`).

### Key Benefits
- Partners gain self-service visibility into pipeline health, tier progress, and MDF balance — reducing "status check" emails to channel managers by an estimated 40%.
- Channel managers see a unified portfolio view with pending-approval counts, replacing manual cross-module checks that currently require navigating 4+ pages.
- Admins get program-level analytics for executive reporting without manual SQL queries.

---

## 2. Problem Statement

### Current Challenges

**For Partners (partner_admin, partner_rep):**
- Dashboard shows hardcoded zeros — no visibility into deal pipeline, revenue attainment, or tier progress.
- Partners must manually navigate to Deals, Leads, MDF, and Training pages to piece together their own performance picture.
- No way to see how close they are to the next tier without comparing raw numbers against tier requirements.

**For Channel Managers:**
- No portfolio overview — must open each partner org individually to assess health.
- Pending approvals (deals + quotes + MDF) are spread across three different list pages with no unified count.
- No partner scorecards for comparing performance across assigned partners.

**For Admins:**
- No program-level metrics — total pipeline, tier distribution, MDF utilization all require direct database queries.
- Cannot identify underperforming partners or overallocated MDF budgets at a glance.

### Why This Matters Now
Phases 1-5 are complete. The system contains deals, quotes, leads, MDF allocations/requests, certifications, and tier data. The data exists but is inaccessible in aggregated form. The placeholder dashboard is the first page every user sees on login — it currently signals "not built yet" and undermines confidence in the platform.

---

## 3. Goals and Success Metrics

### Business Goals
1. Every role sees live, role-appropriate metrics on their home page.
2. Channel managers can identify their top 3 and bottom 3 partners within 10 seconds of loading the dashboard.
3. Partners can determine their tier-progress gap (revenue, deals, certs needed) without navigating away from the dashboard.

### User Goals
1. Partner users see pipeline value, deal status breakdown, lead conversion, MDF balance, and tier progress in a single view.
2. Channel managers see portfolio health, pending approvals, and partner scorecards in a single view.
3. Admins see program KPIs, tier distribution, MDF utilization, and top-partner rankings in a single view.

### Success Metrics

#### Primary Metrics (P0)
| Metric | Baseline | Target (launch) |
|--------|----------|-----------------|
| Dashboard data accuracy | 0% (hardcoded zeros) | 100% match to underlying data |
| Dashboard load time (p95) | N/A | < 2 seconds |
| Endpoints returning valid data | 0 of 7 | 7 of 7 |

#### Secondary Metrics (P1)
| Metric | Target |
|--------|--------|
| Frontend chart render time | < 500ms after data arrives |
| Analytics endpoint response time (p95) | < 3 seconds (may involve heavier aggregations) |

---

## 4. Non-Goals and Boundaries

### Explicit Non-Goals
- **Real-time streaming**: Dashboards use request-response. WebSocket push for live updates is out of scope.
- **Custom dashboard builder**: Users cannot rearrange widgets or create custom charts. Layout is fixed per role.
- **PDF/CSV export of dashboard**: Analytics export is a Phase 8 feature.
- **Historical trend lines**: Phase 6 shows current-state and YTD aggregations. Multi-year trend analysis is post-MVP.
- **Caching layer**: Redis caching for dashboard queries is desirable but not required for Phase 6. Queries will be optimized with proper indexes and denormalized fields. Caching can be added in Phase 8 if load testing reveals the need.
- **New database tables or migrations**: Phase 6 reads existing tables only. No new tables are needed — all metrics derive from existing `deals`, `quotes`, `leads`, `mdf_allocations`, `mdf_requests`, `organizations`, `users`, `user_certifications`, `partner_tiers`, and `approval_requests` tables.

### Phase 6 Boundaries
- Dashboard endpoints return pre-aggregated JSON — they are not generic query engines.
- Analytics endpoints accept date-range and org filters but do not support arbitrary GROUP BY or pivot operations.
- `partner_rep` sees the same dashboard as `partner_admin` but deals/leads are further scoped to `submitted_by = user.id` or `assigned_user_id = user.id`.

### Future Considerations (Post-Phase 6)
- Redis caching with 5-minute TTL for dashboard endpoints.
- Materialized views or nightly rollup tables if query performance degrades at scale.
- Embeddable dashboard widgets for external partner portals.

---

## 5. User Personas and Use Cases

### Persona 1: Priya — Partner Admin (Primary)
**Role:** VP of Alliances at a Gold-tier partner
**Experience:** 8 years in channel sales; uses Salesforce daily

**Goals:**
- See at a glance whether her org is on track for Platinum tier this year.
- Monitor deal pipeline and MDF balance without drilling into sub-pages.
- Identify which reps are converting leads well and which need coaching.

**Use Cases:**
- Priya logs in Monday morning and immediately sees: $2.4M pipeline, 12 active deals, 67% lead conversion, $8K MDF remaining, and a tier-progress bar showing she needs $600K more revenue and 2 more certified reps for Platinum.

### Persona 2: Marcus — Channel Manager
**Role:** Channel Account Manager responsible for 15 partner organizations
**Experience:** 5 years managing partner relationships

**Goals:**
- Quickly identify which partners need attention (low pipeline, missed SLAs, pending approvals).
- Compare partner performance side-by-side for quarterly business reviews.
- Clear his approval queue efficiently.

**Use Cases:**
- Marcus opens his dashboard and sees 7 pending approvals (3 deals, 2 quotes, 2 MDF). He sees partner "Acme Networks" flagged with a low health score due to 0 deals submitted this quarter. He clicks through to the partner scorecard.

### Persona 3: Sarah — Program Admin
**Role:** Director of Partner Programs
**Experience:** 10 years in channel program management

**Goals:**
- Report program health to VP: total pipeline, revenue, partner count by tier.
- Identify MDF budget utilization to plan next quarter's allocation.
- Spot certification coverage gaps that affect partner readiness.

**Use Cases:**
- Sarah opens the admin dashboard before a leadership meeting. She sees: 142 active partners, $48M total pipeline, 63% MDF utilization, Platinum tier has 8 partners (up from 6 last quarter). She drills into the pipeline analytics view filtered by product category.

### Persona 4: Jake — Partner Rep
**Role:** Sales rep at a Silver-tier partner
**Experience:** 2 years in partner sales

**Goals:**
- See his personal deal pipeline and lead conversion stats.
- Know how many leads are assigned to him and their SLA status.

**Use Cases:**
- Jake logs in and sees his 4 active deals ($380K pipeline), 2 leads awaiting acceptance, and 75% lead conversion rate.

---

## 6. Functional Requirements

### 6.1 Dashboard Endpoints — Backend

---

**FR-DB-001: Partner Dashboard Endpoint** (P0)
`GET /api/v1/dashboard/partner`

**Allowed roles:** `partner_admin`, `partner_rep`

**Data scoping:**
- `partner_admin`: All data for `organization_id = req.user.org_id`
- `partner_rep`: Deals scoped to `submitted_by = req.user.sub`, leads scoped to `assigned_user_id = req.user.sub`, MDF and tier data remain org-wide (read-only context).

**Query parameters:** None. This endpoint returns a fixed payload for the authenticated user's org.

**Response schema:**
```json
{
  "success": true,
  "data": {
    "pipeline": {
      "total_value": 2400000.00,
      "deal_count": 12,
      "by_status": [
        { "status": "draft", "count": 2, "value": 180000.00 },
        { "status": "submitted", "count": 3, "value": 420000.00 },
        { "status": "under_review", "count": 1, "value": 150000.00 },
        { "status": "approved", "count": 4, "value": 1200000.00 },
        { "status": "won", "count": 2, "value": 450000.00 },
        { "status": "lost", "count": 0, "value": 0 },
        { "status": "rejected", "count": 0, "value": 0 },
        { "status": "expired", "count": 0, "value": 0 }
      ]
    },
    "revenue": {
      "ytd_closed_won": 450000.00,
      "tier_target": 1000000.00,
      "attainment_pct": 45.0
    },
    "deals": {
      "submitted": 3,
      "approved": 4,
      "rejected": 0,
      "expired": 0,
      "won": 2,
      "lost": 0,
      "total_active": 10
    },
    "leads": {
      "assigned": 5,
      "accepted": 3,
      "converted": 8,
      "disqualified": 1,
      "conversion_rate": 72.7,
      "avg_response_hours": 18.4
    },
    "mdf": {
      "current_quarter": {
        "fiscal_year": 2026,
        "fiscal_quarter": 1,
        "allocated": 25000.00,
        "requested": 15000.00,
        "approved": 12000.00,
        "claimed": 4000.00,
        "reimbursed": 4000.00,
        "remaining": 13000.00
      }
    },
    "certifications": {
      "total_certified": 5,
      "total_users": 8,
      "expiring_within_30_days": 1,
      "expiring_certs": [
        {
          "user_id": "uuid",
          "user_name": "John Smith",
          "course_name": "Firewall Essentials",
          "expires_at": "2026-04-15T00:00:00Z"
        }
      ]
    },
    "tier_progress": {
      "current_tier": {
        "id": "uuid",
        "name": "Gold",
        "rank": 3
      },
      "next_tier": {
        "id": "uuid",
        "name": "Platinum",
        "rank": 4,
        "requirements": {
          "min_annual_revenue": 1000000.00,
          "min_deals_closed": 20,
          "min_certified_reps": 5,
          "min_csat_score": 4.00
        }
      },
      "current_metrics": {
        "ytd_revenue": 450000.00,
        "ytd_deals_closed": 8,
        "certified_reps": 3,
        "csat_score": null
      },
      "gaps": {
        "revenue_needed": 550000.00,
        "deals_needed": 12,
        "certs_needed": 2,
        "csat_needed": null
      },
      "progress_pct": {
        "revenue": 45.0,
        "deals": 40.0,
        "certs": 60.0,
        "csat": null
      }
    },
    "recent_activity": [
      {
        "id": "uuid",
        "action": "submitted",
        "entity_type": "deal",
        "entity_id": "uuid",
        "summary": "John submitted Deal DR-2026-00042",
        "created_at": "2026-03-18T14:30:00Z"
      }
    ]
  },
  "meta": null,
  "errors": null
}
```

*Acceptance Criteria:*
- Given a `partner_admin` is authenticated, when they call `GET /dashboard/partner`, then they receive all sections populated with data scoped to their `organization_id`.
- Given a `partner_rep` is authenticated, when they call `GET /dashboard/partner`, then `pipeline`, `deals`, and `leads` sections reflect only their own deals (where `submitted_by = user.id`) and their own leads (where `assigned_user_id = user.id`). MDF, certifications, and tier_progress remain org-wide.
- Given an org with no deals, leads, or MDF, when the dashboard is requested, then all numeric values are `0` or `0.00`, arrays are empty `[]`, percentages are `0.0`, and `conversion_rate` is `0.0` (not `NaN` or `null`).
- Given a `partner_admin` at the highest tier (no next tier exists), when the dashboard is requested, then `next_tier` is `null` and `gaps` is `null` — the `progress_pct` object shows `100.0` for all metrics.
- Given the org has no MDF allocation for the current quarter, when the dashboard is requested, then `mdf.current_quarter` has `allocated: 0`, `remaining: 0`, and all sub-fields `0.00`.
- Given an `admin` or `channel_manager` calls this endpoint, then they receive `403 AUTH_INSUFFICIENT_ROLE`.

*SQL query hints:*
```sql
-- Pipeline: single query with GROUP BY status
SELECT status, COUNT(*) as count, COALESCE(SUM(estimated_value), 0) as value
FROM deals
WHERE organization_id = $org_id
  AND status NOT IN ('draft')  -- or include draft depending on role
GROUP BY status;

-- Revenue: use denormalized ytd_revenue from organizations table for speed.
-- Cross-check with: SELECT COALESCE(SUM(actual_value), 0) FROM deals
--   WHERE organization_id = $org_id AND status = 'won'
--   AND EXTRACT(YEAR FROM actual_close_date) = EXTRACT(YEAR FROM NOW());

-- Tier target: JOIN partner_tiers WHERE rank = current_tier.rank + 1
--   to get min_annual_revenue as the target.

-- Leads conversion_rate = (converted / (converted + disqualified + accepted + assigned)) * 100
-- Avoid division by zero: CASE WHEN total = 0 THEN 0 ELSE ...

-- MDF: SUM from mdf_requests grouped by status, joined with mdf_allocations
-- for the current fiscal quarter.
--   Current quarter: EXTRACT(QUARTER FROM NOW()), EXTRACT(YEAR FROM NOW())

-- Certifications: COUNT from user_certifications
-- JOIN users ON user_certifications.user_id = users.id
-- WHERE users.organization_id = $org_id AND status = 'passed'
--   AND (expires_at IS NULL OR expires_at > NOW())

-- Tier progress gaps: simple arithmetic in application code after fetching
-- current_metrics and next_tier requirements.

-- Recent activity: SELECT * FROM activity_feed
-- WHERE organization_id = $org_id ORDER BY created_at DESC LIMIT 10
```

---

**FR-DB-002: Channel Manager Dashboard Endpoint** (P0)
`GET /api/v1/dashboard/channel-manager`

**Allowed roles:** `channel_manager`

**Data scoping:** All data filtered by organizations where `channel_manager_id = req.user.sub`.

**Query parameters:** None.

**Response schema:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "total_partners": 15,
      "active_partners": 14,
      "total_pipeline_value": 18500000.00,
      "total_ytd_revenue": 4200000.00,
      "total_active_deals": 67
    },
    "pending_approvals": {
      "total": 7,
      "deals": 3,
      "quotes": 2,
      "mdf_requests": 2
    },
    "partners": [
      {
        "organization_id": "uuid",
        "name": "Acme Networks",
        "tier": {
          "id": "uuid",
          "name": "Gold",
          "rank": 3,
          "color_hex": "#FFD700"
        },
        "status": "active",
        "pipeline_value": 2400000.00,
        "ytd_revenue": 450000.00,
        "active_deals": 10,
        "open_leads": 5,
        "certified_reps": 3,
        "total_reps": 8,
        "health_score": 78
      }
    ],
    "lead_metrics": {
      "total_unassigned": 12,
      "total_assigned_pending": 8,
      "avg_acceptance_hours": 22.5,
      "acceptance_rate_by_partner": [
        {
          "organization_id": "uuid",
          "name": "Acme Networks",
          "assigned": 10,
          "accepted": 8,
          "returned": 1,
          "acceptance_rate": 80.0,
          "avg_response_hours": 18.4
        }
      ]
    },
    "recent_activity": [
      {
        "id": "uuid",
        "action": "submitted",
        "entity_type": "deal",
        "entity_id": "uuid",
        "summary": "John at Acme submitted Deal DR-2026-00042",
        "created_at": "2026-03-18T14:30:00Z"
      }
    ]
  },
  "meta": null,
  "errors": null
}
```

**Health score calculation** (computed in the service layer, not stored):
```
health_score = weighted average of:
  - Revenue attainment vs tier target:   30% weight
  - Deal win rate (won / (won+lost)):    20% weight
  - Lead acceptance rate:                 15% weight
  - Lead avg response time vs SLA:       15% weight
  - Certification coverage (certified/total reps): 10% weight
  - MDF utilization (spent/allocated):   10% weight

Each sub-score is 0-100. If a metric has no data (e.g., no leads ever assigned),
that weight is redistributed equally across other metrics.
```

*Acceptance Criteria:*
- Given a `channel_manager` with 15 assigned partners, when they call the endpoint, then `partners` array contains 15 objects sorted by `health_score` ascending (worst first for attention prioritization).
- Given a `channel_manager` with 0 assigned partners, when they call the endpoint, then `summary` values are all `0`, `partners` is `[]`, `pending_approvals.total` is `0`.
- Given pending approvals exist across deals, quotes, and MDF, when the endpoint is called, then `pending_approvals` counts reflect `approval_requests` where `assigned_to = req.user.sub` and `action IS NULL` (undecided).
- Given a partner has never been assigned any leads, when computing `acceptance_rate_by_partner`, then that partner is included with `acceptance_rate: 0.0` and `avg_response_hours: null`.
- Given a non-`channel_manager` calls this endpoint, then they receive `403`.

*SQL query hints:*
```sql
-- Assigned orgs: SELECT id FROM organizations WHERE channel_manager_id = $user_id
-- Then use this list as a scope filter for all subsequent queries.

-- Pending approvals: Single query on approval_requests
SELECT entity_type, COUNT(*) as count
FROM approval_requests
WHERE assigned_to = $user_id AND action IS NULL
GROUP BY entity_type;

-- Partner list: Main query on organizations joined with aggregated metrics
-- Use subqueries or lateral joins for pipeline_value and active_deals:
SELECT o.id, o.name, o.status, o.ytd_revenue, o.certified_rep_count,
       pt.name as tier_name, pt.rank, pt.color_hex,
       COALESCE(d.pipeline_value, 0) as pipeline_value,
       COALESCE(d.active_deals, 0) as active_deals,
       COALESCE(l.open_leads, 0) as open_leads,
       (SELECT COUNT(*) FROM users WHERE organization_id = o.id AND is_active = true AND role IN ('partner_admin','partner_rep')) as total_reps
FROM organizations o
LEFT JOIN partner_tiers pt ON o.tier_id = pt.id
LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(estimated_value), 0) as pipeline_value,
           COUNT(*) as active_deals
    FROM deals WHERE organization_id = o.id
      AND status IN ('submitted','under_review','approved')
) d ON true
LEFT JOIN LATERAL (
    SELECT COUNT(*) as open_leads
    FROM leads WHERE assigned_org_id = o.id
      AND status IN ('assigned','accepted','contacted','qualified')
) l ON true
WHERE o.channel_manager_id = $user_id;

-- Lead metrics: Aggregated from leads table
-- Unassigned = WHERE status = 'new' (no org scope, CM sees all unassigned)
-- OR scope to leads that COULD be assigned to their partners
```

---

**FR-DB-003: Admin Dashboard Endpoint** (P0)
`GET /api/v1/dashboard/admin`

**Allowed roles:** `admin`

**Data scoping:** Global — no organization filter.

**Query parameters:** None.

**Response schema:**
```json
{
  "success": true,
  "data": {
    "program_metrics": {
      "total_partners": 142,
      "active_partners": 128,
      "total_pipeline_value": 48000000.00,
      "total_ytd_revenue": 12500000.00,
      "total_active_deals": 340,
      "total_active_leads": 89,
      "total_active_quotes": 56
    },
    "tier_distribution": [
      { "tier_id": "uuid", "tier_name": "Registered", "rank": 1, "color_hex": "#94A3B8", "partner_count": 52 },
      { "tier_id": "uuid", "tier_name": "Silver", "rank": 2, "color_hex": "#C0C0C0", "partner_count": 48 },
      { "tier_id": "uuid", "tier_name": "Gold", "rank": 3, "color_hex": "#FFD700", "partner_count": 34 },
      { "tier_id": "uuid", "tier_name": "Platinum", "rank": 4, "color_hex": "#E5E4E2", "partner_count": 8 }
    ],
    "mdf_utilization": {
      "total_allocated": 500000.00,
      "total_approved": 320000.00,
      "total_spent": 185000.00,
      "total_remaining": 315000.00,
      "utilization_pct": 37.0
    },
    "certification_coverage": {
      "total_certified_users": 180,
      "total_partner_users": 420,
      "overall_pct": 42.9,
      "by_tier": [
        {
          "tier_id": "uuid",
          "tier_name": "Gold",
          "required_certs": 3,
          "partners_meeting_requirement": 28,
          "partners_total": 34,
          "coverage_pct": 82.4
        }
      ]
    },
    "top_partners": {
      "by_revenue": [
        { "organization_id": "uuid", "name": "Acme Networks", "tier_name": "Platinum", "ytd_revenue": 2100000.00 }
      ],
      "by_deal_count": [
        { "organization_id": "uuid", "name": "Acme Networks", "tier_name": "Platinum", "deal_count": 24 }
      ],
      "by_lead_conversion": [
        { "organization_id": "uuid", "name": "Beta Systems", "tier_name": "Gold", "conversion_rate": 85.0 }
      ]
    },
    "pending_approvals": {
      "total": 23,
      "deals": 12,
      "quotes": 6,
      "mdf_requests": 5
    },
    "recent_activity": [
      {
        "id": "uuid",
        "action": "approved",
        "entity_type": "deal",
        "entity_id": "uuid",
        "summary": "Marcus approved Deal DR-2026-00038",
        "created_at": "2026-03-18T16:00:00Z"
      }
    ]
  },
  "meta": null,
  "errors": null
}
```

*Acceptance Criteria:*
- Given the platform has 142 organizations, when admin calls the endpoint, then `program_metrics.total_partners` is `142` and `active_partners` counts only those with `status = 'active'`.
- Given tier distribution is requested, then every tier in `partner_tiers` is included even if its count is `0`.
- Given MDF utilization is computed, then `total_allocated` sums all `mdf_allocations` for the current fiscal year, `total_spent` sums `spent_amount`, and `utilization_pct = (total_spent / total_allocated) * 100`. If `total_allocated = 0`, then `utilization_pct = 0.0`.
- Given `top_partners` lists, then each list contains the top 10 partners sorted descending by the respective metric. Only `active` orgs are included.
- Given certification coverage by tier, then `required_certs` is derived from `partner_tiers.min_certified_reps`, and `partners_meeting_requirement` counts orgs at that tier where `certified_rep_count >= min_certified_reps`.
- Given `pending_approvals`, then it counts all `approval_requests` where `action IS NULL` across the entire program (not scoped to a single user).
- Given a non-`admin` calls this endpoint, then they receive `403`.

*SQL query hints:*
```sql
-- Program metrics: Multiple simple COUNT/SUM queries, or a single query with CTEs
WITH org_counts AS (
    SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'active') as active
    FROM organizations
),
deal_stats AS (
    SELECT COALESCE(SUM(estimated_value), 0) as pipeline,
           COUNT(*) as active_deals
    FROM deals WHERE status IN ('submitted','under_review','approved')
),
revenue AS (
    SELECT COALESCE(SUM(actual_value), 0) as ytd
    FROM deals WHERE status = 'won'
      AND EXTRACT(YEAR FROM actual_close_date) = EXTRACT(YEAR FROM NOW())
)
SELECT * FROM org_counts, deal_stats, revenue;

-- Tier distribution: LEFT JOIN ensures tiers with 0 partners appear
SELECT pt.id, pt.name, pt.rank, pt.color_hex,
       COUNT(o.id) as partner_count
FROM partner_tiers pt
LEFT JOIN organizations o ON o.tier_id = pt.id AND o.status = 'active'
GROUP BY pt.id, pt.name, pt.rank, pt.color_hex
ORDER BY pt.rank;

-- Top partners: Use window functions or simple ORDER BY + LIMIT 10
-- For lead_conversion: avoid including orgs with < 5 total leads to prevent
--   noise from 1/1 = 100% conversion.
```

---

### 6.2 Analytics Endpoints — Backend

---

**FR-AN-001: Pipeline Analytics** (P0)
`GET /api/v1/analytics/pipeline`

**Allowed roles:** `admin`, `channel_manager`

**Data scoping:** Admin sees all; channel_manager scoped to assigned orgs.

**Query parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `start_date` | ISO date | First day of current year | Filter deals by `created_at >= start_date` |
| `end_date` | ISO date | Today | Filter deals by `created_at <= end_date` |
| `org_id` | UUID | (all) | Filter to a specific organization |
| `product_id` | UUID | (all) | Filter to a specific product |
| `group_by` | enum | `status` | One of: `status`, `organization`, `product`, `month` |

**Response schema:**
```json
{
  "success": true,
  "data": {
    "total_pipeline_value": 48000000.00,
    "total_deal_count": 340,
    "groups": [
      {
        "key": "submitted",
        "label": "Submitted",
        "deal_count": 85,
        "total_value": 12000000.00,
        "avg_value": 141176.47,
        "avg_win_probability": 35
      }
    ],
    "trend": [
      {
        "period": "2026-01",
        "deal_count": 28,
        "total_value": 4200000.00
      }
    ]
  },
  "meta": null,
  "errors": null
}
```

*Acceptance Criteria:*
- Given `group_by=status`, then `groups` contains one entry per `deal_status` enum value that has at least 1 deal.
- Given `group_by=organization`, then `groups` are keyed by `organization_id` with `label` = org name, sorted by `total_value` descending.
- Given `group_by=product`, then `groups` are keyed by `primary_product_id` with `label` = product name. Deals with no product are grouped under key `"unassigned"`.
- Given `group_by=month`, then `groups` are keyed by `"YYYY-MM"`, covering every month in the `start_date` to `end_date` range (including months with 0 deals).
- Given no `start_date` or `end_date`, then defaults to current calendar year (Jan 1 to today).
- The `trend` array always returns monthly data regardless of `group_by`, enabling a line chart overlay.
- Given a channel_manager with 0 assigned orgs, then `groups` is `[]` and totals are `0`.

---

**FR-AN-002: Partner Performance Analytics** (P0)
`GET /api/v1/analytics/partner-performance`

**Allowed roles:** `admin`, `channel_manager`

**Data scoping:** Admin sees all; channel_manager scoped to assigned orgs.

**Query parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `org_id` | UUID | (all) | Single partner scorecard |
| `tier_id` | UUID | (all) | Filter by tier |
| `sort_by` | enum | `revenue` | One of: `revenue`, `deal_count`, `win_rate`, `lead_conversion`, `health_score` |
| `sort_order` | enum | `desc` | `asc` or `desc` |
| `limit` | int | 25 | Max results |
| `offset` | int | 0 | Pagination offset |

**Response schema:**
```json
{
  "success": true,
  "data": {
    "partners": [
      {
        "organization_id": "uuid",
        "name": "Acme Networks",
        "tier": { "id": "uuid", "name": "Gold", "rank": 3 },
        "metrics": {
          "ytd_revenue": 450000.00,
          "revenue_attainment_pct": 45.0,
          "total_deals": 18,
          "won_deals": 8,
          "lost_deals": 3,
          "win_rate": 72.7,
          "avg_deal_size": 56250.00,
          "avg_deal_cycle_days": 42,
          "total_leads_assigned": 20,
          "leads_converted": 8,
          "lead_conversion_rate": 40.0,
          "avg_lead_response_hours": 18.4,
          "sla_compliance_pct": 90.0,
          "mdf_allocated": 25000.00,
          "mdf_spent": 12000.00,
          "mdf_utilization_pct": 48.0,
          "certified_reps": 3,
          "total_reps": 8,
          "cert_coverage_pct": 37.5,
          "health_score": 78
        }
      }
    ],
    "total": 142
  },
  "meta": { "limit": 25, "offset": 0, "total": 142 },
  "errors": null
}
```

*Acceptance Criteria:*
- Given `org_id` is provided, then `partners` array contains exactly 1 entry (or 404 if not found / not in scope).
- Given `sort_by=win_rate`, then partners are sorted by `win_rate` descending. Partners with fewer than 3 closed deals (won + lost) have `win_rate: null` and sort last.
- Given `avg_deal_cycle_days`, then it is calculated as `AVG(actual_close_date - created_at)` for deals with `status IN ('won', 'lost')` and `actual_close_date IS NOT NULL`.
- Given `sla_compliance_pct`, then it is calculated as the percentage of leads where `accepted_at <= sla_deadline` out of all leads with `sla_deadline IS NOT NULL`.
- Given a new org with no data, then all numeric metrics are `0` or `0.0`, and `win_rate` is `null`.

---

**FR-AN-003: Lead Conversion Analytics** (P1)
`GET /api/v1/analytics/lead-conversion`

**Allowed roles:** `admin`, `channel_manager`

**Data scoping:** Admin sees all; channel_manager scoped to assigned orgs.

**Query parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `start_date` | ISO date | 90 days ago | Lead `created_at >= start_date` |
| `end_date` | ISO date | Today | Lead `created_at <= end_date` |
| `org_id` | UUID | (all) | Filter to specific org |
| `source` | string | (all) | Filter by lead source |

**Response schema:**
```json
{
  "success": true,
  "data": {
    "funnel": [
      { "stage": "new", "count": 100, "pct_of_total": 100.0 },
      { "stage": "assigned", "count": 88, "pct_of_total": 88.0 },
      { "stage": "accepted", "count": 72, "pct_of_total": 72.0 },
      { "stage": "contacted", "count": 65, "pct_of_total": 65.0 },
      { "stage": "qualified", "count": 40, "pct_of_total": 40.0 },
      { "stage": "converted", "count": 28, "pct_of_total": 28.0 }
    ],
    "drop_off": [
      { "from": "assigned", "to": "returned", "count": 8 },
      { "from": "contacted", "to": "disqualified", "count": 12 }
    ],
    "by_source": [
      {
        "source": "marketing",
        "total": 50,
        "converted": 18,
        "conversion_rate": 36.0
      }
    ],
    "avg_time_between_stages": {
      "new_to_assigned_hours": 4.2,
      "assigned_to_accepted_hours": 18.4,
      "accepted_to_converted_days": 14.3
    },
    "trend": [
      {
        "period": "2026-01",
        "new": 35,
        "converted": 10,
        "conversion_rate": 28.6
      }
    ]
  },
  "meta": null,
  "errors": null
}
```

*Acceptance Criteria:*
- Given `funnel`, then stages are ordered by the lead lifecycle: `new -> assigned -> accepted -> contacted -> qualified -> converted`. The count for each stage is the number of leads that *reached* that stage (i.e., leads in `converted` status are also counted in all prior stages).
- Given `drop_off`, then it shows leads that exited the funnel at each stage (`returned` from `assigned`, `disqualified` from any stage).
- Given `by_source`, then each unique `source` value in the date range gets an entry, sorted by `conversion_rate` descending.
- Given `avg_time_between_stages`, then times are calculated from timestamp fields: `created_at` to `assigned_at`, `assigned_at` to `accepted_at`, `accepted_at` to `converted_at`. If a transition has no data, the value is `null`.
- Given no leads exist in the date range, then `funnel` entries all have `count: 0`, `drop_off` is `[]`, `by_source` is `[]`.

---

**FR-AN-004: MDF ROI Analytics** (P1)
`GET /api/v1/analytics/mdf-roi`

**Allowed roles:** `admin`, `channel_manager`

**Data scoping:** Admin sees all; channel_manager scoped to assigned orgs.

**Query parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `fiscal_year` | int | Current year | Filter by fiscal year |
| `fiscal_quarter` | int | (all) | Filter by quarter (1-4) |
| `org_id` | UUID | (all) | Filter to specific org |
| `activity_type` | enum | (all) | Filter by MDF activity type |

**Response schema:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "total_allocated": 500000.00,
      "total_approved": 320000.00,
      "total_claimed": 185000.00,
      "total_reimbursed": 160000.00,
      "associated_revenue": 4800000.00,
      "roi_ratio": 30.0
    },
    "by_activity_type": [
      {
        "activity_type": "event",
        "request_count": 24,
        "total_approved": 120000.00,
        "total_reimbursed": 95000.00,
        "associated_revenue": 2100000.00,
        "roi_ratio": 22.1
      }
    ],
    "by_quarter": [
      {
        "fiscal_year": 2026,
        "fiscal_quarter": 1,
        "allocated": 125000.00,
        "approved": 98000.00,
        "reimbursed": 45000.00,
        "associated_revenue": 1200000.00,
        "roi_ratio": 26.7
      }
    ],
    "by_partner": [
      {
        "organization_id": "uuid",
        "name": "Acme Networks",
        "tier_name": "Gold",
        "total_allocated": 25000.00,
        "total_reimbursed": 12000.00,
        "associated_revenue": 450000.00,
        "roi_ratio": 37.5
      }
    ]
  },
  "meta": null,
  "errors": null
}
```

**ROI calculation:**
```
roi_ratio = associated_revenue / total_reimbursed

"associated_revenue" = SUM(deals.actual_value)
  WHERE deals.organization_id = mdf_requests.organization_id
    AND deals.status = 'won'
    AND deals.actual_close_date BETWEEN mdf_request.start_date AND mdf_request.end_date + INTERVAL '90 days'

This is a *correlation*, not causation. The 90-day window after activity end captures
deals that may have been influenced by the marketing activity.
```

*Acceptance Criteria:*
- Given `roi_ratio`, then it is computed as `associated_revenue / total_reimbursed`. If `total_reimbursed = 0`, then `roi_ratio` is `null` (not Infinity or NaN).
- Given `by_activity_type`, then every `mdf_activity_type` enum value with at least 1 request is included.
- Given `by_partner`, then partners are sorted by `roi_ratio` descending, with `null` ROI values last. Only partners with at least 1 reimbursed MDF request are included.
- Given `fiscal_quarter` is provided, then `by_quarter` contains only that quarter. If omitted, all quarters of the fiscal year are included.
- Given a channel_manager, then `by_partner` only includes their assigned orgs.

---

### 6.3 Frontend — Dashboard Pages

---

**FR-FE-001: Dashboard Route Splitting** (P0)
Replace the current `DashboardPage.tsx` with a role-routing wrapper.

```typescript
// DashboardPage.tsx — becomes a thin router
export function DashboardPage() {
  const { user } = useAuth();
  switch (user?.role) {
    case 'admin':
      return <AdminDashboard />;
    case 'channel_manager':
      return <ChannelManagerDashboard />;
    case 'partner_admin':
    case 'partner_rep':
    default:
      return <PartnerDashboard />;
  }
}
```

*Acceptance Criteria:*
- Given the user is an admin, when they navigate to `/`, then they see the admin dashboard.
- Given the user is a channel_manager, when they navigate to `/`, then they see the channel manager dashboard.
- Given the user is a partner_admin or partner_rep, when they navigate to `/`, then they see the partner dashboard.
- Given a data-loading state, then each dashboard shows skeleton placeholders (not hardcoded zeros).

---

**FR-FE-002: Partner Dashboard Page** (P0)
File: `client/src/pages/dashboard/PartnerDashboard.tsx`

**Layout (top to bottom):**

| Row | Content | Chart Type |
|-----|---------|------------|
| 1 | PageHeader: "Welcome back, {first_name}" + subtitle | — |
| 2 | 4x StatCards: Pipeline Value, Active Deals, Open Leads, MDF Remaining | — |
| 3-left | Deal Status Breakdown | **PieChart** (donut) — 1 slice per status with count labels |
| 3-right | Revenue vs Tier Target | **RadialBarChart** (gauge) — single bar showing attainment_pct, label showing "$450K / $1M" |
| 4-left | Lead Performance | **BarChart** — grouped bars: assigned, accepted, converted, disqualified |
| 4-right | MDF Balance | **PieChart** (donut) — slices: approved, claimed, remaining |
| 5 | Tier Progress | **ProgressBar** (custom) — one bar per metric (revenue, deals, certs) showing current vs target |
| 6-left | Expiring Certifications | Table: user name, course, expires_at, days remaining |
| 6-right | Recent Activity | List of activity_feed entries (max 10) |

**Quick Actions** (preserved from existing page, now functional):
- "Register a Deal" -> navigates to `/deals/new`
- "Create a Quote" -> navigates to `/quotes/new`
- "View Training" -> navigates to `/training`

**Data fetching:**
```typescript
// client/src/api/dashboard.ts
export function usePartnerDashboard() {
  return useQuery({
    queryKey: ['dashboard', 'partner'],
    queryFn: () => client.get('/dashboard/partner').then(r => r.data.data),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
  });
}
```

*Acceptance Criteria:*
- Given the API returns data, then all 4 stat cards display formatted values (e.g., "$2.4M" not "2400000").
- Given the deals donut chart, then each slice uses a consistent color palette: draft=gray, submitted=blue, under_review=yellow, approved=green, won=emerald, lost=red, rejected=orange, expired=slate.
- Given the tier progress section, then each progress bar shows the percentage label and "X / Y" text (e.g., "3 / 5 certified reps").
- Given a `partner_rep`, then the stat cards and charts reflect only their personal metrics (not the full org).
- Given loading state, then skeleton placeholders are shown for all sections.
- Given an API error, then an error banner is shown with a "Retry" button.
- Given the MDF donut chart and `remaining = 0`, then the donut shows a full circle of spent+claimed with no "remaining" slice.

---

**FR-FE-003: Channel Manager Dashboard Page** (P0)
File: `client/src/pages/dashboard/ChannelManagerDashboard.tsx`

**Layout:**

| Row | Content | Chart Type |
|-----|---------|------------|
| 1 | PageHeader: "Portfolio Overview" | — |
| 2 | 4x StatCards: Total Partners, Total Pipeline, Pending Approvals, Unassigned Leads | — |
| 3 | Pending Approvals Banner (if > 0): "You have 7 items awaiting review" with link to approval queue | — |
| 4 | Partner Portfolio Table | Sortable table with columns: Partner Name, Tier (badge), Pipeline Value, YTD Revenue, Active Deals, Health Score (color-coded), Actions (view) |
| 5-left | Lead Acceptance by Partner | **BarChart** — horizontal bars per partner showing acceptance_rate |
| 5-right | Pipeline by Partner | **BarChart** — stacked bars per partner showing value by deal status |

**Partner table details:**
- Sortable by any column (client-side sort since max ~50 partners per CM)
- Health score color coding: 0-40 = red, 41-60 = yellow, 61-80 = blue, 81-100 = green
- Click partner name to navigate to `/organizations/{id}`
- Click pending approvals count to navigate to `/approvals`

*Acceptance Criteria:*
- Given 15 partners, when the table renders, then all 15 are visible (no pagination needed for typical CM portfolio sizes; add client-side pagination if > 25).
- Given health_score = 35, then the score cell has a red background tint.
- Given pending_approvals.total > 0, then the yellow approval banner is visible at the top of the content area.
- Given 0 assigned partners, then a zero-state illustration is shown: "No partners assigned to you yet."

---

**FR-FE-004: Admin Dashboard Page** (P0)
File: `client/src/pages/dashboard/AdminDashboard.tsx`

**Layout:**

| Row | Content | Chart Type |
|-----|---------|------------|
| 1 | PageHeader: "Program Dashboard" | — |
| 2 | 5x StatCards: Total Partners, Active Pipeline, YTD Revenue, Active Deals, Pending Approvals | — |
| 3-left | Tier Distribution | **BarChart** — vertical bars, one per tier, using tier `color_hex` |
| 3-right | MDF Utilization | **PieChart** (donut) — slices: spent, remaining |
| 4 | Certification Coverage by Tier | **BarChart** — grouped: partners meeting req vs total, per tier |
| 5 | Top Partners (tabs: By Revenue, By Deal Count, By Lead Conversion) | Table with rank, partner name, tier badge, metric value |

*Acceptance Criteria:*
- Given tier distribution bar chart, then bars use the `color_hex` from the tier data (e.g., Gold = #FFD700).
- Given top partners tabs, then switching tabs re-sorts the table without a new API call (all 3 lists are in the initial payload).
- Given MDF utilization donut, then the center label shows `"37% utilized"`.
- Given 0 partners in the system, then all charts show empty states with descriptive messages.

---

**FR-FE-005: Analytics Pages** (P1)
Files:
- `client/src/pages/analytics/PipelineAnalytics.tsx`
- `client/src/pages/analytics/PartnerPerformanceAnalytics.tsx`
- `client/src/pages/analytics/LeadConversionAnalytics.tsx`
- `client/src/pages/analytics/MdfRoiAnalytics.tsx`

Route: `/analytics/pipeline`, `/analytics/partner-performance`, `/analytics/lead-conversion`, `/analytics/mdf-roi`

**Allowed roles:** `admin`, `channel_manager`

Each analytics page follows a common layout:
1. PageHeader with title
2. Filter bar: date range picker, org selector dropdown (admin only), additional context-specific filters
3. Summary stat cards (3-5 cards)
4. Primary chart (large, full-width)
5. Secondary chart or data table

**Filter behavior:**
- Changing any filter triggers a new API call with updated query params.
- Filters are reflected in the URL query string for shareability.
- Date range defaults: Pipeline = YTD, Lead Conversion = last 90 days, MDF ROI = current fiscal year.

*Acceptance Criteria:*
- Given a channel_manager, then the org filter dropdown only shows their assigned orgs.
- Given an admin, then the org filter dropdown shows all active orgs with search/typeahead.
- Given date range filters are changed, then the charts update within 3 seconds.
- Given a URL with query params (e.g., `?org_id=xxx&start_date=2026-01-01`), then the page initializes with those filters applied.

---

### 6.4 Shared Chart Components

---

**FR-FE-006: Reusable Chart Components** (P0)
Directory: `client/src/components/charts/`

| Component | Recharts Base | Props |
|-----------|--------------|-------|
| `DashboardBarChart` | `BarChart` | `data`, `xKey`, `bars: {dataKey, color, label}[]`, `stacked?: boolean`, `horizontal?: boolean` |
| `DashboardPieChart` | `PieChart` | `data`, `nameKey`, `valueKey`, `colors: string[]`, `donut?: boolean`, `centerLabel?: string` |
| `DashboardGauge` | `RadialBarChart` | `value: number`, `max: number`, `label: string`, `color: string` |
| `DashboardLineChart` | `LineChart` | `data`, `xKey`, `lines: {dataKey, color, label}[]` |
| `TierProgressBar` | Custom div | `metrics: {label, current, target, unit}[]` |
| `StatCard` | N/A (existing) | Update existing `StatCard` to accept `loading?: boolean` for skeleton state |

All chart components must:
- Accept a `loading` prop that renders a skeleton placeholder.
- Accept an `empty` prop or detect empty data and render a centered "No data available" message.
- Be responsive (use `ResponsiveContainer` from Recharts).
- Include accessible `aria-label` on the chart container.
- Use a consistent color palette defined in a shared `chartColors.ts` constants file.

*Acceptance Criteria:*
- Given `loading=true`, then the chart area shows an animated gray skeleton box matching the chart dimensions.
- Given `data=[]`, then a "No data available" message is centered in the chart area.
- Given a window resize, then charts reflow to fill their container without overflow or clipping.

---

### 6.5 Backend Implementation Files

---

**FR-BE-001: Backend File Structure** (P0)

Create the following files following existing codebase patterns:

```
src/
  routes/dashboard.routes.ts        — 3 dashboard + 4 analytics routes
  controllers/dashboard.controller.ts — thin controller, delegates to service
  services/dashboard.service.ts     — aggregation queries, health score calc
  repositories/dashboard.repository.ts — raw SQL/Knex queries
  validators/dashboard.validator.ts — Joi schemas for analytics query params
```

**Route registration** (in `src/routes/index.ts` or equivalent):
```typescript
router.use('/dashboard', authenticate, dashboardRoutes);
router.use('/analytics', authenticate, authorize('admin', 'channel_manager'), analyticsRoutes);
```

**Route definitions:**
```typescript
// dashboard.routes.ts
router.get('/partner', authorize('partner_admin', 'partner_rep'), scopeToOrg, controller.getPartnerDashboard);
router.get('/channel-manager', authorize('channel_manager'), controller.getChannelManagerDashboard);
router.get('/admin', authorize('admin'), controller.getAdminDashboard);
router.get('/analytics/pipeline', validate(pipelineSchema, 'query'), scopeToOrg, controller.getPipelineAnalytics);
router.get('/analytics/partner-performance', validate(partnerPerformanceSchema, 'query'), scopeToOrg, controller.getPartnerPerformance);
router.get('/analytics/lead-conversion', validate(leadConversionSchema, 'query'), scopeToOrg, controller.getLeadConversion);
router.get('/analytics/mdf-roi', validate(mdfRoiSchema, 'query'), scopeToOrg, controller.getMdfRoi);
```

*Acceptance Criteria:*
- Given the file structure, then each file follows the existing pattern: repository handles SQL, service handles business logic (health score, gap calculations, ROI), controller parses request and calls service.
- Given the route definitions, then each route has appropriate `authorize` and `scopeToOrg` middleware.
- Given analytics query params, then they are validated by Joi schemas (dates are valid ISO strings, UUIDs are valid, enums are checked).

---

## 7. Non-Functional Requirements

### Performance
- **NFR-PERF-001**: Dashboard endpoints must respond within 2 seconds at p95 with 200 concurrent users and 10,000 deals in the database.
- **NFR-PERF-002**: Analytics endpoints must respond within 3 seconds at p95 with 200 concurrent users and 50,000 deals in the database.
- **NFR-PERF-003**: All aggregation queries should use the existing indexes. No full table scans. Use `EXPLAIN ANALYZE` to verify query plans during development.
- **NFR-PERF-004**: The partner dashboard should execute no more than 8 SQL queries (pipeline, revenue, deals, leads, MDF allocation, MDF requests, certifications, tier+next_tier, activity). Combine where possible using CTEs.

### Security
- **NFR-SEC-001**: All endpoints must pass through `authenticate` middleware (JWT verification).
- **NFR-SEC-002**: Role checks must use `authorize()` middleware, not in-service checks.
- **NFR-SEC-003**: Organization scoping must use `scopeToOrg` middleware. A partner must never see another org's data, even via analytics query params.
- **NFR-SEC-004**: Analytics `org_id` query param must be validated: for `channel_manager`, the org must be in their assigned set. For `partner_admin`/`partner_rep`, the param is ignored (always scoped to own org).

### Reliability
- **NFR-REL-001**: If any sub-query within a dashboard endpoint fails, return partial data with a `warnings` array indicating which section failed. Do not return 500 for one failed subsection.
- **NFR-REL-002**: All division operations must guard against division by zero. Return `0.0` for percentages, `null` for ratios.

### Maintainability
- **NFR-MAINT-001**: Dashboard repository methods should be individually unit-testable with mock `knex` instances.
- **NFR-MAINT-002**: Health score weights should be defined as constants in `src/config/constants.ts`, not hardcoded in the service.

---

## 8. Technical Architecture

### System Flow
```
                                       ┌─────────────────────┐
                                       │   React SPA (Vite)  │
                                       │                     │
                                       │  DashboardPage.tsx   │
                                       │    ├─ PartnerDash    │
                                       │    ├─ CMDash         │
                                       │    └─ AdminDash      │
                                       │                     │
                                       │  Analytics Pages     │
                                       │    ├─ Pipeline       │
                                       │    ├─ Performance    │
                                       │    ├─ LeadConv       │
                                       │    └─ MdfRoi         │
                                       └──────────┬──────────┘
                                                  │
                                        GET /api/v1/dashboard/*
                                        GET /api/v1/analytics/*
                                                  │
                                       ┌──────────▼──────────┐
                                       │   Express API       │
                                       │                     │
                                       │  authenticate       │
                                       │  → authorize        │
                                       │  → scopeToOrg       │
                                       │  → validate (analytics)│
                                       │  → controller       │
                                       │  → service          │
                                       │  → repository       │
                                       └──────────┬──────────┘
                                                  │
                              ┌────────────────────┼────────────────────┐
                              │                    │                    │
                    ┌─────────▼──────┐   ┌────────▼────────┐  ┌──────▼──────┐
                    │  deals         │   │  leads           │  │  mdf_*      │
                    │  quotes        │   │  user_certs      │  │  orgs       │
                    │  deal_products │   │  courses         │  │  tiers      │
                    │  approval_reqs │   │  activity_feed   │  │  users      │
                    └────────────────┘   └─────────────────┘  └─────────────┘
                                      PostgreSQL
```

### Data Flow per Dashboard Endpoint

**Partner Dashboard:**
```
1. authenticate → verify JWT, extract user.sub, user.org_id, user.role
2. authorize('partner_admin','partner_rep') → role check
3. scopeToOrg → set req.orgScope = { organization_id: user.org_id }
4. controller.getPartnerDashboard(req, res, next)
5. service.getPartnerDashboard(orgId, userId, role)
   ├── repo.getPipelineSummary(orgId, userId?)       → deals
   ├── repo.getRevenueSummary(orgId)                 → organizations + deals
   ├── repo.getDealStatusCounts(orgId, userId?)      → deals
   ├── repo.getLeadMetrics(orgId, userId?)           → leads
   ├── repo.getMdfSummary(orgId)                     → mdf_allocations + mdf_requests
   ├── repo.getCertificationSummary(orgId)           → user_certifications + users
   ├── repo.getTierProgress(orgId)                   → organizations + partner_tiers
   └── repo.getRecentActivity(orgId, limit=10)       → activity_feed
6. service assembles response, computes gaps/progress_pct
7. controller sends via sendSuccess(res, data)
```

### Technology Choices
| Layer | Technology | Notes |
|-------|-----------|-------|
| Charts | Recharts 2.x | Already installed. Use `ResponsiveContainer`, `PieChart`, `BarChart`, `RadialBarChart`, `LineChart` |
| Data fetching | TanStack Query | Already installed. Use `useQuery` with `staleTime: 5min` |
| Number formatting | Intl.NumberFormat | Built-in. Format currency as "$2.4M", percentages as "45.0%" |
| Skeleton loading | Tailwind `animate-pulse` | Match existing patterns in codebase |
| Date handling | Native `Date` + query param serialization | No additional library needed |

---

## 9. Implementation Phases

### Phase 6A: Backend Foundation (Estimated: 5-8 hours of AI work)

**Objectives:**
- Create all backend files (routes, controller, service, repository, validators)
- Implement the 3 dashboard endpoints with full data aggregation
- Implement data scoping for all roles

**Deliverables:**
- `src/routes/dashboard.routes.ts`
- `src/controllers/dashboard.controller.ts`
- `src/services/dashboard.service.ts`
- `src/repositories/dashboard.repository.ts`
- `src/validators/dashboard.validator.ts`
- Route registered in main app
- All 3 dashboard endpoints returning correct data

**Sub-phases (sequential, dependency-ordered):**

| # | Task | Est. Time | Dependencies |
|---|------|-----------|-------------|
| 6A-1 | Create `dashboard.repository.ts` with all query methods (pipeline, revenue, deals, leads, MDF, certs, tier, activity, health score sub-queries, pending approvals, tier distribution, MDF utilization, cert coverage, top partners) | 15 min | None |
| 6A-2 | Create `dashboard.service.ts` with `getPartnerDashboard`, `getChannelManagerDashboard`, `getAdminDashboard` that call repository and assemble response shapes. Implement health score calculation, tier gap computation, division-by-zero guards. | 15 min | 6A-1 |
| 6A-3 | Create `dashboard.controller.ts` with thin handlers that parse `req.user` and `req.orgScope`, call service, and respond via `sendSuccess`. | 10 min | 6A-2 |
| 6A-4 | Create `dashboard.routes.ts` with route definitions, auth middleware, and register in main app. | 5 min | 6A-3 |
| 6A-5 | Manual testing / curl verification of all 3 endpoints with different role tokens. | 10 min | 6A-4 |

**Dependencies:** Phases 1-5 complete (all tables exist and are populated by seeds).

---

### Phase 6B: Analytics Endpoints (Estimated: 4-6 hours of AI work)

**Objectives:**
- Implement 4 analytics endpoints with query param validation
- Implement date range filtering and group-by logic

**Deliverables:**
- `src/validators/dashboard.validator.ts` extended with analytics schemas
- Repository methods for pipeline, performance, lead conversion, MDF ROI
- Service methods for analytics with filtering and aggregation
- Controller handlers for all 4 analytics endpoints

**Sub-phases:**

| # | Task | Est. Time | Dependencies |
|---|------|-----------|-------------|
| 6B-1 | Create Joi validation schemas for analytics query params in `dashboard.validator.ts`. | 5 min | 6A-4 |
| 6B-2 | Implement `getPipelineAnalytics` in repository (dynamic GROUP BY, monthly trend), service (response assembly), and controller. | 15 min | 6B-1 |
| 6B-3 | Implement `getPartnerPerformance` in repository (multi-metric aggregation per org), service (scoring, sorting), and controller. | 15 min | 6B-1 |
| 6B-4 | Implement `getLeadConversion` in repository (funnel counts, drop-off, by-source, timing), service, and controller. | 15 min | 6B-1 |
| 6B-5 | Implement `getMdfRoi` in repository (allocation/request aggregation, revenue correlation), service, and controller. | 15 min | 6B-1 |
| 6B-6 | Add analytics routes to `dashboard.routes.ts` with validation middleware. | 5 min | 6B-2 through 6B-5 |

**Dependencies:** Phase 6A complete.

---

### Phase 6C: Frontend Dashboard Pages (Estimated: 6-8 hours of AI work)

**Objectives:**
- Create shared chart components
- Replace placeholder DashboardPage with role-routing wrapper
- Build 3 dashboard pages

**Deliverables:**
- `client/src/components/charts/` directory with 6 chart components
- `client/src/api/dashboard.ts` with API hooks
- `client/src/pages/dashboard/PartnerDashboard.tsx`
- `client/src/pages/dashboard/ChannelManagerDashboard.tsx`
- `client/src/pages/dashboard/AdminDashboard.tsx`
- Updated `DashboardPage.tsx` as role router

**Sub-phases:**

| # | Task | Est. Time | Dependencies |
|---|------|-----------|-------------|
| 6C-1 | Create `client/src/components/charts/chartColors.ts` with the shared color palette and formatting utilities (currency, percentage, compact numbers). | 5 min | None |
| 6C-2 | Create `DashboardBarChart`, `DashboardPieChart`, `DashboardGauge`, `DashboardLineChart`, `TierProgressBar` chart components with loading/empty states. | 15 min | 6C-1 |
| 6C-3 | Create `client/src/api/dashboard.ts` with `usePartnerDashboard`, `useChannelManagerDashboard`, `useAdminDashboard` hooks using TanStack Query. | 5 min | None |
| 6C-4 | Create `PartnerDashboard.tsx` with full layout: stat cards, donut chart, gauge, bar chart, tier progress, certifications table, recent activity. | 15 min | 6C-2, 6C-3 |
| 6C-5 | Create `ChannelManagerDashboard.tsx` with portfolio table, approval banner, lead acceptance chart, pipeline-by-partner chart. | 15 min | 6C-2, 6C-3 |
| 6C-6 | Create `AdminDashboard.tsx` with program stats, tier distribution, MDF utilization, cert coverage, top partners tabs. | 15 min | 6C-2, 6C-3 |
| 6C-7 | Update `DashboardPage.tsx` to be a role-routing wrapper. Update `StatCard` with loading skeleton support. | 5 min | 6C-4 through 6C-6 |

**Dependencies:** Phase 6A complete (backend endpoints must return data). Can be developed in parallel with 6B using mock data, but final integration requires 6A.

---

### Phase 6D: Frontend Analytics Pages (Estimated: 4-6 hours of AI work)

**Objectives:**
- Build 4 analytics pages with filterable charts
- Wire up to analytics API endpoints

**Deliverables:**
- `client/src/pages/analytics/PipelineAnalytics.tsx`
- `client/src/pages/analytics/PartnerPerformanceAnalytics.tsx`
- `client/src/pages/analytics/LeadConversionAnalytics.tsx`
- `client/src/pages/analytics/MdfRoiAnalytics.tsx`
- Route registrations in React Router
- `client/src/api/dashboard.ts` extended with analytics hooks

**Sub-phases:**

| # | Task | Est. Time | Dependencies |
|---|------|-----------|-------------|
| 6D-1 | Create shared `AnalyticsFilterBar` component with date range, org selector, and slot for additional filters. | 10 min | 6C-1 |
| 6D-2 | Create `PipelineAnalytics.tsx` with group-by selector, main bar chart, trend line chart overlay. | 15 min | 6D-1, 6B-2 |
| 6D-3 | Create `PartnerPerformanceAnalytics.tsx` with sortable scorecard table and per-partner detail view. | 15 min | 6D-1, 6B-3 |
| 6D-4 | Create `LeadConversionAnalytics.tsx` with funnel chart, drop-off visualization, source breakdown. | 15 min | 6D-1, 6B-4 |
| 6D-5 | Create `MdfRoiAnalytics.tsx` with allocation vs spend chart, ROI by activity type, by-partner table. | 15 min | 6D-1, 6B-5 |
| 6D-6 | Register all analytics routes in React Router. Add analytics navigation links. | 5 min | 6D-2 through 6D-5 |

**Dependencies:** Phase 6B complete (analytics endpoints must return data). Phase 6C complete (shared chart components).

---

## 10. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Dashboard queries too slow with large datasets | Medium | High | Use existing denormalized fields (`ytd_revenue`, `ytd_deals_closed`, `certified_rep_count`) on organizations table. Verify with `EXPLAIN ANALYZE`. Add `staleTime` on frontend to reduce request frequency. |
| Health score calculation too subjective | Low | Medium | Define weights as configurable constants. Document the formula. Allow admin to adjust weights in a future phase. |
| Partner rep scoping is inconsistent across metrics | Medium | Medium | Centralize scoping logic: pass `userId` to repository only when `role === 'partner_rep'`. Service layer decides. Add integration tests for both roles. |
| MDF ROI "associated revenue" correlation is misleading | Medium | Low | Add a disclaimer in the UI: "Revenue correlated within 90 days of MDF activity. Not a causal measurement." |
| Empty-state edge cases cause NaN/null rendering | High | Medium | Implement `safeDivide` utility that returns 0 for percentage contexts and null for ratio contexts. Test every chart component with empty data. |
| Frontend bundle size increase from Recharts | Low | Low | Recharts is already installed. Tree-shaking ensures only used chart types are bundled. Monitor with `vite-plugin-visualizer`. |

---

## 11. Dependencies

### External Dependencies
- **Recharts** (already installed): Chart rendering.
- **TanStack Query** (already installed): Data fetching and caching.
- **Headless UI** (already installed): Dropdown filters on analytics pages.

### Internal Dependencies
- **Phases 1-5 complete**: All database tables must exist with seed data.
- **Seed data**: Dashboard demo requires realistic seed data across all modules. The existing seed files must include deals in various statuses, leads in various stages, MDF allocations/requests, and certifications.
- **`scopeToOrg` middleware**: Must correctly return assigned org IDs for channel_managers (verify this works before starting).
- **`approval_requests` table**: Pending approval counts depend on this table being populated when deals/quotes/MDF are submitted for review.

### Blocking Dependencies
- None. All data sources exist. No new tables or migrations needed.

### Non-Blocking Dependencies
- Redis caching (nice to have, not required).
- Seed data completeness (can be improved incrementally).

---

## 12. Edge Cases and Error Handling

### Empty Data Scenarios

| Scenario | Expected Behavior |
|----------|-------------------|
| New org with 0 deals, 0 leads, 0 MDF | All numeric fields = 0 or 0.00. Arrays = []. Percentages = 0.0. Charts show "No data" message. |
| Org at highest tier (no next tier) | `tier_progress.next_tier` = null, `gaps` = null, `progress_pct` = all 100.0 |
| Org with no MDF allocation for current quarter | `mdf.current_quarter` = all zeros. MDF donut shows empty state. |
| Channel manager with 0 assigned partners | All summary fields = 0. Partners array = []. Lead metrics = empty. |
| Platform with 0 organizations (fresh install) | Admin dashboard = all zeros. Tier distribution shows tiers with count 0. |
| Deal with `actual_value = NULL` (won but no value entered) | Exclude from revenue sums. Use `COALESCE(actual_value, estimated_value, 0)` as fallback. |
| Lead with no `sla_deadline` | Exclude from SLA compliance calculation. Do not count as "missed SLA". |
| MDF allocation exists but 0 requests | `mdf_utilization_pct` = 0.0 (not null). |

### Date Range Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| `start_date` > `end_date` | Return 422 validation error: "start_date must be before end_date" |
| `start_date` in the future | Valid request — return empty data (no deals created in the future). |
| No date params provided | Use endpoint-specific defaults (YTD for pipeline, 90d for leads, current fiscal year for MDF). |
| Date range spans multiple years | All data in range is included. Monthly trend shows all months. |

### Division by Zero Guards

All the following must return `0.0` (not NaN, not Infinity, not null) for percentage fields, and `null` for ratio fields:

```typescript
// Utility function in service layer
function safePct(numerator: number, denominator: number): number {
  if (denominator === 0) return 0.0;
  return Math.round((numerator / denominator) * 1000) / 10; // one decimal place
}

function safeRatio(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return Math.round((numerator / denominator) * 10) / 10; // one decimal place
}
```

---

## 13. Appendices

### A. Glossary

| Term | Definition |
|------|-----------|
| **Pipeline value** | Sum of `estimated_value` for deals in active statuses (submitted, under_review, approved). Does NOT include draft, won, lost, rejected, expired. |
| **YTD revenue** | Sum of `actual_value` for deals with `status = 'won'` and `actual_close_date` in the current calendar year. |
| **Tier target** | `min_annual_revenue` of the *next* tier above the org's current tier. If org is at highest tier, target = current tier's min. |
| **Attainment percentage** | `(ytd_revenue / tier_target) * 100`. Capped at 100.0 for display. |
| **Health score** | Weighted composite score (0-100) computed from 6 sub-metrics. See FR-DB-002 for formula. |
| **Win rate** | `won / (won + lost) * 100`. Requires minimum 3 closed deals to be meaningful. |
| **Lead conversion rate** | `converted / (total_leads_received) * 100` where total = all leads ever assigned to org (excluding `new` status). |
| **SLA compliance** | Percentage of leads where `accepted_at` (or `returned` timestamp) is before `sla_deadline`. |
| **MDF utilization** | `spent_amount / allocated_amount * 100`. |
| **ROI ratio** | `associated_revenue / total_reimbursed`. A correlation metric, not causal. |

### B. Color Palette for Charts

```typescript
// client/src/components/charts/chartColors.ts
export const DEAL_STATUS_COLORS: Record<string, string> = {
  draft: '#94A3B8',       // slate-400
  submitted: '#3B82F6',   // blue-500
  under_review: '#F59E0B',// amber-500
  approved: '#22C55E',    // green-500
  won: '#059669',         // emerald-600
  lost: '#EF4444',        // red-500
  rejected: '#F97316',    // orange-500
  expired: '#64748B',     // slate-500
};

export const MDF_COLORS = {
  approved: '#3B82F6',    // blue-500
  claimed: '#F59E0B',     // amber-500
  remaining: '#E2E8F0',   // slate-200
  reimbursed: '#22C55E',  // green-500
};

export const HEALTH_SCORE_COLORS = {
  critical: '#EF4444',    // 0-40
  warning: '#F59E0B',     // 41-60
  good: '#3B82F6',        // 61-80
  excellent: '#22C55E',   // 81-100
};
```

### C. Number Formatting Utilities

```typescript
// client/src/utils/formatters.ts
export function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export function formatPct(value: number | null): string {
  if (value === null || value === undefined) return 'N/A';
  return `${value.toFixed(1)}%`;
}

export function formatCompactNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toString();
}
```

### D. API Hook Templates

```typescript
// client/src/api/dashboard.ts
import { useQuery } from '@tanstack/react-query';
import client from './client';

// Dashboard hooks
export function usePartnerDashboard() {
  return useQuery({
    queryKey: ['dashboard', 'partner'],
    queryFn: () => client.get('/dashboard/partner').then(r => r.data.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useChannelManagerDashboard() {
  return useQuery({
    queryKey: ['dashboard', 'channel-manager'],
    queryFn: () => client.get('/dashboard/channel-manager').then(r => r.data.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAdminDashboard() {
  return useQuery({
    queryKey: ['dashboard', 'admin'],
    queryFn: () => client.get('/dashboard/admin').then(r => r.data.data),
    staleTime: 5 * 60 * 1000,
  });
}

// Analytics hooks
export function usePipelineAnalytics(params: {
  start_date?: string;
  end_date?: string;
  org_id?: string;
  product_id?: string;
  group_by?: string;
}) {
  return useQuery({
    queryKey: ['analytics', 'pipeline', params],
    queryFn: () => client.get('/analytics/pipeline', { params }).then(r => r.data.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function usePartnerPerformance(params: {
  org_id?: string;
  tier_id?: string;
  sort_by?: string;
  sort_order?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ['analytics', 'partner-performance', params],
    queryFn: () => client.get('/analytics/partner-performance', { params }).then(r => r.data.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useLeadConversion(params: {
  start_date?: string;
  end_date?: string;
  org_id?: string;
  source?: string;
}) {
  return useQuery({
    queryKey: ['analytics', 'lead-conversion', params],
    queryFn: () => client.get('/analytics/lead-conversion', { params }).then(r => r.data.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useMdfRoi(params: {
  fiscal_year?: number;
  fiscal_quarter?: number;
  org_id?: string;
  activity_type?: string;
}) {
  return useQuery({
    queryKey: ['analytics', 'mdf-roi', params],
    queryFn: () => client.get('/analytics/mdf-roi', { params }).then(r => r.data.data),
    staleTime: 5 * 60 * 1000,
  });
}
```

### E. Health Score Constants

```typescript
// src/config/constants.ts (append to existing file)
export const HEALTH_SCORE_WEIGHTS = {
  revenue_attainment: 0.30,
  deal_win_rate: 0.20,
  lead_acceptance_rate: 0.15,
  lead_response_time: 0.15,
  cert_coverage: 0.10,
  mdf_utilization: 0.10,
};

// Sub-score thresholds for normalizing to 0-100
export const HEALTH_SCORE_THRESHOLDS = {
  // lead_response_time: excellent = < 4 hours (score 100), poor = > 48 hours (score 0)
  lead_response_excellent_hours: 4,
  lead_response_poor_hours: 48,
};
```

### F. Validation Schemas

```typescript
// src/validators/dashboard.validator.ts
import Joi from 'joi';

export const pipelineAnalyticsSchema = Joi.object({
  start_date: Joi.date().iso().optional(),
  end_date: Joi.date().iso().min(Joi.ref('start_date')).optional(),
  org_id: Joi.string().uuid().optional(),
  product_id: Joi.string().uuid().optional(),
  group_by: Joi.string().valid('status', 'organization', 'product', 'month').default('status'),
});

export const partnerPerformanceSchema = Joi.object({
  org_id: Joi.string().uuid().optional(),
  tier_id: Joi.string().uuid().optional(),
  sort_by: Joi.string().valid('revenue', 'deal_count', 'win_rate', 'lead_conversion', 'health_score').default('revenue'),
  sort_order: Joi.string().valid('asc', 'desc').default('desc'),
  limit: Joi.number().integer().min(1).max(100).default(25),
  offset: Joi.number().integer().min(0).default(0),
});

export const leadConversionSchema = Joi.object({
  start_date: Joi.date().iso().optional(),
  end_date: Joi.date().iso().min(Joi.ref('start_date')).optional(),
  org_id: Joi.string().uuid().optional(),
  source: Joi.string().optional(),
});

export const mdfRoiSchema = Joi.object({
  fiscal_year: Joi.number().integer().min(2020).max(2030).optional(),
  fiscal_quarter: Joi.number().integer().min(1).max(4).optional(),
  org_id: Joi.string().uuid().optional(),
  activity_type: Joi.string().valid(
    'event', 'webinar', 'digital_campaign', 'print_collateral',
    'trade_show', 'training', 'other'
  ).optional(),
});
```
