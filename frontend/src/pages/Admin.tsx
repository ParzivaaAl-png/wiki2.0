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
  ChevronDown,
  ChevronRight,
  Building2,
  Briefcase,
  FileText,
} from 'lucide-react';
import { 
  fetchArticles, 
  deleteArticle, 
  updateArticle,
  Article, 
  Space,
  Section,
  importArticle,
  clearServerCache,
  syncArticleNow,
  fetchArticleSyncHistory,
  fetchNotifications,
  markNotificationsAsRead,
  fetchNavigationTree,
  ArticleSyncLog,
  Notification
} from '../lib/api';
import { useAuth } from '../lib/auth-context';
import PreviewModal from '../components/preview-modal';
import { NewsAdmin } from '../components/news-admin';
import WikiManagement from '../components/wiki-management';
import AnalyticsDashboard from '../components/analytics-dashboard';
import TeamAccessManagement from '../components/team-access-management';
import { ModalPortal } from '../components/modal-portal';
import { AnimatePresence, motion } from 'framer-motion';

type SectionMeta = {
  section: Section;
  space: Space;
  path: string;
  sortKey: string;
};

type ArticleSectionGroup = {
  id: string;
  title: string;
  description: string;
  section: Section | null;
  articles: Article[];
};

type ArticleSpaceGroup = {
  id: string;
  title: string;
  description: string;
  space: Space | null;
  sections: ArticleSectionGroup[];
  articleCount: number;
};

type ArticleStatusFilter = 'all' | 'published' | 'draft' | 'requires_verification' | 'on_approval' | 'archived' | 'expired';

