import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

interface IndexStatus {
  organizationId: string;
  status: 'building' | 'ready' | 'failed' | 'not_found';
  isBuilding: boolean;
}

export class SearchIndexManager extends EventEmitter {
  private indexStatuses = new Map<string, IndexStatus>();
  private buildingPromises = new Map<string, Promise<void>>();
  private pythonServiceUrl: string;

  constructor() {
    super();
    this.pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8001';
  }

  async buildIndex(organizationId: string, forceRebuild: boolean = false): Promise<any> {
    if (this.buildingPromises.has(organizationId)) {
      await this.buildingPromises.get(organizationId)!;
      // After waiting, get the status to return proper response
      const status = await this.getIndexStatus(organizationId);
      return {
        message: `Index already built for organization ${organizationId}`,
        stats: {
          chunk_count: status.chunk_count,
          document_count: status.document_count,
          last_updated: status.last_updated,
          has_hnsw: status.status === 'ready'
        }
      };
    }

    const buildPromise = this.sendBuildIndexRequest(organizationId, forceRebuild);
    this.buildingPromises.set(organizationId, buildPromise);

    try {
      return await buildPromise;
    } finally {
      this.buildingPromises.delete(organizationId);
    }
  }

  private async sendBuildIndexRequest(organizationId: string, forceRebuild: boolean = false): Promise<any> {
    logger.info(`Building search index for organization ${organizationId}`);

    this.indexStatuses.set(organizationId, {
      organizationId,
      status: 'building',
      isBuilding: true
    });

    try {
      const requestBody = {
        organization_id: organizationId,
        force_rebuild: forceRebuild
      };

      const response = await fetch(`${this.pythonServiceUrl}/api/search/build-index`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Python service responded with ${response.status}: ${errorText}`);
      }

      const result = await response.json();

      this.indexStatuses.set(organizationId, {
        organizationId,
        status: 'ready',
        isBuilding: false
      });

      logger.info(`Index built successfully for organization ${organizationId}`, {
        stats: result.stats
      });

      this.emit('indexBuilt', organizationId, result.stats);

      return result;

    } catch (error: any) {
      this.indexStatuses.set(organizationId, {
        organizationId,
        status: 'failed',
        isBuilding: false
      });

      logger.error(`Failed to build index for organization ${organizationId}:`, error);
      throw error;
    }
  }

  async destroyIndex(organizationId: string): Promise<void> {
    logger.info(`Destroying search index for organization ${organizationId}`);

    try {
      const response = await fetch(`${this.pythonServiceUrl}/api/search/index/${organizationId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.warn(`Failed to destroy index in Python service: ${response.status}: ${errorText}`);
      } else {
        const result = await response.json();
        logger.info(`Index destroyed for organization ${organizationId}: ${result.message}`);
      }

    } catch (error: any) {
      logger.error(`Error calling Python service to destroy index for ${organizationId}:`, error);
      // Continue with local cleanup even if Python service call fails
    }

    this.indexStatuses.delete(organizationId);
    this.emit('indexDestroyed', organizationId);
  }

  async hasIndex(organizationId: string): Promise<boolean> {
    const status = await this.getIndexStatus(organizationId);
    return status.status === 'ready';
  }

  isBuilding(organizationId: string): boolean {
    const localStatus = this.indexStatuses.get(organizationId);
    return localStatus?.isBuilding || false;
  }

  async getIndexStatus(organizationId: string): Promise<any> {
    try {
      const response = await fetch(`${this.pythonServiceUrl}/api/search/index-status/${organizationId}`);

      if (!response.ok) {
        const notFoundStatus = {
          organization_id: organizationId,
          status: 'not_found',
          chunk_count: 0,
          document_count: 0,
          message: 'No indexes found for this organization'
        };

        this.indexStatuses.set(organizationId, {
          organizationId,
          status: 'not_found',
          isBuilding: false
        });

        return notFoundStatus;
      }

      const result = await response.json();

      this.indexStatuses.set(organizationId, {
        organizationId,
        status: result.status === 'building' ? 'building' :
                result.status === 'ready' ? 'ready' : 'not_found',
        isBuilding: result.status === 'building'
      });

      return result;

    } catch (error: any) {
      logger.error(`Failed to get index status for ${organizationId}:`, error);
      const failedStatus = {
        organization_id: organizationId,
        status: 'failed',
        chunk_count: 0,
        document_count: 0,
        message: 'Failed to get index status'
      };

      this.indexStatuses.set(organizationId, {
        organizationId,
        status: 'failed',
        isBuilding: false
      });

      return failedStatus;
    }
  }

  getActiveIndexes(): string[] {
    return Array.from(this.indexStatuses.entries())
      .filter(([_, status]) => status.status === 'ready')
      .map(([orgId, _]) => orgId);
  }

}
