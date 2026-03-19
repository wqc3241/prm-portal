/**
 * Unit tests for QuoteService — pricing waterfall and discount evaluation.
 *
 * These tests call the service methods in complete isolation with all external
 * dependencies (repositories, database, notifications) mocked. No HTTP layer
 * is involved — we test pure business logic.
 *
 * Test coverage:
 *   PW-001  calculateLinePriceFromSnapshot — tier_product_pricing override (discount_pct)
 *   PW-002  calculateLinePriceFromSnapshot — special_price override
 *   PW-003  calculateLinePriceFromSnapshot — fallback to tier.default_discount_pct
 *   PW-004  calculateLinePriceFromSnapshot — fixed_amount discount type
 *   PW-005  calculateLinePriceFromSnapshot — no tier (tierId=null)
 *   PW-006  calculateLinePriceFromSnapshot — zero partner discount
 *   PW-007  calculateLinePriceFromSnapshot — negative unit price throws QUOTE_INVALID_DISCOUNT
 *   PW-008  calculateLinePriceFromSnapshot — fixed_amount negative throws with correct message
 *   PW-009  calculateLinePriceFromSnapshot — result rounded to 2 decimal places
 *   PW-010  calculateLinePriceFromSnapshot — discount exactly at 100% (unit_price = 0, valid edge)
 *
 *   DA-001  evaluateDiscount — Band 1: auto-approve (effective <= self_approve_ceiling)
 *   DA-002  evaluateDiscount — Band 1 boundary: effective equals self_approve_ceiling exactly
 *   DA-003  evaluateDiscount — Band 2: CM required (effective > ceiling, <= ceiling + 15)
 *   DA-004  evaluateDiscount — Band 2 boundary: effective equals ceiling + 15 exactly
 *   DA-005  evaluateDiscount — Band 3: admin required (effective > ceiling + 15)
 *   DA-006  evaluateDiscount — tier_product_pricing.discount_pct overrides tier.max_discount_pct
 *   DA-007  evaluateDiscount — 0% effective discount always auto-approved
 *   DA-008  evaluateDiscount — zero list_price guard (no division by zero)
 *   DA-009  evaluateDiscount — fallback to tier.max_discount_pct when no tier_product_pricing
 *   DA-010  evaluateDiscount — effective_discount_pct rounded to 2 decimal places in return value
 *
 *   PRD scenarios from Appendix D verified in PW-011 and DA-011
 */

// ── Mocks (before all imports) ────────────────────────────────────────────────

jest.mock('../../src/repositories/quote.repository', () => ({
  __esModule: true,
  default: {
    findProduct: jest.fn(),
    findTierProductPricing: jest.fn(),
    findTier: jest.fn(),
    findOrganization: jest.fn(),
    // All other methods stubbed as no-ops
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
    findDeal: jest.fn(),
    transaction: jest.fn(),
  },
}));

jest.mock('../../src/services/notification.service', () => ({
  __esModule: true,
  default: { createNotification: jest.fn() },
}));

const mockDbChain: any = {
  select: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  first: jest.fn().mockResolvedValue(null),
};
const mockDb = jest.fn(() => mockDbChain);
(mockDb as any).raw = jest.fn();
(mockDb as any).fn = { now: jest.fn(() => new Date()) };
(mockDb as any).transaction = jest.fn();

jest.mock('../../src/config/database', () => ({
  __esModule: true,
  default: mockDb,
}));

// ── Imports ───────────────────────────────────────────────────────────────────

import quoteService from '../../src/services/quote.service';
import quoteRepository from '../../src/repositories/quote.repository';
import { TIER_IDS, ORG_IDS } from '../fixtures/factories';
import { v4 as uuidv4 } from 'uuid';

const mockRepo = quoteRepository as jest.Mocked<typeof quoteRepository>;

// ── Constants ─────────────────────────────────────────────────────────────────

const PRODUCT_ID = uuidv4();
const TIER_ID = TIER_IDS.platinum;

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTier(overrides: Record<string, any> = {}) {
  return {
    id: TIER_ID,
    name: 'Platinum Innovator',
    default_discount_pct: '10',
    max_discount_pct: '10',
    ...overrides,
  };
}

function makeTierPricing(overrides: Record<string, any> = {}) {
  return {
    tier_id: TIER_ID,
    product_id: PRODUCT_ID,
    discount_pct: '15',
    special_price: null,
    ...overrides,
  };
}

