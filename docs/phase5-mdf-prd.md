# Product Requirements Document: Phase 5 -- MDF (Market Development Funds)

**Version:** 2.0
**Last Updated:** 2026-03-19
**Document Owner:** PRM Portal Product Team
**Status:** Approved
**Depends On:** Phase 1 (Foundation), Phase 2 (Deal Registration -- revenue data), Phase 4 (Lead Distribution -- org performance)

---

## 1. Executive Summary and Vision

### Vision Statement

Give channel partners a self-service system to request, track, and claim marketing funds -- replacing spreadsheets and email chains with an auditable, tier-aware workflow that ties MDF spend to measurable revenue outcomes.

### Executive Summary

Market Development Funds (MDF), also called co-op funds, are the primary financial incentive a vendor uses to encourage partners to market and sell its products. In most channel programs (including Palo Alto Networks NextWave), the vendor allocates a quarterly budget to each partner proportional to the partner's revenue contribution and tier standing. Partners then submit requests describing planned marketing activities (events, webinars, digital campaigns), receive approval, execute the activity, and submit proof of execution to get reimbursed.

Phase 5 builds the full MDF lifecycle into the PRM Portal: automated quarterly allocation based on tier rules, a request/approval workflow, claim submission with file-upload proof of execution, and reimbursement tracking. Two background jobs handle deadline warnings and quarterly auto-allocation. Four frontend pages provide the user interface for all roles.

### What Already Exists

The following artifacts are complete and stable:

| File | Lines | Contents |
|------|-------|----------|
| `src/validators/mdf.validator.ts` | 107 | Joi schemas for all MDF operations |
| `src/repositories/mdf.repository.ts` | 471 | Full data access layer (allocations, requests, aggregates, job queries) |
| `client/src/api/mdf.ts` | 139 | Frontend API client with methods for all endpoints |
| `client/src/hooks/useMdf.ts` | 287 | TanStack Query hooks for all queries and mutations |
| Database tables | -- | `mdf_allocations`, `mdf_requests`, `approval_requests` (migrated) |
| Constants | -- | `VALID_MDF_TRANSITIONS`, `MDF_TIER_CAPS`, all MDF constants in `src/config/constants.ts` |

### What Needs to Be Built

1. `src/services/mdf.service.ts` -- All business logic
2. `src/controllers/mdf.controller.ts` -- Thin controller layer
3. `src/routes/mdf.routes.ts` -- Route definitions + mounting in `app.ts`
4. `src/jobs/mdfClaimDeadline.job.ts` -- Claim deadline warning notifications
5. `src/jobs/mdfQuarterlyAllocation.job.ts` -- Auto quarterly allocation generation
6. `client/src/pages/mdf/MdfAllocations.tsx` -- Allocation overview page
7. `client/src/pages/mdf/MdfRequestList.tsx` -- Request list page
8. `client/src/pages/mdf/MdfRequestForm.tsx` -- Create/edit request form
9. `client/src/pages/mdf/MdfRequestDetail.tsx` -- Request detail with claim submission

### Key Benefits

- **For partners**: Real-time visibility into available funds, remaining balance, and claim status -- no more emailing the channel manager to ask "how much do I have left?"
- **For channel managers**: Structured approval queue with full context (tier, allocation, history) instead of ad-hoc email threads. Partial approval support for budget trimming.
- **For admins**: Program-wide MDF utilization and automated allocation generation, eliminating quarterly spreadsheet exercises.
- **For the business**: Auditable proof-of-execution trail connecting MDF spend to partner activities, enabling ROI analysis in Phase 6 dashboards.

---

## 2. Problem Statement

### Current Challenges

**For partners (partner_admin):**
- No visibility into how much MDF budget they have until they ask their channel manager (typically via email or Slack).
- No standardized way to submit activity proposals -- requests arrive as email attachments in inconsistent formats.
- Claim reimbursement takes weeks because proof-of-execution documents get lost in email threads.
- Partners miss the 60-day claim deadline because there is no automated reminder.

**For channel managers:**
- Manually track allocation balances per partner in spreadsheets that drift out of sync.
- Approve/reject requests via email with no audit trail.
- Chase partners for proof of execution after activities end.
- Cannot easily see which partners are underutilizing their MDF budget.

**For admins (program leadership):**
- Quarterly allocation generation requires manual calculation for every partner.
- No aggregate view of MDF utilization across the partner program.
- Cannot correlate MDF spend with revenue impact without joining multiple spreadsheets.

### Why This Matters Now

Phases 1-4 have established the data foundation: organizations with tier assignments (Phase 1), closed-won deal revenue (Phase 2), and org performance metrics (Phase 4). MDF allocation depends on trailing revenue and tier -- both are now queryable. Building MDF now means the Phase 6 dashboards can include MDF utilization and ROI metrics from day one.

---

## 3. Goals and Success Metrics

### Business Goals

1. Automate quarterly MDF allocation for all eligible partners (eliminate manual spreadsheet step).
2. Reduce average MDF request-to-approval time from days (email) to hours (in-app).
3. Achieve 100% proof-of-execution capture for all reimbursed claims.

### User Goals

1. Partners can check their MDF balance and submit requests without contacting their channel manager.
2. Channel managers can approve/reject requests with one click from a structured queue.
3. Partners receive proactive reminders before the 60-day claim deadline expires.

### Success Metrics

#### Primary Metrics (P0)

| Metric | Baseline (pre-MDF) | Target (Phase 5 launch) |
|--------|---------------------|--------------------------|
| % of allocations generated automatically | 0% | 100% |
| Avg request-to-approval turnaround | N/A (no system) | < 48 hours |
| % of completed activities with claims submitted | N/A | > 80% |
| Claim deadline miss rate | Unknown | < 5% |

#### Secondary Metrics (P1)

- MDF utilization rate (spent / allocated) per quarter: target > 70% across program.
- Partner self-service rate (requests submitted without CM assistance): target > 90%.

#### Instrumentation Requirements

- Log every MDF status transition to `activity_feed` via `activityLogger` middleware.
- Track `claim_submitted_at` and `reimbursed_at` timestamps for turnaround measurement.
- Store `allocation.spent_amount` as denormalized running total for real-time balance queries.

---

## 4. Non-Goals and Boundaries

### Explicit Non-Goals

- **Multi-currency support**: All MDF amounts are in USD. Currency conversion is out of scope.
- **Budget forecasting / planning tools**: No predictive analytics for MDF spend. That belongs in a future BI layer.
- **Partner-to-partner fund transfer**: Allocations are per-org and non-transferable.
- **Approval delegation / escalation chains**: Channel manager is the single approver. No VP escalation ladder for MDF (unlike quote discounts).
- **Activity-type-specific budget pools**: e.g., "max 30% of allocation on trade shows" -- future enhancement.
- **Automated reimbursement payment**: The portal only tracks that reimbursement occurred. Actual payment processing is external.

### Phase 5 Boundaries

- File upload for proof of execution uses the existing S3/MinIO integration. Phase 5 implements the upload endpoint and stores URLs in `mdf_requests.proof_of_execution`. It does NOT build a general-purpose document management system (that is Phase 7 Content Library).
- MDF ROI analytics (spend vs. revenue generated per partner) is a Phase 6 dashboard concern. Phase 5 stores the data; Phase 6 queries it.

### Future Considerations (Post-MVP)

- Pre-approved activity templates that skip the approval step.
- Integration with accounting systems for automated reimbursement payment.
- Multi-currency support with exchange rate management.

---

## 5. User Personas and Use Cases

### Persona 1: Sarah, Partner Admin at CyberShield Solutions (Diamond Innovator)

**Role:** partner_admin
**Tier:** Diamond Innovator (rank 4, mdf_budget_pct = 6%)
**Trailing 4Q Revenue:** $3,200,000

**Goals:**
- Maximize MDF utilization each quarter to fund marketing activities that generate pipeline.
- Submit claims promptly after events to get reimbursed before quarter-end.

**Pain Points:**
- Loses track of which requests are still pending approval vs. already completed.
- Forgets to submit claims within the 60-day window.

**Use Cases:**
1. Sarah checks her Q2 2026 MDF balance: $192,000 allocated, $45,000 approved/spent, $147,000 remaining.
2. Sarah creates a draft MDF request for a $25,000 cybersecurity summit (trade_show, June 15-17). She edits the description, then submits it. The system validates: $25,000 <= $147,000 remaining, $25,000 <= 50% of $192,000 ($96,000), and start_date is 89 days away (>= 14 days). Request transitions to submitted.
3. After the summit, Sarah marks the activity complete, uploads 3 proof-of-execution files (event photos, attendee list PDF, invoice), and submits a claim for $23,500 (actual spend was under budget).

### Persona 2: Mike, Channel Manager

**Role:** channel_manager
**Assigned Orgs:** CyberShield, CloudGuard, NetSecure

**Goals:**
- Review and approve MDF requests quickly so partners can plan activities.
- Ensure MDF spend aligns with program priorities.

**Pain Points:**
- Multiple pending requests across partners with no unified queue.
- Needs to partially approve requests (reduce amount) when budgets are tight.

**Use Cases:**
1. Mike sees 3 pending MDF requests in his approval queue. He approves CyberShield's summit request for the full $25,000, partially approves CloudGuard's webinar series ($15,000 requested, $10,000 approved), and rejects NetSecure's print collateral request with reason "Digital campaigns preferred for Innovator tier."
2. After CyberShield submits their claim with proof of execution, Mike reviews the proof documents and approves the claim for $23,500.
3. Mike creates a manual allocation for a new partner that joined mid-quarter.

