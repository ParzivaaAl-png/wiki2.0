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
    const shouldSeedDemoData = process.env.SEED_DEMO_DATA === 'true';

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
      const bootstrapFile = shouldSeedDemoData ? 'init.sql' : 'schema.sql';
      console.log(`Database tables not found. Initializing from ${bootstrapFile}...`);
      const initSqlPath = path.join(__dirname, `../../${bootstrapFile}`);
      if (fs.existsSync(initSqlPath)) {
        const sql = fs.readFileSync(initSqlPath, 'utf8');
        // Execute the selected bootstrap schema.
        await pool.query(sql);
        console.log(`Database initialized successfully from ${bootstrapFile}!`);
      } else {
        console.error(`${bootstrapFile} not found at ${initSqlPath}. Skipping database initialization.`);
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
    await pool.query('CREATE INDEX IF NOT EXISTS idx_article_views_log_viewed_at ON article_views_log(viewed_at)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_article_views_log_user_viewed_at ON article_views_log(user_id, viewed_at)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_user_reading_history_viewed_at ON user_reading_history(viewed_at)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_article_changes_log_article_id ON article_changes_log(article_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_articles_updated_at ON articles(updated_at)');

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

    // ----------------------------------------------------
    // STAGE 1 MVP DATABASE MIGRATIONS
    // ----------------------------------------------------
    console.log('Initializing Stage 1 MVP tables for org structure and permissions...');
    
    // Create departments
    await pool.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        parent_department_id INT REFERENCES departments(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create positions
    await pool.query(`
      CREATE TABLE IF NOT EXISTS positions (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        department_id INT REFERENCES departments(id) ON DELETE CASCADE,
        parent_position_id INT REFERENCES positions(id) ON DELETE SET NULL,
        hierarchy_level INT DEFAULT 1,
        status VARCHAR(50) DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(name, department_id)
      );
    `);

    // Create employees
    await pool.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        position_id INT REFERENCES positions(id) ON DELETE SET NULL,
        department_id INT REFERENCES departments(id) ON DELETE SET NULL,
        manager_id INT REFERENCES employees(id) ON DELETE SET NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create spaces
    await pool.query(`
      CREATE TABLE IF NOT EXISTS spaces (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        department_id INT REFERENCES departments(id) ON DELETE SET NULL UNIQUE,
        status VARCHAR(50) DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create sections
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sections (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        space_id INT REFERENCES spaces(id) ON DELETE CASCADE,
        position_id INT REFERENCES positions(id) ON DELETE CASCADE UNIQUE,
        parent_section_id INT REFERENCES sections(id) ON DELETE SET NULL,
        status VARCHAR(50) DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Link users to employees
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id INT REFERENCES employees(id) ON DELETE SET NULL');

    // Add status column to articles for draft/approval workflow
    await pool.query('ALTER TABLE articles ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT \'published\'');

    // Create article_sections mapping table (many-to-many)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS article_sections (
        id SERIAL PRIMARY KEY,
        article_id INT REFERENCES articles(id) ON DELETE CASCADE,
        section_id INT REFERENCES sections(id) ON DELETE CASCADE,
        UNIQUE(article_id, section_id)
      );
    `);

    // Indexes
    await pool.query('CREATE INDEX IF NOT EXISTS idx_positions_department ON positions(department_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_employees_position ON employees(position_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_sections_space ON sections(space_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_article_sections_article ON article_sections(article_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_article_sections_section ON article_sections(section_id)');

    // Trigger Functions for automatic space & section synchronization
    await pool.query(`
      CREATE OR REPLACE FUNCTION sync_space_from_department() RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'INSERT' THEN
          INSERT INTO spaces (name, description, department_id, status)
          VALUES (NEW.name, COALESCE(NEW.description, 'Пространство для отдела ' || NEW.name), NEW.id, 'Active')
          ON CONFLICT (department_id) DO NOTHING;
        ELSIF TG_OP = 'UPDATE' THEN
          UPDATE spaces 
          SET name = NEW.name, 
              description = COALESCE(NEW.description, description)
          WHERE department_id = NEW.id;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await pool.query(`
      DROP TRIGGER IF EXISTS trg_sync_space_from_department ON departments;
      CREATE TRIGGER trg_sync_space_from_department
      AFTER INSERT OR UPDATE ON departments
      FOR EACH ROW EXECUTE FUNCTION sync_space_from_department();
    `);

    await pool.query(`
      CREATE OR REPLACE FUNCTION sync_section_from_position() RETURNS TRIGGER AS $$
      DECLARE
        var_space_id INT;
        var_parent_section_id INT;
      BEGIN
        SELECT id INTO var_space_id FROM spaces WHERE department_id = NEW.department_id;
        
        IF NEW.parent_position_id IS NOT NULL THEN
          SELECT id INTO var_parent_section_id FROM sections WHERE position_id = NEW.parent_position_id;
        ELSE
          var_parent_section_id := NULL;
        END IF;

        IF TG_OP = 'INSERT' THEN
          INSERT INTO sections (name, description, space_id, position_id, parent_section_id, status)
          VALUES (NEW.name, 'Раздел для должности ' || NEW.name, var_space_id, NEW.id, var_parent_section_id, NEW.status)
          ON CONFLICT (position_id) DO NOTHING;
        ELSIF TG_OP = 'UPDATE' THEN
          UPDATE sections 
          SET name = NEW.name, 
              space_id = var_space_id,
              parent_section_id = var_parent_section_id,
              status = NEW.status
          WHERE position_id = NEW.id;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await pool.query(`
      DROP TRIGGER IF EXISTS trg_sync_section_from_position ON positions;
      CREATE TRIGGER trg_sync_section_from_position
      AFTER INSERT OR UPDATE ON positions
      FOR EACH ROW EXECUTE FUNCTION sync_section_from_position();
    `);

    // Demo records are opt-in so a new iCore environment starts as an empty scaffold.
    if (shouldSeedDemoData) {
      const deptCheck = await pool.query('SELECT COUNT(*) FROM departments');
      if (parseInt(deptCheck.rows[0].count, 10) === 0) {
        console.log('Seeding MVP Demo Organizational Structure and Accounts...');
      
      // 1. Departments
      const depts = [
        [1, 'Коммерческий отдел', 'Продажи и обслуживание клиентов'],
        [2, 'IT-отдел', 'Информационные технологии'],
        [3, 'Бухгалтерия', 'Бухгалтерский учет и финансы'],
        [4, 'HR', 'Управление персоналом'],
        [5, 'Общий отдел', 'Общекорпоративные регламенты и инструкции']
      ];
      for (const [id, name, desc] of depts) {
        await pool.query('INSERT INTO departments (id, name, description) VALUES ($1, $2, $3)', [id, name, desc]);
      }

      // 2. Positions
      const positions = [
        [1, 'Коммерческий директор', 1, null, 1],
        [2, 'Руководитель группы', 1, 1, 2],
        [3, 'Супервайзер', 1, 2, 3],
        [4, 'Оператор', 1, 3, 4],
        [5, 'IT-специалист', 2, null, 1],
        [6, 'Бухгалтер', 3, null, 1],
        [7, 'HR-менеджер', 4, null, 1],
        [8, 'Общий сотрудник', 5, null, 1]
      ];
      for (const [id, name, deptId, parentPosId, level] of positions) {
        await pool.query('INSERT INTO positions (id, name, department_id, parent_position_id, hierarchy_level) VALUES ($1, $2, $3, $4, $5)', [id, name, deptId, parentPosId, level]);
      }

      // 3. Employees
      const employees = [
        [1, 'Хайрихан Шерзад (Коммерческий директор)', 'dir_comm@icore.ru', 1, 1, null],
        [2, 'Иван Петров (Руководитель группы)', 'lead_group@icore.ru', 2, 1, 1],
        [3, 'Анна Сидорова (Супервайзер)', 'supervisor@icore.ru', 3, 1, 2],
        [4, 'Сергей Васильев (Оператор)', 'operator@icore.ru', 4, 1, 3],
        [5, 'Алексей Смирнов (IT-специалист)', 'sysadmin@icore.ru', 5, 2, null],
        [6, 'Ольга Кузнецова (Бухгалтер)', 'accountant@icore.ru', 6, 3, null],
        [7, 'Мария Иванова (HR-менеджер)', 'hr_manager@icore.ru', 7, 4, null]
      ];
      for (const [id, name, email, posId, deptId, managerId] of employees) {
        await pool.query('INSERT INTO employees (id, full_name, email, position_id, department_id, manager_id) VALUES ($1, $2, $3, $4, $5, $6)', [id, name, email, posId, deptId, managerId]);
      }

      // 4. Create User Accounts (password hash for: 'iCorePass2026')
      const passHash = '$2b$10$L2Wsx716QB3pBnyjmZ/iTOEckyRfPT40JI1UOihEnNhcequpJAZGm';
      const users = [
        ['dir_comm', 'dir_comm@icore.ru', 'Хайрихан Шерзад', 'Коммерческий директор', 1],
        ['lead_group', 'lead_group@icore.ru', 'Иван Петров', 'Руководитель группы', 2],
        ['supervisor', 'supervisor@icore.ru', 'Анна Сидорова', 'Супервайзер', 3],
        ['operator', 'operator@icore.ru', 'Сергей Васильев', 'Оператор', 4],
        ['sysadmin', 'sysadmin@icore.ru', 'Алексей Смирнов', 'IT-специалист', 5],
        ['accountant', 'accountant@icore.ru', 'Ольга Кузнецова', 'Бухгалтер', 6],
        ['hr_manager', 'hr_manager@icore.ru', 'Мария Иванова', 'HR-менеджер', 7]
      ];
      for (const [username, email, name, role, empId] of users) {
        await pool.query('INSERT INTO users (username, password_hash, name, role, employee_id) VALUES ($1, $2, $3, $4, $5)', [username, passHash, name, role, empId]);
      }

      // 5. Seed Demo Articles & ArticleSections
      const demoArticles = [
        // Коммерческий директор
        [1, 'Должностная инструкция Коммерческого директора', 'dolzhnostnaya-instrukciya-kommercheskogo-direktora', 'Должностная инструкция коммерческого директора', '<p>Это должностная инструкция коммерческого директора.</p><ul><li>Стратегическое планирование</li><li>Контроль KPI</li></ul>', 1],
        [2, 'Стратегия коммерческого отдела', 'strategiya-kommercheskogo-otdela', 'Стратегический план развития продаж', '<p>Стратегия развития коммерческого отдела компании на 2026 год.</p>', 1],
        [3, 'KPI коммерческого отдела', 'kpi-kommercheskogo-otdela', 'Показатели эффективности работы', '<p>Ключевые показатели эффективности (KPI) сотрудников коммерческого отдела.</p>', 1],
        [4, 'Каналы коммуникации коммерческого отдела', 'kanaly-kommunikacii-kommercheskogo-otdela', 'Связь и каналы взаимодействия', '<p>Официальные каналы связи для общения внутри коммерческого отдела.</p>', 1],
        [5, 'Работа с подрядчиками', 'rabota-s-podryadchikami', 'Регламент работы с внешними контрагентами', '<p>Инструкция по взаимодействию с аутсорсинговыми партнерами.</p>', 1],

        // Руководитель группы
        [6, 'Должностная инструкция Руководителя группы', 'dolzhnostnaya-instrukciya-rukovoditelya-gruppy', 'Должностная инструкция лидера группы', '<p>Обязанности и права руководителя группы.</p>', 2],
        [7, 'Управление командой', 'upravlenie-komandoj', 'Методология работы с персоналом', '<p>Как правильно выстраивать работу в команде и мотивировать сотрудников.</p>', 2],
        [8, 'Система грейдирования', 'sistema-grejdirovaniya', 'Сетка должностных окладов и карьерного роста', '<p>Описание уровней квалификации (грейдов) и условий повышения.</p>', 2],
        [9, 'Обучение новых сотрудников', 'obuchenie-novyh-sotrudnikov', 'План адаптации новичков', '<p>Инструкция по вводу новых специалистов в должность.</p>', 2],

        // Супервайзер
        [10, 'Должностная инструкция Супервайзера', 'dolzhnostnaya-instrukciya-supervajzera', 'Обязанности супервайзера', '<p>Обязанности по контролю смены и качества работы операторов.</p>', 3],
        [11, 'Прослушка и оценка звонков', 'proslushka-i-ocenka-zvonkov', 'Регламент прослушивания разговоров', '<p>Критерии оценки диалогов операторов с клиентами.</p>', 3],
        [12, 'Постановка задач операторам', 'postanovka-zadach-operatoram', 'Организация сменного расписания', '<p>Порядок распределения нагрузки и задач на смене.</p>', 3],
        [13, 'Отчётность супервайзера', 'otchyotnost-supervajzera', 'Шаблоны отчетов о работе смены', '<p>Инструкция по заполнению ежедневной отчетности.</p>', 3],

        // Оператор
        [14, 'Должностная инструкция Оператора', 'dolzhnostnaya-instrukciya-operatora', 'Обязанности оператора колл-центра', '<p>Должностная инструкция оператора контакт-центра.</p>', 4],
        [15, 'Скрипты звонков', 'skripty-zvonkov', 'Скрипты входящих и исходящих линий', '<p>Шаблоны приветствия и ответы на частые вопросы клиентов.</p>', 4],
        [16, 'Работа в CRM', 'rabota-v-crm', 'Инструкция по использованию системы', '<p>Как открывать карточки клиентов и вести статусы сделок.</p>', 4],
        [17, 'Оформление заявки', 'oformlenie-zayavki', 'Порядок заполнения данных клиента', '<p>Инструкция по корректному заведению заявок в системе.</p>', 4],

        // Системный администратор
        [18, 'Должностная инструкция Системного администратора', 'dolzhnostnaya-instrukciya-sistemnogo-administratora', 'Обязанности сисадмина', '<p>Регламент технического обслуживания серверов и рабочих станций.</p>', 5],
        [19, 'Управление инфраструктурой', 'upravlenie-infrastrukturoj', 'Администрирование локальной сети', '<p>Схема сетевой инфраструктуры офиса и правила доступа.</p>', 5],
        [20, 'Информационная безопасность', 'informacionnaya-bezopasnost', 'Политика паролей и доступов', '<p>Инструкция по обеспечению безопасности данных.</p>', 5],

        // Бухгалтер
        [21, 'Должностная инструкция Бухгалтера', 'dolzhnostnaya-instrukciya-buhgaltera', 'Регламент работы бухгалтера', '<p>Права и обязанности бухгалтера по расчету зарплаты и налогов.</p>', 6],
        [22, 'Работа в 1С', 'rabota-v-1s', 'Инструкция по работе с конфигурацией', '<p>Порядок проведения платежей и выписки счетов.</p>', 6],
        [23, 'Расчёт зарплаты', 'raschyot-zarplaty', 'Методика начисления заработной платы', '<p>Формула расчета окладов, премий и больничных листов.</p>', 6],
        [24, 'Закрытие периода', 'zakrytie-perioda', 'Сдача отчетности', '<p>Порядок действий бухгалтерии в конце отчетного квартала.</p>', 6],

        // HR-менеджер
        [25, 'Должностная инструкция HR-менеджера', 'dolzhnostnaya-instrukciya-hr-menedzhera', 'Обязанности HR', '<p>Должностная инструкция HR-менеджера по поиску и найму персонала.</p>', 7],
        [26, 'Онбординг новых сотрудников', 'onbordign-novyh-sotrudnikov', 'Адаптационная программа', '<p>HR-регламент по ведению первого рабочего дня новичка.</p>', 7],

        // Общие корпоративные и технические статьи (привязаны к общей секции 8)
        [27, 'Правила внутреннего распорядка', 'pravila-vnutrennego-rasporyadka', 'Регламент рабочего дня компании', '<p>Официальные часы работы, регламент перерывов и праздничные дни.</p>', 8],
        [28, 'Оформление отпуска и больничных', 'oformlenie-otpuska-i-bolnichnyh', 'Как уйти в отпуск или на больничный', '<p>Инструкция по заполнению заявлений и согласованию дней отдыха.</p>', 8],
        [29, 'Инструкция по настройке VPN', 'instrukciya-po-nastrojke-vpn', 'Удаленный доступ к ресурсам', '<p>Инструкция по установке и авторизации в корпоративном VPN.</p>', 8],
        [30, 'Настройка почтового клиента', 'nastrojka-pochtovogo-klienta', 'Корпоративная электронная почта', '<p>Инструкция по конфигурации почтовых клиентов Outlook / Thunderbird.</p>', 8]
      ];

      for (const [rawId, title, slug, summary, content, sectionId] of demoArticles) {
        const id = (rawId as number) + 1000;
        // Create article
        await pool.query(
          `INSERT INTO articles (id, title, slug, summary, content, published, is_visible, status) 
           VALUES ($1, $2, $3, $4, $5, true, true, 'published')
           ON CONFLICT (id) DO NOTHING`,
          [id, title, slug, summary, content]
        );
        // Link to section
        await pool.query(
          `INSERT INTO article_sections (article_id, section_id) 
           VALUES ($1, $2)
           ON CONFLICT (article_id, section_id) DO NOTHING`,
          [id, sectionId]
        );
      }
      
      // Sync sequences
      await pool.query("SELECT setval('departments_id_seq', (SELECT MAX(id) FROM departments))");
      await pool.query("SELECT setval('positions_id_seq', (SELECT MAX(id) FROM positions))");
      await pool.query("SELECT setval('employees_id_seq', (SELECT MAX(id) FROM employees))");
      await pool.query("SELECT setval('spaces_id_seq', (SELECT MAX(id) FROM spaces))");
      await pool.query("SELECT setval('sections_id_seq', (SELECT MAX(id) FROM sections))");
      await pool.query("SELECT setval('articles_id_seq', (SELECT MAX(id) FROM articles))");
      }
    } else {
      console.log('Demo data seeding is disabled. Set SEED_DEMO_DATA=true to enable it.');
    }

    // Apply Stage 1 Extended migrations
    console.log('Running Stage 1 Extended migrations...');
    await pool.query(`
      ALTER TABLE departments ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Active';
      
      ALTER TABLE articles ADD COLUMN IF NOT EXISTS article_type VARCHAR(50) DEFAULT 'general';
      ALTER TABLE articles ADD COLUMN IF NOT EXISTS owner_id INT REFERENCES users(id) ON DELETE SET NULL;
      ALTER TABLE articles ADD COLUMN IF NOT EXISTS approver_id INT REFERENCES users(id) ON DELETE SET NULL;
      
      ALTER TABLE sections ADD COLUMN IF NOT EXISTS owner_id INT REFERENCES users(id) ON DELETE SET NULL;
    `);

    // Safe adjustment of section position_id foreign key constraint to ON DELETE SET NULL
    await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 
          FROM information_schema.table_constraints 
          WHERE constraint_name = 'sections_position_id_fkey' 
            AND table_name = 'sections'
        ) THEN
          ALTER TABLE sections DROP CONSTRAINT sections_position_id_fkey;
        END IF;
      END $$;
      
      ALTER TABLE sections ADD CONSTRAINT sections_position_id_fkey 
      FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE SET NULL;
    `);

    // Create article_links
    await pool.query(`
      CREATE TABLE IF NOT EXISTS article_links (
        id SERIAL PRIMARY KEY,
        source_article_id INT REFERENCES articles(id) ON DELETE CASCADE,
        target_article_id INT REFERENCES articles(id) ON DELETE CASCADE,
        link_text VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(source_article_id, target_article_id)
      );
    `);

    // Create guest_access
    await pool.query(`
      CREATE TABLE IF NOT EXISTS guest_access (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        article_id INT REFERENCES articles(id) ON DELETE CASCADE,
        section_id INT REFERENCES sections(id) ON DELETE CASCADE,
        granted_by INT REFERENCES users(id) ON DELETE SET NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(50) DEFAULT 'Active'
      );
    `);

    // Role-based access model for Wiki 2.0
    console.log('Ensuring Wiki access control tables exist...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS wiki_roles (
        id SERIAL PRIMARY KEY,
        code VARCHAR(80) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        can_read BOOLEAN DEFAULT false,
        can_create BOOLEAN DEFAULT false,
        can_edit BOOLEAN DEFAULT false,
        can_publish BOOLEAN DEFAULT false,
        can_approve BOOLEAN DEFAULT false,
        can_manage_users BOOLEAN DEFAULT false,
        can_manage_structure BOOLEAN DEFAULT false,
        can_manage_access BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_wiki_roles (
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        wiki_role_id INT REFERENCES wiki_roles(id) ON DELETE CASCADE,
        assigned_by INT REFERENCES users(id) ON DELETE SET NULL,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, wiki_role_id)
      );
    `);

    await pool.query(`
      ALTER TABLE sections
      ADD COLUMN IF NOT EXISTS visibility_scope VARCHAR(50) DEFAULT 'restricted';
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS section_access_rules (
        id SERIAL PRIMARY KEY,
        section_id INT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
        position_id INT REFERENCES positions(id) ON DELETE CASCADE,
        department_id INT REFERENCES departments(id) ON DELETE CASCADE,
        wiki_role_id INT REFERENCES wiki_roles(id) ON DELETE CASCADE,
        access_level VARCHAR(50) DEFAULT 'read',
        can_read BOOLEAN DEFAULT true,
        can_create BOOLEAN DEFAULT false,
        can_edit BOOLEAN DEFAULT false,
        can_publish BOOLEAN DEFAULT false,
        can_approve BOOLEAN DEFAULT false,
        grant_subsections BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CHECK (position_id IS NOT NULL OR department_id IS NOT NULL OR wiki_role_id IS NOT NULL)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS access_audit_logs (
        id SERIAL PRIMARY KEY,
        actor_user_id INT REFERENCES users(id) ON DELETE SET NULL,
        target_user_id INT REFERENCES users(id) ON DELETE SET NULL,
        section_id INT REFERENCES sections(id) ON DELETE SET NULL,
        action VARCHAR(100) NOT NULL,
        old_value JSONB,
        new_value JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query('CREATE INDEX IF NOT EXISTS idx_user_wiki_roles_user ON user_wiki_roles(user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_user_wiki_roles_role ON user_wiki_roles(wiki_role_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_section_access_rules_section ON section_access_rules(section_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_section_access_rules_position ON section_access_rules(position_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_section_access_rules_department ON section_access_rules(department_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_section_access_rules_role ON section_access_rules(wiki_role_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_sections_visibility_scope ON sections(visibility_scope)');
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_section_access_rules_unique_position
      ON section_access_rules(section_id, position_id)
      WHERE position_id IS NOT NULL AND department_id IS NULL AND wiki_role_id IS NULL;
    `);
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_section_access_rules_unique_department
      ON section_access_rules(section_id, department_id)
      WHERE department_id IS NOT NULL AND position_id IS NULL AND wiki_role_id IS NULL;
    `);
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_section_access_rules_unique_wiki_role
      ON section_access_rules(section_id, wiki_role_id)
      WHERE wiki_role_id IS NOT NULL AND position_id IS NULL AND department_id IS NULL;
    `);

    const defaultWikiRoles = [
      ['reader', 'Читатель', 'Просмотр опубликованных статей в доступных разделах.', true, false, false, false, false, false, false, false],
      ['editor', 'Редактор', 'Создание и редактирование статей в доступных разделах.', true, true, true, false, false, false, false, false],
      ['process_owner', 'Владелец бизнес-процесса', 'Ответственный за актуальность процесса и публикацию материалов.', true, true, true, true, false, false, false, false],
      ['approver', 'Согласователь', 'Проверка и утверждение статей перед публикацией.', true, false, true, true, true, false, false, false],
      ['wiki_admin', 'Администратор Wiki', 'Полное управление структурой, пользователями, ролями и доступом.', true, true, true, true, true, true, true, true]
    ];

    for (const role of defaultWikiRoles) {
      await pool.query(
        `INSERT INTO wiki_roles (
           code, name, description,
           can_read, can_create, can_edit, can_publish, can_approve,
           can_manage_users, can_manage_structure, can_manage_access
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (code) DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           can_read = EXCLUDED.can_read,
           can_create = EXCLUDED.can_create,
           can_edit = EXCLUDED.can_edit,
           can_publish = EXCLUDED.can_publish,
           can_approve = EXCLUDED.can_approve,
           can_manage_users = EXCLUDED.can_manage_users,
           can_manage_structure = EXCLUDED.can_manage_structure,
           can_manage_access = EXCLUDED.can_manage_access,
           updated_at = CURRENT_TIMESTAMP`,
        role
      );
    }

    // Create trigger for position delete to archive section
    await pool.query(`
      CREATE OR REPLACE FUNCTION archive_section_on_delete_position() RETURNS TRIGGER AS $$
      BEGIN
        UPDATE sections SET status = 'Archived', position_id = NULL WHERE position_id = OLD.id;
        RETURN OLD;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await pool.query(`
      DROP TRIGGER IF EXISTS trg_archive_section_on_delete_position ON positions;
      CREATE TRIGGER trg_archive_section_on_delete_position
      BEFORE DELETE ON positions
      FOR EACH ROW EXECUTE FUNCTION archive_section_on_delete_position();
    `);

    // Sync sequences automatically to avoid "duplicate key value violates unique constraint" errors after migrations
    console.log('Synchronizing auto-increment database sequences...');
    await pool.query(`
      DO $$
      DECLARE
          r RECORD;
          max_id INT;
          seq_name TEXT;
      BEGIN
          FOR r IN 
              SELECT table_name, column_name
              FROM information_schema.columns 
              WHERE table_schema = 'public' 
                AND column_default LIKE 'nextval(%'
          LOOP
              seq_name := pg_get_serial_sequence(r.table_name, r.column_name);
              IF seq_name IS NOT NULL THEN
                  EXECUTE format('SELECT COALESCE(MAX(%I), 0) FROM %I', r.column_name, r.table_name) INTO max_id;
                  IF max_id > 0 THEN
                      EXECUTE format('SELECT setval(%L, %s, true)', seq_name, max_id);
                  ELSE
                      EXECUTE format('SELECT setval(%L, 1, false)', seq_name);
                  END IF;
              END IF;
          END LOOP;
      END $$;
    `);

    console.log('Database tables and indexes verified/created successfully.');
  } catch (error) {
    console.error('Failed to initialize database tables:', error);
  }
};
