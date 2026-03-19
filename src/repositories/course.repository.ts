import db from '../config/database';
import { OrgScope } from '../types/express';
import { applyOrgScope } from '../middleware/scopeToOrg';
import { v4 as uuidv4 } from 'uuid';

export interface CourseFilters {
  course_type?: string;
  is_required?: boolean;
  required_for_tier_id?: string;
  search?: string;
  is_active?: boolean;
}

export interface CertificationFilters {
  status?: string;
  user_id?: string;
  course_id?: string;
  organization_id?: string;
}

export class CourseRepository {
  // ═══════════════════════════════════════════════════════════════════════
  // COURSES
  // ═══════════════════════════════════════════════════════════════════════

  async findAll(
    filters: CourseFilters,
    pagination: { offset: number; limit: number },
    sort?: string,
  ) {
    let query = db('courses as c')
      .leftJoin('partner_tiers as t', 'c.required_for_tier_id', 't.id')
      .select(
        'c.*',
        't.name as required_for_tier_name',
        db.raw('(SELECT COUNT(*)::int FROM user_certifications WHERE course_id = c.id) as enrollment_count'),
      );

    let countQuery = db('courses as c').count('* as total');

    const applyFilters = (q: any, isCount = false) => {
      // Default to active only unless explicitly requested
      if (filters.is_active !== undefined) {
        q = q.where('c.is_active', filters.is_active);
      } else {
        q = q.where('c.is_active', true);
      }
      if (filters.course_type) {
        q = q.where('c.course_type', filters.course_type);
      }
      if (filters.is_required !== undefined) {
        q = q.where('c.is_required', filters.is_required);
      }
      if (filters.required_for_tier_id) {
        q = q.where('c.required_for_tier_id', filters.required_for_tier_id);
      }
      if (filters.search) {
        q = q.where('c.name', 'ilike', `%${filters.search}%`);
      }
      return q;
    };

    query = applyFilters(query);
    countQuery = applyFilters(countQuery, true);

    if (sort) {
      const [col, dir] = sort.split(':');
      const allowed = ['created_at', 'name', 'course_type', 'duration_hours'];
      if (allowed.includes(col)) {
        query = query.orderBy(`c.${col}`, dir === 'desc' ? 'desc' : 'asc');
      }
    } else {
      query = query.orderBy('c.name', 'asc');
    }

    query = query.offset(pagination.offset).limit(pagination.limit);

    const [totalResult] = await countQuery;
    const total = parseInt(totalResult.total as string, 10);
    const data = await query;

    return { data, total };
  }

  async findById(id: string) {
    return db('courses as c')
      .leftJoin('partner_tiers as t', 'c.required_for_tier_id', 't.id')
      .select(
        'c.*',
        't.name as required_for_tier_name',
        db.raw('(SELECT COUNT(*)::int FROM user_certifications WHERE course_id = c.id) as enrollment_count'),
      )
      .where('c.id', id)
      .first();
  }

  async create(data: Record<string, any>) {
    const id = uuidv4();
    const [course] = await db('courses')
      .insert({ id, ...data })
      .returning('*');
    return course;
  }

  async update(id: string, data: Record<string, any>) {
    const [updated] = await db('courses')
      .where('id', id)
      .update({ ...data, updated_at: db.fn.now() })
      .returning('*');
    return updated || null;
  }

