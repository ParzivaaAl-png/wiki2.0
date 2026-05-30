import * as React from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronDown, BookOpen, X, FileText, Search, Sparkles } from 'lucide-react';
import { fetchCategories, fetchArticles, Category, Article } from '../lib/api';
import { CategoryIcon } from './icon';

interface BookSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}

export function BookSidebar({ isOpen, onToggle, onClose }: BookSidebarProps) {
  const location = useLocation();
  const { slug: activeArticleSlug } = useParams<{ slug: string }>();
  
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [allArticles, setAllArticles] = React.useState<Article[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [expandedCategories, setExpandedCategories] = React.useState<Record<string, boolean>>({});

  // Fetch navigation data when open
  React.useEffect(() => {
    if (!isOpen) return;

    async function loadData() {
      setIsLoading(true);
      try {
        const [catsData, artsList] = await Promise.all([
          fetchCategories(),
          fetchArticles(),
        ]);
        setCategories(catsData);
        setAllArticles(artsList);

        // Auto-expand category that contains the active article
        const activeArticle = artsList.find(a => a.slug === activeArticleSlug);
        if (activeArticle?.category_slug) {
          setExpandedCategories(prev => ({
            ...prev,
            [activeArticle.category_slug!]: true
          }));
        }
      } catch (err) {
        console.error('Failed to load BookSidebar data:', err);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadData();
  }, [isOpen, activeArticleSlug]);

  // Group articles by category
  const articlesByCategory = React.useMemo(() => {
    const map: Record<string, Article[]> = {};
    allArticles.forEach(art => {
      if (art.category_slug) {
        if (!map[art.category_slug]) map[art.category_slug] = [];
        map[art.category_slug].push(art);
      }
    });
    return map;
  }, [allArticles]);

  // Filter categories and articles based on search query
  const filteredData = React.useMemo(() => {
    if (!searchQuery.trim()) {
      return { categories, articlesByCategory };
    }

    const query = searchQuery.toLowerCase();
    const filteredArticlesMap: Record<string, Article[]> = {};
    
    // Filter articles
    allArticles.forEach(art => {
      if (art.title.toLowerCase().includes(query) || (art.summary && art.summary.toLowerCase().includes(query))) {
        if (art.category_slug) {
          if (!filteredArticlesMap[art.category_slug]) {
            filteredArticlesMap[art.category_slug] = [];
          }
          filteredArticlesMap[art.category_slug].push(art);
        }
      }
    });

    // Filter categories
    const filteredCategories = categories.filter(cat => {
      const hasMatchingArticles = filteredArticlesMap[cat.slug] && filteredArticlesMap[cat.slug].length > 0;
      const matchesCategoryName = cat.name.toLowerCase().includes(query) || cat.description.toLowerCase().includes(query);
      
      if (matchesCategoryName && !filteredArticlesMap[cat.slug]) {
        filteredArticlesMap[cat.slug] = articlesByCategory[cat.slug] || [];
      }

      return matchesCategoryName || hasMatchingArticles;
    });

    // Auto-expand all matching categories during search
    const newExpanded: Record<string, boolean> = {};
    filteredCategories.forEach(cat => {
      newExpanded[cat.slug] = true;
    });
    setExpandedCategories(prev => ({ ...prev, ...newExpanded }));

    return { categories: filteredCategories, articlesByCategory: filteredArticlesMap };
  }, [searchQuery, categories, allArticles, articlesByCategory]);

  const toggleCategory = (catSlug: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [catSlug]: !prev[catSlug]
    }));
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
                  placeholder="Быстрый поиск статей..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs bg-neutral-100/40 dark:bg-neutral-900/40 border border-neutral-200/60 dark:border-neutral-850 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder-neutral-400 dark:placeholder-neutral-500 text-neutral-850 dark:text-neutral-100"
                />
              </div>
            </div>

            {/* Scrollable Document List */}
            <div className="flex-1 overflow-y-auto px-4 py-3 pl-6 custom-scrollbar">
              {isLoading ? (
                <div className="flex flex-col gap-3 py-2 animate-pulse">
                  {[1, 2, 3, 4].map(n => (
                    <div key={n} className="space-y-2">
                      <div className="h-6 w-3/4 bg-neutral-200 dark:bg-neutral-800 rounded-lg" />
                      <div className="h-4 w-1/2 bg-neutral-100 dark:bg-neutral-900 rounded-md ml-4" />
                    </div>
                  ))}
                </div>
              ) : filteredData.categories.length === 0 ? (
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
                  className="space-y-2.5"
                >
                  {filteredData.categories.map((cat) => {
                    const isExpanded = !!expandedCategories[cat.slug];
                    const catArticles = filteredData.articlesByCategory[cat.slug] || [];
                    const hasArticles = catArticles.length > 0;
                    
                    return (
                      <motion.div 
                        key={cat.id} 
                        variants={itemVariants}
                        className="space-y-1"
                      >
                        {/* Category Row */}
                        <button
                          onClick={() => toggleCategory(cat.slug)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-left font-semibold transition-all ${
                            isExpanded 
                              ? 'text-neutral-950 dark:text-white bg-neutral-100/50 dark:bg-neutral-900/35 border border-neutral-200/20 dark:border-neutral-850/30' 
                              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50/50 dark:hover:bg-neutral-900/10 hover:text-neutral-950 dark:hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <div className="w-5.5 h-5.5 rounded-lg flex items-center justify-center bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 dark:text-indigo-400 shrink-0">
                              <CategoryIcon name={cat.icon} className="w-3.5 h-3.5" />
                            </div>
                            <span className="truncate">{cat.name}</span>
                          </div>
                          
                          <div className="flex items-center gap-2 shrink-0 ml-1">
                            <span className="text-[9px] text-neutral-400 dark:text-neutral-500 font-bold bg-neutral-100 dark:bg-neutral-900/60 px-1.5 py-0.5 rounded-md border border-neutral-200/30 dark:border-neutral-800/30">
                              {catArticles.length}
                            </span>
                            <span className="text-neutral-400 dark:text-neutral-500">
                              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </span>
                          </div>
                        </button>

                        {/* Article Items */}
                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2, ease: 'easeInOut' }}
                              className="overflow-hidden pl-4 border-l border-neutral-200/50 dark:border-neutral-850 ml-5.5 space-y-0.5"
                            >
                              {!hasArticles ? (
                                <span className="block px-3 py-2 text-[10px] text-neutral-400 dark:text-neutral-600 italic">
                                  Нет статей
                                </span>
                              ) : (
                                catArticles.map((art) => {
                                  const isActive = activeArticleSlug === art.slug;
                                  return (
                                    <Link
                                      key={art.id}
                                      to={`/articles/${art.slug}`}
                                      onClick={onClose}
                                      className={`group relative flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all ${
                                        isActive
                                          ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold'
                                          : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white hover:bg-neutral-50/50 dark:hover:bg-neutral-900/20'
                                      }`}
                                    >
                                      {/* Indicator line */}
                                      <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-3 bg-indigo-500 rounded-r-md transition-all ${
                                        isActive ? 'opacity-100 scale-y-100' : 'opacity-0 scale-y-50 group-hover:opacity-100 group-hover:scale-y-100'
                                      }`} />

                                      <FileText className="w-3.5 h-3.5 opacity-50 group-hover:opacity-90 group-hover:text-indigo-500 transition-colors shrink-0" />
                                      <span className="truncate group-hover:translate-x-0.5 transition-transform">{art.title}</span>
                                    </Link>
                                  );
                                })
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
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
