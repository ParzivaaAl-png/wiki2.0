const getApiUrl = () => {
  let apiUrl = import.meta.env.VITE_API_URL || '';
  
  if (!apiUrl) {
    apiUrl = import.meta.env.DEV ? 'http://localhost:5000/api' : 'https://wiki-backend-atnp.onrender.com/api';
  }

  // If the API URL points to localhost, but the user is accessing the site from another device
  // (e.g. using the server's local IP address like 192.168.1.5), resolve the backend host dynamically.
  if (typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost') {
    if (apiUrl.includes('localhost')) {
      return apiUrl.replace('localhost', window.location.hostname);
    }
    // If it's a production build running locally, direct requests to the current hostname's backend port
    const isCloud = window.location.hostname.includes('onrender.com') || 
                    window.location.hostname.includes('vercel.app') || 
                    window.location.hostname.includes('github.io');
    if (!isCloud && !import.meta.env.DEV) {
      return `http://${window.location.hostname}:5000/api`;
    }
  }

  return apiUrl;
};


// Token storage for cross-origin auth fallback (Safari ITP blocks third-party cookies)
let memoryToken: string | null = null;

export function setAuthToken(token: string | null) {
  memoryToken = token;
  if (token) {
    localStorage.setItem('wiki_access_token', token);
  } else {
    localStorage.removeItem('wiki_access_token');
  }
}

export function getAuthToken(): string | null {
  return memoryToken || localStorage.getItem('wiki_access_token');
}

export function clearAuthToken() {
  memoryToken = null;
  localStorage.removeItem('wiki_access_token');
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  icon: string;
  description: string;
  position: number;
  article_count?: number;
}

export interface User {
  id: number;
  username: string;
  name: string;
  role: 'Admin' | 'Editor' | 'User';
  is_blocked: boolean;
  created_at?: string;
  updated_at?: string;
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
  title: string;
  slug: string;
  summary: string;
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

// In-memory cache for fast page navigation (TTL of 15 seconds)
const apiCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 15000;

export function clearApiCache() {
  apiCache.clear();
}

// Helper to make API calls with cookies included and error handling
async function apiCall<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = path.startsWith('http') ? path : `${getApiUrl()}${path}`;
  
  // Build auth headers — include Bearer token as fallback for cross-origin cookie issues
  const authHeaders: Record<string, string> = {};
  const token = getAuthToken();
  if (token) {
    authHeaders['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      ...(!(options.body instanceof FormData) && { 'Content-Type': 'application/json' }),
      ...authHeaders,
      ...options.headers,
    },
  });

  if (!response.ok) {
    let errorMessage = 'Произошла ошибка при запросе к серверу.';
    try {
      const err = await response.json();
      errorMessage = err.error || errorMessage;
    } catch (e) {
      // JSON parsing failed, keep default message
    }
    throw new Error(errorMessage);
  }

  // Handle empty responses
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// Cached API call wrapper for read-only queries
async function apiCallWithCache<T>(path: string, options: RequestInit = {}): Promise<T> {
  const isGet = !options.method || options.method === 'GET';
  
  if (!isGet) {
    clearApiCache();
    return apiCall<T>(path, options);
  }

  const cacheKey = `${path}_${JSON.stringify(options)}`;
  const cached = apiCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as T;
  }

  const data = await apiCall<T>(path, options);
  apiCache.set(cacheKey, { data, timestamp: Date.now() });
  return data;
}

export async function fetchCategories(): Promise<Category[]> {
  return apiCallWithCache<Category[]>('/categories', { cache: 'no-store' });
}

export async function fetchCategory(slugOrId: string | number): Promise<Category> {
  return apiCallWithCache<Category>(`/categories/${slugOrId}`, { cache: 'no-store' });
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

  return apiCallWithCache<Article[]>(`/articles?${queryParams.toString()}`, { cache: 'no-store' });
}

export async function fetchArticle(slugOrId: string | number): Promise<Article> {
  return apiCallWithCache<Article>(`/articles/${slugOrId}`, { cache: 'no-store' });
}

