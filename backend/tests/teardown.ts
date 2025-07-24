import { prisma } from '../src/lib/prisma';
import { logger } from '../src/utils/logger';
import { sessionService } from '../src/services/sessionServiceSingleton';

export default async () => {
  logger.info('Running global test teardown...');

  try {

    sessionService.stopCleanupInterval();
    // Final cleanup
    await prisma.$disconnect();
    logger.info('Test teardown completed successfully');
  } catch (error) {
    logger.error('Error during test teardown:', error as Error);
  }
};
