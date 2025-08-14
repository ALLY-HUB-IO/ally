import { PrismaClient } from '@prisma/client';

let prismaSingleton: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!prismaSingleton) {
    prismaSingleton = new PrismaClient();
  }
  return prismaSingleton;
}

export type { User, Message, Score, Reaction } from '@prisma/client';


