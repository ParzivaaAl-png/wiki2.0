import { Request, Response } from 'express';
import { query } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';

export const getGuestAccessList = async (req: Request, res: Response) => {
  try {
    const sql = `
      SELECT ga.*, 
             u.username as user_name, u.name as user_full_name,
             a.title as article_title,
             s.name as section_name,
             g.name as granted_by_name
      FROM guest_access ga
      LEFT JOIN users u ON ga.user_id = u.id
      LEFT JOIN articles a ON ga.article_id = a.id
      LEFT JOIN sections s ON ga.section_id = s.id
      LEFT JOIN users g ON ga.granted_by = g.id
      ORDER BY ga.created_at DESC
    `;
    const result = await query(sql);
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const createGuestAccess = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const adminId = authReq.user ? authReq.user.id : null;
    const { user_id, article_id, section_id, expires_at } = req.body;

    if (!user_id || !expires_at) {
      return res.status(400).json({ error: 'Пользователь и дата истечения обязательны.' });
    }

    if (!article_id && !section_id) {
      return res.status(400).json({ error: 'Необходимо указать статью или раздел для доступа.' });
    }

    const sql = `
      INSERT INTO guest_access (user_id, article_id, section_id, granted_by, expires_at, status)
      VALUES ($1, $2, $3, $4, $5, 'Active')
      RETURNING *
    `;
    const result = await query(sql, [
      user_id,
      article_id || null,
      section_id || null,
      adminId,
      expires_at
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const deleteGuestAccess = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM guest_access WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Гостевой доступ не найден.' });
    }
    res.json({ message: 'Гостевой доступ успешно отозван.' });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};
