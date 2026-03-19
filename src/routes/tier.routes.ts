import { Router } from 'express';
import tierController from '../controllers/tier.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { scopeToOrg } from '../middleware/scopeToOrg';
import { validate } from '../middleware/validate';
import {
  createTierSchema,
  updateTierSchema,
  tierIdParamSchema,
} from '../validators/tier.validator';

const router = Router();

// All routes require authentication
router.use(authenticate);

// List tiers — any authenticated user
router.get('/', tierController.list);

// Create tier — admin only
router.post(
  '/',
  authorize('admin'),
  validate(createTierSchema),
  tierController.create,
);

// Get tier by ID — any authenticated user
router.get(
  '/:id',
  validate(tierIdParamSchema, 'params'),
  tierController.getById,
);

// Update tier — admin only
router.patch(
  '/:id',
  authorize('admin'),
  validate(tierIdParamSchema, 'params'),
  validate(updateTierSchema),
  tierController.update,
);

// Delete tier — admin only
router.delete(
  '/:id',
  authorize('admin'),
  validate(tierIdParamSchema, 'params'),
  tierController.delete,
);

// List organizations at tier — admin or channel_manager
router.get(
  '/:id/organizations',
  authorize('admin', 'channel_manager'),
  scopeToOrg,
  validate(tierIdParamSchema, 'params'),
  tierController.listOrganizations,
);

export default router;
