import { Request, Response, NextFunction } from 'express';
import { SessionService } from '../services/sessionService';

export const updateSessionActivity = (sessionService: SessionService) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (req.user?.sessionId) {
            sessionService.updateSessionActivity(req.user.sessionId);
        }

        next();
    };
};
