# Phase 1: Foundation — Product Requirements Document

**Version:** 1.0
**Last Updated:** 2026-03-18
**Document Owner:** Product Manager
**Status:** Approved
**Audience:** Architecture Agent, UI/UX Agent, QA Agent

---

## 1. Problem Statement

Phase 1 is the load-bearing foundation for the entire PRM Portal. Nothing else can be built until this phase delivers four things:

1. **A working backend scaffold** with Express.js, TypeScript, and a middleware stack that enforces authentication, authorization, org-scoped data isolation, rate limiting, and validation on every request.
2. **A complete database** with all 18 tables, enums, indexes, triggers, and helper functions. Later phases (deals, quotes, leads, MDF) insert rows into these tables. If the schema is wrong, every subsequent phase fails.
3. **Seed data** that represents a realistic partner ecosystem (4 tiers, 20 products, 4 partner orgs at different tiers, demo users, 5 courses). Without seed data, no endpoint can be manually tested and no demo can be given.
4. **Five CRUD modules** (Auth, Users, Organizations, Tiers, Products) that prove the full vertical slice works: request -> rate limiter -> JWT auth -> RBAC -> org scoping -> validation -> controller -> service -> repository -> database -> response envelope.

**Why it must be built first:** Phases 2-8 all depend on the middleware stack, the database schema, the seed data, and the auth/CRUD patterns established here. If Phase 1 ships with a broken org-scoping middleware, every subsequent module leaks data across organizations. If the JWT flow is wrong, no endpoint can be tested. Phase 1 is not valuable on its own — its value is that it makes everything after it possible and correct.

---

## 2. Non-Goals and Boundaries

These are explicitly out of scope for Phase 1. Do NOT build them:

- **Deal registration** (Phase 2) — no deal CRUD, no conflict detection, no approval workflows
- **CPQ / Quotes** (Phase 3) — no quote builder, no pricing waterfall, no PDF generation
- **Lead distribution** (Phase 4) — no lead CRUD, no assignment logic, no SLA enforcement
- **MDF / co-op funds** (Phase 5) — no allocation, no request lifecycle, no claim processing
- **Dashboards / analytics** (Phase 6) — no dashboard endpoints, no Recharts components
- **Training enrollment / completion** (Phase 7) — seed 5 courses but do NOT build enrollment or completion APIs
- **Content library / notifications / activity feed endpoints** (Phase 7) — the activity_feed table exists and the activityLogger middleware writes to it, but there is no `GET /activity` endpoint yet
- **Frontend React SPA** (Phase 8) — Phase 1 is backend-only; all testing is via API calls
- **Background jobs / cron** (Phase 9) — Bull queue setup and job processors come later. Redis is configured but only used for rate limiting and refresh token storage in Phase 1.
- **File uploads / S3 / MinIO** — no file storage integration
- **Email sending** — the forgot-password and reset-password flows generate tokens and store them in the DB, but do NOT actually send emails. Log the reset URL to console instead.
- **SSO / OAuth** — password-based auth only
- **Docker Compose** — local development uses direct PostgreSQL and Redis connections

---

## 3. User Stories

### 3.1 Auth Module

**US-AUTH-001: Partner Self-Registration** (P0)
As a prospective partner, I want to register my company and create an admin account so that I can begin the onboarding process.

Acceptance Criteria:
- Given valid registration data (company name, admin email, password, first name, last name), when I POST to `/api/v1/auth/register`, then the system creates an organization (status=`prospect`, tier=`Registered`) AND a user (role=`partner_admin`, linked to the new org) AND returns access + refresh tokens.
- Given an email that already exists in the users table, when I POST to `/api/v1/auth/register`, then the system returns 409 with error code `AUTH_EMAIL_EXISTS`.
- Given a password shorter than 8 characters, when I POST to `/api/v1/auth/register`, then the system returns 422 with validation errors.

**US-AUTH-002: Login** (P0)
As a registered user, I want to log in with email and password so that I receive JWT tokens for API access.

Acceptance Criteria:
- Given valid credentials, when I POST to `/api/v1/auth/login`, then the system returns `{ accessToken, refreshToken, expiresIn: 3600 }` and updates `last_login_at` on the user record.
- Given a valid email but wrong password, when I POST to `/api/v1/auth/login`, then the system returns 401 with error code `AUTH_INVALID_CREDENTIALS`. The error message must NOT reveal whether the email exists.
- Given a deactivated user (is_active=false), when I POST to `/api/v1/auth/login`, then the system returns 401 with error code `AUTH_ACCOUNT_DEACTIVATED`.

**US-AUTH-003: Token Refresh** (P0)
As an authenticated user, I want to refresh my access token before it expires so that I stay logged in.

Acceptance Criteria:
- Given a valid refresh token, when I POST to `/api/v1/auth/refresh`, then the system returns a new access token AND rotates the refresh token (old token is invalidated, new one is stored).
- Given an invalid or expired refresh token, when I POST to `/api/v1/auth/refresh`, then the system returns 401 with error code `AUTH_INVALID_REFRESH_TOKEN`.
- Given a refresh token that has already been used (replay attack), when I POST to `/api/v1/auth/refresh`, then the system returns 401 and invalidates ALL refresh tokens for that user (security measure).

**US-AUTH-004: Logout** (P0)
As an authenticated user, I want to log out so that my refresh token is invalidated.

Acceptance Criteria:
- Given a valid access token, when I POST to `/api/v1/auth/logout`, then the system clears the refresh token from the user record and returns 200.

**US-AUTH-005: Get Current User** (P0)
As an authenticated user, I want to retrieve my profile so that the frontend can display my name, role, and org.

Acceptance Criteria:
- Given a valid access token, when I GET `/api/v1/auth/me`, then the system returns the user object (id, email, first_name, last_name, role, organization_id, tier_id, notification_prefs, timezone) WITHOUT password_hash or refresh_token.
- Given an expired access token, when I GET `/api/v1/auth/me`, then the system returns 401 with error code `AUTH_TOKEN_EXPIRED`.

**US-AUTH-006: Update Current User Profile** (P1)
As an authenticated user, I want to update my name, phone, title, timezone, and notification preferences.

Acceptance Criteria:
- Given a valid access token and valid update data, when I PATCH `/api/v1/auth/me`, then the system updates only the allowed fields (first_name, last_name, title, phone, avatar_url, timezone, notification_prefs) and returns the updated user.
- The system must NOT allow updating email, role, organization_id, or is_active via this endpoint.

**US-AUTH-007: Forgot Password** (P1)
As a user who forgot my password, I want to request a password reset token.

Acceptance Criteria:
- Given any email address, when I POST to `/api/v1/auth/forgot-password`, then the system ALWAYS returns 200 with a generic message (do not reveal if email exists).
- If the email exists, the system generates a cryptographically random reset token, stores its hash in `password_reset_token`, sets `password_reset_expires` to NOW + 1 hour, and logs the reset URL to the console.

**US-AUTH-008: Reset Password** (P1)
As a user with a valid reset token, I want to set a new password.

Acceptance Criteria:
- Given a valid, non-expired reset token and a valid new password, when I POST to `/api/v1/auth/reset-password`, then the system hashes the new password, updates the user, clears the reset token fields, and invalidates any existing refresh token.
- Given an expired reset token, when I POST to `/api/v1/auth/reset-password`, then the system returns 400 with error code `AUTH_RESET_TOKEN_EXPIRED`.
- Given an invalid reset token, when I POST to `/api/v1/auth/reset-password`, then the system returns 400 with error code `AUTH_RESET_TOKEN_INVALID`.

