import { Request, Response, NextFunction } from 'express';
import { SessionService } from '../services/sessionService';

export const updateSessionActivity = (sessionService: SessionService) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const sesionId = req.user?.sessionId;

        if (sesionId) {
            sessionService.updateSessionActivity(sesionId);
        }

        next();
    };
};
