import { prisma } from '../lib/prisma';
import { PermissionService } from './permissionService';
import { SessionService } from './sessionService';
import { ValidationError, PermissionError, NotFoundError } from '../utils/errors';
import { MembershipRole } from '../../generated/prisma';

export interface CreateOrganizationRequest {
  name: string;
  description?: string;
  defaultAccess?: 'PUBLIC' | 'GROUP' | 'MANAGERS' | 'ADMINS' | 'RESTRICTED';
}

export interface UpdateOrganizationRequest {
  name?: string;
  description?: string;
  defaultDocumentAccess?: 'PUBLIC' | 'GROUP' | 'MANAGERS' | 'ADMINS' | 'RESTRICTED';
  allowMemberUploads?: boolean;
}

const permissionService = new PermissionService();

export class OrganizationService {
  constructor(private sessionService: SessionService) {}

  async createOrganization(userId: string, data: CreateOrganizationRequest) {

    return await prisma.$transaction(async (tx: any) => {
      const organization = await tx.organization.create({
        data: {
          name: data.name,
          description: data.description,
          defaultDocumentAccess: data.defaultAccess || 'GROUP',
          adminUserId: userId,
          createdBy: userId,
        }
      });

      // Create admin membership
      await tx.organizationMembership.create({
        data: {
          userId,
          organizationId: organization.id,
          role: 'ADMIN',
          canUpload: true,
          canDelete: true,
          canManageUsers: true,
        }
      });

      // Create default group
      await tx.group.create({
        data: {
          name: 'General',
          description: 'Default group for all members',
          organizationId: organization.id,
        }
      });

      return organization;
    });
  }

  async updateOrganization(
    userId: string,
    organizationId: string,
    data: UpdateOrganizationRequest
  ) {

    const permissions = await permissionService.getUserPermissions(userId, organizationId);
    if (!permissions.isAdmin) {
      throw new PermissionError('Only administrators can update organization settings');
    }

    const organization = await prisma.organization.update({
      where: { id: organizationId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.defaultDocumentAccess && { defaultDocumentAccess: data.defaultDocumentAccess }),
        ...(data.allowMemberUploads !== undefined && { allowMemberUploads: data.allowMemberUploads }),
        updatedAt: new Date(),
      }
    });

