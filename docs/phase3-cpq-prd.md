# Product Requirements Document: Phase 3 -- CPQ (Configure, Price, Quote)

**Version:** 1.0
**Last Updated:** 2026-03-18
**Document Owner:** PRM Portal Team
**Status:** Approved
**Depends On:** Phase 1 (Foundation) -- COMPLETE, Phase 2 (Deal Registration) -- COMPLETE

---

## 1. Executive Summary and Vision

### Vision Statement

Partners can configure multi-product quotes with automatic pricing waterfall calculations, tier-aware discount approvals, and one-click PDF generation -- reducing quote turnaround from days to minutes.

### Executive Summary

The CPQ (Configure, Price, Quote) module enables partner representatives and administrators to create professional quotes that automatically calculate pricing based on product list prices, volume discounts, and partner tier entitlements. When a partner enters a discount that exceeds their tier's self-approval threshold, the system routes the quote through a structured approval workflow (channel manager or admin/VP) before it can be sent to the customer.

This module builds directly on Phase 1 (auth, RBAC, products, tiers, tier_product_pricing) and Phase 2 (deal registration). Quotes can be created standalone or linked to an existing deal registration, pre-populating customer information and ensuring traceability from opportunity through proposal.

### Key Benefits

- **Reduced quote cycle time**: Partners self-serve pricing instead of emailing channel managers for every quote (target: 80% of quotes completed without human intervention)
- **Pricing consistency**: Automated waterfall ensures every quote reflects current list prices and tier-negotiated discounts -- no manual spreadsheet errors
- **Audit trail**: Every discount, approval, and status change is recorded for compliance and channel conflict resolution
- **Deal-to-quote linkage**: Quotes created from registered deals inherit customer data and maintain pipeline visibility for channel managers

---

## 2. Problem Statement

### Current Challenges

**For Partner Reps (partner_rep):**
- Must manually look up product prices and calculate tier discounts using spreadsheets or PDFs
- No visibility into which discounts they can self-approve vs. which require channel manager sign-off
- Quote creation takes 30-60 minutes per quote; error rate on manual calculations is ~15%

**For Partner Admins (partner_admin):**
- Cannot track which quotes their reps have outstanding or which are pending approval
- No standardized quote format -- each rep creates their own template, leading to inconsistent branding

**For Channel Managers (channel_manager):**
- Receive discount approval requests via email with no structured data -- must manually verify tier entitlements
- No audit trail linking a discount approval to the original quote and deal

**For Admins (admin):**
- Cannot enforce pricing policy consistently across the partner ecosystem
- No program-wide visibility into discount trends or approval bottlenecks

### Why This Matters Now

Phase 2 (Deal Registration) is complete. Partners can register deals but cannot yet generate formal quotes from those deals. The deal-to-quote gap is the primary blocker to end-to-end pipeline management.

---

## 3. Goals and Success Metrics

### Business Goals

1. Enable partners to create and submit quotes without manual pricing assistance
2. Enforce tier-based discount policy automatically, eliminating unauthorized discounts
3. Provide channel managers with a structured approval queue for discount exceptions

### User Goals

1. Partner reps can create a multi-line quote in under 5 minutes
2. Channel managers can review and approve/reject a quote in under 2 minutes
3. Partners can generate and download a professional PDF quote in one click

### Success Metrics

#### Primary Metrics (P0)

| Metric | Baseline | Target (Phase 3 Complete) |
|--------|----------|---------------------------|
| Quote creation time (avg) | N/A (manual) | < 5 minutes |
| Pricing calculation accuracy | ~85% (manual) | 100% (automated) |
| Quotes auto-approved (no CM needed) | 0% | >= 60% |
| Quote-to-PDF generation time | N/A | < 10 seconds |

#### Secondary Metrics (P1)

| Metric | Target |
|--------|--------|
| Approval turnaround time (CM) | < 4 hours |
| Quotes created from deals (vs. standalone) | >= 40% |
| Quote clone usage rate | >= 15% of all quotes |

---

## 4. Non-Goals and Boundaries

### Explicit Non-Goals

- **Multi-currency conversion**: All quotes are in USD. Currency conversion is out of scope for Phase 3.
- **E-signature integration**: Quotes are sent as PDFs. DocuSign/Adobe Sign integration is a future phase.
- **Volume discount schedules**: The `discount_schedules` table and quantity-break pricing are deferred. The pricing waterfall includes a placeholder step but will not implement tiered volume discounts in Phase 3.
- **Quote versioning**: There is no version history for quote edits. Partners use `clone` to create a new version. The original quote remains unchanged.
- **Email delivery**: The `POST /quotes/:id/send` endpoint marks the quote as `sent_to_customer` and generates the PDF, but does not send an email in Phase 3. Email integration is Phase 7.
- **Tax calculation**: The `tax_amount` field exists in the schema but is not auto-calculated. Partners may manually enter tax if needed.
- **Custom terms and conditions per product**: The `terms_and_conditions` field is a free-text field on the quote header, not per line item.
- **Quote expiration background job**: Quotes have a `valid_until` date but there is no automated job to transition expired quotes. This is a Phase 9 item.

### Phase 3 Boundaries

- Authentication and RBAC are already implemented (Phase 1) -- this phase uses them, does not modify them.
- Products, tiers, and `tier_product_pricing` are already seeded (Phase 1) -- this phase reads them, does not modify them.
- Deal registration is complete (Phase 2) -- this phase links quotes to deals but does not modify deal logic.
- Notification service exists (Phase 1 scaffold) -- this phase calls `notificationService.createNotification()` for quote events.

---

## 5. User Personas and Use Cases

### Persona 1: Sarah (Partner Rep)

**Role:** partner_rep at "CloudGuard Inc" (Platinum Innovator tier)
**Experience:** 3 years selling network security solutions

**Goals:**
- Quickly generate a quote for a customer meeting tomorrow
- Know immediately whether her discount needs approval or is auto-approved

**Use Cases:**
- Creates a quote from an approved deal, adds 3 products, enters a 12% discount on the firewall line item, and submits. System auto-approves (Platinum tier allows up to 15%). She downloads the PDF.
- Clones last quarter's quote for a renewal, adjusts quantities, and submits. New pricing is recalculated automatically.

### Persona 2: Mike (Partner Admin)

**Role:** partner_admin at "CyberShield Solutions" (Diamond Innovator tier)
**Experience:** 8 years managing a team of 5 reps

**Goals:**
- Monitor all quotes created by his team
- Ensure quotes align with company pricing strategy before they reach customers

**Use Cases:**
- Views the quote list filtered by status=draft to review his team's work before submission
- Creates a high-value quote with a 28% discount on Cortex XSIAM. System flags it for CM approval. Mike submits and waits.

### Persona 3: Lisa (Channel Manager)

**Role:** channel_manager managing 4 partner organizations
**Experience:** 5 years in channel sales

**Goals:**
- Review discount approval requests quickly with full context
- Ensure discount decisions are consistent across her portfolio

**Use Cases:**
- Sees a pending approval notification. Opens the quote, reviews the line item discount vs. tier entitlement, approves with a comment.
- Rejects a quote where the partner requested 35% off a product that has a 20% tier-specific cap. Provides reason so the partner can adjust.

### Persona 4: David (Admin)

**Role:** admin (internal)
**Experience:** Program-level oversight

