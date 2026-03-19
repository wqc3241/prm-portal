# Product Requirements Document: Phase 4 — Lead Distribution

**Version:** 1.0
**Last Updated:** 2026-03-18
**Document Owner:** PRM Portal Product Team
**Status:** Approved
**Depends On:** Phase 1 (Foundation), Phase 2 (Deal Registration) -- both complete

---

## 1. Executive Summary and Vision

### Vision Statement

Deliver an automated, fair, and SLA-enforced lead distribution system that routes vendor-sourced leads to the highest-fit partner organization, tracks acceptance and conversion, and provides channel managers with full visibility into lead lifecycle performance.

### Executive Summary

Lead Distribution is the fourth module of the PRM Portal. Vendor marketing and sales teams generate leads (from campaigns, events, website inquiries) that need to be routed to partner organizations for follow-up. Today this routing happens manually via spreadsheets and email, resulting in slow response times, uneven distribution, and zero visibility into conversion outcomes.

This phase builds: (1) lead CRUD with scoring, (2) an assignment algorithm that factors in tier priority, geography, industry expertise, and current load, (3) an accept/return workflow with 48-hour SLA enforcement, (4) lead-to-deal conversion that pre-populates a deal registration, and (5) a background job that monitors SLA compliance and auto-returns breached leads.

### Key Benefits

- **Faster lead response**: 48-hour SLA replaces current 5+ day average response time
- **Fairer distribution**: Algorithm-based assignment eliminates favoritism and ensures load balancing
- **Higher conversion**: Matching leads to partners by geography and industry expertise increases deal conversion rates
- **Full visibility**: Channel managers see unassigned queue, acceptance rates, SLA compliance, and conversion metrics per partner
- **Seamless handoff**: One-click convert-to-deal pre-populates deal registration from lead data, eliminating re-entry

---

## 2. Problem Statement

### Current Challenges

**For Channel Managers:**
- Manual lead routing via spreadsheets takes 2-4 hours per batch
- No systematic way to match leads to the best-fit partner (tier, geography, industry, capacity)
- No SLA tracking -- leads go stale without follow-up for days or weeks
- No visibility into whether a partner accepted, worked, or converted a lead

**For Partners:**
- Leads arrive via email with no structured acceptance workflow
- No way to formally return a bad-fit lead and get it reassigned
- Converting a lead to a deal requires manual re-entry of all contact/company data
- No visibility into their own lead performance metrics

**For the Vendor (Program-wide):**
- Lead-to-deal conversion rate is unmeasured
- No data on which partners convert leads most effectively
- No mechanism to redirect leads away from underperforming partners
- SLA breaches are invisible

### Why This Matters Now

- Phases 1-3 established the foundation (auth, RBAC, org scoping), deal registration, and CPQ. Lead distribution is the natural upstream feeder: leads convert into deals, which generate quotes. Without this module, the deal pipeline has no structured inbound channel.
- The leads table, lead_status enum, and lead_number sequence already exist in the database schema. The notification system infrastructure is in place. The assignment algorithm is the primary new logic.

---

## 3. Goals and Success Metrics

### Business Goals

1. Reduce average lead response time from 5+ days to under 48 hours via SLA enforcement
2. Achieve measurable lead-to-deal conversion tracking (currently 0% visibility)
3. Distribute leads equitably across eligible partners, weighted by tier and fitness

### User Goals

1. Channel managers can assign leads individually or in bulk with algorithm-recommended partners
2. Partners can accept, return, or convert leads through a structured workflow
3. Admins can create leads from any source and monitor program-wide lead metrics

### Success Metrics

#### Primary Metrics (P0)

| Metric | Baseline | Target (3mo) | Target (6mo) |
|--------|----------|--------------|---------------|
| Avg lead response time | Unmeasured (est. 5+ days) | < 48 hours | < 24 hours |
| SLA compliance rate | N/A | > 80% | > 90% |
| Lead-to-deal conversion rate | Unmeasured | Measurable (any %) | > 15% |

#### Secondary Metrics (P1)

- Lead acceptance rate per partner: target > 70% within 6 months
- Average time from lead assignment to first contact: target < 24 hours
- Return rate per partner: flag partners with > 30% return rate

#### Instrumentation Requirements

- Log all status transitions in `activity_feed` with timestamps
- Track `assigned_at`, `accepted_at`, `converted_at` on each lead for funnel analysis
- Record `return_reason` and `disqualify_reason` for pattern analysis

---

## 4. Non-Goals and Boundaries

### Explicit Non-Goals

- **Real-time lead routing / webhooks from external marketing platforms**: Leads are created manually or via future API integration. Inbound webhook ingestion is out of scope.
- **Lead nurturing / drip campaigns**: This module handles assignment and lifecycle, not marketing automation.
- **Partner-to-partner lead sharing**: Leads flow from vendor to partner only. Peer-to-peer sharing is not supported.
- **Lead scoring ML model**: Scores are set manually at creation time. ML-based scoring is a future enhancement.
- **Frontend UI for leads**: Frontend pages are deferred to Phase 8 per the project plan.
- **Email delivery of lead notifications**: Notification records are created in-app. Email transport (Nodemailer/SendGrid) is deferred to Phase 7.

### Phase 4 Boundaries

- Will NOT include: lead import from CSV, lead deduplication against existing contacts, lead web forms
- Authentication/authorization: Uses existing JWT + RBAC + scopeToOrg middleware from Phase 1
- Notifications: Creates `notification` records in the database; does not send email in this phase
- Background jobs: Implements the lead SLA check job; registers it in the scheduler if the scheduler exists, otherwise provides standalone cron setup

### Future Considerations (Post-Phase 4)

- Lead scoring automation based on engagement signals
- Round-robin assignment mode as alternative to weighted scoring
- Lead recycling pool for leads returned multiple times
- Partner lead generation (partner-sourced leads flowing upstream)

---

## 5. User Personas and Use Cases

### Persona 1: Sarah Chen — Channel Manager (Primary)

**Role:** Channel Manager at the vendor, manages 8-12 partner organizations
**Experience:** 5 years in channel sales, uses Salesforce daily

**Goals:**
- Quickly route inbound leads to the best-fit partner
- Monitor SLA compliance across her partner portfolio
- Identify which partners convert leads effectively vs. which let them go stale

**Pain Points:**
- Spends 2+ hours/week manually matching leads to partners in spreadsheets
- Has no data to justify reassigning leads from underperforming partners
- Gets blindsided when a high-value lead expires without follow-up

