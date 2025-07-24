import { PrismaClient } from '../../generated/prisma';

export const prisma = new PrismaClient({
  log: [],
});

process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
