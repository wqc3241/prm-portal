import { Request, Response, NextFunction } from 'express';
import userService from '../services/user.service';
import { sendSuccess } from '../utils/response';
import { parsePagination, buildPaginationMeta } from '../utils/pagination';

class UserController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const pagination = parsePagination(req);
      const filters = {
        role: req.query.role as string | undefined,
        organization_id: req.query.organization_id as string | undefined,
        is_active: req.query.is_active as string | undefined,
        search: req.query.search as string | undefined,
      };

      const { data, total } = await userService.list(
        req.orgScope!,
        filters,
        pagination,
        req.query.sort as string,
      );

      sendSuccess(res, data, 200, buildPaginationMeta(total, pagination));
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await userService.getById(req.params.id, req.orgScope!);
      sendSuccess(res, user, 200);
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await userService.create(req.body, req.user!);
      sendSuccess(res, user, 201);
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await userService.update(
        req.params.id,
        req.body,
        req.user!,
        req.orgScope!,
      );
      sendSuccess(res, user, 200);
    } catch (err) {
      next(err);
    }
  }

  async softDelete(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await userService.softDelete(req.params.id, req.user!);
      sendSuccess(res, user, 200);
    } catch (err) {
      next(err);
    }
  }

  async getCertifications(req: Request, res: Response, next: NextFunction) {
    try {
      const certs = await userService.getCertifications(req.params.id, req.orgScope!);
      sendSuccess(res, certs, 200);
    } catch (err) {
      next(err);
    }
  }

  async getActivity(req: Request, res: Response, next: NextFunction) {
    try {
      const pagination = parsePagination(req);
      const { data, total } = await userService.getActivity(
        req.params.id,
        req.orgScope!,
        pagination,
      );
      sendSuccess(res, data, 200, buildPaginationMeta(total, pagination));
    } catch (err) {
      next(err);
    }
  }
}

export default new UserController();