**Use Cases:**
- UC-1: Sarah receives 15 new marketing-qualified leads. She opens the unassigned leads view, reviews scores and regions, and bulk-assigns them to partners. The system recommends the best-fit partner for each lead based on tier, geography, and capacity.
- UC-2: Sarah checks the SLA dashboard and sees 3 leads approaching the 48-hour deadline. She sends reminders (via notification) to the assigned partner admins.
- UC-3: A Diamond-tier partner has returned 5 leads this month. Sarah reviews the return reasons and schedules a call to discuss lead quality expectations.

### Persona 2: Mike Torres — Partner Admin (Primary)

**Role:** Partner Admin at "CyberShield Solutions" (Diamond Innovator tier), manages a team of 6 reps
**Experience:** 8 years in cybersecurity sales

**Goals:**
- Accept high-quality leads quickly and assign them to his reps
- Return poor-fit leads with clear reasons so the vendor improves targeting
- Convert qualified leads into deal registrations without re-entering data

**Pain Points:**
- Leads arrive via email with no formal acceptance process
- Converting a lead means manually copying 10+ fields into a deal registration form
- No visibility into which of his reps are most effective at converting leads

**Use Cases:**
- UC-4: Mike receives a notification that 3 leads have been assigned to his org. He reviews each lead's score, company, and interest notes, then accepts 2 and returns 1 (wrong industry).
- UC-5: Mike's rep has been working a lead for 2 weeks. The prospect is ready to buy. Mike clicks "Convert to Deal" and the system creates a draft deal registration pre-populated with the lead's company name, contact info, and industry.
- UC-6: A lead is clearly not a real prospect (spam/competitor). Mike disqualifies it with the reason "Not a legitimate business inquiry."

### Persona 3: Admin (Secondary)

**Role:** Internal program administrator with full system access

**Goals:**
- Create leads from any source (marketing campaigns, events, manual entry)
- Monitor program-wide lead distribution metrics
- Intervene when leads are stuck or SLA is breached

**Use Cases:**
- UC-7: Admin imports a batch of leads from a trade show. Creates each lead with source="event", campaign_name="RSA Conference 2026", and sets scores based on booth engagement level.
- UC-8: Admin reviews the activity feed and sees that a lead was auto-returned due to SLA breach. Reassigns it to a different partner.

---

## 6. Functional Requirements

### 6.1 Lead CRUD

**FR-LD-001: Create Lead** (P0)
Admin or channel manager creates a lead with contact info, company details, source, score, and optional interest notes. The system auto-generates a `lead_number` (LD-YYYY-NNNNN) via the existing database trigger. Status defaults to `new`.

*Acceptance Criteria:*
- Given an admin user, when they POST to `/api/v1/leads` with valid lead data, then a lead is created with status `new`, a generated `lead_number`, and `created_at` timestamp
- Given a partner_admin user, when they attempt to create a lead, then a 403 is returned (only admin and channel_manager can create leads)
- Given missing required fields (first_name, last_name), when creating a lead, then a 422 is returned with field-level errors

*Example:*
```json
// POST /api/v1/leads
{
  "first_name": "Jane",
  "last_name": "Doe",
  "email": "jane.doe@acmecorp.com",
  "phone": "+1-555-0123",
  "company_name": "Acme Corp",
  "title": "VP of IT Security",
  "industry": "Financial Services",
  "company_size": "1000-5000",
  "city": "New York",
  "state_province": "NY",
  "country": "US",
  "source": "marketing",
  "campaign_name": "Q1 Webinar Series",
  "score": 75,
  "budget": 150000,
  "timeline": "Q2 2026",
  "interest_notes": "Interested in next-gen firewall for branch offices"
}
// Response: { success: true, data: { id: "uuid", lead_number: "LD-2026-00001", status: "new", ... } }
```

**FR-LD-002: Get Lead** (P0)
Retrieve a single lead by ID. Data is scoped: partners see only leads assigned to their org; channel managers see leads assigned to their managed orgs; admins see all.

*Acceptance Criteria:*
- Given a partner_rep whose org has an assigned lead, when they GET `/api/v1/leads/:id`, then the lead is returned
- Given a partner_rep whose org does NOT have the lead assigned, when they GET `/api/v1/leads/:id`, then a 404 is returned
- Given an admin, when they GET any lead, then the lead is returned regardless of assignment

**FR-LD-003: List Leads** (P0)
List leads with filtering, pagination, and sorting. Supports query params: `status`, `score_min`, `score_max`, `source`, `assigned_org_id`, `assigned_user_id`, `search` (searches first_name, last_name, company_name, email).

*Acceptance Criteria:*
- Given a channel_manager, when they GET `/api/v1/leads?status=assigned&score_min=50`, then only assigned leads with score >= 50 within their managed orgs are returned
- Given pagination params `page=2&per_page=10`, when listing leads, then results are paginated with correct `meta` (page, per_page, total)
- Given `sort=score:desc`, when listing leads, then results are sorted by score descending

**FR-LD-004: Update Lead** (P1)
Update lead fields (contact info, score, interest_notes, tags). Only leads in `new`, `assigned`, or `accepted` status can be updated. Partners can only update leads assigned to their org.

*Acceptance Criteria:*
- Given a lead in `new` status, when an admin PATCHes the lead's score from 50 to 75, then the score is updated and `updated_at` is refreshed
- Given a lead in `converted` status, when any user attempts to update it, then a 422 is returned with error code `LEAD_INVALID_TRANSITION`
- Given a partner_rep, when they try to update a lead not assigned to their org, then a 404 is returned (scoping hides it)

### 6.2 Lead Assignment

**FR-LD-010: Assign Lead to Partner** (P0)
Admin or channel manager assigns a lead to a partner organization (and optionally a specific user). The system sets `assigned_org_id`, `assigned_user_id` (optional), `assigned_at = NOW()`, `sla_deadline = NOW() + 48 hours`, and transitions status from `new` or `returned` to `assigned`. A notification is sent to the partner admin of the assigned org.

*Acceptance Criteria:*
- Given a lead in `new` status, when a CM assigns it to org "CyberShield Solutions", then status becomes `assigned`, `assigned_org_id` is set, `sla_deadline` is 48 hours from now, and a notification of type `lead_assigned` is created for the partner admin
- Given a lead in `accepted` status, when a CM attempts to assign it, then a 422 is returned (cannot reassign an accepted lead without returning it first)
- Given an org_id that does not exist or is not active, when assigning, then a 422 is returned with a descriptive error

*Example:*
```json
// POST /api/v1/leads/:id/assign
{
  "organization_id": "uuid-of-cybershield",
  "user_id": "uuid-of-specific-rep"  // optional
}
// Response: { success: true, data: { id: "...", status: "assigned", assigned_org_id: "...", sla_deadline: "2026-03-20T14:30:00Z" } }
```

