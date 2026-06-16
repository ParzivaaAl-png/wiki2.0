import * as React from 'react';
import { 
  Building2, 
  Briefcase, 
  Users, 
  Plus, 
  Edit3, 
  Trash2, 
  RefreshCw, 
  X, 
  Check, 
  UserCheck 
} from 'lucide-react';
import { 
  fetchDepartments, 
  createDepartment, 
  updateDepartment, 
  deleteDepartment, 
  fetchPositions, 
  createPosition, 
  updatePosition, 
  deletePosition, 
  fetchEmployees, 
  createEmployee, 
  updateEmployee, 
  deleteEmployee, 
  triggerOrgStructureSync,
  Department, 
  Position, 
  Employee 
} from '../lib/api';

export default function OrgManagement() {
  const [activeSubTab, setActiveSubTab] = React.useState<'departments' | 'positions' | 'employees'>('departments');
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSyncing, setIsSyncing] = React.useState(false);

  // Lists State
  const [departments, setDepartments] = React.useState<Department[]>([]);
  const [positions, setPositions] = React.useState<Position[]>([]);
  const [employees, setEmployees] = React.useState<Employee[]>([]);

  // Modals Open State
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editId, setEditId] = React.useState<number | null>(null);

  // Form Fields State
  // Department form
  const [deptName, setDeptName] = React.useState('');
  const [deptDesc, setDeptDesc] = React.useState('');
  const [deptParentId, setDeptParentId] = React.useState<number | null>(null);
  const [deptStatus, setDeptStatus] = React.useState('Active');

  // Position form
  const [posName, setPosName] = React.useState('');
  const [posDeptId, setPosDeptId] = React.useState<number>(0);
  const [posParentId, setPosParentId] = React.useState<number | null>(null);
  const [posLevel, setPosLevel] = React.useState(1);
  const [posStatus, setPosStatus] = React.useState('Active');

  // Employee form
  const [empName, setEmpName] = React.useState('');
  const [empEmail, setEmpEmail] = React.useState('');
  const [empDeptId, setEmpDeptId] = React.useState<number | null>(null);
  const [empPosId, setEmpPosId] = React.useState<number | null>(null);
  const [empManagerId, setEmpManagerId] = React.useState<number | null>(null);
  const [empActive, setEmpActive] = React.useState(true);

  const [formError, setFormError] = React.useState<string | null>(null);

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [deptsData, posData, empData] = await Promise.all([
        fetchDepartments(),
        fetchPositions(),
        fetchEmployees()
      ]);
      setDepartments(deptsData);
      setPositions(posData);
      setEmployees(empData);
    } catch (err) {
      console.error('Failed to load org data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadAllData();
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await triggerOrgStructureSync();
      alert(`Синхронизация успешна!\nСоздано пространств: ${res.details.spacesSynced}\nСоздано разделов: ${res.details.sectionsSynced}`);
      await loadAllData();
    } catch (err: any) {
      alert(`Синхронизация не удалась: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Open forms for create/edit
  const handleOpenCreate = () => {
    setEditId(null);
    setFormError(null);
    
    // Reset fields
    setDeptName('');
    setDeptDesc('');
    setDeptParentId(null);
    setDeptStatus('Active');

    setPosName('');
    setPosDeptId(departments[0]?.id || 0);
    setPosParentId(null);
    setPosLevel(1);
    setPosStatus('Active');

    setEmpName('');
    setEmpEmail('');
    setEmpDeptId(departments[0]?.id || null);
    setEmpPosId(positions[0]?.id || null);
    setEmpManagerId(null);
    setEmpActive(true);

    setIsModalOpen(true);
  };

  const handleOpenEdit = (type: 'departments' | 'positions' | 'employees', item: any) => {
    setEditId(item.id);
    setFormError(null);

    if (type === 'departments') {
      const d = item as Department;
      setDeptName(d.name);
      setDeptDesc(d.description || '');
      setDeptParentId(d.parent_department_id);
      setDeptStatus(d.status);
    } else if (type === 'positions') {
      const p = item as Position;
      setPosName(p.name);
      setPosDeptId(p.department_id);
      setPosParentId(p.parent_position_id);
      setPosLevel(p.hierarchy_level);
      setPosStatus(p.status);
    } else if (type === 'employees') {
      const e = item as Employee;
      setEmpName(e.full_name);
      setEmpEmail(e.email);
      setEmpDeptId(e.department_id);
      setEmpPosId(e.position_id);
      setEmpManagerId(e.manager_id);
      setEmpActive(e.is_active);
    }

    setIsModalOpen(true);
  };

  // Submit forms
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    try {
      if (activeSubTab === 'departments') {
        if (!deptName.trim()) throw new Error('Название отдела обязательно.');
        const data = {
          name: deptName.trim(),
          description: deptDesc.trim() || null,
          parent_department_id: deptParentId,
          status: deptStatus
        };

        if (editId) {
          await updateDepartment(editId, data);
        } else {
          await createDepartment(data);
        }
      } else if (activeSubTab === 'positions') {
        if (!posName.trim() || !posDeptId) throw new Error('Название должности и отдел обязательны.');
        const data = {
          name: posName.trim(),
          department_id: posDeptId,
          parent_position_id: posParentId,
          hierarchy_level: posLevel,
          status: posStatus
        };

        if (editId) {
          await updatePosition(editId, data);
        } else {
          await createPosition(data);
        }
      } else if (activeSubTab === 'employees') {
        if (!empName.trim() || !empEmail.trim()) throw new Error('ФИО и Email обязательны.');
        const data = {
          full_name: empName.trim(),
          email: empEmail.trim(),
          department_id: empDeptId,
          position_id: empPosId,
          manager_id: empManagerId,
          is_active: empActive
        };

        if (editId) {
          await updateEmployee(editId, data);
        } else {
          await createEmployee(data);
        }
      }

      setIsModalOpen(false);
      await loadAllData();
    } catch (err: any) {
      setFormError(err.message || 'Ошибка сохранения.');
    }
  };

  // Delete handlers
  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`Вы уверены, что хотите удалить "${name}"? Это действие может повлиять на связанные записи.`)) {
      return;
    }

    try {
      if (activeSubTab === 'departments') {
        await deleteDepartment(id);
      } else if (activeSubTab === 'positions') {
        await deletePosition(id);
      } else if (activeSubTab === 'employees') {
        await deleteEmployee(id);
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
            onClick={() => setActiveSubTab('departments')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
              activeSubTab === 'departments'
                ? 'bg-white dark:bg-neutral-800 text-neutral-950 dark:text-white shadow-sm'
                : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            Подразделения ({departments.length})
          </button>
          <button
            onClick={() => setActiveSubTab('positions')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
              activeSubTab === 'positions'
                ? 'bg-white dark:bg-neutral-800 text-neutral-950 dark:text-white shadow-sm'
                : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            Должности ({positions.length})
          </button>
          <button
            onClick={() => setActiveSubTab('employees')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
              activeSubTab === 'employees'
                ? 'bg-white dark:bg-neutral-800 text-neutral-950 dark:text-white shadow-sm'
                : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Сотрудники ({employees.length})
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            disabled={isSyncing}
            onClick={handleSync}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-lg text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            Синхронизировать
          </button>

          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Добавить
          </button>
        </div>
      </div>

      {/* Grid lists */}
      <div className="border border-neutral-200/50 dark:border-neutral-800/80 bg-white dark:bg-neutral-950 rounded-xl overflow-hidden shadow-premium">
        <div className="overflow-x-auto">
          {activeSubTab === 'departments' && (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-neutral-50 dark:bg-neutral-950 text-neutral-400 dark:text-neutral-500 font-semibold text-xs border-b border-neutral-200 dark:border-neutral-800 select-none">
                  <th className="p-4">Название подразделения</th>
                  <th className="p-4">Описание</th>
                  <th className="p-4">Родительский отдел</th>
                  <th className="p-4">Статус</th>
                  <th className="p-4 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200/50 dark:divide-neutral-800/80 text-xs">
                {departments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-neutral-400 dark:text-neutral-600 select-none">
                      Подразделения отсутствуют.
                    </td>
                  </tr>
                ) : (
                  departments.map(d => {
                    const parent = departments.find(x => x.id === d.parent_department_id);
                    return (
                      <tr key={d.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/20 transition-colors">
                        <td className="p-4 font-bold text-neutral-900 dark:text-neutral-100">{d.name}</td>
                        <td className="p-4 text-neutral-500 font-light truncate max-w-xs">{d.description || '-'}</td>
                        <td className="p-4 text-neutral-600 dark:text-neutral-400">{parent ? parent.name : '-'}</td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-semibold border ${
                            d.status === 'Active' 
                              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                              : 'bg-neutral-500/10 text-neutral-500 border-neutral-500/20'
                          }`}>
                            {d.status === 'Active' ? 'Активен' : 'Неактивен'}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEdit('departments', d)}
                              className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors cursor-pointer"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(d.id, d.name)}
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

          {activeSubTab === 'positions' && (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-neutral-50 dark:bg-neutral-950 text-neutral-400 dark:text-neutral-500 font-semibold text-xs border-b border-neutral-200 dark:border-neutral-800 select-none">
                  <th className="p-4">Название должности</th>
                  <th className="p-4">Подразделение</th>
                  <th className="p-4">Подчиняется</th>
                  <th className="p-4">Уровень</th>
                  <th className="p-4">Статус</th>
                  <th className="p-4 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200/50 dark:divide-neutral-800/80 text-xs">
                {positions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-neutral-400 dark:text-neutral-600 select-none">
                      Должности отсутствуют.
                    </td>
                  </tr>
                ) : (
                  positions.map(p => {
                    const dept = departments.find(x => x.id === p.department_id);
                    const manager = positions.find(x => x.id === p.parent_position_id);
                    return (
                      <tr key={p.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/20 transition-colors">
                        <td className="p-4 font-bold text-neutral-900 dark:text-neutral-100">{p.name}</td>
                        <td className="p-4 text-neutral-600 dark:text-neutral-400">{dept ? dept.name : '-'}</td>
                        <td className="p-4 text-neutral-600 dark:text-neutral-400">{manager ? manager.name : '-'}</td>
                        <td className="p-4 text-neutral-500 font-light">{p.hierarchy_level}</td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-semibold border ${
                            p.status === 'Active' 
                              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                              : 'bg-neutral-500/10 text-neutral-500 border-neutral-500/20'
                          }`}>
                            {p.status === 'Active' ? 'Активна' : 'Неактивна'}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEdit('positions', p)}
                              className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors cursor-pointer"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(p.id, p.name)}
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

          {activeSubTab === 'employees' && (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-neutral-50 dark:bg-neutral-950 text-neutral-400 dark:text-neutral-500 font-semibold text-xs border-b border-neutral-200 dark:border-neutral-800 select-none">
                  <th className="p-4">Сотрудник</th>
                  <th className="p-4">Email</th>
                  <th className="p-4">Должность</th>
                  <th className="p-4">Руководитель</th>
                  <th className="p-4">Статус</th>
                  <th className="p-4 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200/50 dark:divide-neutral-800/80 text-xs">
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-neutral-400 dark:text-neutral-600 select-none">
                      Сотрудники отсутствуют.
                    </td>
                  </tr>
                ) : (
                  employees.map(e => {
                    const dept = departments.find(x => x.id === e.department_id);
                    const pos = positions.find(x => x.id === e.position_id);
                    const manager = employees.find(x => x.id === e.manager_id);
                    return (
                      <tr key={e.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/20 transition-colors">
                        <td className="p-4 font-bold text-neutral-900 dark:text-neutral-100">{e.full_name}</td>
                        <td className="p-4 text-neutral-500 font-light">{e.email}</td>
                        <td className="p-4 text-neutral-600 dark:text-neutral-400">
                          {pos ? pos.name : '-'}
                          {dept && <span className="block text-[10px] text-neutral-400 font-light mt-0.5">{dept.name}</span>}
                        </td>
                        <td className="p-4 text-neutral-600 dark:text-neutral-400">{manager ? manager.full_name : '-'}</td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-semibold border ${
                            e.is_active 
                              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                              : 'bg-neutral-500/10 text-neutral-500 border-neutral-500/20'
                          }`}>
                            {e.is_active ? 'Активен' : 'Неактивен'}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEdit('employees', e)}
                              className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors cursor-pointer"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(e.id, e.full_name)}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-neutral-900/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg text-neutral-900 dark:text-white">
                {editId ? 'Редактировать' : 'Добавить'} {
                  activeSubTab === 'departments' ? 'подразделение' : 
                  activeSubTab === 'positions' ? 'должность' : 'сотрудника'
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

              {activeSubTab === 'departments' && (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Название</label>
                    <input
                      type="text"
                      required
                      placeholder="Коммерческий отдел"
                      value={deptName}
                      onChange={(e) => setDeptName(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-900 dark:text-white outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Описание</label>
                    <textarea
                      placeholder="Описание отдела..."
                      value={deptDesc}
                      onChange={(e) => setDeptDesc(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-900 dark:text-white outline-none focus:border-indigo-500 h-20 resize-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Родительский отдел</label>
                    <select
                      value={deptParentId || ''}
                      onChange={(e) => setDeptParentId(Number(e.target.value) || null)}
                      className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-700 dark:text-neutral-300 outline-none focus:border-indigo-500"
                    >
                      <option value="">Нет (Корневой)</option>
                      {departments.filter(d => d.id !== editId).map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Статус</label>
                    <select
                      value={deptStatus}
                      onChange={(e) => setDeptStatus(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-700 dark:text-neutral-300 outline-none focus:border-indigo-500"
                    >
                      <option value="Active">Active (Активен)</option>
                      <option value="Inactive">Inactive (Неактивен)</option>
                    </select>
                  </div>
                </>
              )}

              {activeSubTab === 'positions' && (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Название</label>
                    <input
                      type="text"
                      required
                      placeholder="Руководитель группы"
                      value={posName}
                      onChange={(e) => setPosName(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-900 dark:text-white outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Подразделение (Отдел)</label>
                    <select
                      required
                      value={posDeptId}
                      onChange={(e) => setPosDeptId(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-700 dark:text-neutral-300 outline-none focus:border-indigo-500"
                    >
                      {departments.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Руководящая должность</label>
                    <select
                      value={posParentId || ''}
                      onChange={(e) => setPosParentId(Number(e.target.value) || null)}
                      className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-700 dark:text-neutral-300 outline-none focus:border-indigo-500"
                    >
                      <option value="">Нет (Высшая)</option>
                      {positions.filter(p => p.id !== editId).map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Уровень иерархии (Hierarchy Level)</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={posLevel}
                      onChange={(e) => setPosLevel(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-900 dark:text-white outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Статус</label>
                    <select
                      value={posStatus}
                      onChange={(e) => setPosStatus(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-700 dark:text-neutral-300 outline-none focus:border-indigo-500"
                    >
                      <option value="Active">Active (Активна)</option>
                      <option value="Inactive">Inactive (Неактивна)</option>
                    </select>
                  </div>
                </>
              )}

              {activeSubTab === 'employees' && (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">ФИО сотрудника</label>
                    <input
                      type="text"
                      required
                      placeholder="Алексей Смирнов"
                      value={empName}
                      onChange={(e) => setEmpName(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-900 dark:text-white outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Email (Служебный)</label>
                    <input
                      type="email"
                      required
                      placeholder="alex@icore.ru"
                      value={empEmail}
                      onChange={(e) => setEmpEmail(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-900 dark:text-white outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Отдел (Подразделение)</label>
                    <select
                      value={empDeptId || ''}
                      onChange={(e) => setEmpDeptId(Number(e.target.value) || null)}
                      className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-700 dark:text-neutral-300 outline-none focus:border-indigo-500"
                    >
                      <option value="">Без отдела</option>
                      {departments.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Должность</label>
                    <select
                      value={empPosId || ''}
                      onChange={(e) => setEmpPosId(Number(e.target.value) || null)}
                      className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-700 dark:text-neutral-300 outline-none focus:border-indigo-500"
                    >
                      <option value="">Без должности</option>
                      {positions.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Руководитель (Сотрудник)</label>
                    <select
                      value={empManagerId || ''}
                      onChange={(e) => setEmpManagerId(Number(e.target.value) || null)}
                      className="w-full px-3 py-2 text-xs bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-700 dark:text-neutral-300 outline-none focus:border-indigo-500"
                    >
                      <option value="">Нет</option>
                      {employees.filter(emp => emp.id !== editId).map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="empActive"
                      checked={empActive}
                      onChange={(e) => setEmpActive(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 border-neutral-300 dark:border-neutral-800 w-4 h-4"
                    />
                    <label htmlFor="empActive" className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 select-none cursor-pointer">
                      Сотрудник активен (Is Active)
                    </label>
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
      )}
    </div>
  );
}
