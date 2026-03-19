import db from '../config/database';
import { Knex } from 'knex';
import { OrgScope } from '../types/express';
import { v4 as uuidv4 } from 'uuid';

export class OrganizationRepository {
  async findById(id: string, scope: OrgScope) {
    let query = db('organizations as o')
      .leftJoin('partner_tiers as t', 'o.tier_id', 't.id')
      .select(
        'o.*',
        't.name as tier_name',
        't.rank as tier_rank',
        't.color_hex as tier_color_hex',
      )
      .where('o.id', id);

    query = this.applyScopeToOrgs(query, scope);
    return query.first();
  }

  async list(
    scope: OrgScope,
    filters: {
      status?: string;
      tier_id?: string;
      channel_manager_id?: string;
      search?: string;
    },
    pagination: { offset: number; limit: number },
    sort?: string,
  ) {
    let query = db('organizations as o')
      .leftJoin('partner_tiers as t', 'o.tier_id', 't.id')
      .select(
        'o.*',
        't.name as tier_name',
        't.rank as tier_rank',
        't.color_hex as tier_color_hex',
      );
    let countQuery = db('organizations as o').count('* as total');

    query = this.applyScopeToOrgs(query, scope);
    countQuery = this.applyScopeToOrgs(countQuery, scope);

    if (filters.status) {
      query = query.where('o.status', filters.status);
      countQuery = countQuery.where('o.status', filters.status);
    }
    if (filters.tier_id) {
      query = query.where('o.tier_id', filters.tier_id);
      countQuery = countQuery.where('o.tier_id', filters.tier_id);
    }
    if (filters.channel_manager_id) {
      query = query.where('o.channel_manager_id', filters.channel_manager_id);
      countQuery = countQuery.where('o.channel_manager_id', filters.channel_manager_id);
    }
    if (filters.search) {
      const term = `%${filters.search}%`;
      const searchFn = function (this: Knex.QueryBuilder) {
        this.where('o.name', 'ilike', term).orWhere('o.domain', 'ilike', term);
      };
      query = query.where(searchFn);
      countQuery = countQuery.where(searchFn);
    }

    // Sort
    if (sort) {
      const [col, dir] = sort.split(':');
      const allowed = ['name', 'status', 'created_at', 'ytd_revenue'];
      if (allowed.includes(col)) {
        query = query.orderBy(`o.${col}`, dir === 'desc' ? 'desc' : 'asc');
      }
    } else {
      query = query.orderBy('o.created_at', 'desc');
    }

    query = query.offset(pagination.offset).limit(pagination.limit);

    const [totalResult] = await countQuery;
    const total = parseInt(totalResult.total as string, 10);
    const data = await query;

    // Shape tier data as nested object
    const shaped = data.map((row: any) => this.shapeTier(row));

    return { data: shaped, total };
  }

  async create(data: Record<string, any>) {
    const [org] = await db('organizations')
      .insert({ id: uuidv4(), ...data })
      .returning('*');
    return org;
  }

  async update(id: string, data: Record<string, any>) {
    const [org] = await db('organizations')
      .where('id', id)
      .update(data)
      .returning('*');
    return org;
  }

  async getOrgUsers(
    orgId: string,
    pagination: { offset: number; limit: number },
  ) {
    const countQuery = db('users')
      .where('organization_id', orgId)
      .count('* as total');

    const dataQuery = db('users')
      .select('id', 'email', 'role', 'first_name', 'last_name', 'title',
        'phone', 'is_active', 'last_login_at', 'created_at')
      .where('organization_id', orgId)
      .orderBy('created_at', 'desc')
      .offset(pagination.offset)
      .limit(pagination.limit);

    const [totalResult] = await countQuery;
    const total = parseInt(totalResult.total as string, 10);
    const data = await dataQuery;
    return { data, total };
  }

  async countOrgsByTier(tierId: string) {
    const [result] = await db('organizations')
      .where('tier_id', tierId)
      .count('* as total');
    return parseInt(result.total as string, 10);
  }

  async calculateTier(orgId: string): Promise<string | null> {
    const result = await db.raw('SELECT calculate_partner_tier(?) as tier_id', [orgId]);
    return result.rows[0]?.tier_id || null;
  }

  private applyScopeToOrgs(query: any, scope: OrgScope) {
    if (scope.type === 'all') return query;
    if (scope.type === 'assigned') {
      return query.whereIn('o.id', scope.assignedOrgIds || []);
    }
    return query.where('o.id', scope.organizationId);
  }

  private shapeTier(row: any) {
    if (!row) return row;
    const { tier_name, tier_rank, tier_color_hex, ...rest } = row;
    if (tier_name) {
      rest.tier = {
        id: rest.tier_id,
        name: tier_name,
        rank: tier_rank,
        color_hex: tier_color_hex,
      };
    }
    return rest;
  }
}

export default new OrganizationRepository();
