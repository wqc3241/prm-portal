import { Request, Response, NextFunction } from 'express';
import quoteService from '../services/quote.service';
import { sendSuccess } from '../utils/response';
import { parsePagination, buildPaginationMeta } from '../utils/pagination';

class QuoteController {
  // POST /quotes
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const quote = await quoteService.createQuote(req.body, req.user!);
      sendSuccess(res, quote, 201);
    } catch (err) {
      next(err);
    }
  }

  // GET /quotes
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const pagination = parsePagination(req);
      const filters = {
        status: req.query.status as string | undefined,
        deal_id: req.query.deal_id as string | undefined,
        customer_name: req.query.customer_name as string | undefined,
        min_amount: req.query.min_amount ? Number(req.query.min_amount) : undefined,
        max_amount: req.query.max_amount ? Number(req.query.max_amount) : undefined,
        created_after: req.query.created_after as string | undefined,
        created_before: req.query.created_before as string | undefined,
        created_by: req.query.created_by as string | undefined,
      };

      const { data, total } = await quoteService.listQuotes(
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

  // GET /quotes/:id
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const quote = await quoteService.getQuote(req.params.id, req.orgScope!);
      sendSuccess(res, quote, 200);
    } catch (err) {
      next(err);
    }
  }

  // PATCH /quotes/:id
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const quote = await quoteService.updateQuote(
        req.params.id,
        req.body,
        req.user!,
        req.orgScope!,
      );
      sendSuccess(res, quote, 200);
    } catch (err) {
      next(err);
    }
  }

  // DELETE /quotes/:id
  async deleteQuote(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await quoteService.deleteQuote(
        req.params.id,
        req.user!,
        req.orgScope!,
      );
      sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  // POST /quotes/:id/submit
  async submit(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await quoteService.submitQuote(req.params.id, req.user!, req.orgScope!);
      sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  // POST /quotes/:id/approve
  async approve(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await quoteService.approveQuote(
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

  // POST /quotes/:id/reject
  async reject(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await quoteService.rejectQuote(
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

  // POST /quotes/:id/send
  async send(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await quoteService.sendQuote(req.params.id, req.user!, req.orgScope!);
      sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  // POST /quotes/:id/accept
  async accept(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await quoteService.acceptQuote(req.params.id, req.user!, req.orgScope!);
      sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  // POST /quotes/:id/clone
  async clone(req: Request, res: Response, next: NextFunction) {
    try {
      const { data, warnings } = await quoteService.cloneQuote(
        req.params.id,
        req.user!,
        req.orgScope!,
      );
      const meta = warnings.length > 0 ? { warnings } : null;
      sendSuccess(res, data, 201, meta);
    } catch (err) {
      next(err);
    }
  }

  // POST /quotes/:id/recalculate
  async recalculate(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await quoteService.recalculateQuote(
        req.params.id,
        req.user!,
        req.orgScope!,
      );
      sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  // POST /quotes/:id/lines
  async addLine(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await quoteService.addLine(
        req.params.id,
        req.body,
        req.user!,
        req.orgScope!,
      );
      sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  }

  // PATCH /quotes/:id/lines/:lineId
  async updateLine(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await quoteService.updateLine(
        req.params.id,
        req.params.lineId,
        req.body,
        req.user!,
        req.orgScope!,
      );
      sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  // DELETE /quotes/:id/lines/:lineId
  async removeLine(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await quoteService.removeLine(
        req.params.id,
        req.params.lineId,
        req.user!,
        req.orgScope!,
      );
      sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  // GET /quotes/:id/history
  async getHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const history = await quoteService.getHistory(req.params.id, req.orgScope!);
      sendSuccess(res, history, 200);
    } catch (err) {
      next(err);
    }
  }
}

export default new QuoteController();
