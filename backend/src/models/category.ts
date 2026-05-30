import { query } from '../config/db';

export interface Category {
  id: number;
  name: string;
  slug: string;
  icon: string;
  description: string;
  position: number;
  is_visible: boolean;
  color: string;
  article_count?: number;
}

export const getAllCategories = async (includeHidden = false): Promise<Category[]> => {
  const sql = `
    SELECT c.*, COUNT(a.id)::int as article_count 
    FROM categories c
    LEFT JOIN articles a ON a.category_id = c.id AND a.published = true AND a.slug NOT LIKE 'auto-list-%'
    ${includeHidden ? '' : 'WHERE c.is_visible = true'}
    GROUP BY c.id
    ORDER BY c.position ASC, c.name ASC
  `;
  const res = await query(sql);
  return res.rows;
};

export const getCategoryById = async (id: number): Promise<Category | null> => {
  const sql = 'SELECT * FROM categories WHERE id = $1';
  const res = await query(sql, [id]);
  return res.rows.length ? res.rows[0] : null;
};

export const getCategoryBySlug = async (slug: string): Promise<Category | null> => {
  const sql = 'SELECT * FROM categories WHERE slug = $1';
  const res = await query(sql, [slug]);
  return res.rows.length ? res.rows[0] : null;
};

export const createCategory = async (
  name: string,
  slug: string,
  icon: string,
  description: string,
  position = 0,
  is_visible = true,
  color = '#6366f1'
): Promise<Category> => {
  const sql = `
    INSERT INTO categories (name, slug, icon, description, position, is_visible, color)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `;
  const res = await query(sql, [name, slug, icon, description, position, is_visible, color]);
  return res.rows[0];
};

export const updateCategory = async (
  id: number,
  name: string,
  slug: string,
  icon: string,
  description: string,
  position = 0,
  is_visible = true,
  color = '#6366f1'
): Promise<Category | null> => {
  const sql = `
    UPDATE categories
    SET name = $1, slug = $2, icon = $3, description = $4, position = $5, is_visible = $6, color = $7
    WHERE id = $8
    RETURNING *
  `;
  const res = await query(sql, [name, slug, icon, description, position, is_visible, color, id]);
  return res.rows.length ? res.rows[0] : null;
};

export const updateCategoryPosition = async (id: number, position: number): Promise<void> => {
  await query('UPDATE categories SET position = $1 WHERE id = $2', [position, id]);
};

export const deleteCategory = async (id: number): Promise<boolean> => {
  const sql = 'DELETE FROM categories WHERE id = $1';
  const res = await query(sql, [id]);
  return (res.rowCount ?? 0) > 0;
};