**Goals:**
- Set and enforce pricing policy via tier_product_pricing
- Approve exceptional discounts that exceed CM authority

**Use Cases:**
- Receives an escalated approval request for a discount above CM threshold. Reviews the deal context and approves.
- Audits quote approval history to identify discount trend anomalies.

---

## 6. Functional Requirements

### 6.1 Quote CRUD

**FR-QT-001: Create Quote (Standalone)** (P0)

Partners create a new quote by providing customer information and optional metadata.

*Request:*
```json
POST /api/v1/quotes
{
  "customer_name": "Acme Corp",
  "customer_email": "procurement@acme.com",
  "valid_until": "2026-04-17",
  "payment_terms": "Net 30",
  "notes": "Q2 refresh project",
  "terms_and_conditions": "Standard partner terms apply."
}
```

*Behavior:*
- `quote_number` auto-generated via DB trigger: `QT-2026-NNNNN`
- `organization_id` set from `req.user.org_id`
- `created_by` set from `req.user.sub`
- `status` set to `draft`
- `valid_from` defaults to today
- `valid_until` defaults to today + 30 days if not provided
- `subtotal`, `total_discount`, `total_amount` initialized to 0

*Acceptance Criteria:*
- Given a partner_rep with a valid org, when they POST /quotes with customer_name, then a new draft quote is returned with a generated quote_number.
- Given a user without an org_id (admin/CM), when they POST /quotes, then a 403 is returned with code AUTH_ORG_MISMATCH.

*Response:*
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "quote_number": "QT-2026-00001",
    "deal_id": null,
    "organization_id": "org-uuid",
    "created_by": "user-uuid",
    "customer_name": "Acme Corp",
    "customer_email": "procurement@acme.com",
    "subtotal": 0,
    "total_discount": 0,
    "tax_amount": 0,
    "total_amount": 0,
    "currency": "USD",
    "status": "draft",
    "requires_approval": false,
    "valid_from": "2026-03-18",
    "valid_until": "2026-04-17",
    "payment_terms": "Net 30",
    "notes": "Q2 refresh project",
    "terms_and_conditions": "Standard partner terms apply.",
    "pdf_url": null,
    "line_items": [],
    "created_at": "2026-03-18T10:00:00Z",
    "updated_at": "2026-03-18T10:00:00Z"
  }
}
```

---

**FR-QT-002: Create Quote from Deal** (P0)

When `deal_id` is provided, pre-populate customer info from the deal.

*Request:*
```json
POST /api/v1/quotes
{
  "deal_id": "deal-uuid",
  "payment_terms": "Net 45"
}
```

*Behavior:*
- Validate deal exists, belongs to the same org, and is in status `approved` or `won`
- Copy `customer_company_name` to `customer_name`, `customer_contact_email` to `customer_email`
- Set `deal_id` FK on the quote
- If the deal has `deal_products`, do NOT auto-copy them to quote line items (partner may want different quantities/discounts)

*Acceptance Criteria:*
- Given deal DR-2026-00042 in status `approved` belonging to org X, when a partner_rep in org X creates a quote with deal_id, then customer_name and customer_email are pre-populated from the deal.
- Given a deal in status `draft`, when a partner tries to create a quote from it, then a 422 error is returned: "Cannot create quote from a deal in 'draft' status. Deal must be approved or won."
- Given a deal belonging to org Y, when a partner_rep in org X tries to create a quote from it, then a 404 is returned (org scoping hides the deal).

---

**FR-QT-003: Get Quote** (P0)

*Request:*
```
GET /api/v1/quotes/:id
```

*Behavior:*
- Return quote with all line items joined (including product name, SKU from products table)
- Org-scoped: partners see only their org's quotes, CM sees assigned orgs, admin sees all
- Include `organization_name`, `created_by_name`, `approved_by_name` via joins

*Acceptance Criteria:*
- Given quote QT-2026-00001 belonging to org X, when a partner_rep in org X calls GET /quotes/:id, then the full quote with line items is returned.
- Given the same quote, when a partner_rep in org Y calls GET /quotes/:id, then a 404 is returned.

---

**FR-QT-004: List Quotes** (P0)

*Request:*
```
GET /api/v1/quotes?status=draft&page=1&per_page=25&sort=created_at:desc
```

*Query Parameters:*
| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filter by quote_status enum |
| `deal_id` | UUID | Filter by linked deal |
| `customer_name` | string | ILIKE search |
| `min_amount` | number | total_amount >= value |
| `max_amount` | number | total_amount <= value |
| `created_after` | date | created_at >= value |
| `created_before` | date | created_at <= value |
| `created_by` | UUID | Filter by creator |
| `page` | number | Default 1 |
| `per_page` | number | Default 25, max 100 |
| `sort` | string | Field:direction (e.g., `total_amount:desc`) |

*Acceptance Criteria:*
- Given 50 quotes in org X, when a partner_admin lists with per_page=10, then 10 quotes are returned with meta.total=50.
- Org scoping applies identically to GET single quote.

---

**FR-QT-005: Update Quote Header** (P1)

*Request:*
```
PATCH /api/v1/quotes/:id
{
  "customer_name": "Acme Corp International",
  "valid_until": "2026-05-01",
  "notes": "Updated scope"
}
```

*Behavior:*
- Only allowed when status is `draft` or `rejected`
- Only the quote creator (or partner_admin in same org, or admin) can update
- partner_rep can only update quotes they created
- Updatable fields: `customer_name`, `customer_email`, `valid_from`, `valid_until`, `payment_terms`, `notes`, `terms_and_conditions`, `tax_amount`
- Cannot update `status`, `subtotal`, `total_discount`, `total_amount` directly (these are computed)

*Acceptance Criteria:*
- Given a draft quote, when the creator PATCHes customer_name, then the quote is updated.
- Given a quote in status `approved`, when the creator tries to PATCH, then a 422 is returned with code QUOTE_INVALID_TRANSITION.

---

**FR-QT-006: Delete Quote** (P2)

*Request:*
```
DELETE /api/v1/quotes/:id
```

*Behavior:*
- Only allowed when status is `draft`
- Only the creator, partner_admin (same org), or admin can delete
- Hard delete (cascade deletes line items via FK ON DELETE CASCADE)

*Acceptance Criteria:*
- Given a draft quote with 3 line items, when the creator DELETEs it, then the quote and all line items are removed.
- Given a submitted quote, when the creator tries to DELETE, then a 422 is returned.

---

### 6.2 Line Item Management

**FR-LI-001: Add Line Item** (P0)

*Request:*
```json
POST /api/v1/quotes/:id/lines
{
  "product_id": "product-uuid",
  "quantity": 10,
  "discount_type": "percentage",
  "discount_value": 12,
  "sort_order": 1,
  "notes": "Includes 3-year support"
}
```

*Behavior:*
1. Validate quote is in status `draft` or `rejected`
2. Validate product exists, `is_active = true`, `available_to_partners = true`
3. Validate `quantity >= 1`
4. Validate `discount_value >= 0`; if `discount_type = 'percentage'`, validate `discount_value <= 100`
5. Snapshot `list_price` from `products.list_price` at time of line creation (price lock)
6. Run pricing waterfall (FR-PW-001) to calculate `unit_price`
7. `line_total` is a generated column: `quantity * unit_price`
8. Run discount evaluation (FR-DA-001) to determine `discount_approved` and `requires_approval` on quote
9. Recalculate quote header totals (FR-LI-004)
10. Return the created line item with pricing breakdown

*Acceptance Criteria:*
- Given a draft quote, when a partner adds product PA-5400 (list_price=50000) with quantity=10 and discount_value=12 (percentage), then list_price=50000, unit_price is calculated via waterfall, line_total = quantity * unit_price.
- Given the same scenario with a Platinum tier partner (max_discount_pct=15), then discount_approved=true (12 < 15).
- Given discount_value=120 and discount_type=percentage, then a 422 is returned with code QUOTE_INVALID_DISCOUNT.

*Response:*
```json
{
  "success": true,
  "data": {
    "id": "line-uuid",
    "quote_id": "quote-uuid",
    "product_id": "product-uuid",
    "product_name": "PA-5400 Series",
    "product_sku": "PAN-PA-5400",
    "sort_order": 1,
    "quantity": 10,
    "list_price": 50000.00,
    "tier_discount_pct": 15.00,
    "partner_discount_pct": 12.00,
    "effective_discount_pct": 12.00,
    "discount_type": "percentage",
    "discount_value": 12.00,
    "unit_price": 44000.00,
    "line_total": 440000.00,
    "discount_approved": true,
    "discount_approved_by": null,
    "notes": "Includes 3-year support",
    "created_at": "2026-03-18T10:05:00Z"
  }
}
```

---

**FR-LI-002: Update Line Item** (P0)

*Request:*
```json
PATCH /api/v1/quotes/:id/lines/:lineId
{
  "quantity": 15,
  "discount_value": 18
}
```

*Behavior:*
- Only allowed when quote is in status `draft` or `rejected`
- Updatable fields: `quantity`, `discount_type`, `discount_value`, `sort_order`, `notes`
- `list_price` is NOT updatable (it was snapshotted; use `POST /quotes/:id/recalculate` to refresh)
- Re-run pricing waterfall and discount evaluation
- Reset `discount_approved` to false if discount changed and now exceeds threshold
- Recalculate quote header totals

*Acceptance Criteria:*
- Given a line item with discount_approved=true, when the partner increases discount_value from 12 to 18 (above 15% Platinum threshold), then discount_approved is set to false and quote.requires_approval is set to true.

---

**FR-LI-003: Remove Line Item** (P0)

*Request:*
```
DELETE /api/v1/quotes/:id/lines/:lineId
```

*Behavior:*
- Only allowed when quote is in status `draft` or `rejected`
- Delete the line item
- Recalculate quote header totals
- Re-evaluate `requires_approval`: if the removed line was the only unapproved line, set requires_approval=false

*Acceptance Criteria:*
- Given a quote with 3 line items totaling $500,000, when one $200,000 line is removed, then subtotal recalculates to $300,000.
- Given a quote where only line 2 was unapproved, when line 2 is removed, then requires_approval flips to false.

---

**FR-LI-004: Recalculate Quote Header Totals** (P0, internal)

This is not an API endpoint. It is an internal function called after any line item change.

*Algorithm:*
```
FUNCTION recalculateQuoteTotals(quoteId):
  lines = SELECT * FROM quote_line_items WHERE quote_id = quoteId

  subtotal = SUM(lines.quantity * lines.list_price)       // before any discounts
  total_after_discounts = SUM(lines.line_total)            // line_total = qty * unit_price
  total_discount = subtotal - total_after_discounts
  total_amount = total_after_discounts + quote.tax_amount

  UPDATE quotes SET
    subtotal = subtotal,
    total_discount = total_discount,
    total_amount = total_amount
  WHERE id = quoteId
