import { query, pool } from '../config/db';

export interface Article {
  id: number;
  title: string;
  slug: string;
  content: string;
  summary: string;
  category_id: number | null;
  author_id: number | null;
  category_name?: string;
  category_slug?: string;
  published: boolean;
  views: number;
  position: number;
  created_at: Date;
  updated_at: Date;
  tags: string[];
}

export const getAllArticles = async (options: {
  publishedOnly?: boolean;
  categorySlug?: string;
  tag?: string;
} = {}): Promise<Article[]> => {
  const params: any[] = [];
  let paramIndex = 1;

  let sql = `
    SELECT a.*, c.name as category_name, c.slug as category_slug,
           COALESCE(array_agg(t.tag_name) FILTER (WHERE t.tag_name IS NOT NULL), '{}') as tags
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    LEFT JOIN article_tags t ON a.id = t.article_id
  `;

  const whereClauses: string[] = [];

  if (options.publishedOnly !== false) {
    whereClauses.push(`a.published = true`);
  }

  if (options.categorySlug) {
    whereClauses.push(`c.slug = $${paramIndex++}`);
    params.push(options.categorySlug);
  }

  sql += ` GROUP BY a.id, c.name, c.slug`;

  if (whereClauses.length > 0) {
    // We need to inject WHERE before GROUP BY in SQL, so let's adjust the query construct
    sql = `
      SELECT a.*, c.name as category_name, c.slug as category_slug,
             COALESCE(array_agg(t.tag_name) FILTER (WHERE t.tag_name IS NOT NULL), '{}') as tags
      FROM articles a
      LEFT JOIN categories c ON a.category_id = c.id
      LEFT JOIN article_tags t ON a.id = t.article_id
      WHERE ${whereClauses.join(' AND ')}
      GROUP BY a.id, c.name, c.slug
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
    SELECT a.*, c.name as category_name, c.slug as category_slug,
           COALESCE(array_agg(t.tag_name) FILTER (WHERE t.tag_name IS NOT NULL), '{}') as tags
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    LEFT JOIN article_tags t ON a.id = t.article_id
    WHERE a.id = $1
    GROUP BY a.id, c.name, c.slug
  `;
  const res = await query(sql, [id]);
  return res.rows.length ? res.rows[0] : null;
};

export const getArticleBySlug = async (slug: string): Promise<Article | null> => {
  const sql = `
    SELECT a.*, c.name as category_name, c.slug as category_slug,
           COALESCE(array_agg(t.tag_name) FILTER (WHERE t.tag_name IS NOT NULL), '{}') as tags
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    LEFT JOIN article_tags t ON a.id = t.article_id
    WHERE a.slug = $1
    GROUP BY a.id, c.name, c.slug
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
  tags: string[];
  position?: number;
}): Promise<Article> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Insert Article
    const artSql = `
      INSERT INTO articles (title, slug, content, summary, category_id, author_id, published, position)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
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
    tags: string[];
    position?: number;
  }
): Promise<Article | null> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Update Article
    const artSql = `
      UPDATE articles
      SET title = $1, slug = $2, content = $3, summary = $4, category_id = $5, published = $6, position = $7, updated_at = NOW()
      WHERE id = $8
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
