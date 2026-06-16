import * as React from 'react';
import { 
  ShieldAlert, 
  UserPlus, 
  Trash2, 
  X, 
  Calendar, 
  FileText, 
  Folder 
} from 'lucide-react';
import { 
  fetchGuestAccessList, 
  createGuestAccess, 
  deleteGuestAccess, 
  adminFetchUsers, 
  fetchArticles, 
  fetchSections,
  GuestAccess, 
  User, 
  Article, 
  Section 
} from '../lib/api';

export default function GuestManagement() {
  const [guestAccesses, setGuestAccesses] = React.useState<GuestAccess[]>([]);
  const [users, setUsers] = React.useState<User[]>([]);
  const [articles, setArticles] = React.useState<Article[]>([]);
  const [sections, setSections] = React.useState<Section[]>([]);
  
  const [isLoading, setIsLoading] = React.useState(true);
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);

  // Form State
  const [selectedUserId, setSelectedUserId] = React.useState<number>(0);
  const [grantType, setGrantType] = React.useState<'article' | 'section'>('section');
  const [selectedArticleId, setSelectedArticleId] = React.useState<number | null>(null);
  const [selectedSectionId, setSelectedSectionId] = React.useState<number | null>(null);
  const [expiryDate, setExpiryDate] = React.useState('');
  const [expiryTime, setExpiryTime] = React.useState('23:59');
  
  const [formError, setFormError] = React.useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [accessData, usersData, articlesData, sectionsData] = await Promise.all([
        fetchGuestAccessList(),
        adminFetchUsers(),
        fetchArticles({ all: true }),
        fetchSections()
      ]);
      setGuestAccesses(accessData);
      setUsers(usersData);
      setArticles(articlesData.filter(a => !a.slug.startsWith('auto-list-')));
      setSections(sectionsData);
      
      // Set defaults for form
      if (usersData.length > 0) setSelectedUserId(usersData[0].id);
      if (articlesData.length > 0) setSelectedArticleId(articlesData[0].id);
      if (sectionsData.length > 0) setSelectedSectionId(sectionsData[0].id);
      
      // Default expiry date: tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setExpiryDate(tomorrow.toISOString().split('T')[0]);
    } catch (err) {
      console.error('Failed to load guest access list:', err);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreate = () => {
    setFormError(null);
    setIsCreateOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedUserId || !expiryDate || !expiryTime) {
      setFormError('Пожалуйста, заполните все обязательные поля.');
      return;
    }

    if (grantType === 'article' && !selectedArticleId) {
      setFormError('Выберите статью для предоставления доступа.');
      return;
    }

    if (grantType === 'section' && !selectedSectionId) {
      setFormError('Выберите раздел для предоставления доступа.');
      return;
    }

    // Combine date and time to ISO String
    const expiresAt = new Date(`${expiryDate}T${expiryTime}:00`).toISOString();

    try {
      await createGuestAccess({
        user_id: selectedUserId,
        article_id: grantType === 'article' ? selectedArticleId : null,
        section_id: grantType === 'section' ? selectedSectionId : null,
        expires_at: expiresAt
      });
      setIsCreateOpen(false);
      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'Ошибка предоставления доступа.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Вы действительно хотите отозвать этот гостевой доступ?')) {
      return;
    }

    try {
      await deleteGuestAccess(id);
      await loadData();
    } catch (err: any) {
      alert(`Ошибка при отзыве доступа: ${err.message}`);
    }
  };

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
      
      {/* Top action bar */}
      <div className="flex justify-between items-center">
        <div className="text-xs text-neutral-450 dark:text-neutral-500 max-w-md">
          Гостевой доступ позволяет временно предоставить права на чтение конкретной закрытой статьи или раздела пользователю, не меняя его должность в оргструктуре.
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 transition-all cursor-pointer shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          Предоставить доступ
        </button>
      </div>

      {/* Guest accesses Table */}
      <div className="border border-neutral-200/50 dark:border-neutral-800/80 bg-white dark:bg-neutral-950 rounded-xl overflow-hidden shadow-premium">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50 dark:bg-neutral-950 text-neutral-400 dark:text-neutral-500 font-semibold text-xs border-b border-neutral-200 dark:border-neutral-800 select-none">
                <th className="p-4">Пользователь</th>
                <th className="p-4">Тип доступа</th>
                <th className="p-4">Объект доступа</th>
                <th className="p-4">Истекает</th>
                <th className="p-4">Предоставил</th>
                <th className="p-4 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200/50 dark:divide-neutral-800/80 text-xs">
              {guestAccesses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-neutral-400 dark:text-neutral-600 select-none">
                    Активные гостевые доступы отсутствуют.
                  </td>
                </tr>
              ) : (
                guestAccesses.map(ga => {
                  const isExpired = new Date(ga.expires_at) < new Date();
                  return (
                    <tr key={ga.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/20 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-neutral-900 dark:text-neutral-100">{ga.user_full_name}</div>
                        <div className="text-[10px] text-neutral-400 font-light mt-0.5">Логин: {ga.user_name}</div>
                      </td>
                      <td className="p-4 text-neutral-600 dark:text-neutral-400">
                        {ga.article_id ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded font-semibold">
                            <FileText className="w-3 h-3" />
                            Статья
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-blue-600 bg-blue-500/10 px-1.5 py-0.5 rounded font-semibold">
                            <Folder className="w-3 h-3" />
                            Раздел
                          </span>
                        )}
                      </td>
                      <td className="p-4 font-semibold text-neutral-900 dark:text-neutral-100 truncate max-w-xs">
                        {ga.article_id ? ga.article_title : ga.section_name}
                      </td>
                      <td className="p-4">
                        <span className={`font-semibold ${isExpired ? 'text-red-500' : 'text-neutral-700 dark:text-neutral-300'}`}>
                          {new Date(ga.expires_at).toLocaleString('ru-RU')}
                          {isExpired && <span className="block text-[9px] font-normal text-red-400">Истёк</span>}
                        </span>
                      </td>
                      <td className="p-4 text-neutral-600 dark:text-neutral-400">{ga.granted_by_name || 'Система'}</td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleDelete(ga.id)}
                          className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-red-500 dark:hover:text-red-450 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors cursor-pointer"
                          title="Отозвать доступ"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grant Access Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-neutral-900/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg text-neutral-900 dark:text-white flex items-center gap-1.5">
                <ShieldAlert className="w-5 h-5 text-indigo-500" />
                Предоставить гостевой доступ
              </h3>
              <button 
                onClick={() => setIsCreateOpen(false)}
                className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              {formError && (
                <div className="p-3 rounded-lg border border-red-500/10 bg-red-500/5 text-red-600 dark:text-red-400 text-xs">
                  {formError}
                </div>
              )}

              {/* User Selection */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Пользователь</label>
                <select
                  required
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-700 dark:text-neutral-300 outline-none focus:border-indigo-500"
                >
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.username})</option>
                  ))}
                </select>
              </div>

              {/* Grant Type */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Объект доступа</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setGrantType('section')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      grantType === 'section'
                        ? 'bg-indigo-650/10 border-indigo-500 text-indigo-600 dark:text-indigo-400 font-bold'
                        : 'border-neutral-200 dark:border-neutral-800 text-neutral-500'
                    }`}
                  >
                    Раздел
                  </button>
                  <button
                    type="button"
                    onClick={() => setGrantType('article')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      grantType === 'article'
                        ? 'bg-indigo-650/10 border-indigo-500 text-indigo-600 dark:text-indigo-400 font-bold'
                        : 'border-neutral-200 dark:border-neutral-800 text-neutral-500'
                    }`}
                  >
                    Статья
                  </button>
                </div>
              </div>

              {/* Section list or Article list selection */}
              {grantType === 'section' ? (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Выберите раздел</label>
                  <select
                    required
                    value={selectedSectionId || ''}
                    onChange={(e) => setSelectedSectionId(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-700 dark:text-neutral-300 outline-none focus:border-indigo-500"
                  >
                    {sections.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Выберите статью</label>
                  <select
                    required
                    value={selectedArticleId || ''}
                    onChange={(e) => setSelectedArticleId(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-700 dark:text-neutral-300 outline-none focus:border-indigo-500"
                  >
                    {articles.map(a => (
                      <option key={a.id} value={a.id}>{a.title}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Expiry Date-time picker */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    Дата истечения
                  </label>
                  <input
                    type="date"
                    required
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-900 dark:text-white outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Время истечения</label>
                  <input
                    type="time"
                    required
                    value={expiryTime}
                    onChange={(e) => setExpiryTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-900 dark:text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/25 transition-all mt-4 cursor-pointer"
              >
                Подтвердить гостевой доступ
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
