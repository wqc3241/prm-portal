import { Request, Response, NextFunction } from 'express';
import mdfService from '../services/mdf.service';
import { sendSuccess } from '../utils/response';
import { parsePagination, buildPaginationMeta } from '../utils/pagination';

class MdfController {
  // ═══════════════════════════════════════════════════════════════════════
  // ALLOCATIONS
  // ═══════════════════════════════════════════════════════════════════════

  // POST /mdf/allocations
  async createAllocation(req: Request, res: Response, next: NextFunction) {
    try {
      const allocation = await mdfService.createAllocation(req.body, req.user!);
      sendSuccess(res, allocation, 201);
    } catch (err) {
      next(err);
    }
  }

  // GET /mdf/allocations
  async listAllocations(req: Request, res: Response, next: NextFunction) {
    try {
      const pagination = parsePagination(req);
      const filters = {
        organization_id: req.query.organization_id as string | undefined,
        fiscal_year: req.query.fiscal_year ? Number(req.query.fiscal_year) : undefined,
        fiscal_quarter: req.query.fiscal_quarter ? Number(req.query.fiscal_quarter) : undefined,
      };

      const { data, total } = await mdfService.listAllocations(
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

  // GET /mdf/allocations/:id
  async getAllocation(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const allocation = await mdfService.getAllocation(id, req.orgScope!);
      sendSuccess(res, allocation, 200);
    } catch (err) {
      next(err);
    }
  }

  // PATCH /mdf/allocations/:id
  async updateAllocation(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const allocation = await mdfService.updateAllocation(
        id,
        req.body,
        req.orgScope!,
      );
      sendSuccess(res, allocation, 200);
    } catch (err) {
      next(err);
    }
  }

  // POST /mdf/allocations/auto-allocate
  async autoAllocate(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await mdfService.autoAllocate(
        req.body.fiscal_year,
        req.body.fiscal_quarter,
      );
      sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // REQUESTS
  // ═══════════════════════════════════════════════════════════════════════

  // POST /mdf/requests
  async createRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const request = await mdfService.createRequest(req.body, req.user!);
      sendSuccess(res, request, 201);
    } catch (err) {
      next(err);
    }
  }

  // GET /mdf/requests
  async listRequests(req: Request, res: Response, next: NextFunction) {
    try {
      const pagination = parsePagination(req);
      const filters = {
        status: req.query.status as string | undefined,
        organization_id: req.query.organization_id as string | undefined,
        allocation_id: req.query.allocation_id as string | undefined,
        activity_type: req.query.activity_type as string | undefined,
        submitted_by: req.query.submitted_by as string | undefined,
      };

      const { data, total } = await mdfService.listRequests(
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

  // GET /mdf/requests/:id
  async getRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const request = await mdfService.getRequest(id, req.orgScope!);
      sendSuccess(res, request, 200);
    } catch (err) {
      next(err);
    }
  }

  // PATCH /mdf/requests/:id
  async updateRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const request = await mdfService.updateRequest(
        id,
        req.body,
        req.user!,
        req.orgScope!,
      );
      sendSuccess(res, request, 200);
    } catch (err) {
      next(err);
    }
  }

  // POST /mdf/requests/:id/submit
  async submitRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const result = await mdfService.submitRequest(id, req.user!, req.orgScope!);
      sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  // POST /mdf/requests/:id/approve
  async approveRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const result = await mdfService.approveRequest(
        id,
        req.body,
        req.user!,
        req.orgScope!,
      );
      sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  // POST /mdf/requests/:id/reject
  async rejectRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const result = await mdfService.rejectRequest(
        id,
        req.body,
        req.user!,
        req.orgScope!,
      );
      sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  // POST /mdf/requests/:id/complete
  async completeActivity(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const result = await mdfService.completeActivity(id, req.user!, req.orgScope!);
      sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  // POST /mdf/requests/:id/claim
  async submitClaim(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const result = await mdfService.submitClaim(
        id,
        req.body,
        req.user!,
        req.orgScope!,
      );
      sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  // POST /mdf/requests/:id/approve-claim
  async approveClaim(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const result = await mdfService.approveClaim(
        id,
        req.body,
        req.user!,
        req.orgScope!,
      );
      sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  // POST /mdf/requests/:id/reject-claim
  async rejectClaim(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const result = await mdfService.rejectClaim(
        id,
        req.body,
        req.user!,
        req.orgScope!,
      );
      sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  // POST /mdf/requests/:id/reimburse
  async markReimbursed(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const result = await mdfService.markReimbursed(
        id,
        req.body,
        req.user!,
        req.orgScope!,
      );
      sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  // GET /mdf/requests/:id/history
  async getRequestHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const history = await mdfService.getRequestHistory(id, req.orgScope!);
      sendSuccess(res, history, 200);
    } catch (err) {
      next(err);
    }
  }
}

export default new MdfController();
