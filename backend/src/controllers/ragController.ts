import { Request, Response, NextFunction } from 'express';
import { RagService } from '../services/ragService';
import { ValidationError } from '../utils/errors';

const ragService = new RagService();

export class RagController {

  constructor() {}

  // POST /api/rag/search
  async search(req: Request, res: Response, next: NextFunction) {
    try {
      const { query, organizationId, filters, k } = req.body;

      if (!query || typeof query !== 'string') {
        throw new ValidationError('Query is required and must be a string');
      }

      if (!organizationId || typeof organizationId !== 'string') {
        throw new ValidationError('Organization ID is required and must be a string');
      }

      const results = await ragService.search(
        req.user!.userId,
        organizationId,
        query,
        filters,
        k || 10
      );

      res.json({ success: true, data: results });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/rag/query
  async ragQuery(req: Request, res: Response, next: NextFunction) {
    try {
      const { query, organizationId, filters, maxContextChunks } = req.body;

      if (!query || typeof query !== 'string') {
        throw new ValidationError('Query is required and must be a string');
      }

      if (!organizationId || typeof organizationId !== 'string') {
        throw new ValidationError('Organization ID is required and must be a string');
      }

      const results = await ragService.ragQuery(
        req.user!.userId,
        organizationId,
        query,
        filters,
        maxContextChunks || 5
      );

      res.json({ success: true, data: results });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/rag/build-index
  async buildIndex(req: Request, res: Response, next: NextFunction) {
    try {
      const { organizationId } = req.body;

      if (!organizationId || typeof organizationId !== 'string') {
        throw new ValidationError('Organization ID is required and must be a string');
      }

      // Check if user has permission to build index for this organization
      const permissions = await ragService['permissionService'].getUserPermissions(
        req.user!.userId,
        organizationId
      );

      if (!permissions.canManageUsers) {
        throw new ValidationError('Insufficient permissions to build search index');
      }

      const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8001';
      const response = await fetch(`${pythonServiceUrl}/api/search/build-index`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organization_id: organizationId })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to build index: ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/rag/index-status
  async getIndexStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { organizationId } = req.query;

      if (!organizationId || typeof organizationId !== 'string') {
        throw new ValidationError('Organization ID is required and must be a string');
      }

      await ragService['permissionService'].getUserPermissions(
        req.user!.userId,
        organizationId
      );

      const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8001';
      const response = await fetch(`${pythonServiceUrl}/api/search/index-status/${organizationId}`);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get index status: ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/rag/index
  async destroyIndex(req: Request, res: Response, next: NextFunction) {
    try {
      const { organizationId } = req.body;

      if (!organizationId || typeof organizationId !== 'string') {
        throw new ValidationError('Organization ID is required and must be a string');
      }

      const permissions = await ragService['permissionService'].getUserPermissions(
        req.user!.userId,
        organizationId
      );

      if (!permissions.canManageUsers) {
        throw new ValidationError('Insufficient permissions to destroy search index');
      }

      const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8001';
      const response = await fetch(`${pythonServiceUrl}/api/search/index/${organizationId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to destroy index: ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

export const ragController = new RagController();
