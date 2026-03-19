import { Router } from 'express';
import userController from '../controllers/user.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { scopeToOrg } from '../middleware/scopeToOrg';
import { validate } from '../middleware/validate';
import {
  createUserSchema,
  updateUserSchema,
  userIdParamSchema,
  listUsersQuerySchema,
} from '../validators/user.validator';

const router = Router();

// All user routes require authentication and org scoping
router.use(authenticate, scopeToOrg);

// List users — all authenticated users can list (scoped)
router.get('/', validate(listUsersQuerySchema, 'query'), userController.list);

// Create user — admin or partner_admin only
router.post(
  '/',
  authorize('admin', 'partner_admin'),
  validate(createUserSchema),
  userController.create,
);

// Get user by ID
router.get(
  '/:id',
  validate(userIdParamSchema, 'params'),
  userController.getById,
);

// Update user — admin or partner_admin
router.patch(
  '/:id',
  authorize('admin', 'partner_admin'),
  validate(userIdParamSchema, 'params'),
  validate(updateUserSchema),
  userController.update,
);

// Soft-delete user — admin only
router.delete(
  '/:id',
  authorize('admin'),
  validate(userIdParamSchema, 'params'),
  userController.softDelete,
);

// User certifications
router.get(
  '/:id/certifications',
  validate(userIdParamSchema, 'params'),
  userController.getCertifications,
);

// User activity
router.get(
  '/:id/activity',
  validate(userIdParamSchema, 'params'),
  userController.getActivity,
);

export default router;
