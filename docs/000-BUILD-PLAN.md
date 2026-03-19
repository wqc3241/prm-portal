# PRM Portal — End-to-End Build Plan

## What You're Building

A **functional mimic of Salesforce Experience Cloud (Partner Community)** — the same platform Palo Alto Networks uses for its NextWave Partner Portal. This React + Node.js prototype covers all major PRM modules so you can deeply understand the product before your interview.

---

## Platform Overview (What Salesforce Partner Community Actually Is)

Salesforce Partner Community (now "Experience Cloud with PRM") is an **external-facing portal** that sits on top of Salesforce CRM, giving channel partners (resellers, distributors, MSSPs) a self-service interface to:

1. **Register deals** — Claim customer opportunities for deal protection (90-day exclusivity window)
2. **Configure & quote products** — Browse product catalog, apply tier-based pricing, get discount approvals, generate PDFs
3. **Receive & work leads** — Accept vendor-distributed leads with SLA enforcement
4. **Request marketing funds (MDF)** — Submit activity proposals, get pre-approval, claim reimbursement with proof of execution
5. **Track performance** — Pipeline dashboards, revenue vs target gauges, tier progress, certification status
6. **Access enablement** — Training courses, certifications, content library, battle cards

**PANW's portal** lives at `paloaltonetworks.my.site.com/NextWavePartnerProgram/` and supports their 4-tier NextWave program (Registered → Innovator → Platinum Innovator → Diamond Innovator) with specializations in Strata, Prisma SASE, Prisma Cloud, and Cortex.

---

## Architecture Summary

```
React SPA (Vite) ←→ Express.js API ←→ PostgreSQL
                          ↕                ↕
                     Redis (cache/queues)  S3/MinIO (files)
                          ↕
                     Bull Workers (background jobs)
```

**4 user roles**: `admin` | `channel_manager` | `partner_admin` | `partner_rep`
**18 database tables** | **100+ API endpoints** | **14 modules**

Full schema, API design, auth model, and architecture diagrams already generated in `docs/`.

---

## Build Phases

### Phase 1: Foundation (Days 1-2)

**Goal:** Running API with auth, database, and basic CRUD

#### 1.1 Project Setup
```bash
# Backend
mkdir -p prm-portal/{src/{config,middleware,routes,controllers,services,repositories,jobs,utils,validators},migrations,seeds,tests}
cd prm-portal
npm init -y
npm install express pg knex bcryptjs jsonwebtoken cors helmet morgan dotenv joi bull ioredis
npm install -D nodemon jest supertest
```

```bash
# Frontend (separate directory)
npm create vite@latest client -- --template react-ts
cd client
npm install react-router-dom @tanstack/react-query axios recharts lucide-react tailwindcss @headlessui/react
```

#### 1.2 Database Setup
- Run `001-schema.sql` to create all 18 tables, enums, indexes, triggers
- Create seed data: 4 tiers, 20 sample products, 5 partner orgs, demo users

#### 1.3 Auth Module
- POST `/auth/register` — Partner self-registration (creates org + admin user)
- POST `/auth/login` — JWT access token (1hr) + refresh token (30d)
- Middleware: `authenticate.js` (JWT verify), `authorize.js` (role check), `scopeToOrg.js` (partner data isolation)

#### 1.4 Core CRUD
- Organizations, Users, Products, Tiers — basic list/get/create/update
- Standard response envelope: `{ success, data, meta, errors }`

**Deliverable:** Users can register a partner org, log in, see their org profile, browse products.

---

### Phase 2: Deal Registration (Days 3-4)

**Goal:** Complete deal lifecycle with conflict detection and approval workflows

This is the **#1 most important module** — it's what partners interact with daily and what PANW channel managers spend most time reviewing.

#### 2.1 Deal Submission Form
Fields: Customer company, contact name/email, estimated value, expected close date, products of interest, competitive situation, notes.

Auto-generated deal number: `DR-2026-00001`

#### 2.2 Conflict Detection Engine
The `find_deal_conflicts()` function checks 4 layers:
1. **Exact email match** — Same customer contact email in another active deal
2. **Exact company match** — Same customer company name
3. **Fuzzy company match** — pg_trgm similarity > 0.4 (catches "Acme Corp" vs "Acme Corporation")
4. **Product + fuzzy company** — Same product category + similarity > 0.3

