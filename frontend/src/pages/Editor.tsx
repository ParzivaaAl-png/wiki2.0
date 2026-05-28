import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  ArrowLeft, 
  Save, 
  Eye, 
  Edit3, 
  Image as ImageIcon, 
  Tag as TagIcon,
  X,
  Sparkles
} from 'lucide-react';
import { fetchArticle, fetchCategories, createArticle, updateArticle, uploadImage, Category } from '../lib/api';

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

  const [activeTab, setActiveTab] = React.useState<'write' | 'preview'>('write');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);

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
      const slugified = val
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
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

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const { url } = await uploadImage(file);
      
      const textarea = document.getElementById('content-textarea') as HTMLTextAreaElement;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const before = text.substring(0, start);
        const after = text.substring(end, text.length);
        const imageMarkdown = `\n![Uploaded Image](${url})\n`;
        
        setContent(before + imageMarkdown + after);
        
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + imageMarkdown.length, start + imageMarkdown.length);
        }, 10);
      } else {
        setContent(prev => prev + `\n![Uploaded Image](${url})\n`);
      }
    } catch (err: any) {
      console.error(err);
      alert(`Image upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !slug.trim() || !content.trim()) {
      alert('Please fill out Title, Slug and Content.');
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
    };

    try {
      if (isEditMode && id) {
        await updateArticle(Number(id), payload);
      } else {
        await createArticle(payload);
      }
      navigate('/admin');
    } catch (err: any) {
      console.error(err);
      alert(`Save failed: ${err.message}`);
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
          Cancel and return
        </Link>

        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 transition-all cursor-pointer"
        >
          <Save className="w-4 h-4" />
          {isSubmitting ? 'Saving...' : 'Save Article'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Sidebar Settings Form */}
        <div className="lg:order-2 space-y-6">
          <div className="p-5 border border-neutral-200/50 dark:border-neutral-800 bg-white dark:bg-neutral-950 rounded-xl shadow-premium dark:shadow-premium-dark space-y-4">
            <h3 className="font-outfit text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <Sparkles className="w-4.5 h-4.5 text-indigo-500" />
              Settings &amp; Metadata
            </h3>

            <div>
              <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">Slug URL</label>
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
              <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">Category</label>
              <select
                value={categoryId || ''}
                onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/30 text-neutral-900 dark:text-white outline-none focus:border-indigo-500"
              >
                <option value="">Choose category...</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">Tags (Press Enter)</label>
              <div className="flex items-center gap-2 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-1 bg-neutral-50 dark:bg-neutral-900/30 mb-2">
                <TagIcon className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={handleAddTag}
                  placeholder="add tag..."
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
              <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Publish Article</span>
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
        <div className="lg:col-span-2 lg:order-1 flex flex-col border border-neutral-200/50 dark:border-neutral-800 bg-white dark:bg-neutral-950 rounded-xl overflow-hidden shadow-premium dark:shadow-premium-dark">
          <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-200/50 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950">
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setActiveTab('write')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  activeTab === 'write'
                    ? 'bg-neutral-100 dark:bg-neutral-900 text-indigo-500 dark:text-indigo-400'
                    : 'text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                Write
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  activeTab === 'preview'
                    ? 'bg-neutral-100 dark:bg-neutral-900 text-indigo-500 dark:text-indigo-400'
                    : 'text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                Preview
              </button>
            </div>

            <label className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 text-xs font-medium cursor-pointer transition-colors shadow-sm">
              <ImageIcon className="w-3.5 h-3.5" />
              <span>{isUploading ? 'Uploading...' : 'Insert Image'}</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageFileChange}
                disabled={isUploading}
                className="hidden"
              />
            </label>
          </div>

          <div className="p-4 space-y-4 flex-1 flex flex-col">
            <input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Article title..."
              required
              className="w-full text-xl sm:text-2xl font-extrabold text-neutral-950 dark:text-white placeholder-neutral-300 dark:placeholder-neutral-800 bg-transparent outline-none border-b border-neutral-100 dark:border-neutral-900 pb-2"
            />

            <input
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Short paragraph summary describing this article..."
              className="w-full text-xs text-neutral-500 bg-transparent outline-none placeholder-neutral-400 dark:placeholder-neutral-800"
            />

            {activeTab === 'write' ? (
              <textarea
                id="content-textarea"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="# Write your Markdown content here..."
                required
                className="w-full min-h-[450px] flex-1 bg-transparent text-sm text-neutral-900 dark:text-neutral-200 font-mono outline-none resize-y py-2 leading-relaxed"
              />
            ) : (
              <div className="prose-custom min-h-[450px] py-2 overflow-y-auto max-h-[60vh] border border-dashed border-neutral-200 dark:border-neutral-800 p-4 rounded-lg bg-neutral-50/20 dark:bg-neutral-950/20">
                {content.trim() === '' ? (
                  <span className="text-xs text-neutral-400 italic">Nothing to preview. Start writing content.</span>
                ) : (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {content}
                  </ReactMarkdown>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
