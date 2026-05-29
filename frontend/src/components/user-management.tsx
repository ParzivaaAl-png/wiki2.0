import * as React from 'react';
import { 
  User, 
  UserPlus, 
  Shield, 
  Ban, 
  Trash2, 
  Search, 
  X, 
  Edit3,
  ChevronDown,
  ChevronUp,
  Clock
} from 'lucide-react';
import { 
  adminFetchUsers, 
  adminCreateUser, 
  adminChangeRole, 
  adminToggleBlock, 
  adminDeleteUser, 
  adminUpdateUser,
  fetchUserHistory,
  User as UserType,
  UserAuditLog
} from '../lib/api';
import { useAuth } from '../lib/auth-context';

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = React.useState<UserType[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  
  // Create User Form State
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [newUsername, setNewUsername] = React.useState('');
  const [newName, setNewName] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [newRole, setNewRole] = React.useState<'Admin' | 'Editor' | 'User'>('User');
  const [createError, setCreateError] = React.useState<string | null>(null);

  // Edit User Modal State
  const [editUser, setEditUser] = React.useState<UserType | null>(null);
  const [editUsername, setEditUsername] = React.useState('');
  const [editName, setEditName] = React.useState('');
  const [editPassword, setEditPassword] = React.useState('');
  const [editError, setEditError] = React.useState<string | null>(null);
  const [history, setHistory] = React.useState<UserAuditLog[]>([]);
  const [isHistoryExpanded, setIsHistoryExpanded] = React.useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = React.useState(false);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const data = await adminFetchUsers();
      setUsers(data);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!newUsername.trim() || !newName.trim() || !newPassword) {
      setCreateError('Все поля обязательны для заполнения.');
      return;
    }

    try {
      const created = await adminCreateUser({
        username: newUsername.trim(),
        name: newName.trim(),
        password: newPassword,
        role: newRole
      });
      setUsers(prev => [...prev, created]);
      setIsCreateOpen(false);
      setNewUsername('');
      setNewName('');
      setNewPassword('');
      setNewRole('User');
    } catch (err: any) {
      setCreateError(err.message || 'Ошибка создания пользователя.');
    }
  };

  const handleChangeRole = async (userId: number, role: 'Admin' | 'Editor' | 'User') => {
    try {
      await adminChangeRole(userId, role);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u));
    } catch (err: any) {
      alert(err.message || 'Не удалось обновить роль.');
    }
  };

  const handleToggleBlock = async (userId: number, currentBlocked: boolean) => {
    const nextBlockedState = !currentBlocked;
    const actionText = nextBlockedState ? 'заблокировать' : 'разблокировать';
    if (!window.confirm(`Вы действительно хотите ${actionText} этого пользователя?`)) return;

    try {
      await adminToggleBlock(userId, nextBlockedState);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_blocked: nextBlockedState } : u));
    } catch (err: any) {
      alert(err.message || 'Не удалось обновить статус блокировки.');
    }
  };

  const handleOpenEditModal = async (u: UserType) => {
    setEditUser(u);
    setEditUsername(u.username);
    setEditName(u.name);
    setEditPassword('');
    setEditError(null);
    setIsHistoryExpanded(false);
    setHistory([]);
    
    // Load history
    setIsHistoryLoading(true);
    try {
      const logs = await fetchUserHistory(u.id);
      setHistory(logs);
    } catch (err) {
      console.error('Failed to load user history:', err);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);
    if (!editUser) return;

    if (!editUsername.trim() || !editName.trim()) {
      setEditError('Логин и ФИО обязательны.');
      return;
    }

    try {
      const updated = await adminUpdateUser(editUser.id, {
        username: editUsername.trim(),
        name: editName.trim(),
        password: editPassword || undefined
      });
      
      // Update local state
      setUsers(prev => prev.map(u => u.id === editUser.id ? { ...u, username: updated.username, name: updated.name } : u));
      setEditUser(null);
      alert('Данные пользователя успешно обновлены.');
    } catch (err: any) {
      setEditError(err.message || 'Не удалось обновить пользователя.');
    }
  };

  const handleDeleteUser = async (userId: number, username: string) => {
    if (userId === currentUser?.id) {
      alert('Вы не можете удалить свою собственную учетную запись.');
      return;
    }

    if (!window.confirm(`Вы уверены, что хотите удалить пользователя ${username}? Это действие необратимо!`)) {
      return;
    }

    try {
      await adminDeleteUser(userId);
      setUsers(prev => prev.filter(u => u.id !== userId));
    } catch (err: any) {
      alert(err.message || 'Не удалось удалить пользователя.');
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
      
      {/* Search and Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-1.5 bg-neutral-50 dark:bg-neutral-900/30 w-full sm:max-w-xs">
          <Search className="w-4 h-4 text-neutral-400 shrink-0" />
          <input
            type="text"
            placeholder="Поиск пользователей..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-xs text-neutral-950 dark:text-neutral-100 outline-none w-full placeholder-neutral-400"
          />
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 transition-all text-center justify-center shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          Добавить пользователя
        </button>
      </div>

      {/* Create User Dialog */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-neutral-900/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg text-neutral-900 dark:text-white">Новый пользователь</h3>
              <button 
                onClick={() => setIsCreateOpen(false)}
                className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              {createError && (
                <div className="p-3 rounded-lg border border-red-500/10 bg-red-500/5 text-red-600 dark:text-red-400 text-xs">
                  {createError}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">ФИО пользователя</label>
                <input
                  type="text"
                  required
                  placeholder="Иван Петров"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-900 dark:text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Логин (Имя пользователя)</label>
                <input
                  type="text"
                  required
                  placeholder="ivan_editor"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-900 dark:text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Пароль</label>
                <input
                  type="password"
                  required
                  placeholder="Мин. 6 символов"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-900 dark:text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Роль</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-700 dark:text-neutral-300 outline-none focus:border-indigo-500"
                >
                  <option value="User">User (Читатель)</option>
                  <option value="Editor">Editor (Редактор)</option>
                  <option value="Admin">Admin (Администратор)</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/25 transition-all mt-4"
              >
                Создать пользователя
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal with Audit History Accordion */}
      {editUser !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-neutral-900/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg text-neutral-900 dark:text-white">Редактирование профиля</h3>
              <button 
                onClick={() => setEditUser(null)}
                className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              {editError && (
                <div className="p-3 rounded-lg border border-red-500/10 bg-red-500/5 text-red-600 dark:text-red-400 text-xs">
                  {editError}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">ФИО пользователя</label>
                <input
                  type="text"
                  required
                  placeholder="Иван Петров"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-900 dark:text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Логин (Имя пользователя)</label>
                <input
                  type="text"
                  required
                  placeholder="ivan_editor"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-900 dark:text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Новый пароль (оставьте пустым, если не хотите менять)</label>
                <input
                  type="password"
                  placeholder="Не менее 6 символов"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-900 dark:text-white outline-none focus:border-indigo-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/25 transition-all"
              >
                Сохранить изменения
              </button>
            </form>

            {/* Change History Accordion */}
            <div className="border-t border-neutral-100 dark:border-neutral-900 pt-4">
              <button
                type="button"
                onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
                className="flex items-center justify-between w-full text-xs font-bold text-neutral-400 hover:text-neutral-950 dark:hover:text-white uppercase tracking-wider select-none transition-colors"
              >
                <span>История изменений ({history.length})</span>
                {isHistoryExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              {isHistoryExpanded && (
                <div className="mt-3 max-h-40 overflow-y-auto space-y-2 pr-1">
                  {isHistoryLoading ? (
                    <p className="text-[10px] text-neutral-400 py-1 font-light">Загрузка истории...</p>
                  ) : history.length === 0 ? (
                    <p className="text-[10px] text-neutral-400 py-1 font-light">История изменений пуста.</p>
                  ) : (
                    history.map((log) => (
                      <div key={log.id} className="p-2 rounded border border-neutral-200/50 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/20 text-[10px] leading-relaxed">
                        <div className="font-semibold text-neutral-700 dark:text-neutral-300">
                          {log.field_changed === 'username' && `Смена логина: с "${log.old_value}" на "${log.new_value}"`}
                          {log.field_changed === 'name' && `Смена ФИО: с "${log.old_value}" на "${log.new_value}"`}
                          {log.field_changed === 'password' && `Пароль изменен`}
                        </div>
                        <div className="text-neutral-400 font-light mt-0.5 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>Админ: {log.changed_by_name || log.changed_by_username || 'Система'}</span>
                          <span>•</span>
                          <span>{new Date(log.changed_at).toLocaleString('ru-RU')}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="border border-neutral-200/50 dark:border-neutral-800/80 bg-white dark:bg-neutral-950 rounded-xl overflow-hidden shadow-premium dark:shadow-premium-dark">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50 dark:bg-neutral-950 text-neutral-400 dark:text-neutral-500 font-semibold text-xs border-b border-neutral-200 dark:border-neutral-800 select-none">
                <th className="p-4">Пользователь</th>
                <th className="p-4">Роль</th>
                <th className="p-4">Статус</th>
                <th className="p-4 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200/50 dark:divide-neutral-800/80 text-xs">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-neutral-400 dark:text-neutral-600 select-none">
                    Пользователи не найдены.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isSelf = u.id === currentUser?.id;
                  return (
                    <tr key={u.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/20 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center text-neutral-600 dark:text-neutral-400 font-bold shrink-0">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                              {u.name}
                              {isSelf && (
                                <span className="text-[9px] px-1.5 py-0.2 bg-indigo-500/10 text-indigo-500 rounded font-semibold">
                                  Вы
                                </span>
                              )}
                            </span>
                            <span className="block text-[10px] text-neutral-400 font-light mt-0.5">
                              Логин: {u.username}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        {isSelf ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                            <Shield className="w-3 h-3" />
                            {u.role}
                          </span>
                        ) : (
                          <select
                             value={u.role}
                             onChange={(e) => handleChangeRole(u.id, e.target.value as any)}
                             className="text-xs border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1 bg-neutral-50 dark:bg-neutral-950 text-neutral-700 dark:text-neutral-300 outline-none focus:border-indigo-500"
                          >
                            <option value="User">User</option>
                            <option value="Editor">Editor</option>
                            <option value="Admin">Admin</option>
                          </select>
                        )}
                      </td>
                      <td className="p-4">
                        {u.is_blocked ? (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-red-500/10 text-red-500 font-semibold border border-red-500/20">
                            Заблокирован
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-semibold border border-emerald-500/20">
                            Активен
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEditModal(u)}
                            className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
                            title="Редактировать"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          
                          <button
                            disabled={isSelf}
                            onClick={() => handleToggleBlock(u.id, u.is_blocked)}
                            className={`p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 transition-colors ${
                              isSelf 
                                ? 'opacity-30 cursor-not-allowed text-neutral-300' 
                                : u.is_blocked
                                  ? 'text-emerald-500 hover:text-emerald-600 hover:bg-neutral-50 dark:hover:bg-neutral-900'
                                  : 'text-neutral-500 hover:text-red-500 hover:bg-neutral-50 dark:hover:bg-neutral-900'
                            }`}
                            title={u.is_blocked ? "Разблокировать" : "Заблокировать"}
                          >
                            <Ban className="w-4 h-4" />
                          </button>

                          <button
                            disabled={isSelf}
                            onClick={() => handleDeleteUser(u.id, u.username)}
                            className={`p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors ${
                              isSelf ? 'opacity-30 cursor-not-allowed text-neutral-300' : ''
                            }`}
                            title="Удалить"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
