import { EventEmitter } from 'events';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

// TODO: Replace when implementing actual search index
// Will likely change this to reference multiple search indexes
interface OrganizationIndex {
    organizationId: string;
    documents: Map<string, any>;
    lastUpdated: Date;
    isBuilding: boolean;
}

export class SearchIndexManager extends EventEmitter {
    private indexes = new Map<string, OrganizationIndex>();
    private buildingPromises = new Map<string, Promise<void>>();

    async buildIndex(organizationId: string): Promise<void> {
        if(this.buildingPromises.has(organizationId)) {
            return this.buildingPromises.get(organizationId)!;
        }

        const buildPromise = this.buildIndexInternal(organizationId);
        this.buildingPromises.set(organizationId, buildPromise);

        try {
            await buildPromise;
        } finally {
            this.buildingPromises.delete(organizationId)
        }
    }

    private async buildIndexInternal(organizationId: string): Promise<void> {

        const organization = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: {
                lastDataChange: true,
                lastIndexUpdate: true,
                currentWordCount: true,
                maxWords: true
            }
        });

        if (!organization) {
            // TODO: create error class that fits this error type
            throw new Error(`Organization ${organizationId} not found`);
        }

        const existingIndex = this.indexes.get(organizationId);
        const needsRebuild = !existingIndex || !organization.lastIndexUpdate || organization.lastDataChange > organization.lastIndexUpdate;

        if (!needsRebuild && existingIndex) {
            logger.info(`Index for ${organizationId} already up to date`);
            return;
        }

        // TODO: replace with actual search indexes
        const index: OrganizationIndex = {
            organizationId,
            documents: new Map(),
            lastUpdated: new Date(),
            isBuilding: true
        }

        this.indexes.set(organizationId, index);

        try{
            // TODO: add fetch to get all the data to build the search indexes
            const documents: any = [];
            // TODO: actually build the search indexes

            await prisma.organization.update({
                where: { id: organizationId },
                data: { lastIndexUpdate: new Date() }
            });

            logger.info(`Index for ${organizationId} built with ${documents.size} documents`);
            this.emit('indexBuilt', organizationId, documents.length);

        } catch (error) {
            logger.error(`Failed to build index for ${organizationId}: ${error}`);
            this.indexes.delete(organizationId);
            throw error;
        }
    }

    destroyIndex(organizationId: string): void {
        if(this.indexes.has(organizationId)) {
            logger.info(`Destroying index for ${organizationId}`);
            this.indexes.delete(organizationId);
            this.emit('indexDestroyed', organizationId);
        }
    }

    getIndex(organizationId: string): OrganizationIndex | undefined {
        return this.indexes.get(organizationId);
    }

    hasIndex(organizationId: string): boolean {
        return this.indexes.has(organizationId);
    }



}