**FR-LD-011: Assignment Algorithm (Recommendation)** (P1)
When assigning a lead, the system can recommend the best-fit partner organization. The algorithm scores each eligible org on four dimensions (see Section 8 for full algorithm spec). The recommendation is advisory -- the CM makes the final assignment decision.

*Acceptance Criteria:*
- Given a lead with industry "Financial Services" and region "US-Northeast", when the CM requests assignment recommendations, then orgs are ranked by composite score (tier priority + geo match + industry match + load fairness)
- Given all eligible orgs are at max capacity (see FR-LD-040), when recommendations are requested, then the response includes the ranked list with a warning flag `all_at_capacity: true`
- Given an org with no active users, when computing recommendations, then that org is excluded from the ranked list

**FR-LD-012: Bulk Assign Leads** (P0)
Admin or channel manager assigns multiple leads to partner organizations in a single request. Each lead in the batch can be assigned to a different org. The system validates each assignment independently and returns per-lead success/failure results.

*Acceptance Criteria:*
- Given 5 leads in `new` status, when bulk-assigning all 5, then all 5 are assigned and the response includes 5 success results
- Given 5 leads where 2 are already in `accepted` status, when bulk-assigning all 5, then 3 succeed and 2 fail with per-lead error details. The 3 successful assignments are committed (not rolled back by the 2 failures).
- Given a bulk request with more than 50 leads, then a 422 is returned (batch size limit)

*Example:*
```json
// POST /api/v1/leads/bulk-assign
{
  "assignments": [
    { "lead_id": "uuid-1", "organization_id": "uuid-org-a" },
    { "lead_id": "uuid-2", "organization_id": "uuid-org-b", "user_id": "uuid-user-x" },
    { "lead_id": "uuid-3", "organization_id": "uuid-org-a" }
  ]
}
// Response:
{
  "success": true,
  "data": {
    "total": 3,
    "succeeded": 3,
    "failed": 0,
    "results": [
      { "lead_id": "uuid-1", "success": true, "lead_number": "LD-2026-00001" },
      { "lead_id": "uuid-2", "success": true, "lead_number": "LD-2026-00002" },
      { "lead_id": "uuid-3", "success": true, "lead_number": "LD-2026-00003" }
    ]
  }
}
```

**FR-LD-013: List Unassigned Leads** (P0)
Admin or channel manager can retrieve all leads with status `new` (unassigned) or `returned`. This is the assignment queue.

*Acceptance Criteria:*
- Given 10 leads: 4 new, 3 assigned, 2 accepted, 1 returned, when a CM calls `GET /api/v1/leads/unassigned`, then 5 leads are returned (4 new + 1 returned)
- Given a partner_admin, when they call this endpoint, then a 403 is returned

### 6.3 Accept / Return / Convert / Disqualify

**FR-LD-020: Accept Lead** (P0)
Partner admin or partner rep accepts an assigned lead. Validates the lead is assigned to the user's org. Sets `status = accepted`, `accepted_at = NOW()`.

*Acceptance Criteria:*
- Given a lead assigned to org "CyberShield", when a CyberShield partner_admin POSTs to `/api/v1/leads/:id/accept`, then status becomes `accepted` and `accepted_at` is set
- Given a lead assigned to org "CyberShield", when a "CloudGuard" partner_rep attempts to accept it, then a 403 is returned with code `LEAD_NOT_ASSIGNED`
- Given a lead in `new` status (not yet assigned), when a partner attempts to accept it, then a 422 is returned

**FR-LD-021: Return Lead** (P0)
Partner admin or partner rep returns an assigned or accepted lead with a required `return_reason`. The system clears `assigned_org_id`, `assigned_user_id`, `accepted_at`, sets `status = returned`, and logs the return reason. The lead re-enters the unassigned pool.

*Acceptance Criteria:*
- Given a lead in `accepted` status assigned to the user's org, when the user POSTs to `/api/v1/leads/:id/return` with `{ "return_reason": "Customer is outside our service area" }`, then status becomes `returned`, assignment fields are cleared, and the return reason is stored
- Given a return request without `return_reason`, then a 422 is returned (reason is required)
- Given a lead that has been returned 3+ times, when it is returned again, then the return succeeds but the system adds a tag `multiple_returns` and logs a warning in the activity feed

*Example:*
```json
// POST /api/v1/leads/:id/return
{
  "return_reason": "Customer is in a region we don't cover (LATAM)"
}
```

**FR-LD-022: Convert Lead to Deal** (P0)
Partner admin or partner rep converts an accepted or working lead into a deal registration. The system creates a new deal in `draft` status, pre-populated with the lead's contact info, company name, and industry. The lead's `converted_deal_id` and `converted_at` are set, and status transitions to `converted`.

*Acceptance Criteria:*
- Given a lead in `accepted` status with company_name="Acme Corp", contact email, and industry, when the user POSTs to `/api/v1/leads/:id/convert`, then a new deal is created with `customer_company_name = "Acme Corp"`, `customer_contact_email = lead.email`, `customer_industry = lead.industry`, `submitted_by = current user`, and the lead's `converted_deal_id` points to the new deal
- Given a lead in `new` status, when conversion is attempted, then a 422 is returned with code `LEAD_INVALID_TRANSITION` (must be accepted first)
- Given a lead already converted (status = `converted`), when conversion is attempted again, then a 422 is returned with code `LEAD_ALREADY_CONVERTED`
- Given a lead with missing company_name, when conversion is attempted, then the deal is still created with whatever data is available; missing fields can be filled in on the draft deal

*Pre-populated deal fields from lead:*

| Lead Field | Deal Field |
|------------|------------|
| `company_name` | `customer_company_name` |
| `first_name` + `last_name` | `customer_contact_name` |
| `email` | `customer_contact_email` |
| `phone` | `customer_contact_phone` |
| `industry` | `customer_industry` |
| `city, state_province, country` | `customer_address` (concatenated) |
| `budget` | `estimated_value` (if present) |
| `interest_notes` | `description` |

**FR-LD-023: Disqualify Lead** (P0)
Any scoped user (admin, CM, or assigned partner) can disqualify a lead with a required reason. Sets `status = disqualified` and stores `disqualify_reason`. Disqualified leads cannot be reassigned or converted.

*Acceptance Criteria:*
- Given a lead in any active status (new, assigned, accepted), when disqualified with reason "Spam / not a real company", then status becomes `disqualified` and the reason is stored
- Given a lead already in `converted` status, when disqualification is attempted, then a 422 is returned (converted leads cannot be disqualified)
- Given a disqualify request without a reason, then a 422 is returned

### 6.4 Lead Status Progression (Working)

**FR-LD-030: Update Lead Status to Working Stages** (P1)
After accepting a lead, a partner can progress it through intermediate working stages: `accepted` -> `contacted` -> `qualified`. These are informational stages for tracking pipeline progression. The partner updates them via PATCH on the lead's status field.