### Persona 3: Admin (Program Manager)

**Role:** admin (internal)

**Goals:**
- Generate quarterly MDF allocations for all partners automatically.
- Monitor program-wide MDF utilization.
- Process reimbursements after claims are approved.

**Use Cases:**
1. Admin triggers quarterly auto-allocation for Q3 2026. The system calculates each partner's allocation based on tier.mdf_budget_pct * trailing_4q_revenue, applies caps, and awards 20% bonuses to top-10% performers. Response shows 40 created, 10 skipped.
2. Admin marks an approved claim as "reimbursed" after finance confirms payment, recording the reimbursement_amount and timestamp.

### Persona 4: Jake, Partner Rep at CloudGuard Inc (Platinum Innovator)

**Role:** partner_rep
**Tier:** Platinum Innovator (rank 3, mdf_budget_pct = 4%)

**Goals:**
- See what marketing activities the org has funded.
- Understand available budget when planning customer events.

**Use Cases:**
1. Jake views the allocation overview page (read-only) to check remaining Q2 budget before proposing a customer event to his partner_admin.
2. Jake views the request list to see upcoming funded activities and their statuses.

**Note:** partner_rep is **read-only** for MDF. They can view allocations and requests for their org but cannot create, submit, or modify requests. They cannot view MDF allocation amounts directly -- only see their own org's requests.

---

## 6. Functional Requirements

### 6.1 MDF Allocation Management

**FR-MDF-001: Create Allocation** (P0)

Admin or channel manager creates a quarterly MDF allocation for a partner organization.

*Acceptance Criteria:*
- Given a valid org_id, fiscal_year, and fiscal_quarter, when admin POSTs to `/mdf/allocations`, then a new allocation record is created with `spent_amount = 0`.
- Given an allocation already exists for the same org + year + quarter, when admin POSTs, then the request is rejected with error code `MDF_ALLOCATION_EXISTS` (HTTP 409).
- Given the requesting user is a channel_manager, when they create an allocation for an org NOT in their assigned list, then return `403 AUTH_ORG_MISMATCH`.

*Validation Rules (from `mdf.validator.ts`):*
- `organization_id`: required, UUID.
- `fiscal_year`: required, integer, >= current year - 1.
- `fiscal_quarter`: required, integer 1-4.
- `allocated_amount`: required, numeric > 0.
- `notes`: optional string.

*Example:*
```json
// POST /api/v1/mdf/allocations
{
  "organization_id": "org-uuid-cybershield",
  "fiscal_year": 2026,
  "fiscal_quarter": 2,
  "allocated_amount": 192000.00,
  "notes": "Auto-calculated: 6% of $3.2M trailing revenue"
}
// Response 201:
{
  "success": true,
  "data": {
    "id": "alloc-uuid",
    "organization_id": "org-uuid-cybershield",
    "fiscal_year": 2026,
    "fiscal_quarter": 2,
    "allocated_amount": 192000.00,
    "spent_amount": 0.00,
    "remaining_amount": 192000.00,
    "currency": "USD",
    "notes": "Auto-calculated: 6% of $3.2M trailing revenue",
    "created_at": "2026-03-19T10:00:00Z"
  }
}
```

---

**FR-MDF-002: List Allocations** (P0)

Retrieve MDF allocations with org scoping and filters.

*Acceptance Criteria:*
- Given user is partner_admin/partner_rep, when they GET `/mdf/allocations`, then only their org's allocations are returned.
- Given user is channel_manager, when they GET `/mdf/allocations`, then only assigned orgs' allocations are returned.
- Given user is admin, when they GET `/mdf/allocations`, then all allocations are returned.
- Supports query params: `organization_id`, `fiscal_year`, `fiscal_quarter`, `page`, `per_page`, `sort`.
- Sort options: `created_at`, `fiscal_year`, `fiscal_quarter`, `allocated_amount`, `remaining_amount`.
- Default sort: `fiscal_year:desc`, `fiscal_quarter:desc`.

*Response:*
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "organization_id": "uuid",
      "organization_name": "Acme Security",
      "fiscal_year": 2026,
      "fiscal_quarter": 2,
      "allocated_amount": 25000.00,
      "spent_amount": 15000.00,
      "remaining_amount": 10000.00,
      "currency": "USD",
      "notes": null,
      "created_at": "2026-04-01T00:00:00Z",
      "updated_at": "2026-04-01T00:00:00Z"
    }
  ],
  "meta": { "page": 1, "per_page": 25, "total": 1, "total_pages": 1 }
}
```

---

**FR-MDF-003: Get Allocation Detail** (P0)

Retrieve a single allocation with computed `remaining_amount`.

*Acceptance Criteria:*
- Given a valid allocation ID, when user GETs `/mdf/allocations/:id`, then the response includes `allocated_amount`, `spent_amount`, `remaining_amount`, and `organization_name`.
- Given the allocation belongs to a different org and user is partner role, then return 404 (do not leak existence).

---

**FR-MDF-004: Update Allocation** (P1)

Admin or channel manager can adjust an allocation's `allocated_amount` or `notes`.

*Acceptance Criteria:*
- Given `allocated_amount` is updated to a value less than `spent_amount`, then reject with `MDF_ALLOCATION_UNDERFLOW` (HTTP 422) with message "Cannot reduce allocation below committed amount ($X already committed)".
- Given the update succeeds, then `remaining_amount` is recalculated automatically (PostgreSQL generated column).
- Channel_manager can only update allocations for assigned orgs.

---

**FR-MDF-005: Auto-Allocate** (P0)

Calculate and create quarterly allocations for all eligible organizations based on the allocation algorithm.

*Acceptance Criteria:*
- Given admin calls `POST /mdf/allocations/auto-allocate` with `{ fiscal_year, fiscal_quarter }`, then the system:
  1. Retrieves all active orgs with their tier via `repository.getActiveOrgsWithTier()`.
  2. Skips orgs where `tier.mdf_budget_pct = 0` or `MDF_TIER_CAPS[tier.name] = 0` (Registered tier).
  3. Skips orgs that already have an allocation for that year+quarter (checked via `findAllocationByOrgQuarter`).
  4. For each eligible org, calculates allocation per the algorithm in Section 7.
  5. Skips orgs with $0 trailing revenue (no allocation to create).
  6. Creates allocation records for all eligible orgs.
  7. Returns a summary.
- Admin-only endpoint. Channel_manager cannot trigger auto-allocate.

*Response:*
```json
{
  "success": true,
  "data": {
    "created": 40,
    "skipped_existing": 10,
    "skipped_no_revenue": 5,
    "skipped_no_mdf_tier": 3,
    "details": [
      {
        "org_id": "uuid",
        "org_name": "CyberShield Solutions",
        "tier_name": "Diamond Innovator",
        "trailing_revenue": 3200000.00,
        "base_allocation": 192000.00,
        "is_top_performer": false,
        "final_allocation": 192000.00,
        "status": "created"
      }
    ]
  }
}
```

---

### 6.2 MDF Request Lifecycle

**FR-MDF-010: Create Request (Draft)** (P0)

Partner_admin creates an MDF request in draft status.

*Acceptance Criteria:*
- Given a partner_admin, when they POST to `/mdf/requests` with `{ allocation_id, activity_type, activity_name, start_date, end_date, requested_amount }`, then a new request is created with `status = 'draft'` and auto-generated `request_number` (format: `MDF-2026-00001`, via database trigger).
- `organization_id` is set from `req.user.org_id` (not from request body -- enforced server-side).
- `submitted_by` is set from `req.user.sub`.
- The allocation must belong to the user's organization; otherwise return `404 MDF_ALLOCATION_NOT_FOUND`.
- partner_rep CANNOT create requests (role restriction at route level).
- Validation of amount against allocation happens at submit time, NOT at draft creation. Partners can draft any amount.

*Validation (from `createRequestSchema`):*
- `allocation_id`: required, UUID.
- `activity_type`: required, one of `['event', 'webinar', 'digital_campaign', 'print_collateral', 'trade_show', 'training', 'other']`.
- `activity_name`: required, 2-300 characters, trimmed.
- `description`: optional.
- `start_date`: required, ISO date.
- `end_date`: required, ISO date, >= `start_date`.
- `requested_amount`: required, numeric > 0.

---

**FR-MDF-011: Update Draft Request** (P1)

Owner can edit a request while it is in `draft` or `rejected` status.

*Acceptance Criteria:*
- Given request status is `draft` or `rejected`, when partner_admin PATCHes `/mdf/requests/:id`, then editable fields are updated.
- Given request status is anything else, then return `422 MDF_NOT_EDITABLE`.
- partner_rep CANNOT update requests.
- Editable fields: `activity_type`, `activity_name`, `description`, `start_date`, `end_date`, `requested_amount`.

---

**FR-MDF-012: Submit Request for Approval** (P0)

Partner_admin submits a draft or rejected request for channel manager review.

*Validation Rules (all enforced at submission time, not at draft creation):*

| Rule | Check | Error Code |
|------|-------|------------|
| Sufficient funds | `requested_amount <= allocation.remaining_amount` | `MDF_INSUFFICIENT_FUNDS` |
| Single request cap | `requested_amount <= 50% of allocation.allocated_amount` | `MDF_REQUEST_EXCEEDS_CAP` |
| Lead time | `start_date >= today + 14 days` | `MDF_ACTIVITY_TOO_SOON` |
| Valid status | Current status is `draft` or `rejected` | `MDF_INVALID_TRANSITION` |

*Concurrency Handling:*
```
BEGIN TRANSACTION
  1. SELECT allocation FOR UPDATE (row lock via findAllocationForUpdate)
  2. Validate requested_amount <= remaining_amount
  3. Validate requested_amount <= allocated_amount * 0.50
  4. UPDATE mdf_requests SET status = 'submitted' (via updateRequestStatusTrx)
  5. Do NOT adjust spent_amount -- funds are reserved only on approval