---

### 3.2 Users Module

**US-USER-001: List Users** (P0)
As an admin or channel manager, I want to list users with filters so that I can find and manage partner personnel.

Acceptance Criteria:
- Given an admin token, when I GET `/api/v1/users`, then the system returns all users (paginated).
- Given a channel_manager token, when I GET `/api/v1/users`, then the system returns only users belonging to the channel manager's assigned organizations.
- Given a partner_admin token, when I GET `/api/v1/users`, then the system returns only users in their own organization.
- Given a partner_rep token, when I GET `/api/v1/users`, then the system returns only users in their own organization.
- Supports query params: `role`, `organization_id`, `is_active`, `search` (matches first_name, last_name, email), `page`, `per_page`.
- Response includes pagination meta: `{ page, per_page, total, total_pages }`.

**US-USER-002: Create User** (P0)
As an admin, I want to create users of any role. As a partner_admin, I want to create users within my own organization.

Acceptance Criteria:
- Given an admin token and valid user data (email, password, first_name, last_name, role, organization_id), when I POST to `/api/v1/users`, then the system creates the user and returns it.
- Given a partner_admin token and valid user data with role `partner_rep` or `partner_admin`, when I POST to `/api/v1/users`, then the system creates the user in the partner_admin's own organization (ignoring any organization_id in the request body).
- Given a partner_admin token attempting to create a user with role `admin` or `channel_manager`, when I POST to `/api/v1/users`, then the system returns 403 with error code `AUTH_INSUFFICIENT_ROLE`.
- Given a partner_rep or channel_manager token, when I POST to `/api/v1/users`, then the system returns 403.
- Given a duplicate email, when I POST to `/api/v1/users`, then the system returns 409 with error code `USER_EMAIL_EXISTS`.

**US-USER-003: Get User by ID** (P0)
As an authenticated user, I want to view a user's profile (scoped to my org).

Acceptance Criteria:
- Given any authenticated user, when I GET `/api/v1/users/:id`, then the system returns the user IF the requesting user has access (admin sees all; channel_manager sees assigned orgs; partner sees own org).
- Given a partner_admin requesting a user from a different org, when I GET `/api/v1/users/:id`, then the system returns 404 (not 403, to avoid leaking existence).

**US-USER-004: Update User** (P0)
As an admin, I want to update any user. As a partner_admin, I want to update users in my org.

Acceptance Criteria:
- Given an admin token, when I PATCH `/api/v1/users/:id`, then the system updates the user.
- Given a partner_admin token and a user in their org, when I PATCH `/api/v1/users/:id`, then the system updates allowed fields (first_name, last_name, title, phone, is_active, role — but only between partner_admin and partner_rep).
- Given a partner_admin token attempting to set role to `admin` or `channel_manager`, when I PATCH `/api/v1/users/:id`, then the system returns 403 with error code `USER_ROLE_ESCALATION`.

**US-USER-005: Delete (Soft-Delete) User** (P0)
As an admin, I want to deactivate a user so they can no longer log in.

Acceptance Criteria:
- Given an admin token, when I DELETE `/api/v1/users/:id`, then the system sets `is_active = false` and returns 200. The user record is NOT physically deleted.
- Given any non-admin token, when I DELETE `/api/v1/users/:id`, then the system returns 403.

**US-USER-006: Get User Certifications** (P2)
As an authenticated user, I want to see the certifications for a given user.

Acceptance Criteria:
- Given a valid user ID and appropriate scope, when I GET `/api/v1/users/:id/certifications`, then the system returns the user's certifications from `user_certifications` joined with `courses`.

**US-USER-007: Get User Activity** (P2)
As an authenticated user, I want to see the recent activity for a given user.

Acceptance Criteria:
- Given a valid user ID and appropriate scope, when I GET `/api/v1/users/:id/activity`, then the system returns activity_feed entries where actor_id = user ID, ordered by created_at DESC, paginated.

---

### 3.3 Organizations Module

**US-ORG-001: List Organizations** (P0)
As an admin or channel manager, I want to list partner organizations with filters.

Acceptance Criteria:
- Given an admin token, when I GET `/api/v1/organizations`, then the system returns all orgs (paginated) with their tier name included.
- Given a channel_manager token, when I GET `/api/v1/organizations`, then the system returns only orgs assigned to this channel manager (where `channel_manager_id = req.user.id`).
- Given a partner_admin or partner_rep token, when I GET `/api/v1/organizations`, then the system returns only their own org (array of 1).
- Supports query params: `status`, `tier_id`, `channel_manager_id`, `search` (matches name, domain), `page`, `per_page`.

**US-ORG-002: Create Organization** (P0)
As an admin or channel manager, I want to create a partner organization.

Acceptance Criteria:
- Given an admin or channel_manager token and valid org data (name, at minimum), when I POST to `/api/v1/organizations`, then the system creates the org with `status = 'prospect'` and returns it.
- The system must assign a default tier (Registered, rank 1) if no `tier_id` is provided.
- Given a partner_admin or partner_rep token, when I POST to `/api/v1/organizations`, then the system returns 403.

**US-ORG-003: Get Organization by ID** (P0)
As an authenticated user, I want to view an organization's details (scoped).

Acceptance Criteria:
- Given appropriate scope, when I GET `/api/v1/organizations/:id`, then the system returns the org with tier details included.
- Given a partner user requesting a different org, then the system returns 404.
- Given a channel_manager requesting an org NOT assigned to them, then the system returns 404.

**US-ORG-004: Update Organization** (P0)
As an admin, channel_manager (assigned), or partner_admin (own), I want to update organization details.

Acceptance Criteria:
- Given an admin token, when I PATCH `/api/v1/organizations/:id`, then the system updates all allowed fields.
- Given a partner_admin token for their own org, when I PATCH `/api/v1/organizations/:id`, then the system updates only non-sensitive fields (name, phone, website, address fields, industry, employee_count, logo_url, notes). Cannot update status, tier_id, channel_manager_id, or financial fields.
- Given a channel_manager token for an assigned org, when I PATCH `/api/v1/organizations/:id`, then the system updates the org including status transitions.

**US-ORG-005: Get Organization Sub-Resources** (P1)
As an authenticated user, I want to access an organization's users, deals, leads, quotes, and MDF data from nested endpoints.

Acceptance Criteria:
- `GET /api/v1/organizations/:id/users` returns paginated users for the org (scope-enforced).
- The following endpoints return empty arrays in Phase 1 since those modules don't exist yet: `/organizations/:id/deals`, `/organizations/:id/leads`, `/organizations/:id/quotes`, `/organizations/:id/mdf`.
- `GET /api/v1/organizations/:id/dashboard` returns an empty dashboard skeleton or 501 (Not Implemented) in Phase 1.

**US-ORG-006: Recalculate Tier** (P1)
As an admin or channel manager, I want to trigger a tier recalculation for a specific organization.

Acceptance Criteria:
- Given an admin or channel_manager token, when I POST to `/api/v1/organizations/:id/recalculate-tier`, then the system calls the `calculate_partner_tier` PostgreSQL function and updates `tier_id` if the result differs.
- Returns the org with old_tier and new_tier in the response.
- Given a partner token, when I POST to this endpoint, then the system returns 403.

