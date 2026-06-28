import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import * as NewsModel from '../models/news';
import * as msService from '../services/meilisearch';
import fs from 'fs';

const normalizeDepartmentIds = (value: unknown): number[] => {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)
    )
  );
};

const hasDraftContent = (value: unknown) => {
  if (typeof value !== 'string') return false;
  const plainText = value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .trim();

  return plainText.length > 0 || /<(img|iframe|video|table|ul|ol|li|h[1-6])\b/i.test(value);
};

const buildDraftTitle = () => `Черновик новости ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' })}`;

const toNewsDocument = (news: NewsModel.News): msService.NewsDocument => ({
  id: news.id,
  title: news.title,
  description: news.description,
  content: news.content,
  videoUrl: news.video_url || null,
  tags: news.tags,
  attachments: news.attachments.map((a: any) => a.file_name),
  isPublished: news.is_published,
  isPinned: news.is_pinned,
  publishedAt: news.published_at instanceof Date ? news.published_at.toISOString() : new Date(news.published_at).toISOString(),
  createdAt: news.created_at instanceof Date ? news.created_at.toISOString() : new Date(news.created_at).toISOString(),
});

export const getNews = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user ? req.user.id : undefined;
    const isStaff = req.user && (req.user.role === 'Admin' || req.user.role === 'Editor');
    
    // Admins and editors see unpublished news as drafts
    const newsList = await NewsModel.getAllNews({
      publishedOnly: !isStaff,
      userId,
    });
    
    res.json(newsList);
  } catch (error: any) {
    console.error('Error fetching news:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const getNewsDetail = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user ? req.user.id : undefined;
    const isStaff = req.user && (req.user.role === 'Admin' || req.user.role === 'Editor');

    const news = await NewsModel.getNewsById(Number(id), userId);

    if (!news) {
      return res.status(404).json({ error: 'News not found' });
    }

    if (!isStaff && (!news.is_published || new Date(news.published_at) > new Date())) {
      return res.status(403).json({ error: 'News is not published yet.' });
    }

    if (!isStaff && userId) {
      const hasDepartmentAccess = await NewsModel.canUserAccessNews(news, userId);
      if (!hasDepartmentAccess) {
        return res.status(403).json({ error: 'News is not available for your department.' });
      }
    }

    // Auto mark as read and record view logs
    if (userId) {
      NewsModel.markNewsAsRead(news.id, userId).catch(err =>
        console.error(`Failed to mark news ${news.id} read for user ${userId}:`, err)
      );
      NewsModel.recordNewsView(news.id, userId).catch(err =>
        console.error(`Failed to record news view ${news.id} for user ${userId}:`, err)
      );
    }

    res.json(news);
  } catch (error: any) {
    console.error('Error fetching news detail:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const getUnreadCount = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const count = await NewsModel.getUnreadNewsCount(req.user.id);
    res.json({ count });
  } catch (error: any) {
    console.error('Error fetching unread news count:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const createNews = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, description, content, video_url, is_published, is_pinned, published_at, tags, images, attachments, department_ids } = req.body;
    const authorId = req.user?.id;

    if (!authorId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const isPublished = is_published === undefined ? true : !!is_published;
    const contentValue = typeof content === 'string' && content.trim().length > 0 ? content : '<p></p>';
    const hasAnyContent = hasDraftContent(contentValue) ||
      (typeof description === 'string' && description.trim().length > 0) ||
      (typeof video_url === 'string' && video_url.trim().length > 0) ||
      (Array.isArray(images) && images.length > 0) ||
      (Array.isArray(attachments) && attachments.length > 0);
    const normalizedTitle = typeof title === 'string' && title.trim().length > 0
      ? title.trim()
      : (!isPublished && hasAnyContent ? buildDraftTitle() : '');

    if (!normalizedTitle || !hasAnyContent) {
      return res.status(400).json({ error: 'Title and content are required fields.' });
    }

    const news = await NewsModel.createNews({
      title: normalizedTitle,
      description: description || '',
      content: contentValue,
      video_url: video_url || null,
      is_published: isPublished,
      is_pinned: isPublished && is_pinned !== undefined ? !!is_pinned : false,
      author_id: authorId,
      published_at: published_at ? new Date(published_at) : new Date(),
      tags: tags || [],
      images: images || [],
      attachments: attachments || [],
      department_ids: normalizeDepartmentIds(department_ids),
    });

    // Auto-index in Meilisearch
    if (news.is_published) {
      msService.indexNews(toNewsDocument(news)).catch(err =>
        console.error('Failed to auto-index news in Meilisearch:', err)
      );
    }

    res.status(201).json(news);
  } catch (error: any) {
    console.error('Error creating news:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const updateNews = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, content, video_url, is_published, is_pinned, published_at, bump_to_top, tags, images, attachments, department_ids } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const isPublished = is_published === undefined ? true : !!is_published;
    const contentValue = typeof content === 'string' && content.trim().length > 0 ? content : '<p></p>';
    const hasAnyContent = hasDraftContent(contentValue) ||
      (typeof description === 'string' && description.trim().length > 0) ||
      (typeof video_url === 'string' && video_url.trim().length > 0) ||
      (Array.isArray(images) && images.length > 0) ||
      (Array.isArray(attachments) && attachments.length > 0);
    const normalizedTitle = typeof title === 'string' && title.trim().length > 0
      ? title.trim()
      : (!isPublished && hasAnyContent ? buildDraftTitle() : '');

    if (!normalizedTitle || !hasAnyContent) {
      return res.status(400).json({ error: 'Title and content are required fields.' });
    }

    const news = await NewsModel.updateNews(Number(id), {
      title: normalizedTitle,
      description: description || '',
      content: contentValue,
      video_url: video_url || null,
      is_published: isPublished,
      is_pinned: isPublished && is_pinned !== undefined ? !!is_pinned : false,
      published_at: published_at ? new Date(published_at) : new Date(),
      bump_to_top: isPublished && !!bump_to_top,
      tags: tags || [],
      images: images || [],
      attachments: attachments || [],
      department_ids: normalizeDepartmentIds(department_ids),
    }, userId);

    if (!news) {
      return res.status(404).json({ error: 'News not found' });
    }

    // Index or delete from Meilisearch depending on published status
    if (news.is_published) {
      msService.indexNews(toNewsDocument(news)).catch(err =>
        console.error('Failed to update Meilisearch index for news:', err)
      );
    } else {
      msService.deleteNews(news.id).catch(err =>
        console.error('Failed to delete news from Meilisearch index:', err)
      );
    }

    res.json(news);
  } catch (error: any) {
    console.error('Error updating news:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const deleteNews = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const success = await NewsModel.deleteNews(Number(id));

    if (!success) {
      return res.status(404).json({ error: 'News not found' });
    }

    // Delete from Meilisearch index
    msService.deleteNews(Number(id)).catch(err =>
      console.error('Failed to delete news from Meilisearch index:', err)
    );

    res.json({ message: 'News deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting news:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const searchNews = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { q, tag } = req.query;
    const isStaff = req.user && (req.user.role === 'Admin' || req.user.role === 'Editor');

    let results = await msService.searchNews(
      (q as string) || '',
      tag as string,
      isStaff
    );

    if (!isStaff && req.user) {
      const allowedNews = await NewsModel.getAllNews({
        publishedOnly: true,
        userId: req.user.id,
      });
      const allowedIds = new Set(allowedNews.map((news) => news.id));
      results = results.filter((result) => allowedIds.has(result.id));
    }

    res.json(results);
  } catch (error: any) {
    console.error('Meilisearch search news failed:', error);
    res.status(500).json({ error: 'Search Service Unavailable', details: error.message });
  }
};

export const uploadAttachment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }
    
    // Convert to base64 data URL
    const fileBuffer = await fs.promises.readFile(req.file.path);
    const base64 = fileBuffer.toString('base64');
    const fileUrl = `data:${req.file.mimetype};base64,${base64}`;
    
    // Delete the file from the ephemeral disk
    await fs.promises.unlink(req.file.path).catch(err => {
      console.error('Failed to delete temp file:', err);
    });

    res.status(201).json({
      message: 'Attachment uploaded successfully',
      file_url: fileUrl,
      file_name: req.file.originalname,
      file_size: req.file.size,
    });
  } catch (error: any) {
    console.error('Attachment upload failed:', error);
    res.status(500).json({ error: 'Attachment upload failed', details: error.message });
  }
};
