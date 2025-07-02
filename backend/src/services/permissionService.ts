import { prisma }  from '../lib/prisma';
import { PermissionError } from '../utils/errors';
import { MembershipRole, AccessLevel } from '@prisma/client';

export class PermissionService {

    async getUserPermissions(userId: string, organizationId: string) {
        const membership = await prisma.organizationMembership.findUnique({
            where: {
                userId_organizationId: {
                    userId,
                    organizationId,
                }
            },
            inlcude: {
                user: {
                    include: {
                        groupMemberships: {
                            where: {
                                group: {
                                    organizationId,
                                }
                            },
                            include: {
                                group: true,
                            }
                        }
                    }
                }
            }
        });

        if (!membership) {
            throw PermissionError.membershipRequired();
        }

        return {
            role: membership.role,
            canUpload: membership.canUplad,
            canDelete: membership.canDelete,
            canManageUsers: membership.canManageUsers,
            isAdmin: membership.role === MembershipRole.ADMIN,
            groups: membership.user.groupMemberships.map(membership => ({
                id: membership.group.id,
                name: membership.group.name,
                role: membership.role,
            })),
        };
    }

    async getAccessibleDocumentIds(userId: string, organizationId: string): Promise<string[] | undefined> {
        const permissions = await this.getUserPermissions(userId, organizationId);

        if ( permissions.isAdmin) {
            const documents = await prisma.document.findMany({
                where: {
                    organizationId,
                    isDeleted: false,
                },
                select: { id: true}
            });
            return documents.map( (d: any) => d.id);
        }

    }

}
