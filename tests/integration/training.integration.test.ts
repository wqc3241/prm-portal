/**
 * Integration tests for the Training (Courses & Certifications) API.
 *
 * Tests exercise the full request-response cycle through Express,
 * including middleware (authenticate, authorize, scopeToOrg, validate),
 * the controller, the service, and mocked repositories/database.
 *
 * Coverage:
 *   - Course lifecycle: admin creates -> partner enrolls -> admin records completion
 *   - Certification listing with org scoping
 *   - Expiring certs endpoint
 *   - RBAC: partner cannot create courses, admin cannot enroll
 */

// -- Mocks (before all imports) --

jest.mock('../../src/repositories/course.repository', () => ({
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

jest.mock('../../src/services/notification.service', () => ({
  __esModule: true,
  default: {
    createNotification: jest.fn(),
    reminderExists: jest.fn(),
    listNotifications: jest.fn(),
    getUnreadCount: jest.fn(),
    markRead: jest.fn(),
    markAllRead: jest.fn(),
    deleteNotification: jest.fn(),
  },
}));

const mockDbChain: any = {
  select: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  whereIn: jest.fn().mockResolvedValue([]),
  first: jest.fn().mockResolvedValue(null),
  increment: jest.fn().mockReturnThis(),
  count: jest.fn().mockReturnThis(),
};
const mockDb = jest.fn(() => mockDbChain);
(mockDb as any).raw = jest.fn();
(mockDb as any).fn = { now: jest.fn(() => new Date()) };

jest.mock('../../src/config/database', () => ({
  __esModule: true,
  default: mockDb,
}));

jest.mock('jsonwebtoken', () => ({
  ...jest.requireActual('jsonwebtoken'),
  verify: jest.fn(),
}));

// -- Imports --

import request from 'supertest';
import jwt from 'jsonwebtoken';
import express, { Application } from 'express';
import courseRouter, { certificationRouter } from '../../src/routes/course.routes';
import courseRepository from '../../src/repositories/course.repository';
import { ORG_IDS, USER_IDS, TIER_IDS } from '../fixtures/factories';
import { v4 as uuidv4 } from 'uuid';

const mockRepo = courseRepository as jest.Mocked<typeof courseRepository>;
const mockJwtVerify = jwt.verify as jest.Mock;

const COURSE_ID = uuidv4();
const CERT_ID = uuidv4();

// -- App setup --

function buildApp(): Application {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/courses', courseRouter);
  app.use('/api/v1/certifications', certificationRouter);
  app.use((err: any, _req: any, res: any, _next: any) => {
    const status = err.statusCode || 500;
    res.status(status).json({
      success: false,
      data: null,
      errors: err.errors || [{ code: err.code || 'INTERNAL_ERROR', message: err.message }],
      meta: null,
    });
  });
  return app;
}

const app = buildApp();

// -- JWT helpers --

function setupJwtAsAdmin() {
  // Simulate authenticate middleware's db lookups
  (mockDb as jest.Mock).mockImplementation((table: any) => {
    if (table === 'users') {
      return {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          id: USER_IDS.admin,
          email: 'admin@example.com',
          role: 'admin',
          organization_id: null,
          is_active: true,
        }),
      };
    }
    return mockDbChain;
  });
  mockJwtVerify.mockReturnValue({
    sub: USER_IDS.admin,
    email: 'admin@example.com',
    role: 'admin',
    org_id: null,
    tier_id: null,
  });
}

function setupJwtAsPartnerRep() {
  (mockDb as jest.Mock).mockImplementation((table: any) => {
    if (table === 'users') {
      return {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          id: USER_IDS.partnerRepA,
          email: 'partner.rep.a@example.com',
          role: 'partner_rep',
          organization_id: ORG_IDS.orgA,
          is_active: true,
        }),
      };
    }
    if (table === 'organizations') {
      return {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          id: ORG_IDS.orgA,
          status: 'active',
          tier_id: TIER_IDS.registered,
        }),
      };
    }
    return mockDbChain;
  });
  mockJwtVerify.mockReturnValue({
    sub: USER_IDS.partnerRepA,
    email: 'partner.rep.a@example.com',
    role: 'partner_rep',
    org_id: ORG_IDS.orgA,
    tier_id: TIER_IDS.registered,
  });
}

function setupJwtAsPartnerAdmin() {
  (mockDb as jest.Mock).mockImplementation((table: any) => {
    if (table === 'users') {
      return {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          id: USER_IDS.partnerAdminA,
          email: 'partner.admin.a@example.com',
          role: 'partner_admin',
          organization_id: ORG_IDS.orgA,
          is_active: true,
        }),
      };
    }
    if (table === 'organizations') {
      return {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({
          id: ORG_IDS.orgA,
          status: 'active',
          tier_id: TIER_IDS.registered,
        }),
      };
    }
    return mockDbChain;
  });
  mockJwtVerify.mockReturnValue({
    sub: USER_IDS.partnerAdminA,
    email: 'partner.admin.a@example.com',
    role: 'partner_admin',
    org_id: ORG_IDS.orgA,
    tier_id: TIER_IDS.registered,
  });
}

