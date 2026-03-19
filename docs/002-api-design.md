# PRM Portal — REST API Design

Base URL: `/api/v1`

All responses follow envelope format:
```json
{
  "success": true,
  "data": { ... },
  "meta": { "page": 1, "per_page": 25, "total": 142 },
  "errors": null
}
```

Error responses:
```json
{
  "success": false,
  "data": null,
  "errors": [{ "code": "DEAL_CONFLICT", "message": "...", "field": "customer_email" }]
}
```

---

## Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Partner self-registration (creates org + partner_admin user) |
| POST | `/auth/login` | Email/password login, returns JWT access + refresh tokens |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/logout` | Invalidate refresh token |
| POST | `/auth/forgot-password` | Send password reset email |
| POST | `/auth/reset-password` | Reset password with token |
| GET  | `/auth/me` | Get current user profile |
| PATCH | `/auth/me` | Update current user profile |

### Token Structure (JWT)
```json
{
  "sub": "user-uuid",
  "email": "user@partner.com",
  "role": "partner_admin",
  "org_id": "org-uuid",
  "tier_id": "tier-uuid",
  "iat": 1711000000,
  "exp": 1711003600
}
```
- Access token TTL: 1 hour
- Refresh token TTL: 30 days

---

## Users

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users` | admin, channel_manager | List users (filterable by role, org, active) |
| POST | `/users` | admin, partner_admin | Create user (admin creates any; partner_admin creates within own org) |
| GET | `/users/:id` | * | Get user (scoped to own org for partners) |
| PATCH | `/users/:id` | admin, partner_admin (own org) | Update user |
| DELETE | `/users/:id` | admin | Soft-delete (set is_active=false) |
| GET | `/users/:id/certifications` | * | List certifications for user |
| GET | `/users/:id/activity` | * | Activity feed for user |

**Query params:** `?role=partner_rep&org_id=xxx&is_active=true&page=1&per_page=25`

---

## Organizations (Partner Accounts)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/organizations` | admin, channel_manager | List all partner orgs (with filters) |
| POST | `/organizations` | admin, channel_manager | Create partner org |
| GET | `/organizations/:id` | * (scoped) | Get org details with tier info |
| PATCH | `/organizations/:id` | admin, channel_manager, partner_admin (own) | Update org |
| GET | `/organizations/:id/dashboard` | * (scoped) | Org performance dashboard (KPIs, charts) |
| GET | `/organizations/:id/deals` | * (scoped) | Deals for this org |
| GET | `/organizations/:id/leads` | * (scoped) | Leads assigned to this org |
| GET | `/organizations/:id/quotes` | * (scoped) | Quotes for this org |
| GET | `/organizations/:id/mdf` | * (scoped) | MDF allocations & requests |
| GET | `/organizations/:id/users` | * (scoped) | Users in this org |
| POST | `/organizations/:id/recalculate-tier` | admin, channel_manager | Trigger tier recalculation |

**Query params:** `?status=active&tier_id=xxx&channel_manager_id=xxx&search=acme`

---

## Partner Tiers

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/tiers` | * | List all tiers with requirements & benefits |
| POST | `/tiers` | admin | Create tier |
| GET | `/tiers/:id` | * | Get tier details |
| PATCH | `/tiers/:id` | admin | Update tier |
| DELETE | `/tiers/:id` | admin | Delete tier (only if no orgs assigned) |
| GET | `/tiers/:id/organizations` | admin, channel_manager | Orgs at this tier |

---

## Deal Registration

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/deals` | * (scoped) | List deals — partners see own org's; CM sees assigned; admin sees all |
| POST | `/deals` | partner_admin, partner_rep | Register new deal (auto-conflict check) |
| GET | `/deals/:id` | * (scoped) | Get deal with products, history, conflict info |
| PATCH | `/deals/:id` | * (scoped, status-dependent) | Update deal fields |
| POST | `/deals/:id/submit` | partner_admin, partner_rep | Submit draft for review |
| POST | `/deals/:id/approve` | channel_manager, admin | Approve deal registration |
| POST | `/deals/:id/reject` | channel_manager, admin | Reject with reason |
| POST | `/deals/:id/mark-won` | * (scoped) | Mark deal as won (triggers revenue update) |
| POST | `/deals/:id/mark-lost` | * (scoped) | Mark deal as lost |
| GET | `/deals/:id/conflicts` | * (scoped) | Check for conflicting deals |
| GET | `/deals/:id/history` | * (scoped) | Status change audit trail |
| POST | `/deals/:id/products` | * (scoped) | Add product to deal |
| DELETE | `/deals/:id/products/:productId` | * (scoped) | Remove product from deal |
| GET | `/deals/conflict-check` | * | Pre-submission conflict check (query params: customer_company, customer_email, product_id) |
| GET | `/deals/expiring` | channel_manager, admin | Deals expiring within N days |

