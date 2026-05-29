import * as React from 'react';
import { Link } from 'react-router-dom';
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
  Key
} from 'lucide-react';
import { 
  fetchArticles, 
  fetchCategories, 
  deleteArticle, 
  deleteCategory,
  updateCategory,
  updateArticle,
  Article, 
  Category, 
  importArticle 
} from '../lib/api';
import { useAuth } from '../lib/auth-context';
import UserManagement from '../components/user-management';
import SessionManagement from '../components/session-management';
import CategoryModal from '../components/category-modal';
import PreviewModal from '../components/preview-modal';
import { CategoryIcon } from '../components/icon';
import { Eye, ChevronRight, ChevronDown } from 'lucide-react';

export default function Admin() {
  const { user } = useAuth();
  const [articles, setArticles] = React.useState<Article[]>([]);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  
  const [searchQuery, setSearchQuery] = React.useState('');
  const [categoryFilter, setCategoryFilter] = React.useState('all');
  const [activeTab, setActiveTab] = React.useState<'articles' | 'users' | 'sessions'>('articles');

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = React.useState(false);

  // Custom States
  const [expandedCategories, setExpandedCategories] = React.useState<Record<number | string, boolean>>({});
  const [isCategoryModalOpen, setIsCategoryModalOpen] = React.useState(false);
  const [selectedCategoryForEdit, setSelectedCategoryForEdit] = React.useState<Category | null>(null);
  const [selectedArticleForPreview, setSelectedArticleForPreview] = React.useState<Article | null>(null);
  const [selectedCategoryForPreview, setSelectedCategoryForPreview] = React.useState<Category | null>(null);

  const loadAdminData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [arts, cats] = await Promise.all([
        fetchArticles({ all: true }), // fetches all including drafts
        fetchCategories(),
      ]);
      setArticles(arts);
      setCategories(cats);
    } catch (err) {
      console.error('Failed to load admin catalog:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Position change handlers
  const handleArticlePositionChange = async (artId: number, newPos: number) => {
    const art = articles.find(a => a.id === artId);
    if (!art) return;
    try {
      await updateArticle(artId, {
        title: art.title,
        slug: art.slug,
        summary: art.summary,
        content: art.content,
        category_id: art.category_id,
        published: art.published,
        tags: art.tags,
        position: newPos,
      });
      setArticles(prev => prev.map(a => a.id === artId ? { ...a, position: newPos } : a));
    } catch (err) {
      console.error('Failed to update article position:', err);
    }
  };

  const handleCategoryPositionChange = async (catId: number, newPos: number) => {
    const cat = categories.find(c => c.id === catId);
    if (!cat) return;
    try {
      await updateCategory(catId, {
        name: cat.name,
        slug: cat.slug,
        description: cat.description || '',
        icon: cat.icon || 'layout',
        position: newPos,
      });
      setCategories(prev => prev.map(c => c.id === catId ? { ...c, position: newPos } : c));
    } catch (err) {
      console.error('Failed to update category position:', err);
    }
  };

  const handleDeleteCategory = async (id: number, name: string) => {
    if (!window.confirm(`Вы уверены, что хотите удалить раздел "${name}"? Все статьи этого раздела останутся без категории.`)) return;

    try {
      await deleteCategory(id);
      setCategories(prev => prev.filter(c => c.id !== id));
      await loadAdminData();
      alert('Раздел успешно удален.');
    } catch (err) {
      console.error(err);
      alert('Не удалось удалить раздел.');
    }
  };

  // Toggle Category Expand/Collapse
  const toggleCategory = (id: number | string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Filtered categories computed
  const filteredCategories = React.useMemo(() => {
    return categories.filter(cat => {
      if (categoryFilter !== 'all' && cat.slug !== categoryFilter) return false;
      
      if (searchQuery.trim()) {
        const matchesCat = cat.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           (cat.description || '').toLowerCase().includes(searchQuery.toLowerCase());
        const hasMatchingArticles = articles.some(art => 
          art.category_id === cat.id && 
          (art.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
           art.summary.toLowerCase().includes(searchQuery.toLowerCase()))
        );
        return matchesCat || hasMatchingArticles;
      }
      return true;
    });
  }, [categories, articles, searchQuery, categoryFilter]);

  // Filtered articles that are uncategorized
  const uncategorizedArticles = React.useMemo(() => {
    return articles.filter(art => {
      if (art.category_id !== null) return false;
      if (categoryFilter !== 'all') return false;
      
      if (searchQuery.trim()) {
        return art.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
               art.summary.toLowerCase().includes(searchQuery.toLowerCase());
      }
      return true;
    });
  }, [articles, searchQuery, categoryFilter]);

  // Auto-expand search matches
  React.useEffect(() => {
    if (searchQuery.trim()) {
      const toExpand: Record<string | number, boolean> = {};
      articles.forEach(art => {
        if (art.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
            art.summary.toLowerCase().includes(searchQuery.toLowerCase())) {
          if (art.category_id) {
            toExpand[art.category_id] = true;
          } else {
            toExpand['uncategorized'] = true;
          }
        }
      });
      setExpandedCategories(toExpand);
    }
  }, [searchQuery, articles]);

  React.useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

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

  const draftCount = React.useMemo(() => {
    return articles.filter(art => !art.published).length;
  }, [articles]);

  const filteredArticles = React.useMemo(() => {
    return articles.filter(art => {
      const matchesSearch = art.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            art.summary.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || art.category_slug === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [articles, searchQuery, categoryFilter]);

  const handleDelete = async (id: number, title: string) => {
    if (!window.confirm(`Вы уверены, что хотите удалить статью "${title}"?`)) return;

    try {
      await deleteArticle(id);
      setArticles(prev => prev.filter(art => art.id !== id));
      alert('Статья успешно удалена.');
    } catch (err) {
      console.error(err);
      alert('Не удалось удалить статью.');
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-10 space-y-6 animate-pulse">
        <div className="h-10 w-48 bg-neutral-200 dark:bg-neutral-800 rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
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
            Создание статей, управление категориями и импорт документов.
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
            className="inline-flex items-center gap-1.5 px-4 py-2 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900 text-neutral-700 dark:text-neutral-300 rounded-lg text-sm font-semibold shadow-sm transition-all text-center justify-center cursor-pointer"
          >
            {isImporting ? (
              <Loader2 className="w-4.5 h-4.5 animate-spin" />
            ) : (
              <FileUp className="w-4.5 h-4.5" />
            )}
            <span>{isImporting ? 'Импорт...' : 'Импортировать файл'}</span>
          </button>

          <button
            onClick={() => { setSelectedCategoryForEdit(null); setIsCategoryModalOpen(true); }}
            className="inline-flex items-center gap-1.5 px-4 py-2 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900 text-neutral-700 dark:text-neutral-300 rounded-lg text-sm font-semibold shadow-sm transition-all text-center justify-center cursor-pointer font-bold"
          >
            <Plus className="w-4.5 h-4.5 text-indigo-500" />
            <span>Создать раздел</span>
          </button>
        </div>
      </div>

      {/* Tabs Switcher for Admin role */}
      {user?.role === 'Admin' && (
        <div className="flex border-b border-neutral-200 dark:border-neutral-800 mb-8 gap-6">
          <button
            onClick={() => setActiveTab('articles')}
            className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'articles'
                ? 'border-indigo-500 text-indigo-500'
                : 'border-transparent text-neutral-500 hover:text-neutral-950 dark:hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            Статьи и Категории
          </button>
          
          <button
            onClick={() => setActiveTab('users')}
            className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
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
            className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'sessions'
                ? 'border-indigo-500 text-indigo-500'
                : 'border-transparent text-neutral-500 hover:text-neutral-950 dark:hover:text-white'
            }`}
          >
            <Key className="w-4 h-4" />
            Сессии (Админ)
          </button>
        </div>
      )}

      {activeTab === 'users' && user?.role === 'Admin' && (
        <UserManagement />
      )}

      {activeTab === 'sessions' && user?.role === 'Admin' && (
        <SessionManagement />
      )}

      {activeTab === 'articles' && (
        <>
          {/* Stats Widgets */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="p-5 rounded-xl border border-neutral-200/50 dark:border-neutral-800/80 bg-white dark:bg-neutral-950 shadow-premium dark:shadow-premium-dark">
              <div className="flex items-center justify-between mb-3 text-neutral-400">
                <span className="text-xs font-semibold uppercase tracking-wider">Всего статей</span>
                <BookOpen className="w-5 h-5 text-indigo-500" />
              </div>
              <div className="text-2xl font-bold font-outfit text-neutral-900 dark:text-white">{articles.length}</div>
              <p className="text-[10px] text-neutral-400 mt-1">{draftCount} в черновиках</p>
            </div>

            <div className="p-5 rounded-xl border border-neutral-200/50 dark:border-neutral-800/80 bg-white dark:bg-neutral-950 shadow-premium dark:shadow-premium-dark">
              <div className="flex items-center justify-between mb-3 text-neutral-400">
                <span className="text-xs font-semibold uppercase tracking-wider">Разделы</span>
                <Layers className="w-5 h-5 text-violet-500" />
              </div>
              <div className="text-2xl font-bold font-outfit text-neutral-900 dark:text-white">{categories.length}</div>
              <p className="text-[10px] text-neutral-400 mt-1">тех. разделов создано</p>
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

          {/* Table grid */}
          <div className="border border-neutral-200/50 dark:border-neutral-800/80 bg-white dark:bg-neutral-950 rounded-xl overflow-hidden shadow-premium dark:shadow-premium-dark">
            <div className="p-4 border-b border-neutral-200/50 dark:border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-2 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-1.5 bg-neutral-50 dark:bg-neutral-900/30 w-full md:max-w-xs">
                <Search className="w-4 h-4 text-neutral-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Поиск по каталогу..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent text-xs text-neutral-950 dark:text-neutral-100 outline-none w-full placeholder-neutral-400"
                />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-neutral-400">Раздел:</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="text-xs border border-neutral-200 dark:border-neutral-800 rounded-lg px-2.5 py-1.5 bg-neutral-50 dark:bg-neutral-950 text-neutral-700 dark:text-neutral-300 outline-none focus:border-indigo-500"
                >
                  <option value="all">Все разделы</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.slug}>{cat.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {filteredCategories.length === 0 && uncategorizedArticles.length === 0 ? (
                <div className="text-center py-10 text-neutral-400 dark:text-neutral-600 text-xs">
                  Разделов и статей с такими фильтрами не найдено.
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Loop Categories */}
                  {filteredCategories.map((cat) => {
                    const isExpanded = !!expandedCategories[cat.id];
                    const catArticles = articles.filter(art => art.category_id === cat.id).sort((a, b) => a.position - b.position || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                    
                    // Filter articles if search query is active
                    const displayedArticles = searchQuery.trim() 
                      ? catArticles.filter(art => 
                          art.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          art.summary.toLowerCase().includes(searchQuery.toLowerCase())
                        )
                      : catArticles;

                    return (
                      <div key={cat.id} className="border border-neutral-200/60 dark:border-neutral-800/80 rounded-xl overflow-hidden bg-neutral-50/20 dark:bg-neutral-950/20">
                        {/* Category Row */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-950/60 border-b border-neutral-100 dark:border-neutral-900 gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <button
                              onClick={() => toggleCategory(cat.id)}
                              className="p-1 rounded-lg text-neutral-400 hover:text-neutral-950 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900 shrink-0 cursor-pointer"
                            >
                              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center border border-indigo-500/20 shrink-0">
                              <CategoryIcon name={cat.icon} className="w-4.5 h-4.5" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-outfit text-sm font-bold text-neutral-900 dark:text-white truncate">
                                {cat.name}
                              </h4>
                              <p className="text-[10px] text-neutral-400 truncate max-w-sm font-mono mt-0.5 font-light">
                                /{cat.slug}
                              </p>
                            </div>
                          </div>

                          <div className="hidden md:block text-[11px] text-neutral-500 dark:text-neutral-400 flex-1 truncate font-light max-w-xs xl:max-w-md">
                            {cat.description}
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                            {/* Position Input */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-neutral-450 dark:text-neutral-500 font-semibold font-mono">Порядок:</span>
                              <input
                                type="number"
                                key={`cat-pos-${cat.id}-${cat.position}`}
                                defaultValue={cat.position}
                                onBlur={(e) => handleCategoryPositionChange(cat.id, Number(e.target.value))}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleCategoryPositionChange(cat.id, Number((e.target as HTMLInputElement).value));
                                    (e.target as HTMLInputElement).blur();
                                  }
                                }}
                                className="w-12 text-center text-xs py-0.5 rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-white outline-none focus:border-indigo-500"
                              />
                            </div>

                            <span className="text-[10px] font-bold text-neutral-400 bg-neutral-100 dark:bg-neutral-905 px-2 py-0.5 rounded uppercase tracking-wider shrink-0 select-none">
                              {catArticles.length} ст.
                            </span>

                            {/* Actions */}
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => { setSelectedCategoryForPreview(cat); setSelectedArticleForPreview(null); }}
                                className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-neutral-900 transition-colors cursor-pointer"
                                title="Предпросмотр раздела"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => { setSelectedCategoryForEdit(cat); setIsCategoryModalOpen(true); }}
                                className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-neutral-900 transition-colors cursor-pointer"
                                title="Редактировать раздел"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteCategory(cat.id, cat.name)}
                                className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-white dark:hover:bg-neutral-900 transition-colors cursor-pointer"
                                title="Удалить раздел"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Articles Under Category (If Expanded) */}
                        {isExpanded && (
                          <div className="p-2 sm:p-4 bg-white dark:bg-neutral-950/20 divide-y divide-neutral-100 dark:divide-neutral-900/60">
                            {displayedArticles.length === 0 ? (
                              <div className="py-6 text-center text-xs text-neutral-400 dark:text-neutral-500 italic">
                                {searchQuery.trim() ? 'Нет статей, подходящих под критерии поиска.' : 'В этом разделе пока нет статей.'}
                              </div>
                            ) : (
                              displayedArticles.map((art) => (
                                <div key={art.id} className="flex items-center justify-between py-3 px-2 hover:bg-neutral-50/50 dark:hover:bg-neutral-900/10 transition-colors gap-4">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <Link
                                        to={`/articles/${art.slug}`}
                                        className="font-bold text-xs text-neutral-900 dark:text-neutral-100 hover:text-indigo-500 dark:hover:text-indigo-400 hover:underline truncate"
                                      >
                                        {art.title}
                                      </Link>
                                      <ExternalLink className="w-3 h-3 opacity-40 shrink-0" />
                                    </div>
                                    <span className="block text-[9px] text-neutral-400 font-mono mt-0.5 font-light truncate">
                                      /{art.slug}
                                    </span>
                                  </div>

                                  <div className="hidden sm:block shrink-0 select-none">
                                    {art.published ? (
                                      <span className="inline-flex items-center text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-medium">
                                        Опубликовано
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 font-medium">
                                        Черновик
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-4 shrink-0">
                                    {/* Position Input */}
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] text-neutral-405 dark:text-neutral-500 font-mono">Порядок:</span>
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
                                        className="w-12 text-center text-xs py-0.5 rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-white outline-none focus:border-indigo-500 font-medium"
                                      />
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => { setSelectedArticleForPreview(art); setSelectedCategoryForPreview(null); }}
                                        className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors cursor-pointer"
                                        title="Предпросмотр статьи"
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                      </button>
                                      <Link
                                        to={`/admin/editor/${art.id}`}
                                        className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
                                        title="Редактировать статью"
                                      >
                                        <Edit3 className="w-3.5 h-3.5" />
                                      </Link>
                                      <button
                                        onClick={() => handleDelete(art.id, art.title)}
                                        className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors cursor-pointer"
                                        title="Удалить статью"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))
                            )}

                            <div className="pt-3 flex justify-start pl-2">
                              <Link
                                to={`/admin/editor/new?category_id=${cat.id}`}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-indigo-200 hover:border-indigo-500 hover:bg-indigo-500/5 text-indigo-600 dark:border-indigo-800 dark:hover:border-indigo-500 dark:hover:bg-indigo-500/10 dark:text-indigo-400 rounded-lg text-xs font-semibold transition-all select-none cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Добавить статью в этот раздел</span>
                              </Link>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Uncategorized Articles section */}
                  {uncategorizedArticles.length > 0 && (
                    <div className="border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden bg-neutral-50/10 dark:bg-neutral-950/5">
                      {/* Uncategorized Header Row */}
                      <div className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-950/40 border-b border-neutral-100 dark:border-neutral-900 gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            onClick={() => toggleCategory('uncategorized')}
                            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-950 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900 shrink-0 cursor-pointer"
                          >
                            {expandedCategories['uncategorized'] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                          <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-900 text-neutral-400 flex items-center justify-center border border-neutral-200/50 dark:border-neutral-800/50 shrink-0">
                            <Layers className="w-4.5 h-4.5" />
                          </div>
                          <div>
                            <h4 className="font-outfit text-sm font-bold text-neutral-900 dark:text-white select-none">
                              Без раздела
                            </h4>
                            <p className="text-[9px] text-neutral-400 mt-0.5 font-light">
                              Свободные статьи или импортированные файлы
                            </p>
                          </div>
                        </div>

                        <span className="text-[10px] font-bold text-neutral-400 bg-neutral-100 dark:bg-neutral-900 px-2 py-0.5 rounded uppercase tracking-wider select-none shrink-0">
                          {uncategorizedArticles.length} ст.
                        </span>
                      </div>

                      {/* Uncategorized Articles List */}
                      {expandedCategories['uncategorized'] && (
                        <div className="p-2 sm:p-4 bg-white dark:bg-neutral-950/20 divide-y divide-neutral-100 dark:divide-neutral-900">
                          {uncategorizedArticles.map((art) => (
                            <div key={art.id} className="flex items-center justify-between py-3 px-2 hover:bg-neutral-50/50 dark:hover:bg-neutral-900/10 transition-colors gap-4">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <Link
                                    to={`/articles/${art.slug}`}
                                    className="font-bold text-xs text-neutral-900 dark:text-neutral-100 hover:text-indigo-500 dark:hover:text-indigo-400 hover:underline truncate"
                                  >
                                    {art.title}
                                  </Link>
                                  <ExternalLink className="w-3 h-3 opacity-40 shrink-0" />
                                </div>
                                <span className="block text-[9px] text-neutral-400 font-mono mt-0.5 font-light truncate">
                                  /{art.slug}
                                </span>
                              </div>

                              <div className="hidden sm:block shrink-0 select-none">
                                {art.published ? (
                                  <span className="inline-flex items-center text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-medium">
                                    Опубликовано
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 font-medium">
                                    Черновик
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-4 shrink-0">
                                {/* Position Input */}
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] text-neutral-400 font-mono">Порядок:</span>
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
                                    className="w-12 text-center text-xs py-0.5 rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-white outline-none focus:border-indigo-500 font-medium"
                                  />
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => { setSelectedArticleForPreview(art); setSelectedCategoryForPreview(null); }}
                                    className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors cursor-pointer"
                                    title="Предпросмотр статьи"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  <Link
                                    to={`/admin/editor/${art.id}`}
                                    className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
                                    title="Редактировать статью"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </Link>
                                  <button
                                    onClick={() => handleDelete(art.id, art.title)}
                                    className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors cursor-pointer"
                                    title="Удалить статью"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}

                          <div className="pt-3 flex justify-start pl-2">
                            <Link
                              to="/admin/editor/new"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-neutral-350 hover:border-neutral-500 hover:bg-neutral-500/5 text-neutral-600 dark:border-neutral-800 dark:hover:border-neutral-550 dark:hover:bg-neutral-550/10 dark:text-neutral-450 rounded-lg text-xs font-semibold transition-all select-none cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Добавить статью без раздела</span>
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 bg-neutral-50 dark:bg-neutral-950 border-t border-neutral-200/50 dark:border-neutral-800/80 text-[10px] text-neutral-400 flex items-center justify-between">
              <span>Всего разделов: {categories.length} • Всего статей: {articles.length}</span>
              <span>SaaS CMS-движок v2.0</span>
            </div>
          </div>
        </>
      )}

      {/* Modals */}
      {isCategoryModalOpen && (
        <CategoryModal
          category={selectedCategoryForEdit}
          onClose={() => { setIsCategoryModalOpen(false); setSelectedCategoryForEdit(null); }}
          onSuccess={loadAdminData}
        />
      )}

      {(selectedArticleForPreview || selectedCategoryForPreview) && (
        <PreviewModal
          article={selectedArticleForPreview}
          category={selectedCategoryForPreview}
          categories={categories}
          articles={articles}
          onClose={() => { setSelectedArticleForPreview(null); setSelectedCategoryForPreview(null); }}
        />
      )}

    </div>
  );
}
