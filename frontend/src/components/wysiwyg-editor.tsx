import * as React from 'react';
import { useEditor, EditorContent, NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import { Extension, Node, mergeAttributes } from '@tiptap/core';
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
import Heading from '@tiptap/extension-heading';

import { 
  Bold, Italic, Underline as UnderlineIcon, 
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, CheckSquare, Image as ImageIcon,
  Link as LinkIcon, Quote, Code, Heading1, Heading2, Heading3, Heading4,
  Undo, Redo, Table as TableIcon, Smile, Eye, EyeOff, Save,
  Youtube as YoutubeIcon, Paperclip, BookOpen, AlertTriangle, ChevronDown, Type,
  Palette, Highlighter, Ban
} from 'lucide-react';
import { uploadImage, suggestArticles, Suggestion } from '../lib/api';

export const CustomHeading = Heading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      'data-toc-title': {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-toc-title'),
        renderHTML: (attributes: Record<string, any>) => {
          if (!attributes['data-toc-title']) {
            return {};
          }
          return {
            'data-toc-title': attributes['data-toc-title'],
          };
        },
      },
      'data-toc-hidden': {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-toc-hidden'),
        renderHTML: (attributes: Record<string, any>) => {
          if (!attributes['data-toc-hidden']) {
            return {};
          }
          return {
            'data-toc-hidden': attributes['data-toc-hidden'],
          };
        },
      },
    };
  },
});

interface WYSIWYGEditorProps {
  content: string;
  onChange: (html: string) => void;
  articleId?: string | number;
  onEditorReady?: (editor: any) => void;
}

const FONT_FAMILIES = [
  { name: 'Системный', value: 'Inter, system-ui, sans-serif' },
  { name: 'Serif (С засечками)', value: 'Georgia, serif' },
  { name: 'Monospace (Код)', value: 'Fira Code, monospace' },
];

const FONT_SIZES = [
  { name: '12 px', value: '12px' },
  { name: '14 px', value: '14px' },
  { name: '16 px', value: '16px' },
  { name: '18 px', value: '18px' },
  { name: '20 px', value: '20px' },
  { name: '24 px', value: '24px' },
  { name: '28 px', value: '28px' },
  { name: '32 px', value: '32px' },
  { name: '40 px', value: '40px' },
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

const escapeHtml = (value: string) => (
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
);

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (fontSize: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
    collapsibleBlock: {
      insertCollapsibleBlock: (attrs?: {
        title?: string;
        defaultOpen?: boolean;
        allowMultiple?: boolean;
        requiredForAck?: boolean;
      }) => ReturnType;
    };
  }
}

