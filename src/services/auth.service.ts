import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import authConfig from '../config/auth';
import authRepository from '../repositories/auth.repository';
import { AppError } from '../utils/AppError';

class AuthService {
  /**
   * Register a new partner (creates org + partner_admin user).
   */
  async register(data: {
    company_name: string;
    email: string;
    password: string;
    first_name: string;
    last_name: string;
  }) {
    // Check for duplicate email
    const existing = await authRepository.findUserByEmail(data.email);
    if (existing) {
      throw new AppError('Email already registered', 409, 'AUTH_EMAIL_EXISTS');
    }

    // Get default tier (Registered, rank 1)
    const defaultTierId = await authRepository.getDefaultTierId();
    if (!defaultTierId) {
      throw new AppError('Default tier not configured', 500, 'INTERNAL_ERROR');
    }

    // Create organization
    const org = await authRepository.createOrganization({
      name: data.company_name,
      tier_id: defaultTierId,
      status: 'prospect',
    });

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, authConfig.bcryptRounds);

    // Create user
    const user = await authRepository.createUser({
      email: data.email,
      password_hash: passwordHash,
      role: 'partner_admin',
      first_name: data.first_name,
      last_name: data.last_name,
      organization_id: org.id,
    });

    // Generate tokens
    const { accessToken, refreshToken } = this.generateTokens(user, org.tier_id);

    // Store refresh token (hashed)
    const refreshHash = this.hashToken(refreshToken);
    await authRepository.updateRefreshToken(user.id, refreshHash);

