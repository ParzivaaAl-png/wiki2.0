import * as React from 'react';
import {
  Briefcase,
  Building2,
  CheckCircle2,
  CircleOff,
  KeyRound,
  Network,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCog,
  Users,
} from 'lucide-react';
import {
  AccessOverview,
  Department,
  Employee,
  Position,
  User,
  adminFetchUsers,
  fetchAccessOverview,
  fetchDepartments,
  fetchEmployees,
  fetchGuestAccessList,
  fetchPositions,
} from '../lib/api';
import AccessManagement from './access-management';
import GuestManagement from './guest-management';
import OrgManagement from './org-management';
import SessionManagement from './session-management';
import UserManagement from './user-management';

type TeamTab = 'overview' | 'accounts' | 'sessions' | 'org' | 'access' | 'guest';

type TeamMemberRow = {
  id: string;
  name: string;
  email: string;
  departmentName: string;
  positionName: string;
  managerName: string;
  account: User | null;
  wikiRoles: Array<{ id: number; code: string; name: string }>;
  sectionsCount: number;
  isActive: boolean;
  source: 'employee' | 'account';
};

const tabs: Array<{ id: TeamTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: 'Обзор', icon: Users },
  { id: 'accounts', label: 'Аккаунты', icon: UserCog },
  { id: 'sessions', label: 'Сессии', icon: KeyRound },
  { id: 'org', label: 'Оргструктура', icon: Network },
  { id: 'access', label: 'Wiki-роли и доступ', icon: ShieldCheck },
  { id: 'guest', label: 'Гостевой доступ', icon: ShieldAlert },
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
  const [activeTab, setActiveTab] = React.useState<TeamTab>('overview');
  const [isLoading, setIsLoading] = React.useState(true);
  const [users, setUsers] = React.useState<User[]>([]);
  const [departments, setDepartments] = React.useState<Department[]>([]);
  const [positions, setPositions] = React.useState<Position[]>([]);
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [accessOverview, setAccessOverview] = React.useState<AccessOverview | null>(null);
  const [guestAccessCount, setGuestAccessCount] = React.useState(0);
  const [searchQuery, setSearchQuery] = React.useState('');

  const loadOverview = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [usersRes, departmentsRes, positionsRes, employeesRes, accessRes, guestRes] = await Promise.allSettled([
        adminFetchUsers(),
        fetchDepartments(),
        fetchPositions(),
        fetchEmployees(),
        fetchAccessOverview(),
        fetchGuestAccessList(),
      ]);

      setUsers(readSettled(usersRes, []));
      setDepartments(readSettled(departmentsRes, []));
      setPositions(readSettled(positionsRes, []));
      setEmployees(readSettled(employeesRes, []));
      setAccessOverview(readSettled(accessRes, null));
      setGuestAccessCount(readSettled(guestRes, []).length);
    } catch (err) {
      console.error('Failed to load team access overview:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const rows = React.useMemo<TeamMemberRow[]>(() => {
    const departmentsById = new Map(departments.map((department) => [department.id, department]));
    const positionsById = new Map(positions.map((position) => [position.id, position]));
    const employeesById = new Map(employees.map((employee) => [employee.id, employee]));
    const usersByEmployeeId = new Map<number, User>();
    const accessUsersById = new Map((accessOverview?.users || []).map((user) => [user.id, user]));
    const matrixByPositionId = new Map((accessOverview?.matrix || []).map((row) => [row.position_id, row]));

    users.forEach((user) => {
      if (user.employee_id) usersByEmployeeId.set(user.employee_id, user);
    });

    const employeeRows = employees.map((employee): TeamMemberRow => {
      const department = employee.department_id ? departmentsById.get(employee.department_id) : null;
      const position = employee.position_id ? positionsById.get(employee.position_id) : null;
      const manager = employee.manager_id ? employeesById.get(employee.manager_id) : null;
      const account = usersByEmployeeId.get(employee.id) || null;
      const accessUser = account ? accessUsersById.get(account.id) : null;
      const sectionsCount = employee.position_id ? matrixByPositionId.get(employee.position_id)?.sections.length || 0 : 0;

      return {
        id: `employee-${employee.id}`,
        name: employee.full_name,
        email: employee.email,
        departmentName: department?.name || 'Отдел не указан',
        positionName: position?.name || 'Должность не указана',
        managerName: manager?.full_name || 'Не указан',
        account,
        wikiRoles: accessUser?.wiki_roles || account?.wiki_roles || [],
        sectionsCount,
        isActive: employee.is_active,
        source: 'employee',
      };
    });

    const employeeIds = new Set(employees.map((employee) => employee.id));
    const accountRows = users
      .filter((user) => !user.employee_id || !employeeIds.has(user.employee_id))
      .map((user): TeamMemberRow => {
        const accessUser = accessUsersById.get(user.id);
        return {
          id: `account-${user.id}`,
          name: user.name,
          email: user.username,
          departmentName: accessUser?.department_name || 'Без привязки',
          positionName: accessUser?.position_name || user.role,
          managerName: 'Не указан',
          account: user,
          wikiRoles: accessUser?.wiki_roles || user.wiki_roles || [],
          sectionsCount: 0,
          isActive: !user.is_blocked,
          source: 'account',
        };
      });

    return [...employeeRows, ...accountRows];
  }, [accessOverview, departments, employees, positions, users]);

  const filteredRows = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return rows;

    return rows.filter((row) => (
      row.name.toLowerCase().includes(query) ||
      row.email.toLowerCase().includes(query) ||
      row.departmentName.toLowerCase().includes(query) ||
      row.positionName.toLowerCase().includes(query) ||
      row.managerName.toLowerCase().includes(query) ||
      row.account?.role.toLowerCase().includes(query) ||
      row.wikiRoles.some((role) => role.name.toLowerCase().includes(query))
    ));
  }, [rows, searchQuery]);

  const stats = React.useMemo(() => {
    const accounts = users.length;
    const blockedAccounts = users.filter((user) => user.is_blocked).length;
    const linkedAccounts = users.filter((user) => user.employee_id).length;
    const assignedWikiRoles = rows.reduce((sum, row) => sum + row.wikiRoles.length, 0);

    return {
      employees: employees.length,
      activeEmployees: employees.filter((employee) => employee.is_active).length,
      accounts,
      blockedAccounts,
      linkedAccounts,
      assignedWikiRoles,
      departments: departments.length,
      positions: positions.length,
      guestAccessCount,
    };
  }, [departments.length, employees, guestAccessCount, rows, users]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-foreground font-outfit">Команда и доступ</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Сотрудники, аккаунты, оргструктура и Wiki-права в одном месте.
          </p>
        </div>

        <button
          onClick={loadOverview}
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
          <div className="text-[10px] text-muted-foreground mt-1">{stats.linkedAccounts} привязаны к сотрудникам</div>
        </div>
        <div className="p-4 rounded-lg border border-border bg-card text-card-foreground">
          <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            Wiki-роли
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">{stats.assignedWikiRoles}</div>
          <div className="text-[10px] text-muted-foreground mt-1">{accessOverview?.roles.length || 0} типов ролей</div>
        </div>
        <div className="p-4 rounded-lg border border-border bg-card text-card-foreground">
          <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-muted-foreground">
            <Building2 className="w-3.5 h-3.5 text-violet-500" />
            Структура
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">{stats.departments}</div>
          <div className="text-[10px] text-muted-foreground mt-1">{stats.positions} должностей</div>
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

      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 border border-border rounded-lg px-3 py-2 bg-card text-card-foreground max-w-md">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Поиск по команде"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="bg-transparent text-xs text-foreground outline-none w-full placeholder-muted-foreground"
            />
          </div>

          <div className="border border-border bg-card text-card-foreground rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-muted-foreground">
                    <th className="p-4 font-bold uppercase tracking-wider min-w-[220px]">Сотрудник</th>
                    <th className="p-4 font-bold uppercase tracking-wider">Оргструктура</th>
                    <th className="p-4 font-bold uppercase tracking-wider">Аккаунт</th>
                    <th className="p-4 font-bold uppercase tracking-wider">Wiki-роли</th>
                    <th className="p-4 font-bold uppercase tracking-wider">Доступ</th>
                    <th className="p-4 font-bold uppercase tracking-wider">Статус</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        Загружаем команду...
                      </td>
                    </tr>
                  ) : filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        Сотрудники не найдены.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => (
                      <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-4 align-top">
                          <div className="font-bold text-foreground">{row.name}</div>
                          <div className="text-[10px] text-muted-foreground mt-1">{row.email}</div>
                          {row.source === 'account' && (
                            <div className="inline-flex mt-2 text-[10px] px-2 py-0.5 rounded border border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-300 font-semibold">
                              Только аккаунт
                            </div>
                          )}
                        </td>
                        <td className="p-4 align-top">
                          <div className="flex items-start gap-2">
                            <Briefcase className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                            <div>
                              <div className="font-semibold text-foreground">{row.positionName}</div>
                              <div className="text-[10px] text-muted-foreground mt-1">{row.departmentName}</div>
                              <div className="text-[10px] text-muted-foreground mt-1">Руководитель: {row.managerName}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 align-top">
                          {row.account ? (
                            <div>
                              <span className="inline-flex items-center gap-1.5 text-[10px] px-2 py-1 rounded border border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 font-bold">
                                <CheckCircle2 className="w-3 h-3" />
                                Есть аккаунт
                              </span>
                              <div className="text-[10px] text-muted-foreground mt-2">{row.account.role}</div>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-[10px] px-2 py-1 rounded border border-border bg-muted text-muted-foreground font-bold">
                              <CircleOff className="w-3 h-3" />
                              Без аккаунта
                            </span>
                          )}
                        </td>
                        <td className="p-4 align-top">
                          <div className="flex flex-wrap gap-1.5">
                            {row.wikiRoles.length === 0 ? (
                              <span className="text-muted-foreground">Не назначены</span>
                            ) : (
                              row.wikiRoles.map((role) => (
                                <span key={`${row.id}-${role.id}`} className={`text-[10px] px-2 py-1 rounded border font-bold ${roleTone(role.code)}`}>
                                  {role.name}
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="p-4 align-top">
                          <span className="inline-flex items-center gap-1.5 text-[10px] px-2 py-1 rounded border border-indigo-500/25 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 font-bold">
                            <ShieldCheck className="w-3 h-3" />
                            {row.sectionsCount} разделов
                          </span>
                        </td>
                        <td className="p-4 align-top">
                          <span
                            className={`inline-flex items-center gap-1.5 text-[10px] px-2 py-1 rounded border font-bold ${
                              row.isActive
                                ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                                : 'border-neutral-500/25 bg-neutral-500/10 text-neutral-500'
                            }`}
                          >
                            {row.isActive ? 'Активен' : 'Отключён'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-4 rounded-lg border border-border bg-card text-card-foreground">
              <div className="text-[10px] uppercase font-bold text-muted-foreground">Заблокированные аккаунты</div>
              <div className="mt-2 text-xl font-bold text-foreground">{stats.blockedAccounts}</div>
            </div>
            <div className="p-4 rounded-lg border border-border bg-card text-card-foreground">
              <div className="text-[10px] uppercase font-bold text-muted-foreground">Правила доступа</div>
              <div className="mt-2 text-xl font-bold text-foreground">{accessOverview?.summary.rules || 0}</div>
            </div>
            <div className="p-4 rounded-lg border border-border bg-card text-card-foreground">
              <div className="text-[10px] uppercase font-bold text-muted-foreground">Гостевые доступы</div>
              <div className="mt-2 text-xl font-bold text-foreground">{stats.guestAccessCount}</div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'accounts' && <UserManagement />}
      {activeTab === 'sessions' && <SessionManagement />}
      {activeTab === 'org' && <OrgManagement />}
      {activeTab === 'access' && <AccessManagement />}
      {activeTab === 'guest' && <GuestManagement />}
    </div>
  );
}
