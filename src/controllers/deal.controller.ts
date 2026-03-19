import { Request, Response, NextFunction } from 'express';
import dealService from '../services/deal.service';
import { sendSuccess } from '../utils/response';
import { parsePagination, buildPaginationMeta } from '../utils/pagination';

class DealController {
  // POST /deals
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const deal = await dealService.createDeal(req.body, req.user!);
      sendSuccess(res, deal, 201);
    } catch (err) {
      next(err);
    }
  }

  // GET /deals
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const pagination = parsePagination(req);
      const filters = {
        status: req.query.status as string | undefined,
        org_id: req.query.org_id as string | undefined,
        submitted_by: req.query.submitted_by as string | undefined,
        customer_company: req.query.customer_company as string | undefined,
        min_value: req.query.min_value ? Number(req.query.min_value) : undefined,
        max_value: req.query.max_value ? Number(req.query.max_value) : undefined,
        expected_close_before: req.query.expected_close_before as string | undefined,
        expected_close_after: req.query.expected_close_after as string | undefined,
        is_conflicting: req.query.is_conflicting != null
          ? req.query.is_conflicting === 'true'
          : undefined,
        search: req.query.search as string | undefined,
      };

      const { data, total } = await dealService.listDeals(
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

  // GET /deals/:id
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const deal = await dealService.getDeal(req.params.id, req.orgScope!);
      sendSuccess(res, deal, 200);
    } catch (err) {
      next(err);
    }
  }

  // PATCH /deals/:id
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const deal = await dealService.updateDeal(
        req.params.id,
        req.body,
        req.user!,
        req.orgScope!,
      );
      sendSuccess(res, deal, 200);
    } catch (err) {
      next(err);
    }
  }

  // POST /deals/:id/submit
  async submit(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await dealService.submitDeal(req.params.id, req.user!, req.orgScope!);
      sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  // POST /deals/:id/approve
  async approve(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await dealService.approveDeal(
        req.params.id,
        req.user!,
        req.orgScope!,
        req.body.comments,
      );
      sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  // POST /deals/:id/reject
  async reject(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await dealService.rejectDeal(
        req.params.id,
        req.user!,
        req.orgScope!,
        req.body.rejection_reason,
      );
      sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  // POST /deals/:id/mark-won
  async markWon(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await dealService.markWon(
        req.params.id,
        req.user!,
        req.orgScope!,
        req.body.actual_value,
        req.body.actual_close_date,
      );
      sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  // POST /deals/:id/mark-lost
  async markLost(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await dealService.markLost(
        req.params.id,
        req.user!,
        req.orgScope!,
        req.body.loss_reason,
      );
      sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  // GET /deals/:id/conflicts
  async getConflicts(req: Request, res: Response, next: NextFunction) {
    try {
      const conflicts = await dealService.getConflicts(req.params.id, req.orgScope!);
      sendSuccess(res, conflicts, 200);
    } catch (err) {
      next(err);
    }
  }

  // GET /deals/:id/history
  async getHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const history = await dealService.getHistory(req.params.id, req.orgScope!);
      sendSuccess(res, history, 200);
    } catch (err) {
      next(err);
    }
  }

  // POST /deals/:id/products
  async addProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await dealService.addProduct(
        req.params.id,
        req.user!,
        req.orgScope!,
        req.body.product_id,
        req.body.quantity,
        req.body.unit_price,
        req.body.discount_pct,
      );
      sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  }

  // DELETE /deals/:id/products/:productId
  async removeProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await dealService.removeProduct(
        req.params.id,
        req.params.productId,
        req.user!,
        req.orgScope!,
      );
      sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  // GET /deals/conflict-check
  async conflictCheck(req: Request, res: Response, next: NextFunction) {
    try {
      const conflicts = await dealService.conflictCheck(
        req.query.customer_company as string,
        (req.query.customer_email as string) || null,
        (req.query.product_id as string) || null,
        req.user!,
      );
      sendSuccess(res, conflicts, 200);
    } catch (err) {
      next(err);
    }
  }

  // GET /deals/expiring
  async expiring(req: Request, res: Response, next: NextFunction) {
    try {
      const pagination = parsePagination(req);
      const days = parseInt(req.query.days as string, 10) || 30;
      const { data, total } = await dealService.listExpiring(days, req.orgScope!, pagination);
      sendSuccess(res, data, 200, buildPaginationMeta(total, pagination));
    } catch (err) {
      next(err);
    }
  }
}

export default new DealController();