export async function searchArticles(
  q: string,
  category?: string,
  tag?: string
): Promise<SearchResult[]> {
  const queryParams = new URLSearchParams({ q });
  if (category) queryParams.set('category', category);
  if (tag) queryParams.set('tag', tag);

  return apiCallWithCache<SearchResult[]>(`/search?${queryParams.toString()}`, { cache: 'no-store' });
}

export async function suggestArticles(q: string): Promise<Suggestion[]> {
  return apiCallWithCache<Suggestion[]>(`/search/suggest?q=${encodeURIComponent(q)}`, { cache: 'no-store' });
}

export async function createArticle(data: Omit<Article, 'id' | 'created_at' | 'updated_at' | 'views'>): Promise<Article> {
  clearApiCache();
  return apiCall<Article>('/articles', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateArticle(
  id: number,
  data: Omit<Article, 'id' | 'created_at' | 'updated_at' | 'views'>
): Promise<Article> {
  clearApiCache();
  return apiCall<Article>(`/articles/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteArticle(id: number): Promise<void> {
  clearApiCache();
  return apiCall<void>(`/articles/${id}`, {
    method: 'DELETE',
  });
}

export async function uploadImage(file: File): Promise<{ url: string }> {
  return apiCall<{ url: string }>('/upload', {
    method: 'POST',
    body: (() => {
      const formData = new FormData();
      formData.append('image', file);
      return formData;
    })(),
  });
}

// Authentication API
export async function loginUser(username: string, password: string): Promise<{ user: User; accessToken: string }> {
  clearApiCache();
  const result = await apiCall<{ user: User; accessToken: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  // Store token for cross-origin auth fallback
  if (result.accessToken) {
    setAuthToken(result.accessToken);
  }
  return result;
}

export async function registerUser(username: string, name: string, password: string): Promise<{ user: User; accessToken: string }> {
  clearApiCache();
  const result = await apiCall<{ user: User; accessToken: string }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, name, password }),
  });
  // Store token for cross-origin auth fallback
  if (result.accessToken) {
    setAuthToken(result.accessToken);
  }
  return result;
}

export async function logoutUser(): Promise<{ message: string }> {
  clearApiCache();
  clearAuthToken();
  return apiCall<{ message: string }>('/auth/logout', {
    method: 'POST',
  });
}

export async function fetchMe(): Promise<User> {
  return apiCallWithCache<User>('/auth/me', { cache: 'no-store' });
}

// Article Import API
export async function importArticle(file: File): Promise<Article> {
  clearApiCache();
  const formData = new FormData();
  formData.append('file', file);

  return apiCall<Article>('/articles/import', {
    method: 'POST',
    body: formData,
  });
}

// Admin User Management API
export async function adminFetchUsers(): Promise<User[]> {
  return apiCallWithCache<User[]>('/admin/users', { cache: 'no-store' });
}

export async function adminCreateUser(data: Omit<User, 'id' | 'is_blocked'> & { password: string }): Promise<User> {
  clearApiCache();
  return apiCall<User>('/admin/users', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function adminChangeRole(userId: number, role: 'Admin' | 'Editor' | 'User'): Promise<{ message: string }> {
  clearApiCache();
  return apiCall<{ message: string }>(`/admin/users/${userId}/role`, {
    method: 'PUT',
    body: JSON.stringify({ role }),
  });
}

export async function adminToggleBlock(userId: number, is_blocked: boolean): Promise<{ message: string }> {
  clearApiCache();
  return apiCall<{ message: string }>(`/admin/users/${userId}/block`, {
    method: 'PUT',
    body: JSON.stringify({ is_blocked }),
  });
}

export async function adminResetPassword(userId: number, password: string): Promise<{ message: string }> {
  clearApiCache();
  return apiCall<{ message: string }>(`/admin/users/${userId}/reset-password`, {
    method: 'PUT',
    body: JSON.stringify({ password }),
  });
}

export async function adminDeleteUser(userId: number): Promise<{ message: string }> {
  clearApiCache();
  return apiCall<{ message: string }>(`/admin/users/${userId}`, {
    method: 'DELETE',
  });
}

