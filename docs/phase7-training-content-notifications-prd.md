# Product Requirements Document: Phase 7 — Training, Content Library & Notifications

**Version:** 1.0
**Last Updated:** 2026-03-19
**Document Owner:** PRM Portal PM
**Status:** Approved

---

## 1. Executive Summary and Vision

### Vision Statement

Equip partners with self-service access to training, certifications, curated content, and real-time notifications so they can ramp faster, stay certified, and never miss a critical update.

### Executive Summary

Phase 7 completes the PRM Portal's partner enablement layer by delivering four interconnected modules: Training & Certifications, Content Library, Notifications, and Activity Feed. These modules build on database tables, seed data, and service stubs already created in Phases 1-6 — the work is primarily route/controller/service/repository implementation plus frontend pages.

Training drives the `certified_rep_count` metric that feeds tier calculation (Phase 1 business logic). Content visibility is gated by tier, creating a tangible incentive for partners to advance. Notifications tie together every prior module (deals, quotes, leads, MDF) into a cohesive experience where partners and channel managers are proactively informed of status changes instead of polling the UI.

### Key Benefits

- **Reduce partner ramp time by 40%** — self-service course enrollment and completion tracking replaces manual email-based certification workflows.
- **Increase content engagement by 3x** — tier-gated content library with search/filter replaces shared drive links scattered across emails.
- **Eliminate missed approvals** — real-time notifications for deal, quote, lead, and MDF status changes reduce average response time from 48h to under 4h.
- **Automate cert compliance** — background jobs warn partners 30/7/1 days before certifications expire and auto-mark expired certs, keeping `certified_rep_count` accurate for tier calculation.

---

## 2. Problem Statement

### Current Challenges

**For Partners:**
- No way to discover, enroll in, or track certifications within the portal — they use external LMS links emailed ad-hoc.
- No centralized content library — datasheets, battle cards, and pricing guides are scattered across email attachments and shared drives.
- No notification system — partners must log in and manually check for deal approvals, lead assignments, and MDF status changes.

**For Channel Managers:**
- Cannot verify partner certification status from within the portal — must cross-reference external spreadsheets.
- No visibility into content consumption metrics (what partners download, what is popular).
- No way to push announcements or document updates to partners.

**For Admins:**
- Certification expiry tracking is manual — expired certs are not automatically reflected in tier calculations.
- No audit trail for content access, making compliance reporting difficult.

### Why This Matters Now

Phases 1-6 have built the transactional backbone (deals, quotes, leads, MDF, dashboards). Without Phase 7, partners must leave the portal for enablement content and manually monitor for status changes — creating friction that undermines adoption of the features already built.

---

## 3. Goals and Success Metrics

### Business Goals

1. **Drive certification completion** — increase certified reps per org by 25% within 6 months of launch.
2. **Centralize content distribution** — migrate 100% of partner-facing collateral into the content library within 30 days of launch.
3. **Reduce notification latency** — partners and CMs receive in-app notifications within 5 seconds of any status change.

### User Goals

1. **Partners**: Enroll in courses, track certification status, download tier-appropriate content, and receive proactive alerts — all without leaving the portal.
2. **Channel Managers**: View certification compliance across assigned orgs, manage content, and receive actionable notifications for pending reviews.
3. **Admins**: Manage course catalog, curate content library with tier-based access control, and monitor system-wide activity.

### Success Metrics

#### Primary Metrics (P0)

| Metric | Baseline | Target (3mo) | Target (6mo) |
|--------|----------|--------------|---------------|
| Avg certified reps per active org | 6.25 (from seed data) | 8 | 10 |
| Content library documents | 0 (not launched) | 50 | 150 |
| Notification read rate (within 24h) | N/A | 60% | 80% |
| Avg time to act on approval notification | N/A (no notifications) | < 8h | < 4h |

#### Secondary Metrics (P1)

- Document download count per partner per month: Target 15 within 6 months.
- Certification expiry rate (certs that lapse without renewal): Target < 10%.
- Activity feed page views per user per week: Target 3+.

#### Instrumentation Requirements

- Track `download_count` per document (already in schema).
- Track notification `is_read` + `read_at` timestamps (already in schema).
- Log enrollment, completion, and expiry events to `activity_feed`.
- Add `notification_type` breakdown to admin dashboard analytics.

---

## 4. Non-Goals and Boundaries

### Explicit Non-Goals

- **LMS integration**: Phase 7 does NOT integrate with external LMS platforms (Cornerstone, Docebo). Course content is linked via URL; completion is recorded manually or by admin API call.
- **Video hosting**: Documents and course content are stored as file references (URLs). The portal does not transcode, stream, or host video. Video links point to external platforms (YouTube, Vimeo).
- **Email delivery**: Phase 7 creates notification records with `email_sent: false`. Actual email delivery (SendGrid/Nodemailer integration) is deferred to Phase 8. The `email_sent` and `email_sent_at` columns are populated but the email worker is not wired up in this phase.
- **Real-time WebSocket push**: Notifications are fetched via polling (GET /notifications/unread-count). WebSocket push is a Phase 8 enhancement.
- **Document versioning UI**: The `version` column on `documents` exists but Phase 7 treats it as metadata only. No version history browsing or rollback. Admin increments version manually on re-upload.
- **Content approval workflow**: Admins and CMs can publish content directly. There is no draft/review/publish workflow for documents.
- **Bulk enrollment**: partner_admin cannot bulk-enroll all org users into a course. Enrollment is per-user.

### Phase 7 Boundaries

- Will NOT include: email delivery, WebSocket push, LMS SSO, SCORM packages, document version history UI.
- Authentication: Reuses existing JWT + RBAC from Phase 1. No new auth flows.
- Third-party integrations: MinIO/S3 for file storage (already configured in Phase 5 for MDF proof uploads). No new external services.

### Future Considerations (Post-Phase 7)

- WebSocket notification push (Phase 8).
- Email notification worker with digest mode (Phase 8).
- LMS SCORM integration for automated course completion.
- Content approval workflow with draft/review/publish states.
- Bulk course enrollment by partner_admin.

---

## 5. User Personas and Use Cases

### Persona 1: Lisa Zhang — Partner Rep at CyberShield (Diamond tier)

**Role:** Security Sales Engineer
**Experience:** 3 years selling PANW products, holds PCNSA, PCNSE expiring in 60 days.

**Goals:**
- Renew PCNSE certification before it expires.
- Download the latest Cortex XDR battle card before a customer meeting.
- Get notified immediately when her deal DR-2026-00042 is approved.

**Pain Points:**
- Forgot to renew last year's cert because there was no reminder — org lost a certified rep count, nearly triggering a tier downgrade.
- Spent 20 minutes searching email for the latest pricing sheet, ended up using an outdated one.

**Use Cases:**
- UC-1: Lisa navigates to Training > My Certifications, sees PCNSE shows "Expires in 60 days" badge, clicks "Re-enroll" to start renewal process.
- UC-2: Lisa opens Content Library, filters by "Security Operations" folder and "battle_card" tag, downloads Cortex XDR battle card. Download count increments.
- UC-3: Lisa sees a red badge (3) on the bell icon in the nav bar, clicks to see her deal was approved, a new lead was assigned, and her PCNSE is expiring.

### Persona 2: Sarah Chen — Channel Manager

**Role:** Senior Channel Manager (manages CyberShield + CloudGuard)
**Experience:** 5 years managing partner relationships.

**Goals:**
- Verify that CyberShield maintains its Diamond tier certification requirements.
- Upload new Q2 pricing guide visible only to Platinum+ partners.
- Get notified when partners submit deals or MDF requests requiring her review.

**Pain Points:**
- Currently has to ask each partner admin for cert spreadsheets — no single view.
- Cannot restrict sensitive pricing documents to high-tier partners.

**Use Cases:**
- UC-4: Sarah navigates to CyberShield org page > Certifications tab, sees org summary: 15 certified, 2 expiring within 30 days, 1 expired.
- UC-5: Sarah uploads Q2-Pricing-Guide.pdf to "Pricing" folder, sets `visible_to_tiers` to [Platinum Innovator, Diamond Innovator]. Registered and Innovator partners will not see this document.
- UC-6: Sarah's notification bell shows 5 unread: 2 deal submissions, 1 MDF request, 1 quote requiring approval, 1 cert expiry alert for assigned org.

### Persona 3: System Admin

**Role:** Platform Administrator
**Experience:** Manages the PRM Portal platform.

**Goals:**
- Create a new course (PANW AI Security Specialist) in the catalog.
- Organize the content library folder structure.
- Monitor system-wide activity feed for audit compliance.

