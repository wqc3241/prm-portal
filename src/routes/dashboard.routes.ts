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

// All dashboard routes require authentication
router.use(authenticate);

// ─── Dashboard endpoints ──────────────────────────────────────────────────────

// GET /dashboard/partner — Partner dashboard (partner_admin, partner_rep)
router.get(
  '/partner',
  authorize('partner_admin', 'partner_rep'),
  scopeToOrg,
  dashboardController.getPartnerDashboard,
);

// GET /dashboard/channel-manager — CM dashboard (channel_manager)
router.get(
  '/channel-manager',
  authorize('channel_manager'),
  scopeToOrg,
  dashboardController.getChannelManagerDashboard,
);

// GET /dashboard/admin — Admin dashboard (admin)
router.get(
  '/admin',
  authorize('admin'),
  dashboardController.getAdminDashboard,
);

export default router;
