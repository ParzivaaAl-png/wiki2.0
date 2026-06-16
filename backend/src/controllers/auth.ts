import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as UserModel from '../models/user';
import { AuthenticatedRequest } from '../middleware/auth';
import { query, pool } from '../config/db';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_wiki20';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'super_secret_refresh_key_wiki20';

const generateTokens = (userId: number) => {
  const accessToken = jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ id: userId }, REFRESH_SECRET);
  return { accessToken, refreshToken };
};

// 100 years in milliseconds for practically infinite session lifetime
const INFINITE_COOKIE_AGE = 100 * 365 * 24 * 60 * 60 * 1000;

const setCookieOptions = (maxAgeMs: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production' ? true : false,
  sameSite: process.env.NODE_ENV === 'production' ? ('none' as const) : ('lax' as const),
  maxAge: maxAgeMs,
});

export const register = async (req: Request, res: Response) => {
  try {
    const { username, password, name } = req.body;
    if (!username || !password || !name) {
      return res.status(400).json({ error: 'Все поля (имя пользователя, пароль, имя) обязательны.' });
    }

    const existingUser = await UserModel.getUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ error: 'Пользователь с таким именем уже существует.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await UserModel.createUser(username, passwordHash, name, 'User');
    
    const { accessToken, refreshToken } = generateTokens(user.id);
    
    const rawIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || req.ip || '';
    const ipAddress = rawIp.split(',')[0].trim();
    const userAgent = req.headers['user-agent'] || '';
    
    // Save session in DB
    await query(
      'INSERT INTO user_sessions (user_id, refresh_token, ip_address, user_agent) VALUES ($1, $2, $3, $4)',
      [user.id, refreshToken, ipAddress, userAgent]
    );

    res.cookie('accessToken', accessToken, setCookieOptions(15 * 60 * 1000));
    res.cookie('refreshToken', refreshToken, setCookieOptions(INFINITE_COOKIE_AGE));

    res.status(201).json({ user, accessToken });
  } catch (error: any) {
    console.error('Registration failed:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Имя пользователя (логин) и пароль обязательны.' });
    }

    const user = await UserModel.getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: 'Неверное имя пользователя или пароль.' });
    }

    if (user.is_blocked) {
      return res.status(403).json({ error: 'Ваша учетная запись заблокирована.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Неверное имя пользователя или пароль.' });
    }


    const { accessToken, refreshToken } = generateTokens(user.id);
    
    const rawIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || req.ip || '';
    const ipAddress = rawIp.split(',')[0].trim();
    const userAgent = req.headers['user-agent'] || '';
    
    // Save session in DB
    await query(
      'INSERT INTO user_sessions (user_id, refresh_token, ip_address, user_agent) VALUES ($1, $2, $3, $4)',
      [user.id, refreshToken, ipAddress, userAgent]
    );

    res.cookie('accessToken', accessToken, setCookieOptions(15 * 60 * 1000));
    res.cookie('refreshToken', refreshToken, setCookieOptions(INFINITE_COOKIE_AGE));

    const userResponse = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      is_blocked: user.is_blocked,
      employee_id: (user as any).employee_id,
    };

    res.json({ user: userResponse, accessToken });
  } catch (error: any) {
    console.error('Login failed:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
    if (refreshToken) {
      await query('DELETE FROM user_sessions WHERE refresh_token = $1', [refreshToken]);
    }
  } catch (error) {
    console.error('Logout db cleanup failed:', error);
  }
  res.clearCookie('accessToken', setCookieOptions(0));
  res.clearCookie('refreshToken', setCookieOptions(0));
  res.json({ message: 'Logged out successfully' });
};

export const refresh = async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required.' });
    }

    const decoded = jwt.verify(refreshToken, REFRESH_SECRET) as any;
    
    // Check if session exists in DB
    const sessionRes = await query('SELECT * FROM user_sessions WHERE refresh_token = $1', [refreshToken]);
    if (sessionRes.rowCount === 0) {
      return res.status(401).json({ error: 'Session not found or revoked.' });
    }

    const user = await UserModel.getUserById(decoded.id);

    if (!user || user.is_blocked) {
      // Clean up invalid session
      await query('DELETE FROM user_sessions WHERE refresh_token = $1', [refreshToken]);
      return res.status(401).json({ error: 'Invalid user session or user is blocked.' });
    }


    const tokens = generateTokens(user.id);
    
    const rawIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || req.ip || '';
    const ipAddress = rawIp.split(',')[0].trim();
    const userAgent = req.headers['user-agent'] || '';

    // Update session with new refresh token
    await query(
      'UPDATE user_sessions SET refresh_token = $1, last_active_at = CURRENT_TIMESTAMP, ip_address = $2, user_agent = $3 WHERE refresh_token = $4',
      [tokens.refreshToken, ipAddress, userAgent, refreshToken]
    );

    res.cookie('accessToken', tokens.accessToken, setCookieOptions(15 * 60 * 1000));
    res.cookie('refreshToken', tokens.refreshToken, setCookieOptions(INFINITE_COOKIE_AGE));

    res.json({ accessToken: tokens.accessToken });
  } catch (error: any) {
    res.status(401).json({ error: 'Invalid refresh token session.' });
  }
};