  async delete(id: string) {
    const [deleted] = await db('courses')
      .where('id', id)
      .update({ is_active: false, updated_at: db.fn.now() })
      .returning('*');
    return deleted || null;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CERTIFICATIONS
  // ═══════════════════════════════════════════════════════════════════════

  async findCertification(userId: string, courseId: string) {
    return db('user_certifications')
      .where('user_id', userId)
      .where('course_id', courseId)
      .first();
  }

  async findCertificationById(id: string) {
    return db('user_certifications as uc')
      .join('courses as c', 'uc.course_id', 'c.id')
      .join('users as u', 'uc.user_id', 'u.id')
      .select(
        'uc.*',
        'c.name as course_name',
        'c.passing_score',
        'c.certification_valid_months',
        'u.email as user_email',
        'u.first_name as user_first_name',
        'u.last_name as user_last_name',
        'u.organization_id',
      )
      .where('uc.id', id)
      .first();
  }

  async listCertifications(
    filters: CertificationFilters,
    scope: OrgScope,
    pagination: { offset: number; limit: number },
    sort?: string,
  ) {
    let query = db('user_certifications as uc')
      .join('courses as c', 'uc.course_id', 'c.id')
      .join('users as u', 'uc.user_id', 'u.id')
      .select(
        'uc.*',
        'c.name as course_name',
        'c.course_type',
        'u.email as user_email',
        db.raw("CONCAT(u.first_name, ' ', u.last_name) as user_name"),
        'u.organization_id',
      );

    let countQuery = db('user_certifications as uc')
      .join('users as u', 'uc.user_id', 'u.id')
      .count('* as total');

    // Apply org scoping via user's organization_id
    query = applyOrgScope(query, scope, 'u.organization_id');
    countQuery = applyOrgScope(countQuery, scope, 'u.organization_id');

    // For partner_rep, restrict to own certifications only
    if (scope.type === 'own' && filters.user_id === undefined) {
      // partner_rep sees all org certs by default via scoping
      // but if they want only their own, they can filter by user_id
    }

    const applyF = (q: any) => {
      if (filters.status) {
        const statuses = filters.status.split(',');
        q = q.whereIn('uc.status', statuses);
      }
      if (filters.user_id) {
        q = q.where('uc.user_id', filters.user_id);
      }
      if (filters.course_id) {
        q = q.where('uc.course_id', filters.course_id);
      }
      if (filters.organization_id) {
        q = q.where('u.organization_id', filters.organization_id);
      }
      return q;
    };

    query = applyF(query);
    countQuery = applyF(countQuery);

    if (sort) {
      const [col, dir] = sort.split(':');
      const allowed = ['created_at', 'status', 'score', 'expires_at', 'certified_at'];
      if (allowed.includes(col)) {
        query = query.orderBy(`uc.${col}`, dir === 'desc' ? 'desc' : 'asc');
      }
    } else {
      query = query.orderBy('uc.created_at', 'desc');
    }

    query = query.offset(pagination.offset).limit(pagination.limit);

    const [totalResult] = await countQuery;
    const total = parseInt(totalResult.total as string, 10);
    const data = await query;

    return { data, total };
  }

  async createCertification(data: Record<string, any>) {
    const id = uuidv4();
    const [cert] = await db('user_certifications')
      .insert({ id, ...data })
      .returning('*');
    return cert;
  }

  async updateCertification(id: string, data: Record<string, any>) {
    const [updated] = await db('user_certifications')
      .where('id', id)
      .update({ ...data, updated_at: db.fn.now() })
      .returning('*');
    return updated || null;
  }

  async getOrgCertSummary(orgId: string) {
    // Status breakdown
    const statusCounts = await db('user_certifications as uc')
      .join('users as u', 'uc.user_id', 'u.id')
      .where('u.organization_id', orgId)
      .groupBy('uc.status')
      .select('uc.status', db.raw('COUNT(*)::int as count'));

    // Unique certified users (active users with passed + non-expired)
    const [uniqueCertified] = await db('user_certifications as uc')
      .join('users as u', 'uc.user_id', 'u.id')
      .where('u.organization_id', orgId)
      .where('u.is_active', true)
      .where('uc.status', 'passed')
      .where('uc.expires_at', '>', db.fn.now())
      .countDistinct('uc.user_id as count');

    // Expiring within 30 and 7 days
    const [expiring30] = await db('user_certifications as uc')
      .join('users as u', 'uc.user_id', 'u.id')
      .where('u.organization_id', orgId)
      .where('uc.status', 'passed')
      .where('uc.expires_at', '>', db.fn.now())
      .where('uc.expires_at', '<=', db.raw("NOW() + interval '30 days'"))
      .count('* as count');

    const [expiring7] = await db('user_certifications as uc')
      .join('users as u', 'uc.user_id', 'u.id')
      .where('u.organization_id', orgId)
      .where('uc.status', 'passed')
      .where('uc.expires_at', '>', db.fn.now())
      .where('uc.expires_at', '<=', db.raw("NOW() + interval '7 days'"))
      .count('* as count');

    // By course breakdown
    const byCourse = await db('user_certifications as uc')
      .join('users as u', 'uc.user_id', 'u.id')
      .join('courses as c', 'uc.course_id', 'c.id')
      .where('u.organization_id', orgId)
      .groupBy('c.id', 'c.name')
      .select(
        'c.id as course_id',
        'c.name as course_name',
        db.raw("SUM(CASE WHEN uc.status = 'passed' THEN 1 ELSE 0 END)::int as passed"),
        db.raw("SUM(CASE WHEN uc.status = 'enrolled' THEN 1 ELSE 0 END)::int as enrolled"),
        db.raw("SUM(CASE WHEN uc.status = 'expired' THEN 1 ELSE 0 END)::int as expired"),
        db.raw("SUM(CASE WHEN uc.status = 'failed' THEN 1 ELSE 0 END)::int as failed"),
        db.raw("SUM(CASE WHEN uc.status = 'in_progress' THEN 1 ELSE 0 END)::int as in_progress"),
      );

    // Org info + tier requirement
    const org = await db('organizations as o')
      .leftJoin('partner_tiers as t', 'o.tier_id', 't.id')
      .where('o.id', orgId)
      .select('o.id', 'o.name', 'o.certified_rep_count', 't.min_certified_reps')
      .first();

    const byStatus: Record<string, number> = {};
    let totalEnrollments = 0;
    for (const row of statusCounts) {
      byStatus[row.status] = row.count;
      totalEnrollments += row.count;
    }

    const uniqueCertifiedCount = parseInt(uniqueCertified.count as string, 10);

    return {
      organization_id: orgId,
      organization_name: org?.name || null,
      total_enrollments: totalEnrollments,
      by_status: {
        enrolled: byStatus.enrolled || 0,
        in_progress: byStatus.in_progress || 0,
        passed: byStatus.passed || 0,
        failed: byStatus.failed || 0,
        expired: byStatus.expired || 0,
      },
      unique_certified_users: uniqueCertifiedCount,
      expiring_within_30_days: parseInt(expiring30.count as string, 10),
      expiring_within_7_days: parseInt(expiring7.count as string, 10),
      by_course: byCourse,
      tier_requirement: {
        min_certified_reps: org?.min_certified_reps || 0,
        current_certified_reps: uniqueCertifiedCount,
        meets_requirement: uniqueCertifiedCount >= (org?.min_certified_reps || 0),
      },
    };
  }

  async getExpiringCerts(days: number, scope: OrgScope) {
    let query = db('user_certifications as uc')
      .join('courses as c', 'uc.course_id', 'c.id')
      .join('users as u', 'uc.user_id', 'u.id')
      .select(
        'uc.*',
        'c.name as course_name',
        'u.email as user_email',
        db.raw("CONCAT(u.first_name, ' ', u.last_name) as user_name"),
        'u.organization_id',
      )
      .where('uc.status', 'passed')
      .where('uc.expires_at', '>', db.fn.now())
      .where('uc.expires_at', '<=', db.raw(`NOW() + interval '${days} days'`))
      .where('u.is_active', true);

    query = applyOrgScope(query, scope, 'u.organization_id');
    return query.orderBy('uc.expires_at', 'asc');
  }

  async updateExpiredCerts() {
    return db('user_certifications')
      .where('status', 'passed')
      .where('expires_at', '<', db.fn.now())
      .update({ status: 'expired', updated_at: db.fn.now() });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // HELPERS FOR BACKGROUND JOB
  // ═══════════════════════════════════════════════════════════════════════

  async findCertsExpiringInWindow(minDays: number, maxDays: number) {
    return db('user_certifications as uc')
      .join('courses as c', 'uc.course_id', 'c.id')
      .join('users as u', 'uc.user_id', 'u.id')
      .select(
        'uc.id',
        'uc.user_id',
        'uc.course_id',
        'uc.expires_at',
        'c.name as course_name',
        'u.email as user_email',
        'u.organization_id',
      )
      .where('uc.status', 'passed')
      .where('u.is_active', true)
      .where('uc.expires_at', '>', db.raw(`NOW() + interval '${minDays} days'`))
      .where('uc.expires_at', '<=', db.raw(`NOW() + interval '${maxDays} days'`));
  }

  async getPartnerAdminsForOrg(orgId: string) {
    return db('users')
      .select('id')
      .where('organization_id', orgId)
      .where('role', 'partner_admin')
      .where('is_active', true);
  }

  async getAffectedOrgIds() {
    return db('user_certifications as uc')
      .join('users as u', 'uc.user_id', 'u.id')
      .where('uc.updated_at', '>', db.raw("NOW() - interval '1 day'"))
      .whereNotNull('u.organization_id')
      .distinct('u.organization_id as org_id');
  }

  async recalcCertifiedRepCount(orgId: string) {
    const [result] = await db('user_certifications as uc')
      .join('users as u', 'uc.user_id', 'u.id')
      .where('u.organization_id', orgId)
      .where('u.is_active', true)
      .where('uc.status', 'passed')
      .where('uc.expires_at', '>', db.fn.now())
      .countDistinct('uc.user_id as count');

    const count = parseInt(result.count as string, 10);
    await db('organizations')
      .where('id', orgId)
      .update({ certified_rep_count: count });

    return count;
  }

  async hasActiveEnrollments(courseId: string): Promise<boolean> {
    const [result] = await db('user_certifications')
      .where('course_id', courseId)
      .whereIn('status', ['enrolled', 'in_progress'])
      .count('* as total');
    return parseInt(result.total as string, 10) > 0;
  }
}

export default new CourseRepository();
