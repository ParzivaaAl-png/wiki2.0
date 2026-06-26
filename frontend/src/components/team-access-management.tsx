import * as React from 'react';
import {
  Briefcase,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleOff,
  Edit3,
  KeyRound,
  Loader2,
  Network,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import {
  AccessOverview,
  Department,
  Employee,
  Position,
  User,
  adminChangeRole,
  adminCreateUser,
  adminDeleteUser,
  adminFetchUsers,
  adminToggleBlock,
  adminUpdateUser,
  createDepartment,
  createEmployee,
  createPosition,
  deleteEmployee,
  deletePosition,
  fetchAccessOverview,
  fetchDepartments,
  fetchEmployees,
  fetchGuestAccessList,
  fetchPositions,
  updateDepartment,
  updateEmployee,
  updatePosition,
} from '../lib/api';
import AccessManagement from './access-management';
import GuestManagement from './guest-management';
import SessionManagement from './session-management';
import { useAuth } from '../lib/auth-context';

type TeamTab = 'org' | 'access' | 'sessions' | 'guest';

type EmployeeModalState = {
  employee: Employee | null;
  defaultDepartmentId: number | null;
};

type DepartmentModalState = {
  department: Department | null;
};

type PositionModalState = {
  position: Position | null;
  defaultDepartmentId: number | null;
};

const tabs: Array<{ id: TeamTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'org', label: 'Оргструктура', icon: Network },
  { id: 'access', label: 'Wiki-роли и доступ', icon: ShieldCheck },
  { id: 'sessions', label: 'Сессии', icon: KeyRound },
  { id: 'guest', label: 'Гостевой доступ', icon: ShieldAlert },
];

const systemRoleOptions = [
  'Оператор',
  'Супервайзер',
  'Руководитель группы',
  'Коммерческий директор',
  'HR-менеджер',
  'Бухгалтер',
  'IT-специалист',
  'Администратор Wiki',
];

const roleTone = (code: string) => {
  if (code === 'wiki_admin') return 'border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-300';
  if (code === 'process_owner') return 'border-indigo-500/25 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300';
  if (code === 'approver') return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300';
  if (code === 'editor') return 'border-sky-500/25 bg-sky-500/10 text-sky-600 dark:text-sky-300';
  return 'border-border bg-muted text-muted-foreground';
};

const readSettled = <T,>(result: PromiseSettledResult<T>, fallback: T) => (
  result.status === 'fulfilled' ? result.value : fallback
);

