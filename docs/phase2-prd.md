# Phase 2: Deal Registration - Product Requirements Document

**Version:** 1.0
**Last Updated:** 2026-03-18
**Status:** Approved
**Depends On:** Phase 1 (Foundation) - COMPLETE

---

## 1. Problem Statement

Deal registration is the single most important module in any Partner Relationship Management system. It is the mechanism through which partners claim exclusivity on customer opportunities, and it is the primary interaction point between partners and the vendor's channel organization.

**Without deal registration, three critical problems emerge:**

1. **Channel conflict** -- Multiple partners pursue the same customer without coordination, eroding margins and damaging customer relationships. Partners undercut each other, the vendor loses control of pricing, and customers exploit the confusion.

2. **No pipeline visibility** -- The vendor cannot forecast channel revenue, cannot identify which partners are actively selling, and cannot allocate resources (SEs, marketing funds, executive sponsorship) to the highest-value opportunities.

3. **Partner disengagement** -- Partners who invest time qualifying an opportunity but receive no deal protection will stop investing in the vendor's products. This is the #1 reason partners churn from channel programs.

**Why this is Phase 2 (not Phase 3+):** Deal registration is the foundation for CPQ (quotes reference deals), lead conversion (leads become deals), MDF justification (funds are tied to pipeline), and dashboard metrics (pipeline value, win rate, revenue attainment). Every subsequent phase depends on deal data.

---

## 2. Non-Goals and Boundaries

### Explicit Non-Goals
- **Quote generation from deals** -- Phase 3 (CPQ) will add "Create Quote from Deal" functionality. Phase 2 only stores deal products for estimated value calculation.
- **Lead-to-deal conversion** -- Phase 4 (Leads) will add the conversion flow. Phase 2 builds the deal creation API that Phase 4 will call.
- **Tier recalculation on deal won** -- The `recalculateTier` service exists from Phase 1. Phase 2 will call it but will NOT modify tier calculation logic.
- **Email delivery** -- Phase 2 creates notification records in the `notifications` table. Actual email sending (SendGrid/Nodemailer integration) is Phase 7.
- **Real-time push notifications** -- Phase 2 uses in-app notifications via polling. WebSocket/SSE is Phase 7.
- **Deal analytics/reporting** -- Phase 6 (Dashboards) will consume deal data. Phase 2 only provides the raw API endpoints.
- **Frontend implementation** -- Phase 2 is backend-only. The React deal pages (list, form, detail) are Phase 8.

### Phase 2 Boundaries
- Notification service: Phase 2 implements a minimal `createNotification()` helper that inserts into the `notifications` table. It does NOT implement the full notification module (list, mark-read, unread-count). Those endpoints already exist as stubs or will be completed in Phase 7.
- Approval requests: Phase 2 inserts into the `approval_requests` table on deal submission. It does NOT implement the unified `/approvals/pending` endpoint (Phase 6).
- Activity feed: Phase 2 relies on the existing `activityLogger` middleware for automatic audit logging. It does NOT add custom activity feed entries beyond what the middleware captures.

---

## 3. User Personas

### Persona 1: Partner Rep (Primary)
**Role:** `partner_rep` at a Silver-tier partner
**Goal:** Register deals quickly, track approval status, close deals before protection expires
**Pain Points:** Spends time qualifying a customer only to discover another partner already registered the same opportunity; loses track of deal expiration dates

### Persona 2: Channel Manager (Primary)
**Role:** `channel_manager` managing 8-12 partner organizations
**Goal:** Review deal registrations efficiently, resolve conflicts fairly, keep pipeline data accurate
**Pain Points:** Receives deal submissions with incomplete information; must manually check for conflicts across partners; no audit trail for approval decisions

### Persona 3: Partner Admin (Secondary)
**Role:** `partner_admin` managing a team of 5 reps
**Goal:** Monitor team's deal pipeline, ensure compliance with registration requirements
**Pain Points:** Cannot see aggregate pipeline across their reps; no visibility into why deals were rejected

---

## 4. User Stories

### 4.1 Deal Creation and Submission

**US-DR-001: Create Deal Draft** (P0)
As a partner rep, I want to create a deal registration in draft status so that I can fill in details incrementally before submitting.

*Acceptance Criteria:*
- Given I am authenticated as `partner_rep` or `partner_admin`, when I POST to `/api/v1/deals` with valid customer and deal fields, then a deal is created with `status=draft`, `organization_id` set to my org, `submitted_by` set to my user ID, and a `deal_number` in format `DR-YYYY-NNNNN` is auto-generated.
- Given I provide `estimated_value`, `customer_company_name`, and `deal_name`, when I create the deal, then the response includes the complete deal object with all defaults applied.
- Given I omit `estimated_value`, `customer_company_name`, or `deal_name`, when I POST, then I receive a 422 with field-level validation errors.

**US-DR-002: Update Deal Draft** (P0)
As a partner rep, I want to update a draft deal's fields so that I can refine the opportunity details before submission.

*Acceptance Criteria:*
- Given a deal in `draft` status that I created, when I PATCH `/api/v1/deals/:id` with valid fields, then the deal is updated and `updated_at` is refreshed.
- Given a deal in `submitted` or later status, when I attempt to PATCH, then I receive a 422 with code `DEAL_INVALID_TRANSITION` and message explaining that only draft deals can be edited.
- Given a deal created by another user in my org, when I am a `partner_admin`, then I CAN update it. When I am a `partner_rep`, then I CANNOT (403).

**US-DR-003: Submit Deal for Review** (P0)
As a partner rep, I want to submit a draft deal for channel manager review so that I can get deal protection.

*Acceptance Criteria:*
- Given a deal in `draft` status with all required fields populated (customer_company_name, deal_name, estimated_value, expected_close_date), when I POST `/api/v1/deals/:id/submit`, then the status changes to `submitted`.
- Given a deal in `draft` status missing `expected_close_date`, when I submit, then I receive 422 with a message listing the missing required fields.
- Given submission succeeds, then: (a) conflict detection runs automatically, (b) if conflicts found, `is_conflicting=true` and `conflict_deal_id` is set to the strongest match, (c) an `approval_request` is created with `assigned_to` set to the org's `channel_manager_id`, (d) a notification is created for the channel manager, (e) a `deal_status_history` record is inserted.
- Given the org has no `channel_manager_id` set, when I submit, then the `approval_request.assigned_to` falls back to any user with role `admin`.

**US-DR-004: Pre-Submission Conflict Check** (P1)
As a partner rep, I want to check for conflicts before fully filling out a deal so that I don't waste time on a registration that will be rejected.

*Acceptance Criteria:*
- Given I call `GET /api/v1/deals/conflict-check?customer_company=Acme+Corp&customer_email=john@acme.com&product_id=xxx`, then I receive a list of conflicting deals (if any) with `match_type`, `similarity_score`, `conflicting_deal_number`, and `conflicting_org_name`.
- Given no conflicts exist, then I receive an empty array.
- Given I am a partner user, then conflicting deal details do NOT include `submitted_by` name or internal notes -- only the deal number, org name, match type, and similarity score.

---

### 4.2 Deal Review and Approval

**US-DR-005: List Deals for Review** (P0)
As a channel manager, I want to see all submitted deals for my assigned organizations so that I can review them.

*Acceptance Criteria:*
- Given I am a `channel_manager`, when I GET `/api/v1/deals?status=submitted`, then I see only deals from organizations where I am the assigned `channel_manager_id`.
- Given I filter with `?status=submitted&sort=created_at:asc`, then deals are sorted oldest-first (FIFO review queue).
- Given I am a `partner_rep`, when I GET `/api/v1/deals`, then I see only deals from my own organization.

