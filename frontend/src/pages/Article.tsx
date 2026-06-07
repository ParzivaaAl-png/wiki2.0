import * as React from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  ChevronRight, 
  Tag, 
  Calendar, 
  Edit3, 
  ChevronDown,
  ArrowLeft,
  Star,
  History,
  X,
  Info,
  Loader2
} from 'lucide-react';
import { 
  fetchArticle, 
  Article as ArticleType,
  addFavoriteArticle,
  removeFavoriteArticle,
  fetchFavoriteArticles,
  fetchArticleChanges,
  ArticleChangeLog
} from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { AnimatePresence, motion } from 'framer-motion';
import TariffsClassifier from '../components/tariffs-classifier';
import TariffDetails from '../components/tariff-details';

const getTariffKeyFromSlug = (slug: string): string | null => {
  switch (slug) {
    case 'auto-list-эконом': return 'econom';
    case 'auto-list-межгород': return 'intercity';
    case 'auto-list-комфорт': return 'comfort';
    case 'auto-list-комфорт-plus': return 'comfort_plus';
    case 'auto-list-электро': return 'electro';
    case 'auto-list-бизнес': return 'business';
    case 'auto-list-ultima-тариф-premier': return 'ultima';
    default: return null;
  }
};

export default function ArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const [article, setArticle] = React.useState<ArticleType | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const { user } = useAuth();
  const [isFavorited, setIsFavorited] = React.useState(false);
  const [isFavoriteLoading, setIsFavoriteLoading] = React.useState(false);
  const [isChangesModalOpen, setIsChangesModalOpen] = React.useState(false);
  const [changesLog, setChangesLog] = React.useState<ArticleChangeLog[]>([]);
  const [isChangesLoading, setIsChangesLoading] = React.useState(false);

  // Fetch article data on slug change
  React.useEffect(() => {
    async function loadArticleData() {
      if (!slug) return;
      setIsLoading(true);
      try {
        const artData = await fetchArticle(slug);
        setArticle(artData);
      } catch (err) {
        console.error('Failed to load article:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadArticleData();
  }, [slug]);

  // Check favorite status if authenticated
  React.useEffect(() => {
    async function checkFavoriteStatus() {
      if (!user || !article) return;
      try {
        const favorites = await fetchFavoriteArticles();
        const found = favorites.some(fav => fav.id === article.id);
        setIsFavorited(found);
      } catch (err) {
        console.error('Failed to load favorites:', err);
      }
    }
    checkFavoriteStatus();
  }, [user, article]);

  const handleToggleFavorite = async () => {
    if (!user || !article || isFavoriteLoading) return;
    setIsFavoriteLoading(true);
    try {
      if (isFavorited) {
        await removeFavoriteArticle(article.id);
        setIsFavorited(false);
      } else {
        await addFavoriteArticle(article.id);
        setIsFavorited(true);
      }
    } catch (err: any) {
      console.error('Failed to update favorite status:', err);
      alert('Ошибка при обновлении избранного: ' + err.message);
    } finally {
      setIsFavoriteLoading(false);
    }
  };

  const handleOpenChangesModal = async () => {
    setIsChangesModalOpen(true);
    setIsChangesLoading(true);
    try {
      const logs = await fetchArticleChanges(article!.id);
      setChangesLog(logs);
    } catch (err: any) {
      console.error('Failed to fetch changes log:', err);
    } finally {
      setIsChangesLoading(false);
    }
  };

  // Effect to highlight and scroll to text
  React.useEffect(() => {
    if (!article || isLoading) return;
    
    const timer = setTimeout(() => {
      const queryParams = new URLSearchParams(location.search);
      const highlight = queryParams.get('highlight');
      if (highlight) {
        const articleContainer = document.querySelector('article');
        if (articleContainer) {
          highlightTextInDOM(articleContainer as HTMLElement, highlight);
        }
      }
    }, 150);
    
    return () => clearTimeout(timer);
  }, [article, isLoading, location.search]);

  // Parse Headings for Table of Contents
  const headings = React.useMemo(() => {
    if (!article) return [];
    const headingRegex = /^(#{2,3})\s+(.*)$/gm;
    const list: { level: number; text: string; id: string }[] = [];
    let match;
    const cleanContent = article.content.replace(/```[\s\S]*?```/g, '');
    
    while ((match = headingRegex.exec(cleanContent)) !== null) {
      const level = match[1].length;
      const text = match[2].replace(/\*|_|`/g, '').trim();
      const id = text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      list.push({ level, text, id });
    }
    return list;
  }, [article]);

  // Custom heading node hooks to link anchor tags
  const MarkdownComponents = {
    h2: ({ node, children, ...props }: any) => {
      const text = React.Children.toArray(children).join('');
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      return <h2 id={id} className="text-2xl font-bold mt-8 mb-4 border-b border-neutral-200 dark:border-neutral-800 pb-2" {...props}>{children}</h2>;
    },
    h3: ({ node, children, ...props }: any) => {
      const text = React.Children.toArray(children).join('');
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      return <h3 id={id} className="text-xl font-semibold mt-6 mb-3" {...props}>{children}</h3>;
    },
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 animate-pulse flex gap-8">
        <div className="flex-1 space-y-6">
          <div className="h-4 w-40 bg-neutral-200 dark:bg-neutral-800 rounded" />
          <div className="h-10 w-3/4 bg-neutral-200 dark:bg-neutral-800 rounded" />
          <div className="h-4 w-48 bg-neutral-200 dark:bg-neutral-800 rounded" />
          <div className="h-[300px] bg-neutral-200 dark:bg-neutral-800 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <h2 className="font-outfit text-xl font-bold">Статья не найдена</h2>
        <p className="text-sm text-neutral-400 mt-2">Запрошенная вами статья не существует или была удалена.</p>
        <Link to="/" className="inline-flex items-center gap-1 mt-4 text-xs font-semibold text-indigo-500 hover:underline">
          <ArrowLeft className="w-3.5 h-3.5" /> Назад на главную
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-8 flex gap-8">
      
      {/* Content Columns */}
      <div className="flex-1 min-w-0 py-4 sm:py-8">
        <div className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-neutral-400 dark:text-neutral-500 mb-4 sm:mb-6 font-medium overflow-x-auto whitespace-nowrap">
          <Link to="/" className="hover:text-indigo-500 transition-colors shrink-0">Главная</Link>
          <ChevronRight className="w-3 h-3 shrink-0" />
          <span className="text-neutral-600 dark:text-neutral-400 truncate max-w-[150px] sm:max-w-[200px]">{article.title}</span>
        </div>

        <article className="prose-custom">
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center justify-between gap-3 sm:gap-4 mb-6 border-b border-neutral-200/50 dark:border-neutral-800/80 pb-6">
            <div className="w-full sm:w-auto flex-1">
              <div className="flex items-center gap-3 mb-3 flex-wrap">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-neutral-950 dark:text-white">
                  {article.title}
                </h1>
                {user && (
                  <button
                    onClick={handleToggleFavorite}
                    disabled={isFavoriteLoading}
                    className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors shadow-sm cursor-pointer select-none text-neutral-400 dark:text-neutral-500 hover:text-amber-500 dark:hover:text-amber-400"
                    title={isFavorited ? "Удалить из избранного" : "Добавить в избранное"}
                  >
                    <Star
                      className={`w-5 h-5 transition-all ${
                        isFavorited
                          ? 'fill-amber-400 text-amber-400 scale-110'
                          : 'scale-100 hover:scale-110'
                      }`}
                    />
                  </button>
                )}
              </div>
              
              <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-400 dark:text-neutral-500 font-medium">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(article.updated_at).toLocaleDateString()}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleOpenChangesModal}
                className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors shrink-0 shadow-sm cursor-pointer"
                title="История изменений этой статьи"
              >
                <History className="w-3.5 h-3.5 text-indigo-500" />
                История изменений
              </button>

              <Link
                to={`/admin/editor/${article.id}`}
                className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors shrink-0 shadow-sm"
              >
                <Edit3 className="w-3.5 h-3.5 text-indigo-500" />
                Редактировать
              </Link>
            </div>
          </div>

          {article.latest_change && (
            <div className="mb-6 p-4 rounded-xl border border-indigo-150/40 dark:border-indigo-900/35 bg-indigo-50/20 dark:bg-indigo-950/5 flex items-start gap-3 shadow-sm text-xs text-neutral-700 dark:text-neutral-300">
              <Info className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <div className="font-bold text-indigo-950 dark:text-indigo-300 flex items-center gap-1.5 text-xs sm:text-sm">
                  <span>📢 Статья обновлена</span>
                </div>
                <div className="text-[11px] text-neutral-500 dark:text-neutral-450">
                  Последняя правка: <span className="font-semibold text-neutral-800 dark:text-neutral-200">{new Date(article.latest_change.changed_at).toLocaleString()}</span>
                  {article.latest_change.user_name && (
                    <>
                      {' '}автором <span className="font-semibold text-neutral-850 dark:text-neutral-150">{article.latest_change.user_name}</span> ({article.latest_change.user_role === 'Admin' ? 'Администратор' : article.latest_change.user_role === 'Editor' ? 'Редактор' : 'Пользователь'})
                    </>
                  )}
                </div>
                <div className="text-[11px] text-neutral-600 dark:text-neutral-400 mt-1.5 pl-2 border-l border-indigo-300 dark:border-indigo-850">
                  <span className="font-semibold text-neutral-700 dark:text-neutral-300">Изменения:</span> {article.latest_change.change_description}
                  {article.latest_change.editor_comment && (
                    <div className="mt-0.5 italic text-neutral-500 dark:text-neutral-450 font-light">
                      Комментарий редактора: "{article.latest_change.editor_comment}"
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {article.tags && article.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <Tag className="w-3.5 h-3.5 text-neutral-400" />
              {article.tags.map((tag) => (
                <span 
                  key={tag} 
                  className="text-xs px-2 py-0.5 rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/40 text-neutral-600 dark:text-neutral-400 font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Mobile Table of Contents */}
          {headings.length > 0 && (
            <div className="block xl:hidden mb-6 border border-neutral-200 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-neutral-900/30 rounded-xl p-4">
              <details className="group">
                <summary className="flex items-center justify-between text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider cursor-pointer list-none select-none">
                  <span>Содержание статьи</span>
                  <ChevronDown className="w-4 h-4 text-neutral-400 group-open:rotate-180 transition-transform" />
                </summary>
                <nav className="mt-3 space-y-2 border-l border-neutral-200 dark:border-neutral-800 pl-3">
                  {headings.map((heading) => (
                    <a
                      key={heading.id}
                      href={`#${heading.id}`}
                      className={`block text-xs text-neutral-600 dark:text-neutral-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors ${
                        heading.level === 3 ? 'pl-3 text-[11px] text-neutral-500 dark:text-neutral-500' : 'font-medium'
                      }`}
                    >
                      {heading.text}
                    </a>
                  ))}
                </nav>
              </details>
            </div>
          )}

          {(() => {
            if (article.slug === 'auto-list') {
              return <TariffsClassifier />;
            }
            const tariffKey = getTariffKeyFromSlug(article.slug);
            if (tariffKey) {
              return <TariffDetails tariffKey={tariffKey} />;
            }
            return (
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]} 
                components={MarkdownComponents}
              >
                {article.content}
              </ReactMarkdown>
            );
          })()}
        </article>
      </div>

      {/* Right ToC Sidebar */}
      {headings.length > 0 && (
        <aside className="hidden xl:block w-56 shrink-0 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto py-8">
          <div className="border-l border-neutral-200 dark:border-neutral-800 pl-4 space-y-4">
            <h4 className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
              На этой странице
            </h4>
            <nav className="space-y-2">
              {headings.map((heading) => (
                <a
                  key={heading.id}
                  href={`#${heading.id}`}
                  className={`block text-xs text-neutral-500 dark:text-neutral-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors ${
                    heading.level === 3 ? 'pl-3 text-[11px] text-neutral-400 dark:text-neutral-500' : 'font-medium'
                  }`}
                >
                  {heading.text}
                </a>
              ))}
            </nav>
          </div>
        </aside>
      )}

      {/* Changes Log Modal */}
      <AnimatePresence>
        {isChangesModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsChangesModalOpen(false)}
              className="absolute inset-0 bg-neutral-950/40 backdrop-blur-sm"
            />
            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 rounded-xl shadow-premium dark:shadow-premium-dark flex flex-col max-h-[80vh] overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-800">
                <h3 className="font-outfit text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                  <History className="w-4.5 h-4.5 text-indigo-500" />
                  История изменений статьи
                </h3>
                <button
                  onClick={() => setIsChangesModalOpen(false)}
                  className="p-1 rounded-md text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 overflow-y-auto space-y-4 flex-1">
                {isChangesLoading ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                    <span className="text-xs text-neutral-400">Загрузка истории правок...</span>
                  </div>
                ) : changesLog.length === 0 ? (
                  <div className="text-center py-10 text-xs text-neutral-400 italic">
                    У этой статьи пока нет записанных изменений в журнале.
                  </div>
                ) : (
                  <div className="space-y-4 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-[1px] before:bg-neutral-200/50 dark:before:bg-neutral-800/50">
                    {changesLog.map((log) => (
                      <div key={log.id} className="relative pl-7 text-xs">
                        {/* Dot */}
                        <div className="absolute left-[9px] top-1.5 w-2 h-2 rounded-full bg-indigo-500 ring-4 ring-white dark:ring-neutral-950" />
                        
                        <div className="flex items-center justify-between gap-2 text-[10px] text-neutral-400 mb-1">
                          <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                            {log.user_name || 'Система'} 
                            {log.user_role && ` (${log.user_role === 'Admin' ? 'Админ' : log.user_role === 'Editor' ? 'Редактор' : 'Пользователь'})`}
                          </span>
                          <span>
                            {new Date(log.changed_at).toLocaleString()}
                          </span>
                        </div>
                        
                        <div className="bg-neutral-50 dark:bg-neutral-900/30 p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-1.5">
                          <div>
                            <span className="font-semibold text-neutral-700 dark:text-neutral-300 font-mono text-[10px]">ИЗМЕНЕНИЯ:</span>{' '}
                            {log.change_description}
                          </div>
                          {log.editor_comment && (
                            <div className="text-[11px] text-neutral-450 dark:text-neutral-500 italic pl-1.5 border-l-2 border-indigo-500/30">
                              "{log.editor_comment}"
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

function highlightTextInDOM(container: HTMLElement, textToHighlight: string) {
  if (!textToHighlight || textToHighlight.trim().length === 0) return;

  const escapeRegExp = (str: string) => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  const regex = new RegExp(`(${escapeRegExp(textToHighlight)})`, 'gi');
  const walk = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
  const nodesToReplace: Text[] = [];

  let currentNode = walk.nextNode();
  while (currentNode) {
    const parent = currentNode.parentNode;
    if (
      currentNode.nodeValue && 
      regex.test(currentNode.nodeValue) &&
      parent &&
      parent.nodeName !== 'SCRIPT' &&
      parent.nodeName !== 'STYLE' &&
      parent.nodeName !== 'MARK' &&
      parent.nodeName !== 'TEXTAREA'
    ) {
      nodesToReplace.push(currentNode as Text);
    }
    currentNode = walk.nextNode();
  }

  let firstMark: HTMLElement | null = null;

  nodesToReplace.forEach((node) => {
    const parent = node.parentNode;
    if (!parent) return;

    const text = node.nodeValue || '';
    const fragments = document.createDocumentFragment();
    let lastIndex = 0;

    regex.lastIndex = 0;

    text.replace(regex, (match, p1, offset) => {
      if (offset > lastIndex) {
        fragments.appendChild(document.createTextNode(text.substring(lastIndex, offset)));
      }

      const mark = document.createElement('mark');
      mark.className = 'bg-yellow-200 dark:bg-yellow-500/40 text-neutral-900 dark:text-white px-1 py-0.5 rounded font-bold shadow-sm inline-block';
      mark.textContent = match;
      fragments.appendChild(mark);

      if (!firstMark) {
        firstMark = mark;
      }

      lastIndex = offset + match.length;
      return match;
    });

    if (lastIndex < text.length) {
      fragments.appendChild(document.createTextNode(text.substring(lastIndex)));
    }

    try {
      parent.replaceChild(fragments, node);
    } catch (e) {
      console.warn('Failed to replace node for highlight:', e);
    }
  });

  if (firstMark) {
    setTimeout(() => {
      (firstMark as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }
}
