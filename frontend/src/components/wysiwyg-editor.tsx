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

import { 
  Bold, Italic, Underline as UnderlineIcon, 
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, CheckSquare, Image as ImageIcon,
  Link as LinkIcon, Quote, Code, Heading1, Heading2, Heading3,
  Undo, Redo, Table as TableIcon, Smile, Eye, EyeOff, Save
} from 'lucide-react';
import { uploadImage } from '../lib/api';

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
          class: 'text-indigo-600 dark:text-indigo-400 underline cursor-pointer',
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
    ],
    content: content || '<p>Начните писать статью здесь...</p>',
    editorProps: {
      attributes: {
        class: 'prose-custom prose dark:prose-invert focus:outline-none min-h-[400px] max-h-[600px] overflow-y-auto px-4 py-3',
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

  // Autosave interval
  React.useEffect(() => {
    if (!editor || !articleId) return;

    const interval = setInterval(() => {
      const html = editor.getHTML();
      if (html && html !== '<p>Начните писать статью здесь...</p>') {
        const autosaveKey = `wiki_autosave_${articleId}`;
        localStorage.setItem(autosaveKey, html);
        const timeStr = new Date().toLocaleTimeString();
        setLastAutosaved(timeStr);
      }
    }, 30000); // Save every 30 seconds

    return () => clearInterval(interval);
  }, [editor, articleId]);

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
    
    // cancelled
    if (url === null) return;
    
    // empty
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

  return (
    <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden bg-white dark:bg-neutral-950 shadow-sm">
      
      {/* Editor CSS styling injections */}
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
      <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 px-4 py-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsPreview(false)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
              !isPreview 
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/10' 
                : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            <Smile className="w-3.5 h-3.5" />
            Редактор
          </button>
          
          <button
            type="button"
            onClick={() => setIsPreview(true)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
              isPreview 
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/10' 
                : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            {isPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            Предпросмотр
          </button>
        </div>

        {lastAutosaved && (
          <span className="text-[10px] text-neutral-400 flex items-center gap-1">
            <Save className="w-3 h-3 text-emerald-500" />
            Автосохранение: {lastAutosaved}
          </span>
        )}
      </div>

      {/* Toolbar Controls */}
      {!isPreview && (
        <div className="flex flex-wrap items-center gap-1 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/25 p-2">
          
          {/* Headings */}
          <div className="flex items-center gap-0.5 border-r border-neutral-200 dark:border-neutral-800 pr-1.5 mr-1.5">
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              className={`p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors ${editor.isActive('heading', { level: 1 }) ? 'bg-neutral-200 dark:bg-neutral-800 text-indigo-500' : 'text-neutral-500'}`}
              title="Heading 1"
            >
              <Heading1 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={`p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors ${editor.isActive('heading', { level: 2 }) ? 'bg-neutral-200 dark:bg-neutral-800 text-indigo-500' : 'text-neutral-500'}`}
              title="Heading 2"
            >
              <Heading2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              className={`p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors ${editor.isActive('heading', { level: 3 }) ? 'bg-neutral-200 dark:bg-neutral-800 text-indigo-500' : 'text-neutral-500'}`}
              title="Heading 3"
            >
              <Heading3 className="w-4 h-4" />
            </button>
          </div>

          {/* Font Family selector */}
          <div className="flex items-center gap-1 border-r border-neutral-200 dark:border-neutral-800 pr-1.5 mr-1.5">
            <select
              onChange={(e) => editor.chain().focus().setFontFamily(e.target.value).run()}
              className="text-[10px] border border-neutral-200 dark:border-neutral-800 rounded px-1.5 py-1 bg-white dark:bg-neutral-950 text-neutral-600 dark:text-neutral-400 outline-none"
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
              className={`p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors ${editor.isActive('bold') ? 'bg-neutral-200 dark:bg-neutral-800 text-indigo-500' : 'text-neutral-500'}`}
              title="Жирный"
            >
              <Bold className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={`p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors ${editor.isActive('italic') ? 'bg-neutral-200 dark:bg-neutral-800 text-indigo-500' : 'text-neutral-500'}`}
              title="Курсив"
            >
              <Italic className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              className={`p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors ${editor.isActive('underline') ? 'bg-neutral-200 dark:bg-neutral-800 text-indigo-500' : 'text-neutral-500'}`}
              title="Подчеркнутый"
            >
              <UnderlineIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Color Picker & Highlight Dropdowns */}
          <div className="flex items-center gap-1 border-r border-neutral-200 dark:border-neutral-800 pr-1.5 mr-1.5">
            {/* Text Color */}
            <select
              onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
              className="text-[10px] border border-neutral-200 dark:border-neutral-800 rounded px-1 py-1 bg-white dark:bg-neutral-950 text-neutral-600 dark:text-neutral-400 outline-none"
              title="Цвет текста"
            >
              <option value="">Цвет текста</option>
              {COLORS.map(color => (
                <option key={color.value} value={color.value}>{color.name}</option>
              ))}
            </select>

            {/* Highlight Color */}
            <select
              onChange={(e) => {
                if (e.target.value) {
                  editor.chain().focus().toggleHighlight({ color: e.target.value }).run();
                } else {
                  editor.chain().focus().unsetHighlight().run();
                }
              }}
              className="text-[10px] border border-neutral-200 dark:border-neutral-800 rounded px-1 py-1 bg-white dark:bg-neutral-950 text-neutral-600 dark:text-neutral-400 outline-none"
              title="Выделение маркером"
            >
              <option value="">Без маркера</option>
              {HIGHLIGHTS.map(hl => (
                <option key={hl.value} value={hl.value}>{hl.name}</option>
              ))}
            </select>
          </div>

          {/* Alignment */}
          <div className="flex items-center gap-0.5 border-r border-neutral-200 dark:border-neutral-800 pr-1.5 mr-1.5">
            <button
              type="button"
              onClick={() => editor.chain().focus().setTextAlign('left').run()}
              className={`p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors ${editor.isActive({ textAlign: 'left' }) ? 'bg-neutral-200 dark:bg-neutral-800 text-indigo-500' : 'text-neutral-500'}`}
              title="По левому краю"
            >
              <AlignLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().setTextAlign('center').run()}
              className={`p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors ${editor.isActive({ textAlign: 'center' }) ? 'bg-neutral-200 dark:bg-neutral-800 text-indigo-500' : 'text-neutral-500'}`}
              title="По центру"
            >
              <AlignCenter className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().setTextAlign('right').run()}
              className={`p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors ${editor.isActive({ textAlign: 'right' }) ? 'bg-neutral-200 dark:bg-neutral-800 text-indigo-500' : 'text-neutral-500'}`}
              title="По правому краю"
            >
              <AlignRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().setTextAlign('justify').run()}
              className={`p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors ${editor.isActive({ textAlign: 'justify' }) ? 'bg-neutral-200 dark:bg-neutral-800 text-indigo-500' : 'text-neutral-500'}`}
              title="По ширине"
            >
              <AlignJustify className="w-4 h-4" />
            </button>
          </div>

          {/* Bullet, Ordered List and Checklist */}
          <div className="flex items-center gap-0.5 border-r border-neutral-200 dark:border-neutral-800 pr-1.5 mr-1.5">
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={`p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors ${editor.isActive('bulletList') ? 'bg-neutral-200 dark:bg-neutral-800 text-indigo-500' : 'text-neutral-500'}`}
              title="Маркированный список"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={`p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors ${editor.isActive('orderedList') ? 'bg-neutral-200 dark:bg-neutral-800 text-indigo-500' : 'text-neutral-500'}`}
              title="Нумерованный список"
            >
              <ListOrdered className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleTaskList().run()}
              className={`p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors ${editor.isActive('taskList') ? 'bg-neutral-200 dark:bg-neutral-800 text-indigo-500' : 'text-neutral-500'}`}
              title="Чеклист"
            >
              <CheckSquare className="w-4 h-4" />
            </button>
          </div>

          {/* Image, Link, Quote, Code, Table */}
          <div className="flex items-center gap-0.5 border-r border-neutral-200 dark:border-neutral-800 pr-1.5 mr-1.5">
            <button
              type="button"
              onClick={insertImage}
              className="p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors text-neutral-500"
              title="Вставить картинку"
            >
              <ImageIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={insertLink}
              className={`p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors ${editor.isActive('link') ? 'bg-neutral-200 dark:bg-neutral-800 text-indigo-500' : 'text-neutral-500'}`}
              title="Добавить ссылку"
            >
              <LinkIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              className={`p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors ${editor.isActive('blockquote') ? 'bg-neutral-200 dark:bg-neutral-800 text-indigo-500' : 'text-neutral-500'}`}
              title="Цитата"
            >
              <Quote className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
              className={`p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors ${editor.isActive('codeBlock') ? 'bg-neutral-200 dark:bg-neutral-800 text-indigo-500' : 'text-neutral-500'}`}
              title="Блок кода"
            >
              <Code className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={insertTable}
              className="p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors text-neutral-500"
              title="Вставить таблицу (3x3)"
            >
              <TableIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Table management options (show if inside table) */}
          {editor.isActive('table') && (
            <div className="flex items-center gap-0.5 border-r border-neutral-200 dark:border-neutral-800 pr-1.5 mr-1.5 text-[9px] text-neutral-400">
              <button
                type="button"
                onClick={() => editor.chain().focus().addColumnAfter().run()}
                className="px-1 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded hover:bg-neutral-200 text-neutral-600 dark:text-neutral-300"
              >
                +Колонка
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().deleteColumn().run()}
                className="px-1 py-0.5 bg-red-100 dark:bg-red-950/20 text-red-500 rounded hover:bg-red-200"
              >
                -Колонка
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().addRowAfter().run()}
                className="px-1 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded hover:bg-neutral-200 text-neutral-600 dark:text-neutral-300"
              >
                +Строка
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().deleteRow().run()}
                className="px-1 py-0.5 bg-red-100 dark:bg-red-950/20 text-red-500 rounded hover:bg-red-200"
              >
                -Строка
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().deleteTable().run()}
                className="px-1 py-0.5 bg-red-500 text-white rounded hover:bg-red-600 font-bold"
              >
                Удалить
              </button>
            </div>
          )}

          {/* Emojis & History */}
          <div className="flex items-center gap-0.5 relative">
            <button
              type="button"
              onClick={() => setShowEmoji(!showEmoji)}
              className="p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors text-neutral-500"
              title="Emoji"
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
                    className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-900 rounded text-center text-sm"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => editor.chain().focus().undo().run()}
              className="p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors text-neutral-500"
              title="Назад (Undo)"
            >
              <Undo className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().redo().run()}
              className="p-1.5 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors text-neutral-500"
              title="Вперед (Redo)"
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
