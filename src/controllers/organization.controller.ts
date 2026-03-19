import { Request, Response, NextFunction } from 'express';
import organizationService from '../services/organization.service';
import { sendSuccess } from '../utils/response';
import { parsePagination, buildPaginationMeta } from '../utils/pagination';

class OrganizationController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const pagination = parsePagination(req);
      const filters = {
        status: req.query.status as string | undefined,
        tier_id: req.query.tier_id as string | undefined,
        channel_manager_id: req.query.channel_manager_id as string | undefined,
        search: req.query.search as string | undefined,
      };

      const { data, total } = await organizationService.list(
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
      const org = await organizationService.getById(req.params.id, req.orgScope!);
      sendSuccess(res, org, 200);
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const org = await organizationService.create(req.body, req.user!);
      sendSuccess(res, org, 201);
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const org = await organizationService.update(
        req.params.id,
        req.body,
        req.user!,
        req.orgScope!,
      );
      sendSuccess(res, org, 200);
    } catch (err) {
      next(err);
    }
  }

  async getOrgUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const pagination = parsePagination(req);
      const { data, total } = await organizationService.getOrgUsers(
        req.params.id,
        req.orgScope!,
        pagination,
      );
      sendSuccess(res, data, 200, buildPaginationMeta(total, pagination));
    } catch (err) {
      next(err);
    }
  }

  async getOrgDeals(req: Request, res: Response, next: NextFunction) {
    try {
      const pagination = parsePagination(req);
      const { data, total } = await organizationService.getOrgDeals(
        req.params.id,
        req.orgScope!,
        pagination,
      );
      sendSuccess(res, data, 200, buildPaginationMeta(total, pagination));
    } catch (err) {
      next(err);
    }
  }

  async getOrgLeads(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await organizationService.getOrgLeads(req.params.id, req.orgScope!);
      sendSuccess(res, data, 200);
    } catch (err) {
      next(err);
    }
  }

  async getOrgQuotes(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await organizationService.getOrgQuotes(req.params.id, req.orgScope!);
      sendSuccess(res, data, 200);
    } catch (err) {
      next(err);
    }
  }

  async getOrgMdf(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await organizationService.getOrgMdf(req.params.id, req.orgScope!);
      sendSuccess(res, data, 200);
    } catch (err) {
      next(err);
    }
  }

  async getDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await organizationService.getDashboard(req.params.id, req.orgScope!);
      sendSuccess(res, data, 200);
    } catch (err) {
      next(err);
    }
  }

  async recalculateTier(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await organizationService.recalculateTier(req.params.id, req.orgScope!);
      sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }
}

export default new OrganizationController();
