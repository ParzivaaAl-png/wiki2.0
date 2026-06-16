import * as React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, BookOpen, Search, Sparkles, Home, ShieldAlert, Plus, FileText, Folder, FolderOpen, Layers, ClipboardList } from 'lucide-react';
import { fetchNavigationTree, Space, Section } from '../lib/api';
import { useAuth } from '../lib/auth-context';

interface BookSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}

const line1Variants = {
  closed: { rotate: 0, y: 0, width: 20 },
  open: { rotate: 45, y: 5, width: 20 }
};

const line2Variants = {
  closed: { opacity: 1, scaleX: 1, width: 20 },
  open: { opacity: 0, scaleX: 0, width: 20 }
};

const line3Variants = {
  closed: { rotate: 0, y: 0, width: 14 },
  open: { rotate: -45, y: -5, width: 20 }
};

export function BookSidebar({ isOpen, onToggle, onClose }: BookSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isStaff } = useAuth();
  
  const [spaces, setSpaces] = React.useState<Space[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [expandedKeys, setExpandedKeys] = React.useState<Record<string, boolean>>({});

  const canEdit = isStaff;

  const loadData = React.useCallback(async () => {
    try {
      const tree = await fetchNavigationTree();
      setSpaces(tree);
      
      // По умолчанию раскрываем все пространства
      const initialExpanded: Record<string, boolean> = {};
      tree.forEach(space => {
        initialExpanded[`space_${space.id}`] = true;
      });
      setExpandedKeys(prev => ({ ...initialExpanded, ...prev }));
    } catch (err) {
      console.error('Failed to load BookSidebar navigation tree:', err);
    }
  }, []);

  // Fetch navigation tree when sidebar is opened
  React.useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    loadData().finally(() => setIsLoading(false));
  }, [isOpen, loadData]);

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

  const toggleExpand = (key: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Рекурсивный фильтр дерева навигации при локальном поиске
  const filteredSpaces = React.useMemo(() => {
    if (!searchQuery.trim()) return spaces;
    const query = searchQuery.toLowerCase();

    // Функция для фильтрации разделов
    const filterSections = (secs: Section[]): Section[] => {
      return secs
        .map(sec => {
          const matchingArticles = sec.articles.filter(art => 
            art.title.toLowerCase().includes(query)
          );
          const filteredSubs = filterSections(sec.subsections || []);

          if (matchingArticles.length > 0 || filteredSubs.length > 0 || sec.name.toLowerCase().includes(query)) {
            return {
              ...sec,
              articles: matchingArticles,
              subsections: filteredSubs
            };
          }
          return null;
        })
        .filter((sec): sec is Section => sec !== null);
    };

    return spaces
      .map(space => {
        const filteredSecs = filterSections(space.sections || []);
        if (filteredSecs.length > 0 || space.name.toLowerCase().includes(query)) {
          return {
            ...space,
            sections: filteredSecs
          };
        }
        return null;
      })
      .filter((space): space is Space => space !== null);
  }, [spaces, searchQuery]);

  // Рекурсивный рендер узла раздела (Section)
  const renderSectionNode = (section: Section, depth = 0) => {
    const expandKey = `section_${section.id}`;
    const isExpanded = !!expandedKeys[expandKey];
    const hasChildren = (section.subsections && section.subsections.length > 0) || (section.articles && section.articles.length > 0);

    return (
      <div key={section.id} className="select-none">
        {/* Кнопка Раздела */}
        <div
          onClick={(e) => hasChildren && toggleExpand(expandKey, e)}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          className={`group flex items-center justify-between py-1.5 pr-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            hasChildren 
              ? 'text-neutral-750 dark:text-neutral-300 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/40' 
              : 'text-neutral-500 dark:text-neutral-500'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {hasChildren ? (
              <button 
                onClick={(e) => toggleExpand(expandKey, e)}
                className="p-0.5 hover:bg-neutral-300/50 dark:hover:bg-neutral-700/50 rounded transition-colors shrink-0"
              >
                <ChevronRight 
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-90 text-indigo-500' : 'text-neutral-400'}`} 
                />
              </button>
            ) : (
              <span className="w-4.5 shrink-0" />
            )}

            {isExpanded ? (
              <FolderOpen className="w-3.5 h-3.5 text-amber-500/80 shrink-0" />
            ) : (
              <Folder className="w-3.5 h-3.5 text-amber-500/70 shrink-0" />
            )}

            <span className="truncate" title={section.description || section.name}>
              {section.name}
            </span>
          </div>

          {/* Быстрый плюс для создания статьи в этой секции */}
          {canEdit && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
                navigate(`/admin/editor/new?sectionId=${section.id}`);
              }}
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-indigo-500/10 hover:text-indigo-500 text-neutral-400 rounded-md transition-all shrink-0"
              title="Создать статью в этом разделе"
            >
              <Plus className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Содержимое раздела (подразделы и статьи) */}
        {hasChildren && isExpanded && (
          <div className="mt-0.5 space-y-0.5">
            {/* Подразделы */}
            {section.subsections && section.subsections.map(sub => renderSectionNode(sub, depth + 1))}

            {/* Статьи раздела */}
            {section.articles && section.articles.map(art => {
              const isActive = activeArticleSlug === art.slug;
              const isDraft = art.status === 'draft';
              const isPending = art.status === 'on_approval';
              const isWarning = art.status === 'requires_verification';
              const isJobDescription = art.article_type === 'job_description';

              return (
                <div key={art.id} style={{ paddingLeft: `${(depth + 1) * 12 + 12}px` }}>
                  <Link
                    to={`/articles/${art.slug}`}
                    onClick={onClose}
                    className={`group flex items-center justify-between py-1.5 px-2 rounded-lg text-xs transition-all border ${
                      isActive
                        ? 'bg-indigo-500/10 dark:bg-indigo-500/10 border-indigo-500/20 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-semibold shadow-sm'
                        : isJobDescription
                          ? 'text-indigo-650 dark:text-indigo-400 bg-indigo-500/5 dark:bg-indigo-500/5 hover:bg-indigo-500/10 dark:hover:bg-indigo-500/10 border-indigo-550/10 hover:translate-x-0.5 font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                          : 'text-neutral-600 dark:text-neutral-400 hover:bg-white/60 dark:hover:bg-neutral-950/20 hover:text-neutral-900 dark:hover:text-neutral-200 border-transparent hover:translate-x-0.5'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isJobDescription ? (
                        <ClipboardList className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-indigo-600' : 'text-indigo-500'}`} />
                      ) : (
                        <FileText className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-indigo-500' : 'text-neutral-400'}`} />
                      )}
                      <span className="truncate">{art.title}</span>
                    </div>

                    {/* Статусы в виде компактных точек/значков */}
                    <div className="flex items-center gap-1 shrink-0 ml-1.5">
                      {isDraft && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Черновик" />
                      )}
                      {isPending && (
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" title="На согласовании" />
                      )}
                      {isWarning && (
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" title="Требует проверки" />
                      )}
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Mobile Floating Menu Button */}
      <button
        onClick={onToggle}
        className="fixed left-3 top-3 z-50 flex lg:hidden w-8 h-8 items-center justify-center rounded-lg text-indigo-500 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm border border-neutral-200/60 dark:border-neutral-800/60 shadow-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all cursor-pointer"
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

      {/* 1. FIXED LEFT STRIP (56px) - Desktop only */}
      <div 
        className="hidden lg:flex fixed left-0 top-0 h-screen w-14 bg-neutral-50 dark:bg-neutral-950 border-r border-neutral-200/50 dark:border-neutral-850/50 z-50 flex-col items-center py-4 shrink-0 shadow-sm"
      >
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

        <div className="pb-4 mt-auto text-[9px] font-bold font-mono tracking-widest text-neutral-400 dark:text-neutral-600 select-none">
          W2
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
            className="fixed lg:left-14 left-0 top-0 h-screen w-[300px] bg-neutral-100/90 dark:bg-neutral-900/90 backdrop-blur-xl border-r border-neutral-200/50 dark:border-neutral-800/55 shadow-2xl flex flex-col z-40 overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 border-b border-neutral-200/40 dark:border-neutral-800/40 flex items-center justify-between lg:pl-6 pl-14 shrink-0">
              <div className="flex items-center gap-2 text-indigo-500 font-semibold tracking-tight text-sm uppercase">
                <BookOpen className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                <span className="font-outfit font-bold text-neutral-800 dark:text-neutral-200">База Знаний</span>
              </div>
              
              {canEdit && (
                <button
                  onClick={() => {
                    onClose();
                    navigate('/admin/editor/new');
                  }}
                  className="px-2 py-1 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/25 text-indigo-650 dark:text-indigo-400 rounded-lg text-[10px] font-bold uppercase transition-all shadow-sm cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Создать
                </button>
              )}
            </div>

            {/* Quick Search */}
            <div className="px-4 pt-4 pb-2 shrink-0 pl-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Поиск по оглавлению..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs bg-white/60 dark:bg-neutral-950/60 border border-neutral-200/60 dark:border-neutral-850 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder-neutral-400 dark:placeholder-neutral-500 text-neutral-800 dark:text-neutral-100"
                />
              </div>
            </div>

            {/* Quick Links Section */}
            <div className="px-4 py-2 shrink-0 pl-6 space-y-1">
              <Link
                to="/"
                onClick={onClose}
                className="group flex items-center gap-3 px-3 py-1.5 rounded-xl text-xs text-neutral-700 dark:text-neutral-300 hover:bg-white/50 dark:hover:bg-neutral-950/30 hover:text-neutral-950 dark:hover:text-white border border-transparent hover:translate-x-0.5 transition-all"
              >
                <div className="w-6 h-6 rounded-lg bg-white/65 dark:bg-neutral-950/60 text-neutral-500 dark:text-neutral-400 group-hover:bg-indigo-500/10 group-hover:text-indigo-500 flex items-center justify-center transition-colors">
                  <Home className="w-3.5 h-3.5" />
                </div>
                <span className="font-semibold">Главная</span>
              </Link>
              {isStaff && (
                <Link
                  to="/admin"
                  onClick={onClose}
                  className="group flex items-center gap-3 px-3 py-1.5 rounded-xl text-xs text-neutral-700 dark:text-neutral-300 hover:bg-white/50 dark:hover:bg-neutral-950/30 hover:text-neutral-950 dark:hover:text-white border border-transparent hover:translate-x-0.5 transition-all"
                >
                  <div className="w-6 h-6 rounded-lg bg-white/65 dark:bg-neutral-950/60 text-neutral-500 dark:text-neutral-400 group-hover:bg-indigo-500/10 group-hover:text-indigo-500 flex items-center justify-center transition-colors">
                    <ShieldAlert className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-semibold">Администрирование</span>
                </Link>
              )}
            </div>

            <div className="mx-6 my-1 border-b border-neutral-200/30 dark:border-neutral-800/30 shrink-0" />

            {/* Navigation Tree (Spaces -> Sections -> Articles) */}
            <div className="flex-1 overflow-y-auto px-4 py-3 pl-6 custom-scrollbar space-y-4">
              {isLoading ? (
                <div className="flex flex-col gap-3 py-2 animate-pulse">
                  {[1, 2, 3, 4, 5].map(n => (
                    <div key={n} className="h-10 bg-neutral-200 dark:bg-neutral-800/60 rounded-xl" />
                  ))}
                </div>
              ) : filteredSpaces.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Sparkles className="w-8 h-8 text-neutral-300 dark:text-neutral-700 mb-3 animate-pulse" />
                  <p className="text-xs font-medium text-neutral-400 dark:text-neutral-550">Ничего не найдено</p>
                </div>
              ) : (
                filteredSpaces.map((space) => {
                  const spaceKey = `space_${space.id}`;
                  const isSpaceExpanded = !!expandedKeys[spaceKey];
                  const hasSections = space.sections && space.sections.length > 0;

                  return (
                    <div key={space.id} className="space-y-1">
                      {/* Название Пространства (Отдела) */}
                      <div
                        onClick={(e) => hasSections && toggleExpand(spaceKey, e)}
                        className="flex items-center justify-between px-2 py-2 rounded-xl bg-white/45 dark:bg-neutral-950/20 border border-neutral-200/40 dark:border-neutral-850/30 cursor-pointer hover:bg-white/80 dark:hover:bg-neutral-950/40 transition-all select-none"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Layers className="w-4 h-4 text-indigo-500 shrink-0" />
                          <span className="text-xs font-bold text-neutral-800 dark:text-neutral-250 truncate">
                            {space.name}
                          </span>
                        </div>
                        {hasSections && (
                          <ChevronRight 
                            className={`w-3.5 h-3.5 text-neutral-400 transition-transform duration-200 ${
                              isSpaceExpanded ? 'rotate-90 text-indigo-500' : ''
                            }`} 
                          />
                        )}
                      </div>

                      {/* Разделы Пространства */}
                      {hasSections && isSpaceExpanded && (
                        <div className="pl-1.5 mt-1 border-l border-neutral-250/30 dark:border-neutral-800/40 space-y-1">
                          {space.sections.map(sec => renderSectionNode(sec, 0))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-4 pl-6 border-t border-neutral-200/40 dark:border-neutral-800/40 bg-neutral-200/20 dark:bg-neutral-950/20 text-center shrink-0">
              <span className="text-[9px] text-neutral-405 dark:text-neutral-600 font-semibold tracking-wider">Wiki 2.0 • Оргструктура</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
