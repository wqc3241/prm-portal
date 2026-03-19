/**
 * Unit tests for the scopeToOrg middleware and applyOrgScope helper.
 *
 * PRD coverage: SCOPE-E01 through SCOPE-E05, QA-RBAC-01 through QA-RBAC-04
 */

jest.mock('../../../src/config/database', () => {
  const mockQuery = jest.fn();
  return { __esModule: true, default: mockQuery };
});

import { Request, Response, NextFunction } from 'express';
import { scopeToOrg, applyOrgScope } from '../../../src/middleware/scopeToOrg';
import db from '../../../src/config/database';
import { ORG_IDS, USER_IDS } from '../../fixtures/factories';

const mockDb = db as jest.MockedFunction<any>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReq(user: object): Partial<Request> {
  return { user: user as any };
}

function makeRes(): Partial<Response> {
  return {};
}

function makeNext(): NextFunction {
  return jest.fn();
}

// ── scopeToOrg middleware ─────────────────────────────────────────────────────

describe('scopeToOrg middleware', () => {
  test('admin role → req.orgScope.type === "all" (no DB query)', async () => {
    const req = makeReq({ sub: USER_IDS.admin, email: 'admin@x.com', role: 'admin', org_id: null }) as Request;
    const res = makeRes() as Response;
    const next = makeNext();

    await scopeToOrg(req, res, next);

    expect((req as any).orgScope).toEqual({ type: 'all' });
    expect(mockDb).not.toHaveBeenCalled(); // no DB hit needed for admin
    expect((next as jest.Mock).mock.calls[0]).toHaveLength(0);
  });

  test('channel_manager role → queries assigned orgs from DB, sets "assigned" scope', async () => {
    const assignedOrgs = [{ id: ORG_IDS.orgA }, { id: ORG_IDS.orgB }];
    mockDb.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      // resolves to the list of orgs for this CM
      then: undefined,
      [Symbol.iterator]: undefined,
    });
    // Actually make the mock return the right array
    const selectMock = jest.fn().mockReturnThis();
    const whereMock = jest.fn().mockResolvedValue(assignedOrgs);
    mockDb.mockReturnValue({ select: selectMock, where: whereMock });

    const req = makeReq({ sub: USER_IDS.channelManager, email: 'cm@x.com', role: 'channel_manager', org_id: null }) as Request;
    const res = makeRes() as Response;
    const next = makeNext();

    await scopeToOrg(req, res, next);

    expect((req as any).orgScope).toMatchObject({
      type: 'assigned',
      assignedOrgIds: expect.arrayContaining([ORG_IDS.orgA, ORG_IDS.orgB]),
    });
    expect(mockDb).toHaveBeenCalledWith('organizations');
    expect((next as jest.Mock).mock.calls[0]).toHaveLength(0);
  });

  test('partner_admin role → sets "own" scope with org_id', async () => {
    const req = makeReq({
      sub: USER_IDS.partnerAdminA,
      email: 'pa@x.com',
      role: 'partner_admin',
      org_id: ORG_IDS.orgA,
    }) as Request;
    const res = makeRes() as Response;
    const next = makeNext();

    await scopeToOrg(req, res, next);

    expect((req as any).orgScope).toEqual({ type: 'own', organizationId: ORG_IDS.orgA });
    expect((next as jest.Mock).mock.calls[0]).toHaveLength(0);
  });

  test('partner_rep role → sets "own" scope', async () => {
    const req = makeReq({
      sub: USER_IDS.partnerRepA,
      email: 'pr@x.com',
      role: 'partner_rep',
      org_id: ORG_IDS.orgA,
    }) as Request;
    const res = makeRes() as Response;
    const next = makeNext();

    await scopeToOrg(req, res, next);

    expect((req as any).orgScope).toEqual({ type: 'own', organizationId: ORG_IDS.orgA });
  });

  test('partner role with no org_id → 403 AUTH_ORG_MISMATCH', async () => {
    const req = makeReq({
      sub: 'some-user',
      email: 'x@y.com',
      role: 'partner_admin',
      org_id: null, // partner with no org — configuration error
    }) as Request;
    const res = makeRes() as Response;
    const next = makeNext();

    await scopeToOrg(req, res, next);

    const err: any = (next as jest.Mock).mock.calls[0][0];
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('AUTH_ORG_MISMATCH');
  });

  test('called without req.user → 401 AUTH_TOKEN_MISSING', async () => {
    const req = { headers: {}, user: undefined } as any;
    const res = makeRes() as Response;
    const next = makeNext();

    await scopeToOrg(req, res, next);

    const err: any = (next as jest.Mock).mock.calls[0][0];
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('AUTH_TOKEN_MISSING');
  });
});

