import * as React from 'react';
import { Link } from 'react-router-dom';
import { Search, Sparkles, Clock, ChevronRight, BookOpen, Edit3, Check, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchCategories, fetchArticles, updateCategory, reorderCategories, Category, Article } from '../lib/api';
import { CategoryIcon } from '../components/icon';
import { SearchModal } from '../components/search-modal';
import { useAuth } from '../lib/auth-context';
import AddSectionModal from '../components/add-section-modal';

export default function Home() {
  const { user } = useAuth();
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [recentArticles, setRecentArticles] = React.useState<Article[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Edit Mode States
  const [isEditMode, setIsEditMode] = React.useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
  const [draggedId, setDraggedId] = React.useState<number | null>(null);

  const loadData = React.useCallback(async () => {
    try {
      const [cats, arts] = await Promise.all([
        fetchCategories(),
        fetchArticles(),
      ]);
      setCategories(cats);
      setRecentArticles(arts.slice(0, 3));
    } catch (error) {
      console.error('Home data load failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const getArticlePlural = (count: number) => {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return 'статья';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'статьи';
    return 'статей';
  };

  // Drag and Drop Handlers for Categories
  const handleDragStart = (e: React.DragEvent, id: number) => {
    if (!isEditMode) return;
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id.toString());
  };

  const handleDragOver = (e: React.DragEvent, id: number) => {
    if (!isEditMode) return;
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetId: number) => {
    if (!isEditMode || draggedId === null || draggedId === targetId) return;

    const draggedIdx = categories.findIndex(c => c.id === draggedId);
    const targetIdx = categories.findIndex(c => c.id === targetId);

    if (draggedIdx !== -1 && targetIdx !== -1) {
      const updated = [...categories];
      const [draggedItem] = updated.splice(draggedIdx, 1);
      updated.splice(targetIdx, 0, draggedItem);

      // Re-assign positions sequentially
      const reordered = updated.map((cat, index) => ({
        ...cat,
        position: index + 1
      }));

      setCategories(reordered);

      try {
        const payload = reordered.map(c => ({ id: c.id, position: c.position }));
        await reorderCategories(payload);
      } catch (err) {
        console.error('Failed to save category order:', err);
      }
    }
  };

  const handleDragEnd = () => {
    setDraggedId(null);
  };

  // Archive / Soft Delete Category (sets is_visible = false)
  const handleArchiveCategory = async (e: React.MouseEvent, cat: Category) => {
    e.preventDefault();
    e.stopPropagation();

    const confirmed = window.confirm(`Вы уверены, что хотите скрыть раздел "${cat.name}"? Раздел пропадет с экрана навигации, но его можно будет восстановить из архива в админ-панели.`);
    if (!confirmed) return;

    try {
      await updateCategory(cat.id, {
        name: cat.name,
        slug: cat.slug,
        icon: cat.icon || 'layout',
        description: cat.description || '',
        position: cat.position || 0,
        is_visible: false,
        color: cat.color || '#6366f1',
      });
      await loadData();
    } catch (err) {
      console.error('Failed to archive category:', err);
      alert('Ошибка при скрытии раздела.');
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08 },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 100 } },
  };

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

  const canEdit = user && (user.role === 'Admin' || user.role === 'Editor');

  return (
    <div className="relative min-h-screen pb-20 overflow-hidden">
      
      {/* Decorative Blurs */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[400px] pointer-events-none -z-10 opacity-70 dark:opacity-30">
        <div className="absolute top-[-10%] left-[20%] w-[350px] h-[350px] rounded-full bg-indigo-400 dark:bg-indigo-900/40 blur-[120px]" />
        <div className="absolute top-[10%] right-[20%] w-[300px] h-[300px] rounded-full bg-violet-400 dark:bg-violet-900/30 blur-[100px]" />
      </div>

      {/* Hero Header */}
      <section className="max-w-4xl mx-auto px-3 sm:px-4 pt-10 sm:pt-20 pb-8 sm:pb-12 text-center">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-indigo-500/10 dark:border-indigo-400/20 bg-indigo-500/5 text-indigo-600 dark:text-indigo-400 text-xs font-semibold mb-6 shadow-sm shadow-indigo-500/5"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>SaaS Документация 2026</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="font-outfit text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-4 sm:mb-6 bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-700 dark:from-white dark:via-neutral-100 dark:to-neutral-400 bg-clip-text text-transparent"
        >
          Документация, <br className="sm:hidden" />
          быстрая и совершенная.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="text-neutral-500 dark:text-neutral-400 text-sm sm:text-base md:text-lg lg:text-xl max-w-2xl mx-auto mb-6 sm:mb-8 font-light leading-relaxed"
        >
          Минималистичный справочник с моментальным автозаполнением, исправлением опечаток и красивым форматированием в стиле Notion.
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

      {/* Categories Bento Grid */}
      <section className="max-w-5xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <div className="flex items-center justify-between mb-6 px-1">
          <motion.h2 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="font-outfit text-sm font-bold tracking-wider text-neutral-400 uppercase select-none"
          >
            Разделы документации
          </motion.h2>

          {/* Edit Mode Toggle Button */}
          {canEdit && (
            <button
              onClick={() => setIsEditMode(prev => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer shadow-sm ${
                isEditMode
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-450 hover:bg-emerald-500/20'
                  : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20'
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

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {categories.map((cat) => {
            const isBeingDragged = cat.id === draggedId;
            const borderAccentColor = cat.color || '#6366f1';
            
            return (
              <motion.div
                key={cat.id}
                variants={itemVariants}
                whileHover={!isEditMode ? { y: -3, scale: 1.01 } : undefined}
                draggable={isEditMode}
                onDragStart={(e) => handleDragStart(e as any, cat.id)}
                onDragOver={(e) => handleDragOver(e, cat.id)}
                onDrop={(e) => handleDrop(e, cat.id)}
                onDragEnd={handleDragEnd}
                onClick={(e) => isEditMode && e.preventDefault()}
                style={{ 
                  borderColor: isEditMode ? borderAccentColor : undefined,
                  boxShadow: isEditMode ? `0 0 10px ${borderAccentColor}18` : undefined
                }}
                className={`group relative flex flex-col justify-between p-5 rounded-xl border bg-white dark:bg-neutral-950 transition-all duration-300 ${
                  isEditMode 
                    ? 'border-2 cursor-grab active:cursor-grabbing hover:scale-[1.01]' 
                    : 'border-neutral-200/60 dark:border-neutral-800 hover:border-indigo-500/20 dark:hover:border-indigo-500/20 hover:shadow-glow dark:hover:shadow-glow'
                } ${isBeingDragged ? 'opacity-40 border-dashed scale-95' : ''} shadow-premium dark:shadow-premium-dark`}
              >
                {/* iPhone-like red deletion button */}
                {isEditMode && (
                  <button
                    onClick={(e) => handleArchiveCategory(e, cat)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center cursor-pointer shadow-md hover:scale-110 active:scale-95 transition-all z-20 border border-white dark:border-neutral-950"
                    title="Скрыть раздел"
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
                    <CategoryIcon name={cat.icon} className="w-5 h-5" />
                  </div>
                  <h3 className="font-outfit text-base font-bold text-neutral-900 dark:text-neutral-100 mb-2">
                    {cat.name}
                  </h3>
                  <p className="text-neutral-500 dark:text-neutral-400 text-xs line-clamp-2 leading-relaxed font-light">
                    {cat.description}
                  </p>
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <span className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wider bg-neutral-100 dark:bg-neutral-900/60 px-2 py-0.5 rounded">
                    {cat.article_count || 0} {getArticlePlural(cat.article_count || 0)}
                  </span>
                  
                  {!isEditMode && (
                    <Link
                      to={`/categories/${cat.slug}`}
                      className="text-xs font-semibold text-indigo-500 dark:text-indigo-400 flex items-center gap-1 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all"
                    >
                      Перейти <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
              </motion.div>
            );
          })}

          {/* Dotted Plus Slot for adding new section (Edit Mode only) */}
          {isEditMode && (
            <motion.div
              whileHover={{ scale: 1.01, y: -2 }}
              onClick={() => setIsAddModalOpen(true)}
              className="group cursor-pointer flex flex-col items-center justify-center p-5 rounded-xl border-2 border-dashed border-indigo-500/40 bg-indigo-500/[0.01] hover:bg-indigo-500/[0.04] hover:border-indigo-500/80 transition-all duration-300 min-h-[160px] shadow-sm select-none"
            >
              <Plus className="w-8 h-8 text-indigo-500/60 group-hover:text-indigo-500 transition-colors animate-pulse" />
              <span className="text-[11px] font-bold text-indigo-500/65 group-hover:text-indigo-500 uppercase tracking-wider mt-2">
                Добавить раздел
              </span>
            </motion.div>
          )}
        </motion.div>
      </section>

      {/* Recent Articles */}
      {recentArticles.length > 0 && !isEditMode && (
        <section className="max-w-3xl mx-auto px-4 py-12">
          <div className="flex items-center gap-2 mb-6 border-b border-neutral-200/50 dark:border-neutral-800 pb-3">
            <Clock className="w-4 h-4 text-neutral-400" />
            <h3 className="font-outfit text-sm font-semibold tracking-wider text-neutral-400 uppercase">
              Последние обновления
            </h3>
          </div>

          <div className="space-y-3">
            {recentArticles.map((art) => (
              <motion.div
                key={art.id}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="flex items-center justify-between p-4 rounded-xl border border-neutral-200/40 dark:border-neutral-800/40 bg-neutral-50/50 dark:bg-neutral-950/20 hover:border-neutral-200 dark:hover:border-neutral-800 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-medium uppercase tracking-wider bg-neutral-100 dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400 px-1.5 py-0.5 rounded">
                      {art.category_name}
                    </span>
                  </div>
                  <Link 
                    to={`/articles/${art.slug}`}
                    className="font-outfit text-base font-bold text-neutral-900 dark:text-neutral-100 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors line-clamp-1"
                  >
                    {art.title}
                  </Link>
                  <p className="text-neutral-500 dark:text-neutral-400 text-xs line-clamp-1 mt-1 font-light">
                    {art.summary}
                  </p>
                </div>

                <Link
                  to={`/articles/${art.slug}`}
                  className="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-900 text-neutral-400 dark:text-neutral-500 hover:text-indigo-500 dark:hover:text-indigo-400 group-hover:bg-indigo-500/10 group-hover:text-indigo-500 transition-colors ml-4 shrink-0"
                >
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Add Section Wizard Modal */}
      {isAddModalOpen && (
        <AddSectionModal 
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={loadData}
        />
      )}
    </div>
  );
}
