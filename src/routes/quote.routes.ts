import { Router } from 'express';
import quoteController from '../controllers/quote.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { scopeToOrg } from '../middleware/scopeToOrg';
import { validate } from '../middleware/validate';
import {
  createQuoteSchema,
  updateQuoteSchema,
  addLineSchema,
  updateLineSchema,
  submitQuoteSchema,
  approveQuoteSchema,
  rejectQuoteSchema,
  sendQuoteSchema,
  acceptQuoteSchema,
  cloneQuoteSchema,
  recalculateQuoteSchema,
  quoteIdParamSchema,
  lineIdParamsSchema,
  listQuotesQuerySchema,
} from '../validators/quote.validator';

const router = Router();

// All routes require authentication and org scoping
router.use(authenticate, scopeToOrg);

// ─── Collection routes ─────────────────────────────────────────────

// GET /quotes — list (all authenticated, scoped by role)
router.get(
  '/',
  validate(listQuotesQuerySchema, 'query'),
  quoteController.list,
);

// POST /quotes — create (partner_admin, partner_rep only)
router.post(
  '/',
  authorize('partner_admin', 'partner_rep'),
  validate(createQuoteSchema),
  quoteController.create,
);

// ─── Single-quote routes ──────────────────────────────────────────

// GET /quotes/:id
router.get(
  '/:id',
  validate(quoteIdParamSchema, 'params'),
  quoteController.getById,
);

// PATCH /quotes/:id — update header (status-dependent in service)
router.patch(
  '/:id',
  validate(quoteIdParamSchema, 'params'),
  validate(updateQuoteSchema),
  quoteController.update,
);

// DELETE /quotes/:id — delete draft quote
router.delete(
  '/:id',
  validate(quoteIdParamSchema, 'params'),
  quoteController.deleteQuote,
);

// ─── Lifecycle actions ────────────────────────────────────────────

// POST /quotes/:id/submit — partner_admin, partner_rep
router.post(
  '/:id/submit',
  authorize('partner_admin', 'partner_rep'),
  validate(quoteIdParamSchema, 'params'),
  validate(submitQuoteSchema),
  quoteController.submit,
);

// POST /quotes/:id/approve — channel_manager, admin
router.post(
  '/:id/approve',
  authorize('channel_manager', 'admin'),
  validate(quoteIdParamSchema, 'params'),
  validate(approveQuoteSchema),
  quoteController.approve,
);

// POST /quotes/:id/reject — channel_manager, admin
router.post(
  '/:id/reject',
  authorize('channel_manager', 'admin'),
  validate(quoteIdParamSchema, 'params'),
  validate(rejectQuoteSchema),
  quoteController.reject,
);

// POST /quotes/:id/send — send to customer (partner side)
router.post(
  '/:id/send',
  validate(quoteIdParamSchema, 'params'),
  validate(sendQuoteSchema),
  quoteController.send,
);

// POST /quotes/:id/accept — mark as accepted
router.post(
  '/:id/accept',
  validate(quoteIdParamSchema, 'params'),
  validate(acceptQuoteSchema),
  quoteController.accept,
);

// POST /quotes/:id/clone — clone as new draft
router.post(
  '/:id/clone',
  validate(quoteIdParamSchema, 'params'),
  validate(cloneQuoteSchema),
  quoteController.clone,
);

// POST /quotes/:id/recalculate — recalculate all line pricing
router.post(
  '/:id/recalculate',
  validate(quoteIdParamSchema, 'params'),
  validate(recalculateQuoteSchema),
  quoteController.recalculate,
);

// ─── Line item routes ─────────────────────────────────────────────

// POST /quotes/:id/lines — add line item
router.post(
  '/:id/lines',
  validate(quoteIdParamSchema, 'params'),
  validate(addLineSchema),
  quoteController.addLine,
);

// PATCH /quotes/:id/lines/:lineId — update line item
router.patch(
  '/:id/lines/:lineId',
  validate(lineIdParamsSchema, 'params'),
  validate(updateLineSchema),
  quoteController.updateLine,
);

// DELETE /quotes/:id/lines/:lineId — remove line item
router.delete(
  '/:id/lines/:lineId',
  validate(lineIdParamsSchema, 'params'),
  quoteController.removeLine,
);

// ─── History ──────────────────────────────────────────────────────

// GET /quotes/:id/history — status history
router.get(
  '/:id/history',
  validate(quoteIdParamSchema, 'params'),
  quoteController.getHistory,
);

export default router;
