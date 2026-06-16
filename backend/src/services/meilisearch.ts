import { Meilisearch } from 'meilisearch';
import dotenv from 'dotenv';
import * as ArticleModel from '../models/article';
import { 
  normalizeText, 
  transliterateCyrillicToLatin, 
  getAliasesForText, 
  getQueryVariants 
} from '../utils/text';

dotenv.config();

let msHost = process.env.MEILI_HOST || 'http://localhost:7700';
const msApiKey = process.env.MEILI_MASTER_KEY || '';

// Handle Render Free Plan private networking limitation:
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
  section_ids?: number[];

  // Дополнительные поисковые поля
  title_latin?: string;
  content_latin?: string;
  tags_latin?: string[];
  aliases?: string[];
  search_text?: string;
  search_text_latin?: string;
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
        'aliases',
        'title_latin',
        'tags',
        'tags_latin',
        'search_text',
        'search_text_latin',
        'content',
        'content_latin'
      ],
      filterableAttributes: [
        'published',
        'categoryName',
        'tags',
        'section_ids',
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
 * Prepares the article document for indexing by adding normalized/transliterated fields.
 */
export const prepareArticleDocument = (article: ArticleDocument): ArticleDocument => {
  const cleanTitle = article.title || '';
  const cleanContent = article.content || '';
  const cleanSummary = article.summary || '';
  const cleanTags = article.tags || [];

  const title_latin = transliterateCyrillicToLatin(normalizeText(cleanTitle));
  const content_latin = transliterateCyrillicToLatin(normalizeText(cleanContent));
  const tags_latin = cleanTags.map(tag => transliterateCyrillicToLatin(normalizeText(tag)));
  
  const titleAliases = getAliasesForText(cleanTitle);
  const tagAliases = cleanTags.flatMap(tag => getAliasesForText(tag));
  const aliases = Array.from(new Set([...titleAliases, ...tagAliases]));
  
  const search_text = normalizeText(`${cleanTitle} ${cleanSummary} ${cleanContent} ${cleanTags.join(' ')}`);
  const search_text_latin = transliterateCyrillicToLatin(search_text);

  return {
    ...article,
    title_latin,
    content_latin,
    tags_latin,
    aliases,
    search_text,
    search_text_latin
  };
};

/**
 * Indexes or updates a single article.
 */
export const indexArticle = async (article: ArticleDocument) => {
  try {
    const processed = prepareArticleDocument(article);
    const task = await msClient.index(INDEX_NAME).addDocuments([processed]);
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
    const processed = articles.map(prepareArticleDocument);
    const task = await msClient.index(INDEX_NAME).addDocuments(processed);
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
          section_ids: art.section_ids,
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
      section_ids: art.section_ids,
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
 * Custom helper to extract matching snippets with highlight tags from the formatted HTML content.
 */
const extractHighlights = (formattedContent: string, maxFragments = 3): string[] => {
  if (!formattedContent) return [];

  const markTagOpen = '<mark class="bg-indigo-500/20 text-indigo-200 px-1 rounded font-semibold">';

  // Split content by block-level elements or paragraph tags
  const blocks = formattedContent.split(/(?:<\/p>|<\/div>|<br\s*\/?>|<\/li>|<\/h[1-6]>)/gi);
  const matchedSnippets: string[] = [];

  for (const block of blocks) {
    if (block.includes(markTagOpen)) {
      let snippet = block.replace(/<(?!mark\b|\/mark\b)[^>]*>/gi, '').trim();

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
 * Evaluates the relevance rank of a hit to sort.
 * Rank 1: exact or highlighted title match
 * Rank 2: aliases match
 * Rank 3: title_latin match
 * Rank 4: tags or tags_latin match
 * Rank 5: content or content_latin or search_text or search_text_latin match
 * Rank 6: anything else
 */
function getRelevanceRank(hit: any, queryText: string): number {
  const formatted = hit._formatted || {};
  const queryLower = queryText.toLowerCase().trim();
  
  const titleLower = (hit.title || '').toLowerCase().trim();
  if (titleLower === queryLower) {
    return 1;
  }
  
  const hasTitleHighlight = formatted.title && formatted.title.includes('<mark');
  if (hasTitleHighlight) {
    return 1;
  }
  
  const hasAliasesHighlight = formatted.aliases && formatted.aliases.some((alias: string) => alias.includes('<mark'));
  if (hasAliasesHighlight) {
    return 2;
  }
  
  const hasTitleLatinHighlight = formatted.title_latin && formatted.title_latin.includes('<mark');
  if (hasTitleLatinHighlight) {
    return 3;
  }
  
  const hasTagsHighlight = (formatted.tags && formatted.tags.some((tag: string) => tag.includes('<mark'))) || 
                           (formatted.tags_latin && formatted.tags_latin.some((tag: string) => tag.includes('<mark')));
  if (hasTagsHighlight) {
    return 4;
  }
  
  const hasContentHighlight = (formatted.content && formatted.content.includes('<mark')) ||
                              (formatted.content_latin && formatted.content_latin.includes('<mark')) ||
                              (formatted.search_text && formatted.search_text.includes('<mark')) ||
                              (formatted.search_text_latin && formatted.search_text_latin.includes('<mark')) ||
                              (formatted.summary && formatted.summary.includes('<mark'));
  if (hasContentHighlight) {
    return 5;
  }
  
  return 6;
}

/**
 * Searches articles with filters, highlighting, and typo tolerance.
 */
export const searchArticles = async (
  queryText: string,
  categorySlug?: string,
  tagName?: string,
  allowedSectionIds?: number[]
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

    if (allowedSectionIds && allowedSectionIds.length > 0) {
      filterArray.push(`section_ids IN [${allowedSectionIds.join(', ')}]`);
    } else if (allowedSectionIds) {
      filterArray.push(`section_ids = -1`);
    }

    const searchParams: any = {
      filter: filterArray,
      attributesToHighlight: [
        'title',
        'title_latin',
        'aliases',
        'tags',
        'tags_latin',
        'summary',
        'content',
        'content_latin',
        'search_text',
        'search_text_latin'
      ],
      highlightPreTag: '<mark class="bg-indigo-500/20 text-indigo-200 px-1 rounded font-semibold">',
      highlightPostTag: '</mark>',
      showRankingScore: true,
      limit: 25,
    };

    // If query is empty, sort by creation date (newest first)
    if (!queryText || queryText.trim().length === 0) {
      searchParams.sort = ['createdAt:desc'];
      const response = await msClient.index(INDEX_NAME).search('', searchParams);
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
    }

    // Generate multiple variants of the query
    const variants = getQueryVariants(queryText);
    
    // Execute multiple search queries in parallel
    const searchPromises = variants.map(variant =>
      msClient.index(INDEX_NAME).search(variant, searchParams)
    );
    const searchResponses = await Promise.all(searchPromises);

    // Merge and deduplicate by document id
    const hitMap = new Map<number, any>();
    for (const response of searchResponses) {
      for (const hit of response.hits) {
        const hitId = Number(hit.id);
        const existing = hitMap.get(hitId);
        // Keep the one with the higher ranking score
        if (!existing || (hit._rankingScore || 0) > (existing._rankingScore || 0)) {
          hitMap.set(hitId, hit);
        }
      }
    }

    const mergedHits = Array.from(hitMap.values());

    // Sort by custom relevance rank, then by rank score descending
    mergedHits.sort((a, b) => {
      const rankA = getRelevanceRank(a, queryText);
      const rankB = getRelevanceRank(b, queryText);
      
      if (rankA !== rankB) {
        return rankA - rankB;
      }
      
      const scoreA = a._rankingScore || 0;
      const scoreB = b._rankingScore || 0;
      return scoreB - scoreA;
    });

    // Slice to top 20 hits
    const finalHits = mergedHits.slice(0, 20);

    return finalHits.map((hit: any) => {
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
export const suggestArticles = async (queryText: string, allowedSectionIds?: number[]) => {
  await syncIfNeeded();
  try {
    if (!queryText || queryText.trim().length === 0) return [];

    const filterArray = ['published = true'];
    if (allowedSectionIds && allowedSectionIds.length > 0) {
      filterArray.push(`section_ids IN [${allowedSectionIds.join(', ')}]`);
    } else if (allowedSectionIds) {
      filterArray.push(`section_ids = -1`);
    }

    const variants = getQueryVariants(queryText);
    const searchPromises = variants.map(variant =>
      msClient.index(INDEX_NAME).search(variant, {
        filter: filterArray,
        attributesToRetrieve: ['id', 'title', 'slug', 'categoryName'],
        limit: 5,
      })
    );
    const searchResponses = await Promise.all(searchPromises);

    const hitMap = new Map<number, any>();
    for (const response of searchResponses) {
      for (const hit of response.hits) {
        hitMap.set(Number(hit.id), hit);
      }
    }

    const mergedHits = Array.from(hitMap.values());

    return mergedHits.slice(0, 5).map((hit: any) => ({
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
      const response = await msClient.index(NEWS_INDEX_NAME).search('', searchParams);
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
    }

    const variants = getQueryVariants(queryText);
    const searchPromises = variants.map(variant =>
      msClient.index(NEWS_INDEX_NAME).search(variant, searchParams)
    );
    const searchResponses = await Promise.all(searchPromises);

    const hitMap = new Map<number, any>();
    for (const response of searchResponses) {
      for (const hit of response.hits) {
        const hitId = Number(hit.id);
        const existing = hitMap.get(hitId);
        if (!existing || (hit._rankingScore || 0) > (existing._rankingScore || 0)) {
          hitMap.set(hitId, hit);
        }
      }
    }

    const mergedHits = Array.from(hitMap.values());

    // Sort by ranking score descending
    mergedHits.sort((a, b) => (b._rankingScore || 0) - (a._rankingScore || 0));

    return mergedHits.slice(0, 30).map((hit: any) => {
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
