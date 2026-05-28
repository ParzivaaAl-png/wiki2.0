import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as UserModel from '../models/user';
import { AuthenticatedRequest } from '../middleware/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_wiki20';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'super_secret_refresh_key_wiki20';

const generateTokens = (userId: number) => {
  const accessToken = jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ id: userId }, REFRESH_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
};

const setCookieOptions = (maxAgeMs: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
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
    
    res.cookie('accessToken', accessToken, setCookieOptions(15 * 60 * 1000));
    res.cookie('refreshToken', refreshToken, setCookieOptions(7 * 24 * 60 * 60 * 1000));

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
    
    res.cookie('accessToken', accessToken, setCookieOptions(15 * 60 * 1000));
    res.cookie('refreshToken', refreshToken, setCookieOptions(7 * 24 * 60 * 60 * 1000));

    const userResponse = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      is_blocked: user.is_blocked,
    };

    res.json({ user: userResponse, accessToken });
  } catch (error: any) {
    console.error('Login failed:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const logout = (req: Request, res: Response) => {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out successfully' });
};

export const refresh = async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required.' });
    }

    const decoded = jwt.verify(refreshToken, REFRESH_SECRET) as any;
    const user = await UserModel.getUserById(decoded.id);

    if (!user || user.is_blocked) {
      return res.status(401).json({ error: 'Invalid user session or user is blocked.' });
    }

    const tokens = generateTokens(user.id);
    
    res.cookie('accessToken', tokens.accessToken, setCookieOptions(15 * 60 * 1000));
    res.cookie('refreshToken', tokens.refreshToken, setCookieOptions(7 * 24 * 60 * 60 * 1000));

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
