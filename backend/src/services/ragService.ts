import { logger } from '../utils/logger';
import { ValidationError, PermissionError, NotFoundError } from '../utils/errors';
import { PermissionService } from './permissionService';

export class RagService {
  private pythonServiceUrl: string;
  private permissionService: PermissionService;

  constructor() {
    this.pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8001';
    this.permissionService = new PermissionService();
  }

  async search(
    userId: string,
    organizationId: string,
    query: string,
    filters?: Record<string, any>,
    k: number = 10
  ): Promise<any> {
    try {
      logger.info(`Searching for "${query}" in organization ${organizationId}`);

      const permissions = await this.permissionService.getUserPermissions(userId, organizationId);

      const requestBody = {
        query,
        organization_id: organizationId,
        filters: filters || {},
        k,
        user_permissions: {
          role: permissions.role,
          groups: permissions.groups.map(g => g.id),
          canUpload: permissions.canUpload,
          canDelete: permissions.canDelete,
          canManageUsers: permissions.canManageUsers
        }
      };

      const response = await fetch(`${this.pythonServiceUrl}/api/search/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Python service search failed: ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      logger.info(`Search completed for "${query}" - found ${result.total_results} results`);

      return result;

    } catch (error: any) {
      logger.error(`Search failed for "${query}" in organization ${organizationId}:`, error);
      throw error;
    }
  }

  async ragQuery(
    userId: string,
    organizationId: string,
    query: string,
    filters?: Record<string, any>,
    maxContextChunks: number = 5
  ): Promise<any> {
    try {
      logger.info(`RAG query for "${query}" in organization ${organizationId}`);

      const permissions = await this.permissionService.getUserPermissions(userId, organizationId);

      const requestBody: any = {
        query,
        organization_id: organizationId,
        filters: filters || {},
        max_context_chunks: maxContextChunks,
        user_permissions: {
          role: permissions.role,
          groups: permissions.groups.map(g => g.id),
          canUpload: permissions.canUpload,
          canDelete: permissions.canDelete,
          canManageUsers: permissions.canManageUsers
        }
      };

      const response = await fetch(`${this.pythonServiceUrl}/api/search/rag-query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Python service RAG query failed: ${response.status}: ${errorText}`);
      }

      const result = await response.json() as any;
      logger.info(`RAG query completed for "${query}"`);

      return result;

    } catch (error: any) {
      logger.error(`RAG query failed for "${query}" in organization ${organizationId}:`, error);
      throw error;
    }
  }

  async getUserGroupRecommendations(
    requestingUserId: string,
    targetUserId: string,
    organizationId: string,
    topK: number = 3
  ): Promise<any> {
    try {
      logger.info(`Getting group recommendations for user ${targetUserId} in organization ${organizationId}`);

      const permissions = await this.permissionService.getUserPermissions(requestingUserId, organizationId);
      if (!permissions.canManageUsers && !permissions.isAdmin) {
        throw new PermissionError('Insufficient permissions to view group recommendations');
      }

      const requestBody = {
        user_id: targetUserId,
        organization_id: organizationId,
        top_k: topK
      };

      const response = await fetch(`${this.pythonServiceUrl}/api/search/users/${targetUserId}/group-recommendations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Python service group recommendations failed: ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      logger.info(`Generated ${result.recommendations?.length || 0} group recommendations for user ${targetUserId}`);

      return result;

    } catch (error: any) {
      logger.error(`Group recommendations failed for user ${targetUserId} in organization ${organizationId}:`, error);
      throw error;
    }
  }
}