**Use Cases:**
- UC-7: Admin creates course with passing_score=75, certification_valid_months=24, required_for_tier_id=Platinum.
- UC-8: Admin creates folder hierarchy: Sales Collateral > Battle Cards, Sales Collateral > Pricing Guides, Technical > Deployment Guides.
- UC-9: Admin views activity feed filtered by entity_type=certification, sees all enrollment and completion events across all orgs.

### Persona 4: David Kim — Partner Admin at CyberShield

**Role:** VP of Partnerships
**Experience:** Manages 15 partner reps at CyberShield.

**Goals:**
- View which reps are certified and which certs are expiring.
- Ensure org meets Diamond tier certification requirements (min 12 certified reps).
- Receive notifications when reps complete certifications.

**Use Cases:**
- UC-10: David views org certification dashboard showing 15/12 required certified reps, with 2 expiring within 30 days — still safe but needs attention.
- UC-11: David receives notification "Lisa Zhang completed PCNSE renewal" and org certified_rep_count stays at 15.

---

## 6. Functional Requirements

### 6.1 Training & Certifications

**FR-TR-001: List Courses** (P0)
`GET /api/v1/courses`
Return all active courses. Any authenticated user can access. Supports pagination, search by name, and filter by `course_type`, `is_required`, `required_for_tier_id`.

*Acceptance Criteria:*
- Given an authenticated user, when GET /courses is called, then return all courses where `is_active = true` with pagination metadata.
- Given query param `?is_required=true`, when the request is processed, then only courses with `is_required = true` are returned.
- Given query param `?search=PCNSE`, when the request is processed, then courses whose name contains "PCNSE" (case-insensitive) are returned.

*Query params:* `?course_type=exam&is_required=true&required_for_tier_id=xxx&search=pcn&page=1&per_page=25`

*Response example:*
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "PCNSA",
      "description": "Foundation certification...",
      "course_type": "exam",
      "duration_hours": 40,
      "passing_score": 70,
      "certification_valid_months": 24,
      "is_required": true,
      "required_for_tier_id": "uuid",
      "required_for_tier_name": "Innovator",
      "content_url": "https://...",
      "is_active": true,
      "enrollment_count": 42,
      "created_at": "2026-01-15T..."
    }
  ],
  "meta": { "page": 1, "per_page": 25, "total": 5 }
}
```

---

**FR-TR-002: Create Course** (P0)
`POST /api/v1/courses`
Admin only. Creates a new course in the catalog.

*Acceptance Criteria:*
- Given an admin user, when POST /courses is called with valid body, then a new course is created and returned.
- Given a non-admin user, when POST /courses is called, then 403 is returned.
- Given `required_for_tier_id` is provided, when the tier UUID does not exist, then 422 is returned with error code `VALIDATION_ERROR`.

*Request body:*
```json
{
  "name": "PANW AI Security Specialist",
  "description": "Certification for AI-powered security...",
  "course_type": "exam",
  "duration_hours": 40,
  "passing_score": 75,
  "certification_valid_months": 24,
  "is_required": false,
  "required_for_tier_id": null,
  "content_url": "https://learning.paloaltonetworks.com/..."
}
```

*Validation rules:*
- `name`: required, 2-300 chars, unique.
- `course_type`: required, one of `online`, `instructor_led`, `exam`.
- `duration_hours`: optional, > 0.
- `passing_score`: required, 1-100.
- `certification_valid_months`: required, 1-120.

---

**FR-TR-003: Get Course by ID** (P0)
`GET /api/v1/courses/:id`
Any authenticated user. Returns course details plus the requesting user's enrollment status if enrolled.

*Acceptance Criteria:*
- Given an authenticated user who is enrolled in the course, when GET /courses/:id is called, then the response includes `my_enrollment: { status, score, certified_at, expires_at }`.
- Given an authenticated user who is NOT enrolled, when GET /courses/:id is called, then `my_enrollment` is `null`.

---

**FR-TR-004: Update Course** (P0)
`PATCH /api/v1/courses/:id`
Admin only. Updates course fields. Cannot change `id` or `created_at`.

*Acceptance Criteria:*
- Given an admin user, when PATCH /courses/:id is called with `{ "passing_score": 80 }`, then the passing_score is updated.
- Given the course has existing enrollments, when `is_active` is set to false, then existing enrollments are NOT affected (users can still complete) but no new enrollments are accepted.

---

**FR-TR-005: Enroll in Course** (P0)
`POST /api/v1/courses/:id/enroll`
Any authenticated partner user (`partner_admin`, `partner_rep`) enrolls themselves. `partner_admin` can also enroll other users in their org by passing `user_id` in the body.

*Acceptance Criteria:*
- Given a partner_rep, when POST /courses/:id/enroll is called (no body), then a `user_certifications` row is created with `status=enrolled`, `user_id=req.user.sub`.
- Given a partner_admin, when POST /courses/:id/enroll is called with `{ "user_id": "other-user-uuid" }`, then the other user (who must be in the same org) is enrolled.
- Given the user is already enrolled with status `enrolled` or `in_progress`, when POST /enroll is called again, then 409 is returned with code `ALREADY_ENROLLED`.
- Given the user has a `failed` enrollment, when POST /enroll is called, then `attempts` is incremented and `status` is reset to `enrolled` (re-enrollment).
- Given the user has an `expired` enrollment, when POST /enroll is called, then `attempts` is incremented and `status` is reset to `enrolled` (renewal).
- Given the user has a `passed` (active, not expired) enrollment, when POST /enroll is called, then 409 is returned with code `ALREADY_CERTIFIED`.
- Given the course has `is_active = false`, when POST /enroll is called, then 422 is returned with code `COURSE_INACTIVE`.

*State transitions on enroll:*
```
(no record)  -> enrolled     [first enrollment]
failed       -> enrolled     [retry, attempts++]
expired      -> enrolled     [renewal, attempts++]
enrolled     -> 409 error    [already enrolled]
in_progress  -> 409 error    [already enrolled]
passed       -> 409 error    [if not expired]
```

---

**FR-TR-006: Record Course Completion** (P0)
`POST /api/v1/courses/:id/complete`
Admin or system call. Records score and determines pass/fail.

*Acceptance Criteria:*
- Given `score >= course.passing_score`, when POST /complete is called, then status is set to `passed`, `completed_at = NOW()`, `certified_at = NOW()`, `expires_at = NOW() + certification_valid_months`.
- Given `score < course.passing_score`, when POST /complete is called, then status is set to `failed`, `completed_at = NOW()`, `certified_at` remains null.
- After a `passed` completion, then a notification of type `certification_expiring` is NOT sent (it is not expiring yet); instead, the org's `certified_rep_count` is recalculated by counting distinct users with `status=passed AND expires_at > NOW()` for that org.
- After completion, an activity feed entry is logged: `"user@email.com completed course PCNSA with score 85"`.

*Request body:*
```json
{
  "user_id": "uuid",
  "score": 85
}
```

*Validation rules:*
- `user_id`: required, must have an existing enrollment with status `enrolled` or `in_progress`.
- `score`: required, 0-100.

---

**FR-TR-007: List Certifications** (P0)
`GET /api/v1/certifications`
Returns certifications scoped by role. Supports filtering by status, org, user, and expiry window.

*Acceptance Criteria:*
- Given a `partner_rep`, when GET /certifications is called, then only their own certifications are returned.
- Given a `partner_admin`, when GET /certifications is called, then certifications for all users in their org are returned.
- Given a `channel_manager`, when GET /certifications is called, then certifications for users in their assigned orgs are returned.
- Given an `admin`, when GET /certifications is called, then all certifications are returned.
- Given query param `?status=passed`, then only passed certifications are returned.

*Query params:* `?status=passed&user_id=xxx&org_id=xxx&page=1&per_page=25`

---

**FR-TR-008: Expiring Certifications** (P1)
`GET /api/v1/certifications/expiring`
Returns certifications expiring within N days (default 30). Scoped by role.

*Acceptance Criteria:*
- Given `?days=30`, when the request is processed, then return all certifications where `status = 'passed' AND expires_at BETWEEN NOW() AND NOW() + interval '30 days'`.
- Scoping follows the same rules as FR-TR-007.

*Query params:* `?days=30&org_id=xxx`

---

**FR-TR-009: Org Certification Summary** (P0)
`GET /api/v1/certifications/org-summary/:orgId`
Returns aggregate certification counts for an organization. Scoped by role (partners can only see their own org).

*Acceptance Criteria:*
- Given orgId, when the request is processed, then return:
  ```json
  {
    "success": true,
    "data": {
      "organization_id": "uuid",
      "organization_name": "CyberShield Solutions",
      "total_enrollments": 25,
      "by_status": {
        "enrolled": 3,
        "in_progress": 2,
        "passed": 15,
        "failed": 2,
        "expired": 3
      },
      "unique_certified_users": 14,
      "expiring_within_30_days": 2,
      "expiring_within_7_days": 0,
      "by_course": [
        { "course_id": "uuid", "course_name": "PCNSA", "passed": 10, "enrolled": 2, "expired": 1 }
      ],
      "tier_requirement": {
        "min_certified_reps": 12,
        "current_certified_reps": 14,
        "meets_requirement": true
      }
    }
  }
  ```
- Given a `partner_rep` requesting a different org's summary, then 403 is returned.

---

**FR-TR-010: Update Enrollment Status** (P1)
`PATCH /api/v1/certifications/:id`
Admin only. Allows manually updating certification status (e.g., marking `in_progress`, adjusting score, extending expiry).

*Acceptance Criteria:*
- Given an admin, when PATCH /certifications/:id is called with `{ "status": "in_progress" }`, then the status is updated.
- Given a status transition to `passed` via this endpoint, then `certified_at` and `expires_at` are auto-set if not provided.

---

### 6.2 Content Library

**FR-CL-001: List Folders** (P0)
`GET /api/v1/documents/folders`
Returns the folder tree. For partner roles, folders with `internal_only = true` are excluded. Folders with `visible_to_tiers` set are filtered: only returned if the partner's org tier_id is in the array (or if the array is null/empty, meaning all tiers).

*Acceptance Criteria:*
- Given a `partner_rep` at Innovator tier, when GET /documents/folders is called, then folders where `internal_only = false` AND (`visible_to_tiers IS NULL` OR `visible_to_tiers @> ARRAY[user.tier_id]`) are returned.
- Given an `admin`, when GET /documents/folders is called, then ALL folders are returned (including internal_only).
- Folders are returned as a flat list with `parent_id` for client-side tree building, sorted by `sort_order`.

*Response example:*
```json
{
  "success": true,
  "data": [
    { "id": "uuid", "name": "Sales Collateral", "parent_id": null, "sort_order": 1, "visible_to_tiers": null, "internal_only": false },
    { "id": "uuid", "name": "Battle Cards", "parent_id": "parent-uuid", "sort_order": 1, "visible_to_tiers": null, "internal_only": false },
    { "id": "uuid", "name": "Pricing Guides", "parent_id": "parent-uuid", "sort_order": 2, "visible_to_tiers": ["platinum-uuid", "diamond-uuid"], "internal_only": false }
  ]
}
```

---

**FR-CL-002: Create Folder** (P0)
`POST /api/v1/documents/folders`
Admin or channel_manager. Creates a folder in the document tree.

*Acceptance Criteria:*
- Given valid body with `parent_id`, when the parent folder exists, then the folder is created as a child.
- Given `parent_id` is null, when the request is processed, then a root-level folder is created.
- Given `visible_to_tiers` is an array of tier UUIDs, when the request is processed, then each UUID is validated against existing tiers.

*Request body:*
```json
{
  "name": "Deployment Guides",
  "parent_id": "technical-folder-uuid",
  "visible_to_tiers": null,
  "internal_only": false,
  "sort_order": 3
}
```

---

**FR-CL-003: Update Folder** (P1)
`PATCH /api/v1/documents/folders/:id`
Admin or channel_manager. Updates folder name, visibility, sort_order, or parent_id.

*Acceptance Criteria:*
- Given `visible_to_tiers` is changed from null to `[platinum-uuid]`, when the request is processed, then documents in this folder that inherit folder visibility are immediately affected on next read.
- Given `parent_id` is changed, when the new parent would create a circular reference (folder A -> B -> A), then 422 is returned with code `CIRCULAR_FOLDER_REFERENCE`.

---

**FR-CL-004: List Documents** (P0)
`GET /api/v1/documents`
Returns documents filtered by tier visibility. Supports pagination, folder filter, file_type filter, tag filter, and search.

*Tier filtering logic:*
```
IF user.role IN ('admin', 'channel_manager'):
  -> return all documents (including internal_only)
