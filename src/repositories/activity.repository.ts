import db from '../config/database';
import { OrgScope } from '../types/express';
import { applyOrgScope } from '../middleware/scopeToOrg';

export interface ActivityFilters {
  entity_type?: string;
  entity_id?: string;
  actor_id?: string;
  action?: string;
  organization_id?: string;
  since?: string;
  until?: string;
}

export class ActivityRepository {
  async list(
    scope: OrgScope,
    filters: ActivityFilters,
    pagination: { offset: number; limit: number },
    sort?: string,
  ) {
    let query = db('activity_feed as af')
      .leftJoin('users as u', 'af.actor_id', 'u.id')
      .leftJoin('organizations as o', 'af.organization_id', 'o.id')
      .select(
        'af.*',
        db.raw("CONCAT(u.first_name, ' ', u.last_name) as actor_name"),
        'u.email as actor_email',
        'o.name as organization_name',
      );

    let countQuery = db('activity_feed as af').count('* as total');

    query = applyOrgScope(query, scope, 'af.organization_id');
    countQuery = applyOrgScope(countQuery, scope, 'af.organization_id');

    const applyFilters = (q: any) => {
      if (filters.entity_type) {
        q = q.where('af.entity_type', filters.entity_type);
      }
      if (filters.entity_id) {
        q = q.where('af.entity_id', filters.entity_id);
      }
      if (filters.actor_id) {
        q = q.where('af.actor_id', filters.actor_id);
      }
      if (filters.action) {
        q = q.where('af.action', filters.action);
      }
      if (filters.organization_id) {
        q = q.where('af.organization_id', filters.organization_id);
      }
      if (filters.since) {
        q = q.where('af.created_at', '>=', filters.since);
      }
      if (filters.until) {
        q = q.where('af.created_at', '<=', filters.until);
      }
      return q;
    };

    query = applyFilters(query);
    countQuery = applyFilters(countQuery);

    if (sort) {
      const [col, dir] = sort.split(':');
      const allowed = ['created_at'];
      if (allowed.includes(col)) {
        query = query.orderBy(`af.${col}`, dir === 'desc' ? 'desc' : 'asc');
      }
    } else {
      query = query.orderBy('af.created_at', 'desc');
    }

    query = query.offset(pagination.offset).limit(pagination.limit);

    const [totalResult] = await countQuery;
    const total = parseInt(totalResult.total as string, 10);
    const data = await query;

    return { data, total };
  }
}

export default new ActivityRepository();