COMMIT
```

*On success:*
- Create `approval_request` record for the org's channel manager (via `createApprovalRequest`)
- Create notification for channel manager: type `mdf_update`, title "MDF Request {request_number} from {org_name}"

*Resubmission after rejection:*
- Status transitions: `rejected` -> `submitted`
- All validation rules are re-checked (allocation balance may have changed since initial submission)
- The `rejection_reason` field is preserved for reference until overwritten

*Given-When-Then Examples:*
- Given allocation has $50,000 remaining and partner requests $60,000, when they submit, then error `MDF_INSUFFICIENT_FUNDS` with message "Requested amount ($60,000.00) exceeds remaining allocation ($50,000.00)".
- Given start_date is 2026-03-25 and today is 2026-03-19 (6 days out), when they submit, then error `MDF_ACTIVITY_TOO_SOON`.
- Given allocation is $100,000 and request is $55,000, when they submit, then error `MDF_REQUEST_EXCEEDS_CAP` (55,000 > 50% of 100,000 = 50,000).
- Given two partner users submit simultaneously with combined amounts exceeding allocation, both submissions succeed (funds not committed yet), but only one can be approved to full amount.

---

**FR-MDF-013: Approve Request** (P0)

Channel manager or admin approves a submitted MDF request, optionally adjusting the approved amount.

*Acceptance Criteria:*
- Given request is in `submitted` status, when CM/admin POSTs to `/mdf/requests/:id/approve`:
  1. `approved_amount` is set (defaults to `requested_amount` if not provided).
  2. `approved_amount` must be > 0 and <= `requested_amount`. If exceeded, return `422 MDF_AMOUNT_EXCEEDS_REQUESTED`.
  3. `approved_amount` must be <= `allocation.remaining_amount` (re-validated under row lock). If exceeded, return `422 MDF_INSUFFICIENT_FUNDS`.
  4. Status transitions to `approved`.
  5. `allocation.spent_amount` is incremented by `approved_amount` atomically (via `adjustSpentAmount` with transaction).
  6. `reviewed_by` and `reviewed_at` are set.
  7. `approval_requests` record is updated (via `updateApprovalRequest`).
  8. Notification sent to the submitting partner.

*Concurrency Handling (critical path):*
```
BEGIN TRANSACTION
  1. SELECT allocation FOR UPDATE (row lock)
  2. Validate: approved_amount <= remaining_amount
  3. UPDATE allocation: spent_amount += approved_amount (via adjustSpentAmount)
  4. UPDATE request: status='approved', approved_amount, reviewed_by, reviewed_at
     (via updateRequestStatusTrx with fromStatus='submitted')
COMMIT
```

*Example (partial approval):*
```json
// POST /api/v1/mdf/requests/:id/approve
{
  "approved_amount": 20000.00,
  "comments": "Reduced budget for this quarter. Consider a virtual component."
}
```

---

**FR-MDF-014: Reject Request** (P0)

Channel manager or admin rejects a submitted MDF request.

*Acceptance Criteria:*
- Given request is in `submitted` status, when CM/admin POSTs to `/mdf/requests/:id/reject`:
  1. `rejection_reason` is required (from `rejectRequestSchema`).
  2. Status transitions to `rejected` (via `updateRequestStatus` with fromStatus='submitted').
  3. `reviewed_by` and `reviewed_at` are set.
  4. `approval_requests` record is updated.
  5. No funds are reserved (`spent_amount` unchanged).
  6. Notification sent to the submitting partner.
- The partner can edit (FR-MDF-011) and resubmit (FR-MDF-012) the rejected request.

---

**FR-MDF-015: Mark Activity Completed** (P0)

Partner_admin marks an approved activity as completed, unlocking claim submission.

*Acceptance Criteria:*
- Given request is in `approved` status, when partner_admin POSTs to `/mdf/requests/:id/complete`:
  1. Status transitions to `completed`.
  2. Notification sent to partner reminding them to submit claim within 60 days of `end_date`.
- The 60-day claim deadline clock runs from `end_date`, not the completion date.
- partner_rep CANNOT mark activities complete.

---

### 6.3 Claim and Reimbursement

**FR-MDF-020: Submit Claim** (P0)

Partner_admin submits a claim with proof of execution after completing the marketing activity.

*Validation Rules:*

| Rule | Check | Error Code |
|------|-------|------------|
| Valid status | Status is `completed` or `claim_rejected` | `MDF_INVALID_TRANSITION` |
| Amount within approved | `claim_amount > 0 AND claim_amount <= approved_amount` | `MDF_CLAIM_EXCEEDS_APPROVED` |
| Proof attached | `proof_of_execution.length >= 1` | `MDF_PROOF_REQUIRED` |
| Within deadline | `NOW() <= end_date + 60 days` | `MDF_DEADLINE_PASSED` |

*On success:*
- Status transitions to `claim_submitted`.
- Sets `claim_submitted_at`, `claim_amount`, `proof_of_execution`, `claim_notes`.
- Notification sent to channel manager.

*Request body (from `submitClaimSchema`):*
```json
{
  "claim_amount": 23500.00,
  "claim_notes": "Actual spend was $23,500. Invoice and attendee list attached.",
  "proof_of_execution": [
    "https://minio.example.com/mdf-proof/uuid/event-photos.pdf",
    "https://minio.example.com/mdf-proof/uuid/attendee-list.pdf",
    "https://minio.example.com/mdf-proof/uuid/invoice-12345.pdf"
  ]
}
```

*Claim resubmission after rejection:*
- Status transitions: `claim_rejected` -> `claim_submitted`
- Partner can update `claim_amount`, `proof_of_execution`, and `claim_notes`
- All validation rules re-apply, including the 60-day deadline from original `end_date`
- Rejection does NOT reset the deadline clock

---

**FR-MDF-021: Approve Claim** (P0)

Channel manager or admin approves a submitted claim, setting the reimbursement amount.

*Acceptance Criteria:*
- Given request is in `claim_submitted` status, when CM/admin POSTs to `/mdf/requests/:id/approve-claim`:
  1. `reimbursement_amount` is set (defaults to `claim_amount` if not provided).
  2. `reimbursement_amount` must be > 0.
  3. Status transitions to `claim_approved`.
  4. Notification sent to partner.
- Partial reimbursement is allowed (`reimbursement_amount < claim_amount`).
- The difference between `approved_amount` and `reimbursement_amount` is NOT automatically returned to the allocation. See Edge Case EC-07.

*Body (from `approveClaimSchema`):*
```json
{
  "reimbursement_amount": 5000.00,
  "comments": "Partial reimbursement - travel receipts not eligible"
}
```

---

**FR-MDF-022: Reject Claim** (P0)

Channel manager or admin rejects a submitted claim.

*Acceptance Criteria:*
- Given request is in `claim_submitted` status, when CM/admin POSTs to `/mdf/requests/:id/reject-claim`:
  1. `rejection_reason` is required (from `rejectClaimSchema`).
  2. Status transitions to `claim_rejected`.
  3. Notification sent to partner.
- Partner can resubmit the claim (FR-MDF-020, `claim_rejected` -> `claim_submitted`) with updated proof and/or amount, provided the 60-day deadline has not passed.

---

**FR-MDF-023: Mark Reimbursed** (P0)

Admin confirms that payment has been processed for an approved claim.

*Acceptance Criteria:*
- Given request is in `claim_approved` status, when admin POSTs to `/mdf/requests/:id/reimburse`:
  1. Status transitions to `reimbursed`.
  2. `reimbursed_at` is set to now.
  3. Notification sent to partner.
- **Admin-only** action. Channel_manager cannot mark reimbursed.
- `reimbursement_amount` was already set during claim approval (FR-MDF-021).

*Note on spent_amount reconciliation:*
- `spent_amount` was incremented by `approved_amount` during request approval (FR-MDF-013).
- If `reimbursement_amount < approved_amount`, the delta remains "committed but unused."
- There is NO automatic refund of the delta to `remaining_amount`. Admins can manually adjust via FR-MDF-004 if needed.
- Rationale: Retroactively adjusting allocation balance after approval would create accounting complexity and could confuse pending requests.

---

### 6.4 File Upload

**FR-MDF-030: Upload Proof of Execution Files** (P0)

Partner_admin uploads files as proof of execution for a claim.

*Acceptance Criteria:*
- Given partner_admin POSTs multipart/form-data to `/mdf/requests/:id/upload-proof`:
  1. Files are uploaded to S3/MinIO under path `mdf-proof/{request_id}/{filename}`.
  2. Allowed file types: `application/pdf`, `image/png`, `image/jpeg` (from `MDF_PROOF_ALLOWED_TYPES`).
  3. Max file size: 10 MB per file (from `MDF_PROOF_MAX_FILE_SIZE`).
  4. Max files per upload: 10 (from `MDF_PROOF_MAX_FILES`).
  5. Returns array of uploaded file URLs.
  6. Files are NOT automatically attached to the claim -- partner includes URLs in the `/claim` request body.
- Given file type is not in allowed list, then return `422 MDF_INVALID_FILE_TYPE`.
- Given file exceeds 10 MB, then return `422 MDF_FILE_TOO_LARGE`.
- Given S3/MinIO is unavailable, then return `503 MDF_UPLOAD_FAILED`.

---

### 6.5 Request Listing and Detail

**FR-MDF-040: List Requests** (P0)

*Acceptance Criteria:*
- Org scoping follows standard rules.
- Supports query params (from `listRequestsQuerySchema`): `status` (comma-separated), `organization_id`, `allocation_id`, `activity_type`, `submitted_by`, `page`, `per_page`, `sort`.
- Sort options: `created_at`, `requested_amount`, `approved_amount`, `start_date`, `end_date`, `status`, `request_number`, `activity_name`.
- Default sort: `created_at:desc`.
- Response includes: `request_number`, `organization_name`, `submitted_by_name`, `activity_type`, `activity_name`, `dates`, `amounts`, `status`.

---

**FR-MDF-041: Get Request Detail** (P0)

*Acceptance Criteria:*
- Response includes all request fields plus:
  - `organization_name`, `submitted_by_name`, `reviewed_by_name` (from joins in `findRequestById`)
  - `allocation_allocated_amount`, `allocation_spent_amount`, `allocation_remaining_amount`
  - `allocation_fiscal_year`, `allocation_fiscal_quarter`
- Org scoping enforced. Returns 404 if not in scope.

---

## 7. Allocation Algorithm

### Auto-Allocation Calculation

```
FUNCTION calculateMdfAllocation(org, fiscal_year, fiscal_quarter):

  tier = org.tier

  // Step 1: Check eligibility
  IF tier.mdf_budget_pct == 0 OR MDF_TIER_CAPS[tier.name] == 0:
    RETURN { eligible: false, reason: "Tier has no MDF budget" }

  // Step 2: Calculate trailing 4-quarter revenue
  fiscal_quarter_start = getQuarterStartDate(fiscal_year, fiscal_quarter)
  trailing_4q_revenue = repository.getTrailingRevenue(org.id, fiscal_quarter_start)
    // = SUM(deals.actual_value) WHERE org_id AND status='won'
    //   AND actual_close_date >= (quarter_start - 12 months)
    //   AND actual_close_date < quarter_start

  IF trailing_4q_revenue == 0:
    RETURN { eligible: false, reason: "No trailing revenue" }

  // Step 3: Base allocation
  base_allocation = trailing_4q_revenue * (tier.mdf_budget_pct / 100)

  // Step 4: Apply tier cap
  capped_allocation = MIN(base_allocation, MDF_TIER_CAPS[tier.name])

  // Step 5: Top performer bonus (20%)
  threshold = repository.getTopPerformerThreshold(tier.id, fiscal_quarter_start)
  IF trailing_4q_revenue >= threshold:
    with_bonus = capped_allocation * 1.20
  ELSE:
    with_bonus = capped_allocation

  // Step 6: Re-apply tier cap after bonus (cap is absolute maximum)
  final_allocation = MIN(with_bonus, MDF_TIER_CAPS[tier.name])

  // Step 7: Round to nearest cent
  final_allocation = ROUND(final_allocation, 2)

  RETURN { eligible: true, allocated_amount: final_allocation }
