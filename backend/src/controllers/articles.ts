import { Request, Response } from 'express';
import * as fs from 'fs';
import * as ArticleModel from '../models/article';
import * as msService from '../services/meilisearch';
import { parseDocument } from '../services/parser';
import { AuthenticatedRequest } from '../middleware/auth';
import { query } from '../config/db';

export const getArticles = async (req: Request, res: Response) => {
  try {
    const { tag, all, filter } = req.query;
    
    let articles = [];
    if (filter === 'new') {
      const resData = await query(
        `SELECT a.*, u.name as author_name,
                COALESCE(array_agg(t.tag_name) FILTER (WHERE t.tag_name IS NOT NULL), '{}') as tags
         FROM articles a
         LEFT JOIN users u ON a.author_id = u.id
         LEFT JOIN article_tags t ON a.id = t.article_id
         WHERE a.published = true AND a.is_visible = true
         GROUP BY a.id, u.name
         ORDER BY a.created_at DESC`
      );
      articles = resData.rows;
    } else if (filter === 'popular') {
      const resData = await query(
        `SELECT a.*, u.name as author_name,
                COALESCE(array_agg(t.tag_name) FILTER (WHERE t.tag_name IS NOT NULL), '{}') as tags
         FROM articles a
         LEFT JOIN users u ON a.author_id = u.id
         LEFT JOIN article_tags t ON a.id = t.article_id
         WHERE a.published = true AND a.is_visible = true
         GROUP BY a.id, u.name
         ORDER BY a.views DESC, a.created_at DESC`
      );
      articles = resData.rows;
    } else if (filter === 'actual') {
      // Актуальные: трендовые по просмотрам за последние 7 дней, с флбэком на дату обновления
      const resData = await query(
        `SELECT a.*, COUNT(DISTINCT COALESCE(vl.user_id::text, vl.ip_address)) as trending_views, u.name as author_name,
                COALESCE(array_agg(t.tag_name) FILTER (WHERE t.tag_name IS NOT NULL), '{}') as tags
         FROM articles a
         LEFT JOIN users u ON a.author_id = u.id
         LEFT JOIN article_tags t ON a.id = t.article_id
         LEFT JOIN article_views_log vl ON a.id = vl.article_id AND vl.viewed_at > NOW() - INTERVAL '7 days'
         WHERE a.published = true AND a.is_visible = true
         GROUP BY a.id, u.name
         ORDER BY trending_views DESC, a.views DESC, a.created_at DESC`
      );
      articles = resData.rows;
    } else if (filter === 'trending') {
      const resData = await query(
        `SELECT a.*, COUNT(DISTINCT COALESCE(vl.user_id::text, vl.ip_address)) as trending_views, u.name as author_name,
                COALESCE(array_agg(t.tag_name) FILTER (WHERE t.tag_name IS NOT NULL), '{}') as tags
         FROM articles a
         LEFT JOIN users u ON a.author_id = u.id
         LEFT JOIN article_tags t ON a.id = t.article_id
         LEFT JOIN article_views_log vl ON a.id = vl.article_id AND vl.viewed_at > NOW() - INTERVAL '7 days'
         WHERE a.published = true AND a.is_visible = true
         GROUP BY a.id, u.name
         ORDER BY trending_views DESC, a.views DESC, a.created_at DESC`
      );
      articles = resData.rows;
    } else if (filter === 'recommended') {
      const resData = await query(
        `SELECT a.*, COUNT(fa.user_id) as favorites_count, u.name as author_name,
                COALESCE(array_agg(t.tag_name) FILTER (WHERE t.tag_name IS NOT NULL), '{}') as tags
         FROM articles a
         LEFT JOIN users u ON a.author_id = u.id
         LEFT JOIN article_tags t ON a.id = t.article_id
         LEFT JOIN user_favorite_articles fa ON a.id = fa.article_id
         WHERE a.published = true AND a.is_visible = true
         GROUP BY a.id, u.name
         ORDER BY favorites_count DESC, a.views DESC, a.created_at DESC`
      );
      articles = resData.rows;
    } else {
      articles = await ArticleModel.getAllArticles({
        publishedOnly: all === 'true' ? false : true,
        tag: tag as string,
        all: all === 'true',
      });
    }
    
    res.json(articles);
  } catch (error: any) {
    console.error('Error fetching articles:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const getArticle = async (req: Request, res: Response) => {
  try {
    const { slugOrId } = req.params;
    const authReq = req as AuthenticatedRequest;
    let article = null;
    
    if (isNaN(Number(slugOrId))) {
      article = await ArticleModel.getArticleBySlug(slugOrId);
    } else {
      article = await ArticleModel.getArticleById(Number(slugOrId));
    }

    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    // Запись детального просмотра с IP и User ID в фоновом режиме
    const ip = (authReq.headers['x-forwarded-for'] as string) || authReq.socket.remoteAddress || authReq.ip || '';
    const userId = authReq.user ? authReq.user.id : null;
    
    ArticleModel.incrementArticleViews(article.id, userId, ip).catch(err => 
      console.error(`Failed to increment views for article ${article?.id}:`, err)
    );

    // Добавление в историю просмотров пользователя с лимитом в 20 записей
    if (userId) {
      query(`
        INSERT INTO user_reading_history (user_id, article_id, viewed_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id, article_id) DO UPDATE SET viewed_at = CURRENT_TIMESTAMP
      `, [userId, article.id]).then(() => {
        query(`
          DELETE FROM user_reading_history
          WHERE user_id = $1 AND id NOT IN (
            SELECT id FROM user_reading_history
            WHERE user_id = $1
            ORDER BY viewed_at DESC
            LIMIT 20
          )
        `, [userId]);
      }).catch(err => console.error('Failed to save to reading history:', err));
    }

    // Получение информации о последнем изменении статьи
    const changesRes = await query(
      `SELECT cl.*, u.name as user_name, u.role as user_role
       FROM article_changes_log cl
       LEFT JOIN users u ON cl.user_id = u.id
       WHERE cl.article_id = $1
       ORDER BY cl.changed_at DESC LIMIT 1`,
      [article.id]
    );
    const latestChange = changesRes.rows.length ? changesRes.rows[0] : null;

    res.json({
      ...article,
      latest_change: latestChange
    });
  } catch (error: any) {
    console.error('Error fetching article:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const createArticle = async (req: Request, res: Response) => {
  try {
    const { title, slug, content, summary, published, tags, position, is_visible, source_url, sync_interval } = req.body;
    
    if (!title || !slug || !content) {
      return res.status(400).json({ error: 'Title, slug, and content are required fields.' });
    }

    const article = await ArticleModel.createArticle({
      title,
      slug,
      content,
      summary: summary || '',
      category_id: null,
      published: published === undefined ? true : !!published,
      is_visible: is_visible === undefined ? true : !!is_visible,
      tags: tags || [],
      position: position !== undefined ? Number(position) : 0,
      source_url: source_url || null,
      sync_interval: sync_interval || 'manual',
    });

    // Auto-index to Meilisearch
    if (article.published && article.is_visible) {
      const doc: msService.ArticleDocument = {
        id: article.id,
        title: article.title,
        slug: article.slug,
        content: article.content,
        summary: article.summary,
        categoryName: '',
        tags: article.tags,
        published: article.published,
        createdAt: article.created_at.toISOString(),
      };
      // Meilisearch operation runs in background so as to not block client response
      msService.indexArticle(doc).catch(err => 
        console.error('Failed to auto-index new article to Meilisearch:', err)
      );
    }

    res.status(201).json(article);
  } catch (error: any) {
    console.error('Error creating article:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const updateArticle = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, slug, content, summary, published, tags, position, is_visible, source_url, sync_interval, change_description, editor_comment } = req.body;

    if (!title || !slug || !content) {
      return res.status(400).json({ error: 'Title, slug, and content are required.' });
    }

    const article = await ArticleModel.updateArticle(Number(id), {
      title,
      slug,
      content,
      summary: summary || '',
      category_id: null,
      published: published === undefined ? true : !!published,
      is_visible: is_visible === undefined ? true : !!is_visible,
      tags: tags || [],
      position: position !== undefined ? Number(position) : 0,
      source_url: source_url || null,
      sync_interval: sync_interval || 'manual',
    });

    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    // Сохранение записи в журнале изменений статьи
    const authReq = req as AuthenticatedRequest;
    await query(
      `INSERT INTO article_changes_log (article_id, user_id, change_description, editor_comment)
       VALUES ($1, $2, $3, $4)`,
      [
        article.id,
        authReq.user ? authReq.user.id : null,
        change_description || 'Обновлено содержание статьи',
        editor_comment || 'Редактирование статьи'
      ]
    );

    // Auto-index or delete from Meilisearch depending on published and visible status
    if (article.published && article.is_visible) {
      const doc: msService.ArticleDocument = {
        id: article.id,
        title: article.title,
        slug: article.slug,
        content: article.content,
        summary: article.summary,
        categoryName: '',
        tags: article.tags,
        published: article.published,
        createdAt: article.created_at.toISOString(),
      };
      msService.indexArticle(doc).catch(err => 
        console.error('Failed to update Meilisearch index for article:', err)
      );
    } else {
      // If unpublished or hidden, make sure it is removed from index
      msService.deleteArticle(article.id).catch(err =>
        console.error('Failed to remove article from Meilisearch:', err)
      );
    }

    res.json(article);
  } catch (error: any) {
    console.error('Error updating article:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const deleteArticle = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = await ArticleModel.deleteArticle(Number(id));
    
    if (!success) {
      return res.status(404).json({ error: 'Article not found' });
    }

    // Remove from Meilisearch
    msService.deleteArticle(Number(id)).catch(err =>
      console.error('Failed to delete article from Meilisearch index:', err)
    );

    res.json({ message: 'Article deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting article:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const searchArticles = async (req: Request, res: Response) => {
  try {
    const { q, category, tag } = req.query;
    
    const results = await msService.searchArticles(
      (q as string) || '',
      category as string,
      tag as string
    );
    
    res.json(results);
  } catch (error: any) {
    console.error('Meilisearch search request failed:', error);
    res.status(500).json({ error: 'Search Service Unavailable', details: error.message });
  }
};

export const suggestArticles = async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    
    const results = await msService.suggestArticles((q as string) || '');
    
    res.json(results);
  } catch (error: any) {
    console.error('Meilisearch suggestions request failed:', error);
    res.status(500).json({ error: 'Suggestions Service Unavailable', details: error.message });
  }
};

export const uploadImage = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded.' });
    }
    
    // Convert to base64 data URL
    const fileBuffer = await fs.promises.readFile(req.file.path);
    const base64 = fileBuffer.toString('base64');
    const imageUrl = `data:${req.file.mimetype};base64,${base64}`;
    
    // Delete the file from the ephemeral disk
    await fs.promises.unlink(req.file.path).catch(err => {
      console.error('Failed to delete temp file:', err);
    });
    
    res.status(201).json({ 
      message: 'Image uploaded successfully', 
      url: imageUrl 
    });
  } catch (error: any) {
    console.error('Image upload failed:', error);
    res.status(500).json({ error: 'Image upload failed', details: error.message });
  }
};

export const importArticle = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No document file uploaded.' });
    }

    const { path: tempPath, originalname } = req.file;

    // Parse document
    const parsedDoc = await parseDocument(tempPath, originalname);

    // Slugify title + random string to prevent duplicates
    const cleanTitle = parsedDoc.title;
    const cleanSlug = cleanTitle
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w\u0400-\u04FF-]+/g, '')
      .replace(/--+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '') + '-' + Date.now();

    const authorId = req.user ? req.user.id : null;

    // Create article in Postgres as published
    const article = await ArticleModel.createArticle({
      title: cleanTitle,
      slug: cleanSlug,
      content: parsedDoc.content,
      summary: parsedDoc.summary,
      category_id: null,
      author_id: authorId,
      published: true,
      tags: [],
    });

    // Index to Meilisearch
    const doc: msService.ArticleDocument = {
      id: article.id,
      title: article.title,
      slug: article.slug,
      content: article.content,
      summary: article.summary,
      categoryName: '',
      tags: [],
      published: true,
      createdAt: article.created_at.toISOString(),
    };
    
    await msService.indexArticle(doc);

    // Clean up local temp file
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }

    res.status(201).json(article);
  } catch (error: any) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error('Document import failed:', error);
    res.status(500).json({ error: 'Document import failed', details: error.message });
  }
};

