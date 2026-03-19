import { Router } from 'express';
import mdfController from '../controllers/mdf.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { scopeToOrg } from '../middleware/scopeToOrg';
import { validate } from '../middleware/validate';
import {
  createAllocationSchema,
  updateAllocationSchema,
  autoAllocateSchema,
  allocationIdParamSchema,
  createRequestSchema,
  updateRequestSchema,
  submitRequestSchema,
  approveRequestSchema,
  rejectRequestSchema,
  completeActivitySchema,
  submitClaimSchema,
  approveClaimSchema,
  rejectClaimSchema,
  markReimbursedSchema,
  requestIdParamSchema,
  listAllocationsQuerySchema,
  listRequestsQuerySchema,
} from '../validators/mdf.validator';

const router = Router();

// All routes require authentication and org scoping
router.use(authenticate, scopeToOrg);

// ═══════════════════════════════════════════════════════════════════════
// ALLOCATION ROUTES
// ═══════════════════════════════════════════════════════════════════════

// ─── Static allocation routes (before :id param) ────────────────────

// POST /mdf/allocations/auto-allocate — admin only
router.post(
  '/allocations/auto-allocate',
  authorize('admin'),
  validate(autoAllocateSchema),
  mdfController.autoAllocate,
);

// ─── Collection allocation routes ───────────────────────────────────

// GET /mdf/allocations — list (all authenticated, scoped by role)
router.get(
  '/allocations',
  validate(listAllocationsQuerySchema, 'query'),
  mdfController.listAllocations,
);

// POST /mdf/allocations — create (admin, channel_manager)
router.post(
  '/allocations',
  authorize('admin', 'channel_manager'),
  validate(createAllocationSchema),
  mdfController.createAllocation,
);

// ─── Single allocation routes ───────────────────────────────────────

// GET /mdf/allocations/:id
router.get(
  '/allocations/:id',
  validate(allocationIdParamSchema, 'params'),
  mdfController.getAllocation,
);

// PATCH /mdf/allocations/:id — update (admin, channel_manager)
router.patch(
  '/allocations/:id',
  authorize('admin', 'channel_manager'),
  validate(allocationIdParamSchema, 'params'),
  validate(updateAllocationSchema),
  mdfController.updateAllocation,
);

// ═══════════════════════════════════════════════════════════════════════
// REQUEST ROUTES
// ═══════════════════════════════════════════════════════════════════════

// ─── Collection request routes ──────────────────────────────────────

// GET /mdf/requests — list (all authenticated, scoped by role)
router.get(
  '/requests',
  validate(listRequestsQuerySchema, 'query'),
  mdfController.listRequests,
);

// POST /mdf/requests — create (partner_admin only)
router.post(
  '/requests',
  authorize('partner_admin'),
  validate(createRequestSchema),
  mdfController.createRequest,
);

// ─── Single request routes ──────────────────────────────────────────

// GET /mdf/requests/:id
router.get(
  '/requests/:id',
  validate(requestIdParamSchema, 'params'),
  mdfController.getRequest,
);

// PATCH /mdf/requests/:id — update draft/rejected (partner_admin)
router.patch(
  '/requests/:id',
  authorize('partner_admin'),
  validate(requestIdParamSchema, 'params'),
  validate(updateRequestSchema),
  mdfController.updateRequest,
);

// POST /mdf/requests/:id/submit — partner_admin
router.post(
  '/requests/:id/submit',
  authorize('partner_admin'),
  validate(requestIdParamSchema, 'params'),
  validate(submitRequestSchema),
  mdfController.submitRequest,
);

// POST /mdf/requests/:id/approve — channel_manager, admin
router.post(
  '/requests/:id/approve',
  authorize('channel_manager', 'admin'),
  validate(requestIdParamSchema, 'params'),
  validate(approveRequestSchema),
  mdfController.approveRequest,
);

// POST /mdf/requests/:id/reject — channel_manager, admin
router.post(
  '/requests/:id/reject',
  authorize('channel_manager', 'admin'),
  validate(requestIdParamSchema, 'params'),
  validate(rejectRequestSchema),
  mdfController.rejectRequest,
);

// POST /mdf/requests/:id/complete — partner_admin
router.post(
  '/requests/:id/complete',
  authorize('partner_admin'),
  validate(requestIdParamSchema, 'params'),
  validate(completeActivitySchema),
  mdfController.completeActivity,
);

// POST /mdf/requests/:id/claim — partner_admin
router.post(
  '/requests/:id/claim',
  authorize('partner_admin'),
  validate(requestIdParamSchema, 'params'),
  validate(submitClaimSchema),
  mdfController.submitClaim,
);

// POST /mdf/requests/:id/approve-claim — channel_manager, admin
router.post(
  '/requests/:id/approve-claim',
  authorize('channel_manager', 'admin'),
  validate(requestIdParamSchema, 'params'),
  validate(approveClaimSchema),
  mdfController.approveClaim,
);

// POST /mdf/requests/:id/reject-claim — channel_manager, admin
router.post(
  '/requests/:id/reject-claim',
  authorize('channel_manager', 'admin'),
  validate(requestIdParamSchema, 'params'),
  validate(rejectClaimSchema),
  mdfController.rejectClaim,
);

// POST /mdf/requests/:id/reimburse — admin only
router.post(
  '/requests/:id/reimburse',
  authorize('admin'),
  validate(requestIdParamSchema, 'params'),
  validate(markReimbursedSchema),
  mdfController.markReimbursed,
);

// GET /mdf/requests/:id/history
router.get(
  '/requests/:id/history',
  validate(requestIdParamSchema, 'params'),
  mdfController.getRequestHistory,
);

export default router;
