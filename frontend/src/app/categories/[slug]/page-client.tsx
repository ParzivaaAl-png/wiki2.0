'use client';

import * as React from 'react';
import Link from 'next/link';
import { ChevronRight, Calendar, Eye, FileText, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { Category, Article } from '../../../lib/api';
import { CategoryIcon } from '../../../components/icon';

interface CategoryClientProps {
  category: Category;
  articles: Article[];
}

export default function CategoryClient({ category, articles }: CategoryClientProps) {
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
      {/* Glow backgrounds */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[300px] pointer-events-none -z-10 opacity-30">
        <div className="absolute top-[-20%] left-[20%] w-[350px] h-[300px] rounded-full bg-indigo-500/20 blur-[100px]" />
      </div>

      <div className="max-w-4xl mx-auto px-4">
        {/* Back Link */}
        <Link 
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-indigo-500 transition-colors mb-6 font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Home
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
              {articles.length} {articles.length === 1 ? 'article' : 'articles'}
            </span>
          </div>
        </div>

        {/* Articles List */}
        {articles.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl">
            <FileText className="w-8 h-8 text-neutral-300 dark:text-neutral-700 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-neutral-700 dark:text-neutral-300">No articles yet</h3>
            <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
              There are no documents written in this category yet. Head to the admin panel to write the first article.
            </p>
            <Link 
              href="/admin"
              className="inline-flex items-center gap-1.5 px-4 py-2 mt-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-colors"
            >
              Write First Article
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
                    {art.views} views
                  </span>
                </div>

                <Link
                  href={`/articles/${art.slug}`}
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
                    href={`/articles/${art.slug}`}
                    className="text-xs font-semibold text-neutral-400 dark:text-neutral-500 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 flex items-center gap-1 transition-colors"
                  >
                    Read article <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
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