export const getMe = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  res.json(req.user);
};

// ADMIN CONTROLLERS
export const getUsersList = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const users = await UserModel.getAllUsers();
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const createUserByAdmin = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { username, password, name, role } = req.body;
    if (!username || !password || !name) {
      return res.status(400).json({ error: 'Имя пользователя (логин), пароль и имя обязательны.' });
    }

    const existingUser = await UserModel.getUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ error: 'Пользователь с таким логином уже существует.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await UserModel.createUser(username, passwordHash, name, role || 'User');
    res.status(201).json(user);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const toggleBlockUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { is_blocked } = req.body;
    
    if (req.user?.id === Number(id)) {
      return res.status(400).json({ error: 'You cannot block your own account.' });
    }

    const success = await UserModel.blockUser(Number(id), !!is_blocked);
    if (!success) return res.status(404).json({ error: 'User not found.' });

    res.json({ message: `User account has been ${is_blocked ? 'blocked' : 'unblocked'}` });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const changeRole = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role || !['Admin', 'Editor', 'User'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role type. Must be Admin, Editor, or User.' });
    }

    if (req.user?.id === Number(id)) {
      return res.status(400).json({ error: 'You cannot change your own role.' });
    }

    const success = await UserModel.changeUserRole(Number(id), role);
    if (!success) return res.status(404).json({ error: 'User not found.' });

    res.json({ message: 'User role updated successfully.' });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const deleteUserByAdmin = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (req.user?.id === Number(id)) {
      return res.status(400).json({ error: 'You cannot delete your own account.' });
    }

    const success = await UserModel.deleteUser(Number(id));
    if (!success) return res.status(404).json({ error: 'User not found.' });

    res.json({ message: 'User deleted successfully.' });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const resetPasswordByAdmin = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const success = await UserModel.resetUserPassword(Number(id), passwordHash);
    if (!success) return res.status(404).json({ error: 'User not found.' });

    res.json({ message: 'User password reset successfully.' });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

