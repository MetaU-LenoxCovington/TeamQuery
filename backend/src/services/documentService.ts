import { prisma } from '../lib/prisma';
import { PermissionService } from './permissionService';
import { PermissionError, NotFoundError } from '../utils/errors';
import { AccessLevel, MembershipRole } from '../../generated/prisma';

export interface CreateDocumentRequest {
  title: string;
  groupId?: string;
  folderId?: string;
  accessLevel?: AccessLevel;
  restrictedToUsers?: string[];
}

export interface UpdateDocumentRequest {
  title?: string;
  groupId?: string;
  folderId?: string;
  accessLevel?: AccessLevel;
  restrictedToUsers?: string[];
}

export class DocumentService {
  constructor() {}
  private permissionService = new PermissionService();
  private pythonServiceUrl: string = process.env.PYTHON_SERVICE_URL || 'http://localhost:8001'

  async uploadDocument(
    userId: string,
    organizationId: string,
    file: Express.Multer.File,
    data: CreateDocumentRequest
  ) {

    const permissions = await this.permissionService.getUserPermissions(userId, organizationId);
    if (!permissions.canUpload) {
      throw new PermissionError('Cannot upload documents to this organization');
    }

    const organization = await prisma.organization.findFirst({
      where: { id: organizationId, isActive: true }
    });

    if (!organization) {
      throw new NotFoundError('Organization not found or inactive');
    }

    if (data.groupId) {
      const group = await prisma.group.findFirst({
        where: {
          id: data.groupId,
          organizationId,
          members: {
            some: { userId }
          }
        }
      });

      if (!group) {
        throw new PermissionError('Cannot upload to specified group - not a member');
      }
    }

    if (data.folderId) {
      const folder = await prisma.folder.findFirst({
        where: {
          id: data.folderId,
          organizationId,
          isDeleted: false
        }
      });

      if (!folder) {
        throw new NotFoundError('Folder not found');
      }

      if (folder.groupId) {
        const hasGroupAccess = await prisma.groupMembership.findFirst({
          where: { userId, groupId: folder.groupId }
        });

        if (!hasGroupAccess) {
          throw new PermissionError('Cannot upload to folder - not a member of associated group');
        }
      }
    }

    const documentId = `doc-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

    const document = await prisma.document.create({
      data: {
        id: documentId,
        title: data.title,
        organizationId,
        groupId: data.groupId,
        folderId: data.folderId,
        accessLevel: data.accessLevel || 'GROUP',
        restrictedToUsers: data.restrictedToUsers || [],
        originalFileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
      }
    });

    try {
      await this.sendToPythonService(documentId, organizationId, file, data);
    } catch (error) {
      // Rollback document creation on Python service failure
      await prisma.document.delete({ where: { id: documentId } });
      throw new Error(`Failed to process document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return document;
  }

