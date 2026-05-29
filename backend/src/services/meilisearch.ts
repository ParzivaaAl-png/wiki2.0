import { Meilisearch } from 'meilisearch';
import dotenv from 'dotenv';

dotenv.config();

let msHost = process.env.MEILI_HOST || 'http://localhost:7700';
const msApiKey = process.env.MEILI_MASTER_KEY || '';

// Prepend protocol if not specified (important for Render dynamic hostnames)
if (!msHost.startsWith('http://') && !msHost.startsWith('https://')) {
  if (msHost.includes('onrender.com') || msHost.includes('vercel.app')) {
    msHost = `https://${msHost}`;
  } else {
    msHost = `http://${msHost}`;
  }
}

export const msClient = new Meilisearch({
  host: msHost,
  apiKey: msApiKey,
});

const INDEX_NAME = 'articles';

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
    let indexExists = false;
    try {
      await msClient.getIndex(INDEX_NAME);
      indexExists = true;
      console.log(`Meilisearch index "${INDEX_NAME}" already exists.`);
    } catch (err: any) {
      if (err.cause?.code !== 'index_not_found' && err.code !== 'index_not_found') {
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
    console.log('Configuring settings for Meilisearch index...');
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
    console.log('Meilisearch settings configured successfully.');
  } catch (error) {
    console.error('Failed to initialize Meilisearch index:', error);
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
