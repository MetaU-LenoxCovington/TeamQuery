import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService';
import { sessionService } from '../services/sessionServiceSingleton';

const authService = new AuthService(sessionService);

 export class AuthController {

    // POST /api/auth/register
    async register(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await authService.register(req.body);
            res.status(201).json(result);
        } catch (error) {
            next(error);
        }
    }

    // POST /api/auth/login
    async login(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await authService.login(req.body);
            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    }

    // POST /api/auth/refresh
    async refresh(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await authService.refresh(req.body);
            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    }

    // POST /api/auth/logout
    async logout(req: Request, res: Response, next: NextFunction) {
        try {
            const { refreshToken } = req.body;
            await authService.logout(refreshToken);
            res.json({message: 'Logged out successfully'});
        } catch (error) {
            next(error);
        }
    }

    // POST /api/auth/logout-all
    async logoutAll(req: Request, res: Response, next: NextFunction) {
        try {
            await authService.logoutAll(req.user!.userId, req.user!.organizationId);
            res.json({message: 'Logged out from all sessions'});
        } catch (error) {
            next(error);
        }
    }

  // GET /api/auth/me
  async getMe(req: Request, res: Response, next: NextFunction) {
    try {
      const userData = await authService.getUserWithOrganizations(
        req.user!.userId
      );

      res.json({
        user: {
          id: userData.id,
          name: userData.name,
          email: userData.email,
          organizations: userData.organizations,
        },
        sessionActive: true,
      });
    } catch (error) {
      next(error);
    }
  }

    // GET /api/auth/organizations
    async getUserOrganizations(req: Request, res: Response, next: NextFunction) {
        try {
            const { email } = req.query;

            if (!email || typeof email !== 'string') {
                const error = new Error('Email parameter is required');
                (error as any).statusCode = 400;
                throw error;
            }

            const user = await authService.getUserOrganizations(email);
            res.json({ organizations: user });
        } catch (error) {
            next(error);
        }
    }
}

export const authController = new AuthController();
