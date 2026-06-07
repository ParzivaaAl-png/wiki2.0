import * as React from 'react';
import { 
  Bell, Pin, Search, X, Check, Inbox, MessageSquare 
} from 'lucide-react';
import { 
  fetchNews, fetchUnreadNewsCount, searchNews, 
  News, NewsSearchResult, fetchNewsDetail 
} from '../lib/api';
import { NewsCard } from './news-card';
import { AnimatePresence, motion } from 'framer-motion';

export function NewsBell() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [newsList, setNewsList] = React.useState<News[]>([]);
  const [selectedNews, setSelectedNews] = React.useState<News | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<NewsSearchResult[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);

  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Poll count and fetch news
  const loadUnreadCount = async () => {
    try {
      const count = await fetchUnreadNewsCount();
      setUnreadCount(count);
    } catch (e) {
      console.error('Failed to load unread count:', e);
    }
  };

  const loadNewsList = async () => {
    try {
      const list = await fetchNews();
      setNewsList(list);
    } catch (e) {
      console.error('Failed to load news list:', e);
    }
  };

  React.useEffect(() => {
    loadUnreadCount();
    loadNewsList();

    // Poll every 30 seconds
    const interval = setInterval(() => {
      loadUnreadCount();
      // Only reload news list if dropdown is closed to prevent reflows while reading
      if (!isOpen) {
        loadNewsList();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [isOpen]);

  // Click outside handler
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Search Meilisearch on query change
  React.useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchNews(searchQuery);
        setSearchResults(results);
      } catch (err) {
        console.error('Failed to search news:', err);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Mark single news as read on click
  const handleOpenNews = async (newsId: number) => {
    try {
      const detail = await fetchNewsDetail(newsId);
      setSelectedNews(detail);
      setIsOpen(false); // Close dropdown
      // Decrement local unread count if it was unread
      const clickedNews = newsList.find(n => n.id === newsId);
      if (clickedNews && !clickedNews.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
        // Update read status in local state
        setNewsList(prev => prev.map(n => n.id === newsId ? { ...n, is_read: true } : n));
      }
    } catch (e) {
      console.error('Failed to open news:', e);
    }
  };

  // Format date
  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      
      // Check if today
      if (date.toDateString() === now.toDateString()) {
        return `Сегодня в ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
      }
      
      return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div ref={dropdownRef} className="relative">
      
      {/* Bell Trigger Button */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className={`relative p-2 rounded-lg border border-neutral-200/50 dark:border-neutral-800/50 hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-all duration-300 text-neutral-550 dark:text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 group ${isOpen ? 'bg-neutral-100/80 dark:bg-neutral-900 text-indigo-600 dark:text-indigo-400' : ''}`}
        title="Уведомления и Новости"
      >
        <Bell className="w-4.5 h-4.5 group-hover:rotate-12 transition-transform duration-300" />
        
        {/* Count Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-white dark:ring-neutral-950 animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Dropdown Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="fixed left-4 right-4 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:w-96 mt-2 bg-white dark:bg-neutral-950 border border-neutral-200/60 dark:border-neutral-850/80 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[500px]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-150 dark:border-neutral-900 bg-neutral-50/50 dark:bg-neutral-900/40 shrink-0">
              <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />
                Новости компании
              </span>
              {unreadCount > 0 && (
                <span className="text-[10px] bg-red-500/10 dark:bg-red-500/20 text-red-500 px-2 py-0.5 rounded-full font-bold">
                  {unreadCount} новых
                </span>
              )}
            </div>

            {/* Search Input */}
            <div className="px-3 py-2 border-b border-neutral-100 dark:border-neutral-900 flex items-center gap-2 bg-neutral-50/30 dark:bg-neutral-950 shrink-0">
              <Search className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск новостей..."
                className="flex-1 bg-transparent text-xs border-0 outline-none text-neutral-800 dark:text-neutral-200 placeholder-neutral-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="p-0.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-900 text-neutral-400"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* News List Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar min-h-[220px]">
              
              {/* Searching results view */}
              {searchQuery.trim().length >= 2 ? (
                <div className="p-2 space-y-1">
                  <p className="text-[10px] text-neutral-400 font-semibold px-2 uppercase tracking-wider">Результаты поиска</p>
                  
                  {isSearching ? (
                    <div className="py-6 text-center text-xs text-neutral-400 flex items-center justify-center gap-2">
                      <div className="w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                      Поиск...
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="py-8 text-center text-xs text-neutral-450 dark:text-neutral-500 font-medium">
                      По запросу ничего не найдено
                    </div>
                  ) : (
                    searchResults.map((res) => (
                      <div
                        key={`search-res-${res.id}`}
                        onClick={() => handleOpenNews(res.id)}
                        className="p-2 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-900/60 cursor-pointer border border-transparent hover:border-neutral-150 dark:hover:border-neutral-850/60 transition-all space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <h4 
                            className="text-xs font-semibold text-neutral-800 dark:text-neutral-250 truncate flex-1"
                            dangerouslySetInnerHTML={{ __html: res.title }}
                          />
                          <span className="text-[9px] text-neutral-400 shrink-0">{formatDate(res.publishedAt).split(' в ')[0]}</span>
                        </div>
                        <p 
                          className="text-[10px] text-neutral-450 dark:text-neutral-400 line-clamp-1 italic font-light leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: res.description || '...' }}
                        />
                      </div>
                    ))
                  )}
                </div>
              ) : (
                /* Standard Latest News List */
                newsList.length === 0 ? (
                  <div className="py-12 px-4 text-center text-neutral-400 select-none flex flex-col items-center justify-center gap-2">
                    <Inbox className="w-8 h-8 text-neutral-300 dark:text-neutral-800" />
                    <p className="text-xs font-medium text-neutral-400 dark:text-neutral-600">Новостей пока нет</p>
                  </div>
                ) : (
                  <div className="divide-y divide-neutral-100 dark:divide-neutral-900">
                    {newsList.map((news) => {
                      const isUnread = !news.is_read;
                      return (
                        <div
                          key={`news-item-${news.id}`}
                          onClick={() => handleOpenNews(news.id)}
                          className={`p-3.5 cursor-pointer transition-all flex items-start gap-3 relative ${isUnread ? 'bg-indigo-500/[0.02] dark:bg-indigo-500/[0.01] hover:bg-indigo-500/[0.04]' : 'hover:bg-neutral-50/70 dark:hover:bg-neutral-900/30'}`}
                        >
                          {/* Unread indicator dot */}
                          {isUnread && (
                            <span className="absolute top-4 left-2 w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-500 shrink-0" />
                          )}
                          
                          <div className={`flex-1 min-w-0 space-y-1 ${isUnread ? 'pl-2' : ''}`}>
                            <div className="flex items-start justify-between gap-1.5">
                              <h3 className={`text-xs font-bold leading-tight truncate ${isUnread ? 'text-neutral-950 dark:text-white font-extrabold' : 'text-neutral-700 dark:text-neutral-350'}`}>
                                {news.title}
                              </h3>
                              <span className="text-[9px] text-neutral-400 font-medium shrink-0">
                                {formatDate(news.published_at)}
                              </span>
                            </div>

                            {news.description && (
                              <p className="text-[10px] text-neutral-400 dark:text-neutral-500 line-clamp-2 leading-relaxed">
                                {news.description}
                              </p>
                            )}

                            {/* Badges footer */}
                            <div className="flex items-center gap-1.5 pt-1 text-[8px] font-bold tracking-wider uppercase text-neutral-400">
                              {news.is_pinned && (
                                <span className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-500 bg-amber-500/10 px-1 py-0.5 rounded">
                                  <Pin className="w-2 h-2 fill-current" />
                                  Закреплено
                                </span>
                              )}
                              
                              {news.tags && news.tags.slice(0, 2).map(tag => (
                                <span key={tag} className="bg-neutral-100 dark:bg-neutral-900 px-1 py-0.5 rounded">
                                  #{tag}
                                </span>
                              ))}

                              {news.attachments && news.attachments.length > 0 && (
                                <span className="bg-indigo-100/50 dark:bg-indigo-950/20 text-indigo-500 px-1 py-0.5 rounded">
                                  Скрепка ({news.attachments.length})
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-neutral-100 dark:border-neutral-900 text-center select-none bg-neutral-50/20 dark:bg-neutral-900/10 shrink-0">
              <span className="text-[9px] text-neutral-400 font-semibold uppercase tracking-wider">Корпоративный портал Wiki 2.0</span>
            </div>

          </motion.div>
        )}
      </AnimatePresence>

      {/* News Viewer Modal */}
      <AnimatePresence>
        {selectedNews && (
          <NewsCard
            news={selectedNews}
            onClose={() => setSelectedNews(null)}
          />
        )}
      </AnimatePresence>

    </div>
  );
}
