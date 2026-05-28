import * as React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronRight, Calendar, Eye, FileText, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { fetchCategory, fetchArticles, Category as CategoryType, Article } from '../lib/api';
import { CategoryIcon } from '../components/icon';

export default function Category() {
  const { slug } = useParams<{ slug: string }>();
  const [category, setCategory] = React.useState<CategoryType | null>(null);
  const [articles, setArticles] = React.useState<Article[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadCategoryData() {
      if (!slug) return;
      setIsLoading(true);
      try {
        const [catData, artsData] = await Promise.all([
          fetchCategory(slug),
          fetchArticles({ category: slug }),
        ]);
        setCategory(catData);
        setArticles(artsData);
      } catch (err) {
        console.error('Failed to load category details:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadCategoryData();
  }, [slug]);

  const getArticlePlural = (count: number) => {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return 'статья';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'статьи';
    return 'статей';
  };

  const getViewPlural = (count: number) => {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return 'просмотр';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'просмотра';
    return 'просмотров';
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 animate-pulse space-y-6">
        <div className="h-4 w-24 bg-neutral-200 dark:bg-neutral-800 rounded" />
        <div className="h-28 bg-neutral-200 dark:bg-neutral-800 rounded-xl" />
        <div className="space-y-4 pt-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-32 bg-neutral-200 dark:bg-neutral-800 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <h2 className="font-outfit text-xl font-bold">Раздел не найден</h2>
        <p className="text-sm text-neutral-400 mt-2">Запрошенный вами раздел документации не существует.</p>
        <Link to="/" className="inline-flex items-center gap-1 mt-4 text-xs font-semibold text-indigo-500 hover:underline">
          <ArrowLeft className="w-3.5 h-3.5" /> Назад на главную
        </Link>
      </div>
    );
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08 },
    },
  };

  const itemVariants = {
    hidden: { y: 15, opacity: 0 },
    show: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 100 } },
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] py-12">
      {/* Decorative Blur */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[300px] pointer-events-none -z-10 opacity-30">
        <div className="absolute top-[-20%] left-[20%] w-[350px] h-[300px] rounded-full bg-indigo-500/20 blur-[100px]" />
      </div>

      <div className="max-w-4xl mx-auto px-4">
        {/* Back Link */}
        <Link 
          to="/"
          className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-indigo-500 transition-colors mb-6 font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Назад на главную
        </Link>

        {/* Category Header Card */}
        <div className="flex items-start gap-4 p-6 rounded-xl border border-neutral-200/50 dark:border-neutral-800/80 bg-white dark:bg-neutral-950 shadow-premium dark:shadow-premium-dark mb-10">
          <div className="w-12 h-12 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center border border-indigo-500/20 shrink-0">
            <CategoryIcon name={category.icon} className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-outfit text-2xl font-extrabold text-neutral-950 dark:text-white">
              {category.name}
            </h1>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1 font-light">
              {category.description}
            </p>
            <span className="inline-block mt-3 text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider bg-neutral-100 dark:bg-neutral-900/60 px-2 py-0.5 rounded">
              {articles.length} {getArticlePlural(articles.length)}
            </span>
          </div>
        </div>

        {/* Articles List */}
        {articles.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl">
            <FileText className="w-8 h-8 text-neutral-300 dark:text-neutral-700 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-neutral-700 dark:text-neutral-300">Статей пока нет</h3>
            <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
              В этой категории пока нет документов. Перейдите в панель администрирования, чтобы создать первую статью.
            </p>
            <Link 
              to="/admin/editor/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 mt-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-colors"
            >
              Написать первую статью
            </Link>
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="space-y-4"
          >
            {articles.map((art) => (
              <motion.div
                key={art.id}
                variants={itemVariants}
                className="group p-5 rounded-xl border border-neutral-200/50 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-premium dark:shadow-premium-dark hover:border-indigo-500/20 dark:hover:border-indigo-500/20 hover:shadow-glow dark:hover:shadow-glow transition-all duration-300"
              >
                <div className="flex items-center gap-2 mb-2 text-xs text-neutral-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(art.updated_at).toLocaleDateString()}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" />
                    {art.views} {getViewPlural(art.views)}
                  </span>
                </div>

                <Link
                  to={`/articles/${art.slug}`}
                  className="font-outfit text-lg font-bold text-neutral-900 dark:text-white hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors block"
                >
                  {art.title}
                </Link>

                <p className="text-neutral-500 dark:text-neutral-400 text-xs mt-2 line-clamp-2 font-light leading-relaxed">
                  {art.summary}
                </p>

                {art.tags && art.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-4">
                    {art.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] px-2 py-0.5 rounded border border-neutral-200/50 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/40 text-neutral-500 dark:text-neutral-400 font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-900 flex justify-end">
                  <Link
                    to={`/articles/${art.slug}`}
                    className="text-xs font-semibold text-neutral-400 dark:text-neutral-500 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 flex items-center gap-1 transition-colors"
                  >
                    Читать статью <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
