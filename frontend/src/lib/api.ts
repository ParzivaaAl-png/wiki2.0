const getApiUrl = () => {
  let apiUrl = import.meta.env.VITE_API_URL || '';
  
  if (!apiUrl) {
    apiUrl = import.meta.env.DEV ? 'http://localhost:5000/api' : 'https://wiki-backend-vxis.onrender.com/api';
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
  is_visible?: boolean;
  color?: string;
  article_count?: number;
}

export interface User {
  id: number;
  username: string;
  name: string;
  role: 'Admin' | 'Editor' | 'User';
  is_blocked: boolean;
  employee_id?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface ArticleChangeLog {
  id: number;
  article_id: number;
  user_id: number | null;
  user_name: string | null;
  user_role: string | null;
  changed_at: string;
  change_description: string;
  editor_comment: string;
  old_content: string | null;
  new_content: string | null;
  old_title: string | null;
  new_title: string | null;
}

export interface Article {
  id: number;
  title: string;
  slug: string;
  content: string;
  summary: string;
  category_id: number | null;
  author_id?: number | null;
  author_name?: string;
  published: boolean;
  is_visible?: boolean;
  status?: string;
  views: number;
  position: number;
  created_at: string;
  updated_at: string;
  tags: string[];
  section_ids?: number[];
  highlights?: string[];
  score?: number;
  source_url?: string | null;
  sync_interval?: string;
  last_sync_at?: string | null;
  next_sync_at?: string | null;
  structured_data?: any | null;
  latest_change?: ArticleChangeLog | null;
  favorited_at?: string;
  viewed_at?: string;
  trending_views?: number | string;
  favorites_count?: number | string;
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

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

const subscribeTokenRefresh = (cb: (token: string) => void) => {
  refreshSubscribers.push(cb);
};

const onRefreshed = (token: string) => {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
};

const performTokenRefresh = async (): Promise<string> => {
  const url = `${getApiUrl()}/auth/refresh`;
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Session expired');
  }

  const data = await response.json();
  if (data.accessToken) {
    setAuthToken(data.accessToken);
    return data.accessToken;
  }
  throw new Error('Session expired');
};

// Helper to make API calls with cookies included and error handling
async function apiCall<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = path.startsWith('http') ? path : `${getApiUrl()}${path}`;
  
  // Build auth headers — include Bearer token as fallback for cross-origin cookie issues
  const authHeaders: Record<string, string> = {};
  const token = getAuthToken();
  if (token) {
    authHeaders['Authorization'] = `Bearer ${token}`;
  }
  
  let response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      ...(!(options.body instanceof FormData) && { 'Content-Type': 'application/json' }),
      ...authHeaders,
      ...options.headers,
    },
  });

  // Handle Token Expiration and Refresh Interceptor
  if (response.status === 401 && !path.includes('/auth/login') && !path.includes('/auth/refresh') && !path.includes('/auth/register')) {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const newAccessToken = await performTokenRefresh();
        isRefreshing = false;
        onRefreshed(newAccessToken);
      } catch (err) {
        isRefreshing = false;
        clearAuthToken();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('auth_logout'));
        }
        throw new Error('Сессия истекла. Пожалуйста, войдите снова.');
      }
    }

    return new Promise((resolve, reject) => {
      subscribeTokenRefresh((newToken) => {
        // Retry the original request with the new access token
        const newAuthHeaders = { ...authHeaders, 'Authorization': `Bearer ${newToken}` };
        apiCall<T>(path, {
          ...options,
          headers: {
            ...options.headers,
            ...newAuthHeaders,
          },
        }).then(resolve).catch(reject);
      });
    });
  }

  if (!response.ok) {
    let errorMessage = 'Произошла ошибка при запросе к серверу.';
    try {
      const err = await response.json();
      errorMessage = err.details ? `${err.error}: ${err.details}` : (err.error || errorMessage);
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

export async function fetchCategories(options: { all?: boolean } = {}): Promise<Category[]> {
  const query = options.all ? '?all=true' : '';
  return apiCallWithCache<Category[]>(`/categories${query}`, { cache: 'no-store' });
}

export async function fetchCategory(slugOrId: string | number): Promise<Category> {
  return apiCallWithCache<Category>(`/categories/${slugOrId}`, { cache: 'no-store' });
}

export async function createCategory(data: Omit<Category, 'id' | 'article_count'> & { content?: string }): Promise<Category> {
  clearApiCache();
  return apiCall<Category>('/categories', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateCategory(
  id: number,
  data: Omit<Category, 'id' | 'article_count'>
): Promise<Category> {
  clearApiCache();
  return apiCall<Category>(`/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function reorderCategories(orders: { id: number; position: number }[]): Promise<void> {
  clearApiCache();
  return apiCall<void>('/categories/reorder', {
    method: 'POST',
    body: JSON.stringify({ orders }),
  });
}

export async function deleteCategory(id: number): Promise<void> {
  clearApiCache();
  return apiCall<void>(`/categories/${id}`, {
    method: 'DELETE',
  });
}

export async function fetchArticles(params?: {
  category?: string;
  tag?: string;
  all?: boolean;
  filter?: string;
}): Promise<Article[]> {
  const queryParams = new URLSearchParams();
  if (params?.category) queryParams.set('category', params.category);
  if (params?.tag) queryParams.set('tag', params.tag);
  if (params?.all) queryParams.set('all', 'true');
  if (params?.filter) queryParams.set('filter', params.filter);

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
  data: Omit<Article, 'id' | 'created_at' | 'updated_at' | 'views'> & { change_description?: string; editor_comment?: string }
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

export async function fetchFavoriteArticles(): Promise<Article[]> {
  return apiCall<Article[]>('/users/me/favorites', { cache: 'no-store' });
}

export async function saveFavoriteArticles(articleIds: number[]): Promise<void> {
  clearApiCache();
  return apiCall<void>('/users/me/favorites', {
    method: 'POST',
    body: JSON.stringify({ articleIds }),
  });
}

export async function reorderArticles(orders: { id: number; position: number }[]): Promise<void> {
  clearApiCache();
  return apiCall<void>('/articles/reorder', {
    method: 'POST',
    body: JSON.stringify({ orders }),
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

// User Sessions & Audit Logs API Wrappers
export interface UserSession {
  id: number;
  user_id: number;
  ip_address: string;
  user_agent: string;
  created_at: string;
  last_active_at: string;
}

export interface UserWithSessions extends User {
  sessions: UserSession[];
}

export interface UserAuditLog {
  id: number;
  field_changed: 'username' | 'name' | 'password';
  old_value: string;
  new_value: string;
  changed_at: string;
  changed_by_username: string | null;
  changed_by_name: string | null;
}

export async function fetchUserSessions(): Promise<UserWithSessions[]> {
  return apiCall<UserWithSessions[]>('/admin/sessions');
}

export async function deleteUserSession(id: number): Promise<{ message: string }> {
  return apiCall<{ message: string }>(`/admin/sessions/${id}`, {
    method: 'DELETE',
  });
}

export async function adminUpdateUser(id: number, data: { username: string; name: string; password?: string }): Promise<User> {
  clearApiCache();
  return apiCall<User>(`/admin/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function fetchUserHistory(userId: number): Promise<UserAuditLog[]> {
  return apiCall<UserAuditLog[]>(`/admin/users/${userId}/history`);
}

export async function clearServerCache(): Promise<{ message: string }> {
  clearApiCache();
  return apiCall<{ message: string }>('/admin/clear-cache', {
    method: 'POST',
  });
}

// Yandex Classifier Sync & Notifications API
export interface ArticleSyncLog {
  id: number;
  article_id: number;
  synced_at: string;
  source_url: string;
  status: 'success' | 'failed';
  changes_count: number;
  changes_summary: {
    added: string[];
    removed: string[];
    updated: string[];
  };
  error_message: string | null;
  backup_content: string | null;
}

export interface Notification {
  id: number;
  user_id: number | null;
  role: string | null;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  is_read: boolean;
  created_at: string;
}

export async function syncArticleNow(id: number, force = false): Promise<{ message: string }> {
  clearApiCache();
  return apiCall<{ message: string }>(`/articles/${id}/sync`, {
    method: 'POST',
    body: JSON.stringify({ force }),
  });
}

export async function fetchArticleSyncHistory(id: number): Promise<ArticleSyncLog[]> {
  return apiCall<ArticleSyncLog[]>(`/articles/${id}/sync-history`);
}

export async function fetchClassifierData(): Promise<any> {
  return apiCall<any>('/classifier/data');
}

export async function fetchNotifications(): Promise<Notification[]> {
  return apiCall<Notification[]>('/notifications');
}

export async function markNotificationsAsRead(): Promise<{ message: string }> {
  return apiCall<{ message: string }>('/notifications/read', {
    method: 'POST',
  });
}

export interface NewsAttachment {
  id: number;
  file_url: string;
  file_name: string;
  file_size: number;
  created_at: string;
}

export interface News {
  id: number;
  title: string;
  description: string;
  content: string;
  is_published: boolean;
  is_pinned: boolean;
  author_id: number | null;
  author_name?: string;
  published_at: string;
  created_at: string;
  updated_at: string;
  tags: string[];
  images: string[];
  attachments: NewsAttachment[];
  is_read?: boolean;
}

export interface NewsSearchResult {
  id: number;
  title: string;
  description: string;
  tags: string[];
  attachments: string[];
  isPublished: boolean;
  isPinned: boolean;
  publishedAt: string;
  createdAt: string;
  highlights: string[];
  score: number;
}

export async function fetchNews(): Promise<News[]> {
  return apiCall<News[]>('/news', { cache: 'no-store' });
}

export async function fetchNewsDetail(id: number): Promise<News> {
  clearApiCache();
  return apiCall<News>(`/news/${id}`, { cache: 'no-store' });
}

export async function fetchUnreadNewsCount(): Promise<number> {
  const result = await apiCall<{ count: number }>('/news/unread-count', { cache: 'no-store' });
  return result.count;
}

export async function createNews(data: {
  title: string;
  description: string;
  content: string;
  is_published: boolean;
  is_pinned: boolean;
  published_at?: string;
  tags: string[];
  images: string[];
  attachments: { file_url: string; file_name: string; file_size: number }[];
}): Promise<News> {
  clearApiCache();
  return apiCall<News>('/news', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateNews(
  id: number,
  data: {
    title: string;
    description: string;
    content: string;
    is_published: boolean;
    is_pinned: boolean;
    published_at?: string;
    tags: string[];
    images: string[];
    attachments: { file_url: string; file_name: string; file_size: number }[];
  }
): Promise<News> {
  clearApiCache();
  return apiCall<News>(`/news/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteNews(id: number): Promise<void> {
  clearApiCache();
  return apiCall<void>(`/news/${id}`, {
    method: 'DELETE',
  });
}

export async function searchNews(q: string, tag?: string): Promise<NewsSearchResult[]> {
  const queryParams = new URLSearchParams({ q });
  if (tag) queryParams.set('tag', tag);
  return apiCall<NewsSearchResult[]>(`/news/search?${queryParams.toString()}`);
}

export async function uploadNewsAttachment(file: File): Promise<{ file_url: string; file_name: string; file_size: number }> {
  const formData = new FormData();
  formData.append('file', file);
  return apiCall<{ file_url: string; file_name: string; file_size: number }>('/news/upload-attachment', {
    method: 'POST',
    body: formData,
  });
}

// Favorites add/remove
export async function addFavoriteArticle(articleId: number): Promise<void> {
  clearApiCache();
  return apiCall<void>('/users/me/favorites/add', {
    method: 'POST',
    body: JSON.stringify({ articleId }),
  });
}

export async function removeFavoriteArticle(articleId: number): Promise<void> {
  clearApiCache();
  return apiCall<void>('/users/me/favorites/remove', {
    method: 'POST',
    body: JSON.stringify({ articleId }),
  });
}

// Reading History
export async function fetchReadingHistory(): Promise<Article[]> {
  return apiCall<Article[]>('/users/me/history', { cache: 'no-store' });
}

export async function clearReadingHistory(): Promise<void> {
  clearApiCache();
  return apiCall<void>('/users/me/history/clear', {
    method: 'POST',
  });
}

// Article Changes
export async function fetchArticleChanges(id: number): Promise<ArticleChangeLog[]> {
  return apiCall<ArticleChangeLog[]>(`/articles/${id}/changes`, { cache: 'no-store' });
}

// Article Rankings
export async function fetchPopularArticles(): Promise<Article[]> {
  return apiCall<Article[]>('/articles/ranking/popular', { cache: 'no-store' });
}

export async function fetchTrendingArticles(): Promise<Article[]> {
  return apiCall<Article[]>('/articles/ranking/trending', { cache: 'no-store' });
}

export async function fetchRecommendedArticles(): Promise<Article[]> {
  return apiCall<Article[]>('/articles/ranking/recommended', { cache: 'no-store' });
}

export interface RecentChange extends ArticleChangeLog {
  article_title: string;
  article_slug: string;
}

export async function fetchRecentChanges(): Promise<RecentChange[]> {
  return apiCall<RecentChange[]>('/articles/changes/recent', { cache: 'no-store' });
}

export async function restoreArticleVersion(id: number, changeId: number): Promise<Article> {
  clearApiCache();
  return apiCall<Article>(`/articles/${id}/restore/${changeId}`, {
    method: 'POST',
  });
}

export interface Space {
  id: number;
  name: string;
  description: string;
  department_id: number | null;
  sections: Section[];
}

export interface Section {
  id: number;
  name: string;
  description: string;
  position_id: number;
  articles: {
    id: number;
    title: string;
    slug: string;
    status: string;
    position: number;
  }[];
  subsections: Section[];
}

export async function fetchNavigationTree(): Promise<Space[]> {
  return apiCall<Space[]>('/navigation', { cache: 'no-store' });
}