ELSE:
  -> exclude documents where internal_only = true
  -> exclude documents where visible_to_tiers IS NOT NULL
     AND user.tier_id NOT IN visible_to_tiers
  -> ALSO exclude documents in folders where:
     folder.internal_only = true
     OR (folder.visible_to_tiers IS NOT NULL AND user.tier_id NOT IN folder.visible_to_tiers)
```

*Acceptance Criteria:*
- Given a partner_rep at Registered tier, when GET /documents is called, then documents with `visible_to_tiers = [platinum-uuid, diamond-uuid]` are NOT returned.
- Given a partner_rep at Diamond tier, when GET /documents is called, then all non-internal documents are returned (Diamond qualifies for all tier-gated content).
- Given query param `?folder_id=xxx`, then only documents in that folder are returned.
- Given query param `?tags=battle_card,pricing`, then only documents that have ANY of the specified tags are returned.
- Given query param `?search=cortex`, then documents whose title or description contain "cortex" (case-insensitive) are returned.
- Given query param `?file_type=pdf`, then only PDF documents are returned.

*Query params:* `?folder_id=xxx&file_type=pdf&tags=sales,pricing&search=datasheet&is_featured=true&page=1&per_page=25&sort=created_at:desc`

---

**FR-CL-005: Upload Document** (P0)
`POST /api/v1/documents`
Admin or channel_manager. Uploads a document to S3/MinIO and creates the metadata record.

*Upload flow:*
```
1. Client sends multipart/form-data: file + metadata (title, folder_id, etc.)
2. Server validates file type and size.
3. Server uploads file to S3/MinIO bucket: documents/{folder_id}/{uuid}-{original_filename}
4. Server creates documents row with file_url = S3 key, file_size_bytes, file_type.
5. Server returns document metadata.
6. (Optional) If notification_targets is set, create notifications for eligible partners.
```

*Acceptance Criteria:*
- Given a valid file upload with metadata, when POST /documents is called, then the file is stored in S3 and a document record is created.
- Given file size exceeds 50 MB, when POST /documents is called, then 422 is returned with code `FILE_TOO_LARGE`.
- Given file type is not in the allowed list, when POST /documents is called, then 422 is returned with code `FILE_TYPE_NOT_ALLOWED`.
- Given `notify_partners = true` in the body, when the document is created, then notifications of type `document_shared` are sent to all partner_admin users at eligible tiers.

*Request body (multipart):*
```
file: <binary>
title: "Cortex XDR Battle Card Q2 2026"
description: "Updated competitive positioning and feature highlights"
folder_id: "uuid"
visible_to_tiers: ["platinum-uuid", "diamond-uuid"]  (JSON string)
internal_only: false
is_featured: false
tags: ["battle_card", "cortex", "xdr"]  (JSON string)
notify_partners: true
```

*Allowed file types:* `pdf`, `pptx`, `ppt`, `docx`, `doc`, `xlsx`, `xls`, `png`, `jpg`, `jpeg`, `gif`, `mp4`, `zip`
*Max file size:* 50 MB

---

**FR-CL-006: Get Document by ID** (P0)
`GET /api/v1/documents/:id`
Returns document metadata. Tier-filtered: returns 404 (not 403) if the user's tier does not qualify, to avoid revealing the document's existence.

*Acceptance Criteria:*
- Given a partner at a qualifying tier, when GET /documents/:id is called, then document metadata is returned.
- Given a partner at a non-qualifying tier, when GET /documents/:id is called, then 404 is returned (opaque denial).

---

**FR-CL-007: Download Document** (P0)
`GET /api/v1/documents/:id/download`
Returns a pre-signed S3 URL (302 redirect or JSON with download_url). Increments `download_count`. Tier-filtered.

*Acceptance Criteria:*
- Given a qualifying partner, when GET /documents/:id/download is called, then `download_count` is incremented by 1 (atomically: `UPDATE documents SET download_count = download_count + 1`) and a pre-signed URL valid for 5 minutes is returned.
- Given a non-qualifying partner, when GET /documents/:id/download is called, then 404 is returned.

*Response:*
```json
{
  "success": true,
  "data": {
    "download_url": "https://minio.local/documents/...?X-Amz-Signature=...",
    "filename": "Cortex-XDR-Battle-Card-Q2-2026.pdf",
    "file_type": "pdf",
    "file_size_bytes": 2450000,
    "expires_in_seconds": 300
  }
}
```

---

**FR-CL-008: Update Document** (P1)
`PATCH /api/v1/documents/:id`
Admin or channel_manager. Updates metadata. To replace the file itself, the admin should delete and re-upload (or use a dedicated replace endpoint in a future phase).

*Acceptance Criteria:*
- Given valid metadata updates, when PATCH /documents/:id is called, then the document record is updated.
- Given `visible_to_tiers` is changed, when the update is processed, then subsequent reads enforce the new visibility.
- `file_url`, `file_size_bytes`, `download_count` are NOT updatable via this endpoint.

---

**FR-CL-009: Delete Document** (P0)
`DELETE /api/v1/documents/:id`
Admin only. Deletes the document record and the S3 object.

*Acceptance Criteria:*
- Given an admin, when DELETE /documents/:id is called, then the document row is deleted and the S3 object is removed.
- Given a channel_manager, when DELETE /documents/:id is called, then 403 is returned.

---

### 6.3 Notification System

**FR-NT-001: List Notifications** (P0)
`GET /api/v1/notifications`
Returns notifications for the current user. Supports pagination and filter by `type`, `is_read`, and date range.

*Acceptance Criteria:*
- Given an authenticated user, when GET /notifications is called, then only notifications where `user_id = req.user.sub` are returned, ordered by `created_at DESC`.
- Given query param `?is_read=false`, then only unread notifications are returned.
- Given query param `?type=deal_update`, then only deal_update notifications are returned.

*Query params:* `?type=deal_update&is_read=false&since=2026-03-01&page=1&per_page=25`

*Response example:*
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "type": "deal_update",
      "title": "Deal DR-2026-00042 approved",
      "body": "Your deal registration has been approved by Sarah Chen.",
      "entity_type": "deal",
      "entity_id": "deal-uuid",
      "action_url": "/deals/deal-uuid",
      "is_read": false,
      "read_at": null,
      "created_at": "2026-03-19T14:32:00Z"
    }
  ],
  "meta": { "page": 1, "per_page": 25, "total": 12 }
}
```