**US-DR-006: Approve Deal** (P0)
As a channel manager, I want to approve a deal registration so that the partner gets deal protection.

*Acceptance Criteria:*
- Given a deal in `submitted` or `under_review` status, when I POST `/api/v1/deals/:id/approve` with optional `{ "comments": "..." }`, then: (a) status changes to `approved`, (b) `approved_by` is set to my user ID, (c) `approved_at` is set to current timestamp, (d) `registration_expires_at` is set to `NOW() + 90 days`, (e) a notification is created for the submitting partner, (f) a `deal_status_history` record is inserted, (g) the `approval_request` is updated with `action=approve` and `decided_at`.
- Given the deal has `is_conflicting=true`, approval still succeeds (CM overrides the conflict). The `comments` field should document the conflict resolution rationale.
- Given the deal belongs to an org NOT assigned to me, when I am a `channel_manager`, then I receive 403.
- Given I am an `admin`, then I CAN approve deals from any org.

**US-DR-007: Reject Deal** (P0)
As a channel manager, I want to reject a deal registration with a reason so that the partner understands why and can revise.

*Acceptance Criteria:*
- Given a deal in `submitted` or `under_review` status, when I POST `/api/v1/deals/:id/reject` with `{ "rejection_reason": "..." }`, then: (a) status changes to `rejected`, (b) `rejection_reason` is stored, (c) a notification is created for the submitting partner including the rejection reason, (d) a `deal_status_history` record is inserted, (e) the `approval_request` is updated with `action=reject`.
- Given `rejection_reason` is empty or missing, then I receive 422.

**US-DR-008: Resubmit Rejected Deal** (P1)
As a partner rep, I want to revise a rejected deal and resubmit it so that I can address the channel manager's feedback.

*Acceptance Criteria:*
- Given a deal in `rejected` status, when I PATCH it with updated fields, then the update succeeds (rejected deals are editable like drafts).
- Given a deal in `rejected` status, when I POST `/api/v1/deals/:id/submit`, then the status changes to `submitted`, `is_conflicting` is recalculated, a new `approval_request` is created, and the CM is notified again.
- Given a deal in `rejected` status, `rejection_reason` is preserved until the deal is re-approved, at which point it is cleared.

---

### 4.3 Deal Outcomes

**US-DR-009: Mark Deal Won** (P0)
As a partner rep, I want to mark an approved deal as won so that my revenue is tracked and my org's tier metrics are updated.

*Acceptance Criteria:*
- Given a deal in `approved` status, when I POST `/api/v1/deals/:id/mark-won` with `{ "actual_value": 150000, "actual_close_date": "2026-04-15" }`, then: (a) status changes to `won`, (b) `actual_value` and `actual_close_date` are stored, (c) a `deal_status_history` record is inserted, (d) the organization's `ytd_revenue` is incremented by `actual_value`, (e) `ytd_deals_closed` is incremented by 1, (f) `recalculateTier()` is called for the org, (g) a notification is sent to the CM.
- Given `actual_value` is missing, then I receive 422.
- Given `actual_close_date` is missing, it defaults to today.

**US-DR-010: Mark Deal Lost** (P0)
As a partner rep, I want to mark an approved deal as lost with a reason so that the pipeline is accurate.

*Acceptance Criteria:*
- Given a deal in `approved` status, when I POST `/api/v1/deals/:id/mark-lost` with `{ "loss_reason": "Customer chose competitor" }`, then: (a) status changes to `lost`, (b) `loss_reason` is stored in `custom_fields.loss_reason`, (c) a `deal_status_history` record is inserted.
- Given `loss_reason` is empty, then I receive 422.

---

### 4.4 Deal Products

**US-DR-011: Add Product to Deal** (P0)
As a partner rep, I want to add products to my deal so that the estimated value is calculated from line items.

*Acceptance Criteria:*
- Given a deal in `draft` or `rejected` status, when I POST `/api/v1/deals/:id/products` with `{ "product_id": "uuid", "quantity": 10, "unit_price": 5000, "discount_pct": 10 }`, then a `deal_products` row is inserted with `line_total` auto-computed as `quantity * unit_price * (1 - discount_pct/100)`.
- Given the product has `available_to_partners=false` or `is_active=false`, then I receive 422 with code `DEAL_PRODUCT_UNAVAILABLE`.
- Given the same `product_id` already exists on this deal, then I receive 409 with code `DEAL_DUPLICATE_PRODUCT`.
- After adding a product, the deal's `estimated_value` is recalculated as `SUM(deal_products.line_total)`.

**US-DR-012: Remove Product from Deal** (P1)
As a partner rep, I want to remove a product from my deal so that I can correct mistakes.

*Acceptance Criteria:*
- Given a deal in `draft` or `rejected` status, when I DELETE `/api/v1/deals/:id/products/:productId`, then the `deal_products` row is deleted and `estimated_value` is recalculated.
- Given this is the last product on the deal, deletion still succeeds -- `estimated_value` remains at its manually-set value (does not drop to 0 unless the user explicitly sets it). The `estimated_value` field on the deal is the source of truth; line items contribute to it but do not solely determine it.
- Given a deal in `submitted` or later status (except `rejected`), when I try to remove a product, then I receive 422.

---

### 4.5 Conflict Detection

**US-DR-013: Automatic Conflict Detection on Submit** (P0)
As a channel manager, I want deals to be automatically checked for conflicts on submission so that I am aware of potential channel conflicts before reviewing.

