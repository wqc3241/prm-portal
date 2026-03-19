import db from '../config/database';
import { Knex } from 'knex';
import { OrgScope } from '../types/express';
import { applyOrgScope } from '../middleware/scopeToOrg';

const USER_SAFE_COLUMNS = [
  'users.id', 'users.email', 'users.role', 'users.first_name', 'users.last_name',
  'users.title', 'users.phone', 'users.avatar_url', 'users.organization_id',
  'users.is_active', 'users.email_verified', 'users.last_login_at',
  'users.notification_prefs', 'users.timezone', 'users.created_at', 'users.updated_at',
];

export class UserRepository {
  async findById(id: string, scope: OrgScope) {
    let query = db('users').select(USER_SAFE_COLUMNS).where('users.id', id);
    query = applyOrgScope(query, scope, 'users.organization_id');
    return query.first();
  }

  async findByEmail(email: string) {
    return db('users').where('email', email.toLowerCase()).first();
  }

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
    let query = db('users').select(USER_SAFE_COLUMNS);
    let countQuery = db('users').count('* as total');

    // Apply org scope
    query = applyOrgScope(query, scope, 'users.organization_id');
    countQuery = applyOrgScope(countQuery, scope, 'users.organization_id');

    // Apply filters
    if (filters.role) {
      query = query.where('users.role', filters.role);
      countQuery = countQuery.where('users.role', filters.role);
    }
    if (filters.organization_id && scope.type === 'all') {
      query = query.where('users.organization_id', filters.organization_id);
      countQuery = countQuery.where('users.organization_id', filters.organization_id);
    }
    if (filters.is_active !== undefined) {
      const active = filters.is_active === 'true';
      query = query.where('users.is_active', active);
      countQuery = countQuery.where('users.is_active', active);
    }
    if (filters.search) {
      const term = `%${filters.search}%`;
      const searchFn = function (this: Knex.QueryBuilder) {
        this.where('users.first_name', 'ilike', term)
          .orWhere('users.last_name', 'ilike', term)
          .orWhere('users.email', 'ilike', term);
      };
      query = query.where(searchFn);
      countQuery = countQuery.where(searchFn);
    }

    // Sort
    if (sort) {
      const [col, dir] = sort.split(':');
      const allowed = ['first_name', 'last_name', 'email', 'role', 'created_at'];
      if (allowed.includes(col)) {
        query = query.orderBy(`users.${col}`, dir === 'desc' ? 'desc' : 'asc');
      }
    } else {
      query = query.orderBy('users.created_at', 'desc');
    }

    // Pagination
    query = query.offset(pagination.offset).limit(pagination.limit);

    const [totalResult] = await countQuery;
    const total = parseInt(totalResult.total as string, 10);
    const data = await query;

    return { data, total };
  }

  async create(data: Record<string, any>) {
    const [user] = await db('users')
      .insert(data)
      .returning(USER_SAFE_COLUMNS.map((c) => c.replace('users.', '')));
    return user;
  }

  async update(id: string, data: Record<string, any>) {
    const [user] = await db('users')
      .where('id', id)
      .update(data)
      .returning(USER_SAFE_COLUMNS.map((c) => c.replace('users.', '')));
    return user;
  }

  async countActiveAdminsInOrg(orgId: string, excludeUserId?: string) {
    let query = db('users')
      .where('organization_id', orgId)
      .where('role', 'partner_admin')
      .where('is_active', true);

    if (excludeUserId) {
      query = query.whereNot('id', excludeUserId);
    }

    const [result] = await query.count('* as total');
    return parseInt(result.total as string, 10);
  }

  async getCertifications(userId: string) {
    return db('user_certifications')
      .join('courses', 'user_certifications.course_id', 'courses.id')
      .where('user_certifications.user_id', userId)
      .select(
        'user_certifications.*',
        'courses.name as course_name',
        'courses.course_type',
        'courses.duration_hours',
      )
      .orderBy('user_certifications.created_at', 'desc');
  }

  async getActivity(
    userId: string,
    pagination: { offset: number; limit: number },
  ) {
    const countQuery = db('activity_feed')
      .where('actor_id', userId)
      .count('* as total');

    const dataQuery = db('activity_feed')
      .where('actor_id', userId)
      .orderBy('created_at', 'desc')
      .offset(pagination.offset)
      .limit(pagination.limit);

    const [totalResult] = await countQuery;
    const total = parseInt(totalResult.total as string, 10);
    const data = await dataQuery;

    return { data, total };
  }
}

export default new UserRepository();
