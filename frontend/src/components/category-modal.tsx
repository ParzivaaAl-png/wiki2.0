import * as React from 'react';
import { X, Layout, Server, Cpu, Search, Book, Layers, Settings, Users, Key, HelpCircle, Database, Terminal, FileText, Folder, Plus } from 'lucide-react';
import { createCategory, updateCategory, Category } from '../lib/api';

// Available icons to select from, with their Lucide references
const AVAILABLE_ICONS = [
  { name: 'layout', label: 'Layout (Макет)', Icon: Layout },
  { name: 'server', label: 'Server (Сервер)', Icon: Server },
  { name: 'cpu', label: 'CPU (Процессор)', Icon: Cpu },
  { name: 'search', label: 'Search (Поиск)', Icon: Search },
  { name: 'book', label: 'Book (Книга)', Icon: Book },
  { name: 'layers', label: 'Layers (Слои)', Icon: Layers },
  { name: 'settings', label: 'Settings (Настройки)', Icon: Settings },
  { name: 'users', label: 'Users (Пользователи)', Icon: Users },
  { name: 'key', label: 'Key (Ключи)', Icon: Key },
  { name: 'help-circle', label: 'Help (Помощь)', Icon: HelpCircle },
  { name: 'database', label: 'Database (База данных)', Icon: Database },
  { name: 'terminal', label: 'Terminal (Консоль)', Icon: Terminal },
  { name: 'file-text', label: 'File Text (Документ)', Icon: FileText },
  { name: 'folder', label: 'Folder (Папка)', Icon: Folder },
];

interface CategoryModalProps {
  category?: Category | null; // If passed, we are editing. Otherwise creating.
  onClose: () => void;
  onSuccess: () => void;
}

export default function CategoryModal({ category, onClose, onSuccess }: CategoryModalProps) {
  const isEditMode = !!category;
  
  const [name, setName] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [icon, setIcon] = React.useState('layout');
  const [position, setPosition] = React.useState(0);
  
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (category) {
      setName(category.name);
      setSlug(category.slug);
      setDescription(category.description || '');
      setIcon(category.icon || 'layout');
      setPosition(category.position || 0);
    } else {
      setName('');
      setSlug('');
      setDescription('');
      setIcon('layout');
      setPosition(0);
    }
  }, [category]);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!isEditMode) {
      // Auto-generate slug from name (transliterate or sanitize)
      const slugified = val
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        // Simple Cyrillic transliteration mapper
        .replace(/[а-я]/g, (char) => {
          const cyr = 'а б в г д е ё ж з и й к л м н о п р с т у ф х ц ч ш щ ъ ы ь э ю я'.split(' ');
          const lat = 'a b v g d e yo zh z i y k l m n o p r s t u f kh ts ch sh shch  y  e yu ya'.split(' ');
          const idx = cyr.indexOf(char);
          return idx !== -1 ? lat[idx] : char;
        })
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
      setSlug(slugified);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) {
      setError('Название и Slug обязательны для заполнения.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    const payload = {
      name: name.trim(),
      slug: slug.trim().toLowerCase().replace(/\s+/g, '-'),
      description: description.trim(),
      icon,
      position: Number(position),
    };

    try {
      if (isEditMode && category) {
        await updateCategory(category.id, payload);
      } else {
        await createCategory(payload);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Произошла ошибка при сохранении раздела.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="relative w-full max-w-lg overflow-hidden rounded-xl border border-neutral-200/50 dark:border-neutral-800/80 bg-white dark:bg-neutral-950 shadow-2xl animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-900 p-4">
          <h3 className="font-outfit text-base font-extrabold text-neutral-900 dark:text-white">
            {isEditMode ? 'Редактировать раздел' : 'Создать новый раздел'}
          </h3>
          <button 
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-900/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 text-xs bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">Название раздела</label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Например: Всё о Яндекс Про"
              required
              className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/30 text-neutral-900 dark:text-white outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">Slug (путь URL)</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
              placeholder="yandex-pro"
              required
              className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/30 text-neutral-900 dark:text-white outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">Описание</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Краткое описание раздела документации..."
              rows={3}
              className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/30 text-neutral-900 dark:text-white outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">Позиция на экране</label>
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
              <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">Иконка</label>
              <select
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="w-full text-xs px-3 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/30 text-neutral-900 dark:text-white outline-none focus:border-indigo-500"
              >
                {AVAILABLE_ICONS.map((item) => (
                  <option key={item.name} value={item.name}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Icon Preview */}
          <div className="flex items-center gap-3 p-3 bg-neutral-50 dark:bg-neutral-900/40 rounded-lg border border-neutral-200/50 dark:border-neutral-850">
            <span className="text-[10px] uppercase font-bold text-neutral-400">Превью иконки:</span>
            <div className="w-8 h-8 rounded bg-indigo-500/10 text-indigo-500 flex items-center justify-center border border-indigo-500/20">
              {(() => {
                const selected = AVAILABLE_ICONS.find(i => i.name === icon);
                if (selected) {
                  const IconComp = selected.Icon;
                  return <IconComp className="w-4.5 h-4.5" />;
                }
                return null;
              })()}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 pt-3 border-t border-neutral-100 dark:border-neutral-900">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900 text-neutral-700 dark:text-neutral-300 rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              {isSubmitting ? 'Сохранение...' : isEditMode ? 'Сохранить раздел' : 'Создать раздел'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