*Acceptance Criteria:*
- Given a lead in `accepted` status, when the partner PATCHes status to `contacted`, then the status is updated
- Given a lead in `contacted` status, when the partner PATCHes status to `qualified`, then the status is updated
- Given a lead in `contacted` status, when the partner PATCHes status to `new`, then a 422 is returned (invalid backward transition)

---

## 7. Non-Functional Requirements

### Security

- **NFR-SEC-001**: Lead data scoping must use the existing `scopeToOrg` middleware. Partners must never see leads assigned to other organizations. (P0)
- **NFR-SEC-002**: Only admin and channel_manager roles can create leads and assign leads. Partner roles can only accept, return, convert, and disqualify leads assigned to their org. (P0)
- **NFR-SEC-003**: Bulk assign endpoint must validate each assignment independently; a single invalid org_id must not expose data about other orgs. (P0)

### Performance

- **NFR-PERF-001**: Lead list endpoint must return within 200ms for up to 10,000 leads with filters and pagination. Indexes on `status`, `assigned_org_id`, `assigned_user_id`, and `score` already exist. (P1)
- **NFR-PERF-002**: Bulk assign must process up to 50 leads per request within 5 seconds. (P1)
- **NFR-PERF-003**: Assignment algorithm recommendation must return within 500ms for up to 100 eligible organizations. (P2)

### Reliability

- **NFR-REL-001**: SLA deadline calculation must use server-side UTC timestamps, never client-provided times. (P0)
- **NFR-REL-002**: The SLA check background job must be idempotent -- running it multiple times on the same data must produce the same result (no duplicate notifications, no double-returns). (P0)
- **NFR-REL-003**: If the assignment algorithm fails (e.g., cannot query org metrics), the assignment endpoint must still work with manual org_id selection. The algorithm is advisory, not blocking. (P1)
- **NFR-REL-004**: Lead status transitions must use optimistic concurrency control (WHERE status = :expected_status in the UPDATE) to prevent race conditions on concurrent accept/return. (P0)

### Maintainability

- **NFR-MAINT-001**: Follow the existing repository pattern: `lead.repository.ts` for data access, `lead.service.ts` for business logic, `lead.controller.ts` for request/response handling. (P0)
- **NFR-MAINT-002**: All lead status transitions must be defined in `constants.ts` as `VALID_LEAD_TRANSITIONS`, following the pattern of `VALID_DEAL_TRANSITIONS`. (P0)
- **NFR-MAINT-003**: Validation schemas must use Joi/Zod in `lead.validator.ts`, consistent with existing validators. (P0)
- **NFR-MAINT-004**: All business logic errors must use the `AppError` class with unique error codes (see Section 12). (P0)

---

## 8. Assignment Algorithm — Detailed Specification

### Overview

The assignment algorithm computes a **composite fitness score** for each eligible partner organization, given a specific lead. The channel manager receives a ranked list of recommendations and makes the final decision.

### Eligibility Filter (Pre-scoring)

Before scoring, filter out ineligible orgs:

```
FUNCTION getEligibleOrgs(lead):
  RETURN organizations WHERE
    status = 'active'
    AND tier_id IS NOT NULL
    AND has_at_least_one_active_user = TRUE
    AND (channel_manager_id = requesting_cm.id  // CM can only assign to their own orgs
         OR requesting_user.role = 'admin')      // admin can assign to any org
```

### Scoring Dimensions

| Dimension | Weight | Max Points | Description |
|-----------|--------|------------|-------------|
| Tier Priority | 40% | 100 | Higher-tier partners get priority |
| Geographic Match | 25% | 100 | Lead region matches partner territory |
| Industry Expertise | 20% | 100 | Lead industry matches partner specialization |
| Lead Load Fairness | 15% | 100 | Fewer active leads = higher score (capacity headroom) |

### Composite Score Formula

```
composite_score = (tier_score * 0.40)
                + (geo_score * 0.25)
                + (industry_score * 0.20)
                + (load_score * 0.15)
```

### Dimension Calculations

**Tier Priority Score (0-100):**
```
tier_score = (org.tier.rank / max_tier_rank) * 100

Example: Diamond Innovator (rank 4) in a 4-tier system = (4/4) * 100 = 100
         Registered (rank 1) = (1/4) * 100 = 25
```

**Geographic Match Score (0-100):**
```
IF lead.country = org.country AND lead.state_province = org.state_province:
  geo_score = 100  // exact state match
ELSE IF lead.country = org.country:
  geo_score = 60   // same country, different state
ELSE IF lead.country IN same_region(org.country):
  geo_score = 30   // same region (e.g., both in EMEA)
ELSE:
  geo_score = 0    // no geographic match
```

Regional groupings (hardcoded constant):
```typescript
const GEO_REGIONS: Record<string, string[]> = {
  'AMERICAS': ['US', 'CA', 'MX', 'BR', 'AR', 'CL', 'CO'],
  'EMEA': ['GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'SE', 'NO', 'IL', 'AE', 'SA', 'ZA'],
  'APAC': ['JP', 'KR', 'AU', 'NZ', 'SG', 'IN', 'TH', 'MY', 'ID', 'PH'],
};
```

**Industry Expertise Score (0-100):**
```
IF org.industry = lead.industry:
  industry_score = 100  // exact industry match
ELSE IF org.industry IN related_industries(lead.industry):
  industry_score = 50   // related industry
ELSE:
  industry_score = 0    // no match
```

Related industry groupings (hardcoded constant):
```typescript
const RELATED_INDUSTRIES: Record<string, string[]> = {
  'Financial Services': ['Banking', 'Insurance', 'Fintech'],
  'Healthcare': ['Pharmaceuticals', 'Medical Devices', 'Biotech'],
  'Technology': ['Software', 'SaaS', 'Cloud Services', 'IT Services'],
  'Manufacturing': ['Industrial', 'Automotive', 'Aerospace'],
  'Retail': ['E-commerce', 'Consumer Goods', 'Hospitality'],
  'Government': ['Federal', 'State/Local', 'Defense', 'Education'],
};
```

**Lead Load Fairness Score (0-100):**
```
active_lead_count = COUNT(leads) WHERE assigned_org_id = org.id
                    AND status IN ('assigned', 'accepted', 'contacted', 'qualified')

max_load = MAX(active_lead_count) across all eligible orgs

IF max_load = 0:
  load_score = 100  // all orgs have zero load
ELSE:
  load_score = (1 - (active_lead_count / max_load)) * 100

Example: Org has 2 active leads, max across all orgs is 10
         load_score = (1 - 2/10) * 100 = 80
```

### Algorithm Output

