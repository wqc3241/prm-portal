# PRM Portal

A full-stack **Partner Relationship Management** platform — a functional prototype of Salesforce Experience Cloud (Partner Community), modeled after the Palo Alto Networks NextWave Partner Portal.

Built with **React + Express.js + TypeScript + PostgreSQL** to demonstrate partner-facing product management across deal registration, quoting, lead distribution, marketing funds, training, and analytics.

![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Tests](https://img.shields.io/badge/Tests-568_passing-brightgreen)

## Live Demo

| | URL |
|---|---|
| **Frontend** | [prm-portal.vercel.app](https://prm-portal.vercel.app) |
| **Backend API** | [prm-portal-production.up.railway.app](https://prm-portal-production.up.railway.app/api/v1/health) |

Login with any demo account below — all use password **`Demo123!`**. The login page has quick-login buttons for each role.

### Deployment Architecture

| Service | Platform | Details |
|---|---|---|
| **Frontend** | Vercel | React SPA with Vite, auto-deploys from `client/` directory |
| **Backend API** | Railway | Express.js in Docker, auto-deploys from GitHub |
| **PostgreSQL** | Railway | Managed PostgreSQL 16, 21 tables with pg_trgm extension |
| **Redis** | — | Optional (rate limiting + Bull queues disabled in production) |

---

## Features

| Module | Description |
|--------|-------------|
| **Deal Registration** | Submit, track, and approve deals with 4-layer fuzzy conflict detection |
| **CPQ (Quoting)** | Configure-Price-Quote engine with pricing waterfall and 3-band discount approvals |
| **Lead Distribution** | Scored lead assignment with geographic/industry matching and 48hr SLA enforcement |
| **MDF (Marketing Funds)** | Quarterly allocation, request/approval lifecycle, claims, and reimbursement |
| **Dashboards** | 3 role-specific dashboards with real-time charts (Recharts) |
| **Analytics** | Pipeline, partner performance, lead conversion, and MDF ROI analytics |
| **Training & Certs** | Course catalog, enrollment, certification tracking with expiry alerts |
| **Content Library** | Tier-filtered document library with folder management |
| **Notifications** | Real-time bell notifications with polling and activity feed |
| **Background Jobs** | 9 scheduled jobs: tier recalculation, deal expiry, SLA enforcement, and more |

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Headless UI, Recharts, TanStack Query, React Router v6 |
| **Backend** | Express.js, TypeScript, Knex.js, PostgreSQL, JWT + bcrypt, Joi validation |
| **Jobs** | Bull (Redis-backed queues), node-cron (9 scheduled jobs) |
| **Storage** | MinIO (S3-compatible) |
| **DevOps** | Docker Compose, multi-stage Dockerfile |
| **Testing** | Jest, Supertest — 568 tests (unit + integration) |

## Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose

### Option 1: Live Demo (no setup needed)

Visit **[prm-portal.vercel.app](https://prm-portal.vercel.app)** and use any demo account listed below.

### Option 2: Local Development

```bash
# 1. Start infrastructure
docker compose up -d postgres redis

# 2. Configure environment
cp .env.example .env
# Edit .env if needed (defaults work with Docker services)

# 3. Install, migrate, seed
npm run setup

# 4. Start the API server
npm run dev

# 5. In another terminal, start the frontend
cd client && npm install && npm run dev
```

Open **http://localhost:5173** in your browser.

### Option 3: Full Docker

```bash
cp .env.example .env
docker compose up -d
```

Open **http://localhost:3000** in your browser.

## Demo Accounts

All accounts use password: **`Demo123!`**

The login page includes **quick-login buttons** — click any role to auto-fill credentials.

| Role | Email | Organization |
|------|-------|-------------|
| System Admin | `admin@prmportal.com` | — (global access) |
| Channel Manager | `sarah.chen@prmportal.com` | — (manages CyberShield + CloudGuard) |
| Channel Manager | `marcus.johnson@prmportal.com` | — (manages NetSecure + TechDefend) |
| Partner Admin | `admin@cybershield.com` | CyberShield Solutions (Diamond tier) |
| Partner Admin | `admin@cloudguard.io` | CloudGuard Inc (Platinum tier) |
| Partner Admin | `admin@netsecure.net` | NetSecure Partners (Innovator tier) |
| Partner Admin | `admin@techdefend.com` | TechDefend LLC (Registered tier) |
| Partner Rep | `rep@cybershield.com` | CyberShield Solutions |
| Partner Rep | `rep@cloudguard.io` | CloudGuard Inc |
| Partner Rep | `rep@netsecure.net` | NetSecure Partners |
| Partner Rep | `rep@techdefend.com` | TechDefend LLC |

## Architecture

```
                          ┌─────────────────┐
                          │   React SPA      │
                          │  (Vite + TS)     │
                          └────────┬─────────┘
                                   │ /api/v1
                          ┌────────▼─────────┐
                          │  Express.js API   │
                          │  (TypeScript)     │
                          └──┬────┬────┬─────┘
                             │    │    │
                  ┌──────────┘    │    └──────────┐
                  ▼               ▼               ▼
          ┌──────────────┐ ┌──────────┐  ┌──────────────┐
          │  PostgreSQL   │ │  Redis   │  │    MinIO      │
          │  (21 tables)  │ │ (cache/  │  │  (S3-compat   │
          │              │ │  queues) │  │   storage)    │
          └──────────────┘ └────┬─────┘  └──────────────┘
                                │
                          ┌─────▼─────────┐
                          │  Bull Workers   │
                          │  + node-cron    │
                          │  (9 jobs)       │
                          └─────────────────┘
```

## 4 User Roles

| Role | Scope | What They Can Do |
|------|-------|-----------------|
| `admin` | Global | Manage tiers, products, all orgs, view program analytics, create MDF allocations |
| `channel_manager` | Assigned orgs | Approve deals/quotes/MDF, distribute leads, view partner scorecards |
| `partner_admin` | Own org | Submit deals, create quotes, request MDF, enroll users in courses, manage org |
| `partner_rep` | Own org (self) | Submit deals, work leads, create quotes, self-enroll in courses |

Data is automatically scoped per role — partners only see their own org's data, channel managers see their assigned partners, admins see everything.

## Key Business Logic

### Deal Conflict Detection
4-layer fuzzy matching: exact email match → exact company match → PostgreSQL `pg_trgm` similarity → product + company overlap. Conflicts flag deals for CM review but don't block submission.

### Pricing Waterfall (CPQ)
List price → volume discount → tier discount (from `tier_product_pricing`) → partner discount. Three approval bands: auto-approve (within tier max), CM approval (+15%), admin approval (above that).

### Tier Auto-Calculation
Nightly job compares org metrics (YTD revenue, deal count, certified reps) against tier requirements. Upgrades are immediate; downgrades have a 30-day grace period.

### MDF Allocation
Quarterly budget = tier percentage × trailing 4-quarter revenue, capped by tier limit, with 20% bonus for top-10% performers. Requests validated against remaining balance with row-level locking for concurrency.

### Lead Assignment
4-dimension scoring: tier priority, geographic match, industry expertise, and current lead load (fairness). 48-hour SLA with automatic return to pool on breach.

## API Overview

100+ endpoints across 16 route modules. All responses use a standard envelope:

```json
{
  "success": true,
  "data": { ... },
  "meta": { "page": 1, "per_page": 25, "total": 142 },
  "errors": null
}
```

| Module | Base Path | Endpoints |
|--------|-----------|-----------|
| Auth | `/api/v1/auth` | 8 |
| Users | `/api/v1/users` | 6 |
| Organizations | `/api/v1/organizations` | 11 |
| Tiers | `/api/v1/tiers` | 5 |
| Products | `/api/v1/products` | 10 |
| Deals | `/api/v1/deals` | 15 |
| Quotes | `/api/v1/quotes` | 13 |
| Leads | `/api/v1/leads` | 11 |
| MDF | `/api/v1/mdf` | 18 |
| Courses | `/api/v1/courses` | 7 |
| Certifications | `/api/v1/certifications` | 4 |
| Documents | `/api/v1/documents` | 9 |
| Notifications | `/api/v1/notifications` | 5 |
| Dashboard | `/api/v1/dashboard` | 3 |
| Analytics | `/api/v1/analytics` | 4 |
| Activity | `/api/v1/activity` | 1 |

## Background Jobs

| Job | Schedule | Purpose |
|-----|----------|---------|
| Metrics Rollup | Daily midnight | Update denormalized org metrics |
| Tier Recalculation | Daily 2 AM | Evaluate tier upgrades/downgrades with grace period |
| Deal Expiration | Daily 6 AM | Expire deals past 90-day protection window |
| Expiry Reminders | Daily 7 AM | Send 14-day and 7-day deal expiry reminders |
| Lead SLA Check | Every 4 hours | Warn and auto-return SLA-breached leads |
| Cert Expiry | Daily 8 AM | Send 30/7/1-day certification expiry warnings |
| MDF Claim Deadline | Daily 9 AM | Warn of approaching 60-day claim deadlines |
| MDF Auto-Allocate | Quarterly | Generate next quarter MDF allocations |
| Inactive Deal Reminder | Monday 9 AM | Nudge partners about stale deals (14+ days) |

## Testing

```bash
# Run all tests
npm test

# Unit tests only (568 tests, ~8s)
npm run test:unit

# Integration tests (requires running PostgreSQL)
npm run test:integration
```

Coverage includes:
- All services (auth, deal, quote, lead, MDF, dashboard, course, document, notification)
- All background jobs (deal expiration, tier recalculation, metrics rollup, inactive deal reminder)
- Full lifecycle integration tests for every module
- RBAC enforcement (cross-org data isolation)

## Database

21 tables across PostgreSQL 16 with extensions:
- `uuid-ossp` — UUID primary keys
- `pgcrypto` — secure hashing
- `pg_trgm` — trigram fuzzy matching for deal conflict detection

Key design features:
- Sequence-based human-readable IDs (`DR-2026-00001`, `QT-2026-00001`)
- Generated columns for computed totals
- Status history tables for full audit trail
- Activity feed auto-logging via middleware

## Project Structure

```
prm-portal/
├── src/
│   ├── config/           # Database, Redis, auth, business constants
│   ├── middleware/        # Auth, RBAC, org scoping, rate limiting, validation, error handling
│   ├── routes/           # 16 route modules
│   ├── controllers/      # Thin request handlers
│   ├── services/         # All business logic
│   ├── repositories/     # Data access layer (Knex queries)
│   ├── jobs/             # Bull queue factory, scheduler, 9 job processors
│   ├── utils/            # AppError, pagination, filters, response helpers
│   └── validators/       # Joi schemas per entity
├── client/
│   └── src/
│       ├── api/          # 10 Axios API clients
│       ├── components/   # Layout, shared, charts, notifications
│       ├── contexts/     # AuthContext
│       ├── hooks/        # TanStack Query hooks
│       ├── pages/        # All page components
│       └── types/        # TypeScript interfaces
├── migrations/           # 19 Knex migrations
├── seeds/                # Base seed + demo data (35 deals, 18 quotes, 28 leads...)
├── tests/                # Unit + integration test suites
├── docs/                 # Schema, API design, PRDs, demo script
├── docker-compose.yml    # PostgreSQL + Redis + MinIO + API
└── Dockerfile            # Multi-stage production build
```

## Scripts

```bash
npm run dev              # Start API server with ts-node
npm run build            # Compile TypeScript
npm run start            # Start production server
npm run migrate          # Run database migrations
npm run seed             # Run seed files
npm run seed:demo        # Run demo data seed only
npm run setup            # Full setup: install + migrate + seed + demo
npm test                 # Run all tests
npm run test:unit        # Run unit tests only
npm run test:integration # Run integration tests only
npm run docker:up        # Start Docker Compose
npm run docker:down      # Stop Docker Compose
```

## Deployment

### Frontend (Vercel)

The React SPA deploys from the `client/` directory on Vercel:
- **Root Directory:** `client`
- **Framework:** Vite
- **Build Command:** `npm run build`
- **Environment Variable:** `VITE_API_URL=https://prm-portal-production.up.railway.app`

### Backend (Railway)

The Express API deploys via Docker from the project root:
- **Dockerfile:** Multi-stage build (builder + production)
- **Startup:** Runs migrations, seeds demo data, then starts the server
- **Environment Variables:** `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGIN`

## License

This project is a portfolio demonstration piece and is not licensed for production use.
