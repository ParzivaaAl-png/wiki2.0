const getApiUrl = () => {
  if (typeof window === 'undefined') {
    // Inside Docker container networking, the backend service is named "backend"
    return process.env.INTERNAL_API_URL || 'http://backend:5000/api';
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
};

export interface Category {
  id: number;
  name: string;
  slug: string;
  icon: string;
  description: string;
  position: number;
  article_count?: number;
}

export interface Article {
  id: number;
  title: string;
  slug: string;
  content: string;
  summary: string;
  category_id: number | null;
  category_name?: string;
  category_slug?: string;
  published: boolean;
  views: number;
  created_at: string;
  updated_at: string;
  tags: string[];
  highlights?: string[];
  score?: number;
}

export interface SearchResult {
  id: number;
  title: string; // highlighted if matched
  slug: string;
  summary: string; // highlighted if matched
  categoryName: string;
  tags: string[];
  published: boolean;
  createdAt: string;
  highlights: string[];
  score: number;
}

export interface Suggestion {
  id: number;
  title: string;
  slug: string;
  categoryName: string;
}

export async function fetchCategories(): Promise<Category[]> {
  const res = await fetch(`${getApiUrl()}/categories`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch categories');
  return res.json();
}

export async function fetchCategory(slugOrId: string | number): Promise<Category> {
  const res = await fetch(`${getApiUrl()}/categories/${slugOrId}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch category');
  return res.json();
}

export async function fetchArticles(params?: {
  category?: string;
  tag?: string;
  all?: boolean;
}): Promise<Article[]> {
  const queryParams = new URLSearchParams();
  if (params?.category) queryParams.set('category', params.category);
  if (params?.tag) queryParams.set('tag', params.tag);
  if (params?.all) queryParams.set('all', 'true');

  const url = `${getApiUrl()}/articles?${queryParams.toString()}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch articles');
  return res.json();
}

export async function fetchArticle(slugOrId: string | number): Promise<Article> {
  const res = await fetch(`${getApiUrl()}/articles/${slugOrId}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch article');
  return res.json();
}

export async function searchArticles(
  q: string,
  category?: string,
  tag?: string
): Promise<SearchResult[]> {
  const queryParams = new URLSearchParams({ q });
  if (category) queryParams.set('category', category);
  if (tag) queryParams.set('tag', tag);

  const res = await fetch(`${getApiUrl()}/search?${queryParams.toString()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to search articles');
  return res.json();
}

export async function suggestArticles(q: string): Promise<Suggestion[]> {
  const res = await fetch(`${getApiUrl()}/search/suggest?q=${encodeURIComponent(q)}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch suggestions');
  return res.json();
}

export async function createArticle(data: Omit<Article, 'id' | 'created_at' | 'updated_at' | 'views'>): Promise<Article> {
  const res = await fetch(`${getApiUrl()}/articles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to create article');
  }
  return res.json();
}

export async function updateArticle(
  id: number,
  data: Omit<Article, 'id' | 'created_at' | 'updated_at' | 'views'>
): Promise<Article> {
  const res = await fetch(`${getApiUrl()}/articles/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to update article');
  }
  return res.json();
}

export async function deleteArticle(id: number): Promise<void> {
  const res = await fetch(`${getApiUrl()}/articles/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete article');
}

export async function uploadImage(file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append('image', file);

  const res = await fetch(`${getApiUrl()}/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to upload image');
  }

  return res.json();
}
