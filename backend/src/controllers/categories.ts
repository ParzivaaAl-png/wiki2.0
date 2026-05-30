import { Request, Response } from 'express';
import * as CategoryModel from '../models/category';
import * as ArticleModel from '../models/article';
import { triggerFullSync } from '../services/meilisearch';

export const getCategories = async (req: Request, res: Response) => {
  try {
    const { all } = req.query;
    const includeHidden = all === 'true';
    const categories = await CategoryModel.getAllCategories(includeHidden);
    res.json(categories);
  } catch (error: any) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const getCategory = async (req: Request, res: Response) => {
  try {
    const { idOrSlug } = req.params;
    let category = null;
    
    if (isNaN(Number(idOrSlug))) {
      category = await CategoryModel.getCategoryBySlug(idOrSlug);
    } else {
      category = await CategoryModel.getCategoryById(Number(idOrSlug));
    }

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.json(category);
  } catch (error: any) {
    console.error('Error fetching category:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const createCategory = async (req: Request, res: Response) => {
  try {
    const { name, slug, icon, description, position, is_visible, color, content } = req.body;
    if (!name || !slug || !icon) {
      return res.status(400).json({ error: 'Name, slug, and icon are required fields.' });
    }

    const category = await CategoryModel.createCategory(
      name,
      slug,
      icon,
      description,
      position || 0,
      is_visible !== undefined ? !!is_visible : true,
      color || '#6366f1'
    );

    // If initial article content is provided, create the introduction article
    if (content && content.trim()) {
      try {
        await ArticleModel.createArticle({
          title: 'Введение',
          slug: `${slug}-intro`,
          content: content,
          summary: `Вводная статья для раздела ${name}`,
          category_id: category.id,
          published: true,
          tags: [],
        });
        
        // Trigger full sync in background to update search index with new article
        triggerFullSync().catch(err => console.error('Failed to sync Meilisearch after default article creation:', err));
      } catch (articleErr) {
        console.error('Failed to create default article for category:', articleErr);
        // We still return the category because the category itself was created successfully
      }
    }

    res.status(201).json(category);
  } catch (error: any) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const updateCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, slug, icon, description, position, is_visible, color } = req.body;
    if (!name || !slug || !icon) {
      return res.status(400).json({ error: 'Name, slug, and icon are required fields.' });
    }

    const category = await CategoryModel.updateCategory(
      Number(id),
      name,
      slug,
      icon,
      description,
      position || 0,
      is_visible !== undefined ? !!is_visible : true,
      color || '#6366f1'
    );
    
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    // Trigger Meilisearch re-sync in background to reflect new category details/slugs
    triggerFullSync().catch(err => console.error('Failed to sync Meilisearch after category update:', err));

    res.json(category);
  } catch (error: any) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const reorderCategories = async (req: Request, res: Response) => {
  try {
    const { orders } = req.body; // array of { id: number, position: number }
    if (!orders || !Array.isArray(orders)) {
      return res.status(400).json({ error: 'Orders array is required.' });
    }

    for (const item of orders) {
      await CategoryModel.updateCategoryPosition(Number(item.id), Number(item.position));
    }

    res.json({ message: 'Categories reordered successfully' });
  } catch (error: any) {
    console.error('Error reordering categories:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = await CategoryModel.deleteCategory(Number(id));
    if (!success) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    // Trigger Meilisearch re-sync in background to clear category associations
    triggerFullSync().catch(err => console.error('Failed to sync Meilisearch after category deletion:', err));

    res.json({ message: 'Category deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};