---

### 3.4 Tiers Module

**US-TIER-001: List Tiers** (P0)
As any authenticated user, I want to see all partner tiers with their requirements and benefits.

Acceptance Criteria:
- Given any valid token, when I GET `/api/v1/tiers`, then the system returns all tiers ordered by rank ascending.
- Each tier includes: id, name, rank, color_hex, min_annual_revenue, min_deals_closed, min_certified_reps, min_csat_score, default_discount_pct, max_discount_pct, mdf_budget_pct, lead_priority, dedicated_channel_mgr, description.

**US-TIER-002: Create Tier** (P0)
As an admin, I want to create a new partner tier.

Acceptance Criteria:
- Given an admin token and valid tier data, when I POST to `/api/v1/tiers`, then the system creates the tier.
- Given a non-admin token, when I POST to `/api/v1/tiers`, then the system returns 403.
- Given a duplicate name or duplicate rank, when I POST to `/api/v1/tiers`, then the system returns 409 with error code `TIER_DUPLICATE`.

**US-TIER-003: Get Tier by ID** (P0)
As any authenticated user, I want to see a tier's details.

Acceptance Criteria:
- Given any valid token and a valid tier ID, when I GET `/api/v1/tiers/:id`, then the system returns the tier.
- Given a non-existent ID, then the system returns 404.

**US-TIER-004: Update Tier** (P0)
As an admin, I want to update a tier's requirements or benefits.

Acceptance Criteria:
- Given an admin token and valid update data, when I PATCH `/api/v1/tiers/:id`, then the system updates the tier.
- Given a non-admin token, then the system returns 403.

**US-TIER-005: Delete Tier** (P0)
As an admin, I want to delete a tier that is no longer needed.

Acceptance Criteria:
- Given an admin token and a tier with NO organizations assigned, when I DELETE `/api/v1/tiers/:id`, then the system deletes the tier and returns 200.
- Given a tier that HAS organizations assigned, when I DELETE `/api/v1/tiers/:id`, then the system returns 422 with error code `TIER_HAS_ORGS` and a message indicating how many orgs are assigned.

**US-TIER-006: List Organizations at Tier** (P1)
As an admin or channel manager, I want to see which organizations are at a specific tier.

Acceptance Criteria:
- Given an admin or channel_manager token, when I GET `/api/v1/tiers/:id/organizations`, then the system returns paginated orgs where `tier_id` matches (scoped for channel_manager).

---

### 3.5 Products Module

**US-PROD-001: List Products** (P0)
As any authenticated user, I want to browse the product catalog.

Acceptance Criteria:
- Given any valid token, when I GET `/api/v1/products`, then the system returns paginated products.
- Partners see only products where `is_active = true` AND `available_to_partners = true`.
- Admin and channel_manager see all products.
- Supports query params: `category_id`, `product_type`, `is_active`, `search` (matches name, sku), `page`, `per_page`, `sort`.

**US-PROD-002: Create Product** (P0)
As an admin, I want to add a product to the catalog.

Acceptance Criteria:
- Given an admin token and valid product data (sku, name, list_price at minimum), when I POST to `/api/v1/products`, then the system creates the product.
- Given a duplicate SKU, when I POST to `/api/v1/products`, then the system returns 409 with error code `PRODUCT_DUPLICATE_SKU`.
- Given a non-admin token, then the system returns 403.

**US-PROD-003: Get Product by ID** (P0)
As any authenticated user, I want to see product details including tier pricing.

Acceptance Criteria:
- Given any valid token and a valid product ID, when I GET `/api/v1/products/:id`, then the system returns the product.
- For admin/channel_manager, the response includes the full `tier_pricing` array (all tiers).
- For partners, the response includes only their tier's pricing.

**US-PROD-004: Update Product** (P0)
As an admin, I want to update product details or pricing.

Acceptance Criteria:
- Given an admin token, when I PATCH `/api/v1/products/:id`, then the system updates the product.
- Given a non-admin token, then the system returns 403.

**US-PROD-005: Soft-Delete Product** (P0)
As an admin, I want to deactivate a product.

Acceptance Criteria:
- Given an admin token, when I DELETE `/api/v1/products/:id`, then the system sets `is_active = false` (soft delete). The product record is preserved.
- Given a non-admin token, then the system returns 403.

**US-PROD-006: List Product Categories** (P0)
As any authenticated user, I want to browse product categories.

Acceptance Criteria:
- Given any valid token, when I GET `/api/v1/products/categories`, then the system returns the category tree (parent_id relationships resolved).

**US-PROD-007: Create Product Category** (P1)
As an admin, I want to create a product category.

Acceptance Criteria:
- Given an admin token, when I POST to `/api/v1/products/categories`, then the system creates the category.

**US-PROD-008: Update Product Category** (P1)
As an admin, I want to rename or reparent a category.

Acceptance Criteria:
- Given an admin token, when I PATCH `/api/v1/products/categories/:id`, then the system updates the category.

**US-PROD-009: Get Tier Pricing for Product** (P0)
As an admin or channel manager, I want to see all tier-specific pricing for a product.

Acceptance Criteria:
- Given an admin or channel_manager token, when I GET `/api/v1/products/:id/tier-pricing`, then the system returns all `tier_product_pricing` rows for this product, joined with tier name.

**US-PROD-010: Set Tier Pricing for Product** (P0)
As an admin, I want to set or update the discount/special price for a product at a specific tier.

Acceptance Criteria:
- Given an admin token and valid pricing data (discount_pct and/or special_price), when I PUT `/api/v1/products/:id/tier-pricing/:tierId`, then the system upserts the `tier_product_pricing` row.
- Given a non-existent tier ID, then the system returns 404 with error code `TIER_NOT_FOUND`.
- Given a non-existent product ID, then the system returns 404 with error code `PRODUCT_NOT_FOUND`.

---

## 4. Edge Cases and Error Scenarios

### 4.1 Auth Edge Cases

| # | Scenario | Expected Behavior |
|---|----------|-------------------|
| AUTH-E01 | Register with email that already exists | 409, `AUTH_EMAIL_EXISTS` |
| AUTH-E02 | Register with password < 8 characters | 422, validation error with field `password` |
| AUTH-E03 | Register with missing required fields | 422, validation error listing all missing fields |
| AUTH-E04 | Login with correct email, wrong password | 401, `AUTH_INVALID_CREDENTIALS` — same message as wrong email |
| AUTH-E05 | Login with non-existent email | 401, `AUTH_INVALID_CREDENTIALS` — same message as wrong password |
| AUTH-E06 | Login with deactivated account | 401, `AUTH_ACCOUNT_DEACTIVATED` |
| AUTH-E07 | Refresh with expired refresh token (>30 days old) | 401, `AUTH_INVALID_REFRESH_TOKEN` |
| AUTH-E08 | Refresh with already-used token (replay attack) | 401, clear ALL user's refresh tokens |
| AUTH-E09 | Refresh with token belonging to different user | 401, `AUTH_INVALID_REFRESH_TOKEN` |
| AUTH-E10 | Access protected endpoint without Authorization header | 401, `AUTH_TOKEN_MISSING` |
| AUTH-E11 | Access protected endpoint with malformed JWT | 401, `AUTH_TOKEN_INVALID` |
| AUTH-E12 | Access protected endpoint with expired access token | 401, `AUTH_TOKEN_EXPIRED` |
| AUTH-E13 | Forgot-password with non-existent email | 200 (always) — never reveal email existence |
| AUTH-E14 | Reset-password with expired token (>1 hour) | 400, `AUTH_RESET_TOKEN_EXPIRED` |
| AUTH-E15 | Reset-password with invalid/tampered token | 400, `AUTH_RESET_TOKEN_INVALID` |
| AUTH-E16 | Reset-password with already-used token | 400, `AUTH_RESET_TOKEN_INVALID` (token was cleared on first use) |
| AUTH-E17 | Brute force: >5 login attempts in 1 minute from same IP | 429, `RATE_LIMIT_EXCEEDED` |
| AUTH-E18 | Concurrent login sessions | Allowed. Each device gets its own refresh token. Only the last refresh token is stored (previous sessions lose refresh ability). |
| AUTH-E19 | Register with organization name that contains only whitespace | 422, validation error |
| AUTH-E20 | JWT signed with wrong secret (tampered) | 401, `AUTH_TOKEN_INVALID` |