```

### Fiscal Quarter Start Date Calculation

```
FUNCTION getQuarterStartDate(year, quarter):
  // Assuming calendar-year fiscal quarters
  month = (quarter - 1) * 3 + 1  // Q1=Jan, Q2=Apr, Q3=Jul, Q4=Oct
  RETURN new Date(year, month - 1, 1)  // JS months are 0-indexed
```

### Constants (already in `src/config/constants.ts`)

```typescript
MDF_TIER_CAPS = {
  'Registered': 0,
  'Innovator': 10000,
  'Platinum Innovator': 50000,
  'Diamond Innovator': 200000,
};
MDF_TOP_PERFORMER_BONUS_PCT = 20;
MDF_TOP_PERFORMER_THRESHOLD = 0.10;  // top 10%
MDF_SINGLE_REQUEST_CAP_PCT = 50;
```

### Worked Examples

**Example 1: CyberShield Solutions (Diamond Innovator)**
- Trailing 4Q revenue: $3,200,000
- mdf_budget_pct: 6%
- Base: $3,200,000 * 0.06 = $192,000
- Cap check: $192,000 <= $200,000 (Diamond cap) -- passes
- Top performer check: CyberShield is ranked #1 of 2 Diamond partners. Top 10% of 2 = ceil(0.1 * 2) = 1 position. CyberShield qualifies.
- With bonus: $192,000 * 1.20 = $230,400
- Re-cap: MIN($230,400, $200,000) = **$200,000**

**Example 2: CloudGuard Inc (Platinum Innovator)**
- Trailing 4Q revenue: $800,000
- mdf_budget_pct: 4%
- Base: $800,000 * 0.04 = $32,000
- Cap check: $32,000 <= $50,000 (Platinum cap) -- passes
- Top performer check: Only 1 Platinum partner. Threshold = that partner's own revenue. They are in the top 100%, but top 10% of 1 = ceil(0.1 * 1) = 1. They qualify.
- With bonus: $32,000 * 1.20 = $38,400
- Re-cap: MIN($38,400, $50,000) = **$38,400**

**Example 3: NetSecure Partners (Innovator) -- cap applies**
- Trailing 4Q revenue: $600,000
- mdf_budget_pct: 2%
- Base: $600,000 * 0.02 = $12,000
- Cap check: $12,000 > $10,000 (Innovator cap) -- **capped to $10,000**
- Top performer check: Not in top 10% of Innovator tier.
- Final allocation: **$10,000**

**Example 4: TechDefend LLC (Registered)**
- mdf_budget_pct: 0%, MDF_TIER_CAPS['Registered'] = 0
- Result: **Skipped** (not eligible)

**Example 5: New partner with zero revenue (Innovator tier)**
- Trailing 4Q revenue: $0
- Base: $0 * 0.02 = $0
- Result: **Skipped** (no revenue)

---

## 8. State Machine

```
                                    +-----------+
                                    |  rejected |<---------+
                                    +-----+-----+          |
                                          |                |
                                  (edit & resubmit)        |
                                          |                |
         +-------+    submit    +---------v-+   reject   +--+--------+
         | draft |------------->| submitted |----------->|           |
         +-------+              +-----+-----+            |           |
                                      |                  |           |
                                      | approve          |           |
                                      v                  |           |
                                +-----+-----+            |           |
                                |  approved  |           |           |
                                +-----+-----+            |           |
                                      |                  |           |
                                      | complete         |           |
                                      v                  |           |
                                +-----+-----+            |           |
                                | completed  |           |           |
                                +-----+-----+            |           |
                                      |                  |           |
                                      | claim            |           |
                                      v                  |           |
                              +-------+--------+         |           |
                              | claim_submitted |        |           |
                              +---+--------+---+        |           |
                                  |        |             |           |
                        approve   |        | reject      |           |
                          claim   |        | claim       |           |
                                  v        v             |           |
                          +-------+--+ +---+----------+  |           |
                          |claim_    | |claim_rejected|--+           |
                          |approved  | +--------------+              |
                          +----+-----+    (can resubmit claim)       |
                               |                                     |
                               | reimburse (admin only)              |
                               v                                     |
                          +----+------+                              |
                          | reimbursed| (terminal)                   |
                          +-----------+                              |
