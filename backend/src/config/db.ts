import { Pool } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgresql://wiki_user:wiki_password@localhost:5432/wiki_db';

export const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export const query = (text: string, params?: any[]) => {
  return pool.query(text, params);
};

export const checkDatabaseConnection = async (retries = 5, delay = 3000): Promise<boolean> => {
  for (let i = 0; i < retries; i++) {
    try {
      const client = await pool.connect();
      console.log('Successfully connected to PostgreSQL database!');
      client.release();
      return true;
    } catch (err) {
      console.warn(`PostgreSQL connection failed. Retrying in ${delay / 1000}s... (${i + 1}/${retries})`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  return false;
};

export const initializeDatabase = async () => {
  try {
    // Check if the "articles" table exists
    const checkTableQuery = `
      SELECT EXISTS (
        SELECT FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename  = 'articles'
      );
    `;
    const res = await pool.query(checkTableQuery);
    const tableExists = res.rows[0].exists;

    if (!tableExists) {
      console.log('Database tables not found. Initializing from init.sql...');
      const initSqlPath = path.join(__dirname, '../../init.sql');
      if (fs.existsSync(initSqlPath)) {
        const sql = fs.readFileSync(initSqlPath, 'utf8');
        // Execute the entire init.sql
        await pool.query(sql);
        console.log('Database initialized successfully from init.sql!');
      } else {
        console.error(`init.sql not found at ${initSqlPath}. Skipping database initialization.`);
      }
    } else {
      console.log('Database tables already exist. Checking additional tables...');
    }

    // Always ensure user_sessions and user_audit_logs exist
    console.log('Ensuring user_sessions and user_audit_logs tables exist...');
    const createSessionsTableQuery = `
      CREATE TABLE IF NOT EXISTS user_sessions (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        refresh_token VARCHAR(512) NOT NULL UNIQUE,
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await pool.query(createSessionsTableQuery);

    const createAuditLogsTableQuery = `
      CREATE TABLE IF NOT EXISTS user_audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        changed_by INT REFERENCES users(id) ON DELETE SET NULL,
        field_changed VARCHAR(100) NOT NULL,
        old_value TEXT,
        new_value TEXT,
        changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await pool.query(createAuditLogsTableQuery);
    
    // Ensure articles table has position and is_visible columns for sorting/archiving
    await pool.query('ALTER TABLE articles ADD COLUMN IF NOT EXISTS position INT DEFAULT 0');
    await pool.query('ALTER TABLE articles ADD COLUMN IF NOT EXISTS is_visible BOOLEAN DEFAULT true');

    // Create user_favorite_articles table for personal quick access
    const createFavsTableQuery = `
      CREATE TABLE IF NOT EXISTS user_favorite_articles (
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        article_id INT REFERENCES articles(id) ON DELETE CASCADE,
        position INT DEFAULT 0,
        PRIMARY KEY (user_id, article_id)
      );
    `;
    await pool.query(createFavsTableQuery);
    await pool.query('ALTER TABLE user_favorite_articles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');

    // Create user_reading_history table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_reading_history (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        article_id INT REFERENCES articles(id) ON DELETE CASCADE,
        viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id, article_id)
      );
    `);

    // Create article_views_log table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS article_views_log (
        id SERIAL PRIMARY KEY,
        article_id INT REFERENCES articles(id) ON DELETE CASCADE,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        ip_address VARCHAR(45) NOT NULL,
        viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create article_changes_log table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS article_changes_log (
        id SERIAL PRIMARY KEY,
        article_id INT REFERENCES articles(id) ON DELETE CASCADE,
        user_id INT REFERENCES users(id) ON DELETE SET NULL,
        changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        change_description TEXT,
        editor_comment TEXT
      );
    `);

    // Ensure version snapshot columns exist
    await pool.query('ALTER TABLE article_changes_log ADD COLUMN IF NOT EXISTS old_content TEXT DEFAULT NULL');
    await pool.query('ALTER TABLE article_changes_log ADD COLUMN IF NOT EXISTS new_content TEXT DEFAULT NULL');
    await pool.query('ALTER TABLE article_changes_log ADD COLUMN IF NOT EXISTS old_title VARCHAR(255) DEFAULT NULL');
    await pool.query('ALTER TABLE article_changes_log ADD COLUMN IF NOT EXISTS new_title VARCHAR(255) DEFAULT NULL');

    // Add indexes for new tables
    await pool.query('CREATE INDEX IF NOT EXISTS idx_user_reading_history_user_id ON user_reading_history(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_article_views_log_article_id ON article_views_log(article_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_article_changes_log_article_id ON article_changes_log(article_id)');

    // Create database indexes for performance speedup
    console.log('Creating database indexes for performance speedup...');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_articles_category_id ON articles(category_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_articles_author_id ON articles(author_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_articles_published_position ON articles(published, position)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_categories_position ON categories(position)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id)');
    
    // Auto-sync & Classifier integration migrations
    console.log('Ensuring auto-sync columns and tables exist...');
    await pool.query('ALTER TABLE articles ADD COLUMN IF NOT EXISTS source_url TEXT DEFAULT NULL');
    await pool.query('ALTER TABLE articles ADD COLUMN IF NOT EXISTS sync_interval VARCHAR(50) DEFAULT \'manual\'');
    await pool.query('ALTER TABLE articles ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMP DEFAULT NULL');
    await pool.query('ALTER TABLE articles ADD COLUMN IF NOT EXISTS next_sync_at TIMESTAMP DEFAULT NULL');
    await pool.query('ALTER TABLE articles ADD COLUMN IF NOT EXISTS structured_data JSONB DEFAULT NULL');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS article_sync_history (
        id SERIAL PRIMARY KEY,
        article_id INT REFERENCES articles(id) ON DELETE CASCADE,
        synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        source_url TEXT NOT NULL,
        status VARCHAR(50) NOT NULL,
        changes_count INT DEFAULT 0,
        changes_summary JSONB DEFAULT '{}',
        error_message TEXT,
        backup_content TEXT
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(50),
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(50) DEFAULT 'info',
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query('CREATE INDEX IF NOT EXISTS idx_article_sync_history_article_id ON article_sync_history(article_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_notifications_role ON notifications(role)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)');

    // Create News Tables
    console.log('Ensuring news and related tables exist...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS news (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        content TEXT NOT NULL,
        is_published BOOLEAN DEFAULT TRUE,
        is_pinned BOOLEAN DEFAULT FALSE,
        author_id INT REFERENCES users(id) ON DELETE SET NULL,
        published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS news_images (
        id SERIAL PRIMARY KEY,
        news_id INT REFERENCES news(id) ON DELETE CASCADE,
        image_url TEXT NOT NULL,
        position INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS news_attachments (
        id SERIAL PRIMARY KEY,
        news_id INT REFERENCES news(id) ON DELETE CASCADE,
        file_url TEXT NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_size INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS news_views (
        id SERIAL PRIMARY KEY,
        news_id INT REFERENCES news(id) ON DELETE CASCADE,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS news_read_status (
        news_id INT REFERENCES news(id) ON DELETE CASCADE,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        is_read BOOLEAN DEFAULT FALSE,
        read_at TIMESTAMP,
        PRIMARY KEY (news_id, user_id)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS news_tags (
        news_id INT REFERENCES news(id) ON DELETE CASCADE,
        tag_name VARCHAR(50) NOT NULL,
        PRIMARY KEY (news_id, tag_name)
      );
    `);

    // Indexes for news performance
    await pool.query('CREATE INDEX IF NOT EXISTS idx_news_published_pinned ON news(is_published, is_pinned, published_at DESC)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_news_images_news_id ON news_images(news_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_news_attachments_news_id ON news_attachments(news_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_news_views_news_id_user_id ON news_views(news_id, user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_news_read_status_user_id ON news_read_status(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_news_tags_news_id ON news_tags(news_id)');

    // Migration: Alter image_url and file_url columns to TEXT to allow storing large base64 strings
    console.log('Altering news image and attachment URL columns to TEXT...');
    await pool.query('ALTER TABLE news_images ALTER COLUMN image_url TYPE TEXT');
    await pool.query('ALTER TABLE news_attachments ALTER COLUMN file_url TYPE TEXT');

    console.log('Database tables and indexes verified/created successfully.');
  } catch (error) {
    console.error('Failed to initialize database tables:', error);
  }
};
