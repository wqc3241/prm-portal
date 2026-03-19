import { Router } from 'express';
import leadController from '../controllers/lead.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { scopeToOrg } from '../middleware/scopeToOrg';
import { validate } from '../middleware/validate';
import {
  createLeadSchema,
  updateLeadSchema,
  assignLeadSchema,
  bulkAssignSchema,
  acceptSchema,
  returnSchema,
  convertSchema,
  disqualifySchema,
  leadIdParamSchema,
  listLeadsQuerySchema,
} from '../validators/lead.validator';

const router = Router();

// All routes require authentication and org scoping
router.use(authenticate, scopeToOrg);

// ─── Static routes (must come before :id param routes) ─────────────

// GET /leads/unassigned — admin, channel_manager only
router.get(
  '/unassigned',
  authorize('admin', 'channel_manager'),
  leadController.unassigned,
);

// POST /leads/bulk-assign — admin, channel_manager only
router.post(
  '/bulk-assign',
  authorize('admin', 'channel_manager'),
  validate(bulkAssignSchema),
  leadController.bulkAssign,
);

// ─── Collection routes ─────────────────────────────────────────────

// GET /leads — list (all authenticated, scoped by role)
router.get(
  '/',
  validate(listLeadsQuerySchema, 'query'),
  leadController.list,
);

// POST /leads — create (admin, channel_manager only)
router.post(
  '/',
  authorize('admin', 'channel_manager'),
  validate(createLeadSchema),
  leadController.create,
);

// ─── Single-lead routes ────────────────────────────────────────────

// GET /leads/:id
router.get(
  '/:id',
  validate(leadIdParamSchema, 'params'),
  leadController.getById,
);

// PATCH /leads/:id — update (all scoped, status-dependent in service)
router.patch(
  '/:id',
  validate(leadIdParamSchema, 'params'),
  validate(updateLeadSchema),
  leadController.update,
);

// POST /leads/:id/assign — admin, channel_manager
router.post(
  '/:id/assign',
  authorize('admin', 'channel_manager'),
  validate(leadIdParamSchema, 'params'),
  validate(assignLeadSchema),
  leadController.assign,
);

// POST /leads/:id/accept — partner_admin, partner_rep
router.post(
  '/:id/accept',
  authorize('partner_admin', 'partner_rep'),
  validate(leadIdParamSchema, 'params'),
  validate(acceptSchema),
  leadController.accept,
);

// POST /leads/:id/return — partner_admin, partner_rep
router.post(
  '/:id/return',
  authorize('partner_admin', 'partner_rep'),
  validate(leadIdParamSchema, 'params'),
  validate(returnSchema),
  leadController.returnLead,
);

// POST /leads/:id/convert — partner_admin, partner_rep
router.post(
  '/:id/convert',
  authorize('partner_admin', 'partner_rep'),
  validate(leadIdParamSchema, 'params'),
  validate(convertSchema),
  leadController.convert,
);

// POST /leads/:id/disqualify — all authenticated (scoped)
router.post(
  '/:id/disqualify',
  validate(leadIdParamSchema, 'params'),
  validate(disqualifySchema),
  leadController.disqualify,
);

// GET /leads/:id/history
router.get(
  '/:id/history',
  validate(leadIdParamSchema, 'params'),
  leadController.getHistory,
);

// GET /leads/:id/assign-recommendations — admin, channel_manager only
router.get(
  '/:id/assign-recommendations',
  authorize('admin', 'channel_manager'),
  validate(leadIdParamSchema, 'params'),
  leadController.getRecommendations,
);

export default router;