```

### Valid Transitions (from `VALID_MDF_TRANSITIONS` in `constants.ts`)

| From Status | To Status(es) | Trigger | Actor |
|-------------|---------------|---------|-------|
| `draft` | `submitted` | POST `/:id/submit` | partner_admin |
| `submitted` | `approved` | POST `/:id/approve` | channel_manager, admin |
| `submitted` | `rejected` | POST `/:id/reject` | channel_manager, admin |
| `approved` | `completed` | POST `/:id/complete` | partner_admin |
| `rejected` | `submitted` | POST `/:id/submit` (after edit) | partner_admin |
| `completed` | `claim_submitted` | POST `/:id/claim` | partner_admin |
| `claim_submitted` | `claim_approved` | POST `/:id/approve-claim` | channel_manager, admin |
| `claim_submitted` | `claim_rejected` | POST `/:id/reject-claim` | channel_manager, admin |
| `claim_rejected` | `claim_submitted` | POST `/:id/claim` (resubmit) | partner_admin |
| `claim_approved` | `reimbursed` | POST `/:id/reimburse` | admin only |
| `reimbursed` | (terminal) | -- | -- |

### Transition Validation

Every status transition in the service layer must:
1. Check `VALID_MDF_TRANSITIONS[currentStatus].includes(targetStatus)`.
2. Use optimistic concurrency: `updateRequestStatus(id, fromStatus, toStatus)` which includes `WHERE status = fromStatus`. If no rows updated, the request was already transitioned by another actor.
3. For financial transitions (submit, approve), use `updateRequestStatusTrx` within a database transaction that locks the allocation row.

---

## 9. API Endpoint Reference

Base URL: `/api/v1/mdf`

All endpoints require `authenticate` and `scopeToOrg` middleware (applied at router level).

| Method | Endpoint | Auth | Description | FR |
|--------|----------|------|-------------|----|
| GET | `/mdf/allocations` | * (scoped) | List allocations | FR-MDF-002 |
| POST | `/mdf/allocations` | admin, channel_manager | Create allocation | FR-MDF-001 |
| POST | `/mdf/allocations/auto-allocate` | admin | Auto-allocate for quarter | FR-MDF-005 |
| GET | `/mdf/allocations/:id` | * (scoped) | Get allocation detail | FR-MDF-003 |
| PATCH | `/mdf/allocations/:id` | admin, channel_manager | Update allocation | FR-MDF-004 |
| GET | `/mdf/requests` | * (scoped) | List requests | FR-MDF-040 |
| POST | `/mdf/requests` | partner_admin | Create draft request | FR-MDF-010 |
| GET | `/mdf/requests/:id` | * (scoped) | Get request detail | FR-MDF-041 |
| PATCH | `/mdf/requests/:id` | partner_admin (owner) | Update draft/rejected request | FR-MDF-011 |
| POST | `/mdf/requests/:id/submit` | partner_admin | Submit for approval | FR-MDF-012 |
| POST | `/mdf/requests/:id/approve` | channel_manager, admin | Approve request | FR-MDF-013 |
| POST | `/mdf/requests/:id/reject` | channel_manager, admin | Reject request | FR-MDF-014 |
| POST | `/mdf/requests/:id/complete` | partner_admin | Mark activity completed | FR-MDF-015 |
| POST | `/mdf/requests/:id/claim` | partner_admin | Submit claim with proof | FR-MDF-020 |
| POST | `/mdf/requests/:id/approve-claim` | channel_manager, admin | Approve claim | FR-MDF-021 |
| POST | `/mdf/requests/:id/reject-claim` | channel_manager, admin | Reject claim | FR-MDF-022 |
| POST | `/mdf/requests/:id/reimburse` | admin | Mark as reimbursed | FR-MDF-023 |
| POST | `/mdf/requests/:id/upload-proof` | partner_admin | Upload proof files | FR-MDF-030 |

**Route ordering note:** Static routes (`/auto-allocate`) must be registered BEFORE parameterized routes (`/:id`) to avoid Express treating "auto-allocate" as an ID. Follow the pattern in `deal.routes.ts`.

---

## 10. Edge Cases

### EC-01: Allocation Does Not Exist for Current Quarter

**Scenario:** Partner tries to create a request but no allocation exists for the quarter they select.
**Behavior:** The `allocation_id` is a required field on request creation. If the allocation does not exist, the partner cannot reference it. Frontend shows "No allocation found for this quarter" and disables the request form. Backend returns `404 NOT_FOUND` for invalid allocation_id.
**Mitigation:** Auto-allocate job runs at the start of each quarter. Admins can create manual allocations for edge cases.

### EC-02: Request Exceeds Remaining Allocation

**Scenario:** Partner submits a request for $60,000 but only $50,000 remains.
**Behavior:** Submit is rejected with `422 MDF_INSUFFICIENT_FUNDS` and message "Requested amount ($60,000.00) exceeds remaining allocation ($50,000.00)". Status remains `draft`. Partner must reduce amount.
**Note:** This check uses a row lock to get an accurate `remaining_amount`.

### EC-03: Claim After 60-Day Deadline

**Scenario:** Activity `end_date` was 2026-01-15. Partner tries to submit claim on 2026-03-19 (63 days later).
**Behavior:** Return `422 MDF_DEADLINE_PASSED` with message "Claim deadline has passed (deadline was 2026-03-16)."
**Important:** The deadline is calculated from `end_date`, not the date the activity was marked complete. Partners should not delay marking complete to extend their window. The approved funds remain in `spent_amount` -- they are NOT automatically released.

### EC-04: Concurrent Request Submissions Exceeding Allocation

**Scenario:** Two users from the same org submit MDF requests simultaneously. Each requests $8,000 from a $10,000 remaining balance.
**Behavior:**
- The `submit` action acquires a `SELECT ... FOR UPDATE` lock on the allocation row.
- First transaction validates $8,000 <= $10,000 and succeeds. Status -> `submitted`.
- Second transaction validates $8,000 <= $10,000 and also succeeds (funds not committed at submission).
- Both submissions succeed because `spent_amount` is only incremented on **approval**, not submission.
- When CM approves the first for $8,000: `spent_amount` becomes $8,000, `remaining = $2,000`.
- When CM tries to approve the second for $8,000: `MDF_INSUFFICIENT_FUNDS` because $8,000 > $2,000.
- CM can approve for a reduced amount ($2,000) or reject.
**Design Decision:** Validate at submission to catch obvious overages, but enforce the hard constraint at approval time when funds are actually committed. This avoids blocking partners from submitting while allowing CM to prioritize.

### EC-05: Claim Resubmission After Rejection

**Scenario:** CM rejects claim because proof is insufficient. Partner uploads better proof and resubmits.
**Behavior:**
- Status transitions: `claim_rejected` -> `claim_submitted`
- Partner can update `claim_amount`, `proof_of_execution`, `claim_notes`
- All validation rules re-apply, including the 60-day deadline from original `end_date`
- If the 60-day window has now passed, partner CANNOT resubmit (deadline is absolute)

### EC-06: Partial Reimbursement

**Scenario:** Approved $6,500, claimed $6,500, but only $5,000 is eligible after audit.
**Behavior:**
- CM approves claim with `reimbursement_amount = 5000`
- `allocation.spent_amount` remains at $6,500 (set during request approval)
- The $1,500 difference is NOT automatically refunded
- Admin can manually adjust via `PATCH /mdf/allocations/:id` if business policy requires returning unused funds
**Rationale:** Allocation budget was committed at approval time. Partial reimbursement is a cost-reduction outcome, not a budget return. This simplifies accounting and prevents `remaining_amount` from fluctuating unpredictably.

### EC-07: Tier Changes Mid-Quarter

**Scenario:** Partner downgraded from "Platinum Innovator" ($50K cap) to "Innovator" ($10K cap) mid-quarter. Existing allocation is $45,000.
**Behavior:**
- Existing allocations are NOT automatically adjusted. The allocation was calculated based on the tier at allocation time.
- Already-approved requests remain valid.
- New allocations (next quarter) will use the new tier.
- Admin can manually reduce allocation via PATCH if business policy requires it.
- If admin reduces allocation below `spent_amount`, system returns `422 MDF_ALLOCATION_UNDERFLOW`.

### EC-08: Approved Activity Never Completed (Stale Funds)

**Scenario:** Partner gets $20,000 approved but never executes the activity. End_date passes, 60-day claim window closes.
**Behavior:**
- Claim deadline warning job sends notifications at 45, 30, 14, 7 days before deadline.
- After deadline, partner cannot submit a claim.
- The $20,000 remains in `spent_amount` indefinitely.
- Admin must manually release funds by either: (a) adjusting allocation via PATCH, or (b) creating a new allocation with a credit.
- A future enhancement could auto-expire stale approved requests.

### EC-09: Allocation Update Below Committed Amount

**Scenario:** Admin tries to reduce allocation from $50,000 to $20,000 but $30,000 is already spent.
**Behavior:** Return `422 MDF_ALLOCATION_UNDERFLOW` with message "Cannot reduce allocation below committed amount ($30,000.00 already committed)."

### EC-10: Request Against Wrong Org's Allocation

**Scenario:** Partner submits a request referencing an `allocation_id` that belongs to a different organization.
**Behavior:** Service checks `allocation.organization_id === req.user.org_id`. If mismatch, returns `404 MDF_ALLOCATION_NOT_FOUND` (do not leak existence of other orgs' allocations).

### EC-11: Duplicate Allocation for Same Org + Quarter

**Scenario:** Admin creates allocation for CyberShield Q2 2026 when one already exists.
**Behavior:** Rejected with `409 MDF_ALLOCATION_EXISTS`. The UNIQUE constraint on `(organization_id, fiscal_year, fiscal_quarter)` provides a database-level guarantee.

### EC-12: Auto-Allocate with Top Performer Bonus Exceeding Cap

**Scenario:** Diamond Innovator partner has base allocation of $180,000. With 20% bonus = $216,000. Cap is $200,000.
**Behavior:** Final allocation = MIN($216,000, $200,000) = $200,000. The tier cap is re-applied after the bonus. This prevents the bonus from pushing allocations beyond program limits.

---

## 11. Background Jobs

### Job 1: MDF Claim Deadline Warnings

**File:** `src/jobs/mdfClaimDeadline.job.ts`
**Schedule:** Daily at 9:00 AM UTC (`0 9 * * *`)

**Algorithm:**
```
FUNCTION processMdfClaimDeadlines():
  requests = repository.findRequestsForClaimDeadline()
    // Returns: status IN ('approved', 'completed') AND end_date IS NOT NULL

  warnings_sent = 0
  errors = 0

  FOR EACH request:
    deadline = request.end_date + MDF_CLAIM_DEADLINE_DAYS  // 60 days
    days_remaining = deadline - TODAY

    IF days_remaining IN MDF_CLAIM_WARNING_DAYS:  // [45, 30, 14, 7]
      TRY:
        CREATE notification:
          user_id: request.submitted_by
          type: 'mdf_update'
          title: "MDF claim deadline in {days_remaining} days"
          body: "Submit your claim for {request.request_number} by {deadline}.
                 Upload proof of execution to receive reimbursement."
          entity_type: 'mdf_request'
          entity_id: request.id
          action_url: '/mdf/requests/{request.id}'
        warnings_sent++
      CATCH:
        errors++
        LOG error and continue

    IF days_remaining == 0:
      CREATE notification:
        title: "MDF claim deadline is TODAY for {request.request_number}"

    IF days_remaining < 0 AND status == 'approved':
      // Activity was approved but never marked completed,
      // and deadline has passed
      CREATE notification:
        title: "MDF claim deadline PASSED for {request.request_number}"
        body: "The 60-day claim window has closed. Contact your admin."

  RETURN { warnings_sent, errors }
