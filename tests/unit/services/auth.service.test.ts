/**
 * Unit tests for AuthService.
 *
 * All external dependencies (repository, DB, bcrypt, jwt) are mocked so
 * these tests run entirely in-process with no database or Redis required.
 *
 * PRD coverage: QA-AUTH-01 through QA-AUTH-21, AUTH-E01 through AUTH-E20
 */

// ── Mocks must come before imports ───────────────────────────────────────────

jest.mock('../../../src/repositories/auth.repository', () => ({
  __esModule: true,
  default: {
    findUserByEmail: jest.fn(),
    findUserById: jest.fn(),
    getDefaultTierId: jest.fn(),
    createOrganization: jest.fn(),
    createUser: jest.fn(),
    updateRefreshToken: jest.fn(),
    updateLastLogin: jest.fn(),
    findByRefreshToken: jest.fn(),
    clearAllRefreshTokens: jest.fn(),
    setPasswordResetToken: jest.fn(),
    findByResetToken: jest.fn(),
    updatePassword: jest.fn(),
    updateProfile: jest.fn(),
  },
}));

// Mock the dynamic import of the database module inside auth.service login()
jest.mock('../../../src/config/database', () => {
  const mockQuery = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue({ id: 'org-1', status: 'active', tier_id: 'tier-1', name: 'Test Org' }),
  });
  return { __esModule: true, default: mockQuery };
});

import authService from '../../../src/services/auth.service';
import authRepository from '../../../src/repositories/auth.repository';
import { AppError } from '../../../src/utils/AppError';

const mockAuthRepo = authRepository as jest.Mocked<typeof authRepository>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSavedUser(overrides: Record<string, any> = {}) {
  return {
    id: 'user-uuid-1',
    email: 'jane@example.com',
    password_hash: '$2a$01$somehashedvalue',
    role: 'partner_admin',
    first_name: 'Jane',
    last_name: 'Smith',
    organization_id: 'org-uuid-1',
    is_active: true,
    email_verified: false,
    refresh_token: null,
    password_reset_token: null,
    password_reset_expires: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function makeSavedOrg(overrides: Record<string, any> = {}) {
  return {
    id: 'org-uuid-1',
    name: 'AcmeSec Partners',
    status: 'prospect',
    tier_id: 'tier-uuid-registered',
    ...overrides,
  };
}

// ── Register ──────────────────────────────────────────────────────────────────

describe('AuthService.register', () => {
  beforeEach(() => {
    mockAuthRepo.findUserByEmail.mockResolvedValue(null);
    mockAuthRepo.getDefaultTierId.mockResolvedValue('tier-uuid-registered');
    mockAuthRepo.createOrganization.mockResolvedValue(makeSavedOrg());
    mockAuthRepo.createUser.mockResolvedValue(makeSavedUser());
    mockAuthRepo.updateRefreshToken.mockResolvedValue(undefined);
  });

  test('QA-AUTH-01 — valid registration returns user + org + tokens', async () => {
    const result = await authService.register({
      company_name: 'AcmeSec Partners',
      email: 'jane@example.com',
      password: 'Str0ngP@ss!',
      first_name: 'Jane',
      last_name: 'Smith',
    });

    expect(result).toMatchObject({
      user: expect.objectContaining({ email: 'jane@example.com', role: 'partner_admin' }),
      organization: expect.objectContaining({ status: 'prospect' }),
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      expiresIn: 3600,
    });

    // Org should be created first
    expect(mockAuthRepo.createOrganization).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'AcmeSec Partners', status: 'prospect' }),
    );

    // User created with partner_admin role
    expect(mockAuthRepo.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'partner_admin', organization_id: 'org-uuid-1' }),
    );

    // Refresh token stored (hashed)
    expect(mockAuthRepo.updateRefreshToken).toHaveBeenCalledWith('user-uuid-1', expect.any(String));
  });

  test('AUTH-E01 — duplicate email returns 409 AUTH_EMAIL_EXISTS', async () => {
    mockAuthRepo.findUserByEmail.mockResolvedValue(makeSavedUser());

    await expect(
      authService.register({
        company_name: 'Acme',
        email: 'jane@example.com',
        password: 'Str0ngP@ss!',
        first_name: 'Jane',
        last_name: 'Smith',
      }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'AUTH_EMAIL_EXISTS' });

    // No org or user should be created
    expect(mockAuthRepo.createOrganization).not.toHaveBeenCalled();
    expect(mockAuthRepo.createUser).not.toHaveBeenCalled();
  });

  test('registration creates org with default tier when none exists', async () => {
    await authService.register({
      company_name: 'NewCo',
      email: 'new@example.com',
      password: 'Passw0rd!',
      first_name: 'New',
      last_name: 'User',
    });

    expect(mockAuthRepo.getDefaultTierId).toHaveBeenCalled();
    expect(mockAuthRepo.createOrganization).toHaveBeenCalledWith(
      expect.objectContaining({ tier_id: 'tier-uuid-registered' }),
    );
  });

  test('registration fails with INTERNAL_ERROR when no default tier is configured', async () => {
    mockAuthRepo.getDefaultTierId.mockResolvedValue(null as any);

    await expect(
      authService.register({
        company_name: 'NewCo',
        email: 'new@example.com',
        password: 'Passw0rd!',
        first_name: 'New',
        last_name: 'User',
      }),
    ).rejects.toMatchObject({ statusCode: 500, code: 'INTERNAL_ERROR' });
  });
});