*Acceptance Criteria:*
- Given Partner A submits a deal for customer email `john@acme.com` and Partner B has an approved deal for the same email, then Partner A's deal is flagged `is_conflicting=true` with `match_type=exact_email`.
- Given Partner A submits a deal for "Acme Corporation" and Partner B has an approved deal for "Acme Corp" (similarity > 0.4), then the conflict is flagged with `match_type=fuzzy_company`.
- Given two deals from the SAME organization target the same customer, then NO conflict is flagged (same-org deals are excluded from conflict detection by filtering `organization_id != submitting_org_id` at the application layer, since the DB function `find_deal_conflicts` does not filter by org).
- Given a conflict exists with a deal in `rejected`, `lost`, or `expired` status, then NO conflict is flagged (these statuses are excluded by the DB function's WHERE clause).
- Given a conflict exists with an approved deal whose `registration_expires_at < NOW()`, then NO conflict is flagged (expired protection windows are excluded).

**US-DR-014: View Deal Conflicts** (P1)
As a channel manager, I want to see the conflict details for a flagged deal so that I can make an informed approval decision.

*Acceptance Criteria:*
- Given a deal with `is_conflicting=true`, when I GET `/api/v1/deals/:id/conflicts`, then I receive an array of conflicting deals with: `conflicting_deal_id`, `conflicting_deal_number`, `conflicting_org_name`, `match_type` (exact_email | exact_company | fuzzy_company | same_product_customer), and `similarity_score`.
- Given no conflicts, the array is empty.

---

### 4.6 Status History

**US-DR-015: View Deal Status History** (P0)
As a partner rep, I want to see the full audit trail of status changes on my deal so that I understand what happened and when.

*Acceptance Criteria:*
- Given a deal with status changes, when I GET `/api/v1/deals/:id/history`, then I receive an array of history records ordered by `created_at ASC`, each containing: `from_status`, `to_status`, `changed_by` (user ID), `changed_by_name` (first + last), `notes`, `created_at`.
- The initial creation (null -> draft) is recorded as the first history entry.

---

### 4.7 Deal Expiration

**US-DR-016: Auto-Expire Deals Past Protection Window** (P0)
As a system, I want to automatically expire deals whose 90-day protection window has passed so that the pipeline is accurate and customer exclusivity is released.

*Acceptance Criteria:*
- Given a deal with `status=approved` and `registration_expires_at < NOW()`, when the expiration job runs, then: (a) status changes to `expired`, (b) a `deal_status_history` record is inserted with `changed_by` set to a system user ID, (c) a notification is sent to the submitting partner and the assigned CM.
- Given multiple expired deals, all are processed in a single job run.
- The job does NOT expire deals in any status other than `approved`.

**US-DR-017: Send Expiration Reminders** (P1)
As a partner rep, I want to receive reminders before my deal protection expires so that I can close the deal or request an extension.

*Acceptance Criteria:*
- Given a deal with `status=approved` and `registration_expires_at` is between 13 and 15 days from now, when the reminder job runs, then a 14-day reminder notification is sent to the submitting partner.
- Given a deal with `status=approved` and `registration_expires_at` is between 6 and 8 days from now, when the reminder job runs, then a 7-day reminder notification is sent.
- Reminders are idempotent: if the job runs twice within the same window, duplicate notifications are NOT created. Use a check against existing notifications for the same `entity_type=deal`, `entity_id`, and a `title` pattern match, or store a `reminder_sent_at_14d` / `reminder_sent_at_7d` flag in `custom_fields`.

**US-DR-018: View Expiring Deals** (P1)
As a channel manager, I want to see deals that are about to expire so that I can follow up with partners.

*Acceptance Criteria:*
- Given I GET `/api/v1/deals/expiring?days=14`, then I receive all approved deals where `registration_expires_at` is within the next 14 days, scoped to my assigned organizations.
- Default `days` is 30 if not provided.

---

### 4.8 Data Scoping

**US-DR-019: Partner Data Isolation** (P0)
As a system, I want to ensure partners can only access their own organization's deals so that confidential pipeline data is protected.

*Acceptance Criteria:*
- Given I am `partner_rep` at Org A, when I GET `/api/v1/deals`, then I see only Org A's deals.
- Given I am `partner_rep` at Org A, when I GET `/api/v1/deals/:id` for a deal belonging to Org B, then I receive 404 (not 403, to avoid leaking existence).
- Given I am `channel_manager`, when I GET `/api/v1/deals`, then I see deals only from organizations where `channel_manager_id = my user ID`.
- Given I am `admin`, I see all deals across all organizations.

---

## 5. State Machine

### 5.1 Deal Status Transitions

```
                                    +-----------+
                                    |   draft   |
                                    +-----+-----+
                                          |
                                    submit (partner)
                                    [required fields valid]
                                          |
                                          v
                                    +-----------+
                     +------------- | submitted | -------------+
                     |              +-----+-----+              |
                     |                    |                     |
               reject (CM)         review (CM)          (auto if CM
               [reason required]   [optional]            opens detail)
                     |                    |                     |
                     v                    v                     |
               +-----------+      +--------------+             |
               | rejected  |      | under_review |             |
               +-----+-----+      +------+------+             |
                     |                    |                     |
               resubmit (partner)   approve / reject (CM)      |
               [edits allowed]      [same as from submitted]   |
                     |                    |                     |
                     +-----> submitted <--+                    |
                                          |                    |
                                    approve (CM)               |
                                    [sets expires_at]          |
                                          |                    |
                                          v                    |
                                    +-----------+              |
                          +-------> | approved  | <------------+
                          |         +--+--+--+--+
                          |            |  |  |
                   (extension)    won  | lost | expire (system)
                          |       (p)  |  (p) | [expires_at < now]
                          |            |  |    |
                          |            v  v    v
                          |      +---+ +---+ +---------+
                          |      |won| |lost| | expired |
                          |      +---+ +---+ +---------+
                          |
                          +-- (Future: extension request re-enters approval)
```

### 5.2 Valid Transitions Table

| From Status    | To Status      | Actor                | Guards / Side Effects                                                  |
|----------------|----------------|----------------------|------------------------------------------------------------------------|
| *(null)*       | `draft`        | partner_rep, partner_admin | On deal creation                                                  |
| `draft`        | `submitted`    | partner_rep, partner_admin | Required fields validated; conflict detection runs; approval_request created; CM notified |
| `submitted`    | `under_review` | channel_manager, admin | Optional transition when CM opens the deal for review                |
| `submitted`    | `approved`     | channel_manager, admin | Sets `approved_by`, `approved_at`, `registration_expires_at`; partner notified |
| `submitted`    | `rejected`     | channel_manager, admin | `rejection_reason` required; partner notified                        |
| `under_review` | `approved`     | channel_manager, admin | Same as submitted -> approved                                        |
| `under_review` | `rejected`     | channel_manager, admin | Same as submitted -> rejected                                        |
| `rejected`     | `submitted`    | partner_rep, partner_admin | Re-runs conflict detection; new approval_request; CM notified        |
| `approved`     | `won`          | partner_rep, partner_admin | `actual_value` required; updates org revenue metrics; triggers tier recalc |
| `approved`     | `lost`         | partner_rep, partner_admin | `loss_reason` required                                               |
| `approved`     | `expired`      | system (background job) | `registration_expires_at < NOW()`; partner and CM notified           |

### 5.3 Invalid Transitions (must return 422 DEAL_INVALID_TRANSITION)

- `draft` -> `approved` (must go through submitted)
- `draft` -> `rejected` (must go through submitted)
- `draft` -> `won` / `lost` / `expired` (must go through approved)
- `submitted` -> `won` / `lost` (must go through approved)
- `rejected` -> `approved` (must resubmit first)
- `rejected` -> `won` / `lost` / `expired`
- `won` -> any (terminal state)
- `lost` -> any (terminal state)
- `expired` -> any (terminal state)

### 5.4 Transition Map Constant

Add to `src/config/constants.ts`:

```typescript
export const VALID_DEAL_TRANSITIONS: Record<string, string[]> = {
  draft: ['submitted'],
  submitted: ['under_review', 'approved', 'rejected'],
  under_review: ['approved', 'rejected'],
  approved: ['won', 'lost', 'expired'],
  rejected: ['submitted'],  // resubmit
  won: [],
  lost: [],
  expired: [],
};
```

---

## 6. API Contract

### 6.1 Create Deal

**POST** `/api/v1/deals`

**Auth:** `partner_admin`, `partner_rep`

**Request Body:**
```json
{
  "customer_company_name": "Acme Corporation",
  "customer_contact_name": "John Smith",
  "customer_contact_email": "john.smith@acme.com",
  "customer_contact_phone": "+1-555-0100",
  "customer_industry": "Financial Services",
  "customer_address": "123 Main St, New York, NY 10001",
  "deal_name": "Acme Corp - PA-5400 Network Refresh",
  "description": "Customer replacing legacy Cisco ASA firewalls with PA-5400 series across 3 data centers",
  "estimated_value": 450000,
  "currency": "USD",
  "win_probability": 65,
  "expected_close_date": "2026-06-30",
  "primary_product_id": "uuid-of-pa-5400",
  "source": "direct",
  "tags": ["competitive_replacement", "data_center"]
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "deal_number": "DR-2026-00042",
    "organization_id": "org-uuid",
    "submitted_by": "user-uuid",
    "assigned_to": null,
    "customer_company_name": "Acme Corporation",
    "customer_contact_name": "John Smith",
    "customer_contact_email": "john.smith@acme.com",
    "customer_contact_phone": "+1-555-0100",
    "customer_industry": "Financial Services",
    "customer_address": "123 Main St, New York, NY 10001",
    "deal_name": "Acme Corp - PA-5400 Network Refresh",
    "description": "Customer replacing legacy Cisco ASA firewalls...",
    "status": "draft",
    "estimated_value": 450000,
    "actual_value": null,
    "currency": "USD",
    "win_probability": 65,
    "expected_close_date": "2026-06-30",
    "actual_close_date": null,
    "registration_expires_at": null,
    "primary_product_id": "uuid-of-pa-5400",
    "is_conflicting": false,
    "conflict_deal_id": null,
    "conflict_notes": null,
    "approved_by": null,
    "approved_at": null,
    "rejection_reason": null,
    "source": "direct",
    "tags": ["competitive_replacement", "data_center"],
    "custom_fields": {},
    "created_at": "2026-03-18T14:30:00.000Z",
    "updated_at": "2026-03-18T14:30:00.000Z",
    "products": []
  },
  "meta": null,
  "errors": null
}
```

**Validation Errors (422):**
```json
{
  "success": false,
  "data": null,
  "errors": [
    { "code": "VALIDATION_ERROR", "message": "\"customer_company_name\" is required", "field": "customer_company_name" },
    { "code": "VALIDATION_ERROR", "message": "\"estimated_value\" must be greater than 0", "field": "estimated_value" }
  ]
}
```

---

### 6.2 Submit Deal

**POST** `/api/v1/deals/:id/submit`

**Auth:** `partner_admin`, `partner_rep` (own deal or own org for partner_admin)

**Request Body:** *(empty or optional)*
```json
{}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "deal-uuid",
    "deal_number": "DR-2026-00042",
    "status": "submitted",
    "is_conflicting": true,
    "conflict_deal_id": "conflicting-deal-uuid",
    "conflicts": [
      {
        "conflicting_deal_id": "conflicting-deal-uuid",
        "conflicting_deal_number": "DR-2026-00038",
        "conflicting_org_name": "CloudGuard Inc",
        "match_type": "fuzzy_company",
        "similarity_score": 0.72
      }
    ],
    "updated_at": "2026-03-18T14:35:00.000Z"
  },
  "meta": null,
  "errors": null
}
```

**Error -- Missing required fields (422):**
```json
{
  "success": false,
  "data": null,
  "errors": [
    { "code": "DEAL_INCOMPLETE", "message": "Deal cannot be submitted: missing required field 'expected_close_date'", "field": "expected_close_date" }
  ]
}
```

**Error -- Invalid transition (422):**
```json
{
  "success": false,
  "data": null,
  "errors": [
    { "code": "DEAL_INVALID_TRANSITION", "message": "Cannot transition from 'approved' to 'submitted'" }
  ]
}
```

---

### 6.3 Approve Deal

**POST** `/api/v1/deals/:id/approve`

**Auth:** `channel_manager` (assigned org), `admin`

**Request Body:**
```json
{
  "comments": "Conflict with DR-2026-00038 reviewed. Different use case (SD-WAN vs NGFW). Approved."
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "deal-uuid",
    "deal_number": "DR-2026-00042",
    "status": "approved",
    "approved_by": "cm-user-uuid",
    "approved_at": "2026-03-18T15:00:00.000Z",
    "registration_expires_at": "2026-06-16T15:00:00.000Z",
    "updated_at": "2026-03-18T15:00:00.000Z"
  },
  "meta": null,
  "errors": null
}
```

---

### 6.4 Reject Deal

**POST** `/api/v1/deals/:id/reject`

**Auth:** `channel_manager` (assigned org), `admin`

**Request Body:**
```json
{
  "rejection_reason": "Duplicate registration. CloudGuard Inc (DR-2026-00038) has an existing approved deal for this customer with higher engagement."
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "deal-uuid",
    "deal_number": "DR-2026-00042",
    "status": "rejected",
    "rejection_reason": "Duplicate registration. CloudGuard Inc (DR-2026-00038) has an existing approved deal for this customer with higher engagement.",
    "updated_at": "2026-03-18T15:05:00.000Z"
  },
  "meta": null,
  "errors": null
}
```

---

### 6.5 Conflict Check

**GET** `/api/v1/deals/conflict-check?customer_company=Acme+Corporation&customer_email=john@acme.com&product_id=uuid`

**Auth:** Any authenticated user

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "conflicting_deal_id": "deal-uuid-1",
      "conflicting_deal_number": "DR-2026-00038",
      "conflicting_org_name": "CloudGuard Inc",
      "match_type": "exact_email",
      "similarity_score": 1.0
    },
    {
      "conflicting_deal_id": "deal-uuid-2",
      "conflicting_deal_number": "DR-2026-00035",
      "conflicting_org_name": "NetSecure Partners",
      "match_type": "fuzzy_company",
      "similarity_score": 0.68
    }
  ],
  "meta": null,
  "errors": null
}
```

---

### 6.6 Mark Won

**POST** `/api/v1/deals/:id/mark-won`

**Auth:** `partner_admin`, `partner_rep` (own org), `channel_manager` (assigned org), `admin`

**Request Body:**
```json
{
  "actual_value": 425000,
  "actual_close_date": "2026-04-15"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "deal-uuid",
    "deal_number": "DR-2026-00042",
    "status": "won",
    "actual_value": 425000,
    "actual_close_date": "2026-04-15",
    "updated_at": "2026-04-15T10:00:00.000Z",
    "tier_recalculation": {
      "organization_id": "org-uuid",
      "old_tier": { "id": "tier-uuid-2", "name": "Innovator", "rank": 2 },
      "new_tier": { "id": "tier-uuid-3", "name": "Platinum Innovator", "rank": 3 },
      "changed": true
    }
  },
  "meta": null,
  "errors": null
}
```

---

### 6.7 Add Product to Deal

**POST** `/api/v1/deals/:id/products`

**Auth:** `partner_admin`, `partner_rep` (own org deal in draft/rejected status)

**Request Body:**
```json
{
  "product_id": "uuid-of-pa-5400",
  "quantity": 6,
  "unit_price": 75000,
  "discount_pct": 10
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "deal-product-uuid",
    "deal_id": "deal-uuid",
    "product_id": "uuid-of-pa-5400",
    "product_name": "PA-5400 Series",
    "product_sku": "PAN-PA-5400",
    "quantity": 6,
    "unit_price": 75000,
    "discount_pct": 10,
    "line_total": 405000,
    "deal_estimated_value": 405000
  },
  "meta": null,
  "errors": null
}
```

---

### 6.8 List Deals

**GET** `/api/v1/deals?status=approved&min_value=100000&sort=estimated_value:desc&page=1&per_page=25`

**Auth:** All authenticated (scoped by role)

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "deal-uuid",
      "deal_number": "DR-2026-00042",
      "organization_id": "org-uuid",
      "organization_name": "CyberShield Solutions",
      "submitted_by": "user-uuid",
      "submitted_by_name": "Jane Doe",
      "customer_company_name": "Acme Corporation",
      "deal_name": "Acme Corp - PA-5400 Network Refresh",
      "status": "approved",
      "estimated_value": 450000,
      "expected_close_date": "2026-06-30",
      "registration_expires_at": "2026-06-16T15:00:00.000Z",
      "is_conflicting": false,
      "product_count": 2,
      "created_at": "2026-03-18T14:30:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "per_page": 25,
    "total": 1,
    "total_pages": 1
  },
  "errors": null
}
```

