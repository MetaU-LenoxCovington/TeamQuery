import { prisma } from '../lib/prisma';
import { PermissionService } from './permissionService';
import { ValidationError, PermissionError, NotFoundError } from '../utils/errors';
import { MembershipRole } from '../../generated/prisma';

export interface InviteUserRequest {
  email: string;
  role: MembershipRole;
  groupIds?: string[];
}

export class InvitationService {
  constructor(
    private permissionService: PermissionService
  ) {}

  async inviteUser(
    inviterId: string,
    organizationId: string,
    inviteData: InviteUserRequest
  ) {

    const permissions = await this.permissionService.getUserPermissions(inviterId, organizationId);
    if (!permissions.canManageUsers) {
      throw new PermissionError('Cannot invite users');
    }

    const targetUser = await prisma.user.findUnique({
      where: { email: inviteData.email }
    });

    if (!targetUser) {
      throw new ValidationError('User with this email does not exist. They must create an account first.');
    }

    const existingMembership = await prisma.organizationMembership.findFirst({
      where: {
        userId: targetUser.id,
        organizationId
      }
    });

    if (existingMembership) {
      throw new ValidationError('User is already a member of this organization');
    }

    const existingInvite = await prisma.organizationInvite.findFirst({
      where: {
        email: inviteData.email,
        organizationId,
        status: 'PENDING'
      }
    });

    if (existingInvite) {
      throw new ValidationError('Invitation already pending for this user');
    }

    if (inviteData.groupIds && inviteData.groupIds.length > 0) {
      const groupCount = await prisma.group.count({
        where: {
          id: { in: inviteData.groupIds },
          organizationId
        }
      });

      if (groupCount !== inviteData.groupIds.length) {
        throw new ValidationError('Some specified groups do not exist in this organization');
      }
    }

    const invitation = await prisma.organizationInvite.create({
      data: {
        email: inviteData.email,
        organizationId,
        invitedBy: inviterId,
        role: inviteData.role,
        groupIds: inviteData.groupIds || [],
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            description: true
          }
        },
        inviter: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    return invitation;
  }

  async getUserPendingInvitations(email: string) {
    return await prisma.organizationInvite.findMany({
      where: {
        email,
        status: 'PENDING'
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            description: true
          }
        },
        inviter: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getOrganizationInvitations(userId: string, organizationId: string) {
    const permissions = await this.permissionService.getUserPermissions(userId, organizationId);
    if (!permissions.canManageUsers) {
      throw new PermissionError('Cannot view organization invitations');
    }

    return await prisma.organizationInvite.findMany({
      where: { organizationId },
      include: {
        inviter: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: [
        { status: 'asc' }, // PENDING first
        { createdAt: 'desc' }
      ]
    });
  }

  async acceptInvitation(userId: string, invitationId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User not found');

    const invitation = await prisma.organizationInvite.findFirst({
      where: {
        id: invitationId,
        email: user.email, // user can only accept their own invites
        status: 'PENDING'
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            description: true
          }
        }
      }
    });

    if (!invitation) {
      throw new NotFoundError('Invitation not found or no longer valid');
    }

    return await prisma.$transaction(async (tx) => {
      await tx.organizationMembership.create({
        data: {
          userId,
          organizationId: invitation.organizationId,
          role: invitation.role,
          canUpload: ['ADMIN', 'MANAGER', 'MEMBER'].includes(invitation.role),
          canDelete: ['ADMIN', 'MANAGER'].includes(invitation.role),
          canManageUsers: invitation.role === 'ADMIN',
        }
      });

      if (invitation.groupIds.length > 0) {
        const existingGroups = await tx.group.findMany({
          where: {
            id: { in: invitation.groupIds },
            organizationId: invitation.organizationId
          },
          select: { id: true }
        });

        const existingGroupIds = existingGroups.map(g => g.id);

        await Promise.all(
          existingGroupIds.map(groupId =>
            tx.groupMembership.create({
              data: {
                userId,
                groupId,
                canUpload: true,
                canDelete: false
              }
            })
          )
        );
      }

      // Mark invitation as accepted
      await tx.organizationInvite.update({
        where: { id: invitation.id },
        data: {
          status: 'ACCEPTED',
          updatedAt: new Date()
        }
      });

      return invitation.organization;
    });
  }

  async declineInvitation(userId: string, invitationId: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User not found');

    const invitation = await prisma.organizationInvite.findFirst({
      where: {
        id: invitationId,
        email: user.email,
        status: 'PENDING'
      }
    });

    if (!invitation) {
      throw new NotFoundError('Invitation not found or no longer valid');
    }

    await prisma.organizationInvite.update({
      where: { id: invitation.id },
      data: {
        status: 'DECLINED',
        updatedAt: new Date()
      }
    });
  }

  async cancelInvitation(inviterId: string, invitationId: string): Promise<void> {
    const invitation = await prisma.organizationInvite.findUnique({
      where: { id: invitationId },
      include: { organization: true }
    });

    if (!invitation) throw new NotFoundError('Invitation not found');

    // Check permissions
    const permissions = await this.permissionService.getUserPermissions(
      inviterId,
      invitation.organizationId
    );
    if (!permissions.canManageUsers && invitation.invitedBy !== inviterId) {
      throw new PermissionError('Cannot cancel invitation');
    }

    if (invitation.status !== 'PENDING') {
      throw new ValidationError('Can only cancel pending invitations');
    }

    await prisma.organizationInvite.update({
      where: { id: invitationId },
      data: {
        status: 'CANCELLED',
        updatedAt: new Date()
      }
    });
  }

  async resendInvitation(inviterId: string, invitationId: string) {
    const invitation = await prisma.organizationInvite.findUnique({
      where: { id: invitationId },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            description: true
          }
        },
        inviter: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!invitation) throw new NotFoundError('Invitation not found');

    const permissions = await this.permissionService.getUserPermissions(
      inviterId,
      invitation.organizationId
    );
    if (!permissions.canManageUsers && invitation.invitedBy !== inviterId) {
      throw new PermissionError('Cannot resend invitation');
    }

    if (invitation.status !== 'PENDING') {
      throw new ValidationError('Can only resend pending invitations');
    }

    // Update timestamp to "resend"
    const updatedInvitation = await prisma.organizationInvite.update({
      where: { id: invitationId },
      data: { updatedAt: new Date() },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            description: true
          }
        },
        inviter: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    return updatedInvitation;
  }
}
