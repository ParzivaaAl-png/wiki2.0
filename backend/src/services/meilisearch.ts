import { Meilisearch } from 'meilisearch';
import dotenv from 'dotenv';
import * as ArticleModel from '../models/article';

dotenv.config();

let msHost = process.env.MEILI_HOST || 'http://localhost:7700';
const msApiKey = process.env.MEILI_MASTER_KEY || '';

// Handle Render Free Plan private networking limitation:
// Rewrite internal hostport (e.g., wiki-search-90mm:7700) to the public URL (https://wiki-search-90mm.onrender.com)
if (msHost.includes('wiki-search-') && msHost.includes(':7700')) {
  const hostOnly = msHost.replace('http://', '').replace('https://', '').split(':')[0];
  msHost = `https://${hostOnly}.onrender.com`;
} else if (!msHost.startsWith('http://') && !msHost.startsWith('https://')) {
  if (msHost.includes('onrender.com') || msHost.includes('vercel.app')) {
    msHost = `https://${msHost}`;
  } else {
    msHost = `http://${msHost}`;
  }
}

console.log('Meilisearch client initialized with host:', msHost);

export const msClient = new Meilisearch({
  host: msHost,
  apiKey: msApiKey,
});

const INDEX_NAME = 'articles';
const NEWS_INDEX_NAME = 'news';

export interface ArticleDocument {
  id: number;
  title: string;
  slug: string;
  content: string;
  summary: string;
  categoryName: string;
  tags: string[];
  published: boolean;
  createdAt: string;
}

export interface NewsDocument {
  id: number;
  title: string;
  description: string;
  content: string;
  tags: string[];
  attachments: string[];
  isPublished: boolean;
  isPinned: boolean;
  publishedAt: string;
  createdAt: string;
}

/**
 * Checks connection health to Meilisearch with retries.
 */
