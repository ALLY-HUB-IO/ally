import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { prisma } from './db/client';
import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/users';
import { messageRoutes } from './routes/messages';
import { campaignRoutes } from './routes/campaigns';
import { epochRoutes } from './routes/epochs';
import { payoutRoutes } from './routes/payouts';
import { statsRoutes } from './routes/stats';
import { authenticateToken } from './middleware/auth';

const PORT = process.env.ADMIN_PORT ? Number(process.env.ADMIN_PORT) : 8083;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ADMIN_FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', async (req: Request, res: Response) => {
  try {
    // Simple health check without database for now
    res.json({ 
      ok: true, 
      timestamp: new Date().toISOString(),
      service: 'admin-service',
      version: '1.0.0'
    });
  } catch (error) {
    res.status(500).json({ 
      ok: false, 
      error: 'Service error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/messages', authenticateToken, messageRoutes);
app.use('/api/campaigns', authenticateToken, campaignRoutes);
app.use('/api/epochs', authenticateToken, epochRoutes);
app.use('/api/payouts', authenticateToken, payoutRoutes);
app.use('/api/stats', authenticateToken, statsRoutes);

// Error handling middleware
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Admin service error:', error);
  res.status(500).json({
    ok: false,
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// 404 handler
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    ok: false,
    error: 'Endpoint not found',
    path: req.originalUrl
  });
});

const server = app.listen(PORT, () => {
  console.log(`[admin-service] Server running on port ${PORT}`);
  console.log(`[admin-service] Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[admin-service] Received SIGTERM, shutting down gracefully...');
  server.close(() => {
    console.log('[admin-service] Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[admin-service] Received SIGINT, shutting down gracefully...');
  server.close(() => {
    console.log('[admin-service] Server closed');
    process.exit(0);
  });
});

export { app };
