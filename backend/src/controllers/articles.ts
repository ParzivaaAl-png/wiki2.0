import { Request, Response } from 'express';
import * as fs from 'fs';
import * as ArticleModel from '../models/article';
import * as msService from '../services/meilisearch';
import { parseDocument } from '../services/parser';
import { AuthenticatedRequest } from '../middleware/auth';

export const getArticles = async (req: Request, res: Response) => {
  try {
    const { tag, all } = req.query;
    
    const articles = await ArticleModel.getAllArticles({
      publishedOnly: all === 'true' ? false : true,
      tag: tag as string,
      all: all === 'true',
    });
    
    res.json(articles);
  } catch (error: any) {
    console.error('Error fetching articles:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const getArticle = async (req: Request, res: Response) => {
  try {
    const { slugOrId } = req.params;
    let article = null;
    
    if (isNaN(Number(slugOrId))) {
      article = await ArticleModel.getArticleBySlug(slugOrId);
    } else {
      article = await ArticleModel.getArticleById(Number(slugOrId));
    }

    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    // Increment view count in background
    ArticleModel.incrementArticleViews(article.id).catch(err => 
      console.error(`Failed to increment views for article ${article?.id}:`, err)
    );

    res.json(article);
  } catch (error: any) {
    console.error('Error fetching article:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const createArticle = async (req: Request, res: Response) => {
  try {
    const { title, slug, content, summary, published, tags, position, is_visible } = req.body;
    
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
    const { title, slug, content, summary, published, tags, position, is_visible } = req.body;

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
    });

    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

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
    
    // Construct public url
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const imageUrl = `${baseUrl}/uploads/${req.file.filename}`;
    
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
