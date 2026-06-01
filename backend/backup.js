const { Client } = require('pg');
const fs = require('fs');

const connectionString = "postgresql://wiki_user:6D85X3xNxYCLIgKr9obYr3zbSPsXE5NE@dpg-d8cl986q1p3s73bhpnig-a.oregon-postgres.render.com/wiki_db_c304";

async function run() {
  const client = new Client({ 
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  console.log("Connected to PostgreSQL database for backup...");

  const data = {};

  // Fetch users
  console.log("Backing up 'users'...");
  const usersRes = await client.query("SELECT * FROM users ORDER BY id ASC");
  data.users = usersRes.rows;

  // Fetch categories
  console.log("Backing up 'categories'...");
  const categoriesRes = await client.query("SELECT * FROM categories ORDER BY id ASC");
  data.categories = categoriesRes.rows;

  // Fetch articles
  console.log("Backing up 'articles'...");
  const articlesRes = await client.query("SELECT * FROM articles ORDER BY id ASC");
  data.articles = articlesRes.rows;

  // Fetch article_tags
  console.log("Backing up 'article_tags'...");
  const tagsRes = await client.query("SELECT * FROM article_tags");
  data.article_tags = tagsRes.rows;

  // Fetch user_favorite_articles
  console.log("Backing up 'user_favorite_articles'...");
  const favsRes = await client.query("SELECT * FROM user_favorite_articles");
  data.user_favorite_articles = favsRes.rows;

  // Fetch user_audit_logs
  console.log("Backing up 'user_audit_logs'...");
  const logsRes = await client.query("SELECT * FROM user_audit_logs ORDER BY id ASC");
  data.user_audit_logs = logsRes.rows;

  await client.end();

  fs.writeFileSync('wiki_db_backup.json', JSON.stringify(data, null, 2));
  console.log("Backup complete! Saved to 'wiki_db_backup.json' with:");
  console.log(`- ${data.users.length} users`);
  console.log(`- ${data.categories.length} categories`);
  console.log(`- ${data.articles.length} articles`);
  console.log(`- ${data.article_tags.length} tags`);
  console.log(`- ${data.user_favorite_articles.length} favorites`);
  console.log(`- ${data.user_audit_logs.length} logs`);
}

run().catch(err => {
  console.error("Backup failed:", err);
  process.exit(1);
});
