import 'dotenv/config';
import express, { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { getEdgeCloud } from '@ally/intelligence-edgecloud';

const PORT = process.env.PORT ? Number(process.env.PORT) : 8081;
const POSTGRES_URL = process.env.POSTGRES_URL;
const REDIS_URL = process.env.REDIS_URL;
const TEC_CHAT_ID = process.env.TEC_CHAT_ID || 'default-project';

const pg = POSTGRES_URL ? new Pool({ connectionString: POSTGRES_URL }) : null;
const redis = REDIS_URL ? new Redis(REDIS_URL) : null;
const app = express();
app.use(express.json());

// simple worker loop stub (replace with your real consumer)
async function startWorker() {
  const ec = getEdgeCloud();
  console.log('[worker] starting…');
  if (!REDIS_URL) {
    console.warn('[worker] REDIS_URL not set; redis features disabled');
  }
  // example: on boot, ping TEC once so we notice misconfig early
  try {
    const res = await ec.ragChat({ projectId: TEC_CHAT_ID, messages: [{ role: 'user', content: 'ping' }] });
    console.log('[worker] TEC ok:', !!res.content);
  } catch (e) {
    console.warn('[worker] TEC check failed:', (e as Error).message);
  }
  // TODO: subscribe to your queue / stream and score messages
}

type ScoreJobStatus = 'queued' | 'processing' | 'done' | 'error';
type ScoreJob = { id: string; status: ScoreJobStatus; result?: any; error?: string };
const jobs = new Map<string, ScoreJob>();

function extractFirstJsonObject(text: string): any | null {
  try { return JSON.parse(text); } catch {}
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    const maybe = text.slice(start, end + 1);
    try { return JSON.parse(maybe); } catch {}
  }
  return null;
}

async function computeScoreSync(message: { id?: string; text: string }, projectId?: string) {
  const ec = getEdgeCloud();
  const pid = projectId || TEC_CHAT_ID;
  const system = "You are a scoring assistant. Return strict JSON: {\"score\": number (0..1), \"sentiment\": 'positive'|'neutral'|'negative', \"rationale\": string }. No extra text.";
  const res = await ec.ragChat({ projectId: pid, messages: [
    { role: 'system', content: system },
    { role: 'user', content: message.text }
  ] });
  const parsed = extractFirstJsonObject(res.content) ?? {};
  const score = typeof parsed.score === 'number' ? parsed.score : 0.5;
  const sentiment = typeof parsed.sentiment === 'string' ? parsed.sentiment : undefined;
  const rationale = typeof parsed.rationale === 'string' ? parsed.rationale : res.content;
  return { messageId: message.id, projectId: pid, score, sentiment, rationale, sources: res.sources };
}

// POST /v1/score — synchronous scoring
app.post('/v1/score', async (req: Request, res: Response) => {
  try {
    const { message, projectId } = req.body ?? {};
    if (!message?.text || typeof message.text !== 'string') {
      return res.status(400).json({ error: 'message.text is required' });
    }
    const result = await computeScoreSync({ id: message.id, text: message.text }, projectId);
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

// POST /v1/score-jobs — enqueue async scoring job
app.post('/v1/score-jobs', async (req: Request, res: Response) => {
  const { message, projectId } = req.body ?? {};
  if (!message?.text || typeof message.text !== 'string') {
    return res.status(400).json({ error: 'message.text is required' });
  }
  const id = randomUUID();
  const job: ScoreJob = { id, status: 'queued' };
  jobs.set(id, job);
  // Process asynchronously in background
  setImmediate(async () => {
    const j = jobs.get(id);
    if (!j) return;
    j.status = 'processing';
    try {
      j.result = await computeScoreSync({ id: message.id, text: message.text }, projectId);
      j.status = 'done';
    } catch (e) {
      j.status = 'error';
      j.error = (e as Error).message;
    }
  });
  res.status(202).json({ ok: true, jobId: id });
});

// GET /v1/score-jobs/:id — fetch job status/result
app.get('/v1/score-jobs/:id', (req: Request, res: Response) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ ok: false, error: 'job not found' });
  res.json({ ok: true, job });
});

// POST /v1/rescore/:messageId — force recompute
app.post('/v1/rescore/:messageId', async (req: Request, res: Response) => {
  const { projectId, text } = req.body ?? {};
  const messageId = req.params.messageId;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'body.text is required to rescore' });
  }
  // Create an async job for rescore to keep consistent behavior
  const id = randomUUID();
  const job: ScoreJob = { id, status: 'queued' };
  jobs.set(id, job);
  setImmediate(async () => {
    const j = jobs.get(id);
    if (!j) return;
    j.status = 'processing';
    try {
      j.result = await computeScoreSync({ id: messageId, text }, projectId);
      j.status = 'done';
    } catch (e) {
      j.status = 'error';
      j.error = (e as Error).message;
    }
  });
  res.status(202).json({ ok: true, jobId: id });
});

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


