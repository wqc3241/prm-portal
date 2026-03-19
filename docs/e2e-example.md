# End-to-End Example: A Real Deal Through the Partner Portal

## The Cast

| Person | Role | Company |
|---|---|---|
| **James Park** | Senior Account Executive | CyberShield Solutions (Diamond partner) |
| **Sarah Chen** | Channel Manager | Palo Alto Networks (PANW internal) |
| **Lisa Huang** | CISO | Meridian Healthcare (the end customer) |
| **Marcus Webb** | AE at CloudGuard Inc | CloudGuard Inc (competing Platinum partner) |

---

## The Story

### Background

CyberShield Solutions is a managed security services company based in Dallas. They've been a PANW partner for 6 years and recently hit Diamond tier — their top 3 engineers all hold PCNSE certifications, and they closed $4.2M in PANW business last year.

James Park, their senior AE, has been building a relationship with Lisa Huang at Meridian Healthcare for 8 months. Meridian is a 12-hospital system in Texas that just had a ransomware scare and got board approval to overhaul their security stack. Lisa has a $1.8M budget and a mandate to modernize.

---

## Phase 1: PANW Passes a Lead

**What happened at PANW:** Lisa Huang attended a PANW-sponsored webinar on healthcare ransomware defense. She filled out a "request a consultation" form on paloaltonetworks.com. PANW's marketing automation scored her as a high-intent MQL (job title = CISO, company size = 5,000+ employees, healthcare vertical, clicked pricing page).

**In the portal — Lead Distribution:**

Sarah Chen, the Channel Manager, gets the MQL in her queue. She runs the lead assignment algorithm:

- CyberShield (Diamond) scores highest — tier priority + they have a healthcare specialization tag + they're in Texas (geographic match) + their current lead load is low
- CloudGuard (Platinum) scores second — also Texas-based but no healthcare vertical tag

Sarah assigns the lead to CyberShield.

**James Park gets a notification:** "New lead assigned: Lisa Huang, CISO, Meridian Healthcare — 48hr SLA to accept."

James recognizes the name immediately — he's been working this account independently. He accepts the lead in the portal within 2 hours.

> **Portal feature used:** Lead assignment scoring (tier + geography + industry + load), SLA timer, notification

---

## Phase 2: James Registers the Deal

James has his first call with Lisa. It goes well — she wants to evaluate Prisma Cloud for their Azure workloads and Cortex XDR for 8,000 endpoints. Estimated value: $620,000 first year, $1.8M over 3 years.

Before he goes any further, James logs into the partner portal and registers the deal.

**He fills in:**
- Customer company: Meridian Healthcare System
- Customer contact: lisa.huang@meridianhealth.org
- Product interest: Prisma Cloud + Cortex XDR
- Estimated value: $620,000
- Expected close: 90 days

**The conflict detection runs:**

The system checks:
1. Exact email match — no existing deals for `lisa.huang@meridianhealth.org` ✓
2. Exact company match — no deals for "Meridian Healthcare System" ✓
3. Trigram similarity — "Meridian Health" scores 0.71 similarity to "Meridian Healthcare System" → flags a potential match against an older expired deal from 2023 → CM review triggered
4. Product + company overlap check — no active conflicts

Sarah Chen sees the flag in her approvals queue. She checks the 2023 deal — it was a different contact at Meridian, expired, and a different product (hardware only). She clears the conflict and approves the registration.

James gets a notification: "Deal DR-2026-00847 approved. You have 90-day protection."

> **What protection means:** If CloudGuard's Marcus Webb also starts pitching Meridian next week and tries to register the same deal, the system will detect the conflict and notify Sarah. PANW's policy: first registered, first protected. Marcus gets told to back off unless he can prove he was there first.

> **Portal features used:** Deal registration form, 4-layer conflict detection (pg_trgm), CM approval workflow, deal protection window

---

## Phase 3: Building the Quote (CPQ)

Lisa's IT team runs a 3-week evaluation. CyberShield's engineers do a proof-of-concept. Lisa comes back ready to buy — but her CFO wants to see a formal quote by Friday.