### 4.2 Users Edge Cases

| # | Scenario | Expected Behavior |
|---|----------|-------------------|
| USER-E01 | partner_admin creates user in a different org (by providing org_id in body) | System ignores the provided org_id and creates user in the partner_admin's own org |
| USER-E02 | partner_admin creates user with role `admin` | 403, `AUTH_INSUFFICIENT_ROLE` |
| USER-E03 | partner_admin creates user with role `channel_manager` | 403, `AUTH_INSUFFICIENT_ROLE` |
| USER-E04 | partner_admin deactivates the LAST active partner_admin in their org | 422, `USER_LAST_ADMIN` — cannot deactivate the last admin of an org |
| USER-E05 | partner_rep attempts to create a user | 403 |
| USER-E06 | partner_rep attempts to update another user | 403 |
| USER-E07 | partner_admin attempts role escalation: PATCH role to `admin` | 403, `USER_ROLE_ESCALATION` |
| USER-E08 | partner_admin attempts to change user's org_id | System ignores org_id in the update payload for non-admin roles |
| USER-E09 | channel_manager lists users — should only see assigned orgs | Returns only users in orgs where `channel_manager_id = req.user.id` |
| USER-E10 | Admin tries to delete themselves | 422, `USER_CANNOT_DELETE_SELF` |
| USER-E11 | Create user with email in mixed case (User@Example.COM) | Email is normalized to lowercase before storage and uniqueness check |
| USER-E12 | GET /users/:id with a UUID that doesn't exist | 404 |
| USER-E13 | GET /users/:id with an invalid UUID format | 422, validation error |

### 4.3 Organizations Edge Cases

| # | Scenario | Expected Behavior |
|---|----------|-------------------|
| ORG-E01 | channel_manager accesses org NOT assigned to them | 404 (not 403, to avoid information leakage) |
| ORG-E02 | partner_admin accesses a different org | 404 |
| ORG-E03 | partner_rep accesses a different org | 404 |
| ORG-E04 | partner_admin tries to change their org's status | System ignores `status` field in update payload for partner_admin |
| ORG-E05 | partner_admin tries to change their org's tier_id | System ignores `tier_id` field in update payload for partner_admin |
| ORG-E06 | Admin sets org status to `suspended` | Allowed. All users in the org should still exist but fail login (or their tokens fail scopeToOrg). Implementation note: check org status in authenticate middleware or add org_status to JWT claims. |
| ORG-E07 | Invalid status transition: `churned` -> `active` | 422, `ORG_INVALID_STATUS_TRANSITION`. Valid transitions: prospect->pending_approval->active->suspended->churned. Also allow: suspended->active (reinstatement), prospect->active (fast-track). |
| ORG-E08 | Recalculate-tier on an org with no deals or certs | Org qualifies for Registered tier (rank 1) since all minimums are 0. |
| ORG-E09 | Create org with duplicate domain | Allowed (multiple orgs can share a domain — e.g., subsidiaries) |
| ORG-E10 | Assign channel_manager_id that refers to a non-channel_manager user | 422, `ORG_INVALID_CHANNEL_MANAGER` — the referenced user must have role=channel_manager |

### 4.4 Tiers Edge Cases

| # | Scenario | Expected Behavior |
|---|----------|-------------------|
| TIER-E01 | Delete tier with assigned organizations | 422, `TIER_HAS_ORGS`, message includes org count |
| TIER-E02 | Create tier with negative min_annual_revenue | 422, validation error — all requirement fields must be >= 0 |
| TIER-E03 | Create tier with min_csat_score > 5.00 | 422, validation error — max is 5.00 |
| TIER-E04 | Create tier with duplicate rank | 409, `TIER_DUPLICATE` |
| TIER-E05 | Create tier with duplicate name | 409, `TIER_DUPLICATE` |
| TIER-E06 | Update tier rank to a value already used by another tier | 409, `TIER_DUPLICATE` |
| TIER-E07 | Delete the Registered tier (rank 1) when orgs default to it | 422, `TIER_HAS_ORGS` (if any orgs have it) |
| TIER-E08 | Non-admin tries to create/update/delete tier | 403 |
| TIER-E09 | max_discount_pct < default_discount_pct | 422, validation error — max must be >= default |
| TIER-E10 | Create tier with discount_pct > 100 | 422, validation error |

### 4.5 Products Edge Cases

| # | Scenario | Expected Behavior |
|---|----------|-------------------|
| PROD-E01 | Create product with duplicate SKU | 409, `PRODUCT_DUPLICATE_SKU` |
| PROD-E02 | Soft-delete product (is_active=false) | Product hidden from partner product listing but still returned for admin |
| PROD-E03 | Set tier pricing for non-existent tier | 404, `TIER_NOT_FOUND` |
| PROD-E04 | Set tier pricing for non-existent product | 404, `PRODUCT_NOT_FOUND` |
| PROD-E05 | Create product with list_price <= 0 | 422, validation error |
| PROD-E06 | Create product with missing SKU | 422, validation error |
| PROD-E07 | Partner queries products — should not see is_active=false or available_to_partners=false | Only active + partner-available products are returned |
| PROD-E08 | Set tier pricing with discount_pct > 100 | 422, validation error |
| PROD-E09 | Set tier pricing with negative special_price | 422, validation error |
| PROD-E10 | Create category with parent_id pointing to non-existent category | 422, validation error or 404 |
| PROD-E11 | Create category creating a circular parent reference | 422, `CATEGORY_CIRCULAR_REFERENCE` |

### 4.6 Cross-Cutting: Data Scoping

| # | Scenario | Expected Behavior |
|---|----------|-------------------|
| SCOPE-E01 | partner_admin hits GET /users and tries to add `organization_id=<other-org>` as query param | System ignores the query param and returns only their org's users |
| SCOPE-E02 | partner_rep hits GET /organizations/:id with another org's UUID | 404 |
| SCOPE-E03 | channel_manager hits GET /organizations and tries to filter by org not assigned to them | Returns empty results (the filter intersects with their assigned org scope) |
| SCOPE-E04 | Any request with a valid JWT but the user's org has status=`suspended` | 403, `ORG_SUSPENDED` — all API calls except GET /auth/me should be blocked for suspended org users |
| SCOPE-E05 | Admin adds `organization_id` filter — should work as expected | Admin has no scope restriction, filter is applied directly |

