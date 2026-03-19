/**
 * Unit tests for CourseService.
 *
 * All external dependencies (courseRepository, notificationService, db)
 * are fully mocked. No database or network connections required.
 *
 * Coverage: Course CRUD, enrollment state machine, completion logic,
 * org cert summary, org scoping, delete guard.
 */

// -- Mocks must be declared before any imports --

jest.mock('../../../src/repositories/course.repository', () => ({
  __esModule: true,
  default: {
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findCertification: jest.fn(),
    findCertificationById: jest.fn(),
    listCertifications: jest.fn(),
    createCertification: jest.fn(),
    updateCertification: jest.fn(),
    getOrgCertSummary: jest.fn(),
    getExpiringCerts: jest.fn(),
    updateExpiredCerts: jest.fn(),
    findCertsExpiringInWindow: jest.fn(),
    getPartnerAdminsForOrg: jest.fn(),
    getAffectedOrgIds: jest.fn(),
    recalcCertifiedRepCount: jest.fn(),
    hasActiveEnrollments: jest.fn(),
  },
}));

jest.mock('../../../src/services/notification.service', () => ({
  __esModule: true,
  default: {
    createNotification: jest.fn(),
    reminderExists: jest.fn(),
  },
}));

const mockDbChain: any = {
  select: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  whereIn: jest.fn().mockReturnThis(),
  first: jest.fn(),
  increment: jest.fn().mockReturnThis(),
  count: jest.fn().mockReturnThis(),
};
const mockDb = jest.fn(() => mockDbChain);
(mockDb as any).raw = jest.fn();
(mockDb as any).fn = { now: jest.fn(() => new Date()) };

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: mockDb,
}));

// -- Imports --

import courseService from '../../../src/services/course.service';
import courseRepository from '../../../src/repositories/course.repository';
import { AppError } from '../../../src/utils/AppError';
import {
  makeJwtPayload,
  USER_IDS,
  ORG_IDS,
  TIER_IDS,
  adminPayload,
  partnerAdminPayload,
  partnerRepPayload,
  cmPayload,
} from '../../fixtures/factories';

const mockRepo = courseRepository as jest.Mocked<typeof courseRepository>;

// -- Helpers --

