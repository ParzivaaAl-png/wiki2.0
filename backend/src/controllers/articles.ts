import { Request, Response } from 'express';
import * as ArticleModel from '../models/article';
import * as esService from '../services/elasticsearch';

export const getArticles = async (req: Request, res: Response) => {
  try {
    const { category, tag, all } = req.query;
    
    const articles = await ArticleModel.getAllArticles({
      publishedOnly: all === 'true' ? false : true,
      categorySlug: category as string,
      tag: tag as string,
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
    const { title, slug, content, summary, category_id, published, tags } = req.body;
    
    if (!title || !slug || !content) {
      return res.status(400).json({ error: 'Title, slug, and content are required fields.' });
    }

    const article = await ArticleModel.createArticle({
      title,
      slug,
      content,
      summary: summary || '',
      category_id: category_id ? Number(category_id) : null,
      published: published === undefined ? true : !!published,
      tags: tags || [],
    });

    // Auto-index to Elasticsearch
    if (article.published) {
      const doc: esService.ArticleDocument = {
        id: article.id,
        title: article.title,
        slug: article.slug,
        content: article.content,
        summary: article.summary,
        categoryName: article.category_slug || '',
        tags: article.tags,
        published: article.published,
        createdAt: article.created_at.toISOString(),
      };
      // ES operation runs in background so as to not block client response
      esService.indexArticle(doc).catch(err => 
        console.error('Failed to auto-index new article to ES:', err)
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
    const { title, slug, content, summary, category_id, published, tags } = req.body;

    if (!title || !slug || !content) {
      return res.status(400).json({ error: 'Title, slug, and content are required.' });
    }

    const article = await ArticleModel.updateArticle(Number(id), {
      title,
      slug,
      content,
      summary: summary || '',
      category_id: category_id ? Number(category_id) : null,
      published: published === undefined ? true : !!published,
      tags: tags || [],
    });

    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    // Auto-index or delete from Elasticsearch depending on published status
    if (article.published) {
      const doc: esService.ArticleDocument = {
        id: article.id,
        title: article.title,
        slug: article.slug,
        content: article.content,
        summary: article.summary,
        categoryName: article.category_slug || '',
        tags: article.tags,
        published: article.published,
        createdAt: article.created_at.toISOString(),
      };
      esService.indexArticle(doc).catch(err => 
        console.error('Failed to update ES index for article:', err)
      );
    } else {
      // If unpublished, make sure it is removed from index
      esService.deleteArticle(article.id).catch(err =>
        console.error('Failed to remove unpublished article from ES:', err)
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

    // Remove from Elasticsearch
    esService.deleteArticle(Number(id)).catch(err =>
      console.error('Failed to delete article from ES index:', err)
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
    
    const results = await esService.searchArticles(
      (q as string) || '',
      category as string,
      tag as string
    );
    
    res.json(results);
  } catch (error: any) {
    console.error('Elasticsearch search request failed:', error);
    res.status(500).json({ error: 'Search Service Unavailable', details: error.message });
  }
};

export const suggestArticles = async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    
    const results = await esService.suggestArticles((q as string) || '');
    
    res.json(results);
  } catch (error: any) {
    console.error('Elasticsearch suggestions request failed:', error);
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