```json
{
  "recommendations": [
    {
      "organization_id": "uuid",
      "organization_name": "CyberShield Solutions",
      "tier_name": "Diamond Innovator",
      "composite_score": 87.5,
      "scores": {
        "tier": 100,
        "geo": 100,
        "industry": 50,
        "load": 80
      },
      "active_lead_count": 2
    }
  ],
  "all_at_capacity": false
}
```

### Capacity Threshold

**FR-LD-040: Max Active Lead Capacity** (P1)

Each org has an implicit max active lead count based on their tier:

| Tier | Max Active Leads |
|------|-----------------|
| Registered | 5 |
| Innovator | 15 |
| Platinum Innovator | 30 |
| Diamond Innovator | 50 |

When all eligible orgs are at their capacity limit, the system flags `all_at_capacity: true` in the recommendation response. The CM can still override and assign (the cap is advisory, not enforced as a hard block).

---

## 9. SLA Enforcement

### SLA Rules

| Rule | Value | Source |
|------|-------|--------|
| Acceptance deadline | 48 hours from `assigned_at` | `LEAD_SLA_HOURS` constant (already defined as 48) |
| Warning notification | At 24 hours remaining (i.e., 24 hours after assignment) | `leadSlaCheck` job |
| Auto-return | When `sla_deadline < NOW()` and status is still `assigned` | `leadSlaCheck` job |

### SLA Check Background Job

**FR-LD-050: Lead SLA Check Job** (P0)

The `leadSlaCheck` job runs every 4 hours (per the project spec) and performs two actions:

**Action 1: Send 24-hour warning**
```
SELECT leads WHERE status = 'assigned'
  AND sla_deadline BETWEEN NOW() AND NOW() + INTERVAL '24 hours'
  AND NOT EXISTS (notification for this lead with title LIKE '%SLA warning%' created in last 24 hours)

FOR EACH lead:
  Create notification for assigned org's partner_admin:
    type: 'lead_assigned'
    title: 'Lead {lead_number} SLA deadline approaching — {hours_remaining}h remaining'
    body: '{lead.first_name} {lead.last_name} at {lead.company_name} must be accepted within {hours_remaining} hours'
    entity_type: 'lead'
    entity_id: lead.id
  Log activity: 'sla_warning_sent' for entity lead.id
```

**Action 2: Auto-return SLA-breached leads**
```
SELECT leads WHERE status = 'assigned'
  AND sla_deadline < NOW()

FOR EACH lead:
  old_org_id = lead.assigned_org_id
  UPDATE lead SET
    status = 'returned',
    return_reason = 'Auto-returned: SLA deadline exceeded (48 hours)',
    assigned_org_id = NULL,
    assigned_user_id = NULL,
    accepted_at = NULL
  Create notification for old org's partner_admin:
    type: 'lead_assigned'
    title: 'Lead {lead_number} auto-returned — SLA breach'
    body: 'This lead was automatically returned because the 48-hour acceptance deadline was not met.'
  Log activity_feed:
    action: 'sla_breach'
    entity_type: 'lead'
    entity_id: lead.id
    summary: 'Lead {lead_number} auto-returned from {org.name} due to SLA breach'
    changes: { status: { old: 'assigned', new: 'returned' }, reason: 'SLA breach' }
```

### SLA Idempotency

The job must be idempotent:
- Warning: Check for existing warning notification in the last 24 hours before creating a new one
- Auto-return: The WHERE clause `status = 'assigned'` ensures a lead already returned (status = `returned`) will not be processed again

---

## 10. Lead Lifecycle — State Machine

### Valid Status Transitions

```
new ──────────┬──> assigned ──┬──> accepted ──┬──> contacted ──> qualified ──> converted
              │               │               │
              │               │               ├──> converted  (skip contacted/qualified)
              │               │               │
              │               │               ├──> returned   (partner returns)
              │               │               │
              │               │               └──> disqualified
              │               │
              │               ├──> returned    (partner returns before accepting)
              │               │
              │               └──> disqualified
              │
              └──> disqualified

returned ─────> assigned      (re-assignment)
returned ─────> disqualified
```

### Transition Map (for constants.ts)

```typescript
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
```

### Transition Rules

| Transition | Who Can Do It | Requirements |
|------------|---------------|--------------|
| new -> assigned | admin, channel_manager | Valid org_id required |
| assigned -> accepted | partner_admin, partner_rep (assigned org) | Lead must be assigned to user's org |
| assigned -> returned | partner_admin, partner_rep (assigned org) | `return_reason` required |
| accepted -> contacted | partner_admin, partner_rep (assigned org) | None |
| contacted -> qualified | partner_admin, partner_rep (assigned org) | None |
| * -> converted | partner_admin, partner_rep (assigned org) | Lead must be in accepted/contacted/qualified |
| * -> disqualified | admin, CM, assigned partner | `disqualify_reason` required |
| returned -> assigned | admin, channel_manager | Re-assignment (new org_id) |
| assigned -> returned (SLA) | system (background job) | `sla_deadline < NOW()` |

---

## 11. Edge Cases

### EC-01: No Eligible Partner for Assignment

**Scenario:** All partner orgs managed by the CM are at capacity, suspended, or have no active users.
**Behavior:** The assignment recommendation endpoint returns an empty `recommendations` array with `all_at_capacity: true` (or `no_eligible_orgs: true`). The CM can still manually assign by providing an org_id -- the capacity limit is advisory. The assign endpoint itself does not block based on capacity; it only validates that the org exists and is active.

### EC-02: Lead Returned Multiple Times

**Scenario:** A lead has been assigned and returned 3 or more times.
**Behavior:** On the 3rd return, the system adds a tag `multiple_returns` to the lead's `tags` array and creates an activity feed entry with action `multiple_return_warning`. This flags the lead for CM review -- possible quality issue or misrouted geography. The lead can still be re-assigned; returns are never blocked.
**Data tracking:** Each return is logged in the activity feed with the return reason, creating a history. The system does not store a `return_count` column; instead, count returns from the activity feed where `entity_id = lead.id AND action = 'returned'`.

### EC-03: SLA Breach During System Downtime

**Scenario:** The SLA check job did not run for 12 hours due to a Redis outage. Multiple leads have passed their SLA deadline.
**Behavior:** When the job resumes, it processes all leads with `sla_deadline < NOW()` and auto-returns them. The `return_reason` includes the actual breach timestamp: "Auto-returned: SLA deadline exceeded (48 hours). Deadline was {sla_deadline}." The idempotent design ensures that leads already returned are not double-processed.

### EC-04: Concurrent Accept and Return

