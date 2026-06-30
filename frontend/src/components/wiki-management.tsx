import * as React from 'react';
import { 
  FolderOpen, 
  Layers, 
  Plus, 
  Edit3, 
  Trash2, 
  X, 
  UserCheck 
} from 'lucide-react';
import { 
  fetchSpaces, 
  createSpace, 
  updateSpace, 
  deleteSpace, 
  fetchSections, 
  createSection, 
  updateSection, 
  deleteSection, 
  fetchDepartments, 
  fetchPositions, 
  adminFetchUsers,
  Space, 
  Section, 
  Department, 
  Position, 
  User 
} from '../lib/api';
import { ModalPortal } from './modal-portal';

export default function WikiManagement() {
  const [activeSubTab, setActiveSubTab] = React.useState<'spaces' | 'sections'>('spaces');
  const [isLoading, setIsLoading] = React.useState(true);

  // Lists State
  const [spaces, setSpaces] = React.useState<Space[]>([]);
  const [sections, setSections] = React.useState<Section[]>([]);
  const [departments, setDepartments] = React.useState<Department[]>([]);
  const [positions, setPositions] = React.useState<Position[]>([]);
  const [users, setUsers] = React.useState<User[]>([]);

  // Modals Open State
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editId, setEditId] = React.useState<number | null>(null);

  // Form Fields State
  // Space form
  const [spaceName, setSpaceName] = React.useState('');
  const [spaceDesc, setSpaceDesc] = React.useState('');
  const [spaceDeptId, setSpaceDeptId] = React.useState<number | null>(null);
  const [spaceStatus, setSpaceStatus] = React.useState('Active');

  // Section form
  const [secName, setSecName] = React.useState('');
  const [secDesc, setSecDesc] = React.useState('');
  const [secSpaceId, setSecSpaceId] = React.useState<number>(0);
  const [secPosId, setSecPosId] = React.useState<number | null>(null);
  const [secParentId, setSecParentId] = React.useState<number | null>(null);
  const [secStatus, setSecStatus] = React.useState('Active');
  const [secOwnerId, setSecOwnerId] = React.useState<number | null>(null);

  const [formError, setFormError] = React.useState<string | null>(null);

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [spacesData, sectionsData, deptsData, posData, usersData] = await Promise.all([
        fetchSpaces(),
        fetchSections(),
        fetchDepartments(),
        fetchPositions(),
        adminFetchUsers()
      ]);
      setSpaces(spacesData);
      setSections(sectionsData);
      setDepartments(deptsData);
      setPositions(posData);
      setUsers(usersData);
    } catch (err) {
      console.error('Failed to load wiki data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadAllData();
  }, []);

  const handleOpenCreate = () => {
    setEditId(null);
    setFormError(null);

    // Reset Space
    setSpaceName('');
    setSpaceDesc('');
    setSpaceDeptId(null);
    setSpaceStatus('Active');

    // Reset Section
    setSecName('');
    setSecDesc('');
    setSecSpaceId(spaces[0]?.id || 0);
    setSecPosId(null);
    setSecParentId(null);
    setSecStatus('Active');
    setSecOwnerId(null);

    setIsModalOpen(true);
  };

  const handleOpenEdit = (type: 'spaces' | 'sections', item: any) => {
    setEditId(item.id);
    setFormError(null);

    if (type === 'spaces') {
      const sp = item as Space;
      setSpaceName(sp.name);
      setSpaceDesc(sp.description || '');
      setSpaceDeptId(sp.department_id);
      setSpaceStatus(sp.status || 'Active');
    } else if (type === 'sections') {
      const s = item as Section;
      setSecName(s.name);
      setSecDesc(s.description || '');
      setSecSpaceId(s.space_id || 0);
      setSecPosId(s.position_id || null);
      setSecParentId(s.parent_section_id || null);
      setSecStatus(s.status || 'Active');
      setSecOwnerId(s.owner_id || null);
    }

    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    try {
      if (activeSubTab === 'spaces') {
        if (!spaceName.trim()) throw new Error('Название пространства обязательно.');
        const data = {
          name: spaceName.trim(),
          description: spaceDesc.trim() || '',
          department_id: spaceDeptId,
          status: spaceStatus
        };

        if (editId) {
          await updateSpace(editId, data);
        } else {
          await createSpace(data);
        }
      } else if (activeSubTab === 'sections') {
        if (!secName.trim() || !secSpaceId) throw new Error('Название раздела и пространство обязательны.');
        const data = {
          name: secName.trim(),
          description: secDesc.trim() || '',
          space_id: secSpaceId,
          position_id: secPosId,
          parent_section_id: secParentId,
          status: secStatus,
          owner_id: secOwnerId
        };

        if (editId) {
          await updateSection(editId, data);
        } else {
          await createSection(data);
        }
      }

      setIsModalOpen(false);
      await loadAllData();
    } catch (err: any) {
      setFormError(err.message || 'Ошибка сохранения.');
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`Вы действительно хотите удалить "${name}"? Все привязанные статьи останутся в системе, но потеряют привязку к этому разделу.`)) {
      return;
    }

    try {
      if (activeSubTab === 'spaces') {
        await deleteSpace(id);
      } else if (activeSubTab === 'sections') {
        await deleteSection(id);
      }
      await loadAllData();
    } catch (err: any) {
      alert(`Ошибка удаления: ${err.message}`);
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Sub-tabs switcher */}
        <div className="flex bg-neutral-100 dark:bg-neutral-900 p-1 rounded-lg gap-1 select-none w-fit">
          <button
            onClick={() => setActiveSubTab('spaces')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
              activeSubTab === 'spaces'
                ? 'bg-white dark:bg-neutral-800 text-neutral-950 dark:text-white shadow-sm'
                : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            Пространства ({spaces.length})
          </button>
          <button
            onClick={() => setActiveSubTab('sections')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
              activeSubTab === 'sections'
                ? 'bg-white dark:bg-neutral-800 text-neutral-950 dark:text-white shadow-sm'
                : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Разделы ({sections.length})
          </button>
        </div>

        {/* Action Buttons */}
        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 transition-all cursor-pointer w-fit"
        >
          <Plus className="w-4 h-4" />
          Добавить
        </button>
      </div>

      {/* Grid lists */}
      <div className="border border-neutral-200/50 dark:border-neutral-800/80 bg-white dark:bg-neutral-950 rounded-xl overflow-hidden shadow-premium">
        <div className="overflow-x-auto">
          {activeSubTab === 'spaces' && (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-neutral-50 dark:bg-neutral-950 text-neutral-400 dark:text-neutral-500 font-semibold text-xs border-b border-neutral-200 dark:border-neutral-800 select-none">
                  <th className="p-4">Название пространства</th>
                  <th className="p-4">Описание</th>
                  <th className="p-4">Привязанный отдел</th>
                  <th className="p-4">Статус</th>
                  <th className="p-4 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200/50 dark:divide-neutral-800/80 text-xs">
                {spaces.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-neutral-400 dark:text-neutral-600 select-none">
                      Пространства отсутствуют.
                    </td>
                  </tr>
                ) : (
                  spaces.map(sp => {
                    const dept = departments.find(x => x.id === sp.department_id);
                    return (
                      <tr key={sp.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/20 transition-colors">
                        <td className="p-4 font-bold text-neutral-900 dark:text-neutral-100">{sp.name}</td>
                        <td className="p-4 text-neutral-500 font-light truncate max-w-xs">{sp.description || '-'}</td>
                        <td className="p-4 text-neutral-600 dark:text-neutral-400">{dept ? dept.name : '-'}</td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-semibold border ${
                            sp.status === 'Active' 
                              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                              : 'bg-neutral-500/10 text-neutral-500 border-neutral-500/20'
                          }`}>
                            {sp.status === 'Active' ? 'Активно' : 'Неактивно'}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEdit('spaces', sp)}
                              className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors cursor-pointer"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(sp.id, sp.name)}
                              className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors cursor-pointer"
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
          )}

          {activeSubTab === 'sections' && (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-neutral-50 dark:bg-neutral-950 text-neutral-400 dark:text-neutral-500 font-semibold text-xs border-b border-neutral-200 dark:border-neutral-800 select-none">
                  <th className="p-4">Название раздела</th>
                  <th className="p-4">Пространство</th>
                  <th className="p-4">Должность</th>
                  <th className="p-4">Владелец процесса</th>
                  <th className="p-4">Родительский раздел</th>
                  <th className="p-4">Статус</th>
                  <th className="p-4 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200/50 dark:divide-neutral-800/80 text-xs">
                {sections.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-neutral-400 dark:text-neutral-600 select-none">
                      Разделы отсутствуют.
                    </td>
                  </tr>
                ) : (
                  sections.map(s => {
                    const space = spaces.find(x => x.id === s.space_id);
                    const pos = positions.find(x => x.id === s.position_id);
                    const parent = sections.find(x => x.id === s.parent_section_id);
                    const owner = users.find(x => x.id === s.owner_id);
                    return (
                      <tr key={s.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/20 transition-colors">
                        <td className="p-4 font-bold text-neutral-900 dark:text-neutral-100">{s.name}</td>
                        <td className="p-4 text-neutral-600 dark:text-neutral-400">{space ? space.name : '-'}</td>
                        <td className="p-4 text-neutral-600 dark:text-neutral-400">{pos ? pos.name : '-'}</td>
                        <td className="p-4">
                          {owner ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-neutral-800 dark:text-neutral-200 font-medium">
                              <UserCheck className="w-3.5 h-3.5 text-indigo-500" />
                              {owner.name}
                            </span>
                          ) : (
                            <span className="text-neutral-400">-</span>
                          )}
                        </td>
                        <td className="p-4 text-neutral-600 dark:text-neutral-400">{parent ? parent.name : '-'}</td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-semibold border ${
                            s.status === 'Active' 
                              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                              : 'bg-red-500/10 text-red-500 border-red-500/20'
                          }`}>
                            {s.status === 'Active' ? 'Активен' : 'В архиве'}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEdit('sections', s)}
                              className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors cursor-pointer"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(s.id, s.name)}
                              className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors cursor-pointer"
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
          )}
        </div>
      </div>

      {/* Edit/Create Dialog */}
      {isModalOpen && (
        <ModalPortal>
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/65">
          <div className="w-full max-w-md bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg text-neutral-900 dark:text-white">
                {editId ? 'Редактировать' : 'Добавить'} {
                  activeSubTab === 'spaces' ? 'пространство' : 'раздел'
                }
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <div className="p-3 rounded-lg border border-red-500/10 bg-red-500/5 text-red-600 dark:text-red-400 text-xs">
                  {formError}
                </div>
              )}

              {activeSubTab === 'spaces' && (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Название пространства</label>
                    <input
                      type="text"
                      required
                      placeholder="IT-отдел"
                      value={spaceName}
                      onChange={(e) => setSpaceName(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-900 dark:text-white outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Описание</label>
                    <textarea
                      placeholder="Описание пространства..."
                      value={spaceDesc}
                      onChange={(e) => setSpaceDesc(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-900 dark:text-white outline-none focus:border-indigo-500 h-20 resize-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Отдел (Department)</label>
                    <select
                      value={spaceDeptId || ''}
                      onChange={(e) => setSpaceDeptId(Number(e.target.value) || null)}
                      className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-700 dark:text-neutral-300 outline-none focus:border-indigo-500"
                    >
                      <option value="">Без отдела</option>
                      {departments.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Статус</label>
                    <select
                      value={spaceStatus}
                      onChange={(e) => setSpaceStatus(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-700 dark:text-neutral-300 outline-none focus:border-indigo-500"
                    >
                      <option value="Active">Active (Активно)</option>
                      <option value="Inactive">Inactive (Неактивно)</option>
                    </select>
                  </div>
                </>
              )}

              {activeSubTab === 'sections' && (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Название раздела</label>
                    <input
                      type="text"
                      required
                      placeholder="Системный администратор"
                      value={secName}
                      onChange={(e) => setSecName(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-900 dark:text-white outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Описание</label>
                    <textarea
                      placeholder="Описание раздела..."
                      value={secDesc}
                      onChange={(e) => setSecDesc(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-900 dark:text-white outline-none focus:border-indigo-500 h-16 resize-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Пространство (Space)</label>
                    <select
                      required
                      value={secSpaceId}
                      onChange={(e) => setSecSpaceId(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-700 dark:text-neutral-300 outline-none focus:border-indigo-500"
                    >
                      {spaces.map(sp => (
                        <option key={sp.id} value={sp.id}>{sp.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Связанная должность (Position)</label>
                    <select
                      value={secPosId || ''}
                      onChange={(e) => setSecPosId(Number(e.target.value) || null)}
                      className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-700 dark:text-neutral-300 outline-none focus:border-indigo-500"
                    >
                      <option value="">Без должности</option>
                      {positions.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Родительский раздел</label>
                    <select
                      value={secParentId || ''}
                      onChange={(e) => setSecParentId(Number(e.target.value) || null)}
                      className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-700 dark:text-neutral-300 outline-none focus:border-indigo-500"
                    >
                      <option value="">Нет (Корневой)</option>
                      {sections.filter(s => s.id !== editId).map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Владелец процесса (Process Owner)</label>
                    <select
                      value={secOwnerId || ''}
                      onChange={(e) => setSecOwnerId(Number(e.target.value) || null)}
                      className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-700 dark:text-neutral-300 outline-none focus:border-indigo-500"
                    >
                      <option value="">Нет</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Статус</label>
                    <select
                      value={secStatus}
                      onChange={(e) => setSecStatus(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-700 dark:text-neutral-300 outline-none focus:border-indigo-500"
                    >
                      <option value="Active">Active (Активен)</option>
                      <option value="Archived">Archived (В архиве)</option>
                    </select>
                  </div>
                </>
              )}

              <button
                type="submit"
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/25 transition-all mt-4 cursor-pointer"
              >
                Сохранить
              </button>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
}