---

**FR-NT-002: Unread Count** (P0)
`GET /api/v1/notifications/unread-count`
Returns the count of unread notifications for the current user. This endpoint is polled by the frontend (every 30 seconds) to update the bell icon badge.

*Acceptance Criteria:*
- Given a user with 5 unread notifications, when GET /notifications/unread-count is called, then `{ "success": true, "data": { "count": 5 } }` is returned.
- This endpoint must be fast (< 50ms). Use the partial index `idx_notifications_unread` on `(user_id, is_read) WHERE is_read = FALSE`.

---

**FR-NT-003: Mark Notification as Read** (P0)
`PATCH /api/v1/notifications/:id/read`
Marks a single notification as read. User can only mark their own notifications.

*Acceptance Criteria:*
- Given a notification belonging to the current user, when PATCH /notifications/:id/read is called, then `is_read = true` and `read_at = NOW()`.
- Given a notification belonging to a different user, when PATCH is called, then 404 is returned.
- Given the notification is already read, when PATCH is called, then 200 is returned (idempotent, no error).

---

**FR-NT-004: Mark All as Read** (P0)
`POST /api/v1/notifications/mark-all-read`
Marks all unread notifications for the current user as read.

*Acceptance Criteria:*
- Given a user with 12 unread notifications, when POST /notifications/mark-all-read is called, then all 12 are updated to `is_read = true, read_at = NOW()` in a single UPDATE statement.
- Returns `{ "success": true, "data": { "updated_count": 12 } }`.

---

**FR-NT-005: Delete Notification** (P1)
`DELETE /api/v1/notifications/:id`
Deletes a notification. User can only delete their own.

*Acceptance Criteria:*
- Given a notification belonging to the current user, when DELETE /notifications/:id is called, then the row is deleted.
- Given a notification belonging to another user, then 404 is returned.

---

**FR-NT-006: Notification Creation Integration** (P0)
Expand the existing `NotificationService.createNotification()` to be called from all relevant services. This is NOT a new endpoint but a service integration requirement.

*Notification triggers to wire up:*

| Trigger Event | notification_type | Recipients | Title Template |
|---------------|-------------------|------------|----------------|
| Deal submitted | `deal_update` | Assigned CM (or all CMs if unassigned) | "Deal {deal_number} submitted by {org_name}" |
| Deal approved | `deal_update` | Deal submitter | "Deal {deal_number} approved" |
| Deal rejected | `deal_update` | Deal submitter | "Deal {deal_number} rejected" |
| Deal expiring (30/7/1 days) | `deal_update` | Deal submitter | "Deal {deal_number} expires in {N} days" |
| Quote requires approval | `quote_approval` | Assigned CM | "Quote {quote_number} requires approval" |
| Quote approved | `quote_approval` | Quote creator | "Quote {quote_number} approved" |
| Quote rejected | `quote_approval` | Quote creator | "Quote {quote_number} rejected" |
| Lead assigned | `lead_assigned` | Partner admin of target org | "New lead {lead_number} assigned to your organization" |
| Lead SLA warning | `lead_assigned` | Assigned user | "Lead {lead_number} SLA deadline approaching" |
| MDF request approved | `mdf_update` | Submitter | "MDF request {request_number} approved ({amount})" |
| MDF request rejected | `mdf_update` | Submitter | "MDF request {request_number} rejected" |
| MDF claim approved | `mdf_update` | Submitter | "MDF claim for {request_number} approved" |
| MDF claim rejected | `mdf_update` | Submitter | "MDF claim for {request_number} rejected" |
| Tier upgrade | `tier_change` | Partner admin of org | "Congratulations! {org_name} upgraded to {new_tier}" |
| Tier downgrade warning | `tier_change` | Partner admin of org | "{org_name} tier downgrade to {new_tier} scheduled" |
| Cert expiring (30/7/1 days) | `certification_expiring` | Certified user + partner admin | "{course_name} certification expires in {N} days" |
| Cert expired | `certification_expiring` | Expired user + partner admin | "{course_name} certification has expired" |
| New document shared | `document_shared` | Partner admins at eligible tiers | "New document: {doc_title}" |
| System announcement | `system_announcement` | All active users | "{announcement_title}" |

*Acceptance Criteria:*
- Given a deal transitions to "approved" in `deal.service.ts`, when `approve()` is called, then `notificationService.createNotification()` is called with the deal submitter as recipient.
- Notification creation must be fire-and-forget (do not block the response). Use `Promise.catch()` to log errors without failing the parent operation.
- Duplicate notifications are prevented by checking `reminderExists()` for time-based notifications (cert expiry, deal expiry).

---

### 6.4 Activity Feed

**FR-AF-001: List Activity Feed** (P0)
`GET /api/v1/activity`
Returns activity feed entries scoped by role. Supports filtering by `entity_type`, `entity_id`, `actor_id`, `action`, `organization_id`, and date range.

*Acceptance Criteria:*
- Given a `partner_rep`, when GET /activity is called, then only activity for their org (`organization_id = req.user.org_id`) is returned.
- Given a `partner_admin`, when GET /activity is called, then all activity for their org is returned.
- Given a `channel_manager`, when GET /activity is called, then activity for their assigned orgs is returned.
- Given an `admin`, when GET /activity is called, then all activity is returned.
- Given query param `?entity_type=deal`, then only deal-related activity is returned.
- Given query param `?since=2026-03-01&until=2026-03-19`, then only activity within that date range is returned.

*Query params:* `?entity_type=deal&entity_id=xxx&actor_id=xxx&action=approved&organization_id=xxx&since=2026-03-01&until=2026-03-19&page=1&per_page=25`

