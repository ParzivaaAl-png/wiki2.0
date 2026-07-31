import * as React from 'react';
import { Edit3, Check, RotateCcw, ListTree, ChevronRight, X } from 'lucide-react';

export interface TocHeadingItem {
  pos: number;
  level: number;
  text: string;
  tocTitle: string | null;
  id: string;
}

interface ArticleEditorNavigationProps {
  editor: any;
  content: string;
}

export default function ArticleEditorNavigation({ editor, content }: ArticleEditorNavigationProps) {
  const [headings, setHeadings] = React.useState<TocHeadingItem[]>([]);
  const [editingPos, setEditingPos] = React.useState<number | null>(null);
  const [editTitleValue, setEditTitleValue] = React.useState('');

  // Extract headings from TipTap editor doc in real-time
  const extractHeadings = React.useCallback(() => {
    if (!editor || !editor.state || !editor.state.doc) {
      // Fallback HTML regex parsing if editor state is initializing
      if (content) {
        const headingRegex = /<h([1-4])\b([^>]*)>([\s\S]*?)<\/h\1>/gi;
        const list: TocHeadingItem[] = [];
        let match;
        let posCounter = 0;
        while ((match = headingRegex.exec(content)) !== null) {
          const level = parseInt(match[1], 10);
          const attrs = match[2] || '';
          const rawText = match[3].replace(/<[^>]*>/g, '').trim();
          const tocMatch = /data-toc-title=["']([^"']+)["']/i.exec(attrs);
          const tocTitle = tocMatch ? tocMatch[1].trim() : null;
          const id = rawText
            .toLowerCase()
            .replace(/[^a-z0-9а-яё\s-]+/g, '')
            .replace(/\s+/g, '-')
            .replace(/(^-|-$)/g, '');
          list.push({
            pos: posCounter++,
            level,
            text: rawText,
            tocTitle,
            id,
          });
        }
        setHeadings(list);
      }
      return;
    }

    const list: TocHeadingItem[] = [];
    editor.state.doc.descendants((node: any, pos: number) => {
      if (node.type.name === 'heading') {
        const level = node.attrs.level;
        if (level >= 1 && level <= 4) {
          const rawText = node.textContent.trim();
          const tocTitle = node.attrs['data-toc-title'] || null;
          const id = rawText
            .toLowerCase()
            .replace(/[^a-z0-9а-яё\s-]+/g, '')
            .replace(/\s+/g, '-')
            .replace(/(^-|-$)/g, '');
          list.push({
            pos,
            level,
            text: rawText,
            tocTitle,
            id,
          });
        }
      }
    });
    setHeadings(list);
  }, [editor, content]);

  // Subscribe to editor transactions & updates
  React.useEffect(() => {
    extractHeadings();

    if (!editor) return;

    const handleUpdate = () => extractHeadings();
    editor.on('update', handleUpdate);
    editor.on('transaction', handleUpdate);
    editor.on('selectionUpdate', handleUpdate);

    return () => {
      editor.off('update', handleUpdate);
      editor.off('transaction', handleUpdate);
      editor.off('selectionUpdate', handleUpdate);
    };
  }, [editor, extractHeadings]);

  // Quick Jump to Heading in Editor
  const handleJumpToHeading = (pos: number) => {
    if (!editor) return;
    try {
      editor.commands.focus();
      editor.commands.setTextSelection(pos + 1);

      const domNode = editor.view.nodeDOM(pos);
      if (domNode && domNode instanceof HTMLElement) {
        domNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
        domNode.classList.add('ring-2', 'ring-indigo-500', 'rounded-lg', 'transition-all');
        setTimeout(() => domNode.classList.remove('ring-2', 'ring-indigo-500', 'rounded-lg'), 1500);
      }
    } catch (err) {
      console.warn('Failed to jump to heading:', err);
    }
  };

  // Open Edit Custom Title modal/input
  const handleStartEditTitle = (item: TocHeadingItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPos(item.pos);
    setEditTitleValue(item.tocTitle || item.text);
  };

  // Save Custom TOC Title to TipTap Node Attribute
  const handleSaveCustomTitle = (item: TocHeadingItem) => {
    if (!editor) return;
    const cleanTitle = editTitleValue.trim();

    try {
      editor.chain().focus().setNodeSelection(item.pos).updateAttributes('heading', {
        'data-toc-title': cleanTitle && cleanTitle !== item.text ? cleanTitle : null,
      }).run();
    } catch (err) {
      console.warn('Failed to update custom TOC title:', err);
    }

    setEditingPos(null);
  };

  // Reset Custom Title back to Original Heading Text
  const handleResetCustomTitle = (item: TocHeadingItem) => {
    if (!editor) return;
    try {
      editor.chain().focus().setNodeSelection(item.pos).updateAttributes('heading', {
        'data-toc-title': null,
      }).run();
    } catch (err) {
      console.warn('Failed to reset custom TOC title:', err);
    }
    setEditingPos(null);
  };

  // Change Heading Level (H1, H2, H3, H4)
  const handleChangeHeadingLevel = (item: TocHeadingItem, newLevel: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editor) return;
    try {
      editor.chain().focus().setNodeSelection(item.pos).updateAttributes('heading', { level: newLevel }).run();
    } catch (err) {
      console.warn('Failed to change heading level:', err);
    }
  };

  // Convert Heading back to Regular Text Paragraph (<p>)
  const handleConvertToParagraph = (item: TocHeadingItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editor) return;
    try {
      editor.chain().focus().setNodeSelection(item.pos).setParagraph().run();
    } catch (err) {
      console.warn('Failed to convert heading to paragraph:', err);
    }
  };

  return (
    <div className="p-5 border border-border bg-card text-card-foreground rounded-xl shadow-premium dark:shadow-premium-dark space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-outfit text-sm font-bold text-foreground flex items-center gap-2">
          <ListTree className="w-4 h-4 text-indigo-500" />
          Навигация статьи
        </h3>
        {headings.length > 0 && (
          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
            {headings.length}
          </span>
        )}
      </div>

      {headings.length === 0 ? (
        <div className="p-4 rounded-xl border border-dashed border-border bg-muted/20 text-center space-y-2">
          <ListTree className="w-6 h-6 text-muted-foreground mx-auto opacity-40" />
          <p className="text-xs text-muted-foreground font-medium leading-relaxed">
            Добавьте заголовки H1–H4 для формирования навигации.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5 border-l-2 border-border pl-3 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
          {headings.map((item, idx) => {
            const isEditing = editingPos === item.pos;
            const displayTitle = item.tocTitle || item.text;
            const hasCustomTitle = !!item.tocTitle && item.tocTitle !== item.text;

            let indentClass = 'font-bold text-xs text-foreground';
            if (item.level === 2) indentClass = 'pl-2.5 font-semibold text-xs text-foreground/90';
            if (item.level === 3) indentClass = 'pl-5 text-[11px] font-medium text-muted-foreground';
            if (item.level === 4) indentClass = 'pl-7 text-[11px] font-normal text-muted-foreground/80';

            return (
              <div key={`${item.pos}-${idx}`} className="group relative">
                {isEditing ? (
                  <div className="p-2 border border-indigo-500/40 bg-indigo-500/[0.04] rounded-lg space-y-2 my-1.5 animate-fadeIn">
                    <div className="text-[10px] font-bold uppercase text-indigo-500 flex items-center justify-between">
                      <span>Название в меню (H{item.level})</span>
                      {hasCustomTitle && (
                        <button
                          type="button"
                          onClick={() => handleResetCustomTitle(item)}
                          className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-red-500 transition-colors"
                          title="Сбросить к оригиналу"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Сбросить
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={editTitleValue}
                      onChange={(e) => setEditTitleValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveCustomTitle(item);
                        } else if (e.key === 'Escape') {
                          setEditingPos(null);
                        }
                      }}
                      placeholder="Сокращенное название..."
                      className="w-full text-xs px-2.5 py-1.5 rounded-md border border-border bg-card text-foreground outline-none focus:border-indigo-500"
                      autoFocus
                    />
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditingPos(null)}
                        className="px-2 py-1 rounded text-[11px] text-muted-foreground hover:bg-muted transition-colors"
                      >
                        Отмена
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveCustomTitle(item)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold transition-colors"
                      >
                        <Check className="w-3 h-3" />
                        Сохранить
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => handleJumpToHeading(item.pos)}
                    className={`flex items-center justify-between gap-2 py-1 px-1.5 rounded-md hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer ${indentClass}`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="truncate">
                        <span className="truncate">{displayTitle || '(пустой заголовок)'}</span>
                        {hasCustomTitle && (
                          <span className="ml-1.5 inline-block text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 font-semibold uppercase tracking-wider">
                            сокращенно
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      {/* Level Selector Pill */}
                      <div className="flex items-center bg-muted/80 rounded px-1 py-0.5 gap-0.5 text-[9px] font-bold text-muted-foreground">
                        {[1, 2, 3, 4].map((lvl) => (
                          <button
                            key={lvl}
                            type="button"
                            onClick={(e) => handleChangeHeadingLevel(item, lvl, e)}
                            className={`px-1 rounded hover:text-indigo-600 ${item.level === lvl ? 'bg-indigo-500 text-white font-extrabold' : ''}`}
                            title={`Сменить на H${lvl}`}
                          >
                            H{lvl}
                          </button>
                        ))}
                      </div>

                      {/* Convert to Paragraph button */}
                      <button
                        type="button"
                        onClick={(e) => handleConvertToParagraph(item, e)}
                        title="Преобразовать в обычный текст"
                        className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>

                      {/* Edit Custom Title button */}
                      <button
                        type="button"
                        onClick={(e) => handleStartEditTitle(item, e)}
                        title="Редактировать название в навигации"
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-indigo-500 transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
