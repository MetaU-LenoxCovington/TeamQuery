import { Request, Response, NextFunction } from 'express';
import { DocumentService } from '../services/documentService';
import { PermissionService } from '../services/permissionService';

export class DocumentController {
  constructor() {}

  // POST /api/documents/upload
  async uploadDocument(req: Request, res: Response, next: NextFunction) {
    const documentService = new DocumentService();
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'No file provided'
        });
        return;
      }

      if (!req.body.organizationId) {
        res.status(400).json({
          success: false,
          message: 'Organization ID is required'
        });
        return;
      }

      if (!req.body.title) {
        res.status(400).json({
          success: false,
          message: 'Document title is required'
        });
        return;
      }

      const document = await documentService.uploadDocument(
        req.user!.userId,
        req.body.organizationId,
        req.file,
        {
          title: req.body.title,
          groupId: req.body.groupId || undefined,
          folderId: req.body.folderId || undefined,
          accessLevel: req.body.accessLevel || undefined,
          restrictedToUsers: req.body.restrictedToUsers ?
            JSON.parse(req.body.restrictedToUsers) : undefined
        }
      );

      res.status(201).json({ success: true, data: document });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/documents
  async getDocuments(req: Request, res: Response, next: NextFunction) {
    const documentService = new DocumentService();
    try {
      const { organizationId, groupId, folderId } = req.query;

      if (!organizationId) {
        res.status(400).json({
          success: false,
          message: 'Organization ID is required'
        });
        return;
      }

      const documents = await documentService.getDocuments(
        req.user!.userId,
        organizationId as string,
        groupId as string | undefined,
        folderId as string | undefined
      );

      res.json({ success: true, data: documents });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/documents/:id
  async getDocument(req: Request, res: Response, next: NextFunction) {
    const documentService = new DocumentService();
    try {
      const document = await documentService.getDocument(
        req.user!.userId,
        req.params.id
      );

      res.json({ success: true, data: document });
    } catch (error) {
      next(error);
    }
  }

  // PUT /api/documents/:id
  async updateDocument(req: Request, res: Response, next: NextFunction) {
    const documentService = new DocumentService();
    try {
      const document = await documentService.updateDocument(
        req.user!.userId,
        req.params.id,
        req.body
      );

      res.json({ success: true, data: document });
    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/documents/:id
  async deleteDocument(req: Request, res: Response, next: NextFunction) {
    const documentService = new DocumentService();
    try {
      await documentService.deleteDocument(
        req.user!.userId,
        req.params.id
      );

      res.json({ success: true, message: 'Document deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/documents/:id/status
  async getDocumentStatus(req: Request, res: Response, next: NextFunction) {
    const documentService = new DocumentService();
    try {
      const status = await documentService.getDocumentStatus(
        req.user!.userId,
        req.params.id
      );

      res.json({ success: true, data: status });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/groups/:groupId/documents
  async getDocumentsByGroup(req: Request, res: Response, next: NextFunction) {
    const documentService = new DocumentService();
    try {
      const { groupId } = req.params;
      const { organizationId } = req.query;

      if (!organizationId) {
        res.status(400).json({
          success: false,
          message: 'Organization ID is required'
        });
        return;
      }

      const documents = await documentService.getDocuments(
        req.user!.userId,
        organizationId as string,
        groupId
      );

      res.json({ success: true, data: documents });
    } catch (error) {
      next(error);
    }
  }
}

export const documentController = new DocumentController();