*Response example:*
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "actor_id": "uuid",
      "actor_name": "Lisa Zhang",
      "actor_email": "rep@cybershield.com",
      "organization_id": "uuid",
      "organization_name": "CyberShield Solutions",
      "action": "submitted",
      "entity_type": "deal",
      "entity_id": "uuid",
      "summary": "rep@cybershield.com submitted deal DR-2026-00042",
      "changes": { "status": { "old": "draft", "new": "submitted" } },
      "created_at": "2026-03-19T10:15:00Z"
    }
  ],
  "meta": { "page": 1, "per_page": 25, "total": 156 }
}
```

---

## 7. Non-Functional Requirements

### Security

- **NFR-SEC-001**: Tier-filtered content returns 404 (not 403) to prevent information disclosure about documents a user cannot access. (P0)
- **NFR-SEC-002**: Pre-signed download URLs expire after 5 minutes and are single-use where supported by the storage backend. (P0)
- **NFR-SEC-003**: File upload validates MIME type server-side (do not trust Content-Type header alone). Use file magic bytes detection. (P1)
- **NFR-SEC-004**: Activity feed entries cannot be modified or deleted via API (append-only audit log). (P0)
- **NFR-SEC-005**: Notification content must not include sensitive data (no PII, no dollar amounts in the body — use generic text with a link to the entity). (P1)

### Performance

- **NFR-PERF-001**: `GET /notifications/unread-count` must respond in < 50ms at p95. Leverage the existing partial index. (P0)
- **NFR-PERF-002**: `GET /documents` with tier filtering must respond in < 200ms at p95 for up to 1000 documents. (P0)
- **NFR-PERF-003**: File upload endpoint must support files up to 50 MB without timeout. Use streaming upload to S3 (do not buffer entire file in memory). (P0)
- **NFR-PERF-004**: Cert expiry background job must complete in < 60 seconds for up to 10,000 certifications. (P1)

### Reliability

- **NFR-REL-001**: Cert expiry job is idempotent — running it twice produces no duplicate notifications (check `reminderExists` before creating). (P0)
- **NFR-REL-002**: If S3 upload fails, the document record must NOT be created (transactional: upload first, then insert DB row). (P0)
- **NFR-REL-003**: If notification creation fails, the parent operation (deal approval, etc.) must still succeed. Notification failures are logged but do not block. (P0)

### Maintainability

- **NFR-MAINT-001**: Follow existing repository pattern: `course.repository.ts`, `document.repository.ts`, `notification.repository.ts`, `activity.repository.ts`. (P0)
- **NFR-MAINT-002**: Follow existing validation pattern: Joi/Zod schemas in `src/validators/course.validator.ts`, `document.validator.ts`, `notification.validator.ts`. (P0)
- **NFR-MAINT-003**: All new routes registered in a central router file, consistent with existing `deal.routes.ts` pattern. (P0)

---

## 8. Technical Architecture

### System Architecture

```
                         ┌─────────────────────────────────────────────┐
                         │              React SPA (Vite)               │
                         │  ┌──────────┐ ┌──────────┐ ┌────────────┐  │
                         │  │ Training │ │ Content  │ │Notification│  │
                         │  │  Pages   │ │ Library  │ │   Bell +   │  │
                         │  │          │ │  Pages   │ │   Panel    │  │
                         │  └────┬─────┘ └────┬─────┘ └─────┬──────┘  │
                         └───────┼────────────┼─────────────┼──────────┘
                                 │            │             │
                          ───────┼────────────┼─────────────┼──── HTTP ────
                                 │            │             │
                         ┌───────▼────────────▼─────────────▼──────────┐
                         │              Express.js API                 │
                         │  ┌──────────┐ ┌──────────┐ ┌────────────┐  │
                         │  │ /courses │ │/documents│ │/notifica-  │  │
                         │  │ /certs   │ │ /folders │ │  tions     │  │
                         │  │          │ │          │ │ /activity  │  │
                         │  └────┬─────┘ └────┬─────┘ └─────┬──────┘  │
                         │       │            │             │          │
                         │  ┌────▼─────┐ ┌────▼─────┐ ┌────▼───────┐ │
                         │  │ Course   │ │ Document │ │Notification│ │
                         │  │ Service  │ │ Service  │ │  Service   │ │
                         │  └────┬─────┘ └────┬─────┘ └────┬───────┘ │
                         │       │            │             │          │
                         │  ┌────▼─────┐ ┌────▼─────┐ ┌────▼───────┐ │
                         │  │ Course   │ │ Document │ │Notification│ │
                         │  │  Repo    │ │   Repo   │ │   Repo     │ │
                         │  └────┬─────┘ └────┬─────┘ └────┬───────┘ │
                         └───────┼────────────┼─────────────┼──────────┘
                                 │            │             │
                    ┌────────────▼────┐  ┌────▼────┐  ┌────▼──────────┐
                    │   PostgreSQL    │  │ S3/MinIO│  │   Redis       │
                    │  courses        │  │ docs/   │  │ Bull queue:   │
                    │  user_certs     │  │ {uuid}- │  │ cert-expiry   │
                    │  documents      │  │ file    │  │               │
                    │  document_folders│  │         │  │               │
                    │  notifications  │  │         │  │               │
                    │  activity_feed  │  │         │  │               │
                    └─────────────────┘  └─────────┘  └───────────────┘
