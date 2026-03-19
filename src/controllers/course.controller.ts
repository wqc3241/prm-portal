import { Request, Response, NextFunction } from 'express';
import courseService from '../services/course.service';
import { sendSuccess } from '../utils/response';
import { parsePagination, buildPaginationMeta } from '../utils/pagination';

class CourseController {
  // ═══════════════════════════════════════════════════════════════════════
  // COURSES
  // ═══════════════════════════════════════════════════════════════════════

  // GET /courses
  async listCourses(req: Request, res: Response, next: NextFunction) {
    try {
      const pagination = parsePagination(req);
      const filters = {
        course_type: req.query.course_type as string | undefined,
        is_required: req.query.is_required !== undefined
          ? req.query.is_required === 'true'
          : undefined,
        required_for_tier_id: req.query.required_for_tier_id as string | undefined,
        search: req.query.search as string | undefined,
      };

      const { data, total } = await courseService.listCourses(
        filters,
        pagination,
        req.query.sort as string,
      );

      sendSuccess(res, data, 200, buildPaginationMeta(total, pagination));
    } catch (err) {
      next(err);
    }
  }

  // GET /courses/:id
  async getCourse(req: Request, res: Response, next: NextFunction) {
    try {
      const course = await courseService.getCourse(req.params.id as string, req.user?.sub);
      sendSuccess(res, course, 200);
    } catch (err) {
      next(err);
    }
  }

  // POST /courses
  async createCourse(req: Request, res: Response, next: NextFunction) {
    try {
      const course = await courseService.createCourse(req.body, req.user!);
      sendSuccess(res, course, 201);
    } catch (err) {
      next(err);
    }
  }

  // PATCH /courses/:id
  async updateCourse(req: Request, res: Response, next: NextFunction) {
    try {
      const course = await courseService.updateCourse(req.params.id as string, req.body, req.user!);
      sendSuccess(res, course, 200);
    } catch (err) {
      next(err);
    }
  }

  // DELETE /courses/:id
  async deleteCourse(req: Request, res: Response, next: NextFunction) {
    try {
      const course = await courseService.deleteCourse(req.params.id as string, req.user!);
      sendSuccess(res, course, 200);
    } catch (err) {
      next(err);
    }
  }

  // POST /courses/:id/enroll
  async enrollUser(req: Request, res: Response, next: NextFunction) {
    try {
      const cert = await courseService.enrollUser(req.params.id as string, req.body, req.user!);
      sendSuccess(res, cert, 201);
    } catch (err) {
      next(err);
    }
  }

  // POST /courses/:id/complete
  async recordCompletion(req: Request, res: Response, next: NextFunction) {
    try {
      const cert = await courseService.recordCompletion(req.params.id as string, req.body, req.user!);
      sendSuccess(res, cert, 200);
    } catch (err) {
      next(err);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CERTIFICATIONS
  // ═══════════════════════════════════════════════════════════════════════

  // GET /certifications
  async listCertifications(req: Request, res: Response, next: NextFunction) {
    try {
      const pagination = parsePagination(req);
      const filters = {
        status: req.query.status as string | undefined,
        user_id: req.query.user_id as string | undefined,
        course_id: req.query.course_id as string | undefined,
        organization_id: req.query.organization_id as string | undefined,
      };

      const { data, total } = await courseService.listCertifications(
        filters,
        req.orgScope!,
        pagination,
        req.query.sort as string,
      );

      sendSuccess(res, data, 200, buildPaginationMeta(total, pagination));
    } catch (err) {
      next(err);
    }
  }

  // PATCH /certifications/:id
  async updateCertification(req: Request, res: Response, next: NextFunction) {
    try {
      const cert = await courseService.updateCertification(req.params.id as string, req.body, req.user!);
      sendSuccess(res, cert, 200);
    } catch (err) {
      next(err);
    }
  }

  // GET /certifications/expiring
  async getExpiringCerts(req: Request, res: Response, next: NextFunction) {
    try {
      const days = req.query.days ? Number(req.query.days) : 30;
      const data = await courseService.getExpiringCerts(days, req.orgScope!);
      sendSuccess(res, data, 200);
    } catch (err) {
      next(err);
    }
  }

  // GET /certifications/org-summary/:orgId
  async getOrgCertSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await courseService.getOrgCertSummary(req.params.orgId as string, req.user!);
      sendSuccess(res, data, 200);
    } catch (err) {
      next(err);
    }
  }
}

export default new CourseController();
