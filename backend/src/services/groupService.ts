import { PermissionService } from './permissionService';
import { ValidationError, PermissionError, NotFoundError } from '../utils/errors';
import { prisma } from '../lib/prisma';

export interface CreateGroupRequest {
  name: string;
  description?: string;
  isDefault?: boolean;
}

export interface UpdateGroupRequest {
  name?: string;
  description?: string;
  isDefault?: boolean;
}

export interface AddMembersRequest {
  userIds: string[];
  permissions?: {
    canUpload?: boolean;
    canDelete?: boolean;
  };
}

export interface UpdateMemberPermissionsRequest {
  canUpload?: boolean;
  canDelete?: boolean;
}

export class GroupService {
  constructor(
    private permissionService: PermissionService
  ) {}

  async createGroup(userId: string, organizationId: string, data: CreateGroupRequest) {
    // Check permissions - only admins and managers can create groups
    const permissions = await this.permissionService.getUserPermissions(userId, organizationId);
    if (!permissions.canManageUsers) {
      throw new PermissionError('Insufficient permissions to create groups');
    }

    // Check for name conflicts within organization
    const existingGroup = await prisma.group.findFirst({
      where: {
        name: data.name,
        organizationId
      }
    });
    if (existingGroup) {
      throw new ValidationError('A group with this name already exists in the organization');
    }

    return await prisma.group.create({
      data: {
        name: data.name,
        description: data.description,
        organizationId,
        isDefault: data.isDefault || false,
      },
      include: {
        _count: {
          select: {
            members: true,
            documents: true
          }
        }
      }
    });
  }

  async updateGroup(userId: string, organizationId: string, groupId: string, data: UpdateGroupRequest) {

    const permissions = await this.permissionService.getUserPermissions(userId, organizationId);
    if (!permissions.canManageUsers) {
      throw new PermissionError('Insufficient permissions to update groups');
    }

    const group = await prisma.group.findFirst({
      where: { id: groupId, organizationId }
    });
    if (!group) {
      throw new NotFoundError('Group not found');
    }

    // Check name conflicts if name is being updated
    if (data.name && data.name !== group.name) {
      const existingGroup = await prisma.group.findFirst({
        where: {
          name: data.name,
          organizationId,
          id: { not: groupId }
        }
      });
      if (existingGroup) {
        throw new ValidationError('A group with this name already exists');
      }
    }

    return await prisma.group.update({
      where: { id: groupId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
        updatedAt: new Date(),
      },
      include: {
        _count: {
          select: {
            members: true,
            documents: true
          }
        }
      }
    });
  }

  async deleteGroup(userId: string, organizationId: string, groupId: string) {

    const permissions = await this.permissionService.getUserPermissions(userId, organizationId);
    if (!permissions.canManageUsers) {
      throw new PermissionError('Insufficient permissions to delete groups');
    }

    const group = await prisma.group.findFirst({
      where: { id: groupId, organizationId },
      include: {
        _count: {
          select: {
            members: true,
            documents: true
          }
        }
      }
    });

    if (!group) {
      throw new NotFoundError('Group not found');
    }

    if (group.isDefault) {
      throw new ValidationError('Cannot delete the default group');
    }

    if (group._count.documents > 0) {
      throw new ValidationError('Cannot delete group with documents. Move or delete documents first.');
    }

    await prisma.$transaction(async (tx: any) => {
      // Remove all group memberships
      await tx.groupMembership.deleteMany({
        where: { groupId }
      });

      await tx.group.delete({
        where: { id: groupId }
      });
    });
  }

  async getOrganizationGroups(userId: string, organizationId: string) {
    const permissions = await this.permissionService.getUserPermissions(userId, organizationId);
    if (!(permissions.role === 'MEMBER' || permissions.role === 'MANAGER' || permissions.role === 'ADMIN')) {
      throw new PermissionError('Organization membership required');
    }

    const groups = await prisma.group.findMany({
      where: { organizationId },
      include: {
        _count: {
          select: {
            members: true,
            documents: true
          }
        },
        members: {
          where: { userId },
          select: {
            joinedAt: true
          }
        }
      },
      orderBy: [
        { isDefault: 'desc' },
        { name: 'asc' }
      ]
    });

    return groups.map((group: any) => ({
      id: group.id,
      name: group.name,
      description: group.description,
      isDefault: group.isDefault,
      memberCount: group._count.members,
      documentCount: group._count.documents,
      userMembership: group.members[0] || null,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    }));
  }