```

### New Files to Create

| Layer | File | Purpose |
|-------|------|---------|
| Route | `src/routes/course.routes.ts` | Training & cert endpoints |
| Route | `src/routes/document.routes.ts` | Content library endpoints |
| Route | `src/routes/notification.routes.ts` | Notification endpoints |
| Route | `src/routes/activity.routes.ts` | Activity feed endpoints |
| Controller | `src/controllers/course.controller.ts` | Thin controller for courses/certs |
| Controller | `src/controllers/document.controller.ts` | Thin controller for documents |
| Controller | `src/controllers/notification.controller.ts` | Thin controller for notifications |
| Controller | `src/controllers/activity.controller.ts` | Thin controller for activity |
| Service | `src/services/course.service.ts` | Course + certification business logic |
| Service | `src/services/document.service.ts` | Document + folder business logic, S3 interaction |
| Service (expand) | `src/services/notification.service.ts` | Add getAll, getUnreadCount, markRead, markAllRead, delete |
| Repository | `src/repositories/course.repository.ts` | Knex queries for courses + user_certifications |
| Repository | `src/repositories/document.repository.ts` | Knex queries for documents + document_folders |
| Repository | `src/repositories/notification.repository.ts` | Knex queries for notifications |
| Repository | `src/repositories/activity.repository.ts` | Knex queries for activity_feed |
| Validator | `src/validators/course.validator.ts` | Joi/Zod schemas for course/cert endpoints |
| Validator | `src/validators/document.validator.ts` | Joi/Zod schemas for document endpoints |
| Validator | `src/validators/notification.validator.ts` | Joi/Zod schemas for notification endpoints |
| Validator | `src/validators/activity.validator.ts` | Joi/Zod schemas for activity query params |
| Job | `src/jobs/certExpiry.job.ts` | Background job for cert expiry notifications + status updates |
| Page | `client/src/pages/training/CourseList.tsx` | Course catalog page |
| Page | `client/src/pages/training/CourseDetail.tsx` | Single course with enrollment |
| Page | `client/src/pages/training/MyCertifications.tsx` | User's certification dashboard |
| Page | `client/src/pages/training/OrgCertifications.tsx` | Org certification summary (admin/PA) |
| Page | `client/src/pages/training/index.ts` | Barrel export |
| Page | `client/src/pages/content/ContentLibrary.tsx` | Document browser with folders + search |
| Page | `client/src/pages/content/index.ts` | Barrel export |
| Component | `client/src/components/NotificationBell.tsx` | Nav bar bell icon with unread count badge |
| Component | `client/src/components/NotificationPanel.tsx` | Dropdown panel showing recent notifications |
| Component | `client/src/components/ActivityFeed.tsx` | Reusable activity feed component |

### Data Models (TypeScript Interfaces)

```typescript
// Course
interface Course {
  id: string;
  name: string;
  description: string | null;
  course_type: 'online' | 'instructor_led' | 'exam';
  duration_hours: number | null;
  passing_score: number;
  certification_valid_months: number;
  is_required: boolean;
  required_for_tier_id: string | null;
  content_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// UserCertification
interface UserCertification {
  id: string;
  user_id: string;
  course_id: string;
  status: 'enrolled' | 'in_progress' | 'passed' | 'failed' | 'expired';
  score: number | null;
  completed_at: string | null;
  certified_at: string | null;
  expires_at: string | null;
  certificate_url: string | null;
  attempts: number;
  created_at: string;
  updated_at: string;
}

// DocumentFolder
interface DocumentFolder {
  id: string;
  name: string;
  parent_id: string | null;
  visible_to_tiers: string[] | null;
  internal_only: boolean;
  sort_order: number;
  created_at: string;
}

// Document
interface Document {
  id: string;
  folder_id: string | null;
  title: string;
  description: string | null;
  file_url: string;
  file_type: string | null;
  file_size_bytes: number | null;
  visible_to_tiers: string[] | null;
  internal_only: boolean;
  is_featured: boolean;
  version: number;
  tags: string[] | null;
  download_count: number;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

// Notification (already defined in schema)
interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  read_at: string | null;
  email_sent: boolean;
  email_sent_at: string | null;
  action_url: string | null;
  created_at: string;
}
```

### Integration Points

| System | Integration Type | Purpose |
|--------|------------------|---------|
| S3/MinIO | AWS SDK v3 | File upload, download (pre-signed URLs), delete |
| Redis/Bull | Bull queue | Cert expiry background job scheduling |
| PostgreSQL | Knex.js | All CRUD operations across 6 tables |
| Existing services | Internal | NotificationService called from deal/quote/lead/MDF services |

---

## 9. State Machines

### 9.1 Enrollment Lifecycle

```
                                ┌─────────────┐
                    ┌──────────►│   enrolled   │◄──────────────┐
                    │           └──────┬───────┘               │
                    │                  │                        │
                    │           admin records                   │
                    │           progress (optional)             │
                    │                  │                        │
                    │           ┌──────▼───────┐               │
                    │           │ in_progress  │               │
                    │           └──────┬───────┘               │
                    │                  │                        │
                    │           admin records                   │
                    │           completion + score              │
                    │                  │                        │
                    │        ┌─────────┴──────────┐            │
                    │        │                    │            │
              (re-enroll)    │                    │       (re-enroll)
              attempts++  ┌──▼────┐          ┌───▼───┐   attempts++
                    │     │failed │          │passed │        │
                    │     └──┬────┘          └───┬───┘        │
                    │        │                   │            │
                    └────────┘          expires_at < NOW()    │
                                                 │            │
                                          ┌──────▼───────┐    │
                                          │   expired    │────┘
                                          └──────────────┘
```

**Valid transitions:**

| From | To | Trigger |
|------|----|---------|
| (none) | enrolled | POST /courses/:id/enroll |
| enrolled | in_progress | PATCH /certifications/:id (admin) |
| enrolled | passed | POST /courses/:id/complete (score >= passing) |
| enrolled | failed | POST /courses/:id/complete (score < passing) |
| in_progress | passed | POST /courses/:id/complete (score >= passing) |
| in_progress | failed | POST /courses/:id/complete (score < passing) |
| failed | enrolled | POST /courses/:id/enroll (re-enrollment) |
| passed | expired | Background job (expires_at < NOW()) |
| expired | enrolled | POST /courses/:id/enroll (renewal) |

**Invalid transitions (must reject with 422):**
- enrolled -> expired (only background job can expire; only `passed` certs expire)
- passed -> enrolled (if not expired yet -> 409 ALREADY_CERTIFIED)
- failed -> passed (must re-enroll first, then complete)

### 9.2 Document Upload Lifecycle

```
  Client                    Server                     S3/MinIO
    │                         │                           │
    │── POST /documents ─────►│                           │
    │   (multipart: file +    │── validate file ─────────►│
    │    metadata)            │   type, size              │
    │                         │                           │
    │                         │── stream upload ─────────►│
    │                         │   key: documents/{folder}/ │
    │                         │   {uuid}-{filename}       │
    │                         │                           │
    │                         │◄── upload success ────────│
    │                         │                           │
    │                         │── INSERT documents row ──►│ (PostgreSQL)
    │                         │   file_url = S3 key       │
    │                         │                           │
    │                         │── create notifications ──►│ (if notify=true)
    │                         │   for eligible partners   │
    │                         │                           │
    │◄── 201 { document } ───│                           │
    │                         │                           │
```

**Failure modes:**
- S3 upload fails -> return 500 `UPLOAD_FAILED`, no DB row created.
- DB insert fails after S3 upload -> attempt S3 delete (best effort), return 500.
- Notification creation fails after successful upload + DB insert -> log error, return 201 (document was created successfully).

---

## 10. Edge Cases

### Training & Certifications

| Edge Case | Expected Behavior |
|-----------|-------------------|
| User enrolls in course that is deactivated after enrollment | User can still complete the course. `is_active=false` only blocks new enrollments. |
| User passes course but org has no tier | `certification_valid_months` still applies. cert is tracked but does not contribute to any tier requirement. |
| User's cert expires and they re-enroll | New enrollment created (status=enrolled, attempts++). Old expires_at is preserved for audit in the updated row. |
| Two users at same org complete same course | Both get individual `user_certifications` rows. `certified_rep_count` counts DISTINCT users with any passed cert, not distinct course completions. |
| User is deactivated (is_active=false) while certified | Cert status remains `passed` but deactivated users should not be counted in `certified_rep_count`. The recalculation query must include `WHERE users.is_active = true`. |
| Course passing_score changes after enrollment | User is evaluated against the passing_score at the time of completion (current value), not the value at enrollment. |
| Cert expiry job runs but user already re-enrolled | If status is `enrolled` (re-enrolled before expiry), do NOT overwrite to `expired`. Only expire certs where status = `passed`. |

### Content Library

| Edge Case | Expected Behavior |
|-----------|-------------------|
| Partner org is downgraded from Diamond to Innovator | Partner immediately loses access to Diamond-only documents on next request. No grace period for content (unlike tier downgrade grace period for benefits). |
| Folder has `visible_to_tiers` but document inside has different `visible_to_tiers` | Both checks apply (AND logic). Document is visible only if user's tier passes BOTH folder AND document tier gates. |
| Folder has `visible_to_tiers = null` (all tiers) but document has `visible_to_tiers = [diamond-uuid]` | Document is restricted to Diamond only, even though folder is open. Document-level restriction is always enforced. |
| Document is in a folder with `internal_only = true` | Partners cannot see the document regardless of document-level settings. Folder `internal_only` takes precedence. |
| Admin deletes a folder that contains documents | Block deletion (422 `FOLDER_NOT_EMPTY`). Admin must move or delete documents first. |
| Document file_url points to a deleted S3 object | Download endpoint returns 404 with code `FILE_NOT_FOUND`. The document metadata record remains (admin can re-upload). |
| Concurrent downloads of the same document | `download_count` is incremented atomically with `SET download_count = download_count + 1`. No lost updates. |

### Notifications

| Edge Case | Expected Behavior |
|-----------|-------------------|
| User has 10,000+ notifications | Pagination is enforced (max per_page=100, matching existing PAGINATION constant). Old notifications are not auto-deleted in Phase 7; a cleanup job is a Phase 8 consideration. |
| Notification created for a deactivated user | Notification is still created (user may be reactivated). Deactivated users cannot log in to see it, which is acceptable. |
| Duplicate cert expiry notification | `reminderExists()` checks for existing notification with matching entity_type + entity_id + title pattern. If found, skip creation. |
| Notification for an entity the user can no longer access | Clicking the action_url will result in a 403/404 on the entity endpoint. The notification itself remains visible. Frontend should handle this gracefully. |

---

## 11. Background Job Specifications

### 11.1 Certification Expiry Job

**File:** `src/jobs/certExpiry.job.ts`
**Schedule:** Daily at 8:00 AM UTC (cron: `0 8 * * *`)
**Queue:** Bull queue `cert-expiry` on Redis

**Algorithm:**

```
FUNCTION processCertExpiryNotifications():
  results = { notified_30d: 0, notified_7d: 0, notified_1d: 0, expired: 0, errors: 0 }

  // ─── Step 1: Send warning notifications ─────────────────
  FOR EACH window IN [30, 7, 1]:
    certs = SELECT uc.*, c.name as course_name, u.email, u.organization_id
            FROM user_certifications uc
            JOIN courses c ON uc.course_id = c.id
            JOIN users u ON uc.user_id = u.id
            WHERE uc.status = 'passed'
              AND uc.expires_at BETWEEN NOW() AND NOW() + interval '{window} days'
              AND u.is_active = true

    FOR EACH cert IN certs:
      // Deduplicate: check if we already sent this warning
      alreadySent = reminderExists('certification', cert.id, 'expires in {window} day')
      IF alreadySent: CONTINUE

      // Notify the certified user
      createNotification({
        user_id: cert.user_id,
        type: 'certification_expiring',
        title: '{course_name} certification expires in {window} days',
        body: 'Your {course_name} certification expires on {expires_at}. Re-enroll to maintain your certification.',
        entity_type: 'certification',
        entity_id: cert.id,
        action_url: '/training/certifications'
      })

      // Also notify the partner_admin of the user's org
      IF cert.organization_id:
        partner_admins = SELECT id FROM users
                         WHERE organization_id = cert.organization_id
                           AND role = 'partner_admin'
                           AND is_active = true
        FOR EACH admin IN partner_admins:
          createNotification({
            user_id: admin.id,
            type: 'certification_expiring',
            title: '{user_email} {course_name} certification expires in {window} days',
            entity_type: 'certification',
            entity_id: cert.id,
            action_url: '/training/org-certifications'
          })

      results.notified_{window}d++

  // ─── Step 2: Auto-expire passed certs past expires_at ────
  expired_count = UPDATE user_certifications
                  SET status = 'expired', updated_at = NOW()
                  WHERE status = 'passed'
                    AND expires_at < NOW()
  results.expired = expired_count

  // ─── Step 3: Recalculate certified_rep_count for affected orgs ─
  affected_orgs = SELECT DISTINCT u.organization_id
                  FROM user_certifications uc
                  JOIN users u ON uc.user_id = u.id
                  WHERE uc.updated_at > NOW() - interval '1 day'
                    AND u.organization_id IS NOT NULL

