import * as React from 'react';
import { Link } from 'react-router-dom';
import { Search, Sparkles, Clock, ChevronRight, BookOpen, Check, Plus, Star, X, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  fetchArticles, 
  updateArticle, 
  reorderArticles, 
  fetchFavoriteArticles, 
  saveFavoriteArticles, 
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
  const [favoriteArticles, setFavoriteArticles] = React.useState<Article[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Filter Tab State: 'favorites' | 'new' | 'popular' | 'recent'
  const [filterTab, setFilterTab] = React.useState<'favorites' | 'new' | 'popular' | 'recent'>('favorites');

  // Customization States (Personal Favorites)
  const [isConfigureMode, setIsConfigureMode] = React.useState(false);
  const [isAddFavModalOpen, setIsAddFavModalOpen] = React.useState(false);
  const [favSearchQuery, setFavSearchQuery] = React.useState('');

  // Global Edit Mode States (Editor / Admin only)
  const [isEditMode, setIsEditMode] = React.useState(false);
  const [draggedId, setDraggedId] = React.useState<number | null>(null);

  const loadData = React.useCallback(async () => {
    try {
      const isStaff = user && (user.role === 'Admin' || user.role === 'Editor');
      // Fetch all articles (including hidden/archived if Editor/Admin)
      const arts = await fetchArticles({ all: isStaff ? true : false });
      setAllArticles(arts);

      if (user) {
        const favs = await fetchFavoriteArticles();
        setFavoriteArticles(favs);
      } else {
        setFavoriteArticles([]);
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

    if (filterTab === 'favorites') {
      // If user has set favorites, show them. Otherwise show first 4 articles.
      if (favoriteArticles.length > 0) return favoriteArticles.slice(0, 4);
      return allArticles.filter(a => a.is_visible !== false && a.published).slice(0, 4);
    }

    const visibleArticles = allArticles.filter(a => a.is_visible !== false && a.published);

    if (filterTab === 'new') {
      return [...visibleArticles]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 4);
    }

    if (filterTab === 'popular') {
      return [...visibleArticles]
        .sort((a, b) => (b.views || 0) - (a.views || 0))
        .slice(0, 4);
    }

    if (filterTab === 'recent') {
      return [...visibleArticles]
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 4);
    }

    return visibleArticles.slice(0, 4);
  }, [filterTab, allArticles, favoriteArticles, isEditMode]);

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
  const handleRemoveFromFavorites = async (e: React.MouseEvent, artId: number) => {
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
  const handleArchiveArticle = async (e: React.MouseEvent, art: Article) => {
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-12">
          {[1, 2, 3, 4].map((i) => (
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

      {/* FILTER TABS SELECTOR */}
      <section className="max-w-5xl mx-auto px-4 mb-4 mt-6 flex justify-center">
        <div className="flex bg-neutral-150/70 dark:bg-neutral-900/60 p-1.5 rounded-xl border border-neutral-200/40 dark:border-neutral-800/40 shadow-sm gap-1">
          <button
            onClick={() => setFilterTab('favorites')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              filterTab === 'favorites' && !isEditMode
                ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/10'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Star className="w-3.5 h-3.5 shrink-0" />
            <span>Быстрый доступ</span>
          </button>
          
          <button
            onClick={() => setFilterTab('new')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filterTab === 'new' && !isEditMode
                ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/10'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            Новые
          </button>

          <button
            onClick={() => setFilterTab('popular')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filterTab === 'popular' && !isEditMode
                ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/10'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            Популярные
          </button>

          <button
            onClick={() => setFilterTab('recent')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filterTab === 'recent' && !isEditMode
                ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/10'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            Актуальные
          </button>
        </div>
      </section>

      {/* Main Articles Grid Section */}
      <section className="max-w-5xl mx-auto px-3 sm:px-4 py-6">
        <div className="flex items-center justify-between mb-6 px-1">
          <motion.h2 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="font-outfit text-sm font-bold tracking-wider text-neutral-400 uppercase select-none"
          >
            {isEditMode 
              ? 'Все статьи базы знаний (Режим редактирования)'
              : filterTab === 'favorites' 
                ? 'Мои избранные статьи' 
                : filterTab === 'new' 
                  ? 'Последние созданные статьи' 
                  : filterTab === 'popular' 
                    ? 'Самые читаемые статьи' 
                    : 'Недавно обновлённые статьи'
            }
          </motion.h2>

          <div className="flex items-center gap-2">
            {/* Configure Mode Toggle for users (Favorites List ONLY) */}
            {user && filterTab === 'favorites' && !isEditMode && (
              <button
                onClick={() => setIsConfigureMode(prev => !prev)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer shadow-sm ${
                  isConfigureMode
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-450'
                    : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20'
                }`}
              >
                {isConfigureMode ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Готово</span>
                  </>
                ) : (
                  <>
                    <span>✏️ Настроить</span>
                  </>
                )}
              </button>
            )}

            {/* Global Edit Mode Toggle for Admins/Editors */}
            {isStaff && !isConfigureMode && (
              <button
                onClick={() => setIsEditMode(prev => !prev)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer shadow-sm ${
                  isEditMode
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-450 hover:bg-emerald-500/20'
                    : 'bg-violet-500/10 border-violet-500/20 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20'
                }`}
              >
                {isEditMode ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Готово</span>
                  </>
                ) : (
                  <>
                    <span>✏️ Редактировать</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Bento Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
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
                draggable={isEditMode || isConfigureMode}
                onDragStart={(e) => isEditMode ? handleGlobalDragStart(e as any, art.id) : handleFavDragStart(e as any, art.id)}
                onDragOver={(e) => handleDragOver(e, art.id)}
                onDrop={(e) => isEditMode ? handleGlobalDrop(e, art.id) : handleFavDrop(e, art.id)}
                onDragEnd={handleDragEnd}
                onClick={(e) => (isEditMode || isConfigureMode) && e.preventDefault()}
                style={{ 
                  borderColor: (isEditMode || isConfigureMode) ? borderAccentColor : undefined,
                  boxShadow: (isEditMode || isConfigureMode) ? `0 0 10px ${borderAccentColor}18` : undefined
                }}
                className={`group relative flex flex-col justify-between p-5 rounded-xl border bg-white dark:bg-neutral-950 transition-all duration-300 ${
                  (isEditMode || isConfigureMode) 
                    ? 'border-2 cursor-grab active:cursor-grabbing hover:scale-[1.01]' 
                    : 'border-neutral-200/60 dark:border-neutral-800 hover:border-indigo-500/20 dark:hover:border-indigo-500/20 hover:shadow-glow dark:hover:shadow-glow'
                } ${isBeingDragged ? 'opacity-40 border-dashed scale-95' : ''} ${isHidden ? 'opacity-65' : ''} shadow-premium dark:shadow-premium-dark`}
              >
                {/* Personalize Favorites deletion button */}
                {isConfigureMode && (
                  <button
                    onClick={(e) => handleRemoveFromFavorites(e, art.id)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 hover:bg-red-650 text-white flex items-center justify-center cursor-pointer shadow-md hover:scale-110 active:scale-95 transition-all z-20 border border-white dark:border-neutral-950"
                    title="Убрать из быстрого доступа"
                  >
                    <span className="w-2.5 h-[2px] bg-white rounded-full" />
                  </button>
                )}

                {/* Global editor archiving button */}
                {isEditMode && (
                  <button
                    onClick={(e) => handleArchiveArticle(e, art)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 hover:bg-red-650 text-white flex items-center justify-center cursor-pointer shadow-md hover:scale-110 active:scale-95 transition-all z-20 border border-white dark:border-neutral-950"
                    title="Скрыть статью в архив"
                  >
                    <span className="w-2.5 h-[2px] bg-white rounded-full" />
                  </button>
                )}

                <div>
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center mb-4 border transition-colors duration-300"
                    style={{ 
                      backgroundColor: `${borderAccentColor}10`,
                      borderColor: `${borderAccentColor}25`,
                      color: borderAccentColor
                    }}
                  >
                    <CategoryIcon name={iconName} className="w-5 h-5" />
                  </div>
                  
                  <div className="flex items-center gap-1.5 mb-2">
                    <h3 className="font-outfit text-base font-bold text-neutral-900 dark:text-neutral-100 line-clamp-2 leading-snug">
                      {art.title}
                    </h3>
                  </div>

                  <p className="text-neutral-500 dark:text-neutral-400 text-xs line-clamp-2 leading-relaxed font-light">
                    {art.summary || 'Краткое содержание статьи отсутствует.'}
                  </p>
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wider bg-neutral-100 dark:bg-neutral-900/60 px-1.5 py-0.5 rounded">
                      {art.views || 0} просм.
                    </span>
                    {isHidden && (
                      <span className="text-[8px] font-bold text-red-500 bg-red-500/10 px-1 py-0.5 rounded uppercase tracking-wider border border-red-500/20 flex items-center gap-0.5 select-none">
                        <EyeOff className="w-2 h-2" /> Скрыто
                      </span>
                    )}
                  </div>
                  
                  {!isEditMode && !isConfigureMode && (
                    <Link
                      to={`/articles/${art.slug}`}
                      className="text-xs font-semibold text-indigo-500 dark:text-indigo-400 flex items-center gap-1 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all"
                    >
                      Читать <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
              </motion.div>
            );
          })}

          {/* Dotted Plus Slot for adding article to Personal Favorites (Configure Mode only) */}
          {isConfigureMode && favoriteArticles.length < 4 && (
            <motion.div
              whileHover={{ scale: 1.01, y: -2 }}
              onClick={() => setIsAddFavModalOpen(true)}
              className="group cursor-pointer flex flex-col items-center justify-center p-5 rounded-xl border-2 border-dashed border-indigo-500/40 bg-indigo-500/[0.01] hover:bg-indigo-500/[0.04] hover:border-indigo-500/80 transition-all duration-300 min-h-[160px] shadow-sm select-none"
            >
              <Plus className="w-8 h-8 text-indigo-500/60 group-hover:text-indigo-500 transition-colors animate-pulse" />
              <span className="text-[11px] font-bold text-indigo-500/65 group-hover:text-indigo-500 uppercase tracking-wider mt-2">
                Добавить статью
              </span>
            </motion.div>
          )}
        </motion.div>
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
                        className="px-2.5 py-1 text-[10px] font-bold text-indigo-650 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-md transition-colors cursor-pointer shrink-0"
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
