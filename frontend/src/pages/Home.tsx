import * as React from 'react';
import { Link } from 'react-router-dom';
import { Search, Sparkles, Clock, ChevronRight, BookOpen } from 'lucide-react';
import { motion } from 'framer-motion';
import { fetchCategories, fetchArticles, Category, Article } from '../lib/api';
import { CategoryIcon } from '../components/icon';

export default function Home() {
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [recentArticles, setRecentArticles] = React.useState<Article[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadData() {
      try {
        const [cats, arts] = await Promise.all([
          fetchCategories(),
          fetchArticles(),
        ]);
        setCategories(cats);
        setRecentArticles(arts.slice(0, 3));
      } catch (error) {
        console.error('Home data load failed:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const getArticlePlural = (count: number) => {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return 'статья';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'статьи';
    return 'статей';
  };

  const triggerGlobalSearch = () => {
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      metaKey: true,
      bubbles: true,
    });
    window.dispatchEvent(event);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 100 } },
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-20 space-y-12 animate-pulse">
        <div className="space-y-4 text-center max-w-2xl mx-auto">
          <div className="h-6 w-32 bg-neutral-200 dark:bg-neutral-800 rounded-full mx-auto" />
          <div className="h-12 w-3/4 bg-neutral-200 dark:bg-neutral-800 rounded mx-auto" />
          <div className="h-4 w-full bg-neutral-200 dark:bg-neutral-800 rounded mx-auto" />
        </div>
        <div className="h-14 max-w-2xl bg-neutral-200 dark:bg-neutral-800 rounded-xl mx-auto" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-12">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-40 bg-neutral-200 dark:bg-neutral-800 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen pb-20 overflow-hidden">
      
      {/* Decorative Blurs */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[400px] pointer-events-none -z-10 opacity-70 dark:opacity-30">
        <div className="absolute top-[-10%] left-[20%] w-[350px] h-[350px] rounded-full bg-indigo-400 dark:bg-indigo-900/40 blur-[120px]" />
        <div className="absolute top-[10%] right-[20%] w-[300px] h-[300px] rounded-full bg-violet-400 dark:bg-violet-900/30 blur-[100px]" />
      </div>

      {/* Hero Header */}
      <section className="max-w-4xl mx-auto px-4 pt-20 pb-12 text-center">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-indigo-500/10 dark:border-indigo-400/20 bg-indigo-500/5 text-indigo-600 dark:text-indigo-400 text-xs font-semibold mb-6 shadow-sm shadow-indigo-500/5"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>SaaS Документация 2026</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="font-outfit text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight mb-6 bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-700 dark:from-white dark:via-neutral-100 dark:to-neutral-400 bg-clip-text text-transparent"
        >
          Документация, <br className="sm:hidden" />
          быстрая и совершенная.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-neutral-500 dark:text-neutral-400 text-base sm:text-lg md:text-xl max-w-2xl mx-auto mb-8 font-light leading-relaxed"
        >
          Минималистичный справочник с моментальным автозаполнением, исправлением опечаток и красивым форматированием в стиле Notion.
        </motion.p>

        {/* Search Trigger */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="max-w-2xl mx-auto"
        >
          <div 
            onClick={triggerGlobalSearch}
            className="flex items-center gap-4 px-5 py-4 rounded-xl border border-neutral-200 dark:border-neutral-800/80 bg-white dark:bg-neutral-950/80 hover:border-indigo-500/40 dark:hover:border-indigo-500/40 hover:shadow-glow dark:hover:shadow-glow transition-all duration-300 cursor-pointer shadow-premium dark:shadow-premium-dark"
          >
            <Search className="w-5 h-5 text-neutral-400 shrink-0" />
            <span className="flex-1 text-left text-neutral-400 text-sm sm:text-base">
              Поиск по базе знаний...
            </span>
            <kbd className="inline-flex h-6 select-none items-center gap-0.5 rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 px-2 font-mono text-[11px] font-medium text-neutral-400">
              ⌘K
            </kbd>
          </div>
        </motion.div>
      </section>

      {/* Categories Bento Grid */}
      <section className="max-w-5xl mx-auto px-4 py-8">
        <motion.h2 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="font-outfit text-sm font-semibold tracking-wider text-neutral-400 uppercase mb-6 px-1"
        >
          Разделы документации
        </motion.h2>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {categories.map((cat) => (
            <motion.div
              key={cat.id}
              variants={itemVariants}
              whileHover={{ y: -3, scale: 1.01 }}
              className="group relative flex flex-col justify-between p-5 rounded-xl border border-neutral-200/60 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-premium dark:shadow-premium-dark hover:border-indigo-500/20 dark:hover:border-indigo-500/20 hover:shadow-glow dark:hover:shadow-glow transition-all duration-300"
            >
              <div>
                <div className="w-10 h-10 rounded-lg bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center text-neutral-600 dark:text-neutral-300 mb-4 border border-neutral-200/50 dark:border-neutral-800/50 group-hover:bg-indigo-500/10 group-hover:text-indigo-500 transition-colors">
                  <CategoryIcon name={cat.icon} className="w-5 h-5" />
                </div>
                <h3 className="font-outfit text-base font-bold text-neutral-900 dark:text-neutral-100 mb-2">
                  {cat.name}
                </h3>
                <p className="text-neutral-500 dark:text-neutral-400 text-xs line-clamp-2 leading-relaxed">
                  {cat.description}
                </p>
              </div>

              <div className="mt-6 flex items-center justify-between">
                <span className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wider bg-neutral-100 dark:bg-neutral-900/60 px-2 py-0.5 rounded">
                  {cat.article_count || 0} {getArticlePlural(cat.article_count || 0)}
                </span>
                <Link
                  to={`/categories/${cat.slug}`}
                  className="text-xs font-semibold text-indigo-500 dark:text-indigo-400 flex items-center gap-1 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all"
                >
                  Перейти <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Recent Articles */}
      {recentArticles.length > 0 && (
        <section className="max-w-3xl mx-auto px-4 py-12">
          <div className="flex items-center gap-2 mb-6 border-b border-neutral-200/50 dark:border-neutral-800 pb-3">
            <Clock className="w-4 h-4 text-neutral-400" />
            <h3 className="font-outfit text-sm font-semibold tracking-wider text-neutral-400 uppercase">
              Последние обновления
            </h3>
          </div>

          <div className="space-y-3">
            {recentArticles.map((art) => (
              <motion.div
                key={art.id}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="flex items-center justify-between p-4 rounded-xl border border-neutral-200/40 dark:border-neutral-800/40 bg-neutral-50/50 dark:bg-neutral-950/20 hover:border-neutral-200 dark:hover:border-neutral-800 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-medium uppercase tracking-wider bg-neutral-100 dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400 px-1.5 py-0.5 rounded">
                      {art.category_name}
                    </span>
                  </div>
                  <Link 
                    to={`/articles/${art.slug}`}
                    className="font-outfit text-base font-bold text-neutral-900 dark:text-neutral-100 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors line-clamp-1"
                  >
                    {art.title}
                  </Link>
                  <p className="text-neutral-500 dark:text-neutral-400 text-xs line-clamp-1 mt-1 font-light">
                    {art.summary}
                  </p>
                </div>

                <Link
                  to={`/articles/${art.slug}`}
                  className="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-900 text-neutral-400 dark:text-neutral-500 hover:text-indigo-500 dark:hover:text-indigo-400 group-hover:bg-indigo-500/10 group-hover:text-indigo-500 transition-colors ml-4 shrink-0"
                >
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
