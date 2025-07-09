import { Request, Response, NextFunction } from 'express';
import { JWTUtils } from '../utils/jwt';
import { AuthError } from '../utils/errors';
import { PermissionError } from '../utils/errors';
import { SessionService } from '../services/sessionService';

export const authenticateToken = (sessionService: SessionService) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // bearer token

    if (!token) {
      throw AuthError.tokenMissing();
    }

    try {
      const payload = JWTUtils.verifyAccessToken(token);
      const sessionInfo = sessionService.getSessionInfo(payload.sessionId);

      if (!sessionInfo) {
        throw AuthError.tokenInvalid('Session expired');
      }

      sessionService.updateSessionActivity(payload.sessionId);

      req.user = payload;
      next();
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw AuthError.tokenInvalid();
    }
  };
};

export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw AuthError.tokenMissing();
    }

    if (!roles.includes(req.user.role)) {
      throw PermissionError.insufficientPermissions();
    }

    next();
  };
};

export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    throw AuthError.tokenMissing();
  }

  if (!req.user.isAdmin) {
    throw PermissionError.adminRequired();
  }

  next();
};