---

## 5. API Contract — Key Request/Response Examples

### 5.1 Response Envelope

All responses follow this structure:

```json
// Success
{
  "success": true,
  "data": { ... },
  "meta": { "page": 1, "per_page": 25, "total": 142, "total_pages": 6 },
  "errors": null
}

// Error
{
  "success": false,
  "data": null,
  "meta": null,
  "errors": [
    {
      "code": "AUTH_INVALID_CREDENTIALS",
      "message": "Invalid email or password",
      "field": null
    }
  ]
}

// Validation Error
{
  "success": false,
  "data": null,
  "meta": null,
  "errors": [
    { "code": "VALIDATION_ERROR", "message": "\"email\" is required", "field": "email" },
    { "code": "VALIDATION_ERROR", "message": "\"password\" must be at least 8 characters", "field": "password" }
  ]
}
```

### 5.2 Auth: Register

```
POST /api/v1/auth/register
Content-Type: application/json

{
  "company_name": "AcmeSec Partners",
  "email": "admin@acmesec.com",
  "password": "Str0ngP@ss!",
  "first_name": "Jane",
  "last_name": "Smith"
}

// 201 Created
{
  "success": true,
  "data": {
    "user": {
      "id": "a1b2c3d4-...",
      "email": "admin@acmesec.com",
      "first_name": "Jane",
      "last_name": "Smith",
      "role": "partner_admin",
      "organization_id": "e5f6g7h8-...",
      "is_active": true,
      "email_verified": false
    },
    "organization": {
      "id": "e5f6g7h8-...",
      "name": "AcmeSec Partners",
      "status": "prospect",
      "tier_id": "registered-tier-uuid"
    },
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "eyJhbGciOi...",
    "expiresIn": 3600
  }
}
```

### 5.3 Auth: Login

```
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "admin@acmesec.com",
  "password": "Str0ngP@ss!"
}

// 200 OK
{
  "success": true,
  "data": {
    "user": {
      "id": "a1b2c3d4-...",
      "email": "admin@acmesec.com",
      "first_name": "Jane",
      "last_name": "Smith",
      "role": "partner_admin",
      "organization_id": "e5f6g7h8-...",
      "organization": {
        "id": "e5f6g7h8-...",
        "name": "AcmeSec Partners",
        "tier_id": "registered-tier-uuid",
        "status": "active"
      }
    },
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "eyJhbGciOi...",
    "expiresIn": 3600
  }
}
```

### 5.4 Users: Create

```
POST /api/v1/users
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "email": "rep@acmesec.com",
  "password": "Rep$ecure1",
  "first_name": "Bob",
  "last_name": "Jones",
  "role": "partner_rep",
  "organization_id": "e5f6g7h8-...",
  "title": "Sales Engineer"
}

// 201 Created
{
  "success": true,
  "data": {
    "id": "x9y0z1a2-...",
    "email": "rep@acmesec.com",
    "first_name": "Bob",
    "last_name": "Jones",
    "role": "partner_rep",
    "organization_id": "e5f6g7h8-...",
    "title": "Sales Engineer",
    "is_active": true,
    "created_at": "2026-03-18T12:00:00Z"
  }
}
```

### 5.5 Organizations: List (Channel Manager)

```
GET /api/v1/organizations?status=active&page=1&per_page=10
Authorization: Bearer <channel-manager-token>

// 200 OK
{
  "success": true,
  "data": [
    {
      "id": "e5f6g7h8-...",
      "name": "CyberShield Solutions",
      "status": "active",
      "tier": {
        "id": "diamond-tier-uuid",
        "name": "Diamond Innovator",
        "rank": 4,
        "color_hex": "#1E3A5F"
      },
      "ytd_revenue": 2450000.00,
      "ytd_deals_closed": 18,
      "certified_rep_count": 12,
      "channel_manager_id": "cm-user-uuid"
    }
  ],
  "meta": { "page": 1, "per_page": 10, "total": 2, "total_pages": 1 }
}
```

### 5.6 Products: Create with Tier Pricing

```
POST /api/v1/products
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "sku": "PA-5400-BASE",
  "name": "PA-5400 Series Firewall - Base Unit",
  "description": "Next-generation firewall for large enterprise and data center environments",
  "category_id": "network-security-cat-uuid",
  "list_price": 125000.00,
  "cost": 45000.00,
  "product_type": "hardware",
  "billing_cycle": "one_time",
  "is_active": true,
  "available_to_partners": true
}

// 201 Created
{
  "success": true,
  "data": {
    "id": "prod-uuid-...",
    "sku": "PA-5400-BASE",
    "name": "PA-5400 Series Firewall - Base Unit",
    "list_price": 125000.00,
    "category": {
      "id": "network-security-cat-uuid",
      "name": "Network Security"
    },
    "is_active": true,
    "created_at": "2026-03-18T12:00:00Z"
  }
}
```

### 5.7 Tiers: Delete (Blocked)

```
DELETE /api/v1/tiers/diamond-tier-uuid
Authorization: Bearer <admin-token>

// 422 Unprocessable Entity
{
  "success": false,
  "data": null,
  "errors": [
    {
      "code": "TIER_HAS_ORGS",
      "message": "Cannot delete tier 'Diamond Innovator': 1 organization(s) are assigned to this tier",
      "field": null
    }
  ]
}
```

### 5.8 Error: Rate Limited

```
POST /api/v1/auth/login
(6th attempt in 1 minute from same IP)

// 429 Too Many Requests
{
  "success": false,
  "data": null,
  "errors": [
    {
      "code": "RATE_LIMIT_EXCEEDED",
      "message": "Too many requests. Please try again in 45 seconds.",
      "field": null
    }
  ]
}
```

---

## 6. Data Model — Phase 1 Tables

Phase 1 creates ALL 18 tables via Knex migrations, even though only a subset are actively written to in Phase 1. This prevents migration conflicts in later phases.

### Tables Actively Used in Phase 1

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `partner_tiers` | Define partner program levels | name, rank, requirements (min_*), benefits (discount, MDF, lead_priority) |
| `organizations` | Partner company accounts | name, tier_id, status, channel_manager_id, denormalized metrics |
| `users` | All system users (internal + partner) | email, password_hash, role, organization_id, refresh_token, password_reset_* |
| `products` | Product catalog (PANW-style) | sku (unique), name, list_price, category_id, is_active, available_to_partners |
| `product_categories` | Category tree | name, parent_id, sort_order |
| `tier_product_pricing` | Per-tier product discounts | tier_id + product_id (unique), discount_pct, special_price |
| `activity_feed` | Audit log (written by activityLogger middleware) | actor_id, org_id, action, entity_type, entity_id, summary, changes |

### Tables Created But Not Actively Used Until Later Phases

| Table | Phase |
|-------|-------|
| `deals` | Phase 2 |
| `deal_status_history` | Phase 2 |
| `deal_products` | Phase 2 |
| `quotes` | Phase 3 |
| `quote_line_items` | Phase 3 |
| `leads` | Phase 4 |
| `mdf_allocations` | Phase 5 |
| `mdf_requests` | Phase 5 |
| `courses` | Phase 7 (seeded in Phase 1) |
| `user_certifications` | Phase 7 |
| `document_folders` | Phase 7 |
| `documents` | Phase 7 |
| `notifications` | Phase 7 |
| `approval_requests` | Phase 2 |

