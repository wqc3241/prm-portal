import { Router } from 'express';
import activityController from '../controllers/activity.controller';
import { authenticate } from '../middleware/authenticate';
import { scopeToOrg } from '../middleware/scopeToOrg';
import { validate } from '../middleware/validate';
import { listActivityQuerySchema } from '../validators/activity.validator';

const router = Router();

// All routes require authentication and org scoping
router.use(authenticate, scopeToOrg);

// GET /activity — list activity feed (scoped by role)
router.get(
  '/',
  validate(listActivityQuerySchema, 'query'),
  activityController.listActivity,
);

export default router;
