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
  Globe
} from 'lucide-react';
import { 
  fetchUserSessions, 
  deleteUserSession, 
  UserWithSessions, 
  UserSession 
} from '../lib/api';
import { useAuth } from '../lib/auth-context';

export default function SessionManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = React.useState<UserWithSessions[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [expandedUserIds, setExpandedUserIds] = React.useState<Set<number>>(new Set());

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
    return users.filter(u => 
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      u.username.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [users, searchQuery]);

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
      
      {/* Search and Refresh */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-1.5 bg-neutral-50 dark:bg-neutral-900/30 w-full sm:max-w-xs">
          <Search className="w-4 h-4 text-neutral-400 shrink-0" />
          <input
            type="text"
            placeholder="Поиск по пользователям..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-xs text-neutral-950 dark:text-neutral-100 outline-none w-full placeholder-neutral-400"
          />
        </div>

        <button
          onClick={loadSessions}
          className="p-2 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900 text-neutral-500 hover:text-indigo-500 transition-colors"
          title="Обновить список"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

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
                      </h4>
                      <p className="text-[10px] text-neutral-400 font-light mt-0.5">
                        Логин: {u.username} • Роль: {u.role}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
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
    </div>
  );
}
