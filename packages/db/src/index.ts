import { PrismaClient } from '@prisma/client';

let prismaSingleton: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!prismaSingleton) {
    prismaSingleton = new PrismaClient();
  }
  return prismaSingleton;
}

export type { User, Message, Score, Reaction, EventsRaw, Interactions } from '@prisma/client';

// Persistence service exports
export { 
  createPersistenceService, 
  DatabasePersistenceService,
  type PersistenceService 
} from './persistence.js';


