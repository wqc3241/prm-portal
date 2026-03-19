# PRM Portal -- 5-Minute Demo Script

## Pre-Demo Setup

- Ensure the backend, frontend, PostgreSQL, and Redis are all running
- Seed data should be loaded (`npm run seed`)
- Open the app in a browser at `http://localhost:5173`
- Have two browser tabs ready (one for admin, one for partner)

---

## Act 1: Admin Overview (1 min)

**Login as Admin**
- Navigate to `/login`
- Credentials: `admin@panw.demo` / `Demo123!`

**Admin Dashboard**
- Point out the program-level metrics: total partners, pipeline value, revenue trends
- Show the tier distribution chart -- how partners are spread across Registered, Innovator, Platinum, Diamond
- Highlight the pending approvals count (deals, quotes, MDF requests awaiting review)
- Click into **Analytics** to show the full analytics page with revenue trends and partner performance

**Key talking points:**
- "This is the vendor's view -- the channel team sees the entire partner ecosystem at a glance"
- "Approvals are surfaced proactively so nothing falls through the cracks"

---

## Act 2: Partner Experience (1 min)

**Switch to Partner User**
- Open a new tab or log out
- Login as: `partner@acme.demo` / `Demo123!`

**Partner Dashboard**
- Show the personalized welcome with org name and tier badge in the header
- Walk through stat cards: pipeline value, active deals, open leads, MDF remaining
- Show tier progress bar -- "They can see exactly what they need to reach the next tier"
- Point out certifications section -- expiring certs with countdown
- Show recent activity feed

**Key talking points:**
- "Partners see only their own data -- scoped by organization"
- "The tier progress gamification drives partner investment in the program"

---

## Act 3: Deal Registration + Conflict Detection (1 min)

**Create a New Deal**
- Click **New Deal** from the quick actions
- Fill in:
  - Company: "Acme Corp" (or a name that will trigger a conflict)
  - Contact: customer email
  - Product: select from catalog
  - Estimated value: $150,000
  - Expected close: 90 days out
- Submit the deal

**Conflict Detection**
- If a conflict is detected, show the conflict panel:
  - "The system uses 4-layer fuzzy matching: exact email, exact company, trigram similarity, and product+company overlap"
  - "Conflicts are flagged but don't block submission -- the channel manager makes the final call"
- Show the deal detail page with status "Submitted"

**Key talking points:**
- "This prevents channel conflict -- the #1 pain point in partner programs"
- "The 4-layer approach catches conflicts that simple exact-match would miss"

---

## Act 4: CPQ Quoting with Pricing Waterfall (45 sec)

**Create a Quote**
- Navigate to **Quotes** > **New Quote**
- Associate with the deal just created (or an existing deal)
- Add line items from the product catalog
- Show the pricing waterfall:
  - List price > partner discount (tier-based) > deal-specific discount > final price
- Point out the discount approval logic:
  - Within tier max: auto-approved
  - Up to +15%: needs channel manager approval
  - Above that: needs VP/admin approval
- Save/submit the quote

**Key talking points:**
- "The pricing waterfall ensures consistency while giving partners flexibility"
- "Discount guardrails prevent margin erosion without creating bottlenecks"

---

## Act 5: Lead Distribution + SLA Tracking (30 sec)

**View Leads**
- Navigate to **Leads** page
- Show the lead list with status indicators (new, assigned, working, converted)
- Click into a lead to show:
  - Lead score and source
  - Assignment details and SLA timer
  - "Partners have X hours to accept, Y hours to make first contact"
- Show the accept/return workflow

**Key talking points:**
- "Leads are scored and distributed based on partner capability and geography"
- "SLA enforcement ensures leads don't go stale -- automatic reassignment if SLA is breached"

---

## Act 6: MDF Request + Approval Workflow (30 sec)

**Submit MDF Request**
- Navigate to **MDF** > **New Request**
- Fill in:
  - Activity type: "Event Sponsorship"
  - Description: "Regional partner summit"
  - Requested amount: $5,000
  - Expected outcomes
- Submit the request
- Show the MDF overview with allocation balance:
  - "Allocation is calculated as a percentage of trailing 4-quarter revenue"
  - "Top performers get a 20% bonus allocation"

**Approval Flow (switch to admin/CM if time permits)**
- Show the request in the approvals queue
- Approve/reject with comments

**Key talking points:**
- "MDF is the #2 most requested feature after deal reg in partner programs"
- "The allocation algorithm rewards performance -- partners who sell more, get more marketing funds"

---

## Act 7: Content Library + Tier-Filtered Access (15 sec)

**Browse Content Library**
- Navigate to **Library**
- Show documents organized by category
- Point out tier-based access control:
  - "Some content is only available to Platinum and Diamond partners"
  - "This incentivizes tier advancement"

---

## Act 8: Notifications (15 sec)

**Notification Bell**
- Click the notification bell in the header
- Show recent notifications:
  - Deal status changes
  - New lead assignments
  - MDF request updates
  - Certification expirations
- "All actions generate notifications so partners and channel managers stay in sync"

---

## Closing Summary

**Architecture Highlights:**
- Role-based access control with 4 distinct user experiences
- Organization-scoped data isolation
- Event-driven workflows (deal > approval > notification)
- Real-time conflict detection with fuzzy matching
- Tier-aware pricing and content gating

**Tech Stack:**
- React + TypeScript + Tailwind CSS (frontend)
- Express.js + PostgreSQL + Redis (backend)
- Bull queues for background jobs (tier calculation, SLA enforcement)
- JWT auth with refresh tokens

**What this demonstrates:**
- Deep understanding of partner ecosystem dynamics
- Ability to translate complex business rules into software
- Full-stack product thinking: from data model to UX
- Production-quality code patterns (repository pattern, service layer, RBAC)
