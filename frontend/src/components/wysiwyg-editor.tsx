import * as React from 'react';
import { useEditor, EditorContent, NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import { Extension, Node, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
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
  Palette, Highlighter, Ban, FileText, Car, User, PhoneCall, Building2, Banknote, Wrench, ShieldAlert, Maximize2, Minimize2, X, Plus
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
        icon?: string;
        size?: string;
        layout?: string;
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

export const CustomTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: (element) => element.style.backgroundColor || element.getAttribute('bgcolor') || null,
        renderHTML: (attributes) => {
          if (!attributes.backgroundColor) return {};
          return {
            style: `background-color: ${attributes.backgroundColor}`,
          };
        },
      },
    };
  },
});

export function wrapCollapsibleBlocksInRows(html: string): string {
  if (!html || (!html.includes('data-wiki-collapsible') && !html.includes('<details') && !html.includes('data-wiki-collapsible-row'))) return html;
  
  if (typeof window === 'undefined') return html;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const oldRows = Array.from(doc.querySelectorAll('div[data-wiki-collapsible-row="true"], div.wiki-collapsible-row, div.wiki-collapsible-grid'));
    oldRows.forEach((row) => {
      while (row.firstChild) {
        row.parentElement?.insertBefore(row.firstChild, row);
      }
      row.remove();
    });

    const detailsElements = Array.from(doc.querySelectorAll('details, .wiki-collapsible-block'));
    if (detailsElements.length === 0) return doc.body.innerHTML;

    let currentGroup: Element[] = [];

    const flushGroup = () => {
      if (currentGroup.length === 0) return;
      const firstEl = currentGroup[0];
      const parent = firstEl.parentElement;
      if (parent) {
        const groupDiv = doc.createElement('div');
        groupDiv.setAttribute('data-wiki-collapsible-group', 'true');
        groupDiv.className = 'wiki-collapsible-group grid grid-cols-1 sm:grid-cols-2 gap-5 my-4 w-full items-start';
        parent.insertBefore(groupDiv, firstEl);
        currentGroup.forEach((el) => groupDiv.appendChild(el));
      }
      currentGroup = [];
    };

    detailsElements.forEach((el) => {
      if (el.parentElement?.getAttribute('data-wiki-collapsible-group') === 'true' || el.parentElement?.classList.contains('wiki-collapsible-group')) {
        flushGroup();
        return;
      }
      if (currentGroup.length > 0) {
        const lastEl = currentGroup[currentGroup.length - 1];
        if (el.previousElementSibling !== lastEl) {
          flushGroup();
        }
      }
      currentGroup.push(el);
    });

    flushGroup();
    return doc.body.innerHTML;
  } catch {
    return html;
  }
}

const ICON_OPTIONS = [
  { key: 'file-text', name: 'Документ', icon: FileText },
  { key: 'car', name: 'Автомобиль', icon: Car },
  { key: 'user', name: 'Водитель', icon: User },
  { key: 'phone', name: 'Поддержка', icon: PhoneCall },
  { key: 'building', name: 'Офис', icon: Building2 },
  { key: 'banknote', name: 'Выплаты', icon: Banknote },
  { key: 'wrench', name: 'Настройки', icon: Wrench },
  { key: 'shield-alert', name: 'Безопасность', icon: ShieldAlert },
];