### Seed Data Requirements

| Entity | Count | Details |
|--------|-------|---------|
| Partner Tiers | 4 | Registered (rank 1, 0% discount), Innovator (rank 2, 5%), Platinum Innovator (rank 3, 10%), Diamond Innovator (rank 4, 15%) |
| Product Categories | 5 | Network Security, SASE, Cloud Security, Security Operations, Professional Services |
| Products | ~20 | PANW portfolio: PA-400/1400/3400/5400 Series, VM-Series, CN-Series, Cloud NGFW, Prisma Access, Prisma SD-WAN, Prisma Cloud, Cortex XDR, Cortex XSOAR, Cortex XSIAM, Unit 42 Services |
| Tier Product Pricing | ~80 | 20 products x 4 tiers = 80 rows with varying discounts |
| Admin User | 1 | role=admin, no organization |
| Channel Managers | 2 | role=channel_manager, no organization |
| Partner Organizations | 4 | CyberShield Solutions (Diamond), CloudGuard Inc (Platinum), NetSecure Partners (Innovator), TechDefend LLC (Registered) |
| Partner Users | 8 | 1 partner_admin + 1 partner_rep per org |
| Courses | 5 | PCNSA, PCNSE, PCSAE, PCCSE, PCDRA (seeded but enrollment API not built in Phase 1) |

---

## 7. Non-Functional Requirements

### NFR-PERF-001: API Response Time (P0)
All CRUD endpoints must respond in < 200ms at p95 under normal load (single user, seeded database with ~100 rows per table). List endpoints with pagination must respond in < 300ms at p95.

### NFR-PERF-002: Database Connection Pool (P0)
PostgreSQL connection pool: min 2, max 10 connections. All queries must use parameterized statements (no string interpolation of user input).

### NFR-SEC-001: Password Hashing (P0)
Passwords hashed with bcrypt, cost factor 12. Never store or return plaintext passwords. Never include password_hash in any API response.

### NFR-SEC-002: JWT Configuration (P0)
- Access token: HS256, 1 hour TTL, payload includes `{ sub, email, role, org_id, tier_id }`
- Refresh token: HS256, 30 day TTL, stored hashed in DB
- JWT_SECRET and JWT_REFRESH_SECRET must be separate values, minimum 32 characters each
- Tokens must be validated for expiry, signature, and required claims

### NFR-SEC-003: Rate Limiting (P0)
- General API: 100 requests per minute per IP
- Auth endpoints (`/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password`): 5 requests per minute per IP
- Rate limiter backed by Redis
- 429 response must include `Retry-After` header

### NFR-SEC-004: Input Validation (P0)
- All request bodies validated via Joi or Zod schemas BEFORE reaching the controller
- UUIDs validated as proper v4 format in route params
- Strings trimmed and length-checked
- Enum values validated against allowed lists
- SQL injection prevented by Knex parameterized queries (never use `knex.raw()` with unescaped user input)

### NFR-SEC-005: Security Headers (P0)
Helmet middleware enabled with defaults: X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security, X-XSS-Protection.

### NFR-SEC-006: CORS (P0)
CORS configured to allow only the frontend origin (configurable via `CORS_ORIGIN` env var). Credentials allowed for httpOnly cookie refresh token flow.

### NFR-REL-001: Error Handling (P0)
- All errors caught by global `errorHandler` middleware
- Known errors (AppError) return structured response with error code
- Unknown errors return 500 with generic message; full error logged server-side, never sent to client
- Database constraint violations (unique, FK) caught and translated to appropriate HTTP codes

### NFR-REL-002: Graceful Shutdown (P1)
Server handles SIGTERM/SIGINT: stops accepting new connections, drains existing connections (5s timeout), closes database pool, closes Redis connection, then exits.

### NFR-MAINT-001: Logging (P0)
- Morgan request logging (dev format in development, combined format in production)
- Console-based structured logging for errors and key events (auth failures, rate limit hits)
- Activity logger middleware writes to `activity_feed` table for all POST, PATCH, DELETE operations

### NFR-MAINT-002: Environment Configuration (P0)
All configuration via environment variables with sensible defaults. `.env.example` documents all required variables. Application fails fast on startup if critical vars (DB_HOST, JWT_SECRET) are missing.

---

## 8. Dependencies and Assumptions

### External Dependencies

| Dependency | Version | Purpose | Impact if Unavailable |
|-----------|---------|---------|----------------------|
| PostgreSQL | 14+ | Primary data store | Application cannot start |
| Redis | 6+ | Rate limiting, refresh token validation | Rate limiting disabled; refresh tokens fall back to DB-only validation |
| Node.js | 20+ | Runtime | Application cannot run |

### NPM Dependencies (Key)

| Package | Purpose |
|---------|---------|
| express | HTTP framework |
| pg + knex | PostgreSQL driver + query builder |
| bcryptjs | Password hashing |
| jsonwebtoken | JWT creation/verification |
| joi or zod | Request validation |
| ioredis | Redis client |
| cors | CORS middleware |
| helmet | Security headers |
| morgan | Request logging |
| dotenv | Environment variable loading |
| uuid | UUID generation (fallback if DB extension unavailable) |

### Assumptions

1. PostgreSQL is running locally or via a connection string. The `uuid-ossp`, `pgcrypto`, and `pg_trgm` extensions are available (standard with PostgreSQL 14+).
2. Redis is running locally on default port 6379 or via `REDIS_URL`.
3. No external email service is needed for Phase 1. Password reset tokens are logged to console.
4. No file storage is needed for Phase 1.
5. All testing is via API clients (curl, Postman, or automated tests). No frontend exists yet.

### What Must Work Before Phase 2 Can Start

Phase 2 (Deal Registration) has hard dependencies on the following Phase 1 deliverables:

- [ ] JWT authentication middleware is working and tested
- [ ] RBAC authorization middleware correctly enforces role restrictions
- [ ] `scopeToOrg` middleware correctly filters queries by organization for all partner roles
- [ ] All 18 database tables exist with correct schema, enums, triggers, and functions
- [ ] Seed data is loaded: 4 tiers, 20 products, 4 orgs, demo users
- [ ] `AppError` class and global error handler produce correct envelope responses
- [ ] Pagination utility works with Knex queries
- [ ] Filter utility translates query params to Knex WHERE clauses
- [ ] Validation middleware catches invalid input before controllers
- [ ] Activity logger middleware writes audit records for write operations
- [ ] Rate limiter is functional on auth endpoints
- [ ] Users CRUD works (needed for deal `submitted_by` and `assigned_to` references)
- [ ] Organizations CRUD works (needed for deal `organization_id` references)
- [ ] Products CRUD works (needed for `deal_products` and `primary_product_id` references)
- [ ] Tiers are seeded and queryable (needed for discount calculations in Phase 3)

---

## 9. QA Handoff Checklist

The QA agent must verify each scenario below. Mark PASS or FAIL for each.

### 9.1 Auth Tests

