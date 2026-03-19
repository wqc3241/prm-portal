/**
 * Integration tests for the Quote (CPQ) API — Phase 3.
 *
 * These tests exercise the full request-response cycle through Express,
 * including middleware (authenticate, scopeToOrg, validate), the controller,
 * the service, and mocked repositories/database.
 *
 * External dependencies (database, Redis, notifications) are fully mocked so
 * the tests run in-process without infrastructure.
 *
 * PRD coverage:
 *   QT-001  Quote CRUD (create, read, update, delete)
 *   QT-002  Create from deal — customer info pre-population
 *   QT-003  Pricing waterfall — list_price -> tier discount -> partner discount -> unit_price
 *   QT-004  Discount approval Band 1 (auto-approve within tier threshold)
 *   QT-005  Discount approval Band 2 (CM required — above tier but within +15%)
 *   QT-006  Discount approval Band 3 (admin required — above CM ceiling)
 *   QT-007  Quote rejection with reason and notification
 *   QT-008  Clone quote — deep copy with current pricing
 *   QT-009  Recalculate — refresh list_price and re-run waterfall
 *   QT-010  RBAC — partner_rep cannot approve; CM cannot create; cross-org 404
 *   QT-011  Invalid transitions (approve draft, submit without lines)
 *   QT-012  Line item CRUD — add, verify totals, update, recalc, remove
 */

// ── Mocks (must be before any imports) ────────────────────────────────────────

jest.mock('../../src/repositories/quote.repository', () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
    findById: jest.fn(),
    findRawById: jest.fn(),
    list: jest.fn(),
    updateStatus: jest.fn(),
    updateFields: jest.fn(),
    deleteQuote: jest.fn(),
    insertStatusHistory: jest.fn(),
    getStatusHistory: jest.fn(),
    createApprovalRequest: jest.fn(),
    updateApprovalRequest: jest.fn(),
    getLines: jest.fn(),
    addLine: jest.fn(),
    updateLine: jest.fn(),
    removeLine: jest.fn(),
    findLineById: jest.fn(),
    getLineTotals: jest.fn(),
    hasUnapprovedLines: jest.fn(),
    approveAllLines: jest.fn(),
    findProduct: jest.fn(),
    findTierProductPricing: jest.fn(),
    findTier: jest.fn(),
    findOrganization: jest.fn(),
    findDeal: jest.fn(),
    transaction: jest.fn(),
  },
}));

jest.mock('../../src/services/notification.service', () => ({
  __esModule: true,
  default: {
    createNotification: jest.fn(),
  },
}));

// Minimal db mock — scopeToOrg calls db('organizations') for CM scope
const mockDbChain: any = {
  select: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  whereIn: jest.fn().mockResolvedValue([]),
  first: jest.fn().mockResolvedValue(null),
};
const mockDb = jest.fn(() => mockDbChain);
(mockDb as any).raw = jest.fn((sql: string) => sql);
(mockDb as any).fn = { now: jest.fn(() => new Date()) };
(mockDb as any).transaction = jest.fn();

jest.mock('../../src/config/database', () => ({
  __esModule: true,
  default: mockDb,
}));

