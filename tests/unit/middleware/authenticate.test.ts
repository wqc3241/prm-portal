/**
 * Unit tests for the authenticate middleware.
 *
 * PRD coverage: AUTH-E10 through AUTH-E12, AUTH-E20,
 *               QA-AUTH-22, QA-AUTH-23, SCOPE-E04
 */

jest.mock('../../../src/config/database', () => {
  const mockQuery = jest.fn();
  return { __esModule: true, default: mockQuery };
});

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authenticate } from '../../../src/middleware/authenticate';
import db from '../../../src/config/database';

const mockDb = db as jest.MockedFunction<any>;

// ── Helpers ───────────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET!;

function makeReq(authHeader?: string): Partial<Request> {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
  };
}

function makeRes(): Partial<Response> {
  return {};
}

function makeNext(): NextFunction {
  return jest.fn();
}

function signAccessToken(payload: object, secret = JWT_SECRET, options: jwt.SignOptions = {}) {
  return jwt.sign(payload, secret, { expiresIn: '1h', ...options });
}

function setupDbUser(user: object | null, org: object | null = { id: 'org-1', status: 'active', tier_id: 'tier-1' }) {
  mockDb.mockImplementation(() => ({
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(user),
  }));

  // Second call to db (org lookup) needs to return org
  let callCount = 0;
  mockDb.mockImplementation(() => {
    callCount++;
    return {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(callCount === 1 ? user : org),
    };
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('authenticate middleware', () => {
  test('AUTH-E10 / QA-AUTH-22 — missing Authorization header → 401 AUTH_TOKEN_MISSING', async () => {
    const req = makeReq() as Request;
    const res = makeRes() as Response;
    const next = makeNext();

    await authenticate(req, res, next);

    const err: any = (next as jest.Mock).mock.calls[0][0];
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('AUTH_TOKEN_MISSING');
  });

  test('AUTH-E10 — Authorization header without Bearer prefix → 401 AUTH_TOKEN_MISSING', async () => {
    const req = makeReq('Token abc123') as Request;
    const res = makeRes() as Response;
    const next = makeNext();

    await authenticate(req, res, next);

    const err: any = (next as jest.Mock).mock.calls[0][0];
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('AUTH_TOKEN_MISSING');
  });

  test('AUTH-E11 / QA-AUTH-23 — malformed JWT → 401 AUTH_TOKEN_INVALID', async () => {
    const req = makeReq('Bearer not.a.valid.jwt') as Request;
    const res = makeRes() as Response;
    const next = makeNext();

    await authenticate(req, res, next);

    const err: any = (next as jest.Mock).mock.calls[0][0];
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('AUTH_TOKEN_INVALID');
  });

  test('AUTH-E12 — expired access token → 401 AUTH_TOKEN_EXPIRED', async () => {
    const token = signAccessToken(
      { sub: 'user-1', email: 'x@y.com', role: 'admin', org_id: null, tier_id: null },
      JWT_SECRET,
      { expiresIn: -1 }, // already expired
    );

    const req = makeReq(`Bearer ${token}`) as Request;
    const res = makeRes() as Response;
    const next = makeNext();

    await authenticate(req, res, next);

    const err: any = (next as jest.Mock).mock.calls[0][0];
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('AUTH_TOKEN_EXPIRED');
  });

  test('AUTH-E20 — JWT signed with wrong secret → 401 AUTH_TOKEN_INVALID', async () => {
    const token = signAccessToken(
      { sub: 'user-1', email: 'x@y.com', role: 'admin', org_id: null, tier_id: null },
      'wrong-secret-that-is-definitely-not-the-real-one',
    );

    const req = makeReq(`Bearer ${token}`) as Request;
    const res = makeRes() as Response;
    const next = makeNext();

    await authenticate(req, res, next);

    const err: any = (next as jest.Mock).mock.calls[0][0];
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('AUTH_TOKEN_INVALID');
  });

  test('valid JWT but user no longer exists in DB → 401 AUTH_TOKEN_INVALID', async () => {
    const token = signAccessToken({ sub: 'deleted-user', email: 'gone@example.com', role: 'admin', org_id: null, tier_id: null });

    // DB returns null for user lookup
    setupDbUser(null);

    const req = makeReq(`Bearer ${token}`) as Request;
    const res = makeRes() as Response;
    const next = makeNext();

    await authenticate(req, res, next);

    const err: any = (next as jest.Mock).mock.calls[0][0];
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('AUTH_TOKEN_INVALID');
  });

  test('valid JWT but user is deactivated → 401 AUTH_ACCOUNT_DEACTIVATED', async () => {
    const token = signAccessToken({ sub: 'user-1', email: 'x@y.com', role: 'partner_admin', org_id: 'org-1', tier_id: null });

    setupDbUser({ id: 'user-1', email: 'x@y.com', role: 'partner_admin', organization_id: 'org-1', is_active: false }, null);

    const req = makeReq(`Bearer ${token}`) as Request;
    const res = makeRes() as Response;
    const next = makeNext();

    await authenticate(req, res, next);

    const err: any = (next as jest.Mock).mock.calls[0][0];
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('AUTH_ACCOUNT_DEACTIVATED');
  });

  test('SCOPE-E04 — valid JWT but org is suspended → 403 ORG_SUSPENDED', async () => {
    const token = signAccessToken({ sub: 'user-1', email: 'x@y.com', role: 'partner_admin', org_id: 'org-1', tier_id: null });

    let callCount = 0;
    mockDb.mockImplementation(() => {
      callCount++;
      return {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(
          callCount === 1
            ? { id: 'user-1', email: 'x@y.com', role: 'partner_admin', organization_id: 'org-1', is_active: true }
            : { id: 'org-1', status: 'suspended', tier_id: 'tier-1' },
        ),
      };
    });

    const req = makeReq(`Bearer ${token}`) as Request;
    const res = makeRes() as Response;
    const next = makeNext();

    await authenticate(req, res, next);

    const err: any = (next as jest.Mock).mock.calls[0][0];
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('ORG_SUSPENDED');
  });

  test('valid JWT with active user and active org → attaches req.user and calls next()', async () => {
    const payload = { sub: 'user-1', email: 'x@y.com', role: 'partner_admin', org_id: 'org-1', tier_id: 'tier-1' };
    const token = signAccessToken(payload);

    let callCount = 0;
    mockDb.mockImplementation(() => {
      callCount++;
      return {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(
          callCount === 1
            ? { id: 'user-1', email: 'x@y.com', role: 'partner_admin', organization_id: 'org-1', is_active: true }
            : { id: 'org-1', status: 'active', tier_id: 'tier-1' },
        ),
      };
    });

    const req = makeReq(`Bearer ${token}`) as Request;
    const res = makeRes() as Response;
    const next = makeNext();

    await authenticate(req, res, next);

    expect((next as jest.Mock).mock.calls[0]).toHaveLength(0); // next() called with no args = success
    expect((req as any).user).toMatchObject({
      sub: 'user-1',
      role: 'partner_admin',
      org_id: 'org-1',
    });
  });

  test('admin with no org_id — req.user.org_id is null, no org lookup', async () => {
    const token = signAccessToken({ sub: 'admin-1', email: 'admin@x.com', role: 'admin', org_id: null, tier_id: null });

    mockDb.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue({ id: 'admin-1', email: 'admin@x.com', role: 'admin', organization_id: null, is_active: true }),
    }));

    const req = makeReq(`Bearer ${token}`) as Request;
    const res = makeRes() as Response;
    const next = makeNext();

    await authenticate(req, res, next);

    expect((next as jest.Mock).mock.calls[0]).toHaveLength(0);
    expect((req as any).user.org_id).toBeNull();
  });
});
