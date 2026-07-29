import * as React from 'react';
import { Filter, X, RotateCcw, ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export interface AdminFilterBarProps {
  /** Number of active filters applied (0 if none) */
  activeCount?: number;
  /** State whether the filter panel is open */
  isOpen: boolean;
  /** Toggle filter panel open/closed */
  onToggle: () => void;
  /** Reset handler when activeCount > 0 */
  onReset?: () => void;
  /** Primary controls to show inline next to the filter button (e.g. search input) */
  searchControl?: React.ReactNode;
  /** Action buttons to render on the right of the header bar */
  actions?: React.ReactNode;
  /** Filter controls to render inside the collapsible panel */
  children: React.ReactNode;
  /** Optional custom title or label (defaults to "Фильтры") */
  label?: string;
  className?: string;
}

export function AdminFilterBar({
  activeCount = 0,
  isOpen,
  onToggle,
  onReset,
  searchControl,
  actions,
  children,
  label = 'Фильтры',
  className = '',
}: AdminFilterBarProps) {
  const hasActiveFilters = activeCount > 0;

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Search input & Toggle Filter Button */}
        <div className="flex flex-1 items-center gap-2 max-w-full">
          {searchControl && <div className="flex-1 min-w-0">{searchControl}</div>}

          <button
            type="button"
            onClick={onToggle}
            className={`inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-extrabold transition-all cursor-pointer shrink-0 shadow-sm ${
              isOpen || hasActiveFilters
                ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 ring-2 ring-indigo-500/15'
                : 'border-border bg-card text-foreground hover:bg-muted'
            }`}
          >
            <Filter className={`w-3.5 h-3.5 ${hasActiveFilters ? 'text-indigo-500 animate-pulse' : 'text-muted-foreground'}`} />
            <span>{label}</span>
            {hasActiveFilters && (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-bold text-white">
                {activeCount}
              </span>
            )}
            <ChevronDown
              className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${
                isOpen ? 'rotate-180 text-indigo-500' : ''
              }`}
            />
          </button>

          {hasActiveFilters && onReset && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-300 hover:bg-rose-500/20 text-xs font-bold transition-all cursor-pointer shrink-0 shadow-sm"
              title="Сбросить все активные фильтры"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Сбросить</span>
            </button>
          )}
        </div>

        {/* Right: Extra action buttons */}
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>

      {/* Collapsible Filter Panel */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="p-4 rounded-xl border border-border bg-card/80 backdrop-blur-sm shadow-sm space-y-3 my-1">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">
                <span className="flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-indigo-500" />
                  Параметры фильтрации
                </span>
                {hasActiveFilters && (
                  <span className="text-indigo-600 dark:text-indigo-400">
                    Активно фильтров: {activeCount}
                  </span>
                )}
              </div>
              <div className="pt-1">{children}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default AdminFilterBar;