jest.mock('jsonwebtoken', () => ({
  ...jest.requireActual('jsonwebtoken'),
  verify: jest.fn(),
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import request from 'supertest';
import jwt from 'jsonwebtoken';
import express, { Application } from 'express';
import quoteRouter from '../../src/routes/quote.routes';
import quoteRepository from '../../src/repositories/quote.repository';
import notificationService from '../../src/services/notification.service';
import { ORG_IDS, USER_IDS, TIER_IDS } from '../fixtures/factories';
import { v4 as uuidv4 } from 'uuid';

const mockRepo = quoteRepository as jest.Mocked<typeof quoteRepository>;
const mockNotif = notificationService as jest.Mocked<typeof notificationService>;
const mockJwtVerify = jwt.verify as jest.Mock;

// ── App setup ─────────────────────────────────────────────────────────────────

function buildApp(): Application {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/quotes', quoteRouter);
  app.use((err: any, req: any, res: any, _next: any) => {
    const status = err.statusCode || 500;
    res.status(status).json({
      success: false,
      data: null,
      errors: err.errors || [{ code: err.code || 'INTERNAL_ERROR', message: err.message }],
      meta: null,
    });
  });
  return app;
}

const app = buildApp();

// ── JWT helpers ───────────────────────────────────────────────────────────────

function setupJwtAs(role: string, orgId: string | null = ORG_IDS.orgA) {
  const userId = role === 'partner_rep'
    ? USER_IDS.partnerRepA
    : role === 'partner_admin'
      ? USER_IDS.partnerAdminA
      : role === 'channel_manager'
        ? USER_IDS.channelManager
        : USER_IDS.admin;

  mockJwtVerify.mockReturnValue({
    sub: userId,
    email: `${role}@example.com`,
    role,
    org_id: orgId,
    tier_id: orgId ? TIER_IDS.platinum : null,
  });
}

// ── Shared fixture builders ────────────────────────────────────────────────────

const QUOTE_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const LINE_ID  = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const PRODUCT_ID = 'cccccccc-cccc-4ccc-cccc-cccccccccccc';
const DEAL_ID  = 'dddddddd-dddd-4ddd-dddd-dddddddddddd';

function makeQuoteRow(overrides: Record<string, any> = {}) {
  const now = new Date();
  const futureDate = new Date(now);
  futureDate.setDate(futureDate.getDate() + 30);
  return {
    id: QUOTE_ID,
    quote_number: 'QT-2026-00001',
    deal_id: null,
    organization_id: ORG_IDS.orgA,
    created_by: USER_IDS.partnerRepA,
    customer_name: 'Acme Corp',
    customer_email: 'procurement@acme.com',
    subtotal: 0,
    total_discount: 0,
    tax_amount: 0,
    total_amount: 0,
    currency: 'USD',
    status: 'draft',
    requires_approval: false,
    approved_by: null,
    approved_at: null,
    rejection_reason: null,
    valid_from: now.toISOString().slice(0, 10),
    valid_until: futureDate.toISOString().slice(0, 10),
    payment_terms: 'Net 30',
    notes: null,
    terms_and_conditions: null,
    pdf_url: null,
    line_items: [],
    organization_name: 'Org Alpha',
    created_by_name: 'Test User',
    approved_by_name: null,
    deal_number: null,
    tier_id: TIER_IDS.platinum,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function makeLineRow(overrides: Record<string, any> = {}) {
  return {
    id: LINE_ID,
    quote_id: QUOTE_ID,
    product_id: PRODUCT_ID,
    product_name: 'PA-5400 Series',
    product_sku: 'PAN-PA-5400',
    sort_order: 0,
    quantity: 10,
    list_price: '50000.00',
    discount_type: 'percentage',
    discount_value: '12.00',
    unit_price: '44000.00',
    line_total: '440000.00',
    discount_approved: true,
    discount_approved_by: null,
    notes: null,
    created_at: new Date(),
    ...overrides,
  };
}

function makeProductRow(overrides: Record<string, any> = {}) {
  return {
    id: PRODUCT_ID,
    name: 'PA-5400 Series',
    sku: 'PAN-PA-5400',
    list_price: '50000.00',
    is_active: true,
    available_to_partners: true,
    ...overrides,
  };
}

function makeOrgRow(overrides: Record<string, any> = {}) {
  return {
    id: ORG_IDS.orgA,
    name: 'Org Alpha',
    tier_id: TIER_IDS.platinum,
    channel_manager_id: USER_IDS.channelManager,
    ...overrides,
  };
}

function makeTierRow(overrides: Record<string, any> = {}) {
  return {
    id: TIER_IDS.platinum,
    name: 'Platinum Innovator',
    default_discount_pct: '10',
    max_discount_pct: '10',
    ...overrides,
  };
}

// Simulate the transaction executor: immediately calls callback with a fake trx
// The trx is forwarded to repo methods that accept it.
function setupTransactionMock() {
  mockRepo.transaction.mockImplementation(async (cb: any) => cb({}));
}

// ── beforeEach ────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();

  // Always set up DB chain defaults (for scopeToOrg CM lookup)
  mockDbChain.where.mockReturnThis();
  mockDbChain.select.mockReturnThis();
  mockDbChain.whereIn.mockResolvedValue([]);
  mockDbChain.first.mockResolvedValue({ id: USER_IDS.admin, is_active: true });
  mockDb.mockImplementation(() => mockDbChain);

  // Default notification stub
  mockNotif.createNotification.mockResolvedValue({ id: 'n1' } as any);

  // Default status history stub
  mockRepo.insertStatusHistory.mockResolvedValue({ id: 'sh1' } as any);
  mockRepo.createApprovalRequest.mockResolvedValue({ id: 'ar1' } as any);
  mockRepo.updateApprovalRequest.mockResolvedValue(1 as any);

  setupTransactionMock();
});

// ═════════════════════════════════════════════════════════════════════════════
// QT-001: QUOTE LIFECYCLE — create -> add lines -> submit -> approve -> totals
// ═════════════════════════════════════════════════════════════════════════════

describe('QT-001: Quote lifecycle — create, submit, approve', () => {
  test('POST /quotes creates a draft quote with auto-generated number (201)', async () => {
    setupJwtAs('partner_rep');
    const createdQuote = makeQuoteRow();
    mockRepo.create.mockResolvedValue(createdQuote);
    mockRepo.insertStatusHistory.mockResolvedValue({ id: 'sh1' } as any);

    const res = await request(app)
      .post('/api/v1/quotes')
      .set('Authorization', 'Bearer mock-token')
      .send({
        customer_name: 'Acme Corp',
        customer_email: 'procurement@acme.com',
        payment_terms: 'Net 30',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('draft');
    expect(res.body.data.quote_number).toBe('QT-2026-00001');
    expect(res.body.data.line_items).toEqual([]);
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: ORG_IDS.orgA,
        status: 'draft',
        customer_name: 'Acme Corp',
        requires_approval: false,
      }),
    );
  });

  test('POST /quotes/:id/submit auto-approves when requires_approval=false (200)', async () => {
    setupJwtAs('partner_rep');
    const line = makeLineRow({ discount_approved: true });
    const draftQuote = makeQuoteRow({
      requires_approval: false,
      line_items: [line],
    });
    mockRepo.findById.mockResolvedValue(draftQuote);
    mockRepo.updateStatus.mockResolvedValue({
      ...draftQuote,
      status: 'approved',
      approved_at: new Date(),
      updated_at: new Date(),
    });

    const res = await request(app)
      .post(`/api/v1/quotes/${QUOTE_ID}/submit`)
      .set('Authorization', 'Bearer mock-token')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('approved');
    expect(res.body.data.auto_approved).toBe(true);
    expect(mockNotif.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'quote_approval' }),
    );
  });

  test('GET /quotes/:id returns quote with line items (200)', async () => {
    setupJwtAs('partner_rep');
    const line = makeLineRow();
    mockRepo.findById.mockResolvedValue(makeQuoteRow({ line_items: [line] }));

    const res = await request(app)
      .get(`/api/v1/quotes/${QUOTE_ID}`)
      .set('Authorization', 'Bearer mock-token');

    expect(res.status).toBe(200);
    expect(res.body.data.line_items).toHaveLength(1);
    expect(res.body.data.quote_number).toBe('QT-2026-00001');
  });

  test('Full lifecycle: draft -> submit (pending) -> approve -> verified (200)', async () => {
    // Step 1: Submit with requires_approval=true
    setupJwtAs('partner_rep');
    const pendingQuote = makeQuoteRow({
      requires_approval: true,
      line_items: [makeLineRow({ discount_approved: false })],
    });
    mockRepo.findById.mockResolvedValue(pendingQuote);
    mockRepo.updateStatus.mockResolvedValue({
      ...pendingQuote,
      status: 'pending_approval',
      updated_at: new Date(),
    });
    mockRepo.getLines.mockResolvedValue([makeLineRow({ discount_approved: false })]);
    mockRepo.findOrganization.mockResolvedValue(makeOrgRow());
    mockRepo.findTierProductPricing.mockResolvedValue(null);
    mockRepo.findTier.mockResolvedValue(makeTierRow({ max_discount_pct: '10' }));

    let res = await request(app)
      .post(`/api/v1/quotes/${QUOTE_ID}/submit`)
      .set('Authorization', 'Bearer mock-token')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('pending_approval');
    expect(res.body.data.auto_approved).toBe(false);

    // Step 2: Approve as CM
    setupJwtAs('channel_manager', null);
    const pendingForApprove = makeQuoteRow({
      status: 'pending_approval',
      line_items: [makeLineRow({ discount_approved: false })],
    });
    mockRepo.findById.mockResolvedValue(pendingForApprove);
    mockRepo.getLines.mockResolvedValue([makeLineRow({ discount_approved: false })]);
    mockRepo.findOrganization.mockResolvedValue(makeOrgRow());
    mockRepo.findTierProductPricing.mockResolvedValue(null);
    mockRepo.findTier.mockResolvedValue(makeTierRow({ max_discount_pct: '10' }));
    mockRepo.updateStatus.mockResolvedValue({
      ...pendingForApprove,
      status: 'approved',
      approved_by: USER_IDS.channelManager,
      approved_at: new Date(),
      updated_at: new Date(),
    });
    mockRepo.approveAllLines.mockResolvedValue(1 as any);

    res = await request(app)
      .post(`/api/v1/quotes/${QUOTE_ID}/approve`)
      .set('Authorization', 'Bearer mock-token')
      .send({ comments: 'Discount approved for strategic account' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('approved');
    expect(mockRepo.approveAllLines).toHaveBeenCalledWith(QUOTE_ID, USER_IDS.channelManager, expect.anything());
    expect(mockNotif.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: USER_IDS.partnerRepA }),
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// QT-002: CREATE FROM DEAL — customer info pre-population
// ═════════════════════════════════════════════════════════════════════════════

describe('QT-002: Create quote from deal', () => {
  test('POST /quotes with deal_id copies customer_name and customer_email from deal (201)', async () => {
    setupJwtAs('partner_rep');
    const dealRow = {
      id: DEAL_ID,
      deal_number: 'DR-2026-00042',
      organization_id: ORG_IDS.orgA,
      status: 'approved',
      customer_company_name: 'Acme Corporation',
      customer_contact_email: 'cto@acme.com',
    };
    mockRepo.findDeal.mockResolvedValue(dealRow);

    const createdQuote = makeQuoteRow({
      deal_id: DEAL_ID,
      customer_name: 'Acme Corporation',
      customer_email: 'cto@acme.com',
    });
    mockRepo.create.mockResolvedValue(createdQuote);

    const res = await request(app)
      .post('/api/v1/quotes')
      .set('Authorization', 'Bearer mock-token')
      .send({ deal_id: DEAL_ID, payment_terms: 'Net 45' });

    expect(res.status).toBe(201);
    expect(res.body.data.deal_id).toBe(DEAL_ID);
    expect(res.body.data.customer_name).toBe('Acme Corporation');
    expect(res.body.data.customer_email).toBe('cto@acme.com');
    expect(mockRepo.findDeal).toHaveBeenCalledWith(DEAL_ID, expect.any(Object));
    // create should have deal_id set
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ deal_id: DEAL_ID, customer_name: 'Acme Corporation' }),
    );
  });

  test('POST /quotes with deal in draft status returns 422 QUOTE_DEAL_INVALID_STATUS', async () => {
    setupJwtAs('partner_rep');
    mockRepo.findDeal.mockResolvedValue({
      id: DEAL_ID,
      status: 'draft',
      customer_company_name: 'Acme',
      customer_contact_email: null,
    });

    const res = await request(app)
      .post('/api/v1/quotes')
      .set('Authorization', 'Bearer mock-token')
      .send({ deal_id: DEAL_ID });

    expect(res.status).toBe(422);
    expect(res.body.errors[0].code).toBe('QUOTE_DEAL_INVALID_STATUS');
    expect(res.body.errors[0].message).toMatch(/approved or won/i);
  });

  test('POST /quotes with deal from different org returns 404 (org scoping hides it)', async () => {
    setupJwtAs('partner_rep', ORG_IDS.orgA);
    // findDeal returns null because org scoping filtered it out
    mockRepo.findDeal.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/quotes')
      .set('Authorization', 'Bearer mock-token')
      .send({ deal_id: DEAL_ID });

    expect(res.status).toBe(404);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// QT-003: PRICING WATERFALL — list_price -> tier discount -> partner -> unit_price
// ═════════════════════════════════════════════════════════════════════════════

describe('QT-003: Pricing waterfall — line item pricing verification', () => {
  /**
   * Scenario (from PRD Appendix D):
   *   product list_price = 25000
   *   tier_product_pricing.discount_pct = 18%
   *   partner discount = 5% (percentage)
   *
   *   tier_discounted_price = 25000 * (1 - 0.18) = 20500
   *   partner_discount_amount = 20500 * 0.05 = 1025
   *   unit_price = 20500 - 1025 = 19475
   *   line_total = 20 * 19475 = 389500
   */
  test('POST /quotes/:id/lines returns correct waterfall pricing (201)', async () => {
    setupJwtAs('partner_rep');
    const draftQuote = makeQuoteRow({ line_items: [] });
    mockRepo.findById.mockResolvedValue(draftQuote);

    const product = makeProductRow({ list_price: '25000.00' });
    mockRepo.findProduct.mockResolvedValue(product);
    mockRepo.findOrganization.mockResolvedValue(makeOrgRow());

    // Tier product pricing: 18% discount for this product+tier
    mockRepo.findTierProductPricing.mockResolvedValue({
      tier_id: TIER_IDS.platinum,
      product_id: PRODUCT_ID,
      discount_pct: '18',
      special_price: null,
    });

    const expectedLine = makeLineRow({
      list_price: '25000.00',
      unit_price: '19475.00',
      line_total: '389500.00',
      quantity: 20,
      discount_value: '5.00',
      discount_approved: true, // 22.1% effective vs 18% ceiling => needs CM; but we test this separately
    });

    mockRepo.addLine.mockResolvedValue(expectedLine);
    mockRepo.getLines.mockResolvedValue([expectedLine]);
    mockRepo.getLineTotals.mockResolvedValue({
      subtotal: 500000,
      totalAfterDiscounts: 389500,
      count: 1,
    });
    mockRepo.hasUnapprovedLines.mockResolvedValue(false);
    mockRepo.updateFields.mockResolvedValue(draftQuote);

    const res = await request(app)
      .post(`/api/v1/quotes/${QUOTE_ID}/lines`)
      .set('Authorization', 'Bearer mock-token')
      .send({
        product_id: PRODUCT_ID,
        quantity: 20,
        discount_type: 'percentage',
        discount_value: 5,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.list_price).toBe('25000.00');
    expect(res.body.data.unit_price).toBe('19475.00');
    expect(res.body.data.line_total).toBe('389500.00');
    // Tier discount applied should be stored
    expect(res.body.data.tier_discount_pct).toBe(18);
  });

  test('POST /quotes/:id/lines with special_price overrides list_price calculation (201)', async () => {
    setupJwtAs('partner_rep');
    const draftQuote = makeQuoteRow({ line_items: [] });
    mockRepo.findById.mockResolvedValue(draftQuote);

    const product = makeProductRow({ list_price: '10000.00' });
    mockRepo.findProduct.mockResolvedValue(product);
    mockRepo.findOrganization.mockResolvedValue(makeOrgRow());

    // Special price = 7500 overrides everything
    mockRepo.findTierProductPricing.mockResolvedValue({
      tier_id: TIER_IDS.platinum,
      product_id: PRODUCT_ID,
      discount_pct: null,
      special_price: '7500.00',
    });

    const expectedLine = makeLineRow({
      list_price: '10000.00',
      unit_price: '7500.00',
      line_total: '7500.00',
      quantity: 1,
      discount_value: '0.00',
      discount_approved: true,
    });

    mockRepo.addLine.mockResolvedValue(expectedLine);
    mockRepo.getLines.mockResolvedValue([expectedLine]);
    mockRepo.getLineTotals.mockResolvedValue({ subtotal: 10000, totalAfterDiscounts: 7500, count: 1 });
    mockRepo.hasUnapprovedLines.mockResolvedValue(false);
    mockRepo.updateFields.mockResolvedValue(draftQuote);

    const res = await request(app)
      .post(`/api/v1/quotes/${QUOTE_ID}/lines`)
      .set('Authorization', 'Bearer mock-token')
      .send({ product_id: PRODUCT_ID, quantity: 1, discount_value: 0 });

    expect(res.status).toBe(201);
    expect(res.body.data.unit_price).toBe('7500.00');
  });

  test('POST /quotes/:id/lines falls back to tier default_discount_pct when no tier_product_pricing (201)', async () => {
    setupJwtAs('partner_rep');
    const draftQuote = makeQuoteRow({ line_items: [] });
    mockRepo.findById.mockResolvedValue(draftQuote);

    const product = makeProductRow({ list_price: '10000.00' });
    mockRepo.findProduct.mockResolvedValue(product);
    mockRepo.findOrganization.mockResolvedValue(makeOrgRow());

    // No tier product pricing row
    mockRepo.findTierProductPricing.mockResolvedValue(null);
    // Tier default = 5%
    mockRepo.findTier.mockResolvedValue(makeTierRow({ default_discount_pct: '5', max_discount_pct: '10' }));

    // tier_discounted_price = 10000 * 0.95 = 9500
    // partner_discount = 9500 * 0.03 = 285
    // unit_price = 9500 - 285 = 9215
    const expectedLine = makeLineRow({
      list_price: '10000.00',
      unit_price: '9215.00',
      quantity: 1,
      discount_value: '3.00',
      discount_approved: true,
    });

    mockRepo.addLine.mockResolvedValue(expectedLine);
    mockRepo.getLines.mockResolvedValue([expectedLine]);
    mockRepo.getLineTotals.mockResolvedValue({ subtotal: 10000, totalAfterDiscounts: 9215, count: 1 });
    mockRepo.hasUnapprovedLines.mockResolvedValue(false);
    mockRepo.updateFields.mockResolvedValue(draftQuote);

    const res = await request(app)
      .post(`/api/v1/quotes/${QUOTE_ID}/lines`)
      .set('Authorization', 'Bearer mock-token')
      .send({ product_id: PRODUCT_ID, quantity: 1, discount_type: 'percentage', discount_value: 3 });

    expect(res.status).toBe(201);
    expect(res.body.data.unit_price).toBe('9215.00');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// QT-004: DISCOUNT APPROVAL — Band 1 (auto-approve)
// ═════════════════════════════════════════════════════════════════════════════

describe('QT-004: Discount approval Band 1 — auto-approve within tier max', () => {
  test('Submit with all lines within tier threshold auto-approves immediately (200)', async () => {
    setupJwtAs('partner_admin');
    // Quote where all discounts are within Platinum max (10%) -> discount_approved=true, requires_approval=false
    const draftQuote = makeQuoteRow({
      requires_approval: false,
      line_items: [makeLineRow({ discount_approved: true, discount_value: '8.00' })],
    });
    mockRepo.findById.mockResolvedValue(draftQuote);
    mockRepo.updateStatus.mockResolvedValue({
      ...draftQuote,
      status: 'approved',
      approved_at: new Date(),
      updated_at: new Date(),
    });

    const res = await request(app)
      .post(`/api/v1/quotes/${QUOTE_ID}/submit`)
      .set('Authorization', 'Bearer mock-token')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('approved');
    expect(res.body.data.auto_approved).toBe(true);
    // No approval request created for auto-approved quotes
    expect(mockRepo.createApprovalRequest).not.toHaveBeenCalled();
  });

  test('POST /quotes/:id/lines with discount=8% (< Platinum 10% max) sets discount_approved=true', async () => {
    setupJwtAs('partner_rep');
    const draftQuote = makeQuoteRow({ line_items: [] });
    mockRepo.findById.mockResolvedValue(draftQuote);

    const product = makeProductRow({ list_price: '10000.00' });
    mockRepo.findProduct.mockResolvedValue(product);
    mockRepo.findOrganization.mockResolvedValue(makeOrgRow());
    mockRepo.findTierProductPricing.mockResolvedValue(null);
    // Platinum tier: max_discount_pct=10
    mockRepo.findTier.mockResolvedValue(makeTierRow({ default_discount_pct: '0', max_discount_pct: '10' }));

    // 8% discount on a product with no tier discount means:
    // tier_discounted_price = 10000 (no tier discount since default=0)
    // partner_discount = 10000 * 0.08 = 800
    // unit_price = 10000 - 800 = 9200
    // effective_discount = 8% <= 10% -> auto-approved
    const approvedLine = makeLineRow({
      list_price: '10000.00',
      unit_price: '9200.00',
      discount_value: '8.00',
      discount_approved: true,
    });

    mockRepo.addLine.mockResolvedValue(approvedLine);
    mockRepo.getLines.mockResolvedValue([approvedLine]);
    mockRepo.getLineTotals.mockResolvedValue({ subtotal: 10000, totalAfterDiscounts: 9200, count: 1 });
    mockRepo.hasUnapprovedLines.mockResolvedValue(false);
    mockRepo.updateFields.mockResolvedValue(draftQuote);

    const res = await request(app)
      .post(`/api/v1/quotes/${QUOTE_ID}/lines`)
      .set('Authorization', 'Bearer mock-token')
      .send({ product_id: PRODUCT_ID, quantity: 1, discount_type: 'percentage', discount_value: 8 });

    expect(res.status).toBe(201);
    expect(res.body.data.discount_approved).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// QT-005: DISCOUNT APPROVAL — Band 2 (CM required)
// ═════════════════════════════════════════════════════════════════════════════

describe('QT-005: Discount approval Band 2 — CM approval required', () => {
  test('Submit with discount between tier_max and tier_max+15% goes to pending_approval', async () => {
    setupJwtAs('partner_rep');
    // Platinum tier: max=10, CM ceiling=25
    // A 22% effective discount requires CM approval
    const pendingQuote = makeQuoteRow({
      requires_approval: true,
      line_items: [makeLineRow({ discount_approved: false })],
    });
    mockRepo.findById.mockResolvedValue(pendingQuote);
    mockRepo.updateStatus.mockResolvedValue({
      ...pendingQuote,
      status: 'pending_approval',
      updated_at: new Date(),
    });

    // getHighestApprovalLevel evaluates unapproved lines
    mockRepo.getLines.mockResolvedValue([makeLineRow({ discount_approved: false })]);
    mockRepo.findOrganization.mockResolvedValue(makeOrgRow());
    mockRepo.findTierProductPricing.mockResolvedValue(null);
    mockRepo.findTier.mockResolvedValue(makeTierRow({ max_discount_pct: '10' }));

    const res = await request(app)
      .post(`/api/v1/quotes/${QUOTE_ID}/submit`)
      .set('Authorization', 'Bearer mock-token')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('pending_approval');
    expect(res.body.data.approval_level).toBe('channel_manager');
    // Approval request created and CM notified
    expect(mockRepo.createApprovalRequest).toHaveBeenCalledWith(
      expect.objectContaining({ entity_type: 'quote', entity_id: QUOTE_ID }),
      expect.anything(),
    );
    expect(mockNotif.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: USER_IDS.channelManager }),
    );
  });

  test('POST /quotes/:id/lines with discount requiring CM sets discount_approved=false (201)', async () => {
    setupJwtAs('partner_rep');
    const draftQuote = makeQuoteRow({ line_items: [] });
    mockRepo.findById.mockResolvedValue(draftQuote);

    const product = makeProductRow({ list_price: '10000.00' });
    mockRepo.findProduct.mockResolvedValue(product);
    mockRepo.findOrganization.mockResolvedValue(makeOrgRow());
    mockRepo.findTierProductPricing.mockResolvedValue(null);
    mockRepo.findTier.mockResolvedValue(makeTierRow({ default_discount_pct: '0', max_discount_pct: '10' }));

    // 22% effective discount > 10% but < 25% -> CM level -> discount_approved=false
    const unapprovedLine = makeLineRow({
      discount_approved: false,
      discount_value: '22.00',
      unit_price: '7800.00',
    });

    mockRepo.addLine.mockResolvedValue(unapprovedLine);
    mockRepo.getLines.mockResolvedValue([unapprovedLine]);
    mockRepo.getLineTotals.mockResolvedValue({ subtotal: 10000, totalAfterDiscounts: 7800, count: 1 });
    mockRepo.hasUnapprovedLines.mockResolvedValue(true);
    mockRepo.updateFields.mockResolvedValue({ ...draftQuote, requires_approval: true });

    const res = await request(app)
      .post(`/api/v1/quotes/${QUOTE_ID}/lines`)
      .set('Authorization', 'Bearer mock-token')
      .send({ product_id: PRODUCT_ID, quantity: 1, discount_type: 'percentage', discount_value: 22 });

    expect(res.status).toBe(201);
    expect(res.body.data.discount_approved).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// QT-006: DISCOUNT APPROVAL — Band 3 (admin required)
// ═════════════════════════════════════════════════════════════════════════════

describe('QT-006: Discount approval Band 3 — admin approval required', () => {
  test('CM cannot approve a quote requiring admin-level approval (403)', async () => {
    setupJwtAs('channel_manager', null);
    const pendingQuote = makeQuoteRow({
      status: 'pending_approval',
      line_items: [makeLineRow({ discount_approved: false })],
    });
    mockRepo.findById.mockResolvedValue(pendingQuote);

    // Line has 28% effective discount => admin level (Platinum: max=10, CM ceiling=25, 28>25)
    // list_price=10000, unit_price=7200 => effective = (10000-7200)/10000 = 28%
    mockRepo.getLines.mockResolvedValue([makeLineRow({
      discount_approved: false,
      list_price: '10000.00',
      unit_price: '7200.00',
    })]);
    mockRepo.findOrganization.mockResolvedValue(makeOrgRow());
    mockRepo.findTierProductPricing.mockResolvedValue(null);
    mockRepo.findTier.mockResolvedValue(makeTierRow({ max_discount_pct: '10' }));

    const res = await request(app)
      .post(`/api/v1/quotes/${QUOTE_ID}/approve`)
      .set('Authorization', 'Bearer mock-token')
      .send({ comments: 'Trying to approve as CM' });

    expect(res.status).toBe(403);
    expect(res.body.errors[0].message).toMatch(/admin/i);
  });

  test('Admin can approve a quote requiring admin-level approval (200)', async () => {
    setupJwtAs('admin', null);
    const pendingQuote = makeQuoteRow({
      status: 'pending_approval',
      line_items: [makeLineRow({ discount_approved: false })],
    });
    mockRepo.findById.mockResolvedValue(pendingQuote);

    mockRepo.getLines.mockResolvedValue([makeLineRow({
      discount_approved: false,
      list_price: '10000.00',
      unit_price: '7200.00',
    })]);
    mockRepo.findOrganization.mockResolvedValue(makeOrgRow());
    mockRepo.findTierProductPricing.mockResolvedValue(null);
    mockRepo.findTier.mockResolvedValue(makeTierRow({ max_discount_pct: '10' }));
    mockRepo.updateStatus.mockResolvedValue({
      ...pendingQuote,
      status: 'approved',
      approved_by: USER_IDS.admin,
      approved_at: new Date(),
      updated_at: new Date(),
    });
    mockRepo.approveAllLines.mockResolvedValue(1 as any);

    const res = await request(app)
      .post(`/api/v1/quotes/${QUOTE_ID}/approve`)
      .set('Authorization', 'Bearer mock-token')
      .send({ comments: 'Exceptional deal — approved at VP level' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('approved');
    expect(mockRepo.approveAllLines).toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// QT-007: REJECT QUOTE
// ═════════════════════════════════════════════════════════════════════════════

describe('QT-007: Reject quote with reason and notification', () => {
  test('POST /quotes/:id/reject sets status=rejected and notifies creator (200)', async () => {
    setupJwtAs('channel_manager', null);
    const reason = 'Discount on line 2 exceeds policy. Please reduce to 20% or below.';
    const pendingQuote = makeQuoteRow({
      status: 'pending_approval',
      line_items: [makeLineRow()],
    });
    mockRepo.findById.mockResolvedValue(pendingQuote);
    mockRepo.updateStatus.mockResolvedValue({
      ...pendingQuote,
      status: 'rejected',
      rejection_reason: reason,
      updated_at: new Date(),
    });

    const res = await request(app)
      .post(`/api/v1/quotes/${QUOTE_ID}/reject`)
      .set('Authorization', 'Bearer mock-token')
      .send({ rejection_reason: reason });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('rejected');
    expect(res.body.data.rejection_reason).toBe(reason);
    expect(mockNotif.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: USER_IDS.partnerRepA,
        type: 'quote_approval',
      }),
    );
    expect(mockRepo.updateApprovalRequest).toHaveBeenCalledWith(
      'quote',
      QUOTE_ID,
      'reject',
      reason,
      expect.anything(),
    );
  });

  test('POST /quotes/:id/reject without rejection_reason returns 422', async () => {
    setupJwtAs('channel_manager', null);

    const res = await request(app)
      .post(`/api/v1/quotes/${QUOTE_ID}/reject`)
      .set('Authorization', 'Bearer mock-token')
      .send({ rejection_reason: '' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  test('POST /quotes/:id/reject on non-pending quote returns 422 QUOTE_INVALID_TRANSITION', async () => {
    setupJwtAs('channel_manager', null);
    mockRepo.findById.mockResolvedValue(makeQuoteRow({ status: 'draft', line_items: [] }));

    const res = await request(app)
      .post(`/api/v1/quotes/${QUOTE_ID}/reject`)
      .set('Authorization', 'Bearer mock-token')
      .send({ rejection_reason: 'Cannot reject a draft' });

    expect(res.status).toBe(422);
    expect(res.body.errors[0].code).toBe('QUOTE_INVALID_TRANSITION');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// QT-008: CLONE QUOTE
// ═════════════════════════════════════════════════════════════════════════════

describe('QT-008: Clone quote — deep copy with current pricing', () => {
  test('POST /quotes/:id/clone creates new draft with same lines (201)', async () => {
    setupJwtAs('partner_rep');
    const originalLine = makeLineRow({ list_price: '50000.00', unit_price: '44000.00', quantity: 10 });
    const originalQuote = makeQuoteRow({
      status: 'approved',
      line_items: [originalLine],
      subtotal: 500000,
      total_amount: 440000,
    });
    mockRepo.findById.mockResolvedValue(originalQuote);
    mockRepo.findOrganization.mockResolvedValue(makeOrgRow());

    const newQuoteId = uuidv4();
    const clonedQuote = makeQuoteRow({
      id: newQuoteId,
      quote_number: 'QT-2026-00002',
      status: 'draft',
      subtotal: 500000,
      total_amount: 440000,
      line_items: [],
    });
    mockRepo.create.mockResolvedValue(clonedQuote);

    const freshProduct = makeProductRow({ list_price: '50000.00' });
    mockRepo.findProduct.mockResolvedValue(freshProduct);
    mockRepo.findTierProductPricing.mockResolvedValue({ discount_pct: '12', special_price: null });

    mockRepo.addLine.mockResolvedValue(originalLine);
    mockRepo.getLineTotals.mockResolvedValue({ subtotal: 500000, totalAfterDiscounts: 440000, count: 1 });
    mockRepo.hasUnapprovedLines.mockResolvedValue(false);
    mockRepo.updateFields.mockResolvedValue(clonedQuote);
    mockRepo.findRawById.mockResolvedValue(clonedQuote);
    mockRepo.getLines.mockResolvedValue([originalLine]);

    const res = await request(app)
      .post(`/api/v1/quotes/${QUOTE_ID}/clone`)
      .set('Authorization', 'Bearer mock-token')
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('draft');
    expect(res.body.data.quote_number).toBe('QT-2026-00002');
    // New quote should have been created
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'draft', customer_name: 'Acme Corp' }),
      expect.anything(),
    );
    // Re-snapshot pricing was done (findProduct called for each line)
    expect(mockRepo.findProduct).toHaveBeenCalledWith(PRODUCT_ID);
  });

  test('POST /quotes/:id/clone skips inactive products and returns warnings', async () => {
    setupJwtAs('partner_rep');
    const inactiveLine = makeLineRow({ product_name: 'Legacy PA-400', product_sku: 'PAN-PA-400' });
    const originalQuote = makeQuoteRow({
      status: 'accepted',
      line_items: [inactiveLine],
    });
    mockRepo.findById.mockResolvedValue(originalQuote);
    mockRepo.findOrganization.mockResolvedValue(makeOrgRow());

    const newQuote = makeQuoteRow({ id: uuidv4(), quote_number: 'QT-2026-00002', status: 'draft', line_items: [] });
    mockRepo.create.mockResolvedValue(newQuote);

    // Product is no longer active
    mockRepo.findProduct.mockResolvedValue({
      ...makeProductRow(),
      name: 'Legacy PA-400',
      sku: 'PAN-PA-400',
      is_active: false,
    });

    mockRepo.getLineTotals.mockResolvedValue({ subtotal: 0, totalAfterDiscounts: 0, count: 0 });
    mockRepo.hasUnapprovedLines.mockResolvedValue(false);
    mockRepo.updateFields.mockResolvedValue(newQuote);
    mockRepo.findRawById.mockResolvedValue(newQuote);
    mockRepo.getLines.mockResolvedValue([]);

    const res = await request(app)
      .post(`/api/v1/quotes/${QUOTE_ID}/clone`)
      .set('Authorization', 'Bearer mock-token')
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.meta.warnings).toBeDefined();
    expect(res.body.meta.warnings[0]).toMatch(/no longer active/i);
    // No line added for inactive product
    expect(mockRepo.addLine).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// QT-009: RECALCULATE
// ═════════════════════════════════════════════════════════════════════════════

describe('QT-009: Recalculate — refresh list_price and re-run waterfall', () => {
  test('POST /quotes/:id/recalculate refreshes all line pricing (200)', async () => {
    setupJwtAs('partner_rep');
    const oldLine = makeLineRow({ list_price: '50000.00', unit_price: '44000.00' });
    const draftQuote = makeQuoteRow({ line_items: [oldLine] });
    mockRepo.findById.mockResolvedValue(draftQuote);
    mockRepo.findOrganization.mockResolvedValue(makeOrgRow());

    // Admin updated product price to 52000
    mockRepo.getLines.mockResolvedValue([oldLine]);
    const updatedProduct = makeProductRow({ list_price: '52000.00' });
    mockRepo.findProduct.mockResolvedValue(updatedProduct);
    mockRepo.findTierProductPricing.mockResolvedValue({ discount_pct: '12', special_price: null });

    const updatedLine = { ...oldLine, list_price: '52000.00', unit_price: '45760.00', line_total: '457600.00' };
    mockRepo.updateLine.mockResolvedValue(updatedLine as any);
    mockRepo.getLineTotals.mockResolvedValue({ subtotal: 520000, totalAfterDiscounts: 457600, count: 1 });
    mockRepo.hasUnapprovedLines.mockResolvedValue(false);
    mockRepo.updateFields.mockResolvedValue(draftQuote);

    const recalcResult = { ...draftQuote, subtotal: 520000, total_amount: 457600, line_items: [updatedLine] };
    mockRepo.findRawById.mockResolvedValue(recalcResult);
    mockRepo.getLines.mockResolvedValue([updatedLine]);

    const res = await request(app)
      .post(`/api/v1/quotes/${QUOTE_ID}/recalculate`)
      .set('Authorization', 'Bearer mock-token')
      .send({});

    expect(res.status).toBe(200);
    // updateLine should have been called with refreshed list_price
    expect(mockRepo.updateLine).toHaveBeenCalledWith(
      LINE_ID,
      expect.objectContaining({ list_price: 52000 }),
      expect.anything(),
    );
  });

  test('POST /quotes/:id/recalculate on approved quote returns 422 QUOTE_INVALID_TRANSITION', async () => {
    setupJwtAs('partner_rep');
    mockRepo.findById.mockResolvedValue(makeQuoteRow({ status: 'approved', line_items: [] }));

    const res = await request(app)
      .post(`/api/v1/quotes/${QUOTE_ID}/recalculate`)
      .set('Authorization', 'Bearer mock-token')
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.errors[0].code).toBe('QUOTE_INVALID_TRANSITION');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// QT-010: RBAC — access control verification
// ═════════════════════════════════════════════════════════════════════════════

describe('QT-010: Role-based access control', () => {
  test('partner_rep cannot POST /quotes/:id/approve (403)', async () => {
    setupJwtAs('partner_rep');

    const res = await request(app)
      .post(`/api/v1/quotes/${QUOTE_ID}/approve`)
      .set('Authorization', 'Bearer mock-token')
      .send({});

    expect(res.status).toBe(403);
  });

  test('partner_rep cannot POST /quotes/:id/reject (403)', async () => {
    setupJwtAs('partner_rep');

    const res = await request(app)
      .post(`/api/v1/quotes/${QUOTE_ID}/reject`)
      .set('Authorization', 'Bearer mock-token')
      .send({ rejection_reason: 'Test' });

    expect(res.status).toBe(403);
  });

  test('channel_manager cannot POST /quotes (403 — authorize middleware blocks creation)', async () => {
    setupJwtAs('channel_manager', null);

    const res = await request(app)
      .post('/api/v1/quotes')
      .set('Authorization', 'Bearer mock-token')
      .send({ customer_name: 'Acme Corp' });

    expect(res.status).toBe(403);
  });

  test('admin cannot POST /quotes (403 — only partner roles can create quotes)', async () => {
    setupJwtAs('admin', null);

    const res = await request(app)
      .post('/api/v1/quotes')
      .set('Authorization', 'Bearer mock-token')
      .send({ customer_name: 'Acme Corp' });

    expect(res.status).toBe(403);
  });

  test('partner from org B cannot see org A quote (404 — org scoping)', async () => {
    setupJwtAs('partner_rep', ORG_IDS.orgB);
    // findById returns null because org scope filtered it
    mockRepo.findById.mockResolvedValue(null);

    const res = await request(app)
      .get(`/api/v1/quotes/${QUOTE_ID}`)
      .set('Authorization', 'Bearer mock-token');

    expect(res.status).toBe(404);
    // Must not be 403 (would reveal existence)
    expect(res.status).not.toBe(403);
  });

  test('partner_rep cannot update another reps quote (403)', async () => {
    setupJwtAs('partner_rep');
    // Quote was created by a different user
    const otherRepsQuote = makeQuoteRow({ created_by: USER_IDS.partnerAdminA });
    mockRepo.findById.mockResolvedValue(otherRepsQuote);

    const res = await request(app)
      .patch(`/api/v1/quotes/${QUOTE_ID}`)
      .set('Authorization', 'Bearer mock-token')
      .send({ customer_name: 'Updated Name' });

    expect(res.status).toBe(403);
  });

  test('partner_admin can submit quotes not created by them (submit is not creator-restricted)', async () => {
    setupJwtAs('partner_admin');
    // Quote created by a different user — partner_admin should still be able to submit
    const draftByOtherUser = makeQuoteRow({
      created_by: USER_IDS.partnerRepA,
      requires_approval: false,
      line_items: [makeLineRow()],
    });
    mockRepo.findById.mockResolvedValue(draftByOtherUser);
    mockRepo.updateStatus.mockResolvedValue({
      ...draftByOtherUser,
      status: 'approved',
      updated_at: new Date(),
    });

    const res = await request(app)
      .post(`/api/v1/quotes/${QUOTE_ID}/submit`)
      .set('Authorization', 'Bearer mock-token')
      .send({});

    expect(res.status).toBe(200);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// QT-011: INVALID TRANSITIONS
// ═════════════════════════════════════════════════════════════════════════════

describe('QT-011: Invalid status transitions', () => {
  test('Approve a draft quote returns 422 QUOTE_INVALID_TRANSITION', async () => {
    setupJwtAs('channel_manager', null);
    mockRepo.findById.mockResolvedValue(makeQuoteRow({ status: 'draft', line_items: [] }));

    const res = await request(app)
      .post(`/api/v1/quotes/${QUOTE_ID}/approve`)
      .set('Authorization', 'Bearer mock-token')
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.errors[0].code).toBe('QUOTE_INVALID_TRANSITION');
  });

  test('Submit quote with 0 line items returns 422 QUOTE_INCOMPLETE', async () => {
    setupJwtAs('partner_rep');
    const emptyQuote = makeQuoteRow({ line_items: [], requires_approval: false });
    mockRepo.findById.mockResolvedValue(emptyQuote);

    const res = await request(app)
      .post(`/api/v1/quotes/${QUOTE_ID}/submit`)
      .set('Authorization', 'Bearer mock-token')
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.errors[0].code).toBe('QUOTE_INCOMPLETE');
    expect(res.body.errors[0].message).toMatch(/at least one line item/i);
  });

  test('PATCH quote in approved status returns 422 QUOTE_INVALID_TRANSITION', async () => {
    setupJwtAs('partner_rep');
    mockRepo.findById.mockResolvedValue(makeQuoteRow({ status: 'approved', line_items: [] }));

    const res = await request(app)
      .patch(`/api/v1/quotes/${QUOTE_ID}`)
      .set('Authorization', 'Bearer mock-token')
      .send({ customer_name: 'New Name' });

    expect(res.status).toBe(422);
    expect(res.body.errors[0].code).toBe('QUOTE_INVALID_TRANSITION');
  });

  test('DELETE quote in submitted/pending status returns 422 QUOTE_INVALID_TRANSITION', async () => {
    setupJwtAs('partner_rep');
    mockRepo.findById.mockResolvedValue(makeQuoteRow({ status: 'pending_approval', line_items: [] }));

    const res = await request(app)
      .delete(`/api/v1/quotes/${QUOTE_ID}`)
      .set('Authorization', 'Bearer mock-token');

    expect(res.status).toBe(422);
    expect(res.body.errors[0].code).toBe('QUOTE_INVALID_TRANSITION');
  });

  test('ADD line item to approved quote returns 422 QUOTE_INVALID_TRANSITION', async () => {
    setupJwtAs('partner_rep');
    mockRepo.findById.mockResolvedValue(makeQuoteRow({ status: 'approved', line_items: [] }));

    const res = await request(app)
      .post(`/api/v1/quotes/${QUOTE_ID}/lines`)
      .set('Authorization', 'Bearer mock-token')
      .send({ product_id: PRODUCT_ID, quantity: 1 });

    expect(res.status).toBe(422);
    expect(res.body.errors[0].code).toBe('QUOTE_INVALID_TRANSITION');
  });

  test('Send a draft quote (not approved) returns 422 QUOTE_INVALID_TRANSITION', async () => {
    setupJwtAs('partner_rep');
    mockRepo.findById.mockResolvedValue(makeQuoteRow({ status: 'draft', line_items: [] }));

    const res = await request(app)
      .post(`/api/v1/quotes/${QUOTE_ID}/send`)
      .set('Authorization', 'Bearer mock-token')
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.errors[0].code).toBe('QUOTE_INVALID_TRANSITION');
  });

  test('Accept a quote that has not been sent returns 422 QUOTE_INVALID_TRANSITION', async () => {
    setupJwtAs('partner_rep');
    mockRepo.findById.mockResolvedValue(makeQuoteRow({ status: 'approved', line_items: [] }));

    const res = await request(app)
      .post(`/api/v1/quotes/${QUOTE_ID}/accept`)
      .set('Authorization', 'Bearer mock-token')
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.errors[0].code).toBe('QUOTE_INVALID_TRANSITION');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// QT-012: LINE ITEM CRUD — add, totals, update, recalc, remove
// ═════════════════════════════════════════════════════════════════════════════

describe('QT-012: Line item CRUD with totals verification', () => {
  test('Add multiple lines — subtotal is sum of qty * list_price (201)', async () => {
    setupJwtAs('partner_rep');
    const line1 = makeLineRow({ id: 'line-1', quantity: 10, list_price: '1000.00', unit_price: '900.00', line_total: '9000.00', discount_approved: true });
    const line2 = makeLineRow({ id: 'line-2', quantity: 5, list_price: '2000.00', unit_price: '1700.00', line_total: '8500.00', discount_approved: true });
    const draftQuote = makeQuoteRow({ line_items: [line1] });

    mockRepo.findById.mockResolvedValue(draftQuote);
    const product = makeProductRow({ list_price: '2000.00' });
    mockRepo.findProduct.mockResolvedValue(product);
    mockRepo.findOrganization.mockResolvedValue(makeOrgRow());
    mockRepo.findTierProductPricing.mockResolvedValue({ discount_pct: '15', special_price: null });
    mockRepo.addLine.mockResolvedValue(line2);
    mockRepo.getLines.mockResolvedValue([line1, line2]);

    // subtotal = 10*1000 + 5*2000 = 20000
    // total_after_discounts = 9000 + 8500 = 17500
    // total_discount = 20000 - 17500 = 2500
    mockRepo.getLineTotals.mockResolvedValue({ subtotal: 20000, totalAfterDiscounts: 17500, count: 2 });
    mockRepo.hasUnapprovedLines.mockResolvedValue(false);
    mockRepo.updateFields.mockResolvedValue({
      ...draftQuote,
      subtotal: 20000,
      total_discount: 2500,
      total_amount: 17500,
    });

    const res = await request(app)
      .post(`/api/v1/quotes/${QUOTE_ID}/lines`)
      .set('Authorization', 'Bearer mock-token')
      .send({ product_id: PRODUCT_ID, quantity: 5, discount_type: 'percentage', discount_value: 15 });

    expect(res.status).toBe(201);
    // Verify recalculation was triggered
    expect(mockRepo.getLineTotals).toHaveBeenCalled();
    expect(mockRepo.updateFields).toHaveBeenCalledWith(
      QUOTE_ID,
      expect.objectContaining({
        subtotal: 20000,
        total_discount: 2500,
        total_amount: 17500,
      }),
      expect.anything(),
    );
  });

  test('PATCH /quotes/:id/lines/:lineId — update quantity triggers recalculation (200)', async () => {
    setupJwtAs('partner_rep');
    const existingLine = makeLineRow({ quantity: 10, discount_value: '12.00', discount_approved: true });
    const draftQuote = makeQuoteRow({ line_items: [existingLine] });

    mockRepo.findById.mockResolvedValue(draftQuote);
    mockRepo.findLineById.mockResolvedValue(existingLine);
    mockRepo.findOrganization.mockResolvedValue(makeOrgRow());
    mockRepo.findTierProductPricing.mockResolvedValue({ discount_pct: '15', special_price: null });

    const updatedLine = { ...existingLine, quantity: 15, line_total: '660000.00' };
    mockRepo.updateLine.mockResolvedValue(updatedLine as any);
    mockRepo.getLines.mockResolvedValue([updatedLine]);
    mockRepo.getLineTotals.mockResolvedValue({ subtotal: 750000, totalAfterDiscounts: 660000, count: 1 });
    mockRepo.hasUnapprovedLines.mockResolvedValue(false);
    mockRepo.updateFields.mockResolvedValue(draftQuote);

    const res = await request(app)
      .patch(`/api/v1/quotes/${QUOTE_ID}/lines/${LINE_ID}`)
      .set('Authorization', 'Bearer mock-token')
      .send({ quantity: 15 });

    expect(res.status).toBe(200);
    expect(mockRepo.updateLine).toHaveBeenCalledWith(
      LINE_ID,
      expect.objectContaining({ quantity: 15 }),
      expect.anything(),
    );
    // Totals recalculated
    expect(mockRepo.getLineTotals).toHaveBeenCalled();
  });

  test('PATCH line discount increase above threshold flips discount_approved to false (200)', async () => {
    setupJwtAs('partner_rep');
    // Existing line was auto-approved at 12% (within Platinum 10% — wait, 12 > 10)
    // The key behavior: after update discount increases beyond threshold, discount_approved=false
    const existingLine = makeLineRow({
      quantity: 10,
      discount_value: '12.00',
      list_price: '50000.00',
      unit_price: '44000.00',
      discount_approved: true, // was approved (e.g., tier_product_pricing gave 20% ceiling)
    });
    const draftQuote = makeQuoteRow({ line_items: [existingLine] });

    mockRepo.findById.mockResolvedValue(draftQuote);
    mockRepo.findLineById.mockResolvedValue(existingLine);
    mockRepo.findOrganization.mockResolvedValue(makeOrgRow());
    // Now no tier_product_pricing override -> falls back to tier max=10
    // New discount_value=18 -> effective 18% > 10% -> unapproved
    mockRepo.findTierProductPricing.mockResolvedValue(null);
    mockRepo.findTier.mockResolvedValue(makeTierRow({ default_discount_pct: '0', max_discount_pct: '10' }));

    const unapprovedLine = { ...existingLine, discount_value: '18.00', discount_approved: false };
    mockRepo.updateLine.mockResolvedValue(unapprovedLine as any);
    mockRepo.getLines.mockResolvedValue([unapprovedLine]);
    mockRepo.getLineTotals.mockResolvedValue({ subtotal: 500000, totalAfterDiscounts: 410000, count: 1 });
    mockRepo.hasUnapprovedLines.mockResolvedValue(true);
    mockRepo.updateFields.mockResolvedValue({ ...draftQuote, requires_approval: true });

    const res = await request(app)
      .patch(`/api/v1/quotes/${QUOTE_ID}/lines/${LINE_ID}`)
      .set('Authorization', 'Bearer mock-token')
      .send({ discount_value: 18 });

    expect(res.status).toBe(200);
    expect(res.body.data.discount_approved).toBe(false);
    // requires_approval updated to true
    expect(mockRepo.updateFields).toHaveBeenCalledWith(
      QUOTE_ID,
      expect.objectContaining({ requires_approval: true }),
      expect.anything(),
    );
  });

  test('DELETE /quotes/:id/lines/:lineId recalculates totals and requires_approval (200)', async () => {
    setupJwtAs('partner_rep');
    const line1 = makeLineRow({ id: 'line-1', line_total: '200000.00', discount_approved: true });
    const line2 = makeLineRow({ id: LINE_ID, line_total: '300000.00', discount_approved: false });
    const draftQuote = makeQuoteRow({
      line_items: [line1, line2],
      requires_approval: true,
      subtotal: 500000,
    });
    mockRepo.findById.mockResolvedValue(draftQuote);
    mockRepo.findLineById.mockResolvedValue(line2);
    mockRepo.removeLine.mockResolvedValue(1 as any);

    // After removal of the only unapproved line, requires_approval flips to false
    mockRepo.getLineTotals.mockResolvedValue({ subtotal: 200000, totalAfterDiscounts: 200000, count: 1 });
    mockRepo.hasUnapprovedLines.mockResolvedValue(false);
    mockRepo.updateFields.mockResolvedValue({
      ...draftQuote,
      subtotal: 200000,
      total_discount: 0,
      total_amount: 200000,
      requires_approval: false,
    });

    const res = await request(app)
      .delete(`/api/v1/quotes/${QUOTE_ID}/lines/${LINE_ID}`)
      .set('Authorization', 'Bearer mock-token');

    expect(res.status).toBe(200);
    expect(res.body.data.removed).toBe(true);
    expect(mockRepo.removeLine).toHaveBeenCalledWith(LINE_ID, expect.anything());
    // requires_approval flipped to false since only unapproved line was removed
    expect(mockRepo.updateFields).toHaveBeenCalledWith(
      QUOTE_ID,
      expect.objectContaining({ requires_approval: false }),
      expect.anything(),
    );
  });

  test('DELETE /quotes/:id/lines/:lineId on wrong quote returns 404', async () => {
    setupJwtAs('partner_rep');
    const draftQuote = makeQuoteRow({ line_items: [] });
    mockRepo.findById.mockResolvedValue(draftQuote);
    // Line belongs to a different quote
    mockRepo.findLineById.mockResolvedValue({ id: LINE_ID, quote_id: 'different-quote-id' });

    const res = await request(app)
      .delete(`/api/v1/quotes/${QUOTE_ID}/lines/${LINE_ID}`)
      .set('Authorization', 'Bearer mock-token');

    expect(res.status).toBe(404);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// VALIDATION EDGE CASES
// ═════════════════════════════════════════════════════════════════════════════

describe('Validation edge cases', () => {
  test('POST /quotes missing customer_name (standalone) returns 422', async () => {
    setupJwtAs('partner_rep');

    const res = await request(app)
      .post('/api/v1/quotes')
      .set('Authorization', 'Bearer mock-token')
      .send({ payment_terms: 'Net 30' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  test('POST /quotes/:id/lines with percentage discount > 100 returns 422', async () => {
    setupJwtAs('partner_rep');

    const res = await request(app)
      .post(`/api/v1/quotes/${QUOTE_ID}/lines`)
      .set('Authorization', 'Bearer mock-token')
      .send({
        product_id: PRODUCT_ID,
        quantity: 1,
        discount_type: 'percentage',
        discount_value: 120,
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  test('POST /quotes/:id/lines with quantity=0 returns 422', async () => {
    setupJwtAs('partner_rep');

    const res = await request(app)
      .post(`/api/v1/quotes/${QUOTE_ID}/lines`)
      .set('Authorization', 'Bearer mock-token')
      .send({ product_id: PRODUCT_ID, quantity: 0 });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  test('POST /quotes/:id/lines with negative quantity returns 422', async () => {
    setupJwtAs('partner_rep');

    const res = await request(app)
      .post(`/api/v1/quotes/${QUOTE_ID}/lines`)
      .set('Authorization', 'Bearer mock-token')
      .send({ product_id: PRODUCT_ID, quantity: -5 });

    expect(res.status).toBe(422);
  });

  test('POST /quotes/:id/lines with inactive product returns 422 PRODUCT_UNAVAILABLE', async () => {
    setupJwtAs('partner_rep');
    const draftQuote = makeQuoteRow({ line_items: [] });
    mockRepo.findById.mockResolvedValue(draftQuote);
    mockRepo.findProduct.mockResolvedValue(makeProductRow({ is_active: false }));
    mockRepo.findOrganization.mockResolvedValue(makeOrgRow());

    const res = await request(app)
      .post(`/api/v1/quotes/${QUOTE_ID}/lines`)
      .set('Authorization', 'Bearer mock-token')
      .send({ product_id: PRODUCT_ID, quantity: 1 });

    expect(res.status).toBe(422);
    expect(res.body.errors[0].code).toBe('PRODUCT_UNAVAILABLE');
  });

  test('POST /quotes/:id/lines with fixed_amount discount resulting in negative price returns 422 QUOTE_INVALID_DISCOUNT', async () => {
    setupJwtAs('partner_rep');
    const draftQuote = makeQuoteRow({ line_items: [] });
    mockRepo.findById.mockResolvedValue(draftQuote);
    mockRepo.findProduct.mockResolvedValue(makeProductRow({ list_price: '10000.00' }));
    mockRepo.findOrganization.mockResolvedValue(makeOrgRow());
    mockRepo.findTierProductPricing.mockResolvedValue(null);
    mockRepo.findTier.mockResolvedValue(makeTierRow({ default_discount_pct: '0' }));

    // Fixed discount of 60000 on a 10000 product -> negative price
    const res = await request(app)
      .post(`/api/v1/quotes/${QUOTE_ID}/lines`)
      .set('Authorization', 'Bearer mock-token')
      .send({ product_id: PRODUCT_ID, quantity: 1, discount_type: 'fixed_amount', discount_value: 60000 });

    expect(res.status).toBe(422);
    expect(res.body.errors[0].code).toBe('QUOTE_INVALID_DISCOUNT');
    expect(res.body.errors[0].message).toMatch(/negative unit price/i);
  });

  test('GET /quotes/:id returns 404 for non-existent quote', async () => {
    setupJwtAs('partner_rep');
    mockRepo.findById.mockResolvedValue(null);

    const res = await request(app)
      .get(`/api/v1/quotes/${QUOTE_ID}`)
      .set('Authorization', 'Bearer mock-token');

    expect(res.status).toBe(404);
  });

  test('PATCH /quotes/:id with no valid fields returns 422 (min(1) schema)', async () => {
    setupJwtAs('partner_rep');

    const res = await request(app)
      .patch(`/api/v1/quotes/${QUOTE_ID}`)
      .set('Authorization', 'Bearer mock-token')
      .send({});

    expect(res.status).toBe(422);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// QUOTE CRUD — update and delete
// ═════════════════════════════════════════════════════════════════════════════

describe('Quote CRUD — update and delete', () => {
  test('PATCH /quotes/:id updates header fields on draft quote (200)', async () => {
    setupJwtAs('partner_rep');
    const draftQuote = makeQuoteRow();
    const updatedQuote = { ...draftQuote, customer_name: 'Acme Corp International' };
    mockRepo.findById
      .mockResolvedValueOnce(draftQuote)
      .mockResolvedValueOnce(updatedQuote);
    mockRepo.updateFields.mockResolvedValue(updatedQuote);

    const res = await request(app)
      .patch(`/api/v1/quotes/${QUOTE_ID}`)
      .set('Authorization', 'Bearer mock-token')
      .send({ customer_name: 'Acme Corp International' });

    expect(res.status).toBe(200);
    expect(res.body.data.customer_name).toBe('Acme Corp International');
    expect(mockRepo.updateFields).toHaveBeenCalledWith(
      QUOTE_ID,
      expect.objectContaining({ customer_name: 'Acme Corp International' }),
    );
  });

  test('DELETE /quotes/:id deletes draft quote (200)', async () => {
    setupJwtAs('partner_rep');
    const draftQuote = makeQuoteRow({ status: 'draft' });
    mockRepo.findById.mockResolvedValue(draftQuote);
    mockRepo.deleteQuote.mockResolvedValue(1 as any);

    const res = await request(app)
      .delete(`/api/v1/quotes/${QUOTE_ID}`)
      .set('Authorization', 'Bearer mock-token');

    expect(res.status).toBe(200);
    expect(res.body.data.deleted).toBe(true);
    expect(mockRepo.deleteQuote).toHaveBeenCalledWith(QUOTE_ID);
  });

  test('GET /quotes lists quotes with pagination meta (200)', async () => {
    setupJwtAs('partner_admin');
    mockRepo.list.mockResolvedValue({
      data: [makeQuoteRow(), makeQuoteRow({ id: uuidv4(), quote_number: 'QT-2026-00002' })],
      total: 2,
    });

    const res = await request(app)
      .get('/api/v1/quotes?per_page=10&page=1')
      .set('Authorization', 'Bearer mock-token');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toMatchObject({ total: 2 });
  });

  test('GET /quotes/:id/history returns status history (200)', async () => {
    setupJwtAs('partner_rep');
    mockRepo.findById.mockResolvedValue(makeQuoteRow());
    mockRepo.getStatusHistory.mockResolvedValue([
      { id: 'h1', from_status: null, to_status: 'draft', changed_by: USER_IDS.partnerRepA, notes: 'Quote created', created_at: new Date() },
      { id: 'h2', from_status: 'draft', to_status: 'approved', changed_by: USER_IDS.partnerRepA, notes: 'Auto-approved', created_at: new Date() },
    ] as any);

    const res = await request(app)
      .get(`/api/v1/quotes/${QUOTE_ID}/history`)
      .set('Authorization', 'Bearer mock-token');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].from_status).toBeNull();
    expect(res.body.data[0].to_status).toBe('draft');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SEND AND ACCEPT LIFECYCLE
// ═════════════════════════════════════════════════════════════════════════════

describe('Send and accept lifecycle', () => {
  test('POST /quotes/:id/send transitions approved -> sent_to_customer (200)', async () => {
    setupJwtAs('partner_rep');
    const approvedQuote = makeQuoteRow({ status: 'approved', line_items: [] });
    mockRepo.findById.mockResolvedValue(approvedQuote);
    mockRepo.updateStatus.mockResolvedValue({
      ...approvedQuote,
      status: 'sent_to_customer',
      pdf_url: null,
      updated_at: new Date(),
    });

    const res = await request(app)
      .post(`/api/v1/quotes/${QUOTE_ID}/send`)
      .set('Authorization', 'Bearer mock-token')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('sent_to_customer');
  });

  test('POST /quotes/:id/accept transitions sent_to_customer -> accepted (200)', async () => {
    setupJwtAs('partner_rep');
    const sentQuote = makeQuoteRow({ status: 'sent_to_customer', line_items: [] });
    mockRepo.findById.mockResolvedValue(sentQuote);
    mockRepo.updateStatus.mockResolvedValue({
      ...sentQuote,
      status: 'accepted',
      updated_at: new Date(),
    });

    const res = await request(app)
      .post(`/api/v1/quotes/${QUOTE_ID}/accept`)
      .set('Authorization', 'Bearer mock-token')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('accepted');
  });
});