export default function TeamAccessManagement() {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = React.useState<TeamTab>('org');
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [departments, setDepartments] = React.useState<Department[]>([]);
  const [positions, setPositions] = React.useState<Position[]>([]);
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [users, setUsers] = React.useState<User[]>([]);
  const [accessOverview, setAccessOverview] = React.useState<AccessOverview | null>(null);
  const [guestAccessCount, setGuestAccessCount] = React.useState(0);
  const [expandedDepartmentIds, setExpandedDepartmentIds] = React.useState<Set<number | 'none'>>(new Set());
  const [searchQuery, setSearchQuery] = React.useState('');

  const [employeeModal, setEmployeeModal] = React.useState<EmployeeModalState | null>(null);
  const [departmentModal, setDepartmentModal] = React.useState<DepartmentModalState | null>(null);
  const [positionModal, setPositionModal] = React.useState<PositionModalState | null>(null);

  const [employeeForm, setEmployeeForm] = React.useState({
    fullName: '',
    email: '',
    departmentId: '',
    positionId: '',
    managerId: '',
    isActive: true,
    accountEnabled: false,
    accountId: null as number | null,
    username: '',
    password: '',
    systemRole: 'Оператор',
    isBlocked: false,
  });

  const [departmentForm, setDepartmentForm] = React.useState({
    name: '',
    description: '',
    parentDepartmentId: '',
    status: 'Active',
  });

  const [positionForm, setPositionForm] = React.useState({
    name: '',
    departmentId: '',
    parentPositionId: '',
    hierarchyLevel: 1,
    status: 'Active',
  });

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [departmentsRes, positionsRes, employeesRes, usersRes, accessRes, guestRes] = await Promise.allSettled([
        fetchDepartments(),
        fetchPositions(),
        fetchEmployees(),
        adminFetchUsers(),
        fetchAccessOverview(),
        fetchGuestAccessList(),
      ]);

      const nextDepartments = readSettled(departmentsRes, []);
      setDepartments(nextDepartments);
      setPositions(readSettled(positionsRes, []));
      setEmployees(readSettled(employeesRes, []));
      setUsers(readSettled(usersRes, []));
      setAccessOverview(readSettled(accessRes, null));
      setGuestAccessCount(readSettled(guestRes, []).length);

      setExpandedDepartmentIds((prev) => {
        if (prev.size > 0) return prev;
        return new Set(nextDepartments.slice(0, 2).map((department) => department.id));
      });
    } catch (err) {
      console.error('Failed to load team access data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const departmentsById = React.useMemo(() => new Map(departments.map((department) => [department.id, department])), [departments]);
  const positionsById = React.useMemo(() => new Map(positions.map((position) => [position.id, position])), [positions]);
  const employeesById = React.useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees]);
  const usersByEmployeeId = React.useMemo(() => {
    const map = new Map<number, User>();
    users.forEach((user) => {
      if (user.employee_id) map.set(user.employee_id, user);
    });
    return map;
  }, [users]);
  const legacyAccounts = React.useMemo(() => (
    users.filter((account) => !account.employee_id)
  ), [users]);
  const accessUsersById = React.useMemo(() => (
    new Map((accessOverview?.users || []).map((user) => [user.id, user]))
  ), [accessOverview]);

  const visibleDepartments = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return departments;

    return departments.filter((department) => {
      const departmentPositions = positions.filter((position) => position.department_id === department.id);
      const departmentEmployees = employees.filter((employee) => employee.department_id === department.id);
      return (
        department.name.toLowerCase().includes(query) ||
        (department.description || '').toLowerCase().includes(query) ||
        departmentPositions.some((position) => position.name.toLowerCase().includes(query)) ||
        departmentEmployees.some((employee) => employeeMatchesQuery(employee, query))
      );
    });
  }, [departments, employees, positions, searchQuery]);

  const unassignedEmployees = React.useMemo(() => (
    employees.filter((employee) => !employee.department_id)
  ), [employees]);

  const stats = React.useMemo(() => ({
    departments: departments.length,
    positions: positions.length,
    employees: employees.length,
    activeEmployees: employees.filter((employee) => employee.is_active).length,
    accounts: users.length,
    linkedAccounts: users.filter((user) => user.employee_id).length,
    legacyAccounts: legacyAccounts.length,
    inactiveAccounts: users.filter((user) => user.is_blocked).length,
    guestAccessCount,
  }), [departments.length, employees, guestAccessCount, legacyAccounts.length, positions.length, users]);

  function employeeMatchesQuery(employee: Employee, query: string) {
    const account = usersByEmployeeId.get(employee.id);
    const position = employee.position_id ? positionsById.get(employee.position_id) : null;
    const manager = employee.manager_id ? employeesById.get(employee.manager_id) : null;
    const accessUser = account ? accessUsersById.get(account.id) : null;

    return (
      employee.full_name.toLowerCase().includes(query) ||
      employee.email.toLowerCase().includes(query) ||
      (position?.name || '').toLowerCase().includes(query) ||
      (manager?.full_name || '').toLowerCase().includes(query) ||
      (account?.username || '').toLowerCase().includes(query) ||
      (account?.role || '').toLowerCase().includes(query) ||
      (accessUser?.wiki_roles || []).some((role) => role.name.toLowerCase().includes(query))
    );
  }

  const toggleDepartment = (id: number | 'none') => {
    setExpandedDepartmentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openEmployeeModal = (employee: Employee | null, defaultDepartmentId: number | null = null) => {
    const account = employee ? usersByEmployeeId.get(employee.id) || null : null;
    const departmentId = employee?.department_id ?? defaultDepartmentId ?? null;
    const departmentPositions = positions.filter((position) => position.department_id === departmentId);
    const positionId = employee?.position_id || departmentPositions[0]?.id || null;

    setEmployeeForm({
      fullName: employee?.full_name || '',
      email: employee?.email || '',
      departmentId: departmentId ? String(departmentId) : '',
      positionId: positionId ? String(positionId) : '',
      managerId: employee?.manager_id ? String(employee.manager_id) : '',
      isActive: employee?.is_active ?? true,
      accountEnabled: Boolean(account),
      accountId: account?.id || null,
      username: account?.username || employee?.email || '',
      password: '',
      systemRole: account?.role || 'Оператор',
      isBlocked: account?.is_blocked || false,
    });
    setEmployeeModal({ employee, defaultDepartmentId });
  };

  const openDepartmentModal = (department: Department | null) => {
    setDepartmentForm({
      name: department?.name || '',
      description: department?.description || '',
      parentDepartmentId: department?.parent_department_id ? String(department.parent_department_id) : '',
      status: department?.status || 'Active',
    });
    setDepartmentModal({ department });
  };

  const openPositionModal = (position: Position | null, defaultDepartmentId: number | null = null) => {
    setPositionForm({
      name: position?.name || '',
      departmentId: String(position?.department_id || defaultDepartmentId || departments[0]?.id || ''),
      parentPositionId: position?.parent_position_id ? String(position.parent_position_id) : '',
      hierarchyLevel: position?.hierarchy_level || 1,
      status: position?.status || 'Active',
    });
    setPositionModal({ position, defaultDepartmentId });
  };

  const openEmployeeFromLegacyAccount = (account: User) => {
    setEmployeeForm({
      fullName: account.name || account.username,
      email: account.username.includes('@') ? account.username : '',
      departmentId: '',
      positionId: '',
      managerId: '',
      isActive: !account.is_blocked,
      accountEnabled: true,
      accountId: account.id,
      username: account.username,
      password: '',
      systemRole: account.role || 'Оператор',
      isBlocked: account.is_blocked,
    });
    setEmployeeModal({ employee: null, defaultDepartmentId: null });
  };

  const handleEmployeeDepartmentChange = (departmentId: string) => {
    const nextDepartmentId = departmentId ? Number(departmentId) : null;
    const currentPosition = employeeForm.positionId ? positionsById.get(Number(employeeForm.positionId)) : null;
    const nextDepartmentPositions = positions.filter((position) => position.department_id === nextDepartmentId);
    const nextPositionId = currentPosition?.department_id === nextDepartmentId
      ? employeeForm.positionId
      : (nextDepartmentPositions[0]?.id ? String(nextDepartmentPositions[0].id) : '');

    setEmployeeForm((prev) => ({
      ...prev,
      departmentId,
      positionId: nextPositionId,
    }));
  };

  const handleSaveDepartment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!departmentForm.name.trim()) {
      alert('Название отдела обязательно.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: departmentForm.name.trim(),
        description: departmentForm.description.trim() || null,
        parent_department_id: departmentForm.parentDepartmentId ? Number(departmentForm.parentDepartmentId) : null,
        status: departmentForm.status,
      };

      if (departmentModal?.department) {
        await updateDepartment(departmentModal.department.id, payload);
      } else {
        await createDepartment(payload);
      }

      setDepartmentModal(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Не удалось сохранить отдел.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePosition = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!positionForm.name.trim() || !positionForm.departmentId) {
      alert('Название должности и отдел обязательны.');
      return;
    }

    setIsSaving(true);
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
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Не удалось сохранить должность.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePosition = async (position: Position) => {
    if (!window.confirm(`Удалить должность "${position.name}"?`)) return;

    setIsSaving(true);
    try {
      await deletePosition(position.id);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Не удалось удалить должность.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveEmployee = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!employeeForm.fullName.trim() || !employeeForm.email.trim()) {
      alert('ФИО и почта сотрудника обязательны.');
      return;
    }

    if (employeeForm.accountEnabled) {
      if (!employeeForm.departmentId) {
        alert('Аккаунт можно создать только для сотрудника, который находится внутри отдела.');
        return;
      }

      if (!employeeForm.username.trim()) {
        alert('Логин аккаунта обязателен.');
        return;
      }

      if (!employeeForm.accountId && employeeForm.password.length < 6) {
        alert('Для нового аккаунта нужен пароль минимум 6 символов.');
        return;
      }
    }

    setIsSaving(true);
    try {
      const employeePayload = {
        full_name: employeeForm.fullName.trim(),
        email: employeeForm.email.trim(),
        department_id: employeeForm.departmentId ? Number(employeeForm.departmentId) : null,
        position_id: employeeForm.positionId ? Number(employeeForm.positionId) : null,
        manager_id: employeeForm.managerId ? Number(employeeForm.managerId) : null,
        is_active: employeeForm.isActive,
      };

      const savedEmployee = employeeModal?.employee
        ? await updateEmployee(employeeModal.employee.id, employeePayload)
        : await createEmployee(employeePayload);

      const currentAccount = employeeForm.accountId
        ? users.find((user) => user.id === employeeForm.accountId) || null
        : null;

      if (employeeForm.accountEnabled) {
        const nextAccountBlockedState = employeeForm.isBlocked || !employeeForm.isActive;
        if (currentAccount) {
          await adminUpdateUser(currentAccount.id, {
            username: employeeForm.username.trim(),
            name: employeeForm.fullName.trim(),
            password: employeeForm.password || undefined,
            employee_id: savedEmployee.id,
          });

          if (currentAccount.role !== employeeForm.systemRole) {
            await adminChangeRole(currentAccount.id, employeeForm.systemRole);
          }

          if (currentAccount.is_blocked !== nextAccountBlockedState) {
            await adminToggleBlock(currentAccount.id, nextAccountBlockedState);
          }
        } else {
          const createdAccount = await adminCreateUser({
            username: employeeForm.username.trim(),
            name: employeeForm.fullName.trim(),
            password: employeeForm.password,
            role: employeeForm.systemRole,
            employee_id: savedEmployee.id,
          });
          if (nextAccountBlockedState) {
            await adminToggleBlock(createdAccount.id, true);
          }
        }
      } else if (currentAccount && !currentAccount.is_blocked) {
        await adminToggleBlock(currentAccount.id, true);
      }

      setEmployeeModal(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Не удалось сохранить сотрудника.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteEmployee = async (employee: Employee) => {
    const account = usersByEmployeeId.get(employee.id);
    const message = account
      ? `Удалить сотрудника "${employee.full_name}"? Аккаунт останется в системе без привязки к сотруднику.`
      : `Удалить сотрудника "${employee.full_name}"?`;
    if (!window.confirm(message)) return;

    setIsSaving(true);
    try {
      await deleteEmployee(employee.id);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Не удалось удалить сотрудника.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!employeeForm.accountId) return;
    if (!window.confirm('Удалить аккаунт сотрудника? Сам сотрудник останется в оргструктуре.')) return;

    setIsSaving(true);
    try {
      await adminDeleteUser(employeeForm.accountId);
      setEmployeeForm((prev) => ({
        ...prev,
        accountEnabled: false,
        accountId: null,
        username: prev.email,
        password: '',
        systemRole: 'Оператор',
        isBlocked: false,
      }));
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Не удалось удалить аккаунт.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeactivateLegacyAccount = async (account: User) => {
    if (account.id === currentUser?.id) {
      alert('Текущий администратор защищён от деактивации.');
      return;
    }
    if (account.is_blocked) return;
    if (!window.confirm(`Деактивировать архивный аккаунт "${account.username}"?`)) return;

    setIsSaving(true);
    try {
      await adminToggleBlock(account.id, true);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Не удалось деактивировать аккаунт.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteLegacyAccount = async (account: User) => {
    if (account.id === currentUser?.id) {
      alert('Текущий администратор защищён от удаления.');
      return;
    }
    if (!window.confirm(`Удалить старый аккаунт "${account.username}"? Это действие нельзя отменить.`)) return;

    setIsSaving(true);
    try {
      await adminDeleteUser(account.id);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Не удалось удалить аккаунт.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeactivateAllLegacyAccounts = async () => {
    const targets = legacyAccounts.filter((account) => account.id !== currentUser?.id && !account.is_blocked);
    if (targets.length === 0) return;
    if (!window.confirm(`Деактивировать старые аккаунты без сотрудника: ${targets.length}?`)) return;

    setIsSaving(true);
    try {
      await Promise.all(targets.map((account) => adminToggleBlock(account.id, true)));
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Не удалось деактивировать архивные аккаунты.');
    } finally {
      setIsSaving(false);
    }
  };

  const renderEmployeeRows = (departmentEmployees: Employee[], departmentId: number | null, departmentName: string) => {
    const query = searchQuery.trim().toLowerCase();
    const visibleEmployees = query
      ? departmentEmployees.filter((employee) => employeeMatchesQuery(employee, query))
      : departmentEmployees;

    if (visibleEmployees.length === 0) {
      return (
        <div className="p-6 text-center text-xs text-muted-foreground border border-dashed border-border rounded-lg">
          В этом отделе пока нет сотрудников.
        </div>
      );
    }

    return (
      <div className="overflow-x-auto border border-border rounded-lg">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-muted/50 text-muted-foreground border-b border-border">
              <th className="p-3 font-bold uppercase tracking-wider min-w-[220px]">Сотрудник</th>
              <th className="p-3 font-bold uppercase tracking-wider">Должность</th>
              <th className="p-3 font-bold uppercase tracking-wider">Аккаунт</th>
              <th className="p-3 font-bold uppercase tracking-wider">Wiki-роли</th>
              <th className="p-3 font-bold uppercase tracking-wider">Статус</th>
              <th className="p-3 font-bold uppercase tracking-wider text-right">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visibleEmployees.map((employee) => {
              const position = employee.position_id ? positionsById.get(employee.position_id) : null;
              const manager = employee.manager_id ? employeesById.get(employee.manager_id) : null;
              const account = usersByEmployeeId.get(employee.id);
              const accessUser = account ? accessUsersById.get(account.id) : null;

              return (
                <tr key={employee.id} className="hover:bg-muted/30 transition-colors">
                  <td className="p-3 align-top">
                    <div className="font-bold text-foreground">{employee.full_name}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">{employee.email}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">Отдел: {departmentName}</div>
                  </td>
                  <td className="p-3 align-top">
                    <div className="font-semibold text-foreground">{position?.name || 'Не указана'}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">Руководитель: {manager?.full_name || 'Не указан'}</div>
                  </td>
                  <td className="p-3 align-top">
                    {account ? (
                      <div className="space-y-1">
                        <span className="inline-flex items-center gap-1.5 text-[10px] px-2 py-1 rounded border border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 font-bold">
                          <CheckCircle2 className="w-3 h-3" />
                          {account.username}
                        </span>
                        <div className="text-[10px] text-muted-foreground">{account.role}</div>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[10px] px-2 py-1 rounded border border-border bg-muted text-muted-foreground font-bold">
                        <CircleOff className="w-3 h-3" />
                        Нет аккаунта
                      </span>
                    )}
                  </td>
                  <td className="p-3 align-top">
                    <div className="flex flex-wrap gap-1.5">
                      {accessUser?.wiki_roles.length ? (
                        accessUser.wiki_roles.map((role) => (
                          <span key={role.id} className={`text-[10px] px-2 py-1 rounded border font-bold ${roleTone(role.code)}`}>
                            {role.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-muted-foreground">Назначаются во вкладке доступа</span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 align-top">
                    <span
                      className={`inline-flex text-[10px] px-2 py-1 rounded border font-bold ${
                        employee.is_active
                          ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                          : 'border-neutral-500/25 bg-neutral-500/10 text-neutral-500'
                      }`}
                    >
                      {employee.is_active ? 'Активен' : 'Неактивен'}
                    </span>
                  </td>
                  <td className="p-3 align-top">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => openEmployeeModal(employee, departmentId)}
                        className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-indigo-500 hover:bg-muted transition-colors"
                        title="Редактировать сотрудника"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteEmployee(employee)}
                        className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-red-500 hover:bg-muted transition-colors"
                        title="Удалить сотрудника"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderDepartmentCard = (department: Department) => {
    const departmentPositions = positions.filter((position) => position.department_id === department.id);
    const departmentEmployees = employees.filter((employee) => employee.department_id === department.id);
    const isExpanded = expandedDepartmentIds.has(department.id);
    const parentDepartment = department.parent_department_id ? departmentsById.get(department.parent_department_id) : null;

    return (
      <div key={department.id} className="rounded-lg border border-border bg-card text-card-foreground overflow-hidden">
        <div className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <button
            onClick={() => toggleDepartment(department.id)}
            className="flex items-start gap-3 text-left min-w-0"
          >
            <span className="mt-0.5 text-muted-foreground">
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </span>
            <span>
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-extrabold text-foreground">{department.name}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded border font-bold ${
                  department.status === 'Active'
                    ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                    : 'border-neutral-500/25 bg-neutral-500/10 text-neutral-500'
                }`}>
                  {department.status === 'Active' ? 'Активен' : 'Неактивен'}
                </span>
              </span>
              <span className="block text-[11px] text-muted-foreground mt-1">
                {department.description || 'Описание не указано'}
              </span>
              {parentDepartment && (
                <span className="block text-[10px] text-muted-foreground mt-1">В составе: {parentDepartment.name}</span>
              )}
            </span>
          </button>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <span className="text-[10px] px-2 py-1 rounded border border-border bg-muted text-muted-foreground font-bold">
              {departmentPositions.length} должностей
            </span>
            <span className="text-[10px] px-2 py-1 rounded border border-border bg-muted text-muted-foreground font-bold">
              {departmentEmployees.length} сотрудников
            </span>
            <button
              onClick={() => openEmployeeModal(null, department.id)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-bold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Сотрудник
            </button>
            <button
              onClick={() => openDepartmentModal(department)}
              className="p-2 rounded-lg border border-border text-muted-foreground hover:text-indigo-500 hover:bg-muted transition-colors"
              title="Редактировать отдел"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className="border-t border-border p-4 space-y-4 bg-muted/10">
            <div>
              <div className="flex items-center justify-between gap-3 mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Должности отдела</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {departmentPositions.length === 0 ? (
                  <span className="text-xs text-muted-foreground">Должности пока не добавлены.</span>
                ) : (
                  departmentPositions.map((position) => (
                    <span
                      key={position.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-border bg-card text-xs text-foreground"
                    >
                      <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
                      {position.name}
                    </span>
                  ))
                )}
              </div>
            </div>

            {renderEmployeeRows(departmentEmployees, department.id, department.name)}
          </div>
        )}
      </div>
    );
  };

  const renderUnassignedEmployees = () => {
    if (unassignedEmployees.length === 0) return null;
    const isExpanded = expandedDepartmentIds.has('none');

    return (
      <div className="rounded-lg border border-border bg-card text-card-foreground overflow-hidden">
        <div className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <button onClick={() => toggleDepartment('none')} className="flex items-start gap-3 text-left">
            <span className="mt-0.5 text-muted-foreground">
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </span>
            <span>
              <span className="font-extrabold text-foreground">Без отдела</span>
              <span className="block text-[11px] text-muted-foreground mt-1">Сотрудники, которых нужно распределить по структуре.</span>
            </span>
          </button>
          <span className="text-[10px] px-2 py-1 rounded border border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-300 font-bold w-fit">
            {unassignedEmployees.length} сотрудников
          </span>
        </div>
        {isExpanded && (
          <div className="border-t border-border p-4 bg-muted/10">
            {renderEmployeeRows(unassignedEmployees, null, 'Без отдела')}
          </div>
        )}
      </div>
    );
  };

  const renderLegacyAccounts = () => {
    if (legacyAccounts.length === 0) return null;
    const activeLegacyAccounts = legacyAccounts.filter((account) => !account.is_blocked && account.id !== currentUser?.id);

    return (
      <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 text-card-foreground overflow-hidden">
        <div className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <CircleOff className="w-4 h-4 text-amber-500" />
              <h3 className="font-extrabold text-foreground">Архивные аккаунты</h3>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Старые аккаунты без карточки сотрудника. Их можно привязать к сотруднику, деактивировать или удалить.
            </p>
          </div>

          {activeLegacyAccounts.length > 0 && (
            <button
              onClick={handleDeactivateAllLegacyAccounts}
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/15 text-xs font-bold disabled:opacity-60"
            >
              <CircleOff className="w-4 h-4" />
              Деактивировать старые
            </button>
          )}
        </div>

        <div className="border-t border-amber-500/20 divide-y divide-border">
          {legacyAccounts.map((account) => {
            const isCurrentUser = account.id === currentUser?.id;
            return (
              <div key={account.id} className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm text-foreground">{account.name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded border font-bold ${
                      account.is_blocked
                        ? 'border-neutral-500/25 bg-neutral-500/10 text-neutral-500'
                        : 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                    }`}>
                      {account.is_blocked ? 'Деактивирован' : 'Старый аккаунт'}
                    </span>
                    {isCurrentUser && (
                      <span className="text-[10px] px-2 py-0.5 rounded border border-indigo-500/25 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 font-bold">
                        Текущий админ
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {account.username} · {account.role}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => openEmployeeFromLegacyAccount(account)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted text-xs font-bold transition-colors"
                  >
                    <Users className="w-3.5 h-3.5" />
                    Привязать к сотруднику
                  </button>
                  <button
                    onClick={() => handleDeactivateLegacyAccount(account)}
                    disabled={isSaving || account.is_blocked || isCurrentUser}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted text-xs font-bold disabled:opacity-50 transition-colors"
                  >
                    <CircleOff className="w-3.5 h-3.5" />
                    Деактивировать
                  </button>
                  <button
                    onClick={() => handleDeleteLegacyAccount(account)}
                    disabled={isSaving || isCurrentUser}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-300 hover:bg-red-500/15 text-xs font-bold disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Удалить
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-foreground font-outfit">Команда и доступ</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Сотрудники и аккаунты создаются внутри отделов, должности редактируются в матрице доступа.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-border bg-card text-card-foreground hover:bg-muted text-xs font-bold transition-colors disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Обновить
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-lg border border-border bg-card text-card-foreground">
          <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-muted-foreground">
            <Building2 className="w-3.5 h-3.5 text-violet-500" />
            Отделы
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">{stats.departments}</div>
          <div className="text-[10px] text-muted-foreground mt-1">{stats.positions} должностей</div>
        </div>
        <div className="p-4 rounded-lg border border-border bg-card text-card-foreground">
          <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-muted-foreground">
            <Users className="w-3.5 h-3.5 text-indigo-500" />
            Сотрудники
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">{stats.employees}</div>
          <div className="text-[10px] text-muted-foreground mt-1">{stats.activeEmployees} активных</div>
        </div>
        <div className="p-4 rounded-lg border border-border bg-card text-card-foreground">
          <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-muted-foreground">
            <UserCog className="w-3.5 h-3.5 text-sky-500" />
            Аккаунты
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">{stats.accounts}</div>
          <div className="text-[10px] text-muted-foreground mt-1">
            {stats.linkedAccounts} привязаны · {stats.legacyAccounts} архивных
          </div>
        </div>
        <div className="p-4 rounded-lg border border-border bg-card text-card-foreground">
          <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-muted-foreground">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
            Гостевой доступ
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">{stats.guestAccessCount}</div>
          <div className="text-[10px] text-muted-foreground mt-1">временных выдач</div>
        </div>
      </div>

      <div className="flex gap-2 border-b border-border overflow-x-auto">
        {tabs.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors shrink-0 ${
                activeTab === item.id
                  ? 'border-indigo-500 text-indigo-500'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'org' && (
        <div className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-2 border border-border rounded-lg px-3 py-2 bg-card text-card-foreground w-full lg:max-w-md">
              <Search className="w-4 h-4 text-muted-foreground shrink-0" />
              <input
                type="text"
                placeholder="Поиск отдела, сотрудника, должности или логина"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="bg-transparent text-xs text-foreground outline-none w-full placeholder-muted-foreground"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => openDepartmentModal(null)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border hover:bg-muted text-xs font-bold transition-colors"
              >
                <Building2 className="w-3.5 h-3.5" />
                Добавить отдел
              </button>
              <span className="text-[11px] text-muted-foreground">
                Сотрудники добавляются внутри нужного отдела.
              </span>
            </div>
          </div>

          {isLoading ? (
            <div className="p-8 text-center border border-border bg-card text-card-foreground rounded-lg">
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-indigo-500" />
              <div className="text-xs text-muted-foreground mt-2">Загружаем оргструктуру...</div>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleDepartments.map(renderDepartmentCard)}
              {renderUnassignedEmployees()}
              {renderLegacyAccounts()}
              {visibleDepartments.length === 0 && unassignedEmployees.length === 0 && legacyAccounts.length === 0 && (
                <div className="p-8 text-center border border-border bg-card text-card-foreground rounded-lg text-xs text-muted-foreground">
                  Ничего не найдено.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'access' && <AccessManagement />}
      {activeTab === 'sessions' && <SessionManagement />}
      {activeTab === 'guest' && <GuestManagement />}

      {departmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/65">
          <form onSubmit={handleSaveDepartment} className="w-full max-w-lg rounded-xl border border-border bg-card text-card-foreground p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div>
                <h3 className="text-lg font-extrabold text-foreground">{departmentModal.department ? 'Редактировать отдел' : 'Добавить отдел'}</h3>
                <p className="text-xs text-muted-foreground mt-1">Отдел группирует сотрудников и должности.</p>
              </div>
              <button type="button" onClick={() => setDepartmentModal(null)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">Название отдела</span>
                <input
                  value={departmentForm.name}
                  onChange={(event) => setDepartmentForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-border bg-muted text-foreground px-3 py-2 text-sm outline-none focus:border-indigo-500"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">Описание</span>
                <textarea
                  value={departmentForm.description}
                  onChange={(event) => setDepartmentForm((prev) => ({ ...prev, description: event.target.value }))}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-border bg-muted text-foreground px-3 py-2 text-sm outline-none focus:border-indigo-500 resize-none"
                />
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">Родительский отдел</span>
                  <select
                    value={departmentForm.parentDepartmentId}
                    onChange={(event) => setDepartmentForm((prev) => ({ ...prev, parentDepartmentId: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-border bg-muted text-foreground px-3 py-2 text-sm outline-none focus:border-indigo-500"
                  >
                    <option value="">Нет</option>
                    {departments
                      .filter((department) => department.id !== departmentModal.department?.id)
                      .map((department) => (
                        <option key={department.id} value={department.id}>{department.name}</option>
                      ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">Статус</span>
                  <select
                    value={departmentForm.status}
                    onChange={(event) => setDepartmentForm((prev) => ({ ...prev, status: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-border bg-muted text-foreground px-3 py-2 text-sm outline-none focus:border-indigo-500"
                  >
                    <option value="Active">Активен</option>
                    <option value="Inactive">Неактивен</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button type="button" onClick={() => setDepartmentModal(null)} className="px-4 py-2 rounded-lg border border-border hover:bg-muted text-xs font-bold">
                Отмена
              </button>
              <button disabled={isSaving} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-bold disabled:opacity-60">
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                Сохранить
              </button>
            </div>
          </form>
        </div>
      )}

      {positionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/65">
          <form onSubmit={handleSavePosition} className="w-full max-w-lg rounded-xl border border-border bg-card text-card-foreground p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div>
                <h3 className="text-lg font-extrabold text-foreground">{positionModal.position ? 'Редактировать должность' : 'Добавить должность'}</h3>
                <p className="text-xs text-muted-foreground mt-1">Должность относится к конкретному отделу.</p>
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
                    onChange={(event) => setPositionForm((prev) => ({ ...prev, departmentId: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-border bg-muted text-foreground px-3 py-2 text-sm outline-none focus:border-indigo-500"
                  >
                    {departments.map((department) => (
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
                    {positions
                      .filter((position) => position.id !== positionModal.position?.id)
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
              <button disabled={isSaving} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-bold disabled:opacity-60">
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                Сохранить
              </button>
            </div>
          </form>
        </div>
      )}

      {employeeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/65">
          <form onSubmit={handleSaveEmployee} className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card text-card-foreground p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div>
                <h3 className="text-lg font-extrabold text-foreground">{employeeModal.employee ? 'Карточка сотрудника' : 'Добавить сотрудника'}</h3>
                <p className="text-xs text-muted-foreground mt-1">Здесь редактируются ФИО, почта, отдел, должность и аккаунт.</p>
              </div>
              <button type="button" onClick={() => setEmployeeModal(null)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-6">
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-500" />
                  <h4 className="font-bold text-sm text-foreground">Сотрудник</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground">ФИО</span>
                    <input
                      value={employeeForm.fullName}
                      onChange={(event) => setEmployeeForm((prev) => ({ ...prev, fullName: event.target.value }))}
                      className="mt-1 w-full rounded-lg border border-border bg-muted text-foreground px-3 py-2 text-sm outline-none focus:border-indigo-500"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground">Почта</span>
                    <input
                      type="email"
                      value={employeeForm.email}
                      onChange={(event) => setEmployeeForm((prev) => ({
                        ...prev,
                        email: event.target.value,
                        username: prev.accountId ? prev.username : event.target.value,
                      }))}
                      className="mt-1 w-full rounded-lg border border-border bg-muted text-foreground px-3 py-2 text-sm outline-none focus:border-indigo-500"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground">Отдел</span>
                    <select
                      value={employeeForm.departmentId}
                      onChange={(event) => handleEmployeeDepartmentChange(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-border bg-muted text-foreground px-3 py-2 text-sm outline-none focus:border-indigo-500"
                    >
                      <option value="">Без отдела</option>
                      {departments.map((department) => (
                        <option key={department.id} value={department.id}>{department.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground">Должность</span>
                    <select
                      value={employeeForm.positionId}
                      onChange={(event) => setEmployeeForm((prev) => ({ ...prev, positionId: event.target.value }))}
                      className="mt-1 w-full rounded-lg border border-border bg-muted text-foreground px-3 py-2 text-sm outline-none focus:border-indigo-500"
                    >
                      <option value="">Не указана</option>
                      {positions
                        .filter((position) => !employeeForm.departmentId || position.department_id === Number(employeeForm.departmentId))
                        .map((position) => (
                          <option key={position.id} value={position.id}>{position.name}</option>
                        ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground">Руководитель</span>
                    <select
                      value={employeeForm.managerId}
                      onChange={(event) => setEmployeeForm((prev) => ({ ...prev, managerId: event.target.value }))}
                      className="mt-1 w-full rounded-lg border border-border bg-muted text-foreground px-3 py-2 text-sm outline-none focus:border-indigo-500"
                    >
                      <option value="">Не указан</option>
                      {employees
                        .filter((employee) => employee.id !== employeeModal.employee?.id)
                        .map((employee) => (
                          <option key={employee.id} value={employee.id}>{employee.full_name}</option>
                        ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground">Статус сотрудника</span>
                    <select
                      value={employeeForm.isActive ? 'active' : 'inactive'}
                      onChange={(event) => setEmployeeForm((prev) => ({ ...prev, isActive: event.target.value === 'active' }))}
                      className="mt-1 w-full rounded-lg border border-border bg-muted text-foreground px-3 py-2 text-sm outline-none focus:border-indigo-500"
                    >
                      <option value="active">Активен</option>
                      <option value="inactive">Неактивен</option>
                    </select>
                  </label>
                </div>
              </section>

              <section className="space-y-4 pt-5 border-t border-border">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <UserCog className="w-4 h-4 text-sky-500" />
                    <div>
                      <h4 className="font-bold text-sm text-foreground">Аккаунт</h4>
                      <p className="text-[11px] text-muted-foreground">Логин и пароль редактируются здесь же, внутри сотрудника.</p>
                    </div>
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs font-bold text-foreground">
                    <input
                      type="checkbox"
                      checked={employeeForm.accountEnabled}
                      disabled={!employeeForm.departmentId}
                      onChange={(event) => setEmployeeForm((prev) => ({ ...prev, accountEnabled: event.target.checked }))}
                      className="accent-indigo-600"
                    />
                    Аккаунт нужен
                  </label>
                </div>

                {employeeForm.accountEnabled && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground">Логин</span>
                      <input
                        value={employeeForm.username}
                        onChange={(event) => setEmployeeForm((prev) => ({ ...prev, username: event.target.value }))}
                        className="mt-1 w-full rounded-lg border border-border bg-muted text-foreground px-3 py-2 text-sm outline-none focus:border-indigo-500"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground">
                        {employeeForm.accountId ? 'Новый пароль' : 'Пароль'}
                      </span>
                      <input
                        type="password"
                        value={employeeForm.password}
                        onChange={(event) => setEmployeeForm((prev) => ({ ...prev, password: event.target.value }))}
                        placeholder={employeeForm.accountId ? 'Оставьте пустым, если не меняете' : 'Минимум 6 символов'}
                        className="mt-1 w-full rounded-lg border border-border bg-muted text-foreground px-3 py-2 text-sm outline-none focus:border-indigo-500 placeholder-muted-foreground"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground">Системная роль</span>
                      <select
                        value={employeeForm.systemRole}
                        onChange={(event) => setEmployeeForm((prev) => ({ ...prev, systemRole: event.target.value }))}
                        className="mt-1 w-full rounded-lg border border-border bg-muted text-foreground px-3 py-2 text-sm outline-none focus:border-indigo-500"
                      >
                        {systemRoleOptions.map((role) => (
                          <option key={role} value={role}>{role}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground">Статус аккаунта</span>
                      <select
                        value={employeeForm.isBlocked ? 'blocked' : 'active'}
                        onChange={(event) => setEmployeeForm((prev) => ({ ...prev, isBlocked: event.target.value === 'blocked' }))}
                        className="mt-1 w-full rounded-lg border border-border bg-muted text-foreground px-3 py-2 text-sm outline-none focus:border-indigo-500"
                      >
                        <option value="active">Активен</option>
                        <option value="blocked">Заблокирован</option>
                      </select>
                    </label>
                  </div>
                )}

                {employeeForm.accountId && (
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    disabled={isSaving}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-300 hover:bg-red-500/15 text-xs font-bold disabled:opacity-60"
                  >
                    <Trash2 className="w-4 h-4" />
                    Удалить только аккаунт
                  </button>
                )}
              </section>
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-5 border-t border-border">
              <button type="button" onClick={() => setEmployeeModal(null)} className="px-4 py-2 rounded-lg border border-border hover:bg-muted text-xs font-bold">
                Отмена
              </button>
              <button disabled={isSaving} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-bold disabled:opacity-60">
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                Сохранить
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