**Supported query parameters:**
- `status` -- filter by deal status (single or comma-separated)
- `org_id` -- filter by organization (admin/CM only)
- `submitted_by` -- filter by submitter user ID
- `customer_company` -- partial match (ILIKE) on customer_company_name
- `min_value`, `max_value` -- estimated_value range
- `expected_close_before`, `expected_close_after` -- date range on expected_close_date
- `is_conflicting` -- boolean filter
- `search` -- searches across deal_number, deal_name, customer_company_name
- `sort` -- field:direction (e.g., `estimated_value:desc`, `created_at:asc`)
- `page`, `per_page` -- pagination (defaults from constants)

---

### 6.9 Get Deal Detail

**GET** `/api/v1/deals/:id`

**Auth:** All authenticated (scoped by role)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "deal-uuid",
    "deal_number": "DR-2026-00042",
    "organization_id": "org-uuid",
    "organization_name": "CyberShield Solutions",
    "submitted_by": "user-uuid",
    "submitted_by_name": "Jane Doe",
    "assigned_to": "cm-uuid",
    "assigned_to_name": "Mike Channel",
    "customer_company_name": "Acme Corporation",
    "customer_contact_name": "John Smith",
    "customer_contact_email": "john.smith@acme.com",
    "customer_contact_phone": "+1-555-0100",
    "customer_industry": "Financial Services",
    "customer_address": "123 Main St, New York, NY 10001",
    "deal_name": "Acme Corp - PA-5400 Network Refresh",
    "description": "Customer replacing legacy Cisco ASA firewalls...",
    "status": "approved",
    "estimated_value": 450000,
    "actual_value": null,
    "currency": "USD",
    "win_probability": 65,
    "expected_close_date": "2026-06-30",
    "actual_close_date": null,
    "registration_expires_at": "2026-06-16T15:00:00.000Z",
    "primary_product_id": "uuid-of-pa-5400",
    "is_conflicting": true,
    "conflict_deal_id": "conflicting-deal-uuid",
    "conflict_notes": null,
    "approved_by": "cm-uuid",
    "approved_at": "2026-03-18T15:00:00.000Z",
    "rejection_reason": null,
    "source": "direct",
    "tags": ["competitive_replacement", "data_center"],
    "custom_fields": {},
    "created_at": "2026-03-18T14:30:00.000Z",
    "updated_at": "2026-03-18T15:00:00.000Z",
    "products": [
      {
        "id": "deal-product-uuid",
        "product_id": "uuid-of-pa-5400",
        "product_name": "PA-5400 Series",
        "product_sku": "PAN-PA-5400",
        "quantity": 6,
        "unit_price": 75000,
        "discount_pct": 10,
        "line_total": 405000
      }
    ]
  },
  "meta": null,
  "errors": null
}
```

---

## 7. Edge Cases and Error Scenarios

### 7.1 Conflict Detection Edge Cases

| # | Scenario | Expected Behavior |
|---|----------|-------------------|
| CD-1 | Same customer email, different company name | Flagged as `exact_email` match. Strongest match type -- highest priority in conflict list. |
| CD-2 | Similar company names: "Acme Corp" vs "Acme Corporation" | Flagged as `fuzzy_company` if `pg_trgm` similarity > 0.4. Similarity score returned so CM can judge. |
| CD-3 | Similar company names: "IBM" vs "IBM Global Services" | Likely similarity > 0.4 depending on pg_trgm. Flagged. CM decides. |
| CD-4 | Very different names: "Google" vs "Alphabet Inc" | Similarity < 0.4. NOT flagged. This is a known limitation -- brand vs legal entity names require manual oversight. |
| CD-5 | Same product + fuzzy company (similarity > 0.3 but < 0.4) | Flagged as `same_product_customer`. Lower similarity threshold because product overlap strengthens the signal. |
| CD-6 | Conflict with deal from SAME organization | NOT flagged. Application layer filters results to exclude `organization_id = submitting_org_id`. Multiple reps at the same partner can work the same customer. |
| CD-7 | Conflict with `expired` deal | NOT flagged. The DB function filters `status IN (submitted, under_review, approved, won)`. Expired deals have released their protection. |
| CD-8 | Conflict with `rejected` deal | NOT flagged. Rejected deals are not active registrations. |
| CD-9 | Conflict with `lost` deal | NOT flagged. Lost deals are not competing for the customer. |
| CD-10 | Conflict with approved deal whose `registration_expires_at` has passed but status hasn't been updated to `expired` yet (job hasn't run) | NOT flagged. The DB function checks `registration_expires_at > NOW()` regardless of status. |
| CD-11 | `customer_contact_email` is NULL on both deals | No email match (NULL != NULL in SQL). Only company name matching applies. |
| CD-12 | Conflict check with empty `customer_company` param | Return 422 -- `customer_company` is required for conflict check. |
| CD-13 | `primary_product_id` is NULL on submitting deal | Layer 4 (product + company overlap) is skipped. Layers 1-3 still run. |

### 7.2 Status Transition Edge Cases

| # | Scenario | Expected Behavior |
|---|----------|-------------------|
| ST-1 | Submit deal with `draft` status: `draft -> submitted` | Allowed. Conflict detection + approval request created. |
| ST-2 | Approve deal directly from `draft`: `draft -> approved` | 422 `DEAL_INVALID_TRANSITION`. Must submit first. |
| ST-3 | Mark won from `submitted`: `submitted -> won` | 422 `DEAL_INVALID_TRANSITION`. Must be approved first. |
| ST-4 | Reject a `rejected` deal again | 422 `DEAL_INVALID_TRANSITION`. Can only resubmit. |
| ST-5 | Resubmit from `rejected`: `rejected -> submitted` | Allowed. Re-runs conflict detection. Creates new approval_request. |
| ST-6 | Mark won on expired deal | 422 `DEAL_INVALID_TRANSITION`. Expired is terminal. |
| ST-7 | Mark lost on expired deal | 422 `DEAL_INVALID_TRANSITION`. Expired is terminal. |
| ST-8 | Mark won on deal that expired between CM reviewing and partner acting | The expiration job transitions the deal to `expired` before the partner acts. The mark-won call returns 422. Partner must register a new deal. |
| ST-9 | Two CMs simultaneously approve/reject the same deal | First write wins (optimistic concurrency). Second call gets 422 because the status has already changed. Check status in the WHERE clause of the UPDATE. |
| ST-10 | `under_review -> submitted` | 422 -- not a valid backward transition. CM must approve or reject. |

### 7.3 Deal Products Edge Cases

| # | Scenario | Expected Behavior |
|---|----------|-------------------|
| DP-1 | Add product with `available_to_partners=false` | 422 `DEAL_PRODUCT_UNAVAILABLE`. Product must be active and available to partners. |
| DP-2 | Add product with `is_active=false` | 422 `DEAL_PRODUCT_UNAVAILABLE`. |
| DP-3 | Add duplicate product (same product_id) to same deal | 409 `DEAL_DUPLICATE_PRODUCT`. DB UNIQUE constraint on (deal_id, product_id) enforces this. |
| DP-4 | Remove last product from deal | Allowed. The deal's `estimated_value` retains its current value (it was set manually or by previous line items). It does NOT reset to 0. If the user wants to change the estimated value, they PATCH the deal. |
| DP-5 | Add product to deal in `submitted` status | 422. Products can only be modified on `draft` or `rejected` deals. |
| DP-6 | `quantity` = 0 or negative | 422 validation error. Quantity must be >= 1. |
| DP-7 | `unit_price` = 0 | Allowed (e.g., bundled/free product). `line_total` will be 0. |
| DP-8 | `discount_pct` > 100 | 422 validation error. Discount must be between 0 and 100. |
| DP-9 | `discount_pct` = 100 | Allowed. Line total = 0 (fully discounted). |
| DP-10 | Estimated value recalculation after product add/remove | `UPDATE deals SET estimated_value = (SELECT COALESCE(SUM(line_total), 0) FROM deal_products WHERE deal_id = ?) WHERE id = ? AND (SELECT COUNT(*) FROM deal_products WHERE deal_id = ?) > 0`. Only updates if there are products; otherwise leaves estimated_value unchanged. |

### 7.4 Approval Edge Cases

| # | Scenario | Expected Behavior |
|---|----------|-------------------|
| AP-1 | CM approves deal from unassigned org | 403 via scopeToOrg middleware. The CM's `assignedOrgIds` does not include the deal's `organization_id`. Returns 404 (because scoped query finds nothing). |
| AP-2 | Partner tries to approve own deal | 403 via `authorize('channel_manager', 'admin')` on the approve route. Partners do not have the approve role. |
| AP-3 | CM approves already-expired deal | The deal's status is `expired` (a terminal state). Returns 422 `DEAL_INVALID_TRANSITION` because `expired` has no valid transitions. |
| AP-4 | CM approves deal that was already approved | Returns 422 `DEAL_INVALID_TRANSITION` because `approved -> approved` is not a valid transition. |
| AP-5 | Admin approves deal from any org | Allowed. Admin has scope `type: 'all'` and is authorized for the approve role. |
| AP-6 | CM rejects without providing `rejection_reason` | 422 validation error. Rejection reason is required. |
| AP-7 | Approving a deal with conflicts | Allowed. `is_conflicting` flag remains true but the deal is approved. CM's comments should document the conflict resolution. |

### 7.5 Protection Window Edge Cases

| # | Scenario | Expected Behavior |
|---|----------|-------------------|
| PW-1 | Deal expires exactly at midnight | The expiration job compares `registration_expires_at < NOW()`. A deal expiring at `2026-06-16T00:00:00Z` will be expired by the 6 AM job run on 2026-06-16 (since `00:00 < 06:00`). |
| PW-2 | Partner marks won 1 second before expiration | If the mark-won request is processed before the expiration job runs, the deal transitions to `won` (terminal state) and the expiration job skips it. Race condition is handled by the status check: expiration job only processes `status=approved` deals. |
| PW-3 | Partner actions on expired deal (update, mark-won, mark-lost) | All return 422 `DEAL_INVALID_TRANSITION`. Expired is terminal. Partner must register a new deal. |
| PW-4 | Extension request | Phase 2 does NOT implement extension requests. This is a future enhancement. For now, expired deals require a new registration. |
| PW-5 | `registration_expires_at` is NULL on approved deal | This should never happen -- the approve handler always sets it. If it does occur (data issue), the expiration job skips it (`registration_expires_at < NOW()` is FALSE for NULL). The deal lives indefinitely until manually addressed. |

### 7.6 Data Scoping Edge Cases

| # | Scenario | Expected Behavior |
|---|----------|-------------------|
| DS-1 | Partner A queries for Partner B's deal by ID | Returns 404 (not 403). The scoped query `WHERE organization_id = A's org` returns no rows. |
| DS-2 | CM queries for deal in unassigned org | Returns 404. The scoped query `WHERE organization_id IN (assignedOrgIds)` excludes it. |
| DS-3 | partner_rep tries to update deal created by another rep in same org | 403. Partner reps can only update deals they created (`submitted_by = req.user.sub`). |
| DS-4 | partner_admin updates deal created by a rep in their org | Allowed. Partner admins can manage all deals in their org. |
| DS-5 | User with no organization_id | 403 from scopeToOrg middleware: "User is not associated with an organization". |

