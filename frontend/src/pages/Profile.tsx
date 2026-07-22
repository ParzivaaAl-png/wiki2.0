import * as React from 'react';
import { KeyRound, Loader2, Save, ShieldCheck, UserCircle, Users, Building2, Briefcase, Layers3, MonitorSmartphone } from 'lucide-react';
import { fetchMyProfile, updateMyAccount, type MyProfile, type MyProfileSection } from '../lib/api';
import { useAuth } from '../lib/auth-context';

const inputClass =
  'h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-950 shadow-inner shadow-neutral-950/5 outline-none transition-colors placeholder:text-neutral-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25 dark:border-[#303746] dark:bg-[#111318] dark:text-neutral-100 dark:placeholder:text-neutral-500';

const formatDate = (value?: string | null) => {
  if (!value) return 'Не указано';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
};

const getDeviceName = (userAgent?: string | null) => {
  if (!userAgent) return 'Неизвестное устройство';
  if (userAgent.includes('iPhone')) return 'iPhone';
  if (userAgent.includes('iPad')) return 'iPad';
  if (userAgent.includes('Macintosh')) return 'Mac';
  if (userAgent.includes('Windows')) return 'Windows';
  if (userAgent.includes('Android')) return 'Android';
  return 'Браузер';
};

const groupSections = (sections: MyProfileSection[]) => {
  return sections.reduce<Record<string, MyProfileSection[]>>((acc, section) => {
    const key = section.department_name || section.space_name || 'Общие разделы';
    acc[key] = acc[key] || [];
    acc[key].push(section);
    return acc;
  }, {});
};

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [profile, setProfile] = React.useState<MyProfile | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [username, setUsername] = React.useState(user?.username || '');
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const loadProfile = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchMyProfile();
      setProfile(data);
      setUsername(data.user.username);
    } catch (err: any) {
      setError(err.message || 'Не удалось загрузить профиль.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setError(null);

    const nextUsername = username.trim();
    const isPasswordTouched = currentPassword.length > 0 || newPassword.length > 0 || confirmPassword.length > 0;

    if (!nextUsername) {
      setError('Укажите логин.');
      return;
    }

    if (isPasswordTouched) {
      if (!currentPassword) {
        setError('Введите текущий пароль.');
        return;
      }
      if (newPassword.length < 6) {
        setError('Новый пароль должен быть не менее 6 символов.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setError('Новый пароль и повтор не совпадают.');
        return;
      }
    }

    setIsSaving(true);
    try {
      await updateMyAccount({
        username: nextUsername,
        currentPassword: isPasswordTouched ? currentPassword : undefined,
        newPassword: isPasswordTouched ? newPassword : undefined,
      });
      await refreshUser();
      await loadProfile();
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage('Профиль обновлён.');
    } catch (err: any) {
      setError(err.message || 'Не удалось сохранить профиль.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-background px-4 py-10">
        <div className="mx-auto flex max-w-5xl items-center justify-center rounded-2xl border border-border bg-card p-10 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Загружаем профиль...
        </div>
      </div>
    );
  }

  const profileUser = profile?.user;
  const groupedSections = groupSections(profile?.sections || []);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm dark:bg-[#161A22]">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-xs font-bold text-indigo-600 dark:text-indigo-300">
                <UserCircle className="h-4 w-4" />
                Личный кабинет
              </div>
              <h1 className="mt-3 text-2xl font-bold text-foreground sm:text-3xl">Профиль</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Здесь собраны данные аккаунта, доступы и активные сессии.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-background px-4 py-3 text-sm dark:bg-[#111318]">
              <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Текущий статус</div>
              <div className="mt-1 flex items-center gap-2 font-bold text-foreground">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                {profileUser?.must_change_password ? 'Нужно сменить пароль' : 'Аккаунт защищён'}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <InfoCard icon={UserCircle} label="ФИО" value={profileUser?.name || user?.name || 'Не указано'} />
          <InfoCard icon={KeyRound} label="Логин" value={profileUser?.username || user?.username || 'Не указано'} />
          <InfoCard icon={Building2} label="Отдел" value={profileUser?.department_name || 'Отдел не указан'} />
          <InfoCard icon={Briefcase} label="Должность" value={profileUser?.position_name || profileUser?.role || 'Должность не указана'} />
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <form onSubmit={handleSave} className="rounded-2xl border border-border bg-card p-5 shadow-sm dark:bg-[#161A22]">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-foreground">Логин и пароль</h2>
              <p className="mt-1 text-sm text-muted-foreground">Поля теперь выделены плотнее, чтобы их было хорошо видно.</p>
            </div>

            {error && (
              <div className="mb-4 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-300">
                {error}
              </div>
            )}
            {message && (
              <div className="mb-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                {message}
              </div>
            )}

            <div className="space-y-4">
              <label className="block space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Логин</span>
                <input value={username} onChange={(event) => setUsername(event.target.value)} className={inputClass} autoComplete="username" />
              </label>

              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-[#303746] dark:bg-[#111318]">
                <div className="mb-4 flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-primary" />
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Смена пароля</h3>
                    <p className="text-xs text-muted-foreground">Оставьте поля пустыми, если пароль менять не нужно.</p>
                  </div>
                </div>
                <div className="grid gap-3">
                  <label className="block space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Текущий пароль</span>
                    <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className={inputClass} autoComplete="current-password" />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block space-y-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Новый пароль</span>
                      <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className={inputClass} autoComplete="new-password" />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Повтор пароля</span>
                      <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className={inputClass} autoComplete="new-password" />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-ring/40 sm:w-auto"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Сохранить изменения
            </button>
          </form>

          <div className="space-y-6">
            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm dark:bg-[#161A22]">
              <h2 className="text-lg font-bold text-foreground">Wiki-роли</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {profileUser?.wiki_roles?.length ? (
                  profileUser.wiki_roles.map((role) => (
                    <span key={role.id} className="rounded-full border border-indigo-500/25 bg-indigo-500/10 px-3 py-1 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                      {role.name}
                    </span>
                  ))
                ) : (
                  <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-bold text-muted-foreground">
                    По должности: {profileUser?.role || 'роль не указана'}
                  </span>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm dark:bg-[#161A22]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Активные сессии</h2>
                  <p className="text-sm text-muted-foreground">Устройства, где открыт ваш аккаунт.</p>
                </div>
                <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-bold text-muted-foreground">
                  {profile?.sessions.length || 0}
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {profile?.sessions.length ? (
                  profile.sessions.map((session) => (
                    <div key={session.id} className="rounded-xl border border-border bg-background p-3 dark:bg-[#111318]">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <MonitorSmartphone className="h-4 w-4 shrink-0 text-primary" />
                          <span className="truncate text-sm font-bold text-foreground">{getDeviceName(session.user_agent)}</span>
                        </div>
                        {session.is_current && (
                          <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                            текущая
                          </span>
                        )}
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        Последняя активность: {formatDate(session.last_active_at)}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        IP: {session.ip_address || 'не указан'}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-border bg-background p-4 text-sm text-muted-foreground dark:bg-[#111318]">
                    Активных сессий не найдено.
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm dark:bg-[#161A22]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-foreground">Доступные разделы</h2>
              <p className="text-sm text-muted-foreground">Разделы, которые доступны вам по должности, роли или ручной настройке доступа.</p>
            </div>
            <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-bold text-muted-foreground">
              {profile?.section_count || 0} разделов
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {Object.keys(groupedSections).length > 0 ? (
              Object.entries(groupedSections).map(([groupName, sections]) => (
                <div key={groupName} className="rounded-xl border border-border bg-background p-4 dark:bg-[#111318]">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 font-bold text-foreground">
                      <Layers3 className="h-4 w-4 text-primary" />
                      {groupName}
                    </div>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                      {sections.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {sections.map((section) => (
                      <div key={section.id} className="rounded-lg border border-border bg-card px-3 py-2 dark:bg-[#161A22]">
                        <div className="text-sm font-bold text-foreground">{section.name}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {section.position_name || section.space_name || 'Раздел Wiki'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-background p-5 text-sm text-muted-foreground dark:bg-[#111318]">
                Доступные разделы пока не назначены.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm dark:bg-[#161A22]">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {label}
      </div>
      <div className="mt-2 break-words text-base font-bold text-foreground">{value}</div>
    </div>
  );
}