```

*Acceptance Criteria:*
- Given 2 line items: (qty=10, list_price=1000, unit_price=900) and (qty=5, list_price=2000, unit_price=1700), then subtotal=20000, total_discount=2500, total_amount=17500 + tax_amount.

---

### 6.3 Pricing Waterfall Engine

**FR-PW-001: Calculate Line Price** (P0)

The pricing waterfall determines the `unit_price` for each line item. It runs automatically when a line item is added or updated.

*Algorithm:*
```
FUNCTION calculateLinePrice(product_id, tier_id, discount_type, discount_value, quantity):

  // Step 1: Get list price
  product = SELECT list_price FROM products WHERE id = product_id
  base_price = product.list_price

  // Step 2: Volume discount (PLACEHOLDER -- not implemented in Phase 3)
  // volume_discount = lookupVolumeDiscount(product_id, quantity)
  // base_price = base_price * (1 - volume_discount / 100)
  volume_discount_pct = 0  // placeholder

  // Step 3: Determine tier discount entitlement
  tier_pricing = SELECT discount_pct, special_price
                 FROM tier_product_pricing
                 WHERE tier_id = tier_id AND product_id = product_id

  IF tier_pricing.special_price IS NOT NULL:
    // Special price overrides everything -- use it as the base
    tier_discounted_price = tier_pricing.special_price
    tier_discount_applied = ((base_price - tier_discounted_price) / base_price) * 100
  ELSE IF tier_pricing.discount_pct IS NOT NULL:
    tier_discount_applied = tier_pricing.discount_pct
    tier_discounted_price = base_price * (1 - tier_pricing.discount_pct / 100)
  ELSE:
    // Fallback to tier default
    tier = SELECT default_discount_pct FROM partner_tiers WHERE id = tier_id
    tier_discount_applied = tier.default_discount_pct
    tier_discounted_price = base_price * (1 - tier.default_discount_pct / 100)

  // Step 4: Apply partner-entered discount on top of tier price
  IF discount_type == 'percentage':
    partner_discount_amount = tier_discounted_price * (discount_value / 100)
  ELSE:  // fixed_amount -- discount_value is a dollar amount per unit
    partner_discount_amount = discount_value

  unit_price = tier_discounted_price - partner_discount_amount

  // Guard: unit_price cannot be negative
  IF unit_price < 0:
    THROW QUOTE_INVALID_DISCOUNT "Discount results in negative unit price"

  RETURN {
    list_price: product.list_price,
    volume_discount_pct: volume_discount_pct,
    tier_discount_pct: tier_discount_applied,
    tier_discounted_price: tier_discounted_price,
    partner_discount_type: discount_type,
    partner_discount_value: discount_value,
    partner_discount_amount: partner_discount_amount,
    unit_price: unit_price
  }
