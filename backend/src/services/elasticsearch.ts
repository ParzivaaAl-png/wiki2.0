import { Client } from '@elastic/elasticsearch';
import dotenv from 'dotenv';

dotenv.config();

const esNode = process.env.ELASTICSEARCH_NODE || 'http://localhost:9200';
export const esClient = new Client({ node: esNode });

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

export const checkElasticsearchConnection = async (retries = 10, delay = 3000): Promise<boolean> => {
  for (let i = 0; i < retries; i++) {
    try {
      await esClient.ping();
      console.log('Successfully connected to Elasticsearch!');
      return true;
    } catch (err) {
      console.warn(`Elasticsearch ping failed. Retrying in ${delay / 1000}s... (${i + 1}/${retries})`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  return false;
};

export const initializeElasticsearch = async () => {
  try {
    const indexExists = await esClient.indices.exists({ index: INDEX_NAME });

    if (indexExists) {
      console.log(`Elasticsearch index "${INDEX_NAME}" already exists.`);
      return;
    }

    console.log(`Creating Elasticsearch index "${INDEX_NAME}" with custom analyzers...`);
    await esClient.indices.create({
      index: INDEX_NAME,
      body: {
        settings: {
          analysis: {
            filter: {
              autocomplete_filter: {
                type: 'edge_ngram',
                min_gram: 2,
                max_gram: 20,
              },
            },
            analyzer: {
              autocomplete: {
                type: 'custom',
                tokenizer: 'standard',
                filter: ['lowercase', 'autocomplete_filter'],
              },
              autocomplete_search: {
                type: 'custom',
                tokenizer: 'standard',
                filter: ['lowercase'],
              },
            },
          },
        },
        mappings: {
          properties: {
            id: { type: 'integer' },
            title: {
              type: 'text',
              analyzer: 'autocomplete',
              search_analyzer: 'autocomplete_search',
              fields: {
                keyword: { type: 'keyword' },
                stemmed: { type: 'text', analyzer: 'russian' },
              },
            },
            content: {
              type: 'text',
              analyzer: 'standard',
              fields: {
                stemmed: { type: 'text', analyzer: 'russian' },
              },
            },
            summary: { type: 'text', analyzer: 'standard' },
            slug: { type: 'keyword' },
            categoryName: { type: 'keyword' },
            tags: { type: 'keyword' },
            published: { type: 'boolean' },
            createdAt: { type: 'date' },
          },
        },
      },
    });

    console.log(`Elasticsearch index "${INDEX_NAME}" created successfully.`);
  } catch (error) {
    console.error('Failed to initialize Elasticsearch index:', error);
  }
};

export const indexArticle = async (article: ArticleDocument) => {
  try {
    await esClient.index({
      index: INDEX_NAME,
      id: article.id.toString(),
      body: article,
      refresh: true, // make searchable instantly
    });
    console.log(`Indexed article in ES: ID ${article.id} (${article.title})`);
  } catch (error) {
    console.error(`Failed to index article ${article.id} in ES:`, error);
  }
};

export const deleteArticle = async (id: number) => {
  try {
    const docExists = await esClient.exists({
      index: INDEX_NAME,
      id: id.toString(),
    });
    if (docExists) {
      await esClient.delete({
        index: INDEX_NAME,
        id: id.toString(),
        refresh: true,
      });
      console.log(`Deleted article from ES: ID ${id}`);
    }
  } catch (error) {
    console.error(`Failed to delete article ${id} from ES:`, error);
  }
};

export const bulkSyncArticles = async (articles: ArticleDocument[]) => {
  try {
    if (articles.length === 0) return;

    const body = articles.flatMap((doc) => [
      { index: { _index: INDEX_NAME, _id: doc.id.toString() } },
      doc,
    ]);

    const bulkResponse = await esClient.bulk({ refresh: true, body });

    if (bulkResponse.errors) {
      console.error('Bulk index errors occurred');
    } else {
      console.log(`Successfully bulk indexed ${articles.length} articles into ES.`);
    }
  } catch (error) {
    console.error('Bulk sync failed:', error);
  }
};

export const searchArticles = async (
  queryText: string,
  categorySlug?: string,
  tagName?: string
) => {
  try {
    const mustQueries: any[] = [];
    const filterQueries: any[] = [];

    // Base query logic
    if (queryText && queryText.trim().length > 0) {
      mustQueries.push({
        multi_match: {
          query: queryText,
          fields: [
            'title^4', 
            'title.stemmed^3', 
            'summary^2', 
            'content^1', 
            'content.stemmed^1'
          ],
          fuzziness: 'AUTO',
          prefix_length: 2,
          operator: 'or',
        },
      });
    } else {
      mustQueries.push({ match_all: {} });
    }

    // Always filter for published articles
    filterQueries.push({ term: { published: true } });

    // Category filter
    if (categorySlug) {
      filterQueries.push({ term: { categoryName: categorySlug } });
    }

    // Tag filter
    if (tagName) {
      filterQueries.push({ term: { tags: tagName } });
    }

    const searchParams: any = {
      index: INDEX_NAME,
      body: {
        query: {
          bool: {
            must: mustQueries,
            filter: filterQueries,
          },
        },
        highlight: {
          pre_tags: ['<mark class="bg-indigo-500/20 text-indigo-200 px-1 rounded font-semibold">'],
          post_tags: ['</mark>'],
          fields: {
            title: { number_of_fragments: 0 },
            summary: { number_of_fragments: 1, fragment_size: 150 },
            content: { number_of_fragments: 3, fragment_size: 100 },
          },
        },
      },
    };

    const response = await esClient.search(searchParams);
    
    return response.hits.hits.map((hit: any) => {
      const source = hit._source;
      const highlight = hit.highlight || {};
      
      return {
        id: source.id,
        title: highlight.title ? highlight.title[0] : source.title,
        slug: source.slug,
        summary: highlight.summary ? highlight.summary[0] : source.summary,
        categoryName: source.categoryName,
        tags: source.tags,
        published: source.published,
        createdAt: source.createdAt,
        highlights: highlight.content || [],
        score: hit._score,
      };
    });
  } catch (error) {
    console.error('Search query failed:', error);
    return [];
  }
};

export const suggestArticles = async (queryText: string) => {
  try {
    if (!queryText || queryText.trim().length === 0) return [];

    const response = await esClient.search({
      index: INDEX_NAME,
      body: {
        query: {
          bool: {
            must: [
              {
                match: {
                  title: {
                    query: queryText,
                    fuzziness: 'AUTO',
                    operator: 'or',
                  },
                },
              },
            ],
            filter: [{ term: { published: true } }],
          },
        },
        _source: ['id', 'title', 'slug', 'categoryName'],
        size: 5,
      },
    });

    return response.hits.hits.map((hit: any) => ({
      id: hit._source.id,
      title: hit._source.title,
      slug: hit._source.slug,
      categoryName: hit._source.categoryName,
    }));
  } catch (error) {
    console.error('Suggestions query failed:', error);
    return [];
  }
};
