const getApiUrl = () => {
  let apiUrl = import.meta.env.VITE_API_URL || '';
  
  if (!apiUrl) {
    apiUrl = import.meta.env.DEV ? 'http://localhost:5000/api' : 'https://wiki-backend-combined-6tmd.onrender.com/api';
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
  role: string;
  is_blocked: boolean;
  employee_id?: number | null;
  wiki_roles?: Array<{ id: number; code: string; name: string }>;
  capabilities?: WikiCapabilities;
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

export interface GuestAccessInfo {
  type: 'article' | 'section';
  expires_at: string;
  article_id: number | null;
  section_id: number | null;
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
  article_type?: string;
  owner_id?: number | null;
  owner_name?: string;
  approver_id?: number | null;
  approver_name?: string;
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
  guest_access?: GuestAccessInfo | null;
}

export interface AnalyticsReport {
  generatedAt: string;
  periodDays: number;
  staleDays: number;
  overview: {
    total_articles: number;
    published_articles: number;
    draft_articles: number;
    archived_articles: number;
    stale_articles: number;
    updated_articles: number;
    total_spaces: number;
    total_sections: number;
    total_users: number;
    period_views: number;
    active_users: number;
  };
  dailyViews: Array<{ day: string; views: number; unique_readers: number }>;
  topArticles: Array<{
    id: number;
    title: string;
    slug: string;
    total_views: number;
    period_views: number;
    unique_readers: number;
    favorites: number;
  }>;
  sectionStats: Array<{
    id: number;
    section_name: string;
    space_name: string;
    article_count: number;
    period_views: number;
    last_updated_at: string | null;
  }>;
  contributorStats: Array<{
    id: number;
    name: string;
    role: string;
    authored_articles: number;
    period_edits: number;
    last_edit_at: string | null;
  }>;
  userActivity: Array<{
    id: number;
    name: string;
    role: string;
    views: number;
    unique_articles: number;
    last_viewed_at: string | null;
  }>;
  staleArticles: Array<{
    id: number;
    title: string;
    slug: string;
    updated_at: string;
    views: number;
    owner_name: string | null;
    days_without_update: number;
  }>;
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
let refreshSubscribers: Array<{
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}> = [];

const subscribeTokenRefresh = () =>
  new Promise<string>((resolve, reject) => {
    refreshSubscribers.push({ resolve, reject });
  });

const onRefreshed = (token: string) => {
  refreshSubscribers.forEach(({ resolve }) => resolve(token));
  refreshSubscribers = [];
};

const onRefreshFailed = (error: Error) => {
  refreshSubscribers.forEach(({ reject }) => reject(error));
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
    let newAccessToken: string;

    try {
      if (isRefreshing) {
        newAccessToken = await subscribeTokenRefresh();
      } else {
        isRefreshing = true;
        newAccessToken = await performTokenRefresh();
        isRefreshing = false;
        onRefreshed(newAccessToken);
      }
    } catch (err) {
      const sessionError = new Error('Сессия истекла. Пожалуйста, войдите снова.');
      isRefreshing = false;
      onRefreshFailed(sessionError);
      clearAuthToken();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('auth_logout'));
      }
      throw sessionError;
    }

    return apiCall<T>(path, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${newAccessToken}`,
      },
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

export async function fetchAnalyticsReport(days = 30, staleDays = 90): Promise<AnalyticsReport> {
  const params = new URLSearchParams({ days: String(days), staleDays: String(staleDays) });
  return apiCall<AnalyticsReport>(`/admin/analytics?${params.toString()}`, { cache: 'no-store' });
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

export async function adminCreateUser(data: {
  username: string;
  name: string;
  password: string;
  role?: string;
  employee_id?: number | null;
}): Promise<User> {
  clearApiCache();
  return apiCall<User>('/admin/users', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function adminChangeRole(userId: number, role: string): Promise<{ message: string }> {
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

export async function adminUpdateUser(id: number, data: { username: string; name: string; password?: string; employee_id?: number | null }): Promise<User> {
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
  video_url?: string | null;
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
  department_ids?: number[];
  department_names?: string[];
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
  video_url?: string | null;
  is_published: boolean;
  is_pinned: boolean;
  published_at?: string;
  tags: string[];
  images: string[];
  attachments: { file_url: string; file_name: string; file_size: number }[];
  department_ids?: number[];
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
    video_url?: string | null;
    is_published: boolean;
    is_pinned: boolean;
    published_at?: string;
    bump_to_top?: boolean;
    tags: string[];
    images: string[];
    attachments: { file_url: string; file_name: string; file_size: number }[];
    department_ids?: number[];
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
  status?: string;
  sections: Section[];
}

export interface Section {
  id: number;
  name: string;
  description: string;
  position_id: number | null;
  articles: {
    id: number;
    title: string;
    slug: string;
    status: string;
    position: number;
    article_type?: string;
    guest_access?: GuestAccessInfo | null;
  }[];
  subsections: Section[];
  guest_access?: GuestAccessInfo | null;
  owner_id?: number | null;
  parent_section_id?: number | null;
  space_id?: number;
  status?: string;
}

export async function fetchNavigationTree(): Promise<Space[]> {
  return apiCall<Space[]>('/navigation', { cache: 'no-store' });
}

export interface Department {
  id: number;
  name: string;
  description: string | null;
  parent_department_id: number | null;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export interface Position {
  id: number;
  name: string;
  department_id: number;
  parent_position_id: number | null;
  hierarchy_level: number;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export interface Employee {
  id: number;
  full_name: string;
  email: string;
  position_id: number | null;
  department_id: number | null;
  manager_id: number | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface GuestAccess {
  id: number;
  user_id: number;
  article_id: number | null;
  section_id: number | null;
  granted_by: number | null;
  expires_at: string;
  created_at: string;
  status: string;
  user_name?: string;
  user_full_name?: string;
  article_title?: string;
  section_name?: string;
  granted_by_name?: string;
}

export interface ArticleLink {
  id: number;
  source_article_id: number;
  target_article_id: number;
  link_text: string;
  link_source?: 'manual' | 'content' | string;
  created_at?: string;
  target_title?: string;
  target_slug?: string;
  target_summary?: string;
  target_status?: string;
  target_updated_at?: string;
  target_section_paths?: string[];
  source_title?: string;
  source_slug?: string;
  source_summary?: string;
  source_status?: string;
  source_updated_at?: string;
  source_section_paths?: string[];
}

export interface WikiCapabilities {
  can_read: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_publish: boolean;
  can_approve: boolean;
  can_manage_users: boolean;
  can_manage_structure: boolean;
  can_manage_access: boolean;
}

export interface WikiRole {
  id: number;
  code: string;
  name: string;
  description: string | null;
  can_read: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_publish: boolean;
  can_approve: boolean;
  can_manage_users: boolean;
  can_manage_structure: boolean;
  can_manage_access: boolean;
}

export interface AccessOverviewUser extends User {
  employee_name?: string | null;
  position_name?: string | null;
  department_name?: string | null;
  access_mode?: 'auto' | 'manual';
  manual_department_ids?: number[];
  manual_section_ids?: number[];
  wiki_roles: Array<{ id: number; code: string; name: string }>;
}

export interface SectionAccessRule {
  id: number;
  section_id: number;
  position_id: number | null;
  department_id: number | null;
  wiki_role_id: number | null;
  access_level: string;
  can_read: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_publish: boolean;
  can_approve: boolean;
  grant_subsections: boolean;
  section_name: string;
  space_name: string | null;
  position_name: string | null;
  department_name: string | null;
  wiki_role_name: string | null;
  wiki_role_code: string | null;
}

export interface AccessMatrixRow {
  position_id: number;
  position_name: string;
  department_name: string | null;
  hierarchy_level: number;
  sections: Array<{
    id: number;
    name: string;
    space_name: string | null;
    visibility_scope: string;
  }>;
}

export interface AccessOverview {
  roles: WikiRole[];
  users: AccessOverviewUser[];
  departments: Department[];
  positions: Position[];
  sections: Array<Section & {
    space_name?: string | null;
    position_name?: string | null;
    owner_name?: string | null;
    visibility_scope?: string;
  }>;
  rules: SectionAccessRule[];
  matrix: AccessMatrixRow[];
  summary: {
    users: number;
    roles: number;
    departments: number;
    positions: number;
    sections: number;
    rules: number;
  };
}

export interface EffectiveAccess {
  user: AccessOverviewUser & {
    position_id?: number | null;
    department_id?: number | null;
    capabilities: WikiCapabilities;
  };
  capabilities: WikiCapabilities;
  wiki_roles: Array<{ id: number; code: string; name: string }>;
  sections: Array<{
    id: number;
    name: string;
    description: string | null;
    visibility_scope: string;
    space_name: string | null;
    owner_name: string | null;
  }>;
  section_count: number;
}

// DEPARTMENTS
export async function fetchDepartments(): Promise<Department[]> {
  return apiCall<Department[]>('/departments');
}
export async function createDepartment(data: Omit<Department, 'id'>): Promise<Department> {
  clearApiCache();
  return apiCall<Department>('/departments', { method: 'POST', body: JSON.stringify(data) });
}
export async function updateDepartment(id: number, data: Omit<Department, 'id'>): Promise<Department> {
  clearApiCache();
  return apiCall<Department>(`/departments/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}
export async function deleteDepartment(id: number): Promise<void> {
  clearApiCache();
  return apiCall<void>(`/departments/${id}`, { method: 'DELETE' });
}

// POSITIONS
export async function fetchPositions(): Promise<Position[]> {
  return apiCall<Position[]>('/positions');
}
export async function createPosition(data: Omit<Position, 'id'>): Promise<Position> {
  clearApiCache();
  return apiCall<Position>('/positions', { method: 'POST', body: JSON.stringify(data) });
}
export async function updatePosition(id: number, data: Omit<Position, 'id'>): Promise<Position> {
  clearApiCache();
  return apiCall<Position>(`/positions/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}
export async function deletePosition(id: number): Promise<void> {
  clearApiCache();
  return apiCall<void>(`/positions/${id}`, { method: 'DELETE' });
}

// EMPLOYEES
export async function fetchEmployees(): Promise<Employee[]> {
  return apiCall<Employee[]>('/employees');
}
export async function createEmployee(data: Omit<Employee, 'id'>): Promise<Employee> {
  clearApiCache();
  return apiCall<Employee>('/employees', { method: 'POST', body: JSON.stringify(data) });
}
export async function updateEmployee(id: number, data: Omit<Employee, 'id'>): Promise<Employee> {
  clearApiCache();
  return apiCall<Employee>(`/employees/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}
export async function deleteEmployee(id: number): Promise<void> {
  clearApiCache();
  return apiCall<void>(`/employees/${id}`, { method: 'DELETE' });
}

// SPACES
export async function fetchSpaces(): Promise<Space[]> {
  return apiCall<Space[]>('/wiki/spaces');
}
export async function createSpace(data: Omit<Space, 'id' | 'sections'>): Promise<Space> {
  clearApiCache();
  return apiCall<Space>('/wiki/spaces', { method: 'POST', body: JSON.stringify(data) });
}
export async function updateSpace(id: number, data: Omit<Space, 'id' | 'sections'>): Promise<Space> {
  clearApiCache();
  return apiCall<Space>(`/wiki/spaces/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}
export async function deleteSpace(id: number): Promise<void> {
  clearApiCache();
  return apiCall<void>(`/wiki/spaces/${id}`, { method: 'DELETE' });
}

// SECTIONS
export async function fetchSections(): Promise<Section[]> {
  return apiCall<Section[]>('/wiki/sections');
}
export async function createSection(data: Omit<Section, 'id' | 'articles' | 'subsections'>): Promise<Section> {
  clearApiCache();
  return apiCall<Section>('/wiki/sections', { method: 'POST', body: JSON.stringify(data) });
}
export async function updateSection(id: number, data: Omit<Section, 'id' | 'articles' | 'subsections'>): Promise<Section> {
  clearApiCache();
  return apiCall<Section>(`/wiki/sections/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}
export async function deleteSection(id: number): Promise<void> {
  clearApiCache();
  return apiCall<void>(`/wiki/sections/${id}`, { method: 'DELETE' });
}

// SYNC
export async function triggerOrgStructureSync(): Promise<{ message: string; details: any }> {
  clearApiCache();
  return apiCall<{ message: string; details: any }>('/wiki/sync/org-structure', { method: 'POST' });
}

// GUEST ACCESS
export async function fetchGuestAccessList(): Promise<GuestAccess[]> {
  return apiCall<GuestAccess[]>('/wiki/access/guest');
}
export async function createGuestAccess(data: { user_id: number; article_id?: number | null; section_id?: number | null; expires_at: string }): Promise<GuestAccess> {
  clearApiCache();
  return apiCall<GuestAccess>('/wiki/access/guest', { method: 'POST', body: JSON.stringify(data) });
}
export async function deleteGuestAccess(id: number): Promise<void> {
  clearApiCache();
  return apiCall<void>(`/wiki/access/guest/${id}`, { method: 'DELETE' });
}

// ACCESS CHECK
export async function checkAccess(params: { sectionId?: number; articleId?: number }): Promise<{ hasAccess: boolean; guestAccess?: GuestAccessInfo | null }> {
  const q = new URLSearchParams();
  if (params.sectionId) q.set('sectionId', String(params.sectionId));
  if (params.articleId) q.set('articleId', String(params.articleId));
  return apiCall<{ hasAccess: boolean }>(`/wiki/access/check?${q.toString()}`);
}

// ROLE ACCESS MODEL
export async function fetchAccessOverview(): Promise<AccessOverview> {
  return apiCall<AccessOverview>('/wiki/access/overview', { cache: 'no-store' });
}

export async function seedAccessDefaults(): Promise<{ message: string; details: any }> {
  clearApiCache();
  return apiCall<{ message: string; details: any }>('/wiki/access/seed-defaults', { method: 'POST' });
}

export async function fetchEffectiveAccess(userId: number): Promise<EffectiveAccess> {
  return apiCall<EffectiveAccess>(`/wiki/access/effective?userId=${userId}`, { cache: 'no-store' });
}

export async function updateUserWikiRoles(userId: number, roleIds: number[]): Promise<EffectiveAccess['user']> {
  clearApiCache();
  return apiCall<EffectiveAccess['user']>(`/wiki/access/users/${userId}/wiki-roles`, {
    method: 'PUT',
    body: JSON.stringify({ role_ids: roleIds }),
  });
}

export async function updateUserAccessScope(
  userId: number,
  data: { access_mode: 'auto' | 'manual'; department_ids: number[]; section_ids: number[] }
): Promise<EffectiveAccess['user']> {
  clearApiCache();
  return apiCall<EffectiveAccess['user']>(`/wiki/access/users/${userId}/access-scope`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ARTICLE LINKS
export async function fetchArticleLinks(articleId: number): Promise<ArticleLink[]> {
  return apiCall<ArticleLink[]>(`/articles/${articleId}/links`);
}
export async function fetchArticleBacklinks(articleId: number): Promise<ArticleLink[]> {
  return apiCall<ArticleLink[]>(`/articles/${articleId}/backlinks`);
}
export async function createArticleLink(articleId: number, data: { target_article_id: number; link_text?: string }): Promise<ArticleLink> {
  return apiCall<ArticleLink>(`/articles/${articleId}/links`, { method: 'POST', body: JSON.stringify(data) });
}
export async function deleteArticleLink(articleId: number, linkId: number): Promise<void> {
  return apiCall<void>(`/articles/${articleId}/links/${linkId}`, { method: 'DELETE' });
}
