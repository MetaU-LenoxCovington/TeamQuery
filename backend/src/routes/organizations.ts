import { Router } from "express";
import { organizationController } from "../controllers/organizationController";
import { authenticateToken, requireAdmin } from "../middleware/auth";

const createOrganizationRoutes = () => {
  const router = Router();

  // Organization CRUD
  router.post('/', authenticateToken, organizationController.create);
  router.get('/', authenticateToken, organizationController.getUserOrganizations);
  router.put('/:id', authenticateToken, organizationController.update);
  router.delete('/:id', authenticateToken, organizationController.delete);

  // Organization membership management
  router.get('/:id/members', authenticateToken, organizationController.getMembers);
  router.put('/:id/members/:memberId/role', authenticateToken, organizationController.updateMemberRole);
  router.delete('/:id/members/:memberId', authenticateToken, organizationController.removeMember);
  router.post('/:id/transfer-admin', authenticateToken, organizationController.transferAdmin);
  router.post('/:id/leave', authenticateToken, organizationController.leave);

  // Invitation management within organizations
  router.post('/:id/invitations', authenticateToken, organizationController.inviteUser);
  router.get('/:id/invitations', authenticateToken, organizationController.getInvitations);
  router.delete('/:id/invitations/:invitationId', authenticateToken, organizationController.cancelInvitation);
  router.post('/:id/invitations/:invitationId/resend', authenticateToken, organizationController.resendInvitation);

  return router;
};

export default createOrganizationRoutes;
