import * as React from 'react';
import { Edit3, Check, RotateCcw, ListTree, EyeOff, Type, ChevronRight, Eye, AlertCircle } from 'lucide-react';

export interface TocHeadingItem {
  pos: number;
  level: number;
  text: string;
  tocTitle: string | null;
  isHidden: boolean;
  id: string;
}

interface ArticleEditorNavigationProps {
  editor: any;
  content: string;
}

export default function ArticleEditorNavigation({ editor, content }: ArticleEditorNavigationProps) {
  const [headings, setHeadings] = React.useState<TocHeadingItem[]>([]);
  const [hiddenHeadings, setHiddenHeadings] = React.useState<TocHeadingItem[]>([]);
  const [editingPos, setEditingPos] = React.useState<number | null>(null);
  const [editTitleValue, setEditTitleValue] = React.useState('');
  
  // Menu Popup state
  const [activeMenuPos, setActiveMenuPos] = React.useState<number | null>(null);
  const [confirmRemoveItem, setConfirmRemoveItem] = React.useState<TocHeadingItem | null>(null);
  const [showHiddenSection, setShowHiddenSection] = React.useState(false);

  // Extract headings from TipTap editor doc in real-time
  const extractHeadings = React.useCallback(() => {
    if (!editor || !editor.state || !editor.state.doc) {
      if (content) {
        const headingRegex = /<h([1-4])\b([^>]*)>([\s\S]*?)<\/h\1>/gi;
        const activeList: TocHeadingItem[] = [];
        const hiddenList: TocHeadingItem[] = [];
        let match;
        let posCounter = 0;
        while ((match = headingRegex.exec(content)) !== null) {
          const level = parseInt(match[1], 10);
          const attrs = match[2] || '';
          const rawText = match[3].replace(/<[^>]*>/g, '').trim();
          const isHidden = /data-toc-hidden=["']true["']/i.test(attrs);
          const tocMatch = /data-toc-title=["']([^"']+)["']/i.exec(attrs);
          const tocTitle = tocMatch ? tocMatch[1].trim() : null;
          const id = rawText
            .toLowerCase()
            .replace(/[^a-z0-9а-яё\s-]+/g, '')
            .replace(/\s+/g, '-')
            .replace(/(^-|-$)/g, '');
          
          const item: TocHeadingItem = {
            pos: posCounter++,
            level,
            text: rawText,
            tocTitle,
            isHidden,
            id,
          };

          if (isHidden) hiddenList.push(item);
          else activeList.push(item);
        }
        setHeadings(activeList);
        setHiddenHeadings(hiddenList);
      }
      return;
    }

    const activeList: TocHeadingItem[] = [];
    const hiddenList: TocHeadingItem[] = [];
    editor.state.doc.descendants((node: any, pos: number) => {
      if (node.type.name === 'heading') {
        const level = node.attrs.level;
        if (level >= 1 && level <= 4) {
          const rawText = node.textContent.trim();
          const tocTitle = node.attrs['data-toc-title'] || null;
          const isHidden = node.attrs['data-toc-hidden'] === 'true';
          const id = rawText
            .toLowerCase()
            .replace(/[^a-z0-9а-яё\s-]+/g, '')
            .replace(/\s+/g, '-')
            .replace(/(^-|-$)/g, '');

          const item: TocHeadingItem = {
            pos,
            level,
            text: rawText,
            tocTitle,
            isHidden,
            id,
          };

          if (isHidden) hiddenList.push(item);
          else activeList.push(item);
        }
      }
    });
    setHeadings(activeList);
    setHiddenHeadings(hiddenList);
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

  // Open Edit Custom Title
  const handleStartEditTitle = (item: TocHeadingItem) => {
    setActiveMenuPos(null);
    setEditingPos(item.pos);
    setEditTitleValue(item.tocTitle || item.text);
  };

  // Save Custom Title to Node
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

  // Reset Custom Title
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

  // ACTION 1: Убрать из заголовков (Convert to paragraph <p>)
  const handleConfirmRemoveFromHeadings = () => {
    if (!editor || !confirmRemoveItem) return;
    try {
      editor.chain().focus().setNodeSelection(confirmRemoveItem.pos).setParagraph().run();
    } catch (err) {
      console.warn('Failed to convert heading to paragraph:', err);
    }
    setConfirmRemoveItem(null);
    setActiveMenuPos(null);
  };

  // ACTION 2: Скрыть из навигации (Set data-toc-hidden="true")
  const handleHideFromNavigation = (item: TocHeadingItem) => {
    if (!editor) return;
    try {
      editor.chain().focus().setNodeSelection(item.pos).updateAttributes('heading', {
        'data-toc-hidden': 'true',
      }).run();
    } catch (err) {
      console.warn('Failed to hide heading from TOC navigation:', err);
    }
    setActiveMenuPos(null);
  };

  // ACTION 3: Восстановить из скрытых (Unhide)
  const handleUnhideNavigation = (item: TocHeadingItem) => {
    if (!editor) return;
    try {
      editor.chain().focus().setNodeSelection(item.pos).updateAttributes('heading', {
        'data-toc-hidden': null,
      }).run();
    } catch (err) {
      console.warn('Failed to unhide heading in TOC navigation:', err);
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

      {/* Confirmation Banner / Dialog for "Убрать из заголовков" */}
      {confirmRemoveItem && (
        <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 space-y-2.5 animate-fadeIn">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-foreground font-medium leading-normal">
              Убрать этот элемент из заголовков? Текст останется в статье как обычный текст.
            </p>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmRemoveItem(null)}
              className="px-2.5 py-1 rounded text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleConfirmRemoveFromHeadings}
              className="px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors shadow-sm cursor-pointer"
            >
              Да, убрать
            </button>
          </div>
        </div>
      )}

      {headings.length === 0 ? (
        <div className="p-4 rounded-xl border border-dashed border-border bg-muted/20 text-center space-y-2">
          <ListTree className="w-6 h-6 text-muted-foreground mx-auto opacity-40" />
          <p className="text-xs text-muted-foreground font-medium leading-relaxed">
            Добавьте заголовки H1–H4 для формирования навигации.
          </p>
        </div>
      ) : (
        <div className="space-y-1 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
          {headings.map((item, idx) => {
            const isEditing = editingPos === item.pos;
            const isMenuOpen = activeMenuPos === item.pos;
            const displayTitle = item.tocTitle || item.text;
            const hasCustomTitle = !!item.tocTitle && item.tocTitle !== item.text;

            return (
              <div key={`${item.pos}-${idx}`} className="group relative">
                {isEditing ? (
                  <div className="p-2.5 border border-indigo-500/40 bg-indigo-500/[0.04] rounded-xl space-y-2 my-1.5 animate-fadeIn">
                    <div className="text-[10px] font-bold uppercase text-indigo-500 flex items-center justify-between">
                      <span>Название в навигации</span>
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
                        className="px-2 py-1 rounded text-[11px] text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
                      >
                        Отмена
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveCustomTitle(item)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold transition-colors cursor-pointer"
                      >
                        <Check className="w-3 h-3" />
                        Сохранить
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <div
                      onClick={() => handleJumpToHeading(item.pos)}
                      className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors cursor-pointer"
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

                      {/* Action Menu Trigger */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuPos(isMenuOpen ? null : item.pos);
                        }}
                        title="Управление заголовком"
                        className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-muted text-muted-foreground hover:text-indigo-500 transition-all shrink-0 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Compact Actions Menu Popup */}
                    {isMenuOpen && (
                      <div className="absolute right-0 top-full mt-1 z-30 w-52 p-1.5 rounded-xl border border-border bg-card shadow-2xl space-y-1 animate-scaleUp">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartEditTitle(item);
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-foreground hover:bg-muted transition-colors text-left cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-indigo-500" />
                          Изменить название в навигации
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuPos(null);
                            setConfirmRemoveItem(item);
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-500 hover:bg-red-500/10 transition-colors text-left cursor-pointer"
                        >
                          <Type className="w-3.5 h-3.5" />
                          Убрать из заголовков
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleHideFromNavigation(item);
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-amber-500 hover:bg-amber-500/10 transition-colors text-left cursor-pointer"
                        >
                          <EyeOff className="w-3.5 h-3.5" />
                          Скрыть из навигации
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Hidden Headings Toggle Section */}
      {hiddenHeadings.length > 0 && (
        <div className="border-t border-border pt-3 space-y-2">
          <button
            type="button"
            onClick={() => setShowHiddenSection((prev) => !prev)}
            className="flex items-center justify-between w-full text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <EyeOff className="w-3.5 h-3.5 text-amber-500" />
              Скрытые из навигации ({hiddenHeadings.length})
            </span>
            <span className="text-[10px] uppercase font-bold text-indigo-500">
              {showHiddenSection ? 'Скрыть' : 'Показать'}
            </span>
          </button>

          {showHiddenSection && (
            <div className="space-y-1 pl-1">
              {hiddenHeadings.map((h, i) => (
                <div key={`hidden-${h.pos}-${i}`} className="flex items-center justify-between text-xs py-1 text-muted-foreground/70">
                  <span className="truncate flex-1">{h.text}</span>
                  <button
                    type="button"
                    onClick={() => handleUnhideNavigation(h)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-500 hover:text-indigo-600 transition-colors cursor-pointer ml-2 shrink-0"
                    title="Восстановить в навигации"
                  >
                    <Eye className="w-3 h-3" />
                    Показать
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