Returns conflicts with confidence scores. Flags but doesn't block — channel manager decides.

#### 2.3 Approval Workflow
```
Draft → Submitted → Under Review → Approved/Rejected
                                        ↓
                                  Won / Lost / Expired
```

- Partner submits → Channel manager gets notification
- CM reviews conflicts, approves/rejects with comments
- On approval: protection window starts (90 days), partner notified
- On rejection: reason provided, partner can revise and resubmit

#### 2.4 Deal Protection & Expiration
- Background job (`dealExpiration.job.js`) runs daily
- Sends reminders at 14 days and 7 days before expiration
- Auto-expires deals past the window
- Partners can request extensions (re-enters approval flow)

#### 2.5 Status History Audit Trail
Every status change logged in `deal_status_history` with actor, timestamp, and comments.

**Deliverable:** Partner can register a deal, see conflict warnings, track approval status. CM can review/approve/reject.

---

### Phase 3: CPQ — Configure, Price, Quote (Days 5-7)

**Goal:** Product configuration, tier-based pricing, discount approvals, PDF generation

This is the most technically complex module and directly relevant to the PANW role (the JD mentions CPQ experience).

#### 3.1 Product Catalog
- Products organized by category (Hardware Firewall, Software Firewall, SASE, Cloud Security, SOC, Services)
- Product types: hardware, software, subscription, bundle
- Bundles have child products with required/optional flags

#### 3.2 Quote Builder UI
Partner creates a quote (optionally linked to a deal registration):
1. **Browse/search products** → Add to quote
2. **Configure quantities** and terms (subscription months)
3. **System auto-calculates pricing** using the price waterfall:

```
List Price
  → Volume Discount (quantity-based tiers from discount schedule)
    → Partner Tier Discount (looked up from tier_product_pricing)
      → Additional Discount (manual, entered by partner)
        = Net Price (to customer)
```

4. **Discount validation**: If additional discount exceeds tier's `max_discount_pct`:
   - Within CM range (+15%) → Routes to Channel Manager
   - Above CM range → Routes to Admin/VP

#### 3.3 Quote Approval Flow
```
Draft → Pending Approval → Approved/Rejected → Sent → Accepted
```

- Auto-approved if all discounts within self-approve threshold
- CM/Admin approve via "Pending Approvals" queue

#### 3.4 PDF Generation
- Puppeteer renders a branded quote template → PDF
- Includes: partner logo, line items, pricing, terms, validity period
- Partner can download or "send to customer" (email integration)

**Deliverable:** Partner can build a multi-product quote, see tier-adjusted pricing, submit for approval, generate PDF.

---

### Phase 4: Lead Distribution (Days 8-9)

**Goal:** Leads assigned to partners with SLA tracking and accept/return workflow

#### 4.1 Lead Creation & Scoring
- Internal users (CM/Admin) create leads with score (0-100)
- Fields: company, contact, source, product interest, score, geography, industry

#### 4.2 Assignment Logic
Leads assigned based on:
- Partner tier (higher tier = priority)
- Geographic match
- Industry expertise
- Current lead load (fairness balancing)

#### 4.3 Accept/Return Flow
```
New → Assigned → Accepted / Returned
                    ↓
              Working → Converted (creates Deal) / Disqualified
```

- Partner has 48-hour SLA to accept/return
- Background job (`leadSlaCheck.job.js`) auto-reassigns on SLA breach
- Returning a lead requires a reason (picklist)

#### 4.4 Lead-to-Deal Conversion
Partner clicks "Convert to Deal" → Pre-populates deal registration form with lead data.

**Deliverable:** CM can distribute leads, partner accepts/returns, SLA tracked, converts to deal.

---

### Phase 5: MDF (Market Development Funds) (Days 10-11)

**Goal:** Fund allocation, request/approval, claim/reimbursement lifecycle

#### 5.1 Fund Allocation
- Admin creates quarterly MDF budgets per partner
- Allocation amount tied to partner tier:
  - Diamond: 40% of budget pool
  - Platinum: 30%
  - Gold: 20%
  - Silver: 10%

Partner dashboard shows: Total Allocated | Requested | Claimed | Reimbursed | Remaining