```

*Key Design Decisions:*
- `list_price` is snapshotted on the line item at creation time. If the product price changes later, the line item retains the original price until explicitly recalculated.
- The partner-entered discount applies ON TOP of the tier discount, not on the list price. This means a 10% tier discount + 5% partner discount = 14.5% effective discount (not 15%).
- `special_price` in `tier_product_pricing` takes absolute precedence -- it replaces the list price minus tier discount calculation entirely.

*Acceptance Criteria:*
- Given product list_price=10000, tier_product_pricing.discount_pct=10 (no special_price), partner discount=5%:
  - tier_discounted_price = 10000 * 0.90 = 9000
  - partner_discount_amount = 9000 * 0.05 = 450
  - unit_price = 9000 - 450 = 8550
  - Effective discount from list = (10000 - 8550) / 10000 = 14.5%
- Given product list_price=10000, tier_product_pricing.special_price=7500, partner discount=0:
  - unit_price = 7500
- Given product list_price=10000, no tier_product_pricing row, tier.default_discount_pct=5, partner discount=3%:
  - tier_discounted_price = 10000 * 0.95 = 9500
  - partner_discount_amount = 9500 * 0.03 = 285
  - unit_price = 9500 - 285 = 9215

---

**FR-PW-002: Recalculate All Pricing** (P1)

*Request:*
```
POST /api/v1/quotes/:id/recalculate
```

*Behavior:*
- Only allowed when quote is in status `draft` or `rejected`
- For each line item:
  - Re-fetch `list_price` from `products.list_price` (updates the snapshot)
  - Re-fetch tier discount from `tier_product_pricing` using the org's CURRENT tier
  - Re-run pricing waterfall
  - Re-evaluate discount approval
- Recalculate quote header totals
- Return the updated quote with all line items

*Use Cases:*
- Product price was updated by admin since the quote was created
- Partner org was promoted to a higher tier (better discounts now available)
- Quote was rejected, partner wants to recalculate before resubmitting

*Acceptance Criteria:*
- Given a quote created when PA-5400 list_price was 50000, and admin has since updated it to 52000, when the partner calls POST /recalculate, then all PA-5400 line items update list_price to 52000 and unit_price is recalculated.
- Given a partner org upgraded from Gold to Platinum since quote creation, when recalculate is called, then tier discount reflects Platinum entitlements.

---

### 6.4 Discount Approval Logic

**FR-DA-001: Evaluate Discount** (P0)

Runs automatically on line item add/update. Determines whether a discount requires approval and at what level.

*Algorithm:*
```
FUNCTION evaluateDiscount(line_item, org_tier):

  // Calculate effective discount as percentage of list price
  effective_discount_pct = ((list_price - unit_price) / list_price) * 100

  // Determine the self-approve ceiling for this product+tier
  tier_pricing = SELECT discount_pct FROM tier_product_pricing
                 WHERE tier_id = org_tier.id AND product_id = line_item.product_id

  IF tier_pricing EXISTS AND tier_pricing.discount_pct IS NOT NULL:
    self_approve_ceiling = tier_pricing.discount_pct
  ELSE:
    self_approve_ceiling = org_tier.max_discount_pct

  // Band 1: Auto-approve
  IF effective_discount_pct <= self_approve_ceiling:
    line_item.discount_approved = true
    RETURN { approved: true, level: 'auto', ceiling: self_approve_ceiling }

  // Band 2: Channel Manager approval
  cm_ceiling = self_approve_ceiling + 15
  IF effective_discount_pct <= cm_ceiling:
    line_item.discount_approved = false
    RETURN { approved: false, level: 'channel_manager', ceiling: cm_ceiling }

  // Band 3: Admin/VP approval
  ELSE:
    line_item.discount_approved = false
    RETURN { approved: false, level: 'admin', ceiling: null }
```

*Discount Approval Thresholds (from existing tier seed data):*

| Tier | Self-Approve (max_discount_pct) | CM Approval (max + 15) | Admin Approval |
|------|--------------------------------|------------------------|----------------|
| Registered | 0% | Up to 15% | Above 15% |
| Innovator | 5% | Up to 20% | Above 20% |
| Platinum Innovator | 10% | Up to 25% | Above 25% |
| Diamond Innovator | 15% | Up to 30% | Above 30% |

*Note:* `tier_product_pricing.discount_pct` overrides the tier's `max_discount_pct` for specific products. For example, if a Diamond partner has a special 25% entitlement on Cortex XDR, that 25% becomes the self-approve ceiling for that product (not the tier-wide 15%).

*Acceptance Criteria:*
- Given a Platinum Innovator partner (max_discount_pct=10), product with no tier_product_pricing override, effective discount=8%, then discount_approved=true.
- Given the same partner, effective discount=22%, then discount_approved=false, level=channel_manager.
- Given the same partner, effective discount=28%, then discount_approved=false, level=admin.
- Given the same partner, product with tier_product_pricing.discount_pct=20, effective discount=18%, then discount_approved=true (product override of 20 > tier-wide 10).

---

**FR-DA-002: Quote-Level Approval Flag** (P0)

*Behavior:*
- `quote.requires_approval = true` if ANY line item has `discount_approved = false`
- `quote.requires_approval = false` if ALL line items have `discount_approved = true`
- Recalculated on every line item add/update/delete

---

### 6.5 Quote Lifecycle (State Machine)

**FR-LC-001: Quote Status Transitions** (P0)

```
                             +---> rejected --+
                             |                |
                             |                v (partner edits and resubmits)
draft ---> pending_approval -+---> approved ---> sent_to_customer ---> accepted
  ^                                    |
  |                                    v
  +--- (clone creates new draft)    expired (manual only in Phase 3)
