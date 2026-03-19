import { Request, Response, NextFunction } from 'express';
import authService from '../services/auth.service';
import { sendSuccess } from '../utils/response';

class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.register(req.body);
      sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password);
      sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;
      const result = await authService.refresh(refreshToken);
      sendSuccess(res, result, 200);
    } catch (err) {
      next(err);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      await authService.logout(req.user!.sub);
      sendSuccess(res, { message: 'Logged out successfully' }, 200);
    } catch (err) {
      next(err);
    }
  }

  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      await authService.forgotPassword(req.body.email);
      // Always return 200 regardless of whether email exists
      sendSuccess(res, {
        message: 'If an account with that email exists, a password reset link has been sent.',
      }, 200);
    } catch (err) {
      next(err);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { token, password } = req.body;
      await authService.resetPassword(token, password);
      sendSuccess(res, { message: 'Password reset successfully' }, 200);
    } catch (err) {
      next(err);
    }
  }

  async getMe(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await authService.getMe(req.user!.sub);
      sendSuccess(res, user, 200);
    } catch (err) {
      next(err);
    }
  }

  async updateMe(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await authService.updateMe(req.user!.sub, req.body);
      sendSuccess(res, user, 200);
    } catch (err) {
      next(err);
    }
  }
}

export default new AuthController();
