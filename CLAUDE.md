# PRM Portal — Partner Relationship Management Platform

## Project Overview
A functional prototype of Salesforce Experience Cloud (Partner Community) — the same platform Palo Alto Networks uses for its NextWave Partner Portal. Built with React + Node.js to understand partner-facing product management for a PANW IT PM interview.

**Status: ALL 11 PHASES COMPLETE** — 500+ tests, 100+ API endpoints, full React SPA with PANW NextWave branding.

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS (PANW theme) + Headless UI + Recharts + TanStack Query + React Router v6 + react-hot-toast
- **Backend**: Express.js + TypeScript + Knex.js (query builder) + PostgreSQL
- **Auth**: JWT (access 1hr + refresh 30d) + bcrypt + role-based access control
- **Background Jobs**: Bull (Redis-backed) + node-cron (9 scheduled jobs)
- **File Storage**: MinIO (S3-compatible)
- **PDF**: Puppeteer (deferred)
- **Email**: Nodemailer (dev) / SendGrid (prod)
- **DevOps**: Docker Compose (PostgreSQL + Redis + MinIO + API)

## Quick Start
```bash
# Option 1: Docker (recommended)
cp .env.example .env
docker-compose up -d

# Option 2: Local (requires PostgreSQL + Redis running)
docker compose up -d postgres redis   # start DB + cache
cp .env.example .env                  # configure env (update DB_USER/DB_PASSWORD if needed)
npm run setup                         # install + migrate + seed + demo data
npm run dev                           # start API server
cd client && npm run dev              # start frontend
```

## Demo Accounts
All accounts use password: **`Demo123!`**

| Role | Email | Description |
|------|-------|-------------|
| Admin | `admin@prmportal.com` | System admin — full access, program analytics |
| Channel Manager | `sarah.chen@prmportal.com` | Manages CyberShield + CloudGuard partners |
| Channel Manager | `marcus.johnson@prmportal.com` | Manages NetSecure + TechDefend partners |
| Partner Admin (Diamond) | `admin@cybershield.com` | CyberShield Solutions — highest tier |
| Partner Admin (Platinum) | `admin@cloudguard.io` | CloudGuard Inc — mid-high tier |
| Partner Admin (Innovator) | `admin@netsecure.net` | NetSecure Partners — mid tier |
| Partner Admin (Registered) | `admin@techdefend.com` | TechDefend LLC — entry tier |
| Partner Rep | `rep@cybershield.com` | Sales rep at CyberShield |
| Partner Rep | `rep@cloudguard.io` | Sales rep at CloudGuard |
| Partner Rep | `rep@netsecure.net` | Sales rep at NetSecure |
| Partner Rep | `rep@techdefend.com` | Sales rep at TechDefend |

The login page has quick-login buttons to auto-fill credentials for each role.

## Architecture
```
React SPA (Vite) ←→ Express.js API (/api/v1) ←→ PostgreSQL
                          ↕                          ↕
                     Redis (cache/queues)        S3/MinIO (files)
                          ↕
                     Bull Workers + node-cron (9 scheduled jobs)
```

## Project Structure
```
prm-portal/
├── src/
│   ├── config/           # database, redis, auth, constants (health scores, tier thresholds)
│   ├── middleware/        # authenticate, authorize, scopeToOrg, rateLimiter, validate, errorHandler, activityLogger
│   ├── routes/           # auth, users, organizations, tiers, deals, products, quotes, leads, mdf, courses, documents, notifications, dashboard, analytics, activity
│   ├── controllers/      # thin — parse request, call service, send response
│   ├── services/         # business logic (deal conflicts, pricing waterfall, discount approval, tier calc, lead assignment, MDF allocation, dashboards)
│   ├── repositories/     # data access layer (SQL queries via Knex)
│   ├── jobs/             # queue.ts (Bull factory), scheduler.ts (cron), 9 job processors
│   ├── utils/            # AppError, pagination, filters, numberGenerator, response envelope
│   └── validators/       # Joi schemas per entity
├── client/               # React SPA (Vite)
│   ├── src/
│   │   ├── api/          # 10 API clients (auth, deals, quotes, leads, mdf, dashboard, courses, documents, notifications, admin)
│   │   ├── components/   # layout (Sidebar, Header, AppLayout), shared (DataTable, StatusBadge, TierBadge, TimelineHistory, FileUpload, etc.), charts (StatCard, DonutChart, BarChartWidget, LineChartWidget, ProgressBar), notifications (NotificationBell)
│   │   ├── contexts/     # AuthContext
│   │   ├── hooks/        # useAuth, useQuotes, useLeads, useMdf, useDashboard, useCourses, useDocuments, useNotifications, useAdmin
│   │   ├── pages/        # auth, dashboard (3 role-specific), deals, quotes, leads, mdf, training, library, notifications, admin (partners, approvals), settings, products, tiers
│   │   └── types/        # TypeScript interfaces for all entities
│   └── tailwind.config.js  # PANW NextWave color theme
├── migrations/           # 19 Knex migration files
├── seeds/                # 001_seed_data.ts (base), 002_demo_data.ts (realistic demo data)
├── tests/                # 500+ tests: unit (services, jobs) + integration (all modules)
├── docs/                 # schema, API design, auth/business logic, PRDs (phases 5-7), demo script
├── docker-compose.yml    # PostgreSQL + Redis + MinIO + API
├── Dockerfile            # Multi-stage build
└── package.json
```

