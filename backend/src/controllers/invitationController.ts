import { Request, Response, NextFunction } from 'express';
import { InvitationService } from '../services/invitationService';

const invitationService = new InvitationService();

export class InvitationController {
  constructor() {}

  // GET /api/invitations
  async getPendingInvitations(req: Request, res: Response, next: NextFunction) {
    try {
      const invitations = await invitationService.getUserPendingInvitations(
        req.user!.email
      );
      res.json({ success: true, data: invitations });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/invitations/:id/accept
  async acceptInvitation(req: Request, res: Response, next: NextFunction) {
    try {
      const organization = await invitationService.acceptInvitation(
        req.user!.userId,
        req.params.id
      );
      res.json({
        success: true,
        data: organization,
        message: 'Invitation accepted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/invitations/:id/decline
  async declineInvitation(req: Request, res: Response, next: NextFunction) {
    try {
      await invitationService.declineInvitation(
        req.user!.userId,
        req.params.id
      );
      res.json({
        success: true,
        message: 'Invitation declined successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}

export const invitationController = new InvitationController();