**Scenario:** Two users in the same org simultaneously try to accept and return the same lead.
**Behavior:** Both the accept and return operations use optimistic concurrency: `UPDATE leads SET status = :new_status WHERE id = :id AND status = :expected_status`. Exactly one will succeed (the one whose UPDATE matches the current status). The other receives a 422 with `LEAD_INVALID_TRANSITION` and a message indicating the lead's status has changed. The client should re-fetch the lead to see the current state.

### EC-05: Convert to Deal When Lead Data Is Incomplete

**Scenario:** A lead has `company_name` but no email, no phone, no budget.
**Behavior:** The system creates the deal with whatever data is available. Missing fields are set to NULL on the deal. The deal is created in `draft` status so the partner can fill in missing fields before submission. The only hard requirement for lead conversion is that the lead is in an accepted/contacted/qualified status; the data completeness is not validated at conversion time (it will be validated at deal submission time per existing deal validation rules).

### EC-06: Bulk Assign with Mixed Eligible/Ineligible

**Scenario:** A bulk assign request contains 10 leads: 7 are in `new` status, 2 are in `accepted` status, 1 references a non-existent org_id.
**Behavior:** The system processes each assignment independently. The 7 valid assignments succeed. The 2 accepted leads fail with `LEAD_INVALID_TRANSITION`. The 1 with a bad org_id fails with `ORG_NOT_FOUND`. The response includes per-lead results. Successful assignments are committed; failures do not roll back successes.

```json
{
  "data": {
    "total": 10,
    "succeeded": 7,
    "failed": 3,
    "results": [
      { "lead_id": "uuid-1", "success": true },
      { "lead_id": "uuid-8", "success": false, "error": { "code": "LEAD_INVALID_TRANSITION", "message": "Lead is in 'accepted' status and cannot be reassigned" } },
      { "lead_id": "uuid-10", "success": false, "error": { "code": "ORG_NOT_FOUND", "message": "Organization not found" } }
    ]
  }
}
```

### EC-07: Assign to Org with No Active Users

**Scenario:** The assigned org has all users deactivated (is_active = false).
**Behavior:** The assignment is blocked with a 422 error: `ORG_NO_ACTIVE_USERS` - "Cannot assign lead to organization with no active users." The assignment recommendation algorithm already excludes these orgs, but the assign endpoint must also validate this as a guard.

### EC-08: Re-assign Already Accepted Lead

**Scenario:** A CM wants to move an accepted lead from Org A to Org B.
**Behavior:** The CM must first return the lead (or the partner must return it), then re-assign it. Direct reassignment of an accepted lead is not supported. The assign endpoint rejects it with `LEAD_INVALID_TRANSITION` because `accepted -> assigned` is not a valid transition. This protects partners from having leads pulled out from under them without notice.

### EC-09: Convert Lead That Has Already Generated a Deal

**Scenario:** Due to a bug or race condition, a second convert request arrives for a lead that already has `converted_deal_id` set.
**Behavior:** The status check catches this: status is already `converted`, and the transition map shows no valid transitions from `converted`. The endpoint returns 422 with `LEAD_ALREADY_CONVERTED` and includes the existing `converted_deal_id` in the response for reference.

### EC-10: Assign Lead to Org Not Managed by This CM

**Scenario:** A channel manager tries to assign a lead to an org outside their assigned portfolio.
**Behavior:** The existing `scopeToOrg` middleware restricts CMs to their assigned orgs. The org validation in the assign endpoint checks that the target org is within the CM's scope. If not, a 403 is returned with `AUTH_ORG_MISMATCH`.

---

## 12. API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/leads` | * (scoped) | List leads with filters and pagination |
| POST | `/leads` | admin, channel_manager | Create a new lead |
| GET | `/leads/unassigned` | admin, channel_manager | List leads in `new` or `returned` status |
| GET | `/leads/:id` | * (scoped) | Get lead details |
| PATCH | `/leads/:id` | * (scoped) | Update lead fields |
| POST | `/leads/:id/assign` | admin, channel_manager | Assign lead to partner org |
| POST | `/leads/:id/accept` | partner_admin, partner_rep (assigned) | Accept assigned lead |
| POST | `/leads/:id/return` | partner_admin, partner_rep (assigned) | Return lead with reason |
| POST | `/leads/:id/convert` | partner_admin, partner_rep (assigned) | Convert lead to deal registration |
| POST | `/leads/:id/disqualify` | * (scoped) | Disqualify lead with reason |
| POST | `/leads/bulk-assign` | admin, channel_manager | Bulk assign leads to partners |

**Query params for `GET /leads`:**
```
?status=new,assigned          // comma-separated status filter
&score_min=50                 // minimum score
&score_max=100                // maximum score
&source=marketing             // lead source filter
&assigned_org_id=uuid         // filter by assigned org
&assigned_user_id=uuid        // filter by assigned user
&search=acme                  // fuzzy search on name/company/email
&created_after=2026-01-01     // date range filter
&created_before=2026-03-31
&page=1                       // pagination
&per_page=25
&sort=score:desc              // sort field:direction
```

---

## 13. Data Model

### Leads Table (Existing Schema)

The `leads` table is already defined in `docs/001-schema.sql` and created by migration `009_leads`. No schema changes are required. Key columns:

```sql
CREATE TABLE leads (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_number     VARCHAR(20) NOT NULL UNIQUE,         -- LD-2026-00001 (auto-generated)
  -- Source
  source          VARCHAR(50),                          -- 'marketing', 'website', 'event', 'manual'
  campaign_name   VARCHAR(200),
  -- Contact
  first_name      VARCHAR(100) NOT NULL,
  last_name       VARCHAR(100) NOT NULL,
  email           VARCHAR(255),
  phone           VARCHAR(50),
  company_name    VARCHAR(255),
  title           VARCHAR(200),
  industry        VARCHAR(100),
  company_size    VARCHAR(50),
  -- Location
  city            VARCHAR(100),
  state_province  VARCHAR(100),
  country         VARCHAR(100),
  -- Assignment
  status          lead_status NOT NULL DEFAULT 'new',   -- new|assigned|accepted|contacted|qualified|converted|disqualified|returned
  assigned_org_id UUID REFERENCES organizations(id),
  assigned_user_id UUID REFERENCES users(id),
  assigned_at     TIMESTAMPTZ,
  accepted_at     TIMESTAMPTZ,
  sla_deadline    TIMESTAMPTZ,                         -- assigned_at + 48 hours
  -- Qualification
  score           INT DEFAULT 0,                       -- 0-100
  budget          NUMERIC(15,2),
  timeline        VARCHAR(100),
  interest_notes  TEXT,
  -- Conversion
  converted_deal_id UUID REFERENCES deals(id),
  converted_at    TIMESTAMPTZ,
  -- Rejection
  return_reason   TEXT,
  disqualify_reason TEXT,
  -- Metadata
  tags            TEXT[],
  custom_fields   JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Existing indexes
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_org ON leads(assigned_org_id);
CREATE INDEX idx_leads_user ON leads(assigned_user_id);
CREATE INDEX idx_leads_score ON leads(score DESC);
```

