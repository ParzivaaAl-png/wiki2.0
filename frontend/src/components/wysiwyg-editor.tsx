import * as React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Youtube from '@tiptap/extension-youtube';

import { 
  Bold, Italic, Underline as UnderlineIcon, 
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, CheckSquare, Image as ImageIcon,
  Link as LinkIcon, Quote, Code, Heading1, Heading2, Heading3, Heading4,
  Undo, Redo, Table as TableIcon, Smile, Eye, EyeOff, Save,
  Youtube as YoutubeIcon, Paperclip, BookOpen, AlertTriangle
} from 'lucide-react';
import { uploadImage, suggestArticles, Suggestion } from '../lib/api';

interface WYSIWYGEditorProps {
  content: string;
  onChange: (html: string) => void;
  articleId?: string | number;
}

const FONT_FAMILIES = [
  { name: 'Системный', value: 'Inter, system-ui, sans-serif' },
  { name: 'Serif (С засечками)', value: 'Georgia, serif' },
  { name: 'Monospace (Код)', value: 'Fira Code, monospace' },
];

const COLORS = [
  { name: 'Черный', value: '#18181b' },
  { name: 'Серый', value: '#71717a' },
  { name: 'Красный', value: '#ef4444' },
  { name: 'Синий', value: '#3b82f6' },
  { name: 'Зеленый', value: '#10b981' },
  { name: 'Оранжевый', value: '#f97316' },
  { name: 'Фиолетовый', value: '#8b5cf6' },
];

const HIGHLIGHTS = [
  { name: 'Желтый маркер', value: '#fef08a' },
  { name: 'Зеленый маркер', value: '#a7f3d0' },
  { name: 'Синий маркер', value: '#bfdbfe' },
  { name: 'Розовый маркер', value: '#fbcfe8' },
];

const EMOJIS = ['😀', '😂', '👍', '❤️', '🔥', '🎉', '🚀', '💡', '📝', '✅', '❌', '⭐', '⚠️', '🛡️'];

