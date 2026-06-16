import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getUserById } from '../models/user';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_wiki20';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    username: string;
    name: string;
    role: string;
    employee_id?: number | null;
  };
}

export const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    let token = '';

    // Check authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    // Check cookies as fallback
    else if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Check if user exists and is not blocked
    const user = await getUserById(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (user.is_blocked) {
      return res.status(403).json({ error: 'User account is blocked' });
    }

    // IP restriction for User role (89.107.98.195)
    if (user.role === 'User') {
      const rawIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || req.ip || '';
      const ipAddress = rawIp.split(',')[0].trim();
      const isAllowed = ipAddress === '89.107.98.195' || 
                        ipAddress === '127.0.0.1' || 
                        ipAddress === '::1' || 
                        ipAddress === '::ffff:127.0.0.1';
      if (!isAllowed) {
        return res.status(403).json({ error: 'Доступ ограничен: Вход разрешен только с определенного IP адреса.' });
      }
    }

    req.user = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      employee_id: (user as any).employee_id,
    };

    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid or malformed token' });
  }
};

export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }

    next();
  };
};

export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    let token = '';

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      const user = await getUserById(decoded.id);
      if (user && !user.is_blocked) {
        let isAllowed = true;
        if (user.role === 'User') {
          const rawIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || req.ip || '';
          const ipAddress = rawIp.split(',')[0].trim();
          isAllowed = ipAddress === '89.107.98.195' || 
                      ipAddress === '127.0.0.1' || 
                      ipAddress === '::1' || 
                      ipAddress === '::ffff:127.0.0.1';
        }

        if (isAllowed) {
          req.user = {
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role,
            employee_id: (user as any).employee_id,
          };
        }
      }
    }
  } catch (error) {
    // Ignore error, proceed without req.user
  }
  next();
};
