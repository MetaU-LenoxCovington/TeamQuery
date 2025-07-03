import { Request, Response, NextFunction } from 'express';
import { SessionService } from '../services/sessionService';

const sessionService = new SessionService();

export const updateSessionActivity = (req: Request, res: Response, next: NextFunction) => {
    if (req.user?.sessionId) {
        sessionService.updateSessionActivity(req.user.sessionId);
    }

    next();
};
