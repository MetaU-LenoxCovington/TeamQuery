import { Request, Response, NextFunction } from 'express';
import { OrganizationService } from '../services/organizationService';
import { InvitationService } from '../services/invitationService';
import { sessionService } from '../services/sessionServiceSingleton';

const organizationService = new OrganizationService(sessionService);
const invitationService = new InvitationService();

export class OrganizationController {
  constructor() {}

  // POST /api/organizations
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const organization = await organizationService.createOrganization(
        req.user!.userId,
        req.body
      );
      res.status(201).json({ success: true, data: organization });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/organizations
  async getUserOrganizations(req: Request, res: Response, next: NextFunction) {
    try {
      const organizations = await organizationService.getUserOrganizations(
        req.user!.userId
      );
      res.json({ success: true, data: organizations });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/organizations/:id/details
  async getOrganizationDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const details = await organizationService.getOrganizationDetails(
        req.user!.userId,
        req.params.id
      );
      res.json({ success: true, data: details });
    } catch (error) {
      next(error);
    }
  }

  // PUT /api/organizations/:id
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const organization = await organizationService.updateOrganization(
        req.user!.userId,
        req.params.id,
        req.body
      );
      res.json({ success: true, data: organization });
    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/organizations/:id
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await organizationService.deleteOrganization(
        req.user!.userId,
        req.params.id
      );
      res.json({ success: true, message: 'Organization deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/organizations/:id/members
  async getMembers(req: Request, res: Response, next: NextFunction) {
    try {
      const members = await organizationService.getOrganizationMembers(
        req.user!.userId,
        req.params.id
      );
      res.json({ success: true, data: members });
    } catch (error) {
      next(error);
    }
  }

  // PUT /api/organizations/:id/members/:memberId/role
  async updateMemberRole(req: Request, res: Response, next: NextFunction) {
    try {
      const { role, permissions } = req.body;
      const membership = await organizationService.updateMemberRole(
        req.user!.userId,
        req.params.id,
        req.params.memberId,
        role,
        permissions
      );
      res.json({ success: true, data: membership });
    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/organizations/:id/members/:memberId
  async removeMember(req: Request, res: Response, next: NextFunction) {
    try {
      await organizationService.removeMember(
        req.user!.userId,
        req.params.id,
        req.params.memberId
      );
      res.json({ success: true, message: 'Member removed successfully' });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/organizations/:id/transfer-admin
  async transferAdmin(req: Request, res: Response, next: NextFunction) {
    try {
      const { newAdminId } = req.body;
      await organizationService.transferAdminRole(
        req.user!.userId,
        req.params.id,
        newAdminId
      );
      res.json({ success: true, message: 'Admin role transferred successfully' });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/organizations/:id/leave
  async leave(req: Request, res: Response, next: NextFunction) {
    try {
      await organizationService.leaveOrganization(
        req.user!.userId,
        req.params.id
      );
      res.json({ success: true, message: 'Left organization successfully' });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/organizations/:id/invitations
  async inviteUser(req: Request, res: Response, next: NextFunction) {
    try {
      const invitation = await invitationService.inviteUser(
        req.user!.userId,
        req.params.id,
        req.body
      );
      res.status(201).json({ success: true, data: invitation });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/organizations/:id/invitations
  async getInvitations(req: Request, res: Response, next: NextFunction) {
    try {
      const invitations = await invitationService.getOrganizationInvitations(
        req.user!.userId,
        req.params.id
      );
      res.json({ success: true, data: invitations });
    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/organizations/:id/invitations/:invitationId
  async cancelInvitation(req: Request, res: Response, next: NextFunction) {
    try {
      await invitationService.cancelInvitation(
        req.user!.userId,
        req.params.invitationId
      );
      res.json({ success: true, message: 'Invitation cancelled successfully' });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/organizations/:id/invitations/:invitationId/resend
  async resendInvitation(req: Request, res: Response, next: NextFunction) {
    try {
      const invitation = await invitationService.resendInvitation(
        req.user!.userId,
        req.params.invitationId
      );
      res.json({ success: true, data: invitation });
    } catch (error) {
      next(error);
    }
  }
}

export const organizationController = new OrganizationController();