James opens the portal and creates a new quote tied to deal DR-2026-00847.

**He builds the line items:**

| Product | Qty | List Price | Tier Discount (Diamond) | Unit Price |
|---|---|---|---|---|
| Prisma Cloud Enterprise (per workload) | 2,400 workloads | $42/workload | 28% | $30.24 |
| Cortex XDR Pro (per endpoint/year) | 8,000 endpoints | $50/endpoint | 28% | $36.00 |
| Professional Services (implementation) | 80 hours | $300/hr | 0% | $300.00 |

**Subtotal after tier discount:** $385,920

Lisa's procurement team pushes back — they have a competing quote from a Microsoft-native solution and want $340,000. James requests an additional 12% deal-specific discount.

**Discount approval logic kicks in:**
- Diamond tier max discount: 28% (already applied)
- James is requesting 28% + 12% = 40% total
- 40% is within Diamond tier max (28%) + 15% CM band = 43% → **requires Sarah Chen's approval**

James submits the quote for approval. Sarah gets a notification: "Quote QT-2026-00412 pending approval — 40% total discount requested."

Sarah reviews: $340K deal at 40% discount is still above the floor for this product. She approves with a note: "Approved given competitive displacement — Microsoft. Do not go below $330K."

James sends the quote PDF to Lisa.

> **Portal features used:** CPQ line item builder, pricing waterfall (list → tier → deal), 3-band discount approval, CM approval workflow

---

## Phase 4: Deal Closes — Tier Progress Updates

Meridian signs. $342,000 Year 1 (James negotiated up slightly from $340K).

**What happens automatically in the portal:**

The deal status moves to `closed_won`. The nightly metrics rollup job runs at midnight:

- CyberShield's `ytd_revenue` increases by $342,000
- Their `active_deals_count` decrements by 1 (deal closed)
- The tier recalculation job runs at 2 AM — CyberShield is now at $4.54M YTD, well above Diamond threshold ($3M+). Tier confirmed, no change.

Next morning, James logs into his partner dashboard and sees:
- Pipeline value updated
- The Meridian deal showing as `closed_won` in his deal list
- Tier progress bar: $4.54M / $3M minimum — comfortably Diamond

> **Portal features used:** Deal status lifecycle, nightly metrics rollup job, tier recalculation job, partner dashboard stat cards

---

## Phase 5: CyberShield Requests MDF

CyberShield wants to run a "Healthcare Cybersecurity Summit" in Dallas — invite 40 CISOs from Texas hospitals, have a PANW speaker, generate pipeline. Estimated cost: $18,000.

**How MDF allocation works:**

CyberShield's quarterly MDF allocation was calculated at the start of Q2:
- Trailing 4-quarter revenue: $4.2M
- Diamond tier MDF %: 2.5% of trailing revenue
- Allocation: $105,000 for the year → $26,250 per quarter
- Top performer bonus: CyberShield was in the top 10% last quarter → +20% bonus → $31,500 Q2 allocation
- Already spent: $8,400 on a previous webinar
- Remaining balance: $23,100

The $18,000 request is within balance — James submits it:
- Activity type: Event Sponsorship
- Description: Healthcare Cybersecurity Summit, Dallas, June 12
- Requested amount: $18,000
- Expected outcomes: 40 attendees, 8 opportunities, $500K pipeline

Sarah Chen sees it in her approvals queue. She approves it with one edit: "Please add PANW logo to all event materials and submit attendee list post-event for claim processing."

After the event, CyberShield submits the claim with invoices. Sarah approves the reimbursement.

> **Portal features used:** MDF allocation formula (trailing revenue × tier %), remaining balance check, request/approval workflow, claims submission

---

## Phase 6: The Competing Partner Scenario

Two weeks after James closes Meridian, Marcus Webb at CloudGuard (Platinum tier) gets a cold inbound from Meridian's IT Director — a different department wants to evaluate PANW firewalls for their data center.

Marcus registers the deal: "Meridian Healthcare System, firewall refresh, $180,000."

