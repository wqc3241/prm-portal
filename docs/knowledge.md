# PRM Portal — Domain Knowledge Base

## What is PANW?

Palo Alto Networks (PANW) is a cybersecurity company that sells security software and hardware to enterprises and governments. Typical customers include hospitals, banks, retailers, and airlines. A typical deal is $100K–$5M/year.

**Core Products:**
- **Firewalls** (physical + virtual) — network perimeter security
- **Prisma Cloud** — cloud workload protection (AWS/Azure/GCP)
- **Cortex XDR** — endpoint detection & response
- **SASE / Prisma Access** — secure remote access for distributed workforces

---

## The Business Model

PANW cannot hire enough salespeople to reach all enterprise customers globally. Instead, they use a **channel model** — selling *through* other independent companies (partners) rather than always selling direct.

```
PANW (manufacturer) → Partners (distributors/resellers/implementers) → End Customers (enterprises)
```

This is similar to a franchise or distribution network. Partners are independent businesses — they have their own employees, customers, offices, and P&L. PANW doesn't own them.

---

## Key Stakeholders

### PANW Internal Roles

| Role | Responsibility |
|---|---|
| **Channel Manager (CM)** | PANW employee. Manages 30–80 partner companies. Their personal quota is partner-sourced revenue. They approve deals, distribute leads, and coach partners on selling PANW products. |
| **Direct Sales Rep** | Also PANW employee. Sells directly to named enterprise accounts. Can compete with partners, which is why deal registration exists. |
| **VP of Channels / Partner Org** | Sets tier structure, MDF budgets, and overall partner strategy. Decides discount levels per tier. |
| **Deal Desk** | Finance/ops team that approves large discounts. Corresponds to the "admin approval" band in the CPQ pricing waterfall. |

### Partner Types (External Companies)

Partners are **not** PANW employees. They are independent businesses that sell PANW products to their own customers.

| Partner Type | Examples | What They Do |
|---|---|---|
| **VAR (Value-Added Reseller)** | Presidio, CDW, regional IT firms | Buys PANW licenses, resells to their enterprise customers at markup. Handles procurement and billing. |
| **MSSP (Managed Security Service Provider)** | SecureWorks, regional SOC firms | Operates PANW tools on behalf of the customer. Customer pays MSSP monthly; MSSP pays PANW. |
| **Systems Integrator (SI)** | Deloitte, Accenture, IBM | Designs and implements large security architectures. Recommends PANW as part of a bigger engagement. |
| **Distributor** | Ingram Micro, TD SYNNEX | Buys PANW licenses in bulk, resells to smaller VARs. Enables two-tier distribution for geographic scale. |

**Key point:** Partners have their own existing customers. A VAR like Presidio may have 500 enterprise clients built over 10+ years. PANW wants access to those relationships without building them from scratch.

---

## Why Each Side Participates

### Why Partners Work With PANW
1. **Margin** — buy at 30–40% discount, sell at or near list price, keep the difference
2. **Services revenue** — charge customers for installation, configuration, and ongoing management
3. **MDF** — PANW funds their marketing events and lead generation campaigns
4. **Recurring revenue** — annual renewals are low-effort, high-margin
5. **Credibility** — selling PANW (market leader) strengthens the partner's positioning

Higher tier = bigger discounts = more margin = stronger incentive to push PANW over competitors like CrowdStrike or Zscaler.

### Why PANW Works With Partners
1. **Distribution reach** — partners already have trusted relationships PANW can't replicate quickly
2. **Implementation capacity** — PANW doesn't staff global implementation teams; partners do
3. **Lower cost of sale** — one CM managing 50 partners costs less than 50 direct reps
4. **Geographic and vertical coverage** — local partners understand local compliance laws, regulations, and languages
5. **Faster market penetration** — partners activate new segments without PANW hiring

---

## The Tensions the Portal Exists to Solve

The channel model creates natural conflicts. The portal manages these:

| Problem | Portal Solution |
|---|---|
| Two partners both claim the same customer | Deal registration + 4-layer fuzzy conflict detection |
| Partners undercut each other on price | Pricing waterfall with locked tier-based discounts |
| Partner receives a lead and ignores it | 48-hour SLA with automatic return to pool on breach |
| PANW direct rep and partner pursue the same account | Deal registration gives the partner legal "protection" — PANW direct must back off |
| Partner stops investing in product training | Certification requirements enforced by tier; lose tier = lose margin |
| Partner demands more marketing funds than they've earned | MDF allocation formula tied to trailing revenue performance |

---

## The NextWave Partner Program

PANW's partner program is called **NextWave**. It runs on **Salesforce Experience Cloud** (formerly Community Cloud) at `partners.paloaltonetworks.com`. PANW has ~10,000 partners globally who account for ~80% of PANW revenue.

### Tier Structure

