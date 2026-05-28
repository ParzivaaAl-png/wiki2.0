import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import rateLimit from 'express-rate-limit';

import * as articlesController from '../controllers/articles';
import * as categoriesController from '../controllers/categories';
import * as authController from '../controllers/auth';
import { requireAuth, requireRole } from '../middleware/auth';

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Config for Disk Storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit (allow documents)
  fileFilter: (req, file, cb) => {
    // Allow images and documents
    const allowedExtensions = /jpeg|jpg|png|gif|webp|pdf|docx|txt|xlsx|csv/;
    const extName = allowedExtensions.test(path.extname(file.originalname).toLowerCase());
    const mimeType = allowedExtensions.test(file.mimetype) || file.originalname.endsWith('.docx') || file.originalname.endsWith('.xlsx') || file.originalname.endsWith('.csv');
    
    if (extName || mimeType) {
      cb(null, true);
    } else {
      cb(new Error('Format not supported. Only images and docs (pdf, docx, txt, xlsx, csv) are allowed.'));
    }
  },
});

// Rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 25, // limit each IP to 25 attempts
  message: { error: 'Too many authentication requests. Please try again in 15 minutes.' },
});

const router = Router();

// Authentication Routes
router.post('/auth/login', authLimiter, authController.login);
router.post('/auth/logout', authController.logout);
router.post('/auth/refresh', authController.refresh);
router.get('/auth/me', requireAuth, authController.getMe);

// Search routes
router.get('/search', requireAuth, articlesController.searchArticles);
router.get('/search/suggest', requireAuth, articlesController.suggestArticles);

// Article routes (Read-only for public, writes protected)
router.get('/articles', articlesController.getArticles);
router.get('/articles/:slugOrId', articlesController.getArticle);
router.post('/articles', requireAuth, requireRole(['Admin', 'Editor']), articlesController.createArticle);
router.put('/articles/:id', requireAuth, requireRole(['Admin', 'Editor']), articlesController.updateArticle);
router.delete('/articles/:id', requireAuth, requireRole(['Admin', 'Editor']), articlesController.deleteArticle);

// Category routes (Read-only for public, writes protected)
router.get('/categories', categoriesController.getCategories);
router.get('/categories/:idOrSlug', categoriesController.getCategory);
router.post('/categories', requireAuth, requireRole(['Admin', 'Editor']), categoriesController.createCategory);
router.put('/categories/:id', requireAuth, requireRole(['Admin', 'Editor']), categoriesController.updateCategory);
router.delete('/categories/:id', requireAuth, requireRole(['Admin', 'Editor']), categoriesController.deleteCategory);

// Image/File upload & import route
router.post('/upload', requireAuth, requireRole(['Admin', 'Editor']), upload.single('image'), articlesController.uploadImage);
router.post('/articles/import', requireAuth, requireRole(['Admin', 'Editor']), upload.single('file'), articlesController.importArticle);

// Admin User Management Routes
router.get('/admin/users', requireAuth, requireRole(['Admin']), authController.getUsersList);
router.post('/admin/users', requireAuth, requireRole(['Admin']), authController.createUserByAdmin);
router.put('/admin/users/:id/role', requireAuth, requireRole(['Admin']), authController.changeRole);
router.put('/admin/users/:id/block', requireAuth, requireRole(['Admin']), authController.toggleBlockUser);
router.put('/admin/users/:id/reset-password', requireAuth, requireRole(['Admin']), authController.resetPasswordByAdmin);
router.delete('/admin/users/:id', requireAuth, requireRole(['Admin']), authController.deleteUserByAdmin);

export default router;