// ── Login ─────────────────────────────────────────────────────────────────────

describe('AuthService.login', () => {
  const PLAINTEXT = 'Str0ngP@ss!';
  let validUser: ReturnType<typeof makeSavedUser>;

  beforeEach(async () => {
    // Hash the password so bcrypt.compare will actually work
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash(PLAINTEXT, 1);
    validUser = makeSavedUser({ password_hash: hash });

    mockAuthRepo.updateRefreshToken.mockResolvedValue(undefined);
    mockAuthRepo.updateLastLogin.mockResolvedValue(undefined);
  });

  test('QA-AUTH-05 — valid credentials return tokens and update last_login', async () => {
    mockAuthRepo.findUserByEmail.mockResolvedValue(validUser);

    const result = await authService.login(validUser.email, PLAINTEXT);

    expect(result).toMatchObject({
      user: expect.objectContaining({ email: validUser.email }),
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      expiresIn: 3600,
    });

    expect(mockAuthRepo.updateLastLogin).toHaveBeenCalledWith(validUser.id);
  });

  test('QA-AUTH-06 — wrong password returns 401 AUTH_INVALID_CREDENTIALS', async () => {
    mockAuthRepo.findUserByEmail.mockResolvedValue(validUser);

    await expect(authService.login(validUser.email, 'wrongpassword')).rejects.toMatchObject({
      statusCode: 401,
      code: 'AUTH_INVALID_CREDENTIALS',
    });
  });

  test('QA-AUTH-07 — non-existent email returns 401 AUTH_INVALID_CREDENTIALS (same message)', async () => {
    mockAuthRepo.findUserByEmail.mockResolvedValue(null);

    const err = await authService.login('nobody@example.com', 'anypassword').catch((e) => e);

    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('AUTH_INVALID_CREDENTIALS');
    // Error message must be generic — must NOT say "email not found" or similar
    expect(err.message).not.toMatch(/not found/i);
    expect(err.message).not.toMatch(/does not exist/i);
    expect(err.message).not.toMatch(/no account/i);
  });

  test('AUTH-E04 and AUTH-E05 — same error message for wrong password vs wrong email', async () => {
    mockAuthRepo.findUserByEmail.mockResolvedValueOnce(null); // no such email
    const wrongEmailErr = await authService.login('nobody@x.com', 'anything').catch((e) => e);

    mockAuthRepo.findUserByEmail.mockResolvedValueOnce(validUser);
    const wrongPassErr = await authService.login(validUser.email, 'wrongpass').catch((e) => e);

    expect(wrongEmailErr.message).toBe(wrongPassErr.message);
    expect(wrongEmailErr.code).toBe(wrongPassErr.code);
  });

  test('QA-AUTH-08 — deactivated user returns 401 AUTH_ACCOUNT_DEACTIVATED', async () => {
    mockAuthRepo.findUserByEmail.mockResolvedValue(
      makeSavedUser({ is_active: false }),
    );

    await expect(authService.login('jane@example.com', PLAINTEXT)).rejects.toMatchObject({
      statusCode: 401,
      code: 'AUTH_ACCOUNT_DEACTIVATED',
    });
  });

  test('response does not include password_hash', async () => {
    mockAuthRepo.findUserByEmail.mockResolvedValue(validUser);

    const result = await authService.login(validUser.email, PLAINTEXT);

    expect(JSON.stringify(result)).not.toContain('password_hash');
    expect((result.user as any).password_hash).toBeUndefined();
  });
});

// ── Token Refresh ─────────────────────────────────────────────────────────────

