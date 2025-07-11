import { Router } from "express";
import { invitationController } from "../controllers/invitationController";
import { authenticateToken } from "../middleware/auth";

const createInvitationRoutes = () => {
  const router = Router();

  router.get('/', authenticateToken, invitationController.getPendingInvitations);
  router.post('/:id/accept', authenticateToken, invitationController.acceptInvitation);
  router.post('/:id/decline', authenticateToken, invitationController.declineInvitation);

  return router;
};

export default createInvitationRoutes; 