#### 5.2 Fund Request
Partner submits request with:
- Activity type (Event, Digital Campaign, Content, Trade Show, Webinar, Training)
- Requested amount (validated against remaining allocation)
- Activity dates, description, expected outcomes
- Status: Draft → Submitted → Approved/Rejected → In Progress → Completed

#### 5.3 Claim & Reimbursement
After activity completion:
1. Partner submits claim with proof of execution (file uploads to S3/MinIO)
2. CM reviews proof, approves/rejects claim
3. On approval: marked as reimbursed, allocation balance updated

**Deliverable:** Full MDF lifecycle from allocation through reimbursement.

---

### Phase 6: Dashboards & Analytics (Days 12-13)

**Goal:** Role-specific dashboards with charts and KPIs

#### 6.1 Partner Dashboard (Home Page)
```
┌──────────────────────────────────────────────┐
│  Welcome, [Partner Name] — [Tier Badge]      │
├──────────────────────────────────────────────┤
│  Quick Actions:                              │
│  [Register Deal] [Create Quote] [View Leads] │
│  [Request MDF]   [Browse Library]            │
├──────────────┬───────────────────────────────┤
│  Pipeline    │  Revenue vs Target            │
│  Summary     │  (gauge chart)                │
│  (bar chart) │                               │
├──────────────┼───────────────────────────────┤
│  Recent      │  My Open Leads                │
│  Deal Regs   │  (with SLA indicators)        │
├──────────────┼───────────────────────────────┤
│  MDF Balance │  Certification Progress       │
│  (donut)     │  (progress bars)              │
├──────────────┴───────────────────────────────┤
│  Tier Progress: [═══════════░░░] 72%         │
│  Next tier: Platinum (need $180K more rev)   │
└──────────────────────────────────────────────┘
```

#### 6.2 Channel Manager Dashboard
- Portfolio overview: all assigned partners with health scores
- Pending approvals queue (deals + quotes + MDF)
- Partner performance scorecards
- Lead distribution metrics (acceptance rate, conversion rate, SLA compliance)

#### 6.3 Admin Dashboard
- Program-wide metrics: total pipeline, revenue by tier, active partners
- Tier distribution chart
- MDF utilization across program
- Certification coverage heatmap

#### 6.4 Chart Library
Use **Recharts** for:
- Bar charts (pipeline by stage)
- Gauge/radial charts (revenue vs target)
- Donut charts (deal status distribution, MDF balance)
- Line charts (revenue trend)
- Progress bars (tier advancement, certifications)

**Deliverable:** Three role-specific dashboards with live data visualizations.

---

### Phase 7: Training, Content & Notifications (Days 14-15)

**Goal:** Complete the supporting modules

#### 7.1 Training & Certifications
- Course catalog (browse, filter by product area)
- Enrollment tracking (enrolled → in progress → completed)
- Certification records with expiration dates
- Background job sends alerts 30 days before cert expiry
- Org-level certification summary (feeds into tier calculation)

#### 7.2 Content Library / Knowledge Base
- Folder-based document management
- Tier-restricted visibility (Diamond partners see more resources)
- File types: PDF, PPTX, battle cards, data sheets, logos
- Download counter for analytics
- Search within documents

#### 7.3 Notification System
- In-app bell notifications (real-time via polling or WebSocket)
- Types: deal status changes, lead assignments, approval requests, MDF updates, cert expiry warnings
- Mark read/unread, mark all read
- Email notifications (SendGrid/SES integration)

**Deliverable:** Partners can browse training, access tier-appropriate content, receive real-time notifications.

---

### Phase 8: Polish & Interview Prep (Days 16-17)

**Goal:** Make it demo-ready and prepare talking points

#### 8.1 UI Polish
- Consistent design system (Tailwind + Headless UI)
- Responsive layout (works on tablet for demo flexibility)
- Loading states, error states, empty states
- Toast notifications for actions
- Dark/light mode toggle

#### 8.2 Seed Data That Tells a Story
Create realistic demo data mimicking PANW's world:
- **Tiers**: Registered, Innovator, Platinum Innovator, Diamond Innovator
- **Products**: PA-Series Firewalls, Prisma Access, Prisma Cloud, Cortex XDR, Cortex XSOAR
- **Partners**: "CyberShield Solutions" (Diamond), "CloudGuard Inc" (Platinum), "NetSecure Partners" (Innovator), "TechDefend LLC" (Registered)
- **Deals**: Mix of approved/pending/expired/won across partners
- **Specializations**: Strata, Prisma SASE, Prisma Cloud, Cortex

