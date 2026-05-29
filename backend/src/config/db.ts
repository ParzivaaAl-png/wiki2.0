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
      console.log('Database tables already exist. Skipping initialization.');
    }
  } catch (error) {
    console.error('Failed to initialize database tables:', error);
  }
};
