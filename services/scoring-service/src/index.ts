import 'dotenv/config';
import express, { Request, Response } from 'express';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { getEdgeCloud } from '@ally/intelligence-edgecloud';

const PORT = process.env.PORT ? Number(process.env.PORT) : 8081;
const POSTGRES_URL = process.env.POSTGRES_URL;
const REDIS_URL = process.env.REDIS_URL;
const TEC_PROJECT_ID = process.env.TEC_PROJECT_ID || 'default-project';

const pg = POSTGRES_URL ? new Pool({ connectionString: POSTGRES_URL }) : null;
const redis = REDIS_URL ? new Redis(REDIS_URL) : null;
const app = express();

// simple worker loop stub (replace with your real consumer)
async function startWorker() {
  const ec = getEdgeCloud();
  console.log('[worker] starting…');
  if (!REDIS_URL) {
    console.warn('[worker] REDIS_URL not set; redis features disabled');
  }
  // example: on boot, ping TEC once so we notice misconfig early
  try {
    const res = await ec.ragChat({ projectId: TEC_PROJECT_ID, messages: [{ role: 'user', content: 'ping' }] });
    console.log('[worker] TEC ok:', !!res.content);
  } catch (e) {
    console.warn('[worker] TEC check failed:', (e as Error).message);
  }
  // TODO: subscribe to your queue / stream and score messages
}

app.get('/health', async (_req: Request, res: Response) => {
  try {
    if (pg) await pg.query('select 1');
    if (redis) await redis.ping();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

app.listen(PORT, async () => {
  console.log(`[scoring-service] up on :${PORT}`);
  await startWorker();
});