#### 8.3 Demo Script
Prepare a 5-minute walkthrough:
1. Log in as **partner rep** → see dashboard with pipeline and tier progress
2. Register a deal → show conflict detection → submit for approval
3. Switch to **channel manager** → review deal → approve → show notification
4. Back to partner → create quote from approved deal → show pricing waterfall → generate PDF
5. Show MDF request → approval → claim flow
6. Show admin dashboard → program-wide metrics

---

## Frontend Page Map

```
/login                          — Login page
/register                       — Partner self-registration
/                               — Dashboard (role-specific)
/deals                          — Deal list (filterable)
/deals/new                      — Deal registration form
/deals/:id                      — Deal detail (with conflict panel, history)
/quotes                         — Quote list
/quotes/new                     — Quote builder (product selector + line editor)
/quotes/:id                     — Quote detail (with approval status)
/quotes/:id/pdf                 — Quote PDF preview
/leads                          — Lead list (with SLA indicators)
/leads/:id                      — Lead detail (accept/return actions)
/mdf                            — MDF allocations overview
/mdf/requests                   — MDF request list
/mdf/requests/new               — MDF request form
/mdf/requests/:id               — MDF request detail (claim submission)
/products                       — Product catalog (browse/search)
/training                       — Course catalog
/training/:id                   — Course detail
/certifications                 — My certifications
/library                        — Content library (folder browser)
/notifications                  — All notifications
/settings                       — Org settings (partner_admin)
/admin/partners                 — Partner list (admin/CM)
/admin/partners/:id             — Partner detail + scorecard
/admin/approvals                — Pending approvals queue
/admin/tiers                    — Tier management
/admin/analytics                — Analytics dashboards
```

---

## Tech Stack Summary

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React 18 + TypeScript + Vite | Fast dev, easy to explain in interview |
| Styling | Tailwind CSS + Headless UI | Rapid UI development, professional look |
| State/Data | TanStack Query (React Query) | Server state management, caching |
| Charts | Recharts | React-native charting, easy to customize |
| Routing | React Router v6 | Standard, role-based route guards |
| Backend | Express.js + TypeScript | Simple, well-understood, easy to extend |
| Database | PostgreSQL + Knex.js | Relational data model, migrations |
| Auth | JWT (access + refresh tokens) | Stateless, standard pattern |
| Cache/Queue | Redis + Bull | Background jobs, rate limiting |
| File Storage | MinIO (S3-compatible) | Local dev, S3 in prod |
| PDF Gen | Puppeteer | Quote PDF generation |
| Email | Nodemailer (dev) / SendGrid (prod) | Notification delivery |

---

## What This Teaches You for the Interview

| Module | Interview Knowledge |
|--------|-------------------|
| Deal Registration | How PANW partners register deals, conflict resolution, deal protection periods |
| CPQ | How partners configure and price complex security products, discount approval chains |
| Lead Distribution | How PANW distributes leads to partners, SLA enforcement, conversion tracking |
| MDF | How co-marketing funds flow from vendor to partner with accountability |
| Tier System | How NextWave tiers (Registered → Diamond) drive benefits, pricing, and access |
| Dashboards | What metrics matter: pipeline, revenue attainment, lead conversion, MDF ROI |
| Content Library | How enablement materials are distributed by tier |
| Approval Workflows | The cross-functional process involving Channel Ops, Finance, Sales, Legal |

### Key Talking Points for Your Interview

1. **"I built a prototype to understand the platform deeply"** — Shows initiative and the "vibe coding" skill they want
2. **Platformization complexity** — As PANW bundles Strata + Prisma + Cortex, CPQ must handle multi-product platform deals
3. **Partner experience friction** — Quote-to-order, deal registration approval latency, MDF claim complexity
4. **Data-driven tier management** — Automated tier evaluation vs manual, grace periods, specialization tracking
5. **API-first for distributors** — Marketplace integrations (AWS/Azure/GCP) need API-driven quoting and ordering
6. **AI opportunities** — Deal scoring, conflict prediction, quote optimization, intelligent lead routing
