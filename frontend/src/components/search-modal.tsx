'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Search, Sparkles, X, FileText, CornerDownLeft } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { suggestArticles, searchArticles, SearchResult, Suggestion } from '../lib/api';

export function SearchModal() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [suggestions, setSuggestions] = React.useState<Suggestion[]>([]);
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(false);

  const router = useRouter();

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

  // Fetch suggestions and results on query change
  React.useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        // Fetch autocomplete suggestions
        const sugData = await suggestArticles(query);
        setSuggestions(sugData);

        // Fetch detailed results (with highlighting)
        const resData = await searchArticles(query);
        setResults(resData);
        
        setSelectedIndex(0);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsLoading(false);
      }
    }, 200); // debounce API calls

    return () => clearTimeout(timer);
  }, [query]);

  // Reset when closing
  React.useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setSuggestions([]);
      setResults([]);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const handleSelect = (slug: string) => {
    setIsOpen(false);
    router.push(`/articles/${slug}`);
  };

  // Keyboard navigation inside list
  const totalItems = suggestions.length + results.length;

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
      
      // Determine which item is selected
      if (selectedIndex < suggestions.length) {
        handleSelect(suggestions[selectedIndex].slug);
      } else {
        const resultIndex = selectedIndex - suggestions.length;
        handleSelect(results[resultIndex].slug);
      }
    }
  };

  return (
    <>
      {/* Trigger Button (Visible in layout) */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-neutral-200/50 dark:border-neutral-800/50 bg-neutral-50 dark:bg-neutral-900/50 text-neutral-500 dark:text-neutral-400 text-sm hover:border-neutral-300 dark:hover:border-neutral-700 hover:text-neutral-800 dark:hover:text-neutral-200 transition-all w-48 md:w-64"
      >
        <Search className="w-4 h-4" />
        <span className="flex-1 text-left">Search wiki...</span>
        <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-0.5 rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-1.5 font-mono text-[10px] font-medium text-neutral-400 opacity-100">
          <span>⌘</span>K
        </kbd>
      </button>

      {/* Portal Overlay & Modal */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 md:pt-32 p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-neutral-950/60 backdrop-blur-sm"
            />

            {/* Modal Dialog */}
            <motion.div
              initial={{ scale: 0.97, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.97, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative w-full max-w-2xl bg-white dark:bg-neutral-950 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden"
            >
              {/* Input Box */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
                <Search className="w-5 h-5 text-neutral-400 shrink-0" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleListKeyDown}
                  placeholder="Search articles, topics, and code..."
                  autoFocus
                  className="w-full bg-transparent text-neutral-900 dark:text-neutral-50 outline-none placeholder-neutral-400 text-base"
                />
                {isLoading && (
                  <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin shrink-0" />
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-md text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900 hover:text-neutral-600 dark:hover:text-neutral-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Suggestions & Results Pane */}
              <div className="max-h-[60vh] overflow-y-auto p-2">
                {query.trim().length < 2 && (
                  <div className="py-8 text-center text-neutral-400 text-sm">
                    <Sparkles className="w-6 h-6 mx-auto mb-2 text-neutral-300 dark:text-neutral-700" />
                    Type at least 2 characters to search...
                  </div>
                )}

                {query.trim().length >= 2 && suggestions.length === 0 && results.length === 0 && !isLoading && (
                  <div className="py-8 text-center text-neutral-400 text-sm">
                    No results found for &quot;<span className="text-neutral-900 dark:text-white font-semibold">{query}</span>&quot;.
                  </div>
                )}

                {/* Autocomplete Suggestions Section */}
                {suggestions.length > 0 && (
                  <div className="mb-4">
                    <div className="px-3 py-1.5 text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                      Suggestions
                    </div>
                    <ul className="space-y-1">
                      {suggestions.map((sug, idx) => {
                        const isCurrent = idx === selectedIndex;
                        return (
                          <li
                            key={`sug-${sug.id}`}
                            onClick={() => handleSelect(sug.slug)}
                            className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                              isCurrent
                                ? 'bg-indigo-500/10 text-indigo-900 dark:text-indigo-200 font-medium'
                                : 'hover:bg-neutral-50 dark:hover:bg-neutral-900/50 text-neutral-700 dark:text-neutral-300'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                              <span>{sug.title}</span>
                              <span className="text-xs text-neutral-400 dark:text-neutral-500 bg-neutral-100 dark:bg-neutral-900 px-1.5 py-0.5 rounded uppercase">
                                {sug.categoryName}
                              </span>
                            </div>
                            {isCurrent && <CornerDownLeft className="w-3.5 h-3.5 text-indigo-400" />}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {/* Full-Text Matches (with highlighted summaries) */}
                {results.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                      Matching Content
                    </div>
                    <ul className="space-y-2">
                      {results.map((res, idx) => {
                        const globalIndex = suggestions.length + idx;
                        const isCurrent = globalIndex === selectedIndex;
                        return (
                          <li
                            key={`res-${res.id}`}
                            onClick={() => handleSelect(res.slug)}
                            className={`p-3 rounded-lg cursor-pointer transition-colors border ${
                              isCurrent
                                ? 'bg-indigo-500/5 border-indigo-500/20 text-neutral-900 dark:text-neutral-50'
                                : 'hover:bg-neutral-50 dark:hover:bg-neutral-900/30 border-transparent text-neutral-700 dark:text-neutral-300'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <h4 
                                className="font-semibold text-sm text-neutral-950 dark:text-white"
                                dangerouslySetInnerHTML={{ __html: res.title }}
                              />
                              <span className="text-xs text-neutral-400 dark:text-neutral-500 capitalize">
                                {res.categoryName.replace('-', ' ')}
                              </span>
                            </div>
                            
                            {/* Render search highlights */}
                            {res.highlights && res.highlights.length > 0 ? (
                              <div className="text-xs text-neutral-500 dark:text-neutral-400 space-y-1 mt-1 border-l-2 border-neutral-200 dark:border-neutral-800 pl-2">
                                {res.highlights.map((hl, hIdx) => (
                                  <p key={hIdx} dangerouslySetInnerHTML={{ __html: `... ${hl} ...` }} />
                                ))}
                              </div>
                            ) : (
                              <p 
                                className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-1"
                                dangerouslySetInnerHTML={{ __html: res.summary }}
                              />
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>

              {/* Footer Guide */}
              <div className="flex items-center justify-between px-4 py-2 bg-neutral-50 dark:bg-neutral-900/40 border-t border-neutral-200/80 dark:border-neutral-900 text-[10px] text-neutral-400 select-none">
                <div className="flex gap-3">
                  <span><kbd className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-1 rounded shadow-sm">↑↓</kbd> Navigate</span>
                  <span><kbd className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-1 rounded shadow-sm">Enter</kbd> Open</span>
                  <span><kbd className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-1 rounded shadow-sm">Esc</kbd> Close</span>
                </div>
                <div>Fuzzy Autocomplete Active</div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
