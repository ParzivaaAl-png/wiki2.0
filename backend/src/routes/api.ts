import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import rateLimit from 'express-rate-limit';

import * as articlesController from '../controllers/articles';
import * as authController from '../controllers/auth';
import * as newsController from '../controllers/news';
import * as orgStructureController from '../controllers/orgStructure';
import * as guestAccessController from '../controllers/guestAccess';
import * as analyticsController from '../controllers/analytics';
import * as accessControlController from '../controllers/accessControl';
import { requireAuth, requireRole, optionalAuth } from '../middleware/auth';

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
    const allowedExtensions = /jpeg|jpg|png|gif|webp|pdf|docx|txt|xlsx|csv|zip/;
    const extName = allowedExtensions.test(path.extname(file.originalname).toLowerCase());
    const mimeType = allowedExtensions.test(file.mimetype) || 
                     file.originalname.endsWith('.docx') || 
                     file.originalname.endsWith('.xlsx') || 
                     file.originalname.endsWith('.csv') ||
                     file.originalname.endsWith('.zip');
    
    if (extName || mimeType) {
      cb(null, true);
    } else {
      cb(new Error('Format not supported. Only images and docs (pdf, docx, txt, xlsx, csv, zip) are allowed.'));
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
router.get('/users/me/favorites', requireAuth, authController.getFavoriteArticles);
router.post('/users/me/favorites', requireAuth, authController.setFavoriteArticles);
router.post('/users/me/favorites/add', requireAuth, authController.addFavoriteArticle);
router.post('/users/me/favorites/remove', requireAuth, authController.removeFavoriteArticle);
router.get('/users/me/history', requireAuth, authController.getReadingHistory);
router.post('/users/me/history/clear', requireAuth, authController.clearReadingHistory);

// Search routes (public — no auth required; results already filtered by published=true)
router.get('/search', articlesController.searchArticles);
router.get('/search/suggest', articlesController.suggestArticles);

// Classifier routes (public)
router.get('/classifier/data', articlesController.getClassifierData);

// Article routes (Read-only for public, writes protected)
router.get('/navigation', requireAuth, articlesController.getNavigationTree);
router.get('/articles', optionalAuth, articlesController.getArticles);
router.get('/articles/changes/recent', requireAuth, articlesController.getRecentChanges);
router.get('/articles/:slugOrId', optionalAuth, articlesController.getArticle);
router.post('/articles', requireAuth, requireRole(['Admin', 'Editor']), articlesController.createArticle);
router.put('/articles/:id', requireAuth, requireRole(['Admin', 'Editor']), articlesController.updateArticle);
router.delete('/articles/:id', requireAuth, requireRole(['Admin', 'Editor']), articlesController.deleteArticle);
router.post('/articles/reorder', requireAuth, requireRole(['Admin', 'Editor']), articlesController.reorderArticles);
router.get('/articles/:id/changes', requireAuth, articlesController.getArticleChanges);
router.post('/articles/:id/restore/:changeId', requireAuth, requireRole(['Admin']), articlesController.restoreArticleVersion);
router.get('/articles/ranking/popular', optionalAuth, articlesController.getPopularArticles);
router.get('/articles/ranking/trending', optionalAuth, articlesController.getTrendingArticles);
router.get('/articles/ranking/recommended', optionalAuth, articlesController.getRecommendedArticles);

// News Routes
router.get('/news', requireAuth, newsController.getNews);
router.get('/news/unread-count', requireAuth, newsController.getUnreadCount);
router.get('/news/search', requireAuth, newsController.searchNews);
router.get('/news/:id', requireAuth, newsController.getNewsDetail);
router.post('/news', requireAuth, requireRole(['Admin', 'Editor']), newsController.createNews);
router.put('/news/:id', requireAuth, requireRole(['Admin', 'Editor']), newsController.updateNews);
router.delete('/news/:id', requireAuth, requireRole(['Admin', 'Editor']), newsController.deleteNews);
router.post('/news/upload-attachment', requireAuth, requireRole(['Admin', 'Editor']), upload.single('file'), newsController.uploadAttachment);

// Sync operations routes
router.post('/articles/:id/sync', requireAuth, requireRole(['Admin', 'Editor']), articlesController.syncArticle);
router.get('/articles/:id/sync-history', requireAuth, requireRole(['Admin', 'Editor']), articlesController.getArticleSyncHistory);

// System notifications routes
router.get('/notifications', requireAuth, articlesController.getNotifications);
router.post('/notifications/read', requireAuth, articlesController.markNotificationsRead);

// Image/File upload & import route
router.post('/upload', requireAuth, requireRole(['Admin', 'Editor']), upload.single('image'), articlesController.uploadImage);
router.post('/articles/import', requireAuth, requireRole(['Admin', 'Editor']), upload.single('file'), articlesController.importArticle);

// Admin User Management Routes
router.get('/admin/users', requireAuth, requireRole(['Admin', 'Editor']), authController.getUsersList);
router.post('/admin/users', requireAuth, requireRole(['Admin']), authController.createUserByAdmin);
router.put('/admin/users/:id/role', requireAuth, requireRole(['Admin']), authController.changeRole);
router.put('/admin/users/:id/block', requireAuth, requireRole(['Admin']), authController.toggleBlockUser);
router.put('/admin/users/:id/reset-password', requireAuth, requireRole(['Admin']), authController.resetPasswordByAdmin);
router.delete('/admin/users/:id', requireAuth, requireRole(['Admin']), authController.deleteUserByAdmin);

// Admin Session & Profile Modification Audit Routes
router.get('/admin/sessions', requireAuth, requireRole(['Admin']), authController.getUserSessions);
router.delete('/admin/sessions/:id', requireAuth, requireRole(['Admin']), authController.deleteUserSession);
router.put('/admin/users/:id', requireAuth, requireRole(['Admin']), authController.updateUserByAdmin);
router.get('/admin/users/:id/history', requireAuth, requireRole(['Admin']), authController.getUserHistory);
router.post('/admin/clear-cache', requireAuth, requireRole(['Admin']), articlesController.reindexAndClearCache);
router.post('/admin/seed-section-articles', requireAuth, requireRole(['Admin']), articlesController.seedSectionArticles);
router.get('/admin/analytics', requireAuth, requireRole(['Admin']), analyticsController.getAnalyticsReport);

// Org Structure CRUD Routes (Admin only)
router.get('/departments', requireAuth, orgStructureController.getDepartments);
router.post('/departments', requireAuth, requireRole(['Admin']), orgStructureController.createDepartment);
router.patch('/departments/:id', requireAuth, requireRole(['Admin']), orgStructureController.updateDepartment);
router.delete('/departments/:id', requireAuth, requireRole(['Admin']), orgStructureController.deleteDepartment);

router.get('/positions', requireAuth, orgStructureController.getPositions);
router.post('/positions', requireAuth, requireRole(['Admin']), orgStructureController.createPosition);
router.patch('/positions/:id', requireAuth, requireRole(['Admin']), orgStructureController.updatePosition);
router.delete('/positions/:id', requireAuth, requireRole(['Admin']), orgStructureController.deletePosition);

router.get('/employees', requireAuth, orgStructureController.getEmployees);
router.post('/employees', requireAuth, requireRole(['Admin']), orgStructureController.createEmployee);
router.patch('/employees/:id', requireAuth, requireRole(['Admin']), orgStructureController.updateEmployee);
router.delete('/employees/:id', requireAuth, requireRole(['Admin']), orgStructureController.deleteEmployee);

// Wiki structure CRUD Routes (Admin only)
router.get('/wiki/spaces', requireAuth, orgStructureController.getSpaces);
router.post('/wiki/spaces', requireAuth, requireRole(['Admin']), orgStructureController.createSpace);
router.patch('/wiki/spaces/:id', requireAuth, requireRole(['Admin']), orgStructureController.updateSpace);
router.delete('/wiki/spaces/:id', requireAuth, requireRole(['Admin']), orgStructureController.deleteSpace);

router.get('/wiki/sections', requireAuth, orgStructureController.getSections);
router.post('/wiki/sections', requireAuth, requireRole(['Admin']), orgStructureController.createSection);
router.patch('/wiki/sections/:id', requireAuth, requireRole(['Admin']), orgStructureController.updateSection);
router.delete('/wiki/sections/:id', requireAuth, requireRole(['Admin']), orgStructureController.deleteSection);

// Org structure manual sync route
router.post('/wiki/sync/org-structure', requireAuth, requireRole(['Admin']), orgStructureController.syncOrgStructure);

// Guest Access Routes
router.get('/wiki/access/guest', requireAuth, requireRole(['Admin']), guestAccessController.getGuestAccessList);
router.post('/wiki/access/guest', requireAuth, requireRole(['Admin']), guestAccessController.createGuestAccess);
router.delete('/wiki/access/guest/:id', requireAuth, requireRole(['Admin']), guestAccessController.deleteGuestAccess);

// Access check
router.get('/wiki/access/check', requireAuth, articlesController.checkAccess);
router.get('/wiki/access/overview', requireAuth, requireRole(['Admin']), accessControlController.getAccessOverview);
router.post('/wiki/access/seed-defaults', requireAuth, requireRole(['Admin']), accessControlController.seedAccessDefaults);
router.get('/wiki/access/effective', requireAuth, requireRole(['Admin']), accessControlController.getEffectiveAccess);
router.put('/wiki/access/users/:id/wiki-roles', requireAuth, requireRole(['Admin']), accessControlController.updateUserWikiRoles);
router.put('/wiki/access/users/:id/access-scope', requireAuth, requireRole(['Admin']), accessControlController.updateUserAccessScope);

// Article Links Routes
router.get('/articles/:id/links', requireAuth, articlesController.getArticleLinks);
router.get('/articles/:id/backlinks', requireAuth, articlesController.getArticleBacklinks);
router.post('/articles/:id/links', requireAuth, requireRole(['Admin', 'Editor']), articlesController.createArticleLink);
router.delete('/articles/:id/links/:linkId', requireAuth, requireRole(['Admin', 'Editor']), articlesController.deleteArticleLink);

export default router;