### Related Tables Used

| Table | Relationship | Usage |
|-------|-------------|-------|
| `organizations` | `leads.assigned_org_id -> organizations.id` | Assignment target |
| `users` | `leads.assigned_user_id -> users.id` | Optional specific user assignment |
| `deals` | `leads.converted_deal_id -> deals.id` | Conversion target |
| `partner_tiers` | `organizations.tier_id -> partner_tiers.id` | Tier priority for assignment algorithm |
| `notifications` | Created on assignment, SLA warning, SLA breach | In-app notifications |
| `activity_feed` | Logged on every status transition | Audit trail |

### New Constants Required (additions to constants.ts)

```typescript
export const VALID_LEAD_TRANSITIONS: Record<string, string[]> = {
  new:           ['assigned', 'disqualified'],
  assigned:      ['accepted', 'returned', 'disqualified'],
  accepted:      ['contacted', 'qualified', 'converted', 'returned', 'disqualified'],
  contacted:     ['qualified', 'converted', 'returned', 'disqualified'],
  qualified:     ['converted', 'returned', 'disqualified'],
  converted:     [],
  disqualified:  [],
  returned:      ['assigned', 'disqualified'],
};

export const LEAD_SOURCES = ['marketing', 'website', 'event', 'manual', 'referral'] as const;

export const LEAD_SLA_WARNING_HOURS = 24;  // warn at 24h remaining

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
```

### New Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `LEAD_NOT_ASSIGNED` | 403 | Lead is not assigned to your organization |
| `LEAD_ALREADY_CONVERTED` | 422 | Lead has already been converted to a deal |
| `LEAD_INVALID_TRANSITION` | 422 | Invalid lead status transition |
| `LEAD_SLA_EXPIRED` | 422 | Lead SLA deadline has passed |
| `ORG_NO_ACTIVE_USERS` | 422 | Cannot assign to org with no active users |
| `LEAD_BULK_LIMIT` | 422 | Bulk assign exceeds max batch size (50) |

---

## 14. Technical Architecture

### Component Diagram

```
                    POST /leads/:id/assign
                    POST /leads/:id/accept
Client (React)  ──> POST /leads/:id/return    ──>  lead.routes.ts
                    POST /leads/:id/convert           │
                    POST /leads/bulk-assign            v
                                                 lead.controller.ts  (thin: parse req, call service, send res)
                                                      │
                                                      v
                                                 lead.service.ts  (business logic)
                                                 ├── validateTransition()
                                                 ├── assignLead()  ──> assignment algorithm
                                                 ├── acceptLead()
                                                 ├── returnLead()
                                                 ├── convertLead() ──> dealService.createDeal()
                                                 ├── disqualifyLead()
                                                 ├── bulkAssign()
                                                 └── getRecommendations()
                                                      │
                                          ┌───────────┼────────────┐
                                          v           v            v
                                   lead.repository   deal.repo   notification.service
                                   (Knex queries)    (create     (create notifications)
                                                      deal)
                                          │
                                          v
                                     PostgreSQL
                                     (leads table)

      ┌─────────────────────────────────────────────────┐
      │  leadSlaCheck.job.ts  (runs every 4 hours)      │
      │  ├── Query leads with approaching SLA deadline  │
      │  ├── Send warning notifications at 24h mark     │
      │  ├── Auto-return leads past 48h deadline        │
      │  └── Log SLA breaches to activity_feed          │
      └─────────────────────────────────────────────────┘
```

### File Structure (New Files)

```
src/
├── validators/
│   └── lead.validator.ts          # Joi/Zod schemas for create, assign, accept, return, convert, disqualify
├── repositories/
│   └── lead.repository.ts         # Data access: CRUD, list, filters, status updates, org scoping
├── services/
│   └── lead.service.ts            # Business logic: assignment algorithm, SLA, conversion, transitions
├── controllers/
│   └── lead.controller.ts         # Request/response handling
├── routes/
│   └── lead.routes.ts             # Route definitions with middleware
└── jobs/
    └── leadSlaCheck.job.ts        # Background job: SLA warning + auto-return
```

### Integration Points

| System | Integration Type | Purpose |
|--------|------------------|---------|
| Deal Service | Internal service call | `convertLead()` calls `dealService.createDeal()` to create deal from lead data |
| Notification Service | Internal service call | Assignment, SLA warning, SLA breach, return notifications |
| Activity Feed | Middleware + direct insert | Auto-logged via activityLogger middleware for CRUD; direct insert for SLA events |
| Organization Service | Repository query | Fetch org details, tier info, active user count for assignment algorithm |
| Redis / Bull | Job queue | SLA check job scheduled via Bull queue or node-cron |

---

## 15. Implementation Phases

### Phase 4A: Lead CRUD + Validation (Week 1)

**Objectives:**
- Lead validator, repository, service (CRUD only), controller, routes
- Add `VALID_LEAD_TRANSITIONS` and new constants to `constants.ts`
- Integration tests for CRUD + scoping

**Deliverables:**
- `lead.validator.ts` with schemas for create, update
- `lead.repository.ts` with CRUD, list, filters, org scoping
- `lead.service.ts` with createLead, getLead, listLeads, updateLead
- `lead.controller.ts` and `lead.routes.ts`
- Unit tests for service, integration tests for endpoints

**Dependencies:** None beyond Phase 1 foundation

### Phase 4B: Assignment + Bulk Assign (Week 1-2)

**Objectives:**
- Single lead assignment with SLA deadline setting
- Assignment algorithm (recommendation engine)
- Bulk assign endpoint
- Unassigned leads endpoint

**Deliverables:**
- `assignLead()`, `bulkAssign()`, `getRecommendations()` in lead.service.ts
- Assignment algorithm with tier/geo/industry/load scoring
- Notification creation on assignment
- Unit tests for algorithm scoring, integration tests for assign endpoints

**Dependencies:** Phase 4A (lead CRUD must exist)

### Phase 4C: Accept / Return / Convert / Disqualify (Week 2)

**Objectives:**
- Accept, return, convert, disqualify endpoints
- Convert-to-deal integration with deal.service.ts
- Edge case handling (multiple returns, concurrent access, incomplete data)

**Deliverables:**
- `acceptLead()`, `returnLead()`, `convertLead()`, `disqualifyLead()` in lead.service.ts
- Integration with deal.service.ts for conversion
- Status transition validation using VALID_LEAD_TRANSITIONS
- Integration tests for full lifecycle: create -> assign -> accept -> convert

