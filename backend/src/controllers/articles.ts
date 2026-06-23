import { Request, Response } from 'express';
import * as fs from 'fs';
import * as ArticleModel from '../models/article';
import * as msService from '../services/meilisearch';
import { parseDocument } from '../services/parser';
import { AuthenticatedRequest } from '../middleware/auth';
import { query } from '../config/db';
import { getUserAllowedSections } from '../models/orgStructure';
import { canCreateInSections, canEditArticle } from '../services/accessControl';

// Получение списка разрешенных разделов для запроса
const getAllowedSectionsForRequest = async (req: Request): Promise<number[]> => {
  const authReq = req as AuthenticatedRequest;
  const employeeId = authReq.user ? authReq.user.employee_id : null;
  const role = authReq.user ? authReq.user.role : '';
  const userId = authReq.user ? authReq.user.id : undefined;
  return getUserAllowedSections(employeeId, role, userId);
};

export const getArticles = async (req: Request, res: Response) => {
  try {
    const { tag, all, filter } = req.query;
    const authReq = req as AuthenticatedRequest;
    const role = authReq.user ? authReq.user.role : '';
    const userId = authReq.user ? authReq.user.id : 0;
    const employeeId = authReq.user ? authReq.user.employee_id : null;

    const allowedSectionIds = await getUserAllowedSections(employeeId, role, userId);

    let allowedStatuses = ['published', 'requires_verification'];
    if (role === 'Admin') {
      allowedStatuses = ['draft', 'on_approval', 'published', 'requires_verification', 'archived', 'expired'];
    } else if (role === 'Editor') {
      allowedStatuses = ['published', 'requires_verification', 'archived', 'expired'];
    }

    let articles = [];
    if (filter === 'new') {
      const resData = await query(
        `SELECT a.*, u.name as author_name,
                COALESCE(array_agg(DISTINCT t.tag_name) FILTER (WHERE t.tag_name IS NOT NULL), '{}') as tags,
                COALESCE(array_agg(DISTINCT axs.section_id) FILTER (WHERE axs.section_id IS NOT NULL), '{}') as section_ids
         FROM articles a
         LEFT JOIN users u ON a.author_id = u.id
         LEFT JOIN article_tags t ON a.id = t.article_id
         LEFT JOIN article_sections axs ON a.id = axs.article_id
         WHERE a.is_visible = true 
           AND (a.status = ANY($2::varchar[]) OR a.author_id = $3)
           AND axs.section_id = ANY($1::int[])
         GROUP BY a.id, u.name
         ORDER BY a.created_at DESC`,
        [allowedSectionIds, allowedStatuses, userId]
      );
      articles = resData.rows;
    } else if (filter === 'popular') {
      const resData = await query(
        `SELECT a.*, u.name as author_name,
                COALESCE(array_agg(DISTINCT t.tag_name) FILTER (WHERE t.tag_name IS NOT NULL), '{}') as tags,
                COALESCE(array_agg(DISTINCT axs.section_id) FILTER (WHERE axs.section_id IS NOT NULL), '{}') as section_ids
         FROM articles a
         LEFT JOIN users u ON a.author_id = u.id
         LEFT JOIN article_tags t ON a.id = t.article_id
         LEFT JOIN article_sections axs ON a.id = axs.article_id
         WHERE a.is_visible = true
           AND (a.status = ANY($2::varchar[]) OR a.author_id = $3)
           AND axs.section_id = ANY($1::int[])
         GROUP BY a.id, u.name
         ORDER BY a.views DESC, a.created_at DESC`,
        [allowedSectionIds, allowedStatuses, userId]
      );
      articles = resData.rows;
    } else if (filter === 'actual' || filter === 'trending') {
      const resData = await query(
        `SELECT a.*, COUNT(DISTINCT COALESCE(vl.user_id::text, vl.ip_address)) as trending_views, u.name as author_name,
                COALESCE(array_agg(DISTINCT t.tag_name) FILTER (WHERE t.tag_name IS NOT NULL), '{}') as tags,
                COALESCE(array_agg(DISTINCT axs.section_id) FILTER (WHERE axs.section_id IS NOT NULL), '{}') as section_ids
         FROM articles a
         LEFT JOIN users u ON a.author_id = u.id
         LEFT JOIN article_tags t ON a.id = t.article_id
         LEFT JOIN article_sections axs ON a.id = axs.article_id
         LEFT JOIN article_views_log vl ON a.id = vl.article_id AND vl.viewed_at > NOW() - INTERVAL '7 days'
         WHERE a.is_visible = true
           AND (a.status = ANY($2::varchar[]) OR a.author_id = $3)
           AND axs.section_id = ANY($1::int[])
         GROUP BY a.id, u.name
         ORDER BY trending_views DESC, a.views DESC, a.created_at DESC`,
        [allowedSectionIds, allowedStatuses, userId]
      );
      articles = resData.rows;
    } else if (filter === 'recommended') {
      const resData = await query(
        `SELECT a.*, COUNT(fa.user_id) as favorites_count, u.name as author_name,
                COALESCE(array_agg(DISTINCT t.tag_name) FILTER (WHERE t.tag_name IS NOT NULL), '{}') as tags,
                COALESCE(array_agg(DISTINCT axs.section_id) FILTER (WHERE axs.section_id IS NOT NULL), '{}') as section_ids
         FROM articles a
         LEFT JOIN users u ON a.author_id = u.id
         LEFT JOIN article_tags t ON a.id = t.article_id
         LEFT JOIN article_sections axs ON a.id = axs.article_id
         LEFT JOIN user_favorite_articles fa ON a.id = fa.article_id
         WHERE a.is_visible = true
           AND (a.status = ANY($2::varchar[]) OR a.author_id = $3)
           AND axs.section_id = ANY($1::int[])
         GROUP BY a.id, u.name
         ORDER BY favorites_count DESC, a.views DESC, a.created_at DESC`,
        [allowedSectionIds, allowedStatuses, userId]
      );
      articles = resData.rows;
    } else {
      articles = await ArticleModel.getAllArticles({
        publishedOnly: all === 'true' ? false : true,
        tag: tag as string,
        all: all === 'true',
        allowedSectionIds,
        allowedStatuses,
        authorId: userId
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
    const role = authReq.user ? authReq.user.role : '';
    const userId = authReq.user ? authReq.user.id : 0;
    const employeeId = authReq.user ? authReq.user.employee_id : null;
    
    let article = null;
    if (isNaN(Number(slugOrId))) {
      article = await ArticleModel.getArticleBySlug(slugOrId);
    } else {
      article = await ArticleModel.getArticleById(Number(slugOrId));
    }

    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    // Проверка доступа к разделам и статусу статьи
    if (role !== 'Admin') {
      const allowedSections = await getUserAllowedSections(employeeId, role, userId);
      const hasSectionAccess = article.section_ids.some(id => allowedSections.includes(id));
      
      let hasGuestAccess = false;
      if (userId) {
        const guestAccessRes = await query(
          `SELECT id FROM guest_access 
           WHERE user_id = $1 
             AND (article_id = $2 OR section_id = ANY($3::int[])) 
             AND status = 'Active' 
             AND expires_at > CURRENT_TIMESTAMP`,
          [userId, article.id, article.section_ids]
        );
        hasGuestAccess = (guestAccessRes.rowCount ?? 0) > 0;
      }
      
      if (!hasSectionAccess && !hasGuestAccess && article.section_ids.length > 0) {
        return res.status(403).json({ error: 'Доступ ограничен: У вас нет прав на просмотр этой статьи.' });
      }

      const isAuthor = article.author_id === userId;
      if (article.status === 'draft' || article.status === 'on_approval') {
        if (!isAuthor) {
          return res.status(403).json({ error: 'Доступ ограничен: Черновики и статьи на согласовании видны только авторам.' });
        }
      } else if (article.status === 'archived' || article.status === 'expired') {
        if (role !== 'Editor' && !isAuthor) {
          return res.status(403).json({ error: 'Доступ ограничен: Архивные статьи доступны только редакторам и авторам.' });
        }
      }
    }

    // Запись детального просмотра с IP и User ID в фоновом режиме
    const rawIp = (authReq.headers['x-forwarded-for'] as string) || authReq.socket.remoteAddress || authReq.ip || '';
    const ip = rawIp.split(',')[0].trim();
    
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
    const authReq = req as AuthenticatedRequest;
    const {
      title,
      slug,
      content,
      summary,
      published,
      tags,
      position,
      is_visible,
      source_url,
      sync_interval,
      section_ids,
      status,
      article_type,
      owner_id,
      approver_id,
    } = req.body;
    
    if (!title || !slug || !content) {
      return res.status(400).json({ error: 'Title, slug, and content are required fields.' });
    }

    const authorId = authReq.user ? authReq.user.id : null;
    const selectedSectionIds = Array.isArray(section_ids) ? section_ids.map((id) => Number(id)).filter(Boolean) : [];
    const hasCreateAccess = await canCreateInSections(authorId, authReq.user?.role, selectedSectionIds);
    if (!hasCreateAccess) {
      return res.status(403).json({ error: 'Недостаточно прав для создания статьи в выбранных разделах.' });
    }

    const article = await ArticleModel.createArticle({
      title,
      slug,
      content,
      summary: summary || '',
      category_id: null,
      author_id: authorId,
      published: published === undefined ? true : !!published,
      is_visible: is_visible === undefined ? true : !!is_visible,
      status: status || 'draft',
      tags: tags || [],
      section_ids: selectedSectionIds,
      position: position !== undefined ? Number(position) : 0,
      source_url: source_url || null,
      sync_interval: sync_interval || 'manual',
      article_type: article_type || 'general',
      owner_id: owner_id ? Number(owner_id) : null,
      approver_id: approver_id ? Number(approver_id) : null,
    });

    // Auto-index to Meilisearch
    if (article.published && article.is_visible && article.status === 'published') {
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
    const {
      title,
      slug,
      content,
      summary,
      published,
      tags,
      position,
      is_visible,
      source_url,
      sync_interval,
      section_ids,
      status,
      article_type,
      owner_id,
      approver_id,
      change_description,
      editor_comment,
    } = req.body;

    if (!title || !slug || !content) {
      return res.status(400).json({ error: 'Title, slug, and content are required.' });
    }

    // Retrieve current state before update
    const currentArticle = await ArticleModel.getArticleById(Number(id));
    if (!currentArticle) {
      return res.status(404).json({ error: 'Article not found' });
    }

    const authReq = req as AuthenticatedRequest;
    const hasEditAccess = await canEditArticle(authReq.user?.id, authReq.user?.role, currentArticle);
    if (!hasEditAccess) {
      return res.status(403).json({ error: 'Недостаточно прав для редактирования этой статьи.' });
    }

    const selectedSectionIds = Array.isArray(section_ids) ? section_ids.map((sectionId) => Number(sectionId)).filter(Boolean) : [];
    const article = await ArticleModel.updateArticle(Number(id), {
      title,
      slug,
      content,
      summary: summary || '',
      category_id: null,
      published: published === undefined ? true : !!published,
      is_visible: is_visible === undefined ? true : !!is_visible,
      status: status || 'draft',
      tags: tags || [],
      section_ids: selectedSectionIds,
      position: position !== undefined ? Number(position) : 0,
      source_url: source_url || null,
      sync_interval: sync_interval || 'manual',
      article_type: article_type || currentArticle.article_type || 'general',
      owner_id: owner_id !== undefined ? (owner_id ? Number(owner_id) : null) : currentArticle.owner_id || null,
      approver_id: approver_id !== undefined ? (approver_id ? Number(approver_id) : null) : currentArticle.approver_id || null,
    });

    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    // Сохранение записи в журнале изменений статьи со снимками
    try {
      await query(
        `INSERT INTO article_changes_log (article_id, user_id, change_description, editor_comment, old_content, new_content, old_title, new_title)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          article.id,
          authReq.user ? authReq.user.id : null,
          change_description || 'Обновлено содержание статьи',
          editor_comment || 'Редактирование статьи',
          currentArticle.content,
          article.content,
          currentArticle.title,
          article.title
        ]
      );
    } catch (logErr) {
      console.error('Failed to write article change log (non-fatal):', logErr);
    }

    // Добавление системного уведомления
    const authorName = authReq.user ? authReq.user.name : 'Система';
    const authorRole = authReq.user ? authReq.user.role : '';
    const authorRoleName = authorRole === 'Admin' ? 'Администратор' : (authorRole === 'Editor' ? 'Редактор' : 'Пользователь');

    try {
      await query(
        `INSERT INTO notifications (title, message, type) VALUES ($1, $2, $3)`,
        [
          `Статья "${article.title}" была обновлена.`,
          `Автор: ${authorName} (${authorRoleName})\n\nОписание изменений:\n${change_description || 'Обновлено содержание статьи'}`,
          'info'
        ]
      );
    } catch (notifErr) {
      console.error('Failed to write notification (non-fatal):', notifErr);
    }

    // Auto-index or delete from Meilisearch depending on published and visible status
    if (article.published && article.is_visible && article.status === 'published') {
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

export const getRecentChanges = async (req: Request, res: Response) => {
  try {
    const allowedSectionIds = await getAllowedSectionsForRequest(req);
    const result = await query(
      `SELECT cl.*, a.title as article_title, a.slug as article_slug, u.name as user_name, u.role as user_role
       FROM article_changes_log cl
       INNER JOIN articles a ON cl.article_id = a.id
       LEFT JOIN users u ON cl.user_id = u.id
       LEFT JOIN article_sections axs ON a.id = axs.article_id
       WHERE axs.section_id = ANY($1::int[]) AND a.is_visible = true
       ORDER BY cl.changed_at DESC
       LIMIT 5`,
      [allowedSectionIds]
    );
    res.json(result.rows);
  } catch (error: any) {
    console.error('Failed to get recent changes:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const restoreArticleVersion = async (req: Request, res: Response) => {
  try {
    const { id, changeId } = req.params;
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user || authReq.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Доступ запрещен. Только Администраторы могут восстанавливать версии.' });
    }

    const versionRes = await query(
      'SELECT * FROM article_changes_log WHERE id = $1 AND article_id = $2',
      [Number(changeId), Number(id)]
    );
    if (versionRes.rows.length === 0) {
      return res.status(404).json({ error: 'Версия не найдена.' });
    }
    const version = versionRes.rows[0];

    const currentArticle = await ArticleModel.getArticleById(Number(id));
    if (!currentArticle) {
      return res.status(404).json({ error: 'Статья не найдена.' });
    }

    const restoredContent = version.new_content !== null ? version.new_content : currentArticle.content;
    const restoredTitle = version.new_title !== null ? version.new_title : currentArticle.title;

    const updatedArticle = await ArticleModel.updateArticle(Number(id), {
      title: restoredTitle,
      slug: currentArticle.slug,
      content: restoredContent,
      summary: currentArticle.summary || '',
      category_id: currentArticle.category_id,
      published: currentArticle.published,
      is_visible: currentArticle.is_visible,
      status: currentArticle.status,
      tags: currentArticle.tags || [],
      section_ids: currentArticle.section_ids,
      position: currentArticle.position,
      source_url: currentArticle.source_url || null,
      sync_interval: currentArticle.sync_interval || 'manual',
      article_type: currentArticle.article_type || 'general',
      owner_id: currentArticle.owner_id || null,
      approver_id: currentArticle.approver_id || null,
    });

    if (!updatedArticle) {
      return res.status(404).json({ error: 'Не удалось обновить статью при восстановлении.' });
    }

    const restoredDateStr = new Date(version.changed_at).toLocaleString('ru-RU');
    const changeDescription = `Восстановление к версии от ${restoredDateStr}`;
    const editorComment = `Откат к изменениям #${changeId}`;

    await query(
      `INSERT INTO article_changes_log (article_id, user_id, change_description, editor_comment, old_content, new_content, old_title, new_title)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        updatedArticle.id,
        authReq.user.id,
        changeDescription,
        editorComment,
        currentArticle.content,
        restoredContent,
        currentArticle.title,
        restoredTitle
      ]
    );

    await query(
      `INSERT INTO notifications (title, message, type) VALUES ($1, $2, $3)`,
      [
        `Статья "${updatedArticle.title}" была восстановлена.`,
        `Автор: ${authReq.user.name} (Администратор)\n\nОписание изменений:\n${changeDescription}`,
        'info'
      ]
    );

    if (updatedArticle.published && updatedArticle.is_visible && updatedArticle.status === 'published') {
      const doc: msService.ArticleDocument = {
        id: updatedArticle.id,
        title: updatedArticle.title,
        slug: updatedArticle.slug,
        content: updatedArticle.content,
        summary: updatedArticle.summary,
        categoryName: '',
        tags: updatedArticle.tags,
        published: updatedArticle.published,
        createdAt: updatedArticle.created_at.toISOString(),
      };
      await msService.indexArticle(doc);
    } else {
      await msService.deleteArticle(updatedArticle.id);
    }

    res.json(updatedArticle);
  } catch (error: any) {
    console.error('Failed to restore article version:', error);
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
    const allowedSectionIds = await getAllowedSectionsForRequest(req);
    
    let results = await msService.searchArticles(
      (q as string) || '',
      category as string,
      tag as string,
      allowedSectionIds
    );

    // Дополнительная фильтрация результатов Meilisearch по разрешенным разделам на бэкенде (как fallback и для точности)
    // В Meilisearch мы также добавим фильтрацию. Но на бэкенде мы перепроверим:
    // Каждая статья из результатов должна содержать хотя бы одну секцию из allowedSectionIds
    // Но Meilisearch возвращает документы. Сначала найдем в бд секции для найденных статей
    if (results && results.length > 0) {
      const articleIds = results.map(r => r.id);
      const secMapRes = await query(
        'SELECT article_id, section_id FROM article_sections WHERE article_id = ANY($1::int[])',
        [articleIds]
      );
      const articleToSections: Record<number, number[]> = {};
      secMapRes.rows.forEach(row => {
        if (!articleToSections[row.article_id]) {
          articleToSections[row.article_id] = [];
        }
        articleToSections[row.article_id].push(row.section_id);
      });

      results = results.filter(art => {
        const sections = articleToSections[art.id] || [];
        // Если статья не привязана к секциям, обычные пользователи не видят её
        if (sections.length === 0) return false;
        return sections.some(id => allowedSectionIds.includes(id));
      });
    }
    
    res.json(results);
  } catch (error: any) {
    console.error('Meilisearch search request failed:', error);
    res.status(500).json({ error: 'Search Service Unavailable', details: error.message });
  }
};

export const suggestArticles = async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    const allowedSectionIds = await getAllowedSectionsForRequest(req);
    
    let results = await msService.suggestArticles((q as string) || '', allowedSectionIds);
    
    if (results && results.length > 0) {
      const articleIds = results.map(r => r.id);
      const secMapRes = await query(
        'SELECT article_id, section_id FROM article_sections WHERE article_id = ANY($1::int[])',
        [articleIds]
      );
      const articleToSections: Record<number, number[]> = {};
      secMapRes.rows.forEach(row => {
        if (!articleToSections[row.article_id]) {
          articleToSections[row.article_id] = [];
        }
        articleToSections[row.article_id].push(row.section_id);
      });

      results = results.filter(art => {
        const sections = articleToSections[art.id] || [];
        if (sections.length === 0) return false;
        return sections.some(id => allowedSectionIds.includes(id));
      });
    }

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
      status: 'published',
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
    const allowedSectionIds = await getAllowedSectionsForRequest(req);
    const result = await query(
      `SELECT a.*, u.name as author_name,
              COALESCE(array_agg(DISTINCT t.tag_name) FILTER (WHERE t.tag_name IS NOT NULL), '{}') as tags
       FROM articles a
       LEFT JOIN users u ON a.author_id = u.id
       LEFT JOIN article_tags t ON a.id = t.article_id
       LEFT JOIN article_sections axs ON a.id = axs.article_id
       WHERE a.published = true AND a.is_visible = true AND axs.section_id = ANY($1::int[])
       GROUP BY a.id, u.name
       ORDER BY a.views DESC, a.created_at DESC
       LIMIT 10`,
      [allowedSectionIds]
    );
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const getTrendingArticles = async (req: Request, res: Response) => {
  try {
    const allowedSectionIds = await getAllowedSectionsForRequest(req);
    const result = await query(
      `SELECT a.*, COUNT(DISTINCT COALESCE(vl.user_id::text, vl.ip_address)) as trending_views, u.name as author_name,
              COALESCE(array_agg(DISTINCT t.tag_name) FILTER (WHERE t.tag_name IS NOT NULL), '{}') as tags
       FROM articles a
       LEFT JOIN users u ON a.author_id = u.id
       LEFT JOIN article_tags t ON a.id = t.article_id
       LEFT JOIN article_sections axs ON a.id = axs.article_id
       LEFT JOIN article_views_log vl ON a.id = vl.article_id AND vl.viewed_at > NOW() - INTERVAL '7 days'
       WHERE a.published = true AND a.is_visible = true AND axs.section_id = ANY($1::int[])
       GROUP BY a.id, u.name
       ORDER BY trending_views DESC, a.views DESC, a.created_at DESC
       LIMIT 10`,
      [allowedSectionIds]
    );
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const getRecommendedArticles = async (req: Request, res: Response) => {
  try {
    const allowedSectionIds = await getAllowedSectionsForRequest(req);
    const result = await query(
      `SELECT a.*, COUNT(fa.user_id) as favorites_count, u.name as author_name,
              COALESCE(array_agg(DISTINCT t.tag_name) FILTER (WHERE t.tag_name IS NOT NULL), '{}') as tags
       FROM articles a
       LEFT JOIN users u ON a.author_id = u.id
       LEFT JOIN article_tags t ON a.id = t.article_id
       LEFT JOIN article_sections axs ON a.id = axs.article_id
       LEFT JOIN user_favorite_articles fa ON a.id = fa.article_id
       WHERE a.published = true AND a.is_visible = true AND axs.section_id = ANY($1::int[])
       GROUP BY a.id, u.name
       ORDER BY favorites_count DESC, a.views DESC, a.created_at DESC
       LIMIT 10`,
      [allowedSectionIds]
    );
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const getNavigationTree = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const role = authReq.user ? authReq.user.role : '';
    const userId = authReq.user ? authReq.user.id : 0;
    const employeeId = authReq.user ? authReq.user.employee_id : null;

    const allowedSectionIds = await getUserAllowedSections(employeeId, role, userId);

    if (allowedSectionIds.length === 0) {
      return res.json([]);
    }

    // 1. Получаем все разделы (sections), которые разрешены пользователю
    const sectionsRes = await query(
      `SELECT s.id, s.name, s.description, s.space_id, s.parent_section_id, s.position_id
       FROM sections s
       WHERE s.id = ANY($1::int[]) AND s.status = 'Active'
       ORDER BY s.id ASC`,
      [allowedSectionIds]
    );
    const sections = sectionsRes.rows;

    const spaceIds = Array.from(new Set(sections.map(s => s.space_id)));

    if (spaceIds.length === 0) {
      return res.json([]);
    }

    // 2. Получаем все пространства (spaces) для этих разделов
    const spacesRes = await query(
      `SELECT sp.id, sp.name, sp.description, sp.department_id
       FROM spaces sp
       WHERE sp.id = ANY($1::int[]) AND sp.status = 'Active'
       ORDER BY sp.name ASC`,
      [spaceIds]
    );
    const spaces = spacesRes.rows;

    // 3. Получаем все статьи (articles), привязанные к разрешенным разделам и удовлетворяющие статусу
    let allowedStatuses = ['published', 'requires_verification'];
    if (role === 'Admin') {
      allowedStatuses = ['draft', 'on_approval', 'published', 'requires_verification', 'archived', 'expired'];
    } else if (role === 'Editor') {
      allowedStatuses = ['published', 'requires_verification', 'archived', 'expired'];
    }

    const articlesRes = await query(
      `SELECT a.id, a.title, a.slug, a.status, a.position, a.article_type, axs.section_id
       FROM articles a
       JOIN article_sections axs ON a.id = axs.article_id
       WHERE axs.section_id = ANY($1::int[]) 
         AND a.is_visible = true
         AND (a.status = ANY($2::varchar[]) OR a.author_id = $3)
       ORDER BY (CASE WHEN a.article_type = 'job_description' THEN 0 ELSE 1 END) ASC, a.position ASC, a.created_at DESC`,
      [allowedSectionIds, allowedStatuses, userId]
    );
    const articles = articlesRes.rows;

    // 4. Группируем статьи по разделам
    const articlesBySection: Record<number, any[]> = {};
    articles.forEach(art => {
      if (!articlesBySection[art.section_id]) {
        articlesBySection[art.section_id] = [];
      }
      articlesBySection[art.section_id].push({
        id: art.id,
        title: art.title,
        slug: art.slug,
        status: art.status,
        position: art.position,
        article_type: art.article_type
      });
    });

    // 5. Группируем разделы по пространствам и строим дерево вложенности
    const buildSectionTree = (
      allSections: any[],
      parentId: number | null,
      spaceId: number
    ): any[] => {
      return allSections
        .filter(s => s.space_id === spaceId && s.parent_section_id === parentId)
        .map(s => {
          const children = buildSectionTree(allSections, s.id, spaceId);
          return {
            id: s.id,
            name: s.name,
            description: s.description,
            position_id: s.position_id,
            articles: articlesBySection[s.id] || [],
            subsections: children
          };
        });
    };

    const result = spaces.map(sp => {
      const spaceSections = sections.filter(s => s.space_id === sp.id);
      
      const rootSections = spaceSections.filter(s => 
        s.parent_section_id === null || !allowedSectionIds.includes(s.parent_section_id)
      );

      const sectionTree = rootSections.map(s => {
        const children = buildSectionTree(spaceSections, s.id, sp.id);
        return {
          id: s.id,
          name: s.name,
          description: s.description,
          position_id: s.position_id,
          articles: articlesBySection[s.id] || [],
          subsections: children
        };
      });

      return {
        id: sp.id,
        name: sp.name,
        description: sp.description,
        department_id: sp.department_id,
        sections: sectionTree
      };
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error fetching navigation tree:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

// CHECK ACCESS ENDPOINT
export const checkAccess = async (req: Request, res: Response) => {
  try {
    const { sectionId, articleId } = req.query;
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user ? authReq.user.id : 0;
    const role = authReq.user ? authReq.user.role : '';
    const employeeId = authReq.user ? authReq.user.employee_id : null;

    if (role === 'Admin') {
      return res.json({ hasAccess: true });
    }

    if (articleId) {
      const article = await ArticleModel.getArticleById(Number(articleId));
      if (!article) return res.status(404).json({ error: 'Article not found' });
      
      const allowedSections = await getUserAllowedSections(employeeId, role, userId);
      const hasSectionAccess = article.section_ids.some(id => allowedSections.includes(id));
      
      let hasGuestAccess = false;
      if (userId) {
        const guestAccessRes = await query(
          `SELECT id FROM guest_access 
           WHERE user_id = $1 
             AND (article_id = $2 OR section_id = ANY($3::int[])) 
             AND status = 'Active' 
             AND expires_at > CURRENT_TIMESTAMP`,
          [userId, article.id, article.section_ids]
        );
        hasGuestAccess = (guestAccessRes.rowCount ?? 0) > 0;
      }
      
      return res.json({ hasAccess: hasSectionAccess || hasGuestAccess });
    }

    if (sectionId) {
      const allowedSections = await getUserAllowedSections(employeeId, role, userId);
      const hasAccess = allowedSections.includes(Number(sectionId));
      return res.json({ hasAccess });
    }

    return res.status(400).json({ error: 'sectionId or articleId required' });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

// ARTICLE LINKS ENDPOINTS
export const getArticleLinks = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT al.*, a.title as target_title, a.slug as target_slug 
       FROM article_links al
       JOIN articles a ON al.target_article_id = a.id
       WHERE al.source_article_id = $1`,
      [id]
    );
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const createArticleLink = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { target_article_id, link_text } = req.body;
    
    if (!target_article_id) {
      return res.status(400).json({ error: 'target_article_id is required' });
    }

    const result = await query(
      `INSERT INTO article_links (source_article_id, target_article_id, link_text)
       VALUES ($1, $2, $3)
       ON CONFLICT (source_article_id, target_article_id) 
       DO UPDATE SET link_text = EXCLUDED.link_text
       RETURNING *`,
      [id, target_article_id, link_text || '']
    );
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const deleteArticleLink = async (req: Request, res: Response) => {
  try {
    const { id, linkId } = req.params;
    const result = await query(
      'DELETE FROM article_links WHERE id = $1 AND source_article_id = $2',
      [linkId, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Link not found' });
    }
    res.json({ message: 'Link deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};
