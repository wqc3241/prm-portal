import courseRepository, { CourseFilters, CertificationFilters } from '../repositories/course.repository';
import notificationService from './notification.service';
import { AppError } from '../utils/AppError';
import { OrgScope, JwtPayload } from '../types/express';
import db from '../config/database';

class CourseService {
  // ═══════════════════════════════════════════════════════════════════════
  // COURSES
  // ═══════════════════════════════════════════════════════════════════════

  async listCourses(
    filters: CourseFilters,
    pagination: { offset: number; limit: number },
    sort?: string,
  ) {
    return courseRepository.findAll(filters, pagination, sort);
  }

  async getCourse(id: string, userId?: string) {
    const course = await courseRepository.findById(id);
    if (!course) {
      throw AppError.notFound('Course not found', 'COURSE_NOT_FOUND');
    }

    // Attach user's enrollment if userId provided
    let my_enrollment = null;
    if (userId) {
      const cert = await courseRepository.findCertification(userId, id);
      if (cert) {
        my_enrollment = {
          id: cert.id,
          status: cert.status,
          score: cert.score,
          certified_at: cert.certified_at,
          expires_at: cert.expires_at,
          attempts: cert.attempts,
        };
      }
    }

    return { ...course, my_enrollment };
  }

  async createCourse(data: Record<string, any>, _user: JwtPayload) {
    // Validate required_for_tier_id if provided
    if (data.required_for_tier_id) {
      const tier = await db('partner_tiers').where('id', data.required_for_tier_id).first();
      if (!tier) {
        throw AppError.validation('Invalid tier ID', 'required_for_tier_id');
      }
    }

    const courseData: Record<string, any> = {
      name: data.name,
      description: data.description || null,
      course_type: data.course_type,
      duration_hours: data.duration_hours || null,
      passing_score: data.passing_score,
      certification_valid_months: data.certification_valid_months,
      is_required: data.is_required || false,
      required_for_tier_id: data.required_for_tier_id || null,
      content_url: data.content_url || null,
      is_active: true,
    };

    return courseRepository.create(courseData);
  }

  async updateCourse(id: string, data: Record<string, any>, _user: JwtPayload) {
    const course = await courseRepository.findById(id);
    if (!course) {
      throw AppError.notFound('Course not found', 'COURSE_NOT_FOUND');
    }

    if (data.required_for_tier_id) {
      const tier = await db('partner_tiers').where('id', data.required_for_tier_id).first();
      if (!tier) {
        throw AppError.validation('Invalid tier ID', 'required_for_tier_id');
      }
    }

    const allowed = [
      'name', 'description', 'course_type', 'duration_hours',
      'passing_score', 'certification_valid_months', 'is_required',
      'required_for_tier_id', 'content_url', 'is_active',
    ];

    const updates: Record<string, any> = {};
    for (const field of allowed) {
      if (data[field] !== undefined) updates[field] = data[field];
    }

    if (Object.keys(updates).length === 0) {
      return course;
    }

    return courseRepository.update(id, updates);
  }