```

**Idempotency:** Notifications should be deduplicated. Check if a notification with the same `entity_id` and title pattern already exists for today before creating. Alternatively, use a deduplication key like `mdf-claim-{request.id}-{days_remaining}`.

**Warning intervals (from constants):** 45, 30, 14, 7 days before deadline.

**Pattern:** Follow `dealExpiration.job.ts` -- export a named function, handle errors per-request (continue processing others), return summary stats.

---

### Job 2: Quarterly Auto-Allocation

**File:** `src/jobs/mdfQuarterlyAllocation.job.ts`
**Schedule:** 1st of each quarter at 1:00 AM UTC (`0 1 1 1,4,7,10 *`)

**Algorithm:**
```
FUNCTION processMdfQuarterlyAllocations():
  { year, quarter } = getCurrentFiscalQuarter()

  // Reuse the same auto-allocate logic as the manual API endpoint
  result = mdfService.autoAllocate(year, quarter)

  LOG "MDF quarterly allocation complete: created={result.created},
       skipped_existing={result.skipped_existing},
       skipped_no_revenue={result.skipped_no_revenue}"

  // Notify all admin users
  admin_users = SELECT id FROM users WHERE role = 'admin' AND is_active = true
  FOR EACH admin:
    CREATE notification:
      user_id: admin.id
      type: 'system_announcement'
      title: "Q{quarter} {year} MDF allocations generated"
      body: "{result.created} allocations created, {result.skipped_existing} skipped"

  RETURN result
