import * as React from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  ChevronRight, 
  Menu, 
  X, 
  Tag, 
  Calendar, 
  Edit3, 
  BookOpen, 
  ChevronDown,
  ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchArticle, fetchCategories, fetchArticles, Article as ArticleType, Category } from '../lib/api';

export default function ArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const [article, setArticle] = React.useState<ArticleType | null>(null);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [allArticles, setAllArticles] = React.useState<ArticleType[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = React.useState(false);
  const [expandedCategories, setExpandedCategories] = React.useState<Record<string, boolean>>({});

  // Fetch article data on slug change
  React.useEffect(() => {
    async function loadArticleData() {
      if (!slug) return;
      setIsLoading(true);
      try {
        const [artData, catsData, artsList] = await Promise.all([
          fetchArticle(slug),
          fetchCategories(),
          fetchArticles(),
        ]);
        setArticle(artData);
        setCategories(catsData);
        setAllArticles(artsList);
        
        // Auto-expand category
        if (artData.category_slug) {
          setExpandedCategories(prev => ({ ...prev, [artData.category_slug!]: true }));
        }
      } catch (err) {
        console.error('Failed to load article:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadArticleData();
  }, [slug]);

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

  const toggleCategory = (slugStr: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [slugStr]: !prev[slugStr]
    }));
  };

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

  // Group articles by category
  const articlesByCategory = React.useMemo(() => {
    const map: Record<string, ArticleType[]> = {};
    allArticles.forEach(art => {
      if (art.category_slug) {
        if (!map[art.category_slug]) map[art.category_slug] = [];
        map[art.category_slug].push(art);
      }
    });
    return map;
  }, [allArticles]);

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 animate-pulse flex gap-6">
        <div className="hidden lg:block w-64 h-[500px] bg-neutral-200 dark:bg-neutral-800 rounded-xl" />
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

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white dark:bg-neutral-950 p-4 border-r border-neutral-200/50 dark:border-neutral-800/50">
      <div className="flex items-center gap-2 mb-6 px-2 text-indigo-500 font-semibold tracking-tight text-sm uppercase">
        <BookOpen className="w-4 h-4" />
        <span>Вики-документация</span>
      </div>

      <nav className="flex-1 overflow-y-auto space-y-1 pr-1">
        {categories.map((cat) => {
          const isExpanded = !!expandedCategories[cat.slug];
          const catArticles = articlesByCategory[cat.slug] || [];
          const isCurrentCat = article.category_slug === cat.slug;

          return (
            <div key={cat.id} className="space-y-0.5">
              <button
                onClick={() => toggleCategory(cat.slug)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-sm text-left font-medium transition-colors ${
                  isCurrentCat 
                    ? 'text-neutral-900 dark:text-white bg-neutral-50 dark:bg-neutral-900/40' 
                    : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-900/20 hover:text-neutral-800 dark:hover:text-neutral-200'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="text-neutral-400 dark:text-neutral-500 shrink-0">
                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </span>
                  <span className="truncate">{cat.name}</span>
                </div>
                <span className="text-[10px] text-neutral-400 dark:text-neutral-500 bg-neutral-100 dark:bg-neutral-900 px-1.5 py-0.5 rounded">
                  {catArticles.length}
                </span>
              </button>

              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.12 }}
                    className="overflow-hidden pl-5 border-l border-neutral-200 dark:border-neutral-800 ml-4 space-y-0.5"
                  >
                    {catArticles.length === 0 ? (
                      <span className="block px-3 py-1.5 text-xs text-neutral-400 dark:text-neutral-600 italic">Нет статей</span>
                    ) : (
                      catArticles.map((art) => {
                        const isCurrentArticle = article.id === art.id;
                        return (
                          <Link
                            key={art.id}
                            to={`/articles/${art.slug}`}
                            className={`block px-3 py-1.5 rounded-lg text-xs transition-colors truncate ${
                              isCurrentArticle
                                ? 'bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 font-semibold'
                                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                            }`}
                          >
                            {art.title}
                          </Link>
                        );
                      })
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-6">
      
      {/* Left Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
        {sidebarContent}
      </aside>

      {/* Mobile Trigger */}
      <div className="lg:hidden fixed bottom-4 right-4 z-40">
        <button
          onClick={() => setIsMobileSidebarOpen(true)}
          className="p-3 rounded-full bg-indigo-600 text-white shadow-lg flex items-center justify-center hover:bg-indigo-700 transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      <AnimatePresence>
        {isMobileSidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileSidebarOpen(false)}
              className="fixed inset-0 bg-neutral-950/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.18 }}
              className="relative w-80 max-w-[85vw] h-full"
            >
              <button
                onClick={() => setIsMobileSidebarOpen(false)}
                className="absolute top-4 right-4 p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-neutral-500 z-55"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="h-full pt-12">
                {sidebarContent}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Content Columns */}
      <div className="flex-1 min-w-0 py-8 lg:px-4">
        <div className="flex items-center gap-1.5 text-xs text-neutral-400 dark:text-neutral-500 mb-6 font-medium">
          <Link to="/" className="hover:text-indigo-500 transition-colors">Главная</Link>
          <ChevronRight className="w-3 h-3" />
          {article.category_name && (
            <>
              <Link to={`/categories/${article.category_slug}`} className="hover:text-indigo-500 transition-colors">
                {article.category_name}
              </Link>
              <ChevronRight className="w-3 h-3" />
            </>
          )}
          <span className="text-neutral-600 dark:text-neutral-400 truncate max-w-[200px]">{article.title}</span>
        </div>

        <article className="prose-custom">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6 border-b border-neutral-200/50 dark:border-neutral-800/80 pb-6">
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-950 dark:text-white mb-3">
                {article.title}
              </h1>
              
              <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-400 dark:text-neutral-500">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(article.updated_at).toLocaleDateString()}
                </span>
              </div>
            </div>

            <Link
              to={`/admin/editor/${article.id}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors shrink-0 shadow-sm"
            >
              <Edit3 className="w-3.5 h-3.5 text-indigo-500" />
              Редактировать
            </Link>
          </div>

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

          <ReactMarkdown 
            remarkPlugins={[remarkGfm]} 
            components={MarkdownComponents}
          >
            {article.content}
          </ReactMarkdown>
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
