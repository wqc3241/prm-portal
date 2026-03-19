# PRM Portal — Authentication, Authorization & Business Logic

---

## 1. Authentication Architecture

### Strategy
- JWT-based stateless authentication
- Access token (short-lived, 1h) + Refresh token (long-lived, 30d, stored in DB)
- Passwords hashed with bcrypt (cost factor 12)
- Refresh tokens are single-use (rotated on each refresh)

### Token Flow
```
1. POST /auth/login  { email, password }
2. Server validates credentials
3. Returns { accessToken, refreshToken, expiresIn }
4. Client stores accessToken in memory, refreshToken in httpOnly cookie
5. All API calls include: Authorization: Bearer <accessToken>
6. On 401, client calls POST /auth/refresh with cookie
7. Server issues new accessToken + rotates refreshToken
```

### Middleware Stack
```
Request
  -> rateLimiter (IP-based, 100 req/min general, 5 req/min auth endpoints)
  -> cors
  -> helmet (security headers)
  -> authenticate (verify JWT, attach req.user)
  -> authorize(roles[]) (check role against endpoint requirement)
  -> scopeToOrg (for partner roles, restrict data to their org_id)
  -> controller
```

---

## 2. Authorization — Role Permissions Matrix

### Roles

| Role | Scope | Description |
|------|-------|-------------|
| `admin` | Global | Full system access. Manages tiers, products, all orgs. |
| `channel_manager` | Assigned orgs | Manages assigned partner accounts. Reviews deals, leads, quotes, MDF. |
| `partner_admin` | Own org | Manages their organization. Creates users, submits deals, manages reps. |
| `partner_rep` | Own org (self) | Individual contributor. Submits deals, works leads, creates quotes. |

### Permission Matrix

| Resource | admin | channel_manager | partner_admin | partner_rep |
|----------|-------|-----------------|---------------|-------------|
| **Users** | CRUD all | Read assigned orgs | CRUD own org | Read own org |
| **Organizations** | CRUD all | Read/Update assigned | Read/Update own | Read own |
| **Tiers** | CRUD | Read | Read | Read |
| **Products** | CRUD | Read | Read | Read |
| **Deals** | CRUD all | Review assigned orgs | CRUD own org | CRUD own |
| **Quotes** | CRUD all | Review assigned orgs | CRUD own org | CRUD own |
| **Leads** | CRUD all | Assign + manage | Accept/Return/Convert | Accept/Return/Convert |
| **MDF Allocations** | CRUD | CRUD for assigned | Read own org | Read own org |
| **MDF Requests** | CRUD all | Review assigned | CRUD own org | CRUD own org |
| **Courses** | CRUD | Read | Read | Read |
| **Certifications** | Read all | Read assigned | Read own org | Read own |
| **Documents** | CRUD all | CRUD | Read (tier-filtered) | Read (tier-filtered) |
| **Notifications** | Read own | Read own | Read own | Read own |
| **Analytics** | All | Assigned orgs | Own org | None |

### Data Scoping Middleware

```javascript
// Every partner query is automatically scoped:
// partner_admin/partner_rep -> WHERE organization_id = req.user.org_id
// channel_manager -> WHERE organization_id IN (assigned_org_ids)
// admin -> no filter

function scopeToOrg(req, res, next) {
  if (['partner_admin', 'partner_rep'].includes(req.user.role)) {
    req.orgScope = { organization_id: req.user.org_id };
  } else if (req.user.role === 'channel_manager') {
    // Load from a channel_manager -> org assignment table or org.channel_manager_id
    req.orgScope = { organization_id: { $in: req.user.assignedOrgIds } };
  } else {
    req.orgScope = {}; // admin sees all
  }
  next();
}
```

### Additional partner_rep Restrictions
- Can only update deals/quotes they created (submitted_by or created_by = user.id)
- Cannot create/delete users
- Cannot update organization settings
- Cannot view MDF allocation amounts (only see their own requests)

---

## 3. Business Logic

### 3.1 Deal Conflict Detection

Conflict detection runs automatically on deal submission and can be triggered manually via `GET /deals/conflict-check`.

