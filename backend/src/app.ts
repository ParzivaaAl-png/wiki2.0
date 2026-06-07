import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import dotenv from 'dotenv';
import apiRouter from './routes/api';
import { checkDatabaseConnection, initializeDatabase } from './config/db';
import { 
  checkMeilisearchConnection, 
  initializeMeilisearch, 
  bulkSyncArticles,
  bulkSyncNews,
  ArticleDocument,
  NewsDocument,
  msClient
} from './services/meilisearch';
import * as ArticleModel from './models/article';
import * as NewsModel from './models/news';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy (Render runs behind Cloudflare/nginx reverse proxy)
app.set('trust proxy', 1);

// Middleware
app.use(cors({
  origin: true, // Allow requests from any origin or dynamic origins
  credentials: true // Allow cookies to be shared
}));
app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static upload files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api', apiRouter);

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Health Check for Search (Meilisearch) - Proxies to Meilisearch using GET to keep it awake
app.get('/health/search', async (req, res) => {
  try {
    const healthy = await msClient.isHealthy();
    if (healthy) {
      return res.json({ status: 'OK', search: 'available', timestamp: new Date() });
    }
    return res.status(503).json({ status: 'ERROR', search: 'unavailable', timestamp: new Date() });
  } catch (err: any) {
    return res.status(500).json({ status: 'ERROR', details: err.message, timestamp: new Date() });
  }
});

// Startup logic
const startServer = async () => {
  console.log('Starting Wiki 2.0 Backend Server...');

  // 1. Verify DB is running
  const dbConnected = await checkDatabaseConnection();
  if (!dbConnected) {
    console.error('CRITICAL: PostgreSQL database is unreachable. Exiting.');
    process.exit(1);
  }

  // 1b. Initialize Database Tables if they do not exist
  await initializeDatabase();

  // 2. Verify Meilisearch is running
  const msConnected = await checkMeilisearchConnection();
  if (!msConnected) {
    console.error('CRITICAL: Meilisearch is unreachable. Exiting.');
    process.exit(1);
  }

  // 3. Initialize Meilisearch index & settings
  await initializeMeilisearch();

  // 4. Synchronize DB Articles with Meilisearch Index
  try {
    console.log('Synchronizing database articles with Meilisearch...');
    const dbArticles = await ArticleModel.getAllArticles({ publishedOnly: false });
    
    const docs: ArticleDocument[] = dbArticles.map((art) => ({
      id: art.id,
      title: art.title,
      slug: art.slug,
      content: art.content,
      summary: art.summary,
      categoryName: '',
      tags: art.tags,
      published: art.published,
      createdAt: art.created_at instanceof Date ? art.created_at.toISOString() : new Date(art.created_at).toISOString(),
    }));

    await bulkSyncArticles(docs);

    // 4b. Synchronize DB News with Meilisearch Index
    console.log('Synchronizing database news with Meilisearch...');
    const dbNews = await NewsModel.getAllNews({ publishedOnly: false });
    const newsDocs: NewsDocument[] = dbNews.map((n) => ({
      id: n.id,
      title: n.title,
      description: n.description,
      content: n.content,
      tags: n.tags || [],
      attachments: (n.attachments || []).map((a: any) => a.file_name),
      isPublished: n.is_published,
      isPinned: n.is_pinned,
      publishedAt: n.published_at instanceof Date ? n.published_at.toISOString() : new Date(n.published_at).toISOString(),
      createdAt: n.created_at instanceof Date ? n.created_at.toISOString() : new Date(n.created_at).toISOString(),
    }));

    await bulkSyncNews(newsDocs);
    console.log('Database and Meilisearch sync completed.');
  } catch (err) {
    console.error('Failed to sync PostgreSQL data with Meilisearch:', err);
  }

  // 5. Start background sync scheduler daemon
  const { startScheduler } = require('./services/sourceSync');
  startScheduler();

  // 6. Start listening
  app.listen(PORT, () => {
    console.log(`Backend server is running on http://localhost:${PORT}`);
  });
};

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