export default function WYSIWYGEditor({ content, onChange, articleId }: WYSIWYGEditorProps) {
  const [isPreview, setIsPreview] = React.useState(false);
  const [showEmoji, setShowEmoji] = React.useState(false);
  const [lastAutosaved, setLastAutosaved] = React.useState<string | null>(null);

  // States for internal article linking autocomplete
  const [showLinkSuggestions, setShowLinkSuggestions] = React.useState(false);
  const [linkSearchQuery, setLinkSearchQuery] = React.useState('');
  const [linkSuggestions, setLinkSuggestions] = React.useState<Suggestion[]>([]);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const uploadImageFile = async (file: File, view: any) => {
    try {
      const res = await uploadImage(file);
      const { schema } = view.state;
      const node = schema.nodes.image.create({ src: res.url });
      const transaction = view.state.tr.replaceSelectionWith(node);
      view.dispatch(transaction);
    } catch (err: any) {
      alert(err.message || 'Ошибка загрузки изображения');
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
      }),
      Underline,
      TextStyle,
      Color,
      FontFamily,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Image.configure({
        allowBase64: true,
        HTMLAttributes: {
          class: 'rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm max-w-full h-auto my-4',
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-indigo-650 dark:text-indigo-400 font-semibold underline hover:text-indigo-800 cursor-pointer',
        },
      }),
      TaskList.configure({
        HTMLAttributes: {
          class: 'task-list not-prose my-3 space-y-1.5',
        },
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: 'flex items-start gap-2.5',
        },
      }),
      Youtube.configure({
        controls: true,
        HTMLAttributes: {
          class: 'rounded-xl overflow-hidden shadow-md max-w-full my-4 mx-auto block aspect-video',
        },
      }),
    ],
    content: content || '<p>Начните писать статью здесь...</p>',
    editorProps: {
      attributes: {
        class: 'prose-custom prose dark:prose-invert focus:outline-none min-h-[400px] max-h-[600px] overflow-y-auto px-4 py-3 select-text',
      },
      handleDrop: (view, event, slice, moved) => {
        if (!moved && event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]) {
          const file = event.dataTransfer.files[0];
          if (file.type.startsWith('image/')) {
            uploadImageFile(file, view);
            return true;
          }
        }
        return false;
      },
      handlePaste: (view, event) => {
        if (event.clipboardData && event.clipboardData.files && event.clipboardData.files[0]) {
          const file = event.clipboardData.files[0];
          if (file.type.startsWith('image/')) {
            uploadImageFile(file, view);
            return true;
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Keep editor content in sync with external initial value once it finishes loading
  React.useEffect(() => {
    if (editor && content !== editor.getHTML() && !editor.isFocused) {
      editor.commands.setContent(content || '<p></p>');
    }
  }, [content, editor]);

  // Handle Edit/Preview mode toggle
  React.useEffect(() => {
    if (editor) {
      editor.setEditable(!isPreview);
    }
  }, [isPreview, editor]);

  // Load Autosave from LocalStorage if available
  React.useEffect(() => {
    if (editor && articleId) {
      const autosaveKey = `wiki_autosave_${articleId}`;
      const savedHTML = localStorage.getItem(autosaveKey);
      if (savedHTML && savedHTML !== content && window.confirm('Найдена автоматически сохраненная копия статьи. Восстановить её?')) {
        editor.commands.setContent(savedHTML);
        onChange(savedHTML);
      }
    }
  }, [editor, articleId]);

  // Autosave interval (30 seconds)
  React.useEffect(() => {
    if (!editor || !articleId) return;

    const interval = setInterval(() => {
      const html = editor.getHTML();
      if (html && html !== '<p>Начните писать статью здесь...</p>' && html !== '<p></p>') {
        const autosaveKey = `wiki_autosave_${articleId}`;
        localStorage.setItem(autosaveKey, html);
        const timeStr = new Date().toLocaleTimeString();
        setLastAutosaved(timeStr);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [editor, articleId]);

  // Autocomplete link suggestions query with debounce
  React.useEffect(() => {
    if (!linkSearchQuery.trim()) {
      setLinkSuggestions([]);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      try {
        const res = await suggestArticles(linkSearchQuery);
        setLinkSuggestions(res);
      } catch (err) {
        console.error('Failed to get internal links suggestions:', err);
      }
    }, 250);
    return () => clearTimeout(delayDebounce);
  }, [linkSearchQuery]);

  if (!editor) return null;

  const insertImage = () => {
    const url = prompt('Введите URL адрес изображения:');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  const insertLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = prompt('Введите URL ссылки:', previousUrl);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const insertTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  const addEmoji = (emoji: string) => {
    editor.chain().focus().insertContent(emoji).run();
    setShowEmoji(false);
  };

  const insertYoutube = () => {
    const url = prompt('Введите URL видео с YouTube:');
    if (url) {
      editor.commands.setYoutubeVideo({
        src: url,
        width: 640,
        height: 480,
      });
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const res = await uploadImage(file);
      // Вставляем как красивую ссылку с иконкой скрепки
      editor
        .chain()
        .focus()
        .insertContent(`<a href="${res.url}" download="${file.name}" class="inline-flex items-center gap-1.5 text-indigo-650 dark:text-indigo-400 font-bold underline hover:text-indigo-850">📎 ${file.name}</a> `)
        .run();
    } catch (err: any) {
      alert(err.message || 'Ошибка загрузки файла');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const insertAlertBlock = (type: 'note' | 'important' | 'warning') => {
    let html = '';
    if (type === 'note') {
      html = `<div class="p-4 my-4 rounded-xl border border-blue-500/20 bg-blue-50/10 dark:bg-blue-950/5 text-blue-800 dark:text-blue-300"><strong>ℹ️ Примечание:</strong> Напишите примечание здесь...</div>`;
    } else if (type === 'important') {
      html = `<div class="p-4 my-4 rounded-xl border border-amber-500/20 bg-amber-50/10 dark:bg-amber-950/5 text-amber-800 dark:text-amber-300"><strong>⭐ Важно:</strong> Напишите важную информацию здесь...</div>`;
    } else if (type === 'warning') {
      html = `<div class="p-4 my-4 rounded-xl border border-rose-500/20 bg-rose-50/10 dark:bg-rose-950/5 text-rose-800 dark:text-rose-300"><strong>⚠️ Внимание:</strong> Напишите предупреждение здесь...</div>`;
    }
    editor.chain().focus().insertContent(html).run();
  };

  const handleInsertInternalLink = (art: Suggestion) => {
    editor
      .chain()
      .focus()
      .insertContent(`<a href="/articles/${art.slug}" class="text-indigo-650 dark:text-indigo-400 font-semibold underline hover:text-indigo-850">${art.title}</a> `)
      .run();
    setShowLinkSuggestions(false);
    setLinkSearchQuery('');
  };

  return (
    <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden bg-white dark:bg-neutral-950 shadow-sm relative">
      
      {/* Скрытый input для загрузки вложений */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        className="hidden" 
        accept=".pdf,.docx,.xlsx,.txt,.csv,.zip"
      />

      <style>{`
        .ProseMirror table {
          border-collapse: collapse;
          table-layout: fixed;
          width: 100%;
          margin: 1.5rem 0;
          overflow: hidden;
        }
        .ProseMirror th, .ProseMirror td {
          border: 1px solid #e4e4e7;
          padding: 8px 12px;
          position: relative;
          text-align: left;
          vertical-align: top;
          min-width: 50px;
        }
        .dark .ProseMirror th, .dark .ProseMirror td {
          border-color: #27272a;
        }
        .ProseMirror th {
          background-color: #f4f4f5;
          font-weight: 600;
        }
        .dark .ProseMirror th {
          background-color: #18181b;
        }
        .ProseMirror ul.task-list {
          list-style: none;
          padding-left: 0;
        }
        .ProseMirror ul.task-list li {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          margin: 0.25rem 0;
        }
        .ProseMirror ul.task-list li > label {
          margin-top: 2px;
          user-select: none;
        }
        .ProseMirror ul.task-list li > div {
          flex: 1;
        }
        .ProseMirror blockquote {
          border-left: 4px solid #cbd5e1;
          padding-left: 1rem;
          color: #64748b;
          font-style: italic;
        }
        .dark .ProseMirror blockquote {
          border-left-color: #475569;
          color: #94a3b8;
        }
      `}</style>

      {/* Editor Mode Header */}
      <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 px-4 py-2 select-none">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsPreview(false)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
              !isPreview 
                ? 'bg-indigo-650 text-white shadow-sm' 
                : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-850'
            }`}
          >
            ✏️ Редактор
          </button>
          
          <button
            type="button"
            onClick={() => setIsPreview(true)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
              isPreview 
                ? 'bg-indigo-650 text-white shadow-sm' 
                : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-850'
            }`}
          >
            {isPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            Предпросмотр
          </button>
        </div>

        {lastAutosaved && (
          <span className="text-[10px] text-neutral-450 flex items-center gap-1">
            <Save className="w-3 h-3 text-emerald-500 animate-pulse" />
            Автосохранено: {lastAutosaved}
          </span>
        )}
      </div>

      {/* Toolbar Controls */}
      {!isPreview && (
        <div className="flex flex-wrap items-center gap-1 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/25 p-2 select-none">
          
          {/* Headings H1-H4 */}
          <div className="flex items-center gap-0.5 border-r border-neutral-200 dark:border-neutral-800 pr-1.5 mr-1.5">
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              className={`p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors cursor-pointer ${editor.isActive('heading', { level: 1 }) ? 'bg-neutral-200 dark:bg-neutral-800 text-indigo-500' : 'text-neutral-500'}`}
              title="Заголовок H1"
            >
              <Heading1 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={`p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors cursor-pointer ${editor.isActive('heading', { level: 2 }) ? 'bg-neutral-200 dark:bg-neutral-800 text-indigo-500' : 'text-neutral-500'}`}
              title="Заголовок H2"
            >
              <Heading2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              className={`p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors cursor-pointer ${editor.isActive('heading', { level: 3 }) ? 'bg-neutral-200 dark:bg-neutral-800 text-indigo-500' : 'text-neutral-500'}`}
              title="Заголовок H3"
            >
              <Heading3 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
              className={`p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors cursor-pointer ${editor.isActive('heading', { level: 4 }) ? 'bg-neutral-200 dark:bg-neutral-800 text-indigo-500' : 'text-neutral-500'}`}
              title="Заголовок H4"
            >
              <Heading4 className="w-4 h-4" />
            </button>
          </div>

          {/* Font Family */}
          <div className="flex items-center gap-1 border-r border-neutral-200 dark:border-neutral-800 pr-1.5 mr-1.5">
            <select
              onChange={(e) => editor.chain().focus().setFontFamily(e.target.value).run()}
              className="text-[10px] border border-neutral-200 dark:border-neutral-800 rounded px-1.5 py-1 bg-white dark:bg-neutral-950 text-neutral-600 dark:text-neutral-400 outline-none cursor-pointer"
            >
              {FONT_FAMILIES.map(font => (
                <option key={font.value} value={font.value}>{font.name}</option>
              ))}
            </select>
          </div>

          {/* Text Style: Bold, Italic, Underline */}
          <div className="flex items-center gap-0.5 border-r border-neutral-200 dark:border-neutral-800 pr-1.5 mr-1.5">
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={`p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors cursor-pointer ${editor.isActive('bold') ? 'bg-neutral-200 dark:bg-neutral-800 text-indigo-500' : 'text-neutral-500'}`}
              title="Жирный"
            >
              <Bold className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={`p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors cursor-pointer ${editor.isActive('italic') ? 'bg-neutral-200 dark:bg-neutral-800 text-indigo-500' : 'text-neutral-500'}`}
              title="Курсив"
            >
              <Italic className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              className={`p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors cursor-pointer ${editor.isActive('underline') ? 'bg-neutral-200 dark:bg-neutral-800 text-indigo-500' : 'text-neutral-500'}`}
              title="Подчеркнутый"
            >
              <UnderlineIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleStrike().run()}
              className={`p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors cursor-pointer ${editor.isActive('strike') ? 'bg-neutral-200 dark:bg-neutral-800 text-indigo-500' : 'text-neutral-500'}`}
              title="Зачеркнутый"
            >
              <span className="font-semibold line-through text-xs px-0.5">ab</span>
            </button>
          </div>

          {/* Color & Highlight */}
          <div className="flex items-center gap-1 border-r border-neutral-200 dark:border-neutral-800 pr-1.5 mr-1.5">
            <select
              onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
              className="text-[10px] border border-neutral-200 dark:border-neutral-800 rounded px-1 py-1 bg-white dark:bg-neutral-950 text-neutral-600 dark:text-neutral-400 outline-none cursor-pointer"
              title="Цвет текста"
            >
              <option value="">Цвет</option>
              {COLORS.map(color => (
                <option key={color.value} value={color.value}>{color.name}</option>
              ))}
            </select>

            <select
              onChange={(e) => {
                if (e.target.value) {
                  editor.chain().focus().toggleHighlight({ color: e.target.value }).run();
                } else {
                  editor.chain().focus().unsetHighlight().run();
                }
              }}
              className="text-[10px] border border-neutral-200 dark:border-neutral-800 rounded px-1 py-1 bg-white dark:bg-neutral-950 text-neutral-600 dark:text-neutral-400 outline-none cursor-pointer"
              title="Маркер"
            >
              <option value="">Маркер</option>
              {HIGHLIGHTS.map(hl => (
                <option key={hl.value} value={hl.value}>{hl.name}</option>
              ))}
            </select>
          </div>

          {/* Alignments */}
          <div className="flex items-center gap-0.5 border-r border-neutral-200 dark:border-neutral-800 pr-1.5 mr-1.5">
            <button
              type="button"
              onClick={() => editor.chain().focus().setTextAlign('left').run()}
              className={`p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors cursor-pointer ${editor.isActive({ textAlign: 'left' }) ? 'bg-neutral-200 dark:bg-neutral-800 text-indigo-500' : 'text-neutral-500'}`}
              title="По левому краю"
            >
              <AlignLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().setTextAlign('center').run()}
              className={`p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors cursor-pointer ${editor.isActive({ textAlign: 'center' }) ? 'bg-neutral-200 dark:bg-neutral-800 text-indigo-500' : 'text-neutral-500'}`}
              title="По центру"
            >
              <AlignCenter className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().setTextAlign('right').run()}
              className={`p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors cursor-pointer ${editor.isActive({ textAlign: 'right' }) ? 'bg-neutral-200 dark:bg-neutral-800 text-indigo-500' : 'text-neutral-500'}`}
              title="По правому краю"
            >
              <AlignRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().setTextAlign('justify').run()}
              className={`p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors cursor-pointer ${editor.isActive({ textAlign: 'justify' }) ? 'bg-neutral-200 dark:bg-neutral-800 text-indigo-500' : 'text-neutral-500'}`}
              title="По ширине"
            >
              <AlignJustify className="w-4 h-4" />
            </button>
          </div>

          {/* Lists */}
          <div className="flex items-center gap-0.5 border-r border-neutral-200 dark:border-neutral-800 pr-1.5 mr-1.5">
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={`p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors cursor-pointer ${editor.isActive('bulletList') ? 'bg-neutral-200 dark:bg-neutral-800 text-indigo-500' : 'text-neutral-500'}`}
              title="Маркированный список"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={`p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors cursor-pointer ${editor.isActive('orderedList') ? 'bg-neutral-200 dark:bg-neutral-800 text-indigo-500' : 'text-neutral-500'}`}
              title="Нумерованный список"
            >
              <ListOrdered className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleTaskList().run()}
              className={`p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors cursor-pointer ${editor.isActive('taskList') ? 'bg-neutral-200 dark:bg-neutral-800 text-indigo-500' : 'text-neutral-500'}`}
              title="Чеклист"
            >
              <CheckSquare className="w-4 h-4" />
            </button>
          </div>

          {/* Alert Blocks */}
          <div className="flex items-center gap-0.5 border-r border-neutral-200 dark:border-neutral-800 pr-1.5 mr-1.5">
            <button
              type="button"
              onClick={() => insertAlertBlock('note')}
              className="px-1.5 py-1 text-[10px] font-bold rounded hover:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-550/15 cursor-pointer"
              title="Блок примечания"
            >
              ℹ️ Прим.
            </button>
            <button
              type="button"
              onClick={() => insertAlertBlock('important')}
              className="px-1.5 py-1 text-[10px] font-bold rounded hover:bg-amber-500/10 text-amber-600 dark:text-amber-450 border border-amber-550/15 cursor-pointer"
              title="Блок важно"
            >
              ⭐ Важно
            </button>
            <button
              type="button"
              onClick={() => insertAlertBlock('warning')}
              className="px-1.5 py-1 text-[10px] font-bold rounded hover:bg-rose-500/10 text-rose-600 dark:text-rose-450 border border-rose-550/15 cursor-pointer"
              title="Блок предупреждения"
            >
              ⚠️ Вним.
            </button>
          </div>

          {/* Media & Links */}
          <div className="flex items-center gap-0.5 border-r border-neutral-200 dark:border-neutral-800 pr-1.5 mr-1.5 relative">
            <button
              type="button"
              onClick={insertImage}
              className="p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors text-neutral-500 cursor-pointer"
              title="Картинка по URL"
            >
              <ImageIcon className="w-4 h-4" />
            </button>
            
            {/* Вложить файл */}
            <button
              type="button"
              onClick={triggerFileUpload}
              className="p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors text-neutral-500 cursor-pointer"
              title="Загрузить документ (PDF, Docx...)"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* YouTube Embed */}
            <button
              type="button"
              onClick={insertYoutube}
              className="p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors text-neutral-500 cursor-pointer"
              title="YouTube видео"
            >
              <YoutubeIcon className="w-4 h-4 text-red-500" />
            </button>

            <button
              type="button"
              onClick={insertLink}
              className={`p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors cursor-pointer ${editor.isActive('link') ? 'bg-neutral-200 dark:bg-neutral-800 text-indigo-500' : 'text-neutral-500'}`}
              title="Внешняя ссылка"
            >
              <LinkIcon className="w-4 h-4" />
            </button>

            {/* Внутренняя ссылка с автокомплитом */}
            <button
              type="button"
              onClick={() => setShowLinkSuggestions(!showLinkSuggestions)}
              className={`p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors cursor-pointer ${showLinkSuggestions ? 'bg-neutral-200 dark:bg-neutral-800 text-indigo-500' : 'text-neutral-500'}`}
              title="Внутренняя ссылка на статью Wiki"
            >
              <BookOpen className="w-4 h-4" />
            </button>

            {/* Autocomplete Dropdown */}
            {showLinkSuggestions && (
              <div className="absolute top-8 left-0 z-20 w-64 p-3 bg-white dark:bg-neutral-950 border border-neutral-250 dark:border-neutral-800 rounded-xl shadow-2xl space-y-2 animate-scaleUp">
                <div className="text-[10px] font-bold text-neutral-400 uppercase">Поиск статьи Wiki</div>
                <input
                  type="text"
                  placeholder="Введите название статьи..."
                  value={linkSearchQuery}
                  onChange={(e) => setLinkSearchQuery(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50 dark:bg-neutral-900 outline-none text-neutral-900 dark:text-white"
                />
                
                <div className="max-h-36 overflow-y-auto divide-y divide-neutral-100/30 dark:divide-neutral-900/30">
                  {linkSuggestions.length === 0 ? (
                    <div className="text-[10px] text-neutral-400 py-2 text-center italic">
                      {linkSearchQuery ? 'Ничего не найдено' : 'Начните вводить название...'}
                    </div>
                  ) : (
                    linkSuggestions.map(art => (
                      <div
                        key={art.id}
                        onClick={() => handleInsertInternalLink(art)}
                        className="py-1.5 px-2 hover:bg-neutral-100 dark:hover:bg-neutral-900 cursor-pointer text-xs truncate font-semibold text-neutral-700 dark:text-neutral-350"
                      >
                        {art.title}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              className={`p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors cursor-pointer ${editor.isActive('blockquote') ? 'bg-neutral-200 dark:bg-neutral-800 text-indigo-500' : 'text-neutral-500'}`}
              title="Цитата"
            >
              <Quote className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
              className={`p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors cursor-pointer ${editor.isActive('codeBlock') ? 'bg-neutral-200 dark:bg-neutral-800 text-indigo-500' : 'text-neutral-500'}`}
              title="Блок кода"
            >
              <Code className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={insertTable}
              className="p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors text-neutral-500 cursor-pointer"
              title="Таблица"
            >
              <TableIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Table tools */}
          {editor.isActive('table') && (
            <div className="flex items-center gap-0.5 border-r border-neutral-200 dark:border-neutral-800 pr-1.5 mr-1.5 text-[9px] text-neutral-400">
              <button
                type="button"
                onClick={() => editor.chain().focus().addColumnAfter().run()}
                className="px-1 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded hover:bg-neutral-200 text-neutral-600 dark:text-neutral-300 cursor-pointer"
              >
                +Кол.
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().deleteColumn().run()}
                className="px-1 py-0.5 bg-red-100 dark:bg-red-950/20 text-red-500 rounded hover:bg-red-200 cursor-pointer"
              >
                -Кол.
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().addRowAfter().run()}
                className="px-1 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded hover:bg-neutral-200 text-neutral-600 dark:text-neutral-300 cursor-pointer"
              >
                +Стр.
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().deleteRow().run()}
                className="px-1 py-0.5 bg-red-100 dark:bg-red-950/20 text-red-500 rounded hover:bg-red-200 cursor-pointer"
              >
                -Стр.
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().deleteTable().run()}
                className="px-1 py-0.5 bg-red-500 text-white rounded hover:bg-red-600 font-bold cursor-pointer"
              >
                Удалить
              </button>
            </div>
          )}

          {/* Emoji & Undo/Redo */}
          <div className="flex items-center gap-0.5 relative">
            <button
              type="button"
              onClick={() => setShowEmoji(!showEmoji)}
              className="p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors text-neutral-500 cursor-pointer"
              title="Смайлики"
            >
              <Smile className="w-4 h-4" />
            </button>
            {showEmoji && (
              <div className="absolute top-8 left-0 z-10 grid grid-cols-7 gap-1 p-2 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-xl w-44">
                {EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => addEmoji(emoji)}
                    className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-900 rounded text-center text-sm cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => editor.chain().focus().undo().run()}
              className="p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors text-neutral-500 cursor-pointer"
              title="Назад"
            >
              <Undo className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().redo().run()}
              className="p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors text-neutral-500 cursor-pointer"
              title="Вперед"
            >
              <Redo className="w-4 h-4" />
            </button>
          </div>

        </div>
      )}

      {/* Editor Content Area */}
      <div className="bg-white dark:bg-neutral-950 transition-all select-text">
        <EditorContent editor={editor} />
      </div>

    </div>
  );
}