## Database
- PostgreSQL with 21 tables — schema in `docs/001-schema.sql`
- 19 migrations including org metrics columns (active_deals_count, total_pipeline_value, tier_downgrade_grace_at)
- Key extensions: uuid-ossp, pgcrypto, pg_trgm (fuzzy text matching for deal conflicts)
- Knex.js for migrations and query building (not a full ORM)
- Generated columns for computed fields (line_total, remaining_amount)
- Sequence-based human-readable IDs (DR-2026-00001, QT-2026-00001, etc.)

## 4 User Roles
| Role | Scope | Key Actions |
|------|-------|-------------|
| `admin` | Global | Manage tiers, products, all orgs, program analytics, create MDF allocations, record cert completions |
| `channel_manager` | Assigned orgs | Review deals/quotes/MDF, distribute leads, manage partner performance, view portfolio dashboards |
| `partner_admin` | Own org | Manage org users, submit deals, create quotes, request MDF, enroll users in courses |
| `partner_rep` | Own org (self) | Submit deals, work leads, create quotes, self-enroll in courses |

## Data Scoping Rule
- `partner_admin` / `partner_rep` → queries filtered by `WHERE organization_id = req.user.org_id`
- `channel_manager` → queries filtered by `WHERE organization_id IN (assigned_org_ids)`
- `admin` → no filter

## Key Business Logic
1. **Deal Conflict Detection** — 4-layer fuzzy matching (exact email > exact company > pg_trgm similarity > product+company overlap). Flags but doesn't block; CM decides.
2. **Tier Auto-Calculation** — Nightly at 2 AM. Compares org metrics (revenue, deals, certified reps) against tier requirements. Upgrades immediate; downgrades have 30-day grace period.
3. **Discount Approval** — Tier-aware with 3 bands: self-approve (within tier max), CM approval (+15%), VP/admin approval (above that). Product-specific overrides via tier_product_pricing.
4. **MDF Allocation** — Percentage of trailing 4-quarter revenue, capped by tier, 20% bonus for top-10% performers. Requests validated against remaining balance with row-level locking for concurrency.
5. **Lead Assignment** — 4-dimension scoring: tier priority, geographic match, industry expertise, current lead load. 48-hour SLA with auto-return.
6. **Dashboard Health Scores** — 6 weighted sub-metrics for partner health: revenue attainment, deal win rate, lead acceptance, SLA compliance, MDF utilization, cert coverage.
7. **Tier-Filtered Content** — Documents filtered by org tier rank. Returns 404 (not 403) for opaque denial.

## API Design
- Base URL: `/api/v1`
- Response envelope: `{ success, data, meta, errors }`
- 100+ endpoints across 16 route files
- Auth/business logic details in `docs/003-auth-and-business-logic.md`

### Route Modules
| Module | Base Path | Endpoints |
|--------|-----------|-----------|
| Auth | `/auth` | 8 (register, login, refresh, logout, me, forgot/reset password) |
| Users | `/users` | 6 |
| Organizations | `/organizations` | 11 |
| Tiers | `/tiers` | 5 |
| Products | `/products` | 10 |
| Deals | `/deals` | 15 |
| Quotes | `/quotes` | 13 |
| Leads | `/leads` | 11 |
| MDF | `/mdf` | 18 (allocations + requests + claims) |
| Courses | `/courses` | 7 |
| Certifications | `/certifications` | 4 |
| Documents | `/documents` | 9 |
| Notifications | `/notifications` | 5 |
| Dashboard | `/dashboard` | 3 (partner, CM, admin) |
| Analytics | `/analytics` | 4 (pipeline, performance, lead-conversion, mdf-roi) |
| Activity | `/activity` | 1 |

## Background Jobs (9 scheduled)
| Job | Schedule | Purpose |
|-----|----------|---------|
| metricsRollup | Daily midnight | Update denormalized org metrics |
| tierRecalculation | Daily 2 AM | Evaluate tier upgrades/downgrades |
| dealExpiration | Daily 6 AM | Expire deals past protection window |
| dealExpirationReminder | Daily 7 AM | 14/7-day expiry reminders |
| leadSlaCheck | Every 4 hours | Warn/auto-return SLA-breached leads |
| certExpiry | Daily 8 AM | 30/7/1-day cert expiry warnings |
| mdfClaimDeadline | Daily 9 AM | MDF claim deadline warnings |
| mdfQuarterlyAllocation | Quarterly | Auto-generate next quarter allocations |
| inactiveDealReminder | Monday 9 AM | Remind partners of stale deals |

## Testing
- 500+ tests across unit + integration suites
- Unit: all services (auth, deal, quote, lead, MDF, dashboard, course, document, notification) + all jobs
- Integration: full lifecycle tests for deals, quotes, leads, MDF, training, documents, dashboards + RBAC
- Run: `npm test` or `npm run test:unit` / `npm run test:integration`

## Coding Conventions
- Repository pattern: data access separated from business logic
- Thin controllers: parse request → call service → send response (use `sendSuccess` from `src/utils/response.ts`)
- Services contain all business logic and are unit-testable with mock repositories
- Validation at the middleware layer using Joi schemas
- Global error handler with custom AppError class and error codes
- Activity feed auto-logging via middleware for audit trail
- Express `req.params.id` requires `as string` cast for TypeScript strict mode
- Frontend uses TanStack Query with query key factories and 5-min stale time for dashboards
- PANW NextWave color theme via `panw-*` Tailwind classes (navy, blue, orange, teal)

## Known Deferred Items
- PDF generation for quotes (Puppeteer template → S3 upload)
- Dark/light mode toggle
- Email sending via SendGrid (notifications are DB-only currently)
- S3/MinIO file streaming for document uploads (metadata-only currently)