**Dependencies:** Phase 4B (assignment must exist for accept/return), Phase 2 deal.service.ts (for conversion)

### Phase 4D: SLA Enforcement Job (Week 2)

**Objectives:**
- Background job for SLA monitoring
- 24-hour warning notifications
- Auto-return on SLA breach
- Activity feed logging for SLA events

**Deliverables:**
- `leadSlaCheck.job.ts` with warning + auto-return logic
- Idempotency safeguards
- Integration tests verifying SLA warning and auto-return behavior

**Dependencies:** Phase 4B (assigned leads with SLA deadlines must exist)

---

## 16. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Assignment algorithm produces poor recommendations due to sparse org data (missing industry, geography) | Medium | Medium | Algorithm degrades gracefully: missing data dimensions score 0, other dimensions compensate. CM always makes final decision. |
| SLA job downtime causes stale leads to pile up | Low | High | Job is idempotent and processes all overdue leads on restart. Add monitoring/alerting for job execution gaps. |
| Bulk assign with large batches causes timeout | Low | Medium | Enforce 50-lead batch limit. Process sequentially within a batch (not parallel) to avoid connection pool exhaustion. |
| Race condition on concurrent accept/return | Medium | Low | Optimistic concurrency (WHERE status = expected_status) ensures exactly one operation wins. Loser gets a 422 with clear message. |
| Convert-to-deal fails mid-operation (deal created but lead not updated) | Low | High | Wrap conversion in a database transaction: create deal + update lead in a single transaction. If either fails, both roll back. |
| Lead returned many times with no resolution | Medium | Low | Tag `multiple_returns` after 3rd return; surface in CM dashboards (Phase 6). Does not block workflow. |

---

## 17. Dependencies

### External Dependencies

- **PostgreSQL leads table + indexes**: Already created by migration `009_leads`. No schema changes required.
- **Redis / Bull queue**: Required for the SLA check background job. Already configured in Phase 1.
- **lead_number_seq sequence**: Already created in migration `015_sequences`.

### Internal Dependencies

- **Phase 1 (Foundation)**: Auth middleware, RBAC, scopeToOrg, AppError, pagination utils, notification service, activity feed middleware -- all complete
- **Phase 2 (Deal Registration)**: deal.service.ts `createDeal()` method -- required for lead-to-deal conversion. Complete.
- **constants.ts**: New constants must be added (VALID_LEAD_TRANSITIONS, assignment weights, geo regions, related industries)

### Blocking vs Non-blocking

- **Blocking**: Phase 1 foundation (complete), Phase 2 deal service (complete)
- **Non-blocking**: Frontend (Phase 8), dashboards (Phase 6), email delivery (Phase 7)

---

## 18. Appendices

### A. Glossary

- **Lead**: A vendor-sourced prospect (contact + company info) routed to a partner for follow-up and potential conversion to a deal
- **SLA (Service Level Agreement)**: The 48-hour window within which a partner must accept or return an assigned lead
- **Assignment Algorithm**: The scoring system that recommends the best-fit partner for a given lead based on tier, geography, industry, and capacity
- **Convert**: The action of creating a deal registration from lead data, linking the lead to the resulting deal
- **Return**: The action of a partner sending an assigned lead back to the unassigned pool with a reason
- **Disqualify**: The action of marking a lead as invalid (spam, not a real prospect, etc.)

### B. Validation Schemas (lead.validator.ts)

```typescript
// Create Lead
{
  first_name: string().required().min(1).max(100),
  last_name: string().required().min(1).max(100),
  email: string().email().optional(),
  phone: string().max(50).optional(),
  company_name: string().max(255).optional(),
  title: string().max(200).optional(),
  industry: string().max(100).optional(),
  company_size: string().max(50).optional(),
  city: string().max(100).optional(),
  state_province: string().max(100).optional(),
  country: string().max(100).optional(),
  source: string().valid('marketing', 'website', 'event', 'manual', 'referral').optional(),
  campaign_name: string().max(200).optional(),
  score: number().integer().min(0).max(100).optional().default(0),
  budget: number().positive().optional(),
  timeline: string().max(100).optional(),
  interest_notes: string().optional(),
  tags: array().items(string()).optional(),
}

// Assign Lead
{
  organization_id: string().uuid().required(),
  user_id: string().uuid().optional(),
}

// Bulk Assign
{
  assignments: array().items({
    lead_id: string().uuid().required(),
    organization_id: string().uuid().required(),
    user_id: string().uuid().optional(),
  }).min(1).max(50).required(),
}

// Return Lead
{
  return_reason: string().required().min(1).max(1000),
}

// Convert Lead (no body required; optional overrides)
{
  deal_name: string().max(300).optional(),  // override auto-generated deal name
  estimated_value: number().positive().optional(),  // override lead.budget
  expected_close_date: date().min('now').optional(),
}

// Disqualify Lead
{
  disqualify_reason: string().required().min(1).max(1000),
}
```

### C. Notification Templates

| Event | Recipients | Notification Type | Title Template |
|-------|-----------|-------------------|----------------|
| Lead assigned | Partner admin of assigned org | `lead_assigned` | "New lead assigned: {lead_number} — {company_name}" |
| SLA warning (24h) | Partner admin of assigned org | `lead_assigned` | "Lead {lead_number} SLA deadline approaching — {hours}h remaining" |
| SLA breach (auto-return) | Partner admin of former org | `lead_assigned` | "Lead {lead_number} auto-returned — SLA breach" |
| Lead returned by partner | Assigning CM | `lead_assigned` | "Lead {lead_number} returned by {org_name}: {reason_preview}" |
| Lead converted to deal | Assigning CM | `deal_update` | "Lead {lead_number} converted to deal {deal_number} by {org_name}" |

### D. Activity Feed Actions for Leads

| Action | Summary Template | Logged By |
|--------|-----------------|-----------|
| `created` | "{user} created lead {lead_number}" | activityLogger middleware |
| `assigned` | "{user} assigned lead {lead_number} to {org_name}" | lead.service.ts |
| `accepted` | "{user} accepted lead {lead_number}" | activityLogger middleware |
| `returned` | "{user} returned lead {lead_number}: {reason_preview}" | lead.service.ts |
| `converted` | "{user} converted lead {lead_number} to deal {deal_number}" | lead.service.ts |
| `disqualified` | "{user} disqualified lead {lead_number}: {reason_preview}" | lead.service.ts |
| `sla_warning_sent` | "SLA warning sent for lead {lead_number} assigned to {org_name}" | leadSlaCheck.job.ts |
| `sla_breach` | "Lead {lead_number} auto-returned from {org_name} due to SLA breach" | leadSlaCheck.job.ts |
| `multiple_return_warning` | "Lead {lead_number} has been returned {count} times" | lead.service.ts |