```

*Valid Transitions:*

```typescript
export const VALID_QUOTE_TRANSITIONS: Record<string, string[]> = {
  draft: ['pending_approval'],           // submit
  pending_approval: ['approved', 'rejected'],  // CM/admin decides
  approved: ['sent_to_customer'],        // partner sends to customer
  rejected: ['pending_approval'],        // partner fixes and resubmits
  sent_to_customer: ['accepted', 'expired'],   // customer responds
  accepted: [],                          // terminal
  expired: [],                           // terminal
};
```

*Note:* There is no `submitted` status for quotes (unlike deals). When a partner submits a draft quote:
- If `requires_approval = false`: status transitions directly to `approved` (auto-approved, no CM intervention needed)
- If `requires_approval = true`: status transitions to `pending_approval`

---

**FR-LC-002: Submit Quote** (P0)

*Request:*
```
POST /api/v1/quotes/:id/submit
```

*Behavior:*
1. Validate quote is in status `draft` or `rejected`
2. Validate quote has at least 1 line item (reject with 422 if empty)
3. Validate `valid_until >= today` (reject with 422 if expired validity)
4. If `requires_approval = false`:
   - Set status to `approved` directly
   - Set `approved_by = null` (auto-approved), `approved_at = NOW()`
   - Return `{ status: 'approved', auto_approved: true }`
5. If `requires_approval = true`:
   - Set status to `pending_approval`
   - Create `approval_request` record:
     - `entity_type = 'quote'`
     - `entity_id = quote.id`
     - `requested_by = req.user.sub`
     - `assigned_to` = org's channel_manager (or admin fallback)
   - Send notification to the assigned approver
   - Return `{ status: 'pending_approval', approval_level: 'channel_manager' | 'admin' }`

*Acceptance Criteria:*
- Given a draft quote with all line discounts within tier threshold, when submitted, then status becomes `approved` immediately.
- Given a draft quote with one line exceeding tier threshold, when submitted, then status becomes `pending_approval` and an approval_request is created.
- Given a draft quote with 0 line items, when submitted, then a 422 error is returned: "Quote must have at least one line item."

---

**FR-LC-003: Approve Quote** (P0)

*Request:*
```json
POST /api/v1/quotes/:id/approve
{
  "comments": "Discount approved for strategic account"
}
```

*Authorization:* `channel_manager` (for CM-level approvals) or `admin` (for all)

*Behavior:*
1. Validate quote is in status `pending_approval`
2. Validate the approver has authority:
   - CM can approve if the highest approval_level across all lines is `channel_manager`
   - Only admin can approve if any line requires `admin` level
   - CM must be assigned to the quote's org
3. Set all `discount_approved = true` on line items
4. Set `approved_by`, `approved_at`, clear `rejection_reason`
5. Set status to `approved`
6. Set `requires_approval = false`
7. Update `approval_request` record with action=approve
8. Notify the quote creator

*Acceptance Criteria:*
- Given a pending_approval quote requiring CM-level approval, when the org's CM approves, then status becomes `approved` and the creator is notified.
- Given a pending_approval quote requiring admin-level approval, when a CM tries to approve, then a 403 is returned: "This quote requires admin-level approval."

---

**FR-LC-004: Reject Quote** (P0)

*Request:*
```json
POST /api/v1/quotes/:id/reject
{
  "rejection_reason": "Discount on line 2 exceeds policy. Please reduce to 20% or below."
}
```

*Authorization:* `channel_manager`, `admin`

*Behavior:*
1. Validate quote is in status `pending_approval`
2. `rejection_reason` is required (422 if missing)
3. Set status to `rejected`
4. Set `rejection_reason` on quote
5. Update `approval_request` record with action=reject
6. Notify the quote creator with the rejection reason

*Acceptance Criteria:*
- Given a pending_approval quote, when a CM rejects with reason, then status becomes `rejected` and the creator receives a notification with the reason.
- Given a pending_approval quote, when a CM rejects without providing rejection_reason, then a 422 is returned.

---

**FR-LC-005: Send Quote to Customer** (P1)

*Request:*
```
POST /api/v1/quotes/:id/send
```

*Behavior:*
1. Validate quote is in status `approved`
2. Generate PDF if not already generated (FR-PDF-001)
3. Set status to `sent_to_customer`
4. (Phase 3: NO email is sent -- this is a status update + PDF generation only)

*Acceptance Criteria:*
- Given an approved quote without a PDF, when POST /send is called, then a PDF is generated, pdf_url is set, and status becomes sent_to_customer.
- Given a draft quote, when POST /send is called, then a 422 is returned.

---

**FR-LC-006: Mark Quote as Accepted** (P1)

*Request:*
```
POST /api/v1/quotes/:id/accept
```

*Authorization:* Quote creator, partner_admin (same org), admin

*Behavior:*
1. Validate quote is in status `sent_to_customer`
2. Set status to `accepted`

---

**FR-LC-007: Clone Quote** (P1)

*Request:*
```
POST /api/v1/quotes/:id/clone
```

*Behavior:*
1. Create a new quote with status `draft`
2. Copy header fields: customer_name, customer_email, deal_id, payment_terms, notes, terms_and_conditions
3. Set `valid_from = today`, `valid_until = today + 30 days`
4. Deep copy all line items:
   - Copy product_id, quantity, discount_type, discount_value, sort_order, notes
   - Re-snapshot list_price from current products.list_price (NOT the old snapshot)
   - Re-run pricing waterfall with current tier
   - Re-evaluate discount approval
5. Recalculate quote header totals
6. Generate new quote_number
7. Set created_by to the cloning user

*Acceptance Criteria:*
- Given quote QT-2026-00001 with 3 line items, when cloned, then a new QT-2026-00002 is created with 3 line items, each with current pricing.
- Given the original quote had list_price=50000 for PA-5400, and admin has since changed it to 52000, then the cloned line item has list_price=52000.

---

### 6.6 PDF Generation

**FR-PDF-001: Generate Quote PDF** (P1)

*Request:*
```
GET /api/v1/quotes/:id/pdf
```

*Behavior:*
1. If `pdf_url` already exists and quote has not been modified since PDF generation, return a redirect to the S3/MinIO URL
2. If `pdf_url` is null or quote was modified after last generation:
   - Build HTML from template with:
     - Partner organization logo (from organizations.logo_url) and name
     - Quote number, dates (valid_from, valid_until), payment terms
     - Customer name and email
     - Line items table: product name, SKU, quantity, list price, discount %, unit price, line total
     - Subtotal, total discount, tax, total amount
     - Notes and terms & conditions
   - Render HTML to PDF buffer using Puppeteer
   - Upload PDF to S3/MinIO at path: `quotes/{quote_id}/{quote_number}.pdf`
   - Update `quotes.pdf_url` with the S3 URL
3. Return the PDF as `Content-Type: application/pdf`

*Acceptance Criteria:*
- Given a quote with 5 line items, when GET /pdf is called, then a PDF is returned containing all line items with correct pricing.
- Given Puppeteer fails (e.g., Chromium crash), then a 500 error is returned with code PDF_GENERATION_FAILED and the quote status is unchanged.

---

### 6.7 Notifications

**FR-NT-001: Quote Approval Notifications** (P0)

| Event | Recipient | Title Template |
|-------|-----------|---------------|
| Quote submitted (needs approval) | Assigned CM or admin | "Quote {quote_number} requires approval: ${total_amount}" |
| Quote auto-approved | Quote creator | "Quote {quote_number} auto-approved" |
| Quote approved by CM/admin | Quote creator | "Quote {quote_number} approved by {approver_name}" |
| Quote rejected | Quote creator | "Quote {quote_number} rejected: {reason_preview}" |

All notifications use `type = 'quote_approval'`, `entity_type = 'quote'`, `entity_id = quote.id`, `action_url = /quotes/{quote.id}`.

---

## 7. Non-Functional Requirements

### NFR-SEC-001: Data Scoping (P0)

All quote endpoints MUST enforce org scoping via the existing `scopeToOrg` middleware:
- `partner_admin` / `partner_rep`: `WHERE organization_id = req.user.org_id`
- `channel_manager`: `WHERE organization_id IN (assigned_org_ids)`
- `admin`: no filter

A partner must never be able to read, update, or delete another organization's quotes.

### NFR-SEC-002: Ownership Enforcement (P0)

- `partner_rep` can only modify (PATCH, DELETE, submit, send) quotes they created (`created_by = req.user.sub`)
- `partner_admin` can modify any quote in their org
- `channel_manager` can only approve/reject quotes in their assigned orgs (not create/modify)
- `admin` can do everything

### NFR-SEC-003: Price Manipulation Protection (P0)

- `list_price` is read from the `products` table by the server, never accepted from client input
- `unit_price` is calculated server-side via the pricing waterfall, never accepted from client input
- `line_total` is a PostgreSQL generated column, never accepted from client input
- `subtotal`, `total_discount`, `total_amount` are computed server-side, never accepted from client input

### NFR-PERF-001: Quote Operations Performance (P1)

| Operation | Target Response Time |
|-----------|---------------------|
| Create quote | < 200ms |
| Add line item (including pricing waterfall) | < 300ms |
| Recalculate all lines (up to 50 lines) | < 2 seconds |
| Generate PDF (up to 50 lines) | < 10 seconds |
| List quotes (paginated, 25 per page) | < 300ms |

### NFR-PERF-002: Database Indexes (P0)

The following indexes already exist in the schema and MUST be leveraged:
- `idx_quotes_deal` on `quotes(deal_id)`
- `idx_quotes_org` on `quotes(organization_id)`
- `idx_quotes_status` on `quotes(status)`
- `idx_quote_items_quote` on `quote_line_items(quote_id)`

### NFR-REL-001: Transactional Integrity (P0)

The following operations MUST execute within a database transaction:
- Adding a line item + recalculating quote totals
- Updating a line item + recalculating quote totals
- Deleting a line item + recalculating quote totals
- Submitting a quote + creating approval_request + updating status
- Approving a quote + updating all line items discount_approved + updating status
- Cloning a quote + copying all line items

If any step fails, the entire transaction rolls back.

### NFR-REL-002: Concurrent Modification Protection (P0)

Use optimistic locking via the `updated_at` timestamp on status transitions:
```sql
UPDATE quotes
SET status = 'approved', approved_by = $1, approved_at = NOW()
WHERE id = $2 AND status = 'pending_approval' AND updated_at = $3
```
If 0 rows affected, return 409 Conflict: "Quote was modified by another user. Please refresh and try again."

This prevents race conditions such as two channel managers approving the same quote simultaneously, or a partner editing a quote while a CM is approving it.

### NFR-MAINT-001: Audit Trail (P0)

All quote status changes MUST be logged to the `activity_feed` table via the existing `activityLogger` middleware:
- `entity_type = 'quote'`
- `entity_id = quote.id`
- `action` = 'created', 'updated', 'submitted', 'approved', 'rejected', 'sent', 'accepted', 'cloned'
- `changes` JSONB contains field-level diffs for updates

### NFR-MAINT-002: Code Structure (P0)

Follow the established repository pattern from Phase 2:
- `src/validators/quote.validator.ts` -- Joi/Zod schemas
- `src/repositories/quote.repository.ts` -- all SQL via Knex
- `src/services/quote.service.ts` -- all business logic
- `src/controllers/quote.controller.ts` -- thin request/response handling
- `src/routes/quote.routes.ts` -- route definitions with middleware chain

---

## 8. Edge Cases and Error Handling

### EC-001: Product Price Changes After Quote Creation

**Scenario:** Admin updates PA-5400 list_price from 50000 to 52000 after a partner has created a quote with a PA-5400 line item.

**Behavior:** The line item retains `list_price = 50000` (the snapshotted value). The quote remains valid at the old price. If the partner wants current pricing, they call `POST /quotes/:id/recalculate` or clone the quote.

**Rationale:** Price-lock at line creation time is standard CPQ behavior. Partners need price stability while a quote is in flight.

### EC-002: Tier Changes Mid-Quote

**Scenario:** A partner org is upgraded from Innovator to Platinum Innovator while they have a draft quote with discount_approved=true (was within Innovator's 5% threshold).

**Behavior:** The existing quote is unaffected. The discount_approved flag is not recalculated retroactively. If the partner calls `POST /quotes/:id/recalculate`, the tier discount will be recalculated using the new Platinum tier, which may result in BETTER pricing (higher tier discount) and the partner discount remaining within the (now higher) self-approve threshold.

**Scenario (downgrade):** Partner is downgraded from Platinum to Innovator while they have a pending_approval quote.

**Behavior:** The pending approval proceeds based on the approval request already created. The approver sees the current tier at review time and can reject if the discount no longer aligns with policy. No automatic re-evaluation of pending approvals on tier change.

### EC-003: Concurrent Discount Approvals

**Scenario:** Two channel managers both open the same pending_approval quote and click "Approve" within seconds of each other.

**Behavior:** The first approval succeeds (status transitions from `pending_approval` to `approved`). The second approval fails with 409 Conflict because the optimistic locking check (`WHERE status = 'pending_approval' AND updated_at = $3`) finds 0 rows. The second CM receives an error: "Quote was modified by another user. Please refresh and try again."

### EC-004: Quote Cloning with Stale Prices

**Scenario:** Partner clones a 6-month-old accepted quote for a renewal.

**Behavior:** Clone re-snapshots list_price from the current products table and re-runs the pricing waterfall with the current tier. The cloned quote reflects today's pricing, not the original quote's historical pricing. If the product has been discontinued (is_active=false), the clone operation skips that line item and returns a warning in the response:
```json
{
  "data": { ... },
  "meta": {
    "warnings": [
      "Line item for product 'PA-400 Series' (PAN-PA-400) was skipped because the product is no longer active."
    ]
  }
}
```

### EC-005: Line Item with Quantity 0 or Negative

**Scenario:** Partner sends `{ "quantity": 0 }` or `{ "quantity": -5 }`.

**Behavior:** Rejected at the validation layer (Joi/Zod schema) with 422:
```json
{
  "success": false,
  "errors": [{ "code": "VALIDATION_ERROR", "message": "quantity must be at least 1", "field": "quantity" }]
}
```

### EC-006: Discount Greater Than 100%

**Scenario:** Partner sends `{ "discount_type": "percentage", "discount_value": 120 }`.

**Behavior:** Rejected at the validation layer with 422:
```json
{
  "success": false,
  "errors": [{ "code": "QUOTE_INVALID_DISCOUNT", "message": "Percentage discount cannot exceed 100%", "field": "discount_value" }]
}
```

### EC-007: Fixed Amount Discount Exceeding Unit Price

**Scenario:** Partner sends `{ "discount_type": "fixed_amount", "discount_value": 60000 }` on a product with tier_discounted_price of 45000.

**Behavior:** The pricing waterfall calculates unit_price = 45000 - 60000 = -15000. This is caught by the guard:
```json
{
  "success": false,
  "errors": [{ "code": "QUOTE_INVALID_DISCOUNT", "message": "Discount results in negative unit price. Maximum fixed discount for this product is $45,000.00", "field": "discount_value" }]
}
```

### EC-008: Quote Without Line Items (Submit)

**Scenario:** Partner submits a quote that has no line items.

**Behavior:** Rejected with 422:
```json
{
  "success": false,
  "errors": [{ "code": "QUOTE_INCOMPLETE", "message": "Quote must have at least one line item before submission" }]
}
```

### EC-009: PDF Generation Failure

**Scenario:** Puppeteer crashes or times out during PDF generation.

**Behavior:**
- Return 500 with code `PDF_GENERATION_FAILED`: "Unable to generate PDF. Please try again."
- Do NOT change quote status (if this was triggered by POST /send, the quote remains in `approved` status)
- Log the error with full stack trace for ops investigation
- The partner can retry GET /pdf or POST /send

### EC-010: Quote Linked to Expired Deal

**Scenario:** A quote's linked deal (deal_id) has expired (status=expired) since the quote was created.

**Behavior:** The quote is independent of deal lifecycle after creation. An expired deal does NOT affect the quote. The deal_id is informational linkage only. The quote can still be submitted, approved, and sent.

**Rationale:** In practice, partners often create quotes from deals and the deal may expire while the quote negotiation is still active. Blocking the quote would create a poor user experience.

### EC-011: Adding Duplicate Product to Quote

**Scenario:** Partner tries to add PA-5400 to a quote that already has a PA-5400 line item.

**Behavior:** Unlike deal_products (which has a UNIQUE constraint on deal_id + product_id), quote_line_items has NO uniqueness constraint on quote_id + product_id. A partner CAN add the same product multiple times (e.g., different quantities for different deployment sites, or different discount tiers for phased delivery).

### EC-012: Modifying an Approved Quote

**Scenario:** Partner tries to PATCH a quote header or add/remove line items on a quote in status `approved`.

**Behavior:** Rejected with 422:
```json
{
  "success": false,
  "errors": [{ "code": "QUOTE_INVALID_TRANSITION", "message": "Cannot modify a quote in 'approved' status. Clone the quote to create an editable copy." }]
}
```

---

## 9. API Endpoints Summary

| Method | Endpoint | Auth | Status Restriction | Description |
|--------|----------|------|--------------------|-------------|
| GET | `/quotes` | * (scoped) | -- | List quotes with filters |
| POST | `/quotes` | partner_admin, partner_rep | -- | Create quote (optional deal_id) |
| GET | `/quotes/:id` | * (scoped) | -- | Get quote with line items |
| PATCH | `/quotes/:id` | creator, partner_admin (own org), admin | draft, rejected | Update quote header |
| DELETE | `/quotes/:id` | creator, partner_admin (own org), admin | draft | Delete draft quote |
| POST | `/quotes/:id/lines` | creator, partner_admin (own org) | draft, rejected | Add line item |
| PATCH | `/quotes/:id/lines/:lineId` | creator, partner_admin (own org) | draft, rejected | Update line item |
| DELETE | `/quotes/:id/lines/:lineId` | creator, partner_admin (own org) | draft, rejected | Remove line item |
| POST | `/quotes/:id/submit` | partner_admin, partner_rep | draft, rejected | Submit for approval |
| POST | `/quotes/:id/approve` | channel_manager, admin | pending_approval | Approve quote |
| POST | `/quotes/:id/reject` | channel_manager, admin | pending_approval | Reject quote |
| POST | `/quotes/:id/send` | creator, partner_admin (own org) | approved | Send to customer (+ generate PDF) |
| POST | `/quotes/:id/accept` | creator, partner_admin (own org), admin | sent_to_customer | Mark as accepted |
| POST | `/quotes/:id/clone` | * (scoped) | any | Clone as new draft |
| GET | `/quotes/:id/pdf` | * (scoped) | any (but generates only if approved+) | Download/generate PDF |
| POST | `/quotes/:id/recalculate` | creator, partner_admin (own org) | draft, rejected | Recalculate all line pricing |

---

## 10. Data Model

### 10.1 quotes Table

```sql
CREATE TABLE quotes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_number    VARCHAR(20) NOT NULL UNIQUE,         -- QT-2026-00001
  deal_id         UUID REFERENCES deals(id),           -- optional link to deal
  organization_id UUID NOT NULL REFERENCES organizations(id),
  created_by      UUID NOT NULL REFERENCES users(id),
  -- Customer
  customer_name   VARCHAR(255) NOT NULL,
  customer_email  VARCHAR(255),
  -- Financials (server-computed, never from client)
  subtotal        NUMERIC(15,2) NOT NULL DEFAULT 0,    -- sum(qty * list_price) across lines
  total_discount  NUMERIC(15,2) NOT NULL DEFAULT 0,    -- subtotal - sum(line_total)
  tax_amount      NUMERIC(15,2) DEFAULT 0,             -- manually entered
  total_amount    NUMERIC(15,2) NOT NULL DEFAULT 0,    -- sum(line_total) + tax_amount
  currency        VARCHAR(3) DEFAULT 'USD',
  -- Status & approval
  status          quote_status NOT NULL DEFAULT 'draft',
  requires_approval BOOLEAN DEFAULT FALSE,
  approved_by     UUID REFERENCES users(id),
  approved_at     TIMESTAMPTZ,
  rejection_reason TEXT,
  -- Validity
  valid_from      DATE DEFAULT CURRENT_DATE,
  valid_until     DATE DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
  -- Terms
  payment_terms   VARCHAR(100) DEFAULT 'Net 30',
  notes           TEXT,
  terms_and_conditions TEXT,
  -- PDF
  pdf_url         VARCHAR(500),
  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 10.2 quote_line_items Table