function makeCourse(overrides: Record<string, any> = {}) {
  return {
    id: 'course-uuid-1',
    name: 'PCNSA - Network Security',
    description: 'Palo Alto Networks Certified Network Security Administrator',
    course_type: 'exam',
    duration_hours: 4,
    passing_score: 70,
    certification_valid_months: 24,
    is_required: true,
    required_for_tier_id: TIER_IDS.innovator,
    content_url: 'https://lms.example.com/pcnsa',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function makeCert(overrides: Record<string, any> = {}) {
  return {
    id: 'cert-uuid-1',
    user_id: USER_IDS.partnerRepA,
    course_id: 'course-uuid-1',
    status: 'enrolled',
    score: null,
    completed_at: null,
    certified_at: null,
    expires_at: null,
    certificate_url: null,
    attempts: 1,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

// -- Tests --

describe('CourseService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // COURSE CRUD
  // =========================================================================

  describe('listCourses', () => {
    it('should return paginated courses from repository', async () => {
      const courses = [makeCourse(), makeCourse({ id: 'course-uuid-2', name: 'PCCSA' })];
      mockRepo.findAll.mockResolvedValue({ data: courses, total: 2 });

      const result = await courseService.listCourses(
        { course_type: 'exam' },
        { offset: 0, limit: 25 },
        'name:asc',
      );

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockRepo.findAll).toHaveBeenCalledWith(
        { course_type: 'exam' },
        { offset: 0, limit: 25 },
        'name:asc',
      );
    });
  });

  describe('getCourse', () => {
    it('should return course with enrollment data when userId provided', async () => {
      const course = makeCourse();
      const cert = makeCert({ status: 'passed', score: 85 });
      mockRepo.findById.mockResolvedValue(course);
      mockRepo.findCertification.mockResolvedValue(cert);

      const result = await courseService.getCourse('course-uuid-1', USER_IDS.partnerRepA);

      expect(result.my_enrollment).toBeDefined();
      expect(result.my_enrollment.status).toBe('passed');
      expect(result.my_enrollment.score).toBe(85);
    });

    it('should return course with null enrollment when user has none', async () => {
      mockRepo.findById.mockResolvedValue(makeCourse());
      mockRepo.findCertification.mockResolvedValue(null);

      const result = await courseService.getCourse('course-uuid-1', USER_IDS.partnerRepA);

      expect(result.my_enrollment).toBeNull();
    });

    it('should throw COURSE_NOT_FOUND for nonexistent course', async () => {
      mockRepo.findById.mockResolvedValue(undefined);

      await expect(courseService.getCourse('nonexistent')).rejects.toThrow(AppError);
      await expect(courseService.getCourse('nonexistent')).rejects.toMatchObject({
        statusCode: 404,
        code: 'COURSE_NOT_FOUND',
      });
    });
  });

  describe('createCourse', () => {
    it('should create a course with valid data', async () => {
      const data = {
        name: 'New Course',
        course_type: 'online',
        passing_score: 80,
        certification_valid_months: 12,
      };

      mockRepo.create.mockResolvedValue({ id: 'new-uuid', ...data });

      const result = await courseService.createCourse(data, adminPayload() as any);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Course',
          passing_score: 80,
          is_active: true,
        }),
      );
      expect(result.id).toBe('new-uuid');
    });

    it('should validate tier_id if provided', async () => {
      const data = {
        name: 'Tier Course',
        course_type: 'exam',
        passing_score: 70,
        certification_valid_months: 24,
        required_for_tier_id: 'bad-tier-id',
      };

      mockDbChain.first.mockResolvedValue(null); // tier not found

      await expect(courseService.createCourse(data, adminPayload() as any)).rejects.toThrow(AppError);
      await expect(courseService.createCourse(data, adminPayload() as any)).rejects.toMatchObject({
        statusCode: 422,
      });
    });
  });

  describe('updateCourse', () => {
    it('should update allowed fields', async () => {
      const existing = makeCourse();
      mockRepo.findById.mockResolvedValue(existing);
      mockRepo.update.mockResolvedValue({ ...existing, name: 'Updated Name' });

      const result = await courseService.updateCourse(
        'course-uuid-1',
        { name: 'Updated Name' },
        adminPayload() as any,
      );

      expect(mockRepo.update).toHaveBeenCalledWith('course-uuid-1', { name: 'Updated Name' });
      expect(result.name).toBe('Updated Name');
    });

    it('should throw COURSE_NOT_FOUND for nonexistent course', async () => {
      mockRepo.findById.mockResolvedValue(undefined);

      await expect(
        courseService.updateCourse('nonexistent', { name: 'X' }, adminPayload() as any),
      ).rejects.toMatchObject({ code: 'COURSE_NOT_FOUND' });
    });

    it('should return unchanged course when no allowed fields provided', async () => {
      const course = makeCourse();
      mockRepo.findById.mockResolvedValue(course);

      const result = await courseService.updateCourse(
        'course-uuid-1',
        { not_allowed_field: 'X' },
        adminPayload() as any,
      );

      expect(mockRepo.update).not.toHaveBeenCalled();
      expect(result.id).toBe(course.id);
    });
  });

  describe('deleteCourse', () => {
    it('should soft-delete course with no active enrollments', async () => {
      mockRepo.findById.mockResolvedValue(makeCourse());
      mockRepo.hasActiveEnrollments.mockResolvedValue(false);
      mockRepo.delete.mockResolvedValue({ ...makeCourse(), is_active: false });

      const result = await courseService.deleteCourse('course-uuid-1', adminPayload() as any);

      expect(mockRepo.delete).toHaveBeenCalledWith('course-uuid-1');
      expect(result.is_active).toBe(false);
    });

    it('should throw COURSE_NOT_FOUND for nonexistent course', async () => {
      mockRepo.findById.mockResolvedValue(undefined);

      await expect(
        courseService.deleteCourse('nonexistent', adminPayload() as any),
      ).rejects.toMatchObject({ code: 'COURSE_NOT_FOUND' });
    });

    it('should throw COURSE_HAS_ACTIVE_ENROLLMENTS when enrolled/in_progress exist', async () => {
      mockRepo.findById.mockResolvedValue(makeCourse());
      mockRepo.hasActiveEnrollments.mockResolvedValue(true);

      await expect(
        courseService.deleteCourse('course-uuid-1', adminPayload() as any),
      ).rejects.toMatchObject({
        statusCode: 422,
        code: 'COURSE_HAS_ACTIVE_ENROLLMENTS',
      });
      expect(mockRepo.delete).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // ENROLLMENT
  // =========================================================================

  describe('enrollUser', () => {
    it('should create new enrollment for user without existing cert', async () => {
      const course = makeCourse();
      mockRepo.findById.mockResolvedValue(course);
      mockRepo.findCertification.mockResolvedValue(null);

      const newCert = makeCert();
      mockRepo.createCertification.mockResolvedValue(newCert);

      const user = partnerRepPayload() as any;
      const result = await courseService.enrollUser('course-uuid-1', {}, user);

      expect(mockRepo.createCertification).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: user.sub,
          course_id: 'course-uuid-1',
          status: 'enrolled',
          attempts: 1,
        }),
      );
      expect(result).toEqual(newCert);
    });

    it('should block enrollment in inactive course', async () => {
      mockRepo.findById.mockResolvedValue(makeCourse({ is_active: false }));

      await expect(
        courseService.enrollUser('course-uuid-1', {}, partnerRepPayload() as any),
      ).rejects.toMatchObject({
        statusCode: 422,
        code: 'COURSE_INACTIVE',
      });
    });

    it('should throw COURSE_NOT_FOUND for nonexistent course', async () => {
      mockRepo.findById.mockResolvedValue(undefined);

      await expect(
        courseService.enrollUser('nonexistent', {}, partnerRepPayload() as any),
      ).rejects.toMatchObject({ code: 'COURSE_NOT_FOUND' });
    });

    it('should prevent double enrollment when status is enrolled', async () => {
      mockRepo.findById.mockResolvedValue(makeCourse());
      mockRepo.findCertification.mockResolvedValue(makeCert({ status: 'enrolled' }));

      await expect(
        courseService.enrollUser('course-uuid-1', {}, partnerRepPayload() as any),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'ALREADY_ENROLLED',
      });
    });

    it('should prevent double enrollment when status is in_progress', async () => {
      mockRepo.findById.mockResolvedValue(makeCourse());
      mockRepo.findCertification.mockResolvedValue(makeCert({ status: 'in_progress' }));

      await expect(
        courseService.enrollUser('course-uuid-1', {}, partnerRepPayload() as any),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'ALREADY_ENROLLED',
      });
    });

    it('should prevent re-enrollment when user has valid (non-expired) passed cert', async () => {
      const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      mockRepo.findById.mockResolvedValue(makeCourse());
      mockRepo.findCertification.mockResolvedValue(
        makeCert({ status: 'passed', expires_at: futureDate }),
      );

      await expect(
        courseService.enrollUser('course-uuid-1', {}, partnerRepPayload() as any),
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'ALREADY_CERTIFIED',
      });
    });

    it('should allow re-enrollment from expired passed cert', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // yesterday
      const existingCert = makeCert({
        status: 'passed',
        expires_at: pastDate,
        attempts: 1,
      });
      mockRepo.findById.mockResolvedValue(makeCourse());
      mockRepo.findCertification.mockResolvedValue(existingCert);
      mockRepo.updateCertification.mockResolvedValue({
        ...existingCert,
        status: 'enrolled',
        score: null,
        attempts: 2,
      });

      const result = await courseService.enrollUser('course-uuid-1', {}, partnerRepPayload() as any);

      expect(mockRepo.updateCertification).toHaveBeenCalledWith(
        existingCert.id,
        expect.objectContaining({
          status: 'enrolled',
          score: null,
          attempts: 2,
          completed_at: null,
          certified_at: null,
          expires_at: null,
        }),
      );
      expect(result.status).toBe('enrolled');
    });

    it('should allow re-enrollment from failed status', async () => {
      const existingCert = makeCert({ status: 'failed', attempts: 2 });
      mockRepo.findById.mockResolvedValue(makeCourse());
      mockRepo.findCertification.mockResolvedValue(existingCert);
      mockRepo.updateCertification.mockResolvedValue({
        ...existingCert,
        status: 'enrolled',
        attempts: 3,
      });

      const result = await courseService.enrollUser('course-uuid-1', {}, partnerRepPayload() as any);

      expect(mockRepo.updateCertification).toHaveBeenCalledWith(
        existingCert.id,
        expect.objectContaining({ status: 'enrolled', attempts: 3 }),
      );
      expect(result.status).toBe('enrolled');
    });

    it('should allow re-enrollment from expired status', async () => {
      const existingCert = makeCert({ status: 'expired', attempts: 1 });
      mockRepo.findById.mockResolvedValue(makeCourse());
      mockRepo.findCertification.mockResolvedValue(existingCert);
      mockRepo.updateCertification.mockResolvedValue({
        ...existingCert,
        status: 'enrolled',
        attempts: 2,
      });

      const result = await courseService.enrollUser('course-uuid-1', {}, partnerRepPayload() as any);

      expect(result.status).toBe('enrolled');
    });

    it('should allow partner_admin to enroll another org user', async () => {
      const targetUserId = 'target-user-uuid';
      mockRepo.findById.mockResolvedValue(makeCourse());
      mockRepo.findCertification.mockResolvedValue(null);
      mockDbChain.first.mockResolvedValue({
        id: targetUserId,
        organization_id: ORG_IDS.orgA,
        is_active: true,
      });
      const newCert = makeCert({ user_id: targetUserId });
      mockRepo.createCertification.mockResolvedValue(newCert);

      const user = partnerAdminPayload() as any;
      const result = await courseService.enrollUser(
        'course-uuid-1',
        { user_id: targetUserId },
        user,
      );

      expect(mockRepo.createCertification).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: targetUserId }),
      );
    });

    it('should prevent partner_rep from enrolling another user', async () => {
      mockRepo.findById.mockResolvedValue(makeCourse());

      await expect(
        courseService.enrollUser(
          'course-uuid-1',
          { user_id: 'other-user' },
          partnerRepPayload() as any,
        ),
      ).rejects.toMatchObject({
        statusCode: 403,
        code: 'AUTH_INSUFFICIENT_ROLE',
      });
    });
  });

  // =========================================================================
  // COMPLETION
  // =========================================================================

  describe('recordCompletion', () => {
    it('should mark as passed when score >= passing_score', async () => {
      const course = makeCourse({ passing_score: 70, certification_valid_months: 24 });
      const cert = makeCert({ status: 'enrolled' });
      mockRepo.findById.mockResolvedValue(course);
      mockRepo.findCertification.mockResolvedValue(cert);
      mockRepo.updateCertification.mockResolvedValue({
        ...cert,
        status: 'passed',
        score: 85,
        certified_at: expect.any(Date),
        expires_at: expect.any(Date),
      });

      // Mock db('users') for recalc
      mockDbChain.first.mockResolvedValue({ organization_id: ORG_IDS.orgA });
      mockRepo.recalcCertifiedRepCount.mockResolvedValue(1);

      const result = await courseService.recordCompletion(
        'course-uuid-1',
        { user_id: USER_IDS.partnerRepA, score: 85 },
        adminPayload() as any,
      );

      expect(mockRepo.updateCertification).toHaveBeenCalledWith(
        cert.id,
        expect.objectContaining({
          status: 'passed',
          score: 85,
          certified_at: expect.any(Date),
          expires_at: expect.any(Date),
        }),
      );
    });

    it('should mark as failed when score < passing_score', async () => {
      const course = makeCourse({ passing_score: 70 });
      const cert = makeCert({ status: 'in_progress' });
      mockRepo.findById.mockResolvedValue(course);
      mockRepo.findCertification.mockResolvedValue(cert);
      mockRepo.updateCertification.mockResolvedValue({
        ...cert,
        status: 'failed',
        score: 55,
      });

      const result = await courseService.recordCompletion(
        'course-uuid-1',
        { user_id: USER_IDS.partnerRepA, score: 55 },
        adminPayload() as any,
      );

      expect(mockRepo.updateCertification).toHaveBeenCalledWith(
        cert.id,
        expect.objectContaining({ status: 'failed', score: 55 }),
      );
      // Should NOT have certified_at or expires_at for failed
      const updateCall = mockRepo.updateCertification.mock.calls[0][1];
      expect(updateCall.certified_at).toBeUndefined();
      expect(updateCall.expires_at).toBeUndefined();
    });

    it('should set expires_at based on certification_valid_months', async () => {
      const course = makeCourse({ passing_score: 70, certification_valid_months: 12 });
      const cert = makeCert({ status: 'enrolled' });
      mockRepo.findById.mockResolvedValue(course);
      mockRepo.findCertification.mockResolvedValue(cert);
      mockRepo.updateCertification.mockImplementation(async (_id, updates) => ({
        ...cert,
        ...updates,
      }));
      mockDbChain.first.mockResolvedValue({ organization_id: ORG_IDS.orgA });
      mockRepo.recalcCertifiedRepCount.mockResolvedValue(1);

      await courseService.recordCompletion(
        'course-uuid-1',
        { user_id: USER_IDS.partnerRepA, score: 80 },
        adminPayload() as any,
      );

      const updateCall = mockRepo.updateCertification.mock.calls[0][1];
      const expiresAt = new Date(updateCall.expires_at);
      const certifiedAt = new Date(updateCall.certified_at);

      // expires_at should be approximately 12 months after certified_at
      const diffMonths =
        (expiresAt.getFullYear() - certifiedAt.getFullYear()) * 12 +
        (expiresAt.getMonth() - certifiedAt.getMonth());
      expect(diffMonths).toBe(12);
    });

    it('should throw ENROLLMENT_NOT_FOUND when no cert exists', async () => {
      mockRepo.findById.mockResolvedValue(makeCourse());
      mockRepo.findCertification.mockResolvedValue(null);

      await expect(
        courseService.recordCompletion(
          'course-uuid-1',
          { user_id: USER_IDS.partnerRepA, score: 80 },
          adminPayload() as any,
        ),
      ).rejects.toMatchObject({ code: 'ENROLLMENT_NOT_FOUND' });
    });

    it('should throw INVALID_COMPLETION_STATUS for already passed cert', async () => {
      mockRepo.findById.mockResolvedValue(makeCourse());
      mockRepo.findCertification.mockResolvedValue(makeCert({ status: 'passed' }));

      await expect(
        courseService.recordCompletion(
          'course-uuid-1',
          { user_id: USER_IDS.partnerRepA, score: 80 },
          adminPayload() as any,
        ),
      ).rejects.toMatchObject({
        statusCode: 422,
        code: 'INVALID_COMPLETION_STATUS',
      });
    });

    it('should throw INVALID_COMPLETION_STATUS for failed cert', async () => {
      mockRepo.findById.mockResolvedValue(makeCourse());
      mockRepo.findCertification.mockResolvedValue(makeCert({ status: 'failed' }));

      await expect(
        courseService.recordCompletion(
          'course-uuid-1',
          { user_id: USER_IDS.partnerRepA, score: 90 },
          adminPayload() as any,
        ),
      ).rejects.toMatchObject({ code: 'INVALID_COMPLETION_STATUS' });
    });

    it('should trigger certified_rep_count recalc on pass', async () => {
      const course = makeCourse({ passing_score: 70 });
      const cert = makeCert({ status: 'enrolled' });
      mockRepo.findById.mockResolvedValue(course);
      mockRepo.findCertification.mockResolvedValue(cert);
      mockRepo.updateCertification.mockResolvedValue({
        ...cert,
        status: 'passed',
      });
      mockDbChain.first.mockResolvedValue({ organization_id: ORG_IDS.orgA });
      mockRepo.recalcCertifiedRepCount.mockResolvedValue(1);

      await courseService.recordCompletion(
        'course-uuid-1',
        { user_id: USER_IDS.partnerRepA, score: 85 },
        adminPayload() as any,
      );

      // recalc is called asynchronously (fire-and-forget), give it a tick
      await new Promise((r) => setTimeout(r, 10));
      expect(mockRepo.recalcCertifiedRepCount).toHaveBeenCalledWith(ORG_IDS.orgA);
    });
  });

  // =========================================================================
  // CERTIFICATIONS
  // =========================================================================

  describe('listCertifications', () => {
    it('should delegate to repository with scope and filters', async () => {
      const scope = { type: 'own' as const, organizationId: ORG_IDS.orgA };
      mockRepo.listCertifications.mockResolvedValue({ data: [], total: 0 });

      await courseService.listCertifications(
        { status: 'passed' },
        scope,
        { offset: 0, limit: 25 },
        'created_at:desc',
      );

      expect(mockRepo.listCertifications).toHaveBeenCalledWith(
        { status: 'passed' },
        scope,
        { offset: 0, limit: 25 },
        'created_at:desc',
      );
    });
  });

  describe('getOrgCertSummary', () => {
    it('should return summary for partner_admin of own org', async () => {
      const summary = {
        organization_id: ORG_IDS.orgA,
        organization_name: 'Org Alpha',
        total_enrollments: 10,
        by_status: { enrolled: 2, in_progress: 1, passed: 5, failed: 1, expired: 1 },
        unique_certified_users: 4,
        expiring_within_30_days: 2,
        expiring_within_7_days: 0,
        by_course: [],
        tier_requirement: { min_certified_reps: 2, current_certified_reps: 4, meets_requirement: true },
      };
      mockRepo.getOrgCertSummary.mockResolvedValue(summary);

      const result = await courseService.getOrgCertSummary(ORG_IDS.orgA, partnerAdminPayload() as any);

      expect(result.total_enrollments).toBe(10);
      expect(result.tier_requirement.meets_requirement).toBe(true);
    });

    it('should throw 403 when partner_admin accesses another orgs summary', async () => {
      await expect(
        courseService.getOrgCertSummary(ORG_IDS.orgB, partnerAdminPayload() as any),
      ).rejects.toMatchObject({
        statusCode: 403,
        code: 'AUTH_INSUFFICIENT_ROLE',
      });
    });

    it('should throw 403 when channel_manager accesses unassigned org', async () => {
      mockDbChain.first.mockResolvedValue(null); // org not assigned to CM

      await expect(
        courseService.getOrgCertSummary(ORG_IDS.orgA, cmPayload() as any),
      ).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it('should allow admin to access any org summary', async () => {
      mockRepo.getOrgCertSummary.mockResolvedValue({ organization_id: ORG_IDS.orgA } as any);

      const result = await courseService.getOrgCertSummary(ORG_IDS.orgA, adminPayload() as any);

      expect(result.organization_id).toBe(ORG_IDS.orgA);
    });
  });

  describe('getExpiringCerts', () => {
    it('should delegate to repository with days and scope', async () => {
      const scope = { type: 'all' as const };
      mockRepo.getExpiringCerts.mockResolvedValue([]);

      await courseService.getExpiringCerts(30, scope);

      expect(mockRepo.getExpiringCerts).toHaveBeenCalledWith(30, scope);
    });
  });
});
