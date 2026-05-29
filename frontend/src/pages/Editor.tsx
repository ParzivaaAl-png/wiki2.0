import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { 
  ArrowLeft, 
  Save, 
  Tag as TagIcon,
  X,
  Sparkles
} from 'lucide-react';
import { fetchArticle, fetchCategories, createArticle, updateArticle, Category } from '../lib/api';
import WYSIWYGEditor from '../components/wysiwyg-editor';

export default function Editor() {
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;
  const navigate = useNavigate();

  const [categories, setCategories] = React.useState<Category[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Form states
  const [title, setTitle] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [summary, setSummary] = React.useState('');
  const [content, setContent] = React.useState('');
  const [categoryId, setCategoryId] = React.useState<number | null>(null);
  const [published, setPublished] = React.useState(true);
  const [tags, setTags] = React.useState<string[]>([]);
  const [newTag, setNewTag] = React.useState('');
  const [position, setPosition] = React.useState<number>(0);

  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Initial Fetch
  React.useEffect(() => {
    async function loadEditorData() {
      setIsLoading(true);
      try {
        const cats = await fetchCategories();
        setCategories(cats);

        if (isEditMode && id) {
          const article = await fetchArticle(id);
          setTitle(article.title);
          setSlug(article.slug);
          setSummary(article.summary || '');
          setContent(article.content);
          setCategoryId(article.category_id);
          setPublished(article.published);
          setTags(article.tags || []);
          setPosition(article.position || 0);
        } else {
          const queryParams = new URLSearchParams(window.location.search);
          const queryCatId = queryParams.get('category_id');
          if (queryCatId) {
            setCategoryId(Number(queryCatId));
          }
        }
      } catch (err) {
        console.error('Failed to load editor data:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadEditorData();
  }, [id, isEditMode]);

  // Auto slugify title
  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!isEditMode) {
      // Slugify with support for Cyrillic and special characters
      const slugified = val
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w\u0400-\u04FF-]+/g, '')
        .replace(/--+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
      setSlug(slugified);
    }
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newTag.trim()) {
      e.preventDefault();
      const cleaned = newTag.trim().toLowerCase();
      if (!tags.includes(cleaned)) {
        setTags([...tags, cleaned]);
      }
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !slug.trim() || !content.trim()) {
      alert('Пожалуйста, заполните Название, Slug и Текст статьи.');
      return;
    }

    setIsSubmitting(true);
    const payload = {
      title,
      slug,
      summary,
      content,
      category_id: categoryId,
      published,
      tags,
      position,
    };

    try {
      if (isEditMode && id) {
        await updateArticle(Number(id), payload);
      } else {
        await createArticle(payload);
      }
      // Remove autosave copies from local storage on successful save
      localStorage.removeItem(`wiki_autosave_${id || 'new'}`);
      navigate('/admin');
    } catch (err: any) {
      console.error(err);
      alert(`Не удалось сохранить: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 animate-pulse space-y-6">
        <div className="h-4 w-32 bg-neutral-200 dark:bg-neutral-800 rounded" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-[450px] bg-neutral-200 dark:bg-neutral-800 rounded-xl" />
          <div className="h-80 bg-neutral-200 dark:bg-neutral-800 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Navigation and Save Actions */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <Link
          to="/admin"
          className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Отмена и возврат
        </Link>

        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 transition-all cursor-pointer"
        >
          <Save className="w-4 h-4" />
          {isSubmitting ? 'Сохранение...' : 'Сохранить статью'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Sidebar Settings Form */}
        <div className="lg:order-2 space-y-6">
          <div className="p-5 border border-neutral-200/50 dark:border-neutral-800 bg-white dark:bg-neutral-950 rounded-xl shadow-premium dark:shadow-premium-dark space-y-4">
            <h3 className="font-outfit text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <Sparkles className="w-4.5 h-4.5 text-indigo-500" />
              Настройки и метаданные
            </h3>

            <div>
              <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">Slug (путь URL)</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                placeholder="slug-url-endpoint"
                required
                className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/30 text-neutral-900 dark:text-white outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">Раздел</label>
              <select
                value={categoryId || ''}
                onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/30 text-neutral-900 dark:text-white outline-none focus:border-indigo-500"
              >
                <option value="">Выберите раздел...</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">Порядковый номер (Позиция)</label>
              <input
                type="number"
                value={position}
                onChange={(e) => setPosition(Number(e.target.value))}
                placeholder="0"
                min="0"
                className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/30 text-neutral-900 dark:text-white outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">Теги (нажмите Enter)</label>
              <div className="flex items-center gap-2 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-1 bg-neutral-50 dark:bg-neutral-900/30 mb-2">
                <TagIcon className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={handleAddTag}
                  placeholder="добавить тег..."
                  className="bg-transparent text-xs text-neutral-900 dark:text-white outline-none w-full py-1"
                />
              </div>

              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 font-medium"
                    >
                      {tag}
                      <button type="button" onClick={() => handleRemoveTag(tag)} className="text-neutral-400 hover:text-red-500">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Опубликовать статью</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={published}
                  onChange={(e) => setPublished(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-neutral-200 dark:bg-neutral-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Content Pane */}
        <div className="lg:col-span-2 lg:order-1 flex flex-col border border-neutral-200/50 dark:border-neutral-800 bg-white dark:bg-neutral-950 rounded-xl overflow-hidden shadow-premium dark:shadow-premium-dark p-6 space-y-4">
          <input
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Название статьи..."
            required
            className="w-full text-xl sm:text-2xl font-extrabold text-neutral-950 dark:text-white placeholder-neutral-300 dark:placeholder-neutral-800 bg-transparent outline-none border-b border-neutral-100 dark:border-neutral-900 pb-2"
          />

          <input
            type="text"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Краткое описание (summary) этой статьи..."
            className="w-full text-xs text-neutral-500 bg-transparent outline-none placeholder-neutral-400 dark:placeholder-neutral-800 border-b border-neutral-100 dark:border-neutral-900 pb-2"
          />

          <div className="flex-1">
            <WYSIWYGEditor
              content={content}
              onChange={setContent}
              articleId={id || 'new'}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