```sql
CREATE TABLE quote_line_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id        UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id),
  sort_order      INT DEFAULT 0,
  -- Pricing
  quantity        INT NOT NULL DEFAULT 1,              -- must be >= 1
  list_price      NUMERIC(12,2) NOT NULL,              -- snapshot from products.list_price
  discount_type   discount_type DEFAULT 'percentage',  -- 'percentage' or 'fixed_amount'
  discount_value  NUMERIC(12,2) DEFAULT 0,             -- partner-entered discount
  unit_price      NUMERIC(12,2) NOT NULL,              -- after full waterfall
  line_total      NUMERIC(15,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  -- Approval
  discount_approved       BOOLEAN DEFAULT FALSE,
  discount_approved_by    UUID REFERENCES users(id),
  -- Notes
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 10.3 Related Tables (read-only in Phase 3)

| Table | Relationship | Usage in CPQ |
|-------|-------------|-------------|
| `products` | line_item.product_id -> products.id | Source of list_price, name, SKU |
| `partner_tiers` | org.tier_id -> partner_tiers.id | Source of default_discount_pct, max_discount_pct |
| `tier_product_pricing` | (tier_id, product_id) | Source of product-specific discount_pct and special_price |
| `organizations` | quote.organization_id -> organizations.id | Org tier lookup, channel_manager_id for approver |
| `deals` | quote.deal_id -> deals.id | Customer info pre-population |
| `approval_requests` | entity_type='quote', entity_id=quote.id | Approval workflow tracking |
| `activity_feed` | entity_type='quote', entity_id=quote.id | Audit trail |
| `notifications` | entity_type='quote', entity_id=quote.id | Approval notifications |

### 10.4 Entity Relationship Diagram

```
organizations ──────┐
  |                  |
  | (org.tier_id)    | (quote.organization_id)
  v                  v
