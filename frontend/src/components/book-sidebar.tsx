import * as React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, BookOpen, X, Search, Sparkles, Home, ShieldAlert, Plus, Edit2, Check } from 'lucide-react';
import { fetchCategories, updateCategory, reorderCategories, Category } from '../lib/api';
import { CategoryIcon } from './icon';
import { useAuth } from '../lib/auth-context';
import AddSectionModal from './add-section-modal';

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
  const { user } = useAuth();
  
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');

  // Edit Mode States
  const [isEditMode, setIsEditMode] = React.useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
  const [draggedId, setDraggedId] = React.useState<number | null>(null);

  const loadData = React.useCallback(async () => {
    try {
      const catsData = await fetchCategories();
      setCategories(catsData);
    } catch (err) {
      console.error('Failed to load BookSidebar data:', err);
    }
  }, []);

  // Fetch categories when open
  React.useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    loadData().finally(() => setIsLoading(false));
  }, [isOpen, loadData]);

  // Reset Edit Mode when sidebar closes
  React.useEffect(() => {
    if (!isOpen) {
      setIsEditMode(false);
      setIsAddModalOpen(false);
    }
  }, [isOpen]);

  // Filter categories based on search query
  const filteredCategories = React.useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const query = searchQuery.toLowerCase();
    return categories.filter(cat =>
      cat.name.toLowerCase().includes(query) || (cat.description || '').toLowerCase().includes(query)
    );
  }, [searchQuery, categories]);

  // Determine active category from URL
  const activeCategorySlug = React.useMemo(() => {
    const match = location.pathname.match(/^\/categories\/([^/]+)/);
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

    const draggedIdx = categories.findIndex(c => c.id === draggedId);
    const targetIdx = categories.findIndex(c => c.id === targetId);

    if (draggedIdx !== -1 && targetIdx !== -1) {
      const updated = [...categories];
      const [draggedItem] = updated.splice(draggedIdx, 1);
      updated.splice(targetIdx, 0, draggedItem);

      const reordered = updated.map((cat, index) => ({
        ...cat,
        position: index + 1
      }));

      setCategories(reordered);

      try {
        const payload = reordered.map(c => ({ id: c.id, position: c.position }));
        await reorderCategories(payload);
      } catch (err) {
        console.error('Failed to save category order in sidebar:', err);
      }
    }
  };

  const handleDragEnd = () => {
    setDraggedId(null);
  };

  // Archive / Soft Delete Category
  const handleArchiveCategory = async (e: React.MouseEvent, cat: Category) => {
    e.preventDefault();
    e.stopPropagation();

    const confirmed = window.confirm(`Вы уверены, что хотите скрыть раздел "${cat.name}"? Раздел пропадет из навигации, но его можно будет восстановить из архива в админ-панели.`);
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
      console.error('Failed to archive category from sidebar:', err);
    }
  };

  // Framer Motion variants for lists
  const listContainerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.04 }
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

  const canEdit = user && (user.role === 'Admin' || user.role === 'Editor');

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
                  placeholder="Поиск разделов..."
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

            {/* Category List */}
            <div className="flex-1 overflow-y-auto px-4 py-3 pl-6 custom-scrollbar">
              <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-450 dark:text-neutral-500 px-3 mb-2 select-none">
                {isEditMode ? 'Режим редактирования' : 'Разделы базы знаний'}
              </div>
              
              {isLoading ? (
                <div className="flex flex-col gap-3 py-2 animate-pulse">
                  {[1, 2, 3, 4, 5].map(n => (
                    <div key={n} className="h-14 bg-neutral-200 dark:bg-neutral-800/60 rounded-xl" />
                  ))}
                </div>
              ) : filteredCategories.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Sparkles className="w-8 h-8 text-neutral-300 dark:text-neutral-700 mb-3 animate-pulse" />
                  <p className="text-xs font-medium text-neutral-400 dark:text-neutral-500">Ничего не найдено</p>
                </div>
              ) : (
                <motion.nav 
                  variants={listContainerVariants}
                  initial="hidden"
                  animate="visible"
                  className="space-y-1.5"
                >
                  {filteredCategories.map((cat) => {
                    const isActive = activeCategorySlug === cat.slug;
                    const isBeingDragged = cat.id === draggedId;
                    const borderAccentColor = cat.color || '#6366f1';

                    return (
                      <motion.div 
                        key={cat.id} 
                        variants={itemVariants}
                        draggable={isEditMode}
                        onDragStart={(e) => handleDragStart(e as any, cat.id)}
                        onDragOver={(e) => handleDragOver(e, cat.id)}
                        onDrop={(e) => handleDrop(e, cat.id)}
                        onDragEnd={handleDragEnd}
                        className={isBeingDragged ? 'opacity-40 scale-95 border-dashed' : ''}
                      >
                        <Link
                          to={isEditMode ? '#' : `/categories/${cat.slug}`}
                          onClick={(e) => {
                            if (isEditMode) {
                              e.preventDefault();
                              e.stopPropagation();
                            } else {
                              onClose();
                            }
                          }}
                          style={{
                            borderColor: isEditMode ? borderAccentColor : undefined,
                            boxShadow: isEditMode ? `0 0 8px ${borderAccentColor}15` : undefined
                          }}
                          className={`group relative flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-all border ${
                            isEditMode
                              ? 'border-2 cursor-grab active:cursor-grabbing hover:scale-[1.01]'
                              : isActive
                                ? 'bg-indigo-500/10 dark:bg-indigo-500/10 border-indigo-500/20 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-semibold shadow-sm'
                                : 'text-neutral-700 dark:text-neutral-300 hover:bg-white/50 dark:hover:bg-neutral-950/30 hover:text-neutral-950 dark:hover:text-white border-transparent hover:translate-x-0.5 hover:scale-[1.01]'
                          }`}
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
                              onClick={(e) => handleArchiveCategory(e, cat)}
                              className="w-5 h-5 rounded-full bg-red-505 hover:bg-red-600 text-white flex items-center justify-center cursor-pointer shrink-0 shadow-sm border border-white dark:border-neutral-900 active:scale-90 transition-transform z-10"
                              title="Скрыть раздел"
                            >
                              <span className="w-2 h-[2px] bg-white rounded-full" />
                            </button>
                          )}

                          {/* Category Icon */}
                          <div 
                            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors border"
                            style={{
                              backgroundColor: `${borderAccentColor}10`,
                              borderColor: `${borderAccentColor}20`,
                              color: borderAccentColor
                            }}
                          >
                            <CategoryIcon name={cat.icon} className="w-4 h-4" />
                          </div>

                          {/* Category Info */}
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-xs truncate">{cat.name}</div>
                            <div className="text-[10px] text-neutral-450 dark:text-neutral-550 mt-0.5 truncate">{cat.description}</div>
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
                  
                  {/* Dashed Plus Slot for adding new section in Sidebar (Edit Mode only) */}
                  {isEditMode && (
                    <motion.div
                      whileHover={{ scale: 1.01, x: 2 }}
                      onClick={() => setIsAddModalOpen(true)}
                      className="group cursor-pointer flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-indigo-500/40 bg-indigo-500/[0.01] hover:bg-indigo-500/[0.04] hover:border-indigo-500/80 transition-all select-none"
                    >
                      <Plus className="w-4 h-4 text-indigo-500/65 group-hover:text-indigo-500 transition-colors animate-pulse" />
                      <span className="text-[11px] font-bold text-indigo-500/65 group-hover:text-indigo-500 uppercase tracking-wider">
                        Добавить раздел
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

      {/* Add Section Wizard Modal */}
      {isAddModalOpen && (
        <AddSectionModal 
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={loadData}
        />
      )}
    </>
  );
}