// SESSIONS AND AUDIT LOGS ADMIN CONTROLLERS
export const getUserSessions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const usersRes = await UserModel.getAllUsers();
    const sessionsRes = await query(
      'SELECT id, user_id, ip_address, user_agent, created_at, last_active_at FROM user_sessions ORDER BY last_active_at DESC'
    );

    const sessionsGrouped = sessionsRes.rows;

    const result = usersRes.map(u => ({
      id: u.id,
      username: u.username,
      name: u.name,
      role: u.role,
      is_blocked: u.is_blocked,
      sessions: sessionsGrouped.filter(s => s.user_id === u.id)
    }));

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const deleteUserSession = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM user_sessions WHERE id = $1 RETURNING user_id', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Сессия не найдена.' });
    }
    res.json({ message: 'Сессия успешно завершена.' });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const updateUserByAdmin = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { username, name, password } = req.body;
    const adminId = req.user?.id;

    if (!username || !name) {
      return res.status(400).json({ error: 'Логин и ФИО обязательны.' });
    }

    const user = await UserModel.getUserById(Number(id));
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден.' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check username collision
      if (username !== user.username) {
        const existing = await UserModel.getUserByUsername(username);
        if (existing) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Пользователь с таким логином уже существует.' });
        }
        
        await client.query(
          'UPDATE users SET username = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [username, id]
        );
        await client.query(
          'INSERT INTO user_audit_logs (user_id, changed_by, field_changed, old_value, new_value) VALUES ($1, $2, $3, $4, $5)',
          [id, adminId, 'username', user.username, username]
        );
      }

      if (name !== user.name) {
        await client.query(
          'UPDATE users SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [name, id]
        );
        await client.query(
          'INSERT INTO user_audit_logs (user_id, changed_by, field_changed, old_value, new_value) VALUES ($1, $2, $3, $4, $5)',
          [id, adminId, 'name', user.name, name]
        );
      }

      if (password) {
        if (password.length < 6) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Пароль должен быть не менее 6 символов.' });
        }
        const passwordHash = await bcrypt.hash(password, 10);
        await client.query(
          'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [passwordHash, id]
        );
        await client.query(
          'INSERT INTO user_audit_logs (user_id, changed_by, field_changed, old_value, new_value) VALUES ($1, $2, $3, $4, $5)',
          [id, adminId, 'password', '***', '***']
        );
      }

      await client.query('COMMIT');
      
      const updatedUser = await UserModel.getUserById(Number(id));
      res.json(updatedUser);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const getUserHistory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const history = await query(
      `SELECT h.id, h.field_changed, h.old_value, h.new_value, h.changed_at, u.username as changed_by_username, u.name as changed_by_name
       FROM user_audit_logs h 
       LEFT JOIN users u ON h.changed_by = u.id 
       WHERE h.user_id = $1 
       ORDER BY h.changed_at DESC`,
      [id]
    );
    res.json(history.rows);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const getFavoriteArticles = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const userId = req.user.id;
    
    const favsRes = await query(
      `SELECT a.*, fa.created_at as favorited_at, u.name as author_name,
              COALESCE(array_agg(t.tag_name) FILTER (WHERE t.tag_name IS NOT NULL), '{}') as tags
       FROM user_favorite_articles fa
       JOIN articles a ON fa.article_id = a.id
       LEFT JOIN users u ON a.author_id = u.id
       LEFT JOIN article_tags t ON a.id = t.article_id
       WHERE fa.user_id = $1 AND a.is_visible = true
       GROUP BY a.id, fa.position, fa.created_at, u.name
       ORDER BY fa.position ASC`,
      [userId]
    );
    res.json(favsRes.rows);
  } catch (error: any) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const setFavoriteArticles = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const userId = req.user.id;
    const { articleIds } = req.body; // array of numbers
    
    if (!articleIds || !Array.isArray(articleIds)) {
      return res.status(400).json({ error: 'articleIds array is required.' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Get current favorites
      const currentRes = await client.query('SELECT article_id FROM user_favorite_articles WHERE user_id = $1', [userId]);
      const currentIds = currentRes.rows.map(r => Number(r.article_id));
      
      const newIds = articleIds.map(id => Number(id));
      
      // Delete favorites not in new list
      const idsToDelete = currentIds.filter(id => !newIds.includes(id));
      if (idsToDelete.length > 0) {
        await client.query('DELETE FROM user_favorite_articles WHERE user_id = $1 AND article_id = ANY($2::int[])', [userId, idsToDelete]);
      }
      
      // Upsert new favorites preserving their created_at if already exists
      if (newIds.length > 0) {
        for (let i = 0; i < newIds.length; i++) {
          await client.query(
            `INSERT INTO user_favorite_articles (user_id, article_id, position)
             VALUES ($1, $2, $3)
             ON CONFLICT (user_id, article_id) DO UPDATE SET position = $3`,
            [userId, newIds[i], i]
          );
        }
      }
      
      await client.query('COMMIT');
      res.json({ message: 'Favorites updated successfully' });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Error setting favorites:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const addFavoriteArticle = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const userId = req.user.id;
    const { articleId } = req.body;
    
    if (!articleId) return res.status(400).json({ error: 'articleId is required.' });
    
    // Find next position
    const posRes = await query('SELECT COALESCE(MAX(position), -1) as max_pos FROM user_favorite_articles WHERE user_id = $1', [userId]);
    const nextPos = posRes.rows[0].max_pos + 1;
    
    await query(`
      INSERT INTO user_favorite_articles (user_id, article_id, position)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, article_id) DO NOTHING
    `, [userId, Number(articleId), nextPos]);
    
    res.json({ message: 'Article added to favorites' });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const removeFavoriteArticle = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const userId = req.user.id;
    const { articleId } = req.body;
    
    if (!articleId) return res.status(400).json({ error: 'articleId is required.' });
    
    await query(
      'DELETE FROM user_favorite_articles WHERE user_id = $1 AND article_id = $2',
      [userId, Number(articleId)]
    );
    
    res.json({ message: 'Article removed from favorites' });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const getReadingHistory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const userId = req.user.id;
    
    const historyRes = await query(
      `SELECT h.viewed_at, a.*, u.name as author_name,
              COALESCE(array_agg(t.tag_name) FILTER (WHERE t.tag_name IS NOT NULL), '{}') as tags
       FROM user_reading_history h
       JOIN articles a ON h.article_id = a.id
       LEFT JOIN users u ON a.author_id = u.id
       LEFT JOIN article_tags t ON a.id = t.article_id
       WHERE h.user_id = $1 AND a.is_visible = true
       GROUP BY a.id, h.viewed_at, u.name
       ORDER BY h.viewed_at DESC
       LIMIT 20`,
      [userId]
    );
    res.json(historyRes.rows);
  } catch (error: any) {
    console.error('Error fetching reading history:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const clearReadingHistory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const userId = req.user.id;
    
    await query('DELETE FROM user_reading_history WHERE user_id = $1', [userId]);
    res.json({ message: 'Reading history cleared successfully' });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};
