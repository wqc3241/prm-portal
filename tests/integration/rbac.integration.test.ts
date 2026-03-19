/**
 * Integration tests for RBAC and data scoping.
 *
 * These tests verify that the correct HTTP status codes and data filters are
 * applied for each role across all major endpoints.
 *
 * PRD coverage: QA-RBAC-01 through QA-RBAC-17, SCOPE-E01 through SCOPE-E05,
 *               QA-USER-09, QA-USER-10, QA-ORG-07 through QA-ORG-10
 */

import request from 'supertest';
import app from '../../src/app';
import db from '../../src/config/database';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// ── State shared across tests ─────────────────────────────────────────────────

let tierId: string;

const ctx: {
  adminToken: string;
  cmToken: string;
  partnerAdminAToken: string;
  partnerRepAToken: string;
  partnerAdminBToken: string;
  orgAId: string;
  orgBId: string;
  cmUserId: string;
  adminUserId: string;
  partnerAdminAId: string;
  partnerRepAId: string;
  partnerAdminBId: string;
} = {} as any;

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  const BCRYPT_ROUNDS = 1;
  const hash = await bcrypt.hash('TestPass1!', BCRYPT_ROUNDS);

  // Ensure a Registered tier exists
  const existingTier = await db('partner_tiers').where('rank', 1).first();
  if (existingTier) {
    tierId = existingTier.id;
  } else {
    tierId = uuidv4();
    await db('partner_tiers').insert({ id: tierId, name: 'Registered', rank: 1, default_discount_pct: 0, max_discount_pct: 0 });
  }

  // Create org A (assigned to CM)
  ctx.orgAId = uuidv4();
  ctx.orgBId = uuidv4();

  await db('organizations').insert([
    { id: ctx.orgAId, name: 'RBAC Test Org A', tier_id: tierId, status: 'active' },
    { id: ctx.orgBId, name: 'RBAC Test Org B', tier_id: tierId, status: 'active' },
  ]);

  // Create admin
  ctx.adminUserId = uuidv4();
  await db('users').insert({
    id: ctx.adminUserId, email: `rbac.admin.${uuidv4().slice(0,6)}@test.com`,
    password_hash: hash, role: 'admin', first_name: 'Admin', last_name: 'User',
    organization_id: null, is_active: true, email_verified: false,
  });

  // Create channel manager and assign to org A
  ctx.cmUserId = uuidv4();
  await db('users').insert({
    id: ctx.cmUserId, email: `rbac.cm.${uuidv4().slice(0,6)}@test.com`,
    password_hash: hash, role: 'channel_manager', first_name: 'CM', last_name: 'User',
    organization_id: null, is_active: true, email_verified: false,
  });
  await db('organizations').where('id', ctx.orgAId).update({ channel_manager_id: ctx.cmUserId });

  // Create partner users in org A
  ctx.partnerAdminAId = uuidv4();
  ctx.partnerRepAId = uuidv4();
  await db('users').insert([
    {
      id: ctx.partnerAdminAId, email: `rbac.pa.a.${uuidv4().slice(0,6)}@test.com`,
      password_hash: hash, role: 'partner_admin', first_name: 'PA', last_name: 'OrgA',
      organization_id: ctx.orgAId, is_active: true, email_verified: false,
    },
    {
      id: ctx.partnerRepAId, email: `rbac.pr.a.${uuidv4().slice(0,6)}@test.com`,
      password_hash: hash, role: 'partner_rep', first_name: 'PR', last_name: 'OrgA',
      organization_id: ctx.orgAId, is_active: true, email_verified: false,
    },
  ]);

  // Create partner admin in org B
  ctx.partnerAdminBId = uuidv4();
  await db('users').insert({
    id: ctx.partnerAdminBId, email: `rbac.pa.b.${uuidv4().slice(0,6)}@test.com`,
    password_hash: hash, role: 'partner_admin', first_name: 'PA', last_name: 'OrgB',
    organization_id: ctx.orgBId, is_active: true, email_verified: false,
  });

  // Generate JWT tokens directly (avoids login endpoint rate limiting)
  const jwtSecret = process.env.JWT_SECRET!;

  ctx.adminToken = jwt.sign(
    { sub: ctx.adminUserId, email: 'admin@test.com', role: 'admin', org_id: null, tier_id: null },
    jwtSecret, { expiresIn: '1h' },
  );
  ctx.cmToken = jwt.sign(
    { sub: ctx.cmUserId, email: 'cm@test.com', role: 'channel_manager', org_id: null, tier_id: null },
    jwtSecret, { expiresIn: '1h' },
  );
  ctx.partnerAdminAToken = jwt.sign(
    { sub: ctx.partnerAdminAId, email: 'pa.a@test.com', role: 'partner_admin', org_id: ctx.orgAId, tier_id: tierId },
    jwtSecret, { expiresIn: '1h' },
  );
  ctx.partnerRepAToken = jwt.sign(
    { sub: ctx.partnerRepAId, email: 'pr.a@test.com', role: 'partner_rep', org_id: ctx.orgAId, tier_id: tierId },
    jwtSecret, { expiresIn: '1h' },
  );
  ctx.partnerAdminBToken = jwt.sign(
    { sub: ctx.partnerAdminBId, email: 'pa.b@test.com', role: 'partner_admin', org_id: ctx.orgBId, tier_id: tierId },
    jwtSecret, { expiresIn: '1h' },
  );
});