```

**Pattern:** Follow `dealExpiration.job.ts`. The heavy lifting is in `mdfService.autoAllocate()` which is also used by the manual API endpoint (FR-MDF-005).

---

## 12. Data Scoping Rules

### Scoping Matrix

| Role | Allocations | Requests | Mutations |
|------|-------------|----------|-----------|
| `admin` | All orgs | All orgs | Full CRUD, auto-allocate, reimburse |
| `channel_manager` | Assigned orgs only | Assigned orgs only | Create allocations, approve/reject requests & claims |
| `partner_admin` | Own org only | Own org only | Create/edit/submit requests, mark complete, submit claims |
| `partner_rep` | Own org only (read) | Own org only (read) | **Read-only**: list + detail only |

### Implementation

All MDF routes use `authenticate` and `scopeToOrg` middleware at the router level:

```typescript
router.use(authenticate, scopeToOrg);
```

Repository methods accept `OrgScope` and call `applyOrgScope(query, scope, 'column')`:
- partner_admin/partner_rep: `WHERE organization_id = req.user.org_id`
- channel_manager: `WHERE organization_id IN (assigned_org_ids)`
- admin: no filter

### partner_rep Restrictions

partner_rep is read-only for MDF. Enforced at route level via `authorize('partner_admin')` on all mutation endpoints:

- CANNOT POST `/mdf/requests` (create)
- CANNOT PATCH `/mdf/requests/:id` (update)
- CANNOT POST `/mdf/requests/:id/submit` (submit)
- CANNOT POST `/mdf/requests/:id/complete` (complete)
- CANNOT POST `/mdf/requests/:id/claim` (claim)
- CANNOT POST `/mdf/requests/:id/upload-proof` (upload)
- CAN GET `/mdf/allocations` and `/mdf/allocations/:id` (view budgets)
- CAN GET `/mdf/requests` and `/mdf/requests/:id` (view requests)

---

## 13. Frontend Page Specifications

### Page 1: MDF Allocation Overview (`MdfAllocations.tsx`)

**URL:** `/mdf/allocations`
**Hooks:** `useMdfAllocations`, `useCreateAllocation`, `useAutoAllocate`

**Layout:**
- Header: "MDF Allocations" with fiscal year/quarter filter dropdowns
- For admin/CM: "Create Allocation" button + "Auto-Allocate" button (admin only)
- Table columns: Organization, Quarter, Allocated, Spent, Remaining, Utilization %, Actions
- Utilization bar: visual progress bar (green < 70%, yellow 70-90%, red > 90%)
- Click row to view allocation detail (expandable or navigate to filtered request list)

**Role-based display:**
- partner_admin: sees only their org's allocations. No create/auto-allocate buttons.
- partner_rep: same as partner_admin (read-only).
- channel_manager: sees assigned orgs. Has "Create Allocation" button.
- admin: sees all orgs. Has "Create Allocation" and "Auto-Allocate" buttons.

**Auto-Allocate Modal (admin only):**
- Select fiscal year + quarter
- Click "Generate Allocations"
- Show results: created, skipped, details table
- Invalidate allocation list on success (handled by `useAutoAllocate` hook)

---

### Page 2: MDF Request List (`MdfRequestList.tsx`)

**URL:** `/mdf/requests`
**Hooks:** `useMdfRequests`

**Layout:**
- Header: "MDF Requests" with filter bar
- Filters: Status (multi-select chips), Activity Type, Organization (admin/CM), Date range
- Table columns: Request #, Activity Name, Type, Organization, Amount (requested/approved), Status, Start Date, Created
- Status badges with colors matching lifecycle states
- "New Request" button (partner_admin only)
- Click row to navigate to request detail

**Role-based display:**
- partner_admin: sees own org's requests. Has "New Request" button.
- partner_rep: sees own org's requests. No "New Request" button (read-only).
- channel_manager: sees assigned orgs' requests. Has "Pending Review" quick filter.
- admin: sees all requests. All filters available.

---

### Page 3: MDF Request Form (`MdfRequestForm.tsx`)

**URL:** `/mdf/requests/new` (create) and `/mdf/requests/:id/edit` (edit)
**Hooks:** `useCreateMdfRequest`, `useUpdateMdfRequest`, `useMdfAllocations`

**Layout:**
- Allocation selector: dropdown of current org's allocations showing remaining balance
- Form fields:
  - Activity Type: dropdown from `MDF_ACTIVITY_TYPES`
  - Activity Name: text input (2-300 chars)
  - Description: textarea (optional)
  - Start Date: date picker (must be >= today + 14 days, validated on submit)
  - End Date: date picker (must be >= start date)
  - Requested Amount: currency input with validation against allocation
- Amount guidance: "Remaining: ${remaining_amount} | Max per request: ${allocated_amount * 0.50}"
- Buttons: "Save Draft", "Submit for Approval" (calls save then submit)
- On edit (rejected request): show previous rejection reason as info banner

**Validation (client-side, duplicating server rules):**
- All required fields filled
- Amount > 0
- End date >= Start date
- Amount <= remaining allocation (warning, not block -- validated server-side on submit)

---

### Page 4: MDF Request Detail (`MdfRequestDetail.tsx`)

**URL:** `/mdf/requests/:id`
**Hooks:** `useMdfRequest`, `useMdfRequestHistory`, `useSubmitMdfRequest`, `useApproveMdfRequest`, `useRejectMdfRequest`, `useCompleteMdfRequest`, `useSubmitClaim`, `useApproveClaim`, `useRejectClaim`, `useMarkReimbursed`, `useUploadProof`

**Layout:**
- Header: Request number + status badge
- Summary card: activity name, type, dates, amounts (requested, approved, claimed, reimbursed)
- Allocation context: which quarter, allocated amount, remaining
- Organization + submitter info

**Action Buttons (conditional on status and role):**

| Status | partner_admin | channel_manager / admin | admin only |
|--------|--------------|------------------------|------------|
| `draft` | Edit, Submit | -- | -- |
| `submitted` | -- | Approve (with amount), Reject (with reason) | -- |
| `approved` | Mark Complete | -- | -- |
| `rejected` | Edit, Resubmit | -- | -- |
| `completed` | Submit Claim | -- | -- |
| `claim_submitted` | -- | Approve Claim (with amount), Reject Claim | -- |
| `claim_rejected` | Resubmit Claim | -- | -- |
| `claim_approved` | -- | -- | Mark Reimbursed |
| `reimbursed` | (no actions) | (no actions) | (no actions) |

**Claim Submission Section (shown for `completed` and `claim_rejected` statuses):**
- File upload area: drag-and-drop or file picker for proof of execution
  - Uses `useUploadProof` hook to upload to MinIO
  - Shows uploaded file URLs
- Claim amount input (max = approved_amount)
- Claim notes textarea
- "Submit Claim" button

**Proof of Execution Display (shown for claim_submitted and later):**
- List of proof_of_execution URLs as downloadable links
- File type icons (PDF, image)

**Approval Form (shown for CM/admin when status = submitted):**
- Approved Amount input (pre-filled with requested_amount)
- Comments textarea
- "Approve" and "Reject" buttons (reject shows rejection_reason input)

**Claim Approval Form (shown for CM/admin when status = claim_submitted):**
- Reimbursement Amount input (pre-filled with claim_amount)
- Comments textarea
- "Approve Claim" and "Reject Claim" buttons

**History Timeline:**
- Uses `useMdfRequestHistory` hook (queries activity feed)
- Shows all status transitions with actor, timestamp, and notes

**partner_rep view:**
- All display sections visible
- All action buttons hidden

---

## 14. Non-Functional Requirements

### Security

- **NFR-SEC-001**: All MDF endpoints require JWT authentication. No public access.
- **NFR-SEC-002**: Org scoping is enforced at the repository layer via `applyOrgScope`. A partner can never read or write another org's MDF data.
- **NFR-SEC-003**: File uploads are validated server-side for MIME type and size. Client-provided filenames are sanitized before S3 storage to prevent path traversal.
- **NFR-SEC-004**: The `organization_id` on MDF requests is set server-side from `req.user.org_id`, never from the request body.

### Performance

- **NFR-PERF-001**: List endpoints must respond in < 200ms for datasets under 1,000 records.
- **NFR-PERF-002**: Auto-allocation for 100 partners must complete in < 30 seconds.
- **NFR-PERF-003**: File upload supports files up to 10 MB without timeout (60s timeout configured in API client).

### Reliability

- **NFR-REL-001**: Submit and approve transactions use `SELECT ... FOR UPDATE` row locks to prevent double-spending.
- **NFR-REL-002**: File upload failures do not affect request state. Upload is decoupled from claim submission.
- **NFR-REL-003**: Background jobs are idempotent. Re-running the claim deadline job does not create duplicate notifications.
- **NFR-REL-004**: Optimistic concurrency on all status transitions via `WHERE status = fromStatus` prevents race conditions.

### Maintainability

- **NFR-MAINT-001**: Follow existing repository pattern: repository (data access) -> service (business logic) -> controller (HTTP handling).
- **NFR-MAINT-002**: All error codes prefixed with `MDF_` and use the existing `AppError` class.
- **NFR-MAINT-003**: Frontend pages use existing hooks from `useMdf.ts` -- no new API client code needed.

---

## 15. Error Codes

| Code | HTTP | Message | Triggered By |
|------|------|---------|--------------|
| `MDF_ALLOCATION_EXISTS` | 409 | "An MDF allocation already exists for this organization in Q{q} {year}" | FR-MDF-001 |
| `MDF_ALLOCATION_UNDERFLOW` | 422 | "Cannot reduce allocation below committed amount (${spent} already committed)" | FR-MDF-004 |
| `MDF_ALLOCATION_NOT_FOUND` | 404 | "MDF allocation not found" | FR-MDF-010 |
| `MDF_REQUEST_NOT_FOUND` | 404 | "MDF request not found" | All request endpoints |
| `MDF_INSUFFICIENT_FUNDS` | 422 | "Requested amount (${amount}) exceeds remaining allocation (${remaining})" | FR-MDF-012, FR-MDF-013 |
| `MDF_REQUEST_EXCEEDS_CAP` | 422 | "Single request cannot exceed 50% of quarterly allocation (max: ${cap})" | FR-MDF-012 |
| `MDF_ACTIVITY_TOO_SOON` | 422 | "Activity start date must be at least 14 days from today" | FR-MDF-012 |
| `MDF_INVALID_TRANSITION` | 422 | "Cannot transition from '{from}' to '{to}'" | All status changes |
| `MDF_NOT_EDITABLE` | 422 | "Request can only be edited in draft or rejected status" | FR-MDF-011 |
| `MDF_CLAIM_EXCEEDS_APPROVED` | 422 | "Claim amount (${claim}) cannot exceed approved amount (${approved})" | FR-MDF-020 |
| `MDF_DEADLINE_PASSED` | 422 | "Claim deadline has passed (deadline was {date})" | FR-MDF-020 |
| `MDF_PROOF_REQUIRED` | 422 | "At least one proof of execution document is required" | FR-MDF-020 |
| `MDF_AMOUNT_EXCEEDS_REQUESTED` | 422 | "Approved amount cannot exceed requested amount" | FR-MDF-013 |
| `MDF_INVALID_FILE_TYPE` | 422 | "File type not allowed. Accepted: PDF, PNG, JPG" | FR-MDF-030 |
| `MDF_FILE_TOO_LARGE` | 422 | "File exceeds maximum size of 10 MB" | FR-MDF-030 |
| `MDF_UPLOAD_FAILED` | 503 | "File upload service unavailable. Please try again." | FR-MDF-030 |
| `AUTH_ORG_MISMATCH` | 403 | "You do not have access to this organization's data" | Cross-org access |

---

## 16. Implementation Phases

### Phase 5A: Service Layer + Controller + Routes (estimated: 10-15 min AI work)

**Objective:** Build the complete backend API.

**Files to create:**

1. **`src/services/mdf.service.ts`** -- Business logic methods:
   - `createAllocation(data, user)` -- validate no duplicate, create
   - `listAllocations(scope, filters, pagination, sort)` -- delegate to repo
   - `getAllocation(id, scope)` -- fetch with 404 check
   - `updateAllocation(id, data, scope)` -- validate underflow
   - `autoAllocate(fiscalYear, fiscalQuarter)` -- full algorithm from Section 7
   - `createRequest(data, user)` -- validate allocation ownership, create draft
   - `updateRequest(id, data, user, scope)` -- validate editable status
   - `submitRequest(id, user, scope)` -- validate all rules under transaction
   - `approveRequest(id, body, user, scope)` -- lock, validate, commit funds
   - `rejectRequest(id, body, user, scope)` -- transition + reason
   - `completeActivity(id, user, scope)` -- transition approved -> completed
   - `submitClaim(id, body, user, scope)` -- validate deadline + amount + proof
   - `approveClaim(id, body, user, scope)` -- set reimbursement_amount
   - `rejectClaim(id, body, user, scope)` -- transition + reason
   - `markReimbursed(id, body, user, scope)` -- admin only, set reimbursed_at
   - `uploadProof(id, files, user, scope)` -- upload to MinIO, return URLs

2. **`src/controllers/mdf.controller.ts`** -- Thin controller following `deal.controller.ts` pattern:
   - Parse request (params, body, query, user, orgScope)
   - Call service method
   - Return via `sendSuccess(res, data, statusCode, meta?)`
   - Forward errors to `next(err)`

3. **`src/routes/mdf.routes.ts`** -- Route definitions following `deal.routes.ts` pattern:
   - Apply `authenticate`, `scopeToOrg` at router level
   - Static routes before parameterized routes
   - `authorize()` on each route with appropriate roles
   - `validate()` with appropriate schema + location (params/body/query)

4. **Mount in `app.ts`:** Register `mdfRoutes` at `/api/v1/mdf`

**Dependencies:** All existing artifacts (repository, validators, constants, middleware).

**Acceptance Test:** Full request lifecycle via curl/Postman: create allocation -> create draft -> submit -> approve -> complete -> upload proof -> submit claim -> approve claim -> reimburse.

---

### Phase 5B: Background Jobs (estimated: 5-10 min AI work)

**Objective:** Implement claim deadline warnings and quarterly auto-allocation.

**Files to create:**

1. **`src/jobs/mdfClaimDeadline.job.ts`** -- Export `processMdfClaimDeadlines()` function. Follow `dealExpiration.job.ts` pattern.

2. **`src/jobs/mdfQuarterlyAllocation.job.ts`** -- Export `processMdfQuarterlyAllocations()` function. Calls `mdfService.autoAllocate()`.

3. **Register jobs** in existing Bull queue setup / cron scheduler.

**Dependencies:** Phase 5A (service layer).

**Acceptance Test:** Run jobs manually; verify notifications created at correct milestones.

---

### Phase 5C: Frontend Pages (estimated: 10-15 min AI work)

**Objective:** Build four MDF pages using existing hooks and API client.

**Files to create:**

1. **`client/src/pages/mdf/MdfAllocations.tsx`** -- Allocation overview (Section 13, Page 1)
2. **`client/src/pages/mdf/MdfRequestList.tsx`** -- Request list (Section 13, Page 2)
3. **`client/src/pages/mdf/MdfRequestForm.tsx`** -- Create/edit form (Section 13, Page 3)
4. **`client/src/pages/mdf/MdfRequestDetail.tsx`** -- Detail with actions (Section 13, Page 4)
5. **Route registration** in React Router config

**Dependencies:** Phase 5A (API must be functional). Existing hooks in `useMdf.ts` and API client in `mdf.ts`.

**Acceptance Test:** Partner admin can complete full lifecycle through UI. CM can approve/reject. Admin can auto-allocate and reimburse. partner_rep sees read-only views.

---

### Phase 5D: Integration Testing + Seed Data (estimated: 5-10 min AI work)

**Objective:** End-to-end tests and demo data.

**Deliverables:**
- Integration tests for critical paths (submit + approve + claim lifecycle)
- Concurrency test (two simultaneous submissions)
- Seed data: sample allocations and requests in various statuses for demo

**Dependencies:** Phases 5A-5C complete.

---

## 17. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Concurrent fund over-commitment | Medium | High | Database row locking (SELECT ... FOR UPDATE) on allocation during submit and approve. Hard enforcement at approval. |
| Trailing revenue calculation date edge cases | Medium | Medium | Explicit fiscal quarter start date calculation. Unit test with known deal data across quarter boundaries. |
| S3/MinIO unavailable during proof upload | Low | Medium | Return 503 with retry guidance. Upload is decoupled from claim submission. |
| Auto-allocation before tier recalculation | Low | Low | Schedule auto-allocation job after tier recalculation job (tier at 2 AM, allocation at start of quarter). |
| 60-day deadline too short for complex activities | Low | Medium | Configurable via `MDF_CLAIM_DEADLINE_DAYS` constant. Admin can manually extend by creating exception. |
| Stale allocation data in frontend | Medium | Low | TanStack Query invalidates all MDF caches after any mutation (built into existing hooks). |
| partner_rep accidentally gaining write access | Low | High | Route-level `authorize('partner_admin')` on all mutation endpoints. Integration test to verify. |

---

## 18. Dependencies

### External Dependencies

- **S3/MinIO**: Required for proof-of-execution file storage. If unavailable, upload fails (503) but core workflow functions.
- **Redis + Bull**: Required for background job scheduling. If unavailable, jobs don't run but manual API operations still work.
- **PostgreSQL**: Required. Row-level locking (`FOR UPDATE`) is critical for concurrency control.

### Internal Dependencies

- **Phase 1 (Foundation)**: Auth, RBAC, org scoping middleware, database, AppError, pagination utils.
- **Phase 2 (Deal Registration)**: `deals` table with `actual_value` and `status = 'won'` for trailing revenue calculation.
- **Tier data**: `partner_tiers` table with `mdf_budget_pct` values. `MDF_TIER_CAPS` constants.
- **Notification service**: `src/services/notification.service.ts` for all MDF notifications.
- **Existing MDF artifacts**: Repository (471 lines), validators (107 lines), API client (139 lines), hooks (287 lines) -- all complete and stable.

### Blocking vs. Non-Blocking

- **Blocking**: Phase 1 foundation -- cannot start without auth, database, middleware.
- **Blocking**: Phase 2 deal data -- auto-allocation requires trailing revenue.
- **Non-blocking**: Phase 6 dashboards -- MDF data is queryable; dashboard reads it later.
- **Non-blocking**: Phase 7 notifications email delivery -- Phase 5 creates records; Phase 7 sends emails.

---

## 19. Appendices

### A. Glossary

- **MDF (Market Development Funds)**: Vendor-provided budget allocated to partners for co-marketing activities.
- **Proof of Execution (PoE)**: Documentation proving a marketing activity was completed (photos, attendee lists, invoices).
- **Trailing 4Q Revenue**: Sum of `actual_value` from won deals in the 12 months preceding the allocation quarter start.
- **Allocation**: The quarterly budget assigned to a partner organization.
- **Claim**: A partner's request for reimbursement after completing an approved activity.
- **Spent Amount**: Running total of approved (reserved) funds against an allocation. Incremented on request approval, not on submission.
- **Tier Cap**: Maximum allocation amount per quarter regardless of revenue calculation.
- **Top Performer Bonus**: 20% bonus applied to allocation for partners whose trailing revenue is in the 90th percentile within their tier.

### B. Constants Reference (from `src/config/constants.ts`)

```typescript
export const MDF_REQUEST_STATUSES = ['draft', 'submitted', 'approved', 'rejected',
  'completed', 'claim_submitted', 'claim_approved', 'claim_rejected', 'reimbursed'];

