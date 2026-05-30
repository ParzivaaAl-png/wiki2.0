import * as React from 'react';
import { X, Layout, Server, Cpu, Search, Book, Layers, Settings, Users, Key, HelpCircle, Database, Terminal, FileText, Folder, Plus, Check } from 'lucide-react';
import { fetchCategories, updateCategory, createCategory, Category } from '../lib/api';

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

const PRESETS_COLORS = [
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Violet', value: '#7c3aed' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Cyan', value: '#06b6d4' },
];

interface AddSectionModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddSectionModal({ onClose, onSuccess }: AddSectionModalProps) {
  const [step, setStep] = React.useState<'choose' | 'existing' | 'new'>('choose');
  
  // Existing Category States
  const [archivedCats, setArchivedCats] = React.useState<Category[]>([]);
  const [isLoadingArchived, setIsLoadingArchived] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');

  // New Category States
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [icon, setIcon] = React.useState('layout');
  const [color, setColor] = React.useState('#6366f1');
  const [content, setContent] = React.useState('');
  
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');

  // Load archived categories if 'existing' chosen
  React.useEffect(() => {
    if (step === 'existing') {
      setIsLoadingArchived(true);
      fetchCategories({ all: true })
        .then((data) => {
          // Only show archived/hidden categories
          setArchivedCats(data.filter(c => !c.is_visible));
        })
        .catch(err => console.error('Failed to load archived categories:', err))
        .finally(() => setIsLoadingArchived(false));
    }
  }, [step]);