| Tier | Requirement | Benefits |
|---|---|---|
| **Registered** | Minimal revenue, basic certification | Entry-level discounts, portal access |
| **Innovator** | Growing revenue + more certifications | Mid-level discounts, basic MDF |
| **Platinum** | Significant revenue + certified team | Higher discounts, dedicated CM, MDF funds |
| **Diamond** | Highest revenue + deepest certification coverage | Maximum discounts, dedicated resources, co-sell motion, bonus MDF |

Tier is recalculated nightly. Upgrades are immediate. Downgrades have a 30-day grace period.

---

## How the PRM Portal Maps to NextWave

| PRM Portal Module | NextWave Equivalent | Business Purpose |
|---|---|---|
| **Deal Registration** | Deal Registration | Partner claims protection on a customer opportunity. Prevents PANW direct from stealing the deal. |
| **CPQ / Quoting** | Configure-Price-Quote | Partner builds a customer-facing quote with tier-specific pricing. Discount approval gates protect PANW margins. |
| **Lead Distribution** | Demand Generation / Lead-Passing | PANW-generated MQLs distributed to partners based on geography, specialization, and tier. |
| **MDF Requests** | Market Development Funds | PANW funds partner marketing activities (events, webinars, ads). Calculated as % of trailing revenue. |
| **Training & Certifications** | NextWave Academy / PCCSA/PCNSE | Certifications (PSE, PCNSA, PCNSE) required to maintain tier. Expiry alerts protect tier status. |
| **Content Library** | Asset Library | Battle cards, competitive docs, data sheets. Gated by tier — Diamond partners see roadmap content. |
| **Partner Dashboard** | Partner Scorecard | Partner sees their own pipeline, MDF balance, tier progress, and cert coverage. |
| **Admin / CM Dashboard** | Channel Manager Console | CM sees their entire portfolio: deal approvals, lead queue, partner health scores. |
| **Analytics** | Program Analytics | Aggregate pipeline, revenue trends, MDF ROI, partner performance rankings. |
| **Notifications** | In-portal + Email Alerts | Deal status changes, new leads, MDF decisions, cert expirations — keeps both sides in sync. |

---

## Understanding the Portal User Roles

```
PANW Internal:
  admin@prmportal.com      → PANW Channel Ops / IT admin
                              Configures tiers, products, global program settings

  sarah.chen@prmportal.com → PANW Channel Manager
                              Manages CyberShield + CloudGuard partner accounts

Partner Companies (independent businesses):
  admin@cybershield.com    → CyberShield Solutions (Diamond tier partner)
                              Partner Admin: manages their own org, users, deals, MDF

  rep@cybershield.com      → Salesperson employed by CyberShield
                              Partner Rep: submits deals, works leads, creates quotes
```

**The end customer (e.g., Acme Corp) never logs into this portal.** When a partner rep registers a deal for Acme Corp, they are saying: *"I am actively selling to this company — protect my commission."* Acme Corp eventually receives a quote from CyberShield that includes PANW products, unaware of this backend system.

---

## Key Business Logic Summary

### Deal Conflict Detection
Four-layer matching: exact email → exact company name → trigram similarity (pg_trgm) → product + company overlap. Conflicts are flagged but don't block submission — the Channel Manager makes the final call. This mirrors PANW's real conflict resolution process where account ownership disputes go to the CM for adjudication.

### Pricing Waterfall
List price → volume discount → tier discount → deal-specific discount → final price. Three approval bands:
- Within tier max: auto-approved
- Up to tier max +15%: Channel Manager approval
- Above that: VP/Admin approval

This ensures no partner can erode margins on a product line without executive sign-off.

### MDF Allocation Formula
`Quarterly budget = tier percentage × trailing 4-quarter revenue, capped by tier limit`
Top 10% performers receive a 20% bonus allocation. This creates a performance flywheel: sell more → earn more marketing funds → generate more demand → sell more.

### Tier Recalculation
Nightly job compares org metrics (YTD revenue, deal count, certified reps) against tier thresholds. Upgrades are immediate; downgrades have a 30-day grace period to avoid penalizing partners for temporary dips.

### Lead SLA
Partners have 48 hours to accept and make first contact on an assigned lead. Automatic return to pool on SLA breach. This protects PANW's investment in demand generation — a $500 MQL sitting idle is waste.

---

## Why This Matters for a PM at PANW

Understanding channel economics is essential for prioritizing partner portal features:

- **Deal reg** = partner loyalty. Partners who feel unprotected will push competitors.
- **Tiered pricing** = investment flywheel. More certifications → better margins → more incentive to sell PANW.
- **MDF** = co-investment signal. Partners who spend MDF drive measurable pipeline; the allocation formula rewards those who do.
- **SLA enforcement** = lead quality trust. If partners ignore leads, PANW stops sending them — breaking the distribution relationship.
- **Tier-gated content** = advancement incentive. Exclusivity drives cert completion and program engagement.

Every feature in this portal exists because of a measurable channel program inefficiency that costs PANW revenue or partner goodwill.
