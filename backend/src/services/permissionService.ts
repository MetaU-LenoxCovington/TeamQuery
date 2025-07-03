import { prisma }  from '../lib/prisma';
import { PermissionError } from '../utils/errors';
import { MembershipRole, AccessLevel } from '../../generated/prisma';

export class PermissionService {

    async getUserPermissions(userId: string, organizationId: string) {
        const membership = await prisma.organizationMembership.findUnique({
            where: {
                userId_organizationId: {
                    userId,
                    organizationId,
                }
            },
            include: {
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
            canUpload: membership.canUpload,
            canDelete: membership.canDelete,
            canManageUsers: membership.canManageUsers,
            isAdmin: membership.role === MembershipRole.ADMIN,
            groups: membership.user.groupMemberships.map((membership: any) => ({
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

        const userGroupIds = permissions.groups.map((g: any) => g.id);

        const accessConditions = [
            { accessLevel: AccessLevel.PUBLIC},
            {
                accessLevel: AccessLevel.GROUP,
                groupId: { in: userGroupIds }
            },
            {
                accessLevel: AccessLevel.RESTRICTED,
                restrictedToUsers: { has: userId }
            }
        ] as any;

        if (permissions.role === MembershipRole.MANAGER || permissions.role === MembershipRole.ADMIN) {
            accessConditions.push({
                accessLevel: AccessLevel.MANAGERS
            });
        }

        const documents = await prisma.document.findMany({
            where: {
                organizationId,
                isDeleted: false,
                OR: accessConditions,
            },
            select: { id: true }
        });

        return documents.map( (d: any) => d.id);

    }

    async canAccessDocument(userId: string, documentId: string): Promise<boolean> {
        const document = await prisma.document.findUnique({
            where: { id: documentId },
            include: {
                group: true,
            }
        });

        if (!document || document.isDeleted) {
            return false;
        }

        const permissions = await this.getUserPermissions(userId, document.organizationId);

        if (permissions.isAdmin) {
            return true;
        }

        switch (document.accessLevel) {
            case AccessLevel.PUBLIC:
                return true;

            case AccessLevel.GROUP:
                if (!document.groupId) return false;
                return permissions.groups.some( (group: any) =>
                group.id === document.groupId);

            case AccessLevel.MANAGERS:
                return permissions.role === MembershipRole.MANAGER || permissions.role === MembershipRole.ADMIN;

            case AccessLevel.ADMINS:
                return permissions.isAdmin;

            case AccessLevel.RESTRICTED:
                if ( document.restrictedToUsers.includes(userId) || permissions.isAdmin){
                    return true;
                }else{
                    return false;
                }

            default:
                return false;
        }
    }

    async canUploadDocuments(userId: string, organizationId: string): Promise<boolean> {
        const permissions = await this.getUserPermissions(userId, organizationId);
        return permissions.canUpload;
    }

    async canDeleteDocument(userId: string, documentId: string): Promise<boolean> {
        const document = await prisma.document.findUnique({
            where: { id: documentId }
        });

        if (!document) {
            return false;
        }

        const permissions = await this.getUserPermissions(userId, document.organizationId);
        return permissions.canDelete || permissions.isAdmin;
    }

    async canManageUsers(userId: string, organizationId: string): Promise<boolean> {
        const permissions = await this.getUserPermissions(userId, organizationId);
        return permissions.canManageUsers || permissions.isAdmin;
    }

}