| # | Test Scenario | Method | Endpoint | Expected |
|---|--------------|--------|----------|----------|
| QA-AUTH-01 | Register new partner | POST | /auth/register | 201, returns user + org + tokens |
| QA-AUTH-02 | Register with duplicate email | POST | /auth/register | 409, AUTH_EMAIL_EXISTS |
| QA-AUTH-03 | Register with short password (<8 chars) | POST | /auth/register | 422, validation error |
| QA-AUTH-04 | Register with missing company_name | POST | /auth/register | 422, validation error |
| QA-AUTH-05 | Login with valid credentials | POST | /auth/login | 200, returns tokens |
| QA-AUTH-06 | Login with wrong password | POST | /auth/login | 401, AUTH_INVALID_CREDENTIALS |
| QA-AUTH-07 | Login with non-existent email | POST | /auth/login | 401, AUTH_INVALID_CREDENTIALS |
| QA-AUTH-08 | Login with deactivated user | POST | /auth/login | 401, AUTH_ACCOUNT_DEACTIVATED |
| QA-AUTH-09 | Refresh with valid token | POST | /auth/refresh | 200, new access + refresh tokens |
| QA-AUTH-10 | Refresh with expired token | POST | /auth/refresh | 401 |
| QA-AUTH-11 | Refresh with already-used token | POST | /auth/refresh | 401, user's refresh token cleared |
| QA-AUTH-12 | Logout | POST | /auth/logout | 200, refresh token cleared |
| QA-AUTH-13 | Get current user | GET | /auth/me | 200, user object without password_hash |
| QA-AUTH-14 | Get current user with expired token | GET | /auth/me | 401, AUTH_TOKEN_EXPIRED |
| QA-AUTH-15 | Update profile (name, phone) | PATCH | /auth/me | 200, updated user |
| QA-AUTH-16 | Update profile attempt to change role | PATCH | /auth/me | Role field ignored, 200 |
| QA-AUTH-17 | Forgot password with valid email | POST | /auth/forgot-password | 200 (token logged to console) |
| QA-AUTH-18 | Forgot password with non-existent email | POST | /auth/forgot-password | 200 (same response) |
| QA-AUTH-19 | Reset password with valid token | POST | /auth/reset-password | 200, password changed |
| QA-AUTH-20 | Reset password with expired token | POST | /auth/reset-password | 400, AUTH_RESET_TOKEN_EXPIRED |
| QA-AUTH-21 | Rate limit: 6th login in 1 minute | POST | /auth/login | 429, RATE_LIMIT_EXCEEDED |
| QA-AUTH-22 | Access endpoint without token | GET | /users | 401, AUTH_TOKEN_MISSING |
| QA-AUTH-23 | Access endpoint with malformed token | GET | /users | 401, AUTH_TOKEN_INVALID |

### 9.2 RBAC & Scoping Tests

| # | Test Scenario | Actor | Expected |
|---|--------------|-------|----------|
| QA-RBAC-01 | Admin lists all users | admin | 200, returns all users |
| QA-RBAC-02 | Channel manager lists users | channel_manager | 200, only users in assigned orgs |
| QA-RBAC-03 | Partner admin lists users | partner_admin | 200, only users in own org |
| QA-RBAC-04 | Partner rep lists users | partner_rep | 200, only users in own org |
| QA-RBAC-05 | Partner admin creates user in own org | partner_admin | 201 |
| QA-RBAC-06 | Partner admin creates admin user | partner_admin | 403 |
| QA-RBAC-07 | Partner rep creates user | partner_rep | 403 |
| QA-RBAC-08 | Partner admin GET user from other org | partner_admin | 404 |
| QA-RBAC-09 | Channel manager GET org not assigned | channel_manager | 404 |
| QA-RBAC-10 | Partner admin GET other org | partner_admin | 404 |
| QA-RBAC-11 | Non-admin creates tier | partner_admin | 403 |
| QA-RBAC-12 | Non-admin creates product | channel_manager | 403 |
| QA-RBAC-13 | Non-admin deletes user | partner_admin | 403 |
| QA-RBAC-14 | Partner admin updates own org (allowed fields) | partner_admin | 200 |
| QA-RBAC-15 | Partner admin updates own org status | partner_admin | Status field ignored, 200 |
| QA-RBAC-16 | Admin creates user in any org | admin | 201 |
| QA-RBAC-17 | Suspended org user accesses API | partner_admin (suspended org) | 403, ORG_SUSPENDED |

### 9.3 Users CRUD Tests

| # | Test Scenario | Expected |
|---|--------------|----------|
| QA-USER-01 | Create user with all valid fields | 201, user created |
| QA-USER-02 | Create user with duplicate email | 409, USER_EMAIL_EXISTS |
| QA-USER-03 | Create user with invalid email format | 422, validation error |
| QA-USER-04 | Create user missing required fields | 422, validation error listing all missing |
| QA-USER-05 | Get user by valid ID | 200, user object |
| QA-USER-06 | Get user by non-existent ID | 404 |
| QA-USER-07 | Update user name | 200, name updated |
| QA-USER-08 | partner_admin role escalation attempt (set role=admin) | 403, USER_ROLE_ESCALATION |
| QA-USER-09 | Deactivate (soft-delete) user | 200, is_active=false |
| QA-USER-10 | Deactivate last admin in org | 422, USER_LAST_ADMIN |
| QA-USER-11 | List users with role filter | 200, only matching roles |
| QA-USER-12 | List users with pagination | 200, correct page/total |
| QA-USER-13 | List users with search query | 200, matches on name/email |
| QA-USER-14 | Email case normalization: "User@EXAMPLE.com" | Stored as "user@example.com" |

### 9.4 Organizations CRUD Tests

| # | Test Scenario | Expected |
|---|--------------|----------|
| QA-ORG-01 | Admin creates organization | 201, defaults to prospect status + Registered tier |
| QA-ORG-02 | Admin lists all organizations | 200, all orgs with tier info |
| QA-ORG-03 | Channel manager lists assigned orgs | 200, only assigned orgs |
| QA-ORG-04 | Partner admin lists orgs (sees only own) | 200, array of 1 |
| QA-ORG-05 | Get org by ID with tier details | 200, includes tier object |
| QA-ORG-06 | Update org basic fields | 200, updated |
| QA-ORG-07 | Assign invalid channel manager (non-CM role) | 422, ORG_INVALID_CHANNEL_MANAGER |
| QA-ORG-08 | Get org users sub-resource | 200, users in that org |
| QA-ORG-09 | Recalculate tier (admin) | 200, returns old/new tier |
| QA-ORG-10 | Recalculate tier (partner) | 403 |
| QA-ORG-11 | Filter orgs by status | 200, only matching status |
| QA-ORG-12 | Filter orgs by tier_id | 200, only matching tier |
| QA-ORG-13 | Search orgs by name | 200, matching orgs |

### 9.5 Tiers CRUD Tests

| # | Test Scenario | Expected |
|---|--------------|----------|
| QA-TIER-01 | List all tiers (any role) | 200, 4 seeded tiers ordered by rank |
| QA-TIER-02 | Admin creates tier | 201 |
| QA-TIER-03 | Create tier with duplicate name | 409, TIER_DUPLICATE |
| QA-TIER-04 | Create tier with duplicate rank | 409, TIER_DUPLICATE |
| QA-TIER-05 | Create tier with negative requirements | 422, validation error |
| QA-TIER-06 | Get tier by ID | 200 |
| QA-TIER-07 | Update tier | 200, updated |
| QA-TIER-08 | Delete tier with no orgs | 200, deleted |
| QA-TIER-09 | Delete tier with assigned orgs | 422, TIER_HAS_ORGS |
| QA-TIER-10 | Non-admin creates tier | 403 |
| QA-TIER-11 | Get orgs at tier | 200, paginated org list |