**Conflict detection runs:**
1. Email: different contact — no exact match ✓
2. Company: "Meridian Healthcare System" — **exact match** against DR-2026-00847 (James's closed deal)
3. System flags the conflict: "Active/recently closed deal exists for this organization"

Sarah gets a notification. She reviews:
- James's deal was Prisma Cloud + Cortex XDR — cloud and endpoint
- Marcus's deal is firewall hardware — different product, different internal buyer

Sarah makes a judgment call: **different product line, different stakeholder** — she approves both, but adds a co-sell note: "Coordinate with CyberShield — they have the CISO relationship. Do not undercut on services."

She notifies both James and Marcus of the co-sell arrangement.

> **This is the real CM job:** Not just approving/rejecting, but managing partner relationships and account strategy. The portal surfaces the conflict; the human makes the call.

> **Portal features used:** Conflict detection on existing org, CM review workflow, co-sell coordination

---

## Phase 7: Cert Expiry and Tier Risk

It's now September. CyberShield's lead PCNSE-certified engineer, David, just gave his 2-week notice. He's leaving.

The cert expiry job runs its daily check:

- David's PCNSE certification: expires December 1 (still valid)
- But when David leaves in 2 weeks, CyberShield drops from 3 certified engineers to 2
- Diamond tier requires: 3+ PCNSE-certified active employees

The system detects this during the nightly tier recalculation: **CyberShield no longer meets Diamond cert requirements.**

Instead of immediately downgrading them:
- A 30-day grace period begins
- `tier_downgrade_grace_at` = October 15 (today + 30 days)
- Admin at CyberShield (`admin@cybershield.com`) gets a notification: "Tier risk: Diamond certification requirement not met. You have 30 days to certify an additional engineer before tier downgrade."

CyberShield enrolls their junior engineer Karen in the PCNSE course through the training portal. Karen passes on October 10 — 5 days before the grace deadline. Sarah Chen records the certification completion in the admin panel.

The next nightly tier check: CyberShield is back to 3 certified engineers. Grace period cleared. Diamond maintained.

> **Portal features used:** Cert expiry job, tier recalculation with grace period, training enrollment, admin cert recording, notification system

---

## The Full Flow, Visualized

```
PANW Marketing generates MQL (webinar signup)
          ↓
[Lead Distribution] Sarah assigns lead to CyberShield (scoring: tier + geo + industry)
          ↓
[Notifications] James gets 48hr SLA alert → accepts lead
          ↓
James discovers $620K opportunity at Meridian Healthcare
          ↓
[Deal Registration] James submits DR-2026-00847
          ↓
[Conflict Detection] 4-layer check → trigram flag → Sarah reviews → clears and approves
          ↓
3-week proof of concept
          ↓
[CPQ / Quoting] James builds QT-2026-00412 with Diamond pricing
          ↓
[Discount Approval] 40% total → within CM band → Sarah approves
          ↓
Deal closes at $342,000
          ↓
[Background Jobs] Nightly: metrics rollup → tier check → dashboard updates
          ↓
[MDF] CyberShield requests $18K for CISO Summit → Sarah approves → event runs → claim paid
          ↓
[Conflict Detection] CloudGuard registers competing deal → Sarah approves co-sell (different product)
          ↓
[Cert Expiry + Tier Risk] Engineer leaves → 30-day grace → new cert earned → Diamond maintained
```

---

## What This Shows About the PM Role

Every step above is a product decision that a PM on the NextWave portal team would own:

- **How many layers of conflict detection?** Too aggressive = valid deals blocked; too loose = partner disputes
- **What's the right discount approval band?** Too tight = CM bottleneck; too loose = margin erosion at scale
- **How long is the tier grace period?** 30 days balances partner goodwill vs. program integrity
- **What triggers an MDF claim audit?** All claims vs. above $10K vs. random sample — each has cost/trust tradeoffs
- **When does a lead auto-return?** 48 hours is aggressive — shorter SLA = more pipeline velocity; longer = partner frustration when they lose a lead they were working

These are the tradeoffs that show up in real partner portal roadmap conversations at PANW.
