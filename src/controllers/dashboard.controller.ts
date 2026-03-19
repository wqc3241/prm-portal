import { Request, Response, NextFunction } from 'express';
import dashboardService from '../services/dashboard.service';
import { sendSuccess } from '../utils/response';

class DashboardController {
  // GET /dashboard/partner
  async getPartnerDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await dashboardService.getPartnerDashboard(req.user!);
      sendSuccess(res, data, 200);
    } catch (err) {
      next(err);
    }
  }

  // GET /dashboard/channel-manager
  async getChannelManagerDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await dashboardService.getChannelManagerDashboard(req.user!);
      sendSuccess(res, data, 200);
    } catch (err) {
      next(err);
    }
  }

  // GET /dashboard/admin
  async getAdminDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await dashboardService.getAdminDashboard();
      sendSuccess(res, data, 200);
    } catch (err) {
      next(err);
    }
  }

  // GET /analytics/pipeline
  async getPipelineAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await dashboardService.getPipelineAnalytics(
        {
          start_date: req.query.start_date as string | undefined,
          end_date: req.query.end_date as string | undefined,
          org_id: req.query.org_id as string | undefined,
          product_id: req.query.product_id as string | undefined,
          group_by: req.query.group_by as string | undefined,
        },
        req.orgScope!,
      );
      sendSuccess(res, data, 200);
    } catch (err) {
      next(err);
    }
  }

  // GET /analytics/partner-performance
  async getPartnerPerformance(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await dashboardService.getPartnerPerformanceAnalytics(
        {
          org_id: req.query.org_id as string | undefined,
          tier_id: req.query.tier_id as string | undefined,
          sort_by: req.query.sort_by as string | undefined,
          sort_order: req.query.sort_order as string | undefined,
          limit: req.query.limit ? Number(req.query.limit) : undefined,
          offset: req.query.offset ? Number(req.query.offset) : undefined,
        },
        req.orgScope!,
      );
      sendSuccess(res, data, 200, {
        page: Math.floor((Number(req.query.offset) || 0) / (Number(req.query.limit) || 25)) + 1,
        per_page: Number(req.query.limit) || 25,
        total: data.total,
        total_pages: Math.ceil(data.total / (Number(req.query.limit) || 25)),
      });
    } catch (err) {
      next(err);
    }
  }

  // GET /analytics/lead-conversion
  async getLeadConversion(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await dashboardService.getLeadConversionAnalytics(
        {
          start_date: req.query.start_date as string | undefined,
          end_date: req.query.end_date as string | undefined,
          org_id: req.query.org_id as string | undefined,
          source: req.query.source as string | undefined,
        },
        req.orgScope!,
      );
      sendSuccess(res, data, 200);
    } catch (err) {
      next(err);
    }
  }

  // GET /analytics/mdf-roi
  async getMdfRoi(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await dashboardService.getMdfRoiAnalytics(
        {
          fiscal_year: req.query.fiscal_year ? Number(req.query.fiscal_year) : undefined,
          fiscal_quarter: req.query.fiscal_quarter ? Number(req.query.fiscal_quarter) : undefined,
          org_id: req.query.org_id as string | undefined,
          activity_type: req.query.activity_type as string | undefined,
        },
        req.orgScope!,
      );
      sendSuccess(res, data, 200);
    } catch (err) {
      next(err);
    }
  }
}

export default new DashboardController();
