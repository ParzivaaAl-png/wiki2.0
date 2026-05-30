import * as React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, BookOpen, X, Search, Sparkles } from 'lucide-react';
import { fetchCategories, Category } from '../lib/api';
import { CategoryIcon } from './icon';

interface BookSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}

export function BookSidebar({ isOpen, onToggle, onClose }: BookSidebarProps) {
  const location = useLocation();
  
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');

  // Fetch categories when open
  React.useEffect(() => {
    if (!isOpen) return;

    async function loadData() {
      setIsLoading(true);
      try {
        const catsData = await fetchCategories();
        setCategories(catsData);
      } catch (err) {
        console.error('Failed to load BookSidebar data:', err);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadData();
  }, [isOpen]);

  // Filter categories based on search query
  const filteredCategories = React.useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const query = searchQuery.toLowerCase();
    return categories.filter(cat =>
      cat.name.toLowerCase().includes(query) || cat.description.toLowerCase().includes(query)
    );
  }, [searchQuery, categories]);

  // Determine active category from URL
  const activeCategorySlug = React.useMemo(() => {
    const match = location.pathname.match(/^\/categories\/([^/]+)/);
    return match ? match[1] : null;
  }, [location.pathname]);

  const getArticlePlural = (count: number) => {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return 'статья';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'статьи';
    return 'статей';
  };

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

  // Framer Motion variants
  const listContainerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.06 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -12 },
    visible: { 
      opacity: 1, 
      x: 0,
      transition: { type: 'spring', stiffness: 150, damping: 18 }
    }
  };

  return (
    <>
      {/* Backdrop Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-neutral-950/40 dark:bg-black/60 backdrop-blur-sm z-40"
          />
        )}
      </AnimatePresence>

      {/* Book Sidebar Container */}
      <div 
        className="fixed left-0 top-0 h-screen z-50 flex pointer-events-none [perspective:1200px] [transform-style:preserve-3d]"
      >
        {/* 1. SPINE (Корешок книги) - stays anchored to the left */}
        <div 
          onClick={onToggle}
          className="w-[48px] h-full bg-gradient-to-b from-indigo-950 via-slate-900 to-indigo-950 dark:from-indigo-950 dark:via-neutral-950 dark:to-indigo-950 shadow-[4px_0_12px_rgba(0,0,0,0.35)] border-r border-indigo-900/30 dark:border-neutral-900/30 flex flex-col items-center justify-between py-12 pointer-events-auto cursor-pointer z-30 group select-none relative"
        >
          {/* Gold Embossed Spine decorations */}
          <div className="flex flex-col gap-0.5 items-center w-full">
            <div className="w-6 h-[1.5px] bg-amber-400/40 rounded-full" />
            <div className="w-4 h-[1px] bg-amber-400/20 rounded-full" />
          </div>

          {/* Spine vertical Title */}
          <div className="flex flex-col items-center justify-center transform rotate-180 [writing-mode:vertical-lr] font-serif font-bold text-[10px] sm:text-xs tracking-[0.25em] text-amber-400/80 group-hover:text-amber-300 transition-colors">
            W I K I &nbsp; 2 . 0
          </div>

          <div className="flex flex-col gap-0.5 items-center w-full">
            <div className="w-4 h-[1px] bg-amber-400/20 rounded-full" />
            <div className="w-6 h-[1.5px] bg-amber-400/40 rounded-full" />
          </div>

          {/* Spine volumetric gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/25 via-transparent to-black/30 rounded-r-sm pointer-events-none" />
          <div className="absolute left-[3px] top-0 bottom-0 w-[1.5px] bg-white/5 pointer-events-none" />
        </div>

        {/* 2. PAGES (Внутренний стеклянный сайдбар) - expands width dynamically */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: isOpen ? 285 : 0 }}
          transition={{ type: 'spring', damping: 26, stiffness: 220 }}
          className="h-full overflow-hidden bg-white/70 dark:bg-neutral-950/75 backdrop-blur-xl border-r border-neutral-200/40 dark:border-neutral-800/40 flex flex-col pointer-events-auto z-20 relative"
        >
          {/* Inner content wrapper with fixed width to prevent text reflow */}
          <div className="w-[285px] h-full flex flex-col relative">
            
            {/* Book Crease Shadow on the left */}
            <div className="absolute left-0 top-0 bottom-0 w-3 bg-gradient-to-r from-black/15 to-transparent pointer-events-none z-10" />

            {/* Sidebar Header */}
            <div className="p-4 border-b border-neutral-200/40 dark:border-neutral-800/40 flex items-center justify-between pl-6">
              <div className="flex items-center gap-2 text-indigo-500 font-semibold tracking-tight text-sm uppercase">
                <div className="relative">
                  <BookOpen className="w-5 h-5" />
                  <span className="absolute -top-1 -right-1 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
                  </span>
                </div>
                <span className="font-outfit font-bold text-neutral-800 dark:text-neutral-200">Навигация</span>
              </div>
              
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg border border-neutral-200/50 dark:border-neutral-850 bg-white/50 dark:bg-neutral-900/50 text-neutral-500 hover:text-neutral-800 dark:hover:text-white hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all shadow-sm"
                aria-label="Close sidebar"
              >
                <X className="w-4 h-4" />
              </button>
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
                  className="w-full pl-9 pr-4 py-2 text-xs bg-neutral-100/40 dark:bg-neutral-900/40 border border-neutral-200/60 dark:border-neutral-850 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder-neutral-400 dark:placeholder-neutral-500 text-neutral-850 dark:text-neutral-100"
                />
              </div>
            </div>

            {/* Category List — synced with admin panel data */}
            <div className="flex-1 overflow-y-auto px-4 py-3 pl-6 custom-scrollbar">
              {isLoading ? (
                <div className="flex flex-col gap-3 py-2 animate-pulse">
                  {[1, 2, 3, 4, 5].map(n => (
                    <div key={n} className="h-14 bg-neutral-200 dark:bg-neutral-800 rounded-xl" />
                  ))}
                </div>
              ) : filteredCategories.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Sparkles className="w-8 h-8 text-neutral-300 dark:text-neutral-700 mb-3 animate-pulse" />
                  <p className="text-xs font-medium text-neutral-400 dark:text-neutral-500">Ничего не найдено</p>
                  <p className="text-[10px] text-neutral-400/80 dark:text-neutral-500/80 mt-1 max-w-[180px]">Попробуйте другой запрос</p>
                </div>
              ) : (
                <motion.nav 
                  variants={listContainerVariants}
                  initial="hidden"
                  animate={isOpen ? "visible" : "hidden"}
                  className="space-y-1.5"
                >
                  {filteredCategories.map((cat) => {
                    const isActive = activeCategorySlug === cat.slug;
                    const articleCount = cat.article_count || 0;

                    return (
                      <motion.div key={cat.id} variants={itemVariants}>
                        <Link
                          to={`/categories/${cat.slug}`}
                          onClick={onClose}
                          className={`group relative flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-all ${
                            isActive
                              ? 'bg-indigo-500/10 dark:bg-indigo-500/10 border border-indigo-500/20 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-semibold shadow-sm'
                              : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50/60 dark:hover:bg-neutral-900/30 hover:text-neutral-950 dark:hover:text-white border border-transparent'
                          }`}
                        >
                          {/* Active indicator */}
                          <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-indigo-500 rounded-r-md transition-all ${
                            isActive ? 'opacity-100 scale-y-100' : 'opacity-0 scale-y-50 group-hover:opacity-60 group-hover:scale-y-100'
                          }`} />

                          {/* Category Icon */}
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                            isActive
                              ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'
                              : 'bg-neutral-100 dark:bg-neutral-900/60 text-neutral-500 dark:text-neutral-400 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/40 group-hover:text-indigo-500'
                          }`}>
                            <CategoryIcon name={cat.icon} className="w-4 h-4" />
                          </div>

                          {/* Category Info */}
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-xs truncate">{cat.name}</div>
                            <div className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5 truncate">{cat.description}</div>
                          </div>

                          {/* Article Count + Arrow */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${
                              isActive
                                ? 'bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border-indigo-200/50 dark:border-indigo-800/30'
                                : 'bg-neutral-100 dark:bg-neutral-900/60 text-neutral-400 dark:text-neutral-500 border-neutral-200/30 dark:border-neutral-800/30'
                            }`}>
                              {articleCount} {getArticlePlural(articleCount)}
                            </span>
                            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${
                              isActive ? 'text-indigo-500' : 'text-neutral-300 dark:text-neutral-600 group-hover:text-neutral-500 group-hover:translate-x-0.5'
                            }`} />
                          </div>
                        </Link>
                      </motion.div>
                    );
                  })}
                </motion.nav>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 pl-6 border-t border-neutral-200/40 dark:border-neutral-800/40 bg-neutral-50/30 dark:bg-neutral-900/10 text-center shrink-0">
              <span className="text-[9px] text-neutral-400 dark:text-neutral-500 font-semibold tracking-wider">Wiki 2.0 • Справочник</span>
            </div>
          </div>
        </motion.div>

        {/* 3. COVER (Обложка книги) - rotates in 3D around its left edge */}
        <motion.div
          animate={{
            rotateY: isOpen ? 108 : 0,
            z: isOpen ? 55 : 0,
            skewY: isOpen ? -1.5 : 0,
          }}
          whileHover={!isOpen ? { rotateY: 15, z: 12 } : {}}
          transition={{ type: 'spring', damping: 25, stiffness: 220 }}
          className="w-[18px] h-full bg-gradient-to-b from-indigo-900 to-indigo-950 dark:from-indigo-950 dark:to-slate-950 border-r border-y border-indigo-950/70 dark:border-neutral-900/70 shadow-[3px_0_12px_rgba(0,0,0,0.3)] origin-left pointer-events-auto cursor-pointer flex flex-col justify-between py-12 relative z-30 [transform-style:preserve-3d]"
          onClick={onToggle}
        >
          {/* Gold cover decorations */}
          <div className="w-full flex flex-col items-center gap-0.5">
            <div className="w-2.5 h-[1.5px] bg-amber-400/35 rounded-full" />
            <div className="w-1.5 h-[1px] bg-amber-400/15 rounded-full" />
          </div>

          {/* Center gold mark */}
          <div className="flex justify-center items-center">
            <span className="text-[9px] text-amber-400/80 font-serif font-bold tracking-widest select-none">W</span>
          </div>

          <div className="w-full flex flex-col items-center gap-0.5">
            <div className="w-1.5 h-[1px] bg-amber-400/15 rounded-full" />
            <div className="w-2.5 h-[1.5px] bg-amber-400/35 rounded-full" />
          </div>

          {/* Spine hinge line representation on cover */}
          <div className="absolute left-[1px] top-0 bottom-0 w-[1.5px] bg-indigo-950/80 pointer-events-none" />

          {/* closed page layers details */}
          {!isOpen && (
            <div className="absolute right-[-3px] top-1 bottom-1 w-[3px] bg-amber-50/95 dark:bg-neutral-800 rounded-r shadow-[1px_0_2px_rgba(0,0,0,0.15)] flex flex-col justify-between py-4 pointer-events-none">
              {[1, 2, 3, 4, 5].map(n => (
                <div key={n} className="h-[1px] w-full bg-neutral-250 dark:bg-neutral-700" />
              ))}
            </div>
          )}

          {/* Book cover inner surface detail visible when opened */}
          <div 
            className="absolute inset-0 bg-indigo-950 border-r border-indigo-900 shadow-inner rounded-l-sm" 
            style={{ transform: 'rotateY(180deg)', backfaceVisibility: 'hidden' }}
          >
            <div className="absolute inset-2 border border-amber-400/20 rounded flex flex-col justify-between p-2">
              <span className="text-[6px] text-amber-400/40 font-serif tracking-widest">W I K I</span>
              <span className="text-[6px] text-amber-400/40 font-serif tracking-widest text-right">2 . 0</span>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
}
