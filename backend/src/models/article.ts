import { query, pool } from '../config/db';

export interface Article {
  id: number;
  title: string;
  slug: string;
  content: string;
  summary: string;
  category_id: number | null;
  author_id: number | null;
  author_name?: string;
  published: boolean;
  is_visible: boolean;
  views: number;
  position: number;
  created_at: Date;
  updated_at: Date;
  tags: string[];
  source_url?: string | null;
  sync_interval?: string;
  last_sync_at?: Date | null;
  next_sync_at?: Date | null;
  structured_data?: any | null;
}

export const getAllArticles = async (options: {
  publishedOnly?: boolean;
  tag?: string;
  all?: boolean; // If true, include archived (is_visible=false)
} = {}): Promise<Article[]> => {
  const params: any[] = [];
  let paramIndex = 1;

  let sql = `
    SELECT a.*, u.name as author_name,
           COALESCE(array_agg(t.tag_name) FILTER (WHERE t.tag_name IS NOT NULL), '{}') as tags
    FROM articles a
    LEFT JOIN users u ON a.author_id = u.id
    LEFT JOIN article_tags t ON a.id = t.article_id
  `;

  const whereClauses: string[] = [];

  if (!options.all) {
    whereClauses.push(`a.is_visible = true`);
  }

  if (options.publishedOnly !== false) {
    whereClauses.push(`a.published = true`);
  }

  sql += ` GROUP BY a.id, u.name`;

  if (whereClauses.length > 0) {
    sql = `
      SELECT a.*, u.name as author_name,
             COALESCE(array_agg(t.tag_name) FILTER (WHERE t.tag_name IS NOT NULL), '{}') as tags
      FROM articles a
      LEFT JOIN users u ON a.author_id = u.id
      LEFT JOIN article_tags t ON a.id = t.article_id
      WHERE ${whereClauses.join(' AND ')}
      GROUP BY a.id, u.name
      ORDER BY a.position ASC, a.created_at DESC
    `;
  } else {
    sql += ` ORDER BY a.position ASC, a.created_at DESC`;
  }

  const res = await query(sql, params);
  let articles = res.rows as Article[];
  
  if (options.tag) {
    articles = articles.filter(art => art.tags.includes(options.tag!));
  }
  
  return articles;
};

export const getArticleById = async (id: number): Promise<Article | null> => {
  const sql = `
    SELECT a.*, u.name as author_name,
           COALESCE(array_agg(t.tag_name) FILTER (WHERE t.tag_name IS NOT NULL), '{}') as tags
    FROM articles a
    LEFT JOIN users u ON a.author_id = u.id
    LEFT JOIN article_tags t ON a.id = t.article_id
    WHERE a.id = $1
    GROUP BY a.id, u.name
  `;
  const res = await query(sql, [id]);
  return res.rows.length ? res.rows[0] : null;
};

export const getArticleBySlug = async (slug: string): Promise<Article | null> => {
  const sql = `
    SELECT a.*, u.name as author_name,
           COALESCE(array_agg(t.tag_name) FILTER (WHERE t.tag_name IS NOT NULL), '{}') as tags
    FROM articles a
    LEFT JOIN users u ON a.author_id = u.id
    LEFT JOIN article_tags t ON a.id = t.article_id
    WHERE a.slug = $1
    GROUP BY a.id, u.name
  `;
  const res = await query(sql, [slug]);
  return res.rows.length ? res.rows[0] : null;
};

export const createArticle = async (data: {
  title: string;
  slug: string;
  content: string;
  summary: string;
  category_id: number | null;
  author_id?: number | null;
  published: boolean;
  is_visible?: boolean;
  tags: string[];
  position?: number;
  source_url?: string | null;
  sync_interval?: string;
  structured_data?: any | null;
}): Promise<Article> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Insert Article
    const artSql = `
      INSERT INTO articles (title, slug, content, summary, category_id, author_id, published, position, is_visible, source_url, sync_interval, structured_data)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;
    const artRes = await client.query(artSql, [
      data.title,
      data.slug,
      data.content,
      data.summary,
      data.category_id,
      data.author_id || null,
      data.published,
      data.position || 0,
      data.is_visible !== undefined ? data.is_visible : true,
      data.source_url || null,
      data.sync_interval || 'manual',
      data.structured_data ? JSON.stringify(data.structured_data) : null,
    ]);
    const article = artRes.rows[0];

    // Insert Tags
    if (data.tags && data.tags.length > 0) {
      const tagSql = `
        INSERT INTO article_tags (article_id, tag_name)
        VALUES ${data.tags.map((_, i) => `($1, $${i + 2})`).join(', ')}
      `;
      await client.query(tagSql, [article.id, ...data.tags]);
    }

    await client.query('COMMIT');
    
    // Get full populated article
    const fullArticle = await getArticleById(article.id);
    return fullArticle!;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const updateArticle = async (
  id: number,
  data: {
    title: string;
    slug: string;
    content: string;
    summary: string;
    category_id: number | null;
    published: boolean;
    is_visible?: boolean;
    tags: string[];
    position?: number;
    source_url?: string | null;
    sync_interval?: string;
    structured_data?: any | null;
  }
): Promise<Article | null> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Update Article
    const artSql = `
      UPDATE articles
      SET title = $1, slug = $2, content = $3, summary = $4, category_id = $5, published = $6, position = $7, is_visible = $8, source_url = $9, sync_interval = $10, structured_data = $11, updated_at = NOW()
      WHERE id = $12
      RETURNING *
    `;
    const artRes = await client.query(artSql, [
      data.title,
      data.slug,
      data.content,
      data.summary,
      data.category_id,
      data.published,
      data.position || 0,
      data.is_visible !== undefined ? data.is_visible : true,
      data.source_url || null,
      data.sync_interval || 'manual',
      data.structured_data ? JSON.stringify(data.structured_data) : null,
      id,
    ]);

    if (artRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    // Delete Old Tags
    await client.query('DELETE FROM article_tags WHERE article_id = $1', [id]);

    // Insert New Tags
    if (data.tags && data.tags.length > 0) {
      const tagSql = `
        INSERT INTO article_tags (article_id, tag_name)
        VALUES ${data.tags.map((_, i) => `($1, $${i + 2})`).join(', ')}
      `;
      await client.query(tagSql, [id, ...data.tags]);
    }

    await client.query('COMMIT');
    
    // Get full populated article
    const fullArticle = await getArticleById(id);
    return fullArticle;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const deleteArticle = async (id: number): Promise<boolean> => {
  const sql = 'DELETE FROM articles WHERE id = $1';
  const res = await query(sql, [id]);
  return (res.rowCount ?? 0) > 0;
};

export const incrementArticleViews = async (id: number): Promise<void> => {
  await query('UPDATE articles SET views = views + 1 WHERE id = $1', [id]);
};

export const updateArticlePosition = async (id: number, position: number): Promise<void> => {
  await query('UPDATE articles SET position = $1 WHERE id = $2', [position, id]);
};
