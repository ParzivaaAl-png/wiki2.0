'use client';

import * as React from 'react';
import Link from 'next/link';
import { 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Eye, 
  BookOpen, 
  Layers, 
  ExternalLink,
  ChevronRight,
  TrendingUp
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Article, Category, deleteArticle } from '../../lib/api';

interface AdminClientProps {
  initialArticles: Article[];
  categories: Category[];
}

export default function AdminClient({ initialArticles, categories }: AdminClientProps) {
  const [articles, setArticles] = React.useState<Article[]>(initialArticles);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [categoryFilter, setCategoryFilter] = React.useState('all');

  // Calculate quick stats
  const totalViews = React.useMemo(() => {
    return articles.reduce((acc, curr) => acc + curr.views, 0);
  }, [articles]);

  const draftCount = React.useMemo(() => {
    return articles.filter(art => !art.published).length;
  }, [articles]);

  // Filtered Articles
  const filteredArticles = React.useMemo(() => {
    return articles.filter(art => {
      const matchesSearch = art.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            art.summary.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = categoryFilter === 'all' || art.category_slug === categoryFilter;
      
      return matchesSearch && matchesCategory;
    });
  }, [articles, searchQuery, categoryFilter]);

  const handleDelete = async (id: number, title: string) => {
    if (!window.confirm(`Are you sure you want to delete the article "${title}"?`)) return;

    try {
      await deleteArticle(id);
      setArticles(prev => prev.filter(art => art.id !== id));
      alert('Article deleted successfully.');
    } catch (err) {
      console.error(err);
      alert('Failed to delete article.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-outfit text-3xl font-extrabold tracking-tight text-neutral-950 dark:text-white">
            Admin Dashboard
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm font-light mt-1">
            Write documentation, manage categories, and audit reading engagement.
          </p>
        </div>

        <Link
          href="/admin/editor/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 transition-all text-center justify-center"
        >
          <Plus className="w-4.5 h-4.5" />
          New Article
        </Link>
      </div>

      {/* Stats Widgets Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Stat 1 */}
        <div className="p-5 rounded-xl border border-neutral-200/50 dark:border-neutral-800/80 bg-white dark:bg-neutral-950 shadow-premium dark:shadow-premium-dark">
          <div className="flex items-center justify-between mb-3 text-neutral-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Articles</span>
            <BookOpen className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold font-outfit text-neutral-900 dark:text-white">{articles.length}</div>
          <p className="text-[10px] text-neutral-400 mt-1">{draftCount} draft articles pending</p>
        </div>

        {/* Stat 2 */}
        <div className="p-5 rounded-xl border border-neutral-200/50 dark:border-neutral-800/80 bg-white dark:bg-neutral-950 shadow-premium dark:shadow-premium-dark">
          <div className="flex items-center justify-between mb-3 text-neutral-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Categories</span>
            <Layers className="w-5 h-5 text-violet-500" />
          </div>
          <div className="text-2xl font-bold font-outfit text-neutral-900 dark:text-white">{categories.length}</div>
          <p className="text-[10px] text-neutral-400 mt-1">Tech segments defined</p>
        </div>

        {/* Stat 3 */}
        <div className="p-5 rounded-xl border border-neutral-200/50 dark:border-neutral-800/80 bg-white dark:bg-neutral-950 shadow-premium dark:shadow-premium-dark">
          <div className="flex items-center justify-between mb-3 text-neutral-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Documentation Views</span>
            <Eye className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold font-outfit text-neutral-900 dark:text-white">{totalViews}</div>
          <p className="text-[10px] text-neutral-400 mt-1">Total page reads recorded</p>
        </div>

        {/* Stat 4 */}
        <div className="p-5 rounded-xl border border-neutral-200/50 dark:border-neutral-800/80 bg-white dark:bg-neutral-950 shadow-premium dark:shadow-premium-dark">
          <div className="flex items-center justify-between mb-3 text-neutral-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Performance</span>
            <TrendingUp className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-outfit text-neutral-900 dark:text-white">Active</div>
          <p className="text-[10px] text-neutral-400 mt-1">Elasticsearch engine synced</p>
        </div>
      </div>

      {/* Filter and Table Card */}
      <div className="border border-neutral-200/50 dark:border-neutral-800/80 bg-white dark:bg-neutral-950 rounded-xl overflow-hidden shadow-premium dark:shadow-premium-dark">
        
        {/* Filters Header */}
        <div className="p-4 border-b border-neutral-200/50 dark:border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-1.5 bg-neutral-50 dark:bg-neutral-900/30 w-full md:max-w-xs">
            <Search className="w-4 h-4 text-neutral-400 shrink-0" />
            <input
              type="text"
              placeholder="Search local catalog..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-xs text-neutral-950 dark:text-neutral-100 outline-none w-full placeholder-neutral-400"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-neutral-400">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-xs border border-neutral-200 dark:border-neutral-800 rounded-lg px-2.5 py-1.5 bg-neutral-50 dark:bg-neutral-950 text-neutral-700 dark:text-neutral-300 outline-none focus:border-indigo-500"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.slug}>{cat.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Articles Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50 dark:bg-neutral-950 text-neutral-400 dark:text-neutral-500 font-semibold text-xs border-b border-neutral-200 dark:border-neutral-800 select-none">
                <th className="p-4">Article</th>
                <th className="p-4">Category</th>
                <th className="p-4 text-center">Views</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200/50 dark:divide-neutral-800/80 text-xs">
              {filteredArticles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-neutral-400 dark:text-neutral-600">
                    No articles found matching filters.
                  </td>
                </tr>
              ) : (
                filteredArticles.map((art) => (
                  <tr key={art.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/20 transition-colors">
                    <td className="p-4 font-medium max-w-sm truncate">
                      <Link 
                        href={`/articles/${art.slug}`}
                        className="hover:text-indigo-500 dark:hover:text-indigo-400 hover:underline inline-flex items-center gap-1 font-bold text-neutral-900 dark:text-neutral-100"
                      >
                        {art.title}
                        <ExternalLink className="w-3.5 h-3.5 opacity-40 shrink-0" />
                      </Link>
                      <span className="block text-[10px] text-neutral-400 font-mono mt-0.5 font-light truncate">
                        /{art.slug}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-[10px] uppercase font-semibold text-neutral-400 bg-neutral-100 dark:bg-neutral-900 px-2 py-0.5 rounded">
                        {art.category_name || 'Uncategorized'}
                      </span>
                    </td>
                    <td className="p-4 text-center font-semibold text-neutral-700 dark:text-neutral-300">
                      {art.views}
                    </td>
                    <td className="p-4">
                      {art.published ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-semibold border border-emerald-500/20">
                          Published
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 font-semibold border border-amber-500/20">
                          Draft
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/admin/editor/${art.id}`}
                          className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
                          title="Edit"
                        >
                          <Edit3 className="w-4.5 h-4.5" />
                        </Link>
                        <button
                          onClick={() => handleDelete(art.id, art.title)}
                          className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4.5 h-4.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-4 bg-neutral-50 dark:bg-neutral-950 border-t border-neutral-200/50 dark:border-neutral-800/80 text-[10px] text-neutral-400 flex items-center justify-between">
          <span>Showing {filteredArticles.length} of {articles.length} articles</span>
          <span>SaaS CMS Engine v2.0</span>
        </div>
      </div>
    </div>
  );
}
