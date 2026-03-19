import { Request, Response, NextFunction } from 'express';
import leadService from '../services/lead.service';
import { sendSuccess } from '../utils/response';
import { parsePagination, buildPaginationMeta } from '../utils/pagination';

class LeadController {
  // POST /leads
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const lead = await leadService.createLead(req.body, req.user!);
      sendSuccess(res, lead, 201);
    } catch (err) {
      next(err);
    }
  }

  // GET /leads
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const pagination = parsePagination(req);
      const filters = {
        status: req.query.status as string | undefined,
        score_min: req.query.score_min != null ? Number(req.query.score_min) : undefined,
        score_max: req.query.score_max != null ? Number(req.query.score_max) : undefined,
        source: req.query.source as string | undefined,
        assigned_org_id: req.query.assigned_org_id as string | undefined,
        assigned_user_id: req.query.assigned_user_id as string | undefined,
        search: req.query.search as string | undefined,
        created_after: req.query.created_after as string | undefined,
        created_before: req.query.created_before as string | undefined,
      };

      const { data, total } = await leadService.listLeads(
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

  // GET /leads/unassigned
  async unassigned(req: Request, res: Response, next: NextFunction) {
    try {
      const pagination = parsePagination(req);
      const { data, total } = await leadService.getUnassigned(
        req.orgScope!,
        pagination,
        req.query.sort as string,
      );
      sendSuccess(res, data, 200, buildPaginationMeta(total, pagination));
    } catch (err) {
      next(err);
    }
  }

  // GET /leads/:id
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const lead = await leadService.getLead(req.params.id, req.orgScope!);
      sendSuccess(res, lead, 200);
    } catch (err) {
      next(err);
    }
  }

  // PATCH /leads/:id
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const lead = await leadService.updateLead(
        req.params.id,
        req.body,
        req.user!,
        req.orgScope!,
      );
      sendSuccess(res, lead, 200);
    } catch (err) {
      next(err);
    }
  }

  // POST /leads/:id/assign
  async assign(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await leadService.assignLead(
        req.params.id,
        req.body.organization_id,
        req.user!,
        req.orgScope!,
        req.body.user_id,
      );
      sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  // POST /leads/bulk-assign
  async bulkAssign(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await leadService.bulkAssign(
        req.body.assignments,
        req.user!,
        req.orgScope!,
      );
      sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  // POST /leads/:id/accept
  async accept(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await leadService.acceptLead(req.params.id, req.user!, req.orgScope!);
      sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  // POST /leads/:id/return
  async returnLead(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await leadService.returnLead(
        req.params.id,
        req.body.return_reason,
        req.user!,
        req.orgScope!,
      );
      sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  // POST /leads/:id/convert
  async convert(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await leadService.convertLead(
        req.params.id,
        req.user!,
        req.orgScope!,
        req.body,
      );
      sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  // POST /leads/:id/disqualify
  async disqualify(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await leadService.disqualifyLead(
        req.params.id,
        req.body.disqualify_reason,
        req.user!,
        req.orgScope!,
      );
      sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  // GET /leads/:id/history
  async getHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const history = await leadService.getHistory(req.params.id, req.orgScope!);
      sendSuccess(res, history, 200);
    } catch (err) {
      next(err);
    }
  }

  // GET /leads/:id/assign-recommendations — admin, channel_manager
  async getRecommendations(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await leadService.getRecommendations(req.params.id, req.user!);
      sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }
}

export default new LeadController();
