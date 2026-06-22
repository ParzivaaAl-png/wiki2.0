import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  X, 
  Monitor, 
  Smartphone, 
  ChevronRight, 
  Calendar, 
  Tag, 
  ArrowLeft,
  BookOpen,
  RotateCw,
  Globe,
  FileText,
  ChevronDown
} from 'lucide-react';
import { Article } from '../lib/api';

interface PreviewModalProps {
  article?: Article | null;
  category?: any;
  categories?: any[];
  articles: Article[];
  onClose: () => void;
}

export default function PreviewModal({ 
  article, 
  articles, 
  onClose 
}: PreviewModalProps) {
  const [viewport, setViewport] = React.useState<'desktop' | 'mobile'>('desktop');
  
  // URL address bar simulation
  const mockUrl = React.useMemo(() => {
    const base = 'https://wiki2-frontend.vercel.app';
    if (article) return `${base}/articles/${article.slug}`;
    return base;
  }, [article]);

  // Group articles by category for article sidebar preview


  // Parse headings for table of contents in preview
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



  const MarkdownComponents = {
    h2: ({ children, ...props }: any) => {
      const text = React.Children.toArray(children).join('');
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      return <h2 id={id} className="text-xl sm:text-2xl font-bold mt-6 mb-3 border-b border-neutral-100 dark:border-neutral-900 pb-1.5" {...props}>{children}</h2>;
    },
    h3: ({ children, ...props }: any) => {
      const text = React.Children.toArray(children).join('');
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      return <h3 id={id} className="text-lg font-semibold mt-4 mb-2" {...props}>{children}</h3>;
    },
    p: ({ children, ...props }: any) => (
      <p className="text-xs sm:text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4 font-light" {...props}>{children}</p>
    ),
    ul: ({ children, ...props }: any) => (
      <ul className="list-disc pl-5 mb-4 text-xs sm:text-sm text-neutral-700 dark:text-neutral-300 space-y-1" {...props}>{children}</ul>
    ),
    ol: ({ children, ...props }: any) => (
      <ol className="list-decimal pl-5 mb-4 text-xs sm:text-sm text-neutral-700 dark:text-neutral-300 space-y-1" {...props}>{children}</ol>
    ),
    li: ({ children, ...props }: any) => (
      <li className="font-light" {...props}>{children}</li>
    ),
    code: ({ inline, children, ...props }: any) => (
      inline 
        ? <code className="bg-neutral-100 dark:bg-neutral-900 px-1 py-0.5 rounded text-[11px] font-mono text-indigo-500" {...props}>{children}</code>
        : <pre className="bg-neutral-900 text-neutral-100 p-3 rounded-lg text-xs font-mono overflow-x-auto mb-4 border border-neutral-800"><code {...props}>{children}</code></pre>
    ),
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 sm:p-6 bg-neutral-950/80 animate-fade-in">
      
      {/* Outer Wrapper */}
      <div className="relative w-full max-w-6xl flex flex-col h-[90vh] rounded-xl border border-neutral-200/50 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 shadow-2xl overflow-hidden animate-scale-up">
        
        {/* Mock Browser Header */}
        <div className="bg-neutral-50 dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-850 px-4 py-3 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          
          {/* Left: Window Controls + Device Toggle */}
          <div className="flex items-center gap-4">
            {/* Mac style control dots */}
            <div className="flex items-center gap-1.5 mr-2">
              <span className="w-3 h-3 rounded-full bg-red-400 block cursor-pointer" onClick={onClose} title="Close" />
              <span className="w-3 h-3 rounded-full bg-yellow-400 block" />
              <span className="w-3 h-3 rounded-full bg-green-400 block" />
            </div>

            {/* Viewport Control Buttons */}
            <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-900 rounded-lg p-0.5 border border-neutral-250 dark:border-neutral-800">
              <button
                onClick={() => setViewport('desktop')}
                className={`p-1.5 rounded-md flex items-center gap-1 text-[10px] font-bold transition-all cursor-pointer ${
                  viewport === 'desktop'
                    ? 'bg-white dark:bg-neutral-800 text-indigo-500 shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
                }`}
                title="Desktop View"
              >
                <Monitor className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Десктоп</span>
              </button>
              <button
                onClick={() => setViewport('mobile')}
                className={`p-1.5 rounded-md flex items-center gap-1 text-[10px] font-bold transition-all cursor-pointer ${
                  viewport === 'mobile'
                    ? 'bg-white dark:bg-neutral-800 text-indigo-500 shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
                }`}
                title="Mobile View"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Мобильный</span>
              </button>
            </div>
          </div>

          {/* Middle: Mock URL Input Address Bar */}
          <div className="flex-1 max-w-lg mx-auto flex items-center gap-2 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-1.5 bg-white dark:bg-neutral-900 text-neutral-400 dark:text-neutral-500 select-none">
            <Globe className="w-3.5 h-3.5 shrink-0" />
            <input
              type="text"
              readOnly
              value={mockUrl}
              className="bg-transparent text-xs outline-none w-full truncate text-neutral-600 dark:text-neutral-300 font-mono"
            />
            <RotateCw className="w-3.5 h-3.5 shrink-0 animate-spin-once cursor-pointer hover:text-neutral-600" />
          </div>

          {/* Right: Close Action */}
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg border border-neutral-250 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-neutral-50 dark:hover:bg-neutral-850 shadow-sm transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Viewport Frame Box */}
        <div className="flex-1 bg-neutral-200 dark:bg-neutral-950 flex items-center justify-center p-3 sm:p-6 overflow-hidden">
          
          <div 
            className={`h-full bg-white dark:bg-neutral-950 shadow-2xl rounded-lg border border-neutral-250 dark:border-neutral-850 overflow-hidden flex flex-col transition-all duration-300 ${
              viewport === 'desktop' ? 'w-full' : 'w-[375px]'
            }`}
          >
            {/* Mock Page Header Bar (Wiki Header) */}
            <div className="bg-white dark:bg-neutral-950 border-b border-neutral-100 dark:border-neutral-900 px-4 py-3.5 flex items-center justify-between select-none">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-500" />
                <span className="font-outfit text-sm font-bold text-neutral-950 dark:text-white">Wiki 2.0</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] uppercase font-bold text-neutral-400 bg-neutral-100 dark:bg-neutral-900 px-2 py-0.5 rounded border border-neutral-200/50 dark:border-neutral-800">
                  Превью
                </span>
              </div>
            </div>

            {/* Mock Page Body (Scrollable Area) */}
            <div className="flex-1 overflow-y-auto min-h-0 bg-white dark:bg-neutral-950 text-neutral-950 dark:text-neutral-100">
              
              {article && (
                <div className={`max-w-7xl mx-auto px-4 py-6 flex gap-4 ${viewport === 'mobile' ? 'flex-col' : 'flex-row'}`}>
                  
                  {/* Mock Sidebar (Desktop only) */}
                  {viewport === 'desktop' && (
                    <aside className="w-52 shrink-0 border-r border-neutral-100 dark:border-neutral-900 pr-4 space-y-4 select-none">
                      <div className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Вики-документация</span>
                      </div>
                      
                      <nav className="space-y-1 text-xs max-h-[350px] overflow-y-auto pr-1">
                        {articles.filter(art => art.is_visible !== false && art.published).map(art => {
                          const isCurrent = article?.id === art.id;
                          return (
                            <div
                              key={art.id}
                              className={`p-1.5 rounded text-[10px] truncate ${
                                isCurrent
                                  ? 'text-indigo-500 font-bold bg-indigo-500/5'
                                  : 'text-neutral-500'
                              }`}
                            >
                              {art.title}
                            </div>
                          );
                        })}
                      </nav>
                    </aside>
                  )}

                  {/* Main Article Content */}
                  <div className="flex-1 min-w-0">
                    
                    {/* Breadcrumbs */}
                    <div className="flex items-center gap-1 text-[10px] text-neutral-400 mb-4 select-none overflow-x-auto whitespace-nowrap">
                      <span>Главная</span>
                      <ChevronRight className="w-2.5 h-2.5 shrink-0" />
                      <span className="text-neutral-600 dark:text-neutral-300 truncate max-w-[120px] font-semibold">{article.title}</span>
                    </div>

                    {/* Article Body */}
                    <div className="border-b border-neutral-100 dark:border-neutral-900 pb-4 mb-4">
                      <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-neutral-900 dark:text-white leading-tight mb-2">
                        {article.title}
                      </h1>
                      
                      <div className="flex flex-wrap items-center gap-3 text-[10px] sm:text-xs text-neutral-400 select-none">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date().toLocaleDateString()}
                        </span>
                        <span>•</span>
                        <span>Просмотров: 0</span>
                        {!article.published && (
                          <span className="text-[9px] px-1.5 py-0.2 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded font-semibold">
                            Черновик
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Summary */}
                    {article.summary && (
                      <p className="text-xs sm:text-sm text-neutral-400 dark:text-neutral-500 italic mb-5 leading-relaxed font-light pl-3 border-l-2 border-neutral-200 dark:border-neutral-800">
                        {article.summary}
                      </p>
                    )}

                    {/* Content Markdown */}
                    <article className="prose prose-sm dark:prose-invert max-w-none mb-8">
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]} 
                        components={MarkdownComponents}
                      >
                        {article.content || '*Здесь пока пусто...*'}
                      </ReactMarkdown>
                    </article>

                    {/* Tags */}
                    {article.tags && article.tags.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 border-t border-neutral-100 dark:border-neutral-900 pt-4">
                        <Tag className="w-3 h-3 text-neutral-400" />
                        {article.tags.map(tag => (
                          <span key={tag} className="text-[10px] px-2 py-0.5 rounded border border-neutral-200/50 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 text-neutral-500">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Table of Contents (Desktop only) */}
                  {viewport === 'desktop' && headings.length > 0 && (
                    <aside className="w-40 shrink-0 border-l border-neutral-100 dark:border-neutral-900 pl-4 space-y-3 select-none">
                      <h4 className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                        На этой странице
                      </h4>
                      <nav className="space-y-1.5 text-[10px]">
                        {headings.map((heading) => (
                          <div
                            key={heading.id}
                            className={`text-neutral-400 truncate hover:text-indigo-500 transition-colors ${
                              heading.level === 3 ? 'pl-2 text-[9px]' : 'font-medium'
                            }`}
                          >
                            {heading.text}
                          </div>
                        ))}
                      </nav>
                    </aside>
                  )}
                </div>
              )}


            </div>

            {/* Mock Page Footer */}
            <div className="bg-neutral-50 dark:bg-neutral-950 border-t border-neutral-100 dark:border-neutral-900 py-3 px-4 text-center text-[10px] text-neutral-400 select-none shrink-0">
              © {new Date().getFullYear()} Wiki 2.0 • Сделано с любовью
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