**Algorithm:**

```
FUNCTION detectConflicts(deal):
  conflicts = []

  // Layer 1: Exact email match
  IF deal.customer_contact_email exists:
    matches = SELECT deals WHERE customer_contact_email = deal.customer_contact_email
              AND status IN (submitted, under_review, approved, won)
              AND registration_expires_at > NOW()
              AND id != deal.id
    conflicts.push(...matches with type='exact_email')

  // Layer 2: Exact company name match (case-insensitive)
  matches = SELECT deals WHERE LOWER(customer_company_name) = LOWER(deal.customer_company_name)
            AND status IN (submitted, under_review, approved, won)
            AND registration_expires_at > NOW()
            AND id != deal.id
  conflicts.push(...matches with type='exact_company')

  // Layer 3: Fuzzy company name (pg_trgm similarity > 0.4)
  matches = SELECT deals WHERE similarity(customer_company_name, deal.customer_company_name) > 0.4
            AND status IN (submitted, under_review, approved, won)
            AND registration_expires_at > NOW()
            AND id != deal.id
  conflicts.push(...matches with type='fuzzy_company')

  // Layer 4: Same product + similar customer (lower threshold 0.3)
  IF deal.primary_product_id exists:
    matches = SELECT deals WHERE primary_product_id = deal.primary_product_id
              AND similarity(customer_company_name, deal.customer_company_name) > 0.3
              AND status IN (submitted, under_review, approved, won)
              AND registration_expires_at > NOW()
              AND id != deal.id
    conflicts.push(...matches with type='product_overlap')

  RETURN deduplicate(conflicts)
```

**On conflict detection:**
1. Deal is flagged: `is_conflicting = true`, `conflict_deal_id` = first match
2. Deal status remains `submitted` but gets routed to channel manager for manual review
3. Conflict details are included in the approval notification
4. Channel manager can override conflicts and approve anyway

**Self-registration same-org deals are NOT conflicts** — multiple reps in the same org can work the same customer.

---

### 3.2 Tier Auto-Calculation

Runs on two triggers:
1. **Scheduled**: Nightly cron evaluates all active orgs
2. **Event-driven**: After a deal is marked `won` or a certification is completed

**Algorithm:**

```
FUNCTION recalculateTier(org):
  // Gather current metrics
  metrics = {
    ytd_revenue: SUM(deals.actual_value) WHERE org_id AND status='won' AND current year,
    ytd_deals_closed: COUNT(deals) WHERE org_id AND status='won' AND current year,
    certified_reps: COUNT(DISTINCT user_certifications.user_id)
                    WHERE user.org_id AND status='passed' AND expires_at > NOW(),
    csat_score: AVG(customer_satisfaction) // from external source or manual entry
  }

  // Update denormalized fields on org
  UPDATE organizations SET
    ytd_revenue = metrics.ytd_revenue,
    ytd_deals_closed = metrics.ytd_deals_closed,
    certified_rep_count = metrics.certified_reps

  // Find highest qualifying tier
  qualifying_tier = SELECT * FROM partner_tiers
    WHERE min_annual_revenue <= metrics.ytd_revenue
      AND min_deals_closed <= metrics.ytd_deals_closed
      AND min_certified_reps <= metrics.certified_reps
    ORDER BY rank DESC
    LIMIT 1

  IF qualifying_tier.id != org.tier_id:
    old_tier = org.tier_id
    UPDATE organizations SET tier_id = qualifying_tier.id

    // Notify
    IF qualifying_tier.rank > old_tier.rank:
      notify(org, 'TIER_UPGRADE', old_tier, qualifying_tier)
    ELSE:
      notify(org, 'TIER_DOWNGRADE', old_tier, qualifying_tier)
      // Grace period: tier downgrades take effect after 30 days
      // Queue a deferred downgrade instead of immediate change

    // Log activity
    INSERT activity_feed(action='tier_changed', ...)
```