export default function Admin() {
  const { user, isAdmin, isEditor, isStaff } = useAuth();
  const navigate = useNavigate();
  const [articles, setArticles] = React.useState<Article[]>([]);
  const [navigationTree, setNavigationTree] = React.useState<Space[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  
  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<ArticleStatusFilter>('all');
  const [authorFilter, setAuthorFilter] = React.useState('all');
  const [spaceFilter, setSpaceFilter] = React.useState('all');
  const [sectionFilter, setSectionFilter] = React.useState('all');
  const [activeTab, setActiveTab] = React.useState<'articles' | 'archive' | 'analytics' | 'news' | 'team' | 'wiki'>('articles');
  const [collapsedSpaceIds, setCollapsedSpaceIds] = React.useState<Set<string>>(new Set());
  const [collapsedSectionIds, setCollapsedSectionIds] = React.useState<Set<string>>(new Set());

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
      // Fetch all articles and the same wiki tree used by the left navigator.
      const [arts, tree] = await Promise.all([
        fetchArticles({ all: true }),
        fetchNavigationTree(),
      ]);
      setArticles(arts.filter(art => !art.slug.startsWith('auto-list-')));
      setNavigationTree(tree);
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

  const buildArticleUpdatePayload = (art: Article, overrides: Partial<Article> = {}) => ({
    title: art.title,
    slug: art.slug,
    summary: art.summary || '',
    content: art.content,
    category_id: art.category_id || null,
    published: art.published,
    tags: art.tags || [],
    position: art.position || 0,
    is_visible: art.is_visible !== false,
    status: art.status || (art.published ? 'published' : 'draft'),
    section_ids: art.section_ids || [],
    source_url: art.source_url || null,
    sync_interval: art.sync_interval || 'manual',
    article_type: art.article_type || 'general',
    owner_id: art.owner_id || null,
    approver_id: art.approver_id || null,
    ...overrides,
  });

  // Position change handler for articles
  const handleArticlePositionChange = async (artId: number, newPos: number) => {
    const art = articles.find(a => a.id === artId);
    if (!art) return;
    try {
      await updateArticle(artId, buildArticleUpdatePayload(art, { position: newPos }));
      setArticles(prev => prev.map(a => a.id === artId ? { ...a, position: newPos } : a));
    } catch (err) {
      console.error('Failed to update article position:', err);
    }
  };

  // Soft Delete / Archive Article (is_visible = false)
  const handleArchiveArticle = async (art: Article) => {
    if (!window.confirm(`Вы уверены, что хотите скрыть статью "${art.title}"? Она будет отправлена в архив.`)) return;

    try {
      await updateArticle(art.id, buildArticleUpdatePayload(art, { is_visible: false }));
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
      await updateArticle(art.id, buildArticleUpdatePayload(art, { is_visible: true }));
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

  const sectionMeta = React.useMemo(() => {
    const byId = new Map<number, SectionMeta>();
    const options: Array<{ id: number; name: string; spaceId: number; path: string }> = [];

    const walkSections = (space: Space, sections: Section[], parents: string[] = []) => {
      sections.forEach((section, index) => {
        const pathParts = [...parents, section.name];
        const path = pathParts.join(' / ');
        byId.set(section.id, {
          section,
          space,
          path,
          sortKey: `${space.name.toLowerCase()}-${path.toLowerCase()}-${index}`,
        });
        options.push({ id: section.id, name: section.name, spaceId: space.id, path });
        if (section.subsections?.length) {
          walkSections(space, section.subsections, pathParts);
        }
      });
    };

    navigationTree.forEach((space) => walkSections(space, space.sections || []));
    return { byId, options };
  }, [navigationTree]);

  const sectionFilterOptions = React.useMemo(() => (
    sectionMeta.options.filter((section) => (
      spaceFilter === 'all' || section.spaceId === Number(spaceFilter)
    ))
  ), [sectionMeta.options, spaceFilter]);

  const authorFilterOptions = React.useMemo(() => {
    const names = new Set<string>();
    articles.forEach((article) => {
      names.add(article.author_name || 'Не указан');
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'ru'));
  }, [articles]);

  React.useEffect(() => {
    if (sectionFilter === 'all') return;
    const selected = sectionMeta.byId.get(Number(sectionFilter));
    if (spaceFilter !== 'all' && selected?.space.id !== Number(spaceFilter)) {
      setSectionFilter('all');
    }
  }, [sectionFilter, sectionMeta.byId, spaceFilter]);

  const getArticlePrimarySectionId = React.useCallback((article: Article) => {
    const ids = article.section_ids || [];

    if (sectionFilter !== 'all') {
      const selectedId = Number(sectionFilter);
      return ids.includes(selectedId) ? selectedId : null;
    }

    if (spaceFilter !== 'all') {
      const selectedSpaceId = Number(spaceFilter);
      const spaceSection = ids.find((id) => sectionMeta.byId.get(id)?.space.id === selectedSpaceId);
      return spaceSection || null;
    }

    return ids.find((id) => sectionMeta.byId.has(id)) || null;
  }, [sectionFilter, sectionMeta.byId, spaceFilter]);

  const articleMatchesHierarchyFilters = React.useCallback((article: Article) => {
    const ids = article.section_ids || [];
    if (sectionFilter !== 'all') {
      return ids.includes(Number(sectionFilter));
    }
    if (spaceFilter !== 'all') {
      return ids.some((id) => sectionMeta.byId.get(id)?.space.id === Number(spaceFilter));
    }
    return true;
  }, [sectionFilter, sectionMeta.byId, spaceFilter]);

  const getArticleStatusKey = React.useCallback((article: Article): Exclude<ArticleStatusFilter, 'all'> => {
    const rawStatus = article.status || (article.published ? 'published' : 'draft');
    if (article.is_visible === false || rawStatus === 'archived') return 'archived';
    if (rawStatus === 'requires_verification') return 'requires_verification';
    if (rawStatus === 'on_approval') return 'on_approval';
    if (rawStatus === 'expired') return 'expired';
    if (rawStatus === 'draft' || !article.published) return 'draft';
    return 'published';
  }, []);

  const articleMatchesStatusAndAuthor = React.useCallback((article: Article) => {
    if (statusFilter !== 'all' && getArticleStatusKey(article) !== statusFilter) return false;
    if (authorFilter !== 'all' && (article.author_name || 'Не указан') !== authorFilter) return false;
    return true;
  }, [authorFilter, getArticleStatusKey, statusFilter]);

  const articleMatchesSearch = React.useCallback((article: Article, meta: SectionMeta | null, query: string) => {
    if (!query) return true;
    const text = [
      article.title,
      article.slug,
      article.summary || '',
      article.author_name || '',
      ...(article.tags || []),
    ].join(' ').toLowerCase();

    const sectionText = [
      meta?.path || '',
      meta?.section.description || '',
      meta?.space.name || '',
      meta?.space.description || '',
    ].join(' ').toLowerCase();

    return text.includes(query) || sectionText.includes(query);
  }, []);

  const buildArticleTree = React.useCallback((sourceArticles: Article[]): ArticleSpaceGroup[] => {
    const query = searchQuery.trim().toLowerCase();
    const spaceGroups = new Map<string, ArticleSpaceGroup>();

    const ensureSpaceGroup = (meta: SectionMeta | null) => {
      const id = meta ? `space-${meta.space.id}` : 'space-unassigned';
      if (!spaceGroups.has(id)) {
        spaceGroups.set(id, {
          id,
          title: meta?.space.name || 'Без отдела',
          description: meta?.space.description || 'Статьи без привязки к разделу Wiki.',
          space: meta?.space || null,
          sections: [],
          articleCount: 0,
        });
      }
      return spaceGroups.get(id)!;
    };

    const ensureSectionGroup = (spaceGroup: ArticleSpaceGroup, meta: SectionMeta | null) => {
      const id = meta ? `section-${meta.section.id}` : `${spaceGroup.id}-section-unassigned`;
      let group = spaceGroup.sections.find((item) => item.id === id);
      if (!group) {
        group = {
          id,
          title: meta?.section.name || 'Без раздела',
          description: meta?.section.description || (meta ? `Раздел для должности ${meta.section.name}` : 'Статьи без выбранной должности или раздела.'),
          section: meta?.section || null,
          articles: [],
        };
        spaceGroup.sections.push(group);
      }
      return group;
    };

    sourceArticles
      .filter(articleMatchesHierarchyFilters)
      .sort((a, b) => (a.position || 0) - (b.position || 0) || a.title.localeCompare(b.title, 'ru'))
      .forEach((article) => {
        const primarySectionId = getArticlePrimarySectionId(article);
        const meta = primarySectionId ? sectionMeta.byId.get(primarySectionId) || null : null;

        if (!articleMatchesSearch(article, meta, query)) return;

        const spaceGroup = ensureSpaceGroup(meta);
        const sectionGroup = ensureSectionGroup(spaceGroup, meta);
        sectionGroup.articles.push(article);
        spaceGroup.articleCount += 1;
      });

    return Array.from(spaceGroups.values())
      .map((spaceGroup) => ({
        ...spaceGroup,
        sections: spaceGroup.sections.sort((a, b) => {
          if (!a.section) return 1;
          if (!b.section) return -1;
          const aMeta = sectionMeta.byId.get(a.section.id);
          const bMeta = sectionMeta.byId.get(b.section.id);
          return (aMeta?.sortKey || a.title).localeCompare(bMeta?.sortKey || b.title, 'ru');
        }),
      }))
      .sort((a, b) => {
        if (!a.space) return 1;
        if (!b.space) return -1;
        return a.space.name.localeCompare(b.space.name, 'ru');
      });
  }, [
    articleMatchesHierarchyFilters,
    articleMatchesSearch,
    getArticlePrimarySectionId,
    searchQuery,
    sectionMeta.byId,
  ]);

  const activeArticles = React.useMemo(() => (
    articles.filter((art) => {
      if (art.is_visible === false) return false;
      return articleMatchesStatusAndAuthor(art);
    })
  ), [articleMatchesStatusAndAuthor, articles]);

  const archivedArticles = React.useMemo(() => (
    articles.filter((art) => art.is_visible === false && articleMatchesStatusAndAuthor(art))
  ), [articleMatchesStatusAndAuthor, articles]);

  const activeArticleTree = React.useMemo(() => buildArticleTree(activeArticles), [activeArticles, buildArticleTree]);
  const archivedArticleTree = React.useMemo(() => buildArticleTree(archivedArticles), [archivedArticles, buildArticleTree]);
  const activeDisplayedCount = React.useMemo(() => (
    activeArticleTree.reduce((sum, space) => sum + space.articleCount, 0)
  ), [activeArticleTree]);
  const archivedDisplayedCount = React.useMemo(() => (
    archivedArticleTree.reduce((sum, space) => sum + space.articleCount, 0)
  ), [archivedArticleTree]);

  const forceTreeExpanded =
    Boolean(searchQuery.trim()) ||
    spaceFilter !== 'all' ||
    sectionFilter !== 'all' ||
    statusFilter !== 'all' ||
    authorFilter !== 'all';

  const toggleSpaceCollapsed = (id: string) => {
    setCollapsedSpaceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSectionCollapsed = (id: string) => {
    setCollapsedSectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const formatDateTime = (value: string) => (
    new Date(value).toLocaleString('ru-RU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  );

  const formatViews = (views: number) => `${new Intl.NumberFormat('ru-RU').format(Number(views || 0))} просмотров`;

  const statusFilterOptions: Array<{ value: ArticleStatusFilter; label: string }> = [
    { value: 'all', label: 'Все статусы' },
    { value: 'published', label: 'Опубликовано' },
    { value: 'draft', label: 'Черновик' },
    { value: 'requires_verification', label: 'Требует проверки' },
    { value: 'on_approval', label: 'На согласовании' },
    { value: 'archived', label: 'Архив' },
    { value: 'expired', label: 'Истёк срок' },
  ];

  const getArticleStatusMeta = (article: Article) => {
    switch (getArticleStatusKey(article)) {
      case 'draft':
        return {
          label: 'Черновик',
          className: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
        };
      case 'requires_verification':
        return {
          label: 'Требует проверки',
          className: 'border-orange-500/25 bg-orange-500/10 text-orange-700 dark:text-orange-300',
        };
      case 'on_approval':
        return {
          label: 'На согласовании',
          className: 'border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-300',
        };
      case 'archived':
        return {
          label: 'Архив',
          className: 'border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300',
        };
      case 'expired':
        return {
          label: 'Истёк срок',
          className: 'border-neutral-400/30 bg-neutral-500/10 text-neutral-600 dark:text-neutral-300',
        };
      case 'published':
      default:
        return {
          label: 'Опубликовано',
          className: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
        };
    }
  };

  const renderArticleStatusBadge = (article: Article) => {
    const status = getArticleStatusMeta(article);
    return (
      <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${status.className}`}>
        {status.label}
      </span>
    );
  };

  const renderArticleActions = (article: Article, mode: 'active' | 'archive') => {
    const actionButtonClass = 'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors cursor-pointer';

    if (mode === 'archive') {
      return (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => handleRestoreArticle(article)}
            className={`${actionButtonClass} hover:text-emerald-600 dark:hover:text-emerald-300`}
            title="Восстановить статью"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => navigate(`/admin/editor/${article.id}`)}
            className={actionButtonClass}
            title="Редактировать статью"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          {isAdmin && (
            <button
              onClick={() => handleDeleteForever(article.id, article.title)}
              className={`${actionButtonClass} hover:text-red-600 dark:hover:text-red-300`}
              title="Удалить навсегда из базы данных"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="flex items-center justify-end gap-1.5">
        {article.source_url && (
          <>
            <button
              onClick={() => handleSyncArticle(article.id)}
              disabled={!!syncingArticleIds[article.id]}
              className={actionButtonClass}
              title="Синхронизировать сейчас"
            >
              {syncingArticleIds[article.id] ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              onClick={() => handleOpenHistory(article)}
              className={actionButtonClass}
              title="История синхронизации"
            >
              <History className="w-3.5 h-3.5" />
            </button>
          </>
        )}
        <button
          onClick={() => setSelectedArticleForPreview(article)}
          className={actionButtonClass}
          title="Предпросмотр статьи"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
        <Link
          to={`/admin/editor/${article.id}`}
          className={actionButtonClass}
          title="Редактировать статью"
        >
          <Edit3 className="w-3.5 h-3.5" />
        </Link>
        <button
          onClick={() => handleArchiveArticle(article)}
          className={`${actionButtonClass} hover:text-red-600 dark:hover:text-red-300`}
          title="Архивировать статью"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  };

  const renderArticleTree = (tree: ArticleSpaceGroup[], mode: 'active' | 'archive') => {
    const emptyText = mode === 'archive'
      ? 'В архиве нет статей, подходящих под выбранные фильтры.'
      : 'Статей не найдено по выбранным фильтрам.';

    if (tree.length === 0) {
      return (
        <div className="m-4 rounded-2xl border border-dashed border-border bg-muted/20 p-12 text-center text-sm text-muted-foreground">
          {emptyText}
        </div>
      );
    }

    const tableGridClass = 'grid grid-cols-[minmax(260px,1.5fr)_130px_145px_130px_108px_190px] gap-3';
    const stickyActionsClass = 'sticky right-0 z-10 bg-card pl-3 shadow-[-16px_0_20px_-20px_rgba(15,23,42,0.65)]';
    const stickyActionsHeaderClass = 'sticky right-0 z-20 bg-muted/95 pl-3 text-right shadow-[-16px_0_20px_-20px_rgba(15,23,42,0.65)] dark:bg-neutral-900/95';

    return (
      <div className="max-w-full overflow-hidden bg-muted/20 p-3 sm:p-4">
        <div className="space-y-4">
        {tree.map((spaceGroup) => {
          const spaceOpen = forceTreeExpanded || !collapsedSpaceIds.has(spaceGroup.id);
          return (
            <div key={spaceGroup.id} className="max-w-full overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <button
                type="button"
                onClick={() => toggleSpaceCollapsed(spaceGroup.id)}
                className="w-full flex items-center justify-between gap-4 px-4 py-4 text-left hover:bg-muted/35 transition-colors"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-500 shrink-0">
                    <Building2 className="w-4.5 h-4.5" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-outfit text-base font-bold text-foreground truncate">{spaceGroup.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {spaceGroup.description || 'Раздел Wiki без описания.'}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center whitespace-nowrap rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                        {spaceGroup.sections.length} разделов
                      </span>
                      <span className="inline-flex items-center whitespace-nowrap rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-300">
                        {spaceGroup.articleCount} статей
                      </span>
                    </div>
                  </div>
                </div>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted/50 text-muted-foreground shrink-0">
                  {spaceOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </span>
              </button>

              {spaceOpen && (
                <div className="border-t border-border bg-muted/15 px-3 py-3 sm:px-4 sm:py-4">
                  {spaceGroup.sections.map((sectionGroup) => {
                    const sectionOpen = forceTreeExpanded || !collapsedSectionIds.has(sectionGroup.id);
                    return (
                      <div key={sectionGroup.id} className="relative max-w-full pl-0 sm:pl-6 [&+&]:mt-3">
                        <div className="absolute left-2 top-0 hidden h-full w-px bg-border sm:block" />
                        <div className="max-w-full overflow-hidden rounded-xl border border-border bg-background/80">
                          <button
                            type="button"
                            onClick={() => toggleSectionCollapsed(sectionGroup.id)}
                            className="w-full flex items-center justify-between gap-3 px-3 py-3 text-left hover:bg-muted/35 transition-colors sm:px-4"
                          >
                            <div className="flex items-start gap-2.5 min-w-0">
                              <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-300 shrink-0">
                                <Briefcase className="w-4 h-4" />
                              </span>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="font-outfit text-sm font-bold text-foreground truncate">{sectionGroup.title}</h4>
                                  <span className="inline-flex items-center whitespace-nowrap rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                                    {sectionGroup.articles.length} статей
                                  </span>
                                </div>
                                <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                                  {sectionGroup.description || `Раздел для должности ${sectionGroup.title}`}
                                </p>
                              </div>
                            </div>
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground shrink-0">
                              {sectionOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </span>
                          </button>

                          {sectionOpen && (
                            <div className="max-w-full overflow-hidden border-t border-border bg-card">
                              <div className="hidden max-w-full overflow-x-auto xl:block">
                                <div className="min-w-[1040px]">
                                  <div className={`${tableGridClass} border-b border-border bg-muted/35 px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground`}>
                                    <div>Статья</div>
                                    <div>Автор</div>
                                    <div>{mode === 'archive' ? 'Архивировано' : 'Обновлено'}</div>
                                    <div>Статус</div>
                                    <div>Просмотры</div>
                                    <div className={stickyActionsHeaderClass}>Действия</div>
                                  </div>

                                  <div className="divide-y divide-border">
                                    {sectionGroup.articles.map((article) => {
                                      const extraSections = Math.max((article.section_ids?.length || 0) - 1, 0);
                                      return (
                                        <div
                                          key={`${sectionGroup.id}-${article.id}-table`}
                                          className={`${tableGridClass} group items-center px-4 py-3 transition-colors hover:bg-muted/25`}
                                        >
                                          <div className="min-w-0">
                                            <div className="flex min-w-0 items-center gap-2.5">
                                              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted/40 text-muted-foreground shrink-0">
                                                <FileText className="w-4 h-4" />
                                              </span>
                                              <div className="min-w-0">
                                                {mode === 'active' ? (
                                                  <Link
                                                    to={`/articles/${article.slug}`}
                                                    className="inline-flex max-w-full min-w-0 items-center gap-1 font-bold text-sm text-foreground hover:text-indigo-600 dark:hover:text-indigo-300 hover:underline"
                                                  >
                                                    <span className="block min-w-0 truncate whitespace-nowrap">{article.title}</span>
                                                    <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0" />
                                                  </Link>
                                                ) : (
                                                  <div className="truncate whitespace-nowrap text-sm font-bold text-foreground">{article.title}</div>
                                                )}
                                                <div className="mt-1 flex min-w-0 items-center gap-2">
                                                  <span className="min-w-0 truncate whitespace-nowrap text-[10px] text-muted-foreground font-mono">/{article.slug}</span>
                                                  {extraSections > 0 && (
                                                    <span className="shrink-0 rounded-full bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-300">
                                                      +{extraSections}
                                                    </span>
                                                  )}
                                                  {article.source_url && mode === 'active' && (
                                                    <a
                                                      href={article.source_url}
                                                      target="_blank"
                                                      rel="noopener noreferrer"
                                                      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-indigo-500/15 bg-indigo-500/5 px-1.5 py-0.5 text-[9px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-300 dark:hover:text-indigo-200"
                                                    >
                                                      <ExternalLink className="w-2.5 h-2.5" />
                                                      Источник
                                                    </a>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          </div>

                                          <div className="min-w-0 text-[11px] text-muted-foreground">
                                            <span className="block truncate whitespace-nowrap font-medium text-foreground/85">{article.author_name || 'Не указан'}</span>
                                          </div>

                                          <div className="whitespace-nowrap text-[11px] font-mono text-muted-foreground">
                                            {formatDateTime(article.updated_at)}
                                          </div>

                                          <div>
                                            {renderArticleStatusBadge(article)}
                                          </div>

                                          <div className="whitespace-nowrap text-[11px] font-medium text-muted-foreground">
                                            {formatViews(article.views)}
                                          </div>

                                          <div className={`${stickyActionsClass} flex justify-end group-hover:bg-muted/25`}>
                                            {renderArticleActions(article, mode)}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>

                              <div className="divide-y divide-border xl:hidden">
                                {sectionGroup.articles.map((article) => {
                                  const extraSections = Math.max((article.section_ids?.length || 0) - 1, 0);
                                  return (
                                    <div
                                      key={`${sectionGroup.id}-${article.id}-card`}
                                      className="grid grid-cols-1 gap-3 px-3 py-3 transition-colors hover:bg-muted/25 sm:px-4"
                                    >
                                      <div className="min-w-0">
                                        <div className="flex items-start gap-2.5">
                                          <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted/40 text-muted-foreground shrink-0">
                                            <FileText className="w-4 h-4" />
                                          </span>
                                          <div className="min-w-0">
                                            {mode === 'active' ? (
                                              <Link
                                                to={`/articles/${article.slug}`}
                                                className="inline-flex max-w-full min-w-0 items-center gap-1 font-bold text-sm text-foreground hover:text-indigo-600 dark:hover:text-indigo-300 hover:underline"
                                              >
                                                <span className="block min-w-0 truncate whitespace-nowrap">{article.title}</span>
                                                <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0" />
                                              </Link>
                                            ) : (
                                              <div className="truncate whitespace-nowrap text-sm font-bold text-foreground">{article.title}</div>
                                            )}
                                            <div className="mt-1 flex flex-wrap items-center gap-2">
                                              <span className="max-w-full truncate whitespace-nowrap text-[10px] text-muted-foreground font-mono">/{article.slug}</span>
                                              {extraSections > 0 && (
                                                <span className="rounded-full bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-300">
                                                  +{extraSections} разделов
                                                </span>
                                              )}
                                              {article.source_url && mode === 'active' && (
                                                <a
                                                  href={article.source_url}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="inline-flex items-center gap-1 rounded-full border border-indigo-500/15 bg-indigo-500/5 px-1.5 py-0.5 text-[9px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-300 dark:hover:text-indigo-200"
                                                >
                                                  <ExternalLink className="w-2.5 h-2.5" />
                                                  Источник
                                                </a>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </div>

                                      <div className="hidden min-w-0 text-[11px] text-muted-foreground xl:block">
                                        <span className="block truncate font-medium text-foreground/85">{article.author_name || 'Не указан'}</span>
                                      </div>

                                      <div className="hidden whitespace-nowrap text-[11px] font-mono text-muted-foreground xl:block">
                                        {formatDateTime(article.updated_at)}
                                      </div>

                                      <div className="hidden xl:block">
                                        {renderArticleStatusBadge(article)}
                                      </div>

                                      <div className="hidden whitespace-nowrap text-[11px] font-medium text-muted-foreground xl:block">
                                        {formatViews(article.views)}
                                      </div>

                                      <div className="hidden xl:flex xl:justify-end">
                                        {renderArticleActions(article, mode)}
                                      </div>

                                      <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-muted/20 p-3 text-[11px] xl:hidden">
                                        <div>
                                          <div className="font-bold uppercase tracking-wide text-muted-foreground text-[9px]">Автор</div>
                                          <div className="mt-0.5 truncate text-foreground">{article.author_name || 'Не указан'}</div>
                                        </div>
                                        <div>
                                          <div className="font-bold uppercase tracking-wide text-muted-foreground text-[9px]">
                                            {mode === 'archive' ? 'Архивировано' : 'Обновлено'}
                                          </div>
                                          <div className="mt-0.5 font-mono text-muted-foreground">{formatDateTime(article.updated_at)}</div>
                                        </div>
                                        <div>
                                          <div className="font-bold uppercase tracking-wide text-muted-foreground text-[9px]">Статус</div>
                                          <div className="mt-1">{renderArticleStatusBadge(article)}</div>
                                        </div>
                                        <div>
                                          <div className="font-bold uppercase tracking-wide text-muted-foreground text-[9px]">Просмотры</div>
                                          <div className="mt-0.5 whitespace-nowrap text-muted-foreground">{formatViews(article.views)}</div>
                                        </div>
                                        <div className="col-span-2 flex justify-end pt-1">
                                          {renderArticleActions(article, mode)}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        </div>
      </div>
    );
  };

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
    <div className="max-w-6xl mx-auto px-4 py-10 overflow-x-clip">
      
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

          {/* Structured Article Tree */}
          <div className="border border-border bg-card text-card-foreground rounded-xl overflow-hidden shadow-premium dark:shadow-premium-dark">
            <div className="p-4 border-b border-border space-y-3">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex items-center gap-2 border border-border rounded-lg px-3 py-2 bg-muted/30 w-full lg:max-w-md focus-within:border-indigo-500 transition-colors">
                  <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                  <input
                    type="text"
                    placeholder="Поиск по статье, разделу или автору..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-transparent text-xs text-foreground outline-none w-full placeholder-muted-foreground"
                  />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2 shrink-0">
                  <button
                    onClick={handleClearCache}
                    disabled={isClearingCache}
                    className="inline-flex items-center justify-center gap-1 px-3 py-2 border border-border hover:bg-muted rounded-lg text-xs font-semibold shadow-sm transition-colors text-muted-foreground cursor-pointer"
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

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
                <select
                  value={spaceFilter}
                  onChange={(e) => {
                    setSpaceFilter(e.target.value);
                    setSectionFilter('all');
                  }}
                  className="text-xs border border-border rounded-lg px-3 py-2 bg-muted text-foreground outline-none focus:border-indigo-500"
                >
                  <option value="all">Все отделы</option>
                  {navigationTree.map((space) => (
                    <option key={space.id} value={space.id}>{space.name}</option>
                  ))}
                </select>

                <select
                  value={sectionFilter}
                  onChange={(e) => setSectionFilter(e.target.value)}
                  className="text-xs border border-border rounded-lg px-3 py-2 bg-muted text-foreground outline-none focus:border-indigo-500"
                >
                  <option value="all">Все должности / разделы</option>
                  {sectionFilterOptions.map((section) => (
                    <option key={section.id} value={section.id}>{section.path}</option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as ArticleStatusFilter)}
                  className="text-xs border border-border rounded-lg px-3 py-2 bg-muted text-foreground outline-none focus:border-indigo-500"
                >
                  {statusFilterOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>

                <select
                  value={authorFilter}
                  onChange={(e) => setAuthorFilter(e.target.value)}
                  className="text-xs border border-border rounded-lg px-3 py-2 bg-muted text-foreground outline-none focus:border-indigo-500"
                >
                  <option value="all">Все авторы</option>
                  {authorFilterOptions.map((author) => (
                    <option key={author} value={author}>{author}</option>
                  ))}
                </select>
              </div>
            </div>

            {renderArticleTree(activeArticleTree, 'active')}

            <div className="p-4 bg-muted border-t border-border text-[10px] text-muted-foreground flex items-center justify-between">
              <span>Показано статей: {activeDisplayedCount}</span>
              <span>
                {searchQuery.trim() || spaceFilter !== 'all' || sectionFilter !== 'all' || statusFilter !== 'all' || authorFilter !== 'all'
                  ? 'Фильтры применены'
                  : 'SaaS CMS-движок v2.0'}
              </span>
            </div>
          </div>
        </>
      )}

      {/* ARCHIVE TAB */}
      {activeTab === 'archive' && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex max-w-full flex-col gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-premium dark:shadow-premium-dark sm:p-5">
            <div className="w-full max-w-3xl">
              <h3 className="font-outfit text-base font-bold text-foreground sm:text-lg">
                Архив статей базы знаний
              </h3>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Здесь находятся скрытые статьи. Вы можете вернуть их на сайт или удалить навсегда.
              </p>
            </div>
            
            <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(280px,1.4fr)_minmax(180px,1fr)_minmax(200px,1fr)_minmax(180px,0.8fr)_minmax(180px,0.8fr)]">
              <div className="flex min-h-10 min-w-0 items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 transition-colors focus-within:border-indigo-500">
                <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  placeholder="Поиск в архиве..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full min-w-0 bg-transparent text-xs text-foreground outline-none placeholder-muted-foreground"
                />
              </div>

              <select
                value={spaceFilter}
                onChange={(e) => {
                  setSpaceFilter(e.target.value);
                  setSectionFilter('all');
                }}
                className="min-h-10 min-w-0 rounded-lg border border-border bg-muted px-3 py-2 text-xs text-foreground outline-none focus:border-indigo-500"
              >
                <option value="all">Все отделы</option>
                {navigationTree.map((space) => (
                  <option key={space.id} value={space.id}>{space.name}</option>
                ))}
              </select>

              <select
                value={sectionFilter}
                onChange={(e) => setSectionFilter(e.target.value)}
                className="min-h-10 min-w-0 rounded-lg border border-border bg-muted px-3 py-2 text-xs text-foreground outline-none focus:border-indigo-500"
              >
                <option value="all">Все должности</option>
                {sectionFilterOptions.map((section) => (
                  <option key={section.id} value={section.id}>{section.path}</option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as ArticleStatusFilter)}
                className="min-h-10 min-w-0 rounded-lg border border-border bg-muted px-3 py-2 text-xs text-foreground outline-none focus:border-indigo-500"
              >
                {statusFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>

              <select
                value={authorFilter}
                onChange={(e) => setAuthorFilter(e.target.value)}
                className="min-h-10 min-w-0 rounded-lg border border-border bg-muted px-3 py-2 text-xs text-foreground outline-none focus:border-indigo-500"
              >
                <option value="all">Все авторы</option>
                {authorFilterOptions.map((author) => (
                  <option key={author} value={author}>{author}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="border border-border bg-card text-card-foreground rounded-xl overflow-hidden shadow-premium dark:shadow-premium-dark">
            {renderArticleTree(archivedArticleTree, 'archive')}

            <div className="p-4 bg-muted border-t border-border text-[10px] text-muted-foreground">
              Всего архивных статей: {archivedDisplayedCount}
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
          <ModalPortal>
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
          </ModalPortal>
        )}
      </AnimatePresence>

      {/* Sync History Modal */}
      <AnimatePresence>
        {selectedArticleForHistory && (
          <ModalPortal>
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
          </ModalPortal>
        )}
      </AnimatePresence>

    </div>
  );
}
