import { Router } from 'express';
import organizationController from '../controllers/organization.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { scopeToOrg } from '../middleware/scopeToOrg';
import { validate } from '../middleware/validate';
import {
  createOrgSchema,
  updateOrgSchema,
  orgIdParamSchema,
  listOrgsQuerySchema,
} from '../validators/organization.validator';

const router = Router();

// All routes require authentication and org scoping
router.use(authenticate, scopeToOrg);

// List organizations
router.get('/', validate(listOrgsQuerySchema, 'query'), organizationController.list);

// Create organization — admin or channel_manager only
router.post(
  '/',
  authorize('admin', 'channel_manager'),
  validate(createOrgSchema),
  organizationController.create,
);

// Get organization by ID
router.get(
  '/:id',
  validate(orgIdParamSchema, 'params'),
  organizationController.getById,
);

// Update organization — admin, channel_manager, or partner_admin (own org)
router.patch(
  '/:id',
  authorize('admin', 'channel_manager', 'partner_admin'),
  validate(orgIdParamSchema, 'params'),
  validate(updateOrgSchema),
  organizationController.update,
);

// Sub-resources
router.get(
  '/:id/dashboard',
  validate(orgIdParamSchema, 'params'),
  organizationController.getDashboard,
);

router.get(
  '/:id/users',
  validate(orgIdParamSchema, 'params'),
  organizationController.getOrgUsers,
);

router.get(
  '/:id/deals',
  validate(orgIdParamSchema, 'params'),
  organizationController.getOrgDeals,
);

router.get(
  '/:id/leads',
  validate(orgIdParamSchema, 'params'),
  organizationController.getOrgLeads,
);

router.get(
  '/:id/quotes',
  validate(orgIdParamSchema, 'params'),
  organizationController.getOrgQuotes,
);

router.get(
  '/:id/mdf',
  validate(orgIdParamSchema, 'params'),
  organizationController.getOrgMdf,
);

// Recalculate tier — admin or channel_manager only
router.post(
  '/:id/recalculate-tier',
  authorize('admin', 'channel_manager'),
  validate(orgIdParamSchema, 'params'),
  organizationController.recalculateTier,
);

export default router;