### 7.7 Notification Triggers

| # | Event | Recipients | Notification Type | Title Template |
|---|-------|-----------|-------------------|----------------|
| NT-1 | Deal submitted | Org's channel_manager (or admin fallback) | `deal_update` | "New deal registration: {deal_number}" |
| NT-2 | Deal submitted with conflicts | Same as NT-1 | `deal_update` | "New deal registration with conflicts: {deal_number}" |
| NT-3 | Deal approved | `submitted_by` user | `deal_update` | "Deal {deal_number} approved - 90-day protection active" |
| NT-4 | Deal rejected | `submitted_by` user | `deal_update` | "Deal {deal_number} rejected: {rejection_reason_preview}" |
| NT-5 | Deal marked won | Org's channel_manager | `deal_update` | "Deal {deal_number} closed won: ${actual_value}" |
| NT-6 | 14-day expiration warning | `submitted_by` user | `deal_update` | "Deal {deal_number} expires in 14 days" |
| NT-7 | 7-day expiration warning | `submitted_by` user | `deal_update` | "Deal {deal_number} expires in 7 days" |
| NT-8 | Deal expired | `submitted_by` user + org's channel_manager | `deal_update` | "Deal {deal_number} has expired" |

---

## 8. Background Job Specifications

### 8.1 Deal Expiration Job