export const MDF_ACTIVITY_TYPES = ['event', 'webinar', 'digital_campaign',
  'print_collateral', 'trade_show', 'training', 'other'];

export const MDF_CLAIM_DEADLINE_DAYS = 60;
export const MDF_MIN_LEAD_TIME_DAYS = 14;
export const MDF_MAX_REQUEST_PCT = 50;
export const MDF_TOP_PERFORMER_BONUS_PCT = 20;
export const MDF_TOP_PERFORMER_THRESHOLD = 0.10;
export const MDF_SINGLE_REQUEST_CAP_PCT = 50;

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
  rejected:         ['submitted'],
  completed:        ['claim_submitted'],
  claim_submitted:  ['claim_approved', 'claim_rejected'],
  claim_rejected:   ['claim_submitted'],
  claim_approved:   ['reimbursed'],
  reimbursed:       [],
};
```

### C. Database Schema (existing)

```sql
CREATE TABLE mdf_allocations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  fiscal_year     INT NOT NULL,
  fiscal_quarter  INT NOT NULL CHECK (fiscal_quarter BETWEEN 1 AND 4),
  allocated_amount NUMERIC(12,2) NOT NULL,
  spent_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
  remaining_amount NUMERIC(12,2) GENERATED ALWAYS AS (allocated_amount - spent_amount) STORED,
  currency        VARCHAR(3) DEFAULT 'USD',
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, fiscal_year, fiscal_quarter)
);

CREATE TABLE mdf_requests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_number  VARCHAR(20) NOT NULL UNIQUE,         -- MDF-2026-00001
  allocation_id   UUID NOT NULL REFERENCES mdf_allocations(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  submitted_by    UUID NOT NULL REFERENCES users(id),
  activity_type   mdf_activity_type NOT NULL,
  activity_name   VARCHAR(300) NOT NULL,
  description     TEXT,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  requested_amount NUMERIC(12,2) NOT NULL,
  approved_amount  NUMERIC(12,2),
  actual_spend     NUMERIC(12,2),
  status          mdf_request_status NOT NULL DEFAULT 'draft',
  reviewed_by     UUID REFERENCES users(id),
  reviewed_at     TIMESTAMPTZ,
  rejection_reason TEXT,
  claim_submitted_at   TIMESTAMPTZ,
  claim_amount         NUMERIC(12,2),
  proof_of_execution   TEXT[],
  claim_notes          TEXT,
  reimbursement_amount NUMERIC(12,2),
  reimbursed_at        TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### D. Existing Repository Methods (from `mdf.repository.ts`)

| Method | Purpose | Used By |
|--------|---------|---------|
| `createAllocation(data)` | Insert new allocation | FR-MDF-001, FR-MDF-005 |
| `findAllocationById(id, scope)` | Get allocation with org name, scoped | FR-MDF-003 |
| `findAllocationByOrgQuarter(orgId, year, quarter)` | Check for duplicate | FR-MDF-001, FR-MDF-005 |
| `listAllocations(scope, filters, pagination, sort)` | Paginated list | FR-MDF-002 |
| `updateAllocation(id, data)` | Update allocation fields | FR-MDF-004 |
| `adjustSpentAmount(allocId, delta, trx)` | Atomic spent_amount update with row lock | FR-MDF-013, FR-MDF-023 |
| `findAllocationForUpdate(allocId, trx)` | Row lock for validation | FR-MDF-012, FR-MDF-013 |
| `createRequest(data)` | Insert new request | FR-MDF-010 |
| `findRequestById(id, scope)` | Get request with joins, scoped | FR-MDF-041 |
| `findRequestRawById(id)` | Raw request without joins | Internal validation |
| `listRequests(scope, filters, pagination, sort)` | Paginated list | FR-MDF-040 |
| `updateRequestStatus(id, from, to, extra)` | Optimistic concurrency | FR-MDF-014, FR-MDF-015, FR-MDF-022 |
| `updateRequestStatusTrx(id, from, to, extra, trx)` | Status update in transaction | FR-MDF-012, FR-MDF-013, FR-MDF-020 |
| `updateRequestFields(id, data)` | Update non-status fields | FR-MDF-011 |
| `getRequestTotals(allocId)` | Sum approved/claimed amounts | Reporting |
| `getTrailingRevenue(orgId, quarterStart)` | Trailing 4Q deal revenue | FR-MDF-005 |
| `getTopPerformerThreshold(tierId, quarterStart)` | 90th percentile in tier | FR-MDF-005 |
| `getActiveOrgsWithTier()` | All active orgs for auto-allocate | FR-MDF-005 |
| `createApprovalRequest(data)` | Create approval_requests record | FR-MDF-012 |
| `updateApprovalRequest(type, id, action, comments)` | Update approval decision | FR-MDF-013, FR-MDF-014 |
| `findRequestsForClaimDeadline()` | Requests needing deadline warnings | Job 1 |

### E. Notification Templates

| Event | Recipient | Title | Body |
|-------|-----------|-------|------|
| Request submitted | Channel Manager | "MDF Request {request_number} from {org_name}" | "{user_name} submitted a {activity_type} request for ${requested_amount}." |
| Request approved | Submitter | "MDF Request {request_number} Approved" | "Your MDF request has been approved for ${approved_amount}." |
| Request approved (partial) | Submitter | "MDF Request {request_number} Partially Approved" | "Approved for ${approved_amount} (requested: ${requested_amount}). Notes: {comments}" |
| Request rejected | Submitter | "MDF Request {request_number} Rejected" | "Reason: {rejection_reason}" |
| Claim submitted | Channel Manager | "MDF Claim for {request_number}" | "{user_name} submitted a claim for ${claim_amount} with {proof_count} proof documents." |
| Claim approved | Submitter | "MDF Claim Approved: {request_number}" | "Reimbursement of ${reimbursement_amount} approved." |
| Claim rejected | Submitter | "MDF Claim Rejected: {request_number}" | "Reason: {rejection_reason}. You may resubmit with updated proof." |
| Reimbursed | Submitter | "MDF Reimbursement: {request_number}" | "Reimbursement of ${reimbursement_amount} has been processed." |
| Claim deadline warning | Submitter | "MDF Claim Deadline in {days} Days" | "Submit your claim for {request_number} by {deadline_date}." |
| Quarterly allocation | All Admins | "Q{q} {year} MDF Allocations Generated" | "{created} allocations created, {skipped} skipped." |

### F. Files to Create (Summary)

```
src/
  services/mdf.service.ts           <- Business logic (NEW)
  controllers/mdf.controller.ts     <- HTTP handlers (NEW)
  routes/mdf.routes.ts              <- Route definitions (NEW)
  jobs/mdfClaimDeadline.job.ts      <- Deadline warnings (NEW)
  jobs/mdfQuarterlyAllocation.job.ts <- Auto allocations (NEW)

client/src/pages/mdf/
  MdfAllocations.tsx                <- Allocation overview (NEW)
  MdfRequestList.tsx                <- Request list (NEW)
  MdfRequestForm.tsx                <- Create/edit form (NEW)
  MdfRequestDetail.tsx              <- Detail + actions (NEW)

Already exist (no changes needed):
  src/validators/mdf.validator.ts
  src/repositories/mdf.repository.ts
  src/config/constants.ts           (MDF constants already present)
  client/src/api/mdf.ts
  client/src/hooks/useMdf.ts
```
