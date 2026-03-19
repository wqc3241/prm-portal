import db from '../config/database';
import { Knex } from 'knex';
import { v4 as uuidv4 } from 'uuid';
import { OrgScope } from '../types/express';

export class TierRepository {
  async findById(id: string) {
    return db('partner_tiers').where('id', id).first();
  }

  async findByName(name: string) {
    return db('partner_tiers').where('name', name).first();
  }

  async findByRank(rank: number) {
    return db('partner_tiers').where('rank', rank).first();
  }

  async list() {
    return db('partner_tiers').orderBy('rank', 'asc');
  }

  async create(data: Record<string, any>) {
    const [tier] = await db('partner_tiers')
      .insert({ id: uuidv4(), ...data })
      .returning('*');
    return tier;
  }

  async update(id: string, data: Record<string, any>) {
    const [tier] = await db('partner_tiers')
      .where('id', id)
      .update(data)
      .returning('*');
    return tier;
  }

  async delete(id: string) {
    return db('partner_tiers').where('id', id).del();
  }

  async countOrgs(tierId: string): Promise<number> {
    const [result] = await db('organizations')
      .where('tier_id', tierId)
      .count('* as total');
    return parseInt(result.total as string, 10);
  }

  async listOrganizations(
    tierId: string,
    scope: OrgScope,
    pagination: { offset: number; limit: number },
  ) {
    let query = db('organizations')
      .where('tier_id', tierId);
    let countQuery = db('organizations')
      .where('tier_id', tierId)
      .count('* as total');

    if (scope.type === 'assigned') {
      query = query.whereIn('id', scope.assignedOrgIds || []);
      countQuery = countQuery.whereIn('id', scope.assignedOrgIds || []);
    } else if (scope.type === 'own') {
      query = query.where('id', scope.organizationId);
      countQuery = countQuery.where('id', scope.organizationId);
    }

    query = query.orderBy('name', 'asc')
      .offset(pagination.offset)
      .limit(pagination.limit);

    const [totalResult] = await countQuery;
    const total = parseInt(totalResult.total as string, 10);
    const data = await query;

    return { data, total };
  }
}

export default new TierRepository();