**File:** `src/jobs/dealExpiration.job.ts`
**Schedule:** Daily at 6:00 AM UTC (via node-cron: `0 6 * * *`)
**Queue:** Bull queue `deal-expiration`

**Logic:**
```
1. Query: SELECT id, deal_number, submitted_by, organization_id
          FROM deals
          WHERE status = 'approved'
            AND registration_expires_at < NOW()

2. For each expired deal:
   a. UPDATE deals SET status = 'expired' WHERE id = ? AND status = 'approved'
      -- The AND status = 'approved' guard prevents race conditions
      -- If 0 rows affected, skip (deal was already transitioned)

   b. INSERT INTO deal_status_history (deal_id, from_status, to_status, changed_by, notes)
      VALUES (?, 'approved', 'expired', SYSTEM_USER_ID, 'Auto-expired: protection window elapsed')

   c. Create notification for submitted_by user (NT-8)
   d. Create notification for org's channel_manager (NT-8)

3. Log: "Deal expiration job completed. Expired {count} deals."
```

**Error Handling:**
- Each deal is processed independently. If one fails, log the error and continue.
- Job-level errors are caught and logged but do not crash the worker.
- Failed deals are retried on the next daily run (they will still match the query).

**System User:**
- The `changed_by` field requires a valid user UUID. Create a seed user with `email: system@prm-portal.internal`, `role: admin`, `first_name: System`, `last_name: Automation` to use as `SYSTEM_USER_ID` in background jobs.

### 8.2 Deal Expiration Reminder Job

**File:** `src/jobs/dealExpirationReminder.job.ts`
**Schedule:** Daily at 7:00 AM UTC (via node-cron: `0 7 * * *`)
**Queue:** Bull queue `deal-expiration-reminder`