const CollapsibleBlockView = ({ node, updateAttributes, deleteNode, getPos, editor }: any) => {
  const attrs = node.attrs || {};
  const [isConfirmingDelete, setIsConfirmingDelete] = React.useState(false);
  const [isIconPickerOpen, setIsIconPickerOpen] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(Boolean(attrs.defaultOpen));
  const iconPickerRef = React.useRef<HTMLDivElement>(null);
  const titleInputRef = React.useRef<HTMLInputElement>(null);
  const cardRef = React.useRef<HTMLDivElement>(null);
  const isAnimatingRef = React.useRef(false);

  const currentIconKey = attrs.icon || 'file-text';
  const currentLayout = attrs.layout || attrs.size || 'compact';

  const CurrentIconComponent = ICON_OPTIONS.find((i) => i.key === currentIconKey)?.icon || FileText;

  const toggleOpenState = React.useCallback(
    (e?: React.MouseEvent) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (isAnimatingRef.current) return;
      isAnimatingRef.current = true;

      const cardEl = cardRef.current;
      if (cardEl) {
        const parentGroup = cardEl.closest('.wiki-collapsible-group') || cardEl.parentElement;
        if (parentGroup) {
          const siblingCards = Array.from(
            parentGroup.querySelectorAll<HTMLElement>('.accordion-card, .wiki-collapsible-block, .wiki-collapsible-item')
          );
          siblingCards.forEach((el) => {
            (el as any).__flipOldRect = el.getBoundingClientRect();
          });
        }
      }

      setIsOpen((prev) => !prev);

      setTimeout(() => {
        isAnimatingRef.current = false;
      }, 550);
    },
    []
  );

  React.useLayoutEffect(() => {
    const cardEl = cardRef.current;
    if (!cardEl) return;

    const parentGroup = cardEl.closest('.wiki-collapsible-group') || cardEl.parentElement;
    if (!parentGroup) return;

    const siblingCards = Array.from(
      parentGroup.querySelectorAll<HTMLElement>('.accordion-card, .wiki-collapsible-block, .wiki-collapsible-item')
    );

    const newRects = new Map<HTMLElement, DOMRect>();
    siblingCards.forEach((el) => {
      newRects.set(el, el.getBoundingClientRect());
    });

    siblingCards.forEach((el) => {
      const oldRect = (el as any).__flipOldRect as DOMRect | undefined;
      const newRect = newRects.get(el);

      if (oldRect && newRect) {
        const deltaX = oldRect.left - newRect.left;
        const deltaY = oldRect.top - newRect.top;
        const scaleX = oldRect.width / (newRect.width || 1);

        if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1 || Math.abs(scaleX - 1) > 0.02) {
          el.style.transition = 'none';
          el.style.transformOrigin = 'left top';
          el.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0) scaleX(${scaleX})`;

          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              el.style.transition =
                'transform 550ms cubic-bezier(0.16, 1, 0.3, 1), border-color 400ms ease, box-shadow 400ms ease, background-color 400ms ease';
              el.style.transform = 'translate3d(0, 0, 0) scaleX(1)';
            });
          });
        }
      }
      (el as any).__flipOldRect = newRect;
    });
  }, [isOpen, currentLayout]);

  React.useEffect(() => {
    if (attrs.title === 'Новый раскрывающийся блок' && !attrs.autoFocused) {
      updateAttributes({ autoFocused: true });
      setTimeout(() => {
        if (titleInputRef.current) {
          titleInputRef.current.focus();
          titleInputRef.current.select();
        }
      }, 50);
    }
  }, []);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as any;
      if (iconPickerRef.current && !iconPickerRef.current.contains(target)) {
        setIsIconPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  React.useEffect(() => {
    const handleCancelOthers = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.blockId !== attrs.id) {
        setIsConfirmingDelete(false);
      }
    };
    window.addEventListener('wiki-cancel-all-delete-confirmations', handleCancelOthers);
    return () => {
      window.removeEventListener('wiki-cancel-all-delete-confirmations', handleCancelOthers);
    };
  }, [attrs.id]);

  const isLastUnpairedCompact = React.useMemo(() => {
    if (currentLayout === 'wide' || typeof getPos !== 'function' || !editor) return false;
    try {
      const pos = getPos();
      if (typeof pos !== 'number') return false;
      const $pos = editor.doc.resolve(pos);
      const parent = $pos.parent;
      const index = $pos.index();

      let prevCompactCount = 0;
      for (let i = index - 1; i >= 0; i--) {
        const child = parent.child(i);
        const childSize = child.attrs.layout || child.attrs.size || 'compact';
        if (child.type.name === 'collapsibleBlock' && childSize === 'compact') {
          prevCompactCount++;
        } else {
          break;
        }
      }

      if (prevCompactCount % 2 !== 0) {
        return false;
      }

      if (index + 1 < parent.childCount) {
        const nextChild = parent.child(index + 1);
        const nextSize = nextChild.attrs.layout || nextChild.attrs.size || 'compact';
        if (nextChild.type.name === 'collapsibleBlock' && nextSize === 'compact') {
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }, [editor?.doc, getPos, currentLayout]);

  const openDeleteConfirmation = React.useCallback(
    (e?: React.MouseEvent) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      window.dispatchEvent(
        new CustomEvent('wiki-cancel-all-delete-confirmations', {
          detail: { blockId: attrs.id },
        })
      );
      setIsConfirmingDelete(true);
    },
    [attrs.id]
  );

  const handleDeleteBlock = React.useCallback(
    (e?: React.MouseEvent) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      setIsConfirmingDelete(false);

      if (!editor) return;

      try {
        // Layer 1: Dynamic position via getPos()
        if (typeof getPos === 'function') {
          const pos = getPos();
          if (typeof pos === 'number') {
            const $pos = editor.state.doc.resolve(pos);

            let groupPos = -1;
            let groupSize = 0;

            for (let d = $pos.depth; d > 0; d--) {
              const ancestor = $pos.node(d);
              if (ancestor && ancestor.type.name === 'collapsibleGroup') {
                if (ancestor.childCount <= 1) {
                  groupPos = $pos.before(d);
                  groupSize = ancestor.nodeSize;
                }
                break;
              }
            }

            if (groupPos !== -1 && groupSize > 0) {
              const tr = editor.state.tr.delete(groupPos, groupPos + groupSize);
              editor.view.dispatch(tr);
              try { editor.commands.focus(); } catch {}
              return;
            }

            const tr = editor.state.tr.delete(pos, pos + node.nodeSize);
            editor.view.dispatch(tr);
            try { editor.commands.focus(); } catch {}
            return;
          }
        }

        // Layer 2: Built-in deleteNode helper
        if (typeof deleteNode === 'function') {
          deleteNode();
          try { editor.commands.focus(); } catch {}
          return;
        }
      } catch (err) {
        console.error('Layer 1/2 deletion failed:', err);
      }

      // Layer 3: Search document by block ID
      try {
        const blockId = node.attrs.id;
        if (blockId) {
          let foundPos = -1;
          let targetNode: any = null;

          editor.state.doc.descendants((docNode: any, docPos: number) => {
            if (docNode.type.name === 'collapsibleBlock' && docNode.attrs.id === blockId) {
              foundPos = docPos;
              targetNode = docNode;
              return false;
            }
            return true;
          });

          if (foundPos !== -1 && targetNode) {
            const $docPos = editor.state.doc.resolve(foundPos);
            let groupPos = -1;
            let groupSize = 0;

            for (let d = $docPos.depth; d > 0; d--) {
              const parentNode = $docPos.node(d);
              if (parentNode && parentNode.type.name === 'collapsibleGroup' && parentNode.childCount <= 1) {
                groupPos = $docPos.before(d);
                groupSize = parentNode.nodeSize;
                break;
              }
            }

            if (groupPos !== -1 && groupSize > 0) {
              const tr = editor.state.tr.delete(groupPos, groupPos + groupSize);
              editor.view.dispatch(tr);
            } else {
              const tr = editor.state.tr.delete(foundPos, foundPos + targetNode.nodeSize);
              editor.view.dispatch(tr);
            }
            try { editor.commands.focus(); } catch {}
          }
        }
      } catch (fallbackErr) {
        console.error('Layer 3 deletion failed:', fallbackErr);
        try { deleteNode(); } catch {}
      }
    },
    [editor, getPos, node.nodeSize, node.attrs.id, deleteNode]
  );

  const handleAddBlockAlongside = React.useCallback((e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (typeof getPos !== 'function' || !editor) return;
    try {
      const pos = getPos();
      if (typeof pos !== 'number') return;
      const endPos = pos + node.nodeSize;

      editor
        .chain()
        .insertContentAt(endPos, {
          type: 'collapsibleBlock',
          attrs: {
            id: crypto.randomUUID(),
            title: 'Новый раскрывающийся блок',
            icon: 'file-text',
            layout: 'compact',
            size: 'compact',
            defaultOpen: false,
            allowMultiple: true,
            requiredForAck: false,
          },
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Содержимое раскрывающегося блока...' }],
            },
          ],
        })
        .focus()
        .run();
    } catch (err) {
      console.error('Failed to insert block alongside:', err);
    }
  }, [editor, getPos, node.nodeSize]);

  const toggleSize = React.useCallback(() => {
    const nextLayout = currentLayout === 'wide' ? 'compact' : 'wide';
    updateAttributes({ layout: nextLayout, size: nextLayout });
  }, [currentLayout, updateAttributes]);

  const isExpanded = currentLayout === 'wide' || isOpen;

  const showAddButton = Boolean(
    editor?.isEditable && currentLayout === 'compact' && isLastUnpairedCompact && !isConfirmingDelete && !isOpen
  );

  return (
    <NodeViewWrapper 
      data-layout={currentLayout}
      data-size={currentLayout}
      data-open={isOpen ? 'true' : 'false'}
      className={`accordion-item node-collapsibleBlock wiki-collapsible-item min-w-0 w-full transition-all duration-350 ease-in-out ${
        isExpanded
          ? 'wiki-collapsible-wide col-span-full my-2'
          : showAddButton
          ? 'col-span-full grid grid-cols-1 sm:grid-cols-2 gap-5 my-2 items-start'
          : 'wiki-collapsible-compact col-span-1 my-2'
      }`}
    >
      <div 
        ref={cardRef}
        className={`accordion-card relative rounded-2xl border bg-card p-4 transition-all duration-350 ease-in-out w-full min-w-0 box-border ${
          isOpen
            ? 'border-indigo-500/40 dark:border-indigo-400/40 shadow-lg shadow-indigo-500/[0.08] dark:shadow-indigo-500/[0.12] col-span-full'
            : 'border-border shadow-xs hover:border-indigo-500/30 hover:shadow-md col-span-1'
        }`}
      >
        {/* Card Header Row */}
        {isConfirmingDelete ? (
          <div 
            contentEditable={false}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="flex items-center justify-between gap-2 p-1.5 bg-red-500/10 border border-red-500/20 rounded-xl text-xs font-semibold animate-fadeIn w-full select-none min-h-[38px]"
          >
            <span className="text-red-600 dark:text-red-400 font-bold truncate pl-1">
              Удалить блок вместе с содержимым?
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsConfirmingDelete(false);
                }}
                className="px-2.5 py-1 rounded-lg bg-muted hover:bg-neutral-200 dark:hover:bg-neutral-800 text-foreground text-[11px] font-semibold transition-colors cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={handleDeleteBlock}
                className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold transition-colors cursor-pointer shadow-xs"
              >
                Удалить
              </button>
            </div>
          </div>
        ) : (
          <div 
            contentEditable={false}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="flex items-center justify-between gap-3 min-w-0 select-none"
          >
            {/* Left: Icon Selector Button */}
            <div ref={iconPickerRef} className="relative shrink-0">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsIconPickerOpen((prev) => !prev);
                }}
                className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 transition-all cursor-pointer flex items-center justify-center border border-indigo-500/15 shadow-xs"
                title="Выбрать иконку блока"
              >
                <CurrentIconComponent className="w-4.5 h-4.5" />
              </button>

              {/* Icon Palette Popover */}
              {isIconPickerOpen && (
                <div 
                  contentEditable={false}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  className="absolute top-full left-0 mt-2 p-2 bg-card border border-border rounded-2xl shadow-2xl z-50 min-w-[200px] grid grid-cols-4 gap-2 animate-scaleUp"
                >
                  {ICON_OPTIONS.map((opt) => {
                    const IconComp = opt.icon;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          updateAttributes({ icon: opt.key });
                          setIsIconPickerOpen(false);
                        }}
                        className={`p-2.5 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                          currentIconKey === opt.key
                            ? 'bg-indigo-600 text-white shadow-sm scale-105'
                            : 'bg-muted/60 hover:bg-muted text-foreground hover:scale-105'
                        }`}
                        title={opt.name}
                      >
                        <IconComp className="w-4 h-4" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Center: Title Input */}
            <input
              ref={titleInputRef}
              type="text"
              value={attrs.title || ''}
              onMouseDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              onChange={(e) => updateAttributes({ title: e.target.value })}
              className="w-full text-sm font-bold text-foreground bg-transparent border-none outline-none focus:ring-0 placeholder:text-muted-foreground/60 px-1 min-w-0 truncate cursor-text"
              placeholder="Введите название блока..."
            />

            {/* Right: Actions */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleSize();
                }}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                title={currentLayout === 'wide' ? 'Сделать компактным' : 'Развернуть на всю ширину'}
              >
                {currentLayout === 'wide' ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>

              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={toggleOpenState}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                title={isOpen ? 'Свернуть' : 'Раскрыть'}
              >
                <ChevronDown 
                  className={`accordion-toggle-icon w-4 h-4 transition-transform duration-400 ease-in-out ${
                    isOpen ? 'rotate-180' : 'rotate-0'
                  }`} 
                />
              </button>

              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={openDeleteConfirmation}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                title="Удалить блок"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Editable Content Area */}
        <div
          className="accordion-content"
          data-open={isOpen ? 'true' : 'false'}
          style={{
            display: 'grid',
            gridTemplateRows: isOpen ? '1fr' : '0fr',
            opacity: isOpen ? 1 : 0,
            transition: isOpen
              ? 'grid-template-rows 500ms cubic-bezier(0.16, 1, 0.3, 1) 100ms, opacity 350ms ease 120ms'
              : 'grid-template-rows 400ms cubic-bezier(0.16, 1, 0.3, 1) 0ms, opacity 250ms ease 0ms',
          }}
        >
          <div 
            className="accordion-content-inner overflow-hidden min-h-0"
            style={{
              transform: isOpen ? 'translateY(0)' : 'translateY(-10px)',
              transition: isOpen
                ? 'transform 450ms cubic-bezier(0.16, 1, 0.3, 1) 100ms'
                : 'transform 300ms cubic-bezier(0.16, 1, 0.3, 1) 0ms',
            }}
          >
            <div className="mt-3 pt-3 border-t border-border/60">
              <NodeViewContent className="wiki-collapsible-editor-content min-h-12 text-foreground focus:outline-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Placeholder Card: "+ Добавить блок рядом" (Embedded in NodeViewWrapper) */}
      {showAddButton && (
        <button
          type="button" 
          contentEditable={false}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={handleAddBlockAlongside}
          className="accordion-add-slot col-span-1 w-full min-w-0 rounded-2xl border-2 border-dashed border-indigo-400/40 dark:border-indigo-500/40 bg-indigo-500/[0.03] dark:bg-indigo-500/[0.06] p-4 hover:border-indigo-600 dark:hover:border-indigo-400 hover:bg-indigo-500/[0.08] dark:hover:bg-indigo-500/[0.12] transition-all cursor-pointer select-none text-center flex items-center justify-center min-h-[90px] h-full"
          title="Добавить второй компактный блок рядом"
        >
          <div className="flex items-center justify-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 py-0.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
              <Plus className="w-4 h-4" />
            </span>
            <span>Добавить блок рядом</span>
          </div>
        </button>
      )}
    </NodeViewWrapper>
  );
};

const CollapsibleGroup = Node.create({
  name: 'collapsibleGroup',
  group: 'block',
  content: 'collapsibleBlock+',
  defining: true,
  isolating: false,

  parseHTML() {
    return [
      { tag: 'div[data-wiki-collapsible-group="true"]' },
      { tag: 'div.wiki-collapsible-group' },
      { tag: 'div.wiki-collapsible-grid' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-wiki-collapsible-group': 'true',
        class: 'wiki-collapsible-group grid grid-cols-1 sm:grid-cols-2 gap-5 my-4 w-full items-start',
      }),
      0,
    ];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('removeEmptyCollapsibleGroups'),
        appendTransaction: (transactions, oldState, newState) => {
          let tr = newState.tr;
          let modified = false;

          newState.doc.descendants((node, pos) => {
            if (node.type.name === 'collapsibleGroup' && node.childCount === 0) {
              tr.delete(pos, pos + node.nodeSize);
              modified = true;
            }
          });

          return modified ? tr : null;
        },
      }),
    ];
  },
});

const CollapsibleBlock = Node.create({
  name: 'collapsibleBlock',
  group: 'block',
  content: 'block+',
  defining: true,
  isolating: false,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-id') || element.getAttribute('id') || crypto.randomUUID(),
        renderHTML: (attributes) => ({
          'data-id': attributes.id || crypto.randomUUID(),
          id: attributes.id || crypto.randomUUID(),
        }),
      },
      title: {
        default: 'Новый раскрывающийся блок',
        parseHTML: (element) => element.getAttribute('data-title') || element.querySelector('summary')?.textContent || 'Новый раскрывающийся блок',
        renderHTML: (attributes) => ({ 'data-title': attributes.title }),
      },
      icon: {
        default: 'file-text',
        parseHTML: (element) => element.getAttribute('data-icon') || 'file-text',
        renderHTML: (attributes) => ({ 'data-icon': attributes.icon || 'file-text' }),
      },
      size: {
        default: 'compact',
        parseHTML: (element) => element.getAttribute('data-size') || element.getAttribute('data-layout') || 'compact',
        renderHTML: (attributes) => ({
          'data-size': attributes.size || attributes.layout || 'compact',
          'data-layout': attributes.size || attributes.layout || 'compact',
        }),
      },
      layout: {
        default: 'compact',
        parseHTML: (element) => element.getAttribute('data-layout') || element.getAttribute('data-size') || 'compact',
        renderHTML: (attributes) => ({
          'data-layout': attributes.layout || attributes.size || 'compact',
          'data-size': attributes.layout || attributes.size || 'compact',
        }),
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
    return [
      {
        tag: 'details[data-wiki-collapsible="true"]',
        getAttrs: (element) => {
          const el = element as HTMLElement;
          const sz = el.getAttribute('data-layout') || el.getAttribute('data-size') || (el.classList.contains('wiki-collapsible-wide') ? 'wide' : 'compact');
          return {
            id: el.getAttribute('data-id') || el.getAttribute('id') || crypto.randomUUID(),
            title: el.getAttribute('data-title') || el.querySelector('summary')?.textContent || 'Новый раскрывающийся блок',
            icon: el.getAttribute('data-icon') || 'file-text',
            size: sz,
            layout: sz,
            defaultOpen: el.hasAttribute('open') || el.getAttribute('data-default-open') === 'true',
            allowMultiple: el.getAttribute('data-allow-multiple') !== 'false',
            requiredForAck: el.getAttribute('data-required-for-ack') === 'true',
          };
        },
      },
      {
        tag: 'details',
        getAttrs: (element) => {
          const el = element as HTMLElement;
          const sz = el.classList.contains('wiki-collapsible-wide') ? 'wide' : 'compact';
          return {
            id: crypto.randomUUID(),
            title: el.querySelector('summary')?.textContent || 'Новый раскрывающийся блок',
            icon: 'file-text',
            size: sz,
            layout: sz,
            defaultOpen: el.hasAttribute('open'),
          };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const icon = node.attrs.icon || 'file-text';
    const size = node.attrs.layout || node.attrs.size || 'compact';
    const blockId = node.attrs.id || crypto.randomUUID();
    return [
      'details',
      mergeAttributes(HTMLAttributes, {
        'data-wiki-collapsible': 'true',
        'data-id': blockId,
        id: blockId,
        'data-icon': icon,
        'data-size': size,
        'data-layout': size,
        'data-title': node.attrs.title || 'Новый раскрывающийся блок',
        class: `wiki-collapsible-block ${size === 'wide' ? 'wiki-collapsible-wide' : 'wiki-collapsible-compact'}`,
      }),
      ['summary', { class: 'wiki-collapsible-summary' }, node.attrs.title || 'Новый раскрывающийся блок'],
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
        ({ editor, chain, state }) => {
          const { layout = 'compact', size = 'compact', title = 'Новый раскрывающийся блок', icon = 'file-text' } = attrs;
          const targetLayout = layout || size || 'compact';

          const { $from } = state.selection;
          let currentGroupPos = -1;
          let currentGroupNode: any = null;

          for (let d = $from.depth; d > 0; d--) {
            const ancestor = $from.node(d);
            if (ancestor.type.name === 'collapsibleGroup') {
              currentGroupPos = $from.before(d);
              currentGroupNode = ancestor;
              break;
            }
          }

          if (currentGroupNode && currentGroupNode.childCount === 1) {
            const firstChild = currentGroupNode.child(0);
            const childLayout = firstChild.attrs.layout || firstChild.attrs.size || 'compact';
            if (childLayout === 'compact' && targetLayout === 'compact') {
              const insertPos = currentGroupPos + currentGroupNode.nodeSize - 1;
              return chain()
                .focus()
                .insertContentAt(insertPos, {
                  type: 'collapsibleBlock',
                  attrs: {
                    id: crypto.randomUUID(),
                    title,
                    icon,
                    layout: 'compact',
                    size: 'compact',
                    defaultOpen: false,
                    allowMultiple: true,
                    requiredForAck: false,
                  },
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'Содержимое раскрывающегося блока...' }],
                    },
                  ],
                })
                .run();
            }
          }

          return chain()
            .focus()
            .insertContent({
              type: 'collapsibleGroup',
              content: [
                {
                  type: 'collapsibleBlock',
                  attrs: {
                    id: crypto.randomUUID(),
                    title,
                    icon,
                    layout: 'compact',
                    size: 'compact',
                    defaultOpen: false,
                    allowMultiple: true,
                    requiredForAck: false,
                  },
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'Содержимое раскрывающегося блока...' }],
                    },
                  ],
                },
              ],
            })
            .run();
        },
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

  // Advanced Table States
  const [showTableModal, setShowTableModal] = React.useState(false);
  const [tableRowsInput, setTableRowsInput] = React.useState(3);
  const [tableColsInput, setTableColsInput] = React.useState(3);
  const [isCellColorOpen, setIsCellColorOpen] = React.useState(false);

  const colorMenuRef = React.useRef<HTMLDivElement>(null);
  const highlightMenuRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const tableModalRef = React.useRef<HTMLDivElement>(null);

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
      CollapsibleGroup,
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
      CustomTableCell,
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
    content: wrapCollapsibleBlocksInRows(content || '') || '<p>Начните писать статью здесь...</p>',
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
        .ProseMirror {
          display: block !important;
        }
        .ProseMirror p {
          margin-bottom: 0.75rem !important;
        }
        .ProseMirror p:empty,
        .ProseMirror p:has(> br:only-child) {
          margin-bottom: 0 !important;
          min-height: 0 !important;
        }
        .accordion-grid,
        .wiki-collapsible-group {
          display: grid !important;
          grid-template-columns: repeat(2, minmax(260px, 1fr)) !important;
          gap: 20px !important;
          width: 100% !important;
          align-items: start !important;
          margin: 1.25rem 0 !important;
        }
        .accordion-grid > *,
        .wiki-collapsible-group > * {
          min-width: 0 !important;
        }
        .accordion-item,
        .node-collapsibleBlock,
        .wiki-collapsible-item {
          grid-column: span 1 !important;
          width: 100% !important;
          min-width: 0 !important;
        }
        .accordion-item[data-layout="wide"],
        .node-collapsibleBlock[data-layout="wide"],
        .node-collapsibleBlock:has([data-layout="wide"]),
        .wiki-collapsible-item[data-layout="wide"],
        .wiki-collapsible-item.wiki-collapsible-wide {
          grid-column: 1 / -1 !important;
          width: 100% !important;
        }
        .accordion-add-slot,
        .wiki-collapsible-add-card {
          grid-column: span 1 !important;
          width: 100% !important;
          min-width: 0 !important;
        }
        @media (max-width: 768px) {
          .accordion-grid,
          .wiki-collapsible-group {
            grid-template-columns: 1fr !important;
          }
          .accordion-item,
          .node-collapsibleBlock,
          .wiki-collapsible-item,
          .accordion-add-slot,
          .wiki-collapsible-add-card {
            grid-column: 1 / -1 !important;
          }
        }
        .accordion-card {
          width: 100% !important;
          min-width: 0 !important;
          box-sizing: border-box !important;
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
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowTableModal(!showTableModal)}
                className={`p-1.5 rounded hover:bg-muted transition-colors cursor-pointer ${showTableModal || editor.isActive('table') ? 'bg-muted text-indigo-500' : 'text-muted-foreground'}`}
                title="Вставить или настроить таблицу"
              >
                <TableIcon className="w-4 h-4" />
              </button>

              {/* Table Creation Popover */}
              {showTableModal && (
                <div ref={tableModalRef} className="absolute top-8 left-0 z-30 p-3 bg-card border border-border rounded-xl shadow-2xl space-y-3 w-56 animate-scaleUp">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase">Создать таблицу</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="block text-[10px] text-muted-foreground font-semibold mb-1">Строки</label>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={tableRowsInput}
                        onChange={(e) => setTableRowsInput(parseInt(e.target.value) || 1)}
                        className="w-full px-2 py-1 border border-border rounded bg-muted text-foreground"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-muted-foreground font-semibold mb-1">Столбцы</label>
                      <input
                        type="number"
                        min={1}
                        max={15}
                        value={tableColsInput}
                        onChange={(e) => setTableColsInput(parseInt(e.target.value) || 1)}
                        className="w-full px-2 py-1 border border-border rounded bg-muted text-foreground"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      editor.chain().focus().insertTable({ rows: tableRowsInput, cols: tableColsInput, withHeaderRow: true }).run();
                      setShowTableModal(false);
                    }}
                    className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
                  >
                    Вставить таблицу
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Expanded Table Controls Toolbar */}
          {editor.isActive('table') && (
            <div className="flex items-center gap-1 border-r border-border pr-2 mr-2 text-[10px] text-muted-foreground flex-wrap">
              <span className="font-bold text-indigo-500 text-[10px]">Таблица:</span>
              <button
                type="button"
                onClick={() => editor.chain().focus().addRowBefore().run()}
                className="px-1.5 py-0.5 bg-muted rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 text-foreground cursor-pointer"
                title="Добавить строку сверху"
              >
                +Стр. ⬆️
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().addRowAfter().run()}
                className="px-1.5 py-0.5 bg-muted rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 text-foreground cursor-pointer"
                title="Добавить строку снизу"
              >
                +Стр. ⬇️
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().deleteRow().run()}
                className="px-1.5 py-0.5 bg-red-500/10 text-red-600 rounded hover:bg-red-500/20 cursor-pointer"
                title="Удалить строку"
              >
                -Стр.
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().addColumnBefore().run()}
                className="px-1.5 py-0.5 bg-muted rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 text-foreground cursor-pointer"
                title="Добавить столбец слева"
              >
                +Кол. ⬅️
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().addColumnAfter().run()}
                className="px-1.5 py-0.5 bg-muted rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 text-foreground cursor-pointer"
                title="Добавить столбец справа"
              >
                +Кол. ➡️
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().deleteColumn().run()}
                className="px-1.5 py-0.5 bg-red-500/10 text-red-600 rounded hover:bg-red-500/20 cursor-pointer"
                title="Удалить столбец"
              >
                -Кол.
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().mergeCells().run()}
                className="px-1.5 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded hover:bg-indigo-500/20 cursor-pointer"
                title="Объединить выд. ячейки"
              >
                Объединить
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().splitCell().run()}
                className="px-1.5 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded hover:bg-indigo-500/20 cursor-pointer"
                title="Разделить ячейку"
              >
                Разделить
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().deleteTable().run()}
                className="px-1.5 py-0.5 bg-red-600 text-white rounded hover:bg-red-700 font-bold cursor-pointer"
                title="Удалить таблицу"
              >
                Удалить тбл.
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
