import { Router } from "express";
import { groupController } from "../controllers/groupController";
import { authenticateToken } from "../middleware/auth";

const createGroupRoutes = () => {
  const router = Router();

  // Group CRUD
  router.post('/', authenticateToken, groupController.createGroup);
  router.get('/', authenticateToken, groupController.getOrganizationGroups);
  router.put('/:groupId', authenticateToken, groupController.updateGroup);
  router.delete('/:groupId', authenticateToken, groupController.deleteGroup);

  // Group member management
  router.get('/:groupId/members', authenticateToken, groupController.getGroupMembers);
  router.post('/:groupId/members', authenticateToken, groupController.addMembersToGroup);
  router.delete('/:groupId/members/:memberId', authenticateToken, groupController.removeMemberFromGroup);
  router.put('/:groupId/members/:memberId/permissions', authenticateToken, groupController.updateMemberPermissions);

  // Bulk transfer members between groups
  router.post('/transfer-members', authenticateToken, groupController.transferMembersBetweenGroups);

  return router;
};

export default createGroupRoutes; 