    return organization;
  }

  async deleteOrganization(userId: string, organizationId: string): Promise<void> {
    const adminMembership = await prisma.organizationMembership.findFirst({
      where: {
        organizationId,
        userId,
        role: 'ADMIN'
      }
    });

    if (!adminMembership) {
      throw new PermissionError('Only organization admins can delete organizations');
    }

    // Verify organization exists and is active
    const organization = await prisma.organization.findFirst({
      where: {
        id: organizationId,
        isActive: true
      }
    });

    if (!organization) {
      throw new NotFoundError('Organization not found or already deleted');
    }

    // Soft delete the organization by setting isActive to false
    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        isActive: false,
        updatedAt: new Date()
      }
    });

    // Note: We keep all related data (members, groups, documents) for potential restoration
    // The frontend will handle multiple confirmation prompts before allowing deletion

    // TODO: Add a hard delete after some time has passed
    // TODO: Clean up sessions for this organization
  }

  async getUserOrganizations(userId: string) {
    const memberships = await prisma.organizationMembership.findMany({
      where: {
        userId,
        organization: {
          isActive: true  // Only return active organizations
        }
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            description: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: {
                memberships: true,
                groups: true,
                documents: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return memberships.map(membership => ({
      id: membership.organization.id,
      name: membership.organization.name,
      description: membership.organization.description,
      role: membership.role,
      memberCount: membership.organization._count.memberships,
      groupCount: membership.organization._count.groups,
      documentCount: membership.organization._count.documents,
      createdAt: membership.organization.createdAt,
      updatedAt: membership.organization.updatedAt,
    }));
  }

  async getOrganizationDetails(userId: string, organizationId: string) {
    const membership = await prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId,
        },
      },
    });

    if (!membership) {
      throw new NotFoundError('Organization not found or access denied');
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        _count: {
          select: {
            memberships: true,
            groups: true,
            documents: true,
          },
        },
      },
    });

    if (!organization) {
      throw new NotFoundError('Organization not found');
    }

    return {
      ...organization,
      memberCount: organization._count.memberships,
      groupCount: organization._count.groups,
      documentCount: organization._count.documents,
      userRole: membership.role,
      userPermissions: {
        canUpload: membership.canUpload,
        canDelete: membership.canDelete,
        canManageUsers: membership.canManageUsers,
      },
    };
  }

  async getOrganizationMembers(userId: string, organizationId: string) {
    // Check permissions
    const permissions = await permissionService.getUserPermissions(userId, organizationId);
    if (!permissions.canManageUsers && permissions.role === 'VIEWER') {
      throw new PermissionError('Insufficient permissions to view members');
    }

    const memberships = await prisma.organizationMembership.findMany({
      where: { organizationId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
        organization: {
          select: {
            adminUserId: true
          }
        }
      },
      orderBy: [
        { role: 'asc' }, // ADMIN first
        { createdAt: 'asc' }
      ]
    });

    return memberships.map(membership => ({
      id: membership.user.id,
      name: membership.user.name,
      email: membership.user.email,
      role: membership.role,
      isAdmin: membership.role === 'ADMIN',
      isOrgAdmin: membership.organization.adminUserId === membership.user.id,
      canUpload: membership.canUpload,
      canDelete: membership.canDelete,
      canManageUsers: membership.canManageUsers,
      joinedAt: membership.createdAt,
    }));
  }

  async updateMemberRole(
    requesterId: string,
    organizationId: string,
    targetUserId: string,
    newRole: MembershipRole,
    permissions?: {
      canUpload?: boolean;
      canDelete?: boolean;
      canManageUsers?: boolean;
    }
  ) {
    const requesterPermissions = await permissionService.getUserPermissions(requesterId, organizationId);
    if (!requesterPermissions.canManageUsers) {
      throw new PermissionError('Cannot manage user roles');
    }

    // Can't change admin role without transferring ownership
    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new NotFoundError('Organization not found');

    if (org.adminUserId === targetUserId && newRole !== 'ADMIN') {
      throw new ValidationError('Cannot change admin role. Transfer ownership first.');
    }

    const membership = await prisma.organizationMembership.update({
      where: {
        userId_organizationId: {
          userId: targetUserId,
          organizationId
        }
      },
      data: {
        role: newRole,
        canUpload: permissions?.canUpload ?? ['ADMIN', 'MANAGER', 'MEMBER'].includes(newRole),
        canDelete: permissions?.canDelete ?? ['ADMIN', 'MANAGER'].includes(newRole),
        canManageUsers: permissions?.canManageUsers ?? newRole === 'ADMIN',
        updatedAt: new Date(),
      },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    return membership;
  }

  async removeMember(requesterId: string, organizationId: string, targetUserId: string) {

    const requesterPermissions = await permissionService.getUserPermissions(requesterId, organizationId);
    if (!requesterPermissions.canManageUsers) {
      throw new PermissionError('Cannot remove members');
    }

    // Can't remove organization admin
    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new NotFoundError('Organization not found');

    if (org.adminUserId === targetUserId) {
      throw new ValidationError('Cannot remove organization administrator. Transfer ownership first.');
    }

    await prisma.$transaction(async (tx: any) => {
      // Remove from all groups in this organization
      await tx.groupMembership.deleteMany({
        where: {
          userId: targetUserId,
          group: { organizationId }
        }
      });

      await tx.organizationMembership.delete({
        where: {
          userId_organizationId: {
            userId: targetUserId,
            organizationId
          }
        }
      });
    });

    // TODO: Might need to clean up for user sessions for this organization
  }

  async transferAdminRole(
    currentAdminId: string,
    organizationId: string,
    newAdminId: string
  ): Promise<void> {
    await prisma.$transaction(async (tx: any) => {
      // Verify current user is admin
      const currentMembership = await tx.organizationMembership.findUnique({
        where: { userId_organizationId: { userId: currentAdminId, organizationId } }
      });

      if (!currentMembership || currentMembership.role !== 'ADMIN') {
        throw new PermissionError('Only admin can transfer role');
      }

      // Verify new admin is member
      const newMembership = await tx.organizationMembership.findUnique({
        where: { userId_organizationId: { userId: newAdminId, organizationId } }
      });

      if (!newMembership) {
        throw new ValidationError('New admin must be organization member');
      }

      // Update organization admin
      await tx.organization.update({
        where: { id: organizationId },
        data: { adminUserId: newAdminId }
      });

      await tx.organizationMembership.update({
        where: { userId_organizationId: { userId: newAdminId, organizationId } },
        data: {
          role: 'ADMIN',
          canUpload: true,
          canDelete: true,
          canManageUsers: true,
        }
      });

      await tx.organizationMembership.update({
        where: { userId_organizationId: { userId: currentAdminId, organizationId } },
        data: {
          role: 'MEMBER',
          canManageUsers: false,
          canDelete: false,
        }
      });
    });
  }

  async leaveOrganization(userId: string, organizationId: string): Promise<void> {
    const membership = await prisma.organizationMembership.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      include: { organization: true }
    });

    if (!membership) {
      throw new NotFoundError('Not a member of this organization');
    }

    // Can't leave if you're the admin (must transfer first)
    if (membership.organization.adminUserId === userId) {
      throw new ValidationError('Administrator must transfer role before leaving organization');
    }

    await prisma.$transaction(async (tx: any) => {
      // Remove from all groups in this organization
      await tx.groupMembership.deleteMany({
        where: {
          userId,
          group: { organizationId }
        }
      });

      // Remove organization membership
      await tx.organizationMembership.delete({
        where: { userId_organizationId: { userId, organizationId } }
      });
    });

    // TODO: Might need to add clean up for user sessions for this organization
  }
}
