const { Client } = require('pg');
const fs = require('fs');

const connectionString = process.argv[2];

if (!connectionString) {
  console.error("Usage: node restore.js <NEW_DATABASE_CONNECTION_STRING>");
  process.exit(1);
}

const backupDataFile = 'wiki_db_backup.json';
if (!fs.existsSync(backupDataFile)) {
  console.error(`Backup file '${backupDataFile}' not found. Run backup.js first!`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(backupDataFile, 'utf8'));

async function run() {
  const client = new Client({ 
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  console.log("Connected to the new PostgreSQL database for restoring data...");

  // Begin transaction
  await client.query("BEGIN");
  console.log("Started database transaction...");

  try {
    // 1. Clean existing data in reverse order of foreign key dependency
    console.log("Clearing existing data...");
    await client.query("TRUNCATE TABLE user_favorite_articles, article_tags, user_audit_logs, articles, categories, user_sessions, users CASCADE");

    // 2. Insert Users
    console.log(`Restoring ${data.users.length} users...`);
    for (const u of data.users) {
      await client.query(
        "INSERT INTO users (id, username, password_hash, name, role, is_blocked, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        [u.id, u.username, u.password_hash, u.name, u.role, u.is_blocked, u.created_at, u.updated_at]
      );
    }

    // 3. Insert Categories
    console.log(`Restoring ${data.categories.length} categories...`);
    for (const c of data.categories) {
      await client.query(
        "INSERT INTO categories (id, name, slug, icon, description, position) VALUES ($1, $2, $3, $4, $5, $6)",
        [c.id, c.name, c.slug, c.icon, c.description, c.position]
      );
    }

    // 4. Insert Articles
    console.log(`Restoring ${data.articles.length} articles...`);
    for (const a of data.articles) {
      await client.query(
        "INSERT INTO articles (id, title, slug, content, summary, category_id, author_id, published, views, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
        [a.id, a.title, a.slug, a.content, a.summary, a.category_id, a.author_id, a.published, a.views, a.created_at, a.updated_at]
      );
    }

    // 5. Insert Article Tags
    console.log(`Restoring ${data.article_tags.length} article tags...`);
    for (const t of data.article_tags) {
      await client.query(
        "INSERT INTO article_tags (article_id, tag_name) VALUES ($1, $2)",
        [t.article_id, t.tag_name]
      );
    }

    // 6. Insert User Favorites
    console.log(`Restoring ${data.user_favorite_articles.length} user favorites...`);
    for (const f of data.user_favorite_articles) {
      await client.query(
        "INSERT INTO user_favorite_articles (user_id, article_id, position) VALUES ($1, $2, $3)",
        [f.user_id, f.article_id, f.position]
      );
    }

    // 7. Insert Audit Logs
    console.log(`Restoring ${data.user_audit_logs.length} audit logs...`);
    for (const l of data.user_audit_logs) {
      await client.query(
        "INSERT INTO user_audit_logs (id, user_id, changed_by, field_changed, old_value, new_value, changed_at) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [l.id, l.user_id, l.changed_by, l.field_changed, l.old_value, l.new_value, l.changed_at]
      );
    }

    // 8. Reset Serial Sequences to prevent future insertion PK clashes
    const tablesToReset = ['users', 'categories', 'articles', 'user_audit_logs'];
    for (const table of tablesToReset) {
      console.log(`Resetting sequence for table '${table}'...`);
      await client.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM ${table}`);
    }

    await client.query("COMMIT");
    console.log("Transaction committed. Data restore successfully completed!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Restore failed, transaction rolled back:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
