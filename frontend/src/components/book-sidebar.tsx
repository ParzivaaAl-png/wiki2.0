import * as React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, BookOpen, X, Search, Sparkles, Home, ShieldAlert, Plus, Check, FileText, EyeOff } from 'lucide-react';
import { fetchArticles, updateArticle, reorderArticles, Article } from '../lib/api';
import { useAuth } from '../lib/auth-context';

interface BookSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}

// Custom animated menu icon morphing variants
const line1Variants = {
  closed: { rotate: 0, y: 0, width: 20 },
  open: { rotate: 45, y: 5, width: 20 }
};

const line2Variants = {
  closed: { opacity: 1, scaleX: 1 },
  open: { opacity: 0, scaleX: 0 }
};

const line3Variants = {
  closed: { rotate: 0, y: 0, width: 14 },
  open: { rotate: -45, y: -5, width: 20 }
};

export function BookSidebar({ isOpen, onToggle, onClose }: BookSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [articles, setArticles] = React.useState<Article[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');

  // Edit Mode States
  const [isEditMode, setIsEditMode] = React.useState(false);
  const [draggedId, setDraggedId] = React.useState<number | null>(null);

  const canEdit = !!(user && (user.role === 'Admin' || user.role === 'Editor'));

  const loadData = React.useCallback(async () => {
    try {
      // Editors and Admins see drafts and hidden articles in sidebar when they edit
      const artsData = await fetchArticles({ all: canEdit });
      setArticles(artsData);
    } catch (err) {
      console.error('Failed to load BookSidebar data:', err);
    }
  }, [canEdit]);

  // Fetch articles when open
  React.useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    loadData().finally(() => setIsLoading(false));
  }, [isOpen, loadData]);

  // Reset Edit Mode when sidebar closes
  React.useEffect(() => {
    if (!isOpen) {
      setIsEditMode(false);
    }
  }, [isOpen]);

  // Filter articles based on search query
  const filteredArticles = React.useMemo(() => {
    let result = articles.filter(art => !art.slug.startsWith('auto-list-'));
    
    // For regular users, only show visible and published articles
    if (!canEdit) {
      result = result.filter(art => art.is_visible !== false && art.published);
    }

    if (!searchQuery.trim()) return result;
    const query = searchQuery.toLowerCase();
    return result.filter(art =>
      art.title.toLowerCase().includes(query) || (art.summary || '').toLowerCase().includes(query)
    );
  }, [searchQuery, articles, canEdit]);

  // Determine active article from URL
  const activeArticleSlug = React.useMemo(() => {
    const match = location.pathname.match(/^\/articles\/([^/]+)/);
    return match ? match[1] : null;
  }, [location.pathname]);

  // Close on ESC key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent scroll propagation
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Drag and Drop Handlers
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

    const draggedIdx = articles.findIndex(a => a.id === draggedId);
    const targetIdx = articles.findIndex(a => a.id === targetId);

    if (draggedIdx !== -1 && targetIdx !== -1) {
      const updated = [...articles];
      const [draggedItem] = updated.splice(draggedIdx, 1);
      updated.splice(targetIdx, 0, draggedItem);

      const reordered = updated.map((art, index) => ({
        ...art,
        position: index + 1
      }));

      setArticles(reordered);

      try {
        const payload = reordered.map(a => ({ id: a.id, position: a.position }));
        await reorderArticles(payload);
      } catch (err) {
        console.error('Failed to save article order in sidebar:', err);
      }
    }
  };

  const handleDragEnd = () => {
    setDraggedId(null);
  };

  // Archive / Soft Delete Article (sets is_visible = false)
  const handleArchiveArticle = async (e: React.MouseEvent, art: Article) => {
    e.preventDefault();
    e.stopPropagation();

    const confirmed = window.confirm(`Вы уверены, что хотите скрыть статью "${art.title}"? Статья будет перемещена в архив.`);
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
      console.error('Failed to archive article from sidebar:', err);
    }
  };

  // Framer Motion variants for lists
  const listContainerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.03 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: { 
      opacity: 1, 
      x: 0,
      transition: { type: 'spring', stiffness: 150, damping: 18 }
    }
  };

  return (
    <>
      {/* 1. FIXED LEFT STRIP (56px) - Always visible for logged-in users */}
      <div 
        className="fixed left-0 top-0 h-screen w-14 bg-neutral-50 dark:bg-neutral-950 border-r border-neutral-200/50 dark:border-neutral-850/50 z-50 flex flex-col items-center py-4 shrink-0 shadow-sm"
      >
        {/* Custom Animated Burger Button */}
        <button
          onClick={onToggle}
          className="w-10 h-10 flex flex-col justify-center items-center rounded-xl text-indigo-500 bg-indigo-500/10 dark:bg-indigo-500/5 hover:bg-indigo-500/20 dark:hover:bg-indigo-500/15 border border-indigo-500/20 dark:border-indigo-500/10 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-sm relative group"
          aria-label="Toggle navigation menu"
        >
          <div className="w-5 h-[12px] relative flex items-center justify-center">
            <motion.span 
              variants={line1Variants} 
              animate={isOpen ? "open" : "closed"}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className="absolute top-0 left-0 h-[2px] bg-indigo-500 dark:bg-indigo-400 rounded-full origin-center" 
            />
            <motion.span 
              variants={line2Variants} 
              animate={isOpen ? "open" : "closed"}
              transition={{ duration: 0.2 }}
              className="absolute top-[5px] left-0 h-[2px] bg-indigo-500 dark:bg-indigo-400 rounded-full origin-center" 
            />
            <motion.span 
              variants={line3Variants} 
              animate={isOpen ? "open" : "closed"}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className="absolute top-[10px] left-0 h-[2px] bg-indigo-500 dark:bg-indigo-400 rounded-full origin-center" 
            />
          </div>
        </button>

        {/* Minimalist Version Stamp at the bottom */}
        <div className="pb-4 mt-auto text-[9px] font-bold font-mono tracking-widest text-neutral-400 dark:text-neutral-600 select-none">
          V2
        </div>
      </div>

      {/* 2. BACKDROP OVERLAY */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-neutral-950/20 dark:bg-black/40 backdrop-blur-sm z-30"
          />
        )}
      </AnimatePresence>

      {/* 3. SLIDE-OUT DRAWER PANEL */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="fixed left-14 top-0 h-screen w-[290px] bg-neutral-100/90 dark:bg-neutral-900/90 backdrop-blur-xl border-r border-neutral-200/50 dark:border-neutral-800/55 shadow-2xl flex flex-col z-40 overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 border-b border-neutral-200/40 dark:border-neutral-800/40 flex items-center justify-between pl-6 shrink-0">
              <div className="flex items-center gap-2 text-indigo-500 font-semibold tracking-tight text-sm uppercase">
                <BookOpen className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                <span className="font-outfit font-bold text-neutral-800 dark:text-neutral-200">Навигация</span>
              </div>
              
              {/* Edit Mode Toggle Button inside Sidebar */}
              {canEdit && (
                <button
                  onClick={() => setIsEditMode(prev => !prev)}
                  className={`px-2 py-1 rounded-lg border text-[10px] font-bold uppercase transition-all shadow-sm cursor-pointer ${
                    isEditMode
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                      : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400'
                  }`}
                >
                  {isEditMode ? 'Готово' : 'Правка'}
                </button>
              )}
            </div>

            {/* Quick Search */}
            <div className="px-4 pt-4 pb-2 shrink-0 pl-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Поиск статей..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={isEditMode}
                  className="w-full pl-9 pr-4 py-2 text-xs bg-white/60 dark:bg-neutral-950/60 border border-neutral-200/60 dark:border-neutral-850 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder-neutral-400 dark:placeholder-neutral-500 text-neutral-800 dark:text-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* Quick Links Section */}
            {!isEditMode && (
              <>
                <div className="px-4 py-2 shrink-0 pl-6 space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-450 dark:text-neutral-500 px-3 mb-1.5 select-none">
                    Быстрые ссылки
                  </div>
                  <Link
                    to="/"
                    onClick={onClose}
                    className="group flex items-center gap-3 px-3 py-2 rounded-xl text-xs text-neutral-700 dark:text-neutral-300 hover:bg-white/50 dark:hover:bg-neutral-950/30 hover:text-neutral-950 dark:hover:text-white border border-transparent hover:translate-x-0.5 hover:scale-[1.01] transition-all"
                  >
                    <div className="w-6 h-6 rounded-lg bg-white/65 dark:bg-neutral-950/60 text-neutral-500 dark:text-neutral-400 group-hover:bg-indigo-500/10 group-hover:text-indigo-500 flex items-center justify-center transition-colors">
                      <Home className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-semibold">Главный экран</span>
                  </Link>
                  {user && user.role !== 'User' && (
                    <Link
                      to="/admin"
                      onClick={onClose}
                      className="group flex items-center gap-3 px-3 py-2 rounded-xl text-xs text-neutral-700 dark:text-neutral-300 hover:bg-white/50 dark:hover:bg-neutral-950/30 hover:text-neutral-950 dark:hover:text-white border border-transparent hover:translate-x-0.5 hover:scale-[1.01] transition-all"
                    >
                      <div className="w-6 h-6 rounded-lg bg-white/65 dark:bg-neutral-950/60 text-neutral-500 dark:text-neutral-400 group-hover:bg-indigo-500/10 group-hover:text-indigo-500 flex items-center justify-center transition-colors">
                        <ShieldAlert className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-semibold">Панель управления</span>
                    </Link>
                  )}
                </div>
                <div className="mx-6 my-2 border-b border-neutral-200/30 dark:border-neutral-800/30 shrink-0" />
              </>
            )}

            {/* Articles List */}
            <div className="flex-1 overflow-y-auto px-4 py-3 pl-6 custom-scrollbar">
              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-450 dark:text-neutral-500 px-3 mb-2 select-none">
                {isEditMode ? 'Режим редактирования' : 'Статьи базы знаний'}
              </div>
              
              {isLoading ? (
                <div className="flex flex-col gap-3 py-2 animate-pulse">
                  {[1, 2, 3, 4, 5, 6].map(n => (
                    <div key={n} className="h-10 bg-neutral-200 dark:bg-neutral-800/60 rounded-xl" />
                  ))}
                </div>
              ) : filteredArticles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Sparkles className="w-8 h-8 text-neutral-300 dark:text-neutral-700 mb-3 animate-pulse" />
                  <p className="text-xs font-medium text-neutral-400 dark:text-neutral-500">Статей не найдено</p>
                </div>
              ) : (
                <motion.nav 
                  variants={listContainerVariants}
                  initial="hidden"
                  animate="visible"
                  className="space-y-1.5"
                >
                  {filteredArticles.map((art) => {
                    const isActive = activeArticleSlug === art.slug;
                    const isBeingDragged = art.id === draggedId;
                    const isHidden = art.is_visible === false;
                    const isDraft = !art.published;
                    
                    return (
                      <motion.div 
                        key={art.id} 
                        variants={itemVariants}
                        draggable={isEditMode}
                        onDragStart={(e) => handleDragStart(e as any, art.id)}
                        onDragOver={(e) => handleDragOver(e, art.id)}
                        onDrop={(e) => handleDrop(e, art.id)}
                        onDragEnd={handleDragEnd}
                        className={isBeingDragged ? 'opacity-40 scale-95 border-dashed' : ''}
                      >
                        <Link
                          to={isEditMode ? '#' : `/articles/${art.slug}`}
                          onClick={(e) => {
                            if (isEditMode) {
                              e.preventDefault();
                              e.stopPropagation();
                            } else {
                              onClose();
                            }
                          }}
                          className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all border ${
                            isEditMode
                              ? 'border-neutral-300 dark:border-neutral-800 hover:border-indigo-500/40 bg-white/40 dark:bg-neutral-900/40 cursor-grab active:cursor-grabbing hover:scale-[1.01]'
                              : isActive
                                ? 'bg-indigo-500/10 dark:bg-indigo-500/10 border-indigo-500/20 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-semibold shadow-sm'
                                : 'text-neutral-700 dark:text-neutral-300 hover:bg-white/50 dark:hover:bg-neutral-950/30 hover:text-neutral-950 dark:hover:text-white border-transparent hover:translate-x-0.5 hover:scale-[1.01]'
                          } ${isHidden || isDraft ? 'opacity-60' : ''}`}
                        >
                          {/* Active indicator */}
                          {!isEditMode && (
                            <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-indigo-500 rounded-r-md transition-all ${
                              isActive ? 'opacity-100 scale-y-100' : 'opacity-0 scale-y-50 group-hover:opacity-60 group-hover:scale-y-100'
                            }`} />
                          )}

                          {/* iPhone-like red deletion button on left of icon */}
                          {isEditMode && (
                            <button
                              onClick={(e) => handleArchiveArticle(e, art)}
                              className="w-5 h-5 rounded-full bg-red-500 hover:bg-red-650 text-white flex items-center justify-center cursor-pointer shrink-0 shadow-sm border border-white dark:border-neutral-900 active:scale-90 transition-transform z-10"
                              title="Скрыть статью"
                            >
                              <span className="w-2 h-[2px] bg-white rounded-full" />
                            </button>
                          )}

                          {/* Article File Icon */}
                          <div className="w-7 h-7 rounded-lg bg-neutral-200/50 dark:bg-neutral-800/50 text-neutral-500 dark:text-neutral-450 flex items-center justify-center shrink-0 border border-neutral-200/30 dark:border-neutral-800/30">
                            {isHidden ? (
                              <EyeOff className="w-3.5 h-3.5 text-neutral-400" />
                            ) : (
                              <FileText className="w-3.5 h-3.5" />
                            )}
                          </div>

                          {/* Article Title */}
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-xs truncate flex items-center gap-1.5">
                              <span>{art.title}</span>
                              {isDraft && (
                                <span className="text-[8px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1 rounded scale-90">
                                  Черновик
                                </span>
                              )}
                            </div>
                          </div>

                          {!isEditMode && (
                            <ChevronRight className={`w-3.5 h-3.5 transition-transform shrink-0 ${
                              isActive ? 'text-indigo-500' : 'text-neutral-300 dark:text-neutral-600 group-hover:text-neutral-500 group-hover:translate-x-0.5'
                            }`} />
                          )}
                        </Link>
                      </motion.div>
                    );
                  })}
                  
                  {/* Dashed Plus Slot for adding new Article in Sidebar (Edit Mode only) */}
                  {isEditMode && (
                    <motion.div
                      whileHover={{ scale: 1.01, x: 2 }}
                      onClick={() => {
                        onClose();
                        navigate('/admin/editor/new');
                      }}
                      className="group cursor-pointer flex items-center justify-center gap-2 p-2.5 rounded-xl border-2 border-dashed border-indigo-500/40 bg-indigo-500/[0.01] hover:bg-indigo-500/[0.04] hover:border-indigo-500/80 transition-all select-none"
                    >
                      <Plus className="w-4 h-4 text-indigo-500/65 group-hover:text-indigo-500 transition-colors animate-pulse" />
                      <span className="text-[11px] font-bold text-indigo-500/65 group-hover:text-indigo-500 uppercase tracking-wider">
                        Добавить статью
                      </span>
                    </motion.div>
                  )}
                </motion.nav>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 pl-6 border-t border-neutral-200/40 dark:border-neutral-800/40 bg-neutral-200/20 dark:bg-neutral-950/20 text-center shrink-0">
              <span className="text-[9px] text-neutral-400 dark:text-neutral-555 font-semibold tracking-wider">Wiki 2.0 • Справочник</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
