import { Request, Response, NextFunction } from 'express';
import tierService from '../services/tier.service';
import { sendSuccess } from '../utils/response';
import { parsePagination, buildPaginationMeta } from '../utils/pagination';

class TierController {
  async list(_req: Request, res: Response, next: NextFunction) {
    try {
      const tiers = await tierService.list();
      sendSuccess(res, tiers, 200);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const tier = await tierService.getById(req.params.id);
      sendSuccess(res, tier, 200);
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const tier = await tierService.create(req.body);
      sendSuccess(res, tier, 201);
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const tier = await tierService.update(req.params.id, req.body);
      sendSuccess(res, tier, 200);
    } catch (err) {
      next(err);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await tierService.delete(req.params.id);
      sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  async listOrganizations(req: Request, res: Response, next: NextFunction) {
    try {
      const pagination = parsePagination(req);
      const { data, total } = await tierService.listOrganizations(
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

export default new TierController();
