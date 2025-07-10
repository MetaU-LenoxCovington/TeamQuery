import { Request, Response, NextFunction } from 'express';
import { JWTUtils } from '../utils/jwt';
import { sessionService } from '../services/sessionServiceSingleton';
import { ERROR_CODES } from '../utils/errors';

export const authenticateToken = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    const token = authHeader && authHeader.split(' ')[1]; // bearer token

    if (!token) {
      res.status(401).json({
        error: {
          code: ERROR_CODES.TOKEN_MISSING,
          message: 'Authentication required. Please log in.',
          name: 'TOKEN_MISSING',
        },
      });
      return;
    }

    const payload = JWTUtils.verifyAccessToken(token);
    const sessionInfo = sessionService.getSessionInfo(payload.sessionId);

    sessionService.updateSessionActivity(payload.sessionId);
    req.user = payload;
    next();
  } catch (error) {
    res.status(401).json({
      error: {
        code: ERROR_CODES.TOKEN_INVALID,
        message: 'Invalid authentication token. Please log in again.',
        name: 'TOKEN_INVALID',
      },
    });
    return;
  }
};

export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: ERROR_CODES.TOKEN_MISSING,
          message: 'Authentication required. Please log in.',
          name: 'TOKEN_MISSING',
        },
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: {
          code: ERROR_CODES.INSUFFICIENT_PERMISSIONS,
          message: 'You do not have permission to perform this action.',
          name: 'INSUFFICIENT_PERMISSIONS',
        },
      });
      return;
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
    res.status(401).json({
      error: {
        code: ERROR_CODES.TOKEN_MISSING,
        message: 'Authentication required. Please log in.',
        name: 'TOKEN_MISSING',
      },
    });
    return;
  }

  if (!req.user.isAdmin) {
    res.status(403).json({
      error: {
        code: ERROR_CODES.INSUFFICIENT_PERMISSIONS,
        message: 'Administrator privileges required.',
        name: 'ADMIN_REQUIRED',
      },
    });
    return;
  }

    next();
};
