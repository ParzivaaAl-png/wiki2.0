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

export function BookSidebar({ isOpen, onClose }: BookSidebarProps) {
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
      transition: { staggerChildren: 0.05 }
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
            className="fixed inset-0 bg-neutral-950/30 dark:bg-black/50 backdrop-blur-sm z-40"
          />
        )}
      </AnimatePresence>

      {/* Slide-over panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="fixed left-0 top-0 h-screen w-[285px] bg-neutral-100/95 dark:bg-neutral-900/95 backdrop-blur-xl border-r border-neutral-200/50 dark:border-neutral-800/55 shadow-2xl flex flex-col z-50"
          >
            {/* Header */}
            <div className="p-4 border-b border-neutral-200/40 dark:border-neutral-800/40 flex items-center justify-between pl-6">
              <div className="flex items-center gap-2 text-indigo-500 font-semibold tracking-tight text-sm uppercase">
                <div className="relative">
                  <BookOpen className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                </div>
                <span className="font-outfit font-bold text-neutral-800 dark:text-neutral-200">Навигация</span>
              </div>
              
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg border border-neutral-200/50 dark:border-neutral-800/50 bg-white/50 dark:bg-neutral-900/50 text-neutral-500 hover:text-neutral-800 dark:hover:text-white hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all shadow-sm cursor-pointer"
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
                  className="w-full pl-9 pr-4 py-2 text-xs bg-white/60 dark:bg-neutral-950/60 border border-neutral-200/60 dark:border-neutral-850 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder-neutral-400 dark:placeholder-neutral-500 text-neutral-855 dark:text-neutral-100"
                />
              </div>
            </div>

            {/* Category List */}
            <div className="flex-1 overflow-y-auto px-4 py-3 pl-6 custom-scrollbar">
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
                  <p className="text-[10px] text-neutral-400/80 dark:text-neutral-500/80 mt-1 max-w-[180px]">Попробуйте другой запрос</p>
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
                    const articleCount = cat.article_count || 0;

                    return (
                      <motion.div key={cat.id} variants={itemVariants}>
                        <Link
                          to={`/categories/${cat.slug}`}
                          onClick={onClose}
                          className={`group relative flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-all ${
                            isActive
                              ? 'bg-indigo-500/10 dark:bg-indigo-500/10 border border-indigo-500/20 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-semibold shadow-sm'
                              : 'text-neutral-700 dark:text-neutral-300 hover:bg-white/50 dark:hover:bg-neutral-950/30 hover:text-neutral-950 dark:hover:text-white border border-transparent'
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
                              : 'bg-white/60 dark:bg-neutral-950/60 text-neutral-500 dark:text-neutral-400 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/40 group-hover:text-indigo-500'
                          }`}>
                            <CategoryIcon name={cat.icon} className="w-4 h-4" />
                          </div>

                          {/* Category Info */}
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-xs truncate">{cat.name}</div>
                            <div className="text-[10px] text-neutral-450 dark:text-neutral-500 mt-0.5 truncate">{cat.description}</div>
                          </div>

                          {/* Article Count + Arrow */}
                          <div className="flex items-center gap-1.5 shrink-0">
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
            <div className="p-4 pl-6 border-t border-neutral-200/40 dark:border-neutral-800/40 bg-neutral-200/20 dark:bg-neutral-950/20 text-center shrink-0">
              <span className="text-[9px] text-neutral-400 dark:text-neutral-550 font-semibold tracking-wider">Wiki 2.0 • Справочник</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