// -- Shared fixtures --

function makeCourseRow(overrides: Record<string, any> = {}) {
  return {
    id: COURSE_ID,
    name: 'PCNSA Certification',
    description: 'Network Security Administrator exam',
    course_type: 'exam',
    duration_hours: 4,
    passing_score: 70,
    certification_valid_months: 24,
    is_required: true,
    required_for_tier_id: TIER_IDS.innovator,
    content_url: 'https://lms.example.com/pcnsa',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    enrollment_count: 0,
    required_for_tier_name: 'Innovator',
    ...overrides,
  };
}

function makeCertRow(overrides: Record<string, any> = {}) {
  return {
    id: CERT_ID,
    user_id: USER_IDS.partnerRepA,
    course_id: COURSE_ID,
    status: 'enrolled',
    score: null,
    completed_at: null,
    certified_at: null,
    expires_at: null,
    certificate_url: null,
    attempts: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// -- Tests --

describe('Training Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mockDb to default behavior
    mockDb.mockImplementation(() => mockDbChain);
  });

  // =========================================================================
  // COURSE LIFECYCLE
  // =========================================================================

  describe('Course Lifecycle: create -> enroll -> complete', () => {
    it('POST /courses - admin creates course (201)', async () => {
      setupJwtAsAdmin();
      const courseData = {
        name: 'PCNSA Certification',
        course_type: 'exam',
        passing_score: 70,
        certification_valid_months: 24,
      };

      mockRepo.create.mockResolvedValue(makeCourseRow());

      const res = await request(app)
        .post('/api/v1/courses')
        .set('Authorization', 'Bearer mock-token')
        .send(courseData);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('PCNSA Certification');
    });

    it('POST /courses/:id/enroll - partner_rep enrolls self (201)', async () => {
      setupJwtAsPartnerRep();
      const course = makeCourseRow();
      mockRepo.findById.mockResolvedValue(course);
      mockRepo.findCertification.mockResolvedValue(null);
      mockRepo.createCertification.mockResolvedValue(makeCertRow());

      const res = await request(app)
        .post(`/api/v1/courses/${COURSE_ID}/enroll`)
        .set('Authorization', 'Bearer mock-token')
        .send({});

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('enrolled');
    });

    it('POST /courses/:id/complete - admin records passing completion (200)', async () => {
      setupJwtAsAdmin();
      const course = makeCourseRow({ passing_score: 70, certification_valid_months: 24 });
      const cert = makeCertRow({ status: 'enrolled' });
      mockRepo.findById.mockResolvedValue(course);
      mockRepo.findCertification.mockResolvedValue(cert);
      mockRepo.updateCertification.mockResolvedValue({
        ...cert,
        status: 'passed',
        score: 85,
        certified_at: new Date().toISOString(),
      });
      mockRepo.recalcCertifiedRepCount.mockResolvedValue(1);

      const res = await request(app)
        .post(`/api/v1/courses/${COURSE_ID}/complete`)
        .set('Authorization', 'Bearer mock-token')
        .send({ user_id: USER_IDS.partnerRepA, score: 85 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('passed');
      expect(res.body.data.score).toBe(85);
    });

    it('POST /courses/:id/complete - admin records failing completion (200)', async () => {
      setupJwtAsAdmin();
      const course = makeCourseRow({ passing_score: 70 });
      const cert = makeCertRow({ status: 'in_progress' });
      mockRepo.findById.mockResolvedValue(course);
      mockRepo.findCertification.mockResolvedValue(cert);
      mockRepo.updateCertification.mockResolvedValue({
        ...cert,
        status: 'failed',
        score: 55,
      });

      const res = await request(app)
        .post(`/api/v1/courses/${COURSE_ID}/complete`)
        .set('Authorization', 'Bearer mock-token')
        .send({ user_id: USER_IDS.partnerRepA, score: 55 });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('failed');
    });
  });

  // =========================================================================
  // COURSE LISTING
  // =========================================================================

  describe('GET /courses', () => {
    it('should return paginated courses for any authenticated user', async () => {
      setupJwtAsPartnerRep();
      mockRepo.findAll.mockResolvedValue({
        data: [makeCourseRow(), makeCourseRow({ id: 'c2', name: 'PCCSA' })],
        total: 2,
      });

      const res = await request(app)
        .get('/api/v1/courses')
        .set('Authorization', 'Bearer mock-token');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta.total).toBe(2);
    });
  });

  describe('GET /courses/:id', () => {
    it('should return course detail with enrollment info', async () => {
      setupJwtAsPartnerRep();
      const course = makeCourseRow();
      const cert = makeCertRow({ status: 'passed', score: 90 });
      mockRepo.findById.mockResolvedValue(course);
      mockRepo.findCertification.mockResolvedValue(cert);

      const res = await request(app)
        .get(`/api/v1/courses/${COURSE_ID}`)
        .set('Authorization', 'Bearer mock-token');

      expect(res.status).toBe(200);
      expect(res.body.data.my_enrollment).toBeDefined();
      expect(res.body.data.my_enrollment.status).toBe('passed');
    });
  });

  // =========================================================================
  // CERTIFICATION LISTING WITH ORG SCOPING
  // =========================================================================

  describe('GET /certifications', () => {
    it('should return org-scoped certifications for partner_admin', async () => {
      setupJwtAsPartnerAdmin();
      mockRepo.listCertifications.mockResolvedValue({
        data: [makeCertRow()],
        total: 1,
      });

      const res = await request(app)
        .get('/api/v1/certifications')
        .set('Authorization', 'Bearer mock-token');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);

      // Verify org scope was applied (check what was passed to service)
      const callArgs = mockRepo.listCertifications.mock.calls[0];
      expect(callArgs[1]).toEqual(
        expect.objectContaining({ type: 'own', organizationId: ORG_IDS.orgA }),
      );
    });
  });

  // =========================================================================
  // EXPIRING CERTS
  // =========================================================================

  describe('GET /certifications/expiring', () => {
    it('should return expiring certs with default 30 days', async () => {
      setupJwtAsPartnerAdmin();
      const expiringCert = makeCertRow({
        status: 'passed',
        expires_at: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        course_name: 'PCNSA',
      });
      mockRepo.getExpiringCerts.mockResolvedValue([expiringCert]);

      const res = await request(app)
        .get('/api/v1/certifications/expiring')
        .set('Authorization', 'Bearer mock-token');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('should accept custom days parameter', async () => {
      setupJwtAsAdmin();
      mockRepo.getExpiringCerts.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/v1/certifications/expiring?days=7')
        .set('Authorization', 'Bearer mock-token');

      expect(res.status).toBe(200);
      expect(mockRepo.getExpiringCerts).toHaveBeenCalledWith(7, expect.any(Object));
    });
  });

  // =========================================================================
  // RBAC ENFORCEMENT
  // =========================================================================

  describe('RBAC', () => {
    it('partner_rep cannot create courses (403)', async () => {
      setupJwtAsPartnerRep();

      const res = await request(app)
        .post('/api/v1/courses')
        .set('Authorization', 'Bearer mock-token')
        .send({
          name: 'Forbidden Course',
          course_type: 'online',
          passing_score: 70,
          certification_valid_months: 12,
        });

      expect(res.status).toBe(403);
      expect(res.body.errors[0].code).toBe('AUTH_INSUFFICIENT_ROLE');
    });

    it('partner_admin cannot create courses (403)', async () => {
      setupJwtAsPartnerAdmin();

      const res = await request(app)
        .post('/api/v1/courses')
        .set('Authorization', 'Bearer mock-token')
        .send({
          name: 'Forbidden Course',
          course_type: 'online',
          passing_score: 70,
          certification_valid_months: 12,
        });

      expect(res.status).toBe(403);
    });

    it('admin cannot enroll (403 - authorize middleware blocks admin role)', async () => {
      setupJwtAsAdmin();

      const res = await request(app)
        .post(`/api/v1/courses/${COURSE_ID}/enroll`)
        .set('Authorization', 'Bearer mock-token')
        .send({});

      expect(res.status).toBe(403);
    });

    it('partner_rep cannot record completion (403)', async () => {
      setupJwtAsPartnerRep();

      const res = await request(app)
        .post(`/api/v1/courses/${COURSE_ID}/complete`)
        .set('Authorization', 'Bearer mock-token')
        .send({ user_id: USER_IDS.partnerRepA, score: 85 });

      expect(res.status).toBe(403);
    });

    it('partner_rep cannot delete courses (403)', async () => {
      setupJwtAsPartnerRep();

      const res = await request(app)
        .delete(`/api/v1/courses/${COURSE_ID}`)
        .set('Authorization', 'Bearer mock-token');

      expect(res.status).toBe(403);
    });
  });

  // =========================================================================
  // VALIDATION
  // =========================================================================

  describe('Validation', () => {
    it('rejects course creation without required fields (422)', async () => {
      setupJwtAsAdmin();

      const res = await request(app)
        .post('/api/v1/courses')
        .set('Authorization', 'Bearer mock-token')
        .send({ name: 'Incomplete' }); // missing course_type, passing_score, etc.

      expect(res.status).toBe(422);
    });

    it('rejects invalid UUID in params (422)', async () => {
      setupJwtAsPartnerRep();

      const res = await request(app)
        .get('/api/v1/courses/not-a-uuid')
        .set('Authorization', 'Bearer mock-token');

      expect(res.status).toBe(422);
    });

    it('rejects completion without user_id (422)', async () => {
      setupJwtAsAdmin();

      const res = await request(app)
        .post(`/api/v1/courses/${COURSE_ID}/complete`)
        .set('Authorization', 'Bearer mock-token')
        .send({ score: 85 }); // missing user_id

      expect(res.status).toBe(422);
    });
  });

  // =========================================================================
  // AUTH REQUIRED
  // =========================================================================

  describe('Authentication', () => {
    it('returns 401 without Authorization header', async () => {
      const res = await request(app).get('/api/v1/courses');

      expect(res.status).toBe(401);
    });
  });
});
