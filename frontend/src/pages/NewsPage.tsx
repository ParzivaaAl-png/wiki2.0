import * as React from 'react';
import { 
  Newspaper, Pin, Search, X, Video, Paperclip, Calendar, ArrowLeft, Inbox, Eye
} from 'lucide-react';
import { 
  fetchNews, fetchUnreadNewsCount, searchNews, 
  News, NewsSearchResult, fetchNewsDetail 
} from '../lib/api';
import { NewsCard } from '../components/news-card';
import { Link } from 'react-router-dom';

export default function NewsPage() {
  const [newsList, setNewsList] = React.useState<News[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [selectedNews, setSelectedNews] = React.useState<News | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<NewsSearchResult[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);

  const loadNewsData = async () => {
    try {
      const [list, count] = await Promise.all([
        fetchNews(),
        fetchUnreadNewsCount(),
      ]);
      setNewsList(list);
      setUnreadCount(count);
    } catch (err) {
      console.error('Failed to load news:', err);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadNewsData();
  }, []);

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
        console.error('Search news failed:', err);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleOpenNews = async (newsId: number) => {
    try {
      const detail = await fetchNewsDetail(newsId);
      setSelectedNews(detail);

      // Decrement unread count if it was unread
      const clicked = newsList.find(n => n.id === newsId);
      if (clicked && !clicked.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
        setNewsList(prev => prev.map(n => n.id === newsId ? { ...n, is_read: true } : n));
      }
    } catch (err) {
      console.error('Failed to load news detail:', err);
    }
  };

  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8 animate-fadeIn">
      {/* Header Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="p-2 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground transition-all shrink-0"
            title="На главную"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-outfit text-2xl sm:text-3xl font-extrabold text-foreground flex items-center gap-2">
                <Newspaper className="w-7 h-7 text-indigo-500" />
                Новости компании
              </h1>
              {unreadCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  {unreadCount > 9 ? '9+' : `${unreadCount} новых`}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Актуальные события, обновления регламентов и корпоративные объявления.
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по новостям..."
            className="w-full pl-9 pr-8 py-2 bg-card border border-border rounded-xl text-xs text-foreground outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Search Results */}
      {searchQuery.trim().length >= 2 ? (
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Результаты поиска ({searchResults.length})
          </h3>
          {isSearching ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Поиск...</div>
          ) : searchResults.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">По вашему запросу ничего не найдено</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {searchResults.map((res) => (
                <div
                  key={`search-${res.id}`}
                  onClick={() => handleOpenNews(res.id)}
                  className="p-4 rounded-2xl border border-border bg-card hover:border-indigo-500/30 hover:shadow-lg transition-all cursor-pointer space-y-2"
                >
                  <h4 className="font-bold text-sm text-foreground line-clamp-1" dangerouslySetInnerHTML={{ __html: res.title }} />
                  <p className="text-xs text-muted-foreground line-clamp-2" dangerouslySetInnerHTML={{ __html: res.description || '...' }} />
                  <div className="text-[10px] text-muted-foreground pt-2 flex items-center justify-between">
                    <span>{formatDate(res.publishedAt)}</span>
                    <span className="text-indigo-500 font-semibold flex items-center gap-1">
                      Читать <Eye className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Regular News Grid */
        <div>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-44 bg-card rounded-2xl border border-border" />
              ))}
            </div>
          ) : newsList.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground space-y-3">
              <Inbox className="w-12 h-12 mx-auto text-neutral-300 dark:text-neutral-700" />
              <p className="text-sm font-medium">Новостей пока нет</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {newsList.map((news) => {
                const isUnread = !news.is_read;
                return (
                  <div
                    key={news.id}
                    onClick={() => handleOpenNews(news.id)}
                    className={`group relative p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-4 ${
                      isUnread 
                        ? 'border-indigo-500/40 bg-indigo-500/[0.02] shadow-sm hover:shadow-md' 
                        : 'border-border bg-card hover:border-indigo-500/20 hover:bg-muted/40'
                    }`}
                  >
                    {isUnread && (
                      <span className="absolute top-4 right-4 px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-indigo-500 text-white uppercase tracking-wider shadow-sm">
                        Новая
                      </span>
                    )}

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {news.is_pinned && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                            <Pin className="w-3 h-3 fill-current" />
                            Закреплено
                          </span>
                        )}
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(news.published_at)}
                        </span>
                      </div>

                      <h3 className={`text-base font-extrabold leading-snug group-hover:text-indigo-500 transition-colors ${isUnread ? 'text-foreground' : 'text-neutral-800 dark:text-neutral-200'}`}>
                        {news.title}
                      </h3>

                      {news.description && (
                        <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed font-light">
                          {news.description}
                        </p>
                      )}
                    </div>

                    {/* Bottom Metadata & Attachments */}
                    <div className="pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-2 text-[10px] font-semibold">
                        {news.attachments && news.attachments.length > 0 && (
                          <span className="inline-flex items-center gap-1 bg-muted px-2 py-0.5 rounded">
                            <Paperclip className="w-3 h-3 text-indigo-500" />
                            {news.attachments.length} файлов
                          </span>
                        )}
                        {news.video_url && (
                          <span className="inline-flex items-center gap-1 bg-muted px-2 py-0.5 rounded text-indigo-500">
                            <Video className="w-3 h-3" />
                            Видео
                          </span>
                        )}
                      </div>

                      <span className="font-bold text-indigo-500 text-xs group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                        Открыть →
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* News Detail Modal */}
      {selectedNews && (
        <NewsCard
          news={selectedNews}
          onClose={() => setSelectedNews(null)}
        />
      )}
    </div>
  );
}