**Tier downgrade grace period:**
- Downgrades are flagged but not applied for 30 days
- During grace period, partner is notified and can take corrective action
- If metrics improve within 30 days, downgrade is cancelled
- Implementation: `pending_tier_id` + `tier_change_effective_at` fields (or a separate scheduled job table)

---

### 3.3 Discount Approval Thresholds

Discounts are evaluated when creating/updating quote line items.

**Tier-based thresholds:**

| Tier | Self-Approve Up To | CM Approval | VP Approval |
|------|-------------------|-------------|-------------|
| Registered | 0% | Up to 15% | Above 15% |
| Silver | 5% | Up to 20% | Above 20% |
| Gold | 10% | Up to 25% | Above 25% |
| Platinum | 15% | Up to 30% | Above 30% |

**Algorithm:**

```
FUNCTION evaluateDiscount(quote, lineItem, partner_tier):
  effective_discount = calculateEffectiveDiscount(lineItem)

  // Check tier-specific product pricing first
  tier_pricing = SELECT FROM tier_product_pricing
    WHERE tier_id = partner_tier.id AND product_id = lineItem.product_id

  IF tier_pricing.discount_pct exists:
    allowed_discount = tier_pricing.discount_pct
  ELSE:
    allowed_discount = partner_tier.max_discount_pct

  IF effective_discount <= allowed_discount:
    // Auto-approved
    lineItem.discount_approved = true
    quote.requires_approval = checkOtherLines(quote) // other lines might need approval
    RETURN { approved: true, auto: true }

  ELSE IF effective_discount <= allowed_discount + 15:
    // Needs channel manager approval
    quote.requires_approval = true
    createApprovalRequest(quote, 'channel_manager', lineItem)
    RETURN { approved: false, approver: 'channel_manager' }

  ELSE:
    // Needs VP/admin approval
    quote.requires_approval = true
    createApprovalRequest(quote, 'admin', lineItem)
    RETURN { approved: false, approver: 'admin' }

FUNCTION calculateEffectiveDiscount(lineItem):
  IF lineItem.discount_type == 'percentage':
    RETURN lineItem.discount_value
  ELSE: // fixed_amount
    RETURN (lineItem.discount_value / lineItem.list_price) * 100
```

**Quote-level approval logic:**
- A quote requires approval if ANY line item exceeds the partner's self-approve threshold
- Quote cannot transition to `sent_to_customer` until all pending approvals are resolved
- On rejection, the specific line item is flagged so the partner knows which line to adjust

---

### 3.4 MDF Allocation Rules

**Allocation calculation (quarterly):**

```
FUNCTION calculateMdfAllocation(org, fiscal_quarter):
  tier = org.tier
  base_revenue = org.trailing_4q_revenue  // last 4 quarters of closed revenue

  // Tier-based MDF percentage
  allocation = base_revenue * (tier.mdf_budget_pct / 100)

  // Caps
  tier_caps = {
    'Registered': 0,         // no MDF for lowest tier
    'Silver': 5000,
    'Gold': 25000,
    'Platinum': 100000
  }
  allocation = MIN(allocation, tier_caps[tier.name])

  // Bonus for high performers (top 10% of tier)
  IF org.rank_in_tier <= 0.10:
    allocation *= 1.20  // 20% bonus

  RETURN allocation
```

**MDF request rules:**
1. Requested amount cannot exceed remaining allocation for the quarter
2. Activity start_date must be in the future (at least 14 days out for approval time)
3. Single request cannot exceed 50% of quarterly allocation
4. Activities must align with approved activity types for the partner's tier
5. Proof of execution required within 30 days of activity end_date
6. Claims must be submitted within 60 days of activity completion

**MDF lifecycle state machine:**
```
draft -> submitted -> approved -> completed -> claim_submitted -> claim_approved -> reimbursed
                   -> rejected                                  -> claim_rejected
                                                                   (can resubmit)
```

**Claim validation:**
- Claim amount cannot exceed approved_amount
- At least one proof of execution document required
- Proof documents must be in allowed formats (PDF, PNG, JPG)
- Reimbursement amount may differ from claim (partial reimbursement allowed)

---

## 4. Background Jobs / Scheduled Tasks