// ── beforeEach ────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

// ═════════════════════════════════════════════════════════════════════════════
// PRICING WATERFALL — calculateLinePriceFromSnapshot
// ═════════════════════════════════════════════════════════════════════════════

describe('Pricing waterfall — calculateLinePriceFromSnapshot', () => {
  /**
   * PW-001: tier_product_pricing.discount_pct overrides tier default.
   * list_price=10000, tier_product_pricing.discount_pct=10, partner=5%
   *   tier_discounted_price = 10000 * (1 - 0.10) = 9000
   *   partner_discount_amount = 9000 * 0.05 = 450
   *   unit_price = 9000 - 450 = 8550
   */
  test('PW-001: tier_product_pricing.discount_pct applied before partner discount', async () => {
    mockRepo.findTierProductPricing.mockResolvedValue(makeTierPricing({ discount_pct: '10' }));

    const result = await quoteService.calculateLinePriceFromSnapshot(
      PRODUCT_ID,
      10000,
      TIER_ID,
      'percentage',
      5,
      1,
    );

    expect(result.list_price).toBe(10000);
    expect(result.tier_discount_pct).toBe(10);
    expect(result.tier_discounted_price).toBe(9000);
    expect(result.partner_discount_amount).toBe(450);
    expect(result.unit_price).toBe(8550);
    expect(result.volume_discount_pct).toBe(0); // Phase 3 placeholder
  });

  /**
   * PW-002: special_price overrides all tier discount calculations.
   * list_price=10000, special_price=7500, partner=0%
   *   tier_discounted_price = 7500 (special price)
   *   tier_discount_applied = (10000-7500)/10000 * 100 = 25%
   *   unit_price = 7500
   */
  test('PW-002: special_price takes absolute precedence over discount_pct', async () => {
    mockRepo.findTierProductPricing.mockResolvedValue(
      makeTierPricing({ discount_pct: null, special_price: '7500' }),
    );

    const result = await quoteService.calculateLinePriceFromSnapshot(
      PRODUCT_ID,
      10000,
      TIER_ID,
      'percentage',
      0,
      1,
    );

    expect(result.tier_discounted_price).toBe(7500);
    expect(result.tier_discount_pct).toBeCloseTo(25, 1);
    expect(result.unit_price).toBe(7500);
  });

  /**
   * PW-003: No tier_product_pricing row -> fall back to tier.default_discount_pct.
   * list_price=10000, tier.default_discount_pct=5, partner=3%
   *   tier_discounted_price = 10000 * 0.95 = 9500
   *   partner_discount = 9500 * 0.03 = 285
   *   unit_price = 9215
   */
  test('PW-003: falls back to tier.default_discount_pct when no tier_product_pricing', async () => {
    mockRepo.findTierProductPricing.mockResolvedValue(null);
    mockRepo.findTier.mockResolvedValue(makeTier({ default_discount_pct: '5' }));

    const result = await quoteService.calculateLinePriceFromSnapshot(
      PRODUCT_ID,
      10000,
      TIER_ID,
      'percentage',
      3,
      1,
    );

    expect(result.tier_discount_pct).toBe(5);
    expect(result.tier_discounted_price).toBe(9500);
    expect(result.partner_discount_amount).toBeCloseTo(285, 2);
    expect(result.unit_price).toBe(9215);
  });

  /**
   * PW-004: fixed_amount discount type.
   * list_price=10000, no tier pricing, tier_discounted_price=9000 (10% tier)
   *   fixed discount = 500
   *   unit_price = 9000 - 500 = 8500
   */
  test('PW-004: fixed_amount discount subtracts dollar amount from tier_discounted_price', async () => {
    mockRepo.findTierProductPricing.mockResolvedValue(makeTierPricing({ discount_pct: '10' }));

    const result = await quoteService.calculateLinePriceFromSnapshot(
      PRODUCT_ID,
      10000,
      TIER_ID,
      'fixed_amount',
      500,
      1,
    );

    expect(result.tier_discounted_price).toBe(9000);
    expect(result.partner_discount_amount).toBe(500);
    expect(result.unit_price).toBe(8500);
    expect(result.partner_discount_type).toBe('fixed_amount');
    expect(result.partner_discount_value).toBe(500);
  });

  /**
   * PW-005: No tier (tierId=null) — no tier discount applied.
   * list_price=10000, partner=5%
   *   tier_discounted_price = 10000 (no tier)
   *   partner_discount = 10000 * 0.05 = 500
   *   unit_price = 9500
   */
  test('PW-005: no tier ID means zero tier discount', async () => {
    const result = await quoteService.calculateLinePriceFromSnapshot(
      PRODUCT_ID,
      10000,
      null, // no tier
      'percentage',
      5,
      1,
    );

    expect(result.tier_discount_pct).toBe(0);
    expect(result.tier_discounted_price).toBe(10000);
    expect(result.unit_price).toBe(9500);
  });

  /**
   * PW-006: Zero partner discount — unit_price equals tier_discounted_price.
   */
  test('PW-006: zero partner discount returns tier_discounted_price as unit_price', async () => {
    mockRepo.findTierProductPricing.mockResolvedValue(makeTierPricing({ discount_pct: '15' }));

    const result = await quoteService.calculateLinePriceFromSnapshot(
      PRODUCT_ID,
      10000,
      TIER_ID,
      'percentage',
      0,
      5,
    );

    expect(result.partner_discount_amount).toBe(0);
    expect(result.unit_price).toBe(8500); // 10000 * (1 - 0.15) = 8500
  });

  /**
   * PW-007: Percentage discount causes negative unit_price — should throw.
   * list_price=10000, no tier, partner=150% — clearly impossible
   */
  test('PW-007: negative unit_price from percentage throws QUOTE_INVALID_DISCOUNT', async () => {
    mockRepo.findTierProductPricing.mockResolvedValue(null);
    mockRepo.findTier.mockResolvedValue(makeTier({ default_discount_pct: '0' }));

    // 150% of list_price > list_price -> unit_price goes negative
    // Note: validator normally blocks >100%, but service guards defensively
    await expect(
      quoteService.calculateLinePriceFromSnapshot(
        PRODUCT_ID,
        10000,
        TIER_ID,
        'percentage',
        101, // barely over 100% applied to tier_discounted = list = 10000
        1,
      ),
    ).rejects.toMatchObject({
      code: 'QUOTE_INVALID_DISCOUNT',
      statusCode: 422,
    });
  });

  /**
   * PW-008: fixed_amount discount exceeding tier_discounted_price throws with
   *         message that includes the maximum allowed fixed discount.
   */
  test('PW-008: fixed_amount negative price throws with max-allowed message', async () => {
    mockRepo.findTierProductPricing.mockResolvedValue(null);
    mockRepo.findTier.mockResolvedValue(makeTier({ default_discount_pct: '0' }));

    // list_price=10000, no tier discount, fixed discount=15000 > 10000
    await expect(
      quoteService.calculateLinePriceFromSnapshot(
        PRODUCT_ID,
        10000,
        TIER_ID,
        'fixed_amount',
        15000,
        1,
      ),
    ).rejects.toMatchObject({
      code: 'QUOTE_INVALID_DISCOUNT',
      statusCode: 422,
      message: expect.stringContaining('10000.00'), // shows the ceiling
    });
  });

  /**
   * PW-009: Floating-point result rounded to 2 decimal places.
   * list_price=10000, tier discount=3% (=9700), partner=3.333...%
   *   partner_discount = 9700 * 0.03333 = ~323.333...
   *   unit_price = 9700 - 323.33... = 9376.666... -> should round to 9376.67
   */
  test('PW-009: unit_price is rounded to 2 decimal places', async () => {
    mockRepo.findTierProductPricing.mockResolvedValue(null);
    mockRepo.findTier.mockResolvedValue(makeTier({ default_discount_pct: '3' }));

    const result = await quoteService.calculateLinePriceFromSnapshot(
      PRODUCT_ID,
      10000,
      TIER_ID,
      'percentage',
      100 / 3, // 33.333...% of tier_discounted_price
      1,
    );

    // Result should have at most 2 decimal places
    const decimalStr = result.unit_price.toString().split('.')[1] || '';
    expect(decimalStr.length).toBeLessThanOrEqual(2);
  });

  /**
   * PW-010: PRD Appendix D full worked example.
   * Product: Cortex XDR, list_price=25000
   * Tier: Platinum, tier_product_pricing.discount_pct=18
   * Partner: 5% percentage
   *
   *   tier_discounted_price = 25000 * 0.82 = 20500
   *   partner_discount = 20500 * 0.05 = 1025
   *   unit_price = 19475
   */
  test('PW-010: PRD Appendix D — Cortex XDR worked example', async () => {
    mockRepo.findTierProductPricing.mockResolvedValue(makeTierPricing({ discount_pct: '18' }));

    const result = await quoteService.calculateLinePriceFromSnapshot(
      PRODUCT_ID,
      25000,
      TIER_ID,
      'percentage',
      5,
      20,
    );

    expect(result.list_price).toBe(25000);
    expect(result.tier_discount_pct).toBe(18);
    expect(result.tier_discounted_price).toBe(20500);
    expect(result.partner_discount_amount).toBe(1025);
    expect(result.unit_price).toBe(19475);
    // line_total is not returned by this method (computed by DB generated column)
    // Effective discount from list = (25000-19475)/25000 = 22.1%
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// DISCOUNT EVALUATION — evaluateDiscount
// ═════════════════════════════════════════════════════════════════════════════

describe('Discount evaluation — evaluateDiscount (3-band logic)', () => {
  /**
   * DA-001: effective_discount (8%) <= self_approve_ceiling (10%) -> auto-approve.
   * Platinum tier: max_discount_pct=10, no product override.
   */
  test('DA-001: effective 8% discount auto-approved (Platinum max=10%)', async () => {
    mockRepo.findTierProductPricing.mockResolvedValue(null);
    mockRepo.findTier.mockResolvedValue(makeTier({ max_discount_pct: '10' }));

    // list_price=10000, unit_price=9200 -> effective = (10000-9200)/10000 = 8%
    const result = await quoteService.evaluateDiscount(10000, 9200, TIER_ID, PRODUCT_ID);

    expect(result.approved).toBe(true);
    expect(result.level).toBe('auto');
    expect(result.ceiling).toBe(10);
    expect(result.effective_discount_pct).toBe(8);
  });

  /**
   * DA-002: effective_discount equals self_approve_ceiling exactly -> still auto-approved.
   * Boundary condition: must use <=, not <.
   */
  test('DA-002: effective discount exactly at ceiling boundary is auto-approved', async () => {
    mockRepo.findTierProductPricing.mockResolvedValue(null);
    mockRepo.findTier.mockResolvedValue(makeTier({ max_discount_pct: '10' }));

    // 10000 list, 9000 unit -> exactly 10% effective
    const result = await quoteService.evaluateDiscount(10000, 9000, TIER_ID, PRODUCT_ID);

    expect(result.approved).toBe(true);
    expect(result.level).toBe('auto');
    expect(result.effective_discount_pct).toBe(10);
  });

  /**
   * DA-003: effective_discount (22%) > ceiling (10%) but <= CM ceiling (25%) -> CM required.
   * Platinum tier: max=10, CM_ceiling=10+15=25.
   */
  test('DA-003: effective 22% discount requires channel_manager approval (Platinum max=10%)', async () => {
    mockRepo.findTierProductPricing.mockResolvedValue(null);
    mockRepo.findTier.mockResolvedValue(makeTier({ max_discount_pct: '10' }));

    // list=10000, unit=7800 -> effective=22%
    const result = await quoteService.evaluateDiscount(10000, 7800, TIER_ID, PRODUCT_ID);

    expect(result.approved).toBe(false);
    expect(result.level).toBe('channel_manager');
    expect(result.ceiling).toBe(25); // 10 + 15
    expect(result.effective_discount_pct).toBe(22);
  });

  /**
   * DA-004: effective_discount equals CM ceiling exactly -> CM level (boundary).
   * 25% = 10 + 15 -> exactly at CM boundary.
   */
  test('DA-004: effective discount exactly at CM ceiling boundary (25%) still requires CM', async () => {
    mockRepo.findTierProductPricing.mockResolvedValue(null);
    mockRepo.findTier.mockResolvedValue(makeTier({ max_discount_pct: '10' }));

    // list=10000, unit=7500 -> exactly 25%
    const result = await quoteService.evaluateDiscount(10000, 7500, TIER_ID, PRODUCT_ID);

    expect(result.approved).toBe(false);
    expect(result.level).toBe('channel_manager');
    expect(result.effective_discount_pct).toBe(25);
  });

  /**
   * DA-005: effective_discount (28%) > CM ceiling (25%) -> admin required.
   */
  test('DA-005: effective 28% discount requires admin approval (above CM ceiling of 25%)', async () => {
    mockRepo.findTierProductPricing.mockResolvedValue(null);
    mockRepo.findTier.mockResolvedValue(makeTier({ max_discount_pct: '10' }));

    // list=10000, unit=7200 -> effective=28%
    const result = await quoteService.evaluateDiscount(10000, 7200, TIER_ID, PRODUCT_ID);

    expect(result.approved).toBe(false);
    expect(result.level).toBe('admin');
    expect(result.ceiling).toBeNull(); // no ceiling defined for admin level
    expect(result.effective_discount_pct).toBe(28);
  });

  /**
   * DA-006: tier_product_pricing.discount_pct overrides tier.max_discount_pct.
   * Product override = 20% > tier max (10%).
   * An 18% effective discount: 18 <= 20 -> auto-approved.
   */
  test('DA-006: product-specific override (20%) allows 18% without CM approval', async () => {
    // tier_product_pricing.discount_pct=20 overrides tier max_discount_pct=10
    mockRepo.findTierProductPricing.mockResolvedValue(makeTierPricing({ discount_pct: '20' }));

    // list=10000, unit=8200 -> effective=18%
    const result = await quoteService.evaluateDiscount(10000, 8200, TIER_ID, PRODUCT_ID);

    expect(result.approved).toBe(true);
    expect(result.level).toBe('auto');
    expect(result.ceiling).toBe(20); // product override, not tier-wide 10
    expect(result.effective_discount_pct).toBe(18);
  });

  /**
   * DA-007: 0% discount is always auto-approved (list_price === unit_price).
   */
  test('DA-007: 0% effective discount is always auto-approved', async () => {
    mockRepo.findTierProductPricing.mockResolvedValue(null);
    mockRepo.findTier.mockResolvedValue(makeTier({ max_discount_pct: '0' }));
    // Even with tier max=0, a 0% discount should auto-approve

    const result = await quoteService.evaluateDiscount(10000, 10000, TIER_ID, PRODUCT_ID);

    expect(result.approved).toBe(true);
    expect(result.level).toBe('auto');
    expect(result.effective_discount_pct).toBe(0);
  });

  /**
   * DA-008: Zero list_price guard — effective_discount_pct = 0, auto-approve.
   * Prevents division by zero.
   */
  test('DA-008: zero list_price returns 0% effective discount (no division by zero)', async () => {
    mockRepo.findTierProductPricing.mockResolvedValue(null);
    mockRepo.findTier.mockResolvedValue(makeTier({ max_discount_pct: '10' }));

    const result = await quoteService.evaluateDiscount(0, 0, TIER_ID, PRODUCT_ID);

    expect(result.effective_discount_pct).toBe(0);
    expect(result.approved).toBe(true);
  });

  /**
   * DA-009: No tierId — falls back to 0% self-approve ceiling.
   * Any positive discount will require at least CM approval.
   */
  test('DA-009: null tier ID defaults to 0% self-approve ceiling (any discount needs CM)', async () => {
    // 5% effective discount with no tier -> ceiling=0 -> 5 > 0 -> check CM ceiling (0+15=15)
    // 5 <= 15 -> CM level
    const result = await quoteService.evaluateDiscount(10000, 9500, null, PRODUCT_ID);

    expect(result.approved).toBe(false);
    expect(result.level).toBe('channel_manager');
    expect(result.ceiling).toBe(15); // 0 + 15
  });

  /**
   * DA-010: effective_discount_pct is rounded to 2 decimal places in the return value.
   * PRD Appendix D: 22.1% effective discount.
   */
  test('DA-010: effective_discount_pct rounded to 2 decimal places', async () => {
    mockRepo.findTierProductPricing.mockResolvedValue(makeTierPricing({ discount_pct: '18' }));

    // (25000 - 19475) / 25000 = 5525/25000 = 0.221 = 22.1%
    const result = await quoteService.evaluateDiscount(25000, 19475, TIER_ID, PRODUCT_ID);

    expect(result.effective_discount_pct).toBe(22.1);
    const decimalStr = result.effective_discount_pct.toString().split('.')[1] || '';
    expect(decimalStr.length).toBeLessThanOrEqual(2);
  });

  /**
   * DA-011: PRD Appendix D — full discount evaluation scenario.
   * Effective discount 22.1% against:
   *   self_approve_ceiling = tier_product_pricing.discount_pct = 18%
   *   CM ceiling = 18 + 15 = 33%
   *   22.1 <= 33 -> channel_manager level
   */
  test('DA-011: PRD Appendix D — 22.1% effective requires channel_manager (ceiling=18%, CM=33%)', async () => {
    // tier_product_pricing.discount_pct=18 -> self_approve_ceiling=18
    mockRepo.findTierProductPricing.mockResolvedValue(makeTierPricing({ discount_pct: '18' }));

    // list=25000, unit=19475 -> effective=22.1%
    const result = await quoteService.evaluateDiscount(25000, 19475, TIER_ID, PRODUCT_ID);

    expect(result.approved).toBe(false);
    expect(result.level).toBe('channel_manager');
    expect(result.ceiling).toBe(33); // 18 + 15
    expect(result.effective_discount_pct).toBe(22.1);
  });

  /**
   * Additional tier scenarios matching PRD discount table:
   *   Registered (max=0%): any discount > 0% needs CM; > 15% needs admin
   *   Innovator (max=5%): > 5% needs CM; > 20% needs admin
   *   Diamond (max=15%): > 15% needs CM; > 30% needs admin
   */
  test('DA-012: Registered tier (max=0%): 1% effective discount requires channel_manager', async () => {
    mockRepo.findTierProductPricing.mockResolvedValue(null);
    mockRepo.findTier.mockResolvedValue(makeTier({ max_discount_pct: '0' }));

    // list=10000, unit=9900 -> effective=1%
    const result = await quoteService.evaluateDiscount(10000, 9900, TIER_IDS.registered, PRODUCT_ID);

    expect(result.approved).toBe(false);
    expect(result.level).toBe('channel_manager');
    expect(result.ceiling).toBe(15); // 0 + 15
  });

  test('DA-013: Diamond tier (max=15%): 14% auto-approved, 22% is CM, 31% is admin', async () => {
    mockRepo.findTierProductPricing.mockResolvedValue(null);
    mockRepo.findTier.mockResolvedValue(makeTier({ id: TIER_IDS.diamond, max_discount_pct: '15' }));

    // 14% auto-approve
    const autoResult = await quoteService.evaluateDiscount(10000, 8600, TIER_IDS.diamond, PRODUCT_ID);
    expect(autoResult.approved).toBe(true);
    expect(autoResult.level).toBe('auto');

    mockRepo.findTier.mockResolvedValue(makeTier({ id: TIER_IDS.diamond, max_discount_pct: '15' }));
    // 22% -> CM required (ceiling = 15+15 = 30)
    const cmResult = await quoteService.evaluateDiscount(10000, 7800, TIER_IDS.diamond, PRODUCT_ID);
    expect(cmResult.approved).toBe(false);
    expect(cmResult.level).toBe('channel_manager');

    mockRepo.findTier.mockResolvedValue(makeTier({ id: TIER_IDS.diamond, max_discount_pct: '15' }));
    // 31% -> admin required (above CM ceiling of 30)
    const adminResult = await quoteService.evaluateDiscount(10000, 6900, TIER_IDS.diamond, PRODUCT_ID);
    expect(adminResult.approved).toBe(false);
    expect(adminResult.level).toBe('admin');
    expect(adminResult.ceiling).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// calculateLinePrice — integration with findProduct
// ═════════════════════════════════════════════════════════════════════════════

describe('calculateLinePrice — fetches current product list_price', () => {
  test('calculates using product.list_price from database', async () => {
    mockRepo.findProduct.mockResolvedValue({
      id: PRODUCT_ID,
      name: 'PA-5400',
      list_price: '50000.00',
      is_active: true,
    });
    mockRepo.findTierProductPricing.mockResolvedValue(null);
    mockRepo.findTier.mockResolvedValue(makeTier({ default_discount_pct: '10' }));

    const result = await quoteService.calculateLinePrice(
      PRODUCT_ID,
      TIER_ID,
      'percentage',
      5,
      10,
    );

    expect(result.list_price).toBe(50000);
    expect(mockRepo.findProduct).toHaveBeenCalledWith(PRODUCT_ID);
  });

  test('throws NOT_FOUND if product does not exist', async () => {
    mockRepo.findProduct.mockResolvedValue(null);

    await expect(
      quoteService.calculateLinePrice(PRODUCT_ID, TIER_ID, 'percentage', 0, 1),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