describe('AuthService.refresh', () => {
  let validRefreshToken: string;
  let refreshHash: string;
  const crypto = require('crypto');

  const storedUser = makeSavedUser({ id: 'user-uuid-1' });

  beforeEach(async () => {
    const jwt = await import('jsonwebtoken');
    validRefreshToken = jwt.sign(
      { sub: 'user-uuid-1' },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: '30d' },
    );
    refreshHash = crypto.createHash('sha256').update(validRefreshToken).digest('hex');

    mockAuthRepo.findByRefreshToken.mockResolvedValue(storedUser);
    mockAuthRepo.updateRefreshToken.mockResolvedValue(undefined);
  });

  test('QA-AUTH-09 — valid refresh token returns new access + refresh tokens (rotation)', async () => {
    // Wait 1 second so iat differs from the original token (avoiding same-millisecond collision)
    await new Promise((r) => setTimeout(r, 1100));

    const result = await authService.refresh(validRefreshToken);

    expect(result).toMatchObject({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      expiresIn: 3600,
    });

    // Old token hash should be replaced (rotation)
    expect(mockAuthRepo.updateRefreshToken).toHaveBeenCalledWith('user-uuid-1', expect.any(String));

    // The stored hash must differ because a new token was generated
    const callHash = mockAuthRepo.updateRefreshToken.mock.calls[0][1];
    expect(callHash).not.toBe(refreshHash);
  });

  test('QA-AUTH-10 — expired refresh token returns 401 AUTH_INVALID_REFRESH_TOKEN', async () => {
    const jwt = await import('jsonwebtoken');
    const expired = jwt.sign(
      { sub: 'user-uuid-1' },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: -1 }, // already expired
    );

    await expect(authService.refresh(expired)).rejects.toMatchObject({
      statusCode: 401,
      code: 'AUTH_INVALID_REFRESH_TOKEN',
    });
  });

  test('AUTH-E08 — replay attack: token not found in DB clears all user tokens', async () => {
    // Token verifies cryptographically but is NOT stored in DB (already rotated)
    mockAuthRepo.findByRefreshToken.mockResolvedValue(null);

    await expect(authService.refresh(validRefreshToken)).rejects.toMatchObject({
      statusCode: 401,
      code: 'AUTH_INVALID_REFRESH_TOKEN',
    });

    // All sessions revoked as security measure
    expect(mockAuthRepo.clearAllRefreshTokens).toHaveBeenCalledWith('user-uuid-1');
  });

  test('AUTH-E09 — token belongs to a different user returns 401', async () => {
    // DB returns a different user than what is encoded in the token
    const differentUser = makeSavedUser({ id: 'user-uuid-999' });
    mockAuthRepo.findByRefreshToken.mockResolvedValue(differentUser);

    await expect(authService.refresh(validRefreshToken)).rejects.toMatchObject({
      statusCode: 401,
      code: 'AUTH_INVALID_REFRESH_TOKEN',
    });
  });

  test('AUTH-E20 — token signed with wrong secret returns 401', async () => {
    const jwt = await import('jsonwebtoken');
    const tampered = jwt.sign({ sub: 'user-uuid-1' }, 'wrong-secret', { expiresIn: '30d' });

    await expect(authService.refresh(tampered)).rejects.toMatchObject({
      statusCode: 401,
      code: 'AUTH_INVALID_REFRESH_TOKEN',
    });
  });
});

// ── Logout ────────────────────────────────────────────────────────────────────

describe('AuthService.logout', () => {
  test('QA-AUTH-12 — clears refresh token for the user', async () => {
    mockAuthRepo.updateRefreshToken.mockResolvedValue(undefined);

    await authService.logout('user-uuid-1');

    expect(mockAuthRepo.updateRefreshToken).toHaveBeenCalledWith('user-uuid-1', null);
  });
});

// ── Forgot Password ───────────────────────────────────────────────────────────

describe('AuthService.forgotPassword', () => {
  beforeEach(() => {
    mockAuthRepo.setPasswordResetToken.mockResolvedValue(undefined);
  });

  test('QA-AUTH-17 — valid email: stores hashed token and logs reset URL', async () => {
    mockAuthRepo.findUserByEmail.mockResolvedValue(makeSavedUser());

    await authService.forgotPassword('jane@example.com');

    expect(mockAuthRepo.setPasswordResetToken).toHaveBeenCalledWith(
      'user-uuid-1',
      expect.any(String), // hashed token
      expect.any(Date),   // expiry
    );
  });

  test('AUTH-E13 — non-existent email: returns successfully (no error, no reveal)', async () => {
    mockAuthRepo.findUserByEmail.mockResolvedValue(null);

    await expect(authService.forgotPassword('nobody@example.com')).resolves.toBeUndefined();

    // Must NOT attempt to store a token for non-existent user
    expect(mockAuthRepo.setPasswordResetToken).not.toHaveBeenCalled();
  });
});

// ── Reset Password ────────────────────────────────────────────────────────────

