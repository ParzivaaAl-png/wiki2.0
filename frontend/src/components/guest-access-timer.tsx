import * as React from 'react';
import { Clock3, TimerOff } from 'lucide-react';

type GuestAccessTimerProps = {
  expiresAt: string;
  scope?: 'article' | 'section';
  compact?: boolean;
  className?: string;
};

const formatRemaining = (milliseconds: number, compact = false) => {
  if (milliseconds <= 0) return 'Истёк';

  const totalSeconds = Math.floor(milliseconds / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (compact) {
    if (days > 0) return `${days}д ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  if (days > 0) return `${days} дн. ${hours} ч. ${minutes} мин.`;
  if (hours > 0) return `${hours} ч. ${minutes} мин. ${seconds} сек.`;
  return `${minutes} мин. ${seconds} сек.`;
};

export default function GuestAccessTimer({ expiresAt, scope = 'section', compact = false, className = '' }: GuestAccessTimerProps) {
  const [now, setNow] = React.useState(() => Date.now());
  const expiresTime = React.useMemo(() => new Date(expiresAt).getTime(), [expiresAt]);
  const remaining = expiresTime - now;
  const isExpired = remaining <= 0;
  const scopeLabel = scope === 'article' ? 'статье' : 'разделу';
  const expiresLabel = Number.isNaN(expiresTime)
    ? ''
    : new Date(expiresAt).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

  React.useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  if (compact) {
    return (
      <span
        className={`inline-flex h-5 items-center gap-1 rounded-md border px-1.5 text-[10px] font-bold tabular-nums ${
          isExpired
            ? 'border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-400'
            : 'border-indigo-500/25 bg-indigo-500/10 text-indigo-650 dark:text-indigo-300'
        } ${className}`}
        title={`Гостевой доступ к ${scopeLabel} до ${expiresLabel}`}
      >
        {isExpired ? <TimerOff className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}
        {formatRemaining(remaining, true)}
      </span>
    );
  }

  return (
    <div
      className={`rounded-xl border p-4 shadow-premium ${
        isExpired
          ? 'border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300'
          : 'border-indigo-500/20 bg-indigo-500/10 text-indigo-800 dark:text-indigo-200'
      } ${className}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isExpired ? 'bg-rose-500/15' : 'bg-indigo-500/15'}`}>
            {isExpired ? <TimerOff className="h-5 w-5" /> : <Clock3 className="h-5 w-5" />}
          </div>
          <div>
            <div className="text-sm font-bold">
              {isExpired ? 'Гостевой доступ истёк' : `Гостевой доступ к ${scopeLabel}`}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Действует до {expiresLabel}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-current/15 bg-background/55 px-3 py-2 text-sm font-extrabold tabular-nums">
          {formatRemaining(remaining)}
        </div>
      </div>
    </div>
  );
}
