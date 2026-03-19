import { Router } from 'express';
import dealController from '../controllers/deal.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { scopeToOrg } from '../middleware/scopeToOrg';
import { validate } from '../middleware/validate';
import {
  createDealSchema,
  updateDealSchema,
  submitDealSchema,
  approveDealSchema,
  rejectDealSchema,
  markWonSchema,
  markLostSchema,
  addProductSchema,
  dealIdParamSchema,
  dealProductParamsSchema,
  conflictCheckQuerySchema,
  expiringQuerySchema,
  listDealsQuerySchema,
} from '../validators/deal.validator';

const router = Router();

// All routes require authentication and org scoping
router.use(authenticate, scopeToOrg);

// ─── Static routes (must come before :id param routes) ─────────────

// GET /deals/conflict-check — any authenticated user
router.get(
  '/conflict-check',
  validate(conflictCheckQuerySchema, 'query'),
  dealController.conflictCheck,
);

// GET /deals/expiring — channel_manager, admin
router.get(
  '/expiring',
  authorize('channel_manager', 'admin'),
  validate(expiringQuerySchema, 'query'),
  dealController.expiring,
);

// ─── Collection routes ─────────────────────────────────────────────

// GET /deals — list (all authenticated, scoped by role)
router.get(
  '/',
  validate(listDealsQuerySchema, 'query'),
  dealController.list,
);

// POST /deals — create (partner_admin, partner_rep only)
router.post(
  '/',
  authorize('partner_admin', 'partner_rep'),
  validate(createDealSchema),
  dealController.create,
);

// ─── Single-deal routes ────────────────────────────────────────────

// GET /deals/:id
router.get(
  '/:id',
  validate(dealIdParamSchema, 'params'),
  dealController.getById,
);

// PATCH /deals/:id — update (all scoped, status-dependent in service)
router.patch(
  '/:id',
  validate(dealIdParamSchema, 'params'),
  validate(updateDealSchema),
  dealController.update,
);

// POST /deals/:id/submit — partner_admin, partner_rep
router.post(
  '/:id/submit',
  authorize('partner_admin', 'partner_rep'),
  validate(dealIdParamSchema, 'params'),
  validate(submitDealSchema),
  dealController.submit,
);

// POST /deals/:id/approve — channel_manager, admin
router.post(
  '/:id/approve',
  authorize('channel_manager', 'admin'),
  validate(dealIdParamSchema, 'params'),
  validate(approveDealSchema),
  dealController.approve,
);

// POST /deals/:id/reject — channel_manager, admin
router.post(
  '/:id/reject',
  authorize('channel_manager', 'admin'),
  validate(dealIdParamSchema, 'params'),
  validate(rejectDealSchema),
  dealController.reject,
);

// POST /deals/:id/mark-won — all scoped
router.post(
  '/:id/mark-won',
  validate(dealIdParamSchema, 'params'),
  validate(markWonSchema),
  dealController.markWon,
);

// POST /deals/:id/mark-lost — all scoped
router.post(
  '/:id/mark-lost',
  validate(dealIdParamSchema, 'params'),
  validate(markLostSchema),
  dealController.markLost,
);

// GET /deals/:id/conflicts — all scoped
router.get(
  '/:id/conflicts',
  validate(dealIdParamSchema, 'params'),
  dealController.getConflicts,
);

// GET /deals/:id/history — all scoped
router.get(
  '/:id/history',
  validate(dealIdParamSchema, 'params'),
  dealController.getHistory,
);

// POST /deals/:id/products — add product
router.post(
  '/:id/products',
  validate(dealIdParamSchema, 'params'),
  validate(addProductSchema),
  dealController.addProduct,
);

// DELETE /deals/:id/products/:productId — remove product
router.delete(
  '/:id/products/:productId',
  validate(dealProductParamsSchema, 'params'),
  dealController.removeProduct,
);

export default router;
