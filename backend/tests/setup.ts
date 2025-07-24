import { prisma } from '../src/lib/prisma';
import { logger } from '../src/utils/logger';
import dotenv from 'dotenv';

dotenv.config();

beforeAll(async () => {
  process.env.NODE_ENV = 'test';

  if (!process.env.TEST_DATABASE_URL && !process.env.DATABASE_URL) {
    throw new Error('No database URL found. Please set DATABASE_URL in your .env file');
  }

  logger.info(`Using database: ${process.env.TEST_DATABASE_URL || process.env.DATABASE_URL}`);

  process.env.PYTHON_SERVICE_URL = 'http://localhost:8001';

  logger.info('Starting E2E test setup...');

  try {
    await prisma.$connect();
    logger.info('Database connected for tests');
  } catch (error) {
    logger.error('Failed to connect to test database:', error as Error);
    throw error;
  }
});

beforeEach(async () => {

  await prisma.searchQuery.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.embedding.deleteMany();
  await prisma.chunk.deleteMany();
  await prisma.document.deleteMany();
  await prisma.groupMembership.deleteMany();
  await prisma.group.deleteMany();
  await prisma.organizationInvite.deleteMany();
  await prisma.organizationMembership.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.userSession.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();

  logger.info('Database cleaned for test');
});

afterAll(async () => {
  await prisma.$disconnect();
  logger.info('Test database disconnected');
});
