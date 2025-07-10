import { Request, Response, NextFunction } from 'express';
import { sessionService } from '../services/sessionServiceSingleton';

export const updateSessionActivity = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  if (req.user?.sessionId) {
    sessionService.updateSessionActivity(req.user.sessionId);
  }

  next();
};