  FOR EACH org_id IN affected_orgs:
    new_count = SELECT COUNT(DISTINCT uc.user_id)
                FROM user_certifications uc
                JOIN users u ON uc.user_id = u.id
                WHERE u.organization_id = org_id
                  AND u.is_active = true
                  AND uc.status = 'passed'
                  AND uc.expires_at > NOW()
    UPDATE organizations SET certified_rep_count = new_count WHERE id = org_id

  RETURN results
```

**Idempotency:** Uses `reminderExists()` to check for existing notifications with matching title patterns. Safe to run multiple times per day.

**Error handling:** Individual cert failures are caught and counted. The job continues processing remaining certs. Errors are logged with cert ID for investigation.

**Monitoring:** Job returns counts of notifications sent and certs expired. These should be logged and available in admin dashboard.

---

## 12. Implementation Phases

### Phase 7A: Notification System + Activity Feed (Week 1)

**Objectives:**
- Expand notification service with full CRUD.
- Create notification routes/controller/repository.
- Create activity feed route/controller/repository.
- Wire notification creation into existing services (deal, quote, lead, MDF).

**Deliverables:**
- `notification.repository.ts`, `notification.controller.ts`, `notification.routes.ts`, `notification.validator.ts`
- `activity.repository.ts`, `activity.controller.ts`, `activity.routes.ts`, `activity.validator.ts`
- Updated `notification.service.ts` with getAll, getUnreadCount, markRead, markAllRead, delete.
- Notification triggers wired into `deal.service.ts`, `quote.service.ts`, `lead.service.ts`, `mdf.service.ts`.

**Dependencies:** None (builds on existing Phase 1-6 code).

**Rationale:** Notifications are a cross-cutting concern used by all other Phase 7 modules. Building this first means Training and Content Library can create notifications from day one.

---

### Phase 7B: Training & Certifications Backend (Week 2)

**Objectives:**
- Course CRUD endpoints.
- Enrollment + completion workflow.
- Certification listing, expiry query, org summary.
- Cert expiry background job.

**Deliverables:**
- `course.repository.ts`, `course.service.ts`, `course.controller.ts`, `course.routes.ts`, `course.validator.ts`
- `certExpiry.job.ts` registered in Bull queue with cron schedule.
- `certified_rep_count` recalculation on course completion.

**Dependencies:** Phase 7A complete (notification service used by cert expiry job and completion events).

---

### Phase 7C: Content Library Backend (Week 3)

**Objectives:**
- Folder CRUD endpoints.
- Document CRUD with S3 upload/download.
- Tier-filtered document visibility.
- Pre-signed URL generation for downloads.

**Deliverables:**
- `document.repository.ts`, `document.service.ts`, `document.controller.ts`, `document.routes.ts`, `document.validator.ts`
- S3 upload/download utility functions (reuse/extend MDF proof upload utilities from Phase 5).
- `document_shared` notification trigger on document creation.

**Dependencies:** Phase 7A complete (notification service). MinIO/S3 configuration already exists from Phase 5.

---

### Phase 7D: Frontend — Notifications + Activity (Week 4)

**Objectives:**
- NotificationBell component in nav bar (polling unread count every 30s).
- NotificationPanel dropdown with infinite scroll.
- Activity feed component and page.

**Deliverables:**
- `NotificationBell.tsx`, `NotificationPanel.tsx` components.
- `ActivityFeed.tsx` reusable component.
- TanStack Query hooks: `useNotifications`, `useUnreadCount`, `useMarkRead`, `useMarkAllRead`, `useActivityFeed`.
- Integration into existing layout shell (add bell icon to top nav).

**Dependencies:** Phase 7A backend endpoints deployed.

---

### Phase 7E: Frontend — Training + Content Library (Week 5)

**Objectives:**
- Course catalog page with search and filters.
- Course detail page with enrollment action.
- My Certifications page (personal dashboard).
- Org Certifications page (partner_admin / CM / admin view).
- Content Library page with folder tree, search, tag filter.
- Document download integration.

**Deliverables:**
- `CourseList.tsx`, `CourseDetail.tsx`, `MyCertifications.tsx`, `OrgCertifications.tsx`
- `ContentLibrary.tsx` with folder tree sidebar and document grid.
- TanStack Query hooks: `useCourses`, `useCourse`, `useEnroll`, `useCertifications`, `useOrgCertSummary`, `useDocuments`, `useFolders`, `useDownloadDocument`.
- React Router routes added under `/training/*` and `/content/*`.

**Dependencies:** Phases 7B and 7C backend endpoints deployed. Phase 7D notification components available.

---

## 13. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| S3/MinIO configuration drift from Phase 5 | Medium | Medium | Reuse the exact S3 client and bucket config from MDF proof uploads. Test upload/download in dev before building document endpoints. |
| Notification volume overwhelms the UI (too many notifications) | Medium | Low | Implement pagination with per_page=25 default. Future: add notification preferences and digest mode in Phase 8. |
| Cert expiry job marks certs expired while user is mid-re-enrollment | Low | High | Query only `status = 'passed'` certs for expiry. If user has re-enrolled (status=enrolled), their new enrollment is not affected. |
| Tier-filtered content returns stale results after tier change | Low | Medium | Tier filtering runs at query time (not cached). Tier changes take effect immediately for content access. |
| Large file uploads timeout behind reverse proxy | Medium | Medium | Configure NGINX/proxy `client_max_body_size` to 55MB. Use streaming upload (multer with S3 storage engine) to avoid buffering. |
| Notification bell polling (every 30s) creates excessive DB load | Low | Medium | The partial index `idx_notifications_unread` makes the count query near-instant. At scale (1000+ concurrent users), add Redis cache for unread counts with 10s TTL. |

---

## 14. Dependencies

### External Dependencies

- **MinIO/S3**: File storage for document uploads. Already configured in Phase 5. If MinIO is down, document upload and download fail; all other Phase 7 features continue working.
- **Redis**: Required for Bull queue (cert expiry job). Already configured in Phase 1. If Redis is down, background jobs do not run but API endpoints still function.

### Internal Dependencies

- **Phase 1 (Auth + RBAC)**: JWT middleware, role-based authorization, org scoping. No changes needed.
- **Phase 1 (Database tables)**: All 6 tables already exist. No new migrations required.
- **Phase 1 (Seed data)**: 5 courses seeded. Will be used for testing enrollment/completion flows.
- **Phase 5 (S3 utilities)**: MDF proof upload code provides S3 client and bucket configuration to reuse.
- **Existing notification.service.ts**: 55-line stub to be expanded (not replaced).
- **Existing activityLogger.ts**: 103-line middleware already logging POST/PATCH/DELETE. Activity feed endpoint reads from the table this middleware writes to. No changes to the middleware needed.

### Blocking vs Non-Blocking

| Dependency | Blocking? | Notes |
|------------|-----------|-------|
| Phase 7A (notifications) | Blocks 7B, 7C | Other modules need notification service |
| Phase 7B (training backend) | Blocks 7E (training frontend) | |
| Phase 7C (content backend) | Blocks 7E (content frontend) | |
| Phase 7D (notification frontend) | Non-blocking for 7E | Can be developed in parallel with backend work |

---

## 15. Error Codes (New)

| Code | HTTP | Description |
|------|------|-------------|
| `ALREADY_ENROLLED` | 409 | User already has an active enrollment (enrolled/in_progress) |
| `ALREADY_CERTIFIED` | 409 | User already has a valid (non-expired) passed certification |
| `COURSE_INACTIVE` | 422 | Cannot enroll in an inactive course |
| `COURSE_NOT_FOUND` | 404 | Course ID does not exist |
| `ENROLLMENT_NOT_FOUND` | 404 | No enrollment found for this user + course |
| `INVALID_COMPLETION_STATUS` | 422 | Can only complete enrollments with status enrolled/in_progress |
| `FILE_TOO_LARGE` | 422 | Uploaded file exceeds 50 MB limit |
| `FILE_TYPE_NOT_ALLOWED` | 422 | File type not in allowed list |
| `UPLOAD_FAILED` | 500 | S3 upload failed |
| `FILE_NOT_FOUND` | 404 | S3 object does not exist for this document |
| `FOLDER_NOT_EMPTY` | 422 | Cannot delete folder that contains documents |
| `CIRCULAR_FOLDER_REFERENCE` | 422 | Folder parent_id would create a circular reference |
| `NOTIFICATION_NOT_FOUND` | 404 | Notification does not exist or belongs to another user |

---

## 16. Frontend Page Specifications

### 16.1 Course Catalog (`/training/courses`)

**Layout:** Full-width page with search bar at top, filter sidebar (course_type, is_required, tier), course cards in a grid.

**Course Card Contents:**
- Course name, course_type badge (Online / Instructor Led / Exam)
- Duration in hours, passing score
- "Required for [Tier Name]" badge if is_required = true
- User's enrollment status badge: Not Enrolled / Enrolled / In Progress / Passed (green) / Failed (red) / Expired (amber)
- Expiry date if passed
- "Enroll" CTA button (or "Re-enroll" if failed/expired, or "View" if passed)

**Role-specific behavior:**
- Admin: sees "Create Course" button at top. Course cards have "Edit" option.
- All others: read-only catalog with enrollment actions.

### 16.2 Course Detail (`/training/courses/:id`)

**Layout:** Single course page with course info, enrollment action, and completion history.

**Sections:**
1. Course header: name, description, type, duration, passing score, validity period.
2. Enrollment status panel: current status, score (if completed), certified_at, expires_at, attempts count.
3. "Enroll" / "Re-enroll" / "Already Certified" action button.
4. Content link: external URL opens in new tab.
5. Admin-only: "Record Completion" form (select user, enter score). "Edit Course" button.

### 16.3 My Certifications (`/training/my-certifications`)

**Layout:** Table of the current user's certifications with status badges and expiry dates.

**Columns:** Course Name | Status | Score | Certified Date | Expires | Actions
**Actions:** "Re-enroll" (if failed/expired), "View Course" link
**Badges:** Passed (green), Enrolled (blue), In Progress (yellow), Failed (red), Expired (amber), "Expiring Soon" (amber pulsing if < 30 days)

### 16.4 Org Certifications (`/training/org-certifications`)

**Layout:** Dashboard view for partner_admin / channel_manager / admin.

**Sections:**
1. Summary cards: Total Certified, Expiring (30d), Expired, Tier Requirement Met (yes/no).
2. By-course breakdown table: Course Name | Enrolled | Passed | Failed | Expired
3. By-user table: User Name | Email | Certifications (count) | Nearest Expiry
4. Channel Manager: dropdown to switch between assigned orgs.
5. Admin: search/filter by org.

### 16.5 Content Library (`/content`)

**Layout:** Two-panel layout. Left: folder tree. Right: document grid/list with search and filters.

**Left Panel (Folder Tree):**
- Hierarchical folder list with expand/collapse.
- Click folder to filter documents.
- Admin/CM: "New Folder" button, right-click "Edit Folder".

**Right Panel (Document Grid):**
- Search bar with tag filter chips and file_type dropdown.
- Toggle between grid (cards) and list (table) view.
- Document card: title, description (truncated), file_type icon, download_count, "Featured" badge, tags, upload date.
- Click to download (via pre-signed URL).
- Admin/CM: "Upload Document" button, "Edit" / "Delete" options per document.

**Tier visibility UX:**
- Partners only see documents they qualify for (server-side filtering). No "locked" documents are shown.
- Admin/CM see all documents with a "Tier: [names]" label showing visibility scope.

### 16.6 Notification Bell + Panel

**Location:** Top-right of the app shell nav bar, next to user avatar.

**Bell Icon:**
- Red badge with unread count (polled every 30 seconds via `GET /notifications/unread-count`).
- Badge disappears when count = 0.
- Click toggles dropdown panel.

**Notification Panel (Dropdown):**
- Max height 480px, scrollable.
- Each notification: icon (by type), title, body preview (1 line), relative time ("5 min ago").
- Unread items have a blue left border.
- Click notification: mark as read + navigate to `action_url`.
- "Mark All as Read" link at the bottom.
- "View All" link navigates to a full notifications page (optional stretch goal).

### 16.7 Activity Feed Page (`/activity`)

**Layout:** Full-width chronological feed with filters.

**Filters:** Entity Type dropdown (deal, quote, lead, mdf, certification, document), Actor search, Date range picker, Org filter (admin/CM only).

**Feed items:** Icon (by entity_type), actor name, action verb, entity reference (linked), relative time, org name badge.

**Example feed item:**
> Lisa Zhang **submitted** Deal [DR-2026-00042](/deals/uuid) -- CyberShield Solutions -- 2 hours ago

---

## 17. Appendices

### A. Glossary

- **Enrollment**: A `user_certifications` row linking a user to a course. Tracks status from enrolled through passed/failed/expired.
- **Certification**: An enrollment with `status = 'passed'` and `expires_at > NOW()`. An "active certification."
- **Tier-gated content**: Documents or folders with `visible_to_tiers` set to a non-null array of tier UUIDs. Only partners at those tiers can access.
- **Pre-signed URL**: A time-limited URL generated by S3/MinIO that allows direct file download without exposing storage credentials.
- **Certified rep count**: `organizations.certified_rep_count` — a denormalized count of distinct active users in the org who hold at least one active certification.

### B. Constants to Add

```typescript
// src/config/constants.ts additions

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
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
  'application/vnd.ms-powerpoint', // ppt
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/msword', // doc
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/vnd.ms-excel', // xls
  'image/png',
  'image/jpeg',
  'image/gif',
  'video/mp4',
  'application/zip',
];
export const DOCUMENT_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
export const DOCUMENT_PRESIGN_EXPIRY_SECONDS = 300; // 5 minutes

export const NOTIFICATION_POLL_INTERVAL_MS = 30_000; // 30 seconds (frontend)
export const NOTIFICATION_MAX_AGE_DAYS = 90; // for future cleanup job
```

### C. Seed Data Additions (Phase 7)

The existing seed file (`seeds/001_seed_data.ts`) already includes 5 courses. Phase 7 should add:

1. **Document folders** (5-8 folders):
   - Sales Collateral (root)
     - Battle Cards (child)
     - Pricing Guides (child, visible_to_tiers: [Platinum, Diamond])
   - Technical Resources (root)
     - Deployment Guides (child)
     - API Documentation (child)
   - Internal (root, internal_only: true)

2. **Sample documents** (10-15 documents):
   - One per folder, various file types.
   - Some with tier restrictions, some open to all.
   - Realistic PANW-themed titles (e.g., "PA-5400 Deployment Guide", "Prisma Access Battle Card").

3. **User certifications** (8-10 enrollments):
   - CyberShield reps: multiple passed certs (supports Diamond tier requirement).
   - CloudGuard reps: some passed, some enrolled.
   - NetSecure: one passed cert expiring in 7 days (tests expiry notification).
   - TechDefend: one enrolled, none passed (Registered tier, 0 certified reps).

4. **Sample notifications** (5-10):
   - Mix of deal_update, lead_assigned, certification_expiring.
   - Some read, some unread.

### D. API Summary Table

| # | Method | Endpoint | Auth | Phase |
|---|--------|----------|------|-------|
| 1 | GET | `/courses` | * | 7B |
| 2 | POST | `/courses` | admin | 7B |
| 3 | GET | `/courses/:id` | * | 7B |
| 4 | PATCH | `/courses/:id` | admin | 7B |
| 5 | POST | `/courses/:id/enroll` | partner_admin, partner_rep | 7B |
| 6 | POST | `/courses/:id/complete` | admin | 7B |
| 7 | GET | `/certifications` | * (scoped) | 7B |
| 8 | GET | `/certifications/expiring` | * (scoped) | 7B |
| 9 | GET | `/certifications/org-summary/:orgId` | * (scoped) | 7B |
| 10 | PATCH | `/certifications/:id` | admin | 7B |
| 11 | GET | `/documents` | * (tier-filtered) | 7C |
| 12 | POST | `/documents` | admin, channel_manager | 7C |
| 13 | GET | `/documents/:id` | * (tier-filtered) | 7C |
| 14 | GET | `/documents/:id/download` | * (tier-filtered) | 7C |
| 15 | PATCH | `/documents/:id` | admin, channel_manager | 7C |
| 16 | DELETE | `/documents/:id` | admin | 7C |
| 17 | GET | `/documents/folders` | * (tier-filtered) | 7C |
| 18 | POST | `/documents/folders` | admin, channel_manager | 7C |
| 19 | PATCH | `/documents/folders/:id` | admin, channel_manager | 7C |
| 20 | GET | `/notifications` | * (own) | 7A |
| 21 | GET | `/notifications/unread-count` | * (own) | 7A |
| 22 | PATCH | `/notifications/:id/read` | * (own) | 7A |
| 23 | POST | `/notifications/mark-all-read` | * (own) | 7A |
| 24 | DELETE | `/notifications/:id` | * (own) | 7A |
| 25 | GET | `/activity` | * (scoped) | 7A |

**Total: 25 endpoints across 4 modules.**