export const checkMeilisearchConnection = async (retries = 10, delay = 3000): Promise<boolean> => {
  for (let i = 0; i < retries; i++) {
    try {
      const health = await msClient.isHealthy();
      if (health) {
        console.log('Successfully connected to Meilisearch!');
        return true;
      }
      console.warn(`Meilisearch is not healthy. Retrying in ${delay / 1000}s... (${i + 1}/${retries})`);
    } catch (err) {
      console.warn(`Meilisearch ping failed. Retrying in ${delay / 1000}s... (${i + 1}/${retries})`);
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  return false;
};

/**
 * Checks index existence and initializes settings (searchable, filterable, sortable attributes).
 */
export const initializeMeilisearch = async () => {
  try {
    // 1. Initialize Articles Index
    let indexExists = false;
    try {
      await msClient.getIndex(INDEX_NAME);
      indexExists = true;
      console.log(`Meilisearch index "${INDEX_NAME}" already exists.`);
    } catch (err: any) {
      const isNotFound =
        err.code === 'index_not_found' ||
        err.cause?.code === 'index_not_found' ||
        err.message?.includes('not found') ||
        err.message?.includes('index_not_found');
      if (!isNotFound) {
        throw err;
      }
    }

    if (!indexExists) {
      console.log(`Creating Meilisearch index "${INDEX_NAME}"...`);
      const task = await msClient.createIndex(INDEX_NAME, { primaryKey: 'id' });
      await msClient.tasks.waitForTask(task.taskUid);
      console.log(`Meilisearch index "${INDEX_NAME}" created successfully.`);
    }

    // Configure settings for autocomplete, search filters, and sorting
    console.log('Configuring settings for Meilisearch index articles...');
    const settingsTask = await msClient.index(INDEX_NAME).updateSettings({
      searchableAttributes: [
        'title',
        'summary',
        'content',
        'tags',
        'categoryName',
      ],
      filterableAttributes: [
        'published',
        'categoryName',
        'tags',
      ],
      sortableAttributes: [
        'createdAt',
      ],
      // Typo tolerance configuration (customized for better autocomplete UX)
      typoTolerance: {
        enabled: true,
        minWordSizeForTypos: {
          oneTypo: 4,
          twoTypos: 7,
        },
      },
    });

    await msClient.tasks.waitForTask(settingsTask.taskUid);
    console.log('Meilisearch index articles settings configured successfully.');

    // 2. Initialize News Index
    let newsIndexExists = false;
    try {
      await msClient.getIndex(NEWS_INDEX_NAME);
      newsIndexExists = true;
      console.log(`Meilisearch index "${NEWS_INDEX_NAME}" already exists.`);
    } catch (err: any) {
      const isNotFound =
        err.code === 'index_not_found' ||
        err.cause?.code === 'index_not_found' ||
        err.message?.includes('not found') ||
        err.message?.includes('index_not_found');
      if (!isNotFound) {
        throw err;
      }
    }

    if (!newsIndexExists) {
      console.log(`Creating Meilisearch index "${NEWS_INDEX_NAME}"...`);
      const task = await msClient.createIndex(NEWS_INDEX_NAME, { primaryKey: 'id' });
      await msClient.tasks.waitForTask(task.taskUid);
      console.log(`Meilisearch index "${NEWS_INDEX_NAME}" created successfully.`);
    }

    console.log('Configuring settings for Meilisearch index news...');
    const newsSettingsTask = await msClient.index(NEWS_INDEX_NAME).updateSettings({
      searchableAttributes: [
        'title',
        'description',
        'content',
        'tags',
        'attachments',
      ],
      filterableAttributes: [
        'isPublished',
        'isPinned',
        'tags',
      ],
      sortableAttributes: [
        'publishedAt',
        'createdAt',
      ],
      typoTolerance: {
        enabled: true,
        minWordSizeForTypos: {
          oneTypo: 4,
          twoTypos: 7,
        },
      },
    });

    await msClient.tasks.waitForTask(newsSettingsTask.taskUid);
    console.log('Meilisearch index news settings configured successfully.');

  } catch (error) {
    console.error('Failed to initialize Meilisearch indexes:', error);
  }
};

/**
 * Indexes or updates a single article.
 */
export const indexArticle = async (article: ArticleDocument) => {
  try {
    const task = await msClient.index(INDEX_NAME).addDocuments([article]);
    await msClient.tasks.waitForTask(task.taskUid);
    console.log(`Indexed article in Meilisearch: ID ${article.id} (${article.title})`);
  } catch (error) {
    console.error(`Failed to index article ${article.id} in Meilisearch:`, error);
  }
};

/**
 * Deletes an article from the index by ID.
 */
export const deleteArticle = async (id: number) => {
  try {
    const task = await msClient.index(INDEX_NAME).deleteDocument(id);
    await msClient.tasks.waitForTask(task.taskUid);
    console.log(`Deleted article from Meilisearch: ID ${id}`);
  } catch (error) {
    console.error(`Failed to delete article ${id} from Meilisearch:`, error);
  }
};

/**
 * Indexes multiple articles in bulk.
 */
export const bulkSyncArticles = async (articles: ArticleDocument[]) => {
  try {
    if (articles.length === 0) return;
    const task = await msClient.index(INDEX_NAME).addDocuments(articles);
    await msClient.tasks.waitForTask(task.taskUid);
    console.log(`Successfully bulk indexed ${articles.length} articles into Meilisearch.`);
  } catch (error) {
    console.error('Bulk sync with Meilisearch failed:', error);
  }
};

/**
 * Check if meilisearch has 0 documents and sync from database if so (self-healing)
 */
export const syncIfNeeded = async () => {
  try {
    let needSync = false;
    try {
      const stats = await msClient.index(INDEX_NAME).getStats();
      if (stats.numberOfDocuments === 0) {
        needSync = true;
      }
    } catch (err: any) {
      // If index doesn't exist, we must initialize it and then sync
      const isNotFound =
        err.code === 'index_not_found' ||
        err.cause?.code === 'index_not_found' ||
        err.message?.includes('not found') ||
        err.message?.includes('index_not_found');
      if (isNotFound) {
        console.log(`Index "${INDEX_NAME}" not found in Meilisearch. Initializing index...`);
        await initializeMeilisearch();
        needSync = true;
      } else {
        throw err;
      }
    }

    if (needSync) {
      console.log('Meilisearch index is empty or uninitialized. Checking DB articles for sync...');
      const dbArticles = await ArticleModel.getAllArticles({ publishedOnly: false });
      if (dbArticles.length > 0) {
        console.log(`Found ${dbArticles.length} articles in DB. Bulk syncing to Meilisearch...`);
        const docs: ArticleDocument[] = dbArticles.map((art) => ({
          id: art.id,
          title: art.title,
          slug: art.slug,
          content: art.content,
          summary: art.summary,
          categoryName: '',
          tags: art.tags,
          published: art.published,
          createdAt: art.created_at instanceof Date ? art.created_at.toISOString() : new Date(art.created_at).toISOString(),
        }));
        await bulkSyncArticles(docs);
        console.log('Bulk sync completed successfully.');
      }
    }
  } catch (err) {
    console.error('Failed to run syncIfNeeded:', err);
  }
};

/**
 * Triggers a manual full re-sync of all database articles into Meilisearch index.
 */
export const triggerFullSync = async () => {
  try {
    console.log('Starting full re-sync of all articles to Meilisearch...');
    const dbArticles = await ArticleModel.getAllArticles({ publishedOnly: false });

    const docs: ArticleDocument[] = dbArticles.map((art) => ({
      id: art.id,
      title: art.title,
      slug: art.slug,
      content: art.content,
      summary: art.summary,
      categoryName: '',
      tags: art.tags,
      published: art.published,
      createdAt: art.created_at instanceof Date ? art.created_at.toISOString() : new Date(art.created_at).toISOString(),
    }));

    await msClient.index(INDEX_NAME).deleteAllDocuments();

    if (docs.length > 0) {
      await bulkSyncArticles(docs);
    }
    console.log(`Full sync completed. Synced ${docs.length} articles.`);
  } catch (error) {
    console.error('Failed to run triggerFullSync:', error);
  }
};

/**
 * Custom helper to extract matching snippets with highlight tags from the formatted HTML content,
 * mimicking Elasticsearch's fragments highlight system.
 */
const extractHighlights = (formattedContent: string, maxFragments = 3): string[] => {
  if (!formattedContent) return [];

  const markTagOpen = '<mark class="bg-indigo-500/20 text-indigo-200 px-1 rounded font-semibold">';

  // Split content by block-level elements or paragraph tags
  const blocks = formattedContent.split(/(?:<\/p>|<\/div>|<br\s*\/?>|<\/li>|<\/h[1-6]>)/gi);
  const matchedSnippets: string[] = [];

  for (const block of blocks) {
    if (block.includes(markTagOpen)) {
      // Strip all HTML tags EXCEPT <mark> and </mark>
      let snippet = block.replace(/<(?!mark\b|\/mark\b)[^>]*>/gi, '').trim();

      // Crop if it's too long to display nicely
      if (snippet.length > 150) {
        const markIndex = snippet.indexOf(markTagOpen);
        if (markIndex !== -1) {
          const start = Math.max(0, markIndex - 60);
          const end = Math.min(snippet.length, markIndex + markTagOpen.length + 90);
          snippet = (start > 0 ? '...' : '') + snippet.substring(start, end).trim() + (end < snippet.length ? '...' : '');
        }
      }

      matchedSnippets.push(snippet);
      if (matchedSnippets.length >= maxFragments) {
        break;
      }
    }
  }

  return matchedSnippets;
};

/**
 * Searches articles with filters, highlighting, and typo tolerance.
 */
export const searchArticles = async (
  queryText: string,
  categorySlug?: string,
  tagName?: string
) => {
  await syncIfNeeded();
  try {
    const filterArray: string[] = ['published = true'];

    if (categorySlug) {
      filterArray.push(`categoryName = "${categorySlug}"`);
    }

    if (tagName) {
      filterArray.push(`tags = "${tagName}"`);
    }

    const searchParams: any = {
      filter: filterArray,
      attributesToHighlight: ['title', 'summary', 'content'],
      highlightPreTag: '<mark class="bg-indigo-500/20 text-indigo-200 px-1 rounded font-semibold">',
      highlightPostTag: '</mark>',
      showRankingScore: true,
      limit: 20,
    };

    // If query is empty, sort by creation date (newest first)
    if (!queryText || queryText.trim().length === 0) {
      searchParams.sort = ['createdAt:desc'];
    }

    const response = await msClient.index(INDEX_NAME).search(queryText, searchParams);

    return response.hits.map((hit: any) => {
      const formatted = hit._formatted || {};
      const contentHighlights = extractHighlights(formatted.content || '');

      return {
        id: Number(hit.id),
        title: formatted.title || hit.title,
        slug: hit.slug,
        summary: formatted.summary || hit.summary,
        categoryName: hit.categoryName,
        tags: hit.tags,
        published: hit.published,
        createdAt: hit.createdAt,
        highlights: contentHighlights,
        score: hit._rankingScore || 1.0,
      };
    });
  } catch (error) {
    console.error('Meilisearch search query failed:', error);
    return [];
  }
};

/**
 * Auto-completion suggestions provider.
 */
export const suggestArticles = async (queryText: string) => {
  await syncIfNeeded();
  try {
    if (!queryText || queryText.trim().length === 0) return [];

    const response = await msClient.index(INDEX_NAME).search(queryText, {
      filter: ['published = true'],
      attributesToRetrieve: ['id', 'title', 'slug', 'categoryName'],
      limit: 5,
    });

    return response.hits.map((hit: any) => ({
      id: Number(hit.id),
      title: hit.title,
      slug: hit.slug,
      categoryName: hit.categoryName,
    }));
  } catch (error) {
    console.error('Meilisearch suggestions query failed:', error);
    return [];
  }
};

/**
 * Indexes or updates a single news item.
 */
export const indexNews = async (news: NewsDocument) => {
  try {
    const task = await msClient.index(NEWS_INDEX_NAME).addDocuments([news]);
    await msClient.tasks.waitForTask(task.taskUid);
    console.log(`Indexed news in Meilisearch: ID ${news.id} (${news.title})`);
  } catch (error) {
    console.error(`Failed to index news ${news.id} in Meilisearch:`, error);
  }
};

/**
 * Deletes a news item from the index by ID.
 */
export const deleteNews = async (id: number) => {
  try {
    const task = await msClient.index(NEWS_INDEX_NAME).deleteDocument(id);
    await msClient.tasks.waitForTask(task.taskUid);
    console.log(`Deleted news from Meilisearch: ID ${id}`);
  } catch (error) {
    console.error(`Failed to delete news ${id} from Meilisearch:`, error);
  }
};

/**
 * Indexes multiple news items in bulk.
 */
export const bulkSyncNews = async (newsList: NewsDocument[]) => {
  try {
    if (newsList.length === 0) return;
    const task = await msClient.index(NEWS_INDEX_NAME).addDocuments(newsList);
    await msClient.tasks.waitForTask(task.taskUid);
    console.log(`Successfully bulk indexed ${newsList.length} news items into Meilisearch.`);
  } catch (error) {
    console.error('Bulk sync news with Meilisearch failed:', error);
  }
};

/**
 * Searches news with filters, highlighting, and typo tolerance.
 */
export const searchNews = async (
  queryText: string,
  tagName?: string,
  includeUnpublished = false
) => {
  try {
    const filterArray: string[] = [];

    if (!includeUnpublished) {
      filterArray.push('isPublished = true');
    }

    if (tagName) {
      filterArray.push(`tags = "${tagName}"`);
    }

    const searchParams: any = {
      filter: filterArray,
      attributesToHighlight: ['title', 'description', 'content'],
      highlightPreTag: '<mark class="bg-indigo-500/20 text-indigo-200 px-1 rounded font-semibold">',
      highlightPostTag: '</mark>',
      showRankingScore: true,
      limit: 30,
    };

    // If query is empty, sort by pinned first, then by published date (newest first)
    if (!queryText || queryText.trim().length === 0) {
      searchParams.sort = ['isPinned:desc', 'publishedAt:desc'];
    }

    const response = await msClient.index(NEWS_INDEX_NAME).search(queryText, searchParams);

    return response.hits.map((hit: any) => {
      const formatted = hit._formatted || {};
      const contentHighlights = extractHighlights(formatted.content || '');

      return {
        id: Number(hit.id),
        title: formatted.title || hit.title,
        description: formatted.description || hit.description,
        tags: hit.tags,
        attachments: hit.attachments || [],
        isPublished: hit.isPublished,
        isPinned: hit.isPinned,
        publishedAt: hit.publishedAt,
        createdAt: hit.createdAt,
        highlights: contentHighlights,
        score: hit._rankingScore || 1.0,
      };
    });
  } catch (error) {
    console.error('Meilisearch search news query failed:', error);
    return [];
  }
};