**Logic:**
```
1. 14-day reminders:
   SELECT id, deal_number, submitted_by, registration_expires_at
   FROM deals
   WHERE status = 'approved'
     AND registration_expires_at BETWEEN NOW() + INTERVAL '13 days' AND NOW() + INTERVAL '15 days'

   For each deal:
   a. Check if 14-day reminder already sent:
      SELECT COUNT(*) FROM notifications
      WHERE entity_type = 'deal' AND entity_id = deal.id
        AND title LIKE '%expires in 14 days%'
   b. If not sent, create notification (NT-6)

2. 7-day reminders:
   SELECT id, deal_number, submitted_by, registration_expires_at
   FROM deals
   WHERE status = 'approved'
     AND registration_expires_at BETWEEN NOW() + INTERVAL '6 days' AND NOW() + INTERVAL '8 days'

   For each deal:
   a. Check if 7-day reminder already sent (same pattern as above)
   b. If not sent, create notification (NT-7)

3. Log: "Reminder job completed. Sent {14d_count} 14-day and {7d_count} 7-day reminders."
```

**Idempotency:** The duplicate check ensures that if the job runs multiple times in the same window (or if it recovers from a failure), duplicate notifications are not created.

---

## 9. Functional Requirements Reference

### Deal CRUD

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-DR-001 | Create deal in draft status with auto-generated deal_number | P0 |
| FR-DR-002 | Update deal fields (draft and rejected status only) | P0 |
| FR-DR-003 | Submit deal: draft -> submitted with validation + conflict detection | P0 |
| FR-DR-004 | Approve deal: submitted/under_review -> approved with 90-day protection | P0 |
| FR-DR-005 | Reject deal: submitted/under_review -> rejected with required reason | P0 |
| FR-DR-006 | Mark won: approved -> won with actual_value + tier recalculation | P0 |
| FR-DR-007 | Mark lost: approved -> lost with required loss_reason | P0 |
| FR-DR-008 | Resubmit rejected deal: rejected -> submitted | P1 |
| FR-DR-009 | Transition to under_review when CM views submitted deal | P2 |
| FR-DR-010 | List deals with filtering, sorting, pagination, org scoping | P0 |
| FR-DR-011 | Get deal detail with products, org name, user names | P0 |
| FR-DR-012 | Delete deal (draft status only, soft-delete optional) | P2 |

### Conflict Detection

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-CD-001 | Run conflict detection on deal submission using find_deal_conflicts() | P0 |
| FR-CD-002 | Pre-submission conflict check via GET /deals/conflict-check | P1 |
| FR-CD-003 | View conflicts for existing deal via GET /deals/:id/conflicts | P1 |
| FR-CD-004 | Exclude same-org deals from conflict results | P0 |
| FR-CD-005 | Exclude expired/rejected/lost deals from conflict detection | P0 |
| FR-CD-006 | Store conflict flag + strongest match on deal record | P0 |

### Deal Products

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-DP-001 | Add product to deal (draft/rejected status only) | P0 |
| FR-DP-002 | Remove product from deal (draft/rejected status only) | P1 |
| FR-DP-003 | Auto-recalculate estimated_value from line totals | P0 |
| FR-DP-004 | Validate product is active and available_to_partners | P0 |
| FR-DP-005 | Prevent duplicate product on same deal | P0 |

### Status History

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-SH-001 | Insert deal_status_history on every status change | P0 |
| FR-SH-002 | GET /deals/:id/history returns ordered audit trail | P0 |
| FR-SH-003 | Record initial creation as null -> draft | P1 |

### Expiration

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-EX-001 | Background job expires approved deals past registration_expires_at | P0 |
| FR-EX-002 | 14-day and 7-day expiration reminder notifications | P1 |
| FR-EX-003 | GET /deals/expiring endpoint for CM | P1 |
| FR-EX-004 | Reminder idempotency (no duplicate notifications) | P1 |

### Notifications (minimal for Phase 2)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-NT-001 | createNotification() helper inserts into notifications table | P0 |
| FR-NT-002 | Notify CM on deal submission | P0 |
| FR-NT-003 | Notify partner on deal approval | P0 |
| FR-NT-004 | Notify partner on deal rejection | P0 |
| FR-NT-005 | Notify partner + CM on deal expiration | P1 |
| FR-NT-006 | Notify partner on expiration warnings (14d, 7d) | P1 |
| FR-NT-007 | Notify CM on deal marked won | P2 |

---

## 10. Non-Functional Requirements

### Security
- **NFR-SEC-001:** All deal endpoints require JWT authentication (existing `authenticate` middleware).
- **NFR-SEC-002:** Role-based authorization enforced on approve/reject endpoints (`channel_manager`, `admin` only).
- **NFR-SEC-003:** Data scoping enforced via `scopeToOrg` middleware on all deal queries.
- **NFR-SEC-004:** Deal detail returns 404 (not 403) when user lacks access to prevent information leakage.

### Performance
- **NFR-PERF-001:** Deal list queries must return within 200ms for up to 10,000 deals with standard filters.
- **NFR-PERF-002:** Conflict detection (find_deal_conflicts) must return within 500ms for up to 50,000 deals. The `gin_trgm_ops` index on `customer_company_name` supports this.
- **NFR-PERF-003:** Deal expiration job must complete within 60 seconds for up to 1,000 expired deals.

### Reliability
- **NFR-REL-001:** Deal status transitions use optimistic concurrency: the UPDATE WHERE clause includes the expected current status.
- **NFR-REL-002:** Background jobs are idempotent and can be safely re-run.
- **NFR-REL-003:** If conflict detection fails (e.g., pg_trgm extension issue), deal submission still succeeds but `is_conflicting` defaults to false with a warning logged.

### Maintainability
- **NFR-MAINT-001:** Follow existing Phase 1 patterns: repository for data access, service for business logic, thin controller.
- **NFR-MAINT-002:** Validation schemas defined in `src/validators/deal.validator.ts` using Joi (matching Phase 1 convention).
- **NFR-MAINT-003:** `VALID_DEAL_TRANSITIONS` map defined in `src/config/constants.ts` alongside existing `VALID_ORG_TRANSITIONS`.

---

## 11. Implementation Phases (Sub-Phases for Architecture Agent)

### Sub-Phase 2A: Deal Repository + Service Foundation (estimated: 15 min)
**Files to create:**
- `src/validators/deal.validator.ts` -- Joi schemas for create, update, submit, approve, reject, mark-won, mark-lost, add-product
- `src/repositories/deal.repository.ts` -- CRUD + list with filters + org scoping + deal_products joins + status history queries + conflict detection via raw SQL call to `find_deal_conflicts()`
- Add `VALID_DEAL_TRANSITIONS` to `src/config/constants.ts`

**Dependencies:** None (uses existing DB tables from migration 007)

### Sub-Phase 2B: Deal Service + Status Machine (estimated: 15 min)
**Files to create:**
- `src/services/deal.service.ts` -- createDeal, updateDeal, submitDeal (with conflict detection), approveDeal, rejectDeal, markWon, markLost, addProduct, removeProduct, getConflicts, getHistory, listExpiring
- Minimal `createNotification()` helper (can be in `src/services/notification.service.ts` or inline)

**Dependencies:** Sub-Phase 2A (repository)

### Sub-Phase 2C: Deal Controller + Routes (estimated: 10 min)
**Files to create:**
- `src/controllers/deal.controller.ts` -- thin handlers per endpoint
- `src/routes/deal.routes.ts` -- all deal endpoints with middleware chain

**Dependencies:** Sub-Phase 2B (service)

### Sub-Phase 2D: Background Jobs (estimated: 10 min)
**Files to create:**
- `src/jobs/dealExpiration.job.ts`
- `src/jobs/dealExpirationReminder.job.ts`
- Register both in existing job scheduler (if exists) or create `src/jobs/scheduler.ts`

**Dependencies:** Sub-Phase 2B (service, notification helper)

