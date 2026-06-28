import { query, pool } from '../config/db';

export interface NewsImage {
  id: number;
  news_id: number;
  image_url: string;
  position: number;
  created_at: Date;
}

export interface NewsAttachment {
  id: number;
  news_id: number;
  file_url: string;
  file_name: string;
  file_size: number;
  created_at: Date;
}

export interface News {
  id: number;
  title: string;
  description: string;
  content: string;
  video_url?: string | null;
  is_published: boolean;
  is_pinned: boolean;
  author_id: number | null;
  author_name?: string;
  published_at: Date;
  created_at: Date;
  updated_at: Date;
  tags: string[];
  images: string[];
  attachments: Omit<NewsAttachment, 'news_id'>[];
  department_ids: number[];
  department_names: string[];
  is_read?: boolean;
}

const normalizeDepartmentIds = (ids: unknown): number[] => {
  if (!Array.isArray(ids)) return [];

  return Array.from(
    new Set(
      ids
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)
    )
  );
};

const normalizeNewsRow = (row: any): News => ({
  ...row,
  department_ids: normalizeDepartmentIds(row.department_ids),
  department_names: Array.isArray(row.department_names)
    ? row.department_names.filter((name: unknown) => typeof name === 'string' && name.trim().length > 0)
    : [],
});

const insertNewsDepartments = async (client: any, newsId: number, departmentIds: number[]) => {
  const ids = normalizeDepartmentIds(departmentIds);
  if (ids.length === 0) return;

  const values = ids.map((_, index) => `($1, $${index + 2})`).join(', ');
  await client.query(
    `INSERT INTO news_departments (news_id, department_id) VALUES ${values} ON CONFLICT DO NOTHING`,
    [newsId, ...ids]
  );
};