afterAll(async () => {
  // Clean up in dependency order
  await db('users').whereIn('id', [
    ctx.adminUserId, ctx.cmUserId, ctx.partnerAdminAId, ctx.partnerRepAId, ctx.partnerAdminBId,
  ]).del();
  await db('organizations').whereIn('id', [ctx.orgAId, ctx.orgBId]).del();
  await db.destroy();
});

// ── Users RBAC ────────────────────────────────────────────────────────────────

describe('Users — RBAC and data scoping', () => {
  test('QA-RBAC-01 — admin lists all users (no org filter)', async () => {
    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${ctx.adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Admin should see users from multiple orgs
    const userIds = res.body.data.map((u: any) => u.id);
    expect(userIds).toContain(ctx.partnerAdminAId);
    expect(userIds).toContain(ctx.partnerAdminBId);
  });

  test('QA-RBAC-02 — channel_manager sees only users in assigned orgs', async () => {
    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${ctx.cmToken}`);

    expect(res.status).toBe(200);
    const userIds = res.body.data.map((u: any) => u.id);

    // CM is assigned to orgA only
    expect(userIds).toContain(ctx.partnerAdminAId);
    // CM should NOT see orgB users
    expect(userIds).not.toContain(ctx.partnerAdminBId);
  });

  test('QA-RBAC-03 — partner_admin sees only users in own org', async () => {
    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${ctx.partnerAdminAToken}`);

    expect(res.status).toBe(200);
    const userIds = res.body.data.map((u: any) => u.id);

    expect(userIds).toContain(ctx.partnerAdminAId);
    expect(userIds).not.toContain(ctx.partnerAdminBId);
  });

  test('QA-RBAC-04 — partner_rep sees only users in own org', async () => {
    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${ctx.partnerRepAToken}`);

    expect(res.status).toBe(200);
    const userIds = res.body.data.map((u: any) => u.id);

    expect(userIds).not.toContain(ctx.partnerAdminBId);
  });

  test('QA-RBAC-05 — partner_admin creates partner_rep in own org (201)', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${ctx.partnerAdminAToken}`)
      .send({
        email: `new.rep.${uuidv4().slice(0,8)}@test.com`,
        password: 'TestPass1!',
        first_name: 'New',
        last_name: 'Rep',
        role: 'partner_rep',
        organization_id: ctx.orgBId, // attempting wrong org — should be ignored
      });

    expect(res.status).toBe(201);
    // Created in orgA, not orgB
    expect(res.body.data.organization_id).toBe(ctx.orgAId);

    // Cleanup
    await db('users').where('id', res.body.data.id).del();
  });

  test('QA-RBAC-06 — partner_admin tries to create admin user → 403', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${ctx.partnerAdminAToken}`)
      .send({
        email: `evil.admin.${uuidv4().slice(0,8)}@test.com`,
        password: 'TestPass1!',
        first_name: 'Evil',
        last_name: 'Admin',
        role: 'admin',
      });

    expect(res.status).toBe(403);
    expect(res.body.errors[0].code).toBe('AUTH_INSUFFICIENT_ROLE');
  });

  test('QA-RBAC-07 — partner_rep tries to create user → 403', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${ctx.partnerRepAToken}`)
      .send({
        email: `rep.attempt.${uuidv4().slice(0,8)}@test.com`,
        password: 'TestPass1!',
        first_name: 'Rep',
        last_name: 'Attempt',
        role: 'partner_rep',
      });

    expect(res.status).toBe(403);
  });

  test('QA-RBAC-08 — partner_admin GETs user from different org → 404 (not 403)', async () => {
    const res = await request(app)
      .get(`/api/v1/users/${ctx.partnerAdminBId}`)
      .set('Authorization', `Bearer ${ctx.partnerAdminAToken}`);

    expect(res.status).toBe(404);
  });

  test('QA-RBAC-13 — non-admin tries to delete user → 403', async () => {
    const res = await request(app)
      .delete(`/api/v1/users/${ctx.partnerRepAId}`)
      .set('Authorization', `Bearer ${ctx.partnerAdminAToken}`);

    expect(res.status).toBe(403);
  });

  test('USER-E07 — partner_admin role escalation via PATCH → 403 USER_ROLE_ESCALATION', async () => {
    const res = await request(app)
      .patch(`/api/v1/users/${ctx.partnerRepAId}`)
      .set('Authorization', `Bearer ${ctx.partnerAdminAToken}`)
      .send({ role: 'admin' });

    expect(res.status).toBe(403);
    expect(res.body.errors[0].code).toBe('USER_ROLE_ESCALATION');
  });

  test('SCOPE-E01 — partner_admin passes org_id query param → ignored, only own org returned', async () => {
    const res = await request(app)
      .get(`/api/v1/users?organization_id=${ctx.orgBId}`)
      .set('Authorization', `Bearer ${ctx.partnerAdminAToken}`);

    expect(res.status).toBe(200);
    const userIds = res.body.data.map((u: any) => u.id);
    // Should NOT see orgB users despite query param
    expect(userIds).not.toContain(ctx.partnerAdminBId);
  });
});