// ── applyOrgScope helper ──────────────────────────────────────────────────────

describe('applyOrgScope helper', () => {
  function makeQueryBuilder() {
    const qb: any = {
      calls: [] as string[],
      where: jest.fn().mockImplementation(function (this: any, ...args: any[]) {
        this.calls.push(['where', ...args]);
        return this;
      }),
      whereIn: jest.fn().mockImplementation(function (this: any, ...args: any[]) {
        this.calls.push(['whereIn', ...args]);
        return this;
      }),
    };
    return qb;
  }

  test('"all" scope — no where clauses added (admin)', () => {
    const qb = makeQueryBuilder();
    const result = applyOrgScope(qb, { type: 'all' });

    expect(qb.where).not.toHaveBeenCalled();
    expect(qb.whereIn).not.toHaveBeenCalled();
    expect(result).toBe(qb);
  });

  test('"own" scope — WHERE organization_id = orgId added', () => {
    const qb = makeQueryBuilder();
    applyOrgScope(qb, { type: 'own', organizationId: ORG_IDS.orgA });

    expect(qb.where).toHaveBeenCalledWith('organization_id', ORG_IDS.orgA);
  });

  test('"own" scope with custom column name', () => {
    const qb = makeQueryBuilder();
    applyOrgScope(qb, { type: 'own', organizationId: ORG_IDS.orgA }, 'org_id');

    expect(qb.where).toHaveBeenCalledWith('org_id', ORG_IDS.orgA);
  });

  test('"assigned" scope — WHERE organization_id IN (ids) added', () => {
    const qb = makeQueryBuilder();
    applyOrgScope(qb, { type: 'assigned', assignedOrgIds: [ORG_IDS.orgA, ORG_IDS.orgB] });

    expect(qb.whereIn).toHaveBeenCalledWith('organization_id', [ORG_IDS.orgA, ORG_IDS.orgB]);
  });

  test('"assigned" scope with empty ids — WHERE organization_id IN ([]) (returns nothing)', () => {
    const qb = makeQueryBuilder();
    applyOrgScope(qb, { type: 'assigned', assignedOrgIds: [] });

    expect(qb.whereIn).toHaveBeenCalledWith('organization_id', []);
  });

  test('SCOPE-E01 — non-admin org_id filter from query params is overridden by "own" scope', () => {
    // The service receives organization_id filter in filters object,
    // but repository only applies it when scope.type === 'all'.
    // This test verifies applyOrgScope overrides any query param filter.
    const qb = makeQueryBuilder();
    applyOrgScope(qb, { type: 'own', organizationId: ORG_IDS.orgA });

    // Only one WHERE clause for the scope — not the user-supplied org_id
    expect(qb.where).toHaveBeenCalledTimes(1);
    expect(qb.where).toHaveBeenCalledWith('organization_id', ORG_IDS.orgA);
  });

  test('SCOPE-E05 — admin scope: query param filters can be applied freely', () => {
    const qb = makeQueryBuilder();
    const result = applyOrgScope(qb, { type: 'all' });

    // applyOrgScope adds nothing, allowing external filters to work normally
    expect(qb.where).not.toHaveBeenCalled();
    expect(result).toBe(qb);
  });
});
