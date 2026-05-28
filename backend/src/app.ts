import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import dotenv from 'dotenv';
import apiRouter from './routes/api';
import { checkDatabaseConnection } from './config/db';
import { 
  checkElasticsearchConnection, 
  initializeElasticsearch, 
  bulkSyncArticles,
  ArticleDocument
} from './services/elasticsearch';
import * as ArticleModel from './models/article';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: true, // Allow requests from any origin or dynamic origins
  credentials: true // Allow cookies to be shared
}));
app.use(cookieParser());
app.use(express.json());

// Serve static upload files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api', apiRouter);

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
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

  // 2. Verify ES is running
  const esConnected = await checkElasticsearchConnection();
  if (!esConnected) {
    console.error('CRITICAL: Elasticsearch is unreachable. Exiting.');
    process.exit(1);
  }

  // 3. Initialize ES Index mapping & analyzers
  await initializeElasticsearch();

  // 4. Synchronize DB Articles with Elasticsearch Index
  try {
    console.log('Synchronizing database articles with Elasticsearch...');
    const dbArticles = await ArticleModel.getAllArticles({ publishedOnly: false });
    
    const docs: ArticleDocument[] = dbArticles.map((art) => ({
      id: art.id,
      title: art.title,
      slug: art.slug,
      content: art.content,
      summary: art.summary,
      categoryName: art.category_slug || '',
      tags: art.tags,
      published: art.published,
      createdAt: art.created_at instanceof Date ? art.created_at.toISOString() : new Date(art.created_at).toISOString(),
    }));

    await bulkSyncArticles(docs);
    console.log('Database and Elasticsearch sync completed.');
  } catch (err) {
    console.error('Failed to sync PostgreSQL data with Elasticsearch:', err);
  }

  // 5. Start listening
  app.listen(PORT, () => {
    console.log(`Backend server is running on http://localhost:${PORT}`);
  });
};

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
