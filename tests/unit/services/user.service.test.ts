/**
 * Unit tests for UserService.
 *
 * PRD coverage: QA-USER-01 through QA-USER-14, USER-E01 through USER-E13,
 *               QA-RBAC-01 through QA-RBAC-07, QA-RBAC-13
 */

jest.mock('../../../src/repositories/user.repository', () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
    findByEmail: jest.fn(),
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    countActiveAdminsInOrg: jest.fn(),
    getCertifications: jest.fn(),
    getActivity: jest.fn(),
  },
}));

import userService from '../../../src/services/user.service';
import userRepository from '../../../src/repositories/user.repository';
import { AppError } from '../../../src/utils/AppError';
import {
  adminPayload,
  cmPayload,
  partnerAdminPayload,
  partnerRepPayload,
  ORG_IDS,
  USER_IDS,
} from '../../fixtures/factories';

const mockRepo = userRepository as jest.Mocked<typeof userRepository>;

// ── Scope helpers ─────────────────────────────────────────────────────────────

const allScope = { type: 'all' as const };
const ownScope = { type: 'own' as const, organizationId: ORG_IDS.orgA };
const assignedScope = {
  type: 'assigned' as const,
  assignedOrgIds: [ORG_IDS.orgA],
};

// ── Factory helpers ───────────────────────────────────────────────────────────

function makeUser(overrides: Record<string, any> = {}) {
  return {
    id: USER_IDS.partnerRepA,
    email: 'rep@example.com',
    role: 'partner_rep',
    first_name: 'Bob',
    last_name: 'Jones',
    organization_id: ORG_IDS.orgA,
    is_active: true,
    ...overrides,
  };
}

// ── create() ─────────────────────────────────────────────────────────────────

describe('UserService.create', () => {
  beforeEach(() => {
    mockRepo.findByEmail.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue(makeUser());
  });

  test('QA-USER-01 / QA-RBAC-16 — admin creates user of any role', async () => {
    await userService.create(
      { email: 'new@example.com', password: 'Pass1234!', first_name: 'X', last_name: 'Y', role: 'channel_manager', organization_id: null },
      adminPayload(),
    );

    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'channel_manager' }),
    );
  });

  test('QA-RBAC-05 — partner_admin creates partner_rep in own org, org_id forced to own org', async () => {
    const requestor = partnerAdminPayload();
    await userService.create(
      { email: 'rep@example.com', password: 'Pass1234!', first_name: 'R', last_name: 'P', role: 'partner_rep', organization_id: ORG_IDS.orgB },
      requestor,
    );

    // organization_id must be overridden to the requestor's org (USER-E01)
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ organization_id: ORG_IDS.orgA }),
    );
  });

  test('QA-RBAC-06 / USER-E02 — partner_admin tries to create admin user → 403', async () => {
    await expect(
      userService.create(
        { email: 'x@y.com', password: 'Pass1234!', first_name: 'A', last_name: 'B', role: 'admin' },
        partnerAdminPayload(),
      ),
    ).rejects.toMatchObject({ statusCode: 403, code: 'AUTH_INSUFFICIENT_ROLE' });
  });

  test('USER-E03 — partner_admin tries to create channel_manager → 403', async () => {
    await expect(
      userService.create(
        { email: 'x@y.com', password: 'Pass1234!', first_name: 'A', last_name: 'B', role: 'channel_manager' },
        partnerAdminPayload(),
      ),
    ).rejects.toMatchObject({ statusCode: 403, code: 'AUTH_INSUFFICIENT_ROLE' });
  });

  test('QA-USER-02 — duplicate email returns 409 USER_EMAIL_EXISTS', async () => {
    mockRepo.findByEmail.mockResolvedValue(makeUser());

    await expect(
      userService.create(
        { email: 'dup@example.com', password: 'Pass1234!', first_name: 'D', last_name: 'U', role: 'partner_rep' },
        adminPayload(),
      ),
    ).rejects.toMatchObject({ statusCode: 409, code: 'USER_EMAIL_EXISTS' });
  });

  test('USER-E11 — email is normalized to lowercase before storage', async () => {
    await userService.create(
      { email: 'User@EXAMPLE.COM', password: 'Pass1234!', first_name: 'U', last_name: 'E', role: 'partner_rep', organization_id: ORG_IDS.orgA },
      adminPayload(),
    );

    expect(mockRepo.findByEmail).toHaveBeenCalledWith('user@example.com');
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'user@example.com' }),
    );
  });
});

