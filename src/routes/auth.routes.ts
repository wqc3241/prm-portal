import { Router } from 'express';
import authController from '../controllers/auth.controller';
import { authenticate } from '../middleware/authenticate';
import { authLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validate';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from '../validators/auth.validator';

const router = Router();

// Public routes (rate-limited)
router.post('/register', authLimiter, validate(registerSchema), authController.register);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/refresh', validate(refreshSchema), authController.refresh);
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), authController.resetPassword);

// Authenticated routes
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.getMe);
router.patch('/me', authenticate, validate(updateProfileSchema), authController.updateMe);

export default router;
