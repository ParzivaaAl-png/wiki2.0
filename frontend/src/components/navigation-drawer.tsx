import * as React from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronDown, BookOpen, X, FileText, Search, Sparkles } from 'lucide-react';
import { fetchCategories, fetchArticles, Category, Article } from '../lib/api';
import { CategoryIcon } from './icon';

interface NavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NavigationDrawer({ isOpen, onClose }: NavigationDrawerProps) {
  const location = useLocation();
  const { slug: activeArticleSlug } = useParams<{ slug: string }>();
  
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [allArticles, setAllArticles] = React.useState<Article[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [expandedCategories, setExpandedCategories] = React.useState<Record<string, boolean>>({});

  // Fetch navigation data when the drawer opens
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
        console.error('Failed to load navigation drawer data:', err);
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

    // Filter categories (keep categories that match the query OR have matching articles)
    const filteredCategories = categories.filter(cat => {
      const hasMatchingArticles = filteredArticlesMap[cat.slug] && filteredArticlesMap[cat.slug].length > 0;
      const matchesCategoryName = cat.name.toLowerCase().includes(query) || cat.description.toLowerCase().includes(query);
      
      if (matchesCategoryName && !filteredArticlesMap[cat.slug]) {
        // If category matches name, but no articles are matched, include all articles for this category
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

  // Close drawer on ESC key
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
  const drawerVariants = {
    hidden: { x: '-100%' },
    visible: { 
      x: 0,
      transition: { 
        type: 'spring', 
        damping: 25, 
        stiffness: 220,
        staggerChildren: 0.05,
        delayChildren: 0.1
      } 
    },
    exit: { 
      x: '-100%', 
      transition: { 
        type: 'tween', 
        duration: 0.25, 
        ease: 'easeInOut' 
      } 
    }
  };

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.25 } },
    exit: { opacity: 0, transition: { duration: 0.2 } }
  };

  const listContainerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: {
        staggerChildren: 0.04
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -15 },
    visible: { 
      opacity: 1, 
      x: 0,
      transition: { type: 'spring', stiffness: 150, damping: 18 }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop Blur Overlay */}
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
            className="fixed inset-0 bg-neutral-950/40 dark:bg-black/60 backdrop-blur-sm"
          />

          {/* Drawer Panel */}
          <motion.div
            variants={drawerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="relative w-80 max-w-[85vw] h-full bg-white/75 dark:bg-neutral-950/80 backdrop-blur-xl border-r border-neutral-200/40 dark:border-neutral-800/40 shadow-2xl flex flex-col z-50"
          >
            {/* Header Section */}
            <div className="p-4 border-b border-neutral-200/40 dark:border-neutral-800/40 flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-500 font-semibold tracking-tight text-sm uppercase">
                <div className="relative">
                  <BookOpen className="w-5 h-5" />
                  <span className="absolute -top-1 -right-1 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
                  </span>
                </div>
                <span className="font-outfit font-bold text-neutral-850 dark:text-neutral-250">Навигация</span>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg border border-neutral-200/50 dark:border-neutral-850 bg-white/50 dark:bg-neutral-900/50 text-neutral-500 hover:text-neutral-800 dark:hover:text-white hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all shadow-sm"
                aria-label="Close sidebar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Input */}
            <div className="px-4 pt-4 pb-2 shrink-0">
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

            {/* Scrollable Navigation Body */}
            <div className="flex-1 overflow-y-auto px-4 py-3 custom-scrollbar">
              {isLoading ? (
                <div className="flex flex-col gap-3 py-4 animate-pulse">
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
                  <p className="text-[10px] text-neutral-400/80 dark:text-neutral-500/80 mt-1 max-w-[180px]">Попробуйте ввести другой запрос</p>
                </div>
              ) : (
                <motion.nav 
                  variants={listContainerVariants}
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
                        {/* Category Heading Button */}
                        <button
                          onClick={() => toggleCategory(cat.slug)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-left font-semibold transition-all ${
                            isExpanded 
                              ? 'text-neutral-900 dark:text-white bg-neutral-100/50 dark:bg-neutral-900/35 border border-neutral-200/20 dark:border-neutral-850/30' 
                              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50/50 dark:hover:bg-neutral-900/10 hover:text-neutral-900 dark:hover:text-white'
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

                        {/* Category Articles list */}
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
                                          : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-50/50 dark:hover:bg-neutral-900/20'
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

            {/* Bottom Footer Info */}
            <div className="p-4 border-t border-neutral-200/40 dark:border-neutral-800/40 bg-neutral-50/30 dark:bg-neutral-900/10 text-center shrink-0">
              <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">Wiki 2.0 • Справочник сотрудника</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