  async getDocuments(userId: string, organizationId: string, groupId?: string, folderId?: string) {
    const permissions = await this.permissionService.getUserPermissions(userId, organizationId);

    const userGroups = await prisma.groupMembership.findMany({
      where: { userId, group: { organizationId } },
      select: { groupId: true }
    });
    const userGroupIds = userGroups.map(g => g.groupId);

    const whereClause: any = {
      organizationId,
      isDeleted: false,
      OR: [
        { accessLevel: 'PUBLIC' },
        {
          accessLevel: 'GROUP',
          OR: [
            { groupId: { in: userGroupIds } },
            { groupId: null } // Documents not assigned to any group
          ]
        },
        ...(permissions.role === MembershipRole.MANAGER || permissions.isAdmin ? [{ accessLevel: 'MANAGERS' }] : []),
        ...(permissions.isAdmin ? [{ accessLevel: 'ADMINS' }] : []),
        {
          accessLevel: 'RESTRICTED',
          restrictedToUsers: { has: userId }
        }
      ]
    };

    if (groupId) {
      whereClause.groupId = groupId;
    }

    if (folderId) {
      whereClause.folderId = folderId;
    }

    const documents = await prisma.document.findMany({
      where: whereClause,
      include: {
        group: {
          select: { id: true, name: true }
        },
        folder: {
          select: { id: true, name: true }
        },
        _count: {
          select: {
            chunks: { where: { isDeleted: false } },
            embeddings: { where: { isDeleted: false } }
          }
        }
      },
      orderBy: [
        { recency: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    return documents.map(doc => ({
      ...doc,
      isProcessed: doc._count.chunks > 0 && doc._count.embeddings > 0,
      chunkCount: doc._count.chunks,
      embeddingCount: doc._count.embeddings
    }));
  }

  async getDocument(userId: string, documentId: string) {
    const document = await prisma.document.findUnique({
      where: { id: documentId, isDeleted: false },
      include: {
        organization: true,
        group: {
          select: { id: true, name: true }
        },
        folder: {
          select: { id: true, name: true }
        },
        _count: {
          select: {
            chunks: { where: { isDeleted: false } },
            embeddings: { where: { isDeleted: false } }
          }
        }
      }
    });

    if (!document) {
      throw new NotFoundError('Document not found');
    }

    const permissions = await this.permissionService.getUserPermissions(userId, document.organizationId);

    const hasAccess = await this.permissionService.canAccessDocument(userId, documentId);
    if (!hasAccess) {
      throw new PermissionError('Cannot access this document');
    }

    return {
      ...document,
      isProcessed: document._count.chunks > 0 && document._count.embeddings > 0,
      chunkCount: document._count.chunks,
      embeddingCount: document._count.embeddings
    };
  }

  async updateDocument(
    userId: string,
    documentId: string,
    data: UpdateDocumentRequest
  ) {
    const document = await prisma.document.findUnique({
      where: { id: documentId, isDeleted: false },
      include: { organization: true }
    });

    if (!document) {
      throw new NotFoundError('Document not found');
    }

    const permissions = await this.permissionService.getUserPermissions(userId, document.organizationId);
    if (!permissions.canUpload && !permissions.canManageUsers) {
      throw new PermissionError('Cannot update documents');
    }

    if (data.groupId !== undefined && data.groupId !== document.groupId) {
      if (data.groupId) {
        const group = await prisma.group.findFirst({
          where: {
            id: data.groupId,
            organizationId: document.organizationId,
            members: {
              some: { userId }
            }
          }
        });

        if (!group) {
          throw new PermissionError('Cannot assign to specified group - not a member');
        }
      }
    }

    if (data.folderId !== undefined && data.folderId !== document.folderId) {
      if (data.folderId) {
        const folder = await prisma.folder.findFirst({
          where: {
            id: data.folderId,
            organizationId: document.organizationId,
            isDeleted: false
          }
        });

        if (!folder) {
          throw new NotFoundError('Folder not found');
        }

        if (folder.groupId) {
          const hasGroupAccess = await prisma.groupMembership.findFirst({
            where: { userId, groupId: folder.groupId }
          });

          if (!hasGroupAccess) {
            throw new PermissionError('Cannot move to folder - not a member of associated group');
          }
        }
      }
    }

    const updatedDocument = await prisma.document.update({
      where: { id: documentId },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.groupId !== undefined && { groupId: data.groupId }),
        ...(data.folderId !== undefined && { folderId: data.folderId }),
        ...(data.accessLevel && { accessLevel: data.accessLevel }),
        ...(data.restrictedToUsers && { restrictedToUsers: data.restrictedToUsers }),
        updatedAt: new Date(),
      },
      include: {
        group: {
          select: { id: true, name: true }
        },
        folder: {
          select: { id: true, name: true }
        }
      }
    });

    await this.rebuildSearchIndex(document.organizationId);

    return updatedDocument;
  }

  async deleteDocument(userId: string, documentId: string): Promise<void> {
    const document = await prisma.document.findUnique({
      where: { id: documentId, isDeleted: false },
      include: { organization: true }
    });

    if (!document) {
      throw new NotFoundError('Document not found');
    }

    const permissions = await this.permissionService.getUserPermissions(userId, document.organizationId);
    if (!permissions.canDelete) {
      throw new PermissionError('Cannot delete documents');
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.embedding.deleteMany({
        where: { documentId }
      });

      await tx.chunk.deleteMany({
        where: { documentId }
      });

      await tx.document.delete({
        where: { id: documentId }
      });
    });

    await this.rebuildSearchIndex(document.organizationId);
  }

  async getDocumentStatus(userId: string, documentId: string) {
    const document = await prisma.document.findUnique({
      where: { id: documentId, isDeleted: false },
      include: { organization: true }
    });

    if (!document) {
      throw new NotFoundError('Document not found');
    }

    const permissions = await this.permissionService.getUserPermissions(userId, document.organizationId);

    const hasAccess = await this.permissionService.canAccessDocument(userId, documentId);
    if (!hasAccess) {
      throw new PermissionError('Cannot access this document');
    }

    const [chunkCount, embeddingCount] = await Promise.all([
      prisma.chunk.count({ where: { documentId, isDeleted: false } }),
      prisma.embedding.count({ where: { documentId, isDeleted: false } })
    ]);

    const isProcessed = chunkCount > 0 && embeddingCount > 0;

    return {
      documentId,
      status: isProcessed ? 'completed' : 'processing',
      chunkCount,
      embeddingCount,
      isProcessed
    };
  }


  private async sendToPythonService(
    documentId: string,
    organizationId: string,
    file: Express.Multer.File,
    data: CreateDocumentRequest
  ) {
    const formData = new FormData();

    const fileBlob = new Blob([file.buffer], { type: file.mimetype });

    formData.append('file', fileBlob, file.originalname);

    formData.append('document_id', documentId);
    formData.append('organization_id', organizationId);
    formData.append('title', data.title);
    formData.append('access_level', data.accessLevel || 'GROUP');

    if (data.groupId) {
      formData.append('group_id', data.groupId);
    }

    formData.append('restricted_to_users', JSON.stringify(data.restrictedToUsers || []));

    const response = await fetch(`${this.pythonServiceUrl}/api/documents/upload`, {
      method: 'POST',
      body: formData
    });


    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Python service error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }

  private async rebuildSearchIndex(organizationId: string) {
    try {
      const response = await fetch(`${this.pythonServiceUrl}/api/search/build-index`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: organizationId,
          force_rebuild: true
        })
      });

      if (!response.ok) {
        console.error(`Failed to rebuild search index: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to rebuild search index:', error);
    }
  }

}
