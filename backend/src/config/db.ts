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
    
    // Ensure articles table has position column for sorting
    await pool.query('ALTER TABLE articles ADD COLUMN IF NOT EXISTS position INT DEFAULT 0');

    // Ensure categories table has is_visible and color columns
    await pool.query('ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_visible BOOLEAN DEFAULT true');
    await pool.query('ALTER TABLE categories ADD COLUMN IF NOT EXISTS color VARCHAR(50) DEFAULT \'#6366f1\'');

    // Create database indexes for performance speedup
    console.log('Creating database indexes for performance speedup...');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_articles_category_id ON articles(category_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_articles_author_id ON articles(author_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_articles_published_position ON articles(published, position)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_categories_position ON categories(position)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id)');
    
    console.log('Database tables and indexes verified/created successfully.');
  } catch (error) {
    console.error('Failed to initialize database tables:', error);
  }
};
