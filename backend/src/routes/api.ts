import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import * as articlesController from '../controllers/articles';
import * as categoriesController from '../controllers/categories';

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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extName = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimeType = allowedTypes.test(file.mimetype);
    if (extName && mimeType) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed (jpeg, jpg, png, gif, webp)'));
    }
  },
});

const router = Router();

// Search routes
router.get('/search', articlesController.searchArticles);
router.get('/search/suggest', articlesController.suggestArticles);

// Article routes
router.get('/articles', articlesController.getArticles);
router.get('/articles/:slugOrId', articlesController.getArticle);
router.post('/articles', articlesController.createArticle);
router.put('/articles/:id', articlesController.updateArticle);
router.delete('/articles/:id', articlesController.deleteArticle);

// Category routes
router.get('/categories', categoriesController.getCategories);
router.get('/categories/:idOrSlug', categoriesController.getCategory);
router.post('/categories', categoriesController.createCategory);
router.put('/categories/:id', categoriesController.updateCategory);
router.delete('/categories/:id', categoriesController.deleteCategory);

// Image Upload route
router.post('/upload', upload.single('image'), articlesController.uploadImage);

export default router;
