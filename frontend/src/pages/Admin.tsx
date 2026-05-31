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
  Key,
  Eye,
  RotateCcw
} from 'lucide-react';
import { 
  fetchArticles, 
  deleteArticle, 
  updateArticle,
  Article, 
  importArticle,
  clearServerCache
} from '../lib/api';
import { useAuth } from '../lib/auth-context';
import UserManagement from '../components/user-management';
import SessionManagement from '../components/session-management';
import PreviewModal from '../components/preview-modal';

export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [articles, setArticles] = React.useState<Article[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  
  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'published' | 'drafts'>('all');
  const [activeTab, setActiveTab] = React.useState<'articles' | 'archive' | 'users' | 'sessions'>('articles');

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = React.useState(false);
  const [isClearingCache, setIsClearingCache] = React.useState(false);

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
        <div className="h-10 w-48 bg-neutral-200 dark:bg-neutral-800 rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-28 bg-neutral-200 dark:bg-neutral-800 rounded-xl" />
          ))}
        </div>
        <div className="h-[400px] bg-neutral-200 dark:bg-neutral-800 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-outfit text-3xl font-extrabold tracking-tight text-neutral-950 dark:text-white">
            Панель управления
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm font-light mt-1">
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
            className="inline-flex items-center gap-1.5 px-4 py-2 border border-neutral-200 dark:border-neutral-850 hover:bg-neutral-50 dark:hover:bg-neutral-900 text-neutral-700 dark:text-neutral-300 rounded-lg text-sm font-semibold shadow-sm transition-all text-center justify-center cursor-pointer"
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
        </div>
      </div>

      {/* Tabs Switcher for Admin & Editor roles */}
      {(user?.role === 'Admin' || user?.role === 'Editor') && (
        <div className="flex border-b border-neutral-200 dark:border-neutral-800 mb-8 gap-6 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('articles')}
            className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all shrink-0 cursor-pointer ${
              activeTab === 'articles'
                ? 'border-indigo-500 text-indigo-500'
                : 'border-transparent text-neutral-500 hover:text-neutral-950 dark:hover:text-white'
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
                : 'border-transparent text-neutral-500 hover:text-neutral-950 dark:hover:text-white'
            }`}
          >
            <Trash2 className="w-4 h-4 text-neutral-400" />
            Архив статей
          </button>
          
          {user?.role === 'Admin' && (
            <>
              <button
                onClick={() => setActiveTab('users')}
                className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all shrink-0 cursor-pointer ${
                  activeTab === 'users'
                    ? 'border-indigo-500 text-indigo-500'
                    : 'border-transparent text-neutral-500 hover:text-neutral-950 dark:hover:text-white'
                }`}
              >
                <Users className="w-4 h-4" />
                Пользователи (Админ)
              </button>

              <button
                onClick={() => setActiveTab('sessions')}
                className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all shrink-0 cursor-pointer ${
                  activeTab === 'sessions'
                    ? 'border-indigo-500 text-indigo-500'
                    : 'border-transparent text-neutral-500 hover:text-neutral-950 dark:hover:text-white'
                }`}
              >
                <Key className="w-4 h-4" />
                Сессии (Админ)
              </button>
            </>
          )}
        </div>
      )}

      {activeTab === 'users' && user?.role === 'Admin' && (
        <UserManagement />
      )}

      {activeTab === 'sessions' && user?.role === 'Admin' && (
        <SessionManagement />
      )}

      {/* STATS AND MAIN ARTICLES TAB */}
      {activeTab === 'articles' && (
        <>
          {/* Stats Widgets */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="p-5 rounded-xl border border-neutral-200/50 dark:border-neutral-800/80 bg-white dark:bg-neutral-950 shadow-premium dark:shadow-premium-dark">
              <div className="flex items-center justify-between mb-3 text-neutral-400">
                <span className="text-xs font-semibold uppercase tracking-wider">Активные статьи</span>
                <BookOpen className="w-5 h-5 text-indigo-500" />
              </div>
              <div className="text-2xl font-bold font-outfit text-neutral-900 dark:text-white">{stats.total}</div>
              <p className="text-[10px] text-neutral-400 mt-1">{stats.drafts} в черновиках</p>
            </div>

            <div className="p-5 rounded-xl border border-neutral-200/50 dark:border-neutral-800/80 bg-white dark:bg-neutral-950 shadow-premium dark:shadow-premium-dark">
              <div className="flex items-center justify-between mb-3 text-neutral-400">
                <span className="text-xs font-semibold uppercase tracking-wider">Архивировано</span>
                <Trash2 className="w-5 h-5 text-violet-500" />
              </div>
              <div className="text-2xl font-bold font-outfit text-neutral-900 dark:text-white">{stats.archived}</div>
              <p className="text-[10px] text-neutral-400 mt-1">скрытых статей в системе</p>
            </div>

            <div className="p-5 rounded-xl border border-neutral-200/50 dark:border-neutral-800/80 bg-white dark:bg-neutral-950 shadow-premium dark:shadow-premium-dark">
              <div className="flex items-center justify-between mb-3 text-neutral-400">
                <span className="text-xs font-semibold uppercase tracking-wider">Поиск</span>
                <TrendingUp className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold font-outfit text-neutral-900 dark:text-white">Активен</div>
              <p className="text-[10px] text-neutral-400 mt-1">Meilisearch синхронизирован</p>
            </div>
          </div>

          {/* Table Container */}
          <div className="border border-neutral-200/50 dark:border-neutral-800/80 bg-white dark:bg-neutral-950 rounded-xl overflow-hidden shadow-premium dark:shadow-premium-dark">
            <div className="p-4 border-b border-neutral-200/50 dark:border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-2 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-1.5 bg-neutral-50 dark:bg-neutral-900/30 w-full md:max-w-xs">
                <Search className="w-4 h-4 text-neutral-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Поиск по названию..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent text-xs text-neutral-950 dark:text-neutral-100 outline-none w-full placeholder-neutral-400"
                />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-neutral-400">Статус:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="text-xs border border-neutral-200 dark:border-neutral-800 rounded-lg px-2.5 py-1.5 bg-neutral-50 dark:bg-neutral-950 text-neutral-700 dark:text-neutral-300 outline-none focus:border-indigo-500"
                >
                  <option value="all">Все</option>
                  <option value="published">Опубликованные</option>
                  <option value="drafts">Черновики</option>
                </select>

                <button
                  onClick={handleClearCache}
                  disabled={isClearingCache}
                  className="ml-2 inline-flex items-center gap-1 px-3 py-1.5 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900 rounded-lg text-xs font-semibold shadow-sm transition-colors text-neutral-750 dark:text-neutral-300 cursor-pointer"
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
                  <tr className="border-b border-neutral-100 dark:border-neutral-900 bg-neutral-50/50 dark:bg-neutral-950/20 text-neutral-400 select-none">
                    <th className="p-4 font-bold uppercase tracking-wider">Статья</th>
                    <th className="p-4 font-bold uppercase tracking-wider hidden sm:table-cell">Автор</th>
                    <th className="p-4 font-bold uppercase tracking-wider text-center">Порядок</th>
                    <th className="p-4 font-bold uppercase tracking-wider text-center">Просмотры</th>
                    <th className="p-4 font-bold uppercase tracking-wider text-center">Статус</th>
                    <th className="p-4 font-bold uppercase tracking-wider text-center">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-900/60">
                  {filteredArticles.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center p-12 text-neutral-400 italic">
                        Статей не найдено по вашему запросу.
                      </td>
                    </tr>
                  ) : (
                    filteredArticles.map((art) => (
                      <tr key={art.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/10 transition-colors">
                        <td className="p-4 min-w-[200px]">
                          <div className="flex items-center gap-2">
                            <Link 
                              to={`/articles/${art.slug}`}
                              className="font-bold text-neutral-900 dark:text-neutral-100 hover:text-indigo-500 hover:underline flex items-center gap-1"
                            >
                              <span>{art.title}</span>
                              <ExternalLink className="w-3 h-3 text-neutral-400 shrink-0" />
                            </Link>
                          </div>
                          <span className="block text-[10px] text-neutral-400 font-mono mt-0.5">
                            /{art.slug}
                          </span>
                        </td>
                        <td className="p-4 text-neutral-550 dark:text-neutral-400 hidden sm:table-cell">
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
                            className="w-12 text-center text-xs py-0.5 rounded border border-neutral-250 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-white outline-none focus:border-indigo-500 mx-auto"
                          />
                        </td>
                        <td className="p-4 text-center text-neutral-500 font-mono">
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
                            <button
                              onClick={() => setSelectedArticleForPreview(art)}
                              className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-neutral-900 transition-colors cursor-pointer"
                              title="Предпросмотр статьи"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <Link
                              to={`/admin/editor/${art.id}`}
                              className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-neutral-900 transition-colors"
                              title="Редактировать статью"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </Link>
                            <button
                              onClick={() => handleArchiveArticle(art)}
                              className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-white dark:hover:bg-neutral-900 transition-colors cursor-pointer"
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

            <div className="p-4 bg-neutral-50 dark:bg-neutral-950 border-t border-neutral-200/50 dark:border-neutral-800/80 text-[10px] text-neutral-400 flex items-center justify-between">
              <span>Всего статей: {filteredArticles.length}</span>
              <span>SaaS CMS-движок v2.0</span>
            </div>
          </div>
        </>
      )}

      {/* ARCHIVE TAB */}
      {activeTab === 'archive' && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border border-neutral-200/50 dark:border-neutral-800/80 bg-white dark:bg-neutral-950 rounded-xl shadow-premium dark:shadow-premium-dark">
            <div>
              <h3 className="font-outfit text-sm font-bold uppercase tracking-wider text-neutral-450 dark:text-neutral-500">
                Архив статей базы знаний
              </h3>
              <p className="text-xs text-neutral-400 mt-1 font-light">
                Здесь находятся скрытые статьи. Вы можете вернуть их на сайт или удалить навсегда.
              </p>
            </div>
            
            <div className="flex items-center gap-2 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-1.5 bg-neutral-50 dark:bg-neutral-900/30 w-full md:max-w-xs shrink-0">
              <Search className="w-4 h-4 text-neutral-400 shrink-0" />
              <input
                type="text"
                placeholder="Поиск в архиве..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-xs text-neutral-950 dark:text-neutral-100 outline-none w-full placeholder-neutral-400"
              />
            </div>
          </div>

          <div className="border border-neutral-200/50 dark:border-neutral-800/80 bg-white dark:bg-neutral-950 rounded-xl overflow-hidden shadow-premium dark:shadow-premium-dark">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-neutral-100 dark:border-neutral-900 bg-neutral-50/50 dark:bg-neutral-950/20 text-neutral-400 select-none">
                    <th className="p-4 font-bold uppercase tracking-wider">Статья</th>
                    <th className="p-4 font-bold uppercase tracking-wider">Автор статьи</th>
                    <th className="p-4 font-bold uppercase tracking-wider">Скрыта (изменена)</th>
                    <th className="p-4 font-bold uppercase tracking-wider text-center">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-900/60">
                  {archivedArticles.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center p-12 text-neutral-400 italic">
                        В архиве нет статей, подходящих под критерии поиска.
                      </td>
                    </tr>
                  ) : (
                    archivedArticles.map((art) => (
                      <tr key={art.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/10 transition-colors">
                        <td className="p-4 min-w-[200px]">
                          <div className="font-bold text-neutral-900 dark:text-neutral-100">
                            {art.title}
                          </div>
                          <span className="block text-[10px] text-neutral-450 dark:text-neutral-500 font-mono mt-0.5">
                            /{art.slug}
                          </span>
                        </td>
                        <td className="p-4 text-neutral-550 dark:text-neutral-400">
                          {art.author_name || 'Не указан'}
                        </td>
                        <td className="p-4 text-neutral-500 font-mono">
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
                            {user?.role === 'Admin' && (
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

            <div className="p-4 bg-neutral-50 dark:bg-neutral-950 border-t border-neutral-200/50 dark:border-neutral-800/80 text-[10px] text-neutral-400">
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

    </div>
  );
}