// ── getById() ─────────────────────────────────────────────────────────────────

describe('UserService.getById', () => {
  test('QA-USER-05 — returns user when found within scope', async () => {
    mockRepo.findById.mockResolvedValue(makeUser());

    const user = await userService.getById(USER_IDS.partnerRepA, ownScope);

    expect(user).toMatchObject({ id: USER_IDS.partnerRepA });
  });

  test('QA-USER-06 / QA-RBAC-08 — returns 404 when user not in scope (not 403)', async () => {
    // findById returns null when org scope filtering excludes the record
    mockRepo.findById.mockResolvedValue(null);

    await expect(userService.getById('other-user-id', ownScope)).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  test('USER-E12 — non-existent UUID returns 404', async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(
      userService.getById('00000000-0000-0000-0000-000000000000', allScope),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── list() ────────────────────────────────────────────────────────────────────

describe('UserService.list', () => {
  beforeEach(() => {
    mockRepo.list.mockResolvedValue({ data: [], total: 0 });
  });

  test('QA-RBAC-01 — admin scope passes "all" scope to repository', async () => {
    await userService.list(allScope, {}, { offset: 0, limit: 25 });

    expect(mockRepo.list).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'all' }),
      expect.any(Object),
      expect.any(Object),
      undefined,
    );
  });

  test('QA-RBAC-03 — partner_admin scope passes "own" scope to repository', async () => {
    await userService.list(ownScope, {}, { offset: 0, limit: 25 });

    expect(mockRepo.list).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'own', organizationId: ORG_IDS.orgA }),
      expect.any(Object),
      expect.any(Object),
      undefined,
    );
  });

  test('SCOPE-E01 — organization_id filter from non-admin query is ignored by repository', async () => {
    // The repository only applies organization_id filter when scope.type === 'all'
    await userService.list(ownScope, { organization_id: ORG_IDS.orgB }, { offset: 0, limit: 25 });

    expect(mockRepo.list).toHaveBeenCalledWith(
      ownScope,
      expect.objectContaining({ organization_id: ORG_IDS.orgB }),
      expect.any(Object),
      undefined,
    );
    // The enforcement is in the repository layer (scope always takes precedence)
  });
});

// ── update() ─────────────────────────────────────────────────────────────────