export const getAllNews = async (options: {
  publishedOnly?: boolean;
  userId?: number;
} = {}): Promise<News[]> => {
  const params: any[] = [];
  let paramIndex = 1;
  const whereClauses: string[] = [];

  if (options.publishedOnly !== false) {
    whereClauses.push(`n.is_published = true AND n.published_at <= NOW()`);
  }

  let userSelect = 'FALSE as is_read';
  let joinReadStatus = '';
  if (options.userId) {
    userSelect = `COALESCE(rs.is_read, FALSE) as is_read`;
    joinReadStatus = `LEFT JOIN news_read_status rs ON n.id = rs.news_id AND rs.user_id = $${paramIndex++}`;
    params.push(options.userId);
  }

  if (options.userId && options.publishedOnly !== false) {
    const audienceUserParam = paramIndex++;
    params.push(options.userId);
    whereClauses.push(`(
      NOT EXISTS (
        SELECT 1 FROM news_departments nd_all
        WHERE nd_all.news_id = n.id
      )
      OR EXISTS (
        SELECT 1
        FROM news_departments nd_allowed
        JOIN users audience_user ON audience_user.id = $${audienceUserParam}
        JOIN employees audience_employee ON audience_employee.id = audience_user.employee_id
        WHERE nd_allowed.news_id = n.id
          AND nd_allowed.department_id = audience_employee.department_id
      )
    )`);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const sql = `
    SELECT n.*, u.name as author_name, ${userSelect},
           COALESCE(array_agg(DISTINCT t.tag_name) FILTER (WHERE t.tag_name IS NOT NULL), '{}') as tags,
           COALESCE(array_agg(DISTINCT img.image_url) FILTER (WHERE img.image_url IS NOT NULL), '{}') as images,
           COALESCE(array_agg(DISTINCT nd.department_id) FILTER (WHERE nd.department_id IS NOT NULL), '{}') as department_ids,
           COALESCE(array_agg(DISTINCT d.name) FILTER (WHERE d.name IS NOT NULL), '{}') as department_names
    FROM news n
    LEFT JOIN users u ON n.author_id = u.id
    ${joinReadStatus}
    LEFT JOIN news_tags t ON n.id = t.news_id
    LEFT JOIN news_images img ON n.id = img.news_id
    LEFT JOIN news_departments nd ON n.id = nd.news_id
    LEFT JOIN departments d ON d.id = nd.department_id
    ${whereSql}
    GROUP BY n.id, u.name ${options.userId ? ', rs.is_read' : ''}
    ORDER BY n.is_pinned DESC, n.published_at DESC, n.created_at DESC
  `;

  const res = await query(sql, params);
  const newsList = res.rows.map(normalizeNewsRow) as any[];

  // For attachments, we can make a separate batch query to populate them efficiently
  if (newsList.length > 0) {
    const newsIds = newsList.map(n => n.id);
    const attachRes = await query(
      `SELECT id, news_id, file_url, file_name, file_size, created_at FROM news_attachments WHERE news_id = ANY($1)`,
      [newsIds]
    );
    const attachmentsMap: Record<number, any[]> = {};
    attachRes.rows.forEach(att => {
      if (!attachmentsMap[att.news_id]) {
        attachmentsMap[att.news_id] = [];
      }
      attachmentsMap[att.news_id].push({
        id: att.id,
        file_url: att.file_url,
        file_name: att.file_name,
        file_size: att.file_size,
        created_at: att.created_at
      });
    });

    newsList.forEach(n => {
      n.attachments = attachmentsMap[n.id] || [];
    });
  }

  return newsList;
};

export const getNewsById = async (id: number, userId?: number): Promise<News | null> => {
  let userSelect = 'FALSE as is_read';
  let joinReadStatus = '';
  const params = [id];

  if (userId) {
    userSelect = `COALESCE(rs.is_read, FALSE) as is_read`;
    joinReadStatus = `LEFT JOIN news_read_status rs ON n.id = rs.news_id AND rs.user_id = $2`;
    params.push(userId);
  }

  const sql = `
    SELECT n.*, u.name as author_name, ${userSelect},
           COALESCE(array_agg(DISTINCT t.tag_name) FILTER (WHERE t.tag_name IS NOT NULL), '{}') as tags,
           COALESCE(array_agg(DISTINCT nd.department_id) FILTER (WHERE nd.department_id IS NOT NULL), '{}') as department_ids,
           COALESCE(array_agg(DISTINCT d.name) FILTER (WHERE d.name IS NOT NULL), '{}') as department_names
    FROM news n
    LEFT JOIN users u ON n.author_id = u.id
    ${joinReadStatus}
    LEFT JOIN news_tags t ON n.id = t.news_id
    LEFT JOIN news_departments nd ON n.id = nd.news_id
    LEFT JOIN departments d ON d.id = nd.department_id
    WHERE n.id = $1
    GROUP BY n.id, u.name ${userId ? ', rs.is_read' : ''}
  `;

  const res = await query(sql, params);
  if (res.rows.length === 0) return null;
  const news = normalizeNewsRow(res.rows[0]) as any;

  // Retrieve gallery images ordered by position
  const imgRes = await query(
    `SELECT id, image_url, position, created_at FROM news_images WHERE news_id = $1 ORDER BY position ASC`,
    [id]
  );
  news.images = imgRes.rows.map(img => img.image_url);

  // Retrieve attachments
  const attachRes = await query(
    `SELECT id, file_url, file_name, file_size, created_at FROM news_attachments WHERE news_id = $1 ORDER BY created_at ASC`,
    [id]
  );
  news.attachments = attachRes.rows;

  return news;
};

export const canUserAccessNews = async (news: Pick<News, 'department_ids'>, userId: number): Promise<boolean> => {
  const targetDepartmentIds = normalizeDepartmentIds(news.department_ids);
  if (targetDepartmentIds.length === 0) return true;

  const res = await query(
    `SELECT e.department_id
     FROM users u
     JOIN employees e ON e.id = u.employee_id
     WHERE u.id = $1`,
    [userId]
  );

  const userDepartmentId = Number(res.rows[0]?.department_id);
  return Number.isInteger(userDepartmentId) && targetDepartmentIds.includes(userDepartmentId);
};

export const getUnreadNewsCount = async (userId: number): Promise<number> => {
  const sql = `
    SELECT COUNT(*) as count 
    FROM news n
    WHERE n.is_published = true 
      AND n.published_at <= NOW()
      AND NOT EXISTS (
        SELECT 1 FROM news_read_status rs 
        WHERE rs.news_id = n.id AND rs.user_id = $1 AND rs.is_read = true
      )
      AND (
        NOT EXISTS (
          SELECT 1 FROM news_departments nd_all
          WHERE nd_all.news_id = n.id
        )
        OR EXISTS (
          SELECT 1
          FROM news_departments nd_allowed
          JOIN users audience_user ON audience_user.id = $1
          JOIN employees audience_employee ON audience_employee.id = audience_user.employee_id
          WHERE nd_allowed.news_id = n.id
            AND nd_allowed.department_id = audience_employee.department_id
        )
      )
  `;
  const res = await query(sql, [userId]);
  return Number(res.rows[0].count);
};

export const markNewsAsRead = async (newsId: number, userId: number): Promise<void> => {
  const sql = `
    INSERT INTO news_read_status (news_id, user_id, is_read, read_at)
    VALUES ($1, $2, TRUE, NOW())
    ON CONFLICT (news_id, user_id) 
    DO UPDATE SET is_read = TRUE, read_at = NOW()
  `;
  await query(sql, [newsId, userId]);
};

export const recordNewsView = async (newsId: number, userId: number): Promise<void> => {
  const sql = `
    INSERT INTO news_views (news_id, user_id)
    VALUES ($1, $2)
  `;
  await query(sql, [newsId, userId]);
};

export const createNews = async (data: {
  title: string;
  description: string;
  content: string;
  video_url?: string | null;
  is_published: boolean;
  is_pinned: boolean;
  author_id: number;
  published_at?: Date;
  tags: string[];
  images: string[];
  attachments: { file_url: string; file_name: string; file_size: number }[];
  department_ids?: number[];
}): Promise<News> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insert News
    const newsSql = `
      INSERT INTO news (title, description, content, video_url, is_published, is_pinned, author_id, published_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const newsRes = await client.query(newsSql, [
      data.title,
      data.description || '',
      data.content,
      data.video_url || null,
      data.is_published,
      data.is_pinned,
      data.author_id,
      data.published_at || new Date(),
    ]);
    const news = newsRes.rows[0];
    await insertNewsDepartments(client, news.id, data.department_ids || []);

    // Insert Tags
    if (data.tags && data.tags.length > 0) {
      const tagSql = `
        INSERT INTO news_tags (news_id, tag_name)
        VALUES ${data.tags.map((_, i) => `($1, $${i + 2})`).join(', ')}
      `;
      await client.query(tagSql, [news.id, ...data.tags]);
    }

    // Insert Gallery Images
    if (data.images && data.images.length > 0) {
      const imageSql = `
        INSERT INTO news_images (news_id, image_url, position)
        VALUES ${data.images.map((_, i) => `($1, $${i + 2}, ${i})`).join(', ')}
      `;
      await client.query(imageSql, [news.id, ...data.images]);
    }

    // Insert Attachments
    if (data.attachments && data.attachments.length > 0) {
      for (const att of data.attachments) {
        await client.query(
          `INSERT INTO news_attachments (news_id, file_url, file_name, file_size) VALUES ($1, $2, $3, $4)`,
          [news.id, att.file_url, att.file_name, att.file_size]
        );
      }
    }

    await client.query('COMMIT');

    const fullNews = await getNewsById(news.id, data.author_id);
    return fullNews!;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const updateNews = async (
  id: number,
  data: {
    title: string;
    description: string;
    content: string;
    video_url?: string | null;
    is_published: boolean;
    is_pinned: boolean;
    published_at?: Date;
    bump_to_top?: boolean;
    tags: string[];
    images: string[];
    attachments: { file_url: string; file_name: string; file_size: number }[];
    department_ids?: number[];
  },
  userId: number
): Promise<News | null> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Update News
    const newsSql = `
      UPDATE news
      SET title = $1,
          description = $2,
          content = $3,
          video_url = $4,
          is_published = $5,
          is_pinned = $6,
          published_at = CASE
            WHEN $7::boolean = true AND $5::boolean = true THEN NOW()
            ELSE $8
          END,
          updated_at = NOW()
      WHERE id = $9
      RETURNING *
    `;
    const newsRes = await client.query(newsSql, [
      data.title,
      data.description || '',
      data.content,
      data.video_url || null,
      data.is_published,
      data.is_pinned,
      !!data.bump_to_top,
      data.published_at || new Date(),
      id,
    ]);

    if (newsRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    // Delete Old Tags, Images, and Attachments
    await client.query('DELETE FROM news_tags WHERE news_id = $1', [id]);
    await client.query('DELETE FROM news_images WHERE news_id = $1', [id]);
    await client.query('DELETE FROM news_attachments WHERE news_id = $1', [id]);
    await client.query('DELETE FROM news_departments WHERE news_id = $1', [id]);
    await insertNewsDepartments(client, id, data.department_ids || []);

    // Insert New Tags
    if (data.tags && data.tags.length > 0) {
      const tagSql = `
        INSERT INTO news_tags (news_id, tag_name)
        VALUES ${data.tags.map((_, i) => `($1, $${i + 2})`).join(', ')}
      `;
      await client.query(tagSql, [id, ...data.tags]);
    }

    // Insert New Gallery Images
    if (data.images && data.images.length > 0) {
      const imageSql = `
        INSERT INTO news_images (news_id, image_url, position)
        VALUES ${data.images.map((_, i) => `($1, $${i + 2}, ${i})`).join(', ')}
      `;
      await client.query(imageSql, [id, ...data.images]);
    }

    // Insert New Attachments
    if (data.attachments && data.attachments.length > 0) {
      for (const att of data.attachments) {
        await client.query(
          `INSERT INTO news_attachments (news_id, file_url, file_name, file_size) VALUES ($1, $2, $3, $4)`,
          [id, att.file_url, att.file_name, att.file_size]
        );
      }
    }

    await client.query('COMMIT');

    const fullNews = await getNewsById(id, userId);
    return fullNews;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const deleteNews = async (id: number): Promise<boolean> => {
  const sql = 'DELETE FROM news WHERE id = $1';
  const res = await query(sql, [id]);
  return (res.rowCount ?? 0) > 0;
};
