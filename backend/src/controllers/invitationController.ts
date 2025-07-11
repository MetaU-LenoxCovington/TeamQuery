import { Request, Response, NextFunction } from 'express';
import { InvitationService } from '../services/invitationService';

export class InvitationController {
  constructor(
    private invitationService: InvitationService
  ) {}

  // GET /api/invitations
  async getPendingInvitations(req: Request, res: Response, next: NextFunction) {
    try {
      const invitations = await this.invitationService.getUserPendingInvitations(
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
      const organization = await this.invitationService.acceptInvitation(
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
      await this.invitationService.declineInvitation(
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

import { PermissionService } from '../services/permissionService';

const permissionService = new PermissionService();
const invitationService = new InvitationService(permissionService);

export const invitationController = new InvitationController(invitationService);