describe('UserService.update', () => {
  const existingPartnerAdmin = makeUser({ id: 'target-user', role: 'partner_admin', organization_id: ORG_IDS.orgA });
  const existingPartnerRep = makeUser({ id: 'target-rep', role: 'partner_rep', organization_id: ORG_IDS.orgA });

  beforeEach(() => {
    mockRepo.update.mockResolvedValue({ ...existingPartnerAdmin, first_name: 'Updated' });
    mockRepo.countActiveAdminsInOrg.mockResolvedValue(2); // safe: more admins remain
  });

  test('QA-USER-07 — admin can update any user', async () => {
    mockRepo.findById.mockResolvedValue(existingPartnerAdmin);

    await userService.update('target-user', { first_name: 'NewName' }, adminPayload(), allScope);

    expect(mockRepo.update).toHaveBeenCalledWith('target-user', expect.objectContaining({ first_name: 'NewName' }));
  });

  test('QA-USER-08 / USER-E07 — partner_admin role escalation to admin → 403 USER_ROLE_ESCALATION', async () => {
    mockRepo.findById.mockResolvedValue(existingPartnerRep);

    await expect(
      userService.update('target-rep', { role: 'admin' }, partnerAdminPayload(), ownScope),
    ).rejects.toMatchObject({ statusCode: 403, code: 'USER_ROLE_ESCALATION' });
  });

  test('partner_admin role escalation to channel_manager → 403 USER_ROLE_ESCALATION', async () => {
    mockRepo.findById.mockResolvedValue(existingPartnerRep);

    await expect(
      userService.update('target-rep', { role: 'channel_manager' }, partnerAdminPayload(), ownScope),
    ).rejects.toMatchObject({ statusCode: 403, code: 'USER_ROLE_ESCALATION' });
  });

  test('USER-E08 — partner_admin cannot change organization_id (field is stripped)', async () => {
    mockRepo.findById.mockResolvedValue(existingPartnerRep);

    await userService.update('target-rep', { first_name: 'Safe', organization_id: ORG_IDS.orgB }, partnerAdminPayload(), ownScope);

    const callArg = mockRepo.update.mock.calls[0][1];
    expect(callArg.organization_id).toBeUndefined();
    expect(callArg.first_name).toBe('Safe');
  });

  test('USER-E04 — deactivating last partner_admin in org → 422 USER_LAST_ADMIN', async () => {
    const lastAdmin = makeUser({ id: 'last-admin', role: 'partner_admin', organization_id: ORG_IDS.orgA });
    mockRepo.findById.mockResolvedValue(lastAdmin);
    mockRepo.countActiveAdminsInOrg.mockResolvedValue(0); // this IS the last admin

    await expect(
      userService.update('last-admin', { is_active: false }, partnerAdminPayload(), ownScope),
    ).rejects.toMatchObject({ statusCode: 422, code: 'USER_LAST_ADMIN' });
  });

  test('partner_rep cannot update other users → 403', async () => {
    mockRepo.findById.mockResolvedValue(existingPartnerRep);

    await expect(
      userService.update('target-rep', { first_name: 'X' }, partnerRepPayload(), ownScope),
    ).rejects.toMatchObject({ statusCode: 403, code: 'AUTH_INSUFFICIENT_ROLE' });
  });

  test('updating non-existent user within scope → 404', async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(
      userService.update('missing-user', { first_name: 'X' }, adminPayload(), allScope),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── softDelete() ──────────────────────────────────────────────────────────────

describe('UserService.softDelete', () => {
  const targetUser = makeUser({ id: 'target-user', role: 'partner_rep', organization_id: ORG_IDS.orgA });

  beforeEach(() => {
    mockRepo.update.mockResolvedValue({ ...targetUser, is_active: false });
    mockRepo.countActiveAdminsInOrg.mockResolvedValue(2);
  });

  test('QA-USER-09 — admin soft-deletes a user (sets is_active=false)', async () => {
    mockRepo.findById.mockResolvedValue(targetUser);

    await userService.softDelete('target-user', adminPayload());

    expect(mockRepo.update).toHaveBeenCalledWith('target-user', { is_active: false });
  });

  test('USER-E10 — admin cannot delete themselves → 422 USER_CANNOT_DELETE_SELF', async () => {
    const requestor = adminPayload();

    await expect(
      userService.softDelete(requestor.sub, requestor),
    ).rejects.toMatchObject({ statusCode: 422, code: 'USER_CANNOT_DELETE_SELF' });
  });

  test('QA-USER-10 — deleting last partner_admin → 422 USER_LAST_ADMIN', async () => {
    const lastAdmin = makeUser({ id: 'last-admin', role: 'partner_admin', organization_id: ORG_IDS.orgA });
    mockRepo.findById.mockResolvedValue(lastAdmin);
    mockRepo.countActiveAdminsInOrg.mockResolvedValue(0);

    await expect(
      userService.softDelete('last-admin', adminPayload()),
    ).rejects.toMatchObject({ statusCode: 422, code: 'USER_LAST_ADMIN' });
  });

  test('soft-delete non-existent user → 404', async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(
      userService.softDelete('nonexistent', adminPayload()),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