| Job | Schedule | Description |
|-----|----------|-------------|
| `tier-recalculation` | Daily 2:00 AM | Recalculate all partner tiers |
| `deal-expiration` | Daily 6:00 AM | Expire deals past registration_expires_at |
| `lead-sla-check` | Every 4 hours | Flag leads past SLA deadline, auto-return |
| `cert-expiry-warning` | Daily 8:00 AM | Notify users with certs expiring in 30/7/1 days |
| `mdf-claim-deadline` | Daily 9:00 AM | Warn partners of MDF claim deadlines |
| `mdf-quarterly-allocation` | Quarterly | Auto-generate MDF allocations for next quarter |
| `metrics-rollup` | Daily midnight | Update denormalized org metrics (ytd_revenue, etc.) |
| `inactive-deal-reminder` | Weekly | Remind partners of deals with no activity in 14+ days |

---

## 5. Notification Triggers

| Event | Recipients | Channel |
|-------|-----------|---------|
| Deal submitted | Assigned channel manager | In-app + email |
| Deal approved/rejected | Submitting partner | In-app + email |
| Deal conflict detected | Channel manager + both partners | In-app + email |
| Deal expiring (7 days) | Partner who registered | In-app + email |
| Lead assigned | Partner admin of target org | In-app + email |
| Lead SLA approaching | Assigned partner rep | In-app |
| Quote requires approval | Assigned channel manager | In-app + email |
| Quote approved/rejected | Quote creator | In-app + email |
| MDF request approved/rejected | Submitting partner | In-app + email |
| MDF claim deadline approaching | Submitting partner | In-app + email |
| Tier upgrade | Partner admin | In-app + email |
| Tier downgrade warning | Partner admin | In-app + email |
| Certification expiring | Certified user + partner admin | In-app + email |
| New document published | Partners at eligible tier | In-app |

---

## 6. Data Validation Rules

### Deal Registration
- `customer_company_name`: required, 2-255 chars
- `deal_name`: required, 2-300 chars
- `estimated_value`: required, > 0
- `expected_close_date`: required, must be future date
- `customer_contact_email`: valid email format if provided
- `win_probability`: 0-100 if provided

### Quote Line Items
- `quantity`: required, >= 1
- `discount_value`: >= 0, <= 100 for percentage type
- `unit_price`: auto-calculated but can be overridden (triggers approval if below floor)

### MDF Requests
- `requested_amount`: > 0, <= remaining allocation
- `start_date`: >= today + 14 days
- `end_date`: >= start_date
- `activity_type`: must be valid enum
- `claim_amount`: > 0, <= approved_amount (on claim submission)

---

## 7. Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `AUTH_INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `AUTH_TOKEN_EXPIRED` | 401 | Access token expired |
| `AUTH_INSUFFICIENT_ROLE` | 403 | Role cannot access this resource |
| `AUTH_ORG_MISMATCH` | 403 | Attempting to access another org's data |
| `DEAL_CONFLICT` | 409 | Conflicting deal registration exists |
| `DEAL_INVALID_TRANSITION` | 422 | Invalid status transition (e.g. draft -> approved) |
| `DEAL_EXPIRED` | 422 | Deal registration has expired |
| `QUOTE_APPROVAL_REQUIRED` | 422 | Quote has unapproved discount lines |
| `QUOTE_INVALID_DISCOUNT` | 422 | Discount exceeds maximum allowed |
| `MDF_INSUFFICIENT_FUNDS` | 422 | Request exceeds MDF allocation |
| `MDF_DEADLINE_PASSED` | 422 | Claim submission deadline has passed |
| `MDF_ACTIVITY_TOO_SOON` | 422 | Activity start date must be 14+ days out |
| `TIER_HAS_ORGS` | 422 | Cannot delete tier with assigned organizations |
| `LEAD_NOT_ASSIGNED` | 422 | Lead is not assigned to your org |
| `LEAD_ALREADY_CONVERTED` | 422 | Lead has already been converted |
| `VALIDATION_ERROR` | 422 | Request body validation failed (field-level errors) |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