  async getGroupMembers(userId: string, organizationId: string, groupId: string) {
    // Check permissions - members can view, but managers+ can see more details
    const permissions = await this.permissionService.getUserPermissions(userId, organizationId);
    if (!(permissions.role === 'MEMBER' || permissions.role === 'MANAGER' || permissions.role === 'ADMIN')) {
      throw new PermissionError('Organization membership required');
    }

    const group = await prisma.group.findFirst({
      where: { id: groupId, organizationId }
    });
    if (!group) {
      throw new NotFoundError('Group not found');
    }

    const members = await prisma.groupMembership.findMany({
      where: { groupId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: permissions.canManageUsers, // Only show email to managers+
          }
        }
      },
      orderBy: [
        { joinedAt: 'asc' }
      ]
    });

    return members.map((membership: any) => ({
      id: membership.user.id,
      name: membership.user.name,
      email: membership.user.email,
      canUpload: membership.canUpload,
      canDelete: membership.canDelete,
      joinedAt: membership.joinedAt,
      canManageGroup: permissions.canManageUsers,
    }));
  }

  async addMembersToGroup(
    userId: string,
    organizationId: string,
    groupId: string,
    data: AddMembersRequest
  ) {
    const permissions = await this.permissionService.getUserPermissions(userId, organizationId);
    if (!permissions.canManageUsers) {
      throw new PermissionError('Insufficient permissions to manage group members');
    }

    const group = await prisma.group.findFirst({
      where: { id: groupId, organizationId }
    });
    if (!group) {
      throw new NotFoundError('Group not found');
    }

    // Verify all users are organization members
    const orgMembers = await prisma.organizationMembership.findMany({
      where: {
        organizationId,
        userId: { in: data.userIds }
      },
      select: { userId: true }
    });

    const orgMemberIds = new Set(orgMembers.map((m: any) => m.userId));
    const invalidUserIds = data.userIds.filter(id => !orgMemberIds.has(id));

    if (invalidUserIds.length > 0) {
      throw new ValidationError('Some users are not members of this organization');
    }

    const existingMemberships = await prisma.groupMembership.findMany({
      where: {
        groupId,
        userId: { in: data.userIds }
      },
      select: { userId: true }
    });

    const existingMemberIds = new Set(existingMemberships.map((m: any) => m.userId));
    const newUserIds = data.userIds.filter(id => !existingMemberIds.has(id));

    if (newUserIds.length === 0) {
      throw new ValidationError('All specified users are already members of this group');
    }

    await prisma.groupMembership.createMany({
      data: newUserIds.map(userId => ({
        userId,
        groupId,
        canUpload: data.permissions?.canUpload ?? true,
        canDelete: data.permissions?.canDelete ?? false,
      }))
    });

    return {
      addedCount: newUserIds.length,
      skippedCount: data.userIds.length - newUserIds.length,
      addedUserIds: newUserIds,
    };
  }

  async removeMemberFromGroup(
    userId: string,
    organizationId: string,
    groupId: string,
    targetUserId: string
  ) {
    const permissions = await this.permissionService.getUserPermissions(userId, organizationId);
    if (!permissions.canManageUsers) {
      throw new PermissionError('Insufficient permissions to manage group members');
    }

    const group = await prisma.group.findFirst({
      where: { id: groupId, organizationId }
    });
    if (!group) {
      throw new NotFoundError('Group not found');
    }

    const membership = await prisma.groupMembership.findFirst({
      where: { groupId, userId: targetUserId }
    });
    if (!membership) {
      throw new NotFoundError('User is not a member of this group');
    }

    // Prevent removing from default group unless removing from organization
    if (group.isDefault) {
      throw new ValidationError('Cannot remove members from the default group. Remove from organization instead.');
    }

    await prisma.groupMembership.delete({
      where: {
        userId_groupId: {
          userId: targetUserId,
          groupId
        }
      }
    });
  }

  async updateMemberPermissions(
    userId: string,
    organizationId: string,
    groupId: string,
    targetUserId: string,
    permissions: UpdateMemberPermissionsRequest
  ) {

    const userPermissions = await this.permissionService.getUserPermissions(userId, organizationId);
    if (!userPermissions.canManageUsers) {
      throw new PermissionError('Insufficient permissions to manage group member permissions');
    }

    const group = await prisma.group.findFirst({
      where: { id: groupId, organizationId }
    });
    if (!group) {
      throw new NotFoundError('Group not found');
    }

    const membership = await prisma.groupMembership.findFirst({
      where: { groupId, userId: targetUserId }
    });
    if (!membership) {
      throw new NotFoundError('User is not a member of this group');
    }

    return await prisma.groupMembership.update({
      where: {
        userId_groupId: {
          userId: targetUserId,
          groupId
        }
      },
      data: {
        ...(permissions.canUpload !== undefined && { canUpload: permissions.canUpload }),
        ...(permissions.canDelete !== undefined && { canDelete: permissions.canDelete }),
        updatedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
  }

  async transferMembersBetweenGroups(
    userId: string,
    organizationId: string,
    fromGroupId: string,
    toGroupId: string,
    memberIds: string[]
  ) {
    const permissions = await this.permissionService.getUserPermissions(userId, organizationId);
    if (!permissions.canManageUsers) {
      throw new PermissionError('Insufficient permissions to transfer group members');
    }

    const groups = await prisma.group.findMany({
      where: {
        id: { in: [fromGroupId, toGroupId] },
        organizationId
      }
    });

    if (groups.length !== 2) {
      throw new NotFoundError('One or both groups not found');
    }

    const fromGroup = groups.find((g: any) => g.id === fromGroupId);

    // Prevent transferring from default group
    if (fromGroup?.isDefault) {
      throw new ValidationError('Cannot transfer members from the default group');
    }

    await prisma.$transaction(async (tx: any) => {
      // Remove from source group
      await tx.groupMembership.deleteMany({
        where: {
          groupId: fromGroupId,
          userId: { in: memberIds }
        }
      });

      for (const memberId of memberIds) {
        await tx.groupMembership.upsert({
          where: {
            userId_groupId: {
              userId: memberId,
              groupId: toGroupId
            }
          },
          create: {
            userId: memberId,
            groupId: toGroupId,
            canUpload: true,
            canDelete: false,
          },
          update: {} // No update needed if already exists
        });
      }
    });
  }
}