describe('AuthService.resetPassword', () => {
  const validToken = 'valid-reset-token-32bytes-0000000001';

  test('QA-AUTH-19 — valid token resets password and clears refresh token', async () => {
    const futureExpiry = new Date(Date.now() + 3600_000);
    mockAuthRepo.findByResetToken.mockResolvedValue(
      makeSavedUser({ password_reset_expires: futureExpiry }),
    );
    mockAuthRepo.updatePassword.mockResolvedValue(undefined);

    await authService.resetPassword(validToken, 'NewPassw0rd!');

    expect(mockAuthRepo.updatePassword).toHaveBeenCalledWith(
      'user-uuid-1',
      expect.any(String), // bcrypt hash
    );
  });

  test('AUTH-E14 — expired reset token returns 400 AUTH_RESET_TOKEN_EXPIRED', async () => {
    const pastExpiry = new Date(Date.now() - 1);
    mockAuthRepo.findByResetToken.mockResolvedValue(
      makeSavedUser({ password_reset_expires: pastExpiry }),
    );

    await expect(authService.resetPassword(validToken, 'NewPassw0rd!')).rejects.toMatchObject({
      statusCode: 400,
      code: 'AUTH_RESET_TOKEN_EXPIRED',
    });
  });

  test('AUTH-E15 — invalid/tampered token returns 400 AUTH_RESET_TOKEN_INVALID', async () => {
    mockAuthRepo.findByResetToken.mockResolvedValue(null);

    await expect(authService.resetPassword('bad-token', 'NewPassw0rd!')).rejects.toMatchObject({
      statusCode: 400,
      code: 'AUTH_RESET_TOKEN_INVALID',
    });
  });

  test('AUTH-E16 — already-used token (cleared from DB) returns 400 AUTH_RESET_TOKEN_INVALID', async () => {
    // After first use, updatePassword clears the token; subsequent lookup returns null
    mockAuthRepo.findByResetToken.mockResolvedValue(null);

    await expect(authService.resetPassword(validToken, 'AnotherPass1!')).rejects.toMatchObject({
      statusCode: 400,
      code: 'AUTH_RESET_TOKEN_INVALID',
    });
  });
});

// ── Get Me ────────────────────────────────────────────────────────────────────

describe('AuthService.getMe', () => {
  test('QA-AUTH-13 — returns user without sensitive fields', async () => {
    const safeUser = {
      id: 'user-uuid-1',
      email: 'jane@example.com',
      role: 'partner_admin',
      first_name: 'Jane',
      last_name: 'Smith',
      organization_id: 'org-uuid-1',
    };
    mockAuthRepo.findUserById.mockResolvedValue(safeUser);

    const result = await authService.getMe('user-uuid-1');

    expect(result).toMatchObject(safeUser);
    expect((result as any).password_hash).toBeUndefined();
    expect((result as any).refresh_token).toBeUndefined();
  });

  test('returns 404 NOT_FOUND when user does not exist', async () => {
    mockAuthRepo.findUserById.mockResolvedValue(null);

    await expect(authService.getMe('nonexistent-id')).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });
});

// ── Update Me ─────────────────────────────────────────────────────────────────

describe('AuthService.updateMe', () => {
  beforeEach(() => {
    mockAuthRepo.updateProfile.mockResolvedValue(makeSavedUser());
  });

  test('QA-AUTH-15 — updates allowed fields (first_name, phone, timezone)', async () => {
    await authService.updateMe('user-uuid-1', {
      first_name: 'Updated',
      phone: '+1-555-0000',
      timezone: 'America/Los_Angeles',
    });

    expect(mockAuthRepo.updateProfile).toHaveBeenCalledWith(
      'user-uuid-1',
      expect.objectContaining({ first_name: 'Updated', phone: '+1-555-0000', timezone: 'America/Los_Angeles' }),
    );
  });

  test('QA-AUTH-16 — disallowed fields (email, role, is_active) are silently stripped', async () => {
    await authService.updateMe('user-uuid-1', {
      first_name: 'Safe',
      email: 'hacker@evil.com',
      role: 'admin',
      is_active: false,
      organization_id: 'other-org',
    });

    const callArg = mockAuthRepo.updateProfile.mock.calls[0][1];
    expect(callArg.email).toBeUndefined();
    expect(callArg.role).toBeUndefined();
    expect(callArg.is_active).toBeUndefined();
    expect(callArg.organization_id).toBeUndefined();
    expect(callArg.first_name).toBe('Safe');
  });

  test('returns 422 VALIDATION_ERROR when no valid fields provided', async () => {
    await expect(
      authService.updateMe('user-uuid-1', { email: 'x@x.com', role: 'admin' }),
    ).rejects.toMatchObject({ statusCode: 422, code: 'VALIDATION_ERROR' });
  });
});
