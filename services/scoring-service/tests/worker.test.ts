import { ScoringWorker } from '../src/worker';

// Mock Redis client
const mockRedis = {
  xgroup: jest.fn(),
  xack: jest.fn(),
  xreadgroup: jest.fn(),
  xadd: jest.fn(),
};

// Mock orchestrator
jest.mock('@ally/scoring-orchestrator', () => ({
  createScoreOrchestrator: jest.fn(() => ({
    score: jest.fn().mockResolvedValue({
      finalScore: 0.75,
      breakdown: {
        sentiment: { score: 0.8, label: 'positive', weight: 0.4, weightedScore: 0.32 },
        value: { score: 0.7, weight: 0.4, weightedScore: 0.28 },
        uniqueness: { score: 0.6, weight: 0.2, weightedScore: 0.12 },
      },
      metadata: {
        processingTimeMs: 150,
        timestamp: '2024-01-01T00:00:00.000Z',
        models: { sentiment: 'test-model', value: 'test-model' },
      },
    }),
  })),
}));

// Mock events package
jest.mock('@ally/events/streams', () => ({
  xreadGroupLoop: jest.fn(),
  ingestStreamKey: jest.fn(),
  dlqStreamKey: jest.fn(),
  xaddObj: jest.fn(),
}));

describe('ScoringWorker', () => {
  let worker: ScoringWorker;

  beforeEach(() => {
    jest.clearAllMocks();
    worker = new ScoringWorker({
      redis: mockRedis as any,
      projectId: 'test-project',
      platform: 'discord',
      consumerGroup: 'cg:scoring:v1:test-project',
      consumerName: 'test-consumer',
    });
  });

  describe('shouldProcessEvent', () => {
    it('should process Discord message created events', () => {
      const envelope = {
        type: 'platform.discord.message.created',
        payload: { content: 'test message' },
      } as any;

      // Access private method for testing
      const shouldProcess = (worker as any).shouldProcessEvent(envelope);
      expect(shouldProcess).toBe(true);
    });

    it('should ignore unsupported event types', () => {
      const envelope = {
        type: 'platform.discord.message.updated',
        payload: { content: 'test message' },
      } as any;

      const shouldProcess = (worker as any).shouldProcessEvent(envelope);
      expect(shouldProcess).toBe(false);
    });
  });

  describe('handleMessage', () => {
    it('should process valid message successfully', async () => {
      const fields = {
        version: 'v1',
        idempotencyKey: 'test-key',
        projectId: 'test-project',
        platform: 'discord',
        type: 'platform.discord.message.created',
        ts: '2024-01-01T00:00:00.000Z',
        source: '{"guildId":"123","channelId":"456"}',
        payload: '{"externalId":"789","content":"test message","author":{"id":"user1"}}',
      };

      await (worker as any).handleMessage('test-stream', '123-0', fields);

      expect(mockRedis.xack).toHaveBeenCalledWith('test-stream', 'cg:scoring:v1:test-project', '123-0');
      
      const stats = worker.getStats();
      expect(stats.messagesReceived).toBe(1);
      expect(stats.messagesProcessed).toBe(1);
      expect(stats.messagesFailed).toBe(0);
      expect(stats.messagesIgnored).toBe(0);
    });

    it('should ignore unsupported event types', async () => {
      const fields = {
        version: 'v1',
        idempotencyKey: 'test-key',
        projectId: 'test-project',
        platform: 'discord',
        type: 'platform.discord.message.updated',
        ts: '2024-01-01T00:00:00.000Z',
        source: '{}',
        payload: '{"content":"test message"}',
      };

      await (worker as any).handleMessage('test-stream', '123-0', fields);

      expect(mockRedis.xack).toHaveBeenCalledWith('test-stream', 'cg:scoring:v1:test-project', '123-0');
      
      const stats = worker.getStats();
      expect(stats.messagesReceived).toBe(1);
      expect(stats.messagesProcessed).toBe(0);
      expect(stats.messagesFailed).toBe(0);
      expect(stats.messagesIgnored).toBe(1);
    });

    it('should handle processing errors and send to DLQ', async () => {
      const fields = {
        version: 'v1',
        idempotencyKey: 'test-key',
        projectId: 'test-project',
        platform: 'discord',
        type: 'platform.discord.message.created',
        ts: '2024-01-01T00:00:00.000Z',
        source: '{}',
        payload: '{"externalId":"789"}', // Missing content
      };

      await (worker as any).handleMessage('test-stream', '123-0', fields);

      expect(mockRedis.xack).toHaveBeenCalledWith('test-stream', 'cg:scoring:v1:test-project', '123-0');
      expect(mockRedis.xadd).toHaveBeenCalled(); // DLQ entry
      
      const stats = worker.getStats();
      expect(stats.messagesReceived).toBe(1);
      expect(stats.messagesProcessed).toBe(0);
      expect(stats.messagesFailed).toBe(1);
      expect(stats.messagesIgnored).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return initial stats', () => {
      const stats = worker.getStats();
      expect(stats).toEqual({
        messagesReceived: 0,
        messagesProcessed: 0,
        messagesFailed: 0,
        messagesIgnored: 0,
      });
    });

    it('should track stats correctly', async () => {
      const fields = {
        version: 'v1',
        idempotencyKey: 'test-key',
        projectId: 'test-project',
        platform: 'discord',
        type: 'platform.discord.message.created',
        ts: '2024-01-01T00:00:00.000Z',
        source: '{}',
        payload: '{"externalId":"789","content":"test message"}',
      };

      await (worker as any).handleMessage('test-stream', '123-0', fields);

      const stats = worker.getStats();
      expect(stats.messagesReceived).toBe(1);
      expect(stats.messagesProcessed).toBe(1);
      expect(stats.lastProcessedAt).toBeDefined();
    });
  });
});
