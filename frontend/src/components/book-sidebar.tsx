import * as React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, BookOpen, Search, Sparkles, Home, ShieldAlert, Plus, FileText, Folder, FolderOpen, Layers, ClipboardList, Pin } from 'lucide-react';
import { fetchNavigationTree, Space, Section } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import GuestAccessTimer from './guest-access-timer';

interface BookSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  isPinned: boolean;
  onTogglePin: () => void;
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

export function BookSidebar({ isOpen, onToggle, onClose, isPinned, onTogglePin }: BookSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isStaff } = useAuth();
  
  const [spaces, setSpaces] = React.useState<Space[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [expandedKeys, setExpandedKeys] = React.useState<Record<string, boolean>>({});

  const canEdit = isStaff;
  const isHomeActive = location.pathname === '/';
  const isAdminActive = location.pathname.startsWith('/admin');

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

  // Helper for closing sidebar conditionally when unpinned
  const handleNavClose = React.useCallback(() => {
    if (!isPinned) {
      onClose();
    }
  }, [isPinned, onClose]);

  // Close on ESC key (only if unpinned)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isPinned) onClose();
    };
    if (isOpen && !isPinned) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isPinned, onClose]);

  // Prevent scroll propagation only when unpinned floating modal
  React.useEffect(() => {
    if (isOpen && !isPinned) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, isPinned]);

  const toggleExpand = (key: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Helper to count published & accessible articles for a section
  const getSectionArticleCount = (sec: Section): number => {
    let count = sec.articles ? sec.articles.filter(a => a.status !== 'archived').length : 0;
    if (sec.subsections) {
      sec.subsections.forEach(sub => {
        count += getSectionArticleCount(sub);
      });
    }
    return count;
  };

  // Рекурсивный фильтр дерева навигации: скрываем пустые должности и пустые отделы
  const filteredSpaces = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const processSections = (secs: Section[]): Section[] => {
      return secs
        .map(sec => {
          const validArticles = (sec.articles || []).filter(art => {
            if (art.status === 'archived') return false;
            if (query) return art.title.toLowerCase().includes(query);
            return true;
          });

          const validSubsections = processSections(sec.subsections || []);
          const articleCount = validArticles.length + validSubsections.reduce((acc, sub) => acc + getSectionArticleCount(sub), 0);
          const isNameMatching = query ? sec.name.toLowerCase().includes(query) : false;

          // Скрывать должности с 0 статей (если не идёт локальный поиск)
          if (articleCount === 0 && !isNameMatching) {
            return null;
          }

          return {
            ...sec,
            articles: validArticles,
            subsections: validSubsections
          };
        })
        .filter((sec): sec is Section => sec !== null);
    };

    return spaces
      .map(space => {
        const validSecs = processSections(space.sections || []);
        const isSpaceMatching = query ? space.name.toLowerCase().includes(query) : false;

        // Скрывать отделы без доступных должностей/статей
        if (validSecs.length === 0 && !isSpaceMatching) {
          return null;
        }

        return {
          ...space,
          sections: validSecs
        };
      })
      .filter((space): space is Space => space !== null);
  }, [spaces, searchQuery]);

  // Древовидный рендер должности (Section) с раскрывающимся списком статей
  const renderSectionNode = (section: Section, depth = 0) => {
    const expandKey = `section_${section.id}`;
    const isExpanded = !!expandedKeys[expandKey];
    const hasSubsections = section.subsections && section.subsections.length > 0;
    const hasArticles = section.articles && section.articles.length > 0;
    const hasExpandableContent = hasSubsections || hasArticles;
    const articleCount = getSectionArticleCount(section);

    return (
      <div key={section.id} className="select-none">
        {/* Кнопка Должности/Раздела */}
        <div
          onClick={(e) => {
            if (hasExpandableContent) {
              toggleExpand(expandKey, e);
            } else {
              onClose();
              navigate(`/?sectionId=${section.id}&sectionName=${encodeURIComponent(section.name)}`);
            }
          }}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          className="group flex items-center justify-between py-1.5 pr-2 rounded-lg text-xs font-semibold transition-all cursor-pointer text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/40"
        >
          <div className="flex items-center gap-2 min-w-0">
            {hasExpandableContent ? (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(expandKey, e);
                }}
                className="p-0.5 hover:bg-neutral-300/50 dark:hover:bg-neutral-700/50 rounded transition-colors shrink-0"
              >
                <ChevronRight 
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-90 text-indigo-500' : 'text-neutral-400'}`} 
                />
              </button>
            ) : (
              <Folder className="w-3.5 h-3.5 text-indigo-500/70 shrink-0" />
            )}

            {isExpanded ? (
              <FolderOpen className="w-3.5 h-3.5 text-amber-500/80 shrink-0" />
            ) : (
              <Folder className="w-3.5 h-3.5 text-indigo-500/70 shrink-0" />
            )}

            <span className="truncate" title={section.description || section.name}>
              {section.name}
            </span>

            <span className="ml-0.5 text-[11px] text-neutral-400 dark:text-neutral-500 font-medium">
              ({articleCount})
            </span>

            {section.guest_access && (
              <GuestAccessTimer
                expiresAt={section.guest_access.expires_at}
                scope="section"
                compact
                className="shrink-0"
              />
            )}
          </div>

          {/* Быстрый плюс для создания статьи в этой должности */}
          {canEdit && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
                navigate(`/admin/editor/new?sectionId=${section.id}`);
              }}
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-indigo-500/20 hover:text-indigo-600 text-neutral-400 rounded-md transition-all shrink-0"
              title={`Создать статью для должности ${section.name}`}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Раскрывающийся список статей и подразделов */}
        {hasExpandableContent && isExpanded && (
          <div className="mt-0.5 space-y-0.5">
            {/* Подразделы */}
            {section.subsections && section.subsections.map(sub => renderSectionNode(sub, depth + 1))}

            {/* Статьи этой должности */}
            {section.articles && section.articles.map(art => {
              const isActive = activeArticleSlug === art.slug;
              const isJobDescription = art.article_type === 'job_description';

              return (
                <div key={art.id} style={{ paddingLeft: `${(depth + 1) * 12 + 12}px` }}>
                  <Link
                    to={`/articles/${art.slug}`}
                    onClick={onClose}
                    className={`group flex items-center justify-between py-1 px-2 rounded-lg text-xs transition-all border ${
                      isActive
                        ? 'bg-indigo-500/10 dark:bg-indigo-500/10 border-indigo-500/20 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-semibold shadow-sm'
                        : isJobDescription
                          ? 'text-indigo-650 dark:text-indigo-400 bg-indigo-500/5 dark:bg-indigo-500/5 hover:bg-indigo-500/10 dark:hover:bg-indigo-500/10 border-indigo-550/10 hover:translate-x-0.5 font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                          : 'text-neutral-600 dark:text-neutral-400 hover:bg-white/60 dark:hover:bg-card/30 hover:text-neutral-900 dark:hover:text-neutral-200 border-transparent hover:translate-x-0.5'
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

                    {art.guest_access && (
                      <GuestAccessTimer
                        expiresAt={art.guest_access.expires_at}
                        scope={art.guest_access.type}
                        compact
                        className="shrink-0 ml-1.5"
                      />
                    )}
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
        type="button"
        onClick={onToggle}
        className="fixed left-2.5 top-2.5 z-50 flex lg:hidden w-9 h-9 items-center justify-center rounded-lg text-indigo-500 bg-card border border-border shadow-sm hover:bg-muted transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-ring/40"
        aria-label={isOpen ? 'Закрыть навигацию' : 'Открыть навигацию'}
        title={isOpen ? 'Закрыть навигацию' : 'Открыть навигацию'}
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
        className="hidden lg:flex fixed left-0 top-0 h-screen w-14 bg-neutral-50 dark:bg-sidebar-bg border-r border-neutral-200/50 dark:border-border z-50 flex-col items-center py-4 shrink-0 shadow-sm"
      >
        <button
          type="button"
          onClick={onToggle}
          className="w-10 h-10 flex flex-col justify-center items-center rounded-xl text-indigo-500 bg-indigo-500/10 dark:bg-indigo-500/5 hover:bg-indigo-500/20 dark:hover:bg-indigo-500/15 border border-indigo-500/20 dark:border-indigo-500/10 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-sm relative group"
          aria-label={isOpen ? 'Закрыть навигацию' : 'Открыть навигацию'}
          title={isOpen ? 'Закрыть навигацию' : 'Открыть навигацию'}
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

        {/* 2. BACKDROP OVERLAY (Only when unpinned) */}
        <AnimatePresence>
          {isOpen && !isPinned && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-neutral-950/30 dark:bg-black/50 z-30"
            />
          )}
        </AnimatePresence>

        {/* 3. SLIDE-OUT / PINNED DRAWER PANEL */}
        <AnimatePresence>
          {(isOpen || isPinned) && (
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className={`fixed lg:left-14 left-0 top-0 h-screen w-[300px] bg-neutral-100/90 dark:bg-sidebar-bg border-r border-neutral-200/50 dark:border-border flex flex-col z-40 overflow-hidden ${
                isPinned ? 'shadow-none' : 'shadow-2xl'
              }`}
            >
              {/* Header */}
              <div className="p-4 border-b border-neutral-200/40 dark:border-border flex items-center justify-between lg:pl-6 pl-14 shrink-0">
                <div className="flex items-center gap-2 text-indigo-500 font-semibold tracking-tight text-sm uppercase">
                  <BookOpen className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                  <span className="font-outfit font-bold text-neutral-800 dark:text-neutral-200">Оргструктура</span>
                </div>

                {/* Pin / Unpin Button (Desktop >= 1200px / xl breakpoint only) */}
                <button
                  type="button"
                  onClick={onTogglePin}
                  className={`hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                    isPinned
                      ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-600 dark:text-indigo-300 shadow-sm'
                      : 'bg-neutral-200/60 dark:bg-neutral-800/60 border-neutral-300/60 dark:border-border text-neutral-600 dark:text-neutral-400 hover:text-indigo-500 hover:bg-neutral-200 dark:hover:bg-neutral-800'
                  }`}
                  title={isPinned ? 'Открепить панель' : 'Закрепить панель'}
                >
                  <Pin className={`w-3.5 h-3.5 transition-transform ${isPinned ? 'rotate-45 text-indigo-500 fill-indigo-500' : ''}`} />
                  <span>{isPinned ? 'Открепить' : 'Закрепить'}</span>
                </button>
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
                    className="w-full pl-9 pr-4 py-2 text-xs bg-white/60 dark:bg-background/80 border border-neutral-200/60 dark:border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder-neutral-400 dark:placeholder-neutral-500 text-neutral-800 dark:text-neutral-100"
                  />
                </div>
              </div>

              {/* Quick Links Section */}
              <div className="px-4 py-2 shrink-0 pl-6 space-y-1">
                <Link
                  to="/"
                  onClick={handleNavClose}
                  aria-current={isHomeActive ? 'page' : undefined}
                  className={`group flex items-center gap-3 px-3 py-1.5 rounded-xl text-xs border transition-colors ${
                    isHomeActive
                      ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-700 dark:text-indigo-300'
                      : 'text-neutral-700 dark:text-neutral-300 hover:bg-white/50 dark:hover:bg-card/70 hover:text-neutral-950 dark:hover:text-white border-transparent'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
                    isHomeActive
                      ? 'bg-indigo-500/15 text-indigo-500'
                      : 'bg-white/65 dark:bg-card text-neutral-500 dark:text-neutral-400 group-hover:bg-indigo-500/10 group-hover:text-indigo-500'
                  }`}>
                    <Home className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-semibold">Главная</span>
                </Link>
                {isStaff && (
                  <Link
                    to="/admin"
                    onClick={handleNavClose}
                    aria-current={isAdminActive ? 'page' : undefined}
                    className={`group flex items-center gap-3 px-3 py-1.5 rounded-xl text-xs border transition-colors ${
                      isAdminActive
                        ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-700 dark:text-indigo-300'
                        : 'text-neutral-700 dark:text-neutral-300 hover:bg-white/50 dark:hover:bg-card/70 hover:text-neutral-950 dark:hover:text-white border-transparent'
                    }`}
                  >
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
                    isAdminActive
                      ? 'bg-indigo-500/15 text-indigo-500'
                      : 'bg-white/65 dark:bg-card text-neutral-500 dark:text-neutral-400 group-hover:bg-indigo-500/10 group-hover:text-indigo-500'
                  }`}>
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
                <div className="flex flex-col items-center justify-center py-12 text-center select-none">
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
                        className="flex items-center justify-between px-2 py-2 rounded-xl bg-white/45 dark:bg-card/40 border border-neutral-200/40 dark:border-border/50 cursor-pointer hover:bg-white/80 dark:hover:bg-card/75 transition-all select-none"
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
                        <div className="pl-1.5 mt-1 border-l border-neutral-250/30 dark:border-border/40 space-y-1">
                          {space.sections.map(sec => renderSectionNode(sec, 0))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-4 pl-6 border-t border-neutral-200/40 dark:border-border bg-neutral-200/20 dark:bg-background/25 text-center shrink-0">
              <span className="text-[9px] text-neutral-405 dark:text-neutral-600 font-semibold tracking-wider">Wiki 2.0 • Оргструктура</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
