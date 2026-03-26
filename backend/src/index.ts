import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { getRedisClient } from './redis';
import { handleAutocomplete } from './routes/autocomplete';
import { handleSearch } from './routes/search';
import { handleVectorSearch } from './routes/vectorSearch';
import { handleCategories } from './routes/categories';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

// Middleware
// Helmet with relaxed CSP for CORS compatibility
app.use(helmet({
  contentSecurityPolicy: false,  // Disable CSP to allow cross-origin requests
  crossOriginResourcePolicy: false,  // Allow cross-origin resource sharing
}));
app.use(cors({
  origin: CORS_ORIGIN,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API Routes
app.get('/api/autocomplete', handleAutocomplete);
app.post('/api/search', handleSearch);
app.post('/api/vector-search', handleVectorSearch);
app.get('/api/categories', handleCategories);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
  });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: any) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Start server
async function start() {
  try {
    // Test Redis connection
    const redis = getRedisClient();
    await redis.ping();
    console.log('✅ Connected to Redis');

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV}`);
      console.log(`🔒 CORS Origin: ${CORS_ORIGIN}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

start();

