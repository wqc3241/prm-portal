import { Router } from 'express';
import dashboardController from '../controllers/dashboard.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { scopeToOrg } from '../middleware/scopeToOrg';
import { validate } from '../middleware/validate';
import {
  pipelineAnalyticsSchema,
  partnerPerformanceSchema,
  leadConversionSchema,
  mdfRoiSchema,
} from '../validators/dashboard.validator';

const router = Router();

// All analytics routes require authentication + admin or channel_manager
router.use(authenticate, authorize('admin', 'channel_manager'), scopeToOrg);

// ─── Analytics endpoints ──────────────────────────────────────────────────────

// GET /analytics/pipeline — Pipeline analytics
router.get(
  '/pipeline',
  validate(pipelineAnalyticsSchema, 'query'),
  dashboardController.getPipelineAnalytics,
);

// GET /analytics/partner-performance — Partner performance scorecards
router.get(
  '/partner-performance',
  validate(partnerPerformanceSchema, 'query'),
  dashboardController.getPartnerPerformance,
);

// GET /analytics/lead-conversion — Lead conversion funnel
router.get(
  '/lead-conversion',
  validate(leadConversionSchema, 'query'),
  dashboardController.getLeadConversion,
);

// GET /analytics/mdf-roi — MDF ROI analysis
router.get(
  '/mdf-roi',
  validate(mdfRoiSchema, 'query'),
  dashboardController.getMdfRoi,
);

export default router;