export const reindexAndClearCache = async (req: Request, res: Response) => {
  try {
    console.log('Triggering manual search index sync and cache clearing...');
    await msService.triggerFullSync();
    res.json({ message: 'Кэш и поисковый индекс Meilisearch успешно очищены и синхронизированы!' });
  } catch (error: any) {
    console.error('Error clearing cache/syncing Meilisearch:', error);
    res.status(500).json({ error: 'Failed to reindex', details: error.message });
  }
};

export const reorderArticles = async (req: Request, res: Response) => {
  try {
    const { orders } = req.body; // array of { id: number, position: number }
    if (!orders || !Array.isArray(orders)) {
      return res.status(400).json({ error: 'Orders array is required.' });
    }

    for (const item of orders) {
      await ArticleModel.updateArticlePosition(Number(item.id), Number(item.position));
    }

    res.json({ message: 'Articles reordered successfully' });
  } catch (error: any) {
    console.error('Error reordering articles:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const syncArticle = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { force } = req.body;
    
    // Lazy load the sync service to avoid circular dependency
    const { syncArticle: runSync } = require('../services/sourceSync');
    await runSync(Number(id), { force: !!force });
    
    res.json({ message: 'Синхронизация завершена успешно!' });
  } catch (error: any) {
    console.error('Manual sync failed:', error);
    res.status(500).json({ error: 'Синхронизация завершилась ошибкой', details: error.message });
  }
};

export const getArticleSyncHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const historyRes = await query(
      'SELECT * FROM article_sync_history WHERE article_id = $1 ORDER BY synced_at DESC LIMIT 50',
      [Number(id)]
    );
    res.json(historyRes.rows);
  } catch (error: any) {
    console.error('Failed to get sync history:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const getClassifierData = async (req: Request, res: Response) => {
  try {
    const mainRes = await query(
      "SELECT structured_data FROM articles WHERE slug = 'auto-list'"
    );
    if (mainRes.rows.length > 0 && mainRes.rows[0].structured_data) {
      return res.json(mainRes.rows[0].structured_data);
    }
    res.json(null);
  } catch (error: any) {
    console.error('Failed to fetch classifier data:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const getNotifications = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userRole = req.user ? req.user.role : '';
    const userId = req.user ? req.user.id : null;
    
    const sql = `
      SELECT * FROM notifications 
      WHERE (role = $1 OR user_id = $2 OR (role IS NULL AND user_id IS NULL))
      ORDER BY created_at DESC LIMIT 30
    `;
    const notifRes = await query(sql, [userRole, userId]);
    res.json(notifRes.rows);
  } catch (error: any) {
    console.error('Failed to get notifications:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const markNotificationsRead = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userRole = req.user ? req.user.role : '';
    const userId = req.user ? req.user.id : null;
    
    const sql = `
      UPDATE notifications 
      SET is_read = true 
      WHERE (role = $1 OR user_id = $2 OR (role IS NULL AND user_id IS NULL))
    `;
    await query(sql, [userRole, userId]);
    res.json({ message: 'Уведомления помечены как прочитанные' });
  } catch (error: any) {
    console.error('Failed to mark notifications read:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const getArticleChanges = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT cl.*, u.name as user_name, u.role as user_role
       FROM article_changes_log cl
       LEFT JOIN users u ON cl.user_id = u.id
       WHERE cl.article_id = $1
       ORDER BY cl.changed_at DESC`,
      [Number(id)]
    );
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const getPopularArticles = async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT a.*, u.name as author_name,
              COALESCE(array_agg(t.tag_name) FILTER (WHERE t.tag_name IS NOT NULL), '{}') as tags
       FROM articles a
       LEFT JOIN users u ON a.author_id = u.id
       LEFT JOIN article_tags t ON a.id = t.article_id
       WHERE a.published = true AND a.is_visible = true
       GROUP BY a.id, u.name
       ORDER BY a.views DESC, a.created_at DESC
       LIMIT 10`
    );
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const getTrendingArticles = async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT a.*, COUNT(DISTINCT COALESCE(vl.user_id::text, vl.ip_address)) as trending_views, u.name as author_name,
              COALESCE(array_agg(t.tag_name) FILTER (WHERE t.tag_name IS NOT NULL), '{}') as tags
       FROM articles a
       LEFT JOIN users u ON a.author_id = u.id
       LEFT JOIN article_tags t ON a.id = t.article_id
       LEFT JOIN article_views_log vl ON a.id = vl.article_id AND vl.viewed_at > NOW() - INTERVAL '7 days'
       WHERE a.published = true AND a.is_visible = true
       GROUP BY a.id, u.name
       ORDER BY trending_views DESC, a.views DESC, a.created_at DESC
       LIMIT 10`
    );
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const getRecommendedArticles = async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT a.*, COUNT(fa.user_id) as favorites_count, u.name as author_name,
              COALESCE(array_agg(t.tag_name) FILTER (WHERE t.tag_name IS NOT NULL), '{}') as tags
       FROM articles a
       LEFT JOIN users u ON a.author_id = u.id
       LEFT JOIN article_tags t ON a.id = t.article_id
       LEFT JOIN user_favorite_articles fa ON a.id = fa.article_id
       WHERE a.published = true AND a.is_visible = true
       GROUP BY a.id, u.name
       ORDER BY favorites_count DESC, a.views DESC, a.created_at DESC
       LIMIT 10`
    );
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};