**Query params:** `?status=approved&org_id=xxx&submitted_by=xxx&customer_company=acme&min_value=10000&max_value=500000&expected_close_before=2026-06-30&page=1&per_page=25&sort=estimated_value:desc`

---

## Products / SKUs

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/products` | * | List products (partners see available_to_partners only) |
| POST | `/products` | admin | Create product |
| GET | `/products/:id` | * | Get product with tier pricing |
| PATCH | `/products/:id` | admin | Update product |
| DELETE | `/products/:id` | admin | Soft-delete |
| GET | `/products/categories` | * | List product categories (tree) |
| POST | `/products/categories` | admin | Create category |
| PATCH | `/products/categories/:id` | admin | Update category |
| GET | `/products/:id/tier-pricing` | admin, channel_manager | Get tier-specific pricing |
| PUT | `/products/:id/tier-pricing/:tierId` | admin | Set tier-specific pricing |

**Query params:** `?category_id=xxx&product_type=software&is_active=true&search=firewall`

---

## CPQ Quotes

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/quotes` | * (scoped) | List quotes |
| POST | `/quotes` | partner_admin, partner_rep | Create quote (optionally from deal) |
| GET | `/quotes/:id` | * (scoped) | Get quote with line items |
| PATCH | `/quotes/:id` | * (owner, draft/rejected only) | Update quote header |
| DELETE | `/quotes/:id` | * (owner, draft only) | Delete draft quote |
| POST | `/quotes/:id/lines` | * (owner) | Add line item (auto-calculates pricing + discount check) |
| PATCH | `/quotes/:id/lines/:lineId` | * (owner) | Update line item |
| DELETE | `/quotes/:id/lines/:lineId` | * (owner) | Remove line item |
| POST | `/quotes/:id/submit` | partner_admin, partner_rep | Submit for approval (if required) |
| POST | `/quotes/:id/approve` | channel_manager, admin | Approve quote |
| POST | `/quotes/:id/reject` | channel_manager, admin | Reject quote |
| POST | `/quotes/:id/send` | * (owner) | Send to customer (marks sent, generates PDF) |
| POST | `/quotes/:id/clone` | * (scoped) | Clone quote as new draft |
| GET | `/quotes/:id/pdf` | * (scoped) | Download quote PDF |
| POST | `/quotes/:id/recalculate` | * (owner) | Recalculate all pricing |

---

