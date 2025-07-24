import { Request, Response, NextFunction } from 'express';
import { GroupService } from '../services/groupService';

const groupService = new GroupService();

export class GroupController {
  constructor() {}

  // POST /api/organizations/:orgId/groups
  async createGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const group = await groupService.createGroup(
        req.user!.userId,
        req.params.orgId,
        req.body
      );
      res.status(201).json({ success: true, data: group });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/organizations/:orgId/groups
  async getOrganizationGroups(req: Request, res: Response, next: NextFunction) {
    try {
      console.log("userId: ", req.user!.userId);
      console.log("orgId: ", req.params.orgId);
      const groups = await groupService.getOrganizationGroups(
        req.user!.userId,
        req.params.orgId
      );
      res.json({ success: true, data: groups });
    } catch (error) {
      next(error);
    }
  }

  // PUT /api/organizations/:orgId/groups/:groupId
  async updateGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const group = await groupService.updateGroup(
        req.user!.userId,
        req.params.orgId,
        req.params.groupId,
        req.body
      );
      res.json({ success: true, data: group });
    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/organizations/:orgId/groups/:groupId
  async deleteGroup(req: Request, res: Response, next: NextFunction) {
    try {
      await groupService.deleteGroup(
        req.user!.userId,
        req.params.orgId,
        req.params.groupId
      );
      res.json({ success: true, message: 'Group deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/organizations/:orgId/groups/:groupId/members
  async getGroupMembers(req: Request, res: Response, next: NextFunction) {
    try {
      const members = await groupService.getGroupMembers(
        req.user!.userId,
        req.params.orgId,
        req.params.groupId
      );
      res.json({ success: true, data: members });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/organizations/:orgId/groups/:groupId/members
  async addMembersToGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await groupService.addMembersToGroup(
        req.user!.userId,
        req.params.orgId,
        req.params.groupId,
        req.body
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/organizations/:orgId/groups/:groupId/members/:memberId
  async removeMemberFromGroup(req: Request, res: Response, next: NextFunction) {
    try {
      await groupService.removeMemberFromGroup(
        req.user!.userId,
        req.params.orgId,
        req.params.groupId,
        req.params.memberId
      );
      res.json({ success: true, message: 'Member removed from group successfully' });
    } catch (error) {
      next(error);
    }
  }

  // PUT /api/organizations/:orgId/groups/:groupId/members/:memberId/permissions
  async updateMemberPermissions(req: Request, res: Response, next: NextFunction) {
    try {
      const membership = await groupService.updateMemberPermissions(
        req.user!.userId,
        req.params.orgId,
        req.params.groupId,
        req.params.memberId,
        req.body
      );
      res.json({ success: true, data: membership });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/organizations/:orgId/groups/transfer-members
  async transferMembersBetweenGroups(req: Request, res: Response, next: NextFunction) {
    try {
      const { fromGroupId, toGroupId, memberIds } = req.body;
      await groupService.transferMembersBetweenGroups(
        req.user!.userId,
        req.params.orgId,
        fromGroupId,
        toGroupId,
        memberIds
      );
      res.json({ success: true, message: 'Members transferred successfully' });
    } catch (error) {
      next(error);
    }
  }
}

import { PermissionService } from '../services/permissionService';

export const groupController = new GroupController();
