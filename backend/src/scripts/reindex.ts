import dotenv from 'dotenv';
import path from 'path';

// Загружаем переменные окружения перед остальными импортами
dotenv.config();

import { checkDatabaseConnection, pool } from '../config/db';
import { 
  checkMeilisearchConnection, 
  initializeMeilisearch, 
  bulkSyncArticles, 
  bulkSyncNews,
  msClient,
  ArticleDocument,
  NewsDocument
} from '../services/meilisearch';
import * as ArticleModel from '../models/article';
import * as NewsModel from '../models/news';

const runReindex = async () => {
  console.log('--- ЗАПУСК ПОЛНОЙ ПЕРЕИНДЕКСАЦИИ WIKI 2.0 ---');

  // 1. Проверяем подключение к PostgreSQL
  const dbConnected = await checkDatabaseConnection(5, 2000);
  if (!dbConnected) {
    console.error('Ошибка: Не удалось подключиться к базе данных PostgreSQL. Выход.');
    process.exit(1);
  }

  // 2. Проверяем подключение к Meilisearch
  const msConnected = await checkMeilisearchConnection(5, 2000);
  if (!msConnected) {
    console.error('Ошибка: Не удалось подключиться к поисковому серверу Meilisearch. Выход.');
    process.exit(1);
  }

  try {
    // 3. Сбрасываем и инициализируем индексы
    console.log('Инициализация настроек Meilisearch...');
    await initializeMeilisearch();

    // 4. Очищаем старые документы из индексов перед заливкой
    console.log('Очистка индексов Meilisearch...');
    try {
      const task1 = await msClient.index('articles').deleteAllDocuments();
      await msClient.tasks.waitForTask(task1.taskUid);
      console.log('Индекс "articles" успешно очищен.');
    } catch (e: any) {
      console.log('Индекс "articles" не требует очистки или не найден.');
    }

    try {
      const task2 = await msClient.index('news').deleteAllDocuments();
      await msClient.tasks.waitForTask(task2.taskUid);
      console.log('Индекс "news" успешно очищен.');
    } catch (e: any) {
      console.log('Индекс "news" не требует очистки или не найден.');
    }

    // 5. Загружаем статьи из БД и переиндексируем
    console.log('Выгрузка статей из базы данных...');
    const dbArticles = await ArticleModel.getAllArticles({ publishedOnly: false });
    console.log(`Найдено статей в БД: ${dbArticles.length}`);

    const articleDocs: ArticleDocument[] = dbArticles.map((art) => ({
      id: art.id,
      title: art.title,
      slug: art.slug,
      content: art.content,
      summary: art.summary || '',
      categoryName: '',
      tags: art.tags || [],
      published: art.published,
      createdAt: art.created_at instanceof Date ? art.created_at.toISOString() : new Date(art.created_at).toISOString(),
      section_ids: art.section_ids || [],
    }));

    if (articleDocs.length > 0) {
      console.log('Экспорт статей в Meilisearch...');
      await bulkSyncArticles(articleDocs);
    }

    // 6. Загружаем новости из БД и переиндексируем
    console.log('Выгрузка новостей из базы данных...');
    const dbNews = await NewsModel.getAllNews({ publishedOnly: false });
    console.log(`Найдено новостей в БД: ${dbNews.length}`);

    const newsDocs: NewsDocument[] = dbNews.map((n) => ({
      id: n.id,
      title: n.title,
      description: n.description || '',
      content: n.content || '',
      videoUrl: n.video_url || null,
      tags: n.tags || [],
      attachments: (n.attachments || []).map((a: any) => a.file_name),
      isPublished: n.is_published,
      isPinned: n.is_pinned,
      publishedAt: n.published_at instanceof Date ? n.published_at.toISOString() : new Date(n.published_at).toISOString(),
      createdAt: n.created_at instanceof Date ? n.created_at.toISOString() : new Date(n.created_at).toISOString(),
    }));

    if (newsDocs.length > 0) {
      console.log('Экспорт новостей в Meilisearch...');
      await bulkSyncNews(newsDocs);
    }

    console.log('--- ПЕРЕИНДЕКСАЦИЯ УСПЕШНО ЗАВЕРШЕНА ---');
  } catch (err) {
    console.error('Ошибка во время переиндексации:', err);
  } finally {
    // Закрываем подключение к пулу БД, чтобы процесс завершился корректно
    await pool.end();
  }
};

runReindex();
