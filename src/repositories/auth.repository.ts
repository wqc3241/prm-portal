import db from '../config/database';
import { v4 as uuidv4 } from 'uuid';

const USER_SAFE_COLUMNS = [
  'id', 'email', 'role', 'first_name', 'last_name', 'title', 'phone',
  'avatar_url', 'organization_id', 'is_active', 'email_verified',
  'last_login_at', 'notification_prefs', 'timezone', 'created_at', 'updated_at',
];

export class AuthRepository {
  async findUserByEmail(email: string) {
    return db('users')
      .where('email', email.toLowerCase())
      .first();
  }

  async findUserById(id: string) {
    return db('users')
      .select(USER_SAFE_COLUMNS)
      .where('id', id)
      .first();
  }

  async createOrganization(data: {
    name: string;
    tier_id: string;
    status?: string;
  }) {
    const [org] = await db('organizations')
      .insert({
        id: uuidv4(),
        name: data.name,
        tier_id: data.tier_id,
        status: data.status || 'prospect',
      })
      .returning('*');
    return org;
  }

  async createUser(data: {
    email: string;
    password_hash: string;
    role: string;
    first_name: string;
    last_name: string;
    organization_id?: string | null;
  }) {
    const [user] = await db('users')
      .insert({
        id: uuidv4(),
        email: data.email.toLowerCase(),
        password_hash: data.password_hash,
        role: data.role,
        first_name: data.first_name,
        last_name: data.last_name,
        organization_id: data.organization_id || null,
        is_active: true,
        email_verified: false,
      })
      .returning(USER_SAFE_COLUMNS);
    return user;
  }

  async updateRefreshToken(userId: string, refreshToken: string | null) {
    await db('users')
      .where('id', userId)
      .update({ refresh_token: refreshToken });
  }

  async findByRefreshToken(refreshToken: string) {
    return db('users')
      .where('refresh_token', refreshToken)
      .first();
  }

  async updateLastLogin(userId: string) {
    await db('users')
      .where('id', userId)
      .update({ last_login_at: db.fn.now() });
  }

  async setPasswordResetToken(userId: string, tokenHash: string, expiresAt: Date) {
    await db('users')
      .where('id', userId)
      .update({
        password_reset_token: tokenHash,
        password_reset_expires: expiresAt,
      });
  }

  async findByResetToken(tokenHash: string) {
    return db('users')
      .where('password_reset_token', tokenHash)
      .first();
  }

  async updatePassword(userId: string, passwordHash: string) {
    await db('users')
      .where('id', userId)
      .update({
        password_hash: passwordHash,
        password_reset_token: null,
        password_reset_expires: null,
        refresh_token: null,
      });
  }

  async updateProfile(userId: string, data: Record<string, any>) {
    const [updated] = await db('users')
      .where('id', userId)
      .update(data)
      .returning(USER_SAFE_COLUMNS);
    return updated;
  }

  async clearAllRefreshTokens(userId: string) {
    await db('users')
      .where('id', userId)
      .update({ refresh_token: null });
  }

  async getDefaultTierId(): Promise<string> {
    const tier = await db('partner_tiers')
      .where('rank', 1)
      .select('id')
      .first();
    return tier?.id;
  }
}

export default new AuthRepository();
