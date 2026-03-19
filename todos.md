# PRM Portal — Implementation Todos

## Phase 1: Foundation (Backend Setup + Auth + Core CRUD) ✅ COMPLETE
> Completed: 44 backend files, 17 migrations, 45 frontend files, 177 tests (129 unit passing). QA signed off.

### Project Scaffolding
- [ ] Initialize Node.js project with TypeScript (`package.json`, `tsconfig.json`)
- [ ] Install dependencies: express, pg, knex, bcryptjs, jsonwebtoken, cors, helmet, morgan, dotenv, joi, bull, ioredis
- [ ] Install dev dependencies: nodemon, jest, supertest, ts-node, @types/*
- [ ] Create folder structure: `src/{config,middleware,routes,controllers,services,repositories,jobs,utils,validators}`
- [ ] Create `.env.example` with all required env vars (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, JWT_SECRET, JWT_REFRESH_SECRET, REDIS_URL, S3_ENDPOINT, S3_BUCKET)
- [ ] Create `knexfile.ts` with dev/test/prod database configs
- [ ] Create `src/app.ts` — Express app setup (cors, helmet, morgan, JSON parsing, route mounting, error handler)
- [ ] Create `src/server.ts` — HTTP server entry point

### Database
- [ ] Run `docs/001-schema.sql` or convert to Knex migrations
- [ ] Create migration: `001_extensions` — uuid-ossp, pgcrypto, pg_trgm
- [ ] Create migration: `002_enums` — all 10 enum types
- [ ] Create migration: `003_partner_tiers` — partner_tiers table
- [ ] Create migration: `004_organizations` — organizations table
- [ ] Create migration: `005_users` — users table + FK back to organizations.channel_manager_id
- [ ] Create migration: `006_products` — product_categories, products, tier_product_pricing tables
- [ ] Create migration: `007_deals` — deals, deal_status_history, deal_products tables + indexes + trigram index
- [ ] Create migration: `008_quotes` — quotes, quote_line_items tables
- [ ] Create migration: `009_leads` — leads table
- [ ] Create migration: `010_mdf` — mdf_allocations, mdf_requests tables
- [ ] Create migration: `011_training` — courses, user_certifications tables
- [ ] Create migration: `012_documents` — document_folders, documents tables
- [ ] Create migration: `013_notifications` — notifications, activity_feed tables
- [ ] Create migration: `014_approvals` — approval_requests table
- [ ] Create migration: `015_sequences` — deal/quote/lead/mdf number sequences
- [ ] Create migration: `016_functions` — update_updated_at trigger function, number generators, find_deal_conflicts, calculate_partner_tier
- [ ] Create migration: `017_triggers` — all updated_at triggers + number generation triggers

### Seed Data
- [ ] Seed 4 partner tiers: Registered (rank 1), Innovator (rank 2), Platinum Innovator (rank 3), Diamond Innovator (rank 4) — with PANW-style requirements and benefits
- [ ] Seed product categories: Network Security, SASE, Cloud Security, Security Operations, Professional Services
- [ ] Seed ~20 products mimicking PANW portfolio: PA-400/1400/3400/5400 Series, VM-Series, CN-Series, Cloud NGFW, Prisma Access, Prisma SD-WAN, Prisma Cloud, Cortex XDR, Cortex XSOAR, Cortex XSIAM, Unit 42 Services
- [ ] Seed tier_product_pricing for each product × tier combination
- [ ] Seed admin user (internal super-admin)
- [ ] Seed 2 channel manager users
- [ ] Seed 4 partner organizations at different tiers: "CyberShield Solutions" (Diamond), "CloudGuard Inc" (Platinum), "NetSecure Partners" (Innovator), "TechDefend LLC" (Registered)
- [ ] Seed partner_admin + partner_rep users for each org
- [ ] Seed 5 sample courses: PCNSA, PCNSE, PCSAE, PCCSE, PCDRA

### Config
- [ ] `src/config/database.ts` — Knex + pg pool config (connection pooling, SSL)
- [ ] `src/config/redis.ts` — Redis client (ioredis)
- [ ] `src/config/auth.ts` — JWT secrets, expiry settings, bcrypt rounds
- [ ] `src/config/constants.ts` — enums mirroring DB enums, pagination defaults, SLA durations, protection periods

### Middleware
- [ ] `src/middleware/authenticate.ts` — Verify JWT, attach `req.user` (sub, email, role, org_id, tier_id)
- [ ] `src/middleware/authorize.ts` — Role-based guard: `authorize('admin', 'channel_manager')` returns 403 if role not in list
- [ ] `src/middleware/scopeToOrg.ts` — Set `req.orgScope` based on role (partner → own org_id, CM → assigned orgs, admin → no filter)
- [ ] `src/middleware/rateLimiter.ts` — Redis-backed rate limiting (100 req/min general, 5 req/min auth)
- [ ] `src/middleware/validate.ts` — Joi/Zod schema validation wrapper (`validate(schema)` returns 422 with field errors)
- [ ] `src/middleware/errorHandler.ts` — Global error handler (AppError → structured response, unhandled → 500)
- [ ] `src/middleware/activityLogger.ts` — Auto-log write operations to activity_feed table

### Utils
- [ ] `src/utils/AppError.ts` — Custom error class with code, statusCode, message
- [ ] `src/utils/pagination.ts` — Parse `page` + `per_page` query params, return offset/limit + meta
- [ ] `src/utils/filters.ts` — Query param → Knex WHERE builder (handles eq, in, gte, lte, like, date ranges)
- [ ] `src/utils/numberGenerator.ts` — Fallback JS-side number generation if DB trigger not used

### Auth Module
- [ ] `src/validators/auth.validator.ts` — Schemas for register, login, refresh, forgot-password, reset-password
- [ ] `src/repositories/auth.repository.ts` — findUserByEmail, createUser, updateRefreshToken, findByRefreshToken
- [ ] `src/services/auth.service.ts` — register (create org + user), login (verify password, generate tokens), refresh (rotate), logout (clear token)
- [ ] `src/controllers/auth.controller.ts` — Thin handler for each auth endpoint
- [ ] `src/routes/auth.routes.ts` — POST /register, /login, /refresh, /logout, /forgot-password, /reset-password; GET /me; PATCH /me

### Users Module
- [ ] `src/validators/user.validator.ts` — Create/update user schemas
- [ ] `src/repositories/user.repository.ts` — CRUD + list with filters + org scoping
- [ ] `src/services/user.service.ts` — Create user (partner_admin can only create within own org), update, soft-delete
- [ ] `src/controllers/user.controller.ts`
- [ ] `src/routes/user.routes.ts` — GET /, GET /:id, POST /, PATCH /:id, DELETE /:id, GET /:id/certifications, GET /:id/activity

### Organizations Module
- [ ] `src/validators/organization.validator.ts`
- [ ] `src/repositories/organization.repository.ts` — CRUD + list with tier/status/search filters + org scoping
- [ ] `src/services/organization.service.ts` — Create, update, trigger tier recalculation
- [ ] `src/controllers/organization.controller.ts`
- [ ] `src/routes/organization.routes.ts` — GET /, POST /, GET /:id, PATCH /:id, GET /:id/dashboard, GET /:id/deals, GET /:id/leads, GET /:id/quotes, GET /:id/mdf, GET /:id/users, POST /:id/recalculate-tier

### Tiers Module
- [ ] `src/repositories/tier.repository.ts` — CRUD + list orgs per tier
- [ ] `src/services/tier.service.ts` — Create, update, delete (guard: no orgs assigned)
- [ ] `src/controllers/tier.controller.ts`
- [ ] `src/routes/tier.routes.ts` — GET /, POST /, GET /:id, PATCH /:id, DELETE /:id, GET /:id/organizations

### Products Module
- [ ] `src/validators/product.validator.ts`
- [ ] `src/repositories/product.repository.ts` — CRUD + category tree + tier pricing CRUD
- [ ] `src/services/product.service.ts` — Create, update, soft-delete, manage tier pricing
- [ ] `src/controllers/product.controller.ts`
- [ ] `src/routes/product.routes.ts` — GET /, POST /, GET /:id, PATCH /:id, DELETE /:id, GET /categories, POST /categories, PATCH /categories/:id, GET /:id/tier-pricing, PUT /:id/tier-pricing/:tierId

---

## Phase 2: Deal Registration ✅ COMPLETE
> Completed: All deal CRUD, conflict detection (4-layer), deal products, status history, expiration jobs, integration tests. QA signed off.

### Deal CRUD + Submission
- [x] `src/validators/deal.validator.ts` — Create deal, update deal, submit, approve/reject schemas
- [x] `src/repositories/deal.repository.ts` — CRUD + list with filters (status, org, customer, value range, close date) + org scoping + join deal_products
- [x] `src/services/deal.service.ts`:
  - [x] `createDeal()` — Validate fields, set status=draft, auto-generate deal_number
  - [x] `submitDeal()` — Transition draft→submitted, run conflict detection, create approval_request for channel manager, send notification
  - [x] `approveDeal()` — Transition submitted/under_review→approved, set registration_expires_at = now + 90 days, notify partner
  - [x] `rejectDeal()` — Set status=rejected with rejection_reason, notify partner
  - [x] `markWon()` — Set status=won, actual_value, actual_close_date, trigger tier recalculation job
  - [x] `markLost()` — Set status=lost with loss_reason
- [x] `src/controllers/deal.controller.ts`
- [x] `src/routes/deal.routes.ts` — Full endpoint set per API design doc

### Conflict Detection
- [x] `src/services/deal.service.ts` → `detectConflicts()` — Call `find_deal_conflicts()` PostgreSQL function
- [x] `GET /deals/conflict-check` — Pre-submission conflict check (query params: customer_company, customer_email, product_id)
- [x] `GET /deals/:id/conflicts` — Show conflicts for an existing deal
- [x] On submission: auto-flag deal if conflicts found, include conflict details in CM notification

### Deal Products (Junction)
- [x] `POST /deals/:id/products` — Add product to deal (product_id, quantity, unit_price, discount_pct)
- [x] `DELETE /deals/:id/products/:productId` — Remove product from deal
- [x] Auto-recalculate deal estimated_value as sum of deal_products.line_total

### Status History
- [x] Insert into `deal_status_history` on every status change (from_status, to_status, changed_by, notes)
- [x] `GET /deals/:id/history` — Return audit trail ordered by created_at

### Deal Expiration Background Job
- [x] `src/jobs/dealExpiration.job.ts`:
  - [x] Query deals WHERE status='approved' AND registration_expires_at < NOW()
  - [x] Update status to 'expired'
  - [x] Send notification to partner
- [x] `src/jobs/dealExpirationReminder.job.ts`:
  - [x] Query deals WHERE status='approved' AND registration_expires_at BETWEEN NOW() AND NOW() + 14 days
  - [x] Send reminder notifications at 14-day and 7-day marks

---

## Phase 3: CPQ (Configure, Price, Quote) ✅ COMPLETE
> Completed: Quote CRUD, pricing waterfall engine, line item management, 3-band discount approval, clone, recalculate, status history, 81 tests (56 integration + 25 unit). PDF generation deferred to Phase 7. QA signed off.

### Quote CRUD
- [x] `src/validators/quote.validator.ts` — Create quote, add line, update line, submit, approve/reject schemas
- [x] `src/repositories/quote.repository.ts` — CRUD + list with filters + org scoping + join line items
- [x] `src/services/quote.service.ts`:
  - [x] `createQuote()` — Create from scratch or from a deal (pre-populate customer info), auto-generate quote_number
  - [x] `cloneQuote()` — Deep clone quote + line items as new draft

### Pricing Waterfall Engine
- [x] `src/services/quote.service.ts` → `calculateLinePrice()`:
  - [x] Fetch list_price from products table
  - [x] Apply volume discount from discount schedules (if implemented)
  - [x] Apply partner tier discount from tier_product_pricing (or tier.default_discount_pct fallback)
  - [x] Apply additional discount (partner-entered)
  - [x] Calculate unit_price and line_total
- [x] `POST /quotes/:id/recalculate` — Re-run pricing for all lines (after tier change or product price update)

### Line Item Management
- [x] `POST /quotes/:id/lines` — Add line item, auto-calculate pricing, check discount threshold
- [x] `PATCH /quotes/:id/lines/:lineId` — Update quantity/discount, re-calculate, re-check approval
- [x] `DELETE /quotes/:id/lines/:lineId` — Remove line, update quote totals
- [x] Auto-update quote header totals (subtotal, total_discount, total_amount) after any line change

### Discount Approval Logic
- [x] `src/services/quote.service.ts` → `evaluateDiscount()`:
  - [x] Tier self-approve threshold from partner_tiers.max_discount_pct
  - [x] Product-specific override from tier_product_pricing.discount_pct
  - [x] 3 bands: auto-approve / CM approval / admin approval
- [x] `submitQuote()` — If requires_approval=true, create approval_request(s), set status=pending_approval
- [x] `approveQuote()` — CM/admin approves, set line discount_approved=true, if all lines approved set quote status=approved
- [x] `rejectQuote()` — Set status=rejected with reason, flag specific unapproved lines

### PDF Generation (deferred to Phase 7)
- [ ] `src/services/document.service.ts` → `generateQuotePdf()`:
  - [ ] HTML template with partner logo, line items table, pricing, terms & conditions, validity period
  - [ ] Render with Puppeteer → PDF buffer
  - [ ] Upload to S3/MinIO, store url in quotes.pdf_url
- [ ] `GET /quotes/:id/pdf` — Return PDF (generate if not exists)
- [ ] `POST /quotes/:id/send` — Generate PDF + mark status=sent_to_customer + (optional) email to customer

---

## Phase 4: Lead Distribution ✅ COMPLETE
> Completed: Lead CRUD, assignment algorithm (4-dimension scoring), accept/return/convert/disqualify flows, SLA enforcement job, bulk assign, recommendations endpoint, 127 tests (62 integration + 65 unit). 3 bugs found and fixed. QA signed off.

### Lead CRUD
- [x] `src/validators/lead.validator.ts` — Create lead, assign, accept, return, convert schemas
- [x] `src/repositories/lead.repository.ts` — CRUD + list with filters (status, score, source, org) + org scoping
- [x] `src/services/lead.service.ts`:
  - [x] `createLead()` — Create with score, auto-generate lead_number

### Assignment Logic
- [x] `src/services/lead.service.ts` → `assignLead()`:
  - [x] Select partner org based on: tier priority (higher first), geographic match, industry expertise, current lead load (fairness)
  - [x] Set assigned_org_id, assigned_user_id (optional), assigned_at, sla_deadline = now + 48hr
  - [x] Send notification to partner admin
- [x] `POST /leads/bulk-assign` — Assign multiple leads to partners
- [x] `GET /leads/unassigned` — Leads awaiting assignment (for CM/admin)

### Accept / Return Flow
- [x] `POST /leads/:id/accept` — Validate lead assigned to user's org, set status=accepted, accepted_at=now
- [x] `POST /leads/:id/return` — Set status=returned, return_reason required, clear assigned_org/user, re-queue
- [x] `POST /leads/:id/convert` — Create deal registration pre-populated from lead data, set converted_deal_id, status=converted, converted_at=now
- [x] `POST /leads/:id/disqualify` — Set status=disqualified with disqualify_reason

### SLA Enforcement Background Job
- [x] `src/jobs/leadSlaCheck.job.ts` (every 4 hours):
  - [x] Query leads WHERE status='assigned' AND sla_deadline < NOW()
  - [x] Send warning notification at 24 hours remaining
  - [x] Auto-return leads past 48-hour SLA deadline
  - [x] Log SLA breach in activity_feed

---

## Phase 5: MDF (Market Development Funds) ✅ COMPLETE
> Completed: MDF service (530 lines), controller, routes (18 endpoints), 2 background jobs, 4 frontend pages. 1 bug fixed (TS params type). 97 tests (66 unit + 31 integration). QA signed off.

### MDF Allocation
- [x] `src/validators/mdf.validator.ts` — Allocation create/update, request create/submit, claim schemas
- [x] `src/repositories/mdf.repository.ts` — Allocation CRUD + request CRUD + org scoping
- [x] `src/services/mdf.service.ts`:
  - [x] `createAllocation()` — Admin/CM creates quarterly allocation for a partner (validate: no duplicate org+year+quarter)
  - [x] `autoAllocate()` — Calculate allocation based on tier.mdf_budget_pct × trailing revenue, capped by tier, 20% bonus for top performers

### MDF Request Lifecycle
- [x] `src/services/mdf.service.ts`:
  - [x] `createRequest()` — Validate: amount <= remaining allocation, start_date >= today + 14 days, single request <= 50% of quarterly allocation
  - [x] `submitRequest()` — Transition draft→submitted, create approval_request for CM
  - [x] `approveRequest()` — Set approved_amount (may differ from requested), status=approved, reserve funds against allocation.spent_amount
  - [x] `rejectRequest()` — Status=rejected with reason
  - [x] `completeActivity()` — Partner marks activity complete, status=completed

### Claim & Reimbursement
- [x] `src/services/mdf.service.ts`:
  - [x] `submitClaim()` — Validate: claim_amount <= approved_amount, at least 1 proof_of_execution file, within 60 days of end_date. Set status=claim_submitted
  - [x] `approveClaim()` — Set reimbursement_amount, status=claim_approved
  - [x] `rejectClaim()` — Status=claim_rejected with reason (partner can resubmit)
  - [x] `markReimbursed()` — Admin confirms payment, status=reimbursed, reimbursed_at=now, update allocation.spent_amount
- [x] File upload for proof of execution (S3/MinIO integration)

### MDF Background Jobs
- [x] `src/jobs/mdfClaimDeadline.job.ts` — Warn partners of approaching 60-day claim deadline
- [x] `src/jobs/mdfQuarterlyAllocation.job.ts` — Auto-generate next quarter allocations based on tier rules

### MDF Frontend
- [x] `client/src/pages/mdf/MdfOverview.tsx` — Allocation overview with utilization cards
- [x] `client/src/pages/mdf/MdfRequestList.tsx` — Filterable request list with status badges
- [x] `client/src/pages/mdf/MdfRequestForm.tsx` — Create/edit request form with validation
- [x] `client/src/pages/mdf/MdfRequestDetail.tsx` — Detail view with role-based actions
- [x] Routes added to App.tsx, sidebar nav enabled

---

## Phase 6: Dashboards & Analytics ✅ COMPLETE
> Completed: Dashboard repo/service/controller/routes (7 endpoints), analytics (4 endpoints), 3 role-specific frontend dashboards, analytics page, 5 chart components. 4 bugs fixed. 69 tests (27 unit + 42 integration). QA signed off.

### Partner Dashboard (`GET /dashboard/partner`)
- [x] Pipeline summary: total pipeline value, deal count by status (bar chart data)
- [x] Revenue tracker: YTD closed-won revenue vs tier target (gauge data)
- [x] Deal registration status breakdown: submitted/approved/rejected/expired counts (donut data)
- [x] Lead performance: assigned/accepted/converted counts, conversion rate
- [x] MDF balance: allocated/requested/claimed/remaining (donut data)
- [x] Certification count and expiring certs
- [x] Tier progress: current metrics vs next tier requirements (progress bar data)

### Channel Manager Dashboard (`GET /dashboard/channel-manager`)
- [x] Portfolio overview: all assigned partners with tier, pipeline value, health score
- [x] Pending approvals count (deals + quotes + MDF)
- [x] Partner performance scorecards: revenue attainment, deal win rate, lead conversion, SLA compliance
- [x] Lead distribution metrics: unassigned count, acceptance rate by partner, avg response time

### Admin Dashboard (`GET /dashboard/admin`)
- [x] Program-wide metrics: total partners, total pipeline, total revenue, active deals
- [x] Tier distribution: count of partners per tier (bar chart)
- [x] MDF utilization: total allocated vs spent vs remaining across program
- [x] Certification coverage: % of partners meeting cert requirements per tier
- [x] Top partners by revenue, deal count, lead conversion

### Analytics Endpoints
- [x] `GET /analytics/pipeline` — Deal pipeline by stage × value × partner (filterable by date range)
- [x] `GET /analytics/partner-performance` — Scorecard data per partner
- [x] `GET /analytics/lead-conversion` — Conversion funnel metrics by partner
- [x] `GET /analytics/mdf-roi` — MDF spend vs revenue generated per partner

### Frontend Dashboard Pages
- [x] Partner home page with Quick Actions row + chart grid
- [x] Channel Manager portfolio view with partner cards + approval queue
- [x] Admin analytics page with filterable charts
- [x] Recharts components: BarChart, RadialBarChart (gauge), PieChart (donut), LineChart, ProgressBar

---

## Phase 7: Training, Content Library & Notifications ✅ COMPLETE
> Completed: 4 modules (Training, Content Library, Notifications, Activity Feed). 18 backend files, 17 frontend files. 26 endpoints. Cert expiry job. 2 bugs fixed. 120 tests (79 unit + 41 integration). QA signed off.

### Training & Certifications
- [x] `src/repositories/course.repository.ts` — Course CRUD + certification CRUD + org-level summary
- [x] `src/services/course.service.ts`:
  - [x] `enrollUser()` — Create user_certification with status=enrolled
  - [x] `recordCompletion()` — Set score, status=passed/failed, certified_at, expires_at (course.certification_valid_months)
  - [x] `getOrgCertSummary()` — Count certs by status for an org (feeds tier calculation)
- [x] `src/routes/course.routes.ts` — GET /courses, POST /courses, GET /:id, PATCH /:id, POST /:id/enroll, POST /:id/complete
- [x] `GET /certifications` — List certs (by org or user)
- [x] `GET /certifications/expiring` — Certs expiring within N days
- [x] `GET /certifications/org-summary/:orgId` — Aggregate cert stats

### Certification Expiry Background Job
- [x] `src/jobs/certExpiry.job.ts` — Send notifications at 30/7/1 days before cert expires
- [x] Auto-update status to 'expired' when expires_at < NOW()

### Content Library
- [x] `src/repositories/document.repository.ts` — Folder tree + document CRUD + tier-filtered reads + download count increment
- [x] `src/services/document.service.ts`:
  - [x] `listDocuments()` — Filter by folder, tags, file_type, search; enforce tier visibility
  - [x] `uploadDocument()` — Upload file to S3/MinIO, create document record
  - [x] `downloadDocument()` — Return signed URL, increment download_count
- [x] `src/routes/document.routes.ts` — Full endpoint set

### Notification System
- [x] `src/repositories/notification.repository.ts` — Create, list (by user), mark read, unread count
- [x] `src/services/notification.service.ts` — Expanded: createNotification, getUnreadCount, markRead, markAllRead, delete
- [x] `src/routes/notification.routes.ts` — GET /, GET /unread-count, PATCH /:id/read, POST /mark-all-read, DELETE /:id
- [x] Notifications integrated into deal, quote, lead, MDF, cert expiry services

### Activity Feed
- [x] `src/repositories/activity.repository.ts` — List with filters (entity_type, entity_id, actor, org, date range)
- [x] `GET /activity` — Scoped activity feed
- [x] Activity logger middleware auto-inserts records for POST/PATCH/DELETE operations

### Frontend
- [x] CourseCatalog, CourseDetail, CertificationList pages
- [x] ContentLibrary, DocumentDetail pages
- [x] NotificationBell component in header with polling
- [x] NotificationList page
- [x] All routes, sidebar nav, hooks, API clients

---

## Phase 8: Frontend (React SPA) ✅ COMPLETE
> Completed: All pages built across phases 2-8. Admin pages (PartnerList, PartnerDetail, ApprovalsPage), shared components (TimelineHistory, FileUpload). Toast via react-hot-toast. 4 bugs fixed. QA signed off.

### App Shell & Routing
- [x] React Router v6 setup with role-based route guards
- [x] Layout: sidebar nav (collapsible) + header (user profile, notifications bell, search) + main content area
- [x] Auth context: login/logout, token management, role-based rendering
- [x] TanStack Query setup: query client, default options, devtools

### Auth Pages
- [x] `/login` — Email + password form, JWT token storage
- [x] `/register` — Partner self-registration (company name, admin user details)
- [x] `/forgot-password` + `/reset-password`

### Dashboard Pages
- [x] `/` (Home) — Role-specific dashboard (partner/CM/admin)
- [x] Partner: welcome banner, quick actions, pipeline chart, revenue gauge, recent deals, open leads, MDF balance, cert progress, tier progress bar
- [x] CM: portfolio cards, pending approvals queue, partner scorecards
- [x] Admin: program metrics, tier distribution, MDF utilization, top partners

### Deal Registration Pages
- [x] `/deals` — Filterable list view (status, date range, value range, search)
- [x] `/deals/new` — Multi-step form: customer info → deal details → product selection → review & submit
- [x] `/deals/:id` — Detail view with action buttons

### CPQ Pages
- [x] `/quotes` — Filterable list view
- [x] `/quotes/new` — Quote builder with pricing waterfall
- [x] `/quotes/:id` — Detail view: line items table, approval status
- [ ] `/quotes/:id/pdf` — PDF preview (deferred — PDF gen in Phase 7 notes)

### Lead Pages
- [x] `/leads` — List with SLA indicators
- [x] `/leads/:id` — Detail view with accept/return/convert

### MDF Pages
- [x] `/mdf` — Allocation overview
- [x] `/mdf/requests` — Request list with status filters
- [x] `/mdf/requests/new` — Request form
- [x] `/mdf/requests/:id` — Detail view with claim submission

### Product Catalog
- [x] `/products` — Browse by category, search
- [x] Product cards with tier price info

### Training & Certs
- [x] `/training` — Course catalog with enrollment status
- [x] `/training/:id` — Course detail with enroll button
- [x] `/certifications` — Certs list with expiry dates, org summary

### Content Library
- [x] `/library` — Folder tree sidebar + document grid, search, filter
- [x] Download tracking

### Notifications
- [x] Bell icon in header with unread count badge
- [x] Dropdown panel showing recent notifications
- [x] `/notifications` — Full notification list with mark read/unread

### Admin Pages
- [x] `/admin/partners` — Partner list with tier badges, search, status filters
- [x] `/admin/partners/:id` — Partner detail: scorecard, users, deals, quotes, MDF, certs
- [x] `/admin/approvals` — Unified pending approvals queue (deals + quotes + MDF)
- [x] `/admin/tiers` — Tier management (CRUD)
- [x] `/admin/analytics` — Full analytics dashboards (at /analytics route)

### Shared Components
- [x] `<DataTable>` — Sortable, filterable table with pagination
- [x] `<StatusBadge>` — Color-coded status pills
- [x] `<TierBadge>` — Tier icon + name with color
- [x] `<QuickActions>` — Button row for common actions
- [x] `<ApprovalCard>` — In ApprovalsPage inline
- [x] `<TimelineHistory>` — Vertical timeline for status changes
- [x] `<FileUpload>` — Drag-and-drop file upload with preview
- [x] `<SearchBar>` — Global search
- [x] `<EmptyState>` — Illustrated empty state for lists
- [x] `<LoadingSkeleton>` — Shimmer loading placeholders
- [x] `<Toast>` — Via react-hot-toast (already configured)

---

## Phase 9: Background Jobs Setup ✅ COMPLETE
> Completed: Queue factory, 9 scheduled jobs, central scheduler with node-cron, server integration. 3 bugs fixed. 31 tests. QA signed off.

- [x] `src/jobs/queue.ts` — Bull queue setup with Redis connection, default job options, event logging
- [x] `src/jobs/tierRecalculation.job.ts` — Daily 2:00 AM: recalculate all partner tiers (with 30-day grace period)
- [x] `src/jobs/dealExpiration.job.ts` — Daily 6:00 AM: expire deals past protection window
- [x] `src/jobs/dealExpirationReminder.job.ts` — Daily: send 14-day and 7-day reminders
- [x] `src/jobs/leadSlaCheck.job.ts` — Every 4 hours: warn/auto-return SLA-breached leads
- [x] `src/jobs/certExpiry.job.ts` — Daily 8:00 AM: 30/7/1 day cert expiry warnings
- [x] `src/jobs/mdfClaimDeadline.job.ts` — Daily 9:00 AM: MDF claim deadline warnings
- [x] `src/jobs/mdfQuarterlyAllocation.job.ts` — Quarterly: auto-generate next quarter MDF allocations
- [x] `src/jobs/metricsRollup.job.ts` — Daily midnight: update denormalized org metrics
- [x] `src/jobs/inactiveDealReminder.job.ts` — Weekly Monday 9 AM: remind partners of inactive deals
- [x] Register all jobs in `src/jobs/scheduler.ts` with node-cron
- [x] Integrated in `src/server.ts` with graceful shutdown

---

## Phase 10: Testing ✅ COMPLETE
> Completed: 500+ tests across all phases. Unit tests for all services + jobs. Integration tests for all modules. Written incrementally during QA phases.

### Unit Tests
- [x] Auth service: register, login, refresh, token generation
- [x] Deal service: conflict detection (all 4 layers), status transitions, expiration logic
- [x] Quote service: pricing waterfall calculation, discount threshold evaluation
- [x] Lead service: assignment scoring, SLA calculation
- [x] MDF service: allocation calculation, request validation, claim validation
- [x] Tier service: qualification calculation, downgrade grace period (via tierRecalculation job tests)
- [x] Dashboard service: all 3 dashboards, health scores, partial failure
- [x] Course service: enrollment state machine, completion, cert summary
- [x] Document service: CRUD, tier visibility, download counting
- [x] Notification service: list, unread count, mark read, delete
- [x] Background jobs: dealExpiration, tierRecalculation, metricsRollup, inactiveDealReminder

### Integration Tests
- [x] Auth endpoints: register → login → refresh → me → logout
- [x] Deal lifecycle: create draft → submit → approve → mark won (with conflict detection)
- [x] Quote lifecycle: create → add lines → submit → approve
- [x] Lead lifecycle: create → assign → accept → convert to deal
- [x] MDF lifecycle: create allocation → submit request → approve → submit claim → reimburse
- [x] RBAC: verify partner cannot access other org's data, CM can only see assigned orgs
- [x] Dashboard: role-based access, response structure validation
- [x] Training: course CRUD, enrollment, completion
- [x] Documents: CRUD, tier filtering, download counting

### Seed Data for Demo
- [x] Create demo script that populates realistic data (`seeds/002_demo_data.ts`)
- [x] Time-distributed data (deals from past 6 months) for meaningful chart visualizations

---

## Phase 11: Polish & Demo Readiness ✅ COMPLETE
> Completed: PANW NextWave theme applied (33 files updated), responsive sidebar, login branding, demo script, Docker Compose + Dockerfile, demo seed data.

- [x] PANW-themed color palette (NextWave brand colors)
- [x] Responsive layout (desktop + tablet) — mobile sidebar with hamburger menu
- [x] Loading states, error states, empty states for all pages
- [x] Toast notifications for all user actions (react-hot-toast)
- [ ] Dark/light mode toggle (deferred — low priority)
- [x] 5-minute demo walkthrough script covering all modules (`docs/demo-script.md`)
- [x] Docker Compose for one-command local setup (API + PostgreSQL + Redis + MinIO)