const FontSize = Extension.create({
  name: 'fontSize',

  addOptions() {
    return {
      types: ['textStyle'],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize?.replace(/['"]+/g, '') || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return {
                style: `font-size: ${attributes.fontSize}`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontSize }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    };
  },
});

const CollapsibleBlockView = ({ node, updateAttributes }: any) => {
  const attrs = node.attrs || {};

  return (
    <NodeViewWrapper className="wiki-collapsible-editor my-4 rounded-xl border border-indigo-500/25 bg-indigo-500/[0.035] p-3">
      <div className="mb-3 flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
        <label className="text-[10px] font-extrabold uppercase text-muted-foreground">
          Заголовок раскрывающегося блока
        </label>
        <input
          value={attrs.title || ''}
          onChange={(event) => updateAttributes({ title: event.target.value })}
          className="h-9 rounded-lg border border-border bg-muted px-3 text-sm font-bold text-foreground outline-none focus:border-indigo-500"
          placeholder="Например: Детали тарифа"
        />
        <div className="grid gap-2 text-[11px] font-semibold text-muted-foreground sm:grid-cols-3">
          <label className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-2">
            <input
              type="checkbox"
              checked={!!attrs.defaultOpen}
              onChange={(event) => updateAttributes({ defaultOpen: event.target.checked })}
              className="h-3.5 w-3.5 rounded border-border text-indigo-600"
            />
            <span>Открыт после публикации</span>
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-2">
            <input
              type="checkbox"
              checked={attrs.allowMultiple !== false}
              onChange={(event) => updateAttributes({ allowMultiple: event.target.checked })}
              className="h-3.5 w-3.5 rounded border-border text-indigo-600"
            />
            <span>Можно открывать несколько</span>
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-2">
            <input
              type="checkbox"
              checked={!!attrs.requiredForAck}
              onChange={(event) => updateAttributes({ requiredForAck: event.target.checked })}
              className="h-3.5 w-3.5 rounded border-border text-indigo-600"
            />
            <span>Обязательно открыть</span>
          </label>
        </div>
      </div>
      <div className="rounded-lg border border-dashed border-indigo-500/25 bg-card/70 p-3">
        <div className="mb-2 flex items-center gap-2 text-[10px] font-extrabold uppercase text-indigo-500">
          <ChevronDown className="h-3.5 w-3.5" />
          Содержимое блока
        </div>
        <NodeViewContent className="wiki-collapsible-editor-content min-h-12 text-foreground" />
      </div>
    </NodeViewWrapper>
  );
};

const CollapsibleBlock = Node.create({
  name: 'collapsibleBlock',
  group: 'block',
  content: 'block+',
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      title: {
        default: 'Раскрывающийся блок',
        parseHTML: (element) => element.getAttribute('data-title') || element.querySelector('summary')?.textContent || 'Раскрывающийся блок',
        renderHTML: (attributes) => ({ 'data-title': attributes.title }),
      },
      defaultOpen: {
        default: false,
        parseHTML: (element) => element.hasAttribute('open') || element.getAttribute('data-default-open') === 'true',
        renderHTML: (attributes) => ({
          'data-default-open': attributes.defaultOpen ? 'true' : 'false',
          ...(attributes.defaultOpen ? { open: '' } : {}),
        }),
      },
      allowMultiple: {
        default: true,
        parseHTML: (element) => element.getAttribute('data-allow-multiple') !== 'false',
        renderHTML: (attributes) => ({ 'data-allow-multiple': attributes.allowMultiple === false ? 'false' : 'true' }),
      },
      requiredForAck: {
        default: false,
        parseHTML: (element) => element.getAttribute('data-required-for-ack') === 'true',
        renderHTML: (attributes) => ({ 'data-required-for-ack': attributes.requiredForAck ? 'true' : 'false' }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'details[data-wiki-collapsible="true"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'details',
      mergeAttributes(HTMLAttributes, {
        'data-wiki-collapsible': 'true',
        class: 'wiki-collapsible-block',
      }),
      ['summary', { class: 'wiki-collapsible-summary' }, node.attrs.title || 'Раскрывающийся блок'],
      ['div', { class: 'wiki-collapsible-content' }, 0],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CollapsibleBlockView);
  },

  addCommands() {
    return {
      insertCollapsibleBlock:
        (attrs = {}) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: {
              title: attrs.title || 'Раскрывающийся блок',
              defaultOpen: !!attrs.defaultOpen,
              allowMultiple: attrs.allowMultiple !== false,
              requiredForAck: !!attrs.requiredForAck,
            },
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Добавьте содержимое блока...' }],
              },
            ],
          }),
    };
  },
});