### 9.6 Products CRUD Tests

| # | Test Scenario | Expected |
|---|--------------|----------|
| QA-PROD-01 | Admin creates product | 201 |
| QA-PROD-02 | Create product with duplicate SKU | 409, PRODUCT_DUPLICATE_SKU |
| QA-PROD-03 | Create product with list_price <= 0 | 422, validation error |
| QA-PROD-04 | List products as admin (sees all) | 200, includes inactive |
| QA-PROD-05 | List products as partner (sees only active + available) | 200, filtered |
| QA-PROD-06 | Get product by ID with tier pricing | 200, includes tier_pricing |
| QA-PROD-07 | Soft-delete product | 200, is_active=false |
| QA-PROD-08 | List categories | 200, tree structure |
| QA-PROD-09 | Create category | 201 |
| QA-PROD-10 | Set tier pricing for product | 200/201, pricing saved |
| QA-PROD-11 | Set tier pricing for non-existent tier | 404, TIER_NOT_FOUND |
| QA-PROD-12 | Set tier pricing for non-existent product | 404, PRODUCT_NOT_FOUND |
| QA-PROD-13 | Non-admin creates product | 403 |
| QA-PROD-14 | Filter products by category | 200, filtered results |
| QA-PROD-15 | Search products by name/SKU | 200, matching products |

### 9.7 Infrastructure Tests

| # | Test Scenario | Expected |
|---|--------------|----------|
| QA-INFRA-01 | Rate limiter: 101st request in 1 minute | 429 with Retry-After header |
| QA-INFRA-02 | Request with invalid JSON body | 400, parse error |
| QA-INFRA-03 | Request to non-existent route | 404 |
| QA-INFRA-04 | Activity logger: POST creates activity_feed entry | Verify row in activity_feed table |
| QA-INFRA-05 | Activity logger: PATCH creates activity_feed entry with changes JSONB | Verify old/new values captured |
| QA-INFRA-06 | Helmet headers present in response | Verify X-Content-Type-Options, etc. |
| QA-INFRA-07 | CORS: request from allowed origin | 200 with Access-Control headers |
| QA-INFRA-08 | CORS: request from disallowed origin | No Access-Control headers |
| QA-INFRA-09 | Database seed data: 4 tiers exist | Verify via GET /tiers |
| QA-INFRA-10 | Database seed data: 20 products exist | Verify via GET /products |
| QA-INFRA-11 | Database seed data: 4 orgs with correct tiers | Verify via GET /organizations (as admin) |
| QA-INFRA-12 | Database seed data: 11 users (1 admin + 2 CM + 8 partner) | Verify via GET /users (as admin) |
| QA-INFRA-13 | Database seed data: 5 courses exist | Verify via direct DB query |
| QA-INFRA-14 | Pagination: page=1, per_page=5 | Returns 5 items with correct meta |
| QA-INFRA-15 | Pagination: page beyond total | Returns empty array with correct meta |
| QA-INFRA-16 | Unhandled error returns 500 with generic message | No stack trace in response |

---

## 10. Implementation Phases (Sub-phases within Phase 1)

Phase 1 itself should be built in this dependency order:

### Sub-phase 1A: Scaffold (1-2 hours)
- Project init, TypeScript config, folder structure
- Express app with cors, helmet, morgan, JSON parsing
- `.env.example` and config modules (database, redis, auth, constants)
- AppError class and global error handler
- **Deliverable:** Server starts and returns 404 for unknown routes

### Sub-phase 1B: Database (1-2 hours)
- Knex migrations for all 18 tables, enums, indexes, triggers, functions
- Knexfile.ts with dev/test/prod configs
- **Deliverable:** `npx knex migrate:latest` runs without errors

### Sub-phase 1C: Seed Data (30-60 min)
- Seed files for tiers, categories, products, tier pricing, orgs, users, courses
- **Deliverable:** `npx knex seed:run` populates the database

### Sub-phase 1D: Middleware (1-2 hours)
- authenticate, authorize, scopeToOrg, rateLimiter, validate, activityLogger
- Pagination and filter utilities
- **Deliverable:** Middleware stack can be applied to routes

### Sub-phase 1E: Auth Module (1-2 hours)
- Validator, repository, service, controller, routes
- Register, login, refresh, logout, forgot-password, reset-password, me
- **Deliverable:** Full auth flow works end-to-end

### Sub-phase 1F: Users Module (1 hour)
- Validator, repository, service, controller, routes
- CRUD with org scoping and role restrictions
- **Deliverable:** User management works with proper RBAC

### Sub-phase 1G: Organizations Module (1 hour)
- Validator, repository, service, controller, routes
- CRUD with scoping, status transitions, tier recalculation endpoint
- **Deliverable:** Org management works with proper scoping

### Sub-phase 1H: Tiers Module (30 min)
- Repository, service, controller, routes
- CRUD with deletion guard
- **Deliverable:** Tier management works with admin-only restrictions

### Sub-phase 1I: Products Module (1 hour)
- Validator, repository, service, controller, routes
- CRUD with categories, tier pricing, soft-delete, partner filtering
- **Deliverable:** Product catalog works with tier-aware pricing

---

## Appendix A: Status Transition Rules

### Organization Status

```
prospect ──> pending_approval ──> active ──> suspended ──> churned
    │                                  │          │
    └──────────── active ──────────────┘          │
                  (fast-track)            active ←─┘
                                        (reinstatement)
```

Valid transitions:
- `prospect` -> `pending_approval`, `active` (fast-track by admin)
- `pending_approval` -> `active`, `prospect` (send back)
- `active` -> `suspended`
- `suspended` -> `active` (reinstatement), `churned`
- `churned` -> (terminal, no transitions out)

### User Lifecycle
Users are never hard-deleted. `is_active = false` is the deactivation mechanism. Deactivated users cannot log in but their records are preserved for audit trail integrity.

---

## Appendix B: Environment Variables

```bash
# Server
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=prm_portal
DB_USER=postgres
DB_PASSWORD=postgres
DB_SSL=false

# Redis
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=<min-32-char-secret>
JWT_REFRESH_SECRET=<min-32-char-secret-different-from-above>
JWT_ACCESS_EXPIRY=1h
JWT_REFRESH_EXPIRY=30d
BCRYPT_ROUNDS=12
PASSWORD_RESET_EXPIRY=1h

# Rate Limiting
RATE_LIMIT_GENERAL=100
RATE_LIMIT_AUTH=5
RATE_LIMIT_WINDOW_MS=60000
```

---

## Appendix C: Glossary

- **PRM**: Partner Relationship Management
- **RBAC**: Role-Based Access Control
- **JWT**: JSON Web Token
- **CM**: Channel Manager
- **MDF**: Market Development Funds
- **CPQ**: Configure, Price, Quote
- **SKU**: Stock Keeping Unit
- **SLA**: Service Level Agreement
- **PANW**: Palo Alto Networks (the real-world product this system models)
- **Org Scoping**: The mechanism by which partner users can only see data belonging to their organization
- **Soft Delete**: Setting `is_active = false` instead of physically deleting a database row
