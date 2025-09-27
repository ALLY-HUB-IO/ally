import { PrismaClient } from '@prisma/client';

// Create a singleton Prisma client
let prisma: PrismaClient;

declare global {
  var __prisma: PrismaClient | undefined;
}

// Always create a new instance to ensure it works in all environments
if (!global.__prisma) {
  global.__prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.POSTGRES_URL
      }
    }
  });
}
prisma = global.__prisma;

export { prisma };