partner_tiers     quotes ─────── deals
  |                  |              (optional FK)
  |                  |
  | (tier_id)        | (quote_id, ON DELETE CASCADE)
  v                  v
tier_product     quote_line_items ──── products
_pricing             |                    |
  |                  |                    |
  +---(product_id)---+----(product_id)----+
```

---

## 11. Implementation Phases

### Phase 3A: Quote CRUD + Line Items (Week 1)

**Objectives:**
- Quote create/read/update/delete with org scoping
- Line item create/update/delete
- Quote header total recalculation

**Deliverables:**
- `src/validators/quote.validator.ts`
- `src/repositories/quote.repository.ts`
- `src/services/quote.service.ts` (createQuote, updateQuote, deleteQuote, addLineItem, updateLineItem, removeLineItem, recalculateQuoteTotals)
- `src/controllers/quote.controller.ts`
- `src/routes/quote.routes.ts`
- Add `VALID_QUOTE_TRANSITIONS` to `src/config/constants.ts`

**Dependencies:** Phase 1 complete (products, tiers, auth, RBAC)

### Phase 3B: Pricing Waterfall + Discount Approval (Week 1-2)

**Objectives:**
- Implement calculateLinePrice() with full waterfall
- Implement evaluateDiscount() with 3-band approval logic
- Wire into addLineItem/updateLineItem flows

**Deliverables:**
- `calculateLinePrice()` in quote.service.ts
- `evaluateDiscount()` in quote.service.ts
- `recalculate` endpoint
- Integration with `tier_product_pricing` and `partner_tiers` tables

**Dependencies:** Phase 3A complete

### Phase 3C: Lifecycle + Approval Workflow (Week 2)

**Objectives:**
- Submit, approve, reject, send, accept, clone
- Approval request creation and resolution
- Notifications for approval events
- Optimistic locking on status transitions

**Deliverables:**
- submitQuote(), approveQuote(), rejectQuote(), sendQuote(), acceptQuote(), cloneQuote() in quote.service.ts
- Integration with approval_requests table
- Integration with notification.service.ts
- All status transition endpoints

**Dependencies:** Phase 3B complete

### Phase 3D: PDF Generation (Week 2-3)

**Objectives:**
- HTML quote template
- Puppeteer rendering
- S3/MinIO upload
- GET /pdf and POST /send endpoints

**Deliverables:**
- `src/services/document.service.ts` -> `generateQuotePdf()`
- HTML template file
- S3 upload integration
- Error handling for Puppeteer failures

**Dependencies:** Phase 3C complete (need full quote data for PDF)

### Phase 3E: Testing + Polish (Week 3)

**Objectives:**
- Unit tests for pricing waterfall calculations
- Unit tests for discount evaluation logic
- Integration tests for full quote lifecycle
- Edge case validation

**Deliverables:**
- `tests/unit/quote.service.test.ts`
- `tests/integration/quote.lifecycle.test.ts`
- Test fixtures for products, tiers, tier_product_pricing

**Dependencies:** Phase 3D complete

---

## 12. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Pricing waterfall calculation errors produce incorrect unit prices | Medium | High | Extensive unit tests with known-good pricing scenarios. Code review with worked examples. |
| Puppeteer installs fail or crash in CI/production | Medium | Medium | Graceful degradation: PDF generation is non-blocking. Quote can be approved and sent without PDF. Add health check. |
| Concurrent approval race conditions | Low | Medium | Optimistic locking via updated_at check on all status transitions. 409 Conflict response. |
| tier_product_pricing data gaps (no row for a product+tier combination) | Medium | Low | Fallback to tier.default_discount_pct is built into the waterfall. Log a warning when fallback is used. |
| Large quotes (50+ line items) cause slow recalculation | Low | Low | Batch the pricing waterfall in a single DB round-trip (fetch all products + tier_pricing in one query, calculate in memory). |

---

## 13. Dependencies

### External Dependencies

| Dependency | Type | Impact if Unavailable |
|------------|------|----------------------|
| PostgreSQL | Database | All quote operations fail (hard dependency) |
| Redis | Cache/Queue | Degraded: rate limiting falls back to in-memory. No impact on core quote logic. |
| MinIO/S3 | File Storage | PDF upload fails. Quote can still be approved/sent without PDF. |
| Puppeteer/Chromium | PDF Rendering | PDF generation fails. Graceful error returned. |

### Internal Dependencies

| Component | What's Needed | Status |
|-----------|--------------|--------|
| Auth middleware (authenticate, authorize, scopeToOrg) | JWT validation, role checks, org scoping | Complete (Phase 1) |
| Products table + seed data | list_price, is_active, available_to_partners | Complete (Phase 1) |
| partner_tiers table + seed data | default_discount_pct, max_discount_pct | Complete (Phase 1) |
| tier_product_pricing table + seed data | discount_pct, special_price per product+tier | Complete (Phase 1) |
| Deals table + deal.service.ts | deal lookup for quote-from-deal flow | Complete (Phase 2) |
| notification.service.ts | createNotification() for approval events | Scaffold exists (Phase 1), may need completion |
| approval_requests table | Store and query approval records | Schema exists (Phase 1) |
| activity_feed + activityLogger middleware | Audit logging | Complete (Phase 1) |

---

## 14. Appendices

### A. Glossary

- **CPQ**: Configure, Price, Quote -- the process of selecting products, applying pricing rules, and generating a formal quote document.
- **Pricing Waterfall**: The sequential application of discounts from list price to final unit price: list price -> volume discount -> tier discount -> partner discount -> unit price.
- **Tier Discount**: The discount a partner receives based on their program tier level, sourced from `tier_product_pricing.discount_pct` or `partner_tiers.default_discount_pct`.
- **Self-Approve Threshold**: The maximum discount a partner can apply without requiring channel manager approval, sourced from `partner_tiers.max_discount_pct` or `tier_product_pricing.discount_pct`.
- **Price Lock / Snapshot**: The practice of recording the product's list price on the line item at creation time, so the quote is insulated from later price changes.
- **Optimistic Locking**: A concurrency control method where the update query includes a check against the last-known `updated_at` timestamp, failing if another process has modified the record.

### B. Error Codes (CPQ-Specific)

| Code | HTTP | Description |
|------|------|-------------|
| `QUOTE_INVALID_TRANSITION` | 422 | Attempted an invalid status transition |
| `QUOTE_INVALID_DISCOUNT` | 422 | Discount exceeds 100% or results in negative price |
| `QUOTE_APPROVAL_REQUIRED` | 422 | Cannot send quote with unapproved discount lines |
| `QUOTE_INCOMPLETE` | 422 | Quote missing required data for submission (e.g., no line items) |
| `QUOTE_CONCURRENT_MODIFICATION` | 409 | Quote was modified by another user during operation |
| `QUOTE_DEAL_INVALID_STATUS` | 422 | Linked deal is in an invalid status for quote creation |
| `PDF_GENERATION_FAILED` | 500 | Puppeteer failed to render PDF |
| `PRODUCT_UNAVAILABLE` | 422 | Product is inactive or not available to partners |

### C. Constants to Add

```typescript
// Add to src/config/constants.ts

