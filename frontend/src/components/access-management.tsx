import * as React from 'react';
import {
  Briefcase,
  Building2,
  Check,
  Edit3,
  Eye,
  KeyRound,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import {
  AccessOverview,
  AccessOverviewUser,
  createPosition,
  deletePosition,
  fetchAccessOverview,
  Position,
  seedAccessDefaults,
  updatePosition,
  updateUserWikiRoles,
  WikiCapabilities,
  WikiRole,
} from '../lib/api';

type AccessTab = 'matrix' | 'users';

type PositionModalState = {
  position: Position | null;
};

const capabilityLabels: Array<{ key: keyof WikiCapabilities; label: string }> = [
  { key: 'can_read', label: 'Чтение' },
  { key: 'can_create', label: 'Создание' },
  { key: 'can_edit', label: 'Редактирование' },
  { key: 'can_publish', label: 'Публикация' },
  { key: 'can_approve', label: 'Согласование' },
  { key: 'can_manage_users', label: 'Пользователи' },
  { key: 'can_manage_structure', label: 'Структура' },
  { key: 'can_manage_access', label: 'Доступ' },
];

const roleCapabilities = (role: WikiRole): WikiCapabilities => ({
  can_read: role.can_read,
  can_create: role.can_create,
  can_edit: role.can_edit,
  can_publish: role.can_publish,
  can_approve: role.can_approve,
  can_manage_users: role.can_manage_users,
  can_manage_structure: role.can_manage_structure,
  can_manage_access: role.can_manage_access,
});

const activeCapabilities = (capabilities: WikiCapabilities) =>
  capabilityLabels.filter((item) => capabilities[item.key]);

const roleTone = (code: string) => {
  if (code === 'wiki_admin') return 'border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-300';
  if (code === 'process_owner') return 'border-indigo-500/25 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300';
  if (code === 'approver') return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300';
  if (code === 'editor') return 'border-sky-500/25 bg-sky-500/10 text-sky-600 dark:text-sky-300';
  return 'border-border bg-muted text-muted-foreground';
};

export default function AccessManagement() {
  const [activeTab, setActiveTab] = React.useState<AccessTab>('matrix');
  const [overview, setOverview] = React.useState<AccessOverview | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSeeding, setIsSeeding] = React.useState(false);
  const [isSavingRoles, setIsSavingRoles] = React.useState(false);
  const [selectedUserId, setSelectedUserId] = React.useState<number | null>(null);
  const [pendingRoleIds, setPendingRoleIds] = React.useState<number[]>([]);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [departmentFilterId, setDepartmentFilterId] = React.useState<string>('all');
  const [positionModal, setPositionModal] = React.useState<PositionModalState | null>(null);
  const [positionForm, setPositionForm] = React.useState({
    name: '',
    departmentId: '',
    parentPositionId: '',
    hierarchyLevel: 1,
    status: 'Active',
  });
  const [isSavingPosition, setIsSavingPosition] = React.useState(false);

  const loadOverview = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchAccessOverview();
      setOverview(data);
      const firstUserId = selectedUserId || data.users[0]?.id || null;
      setSelectedUserId(firstUserId);
      const selected = data.users.find((user) => user.id === firstUserId);
      setPendingRoleIds(selected?.wiki_roles.map((role) => role.id) || []);
    } catch (err) {
      console.error('Failed to load access overview:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedUserId]);

  React.useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  React.useEffect(() => {
    if (!overview || !selectedUserId) return;
    const selected = overview.users.find((user) => user.id === selectedUserId);
    setPendingRoleIds(selected?.wiki_roles.map((role) => role.id) || []);
  }, [overview, selectedUserId]);

  const selectedUser = React.useMemo<AccessOverviewUser | null>(() => {
    if (!overview || !selectedUserId) return null;
    return overview.users.find((user) => user.id === selectedUserId) || null;
  }, [overview, selectedUserId]);

  const filteredUsers = React.useMemo(() => {
    if (!overview) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return overview.users;
    return overview.users.filter((user) => (
      user.name.toLowerCase().includes(q) ||
      user.username.toLowerCase().includes(q) ||
      (user.position_name || '').toLowerCase().includes(q) ||
      (user.department_name || '').toLowerCase().includes(q)
    ));
  }, [overview, searchQuery]);

  const positionsById = React.useMemo(() => (
    new Map((overview?.positions || []).map((position) => [position.id, position]))
  ), [overview]);

  const filteredMatrixRows = React.useMemo(() => {
    if (!overview) return [];
    if (departmentFilterId === 'all') return overview.matrix;
    const departmentId = Number(departmentFilterId);
    return overview.matrix.filter((row) => positionsById.get(row.position_id)?.department_id === departmentId);
  }, [departmentFilterId, overview, positionsById]);

  const openPositionModal = (position: Position | null = null) => {
    const fallbackDepartmentId = departmentFilterId !== 'all'
      ? departmentFilterId
      : String(position?.department_id || overview?.departments[0]?.id || '');

    setPositionForm({
      name: position?.name || '',
      departmentId: String(position?.department_id || fallbackDepartmentId),
      parentPositionId: position?.parent_position_id ? String(position.parent_position_id) : '',
      hierarchyLevel: position?.hierarchy_level || 1,
      status: position?.status || 'Active',
    });
    setPositionModal({ position });
  };

  const handleSavePosition = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!positionForm.name.trim() || !positionForm.departmentId) {
      alert('Название должности и отдел обязательны.');
      return;
    }

    setIsSavingPosition(true);
    try {
      const payload = {
        name: positionForm.name.trim(),
        department_id: Number(positionForm.departmentId),
        parent_position_id: positionForm.parentPositionId ? Number(positionForm.parentPositionId) : null,
        hierarchy_level: Number(positionForm.hierarchyLevel) || 1,
        status: positionForm.status,
      };

      if (positionModal?.position) {
        await updatePosition(positionModal.position.id, payload);
      } else {
        await createPosition(payload);
      }

      setPositionModal(null);
      await loadOverview();
    } catch (err: any) {
      alert(err.message || 'Не удалось сохранить должность.');
    } finally {
      setIsSavingPosition(false);
    }
  };

  const handleDeletePosition = async (position: Position) => {
    if (!window.confirm(`Удалить должность "${position.name}"?`)) return;

    setIsSavingPosition(true);
    try {
      await deletePosition(position.id);
      await loadOverview();
    } catch (err: any) {
      alert(err.message || 'Не удалось удалить должность.');
    } finally {
      setIsSavingPosition(false);
    }
  };

  const handleSeedDefaults = async () => {
    setIsSeeding(true);
    try {
      const result = await seedAccessDefaults();
      alert(result.message);
      await loadOverview();
    } catch (err: any) {
      alert(err.message || 'Не удалось создать каркас доступа.');
    } finally {
      setIsSeeding(false);
    }
  };

  const handleToggleRole = (roleId: number) => {
    setPendingRoleIds((prev) => (
      prev.includes(roleId)
        ? prev.filter((id) => id !== roleId)
        : [...prev, roleId]
    ));
  };

  const handleSaveRoles = async () => {
    if (!selectedUserId) return;
    setIsSavingRoles(true);
    try {
      await updateUserWikiRoles(selectedUserId, pendingRoleIds);
      await loadOverview();
    } catch (err: any) {
      alert(err.message || 'Не удалось сохранить Wiki-роли пользователя.');
    } finally {
      setIsSavingRoles(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 bg-muted rounded w-full" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-24 bg-muted rounded-lg" />
          ))}
        </div>
        <div className="h-80 bg-muted rounded-lg" />
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="border border-border bg-card text-card-foreground rounded-lg p-8 text-center">
        <p className="text-sm text-muted-foreground">Не удалось загрузить модель доступа.</p>
        <button
          onClick={loadOverview}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-muted transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Повторить
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-foreground font-outfit">Ролевая модель доступа</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Должности определяют видимость разделов, Wiki-роли определяют действия.
          </p>
        </div>

        <button
          onClick={handleSeedDefaults}
          disabled={isSeeding}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-bold shadow-md shadow-indigo-600/15 disabled:opacity-60 transition-colors"
        >
          {isSeeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
          Синхронизировать каркас
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-lg border border-border bg-card text-card-foreground">
          <div className="text-[10px] uppercase font-bold text-muted-foreground">Пользователи</div>
          <div className="mt-2 text-2xl font-bold text-foreground">{overview.summary.users}</div>
        </div>
        <div className="p-4 rounded-lg border border-border bg-card text-card-foreground">
          <div className="text-[10px] uppercase font-bold text-muted-foreground">Wiki-роли</div>
          <div className="mt-2 text-2xl font-bold text-foreground">{overview.summary.roles}</div>
        </div>
        <div className="p-4 rounded-lg border border-border bg-card text-card-foreground">
          <div className="text-[10px] uppercase font-bold text-muted-foreground">Должности</div>
          <div className="mt-2 text-2xl font-bold text-foreground">{overview.summary.positions}</div>
        </div>
        <div className="p-4 rounded-lg border border-border bg-card text-card-foreground">
          <div className="text-[10px] uppercase font-bold text-muted-foreground">Разделы</div>
          <div className="mt-2 text-2xl font-bold text-foreground">{overview.summary.sections}</div>
        </div>
        <div className="p-4 rounded-lg border border-border bg-card text-card-foreground">
          <div className="text-[10px] uppercase font-bold text-muted-foreground">Правила</div>
          <div className="mt-2 text-2xl font-bold text-foreground">{overview.summary.rules}</div>
        </div>
        <div className="p-4 rounded-lg border border-border bg-card text-card-foreground">
          <div className="text-[10px] uppercase font-bold text-muted-foreground">Публичные</div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {overview.sections.filter((section) => section.visibility_scope === 'public').length}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {overview.roles.map((role) => (
          <div key={role.id} className="rounded-lg border border-border bg-card text-card-foreground p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-foreground">{role.name}</h3>
                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{role.description}</p>
              </div>
              <span className={`shrink-0 text-[9px] px-2 py-1 rounded border font-bold ${roleTone(role.code)}`}>
                {role.code}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {activeCapabilities(roleCapabilities(role)).map((item) => (
                <span key={item.key} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                  <Check className="w-3 h-3 text-emerald-500" />
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 border-b border-border overflow-x-auto">
        <button
          onClick={() => setActiveTab('matrix')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors shrink-0 ${
            activeTab === 'matrix' ? 'border-indigo-500 text-indigo-500' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Layers className="w-4 h-4" />
          Матрица должностей
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors shrink-0 ${
            activeTab === 'users' ? 'border-indigo-500 text-indigo-500' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <UserCog className="w-4 h-4" />
          Роли пользователей
        </button>
      </div>

      {activeTab === 'matrix' && (
        <div className="border border-border bg-card text-card-foreground rounded-lg overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/20 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-indigo-500" />
                <h3 className="font-bold text-sm text-foreground">Матрица должностей</h3>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Должности добавляются здесь и сразу привязываются к выбранному отделу.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <label className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <select
                  value={departmentFilterId}
                  onChange={(event) => setDepartmentFilterId(event.target.value)}
                  className="bg-transparent text-xs font-bold text-foreground outline-none"
                >
                  <option value="all">Все отделы</option>
                  {overview.departments.map((department) => (
                    <option key={department.id} value={department.id}>{department.name}</option>
                  ))}
                </select>
              </label>
              <button
                onClick={() => openPositionModal(null)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-bold transition-colors"
              >
                <Plus className="w-4 h-4" />
                Должность
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-muted-foreground">
                  <th className="p-4 font-bold uppercase tracking-wider min-w-[220px]">Должность</th>
                  <th className="p-4 font-bold uppercase tracking-wider">Доступные разделы</th>
                  <th className="p-4 font-bold uppercase tracking-wider text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredMatrixRows.map((row) => {
                  const position = positionsById.get(row.position_id);
                  return (
                    <tr key={row.position_id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-4 align-top">
                        <div className="font-bold text-foreground">{row.position_name}</div>
                        <div className="text-[10px] text-muted-foreground mt-1">{row.department_name || 'Отдел не указан'}</div>
                        <div className="text-[10px] text-muted-foreground mt-1">Уровень: {row.hierarchy_level}</div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1.5">
                          {row.sections.length === 0 ? (
                            <span className="text-muted-foreground">Нет разделов</span>
                          ) : (
                            row.sections.map((section) => (
                              <span
                                key={`${row.position_id}-${section.id}`}
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-semibold ${
                                  section.visibility_scope === 'public'
                                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                                    : 'border-border bg-muted text-muted-foreground'
                                }`}
                                title={section.space_name || ''}
                              >
                                <Eye className="w-3 h-3" />
                                {section.name}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="p-4 align-top">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => position && openPositionModal(position)}
                            disabled={!position}
                            className="p-2 rounded-lg border border-border text-muted-foreground hover:text-indigo-500 hover:bg-muted disabled:opacity-50 transition-colors"
                            title="Редактировать должность"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => position && handleDeletePosition(position)}
                            disabled={!position || isSavingPosition}
                            className="p-2 rounded-lg border border-border text-muted-foreground hover:text-red-500 hover:bg-muted disabled:opacity-50 transition-colors"
                            title="Удалить должность"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredMatrixRows.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-xs text-muted-foreground">
                      Для выбранного отдела должности не найдены.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4">
          <div className="border border-border bg-card text-card-foreground rounded-lg overflow-hidden">
            <div className="p-4 border-b border-border flex items-center gap-2 bg-muted/20">
              <Users className="w-4 h-4 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Поиск пользователя"
                className="w-full bg-transparent outline-none text-xs text-foreground placeholder-muted-foreground"
              />
            </div>
            <div className="max-h-[520px] overflow-y-auto divide-y divide-border">
              {filteredUsers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => setSelectedUserId(user.id)}
                  className={`w-full text-left p-4 transition-colors ${
                    selectedUserId === user.id ? 'bg-indigo-500/10' : 'hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-bold text-sm text-foreground">{user.name}</div>
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {user.username} · {user.position_name || user.role}
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1 max-w-[180px]">
                      {user.wiki_roles.length === 0 ? (
                        <span className="text-[10px] text-muted-foreground">Без Wiki-роли</span>
                      ) : (
                        user.wiki_roles.map((role) => (
                          <span key={role.id} className={`text-[9px] px-1.5 py-0.5 rounded border font-bold ${roleTone(role.code)}`}>
                            {role.name}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="border border-border bg-card text-card-foreground rounded-lg p-4 h-fit">
            <div className="flex items-center gap-2 mb-4">
              <KeyRound className="w-4 h-4 text-indigo-500" />
              <h3 className="font-bold text-sm text-foreground">Wiki-роли</h3>
            </div>

            {selectedUser ? (
              <>
                <div className="p-3 rounded-lg bg-muted/40 border border-border mb-4">
                  <div className="font-bold text-sm text-foreground">{selectedUser.name}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {selectedUser.department_name || 'Отдел не указан'} · {selectedUser.position_name || selectedUser.role}
                  </div>
                </div>

                <div className="space-y-2">
                  {overview.roles.map((role) => {
                    const isEnabled = pendingRoleIds.includes(role.id);
                    return (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => handleToggleRole(role.id)}
                        className={`w-full flex items-center justify-between gap-4 p-3 rounded-lg border text-left transition-colors ${
                          isEnabled
                            ? 'border-indigo-500/30 bg-indigo-500/10'
                            : 'border-border hover:bg-muted/40'
                        }`}
                      >
                        <span>
                          <span className="block text-xs font-bold text-foreground">{role.name}</span>
                          <span className="block text-[10px] text-muted-foreground mt-0.5">{role.description}</span>
                        </span>
                        <span
                          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors ${
                            isEnabled
                              ? 'border-indigo-500 bg-indigo-600'
                              : 'border-border bg-muted'
                          }`}
                          aria-hidden="true"
                        >
                          <span
                            className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                              isEnabled ? 'translate-x-5' : 'translate-x-1'
                            }`}
                          />
                        </span>
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={handleSaveRoles}
                  disabled={isSavingRoles}
                  className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-bold disabled:opacity-60 transition-colors"
                >
                  {isSavingRoles ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Сохранить роли
                </button>
              </>
            ) : (
              <div className="text-xs text-muted-foreground">Выберите пользователя.</div>
            )}
          </div>
        </div>
      )}

      {positionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/65">
          <form onSubmit={handleSavePosition} className="w-full max-w-lg rounded-xl border border-border bg-card text-card-foreground p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div>
                <h3 className="text-lg font-extrabold text-foreground">
                  {positionModal.position ? 'Редактировать должность' : 'Добавить должность'}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">Должность создаётся для конкретного отдела.</p>
              </div>
              <button type="button" onClick={() => setPositionModal(null)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">Название должности</span>
                <input
                  value={positionForm.name}
                  onChange={(event) => setPositionForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-border bg-muted text-foreground px-3 py-2 text-sm outline-none focus:border-indigo-500"
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">Отдел</span>
                  <select
                    value={positionForm.departmentId}
                    onChange={(event) => setPositionForm((prev) => ({
                      ...prev,
                      departmentId: event.target.value,
                      parentPositionId: '',
                    }))}
                    className="mt-1 w-full rounded-lg border border-border bg-muted text-foreground px-3 py-2 text-sm outline-none focus:border-indigo-500"
                  >
                    {overview.departments.map((department) => (
                      <option key={department.id} value={department.id}>{department.name}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">Подчиняется</span>
                  <select
                    value={positionForm.parentPositionId}
                    onChange={(event) => setPositionForm((prev) => ({ ...prev, parentPositionId: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-border bg-muted text-foreground px-3 py-2 text-sm outline-none focus:border-indigo-500"
                  >
                    <option value="">Нет</option>
                    {overview.positions
                      .filter((position) => (
                        position.id !== positionModal.position?.id &&
                        (!positionForm.departmentId || position.department_id === Number(positionForm.departmentId))
                      ))
                      .map((position) => (
                        <option key={position.id} value={position.id}>{position.name}</option>
                      ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">Уровень</span>
                  <input
                    type="number"
                    min={1}
                    value={positionForm.hierarchyLevel}
                    onChange={(event) => setPositionForm((prev) => ({ ...prev, hierarchyLevel: Number(event.target.value) }))}
                    className="mt-1 w-full rounded-lg border border-border bg-muted text-foreground px-3 py-2 text-sm outline-none focus:border-indigo-500"
                  />
                </label>

                <label className="block">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">Статус</span>
                  <select
                    value={positionForm.status}
                    onChange={(event) => setPositionForm((prev) => ({ ...prev, status: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-border bg-muted text-foreground px-3 py-2 text-sm outline-none focus:border-indigo-500"
                  >
                    <option value="Active">Активна</option>
                    <option value="Inactive">Неактивна</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button type="button" onClick={() => setPositionModal(null)} className="px-4 py-2 rounded-lg border border-border hover:bg-muted text-xs font-bold">
                Отмена
              </button>
              <button disabled={isSavingPosition} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-bold disabled:opacity-60">
                {isSavingPosition && <Loader2 className="w-4 h-4 animate-spin" />}
                Сохранить
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
