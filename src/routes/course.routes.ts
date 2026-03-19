import { Router } from 'express';
import courseController from '../controllers/course.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { scopeToOrg } from '../middleware/scopeToOrg';
import { validate } from '../middleware/validate';
import {
  courseIdParamSchema,
  orgIdParamSchema,
  certIdParamSchema,
  createCourseSchema,
  updateCourseSchema,
  enrollSchema,
  completeSchema,
  updateCertificationSchema,
  listCoursesQuerySchema,
  listCertificationsQuerySchema,
  expiringCertsQuerySchema,
} from '../validators/course.validator';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ═══════════════════════════════════════════════════════════════════════
// COURSE ROUTES
// ═══════════════════════════════════════════════════════════════════════

// GET /courses — list courses (all roles)
router.get(
  '/',
  validate(listCoursesQuerySchema, 'query'),
  courseController.listCourses,
);

// POST /courses — create course (admin only)
router.post(
  '/',
  authorize('admin'),
  validate(createCourseSchema),
  courseController.createCourse,
);

// GET /courses/:id — get course detail
router.get(
  '/:id',
  validate(courseIdParamSchema, 'params'),
  courseController.getCourse,
);

// PATCH /courses/:id — update course (admin only)
router.patch(
  '/:id',
  authorize('admin'),
  validate(courseIdParamSchema, 'params'),
  validate(updateCourseSchema),
  courseController.updateCourse,
);

// DELETE /courses/:id — deactivate course (admin only)
router.delete(
  '/:id',
  authorize('admin'),
  validate(courseIdParamSchema, 'params'),
  courseController.deleteCourse,
);

// POST /courses/:id/enroll — enroll user (partner_admin, partner_rep)
router.post(
  '/:id/enroll',
  authorize('partner_admin', 'partner_rep'),
  validate(courseIdParamSchema, 'params'),
  validate(enrollSchema),
  courseController.enrollUser,
);

// POST /courses/:id/complete — record completion (admin only)
router.post(
  '/:id/complete',
  authorize('admin'),
  validate(courseIdParamSchema, 'params'),
  validate(completeSchema),
  courseController.recordCompletion,
);

// ═══════════════════════════════════════════════════════════════════════
// CERTIFICATION ROUTES (mounted under /certifications in app.ts)
// But included here to keep course + cert together
// ═══════════════════════════════════════════════════════════════════════

export const certificationRouter = Router();

certificationRouter.use(authenticate, scopeToOrg);

// GET /certifications/expiring — must be before /:id
certificationRouter.get(
  '/expiring',
  validate(expiringCertsQuerySchema, 'query'),
  courseController.getExpiringCerts,
);

// GET /certifications/org-summary/:orgId
certificationRouter.get(
  '/org-summary/:orgId',
  validate(orgIdParamSchema, 'params'),
  courseController.getOrgCertSummary,
);

// GET /certifications — list certs (scoped)
certificationRouter.get(
  '/',
  validate(listCertificationsQuerySchema, 'query'),
  courseController.listCertifications,
);

// PATCH /certifications/:id — update cert (admin only)
certificationRouter.patch(
  '/:id',
  authorize('admin'),
  validate(certIdParamSchema, 'params'),
  validate(updateCertificationSchema),
  courseController.updateCertification,
);

export default router;