// ── Organizations RBAC ────────────────────────────────────────────────────────

describe('Organizations — RBAC and data scoping', () => {
  test('QA-ORG-02 — admin lists all organizations', async () => {
    const res = await request(app)
      .get('/api/v1/organizations')
      .set('Authorization', `Bearer ${ctx.adminToken}`);

    expect(res.status).toBe(200);
    const orgIds = res.body.data.map((o: any) => o.id);
    expect(orgIds).toContain(ctx.orgAId);
    expect(orgIds).toContain(ctx.orgBId);
  });

  test('QA-ORG-03 — channel_manager sees only assigned orgs', async () => {
    const res = await request(app)
      .get('/api/v1/organizations')
      .set('Authorization', `Bearer ${ctx.cmToken}`);

    expect(res.status).toBe(200);
    const orgIds = res.body.data.map((o: any) => o.id);
    expect(orgIds).toContain(ctx.orgAId); // assigned to CM
    expect(orgIds).not.toContain(ctx.orgBId); // not assigned
  });

  test('QA-ORG-04 — partner_admin sees only own org (array of 1)', async () => {
    const res = await request(app)
      .get('/api/v1/organizations')
      .set('Authorization', `Bearer ${ctx.partnerAdminAToken}`);

    expect(res.status).toBe(200);
    const orgIds = res.body.data.map((o: any) => o.id);
    expect(orgIds).toContain(ctx.orgAId);
    expect(orgIds).not.toContain(ctx.orgBId);
  });

  test('QA-RBAC-09 — channel_manager GETs unassigned org → 404', async () => {
    const res = await request(app)
      .get(`/api/v1/organizations/${ctx.orgBId}`)
      .set('Authorization', `Bearer ${ctx.cmToken}`);

    expect(res.status).toBe(404);
  });

  test('QA-RBAC-10 — partner_admin GETs different org → 404', async () => {
    const res = await request(app)
      .get(`/api/v1/organizations/${ctx.orgBId}`)
      .set('Authorization', `Bearer ${ctx.partnerAdminAToken}`);

    expect(res.status).toBe(404);
  });

  test('SCOPE-E02 — partner_rep GETs different org → 404', async () => {
    const res = await request(app)
      .get(`/api/v1/organizations/${ctx.orgBId}`)
      .set('Authorization', `Bearer ${ctx.partnerRepAToken}`);

    expect(res.status).toBe(404);
  });

  test('QA-RBAC-14 — partner_admin updates own org non-sensitive fields', async () => {
    const res = await request(app)
      .patch(`/api/v1/organizations/${ctx.orgAId}`)
      .set('Authorization', `Bearer ${ctx.partnerAdminAToken}`)
      .send({ phone: '+1-800-555-0000', website: 'https://orga.example.com' });

    expect(res.status).toBe(200);
    expect(res.body.data.website).toBe('https://orga.example.com');
  });

  test('QA-RBAC-15 — partner_admin tries to change org status → status ignored, 200 returned', async () => {
    const res = await request(app)
      .patch(`/api/v1/organizations/${ctx.orgAId}`)
      .set('Authorization', `Bearer ${ctx.partnerAdminAToken}`)
      .send({ name: 'Updated Name', status: 'suspended' });

    expect(res.status).toBe(200);
    // Status should NOT be suspended
    const orgCheck = await db('organizations').where('id', ctx.orgAId).first();
    expect(orgCheck.status).not.toBe('suspended');
  });

  test('QA-ORG-07 — assigning non-CM as channel_manager → 422 ORG_INVALID_CHANNEL_MANAGER', async () => {
    const res = await request(app)
      .patch(`/api/v1/organizations/${ctx.orgAId}`)
      .set('Authorization', `Bearer ${ctx.adminToken}`)
      .send({ channel_manager_id: ctx.partnerAdminAId }); // not a CM

    expect(res.status).toBe(422);
    expect(res.body.errors[0].code).toBe('ORG_INVALID_CHANNEL_MANAGER');
  });

  test('QA-RBAC-17 / SCOPE-E04 — suspended org user is blocked from API calls with 403 ORG_SUSPENDED', async () => {
    // Create a suspended org and a user in it
    const suspendedOrgId = uuidv4();
    const suspendedUserId = uuidv4();
    const hash = await bcrypt.hash('TestPass1!', 1);

    await db('organizations').insert({
      id: suspendedOrgId, name: 'Suspended Test Org', tier_id: tierId, status: 'suspended',
    });
    await db('users').insert({
      id: suspendedUserId, email: `suspended.user.${uuidv4().slice(0,6)}@test.com`,
      password_hash: hash, role: 'partner_admin', first_name: 'S', last_name: 'U',
      organization_id: suspendedOrgId, is_active: true, email_verified: false,
    });

    const suspendedToken = jwt.sign(
      { sub: suspendedUserId, email: 's@test.com', role: 'partner_admin', org_id: suspendedOrgId, tier_id: tierId },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' },
    );

    const res = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${suspendedToken}`);

    expect(res.status).toBe(403);
    expect(res.body.errors[0].code).toBe('ORG_SUSPENDED');

    // Cleanup
    await db('users').where('id', suspendedUserId).del();
    await db('organizations').where('id', suspendedOrgId).del();
  });
});

// ── Tiers RBAC ────────────────────────────────────────────────────────────────

describe('Tiers — RBAC', () => {
  test('QA-TIER-01 — any authenticated user can list tiers', async () => {
    for (const token of [ctx.adminToken, ctx.cmToken, ctx.partnerAdminAToken, ctx.partnerRepAToken]) {
      const res = await request(app)
        .get('/api/v1/tiers')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    }
  });

  test('QA-RBAC-11 / TIER-E08 — non-admin tries to create tier → 403', async () => {
    for (const token of [ctx.cmToken, ctx.partnerAdminAToken, ctx.partnerRepAToken]) {
      const res = await request(app)
        .post('/api/v1/tiers')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Forbidden Tier', rank: 99 });
      expect(res.status).toBe(403);
    }
  });
});

// ── Products RBAC ─────────────────────────────────────────────────────────────

describe('Products — RBAC and partner filtering', () => {
  let inactiveProductId: string;

  beforeAll(async () => {
    // Create an inactive product to test partner filtering
    inactiveProductId = uuidv4();
    await db('products').insert({
      id: inactiveProductId,
      sku: `INACTIVE-SKU-${uuidv4().slice(0,6)}`,
      name: 'Hidden Product',
      list_price: 1000,
      is_active: false,
      available_to_partners: true,
    });
  });

  afterAll(async () => {
    await db('products').where('id', inactiveProductId).del();
  });

  test('QA-PROD-04 — admin sees all products including inactive', async () => {
    const res = await request(app)
      .get('/api/v1/products')
      .set('Authorization', `Bearer ${ctx.adminToken}`);

    expect(res.status).toBe(200);
    const productIds = res.body.data.map((p: any) => p.id);
    expect(productIds).toContain(inactiveProductId);
  });

  test('QA-PROD-05 / PROD-E07 — partner sees only active + available products', async () => {
    const res = await request(app)
      .get('/api/v1/products')
      .set('Authorization', `Bearer ${ctx.partnerAdminAToken}`);

    expect(res.status).toBe(200);
    const productIds = res.body.data.map((p: any) => p.id);
    expect(productIds).not.toContain(inactiveProductId);

    // All returned products must be active and partner-available
    res.body.data.forEach((p: any) => {
      expect(p.is_active).toBe(true);
      expect(p.available_to_partners).toBe(true);
    });
  });

  test('QA-RBAC-12 — non-admin (channel_manager) cannot create products → 403', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${ctx.cmToken}`)
      .send({ sku: 'CM-SKU-001', name: 'CM Product', list_price: 1000 });

    expect(res.status).toBe(403);
  });

  test('non-admin partner cannot create products → 403', async () => {
    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${ctx.partnerAdminAToken}`)
      .send({ sku: 'PA-SKU-001', name: 'PA Product', list_price: 1000 });

    expect(res.status).toBe(403);
  });
});

// ── Admin cross-org data access ───────────────────────────────────────────────

describe('Admin — unrestricted cross-org data access', () => {
  test('SCOPE-E05 — admin can filter users by any organization_id', async () => {
    const res = await request(app)
      .get(`/api/v1/users?organization_id=${ctx.orgBId}`)
      .set('Authorization', `Bearer ${ctx.adminToken}`);

    expect(res.status).toBe(200);
    const userIds = res.body.data.map((u: any) => u.id);
    expect(userIds).toContain(ctx.partnerAdminBId);
    // Must NOT include orgA users when filtering by orgB
    expect(userIds).not.toContain(ctx.partnerAdminAId);
  });
});

// ── Pagination ────────────────────────────────────────────────────────────────

describe('Pagination', () => {
  test('QA-INFRA-14 — page=1, per_page=1 returns correct meta', async () => {
    const res = await request(app)
      .get('/api/v1/users?page=1&per_page=1')
      .set('Authorization', `Bearer ${ctx.adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta).toMatchObject({
      page: 1,
      per_page: 1,
      total: expect.any(Number),
      total_pages: expect.any(Number),
    });
  });

  test('QA-INFRA-15 — page beyond total returns empty array with correct meta', async () => {
    const res = await request(app)
      .get('/api/v1/users?page=9999&per_page=25')
      .set('Authorization', `Bearer ${ctx.adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.meta.page).toBe(9999);
  });
});

// ── Infrastructure ────────────────────────────────────────────────────────────

describe('Infrastructure', () => {
  test('QA-INFRA-03 — request to non-existent route returns 404', async () => {
    const res = await request(app).get('/api/v1/nonexistent-route');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('QA-INFRA-02 — request with invalid JSON body returns 400', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{ this is not valid json }');

    expect(res.status).toBe(400);
  });

  test('QA-INFRA-06 — helmet security headers present in response', async () => {
    const res = await request(app)
      .get('/api/v1/tiers')
      .set('Authorization', `Bearer ${ctx.adminToken}`);

    expect(res.headers['x-content-type-options']).toBeDefined();
    expect(res.headers['x-frame-options']).toBeDefined();
  });

  test('QA-INFRA-16 — unhandled error returns 500 with generic message (no stack trace)', async () => {
    // This requires triggering a 500. We test the error handler directly.
    const { errorHandler } = await import('../../src/middleware/errorHandler');
    const mockReq: any = {};
    const mockRes: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const mockNext: any = jest.fn();

    errorHandler(new Error('Something blew up'), mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    const responseBody = mockRes.json.mock.calls[0][0];
    expect(responseBody.errors[0].code).toBe('INTERNAL_ERROR');
    expect(responseBody.errors[0].message).not.toContain('Something blew up');
    expect(JSON.stringify(responseBody)).not.toContain('stack');
  });

  test('Response envelope format is correct on success', async () => {
    const res = await request(app)
      .get('/api/v1/tiers')
      .set('Authorization', `Bearer ${ctx.adminToken}`);

    expect(res.body).toMatchObject({
      success: true,
      data: expect.any(Array),
      errors: null,
    });
    // meta is present on list responses
    expect(res.body.meta).toBeTruthy();
  });

  test('Response envelope format is correct on error', async () => {
    const res = await request(app).get('/api/v1/users'); // no auth

    expect(res.body).toMatchObject({
      success: false,
      data: null,
      meta: null,
      errors: expect.arrayContaining([
        expect.objectContaining({ code: expect.any(String), message: expect.any(String) }),
      ]),
    });
  });
});