## Leads

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/leads` | * (scoped) | List leads |
| POST | `/leads` | admin, channel_manager | Create lead |
| GET | `/leads/:id` | * (scoped) | Get lead details |
| PATCH | `/leads/:id` | * (scoped) | Update lead |
| POST | `/leads/:id/assign` | admin, channel_manager | Assign lead to partner org + optional user |
| POST | `/leads/:id/accept` | partner_admin, partner_rep (assigned) | Accept assigned lead |
| POST | `/leads/:id/return` | partner_admin, partner_rep (assigned) | Return lead with reason |
| POST | `/leads/:id/convert` | partner_admin, partner_rep (assigned) | Convert lead to deal registration |
| POST | `/leads/:id/disqualify` | * (scoped) | Disqualify lead |
| POST | `/leads/bulk-assign` | admin, channel_manager | Bulk assign leads to partners |
| GET | `/leads/unassigned` | admin, channel_manager | Leads awaiting assignment |

**Query params:** `?status=new&score_min=50&source=marketing&assigned_org_id=xxx`

---

## MDF / Co-op Funds

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/mdf/allocations` | * (scoped) | List MDF allocations |
| POST | `/mdf/allocations` | admin, channel_manager | Create allocation for partner |
| GET | `/mdf/allocations/:id` | * (scoped) | Get allocation with remaining balance |
| PATCH | `/mdf/allocations/:id` | admin, channel_manager | Update allocation |
| GET | `/mdf/requests` | * (scoped) | List MDF requests |
| POST | `/mdf/requests` | partner_admin, partner_rep | Submit MDF request |
| GET | `/mdf/requests/:id` | * (scoped) | Get MDF request details |
| PATCH | `/mdf/requests/:id` | * (owner, draft/rejected) | Update request |
| POST | `/mdf/requests/:id/submit` | partner_admin, partner_rep | Submit for approval |
| POST | `/mdf/requests/:id/approve` | channel_manager, admin | Approve request (set approved_amount) |
| POST | `/mdf/requests/:id/reject` | channel_manager, admin | Reject request |
| POST | `/mdf/requests/:id/claim` | partner_admin, partner_rep | Submit claim with proof of execution |
| POST | `/mdf/requests/:id/approve-claim` | channel_manager, admin | Approve claim |
| POST | `/mdf/requests/:id/reject-claim` | channel_manager, admin | Reject claim |
| POST | `/mdf/requests/:id/reimburse` | admin | Mark as reimbursed |

---

## Training & Certifications

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/courses` | * | List available courses |
| POST | `/courses` | admin | Create course |
| GET | `/courses/:id` | * | Get course details |
| PATCH | `/courses/:id` | admin | Update course |
| POST | `/courses/:id/enroll` | * | Enroll current user |
| POST | `/courses/:id/complete` | system/admin | Record completion + score |
| GET | `/certifications` | * (scoped) | List certifications (by org or user) |
| GET | `/certifications/expiring` | * (scoped) | Certs expiring within N days |
| GET | `/certifications/org-summary/:orgId` | * (scoped) | Certification summary for org |

---

## Documents / Content Library

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/documents` | * | List documents (filtered by tier visibility) |
| POST | `/documents` | admin, channel_manager | Upload document |
| GET | `/documents/:id` | * (tier-filtered) | Get document metadata |
| GET | `/documents/:id/download` | * (tier-filtered) | Download file (increments counter) |
| PATCH | `/documents/:id` | admin, channel_manager | Update metadata |
| DELETE | `/documents/:id` | admin | Delete document |
| GET | `/documents/folders` | * | List folder tree |
| POST | `/documents/folders` | admin, channel_manager | Create folder |
| PATCH | `/documents/folders/:id` | admin, channel_manager | Update folder |

**Query params:** `?folder_id=xxx&file_type=pdf&tags=sales,pricing&search=datasheet`

---

## Notifications

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/notifications` | * | List notifications for current user |
| GET | `/notifications/unread-count` | * | Get unread count |
| PATCH | `/notifications/:id/read` | * | Mark as read |
| POST | `/notifications/mark-all-read` | * | Mark all as read |
| DELETE | `/notifications/:id` | * | Dismiss notification |

---

## Activity Feed

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/activity` | * (scoped) | Activity feed (partners see own org; CM sees assigned orgs) |

**Query params:** `?entity_type=deal&entity_id=xxx&actor_id=xxx&action=approved&since=2026-01-01`

---

## Approvals (Unified)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/approvals/pending` | channel_manager, admin | All pending approvals for current user |
| GET | `/approvals/history` | channel_manager, admin | Past approval decisions |

---

## Dashboard / Analytics

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/dashboard/partner` | partner_admin, partner_rep | Partner dashboard KPIs |
| GET | `/dashboard/channel-manager` | channel_manager | CM dashboard (portfolio overview) |
| GET | `/dashboard/admin` | admin | Admin dashboard (program-wide metrics) |
| GET | `/analytics/pipeline` | admin, channel_manager | Deal pipeline by stage, value, partner |
| GET | `/analytics/partner-performance` | admin, channel_manager | Partner scorecards |
| GET | `/analytics/lead-conversion` | admin, channel_manager | Lead conversion rates by partner |
| GET | `/analytics/mdf-roi` | admin, channel_manager | MDF spend vs revenue generated |