  const filteredArchived = React.useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return archivedCats;
    return archivedCats.filter(c => 
      c.name.toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q)
    );
  }, [archivedCats, searchQuery]);

  const handleRestoreCategory = async (cat: Category) => {
    try {
      await updateCategory(cat.id, {
        name: cat.name,
        slug: cat.slug,
        icon: cat.icon || 'layout',
        description: cat.description || '',
        position: cat.position || 0,
        is_visible: true,
        color: cat.color || '#6366f1',
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      alert('Не удалось восстановить раздел.');
    }
  };

  const handleCreateNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Название обязательно для заполнения.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    // Generate slug from name
    const slug = name
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
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

    try {
      await createCategory({
        name: name.trim(),
        slug,
        icon,
        description: description.trim(),
        position: 0,
        is_visible: true,
        color,
        content: content.trim(), // Send initial article content
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Произошла ошибка при создании раздела.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/60 backdrop-blur-sm transition-all duration-300">
      <div 
        className="relative w-full max-w-lg overflow-hidden rounded-xl border border-neutral-200/50 dark:border-neutral-800/80 bg-white dark:bg-neutral-950 shadow-2xl transition-all duration-300 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-900 p-4 shrink-0">
          <h3 className="font-outfit text-base font-extrabold text-neutral-900 dark:text-white">
            {step === 'choose' && 'Добавить раздел'}
            {step === 'existing' && 'Добавить существующий раздел'}
            {step === 'new' && 'Создать новый раздел'}
          </h3>
          <button 
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-900/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {step === 'choose' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
              <button
                onClick={() => setStep('existing')}
                className="flex flex-col items-center justify-center p-6 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 hover:border-indigo-500/40 hover:bg-indigo-500/[0.02] text-center transition-all group cursor-pointer"
              >
                <div className="w-12 h-12 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <Layers className="w-5 h-5" />
                </div>
                <div className="font-bold text-xs text-neutral-800 dark:text-neutral-200">
                  Добавить существующий
                </div>
                <p className="text-[10px] text-neutral-450 dark:text-neutral-500 mt-1 max-w-[180px]">
                  Восстановить скрытый или ранее архивированный раздел документации
                </p>
              </button>

              <button
                onClick={() => setStep('new')}
                className="flex flex-col items-center justify-center p-6 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 hover:border-indigo-500/40 hover:bg-indigo-500/[0.02] text-center transition-all group cursor-pointer"
              >
                <div className="w-12 h-12 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                  <Plus className="w-5 h-5" />
                </div>
                <div className="font-bold text-xs text-neutral-800 dark:text-neutral-200">
                  Создать новый раздел
                </div>
                <p className="text-[10px] text-neutral-450 dark:text-neutral-500 mt-1 max-w-[180px]">
                  Создать абсолютно новый раздел со своим цветом, иконкой и контентом
                </p>
              </button>
            </div>
          )}

          {step === 'existing' && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Поиск по архивным разделам..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs pl-9 pr-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/30 text-neutral-900 dark:text-white outline-none focus:border-indigo-500"
                />
              </div>

              {isLoadingArchived ? (
                <div className="flex justify-center py-10">
                  <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filteredArchived.length === 0 ? (
                <div className="text-center py-10 text-xs text-neutral-400">
                  Нет архивных разделов для добавления.
                </div>
              ) : (
                <div className="divide-y divide-neutral-100 dark:divide-neutral-900 max-h-[300px] overflow-y-auto">
                  {filteredArchived.map((cat) => (
                    <div 
                      key={cat.id} 
                      className="flex items-center justify-between py-3 hover:bg-neutral-55 dark:hover:bg-neutral-900/30 px-2 rounded-lg transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border"
                          style={{ borderColor: `${cat.color}20`, backgroundColor: `${cat.color}10`, color: cat.color || '#6366f1' }}
                        >
                          {(() => {
                            const selected = AVAILABLE_ICONS.find(i => i.name === cat.icon);
                            const IconComp = selected ? selected.Icon : Folder;
                            return <IconComp className="w-4 h-4" />;
                          })()}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-neutral-800 dark:text-neutral-200">{cat.name}</div>
                          <div className="text-[10px] text-neutral-450 dark:text-neutral-500 line-clamp-1">{cat.description}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRestoreCategory(cat)}
                        className="px-2.5 py-1 text-[10px] font-bold text-indigo-600 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-md transition-colors cursor-pointer"
                      >
                        Добавить
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 'new' && (
            <form onSubmit={handleCreateNew} className="space-y-4">
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
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Например: Всё о поездках и тарифах"
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
                  rows={2}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/30 text-neutral-900 dark:text-white outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">Иконка</label>
                  <select
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/30 text-neutral-900 dark:text-white outline-none focus:border-indigo-500"
                  >
                    {AVAILABLE_ICONS.map((item) => (
                      <option key={item.name} value={item.name}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">Цветовой акцент</label>
                  <div className="flex flex-wrap gap-1.5 items-center h-9">
                    {PRESETS_COLORS.map((preset) => {
                      const isSelected = color === preset.value;
                      return (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={() => setColor(preset.value)}
                          className="w-5 h-5 rounded-full border flex items-center justify-center transition-all cursor-pointer hover:scale-110"
                          style={{ backgroundColor: preset.value, borderColor: isSelected ? '#ffffff' : 'transparent', boxShadow: isSelected ? '0 0 4px rgba(0,0,0,0.5)' : 'none' }}
                        >
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">Контент вводной статьи</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Напишите текст первой (вводной) статьи для этого раздела..."
                  rows={4}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/30 text-neutral-900 dark:text-white outline-none focus:border-indigo-500"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-3 pt-3 border-t border-neutral-100 dark:border-neutral-900">
                <button
                  type="button"
                  onClick={() => setStep('choose')}
                  className="px-4 py-2 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900 text-neutral-700 dark:text-neutral-300 rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                >
                  Назад
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 transition-all cursor-pointer"
                >
                  {isSubmitting ? 'Создание...' : 'Создать раздел'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Global Modal Footer */}
        {step !== 'new' && (
          <div className="p-4 border-t border-neutral-100 dark:border-neutral-900 flex justify-end shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900 text-neutral-700 dark:text-neutral-300 rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
            >
              Отмена
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
