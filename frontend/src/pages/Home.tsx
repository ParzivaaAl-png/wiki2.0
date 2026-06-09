import * as React from 'react';
import { Link } from 'react-router-dom';
import { Search, Sparkles, Clock, ChevronRight, ChevronLeft, Check, Plus, Star, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  fetchArticles, 
  updateArticle, 
  reorderArticles, 
  fetchFavoriteArticles, 
  saveFavoriteArticles, 
  fetchReadingHistory,
  clearReadingHistory,
  Article
} from '../lib/api';
import { CategoryIcon } from '../components/icon';
import { SearchModal } from '../components/search-modal';
import { useAuth } from '../lib/auth-context';

const PRESET_COLORS = ['#6366f1', '#8b5cf6', '#7c3aed', '#10b981', '#f43f5e', '#f59e0b', '#06b6d4'];
const PRESET_ICONS = ['file-text', 'book', 'layers', 'layout', 'database', 'settings', 'cpu', 'terminal', 'search'];

export default function Home() {
  const { user } = useAuth();
  const [allArticles, setAllArticles] = React.useState<Article[]>([]);
  const [trendingArticles, setTrendingArticles] = React.useState<Article[]>([]);
  const [recommendedArticles, setRecommendedArticles] = React.useState<Article[]>([]);
  const [favoriteArticles, setFavoriteArticles] = React.useState<Article[]>([]);
  const [readingHistory, setReadingHistory] = React.useState<Article[]>([]);

  
  const [isLoading, setIsLoading] = React.useState(true);

  // Filter Tab State: 'all' | 'new' | 'popular' | 'actual' | 'trending' | 'recommended'
  const [filterTab, setFilterTab] = React.useState<'all' | 'new' | 'popular' | 'actual' | 'trending' | 'recommended'>('all');

  // Customization States (Personal Favorites)
  const [isConfigureMode, setIsConfigureMode] = React.useState(false);
  const [isAddFavModalOpen, setIsAddFavModalOpen] = React.useState(false);
  const [favSearchQuery, setFavSearchQuery] = React.useState('');
  const [searchFavQuery, setSearchFavQuery] = React.useState('');

  // Global Edit Mode States (Editor / Admin only)
  const [isEditMode, setIsEditMode] = React.useState(false);
  const [draggedId, setDraggedId] = React.useState<number | null>(null);

  const loadData = React.useCallback(async () => {
    try {
      const isStaff = user && (user.role === 'Admin' || user.role === 'Editor');
      
      // Load all lists in parallel safely using Promise.allSettled
      const [artsResult, trendingArtsResult, recommendedArtsResult] = await Promise.allSettled([
        fetchArticles({ all: isStaff ? true : false }),
        fetchArticles({ filter: 'trending' }),
        fetchArticles({ filter: 'recommended' })
      ]);

      const arts = artsResult.status === 'fulfilled' ? artsResult.value : [];
      const trendingArts = trendingArtsResult.status === 'fulfilled' ? trendingArtsResult.value : [];
      const recommendedArts = recommendedArtsResult.status === 'fulfilled' ? recommendedArtsResult.value : [];

      setAllArticles(arts.filter(art => !art.slug.startsWith('auto-list-')));
      setTrendingArticles(trendingArts.filter(art => !art.slug.startsWith('auto-list-')));
      setRecommendedArticles(recommendedArts.filter(art => !art.slug.startsWith('auto-list-')));

      if (user) {
        const [favs, history] = await Promise.all([
          fetchFavoriteArticles(),
          fetchReadingHistory()
        ]);
        setFavoriteArticles(favs);
        setReadingHistory(history);
      } else {
        setFavoriteArticles([]);
        setReadingHistory([]);
      }
    } catch (error) {
      console.error('Home data load failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Turn off configure mode if filter changes
  React.useEffect(() => {
    setIsConfigureMode(false);
    setIsEditMode(false);
  }, [filterTab]);

  const getArticleColor = (id: number) => PRESET_COLORS[id % PRESET_COLORS.length];
  const getArticleIcon = (id: number) => PRESET_ICONS[id % PRESET_ICONS.length];

  // COMPUTED ARTICLES LIST BASED ON ACTIVE FILTER TAB
  const displayedArticles = React.useMemo(() => {
    // If Admin/Editor global editing mode is on, display ALL articles so they can order and hide them
    if (isEditMode) {
      return allArticles;
    }

    const visibleArticles = allArticles.filter(a => a.is_visible !== false && a.published);

    if (filterTab === 'new') {
      return [...visibleArticles]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    if (filterTab === 'popular') {
      return [...visibleArticles]
        .sort((a, b) => (b.views || 0) - (a.views || 0));
    }

    if (filterTab === 'actual') {
      return [...visibleArticles]
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    }

    if (filterTab === 'trending') {
      return trendingArticles.filter(a => a.is_visible !== false && a.published);
    }

    if (filterTab === 'recommended') {
      return recommendedArticles.filter(a => a.is_visible !== false && a.published);
    }

    return visibleArticles;
  }, [filterTab, allArticles, trendingArticles, recommendedArticles, isEditMode]);

  const filteredFavs = React.useMemo(() => {
    if (!searchFavQuery.trim()) return favoriteArticles;
    const q = searchFavQuery.toLowerCase();
    return favoriteArticles.filter(art =>
      art.title.toLowerCase().includes(q) || (art.summary || '').toLowerCase().includes(q)
    );
  }, [favoriteArticles, searchFavQuery]);

  // Drag and Drop for PERSONAL Favorites Configuration
  const handleFavDragStart = (e: React.DragEvent, id: number) => {
    if (!isConfigureMode) return;
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id.toString());
  };

  const handleFavDrop = async (e: React.DragEvent, targetId: number) => {
    if (!isConfigureMode || draggedId === null || draggedId === targetId) return;

    const draggedIdx = favoriteArticles.findIndex(a => a.id === draggedId);
    const targetIdx = favoriteArticles.findIndex(a => a.id === targetId);

    if (draggedIdx !== -1 && targetIdx !== -1) {
      const updated = [...favoriteArticles];
      const [draggedItem] = updated.splice(draggedIdx, 1);
      updated.splice(targetIdx, 0, draggedItem);

      setFavoriteArticles(updated);

      try {
        await saveFavoriteArticles(updated.map(a => a.id));
      } catch (err) {
        console.error('Failed to save personalized favorites order:', err);
      }
    }
  };

  // Drag and Drop for GLOBAL Articles Editing (Admin/Editor only)
  const handleGlobalDragStart = (e: React.DragEvent, id: number) => {
    if (!isEditMode) return;
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id.toString());
  };

  const handleGlobalDrop = async (e: React.DragEvent, targetId: number) => {
    if (!isEditMode || draggedId === null || draggedId === targetId) return;

    const draggedIdx = allArticles.findIndex(a => a.id === draggedId);
    const targetIdx = allArticles.findIndex(a => a.id === targetId);

    if (draggedIdx !== -1 && targetIdx !== -1) {
      const updated = [...allArticles];
      const [draggedItem] = updated.splice(draggedIdx, 1);
      updated.splice(targetIdx, 0, draggedItem);

      const reordered = updated.map((art, idx) => ({ ...art, position: idx + 1 }));
      setAllArticles(reordered);

      try {
        await reorderArticles(reordered.map(a => ({ id: a.id, position: a.position })));
      } catch (err) {
        console.error('Failed to save global articles order:', err);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent, id: number) => {
    if (!isEditMode && !isConfigureMode) return;
    e.preventDefault();
  };

  const handleDragEnd = () => {
    setDraggedId(null);
  };

  // Remove Article from Personal Favorites
  const handleRemoveFromFavorites = async (e: React.MouseEvent | React.TouchEvent, artId: number) => {
    e.preventDefault();
    e.stopPropagation();

    const updated = favoriteArticles.filter(a => a.id !== artId);
    setFavoriteArticles(updated);

    try {
      await saveFavoriteArticles(updated.map(a => a.id));
    } catch (err) {
      console.error('Failed to remove article from favorites:', err);
    }
  };

  const handleMoveFavorite = async (direction: 'left' | 'right', artId: number) => {
    const idx = favoriteArticles.findIndex(a => a.id === artId);
    if (idx === -1) return;
    const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= favoriteArticles.length) return;

    const updated = [...favoriteArticles];
    const [item] = updated.splice(idx, 1);
    updated.splice(targetIdx, 0, item);
    setFavoriteArticles(updated);

    try {
      await saveFavoriteArticles(updated.map(a => a.id));
    } catch (err) {
      console.error('Failed to save personalized favorites order:', err);
    }
  };

  const handleMoveGlobal = async (direction: 'left' | 'right', artId: number) => {
    const idx = allArticles.findIndex(a => a.id === artId);
    if (idx === -1) return;
    const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= allArticles.length) return;

    const updated = [...allArticles];
    const [item] = updated.splice(idx, 1);
    updated.splice(targetIdx, 0, item);

    const reordered = updated.map((art, index) => ({ ...art, position: index + 1 }));
    setAllArticles(reordered);

    try {
      await reorderArticles(reordered.map(a => ({ id: a.id, position: a.position })));
    } catch (err) {
      console.error('Failed to save global articles order:', err);
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm('Вы уверены, что хотите очистить всю историю просмотров?')) return;
    try {
      await clearReadingHistory();
      setReadingHistory([]);
    } catch (err: any) {
      console.error('Failed to clear reading history:', err);
      alert('Не удалось очистить историю: ' + err.message);
    }
  };

  // Add Article to Personal Favorites
  const handleAddToFavorites = async (art: Article) => {
    if (favoriteArticles.some(a => a.id === art.id)) return;
    if (favoriteArticles.length >= 4) {
      alert('В быстрый доступ можно добавить не более 4 статей.');
      return;
    }

    const updated = [...favoriteArticles, art];
    setFavoriteArticles(updated);
    setIsAddFavModalOpen(false);
    setFavSearchQuery('');

    try {
      await saveFavoriteArticles(updated.map(a => a.id));
    } catch (err) {
      console.error('Failed to add article to favorites:', err);
    }
  };

  // Global Soft Delete / Archive Article (Editor / Admin only)
  const handleArchiveArticle = async (e: React.MouseEvent | React.TouchEvent, art: Article) => {
    e.preventDefault();
    e.stopPropagation();

    const confirmed = window.confirm(`Вы уверены, что хотите скрыть статью "${art.title}"? Статья пропадет из навигации и быстрого доступа, но останется в архиве.`);
    if (!confirmed) return;

    try {
      await updateArticle(art.id, {
        title: art.title,
        slug: art.slug,
        content: art.content,
        summary: art.summary || '',
        category_id: null,
        published: art.published,
        tags: art.tags || [],
        position: art.position || 0,
        is_visible: false
      });
      await loadData();
    } catch (err) {
      console.error('Failed to archive article:', err);
      alert('Ошибка при скрытии статьи.');
    }
  };

  // Search filter for favorites addition
  const searchResultsForFavs = React.useMemo(() => {
    const visibleActive = allArticles.filter(a => a.is_visible !== false && a.published && !favoriteArticles.some(f => f.id === a.id));
    if (!favSearchQuery.trim()) return visibleActive;
    const q = favSearchQuery.toLowerCase();
    return visibleActive.filter(a => 
      a.title.toLowerCase().includes(q) || (a.summary || '').toLowerCase().includes(q)
    );
  }, [allArticles, favoriteArticles, favSearchQuery]);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 },
    },
  };

  const itemVariants = {
    hidden: { y: 15, opacity: 0 },
    show: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 120 } },
  };

  const isStaff = user && (user.role === 'Admin' || user.role === 'Editor');

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-20 space-y-12 animate-pulse">
        <div className="space-y-4 text-center max-w-2xl mx-auto">
          <div className="h-6 w-32 bg-neutral-200 dark:bg-neutral-800 rounded-full mx-auto" />
          <div className="h-12 w-3/4 bg-neutral-200 dark:bg-neutral-800 rounded mx-auto" />
          <div className="h-4 w-full bg-neutral-200 dark:bg-neutral-800 rounded mx-auto" />
        </div>
        <div className="h-14 max-w-2xl bg-neutral-200 dark:bg-neutral-800 rounded-xl mx-auto" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-12">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 bg-neutral-200 dark:bg-neutral-800 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen pb-20 overflow-hidden">
      
      {/* Decorative Blurs */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[400px] pointer-events-none -z-10 opacity-70 dark:opacity-30">
        <div className="absolute top-[-10%] left-[20%] w-[350px] h-[350px] rounded-full bg-indigo-400 dark:bg-indigo-900/40 blur-[120px]" />
        <div className="absolute top-[10%] right-[20%] w-[300px] h-[300px] rounded-full bg-violet-400 dark:bg-violet-900/30 blur-[100px]" />
      </div>

      {/* Hero Header */}
      <section className="max-w-4xl mx-auto px-3 sm:px-4 pt-10 sm:pt-16 pb-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-indigo-500/10 dark:border-indigo-400/20 bg-indigo-500/5 text-indigo-600 dark:text-indigo-400 text-xs font-semibold mb-6 shadow-sm shadow-indigo-500/5"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>SaaS База Знаний 2026</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="font-outfit text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-4 sm:mb-6 bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-700 dark:from-white dark:via-neutral-100 dark:to-neutral-400 bg-clip-text text-transparent"
        >
          Все статьи Wiki 2.0 <br />
          в одном месте.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="text-neutral-500 dark:text-neutral-400 text-sm sm:text-base md:text-lg lg:text-xl max-w-2xl mx-auto mb-6 sm:mb-8 font-light leading-relaxed"
        >
          Минималистичный справочник с моментальным автозаполнением, поиском по содержимому статей и красивым оформлением в стиле Notion и GitBook.
        </motion.p>

        {/* Search Input Bar */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="max-w-2xl mx-auto"
        >
          <SearchModal variant="hero" />
        </motion.div>
      </section>

      {/* MAIN CONTENT CONTAINER */}
      <section className="max-w-5xl mx-auto px-3 sm:px-4 lg:px-8 py-6 space-y-6">

        {/* ROW OF PERSONAL BLOCKS (Continue Reading + Favorites + Recent Changes) */}
        {user && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Block: Продолжить чтение */}
            <div className="lg:col-span-5 flex">
              <div className="w-full p-5 rounded-xl border border-neutral-200/50 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-premium dark:shadow-premium-dark flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-900 pb-3 mb-4">
                    <h3 className="font-outfit text-xs font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5 uppercase tracking-wider select-none">
                      <Clock className="w-4 h-4 text-indigo-500" />
                      Продолжить чтение
                    </h3>
                    {readingHistory.length > 0 && (
                      <button
                        onClick={handleClearHistory}
                        className="text-[10px] font-bold text-red-500 hover:text-red-655 bg-red-500/10 hover:bg-red-500/20 px-2.5 py-1 rounded transition-colors cursor-pointer"
                      >
                        Очистить
                      </button>
                    )}
                  </div>

                  {readingHistory.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center text-neutral-455 text-xs italic">
                      <Clock className="w-8 h-8 text-neutral-300 dark:text-neutral-800 mb-2 animate-pulse" />
                      <span>Здесь будут отображаться последние прочитанные вами статьи.</span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {readingHistory.slice(0, 3).map((art) => (
                        <Link
                          key={art.id}
                          to={`/articles/${art.slug}`}
                          className="flex items-start gap-3 p-3 rounded-lg border border-neutral-150 dark:border-neutral-900 hover:border-indigo-500/25 hover:bg-neutral-50/50 dark:hover:bg-neutral-900/10 transition-all group"
                        >
                          <div className="w-8 h-8 rounded-md bg-indigo-500/5 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0 mt-0.5 font-bold text-xs">
                            🕒
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs font-bold text-neutral-800 dark:text-neutral-200 group-hover:text-indigo-500 transition-colors truncate">
                              {art.title}
                            </h4>
                            <p className="text-[10px] text-neutral-455 truncate mt-0.5">
                              {art.summary || 'Описание отсутствует'}
                            </p>
                            <span className="text-[9px] text-neutral-400 block mt-1 font-mono">
                              {formatRelativeTime(art.viewed_at!)}
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Middle Block: Избранное */}
            <div className="lg:col-span-7 flex">
              <div className="w-full p-5 rounded-xl border border-neutral-200/50 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-premium dark:shadow-premium-dark flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-900 pb-3 mb-4 gap-2">
                    <h3 className="font-outfit text-xs font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5 uppercase tracking-wider select-none">
                      <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                      Избранное
                    </h3>
                    <div className="flex items-center gap-1.5 shrink-0 select-none">
                      {favoriteArticles.length > 0 && (
                        <input
                          type="text"
                          placeholder="Поиск..."
                          value={searchFavQuery}
                          onChange={(e) => setSearchFavQuery(e.target.value)}
                          className="text-[10px] px-2 py-0.5 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/30 text-neutral-900 dark:text-white rounded outline-none focus:border-indigo-500 placeholder-neutral-455 w-16"
                        />
                      )}
                      <button
                        onClick={() => setIsConfigureMode(prev => !prev)}
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-bold transition-all cursor-pointer shadow-sm shrink-0 ${
                          isConfigureMode
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-455'
                            : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20'
                        }`}
                      >
                        {isConfigureMode ? <Check className="w-2.5 h-2.5" /> : null}
                        <span>{isConfigureMode ? 'Готово' : 'Наст.'}</span>
                      </button>
                    </div>
                  </div>

                  {filteredFavs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center space-y-2">
                      <span className="text-[10px] text-neutral-455 italic">
                        {searchFavQuery ? 'Ничего не найдено' : 'В вашем избранном пока нет статей.'}
                      </span>
                      {!searchFavQuery && !isConfigureMode && (
                        <button
                          onClick={() => setIsConfigureMode(true)}
                          className="text-[9px] font-bold text-indigo-500 hover:text-indigo-750 flex items-center gap-0.5 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Добавить статьи
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2.5">
                      {filteredFavs.map((art) => {
                        const isBeingDragged = art.id === draggedId;
                        const borderAccentColor = getArticleColor(art.id);
                        return (
                          <div
                            key={art.id}
                            draggable={isConfigureMode}
                            onDragStart={(e) => handleFavDragStart(e as any, art.id)}
                            onDragOver={(e) => handleDragOver(e, art.id)}
                            onDrop={(e) => handleFavDrop(e, art.id)}
                            onDragEnd={handleDragEnd}
                            onClick={(e) => isConfigureMode && e.preventDefault()}
                            style={{ 
                              borderColor: isConfigureMode ? borderAccentColor : undefined,
                            }}
                            className={`group relative flex items-center justify-between p-2.5 rounded-lg border transition-all duration-300 ${
                              isConfigureMode 
                                ? 'border-2 cursor-grab active:cursor-grabbing hover:scale-[1.01]' 
                                : 'border-neutral-150 dark:border-neutral-900 hover:border-indigo-500/25 hover:bg-neutral-50/50 dark:hover:bg-neutral-900/10'
                            } ${isBeingDragged ? 'opacity-40 border-dashed scale-95' : ''}`}
                          >
                            {isConfigureMode && (
                              <button
                                onClick={(e) => handleRemoveFromFavorites(e, art.id)}
                                onTouchStart={(e) => {
                                  e.stopPropagation();
                                  handleRemoveFromFavorites(e, art.id);
                                }}
                                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 hover:bg-red-655 text-white flex items-center justify-center cursor-pointer shadow-md hover:scale-110 active:scale-95 transition-all z-20 border border-white dark:border-neutral-950"
                                title="Удалить из избранного"
                              >
                                <span className="w-2 h-[2px] bg-white rounded-full" />
                              </button>
                            )}

                            <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-1">
                              <div className="w-6 h-6 rounded bg-amber-500/5 dark:bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0 text-xs select-none">
                                ⭐
                              </div>
                              <div className="min-w-0 flex-1">
                                <Link to={`/articles/${art.slug}`} className="block">
                                  <h4 className="text-xs font-bold text-neutral-800 dark:text-neutral-200 group-hover:text-indigo-500 transition-colors truncate">
                                    {art.title}
                                  </h4>
                                </Link>
                              </div>
                            </div>

                            {isConfigureMode ? (
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleMoveFavorite('left', art.id);
                                  }}
                                  disabled={favoriteArticles.findIndex(a => a.id === art.id) === 0}
                                  className="p-0.5 rounded bg-neutral-100 dark:bg-neutral-900 text-neutral-500 disabled:opacity-30 cursor-pointer"
                                >
                                  <ChevronLeft className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleMoveFavorite('right', art.id);
                                  }}
                                  disabled={favoriteArticles.findIndex(a => a.id === art.id) === favoriteArticles.length - 1}
                                  className="p-0.5 rounded bg-neutral-100 dark:bg-neutral-900 text-neutral-550 disabled:opacity-30 cursor-pointer"
                                >
                                  <ChevronRight className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              art.favorited_at && (
                                <span className="text-[9px] text-neutral-400 shrink-0 font-mono select-none">
                                  {new Date(art.favorited_at).toLocaleDateString()}
                                </span>
                              )
                            )}
                          </div>
                        );
                      })}

                      {isConfigureMode && favoriteArticles.length < 4 && (
                        <div
                          onClick={() => setIsAddFavModalOpen(true)}
                          className="group cursor-pointer flex items-center justify-center p-2 rounded-lg border-2 border-dashed border-indigo-500/40 bg-indigo-500/[0.01] hover:bg-indigo-500/[0.04] hover:border-indigo-500/80 transition-all duration-300 min-h-[42px] shadow-sm select-none"
                        >
                          <Plus className="w-4 h-4 text-indigo-500/60 group-hover:text-indigo-500 transition-colors animate-pulse" />
                          <span className="text-[9px] font-bold text-indigo-500/65 group-hover:text-indigo-500 uppercase tracking-wider ml-1">
                            Добавить
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>



          </div>
        )}

        {/* ARTICLES CATALOG CARD */}
        <div className="p-5 rounded-xl border border-neutral-200/50 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-premium dark:shadow-premium-dark space-y-4">
          
          {/* Header & Tabs */}
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-neutral-105 dark:border-neutral-900 pb-3 gap-3">
            <div className="flex bg-neutral-100 dark:bg-neutral-900 p-1 rounded-xl border border-neutral-200/30 dark:border-neutral-800/30 shadow-inner gap-0.5 overflow-x-auto max-w-full select-none scrollbar-none shrink-0">
              <button
                onClick={() => setFilterTab('all')}
                className={`px-3.5 py-1.5 rounded-lg text-[10px] font-bold transition-all shrink-0 cursor-pointer ${
                  filterTab === 'all' && !isEditMode
                    ? 'bg-indigo-500 text-white shadow'
                    : 'text-neutral-550 hover:text-neutral-950 dark:hover:text-white'
                }`}
              >
                Все
              </button>
              <button
                onClick={() => setFilterTab('new')}
                className={`px-3.5 py-1.5 rounded-lg text-[10px] font-bold transition-all shrink-0 cursor-pointer ${
                  filterTab === 'new' && !isEditMode
                    ? 'bg-indigo-500 text-white shadow'
                    : 'text-neutral-550 hover:text-neutral-950 dark:hover:text-white'
                }`}
              >
                Новые
              </button>
              <button
                onClick={() => setFilterTab('popular')}
                className={`px-3.5 py-1.5 rounded-lg text-[10px] font-bold transition-all shrink-0 cursor-pointer ${
                  filterTab === 'popular' && !isEditMode
                    ? 'bg-indigo-500 text-white shadow'
                    : 'text-neutral-550 hover:text-neutral-950 dark:hover:text-white'
                }`}
              >
                Популярные
              </button>
              <button
                onClick={() => setFilterTab('actual')}
                className={`px-3.5 py-1.5 rounded-lg text-[10px] font-bold transition-all shrink-0 cursor-pointer ${
                  filterTab === 'actual' && !isEditMode
                    ? 'bg-indigo-500 text-white shadow'
                    : 'text-neutral-550 hover:text-neutral-950 dark:hover:text-white'
                }`}
              >
                Актуальные
              </button>
              <button
                onClick={() => setFilterTab('trending')}
                className={`px-3.5 py-1.5 rounded-lg text-[10px] font-bold transition-all shrink-0 cursor-pointer ${
                  filterTab === 'trending' && !isEditMode
                    ? 'bg-indigo-500 text-white shadow'
                    : 'text-neutral-550 hover:text-neutral-950 dark:hover:text-white'
                }`}
              >
                Трендовые
              </button>
              <button
                onClick={() => setFilterTab('recommended')}
                className={`px-3.5 py-1.5 rounded-lg text-[10px] font-bold transition-all shrink-0 cursor-pointer ${
                  filterTab === 'recommended' && !isEditMode
                    ? 'bg-indigo-500 text-white shadow'
                    : 'text-neutral-550 hover:text-neutral-950 dark:hover:text-white'
                }`}
              >
                Рекомендуемые
              </button>
            </div>

            <div className="flex items-center gap-2 select-none self-end md:self-auto">
              {isStaff && !isConfigureMode && (
                <button
                  onClick={() => setIsEditMode(prev => !prev)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-all cursor-pointer shadow-sm ${
                    isEditMode
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-450'
                      : 'bg-violet-500/10 border-violet-500/20 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20'
                  }`}
                >
                  {isEditMode ? <Check className="w-3.5 h-3.5" /> : null}
                  <span>{isEditMode ? 'Готово' : 'Порядок статей'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Articles Bento Grid */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {displayedArticles.map((art) => {
              const isBeingDragged = art.id === draggedId;
              const borderAccentColor = getArticleColor(art.id);
              const iconName = getArticleIcon(art.id);
              const isHidden = art.is_visible === false;
              
              return (
                <motion.div
                  key={art.id}
                  variants={itemVariants}
                  whileHover={!isEditMode && !isConfigureMode ? { y: -3, scale: 1.01 } : undefined}
                  draggable={isEditMode}
                  onDragStart={(e) => handleGlobalDragStart(e as any, art.id)}
                  onDragOver={(e) => handleDragOver(e, art.id)}
                  onDrop={(e) => handleGlobalDrop(e, art.id)}
                  onDragEnd={handleDragEnd}
                  onClick={(e) => isEditMode && e.preventDefault()}
                  style={{ 
                    borderColor: isEditMode ? borderAccentColor : undefined,
                    boxShadow: isEditMode ? `0 0 10px ${borderAccentColor}18` : undefined
                  }}
                  className={`group relative flex flex-col justify-between p-5 rounded-xl border bg-white dark:bg-neutral-950 transition-all duration-300 ${
                    isEditMode 
                      ? 'border-2 cursor-grab active:cursor-grabbing hover:scale-[1.01]' 
                      : 'border-neutral-200/60 dark:border-neutral-800 hover:border-indigo-500/25 dark:hover:border-indigo-500/25 hover:shadow-glow dark:hover:shadow-glow'
                  } ${isBeingDragged ? 'opacity-40 border-dashed scale-95' : ''} ${isHidden ? 'opacity-65' : ''} shadow-premium dark:shadow-premium-dark`}
                >
                  {isEditMode && (
                    <button
                      onClick={(e) => handleArchiveArticle(e, art)}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                        handleArchiveArticle(e, art);
                      }}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 hover:bg-red-650 text-white flex items-center justify-center cursor-pointer shadow-md hover:scale-110 active:scale-95 transition-all z-20 border border-white dark:border-neutral-950"
                      title="Скрыть статью в архив"
                    >
                      <span className="w-2 h-[2px] bg-white rounded-full" />
                    </button>
                  )}

                  <div>
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center mb-4 border transition-colors duration-300 select-none"
                      style={{ 
                        backgroundColor: `${borderAccentColor}10`,
                        borderColor: `${borderAccentColor}25`,
                        color: borderAccentColor
                      }}
                    >
                      <CategoryIcon name={iconName} className="w-5 h-5" />
                    </div>
                    
                    <div className="flex items-center gap-1.5 mb-2">
                      <h3 className="font-outfit text-xs font-bold text-neutral-900 dark:text-neutral-100 line-clamp-2 leading-snug">
                        {art.title}
                      </h3>
                    </div>

                    <p className="text-neutral-500 dark:text-neutral-400 text-[10px] line-clamp-2 leading-relaxed font-light">
                      {art.summary || 'Краткое содержание статьи отсутствует.'}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center gap-2 select-none">
                      <span className="text-[8px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wider bg-neutral-100 dark:bg-neutral-900 px-1.5 py-0.5 rounded font-mono">
                        {art.views || 0} просм.
                      </span>
                      {isHidden && (
                        <span className="text-[8px] font-bold text-red-500 bg-red-500/10 px-1 py-0.5 rounded uppercase tracking-wider border border-red-500/20 flex items-center gap-0.5 select-none font-mono">
                          Скрыто
                        </span>
                      )}
                    </div>
                    
                    {isEditMode && (
                      <div className="flex items-center gap-1.5 z-20 select-none">
                        <button
                          onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleMoveGlobal('left', art.id);
                          }}
                          disabled={allArticles.findIndex(a => a.id === art.id) === 0}
                          className="p-1 rounded bg-neutral-100 dark:bg-neutral-900 text-neutral-550 disabled:opacity-30 cursor-pointer"
                        >
                          <ChevronLeft className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleMoveGlobal('right', art.id);
                          }}
                          disabled={allArticles.findIndex(a => a.id === art.id) === allArticles.length - 1}
                          className="p-1 rounded bg-neutral-100 dark:bg-neutral-900 text-neutral-550 disabled:opacity-30 cursor-pointer"
                        >
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {!isEditMode && !isConfigureMode && (
                      <Link
                        to={`/articles/${art.slug}`}
                        className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 flex items-center gap-1 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all"
                      >
                        Читать <ChevronRight className="w-3 h-3 shrink-0" />
                      </Link>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>

      </section>

      {/* POPUP: Add to Favorites Search Dialog */}
      <AnimatePresence>
        {isAddFavModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-850 bg-white dark:bg-neutral-950 shadow-2xl flex flex-col max-h-[80vh]"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-900 p-4 shrink-0">
                <h3 className="font-outfit text-base font-extrabold text-neutral-900 dark:text-white flex items-center gap-2">
                  <Star className="w-4 h-4 text-indigo-500" />
                  <span>Добавить статью в быстрый доступ</span>
                </h3>
                <button 
                  onClick={() => { setIsAddFavModalOpen(false); setFavSearchQuery(''); }}
                  className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-900/60 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search input */}
              <div className="p-4 border-b border-neutral-150 dark:border-neutral-900 pl-5 shrink-0 bg-neutral-50/50 dark:bg-neutral-950/20">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-450" />
                  <input
                    type="text"
                    placeholder="Поиск по названию или содержимому..."
                    value={favSearchQuery}
                    onChange={(e) => setFavSearchQuery(e.target.value)}
                    className="w-full text-xs pl-9 pr-4 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Articles list */}
              <div className="flex-1 overflow-y-auto p-4 max-h-[40vh] divide-y divide-neutral-100 dark:divide-neutral-900">
                {searchResultsForFavs.length === 0 ? (
                  <div className="text-center py-10 text-xs text-neutral-400">
                    Статей для добавления не найдено.
                  </div>
                ) : (
                  searchResultsForFavs.map((art) => (
                    <div 
                      key={art.id} 
                      onClick={() => handleAddToFavorites(art)}
                      className="flex items-center justify-between py-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-900/50 px-2 rounded-lg transition-colors cursor-pointer group"
                    >
                      <div className="min-w-0 pr-4">
                        <div className="text-xs font-bold text-neutral-800 dark:text-neutral-250 group-hover:text-indigo-500 transition-colors line-clamp-1">{art.title}</div>
                        <div className="text-[10px] text-neutral-450 mt-0.5 line-clamp-1">{art.summary}</div>
                      </div>
                      <button
                        className="px-2.5 py-1 text-[10px] font-bold text-indigo-600 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-md transition-colors cursor-pointer shrink-0"
                      >
                        Выбрать
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-neutral-100 dark:border-neutral-900 flex justify-end shrink-0 bg-neutral-50/50 dark:bg-neutral-950/20">
                <button
                  onClick={() => { setIsAddFavModalOpen(false); setFavSearchQuery(''); }}
                  className="px-4 py-2 border border-neutral-200 dark:border-neutral-850 hover:bg-neutral-50 dark:hover:bg-neutral-900 text-neutral-700 dark:text-neutral-300 rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                >
                  Отмена
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'только что';
  if (diffMins < 60) {
    if (diffMins === 1) return '1 минуту назад';
    if (diffMins % 10 === 1 && diffMins !== 11) return `${diffMins} минуту назад`;
    if ([2, 3, 4].includes(diffMins % 10) && ![12, 13, 14].includes(diffMins)) return `${diffMins} минуты назад`;
    return `${diffMins} минут назад`;
  }
  if (diffHours < 24) {
    if (diffHours === 1) return '1 час назад';
    if (diffHours % 10 === 1 && diffHours !== 11) return `${diffHours} час назад`;
    if ([2, 3, 4].includes(diffHours % 10) && ![12, 13, 14].includes(diffHours)) return `${diffHours} часа назад`;
    return `${diffHours} часов назад`;
  }
  if (diffDays === 1) return 'вчера';
  if (diffDays === 2) return '2 дня назад';
  if (diffDays % 10 === 1 && diffDays !== 11) return `${diffDays} день назад`;
  if ([2, 3, 4].includes(diffDays % 10) && ![12, 13, 14].includes(diffDays)) return `${diffDays} дня назад`;
  return `${diffDays} дней назад`;
}

