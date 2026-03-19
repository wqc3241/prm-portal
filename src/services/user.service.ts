import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import authConfig from '../config/auth';
import userRepository from '../repositories/user.repository';
import { AppError } from '../utils/AppError';
import { OrgScope, JwtPayload } from '../types/express';
import { PARTNER_ROLES } from '../config/constants';

class UserService {
  async list(
    scope: OrgScope,
    filters: {
      role?: string;
      organization_id?: string;
      is_active?: string;
      search?: string;
    },
    pagination: { offset: number; limit: number },
    sort?: string,
  ) {
    return userRepository.list(scope, filters, pagination, sort);
  }

  async getById(id: string, scope: OrgScope) {
    const user = await userRepository.findById(id, scope);
    if (!user) {
      throw AppError.notFound('User not found');
    }
    return user;
  }

  async create(data: any, requestor: JwtPayload) {
    // Normalize email
    data.email = data.email.toLowerCase();

    // Check for duplicate email
    const existing = await userRepository.findByEmail(data.email);
    if (existing) {
      throw new AppError('A user with this email already exists', 409, 'USER_EMAIL_EXISTS');
    }

    // Role-based creation restrictions
    if (requestor.role === 'partner_admin') {
      // partner_admin can only create partner_admin or partner_rep within own org
      if (!PARTNER_ROLES.includes(data.role)) {
        throw new AppError(
          'You do not have permission to create users with this role',
          403,
          'AUTH_INSUFFICIENT_ROLE',
        );
      }
      // Force org to be the partner_admin's own org
      data.organization_id = requestor.org_id;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, authConfig.bcryptRounds);

    const userData = {
      id: uuidv4(),
      email: data.email,
      password_hash: passwordHash,
      role: data.role,
      first_name: data.first_name,
      last_name: data.last_name,
      title: data.title || null,
      phone: data.phone || null,
      organization_id: data.organization_id || null,
      is_active: true,
      email_verified: false,
    };

    return userRepository.create(userData);
  }

  async update(id: string, data: any, requestor: JwtPayload, scope: OrgScope) {
    // Verify user exists and is within scope
    const user = await userRepository.findById(id, scope);
    if (!user) {
      throw AppError.notFound('User not found');
    }

    // Build update object based on requestor role
    const updates: Record<string, any> = {};

    if (requestor.role === 'admin') {
      // Admin can update everything
      const allowed = ['first_name', 'last_name', 'title', 'phone', 'avatar_url',
        'is_active', 'role', 'organization_id', 'notification_prefs', 'timezone'];
      for (const field of allowed) {
        if (data[field] !== undefined) updates[field] = data[field];
      }
    } else if (requestor.role === 'partner_admin') {
      // partner_admin can update users in own org with restrictions
      const allowed = ['first_name', 'last_name', 'title', 'phone', 'is_active', 'role'];
      for (const field of allowed) {
        if (data[field] !== undefined) updates[field] = data[field];
      }

      // Prevent role escalation
      if (updates.role && !PARTNER_ROLES.includes(updates.role)) {
        throw new AppError(
          'Cannot escalate user role to admin or channel_manager',
          403,
          'USER_ROLE_ESCALATION',
        );
      }

      // Ignore organization_id changes for non-admins
      delete updates.organization_id;
    } else {
      throw AppError.forbidden('You do not have permission to update users', 'AUTH_INSUFFICIENT_ROLE');
    }

    // Check: deactivating last admin in org
    if (updates.is_active === false && user.role === 'partner_admin' && user.organization_id) {
      const adminCount = await userRepository.countActiveAdminsInOrg(
        user.organization_id,
        user.id,
      );
      if (adminCount === 0) {
        throw new AppError(
          'Cannot deactivate the last active admin in this organization',
          422,
          'USER_LAST_ADMIN',
        );
      }
    }

    if (Object.keys(updates).length === 0) {
      return user; // No changes
    }

    return userRepository.update(id, updates);
  }

  async softDelete(id: string, requestor: JwtPayload) {
    // Admins cannot delete themselves
    if (requestor.sub === id) {
      throw new AppError('Cannot deactivate your own account', 422, 'USER_CANNOT_DELETE_SELF');
    }

    const user = await userRepository.findById(id, { type: 'all' });
    if (!user) {
      throw AppError.notFound('User not found');
    }

    // Check last admin guard
    if (user.role === 'partner_admin' && user.organization_id) {
      const adminCount = await userRepository.countActiveAdminsInOrg(
        user.organization_id,
        user.id,
      );
      if (adminCount === 0) {
        throw new AppError(
          'Cannot deactivate the last active admin in this organization',
          422,
          'USER_LAST_ADMIN',
        );
      }
    }

    return userRepository.update(id, { is_active: false });
  }

  async getCertifications(id: string, scope: OrgScope) {
    // Verify user exists within scope
    const user = await userRepository.findById(id, scope);
    if (!user) {
      throw AppError.notFound('User not found');
    }

    return userRepository.getCertifications(id);
  }

  async getActivity(id: string, scope: OrgScope, pagination: { offset: number; limit: number }) {
    const user = await userRepository.findById(id, scope);
    if (!user) {
      throw AppError.notFound('User not found');
    }

    return userRepository.getActivity(id, pagination);
  }
}

export default new UserService();