  async deleteCourse(id: string, _user: JwtPayload) {
    const course = await courseRepository.findById(id);
    if (!course) {
      throw AppError.notFound('Course not found', 'COURSE_NOT_FOUND');
    }

    // Guard: cannot delete if there are active enrollments
    const hasActive = await courseRepository.hasActiveEnrollments(id);
    if (hasActive) {
      throw new AppError(
        'Cannot deactivate course with active enrollments (enrolled or in_progress). Complete or fail them first.',
        422,
        'COURSE_HAS_ACTIVE_ENROLLMENTS',
      );
    }

    return courseRepository.delete(id);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ENROLLMENT
  // ═══════════════════════════════════════════════════════════════════════

  async enrollUser(courseId: string, body: { user_id?: string }, user: JwtPayload) {
    const course = await courseRepository.findById(courseId);
    if (!course) {
      throw AppError.notFound('Course not found', 'COURSE_NOT_FOUND');
    }

    if (!course.is_active) {
      throw new AppError('Cannot enroll in an inactive course', 422, 'COURSE_INACTIVE');
    }

    // Determine target user
    let targetUserId = user.sub;
    if (body.user_id && body.user_id !== user.sub) {
      // partner_admin can enroll org users
      if (user.role !== 'partner_admin') {
        throw AppError.forbidden(
          'Only partner admins can enroll other users',
          'AUTH_INSUFFICIENT_ROLE',
        );
      }
      // Verify target user is in same org
      const targetUser = await db('users')
        .where('id', body.user_id)
        .where('organization_id', user.org_id)
        .where('is_active', true)
        .first();

      if (!targetUser) {
        throw AppError.notFound('User not found in your organization', 'USER_NOT_FOUND');
      }
      targetUserId = body.user_id;
    }

    // Check existing enrollment
    const existing = await courseRepository.findCertification(targetUserId, courseId);

    if (existing) {
      if (existing.status === 'enrolled' || existing.status === 'in_progress') {
        throw AppError.conflict('User is already enrolled in this course', 'ALREADY_ENROLLED');
      }

      if (existing.status === 'passed') {
        // Check if expired
        if (existing.expires_at && new Date(existing.expires_at) > new Date()) {
          throw AppError.conflict('User already has a valid certification for this course', 'ALREADY_CERTIFIED');
        }
        // Expired — allow re-enrollment
        return courseRepository.updateCertification(existing.id, {
          status: 'enrolled',
          score: null,
          completed_at: null,
          certified_at: null,
          expires_at: null,
          certificate_url: null,
          attempts: existing.attempts + 1,
        });
      }

      if (existing.status === 'failed' || existing.status === 'expired') {
        // Re-enroll
        return courseRepository.updateCertification(existing.id, {
          status: 'enrolled',
          score: null,
          completed_at: null,
          certified_at: null,
          expires_at: null,
          certificate_url: null,
          attempts: existing.attempts + 1,
        });
      }
    }

    // New enrollment
    return courseRepository.createCertification({
      user_id: targetUserId,
      course_id: courseId,
      status: 'enrolled',
      attempts: 1,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // COMPLETION
  // ═══════════════════════════════════════════════════════════════════════

  async recordCompletion(courseId: string, data: { user_id: string; score: number }, user: JwtPayload) {
    const course = await courseRepository.findById(courseId);
    if (!course) {
      throw AppError.notFound('Course not found', 'COURSE_NOT_FOUND');
    }

    const cert = await courseRepository.findCertification(data.user_id, courseId);
    if (!cert) {
      throw AppError.notFound('No enrollment found for this user and course', 'ENROLLMENT_NOT_FOUND');
    }

    if (cert.status !== 'enrolled' && cert.status !== 'in_progress') {
      throw new AppError(
        `Cannot record completion for enrollment with status '${cert.status}'. Must be enrolled or in_progress.`,
        422,
        'INVALID_COMPLETION_STATUS',
      );
    }

    const passed = data.score >= course.passing_score;
    const now = new Date();

    const updates: Record<string, any> = {
      score: data.score,
      completed_at: now,
    };

    if (passed) {
      updates.status = 'passed';
      updates.certified_at = now;
      const expiresAt = new Date(now);
      expiresAt.setMonth(expiresAt.getMonth() + course.certification_valid_months);
      updates.expires_at = expiresAt;
    } else {
      updates.status = 'failed';
    }

    const updated = await courseRepository.updateCertification(cert.id, updates);

    // Recalculate org certified_rep_count if passed
    if (passed) {
      const targetUser = await db('users').where('id', data.user_id).select('organization_id').first();
      if (targetUser?.organization_id) {
        courseRepository.recalcCertifiedRepCount(targetUser.organization_id).catch((err) => {
          console.error('[CourseService] Failed to recalc certified_rep_count:', err.message);
        });
      }
    }

    return updated;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CERTIFICATION QUERIES
  // ═══════════════════════════════════════════════════════════════════════

  async listCertifications(
    filters: CertificationFilters,
    scope: OrgScope,
    pagination: { offset: number; limit: number },
    sort?: string,
  ) {
    return courseRepository.listCertifications(filters, scope, pagination, sort);
  }

  async updateCertification(id: string, data: Record<string, any>, _user: JwtPayload) {
    const cert = await courseRepository.findCertificationById(id);
    if (!cert) {
      throw AppError.notFound('Certification not found', 'ENROLLMENT_NOT_FOUND');
    }

    const allowed = ['status', 'score', 'certified_at', 'expires_at', 'certificate_url'];
    const updates: Record<string, any> = {};
    for (const field of allowed) {
      if (data[field] !== undefined) updates[field] = data[field];
    }

    // Auto-set certified_at and expires_at when transitioning to passed
    if (updates.status === 'passed' && !cert.certified_at) {
      const now = new Date();
      if (!updates.certified_at) updates.certified_at = now;
      if (!updates.expires_at) {
        const expiresAt = new Date(now);
        expiresAt.setMonth(expiresAt.getMonth() + cert.certification_valid_months);
        updates.expires_at = expiresAt;
      }
    }

    if (Object.keys(updates).length === 0) {
      return cert;
    }

    const updated = await courseRepository.updateCertification(id, updates);

    // Recalc if status changed to/from passed
    if (updates.status && cert.organization_id) {
      courseRepository.recalcCertifiedRepCount(cert.organization_id).catch((err) => {
        console.error('[CourseService] Failed to recalc certified_rep_count:', err.message);
      });
    }

    return updated;
  }

  async getOrgCertSummary(orgId: string, user: JwtPayload) {
    // Validate access
    if (user.role === 'partner_admin' || user.role === 'partner_rep') {
      if (user.org_id !== orgId) {
        throw AppError.forbidden('You can only view your own organization\'s certifications', 'AUTH_INSUFFICIENT_ROLE');
      }
    } else if (user.role === 'channel_manager') {
      const assigned = await db('organizations')
        .where('id', orgId)
        .where('channel_manager_id', user.sub)
        .first();
      if (!assigned) {
        throw AppError.forbidden('Organization is not assigned to you', 'AUTH_INSUFFICIENT_ROLE');
      }
    }
    // admin can access any

    return courseRepository.getOrgCertSummary(orgId);
  }

  async getExpiringCerts(
    days: number,
    scope: OrgScope,
  ) {
    return courseRepository.getExpiringCerts(days, scope);
  }
}

export default new CourseService();
