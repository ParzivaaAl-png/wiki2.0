import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  BookOpen, 
  Layers, 
  ExternalLink,
  TrendingUp,
  FileUp,
  Users,
  Loader2,
  Eye,
  RotateCcw,
  Bell,
  BellRing,
  History,
  RefreshCw,
  X,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  MessageSquare,
  BarChart3,
} from 'lucide-react';
import { 
  fetchArticles, 
  deleteArticle, 
  updateArticle,
  Article, 
  importArticle,
  clearServerCache,
  syncArticleNow,
  fetchArticleSyncHistory,
  fetchNotifications,
  markNotificationsAsRead,
  ArticleSyncLog,
  Notification
} from '../lib/api';
import { useAuth } from '../lib/auth-context';
import PreviewModal from '../components/preview-modal';
import { NewsAdmin } from '../components/news-admin';
import WikiManagement from '../components/wiki-management';
import AnalyticsDashboard from '../components/analytics-dashboard';
import TeamAccessManagement from '../components/team-access-management';
import { AnimatePresence, motion } from 'framer-motion';

export default function Admin() {
  const { user, isAdmin, isEditor, isStaff } = useAuth();
  const navigate = useNavigate();
  const [articles, setArticles] = React.useState<Article[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  
  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'published' | 'drafts'>('all');
  const [activeTab, setActiveTab] = React.useState<'articles' | 'archive' | 'analytics' | 'news' | 'team' | 'wiki'>('articles');

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = React.useState(false);
  const [isClearingCache, setIsClearingCache] = React.useState(false);

  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [isNotificationsDrawerOpen, setIsNotificationsDrawerOpen] = React.useState(false);
  const [syncingArticleIds, setSyncingArticleIds] = React.useState<Record<number, boolean>>({});
  const [selectedArticleForHistory, setSelectedArticleForHistory] = React.useState<Article | null>(null);
  const [syncHistoryList, setSyncHistoryList] = React.useState<ArticleSyncLog[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = React.useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = React.useState<ArticleSyncLog | null>(null);

  const loadNotifications = React.useCallback(async () => {
    if (!isStaff) return;
    try {
      const data = await fetchNotifications();
      setNotifications(data);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  }, [isStaff]);

  React.useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  const unreadCount = React.useMemo(() => {
    return notifications.filter(n => !n.is_read).length;
  }, [notifications]);

  const handleMarkNotificationsRead = async () => {
    try {
      await markNotificationsAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error('Failed to mark notifications as read:', err);
    }
  };

  const handleSyncArticle = async (id: number) => {
    setSyncingArticleIds(prev => ({ ...prev, [id]: true }));
    try {
      const res = await syncArticleNow(id);
      alert(res.message || 'Синхронизация успешно завершена!');
      await loadAdminData();
      await loadNotifications();
    } catch (err: any) {
      console.error('Manual sync failed:', err);
      alert('Ошибка при синхронизации: ' + err.message);
    } finally {
      setSyncingArticleIds(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleOpenHistory = async (art: Article) => {
    setSelectedArticleForHistory(art);
    setIsLoadingHistory(true);
    try {
      const logs = await fetchArticleSyncHistory(art.id);
      setSyncHistoryList(logs);
    } catch (err: any) {
      console.error('Failed to load sync history:', err);
      alert('Не удалось загрузить историю синхронизации: ' + err.message);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const [selectedArticleForPreview, setSelectedArticleForPreview] = React.useState<Article | null>(null);

  const loadAdminData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch all articles (including drafts and hidden)
      const arts = await fetchArticles({ all: true });
      setArticles(arts.filter(art => !art.slug.startsWith('auto-list-')));
    } catch (err) {
      console.error('Failed to load admin articles catalog:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  const handleClearCache = async () => {
    setIsClearingCache(true);
    try {
      const res = await clearServerCache();
      alert(res.message || 'Кэш успешно очищен!');
    } catch (err: any) {
      console.error('Failed to clear cache:', err);
      alert('Ошибка при очистке кэша: ' + err.message);
    } finally {
      setIsClearingCache(false);
    }
  };

  // Position change handler for articles
  const handleArticlePositionChange = async (artId: number, newPos: number) => {
    const art = articles.find(a => a.id === artId);
    if (!art) return;
    try {
      await updateArticle(artId, {
        title: art.title,
        slug: art.slug,
        summary: art.summary,
        content: art.content,
        category_id: null,
        published: art.published,
        tags: art.tags,
        position: newPos,
        is_visible: art.is_visible
      });
      setArticles(prev => prev.map(a => a.id === artId ? { ...a, position: newPos } : a));
    } catch (err) {
      console.error('Failed to update article position:', err);
    }
  };

  // Soft Delete / Archive Article (is_visible = false)
  const handleArchiveArticle = async (art: Article) => {
    if (!window.confirm(`Вы уверены, что хотите скрыть статью "${art.title}"? Она будет отправлена в архив.`)) return;

    try {
      await updateArticle(art.id, {
        title: art.title,
        slug: art.slug,
        summary: art.summary || '',
        content: art.content,
        category_id: null,
        published: art.published,
        tags: art.tags,
        position: art.position || 0,
        is_visible: false
      });
      await loadAdminData();
      alert('Статья перенесена в архив.');
    } catch (err: any) {
      console.error('Failed to archive article:', err);
      alert('Не удалось скрыть статью: ' + err.message);
    }
  };

  // Restore Article (is_visible = true)
  const handleRestoreArticle = async (art: Article) => {
    try {
      await updateArticle(art.id, {
        title: art.title,
        slug: art.slug,
        summary: art.summary || '',
        content: art.content,
        category_id: null,
        published: art.published,
        tags: art.tags,
        position: art.position || 0,
        is_visible: true
      });
      await loadAdminData();
      alert('Статья успешно восстановлена из архива.');
    } catch (err: any) {
      console.error('Failed to restore article:', err);
      alert('Не удалось восстановить статью: ' + err.message);
    }
  };

  // Hard Delete Article (only Admin)
  const handleDeleteForever = async (artId: number, title: string) => {
    if (!window.confirm(`Вы уверены, что хотите НАВСЕГДА удалить статью "${title}"? Это действие необратимо.`)) return;

    try {
      await deleteArticle(artId);
      setArticles(prev => prev.filter(art => art.id !== artId));
      alert('Статья окончательно удалена из базы данных.');
    } catch (err: any) {
      console.error('Failed to permanently delete article:', err);
      alert('Не удалось удалить статью: ' + err.message);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      await importArticle(file);
      alert('Статья успешно импортирована, извлечен текст и настроено индексирование в Meilisearch!');
      await loadAdminData();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Ошибка импорта документа.');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // COMPUTE STATS
  const stats = React.useMemo(() => {
    const active = articles.filter(a => a.is_visible !== false);
    const drafts = active.filter(a => !a.published).length;
    const archived = articles.filter(a => a.is_visible === false).length;
    return {
      total: active.length,
      drafts,
      archived
    };
  }, [articles]);

  // FILTERED ARTICLES (ACTIVE LIST)
  const filteredArticles = React.useMemo(() => {
    return articles.filter(art => {
      // Exclude archived articles from active view
      if (art.is_visible === false) return false;

      // Apply status filters
      if (statusFilter === 'published' && !art.published) return false;
      if (statusFilter === 'drafts' && art.published) return false;

      // Apply search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return art.title.toLowerCase().includes(q) || (art.summary || '').toLowerCase().includes(q);
      }

      return true;
    });
  }, [articles, searchQuery, statusFilter]);

  // FILTERED ARCHIVED ARTICLES
  const archivedArticles = React.useMemo(() => {
    return articles.filter(art => {
      if (art.is_visible !== false) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return art.title.toLowerCase().includes(q) || (art.summary || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [articles, searchQuery]);

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-10 space-y-6 animate-pulse">
        <div className="h-10 w-48 bg-muted rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-28 bg-muted rounded-xl" />
          ))}
        </div>
        <div className="h-[400px] bg-muted rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-outfit text-3xl font-extrabold tracking-tight text-foreground">
            Панель управления
          </h1>
          <p className="text-muted-foreground text-sm font-light mt-1">
            Создание статей, импорт документов и управление архивами базы знаний.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* File import button & hidden input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".docx,.pdf,.txt,.xlsx,.csv"
            className="hidden"
          />
          <button
            onClick={handleImportClick}
            disabled={isImporting}
            className="inline-flex items-center gap-1.5 px-4 py-2 border border-border hover:bg-muted text-foreground rounded-lg text-sm font-semibold shadow-sm transition-all text-center justify-center cursor-pointer"
          >
            {isImporting ? (
              <Loader2 className="w-4.5 h-4.5 animate-spin" />
            ) : (
              <FileUp className="w-4.5 h-4.5" />
            )}
            <span>{isImporting ? 'Импорт...' : 'Импортировать файл'}</span>
          </button>

           <button
            onClick={() => navigate('/admin/editor/new')}
            className="inline-flex items-center gap-1.5 px-4 py-2 border border-indigo-500/20 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-lg text-sm font-semibold shadow-sm transition-all text-center justify-center cursor-pointer font-bold"
          >
            <Plus className="w-4.5 h-4.5 text-indigo-500" />
            <span>Создать статью</span>
          </button>

          {/* Notifications Bell */}
          {isStaff && (
            <button
              onClick={() => {
                setIsNotificationsDrawerOpen(true);
                handleMarkNotificationsRead();
              }}
              className="relative p-2 border border-border hover:bg-muted text-foreground rounded-lg text-sm shadow-sm transition-all text-center justify-center cursor-pointer"
              title="Уведомления об изменениях классификатора"
            >
              {unreadCount > 0 ? (
                <BellRing className="w-5 h-5 text-indigo-500 animate-bounce" />
              ) : (
                <Bell className="w-5 h-5" />
              )}
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white ring-2 ring-background">
                  {unreadCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Tabs Switcher for Admin & Editor roles */}
      {isStaff && (
        <div className="flex border-b border-border mb-8 gap-6 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('articles')}
            className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all shrink-0 cursor-pointer ${
              activeTab === 'articles'
                ? 'border-indigo-500 text-indigo-500'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Управление статьями
          </button>

          <button
            onClick={() => setActiveTab('archive')}
            className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all shrink-0 cursor-pointer ${
              activeTab === 'archive'
                ? 'border-indigo-500 text-indigo-500'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Trash2 className="w-4 h-4 text-muted-foreground" />
            Архив статей
          </button>

          <button
            onClick={() => setActiveTab('news')}
            className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all shrink-0 cursor-pointer ${
              activeTab === 'news'
                ? 'border-indigo-500 text-indigo-500'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
            Новости
          </button>

          {isAdmin && (
            <button
              onClick={() => setActiveTab('analytics')}
              className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all shrink-0 cursor-pointer ${
                activeTab === 'analytics'
                  ? 'border-indigo-500 text-indigo-500'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Аналитика
            </button>
          )}
          
          {isAdmin && (
            <>
              <button
                onClick={() => setActiveTab('team')}
                className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all shrink-0 cursor-pointer ${
                  activeTab === 'team'
                    ? 'border-indigo-500 text-indigo-500'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Users className="w-4 h-4" />
                Команда и доступ
              </button>

              <button
                onClick={() => setActiveTab('wiki')}
                className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all shrink-0 cursor-pointer ${
                  activeTab === 'wiki'
                    ? 'border-indigo-500 text-indigo-500'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Layers className="w-4 h-4" />
                Wiki-структура
              </button>
            </>
          )}
        </div>
      )}

      {activeTab === 'team' && isAdmin && (
        <TeamAccessManagement />
      )}

      {activeTab === 'wiki' && isAdmin && (
        <WikiManagement />
      )}

      {activeTab === 'news' && (
        <NewsAdmin />
      )}

      {activeTab === 'analytics' && isAdmin && (
        <AnalyticsDashboard />
      )}

      {/* STATS AND MAIN ARTICLES TAB */}
      {activeTab === 'articles' && (
        <>
          {/* Stats Widgets */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="p-5 rounded-xl border border-border bg-card text-card-foreground shadow-premium dark:shadow-premium-dark">
              <div className="flex items-center justify-between mb-3 text-muted-foreground">
                <span className="text-xs font-semibold uppercase tracking-wider">Активные статьи</span>
                <BookOpen className="w-5 h-5 text-indigo-500" />
              </div>
              <div className="text-2xl font-bold font-outfit text-foreground">{stats.total}</div>
              <p className="text-[10px] text-muted-foreground mt-1">{stats.drafts} в черновиках</p>
            </div>

            <div className="p-5 rounded-xl border border-border bg-card text-card-foreground shadow-premium dark:shadow-premium-dark">
              <div className="flex items-center justify-between mb-3 text-muted-foreground">
                <span className="text-xs font-semibold uppercase tracking-wider">Архивировано</span>
                <Trash2 className="w-5 h-5 text-violet-500" />
              </div>
              <div className="text-2xl font-bold font-outfit text-foreground">{stats.archived}</div>
              <p className="text-[10px] text-muted-foreground mt-1">скрытых статей в системе</p>
            </div>

            <div className="p-5 rounded-xl border border-border bg-card text-card-foreground shadow-premium dark:shadow-premium-dark">
              <div className="flex items-center justify-between mb-3 text-muted-foreground">
                <span className="text-xs font-semibold uppercase tracking-wider">Поиск</span>
                <TrendingUp className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold font-outfit text-foreground">Активен</div>
              <p className="text-[10px] text-muted-foreground mt-1">Meilisearch синхронизирован</p>
            </div>
          </div>

          {/* Table Container */}
          <div className="border border-border bg-card text-card-foreground rounded-xl overflow-hidden shadow-premium dark:shadow-premium-dark">
            <div className="p-4 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-2 border border-border rounded-lg px-3 py-1.5 bg-muted/30 w-full md:max-w-xs">
                <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  placeholder="Поиск по названию..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent text-xs text-foreground outline-none w-full placeholder-muted-foreground"
                />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground">Статус:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-muted text-foreground outline-none focus:border-indigo-500"
                >
                  <option value="all">Все</option>
                  <option value="published">Опубликованные</option>
                  <option value="drafts">Черновики</option>
                </select>

                <button
                  onClick={handleClearCache}
                  disabled={isClearingCache}
                  className="ml-2 inline-flex items-center gap-1 px-3 py-1.5 border border-border hover:bg-muted rounded-lg text-xs font-semibold shadow-sm transition-colors text-muted-foreground cursor-pointer"
                  title="Очистить серверный кэш"
                >
                  {isClearingCache ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="w-3.5 h-3.5" />
                  )}
                  <span>Сбросить кэш</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-muted-foreground select-none">
                    <th className="p-4 font-bold uppercase tracking-wider">Статья</th>
                    <th className="p-4 font-bold uppercase tracking-wider hidden sm:table-cell">Автор</th>
                    <th className="p-4 font-bold uppercase tracking-wider text-center">Порядок</th>
                    <th className="p-4 font-bold uppercase tracking-wider text-center">Просмотры</th>
                    <th className="p-4 font-bold uppercase tracking-wider text-center">Статус</th>
                    <th className="p-4 font-bold uppercase tracking-wider text-center">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredArticles.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center p-12 text-muted-foreground italic">
                        Статей не найдено по вашему запросу.
                      </td>
                    </tr>
                  ) : (
                    filteredArticles.map((art) => (
                      <tr key={art.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-4 min-w-[200px]">
                          <div className="flex items-center gap-2">
                            <Link 
                              to={`/articles/${art.slug}`}
                              className="font-bold text-foreground hover:text-indigo-500 hover:underline flex items-center gap-1"
                            >
                              <span>{art.title}</span>
                              <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0" />
                            </Link>
                          </div>
                          <span className="block text-[10px] text-muted-foreground font-mono mt-0.5">
                            /{art.slug}
                          </span>
                          {art.source_url && (
                            <a
                              href={art.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[9px] text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 mt-1 font-medium bg-indigo-500/5 dark:bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/15"
                            >
                              <ExternalLink className="w-2.5 h-2.5" />
                              <span>Источник</span>
                            </a>
                          )}
                        </td>
                        <td className="p-4 text-muted-foreground hidden sm:table-cell">
                          {art.author_name || 'Не указан'}
                        </td>
                        <td className="p-4 text-center">
                          <input
                            type="number"
                            key={`art-pos-${art.id}-${art.position}`}
                            defaultValue={art.position}
                            onBlur={(e) => handleArticlePositionChange(art.id, Number(e.target.value))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleArticlePositionChange(art.id, Number((e.target as HTMLInputElement).value));
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            className="w-12 text-center text-xs py-0.5 rounded border border-border bg-input text-foreground outline-none focus:border-indigo-500 mx-auto"
                          />
                        </td>
                        <td className="p-4 text-center text-muted-foreground font-mono">
                          {art.views}
                        </td>
                        <td className="p-4 text-center select-none">
                          {art.published ? (
                            <span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-semibold uppercase tracking-wider">
                              Опубликовано
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 font-semibold uppercase tracking-wider">
                              Черновик
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {art.source_url && (
                              <>
                                <button
                                  onClick={() => handleSyncArticle(art.id)}
                                  disabled={!!syncingArticleIds[art.id]}
                                  className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-card transition-colors cursor-pointer"
                                  title="Синхронизировать сейчас"
                                >
                                  {syncingArticleIds[art.id] ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                                  ) : (
                                    <RefreshCw className="w-3.5 h-3.5" />
                                  )}
                                </button>
                                <button
                                  onClick={() => handleOpenHistory(art)}
                                  className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-card transition-colors cursor-pointer"
                                  title="История синхронизации"
                                >
                                  <History className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => setSelectedArticleForPreview(art)}
                              className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-card transition-colors cursor-pointer"
                              title="Предпросмотр статьи"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <Link
                              to={`/admin/editor/${art.id}`}
                              className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-card transition-colors"
                              title="Редактировать статью"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </Link>
                            <button
                              onClick={() => handleArchiveArticle(art)}
                              className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-red-500 dark:hover:text-red-400 hover:bg-card transition-colors cursor-pointer"
                              title="Архивировать статью"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-muted border-t border-border text-[10px] text-muted-foreground flex items-center justify-between">
              <span>Всего статей: {filteredArticles.length}</span>
              <span>SaaS CMS-движок v2.0</span>
            </div>
          </div>
        </>
      )}

      {/* ARCHIVE TAB */}
      {activeTab === 'archive' && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border border-border bg-card text-card-foreground rounded-xl shadow-premium dark:shadow-premium-dark">
            <div>
              <h3 className="font-outfit text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Архив статей базы знаний
              </h3>
              <p className="text-xs text-muted-foreground mt-1 font-light">
                Здесь находятся скрытые статьи. Вы можете вернуть их на сайт или удалить навсегда.
              </p>
            </div>
            
            <div className="flex items-center gap-2 border border-border rounded-lg px-3 py-1.5 bg-muted/30 w-full md:max-w-xs shrink-0">
              <Search className="w-4 h-4 text-muted-foreground shrink-0" />
              <input
                type="text"
                placeholder="Поиск в архиве..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-xs text-foreground outline-none w-full placeholder-muted-foreground"
              />
            </div>
          </div>

          <div className="border border-border bg-card text-card-foreground rounded-xl overflow-hidden shadow-premium dark:shadow-premium-dark">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-muted-foreground select-none">
                    <th className="p-4 font-bold uppercase tracking-wider">Статья</th>
                    <th className="p-4 font-bold uppercase tracking-wider">Автор статьи</th>
                    <th className="p-4 font-bold uppercase tracking-wider">Скрыта (изменена)</th>
                    <th className="p-4 font-bold uppercase tracking-wider text-center">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {archivedArticles.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center p-12 text-muted-foreground italic">
                        В архиве нет статей, подходящих под критерии поиска.
                      </td>
                    </tr>
                  ) : (
                    archivedArticles.map((art) => (
                      <tr key={art.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-4 min-w-[200px]">
                          <div className="font-bold text-foreground">
                            {art.title}
                          </div>
                          <span className="block text-[10px] text-muted-foreground font-mono mt-0.5">
                            /{art.slug}
                          </span>
                        </td>
                        <td className="p-4 text-muted-foreground">
                          {art.author_name || 'Не указан'}
                        </td>
                        <td className="p-4 text-muted-foreground font-mono">
                          {new Date(art.updated_at).toLocaleString()}
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleRestoreArticle(art)}
                              className="px-2.5 py-1 text-[10px] font-bold text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-md transition-colors cursor-pointer"
                              title="Восстановить статью"
                            >
                              Восстановить
                            </button>
                            <button
                              onClick={() => navigate(`/admin/editor/${art.id}`)}
                              className="px-2.5 py-1 text-[10px] font-bold text-indigo-600 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-md transition-colors cursor-pointer"
                              title="Редактировать статью"
                            >
                              Изменить
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => handleDeleteForever(art.id, art.title)}
                                className="px-2.5 py-1 text-[10px] font-bold text-red-600 bg-red-500/10 hover:bg-red-500/20 rounded-md transition-colors cursor-pointer"
                                title="Удалить навсегда из базы данных"
                              >
                                Удалить
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-muted border-t border-border text-[10px] text-muted-foreground">
              Всего архивных статей: {archivedArticles.length}
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {selectedArticleForPreview && (
        <PreviewModal
          article={selectedArticleForPreview}
          category={null}
          categories={[]}
          articles={articles}
          onClose={() => setSelectedArticleForPreview(null)}
        />
      )}

      {/* Notifications Drawer Portal / Overlay */}
      <AnimatePresence>
        {isNotificationsDrawerOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsNotificationsDrawerOpen(false)}
              className="fixed inset-0 z-50 bg-black/55"
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 z-[60] w-full max-w-md bg-card text-card-foreground border-l border-border shadow-2xl flex flex-col h-full"
            >
              <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
                <h3 className="font-outfit font-bold text-sm text-foreground">Уведомления</h3>
                <button 
                  onClick={() => setIsNotificationsDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Notifications List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {notifications.length === 0 ? (
                  <div className="text-center py-12 text-xs text-muted-foreground font-light">
                    Уведомлений нет
                  </div>
                ) : (
                  notifications.map((n) => {
                    let typeClass = 'border-blue-500/20 bg-blue-500/[0.03] dark:bg-blue-500/[0.01] text-blue-700 dark:text-blue-400';
                    if (n.type === 'success') {
                      typeClass = 'border-emerald-500/20 bg-emerald-500/[0.03] dark:bg-emerald-500/[0.01] text-emerald-700 dark:text-emerald-400';
                    } else if (n.type === 'warning') {
                      typeClass = 'border-amber-500/20 bg-amber-500/[0.03] dark:bg-amber-500/[0.01] text-amber-800 dark:text-amber-400';
                    } else if (n.type === 'error') {
                      typeClass = 'border-rose-500/20 bg-rose-500/[0.03] dark:bg-rose-500/[0.01] text-rose-700 dark:text-rose-400';
                    }

                    return (
                      <div 
                        key={n.id} 
                        className={`p-3 rounded-lg border text-xs leading-relaxed transition-all ${typeClass} ${!n.is_read ? 'ring-1 ring-indigo-500/25' : ''}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-[11px] truncate max-w-[200px]">{n.title}</span>
                          <span className="text-[9px] text-muted-foreground font-mono">
                            {new Date(n.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-[11px] font-light leading-normal">{n.message}</p>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Sync History Modal */}
      <AnimatePresence>
        {selectedArticleForHistory && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setSelectedArticleForHistory(null);
                setSelectedHistoryItem(null);
              }}
              className="fixed inset-0 z-50 bg-black/60"
            />
            {/* Modal Body */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="fixed inset-x-4 top-10 bottom-10 md:inset-x-20 md:top-14 md:bottom-14 z-[60] bg-card text-card-foreground border border-border rounded-2xl shadow-2xl flex overflow-hidden max-w-5xl mx-auto"
            >
              {/* Left Side: History List */}
              <div className="flex-1 flex flex-col h-full border-r border-border">
                <div className="p-4 border-b border-border flex items-center justify-between bg-muted/50 shrink-0">
                  <div>
                    <h3 className="font-outfit font-bold text-sm text-foreground">
                      История авто-синхронизаций
                    </h3>
                    <p className="text-[10px] text-muted-foreground truncate max-w-sm mt-0.5 font-mono">
                      {selectedArticleForHistory.title}
                    </p>
                  </div>
                  <button 
                    onClick={() => {
                      setSelectedArticleForHistory(null);
                      setSelectedHistoryItem(null);
                    }}
                    className="p-1 rounded text-muted-foreground hover:bg-muted cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {isLoadingHistory ? (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                      <span className="text-xs font-light">Загрузка истории...</span>
                    </div>
                  ) : syncHistoryList.length === 0 ? (
                    <div className="text-center py-20 text-xs text-muted-foreground italic">
                      Записи о синхронизации отсутствуют.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-border text-muted-foreground font-bold bg-muted/50">
                            <th className="py-2 px-3">Дата синхронизации</th>
                            <th className="py-2 px-3">Статус</th>
                            <th className="py-2 px-3 text-center">Изменений</th>
                            <th className="py-2 px-3">Детали</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {syncHistoryList.map((log) => {
                            const isSuccess = log.status === 'success';
                            const hasDiff = log.changes_count > 0;
                            const isSelected = selectedHistoryItem?.id === log.id;
                            
                            return (
                              <tr 
                                key={log.id} 
                                className={`hover:bg-muted/30 cursor-pointer transition-colors ${
                                  isSelected ? 'bg-indigo-500/[0.03] dark:bg-indigo-500/[0.02]' : ''
                                }`}
                                onClick={() => {
                                  if (isSuccess && log.changes_summary) {
                                    setSelectedHistoryItem(log);
                                  } else {
                                    setSelectedHistoryItem(null);
                                  }
                                }}
                              >
                                <td className="py-2.5 px-3 font-mono text-[10px] text-muted-foreground">
                                  {new Date(log.synced_at).toLocaleString()}
                                </td>
                                <td className="py-2.5 px-3">
                                  {isSuccess ? (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 uppercase tracking-wider">
                                      Успешно
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20 uppercase tracking-wider">
                                      Сбой
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-center font-bold">
                                  {log.changes_count}
                                </td>
                                <td className="py-2.5 px-3">
                                  {!isSuccess ? (
                                    <span className="text-rose-500 text-[10px] truncate max-w-[120px] block" title={log.error_message || ''}>
                                      {log.error_message}
                                    </span>
                                  ) : hasDiff ? (
                                    <span className="text-indigo-500 text-[10px] font-semibold hover:underline">
                                      Показать изменения
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground text-[10px]">Без изменений</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Side: Diff Viewer Panel */}
              <div className="w-[380px] shrink-0 bg-muted/40 flex flex-col h-full border-l border-border overflow-hidden">
                <div className="p-4 border-b border-border flex items-center justify-between bg-muted/50 shrink-0">
                  <h4 className="font-outfit font-bold text-xs text-foreground uppercase tracking-wider">
                    Сравнение версий
                  </h4>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {!selectedHistoryItem ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground text-xs font-light">
                      <History className="w-8 h-8 text-muted-foreground/60 mb-2" />
                      Выберите запись из списка с изменениями для просмотра детального сравнения.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Sync metadata summary */}
                      <div className="p-3 bg-card border border-border rounded-xl space-y-1">
                        <div className="text-[10px] text-muted-foreground font-medium">Сводка изменений</div>
                        <div className="text-xs text-foreground flex items-center gap-1.5">
                          <span className="text-emerald-500 font-bold">+{selectedHistoryItem.changes_summary?.added?.length || 0}</span> / 
                          <span className="text-rose-500 font-bold">-{selectedHistoryItem.changes_summary?.removed?.length || 0}</span> / 
                          <span className="text-amber-500 font-bold">~{selectedHistoryItem.changes_summary?.updated?.length || 0}</span>
                        </div>
                      </div>

                      {/* Added models list */}
                      {selectedHistoryItem.changes_summary?.added && selectedHistoryItem.changes_summary.added.length > 0 && (
                        <div className="space-y-1.5">
                          <h5 className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Добавленные автомобили ({selectedHistoryItem.changes_summary.added.length})
                          </h5>
                          <ul className="space-y-1 bg-card p-2 rounded-lg border border-border max-h-[150px] overflow-y-auto scrollbar-thin">
                            {selectedHistoryItem.changes_summary.added.map((item, idx) => (
                              <li key={`add-${idx}`} className="text-[11px] text-foreground flex items-start gap-1">
                                <span className="text-emerald-500 font-bold shrink-0">+</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Removed models list */}
                      {selectedHistoryItem.changes_summary?.removed && selectedHistoryItem.changes_summary.removed.length > 0 && (
                        <div className="space-y-1.5">
                          <h5 className="text-[10px] font-bold uppercase tracking-wider text-rose-500 flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" />
                            Удаленные автомобили ({selectedHistoryItem.changes_summary.removed.length})
                          </h5>
                          <ul className="space-y-1 bg-card p-2 rounded-lg border border-border max-h-[150px] overflow-y-auto scrollbar-thin">
                            {selectedHistoryItem.changes_summary.removed.map((item, idx) => (
                              <li key={`rem-${idx}`} className="text-[11px] text-foreground flex items-start gap-1">
                                <span className="text-rose-500 font-bold shrink-0">-</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Updated models list */}
                      {selectedHistoryItem.changes_summary?.updated && selectedHistoryItem.changes_summary.updated.length > 0 && (
                        <div className="space-y-1.5">
                          <h5 className="text-[10px] font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Измененные требования ({selectedHistoryItem.changes_summary.updated.length})
                          </h5>
                          <ul className="space-y-1 bg-card p-2 rounded-lg border border-border max-h-[150px] overflow-y-auto scrollbar-thin">
                            {selectedHistoryItem.changes_summary.updated.map((item, idx) => (
                              <li key={`upd-${idx}`} className="text-[11px] text-foreground flex items-start gap-1">
                                <span className="text-amber-500 font-bold shrink-0">~</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
