import { MembershipRole, AccessLevel } from '../../generated/prisma';

export enum OrganizationPermission {
  MANAGE_MEMBERS = 'MANAGE_MEMBERS',
  INVITE_MEMBERS = 'INVITE_MEMBERS',

  MANAGE_PERMISSIONS = 'MANAGE_PERMISSIONS',
  ASSIGN_DOCUMENT_ACCESS = 'ASSIGN_DOCUMENT_ACCESS',

  MANAGE_ORGANIZATION = 'MANAGE_ORGANIZATION',
  VIEW_AUDIT_LOGS = 'VIEW_AUDIT_LOGS',

  VIEW_ANALYTICS = 'VIEW_ANALYTICS',
  VIEW_SEARCH_ANALYTICS = 'VIEW_SEARCH_ANALYTICS',

  UPLOAD_DOCUMENTS = 'UPLOAD_DOCUMENTS',
  CREATE_FOLDERS = 'CREATE_FOLDERS',
}

export { AccessLevel };

export interface PermissionGroupData {
  id: string;
  name: string;
  description?: string;
  permissions: OrganizationPermission[];
  memberCount: number;
  organizationId: string;
}

export interface CreatePermissionGroupRequest {
  name: string;
  description?: string;
  permissions: OrganizationPermission[];
}

export interface UpdatePermissionGroupRequest {
  name?: string;
  description?: string;
  permissions?: OrganizationPermission[];
}

export interface DocumentAccess {
  documentId: string;
  userId?: string;
  groupId?: string;
  accessLevel: AccessLevel;
  grantedBy: string;
  grantedAt: Date;
}

export interface FolderAccess {
  folderId: string;
  userId?: string;
  groupId?: string;
  accessLevel: AccessLevel;
  inherited: boolean;
  grantedBy: string;
  grantedAt: Date;
}

export interface PermissionContext {
  userId: string;
  organizationId: string;
  role: MembershipRole;
  permissionsGroupId?: string;
  isAdmin: boolean;
}

export interface PermissionCheckResult {
  allowed: boolean;
  accessLevel?: AccessLevel;
}
