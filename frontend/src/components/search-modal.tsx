import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Sparkles, X, FileText, CornerDownLeft } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { searchArticles, SearchResult } from '../lib/api';
import { createPortal } from 'react-dom';

interface SearchBarProps {
  variant?: 'header' | 'hero';
}

export function SearchModal({ variant = 'header' }: SearchBarProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isFocused, setIsFocused] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(false);

  const navigate = useNavigate();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Listen for Cmd+K / Ctrl+K and Escape
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        
        if (window.innerWidth < 640) {
          setIsOpen((prev) => !prev);
          return;
        }

        // Focus matching search field on desktop
        if (variant === 'hero') {
          inputRef.current?.focus();
        } else if (variant === 'header') {
          const heroInput = document.querySelector('[data-search-variant="hero"]');
          if (!heroInput) {
            inputRef.current?.focus();
          }
        }
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
        setIsFocused(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [variant]);

  // Handle click outside to close dropdown on desktop
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    }
    if (isFocused) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFocused]);

  // Fetch results on query change
  React.useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const resData = await searchArticles(query);
        setResults(resData);
        setSelectedIndex(0);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  // Reset when closing mobile modal or blurring desktop input
  React.useEffect(() => {
    if (!isOpen && !isFocused) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [isOpen, isFocused]);

  const handleSelect = (slug: string, highlight?: string) => {
    setIsOpen(false);
    setIsFocused(false);
    inputRef.current?.blur();
    setQuery('');
    if (highlight) {
      navigate(`/articles/${slug}?highlight=${encodeURIComponent(highlight)}`);
    } else {
      navigate(`/articles/${slug}`);
    }
  };

  // Process results into Article Matches and Snippet Matches
  const matchedArticles = results;

  const textMatches = React.useMemo(() => {
    const list: {
      id: number;
      articleTitle: string;
      slug: string;
      categoryName: string;
      snippet: string;
      matchedWord: string;
    }[] = [];

    results.forEach((res) => {
      if (res.highlights && res.highlights.length > 0) {
        res.highlights.forEach((hl) => {
          const match = hl.match(/<mark[^>]*>(.*?)<\/mark>/i);
          const matchedWord = match ? match[1] : query;

          list.push({
            id: res.id,
            articleTitle: res.title,
            slug: res.slug,
            categoryName: res.categoryName,
            snippet: hl,
            matchedWord: matchedWord,
          });
        });
      }
    });
    return list;
  }, [results, query]);

  const totalItems = matchedArticles.length + textMatches.length;

  const handleListKeyDown = (e: React.KeyboardEvent) => {
    if (totalItems === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % totalItems);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + totalItems) % totalItems);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      
      if (selectedIndex < matchedArticles.length) {
        handleSelect(matchedArticles[selectedIndex].slug);
      } else {
        const textIdx = selectedIndex - matchedArticles.length;
        const match = textMatches[textIdx];
        handleSelect(match.slug, match.matchedWord);
      }
    }
  };

  const renderDropdownContent = () => {
    return (
      <div className="flex-1 overflow-y-auto p-2">
        {results.length === 0 && !isLoading && (
          <div className="py-6 text-center text-neutral-400 text-sm">
            Ничего не найдено по запросу &quot;<span className="text-neutral-900 dark:text-white font-semibold">{query}</span>&quot;.
          </div>
        )}

        {matchedArticles.length > 0 && (
          <div className="mb-4">
            <div className="px-3 py-1.5 text-xs font-semibold text-neutral-400 uppercase tracking-wider">
              Статьи
            </div>
            <ul className="space-y-0.5">
              {matchedArticles.map((art, idx) => {
                const isCurrent = idx === selectedIndex;
                return (
                  <li
                    key={`art-${art.id}`}
                    onMouseDown={() => handleSelect(art.slug)}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                      isCurrent
                        ? 'bg-indigo-500/10 text-indigo-900 dark:text-indigo-200 font-medium'
                        : 'hover:bg-neutral-50 dark:hover:bg-neutral-900/50 text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                      <span className="text-sm truncate max-w-[280px]" dangerouslySetInnerHTML={{ __html: art.title }} />
                      <span className="text-[9px] text-neutral-400 dark:text-neutral-500 bg-neutral-100 dark:bg-neutral-900 px-1.5 py-0.5 rounded uppercase font-medium shrink-0">
                        {(art.categoryName || '').replace('-', ' ')}
                      </span>
                    </div>
                    {isCurrent && <CornerDownLeft className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {textMatches.length > 0 && (
          <div>
            <div className="px-3 py-1.5 text-xs font-semibold text-neutral-400 uppercase tracking-wider">
              Совпадения в тексте
            </div>
            <ul className="space-y-1.5">
              {textMatches.map((match, idx) => {
                const globalIndex = matchedArticles.length + idx;
                const isCurrent = globalIndex === selectedIndex;
                return (
                  <li
                    key={`match-${match.slug}-${idx}`}
                    onMouseDown={() => handleSelect(match.slug, match.matchedWord)}
                    className={`p-2.5 rounded-lg cursor-pointer transition-colors border ${
                      isCurrent
                        ? 'bg-indigo-500/5 border-indigo-500/20 text-neutral-900 dark:text-neutral-50'
                        : 'hover:bg-neutral-50 dark:hover:bg-neutral-900/30 border-transparent text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500">
                        из: <strong className="text-neutral-600 dark:text-neutral-300 font-semibold" dangerouslySetInnerHTML={{ __html: match.articleTitle }} />
                      </span>
                      <span className="text-[9px] text-neutral-400 dark:text-neutral-500 bg-neutral-100 dark:bg-neutral-900 px-1.5 py-0.5 rounded uppercase font-medium">
                        {(match.categoryName || '').replace('-', ' ')}
                      </span>
                    </div>
                    
                    <p 
                      className="text-[11px] text-neutral-500 dark:text-neutral-400 border-l-2 border-neutral-200 dark:border-neutral-800 pl-2 mt-1 italic font-light leading-relaxed line-clamp-2"
                      dangerouslySetInnerHTML={{ __html: `... ${match.snippet} ...` }}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    );
  };

  const renderMobileModal = () => {
    return (
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[60] flex items-start justify-center pt-0 p-0">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-neutral-950/60 backdrop-blur-sm"
            />

            <motion.div
              initial={{ scale: 0.97, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.97, opacity: 0 }}
              transition={{ duration: 0.12, ease: 'easeOut' }}
              className="relative w-full h-full bg-white dark:bg-neutral-950 border-0 shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="flex items-center gap-3 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] border-b border-neutral-200 dark:border-neutral-800 shrink-0">
                <Search className="w-5 h-5 text-neutral-400 shrink-0" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Поиск..."
                  autoFocus
                  className="w-full bg-transparent text-neutral-900 dark:text-neutral-50 outline-none placeholder-neutral-400 text-base"
                />
                {isLoading && (
                  <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin shrink-0" />
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-md text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-2 max-h-[calc(100vh-7rem)]">
                {query.trim().length < 2 && (
                  <div className="py-8 text-center text-neutral-400 text-sm">
                    <Sparkles className="w-6 h-6 mx-auto mb-2 text-neutral-300 dark:text-neutral-700" />
                    Введите не менее 2 символов для поиска...
                  </div>
                )}

                {query.trim().length >= 2 && (
                  <>
                    {results.length === 0 && !isLoading && (
                      <div className="py-8 text-center text-neutral-400 text-sm">
                        Ничего не найдено по запросу &quot;<span className="text-neutral-900 dark:text-white font-semibold">{query}</span>&quot;.
                      </div>
                    )}

                    {matchedArticles.length > 0 && (
                      <div className="mb-4">
                        <div className="px-3 py-1.5 text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                          Статьи
                        </div>
                        <ul className="space-y-1">
                          {matchedArticles.map((art) => (
                            <li
                              key={`art-${art.id}`}
                              onClick={() => handleSelect(art.slug)}
                              className="flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-900/50 text-neutral-700 dark:text-neutral-300"
                            >
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                                <span dangerouslySetInnerHTML={{ __html: art.title }} />
                                <span className="text-[10px] text-neutral-400 dark:text-neutral-500 bg-neutral-100 dark:bg-neutral-900 px-1.5 py-0.5 rounded uppercase font-medium">
                                  {(art.categoryName || '').replace('-', ' ')}
                                </span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {textMatches.length > 0 && (
                      <div>
                        <div className="px-3 py-1.5 text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                          Совпадения в тексте
                        </div>
                        <ul className="space-y-2">
                          {textMatches.map((match, idx) => (
                            <li
                              key={`match-${match.slug}-${idx}`}
                              onClick={() => handleSelect(match.slug, match.matchedWord)}
                              className="p-3 rounded-lg cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-900/30 border-transparent text-neutral-700 dark:text-neutral-300"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium text-neutral-400 dark:text-neutral-500">
                                  из статьи: <strong className="text-neutral-600 dark:text-neutral-300 font-semibold" dangerouslySetInnerHTML={{ __html: match.articleTitle }} />
                                </span>
                                <span className="text-[10px] text-neutral-400 dark:text-neutral-500 bg-neutral-100 dark:bg-neutral-900 px-1.5 py-0.5 rounded uppercase font-medium">
                                  {(match.categoryName || '').replace('-', ' ')}
                                </span>
                              </div>
                              <p 
                                className="text-xs text-neutral-500 dark:text-neutral-400 border-l-2 border-neutral-200 dark:border-neutral-800 pl-2 mt-1.5 italic font-light leading-relaxed"
                                dangerouslySetInnerHTML={{ __html: `... ${match.snippet} ...` }}
                              />
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="flex items-center justify-between px-4 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] bg-neutral-50 dark:bg-neutral-900/40 border-t border-neutral-200/80 dark:border-neutral-900 text-[10px] text-neutral-400 select-none shrink-0">
                <div className="w-full text-center text-xs">Поиск с автодополнением</div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    );
  };

  if (variant === 'hero') {
    return (
      <div ref={containerRef} className="relative w-full max-w-2xl mx-auto">
        {/* Mobile trigger (looks like search bar) */}
        <div 
          onClick={() => setIsOpen(true)}
          className="sm:hidden flex items-center gap-4 px-5 py-4 rounded-xl border border-neutral-200 dark:border-neutral-800/80 bg-white dark:bg-neutral-950/80 hover:border-indigo-500/40 dark:hover:border-indigo-500/40 transition-all duration-300 cursor-pointer shadow-premium dark:shadow-premium-dark"
        >
          <Search className="w-5 h-5 text-neutral-400 shrink-0" />
          <span className="flex-1 text-left text-neutral-400 text-sm">
            Поиск по базе знаний...
          </span>
        </div>

        {/* Desktop inline input search bar */}
        <div 
          className={`hidden sm:flex items-center gap-4 px-5 py-4 rounded-xl border bg-white dark:bg-neutral-950/80 transition-all duration-300 shadow-premium dark:shadow-premium-dark ${
            isFocused 
              ? 'border-indigo-500/50 ring-2 ring-indigo-500/10 shadow-glow dark:shadow-glow' 
              : 'border-neutral-200 dark:border-neutral-800/80 hover:border-indigo-500/40 dark:hover:border-indigo-500/40 hover:shadow-glow dark:hover:shadow-glow'
          }`}
        >
          <Search className="w-5 h-5 text-neutral-400 shrink-0" />
          <input
            ref={inputRef}
            data-search-variant="hero"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onKeyDown={handleListKeyDown}
            placeholder="Поиск по базе знаний..."
            className="flex-1 bg-transparent border-0 outline-none text-base text-neutral-900 dark:text-neutral-50 placeholder-neutral-400"
          />
          {isLoading && (
            <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin shrink-0" />
          )}
          {!query && (
            <kbd className="hidden sm:inline-flex h-6 select-none items-center gap-0.5 rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 px-2 font-mono text-[11px] font-medium text-neutral-400">
              ⌘K
            </kbd>
          )}
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Desktop Dropdown */}
        <AnimatePresence>
          {isFocused && query.trim().length >= 2 && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.99 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[350px]"
            >
              {renderDropdownContent()}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile Modal Portal */}
        {createPortal(renderMobileModal(), document.body)}
      </div>
    );
  }

  // Default: variant === 'header'
  return (
    <div ref={containerRef} className="relative">
      {/* Mobile trigger */}
      <button
        onClick={() => setIsOpen(true)}
        className="sm:hidden flex items-center justify-center p-2 rounded-lg border border-neutral-200/50 dark:border-neutral-800/50 text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors"
      >
        <Search className="w-4 h-4" />
      </button>

      {/* Desktop inline input search bar */}
      <div 
        className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-neutral-200/50 dark:border-neutral-800/50 bg-neutral-50 dark:bg-neutral-900/50 text-neutral-500 dark:text-neutral-400 text-sm hover:border-neutral-300 dark:hover:border-neutral-700 transition-all duration-300 ${
          isFocused ? 'w-80 lg:w-[420px] ring-1 ring-indigo-500/20 border-indigo-500/40 bg-white dark:bg-neutral-950' : 'w-48 lg:w-64'
        }`}
      >
        <Search className="w-4 h-4 shrink-0 text-neutral-400" />
        <input
          ref={inputRef}
          data-search-variant="header"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onKeyDown={handleListKeyDown}
          placeholder="Поиск по вики..."
          className="flex-1 bg-transparent border-0 outline-none text-xs text-neutral-900 dark:text-neutral-50 placeholder-neutral-400 py-0.5"
        />
        {isLoading && (
          <div className="w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin shrink-0" />
        )}
        {!query && (
          <kbd className="hidden md:inline-flex h-4 select-none items-center gap-0.5 rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-1 font-mono text-[9px] font-medium text-neutral-400 opacity-100">
            <span>⌘</span>K
          </kbd>
        )}
        {query && (
          <button
            onClick={() => setQuery('')}
            className="p-0.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Desktop Dropdown */}
      <AnimatePresence>
        {isFocused && query.trim().length >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.99 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full right-0 mt-2 w-[420px] bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[350px]"
          >
            {renderDropdownContent()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Modal Portal */}
      {createPortal(renderMobileModal(), document.body)}
    </div>
  );
}