export const VALID_QUOTE_TRANSITIONS: Record<string, string[]> = {
  draft: ['pending_approval', 'approved'],     // approved if no approval needed
  pending_approval: ['approved', 'rejected'],
  approved: ['sent_to_customer'],
  rejected: ['pending_approval', 'approved'],  // resubmit
  sent_to_customer: ['accepted', 'expired'],
  accepted: [],
  expired: [],
};

export const QUOTE_VALIDITY_DAYS = 30;
export const DISCOUNT_CM_BUFFER_PCT = 15;  // CM can approve up to tier_max + 15%

export const ALLOWED_QUOTE_CREATION_DEAL_STATUSES = ['approved', 'won'];
```

### D. Pricing Waterfall Worked Example

**Setup:**
- Product: Cortex XDR (list_price = $25,000)
- Partner Org: CloudGuard Inc (Platinum Innovator tier)
- Tier: Platinum Innovator (default_discount_pct = 10%, max_discount_pct = 10%)
- tier_product_pricing for Cortex XDR + Platinum: discount_pct = 18%, special_price = NULL

**Partner enters:** quantity = 20, discount_type = percentage, discount_value = 5%

**Waterfall calculation:**
1. list_price = $25,000
2. Volume discount = 0% (not implemented Phase 3)
3. Tier discount: tier_product_pricing.discount_pct = 18% (overrides tier default of 10%)
   - tier_discounted_price = $25,000 * (1 - 0.18) = $20,500
4. Partner discount: 5% of $20,500 = $1,025
   - unit_price = $20,500 - $1,025 = $19,475
5. line_total = 20 * $19,475 = $389,500
6. Effective discount from list = ($25,000 - $19,475) / $25,000 = 22.1%

**Discount evaluation:**
- Self-approve ceiling = tier_product_pricing.discount_pct = 18%
- Effective discount = 22.1% > 18%
- CM ceiling = 18% + 15% = 33%
- 22.1% <= 33% -> Requires channel_manager approval

**Result:** Line item created with discount_approved = false, quote.requires_approval = true.
