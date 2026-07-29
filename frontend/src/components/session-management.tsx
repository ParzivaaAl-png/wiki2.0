import * as React from 'react';
import { 
  ChevronDown, 
  ChevronUp, 
  Monitor, 
  Smartphone, 
  Trash2, 
  ShieldAlert, 
  RefreshCw,
  Search,
  Clock,
  Globe,
  KeyRound,
  Lock,
  Unlock,
  RotateCcw
} from 'lucide-react';
import { 
  fetchUserSessions, 
  deleteUserSession, 
  UserWithSessions, 
  UserSession,
  adminResetPassword,
  adminRequirePasswordChange,
  adminRevokeUserSessions,
  adminToggleBlock
} from '../lib/api';
import { useAuth } from '../lib/auth-context';
import AdminFilterBar from './admin-filter-bar';

export default function SessionManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = React.useState<UserWithSessions[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'active' | 'blocked'>('all');
  const [isFilterOpen, setIsFilterOpen] = React.useState(false);
  const [expandedUserIds, setExpandedUserIds] = React.useState<Set<number>>(new Set());
  const [temporaryPassword, setTemporaryPassword] = React.useState<{ userName: string; password: string } | null>(null);

  const loadSessions = async () => {
    setIsLoading(true);
    try {
      const data = await fetchUserSessions();
      setUsers(data);
    } catch (err) {
      console.error('Failed to load user sessions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadSessions();
  }, []);

  const toggleExpand = (userId: number) => {
    setExpandedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handleRevokeSession = async (sessionId: number, userName: string) => {
    if (!window.confirm(`Вы уверены, что хотите завершить эту сессию для пользователя ${userName}? На этом устройстве будет выполнен автоматический выход.`)) {
      return;
    }

    try {
      await deleteUserSession(sessionId);
      
      // Update UI state
      setUsers(prev => prev.map(u => ({
        ...u,
        sessions: u.sessions.filter(s => s.id !== sessionId)
      })));
    } catch (err: any) {
      alert(err.message || 'Не удалось завершить сессию.');
    }
  };

  const handleResetPassword = async (targetUser: UserWithSessions, event: React.MouseEvent) => {
    event.stopPropagation();
    if (!window.confirm(`Сгенерировать временный пароль для пользователя ${targetUser.name}? Все активные сессии будут завершены.`)) {
      return;
    }

    try {
      const result = await adminResetPassword(targetUser.id);
      if (result.temporaryPassword) {
        setTemporaryPassword({ userName: targetUser.name, password: result.temporaryPassword });
      }
      setUsers((prev) => prev.map((u) => (u.id === targetUser.id ? { ...u, sessions: [] } : u)));
    } catch (err: any) {
      alert(err.message || 'Не удалось сбросить пароль.');
    }
  };

  const handleRequirePasswordChange = async (targetUser: UserWithSessions, event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      await adminRequirePasswordChange(targetUser.id);
      alert(`При следующем входе ${targetUser.name} должен будет сменить пароль.`);
    } catch (err: any) {
      alert(err.message || 'Не удалось включить требование смены пароля.');
    }
  };

  const handleRevokeAllSessions = async (targetUser: UserWithSessions, event: React.MouseEvent) => {
    event.stopPropagation();
    if (!window.confirm(`Завершить все активные сессии пользователя ${targetUser.name}?`)) {
      return;
    }

    try {
      await adminRevokeUserSessions(targetUser.id);
      setUsers((prev) => prev.map((u) => (u.id === targetUser.id ? { ...u, sessions: [] } : u)));
    } catch (err: any) {
      alert(err.message || 'Не удалось завершить все сессии.');
    }
  };

  const handleToggleBlock = async (targetUser: UserWithSessions, event: React.MouseEvent) => {
    event.stopPropagation();
    if (targetUser.id === currentUser?.id) {
      alert('Нельзя заблокировать собственный аккаунт.');
      return;
    }

    const nextBlocked = !targetUser.is_blocked;
    if (!window.confirm(`${nextBlocked ? 'Заблокировать' : 'Разблокировать'} аккаунт ${targetUser.name}?`)) {
      return;
    }

    try {
      await adminToggleBlock(targetUser.id, nextBlocked);
      setUsers((prev) => prev.map((u) => (
        u.id === targetUser.id
          ? { ...u, is_blocked: nextBlocked, sessions: nextBlocked ? [] : u.sessions }
          : u
      )));
    } catch (err: any) {
      alert(err.message || 'Не удалось изменить статус аккаунта.');
    }
  };

  const parseUserAgent = (ua: string): { label: string; isMobile: boolean } => {
    if (!ua) return { label: 'Неизвестное устройство', isMobile: false };
    
    let browser = 'Браузер';
    let os = 'ОС';
    let isMobile = false;

    // OS detection
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Macintosh') || ua.includes('Mac OS X')) os = 'macOS';
    else if (ua.includes('iPhone') || ua.includes('iPad')) {
      os = 'iOS';
      isMobile = true;
    } else if (ua.includes('Android')) {
      os = 'Android';
      isMobile = true;
    } else if (ua.includes('Linux')) os = 'Linux';

    // Browser detection
    if (ua.includes('Chrome') || ua.includes('CriOS')) {
      if (ua.includes('Edg')) browser = 'Edge';
      else if (ua.includes('OPR') || ua.includes('Opera')) browser = 'Opera';
      else browser = 'Chrome';
    } else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
    else if (ua.includes('Firefox') || ua.includes('FxiOS')) browser = 'Firefox';
    else if (ua.includes('MSIE') || ua.includes('Trident')) browser = 'Internet Explorer';

    return { label: `${browser} на ${os}`, isMobile };
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return dateStr;
    }
  };

  const filteredUsers = React.useMemo(() => {
    return users.filter(u => {
      const matchesSearch =
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        u.username.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;
      if (statusFilter === 'blocked') return u.is_blocked;
      if (statusFilter === 'active') return !u.is_blocked;
      return true;
    });
  }, [users, searchQuery, statusFilter]);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 bg-neutral-200 dark:bg-neutral-800 rounded w-full" />
        <div className="h-64 bg-neutral-200 dark:bg-neutral-800 rounded w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Search and Refresh Filter Bar */}
      <AdminFilterBar
        isOpen={isFilterOpen}
        onToggle={() => setIsFilterOpen((prev) => !prev)}
        activeCount={(searchQuery.trim() ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0)}
        onReset={() => {
          setSearchQuery('');
          setStatusFilter('all');
        }}
        searchControl={
          <div className="flex items-center gap-2 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 bg-neutral-50 dark:bg-neutral-900/30 w-full focus-within:border-indigo-500 transition-colors">
            <Search className="w-4 h-4 text-neutral-400 shrink-0" />
            <input
              type="text"
              placeholder="Поиск по пользователям..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-xs text-neutral-950 dark:text-neutral-100 outline-none w-full placeholder-neutral-400"
            />
          </div>
        }
        actions={
          <button
            type="button"
            onClick={loadSessions}
            className="p-2 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900 text-neutral-500 hover:text-indigo-500 transition-colors cursor-pointer shadow-sm"
            title="Обновить список"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">Статус аккаунта</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full text-xs border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-white outline-none focus:border-indigo-500"
            >
              <option value="all">Все аккаунты</option>
              <option value="active">Активные</option>
              <option value="blocked">Заблокированные</option>
            </select>
          </div>
        </div>
      </AdminFilterBar>

      {/* Users list with sessions count */}
      <div className="border border-neutral-200/50 dark:border-neutral-800/80 bg-white dark:bg-neutral-950 rounded-xl overflow-hidden shadow-premium dark:shadow-premium-dark divide-y divide-neutral-200/50 dark:divide-neutral-800/80">
        {filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-neutral-400 dark:text-neutral-600 text-xs">
            Пользователи не найдены.
          </div>
        ) : (
          filteredUsers.map((u) => {
            const isExpanded = expandedUserIds.has(u.id);
            const activeSessions = u.sessions || [];
            
            return (
              <div key={u.id} className="transition-colors">
                
                {/* User Header Accordion Item */}
                <div 
                  onClick={() => toggleExpand(u.id)}
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-neutral-50/50 dark:hover:bg-neutral-900/10 select-none"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center text-neutral-600 dark:text-neutral-400 font-bold shrink-0">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-neutral-900 dark:text-neutral-100 text-xs flex items-center gap-1.5">
                        {u.name}
                        {u.id === currentUser?.id && (
                          <span className="text-[9px] px-1.5 py-0.2 bg-indigo-500/10 text-indigo-500 rounded font-semibold">
                            Вы
                          </span>
                        )}
                        {u.is_blocked && (
                          <span className="text-[9px] px-1.5 py-0.2 bg-red-500/10 text-red-500 rounded font-semibold">
                            Заблокирован
                          </span>
                        )}
                      </h4>
                      <p className="text-[10px] text-neutral-400 font-light mt-0.5">
                        Логин: {u.username} • Роль: {u.role}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="hidden xl:flex items-center gap-1.5">
                      <button
                        onClick={(event) => handleResetPassword(u, event)}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-amber-500/20 bg-amber-500/5 px-2 text-[10px] font-bold text-amber-600 hover:bg-amber-500/10"
                        title="Сгенерировать временный пароль"
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                        Сброс
                      </button>
                      <button
                        onClick={(event) => handleRequirePasswordChange(u, event)}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-2 text-[10px] font-bold text-indigo-600 hover:bg-indigo-500/10"
                        title="Потребовать смену пароля"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Смена
                      </button>
                      <button
                        onClick={(event) => handleRevokeAllSessions(u, event)}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-2 text-[10px] font-bold text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-900"
                        title="Завершить все сессии"
                      >
                        <ShieldAlert className="h-3.5 w-3.5" />
                        Сессии
                      </button>
                      <button
                        onClick={(event) => handleToggleBlock(u, event)}
                        disabled={u.id === currentUser?.id}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-red-500/20 bg-red-500/5 px-2 text-[10px] font-bold text-red-500 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                        title={u.is_blocked ? 'Разблокировать аккаунт' : 'Заблокировать аккаунт'}
                      >
                        {u.is_blocked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                        {u.is_blocked ? 'Открыть' : 'Блок'}
                      </button>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                      activeSessions.length > 0
                        ? 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20'
                        : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-400'
                    }`}>
                      {activeSessions.length} {activeSessions.length === 1 ? 'сессия' : activeSessions.length > 1 && activeSessions.length < 5 ? 'сессии' : 'сессий'}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-neutral-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-neutral-400" />
                    )}
                  </div>
                </div>

                {/* Collapsible Session List */}
                {isExpanded && (
                  <div className="bg-neutral-50/30 dark:bg-neutral-900/5 p-4 border-t border-neutral-100 dark:border-neutral-900 space-y-3">
                    <div className="grid grid-cols-2 gap-2 xl:hidden">
                      <button
                        onClick={(event) => handleResetPassword(u, event)}
                        className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-2 text-[10px] font-bold text-amber-600"
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                        Временный пароль
                      </button>
                      <button
                        onClick={(event) => handleRequirePasswordChange(u, event)}
                        className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-2 text-[10px] font-bold text-indigo-600"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Смена пароля
                      </button>
                      <button
                        onClick={(event) => handleRevokeAllSessions(u, event)}
                        className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-2 text-[10px] font-bold text-neutral-500"
                      >
                        <ShieldAlert className="h-3.5 w-3.5" />
                        Завершить сессии
                      </button>
                      <button
                        onClick={(event) => handleToggleBlock(u, event)}
                        disabled={u.id === currentUser?.id}
                        className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/5 px-2 text-[10px] font-bold text-red-500 disabled:opacity-40"
                      >
                        {u.is_blocked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                        {u.is_blocked ? 'Разблокировать' : 'Заблокировать'}
                      </button>
                    </div>
                    {activeSessions.length === 0 ? (
                      <p className="text-[11px] text-neutral-400 py-2 pl-11">
                        Нет активных сессий (пользователь не вошел в аккаунт).
                      </p>
                    ) : (
                      <div className="space-y-2 pl-11">
                        {activeSessions.map((session) => {
                          const { label, isMobile } = parseUserAgent(session.user_agent);
                          return (
                            <div 
                              key={session.id}
                              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border border-neutral-200/50 dark:border-neutral-800 bg-white dark:bg-neutral-950/40 text-xs shadow-sm hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
                            >
                              <div className="flex items-start gap-3">
                                <div className="mt-0.5 text-neutral-400 shrink-0">
                                  {isMobile ? (
                                    <Smartphone className="w-4 h-4 text-neutral-500" />
                                  ) : (
                                    <Monitor className="w-4 h-4 text-indigo-500" />
                                  )}
                                </div>
                                <div className="space-y-1">
                                  <div className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5 flex-wrap">
                                    <span>{label}</span>
                                    <span className="text-[10px] text-neutral-400 font-mono bg-neutral-100 dark:bg-neutral-900 px-1.5 py-0.2 rounded inline-flex items-center gap-1 font-light">
                                      <Globe className="w-3 h-3" />
                                      {session.ip_address}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3 text-[10px] text-neutral-400 font-light flex-wrap">
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3 h-3 text-neutral-300" />
                                      Создана: {formatDate(session.created_at)}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3 h-3 text-neutral-300" />
                                      Активность: {formatDate(session.last_active_at)}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <button
                                onClick={() => handleRevokeSession(session.id, u.name)}
                                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 border border-red-500/10 hover:border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-red-500 dark:text-red-400 rounded-lg text-[10px] font-semibold transition-all shrink-0 cursor-pointer self-end sm:self-center"
                                title="Завершить сессию"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Завершить</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      {temporaryPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 shadow-2xl">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-outfit text-base font-extrabold text-neutral-950 dark:text-neutral-100">
                  Временный пароль создан
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                  Покажите пароль пользователю {temporaryPassword.userName}. После закрытия окна повторно посмотреть его нельзя.
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4 font-mono text-lg font-extrabold tracking-widest text-amber-700 dark:text-amber-300">
              {temporaryPassword.password}
            </div>
            <button
              onClick={() => setTemporaryPassword(null)}
              className="mt-5 inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white hover:bg-indigo-700"
            >
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