### Sub-Phase 2E: Unit Tests (estimated: 15 min)
**Files to create:**
- `tests/unit/services/deal.service.test.ts` -- test all status transitions (valid + invalid), conflict detection filtering, estimated_value recalculation, product validation
- `tests/unit/validators/deal.validator.test.ts` -- test validation schemas

**Dependencies:** Sub-Phases 2A-2C

---

## 12. QA Handoff Checklist

### Deal Lifecycle Tests

- [ ] **QA-001:** Create deal as `partner_rep` -> verify status=draft, deal_number format, org_id matches user's org
- [ ] **QA-002:** Create deal as `admin` -> verify 403 (admin cannot create deals, only partner roles)
- [ ] **QA-003:** Update draft deal -> verify fields changed, updated_at refreshed
- [ ] **QA-004:** Update submitted deal -> verify 422 DEAL_INVALID_TRANSITION
- [ ] **QA-005:** Submit deal with all required fields -> verify status=submitted, conflict check ran, approval_request created
- [ ] **QA-006:** Submit deal missing expected_close_date -> verify 422 with field error
- [ ] **QA-007:** Submit deal that has conflicts -> verify is_conflicting=true, conflict_deal_id set, conflicts array in response
- [ ] **QA-008:** Submit deal with NO conflicts -> verify is_conflicting=false
- [ ] **QA-009:** Approve submitted deal -> verify status=approved, approved_by, approved_at, registration_expires_at = now + 90 days
- [ ] **QA-010:** Reject submitted deal with reason -> verify status=rejected, rejection_reason stored
- [ ] **QA-011:** Reject deal without reason -> verify 422
- [ ] **QA-012:** Resubmit rejected deal -> verify status=submitted, new conflict check, new approval_request
- [ ] **QA-013:** Mark approved deal won with actual_value -> verify status=won, org ytd_revenue incremented, tier recalculated
- [ ] **QA-014:** Mark approved deal lost with loss_reason -> verify status=lost
- [ ] **QA-015:** Mark approved deal lost without loss_reason -> verify 422

### Invalid Transition Tests

- [ ] **QA-016:** draft -> approved -> verify 422
- [ ] **QA-017:** draft -> won -> verify 422
- [ ] **QA-018:** submitted -> won -> verify 422
- [ ] **QA-019:** rejected -> approved -> verify 422
- [ ] **QA-020:** won -> any status -> verify 422
- [ ] **QA-021:** lost -> any status -> verify 422
- [ ] **QA-022:** expired -> any status -> verify 422

### Conflict Detection Tests

- [ ] **QA-023:** Two deals, same customer email, different orgs -> conflict detected as exact_email
- [ ] **QA-024:** Two deals, exact same company name (case insensitive), different orgs -> conflict detected as exact_company
- [ ] **QA-025:** Two deals, similar company names (similarity > 0.4), different orgs -> conflict detected as fuzzy_company
- [ ] **QA-026:** Two deals, same product + similar company (similarity > 0.3 but < 0.4), different orgs -> conflict detected as same_product_customer
- [ ] **QA-027:** Two deals from SAME org -> NO conflict
- [ ] **QA-028:** Conflict with expired deal -> NO conflict
- [ ] **QA-029:** Conflict with rejected deal -> NO conflict
- [ ] **QA-030:** Conflict with approved deal past registration_expires_at -> NO conflict
- [ ] **QA-031:** Pre-submission conflict check (GET /deals/conflict-check) -> returns conflicts without creating a deal

### Deal Products Tests

- [ ] **QA-032:** Add product to draft deal -> verify deal_products row, line_total computed, estimated_value recalculated
- [ ] **QA-033:** Add same product twice -> verify 409
- [ ] **QA-034:** Add inactive product -> verify 422
- [ ] **QA-035:** Add product to submitted deal -> verify 422
- [ ] **QA-036:** Remove product from draft deal -> verify row deleted, estimated_value recalculated
- [ ] **QA-037:** Remove last product -> verify deal's estimated_value unchanged (not reset to 0)
- [ ] **QA-038:** Add product with quantity=0 -> verify 422
- [ ] **QA-039:** Add product with discount_pct=101 -> verify 422

### Data Scoping Tests

- [ ] **QA-040:** Partner A lists deals -> sees only Org A deals
- [ ] **QA-041:** Partner A GETs Org B deal by ID -> 404
- [ ] **QA-042:** CM lists deals -> sees only assigned org deals
- [ ] **QA-043:** CM approves unassigned org deal -> 404
- [ ] **QA-044:** Admin lists deals -> sees all deals
- [ ] **QA-045:** Admin approves any deal -> success
- [ ] **QA-046:** partner_rep updates deal created by different rep in same org -> 403
- [ ] **QA-047:** partner_admin updates deal created by rep in their org -> success

### Notifications Tests

- [ ] **QA-048:** Submit deal -> notification created for CM
- [ ] **QA-049:** Approve deal -> notification created for submitter
- [ ] **QA-050:** Reject deal -> notification created for submitter with rejection reason
- [ ] **QA-051:** Expire deal -> notifications for submitter + CM

### Background Job Tests

- [ ] **QA-052:** Create approved deal with registration_expires_at in the past -> run expiration job -> verify status=expired, history record created
- [ ] **QA-053:** Create approved deal with registration_expires_at 10 days from now -> run reminder job -> verify 7-day reminder NOT sent (outside window), 14-day reminder NOT sent (outside window)
- [ ] **QA-054:** Create approved deal with registration_expires_at 14 days from now -> run reminder job -> verify 14-day reminder sent
- [ ] **QA-055:** Run reminder job twice for same deal -> verify only 1 notification created (idempotency)
- [ ] **QA-056:** Deal marked won before expiration job runs -> expiration job skips it (status != approved)

### Status History Tests

- [ ] **QA-057:** Create deal -> verify history entry: null -> draft
- [ ] **QA-058:** Submit deal -> verify history entry: draft -> submitted
- [ ] **QA-059:** Approve deal -> verify history entry: submitted -> approved with CM's comments
- [ ] **QA-060:** GET /deals/:id/history -> verify ordered by created_at ASC, includes changed_by_name

---

## 13. Appendices

### A. Glossary

- **Deal Registration:** A partner's formal request to claim a customer opportunity for deal protection.
- **Deal Protection:** A time-limited (90-day) exclusive right to pursue a customer opportunity without competition from other partners in the same vendor's channel program.
- **Conflict Detection:** Automated matching of new deal registrations against existing active deals to identify potential channel conflict.
- **Channel Manager (CM):** An internal vendor employee responsible for managing a portfolio of partner organizations.
- **pg_trgm:** PostgreSQL extension for trigram-based fuzzy text matching. Used for company name similarity comparison.
- **Deal Number:** Human-readable identifier in format DR-YYYY-NNNNN (e.g., DR-2026-00042).

### B. Referenced Files

- Schema: `docs/001-schema.sql` (deals, deal_status_history, deal_products tables)
- API design: `docs/002-api-design.md` (Deal Registration section)
- Business logic: `docs/003-auth-and-business-logic.md` (Section 3.1: Deal Conflict Detection)
- Build plan: `docs/000-BUILD-PLAN.md` (Phase 2 section)
- Constants: `src/config/constants.ts` (DEAL_STATUSES, DEAL_PROTECTION_DAYS)
- Middleware: `src/middleware/scopeToOrg.ts` (applyOrgScope helper)
- Service pattern: `src/services/organization.service.ts` (Phase 1 reference implementation)
- Route pattern: `src/routes/organization.routes.ts` (Phase 1 reference implementation)