export default function WYSIWYGEditor({ content, onChange, articleId, onEditorReady }: WYSIWYGEditorProps) {
  const [isPreview, setIsPreview] = React.useState(false);
  const [showEmoji, setShowEmoji] = React.useState(false);
  const [lastAutosaved, setLastAutosaved] = React.useState<string | null>(null);
  const [activeFontSize, setActiveFontSize] = React.useState('');
  const [contextMenuCoords, setContextMenuCoords] = React.useState<{ top: number; left: number } | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const contextMenuRef = React.useRef<HTMLDivElement>(null);

  // States for internal article linking autocomplete
  const [showLinkSuggestions, setShowLinkSuggestions] = React.useState(false);
  const [linkSearchQuery, setLinkSearchQuery] = React.useState('');
  const [linkSuggestions, setLinkSuggestions] = React.useState<Suggestion[]>([]);

  // Color & Highlight states
  const [selectedColor, setSelectedColor] = React.useState<string>('#ef4444');
  const [selectedHighlight, setSelectedHighlight] = React.useState<string>('#fef08a');
  const [isColorMenuOpen, setIsColorMenuOpen] = React.useState(false);
  const [isHighlightMenuOpen, setIsHighlightMenuOpen] = React.useState(false);

  const colorMenuRef = React.useRef<HTMLDivElement>(null);
  const highlightMenuRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as any;
      if (colorMenuRef.current && !colorMenuRef.current.contains(target)) {
        setIsColorMenuOpen(false);
      }
      if (highlightMenuRef.current && !highlightMenuRef.current.contains(target)) {
        setIsHighlightMenuOpen(false);
      }
      if (contextMenuRef.current && !contextMenuRef.current.contains(target)) {
        setContextMenuCoords(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsColorMenuOpen(false);
        setIsHighlightMenuOpen(false);
        setContextMenuCoords(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const withArticleScope = React.useCallback((url: string) => {
    if (!articleId || articleId === 'new' || !url.startsWith('/uploads/')) return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}articleId=${encodeURIComponent(String(articleId))}`;
  }, [articleId]);

  const uploadImageFile = async (file: File, view: any) => {
    try {
      const res = await uploadImage(file);
      const { schema } = view.state;
      const node = schema.nodes.image.create({ src: withArticleScope(res.url) });
      const transaction = view.state.tr.replaceSelectionWith(node);
      view.dispatch(transaction);
    } catch (err: any) {
      alert(err.message || 'Ошибка загрузки изображения');
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
      }),
      CustomHeading.configure({
        levels: [1, 2, 3, 4, 5, 6],
      }),
      CollapsibleBlock,
      Underline,
      TextStyle,
      FontSize,
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

  const handleApplyColor = React.useCallback((colorValue: string) => {
    if (!editor) return;
    if (colorValue) {
      setSelectedColor(colorValue);
      editor.chain().focus().setColor(colorValue).run();
    } else {
      editor.chain().focus().unsetColor().run();
    }
    setIsColorMenuOpen(false);
    setIsHighlightMenuOpen(false);
    setContextMenuCoords(null);
  }, [editor]);

  const handleApplyHighlight = React.useCallback((highlightValue: string) => {
    if (!editor) return;
    if (highlightValue) {
      setSelectedHighlight(highlightValue);
      editor.chain().focus().setHighlight({ color: highlightValue }).run();
    } else {
      editor.chain().focus().unsetHighlight().run();
    }
    setIsHighlightMenuOpen(false);
    setIsColorMenuOpen(false);
    setContextMenuCoords(null);
  }, [editor]);

  const handleContextMenu = React.useCallback((e: React.MouseEvent) => {
    if (isPreview || !editor) return;
    const { empty } = editor.state.selection;
    if (empty) {
      setContextMenuCoords(null);
      return;
    }
    e.preventDefault();
    setIsColorMenuOpen(false);
    setIsHighlightMenuOpen(false);

    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const top = Math.max(8, Math.min(e.clientY - containerRect.top + 8, containerRect.height - 50));
    const left = Math.max(8, Math.min(e.clientX - containerRect.left + 8, containerRect.width - 240));

    setContextMenuCoords({ top, left });
  }, [editor, isPreview]);

  React.useEffect(() => {
    if (!editor) return;

    if (onEditorReady) {
      onEditorReady(editor);
    }

    const syncFontSize = () => {
      setActiveFontSize(editor.getAttributes('textStyle').fontSize || '');
    };

    const handleSelectionChange = () => {
      const { empty } = editor.state.selection;
      if (empty) {
        setContextMenuCoords(null);
      }
    };

    editor.on('selectionUpdate', syncFontSize);
    editor.on('transaction', syncFontSize);
    editor.on('selectionUpdate', handleSelectionChange);
    syncFontSize();

    return () => {
      editor.off('selectionUpdate', syncFontSize);
      editor.off('transaction', syncFontSize);
      editor.off('selectionUpdate', handleSelectionChange);
    };
  }, [editor, isPreview]);

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

  const adjustFontSize = (direction: 1 | -1) => {
    const values = FONT_SIZES.map((size) => size.value);
    const current = activeFontSize || editor.getAttributes('textStyle').fontSize || '16px';
    const currentIndex = Math.max(0, values.indexOf(current));
    const nextIndex = Math.min(values.length - 1, Math.max(0, currentIndex + direction));
    const nextSize = values[nextIndex];
    setActiveFontSize(nextSize);
    editor.chain().focus().setFontSize(nextSize).run();
  };

  const insertCollapsibleBlock = () => {
    editor.chain().focus().insertCollapsibleBlock({
      title: 'Новый раскрывающийся блок',
      defaultOpen: false,
      allowMultiple: true,
      requiredForAck: false,
    }).run();
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
      const scopedUrl = withArticleScope(res.url);
      // Вставляем как красивую ссылку с иконкой скрепки
      editor
        .chain()
        .focus()
        .insertContent(`<a href="${scopedUrl}" download="${file.name}" class="inline-flex items-center gap-1.5 text-indigo-650 dark:text-indigo-400 font-bold underline hover:text-indigo-850">📎 ${file.name}</a> `)
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
    const href = `/articles/${art.slug}`;
    editor
      .chain()
      .focus()
      .insertContent(
        `<a href="${escapeHtml(href)}" data-link-kind="article" data-article-id="${art.id}" class="text-indigo-650 dark:text-indigo-400 font-semibold underline hover:text-indigo-850">${escapeHtml(art.title)}</a> `
      )
      .run();
    setShowLinkSuggestions(false);
    setLinkSearchQuery('');
  };

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card text-card-foreground shadow-sm relative">
      
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
          border-color: var(--border);
        }
        .ProseMirror th {
          background-color: var(--muted);
          font-weight: 600;
        }
        .dark .ProseMirror th {
          background-color: var(--muted);
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
        .ProseMirror .wiki-collapsible-editor-content > *:first-child {
          margin-top: 0;
        }
        .ProseMirror .wiki-collapsible-editor-content > *:last-child {
          margin-bottom: 0;
        }
        .wiki-collapsible-block {
          margin: 1rem 0;
          border: 1px solid var(--border);
          border-radius: 0.75rem;
          background: var(--card);
          overflow: hidden;
        }
        .wiki-collapsible-summary {
          cursor: pointer;
          list-style: none;
          padding: 0.875rem 1rem;
          font-weight: 800;
          color: var(--foreground);
          background: var(--muted);
        }
        .wiki-collapsible-summary::-webkit-details-marker {
          display: none;
        }
        .wiki-collapsible-content {
          padding: 1rem;
          border-top: 1px solid var(--border);
        }
      `}</style>

      {/* Editor Mode Header */}
      <div className="flex items-center justify-between border-b border-border bg-muted px-4 py-2 select-none">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsPreview(false)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
              !isPreview 
                ? 'bg-indigo-650 text-white shadow-sm' 
                : 'text-muted-foreground hover:bg-muted'
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
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {isPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            Предпросмотр
          </button>
        </div>

        {lastAutosaved && (
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Save className="w-3 h-3 text-emerald-500 animate-pulse" />
            Автосохранено: {lastAutosaved}
          </span>
        )}
      </div>

      {/* Toolbar Controls */}
      {!isPreview && (
        <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/30 p-2 select-none">
          
          {/* Headings H1-H4 */}
          <div className="flex items-center gap-0.5 border-r border-border pr-1.5 mr-1.5">
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              className={`p-1.5 rounded hover:bg-muted transition-colors cursor-pointer ${editor.isActive('heading', { level: 1 }) ? 'bg-muted text-indigo-500' : 'text-muted-foreground'}`}
              title="Заголовок H1"
            >
              <Heading1 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={`p-1.5 rounded hover:bg-muted transition-colors cursor-pointer ${editor.isActive('heading', { level: 2 }) ? 'bg-muted text-indigo-500' : 'text-muted-foreground'}`}
              title="Заголовок H2"
            >
              <Heading2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              className={`p-1.5 rounded hover:bg-muted transition-colors cursor-pointer ${editor.isActive('heading', { level: 3 }) ? 'bg-muted text-indigo-500' : 'text-muted-foreground'}`}
              title="Заголовок H3"
            >
              <Heading3 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
              className={`p-1.5 rounded hover:bg-muted transition-colors cursor-pointer ${editor.isActive('heading', { level: 4 }) ? 'bg-muted text-indigo-500' : 'text-muted-foreground'}`}
              title="Заголовок H4"
            >
              <Heading4 className="w-4 h-4" />
            </button>
          </div>

          {/* Font Family */}
          <div className="flex items-center gap-1 border-r border-border pr-1.5 mr-1.5">
            <select
              onChange={(e) => editor.chain().focus().setFontFamily(e.target.value).run()}
              className="text-[10px] border border-border rounded px-1.5 py-1 bg-card text-muted-foreground outline-none cursor-pointer"
            >
              {FONT_FAMILIES.map(font => (
                <option key={font.value} value={font.value}>{font.name}</option>
              ))}
            </select>

            <select
              value={activeFontSize}
              onChange={(e) => {
                const size = e.target.value;
                setActiveFontSize(size);
                if (size) {
                  editor.chain().focus().setFontSize(size).run();
                } else {
                  editor.chain().focus().unsetFontSize().run();
                }
              }}
              className="h-8 min-w-[92px] text-[11px] font-semibold border border-border rounded px-2 bg-card text-foreground outline-none cursor-pointer"
              title="Размер текста"
            >
              <option value="">Размер</option>
              {FONT_SIZES.map(size => (
                <option key={size.value} value={size.value}>{size.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => adjustFontSize(-1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded border border-border bg-card text-xs font-extrabold text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Уменьшить шрифт"
            >
              A-
            </button>
            <button
              type="button"
              onClick={() => adjustFontSize(1)}
              className="inline-flex h-8 w-8 items-center justify-center rounded border border-border bg-card text-sm font-extrabold text-foreground hover:bg-muted"
              title="Увеличить шрифт"
            >
              A+
            </button>
          </div>

          {/* Text Style: Bold, Italic, Underline */}
          <div className="flex items-center gap-0.5 border-r border-border pr-1.5 mr-1.5">
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={`p-1.5 rounded hover:bg-muted transition-colors cursor-pointer ${editor.isActive('bold') ? 'bg-muted text-indigo-500' : 'text-muted-foreground'}`}
              title="Жирный"
            >
              <Bold className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={`p-1.5 rounded hover:bg-muted transition-colors cursor-pointer ${editor.isActive('italic') ? 'bg-muted text-indigo-500' : 'text-muted-foreground'}`}
              title="Курсив"
            >
              <Italic className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              className={`p-1.5 rounded hover:bg-muted transition-colors cursor-pointer ${editor.isActive('underline') ? 'bg-muted text-indigo-500' : 'text-muted-foreground'}`}
              title="Подчеркнутый"
            >
              <UnderlineIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleStrike().run()}
              className={`p-1.5 rounded hover:bg-muted transition-colors cursor-pointer ${editor.isActive('strike') ? 'bg-muted text-indigo-500' : 'text-muted-foreground'}`}
              title="Зачеркнутый"
            >
              <span className="font-semibold line-through text-xs px-0.5">ab</span>
            </button>
          </div>

          {/* Color & Highlight Tools */}
          <div className="flex items-center gap-1 border-r border-border pr-1.5 mr-1.5">
            {/* 1. TEXT COLOR TOOL */}
            <div ref={colorMenuRef} className="relative flex items-center">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleApplyColor(selectedColor);
                }}
                className="p-1.5 rounded-l border border-r-0 border-border hover:bg-muted transition-all cursor-pointer flex items-center gap-1"
                title={`Применить цвет текста (${COLORS.find(c => c.value === selectedColor)?.name || 'Выбранный'})`}
              >
                <div className="flex flex-col items-center">
                  <span className="font-bold text-xs leading-none">A</span>
                  <div 
                    className="w-3.5 h-1 rounded-full mt-0.5" 
                    style={{ backgroundColor: selectedColor }} 
                  />
                </div>
              </button>

              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setIsColorMenuOpen(prev => !prev);
                  setIsHighlightMenuOpen(false);
                }}
                className="p-1 rounded-r border border-border hover:bg-muted transition-all cursor-pointer text-muted-foreground"
                title="Выбрать цвет текста"
              >
                <ChevronDown className="w-3 h-3" />
              </button>

              {isColorMenuOpen && (
                <div className="absolute top-full left-0 mt-1.5 p-2 bg-card border border-border rounded-xl shadow-xl z-50 min-w-[160px] animate-scaleUp">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 px-1">
                    Цвет текста
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 mb-2">
                    {COLORS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleApplyColor(c.value);
                        }}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer border ${
                          selectedColor === c.value ? 'ring-2 ring-indigo-500 ring-offset-1 border-transparent' : 'border-border/60 hover:scale-110'
                        }`}
                        style={{ backgroundColor: c.value }}
                        title={c.name}
                      />
                    ))}
                  </div>

                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleApplyColor('');
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer font-medium"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>Без цвета (Сбросить)</span>
                  </button>
                </div>
              )}
            </div>

            {/* 2. HIGHLIGHT MARKER TOOL */}
            <div ref={highlightMenuRef} className="relative flex items-center">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleApplyHighlight(selectedHighlight);
                }}
                className="p-1.5 rounded-l border border-r-0 border-border hover:bg-muted transition-all cursor-pointer flex items-center gap-1"
                title={`Применить маркер (${HIGHLIGHTS.find(h => h.value === selectedHighlight)?.name || 'Выбранный'})`}
              >
                <div className="flex flex-col items-center">
                  <Highlighter className="w-3.5 h-3.5 text-foreground" />
                  <div 
                    className="w-3.5 h-1 rounded-full mt-0.5" 
                    style={{ backgroundColor: selectedHighlight }} 
                  />
                </div>
              </button>

              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setIsHighlightMenuOpen(prev => !prev);
                  setIsColorMenuOpen(false);
                }}
                className="p-1 rounded-r border border-border hover:bg-muted transition-all cursor-pointer text-muted-foreground"
                title="Выбрать маркер"
              >
                <ChevronDown className="w-3 h-3" />
              </button>

              {isHighlightMenuOpen && (
                <div className="absolute top-full left-0 mt-1.5 p-2 bg-card border border-border rounded-xl shadow-xl z-50 min-w-[160px] animate-scaleUp">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 px-1">
                    Цвет маркера
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 mb-2">
                    {HIGHLIGHTS.map((hl) => (
                      <button
                        key={hl.value}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleApplyHighlight(hl.value);
                        }}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer border ${
                          selectedHighlight === hl.value ? 'ring-2 ring-indigo-500 ring-offset-1 border-transparent' : 'border-border/60 hover:scale-110'
                        }`}
                        style={{ backgroundColor: hl.value }}
                        title={hl.name}
                      />
                    ))}
                  </div>

                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleApplyHighlight('');
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer font-medium"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>Без маркера (Сбросить)</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Alignments */}
          <div className="flex items-center gap-0.5 border-r border-border pr-1.5 mr-1.5">
            <button
              type="button"
              onClick={() => editor.chain().focus().setTextAlign('left').run()}
              className={`p-1.5 rounded hover:bg-muted transition-colors cursor-pointer ${editor.isActive({ textAlign: 'left' }) ? 'bg-muted text-indigo-500' : 'text-muted-foreground'}`}
              title="По левому краю"
            >
              <AlignLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().setTextAlign('center').run()}
              className={`p-1.5 rounded hover:bg-muted transition-colors cursor-pointer ${editor.isActive({ textAlign: 'center' }) ? 'bg-muted text-indigo-500' : 'text-muted-foreground'}`}
              title="По центру"
            >
              <AlignCenter className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().setTextAlign('right').run()}
              className={`p-1.5 rounded hover:bg-muted transition-colors cursor-pointer ${editor.isActive({ textAlign: 'right' }) ? 'bg-muted text-indigo-500' : 'text-muted-foreground'}`}
              title="По правому краю"
            >
              <AlignRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().setTextAlign('justify').run()}
              className={`p-1.5 rounded hover:bg-muted transition-colors cursor-pointer ${editor.isActive({ textAlign: 'justify' }) ? 'bg-muted text-indigo-500' : 'text-muted-foreground'}`}
              title="По ширине"
            >
              <AlignJustify className="w-4 h-4" />
            </button>
          </div>

          {/* Lists */}
          <div className="flex items-center gap-0.5 border-r border-border pr-1.5 mr-1.5">
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={`p-1.5 rounded hover:bg-muted transition-colors cursor-pointer ${editor.isActive('bulletList') ? 'bg-muted text-indigo-500' : 'text-muted-foreground'}`}
              title="Маркированный список"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={`p-1.5 rounded hover:bg-muted transition-colors cursor-pointer ${editor.isActive('orderedList') ? 'bg-muted text-indigo-500' : 'text-muted-foreground'}`}
              title="Нумерованный список"
            >
              <ListOrdered className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleTaskList().run()}
              className={`p-1.5 rounded hover:bg-muted transition-colors cursor-pointer ${editor.isActive('taskList') ? 'bg-muted text-indigo-500' : 'text-muted-foreground'}`}
              title="Чеклист"
            >
              <CheckSquare className="w-4 h-4" />
            </button>
          </div>

          {/* Alert Blocks */}
          <div className="flex items-center gap-0.5 border-r border-border pr-1.5 mr-1.5">
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
            <button
              type="button"
              onClick={insertCollapsibleBlock}
              className="inline-flex items-center gap-1 px-1.5 py-1 text-[10px] font-bold rounded hover:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-550/15 cursor-pointer"
              title="Раскрывающийся блок"
            >
              <ChevronDown className="h-3.5 w-3.5" />
              Блок
            </button>
          </div>

          {/* Media & Links */}
          <div className="flex items-center gap-0.5 border-r border-border pr-1.5 mr-1.5 relative">
            <button
              type="button"
              onClick={insertImage}
              className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground cursor-pointer"
              title="Картинка по URL"
            >
              <ImageIcon className="w-4 h-4" />
            </button>
            
            {/* Вложить файл */}
            <button
              type="button"
              onClick={triggerFileUpload}
              className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground cursor-pointer"
              title="Загрузить документ (PDF, Docx...)"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* YouTube Embed */}
            <button
              type="button"
              onClick={insertYoutube}
              className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground cursor-pointer"
              title="YouTube видео"
            >
              <YoutubeIcon className="w-4 h-4 text-red-500" />
            </button>

            <button
              type="button"
              onClick={insertLink}
              className={`p-1.5 rounded hover:bg-muted transition-colors cursor-pointer ${editor.isActive('link') ? 'bg-muted text-indigo-500' : 'text-muted-foreground'}`}
              title="Внешняя ссылка"
            >
              <LinkIcon className="w-4 h-4" />
            </button>

            {/* Внутренняя ссылка с автокомплитом */}
            <button
              type="button"
              onClick={() => setShowLinkSuggestions(!showLinkSuggestions)}
              className={`p-1.5 rounded hover:bg-muted transition-colors cursor-pointer ${showLinkSuggestions ? 'bg-muted text-indigo-500' : 'text-muted-foreground'}`}
              title="Внутренняя ссылка на статью Wiki"
            >
              <BookOpen className="w-4 h-4" />
            </button>

            {/* Autocomplete Dropdown */}
            {showLinkSuggestions && (
              <div className="absolute top-8 left-0 z-20 w-64 p-3 bg-card border border-border rounded-xl shadow-2xl space-y-2 animate-scaleUp">
                <div className="text-[10px] font-bold text-muted-foreground uppercase">Поиск статьи Wiki</div>
                <input
                  type="text"
                  placeholder="Введите название статьи..."
                  value={linkSearchQuery}
                  onChange={(e) => setLinkSearchQuery(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 border border-border rounded-lg bg-muted outline-none text-foreground"
                />
                
                <div className="max-h-36 overflow-y-auto divide-y divide-border">
                  {linkSuggestions.length === 0 ? (
                    <div className="text-[10px] text-muted-foreground py-2 text-center italic">
                      {linkSearchQuery ? 'Ничего не найдено' : 'Начните вводить название...'}
                    </div>
                  ) : (
                    linkSuggestions.map(art => (
                      <div
                        key={art.id}
                        onClick={() => handleInsertInternalLink(art)}
                        className="py-1.5 px-2 hover:bg-muted cursor-pointer text-xs truncate font-semibold text-foreground"
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
              className={`p-1.5 rounded hover:bg-muted transition-colors cursor-pointer ${editor.isActive('blockquote') ? 'bg-muted text-indigo-500' : 'text-muted-foreground'}`}
              title="Цитата"
            >
              <Quote className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
              className={`p-1.5 rounded hover:bg-muted transition-colors cursor-pointer ${editor.isActive('codeBlock') ? 'bg-muted text-indigo-500' : 'text-muted-foreground'}`}
              title="Блок кода"
            >
              <Code className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={insertTable}
              className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground cursor-pointer"
              title="Таблица"
            >
              <TableIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Table tools */}
          {editor.isActive('table') && (
            <div className="flex items-center gap-0.5 border-r border-border pr-1.5 mr-1.5 text-[9px] text-muted-foreground">
              <button
                type="button"
                onClick={() => editor.chain().focus().addColumnAfter().run()}
                className="px-1 py-0.5 bg-muted rounded hover:bg-muted text-muted-foreground cursor-pointer"
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
                className="px-1 py-0.5 bg-muted rounded hover:bg-muted text-muted-foreground cursor-pointer"
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
              className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground cursor-pointer"
              title="Смайлики"
            >
              <Smile className="w-4 h-4" />
            </button>
            {showEmoji && (
              <div className="absolute top-8 left-0 z-10 grid grid-cols-7 gap-1 p-2 bg-card border border-border rounded-lg shadow-xl w-44">
                {EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => addEmoji(emoji)}
                    className="p-1 hover:bg-muted rounded text-center text-sm cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => editor.chain().focus().undo().run()}
              className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground cursor-pointer"
              title="Назад"
            >
              <Undo className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().redo().run()}
              className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground cursor-pointer"
              title="Вперед"
            >
              <Redo className="w-4 h-4" />
            </button>
          </div>

        </div>
      )}

      {/* Editor Content Area */}
      <div 
        ref={containerRef} 
        onContextMenu={handleContextMenu}
        className="bg-card transition-all select-text relative overflow-visible"
      >
        {/* Right-Click Context Menu (Shows ONLY on right-click on selected text) */}
        {contextMenuCoords && !isPreview && editor && (
          <div
            ref={contextMenuRef}
            style={{ top: `${contextMenuCoords.top}px`, left: `${contextMenuCoords.left}px` }}
            className="absolute flex items-center gap-1.5 p-1.5 rounded-xl border border-border bg-card/95 backdrop-blur-md shadow-2xl text-card-foreground z-50 animate-scaleUp select-none"
          >
            <div className="flex items-center gap-1 border-r border-border pr-1.5">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  editor.chain().focus().toggleHeading({ level: 2 }).run();
                  setContextMenuCoords(null);
                }}
                className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                  editor.isActive('heading')
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'hover:bg-muted text-foreground'
                }`}
                title="Преобразовать выделенный текст в заголовок статьи"
              >
                Сделать заголовком
              </button>

              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  editor.chain().focus().setParagraph().run();
                  setContextMenuCoords(null);
                }}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-all cursor-pointer ${
                  !editor.isActive('heading')
                    ? 'bg-muted text-indigo-500 font-semibold'
                    : 'hover:bg-red-500/10 text-red-500'
                }`}
                title="Преобразовать в обычный текст (параграф)"
              >
                Обычный текст
              </button>
            </div>

            <div className="flex items-center gap-0.5 pl-0.5">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  editor.chain().focus().toggleBold().run();
                  setContextMenuCoords(null);
                }}
                className={`p-1.5 rounded hover:bg-muted transition-colors cursor-pointer ${editor.isActive('bold') ? 'text-indigo-500 font-bold' : 'text-muted-foreground'}`}
                title="Полужирный"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  editor.chain().focus().toggleItalic().run();
                  setContextMenuCoords(null);
                }}
                className={`p-1.5 rounded hover:bg-muted transition-colors cursor-pointer ${editor.isActive('italic') ? 'text-indigo-500' : 'text-muted-foreground'}`}
                title="Курсив"
              >
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  editor.chain().focus().toggleUnderline().run();
                  setContextMenuCoords(null);
                }}
                className={`p-1.5 rounded hover:bg-muted transition-colors cursor-pointer ${editor.isActive('underline') ? 'text-indigo-500' : 'text-muted-foreground'}`}
                title="Подчеркнутый"
              >
                <UnderlineIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        <EditorContent editor={editor} />
      </div>

    </div>
  );
}
