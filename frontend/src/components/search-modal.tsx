import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Sparkles, X, FileText, CornerDownLeft } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { searchArticles, SearchResult } from '../lib/api';

export function SearchModal() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(false);

  const navigate = useNavigate();

  // Listen for Cmd+K / Ctrl+K
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  // Reset when closing
  React.useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const handleSelect = (slug: string, highlight?: string) => {
    setIsOpen(false);
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
          // Extract matching word from tag: <mark class="...">word</mark>
          const match = hl.match(/<mark[^>]*>(.*?)<\/mark>/i);
          const matchedWord = match ? match[1] : query;

          // Strip HTML tags from snippet context for better highlight match in article
          // but we keep the mark format for the modal preview rendering
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

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-neutral-200/50 dark:border-neutral-800/50 bg-neutral-50 dark:bg-neutral-900/50 text-neutral-500 dark:text-neutral-400 text-sm hover:border-neutral-300 dark:hover:border-neutral-700 hover:text-neutral-800 dark:hover:text-neutral-200 transition-all w-10 sm:w-48 md:w-64"
      >
        <Search className="w-4 h-4 shrink-0" />
        <span className="hidden sm:block flex-1 text-left">Поиск по вики...</span>
        <kbd className="hidden md:inline-flex h-5 select-none items-center gap-0.5 rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-1.5 font-mono text-[10px] font-medium text-neutral-400 opacity-100">
          <span>⌘</span>K
        </kbd>
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[60] flex items-start justify-center pt-4 sm:pt-20 md:pt-32 p-0 sm:p-4">
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
              className="relative w-full h-full sm:h-auto sm:max-w-2xl bg-white dark:bg-neutral-950 sm:rounded-xl border-0 sm:border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 shrink-0">
                <Search className="w-5 h-5 text-neutral-400 shrink-0" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleListKeyDown}
                  placeholder="Поиск статей, разделов и кода..."
                  autoFocus
                  className="w-full bg-transparent text-neutral-900 dark:text-neutral-50 outline-none placeholder-neutral-400 text-base"
                />
                {isLoading && (
                  <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin shrink-0" />
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-md text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900 hover:text-neutral-600 dark:hover:text-neutral-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-2 max-h-[calc(100vh-7rem)] sm:max-h-[60vh]">
                {query.trim().length < 2 && (
                  <div className="py-8 text-center text-neutral-400 text-sm">
                    <Sparkles className="w-6 h-6 mx-auto mb-2 text-neutral-300 dark:text-neutral-700" />
                    Введите не менее 2 символов для поиска...
                  </div>
                )}

                {query.trim().length >= 2 && matchedArticles.length === 0 && textMatches.length === 0 && !isLoading && (
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
                      {matchedArticles.map((art, idx) => {
                        const isCurrent = idx === selectedIndex;
                        return (
                          <li
                            key={`art-${art.id}`}
                            onClick={() => handleSelect(art.slug)}
                            className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                              isCurrent
                                ? 'bg-indigo-500/10 text-indigo-900 dark:text-indigo-200 font-medium'
                                : 'hover:bg-neutral-50 dark:hover:bg-neutral-900/50 text-neutral-700 dark:text-neutral-300'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                              <span dangerouslySetInnerHTML={{ __html: art.title }} />
                              <span className="text-[10px] text-neutral-400 dark:text-neutral-500 bg-neutral-100 dark:bg-neutral-900 px-1.5 py-0.5 rounded uppercase font-medium">
                                {art.categoryName.replace('-', ' ')}
                              </span>
                            </div>
                            {isCurrent && <CornerDownLeft className="w-3.5 h-3.5 text-indigo-400" />}
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
                    <ul className="space-y-2">
                      {textMatches.map((match, idx) => {
                        const globalIndex = matchedArticles.length + idx;
                        const isCurrent = globalIndex === selectedIndex;
                        return (
                          <li
                            key={`match-${match.slug}-${idx}`}
                            onClick={() => handleSelect(match.slug, match.matchedWord)}
                            className={`p-3 rounded-lg cursor-pointer transition-colors border ${
                              isCurrent
                                ? 'bg-indigo-500/5 border-indigo-500/20 text-neutral-900 dark:text-neutral-50'
                                : 'hover:bg-neutral-50 dark:hover:bg-neutral-900/30 border-transparent text-neutral-700 dark:text-neutral-300'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-neutral-400 dark:text-neutral-500">
                                из статьи: <strong className="text-neutral-600 dark:text-neutral-300 font-semibold" dangerouslySetInnerHTML={{ __html: match.articleTitle }} />
                              </span>
                              <span className="text-[10px] text-neutral-400 dark:text-neutral-500 bg-neutral-100 dark:bg-neutral-900 px-1.5 py-0.5 rounded uppercase font-medium">
                                {match.categoryName.replace('-', ' ')}
                              </span>
                            </div>
                            
                            <p 
                              className="text-xs text-neutral-500 dark:text-neutral-400 border-l-2 border-neutral-200 dark:border-neutral-800 pl-2 mt-1.5 italic font-light leading-relaxed"
                              dangerouslySetInnerHTML={{ __html: `... ${match.snippet} ...` }}
                            />
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between px-4 py-2 bg-neutral-50 dark:bg-neutral-900/40 border-t border-neutral-200/80 dark:border-neutral-900 text-[10px] text-neutral-400 select-none shrink-0">
                <div className="hidden sm:flex gap-3">
                  <span><kbd className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-1 rounded shadow-sm">↑↓</kbd> Навигация</span>
                  <span><kbd className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-1 rounded shadow-sm">Enter</kbd> Открыть</span>
                  <span><kbd className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-1 rounded shadow-sm">Esc</kbd> Закрыть</span>
                </div>
                <div className="w-full sm:w-auto text-center sm:text-right text-xs sm:text-[10px]">Поиск с автодополнением</div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
