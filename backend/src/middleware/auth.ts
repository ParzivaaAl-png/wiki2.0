import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getUserById } from '../models/user';
import { getUserCapabilities } from '../services/accessControl';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_wiki20';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    username: string;
    name: string;
    role: string;
    must_change_password?: boolean;
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


    req.user = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      must_change_password: user.must_change_password,
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
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const mappedRoles = new Set<string>();
    allowedRoles.forEach((r) => {
      if (r === 'Admin') {
        mappedRoles.add('Admin');
        mappedRoles.add('Администратор Wiki');
      } else if (r === 'Editor') {
        mappedRoles.add('Editor');
        mappedRoles.add('Администратор Wiki');
        mappedRoles.add('Коммерческий директор');
        mappedRoles.add('Руководитель группы');
        mappedRoles.add('Супервайзер');
        mappedRoles.add('HR-менеджер');
        mappedRoles.add('IT-специалист');
        mappedRoles.add('Бухгалтер');
      } else if (r === 'User') {
        mappedRoles.add('User');
        mappedRoles.add('Оператор');
      } else {
        mappedRoles.add(r);
      }
    });

    if (!mappedRoles.has(req.user.role)) {
      try {
        const { capabilities } = await getUserCapabilities(req.user.id, req.user.role);
        const hasAdminAccess = allowedRoles.includes('Admin') && (
          capabilities.can_manage_access ||
          capabilities.can_manage_structure ||
          capabilities.can_manage_users
        );
        const hasEditorAccess = allowedRoles.includes('Editor') && (
          capabilities.can_create ||
          capabilities.can_edit ||
          capabilities.can_publish ||
          capabilities.can_approve
        );
        const hasUserAccess = allowedRoles.includes('User') && capabilities.can_read;

        if (!hasAdminAccess && !hasEditorAccess && !hasUserAccess) {
          return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
        }
      } catch (error) {
        console.error('Failed to resolve Wiki role permissions:', error);
        return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
      }
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
        req.user = {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
          must_change_password: user.must_change_password,
          employee_id: (user as any).employee_id,
        };
      }
    }
  } catch (error) {
    // Ignore error, proceed without req.user
  }
  next();
};