    return {
      user,
      organization: {
        id: org.id,
        name: org.name,
        status: org.status,
        tier_id: org.tier_id,
      },
      accessToken,
      refreshToken,
      expiresIn: 3600,
    };
  }

  /**
   * Login with email + password.
   */
  async login(email: string, password: string) {
    const user = await authRepository.findUserByEmail(email);

    // Same error for non-existent email or wrong password
    if (!user) {
      throw new AppError('Invalid email or password', 401, 'AUTH_INVALID_CREDENTIALS');
    }

    if (!user.is_active) {
      throw new AppError('Account has been deactivated', 401, 'AUTH_ACCOUNT_DEACTIVATED');
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      throw new AppError('Invalid email or password', 401, 'AUTH_INVALID_CREDENTIALS');
    }

    // Get org for JWT claims
    let orgData = null;
    let tierId = null;
    if (user.organization_id) {
      const db = (await import('../config/database')).default;
      orgData = await db('organizations')
        .select('id', 'name', 'status', 'tier_id')
        .where('id', user.organization_id)
        .first();
      tierId = orgData?.tier_id;
    }

    // Generate tokens
    const { accessToken, refreshToken } = this.generateTokens(
      { id: user.id, email: user.email, role: user.role, organization_id: user.organization_id },
      tierId,
    );

    // Store refresh token hash
    const refreshHash = this.hashToken(refreshToken);
    await authRepository.updateRefreshToken(user.id, refreshHash);

    // Update last login
    await authRepository.updateLastLogin(user.id);

    // Build safe user response
    const safeUser: any = {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      organization_id: user.organization_id,
    };
    if (orgData) {
      safeUser.organization = orgData;
    }

    return {
      user: safeUser,
      accessToken,
      refreshToken,
      expiresIn: 3600,
    };
  }

  /**
   * Refresh access token using refresh token (with rotation).
   */
  async refresh(refreshToken: string) {
    // Verify the refresh token JWT
    let decoded: any;
    try {
      decoded = jwt.verify(refreshToken, authConfig.jwtRefreshSecret);
    } catch {
      throw new AppError('Invalid or expired refresh token', 401, 'AUTH_INVALID_REFRESH_TOKEN');
    }

    // Find user by refresh token hash
    const refreshHash = this.hashToken(refreshToken);
    const user = await authRepository.findByRefreshToken(refreshHash);

    if (!user) {
      // Possible replay attack — clear all tokens for this user
      if (decoded.sub) {
        await authRepository.clearAllRefreshTokens(decoded.sub);
      }
      throw new AppError('Invalid refresh token. All sessions have been revoked.', 401, 'AUTH_INVALID_REFRESH_TOKEN');
    }

    if (user.id !== decoded.sub) {
      throw new AppError('Invalid refresh token', 401, 'AUTH_INVALID_REFRESH_TOKEN');
    }

    if (!user.is_active) {
      throw new AppError('Account has been deactivated', 401, 'AUTH_ACCOUNT_DEACTIVATED');
    }

    // Get tier_id
    let tierId = null;
    if (user.organization_id) {
      const db = (await import('../config/database')).default;
      const org = await db('organizations').select('tier_id').where('id', user.organization_id).first();
      tierId = org?.tier_id;
    }

    // Generate new tokens (rotation)
    const tokens = this.generateTokens(
      { id: user.id, email: user.email, role: user.role, organization_id: user.organization_id },
      tierId,
    );

    // Store new refresh token hash
    const newRefreshHash = this.hashToken(tokens.refreshToken);
    await authRepository.updateRefreshToken(user.id, newRefreshHash);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: 3600,
    };
  }

  /**
   * Logout — clear refresh token.
   */
  async logout(userId: string) {
    await authRepository.updateRefreshToken(userId, null);
  }

  /**
   * Forgot password — generate reset token.
   */
  async forgotPassword(email: string) {
    const user = await authRepository.findUserByEmail(email);

    // Always return success (don't reveal email existence)
    if (!user) return;

    // Generate a random token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetHash = this.hashToken(resetToken);
    const expiresAt = new Date(Date.now() + authConfig.passwordResetExpiryMs);

    await authRepository.setPasswordResetToken(user.id, resetHash, expiresAt);

    // Log the reset URL (email not implemented in Phase 1)
    const resetUrl = `${process.env.CORS_ORIGIN || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
    console.log(`[Auth] Password reset requested for ${email}`);
    console.log(`[Auth] Reset URL: ${resetUrl}`);
  }

  /**
   * Reset password using token.
   */
  async resetPassword(token: string, newPassword: string) {
    const tokenHash = this.hashToken(token);
    const user = await authRepository.findByResetToken(tokenHash);

    if (!user) {
      throw new AppError('Invalid reset token', 400, 'AUTH_RESET_TOKEN_INVALID');
    }

    if (!user.password_reset_expires || new Date(user.password_reset_expires) < new Date()) {
      throw new AppError('Reset token has expired', 400, 'AUTH_RESET_TOKEN_EXPIRED');
    }

    const passwordHash = await bcrypt.hash(newPassword, authConfig.bcryptRounds);
    await authRepository.updatePassword(user.id, passwordHash);
  }

  /**
   * Get current user profile.
   */
  async getMe(userId: string) {
    const user = await authRepository.findUserById(userId);
    if (!user) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }
    return user;
  }

  /**
   * Update current user profile.
   */
  async updateMe(userId: string, data: Record<string, any>) {
    // Strip disallowed fields
    const allowedFields = ['first_name', 'last_name', 'title', 'phone', 'avatar_url', 'timezone', 'notification_prefs'];
    const updates: Record<string, any> = {};
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updates[field] = data[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      throw new AppError('No valid fields to update', 422, 'VALIDATION_ERROR');
    }

    if (updates.notification_prefs) {
      updates.notification_prefs = JSON.stringify(updates.notification_prefs);
    }

    return authRepository.updateProfile(userId, updates);
  }

  // === Private helpers ===

  private generateTokens(
    user: { id: string; email: string; role: string; organization_id?: string | null },
    tierId: string | null,
  ) {
    const accessPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      org_id: user.organization_id || null,
      tier_id: tierId || null,
    };

    const accessToken = jwt.sign(accessPayload, authConfig.jwtSecret, {
      expiresIn: authConfig.accessTokenExpiry,
    } as jwt.SignOptions);

    const refreshPayload = { sub: user.id };
    const refreshToken = jwt.sign(refreshPayload, authConfig.jwtRefreshSecret, {
      expiresIn: authConfig.refreshTokenExpiry,
    } as jwt.SignOptions);

    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}

export default new AuthService();
