import { Request, Response } from 'express';
import * as CategoryModel from '../models/category';
import { triggerFullSync } from '../services/meilisearch';

export const getCategories = async (req: Request, res: Response) => {
  try {
    const categories = await CategoryModel.getAllCategories();
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
    const { name, slug, icon, description, position } = req.body;
    if (!name || !slug || !icon) {
      return res.status(400).json({ error: 'Name, slug, and icon are required fields.' });
    }

    const category = await CategoryModel.createCategory(name, slug, icon, description, position || 0);
    res.status(201).json(category);
  } catch (error: any) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const updateCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, slug, icon, description, position } = req.body;
    if (!name || !slug || !icon) {
      return res.status(400).json({ error: 'Name, slug, and icon are required fields.' });
    }

    const category = await CategoryModel.updateCategory(Number(id), name, slug, icon, description, position || 0);
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
