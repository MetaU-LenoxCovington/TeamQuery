import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { sessionService } from '../../src/services/sessionServiceSingleton';
import fs from 'fs';
import path from 'path';
import { DocumentService } from '../../src/services/documentService';

describe('Document Upload E2E Test', () => {
  let accessToken: string;
  let organizationId: string;
  let groupId: string;
  let userId: string;

  const TEST_TIMEOUT = 3 * 60 * 1000; // 3 minutes

  beforeAll(async () => {
    const testPdfPath = path.join(__dirname, '../fixtures/test-document.pdf');
    const sourcePdfPath = path.join(__dirname, '../../../pythonService/test_data/House Rules.pdf');

    if (!fs.existsSync(path.dirname(testPdfPath))) {
      fs.mkdirSync(path.dirname(testPdfPath), { recursive: true });
    }

    if (fs.existsSync(sourcePdfPath)) {
      fs.copyFileSync(sourcePdfPath, testPdfPath);
    } else {
      throw new Error(`Source PDF file not found at ${sourcePdfPath}`);
    }
  }, TEST_TIMEOUT);

  afterAll(async () => {

    const testPdfPath = path.join(__dirname, '../fixtures/test-document.pdf');
    if (fs.existsSync(testPdfPath)) {
      fs.unlinkSync(testPdfPath);
    }

    sessionService.stopCleanupInterval();
  });

  describe('Complete Document Upload and Processing Flow', () => {
    it('should register user, create organization/group, upload document, and verify processing', async () => {
      // Step 1: Register a new user (this creates organization and default group)
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: `test-${Date.now()}@example.com`,
          password: 'TestPassword123!',
          name: 'Test User',
          organizationName: 'Test Organization'
        })
        .expect(201);

      expect(registerResponse.body).toHaveProperty('accessToken');
      expect(registerResponse.body).toHaveProperty('user');
      expect(registerResponse.body).toHaveProperty('defaultOrganizationId');

      accessToken = registerResponse.body.accessToken;
      organizationId = registerResponse.body.defaultOrganizationId;
      userId = registerResponse.body.user.id;

      // Step 2: Verify organization and default group were created
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        include: {
          groups: true,
          memberships: true
        }
      });

      expect(organization).toBeTruthy();
      expect(organization!.name).toBe('Test Organization');
      expect(organization!.groups).toHaveLength(1);
      expect(organization!.groups[0].name).toBe('General');
      expect(organization!.memberships).toHaveLength(1);
      expect(organization!.memberships[0].role).toBe('ADMIN');

      groupId = organization!.groups[0].id;

      // Step 3: Upload a document
      const testPdfPath = path.join(__dirname, '../fixtures/test-document.pdf');

      const uploadResponse = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${accessToken}`)
        .field('title', 'Test Document')
        .field('organizationId', organizationId)
        .field('groupId', groupId)
        .field('accessLevel', 'GROUP')
        .attach('file', testPdfPath);

      expect(uploadResponse.status).toBe(201);

      expect(uploadResponse.body.success).toBe(true);
      expect(uploadResponse.body.data).toHaveProperty('id');
      expect(uploadResponse.body.data.title).toBe('Test Document');
      expect(uploadResponse.body.data.organizationId).toBe(organizationId);
      expect(uploadResponse.body.data.groupId).toBe(groupId);

      const documentId = uploadResponse.body.data.id;

      // Step 4: Verify document was created in database
      const document = await prisma.document.findUnique({
        where: { id: documentId }
      });

      expect(document).toBeTruthy();
      expect(document!.title).toBe('Test Document');
      expect(document!.organizationId).toBe(organizationId);
      expect(document!.groupId).toBe(groupId);
      expect(document!.originalFileName).toBe('test-document.pdf');

      // Step 5: Poll for document processing completion (max 3 minutes)
      const startTime = Date.now();
      const maxWaitTime = 3 * 60 * 1000; // 3 minutes
      let isProcessed = false;
      let attempts = 0;
      const pollInterval = 5000; // 5 seconds

      while (!isProcessed && (Date.now() - startTime) < maxWaitTime) {
        attempts++;

        const statusResponse = await request(app)
          .get(`/api/documents/${documentId}/status`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(statusResponse.body.success).toBe(true);
        expect(statusResponse.body.data).toHaveProperty('documentId', documentId);
        expect(statusResponse.body.data).toHaveProperty('status');
        expect(statusResponse.body.data).toHaveProperty('chunkCount');
        expect(statusResponse.body.data).toHaveProperty('embeddingCount');
        expect(statusResponse.body.data).toHaveProperty('isProcessed');

        isProcessed = statusResponse.body.data.isProcessed;
        const status = statusResponse.body.data.status;
        const chunkCount = statusResponse.body.data.chunkCount;
        const embeddingCount = statusResponse.body.data.embeddingCount;

        if (isProcessed) {
          expect(status).toBe('completed');
          expect(chunkCount).toBeGreaterThan(0);
          expect(embeddingCount).toBeGreaterThan(0);
          expect(embeddingCount).toBe(chunkCount); // Should have one embedding per chunk
          break;
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }

      // Verify processing completed within time limit
      if (!isProcessed) {

        // Get final status for debugging
        const finalStatusResponse = await request(app)
          .get(`/api/documents/${documentId}/status`)
          .set('Authorization', `Bearer ${accessToken}`);


        // Check if there are any chunks/embeddings in the database
        const [chunkCount, embeddingCount] = await Promise.all([
          prisma.chunk.count({ where: { documentId, isDeleted: false } }),
          prisma.embedding.count({ where: { documentId, isDeleted: false } })
        ]);


        fail('Document processing did not complete within the 3-minute timeout');
      }

      // Step 6: Verify chunks and embeddings exist in database
      const [finalChunkCount, finalEmbeddingCount] = await Promise.all([
        prisma.chunk.count({ where: { documentId, isDeleted: false } }),
        prisma.embedding.count({ where: { documentId, isDeleted: false } })
      ]);

      expect(finalChunkCount).toBeGreaterThan(0);
      expect(finalEmbeddingCount).toBeGreaterThan(0);
      expect(finalEmbeddingCount).toBe(finalChunkCount);


      // Step 7: Test document retrieval
      const getDocumentResponse = await request(app)
        .get(`/api/documents/${documentId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(getDocumentResponse.body.success).toBe(true);
      expect(getDocumentResponse.body.data.id).toBe(documentId);
      expect(getDocumentResponse.body.data.title).toBe('Test Document');
      expect(getDocumentResponse.body.data.isProcessed).toBe(true);
      expect(getDocumentResponse.body.data.chunkCount).toBe(finalChunkCount);
      expect(getDocumentResponse.body.data.embeddingCount).toBe(finalEmbeddingCount);


      // Step 8: Test document listing
      const listDocumentsResponse = await request(app)
        .get(`/api/documents?organizationId=${organizationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(listDocumentsResponse.body.success).toBe(true);
      expect(listDocumentsResponse.body.data).toHaveLength(1);
      expect(listDocumentsResponse.body.data[0].id).toBe(documentId);
      expect(listDocumentsResponse.body.data[0].isProcessed).toBe(true);



    }, TEST_TIMEOUT);

    it('should handle document upload without python service', async () => {
      // This test verifies error handling when Python service is unavailable

      // Register a new user
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: `test-no-python-${Date.now()}@example.com`,
          password: 'TestPassword123!',
          name: 'Test User No Python',
          organizationName: 'Test Organization No Python'
        })
        .expect(201);

      const accessToken = registerResponse.body.accessToken;
      const organizationId = registerResponse.body.defaultOrganizationId;

      // Get the default group
      const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        include: { groups: true }
      });
      const groupId = organization!.groups[0].id;

      // Temporarily set Python service URL to invalid URL
      const originalUrl = process.env.PYTHON_SERVICE_URL;
      process.env.PYTHON_SERVICE_URL = 'http://localhost:9999'; // Invalid port

      try {
        const testPdfPath = path.join(__dirname, '../fixtures/test-document.pdf');

        const uploadResponse = await request(app)
          .post('/api/documents/upload')
          .set('Authorization', `Bearer ${accessToken}`)
          .field('title', 'Test Document - Should Fail')
          .field('organizationId', organizationId)
          .field('groupId', groupId)
          .field('accessLevel', 'GROUP')
          .attach('file', testPdfPath)
          .expect(500);

        expect(uploadResponse.body.success).toBe(false);
        expect(uploadResponse.body.error.message).toContain('An unexpected error occurred');

        // Verify document was not created in database (rollback)
        const documents = await prisma.document.findMany({
          where: {
            organizationId,
            title: 'Test Document - Should Fail'
          }
        });
        expect(documents).toHaveLength(0);


      } finally {
        // Restore original URL
        process.env.PYTHON_SERVICE_URL = originalUrl;
      }
    });

    it('should enforce permission checks', async () => {
      // Register first user (admin of org1)
      const user1Response = await request(app)
        .post('/api/auth/register')
        .send({
          email: `admin-${Date.now()}@example.com`,
          password: 'TestPassword123!',
          name: 'Admin User',
          organizationName: 'Admin Organization'
        })
        .expect(201);

      // Register second user (admin of org2)
      const user2Response = await request(app)
        .post('/api/auth/register')
        .send({
          email: `user2-${Date.now()}@example.com`,
          password: 'TestPassword123!',
          name: 'User 2',
          organizationName: 'User 2 Organization'
        })
        .expect(201);

      const user1Token = user1Response.body.accessToken;
      const user1OrgId = user1Response.body.defaultOrganizationId;
      const user2Token = user2Response.body.accessToken;

      const testPdfPath = path.join(__dirname, '../fixtures/test-document.pdf');

      // User 2 should not be able to upload to User 1's organization
      const uploadResponse = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${user2Token}`)
        .field('title', 'Unauthorized Upload')
        .field('organizationId', user1OrgId)
        .field('accessLevel', 'GROUP')
        .attach('file', testPdfPath)
        .expect(403); // Should fail with forbidden error (correct behavior)

      expect(uploadResponse.body.success).toBe(false);

    });
  });
});
