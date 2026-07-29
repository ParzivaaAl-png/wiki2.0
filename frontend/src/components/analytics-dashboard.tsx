import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock3,
  Download,
  FileWarning,
  Layers,
  RefreshCw,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { AnalyticsReport, fetchAnalyticsReport } from '../lib/api';
import AdminFilterBar from './admin-filter-bar';

const numberFormatter = new Intl.NumberFormat('ru-RU');

const formatDate = (value: string | null) => {
  if (!value) return 'Нет данных';
  return new Date(value).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return 'Нет данных';
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const mandatoryStatusLabels: Record<string, string> = {
  all: 'Все статусы',
  not_open: 'Не открыта',
  in_progress: 'В процессе чтения',
  read_completed: 'Прочитана до конца',
  acknowledged: 'Ознакомлен',
  overdue: 'Просрочена',
  requires_reacknowledgement: 'Требует повторного ознакомления',
};

const mandatoryStatusClass = (status: string) => {
  if (status === 'acknowledged') return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300';
  if (status === 'overdue') return 'border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-300';
  if (status === 'read_completed') return 'border-sky-500/25 bg-sky-500/10 text-sky-600 dark:text-sky-300';
  if (status === 'in_progress') return 'border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-300';
  if (status === 'requires_reacknowledgement') return 'border-violet-500/25 bg-violet-500/10 text-violet-600 dark:text-violet-300';
  return 'border-border bg-muted text-muted-foreground';
};

type ExcelCell = string | number | null | undefined;

const xmlEscape = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const sheetName = (name: string) => xmlEscape(name.replace(/[\\/?*:\[\]]/g, '').slice(0, 31) || 'Лист');

const excelCell = (value: ExcelCell, styleId?: string) => {
  const isNumber = typeof value === 'number' && Number.isFinite(value);
  const styleAttr = styleId ? ` ss:StyleID="${styleId}"` : '';
  return `<Cell${styleAttr}><Data ss:Type="${isNumber ? 'Number' : 'String'}">${xmlEscape(value)}</Data></Cell>`;
};

const excelSheet = (name: string, rows: ExcelCell[][]) => `
  <Worksheet ss:Name="${sheetName(name)}">
    <Table>
      ${rows.map((row, rowIndex) => `<Row>${row.map((cell) => excelCell(cell, rowIndex === 0 ? 'Header' : undefined)).join('')}</Row>`).join('')}
    </Table>
  </Worksheet>
`;

export default function AnalyticsDashboard() {
  const [periodDays, setPeriodDays] = React.useState(30);
  const [staleDays, setStaleDays] = React.useState(90);
  const [isFilterOpen, setIsFilterOpen] = React.useState(false);
  const [activeAnalyticsTab, setActiveAnalyticsTab] = React.useState<'overview' | 'mandatory'>('overview');
  const [mandatoryStatus, setMandatoryStatus] = React.useState('all');
  const [mandatoryViewMode, setMandatoryViewMode] = React.useState<'employees' | 'articles'>('employees');
  const [report, setReport] = React.useState<AnalyticsReport | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  const loadReport = React.useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      setReport(await fetchAnalyticsReport(periodDays, staleDays, { status: mandatoryStatus }));
    } catch (err: any) {
      console.error('Failed to load analytics report:', err);
      setError(err.message || 'Не удалось загрузить аналитику.');
    } finally {
      setIsLoading(false);
    }
  }, [periodDays, staleDays, mandatoryStatus]);

  React.useEffect(() => {
    loadReport();
  }, [loadReport]);

  const exportExcel = () => {
    if (!report) return;

    const mandatoryRows = report.mandatoryAcknowledgement?.rows || [];
    const mandatoryByArticle = report.mandatoryAcknowledgement?.byArticle || [];

    const workbook = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook
  xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:html="http://www.w3.org/TR/REC-html40">
  <Styles>
    <Style ss:ID="Header">
      <Font ss:Bold="1"/>
      <Interior ss:Color="#E8EAFD" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
      </Borders>
    </Style>
  </Styles>
  ${excelSheet('Сводка', [
    ['Показатель', 'Значение'],
    ['Сформирован', new Date(report.generatedAt).toLocaleString('ru-RU')],
    ['Период отчёта, дней', report.periodDays],
    ['Порог проверки, дней', report.staleDays],
    ['Всего статей', Number(report.overview.total_articles)],
    ['Опубликовано', Number(report.overview.published_articles)],
    ['Черновиков', Number(report.overview.draft_articles)],
    ['В архиве', Number(report.overview.archived_articles)],
    ['Требуют проверки', Number(report.overview.stale_articles)],
    ['Обновлено за период', Number(report.overview.updated_articles)],
    ['Пространств', Number(report.overview.total_spaces)],
    ['Разделов', Number(report.overview.total_sections)],
    ['Пользователей', Number(report.overview.total_users)],
    ['Просмотры за период', Number(report.overview.period_views)],
    ['Активные сотрудники', Number(report.overview.active_users)],
  ])}
  ${excelSheet('Динамика', [
    ['Дата', 'Просмотры', 'Уникальные читатели'],
    ...report.dailyViews.map((item) => [formatDate(item.day), Number(item.views), Number(item.unique_readers)]),
  ])}
  ${excelSheet('Популярные статьи', [
    ['Статья', 'Ссылка', 'Просмотры за период', 'Уникальные читатели', 'Всего просмотров', 'В избранном'],
    ...report.topArticles.map((item) => [
      item.title,
      `/articles/${item.slug}`,
      Number(item.period_views),
      Number(item.unique_readers),
      Number(item.total_views),
      Number(item.favorites),
    ]),
  ])}
  ${excelSheet('Разделы', [
    ['Пространство', 'Раздел', 'Статей', 'Просмотров за период', 'Последнее обновление'],
    ...report.sectionStats.map((item) => [
      item.space_name,
      item.section_name,
      Number(item.article_count),
      Number(item.period_views),
      formatDate(item.last_updated_at),
    ]),
  ])}
  ${excelSheet('Активность', [
    ['Сотрудник', 'Роль', 'Просмотры', 'Уникальные статьи', 'Последняя активность'],
    ...report.userActivity.map((item) => [
      item.name,
      item.role,
      Number(item.views),
      Number(item.unique_articles),
      formatDate(item.last_viewed_at),
    ]),
  ])}
  ${excelSheet('Авторы', [
    ['Сотрудник', 'Роль', 'Статей', 'Правок за период', 'Последняя правка'],
    ...report.contributorStats.map((item) => [
      item.name,
      item.role,
      Number(item.authored_articles),
      Number(item.period_edits),
      formatDate(item.last_edit_at),
    ]),
  ])}
  ${excelSheet('Проверка', [
    ['Статья', 'Ссылка', 'Владелец', 'Просмотры', 'Дней без обновления', 'Последнее обновление'],
    ...report.staleArticles.map((item) => [
      item.title,
      `/articles/${item.slug}`,
      item.owner_name || 'Не назначен',
      Number(item.views),
      Number(item.days_without_update),
      formatDate(item.updated_at),
    ]),
  ])}
  ${excelSheet('Обязательное ознакомление', [
    [
      'ID сотрудника',
      'ФИО',
      'логин',
      'подразделение',
      'должность',
      'руководитель',
      'название статьи',
      'раздел статьи',
      'версия статьи',
      'автор статьи',
      'дата публикации',
      'дата назначения',
      'срок ознакомления',
      'дата первого просмотра',
      'дата прокрутки до конца',
      'дата подтверждения',
      'статус',
      'ознакомился в установленный срок',
      'количество дней просрочки',
      'дата последнего обновления статьи',
    ],
    ...mandatoryRows.map((item) => [
      item.employee_id,
      item.user_name || 'Не указан',
      item.username || '',
      item.department_name || 'Не указан',
      item.position_name || 'Не указана',
      item.manager_name || 'Не указан',
      item.article_title || item.title || 'Без названия',
      item.article_sections || 'Без раздела',
      item.article_version,
      item.article_author || 'Не указан',
      formatDateTime(item.article_published_at),
      formatDateTime(item.assigned_at),
      formatDateTime(item.due_at),
      formatDateTime(item.first_viewed_at),
      formatDateTime(item.read_completed_at),
      formatDateTime(item.acknowledged_at),
      mandatoryStatusLabels[item.status] || item.status,
      item.completed_in_time === null ? 'Нет данных' : (item.completed_in_time ? 'Да' : 'Нет'),
      Number(item.overdue_days || 0),
      formatDateTime(item.article_updated_at),
    ]),
  ])}
  ${excelSheet('Сводка по обязательным статьям', [
    [
      'название статьи',
      'версия',
      'количество назначенных сотрудников',
      'ознакомились',
      'не ознакомились',
      'просрочили',
      'процент выполнения',
      'среднее время от назначения до ознакомления',
    ],
    ...mandatoryByArticle.map((item) => [
      item.article_title,
      item.article_version,
      Number(item.assigned_count),
      Number(item.acknowledged_count),
      Number(item.not_acknowledged_count),
      Number(item.overdue_count),
      Number(item.completion_percent),
      item.avg_hours_to_ack === null ? 'Нет данных' : `${Number(item.avg_hours_to_ack)} ч.`,
    ]),
  ])}
</Workbook>`;

    const url = URL.createObjectURL(new Blob([workbook], { type: 'application/vnd.ms-excel;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `wiki-analytics-${new Date().toISOString().slice(0, 10)}.xls`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading && !report) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-10 w-64 rounded bg-muted" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((item) => <div key={item} className="h-28 rounded-lg bg-muted" />)}
        </div>
        <div className="h-64 rounded-lg bg-muted" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="border border-red-500/20 bg-red-500/5 p-6 rounded-lg text-center">
        <FileWarning className="w-7 h-7 text-red-500 mx-auto mb-2" />
        <p className="text-sm font-semibold text-foreground">{error || 'Отчёт недоступен'}</p>
        <button onClick={loadReport} className="mt-4 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold">
          Повторить
        </button>
      </div>
    );
  }

  const maxDailyViews = Math.max(1, ...report.dailyViews.map((item) => Number(item.views)));
  const firstDay = report.dailyViews[0]?.day;
  const lastDay = report.dailyViews[report.dailyViews.length - 1]?.day;
  const metrics = [
    { label: 'Просмотры', value: report.overview.period_views, detail: `за ${periodDays} дней`, icon: Activity, color: 'text-indigo-500' },
    { label: 'Активные сотрудники', value: report.overview.active_users, detail: `из ${report.overview.total_users}`, icon: Users, color: 'text-emerald-500' },
    { label: 'Опубликовано', value: report.overview.published_articles, detail: `${report.overview.draft_articles} черновиков`, icon: BookOpen, color: 'text-sky-500' },
    { label: 'Требуют проверки', value: report.overview.stale_articles, detail: `старше ${staleDays} дней`, icon: FileWarning, color: 'text-amber-500' },
  ];
  const mandatorySummary = report.mandatoryAcknowledgement?.summary || {
    mandatory_articles: 0,
    assigned_count: 0,
    acknowledged_count: 0,
    not_acknowledged_count: 0,
    overdue_count: 0,
    completion_percent: 0,
  };
  const mandatoryMetrics = [
    { label: 'Обязательных статей', value: mandatorySummary.mandatory_articles, detail: 'в базе знаний', icon: ShieldCheck, color: 'text-indigo-500' },
    { label: 'Назначено', value: mandatorySummary.assigned_count, detail: 'ознакомлений', icon: Users, color: 'text-sky-500' },
    { label: 'Ознакомились', value: mandatorySummary.acknowledged_count, detail: `${mandatorySummary.completion_percent || 0}% выполнения`, icon: CheckCircle2, color: 'text-emerald-500' },
    { label: 'Просрочили', value: mandatorySummary.overdue_count, detail: `${mandatorySummary.not_acknowledged_count || 0} не завершили`, icon: FileWarning, color: 'text-red-500' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="font-outfit text-xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-500" />
            Аналитика Wiki
          </h2>
          <p className="text-xs text-muted-foreground mt-1">Данные обновлены {new Date(report.generatedAt).toLocaleString('ru-RU')}</p>
        </div>

        <AdminFilterBar
          isOpen={isFilterOpen}
          onToggle={() => setIsFilterOpen((prev) => !prev)}
          activeCount={(periodDays !== 30 ? 1 : 0) + (staleDays !== 90 ? 1 : 0) + (mandatoryStatus !== 'all' ? 1 : 0)}
          onReset={() => {
            setPeriodDays(30);
            setStaleDays(90);
            setMandatoryStatus('all');
          }}
          actions={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadReport}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground shadow-sm cursor-pointer"
                title="Обновить отчёт"
                aria-label="Обновить отчёт"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={exportExcel}
                className="inline-flex h-9 items-center gap-1.5 px-3 rounded-xl border border-border bg-card text-xs font-bold text-foreground hover:bg-muted shadow-sm cursor-pointer"
              >
                <Download className="w-4 h-4 text-indigo-500" />
                <span className="hidden sm:inline">Выгрузить</span> Excel
              </button>
            </div>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1" htmlFor="analytics-period">Период аналитики</label>
              <select
                id="analytics-period"
                value={periodDays}
                onChange={(event) => setPeriodDays(Number(event.target.value))}
                className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-muted text-foreground outline-none focus:border-indigo-500"
              >
                <option value={7}>7 дней</option>
                <option value={30}>30 дней</option>
                <option value={90}>90 дней</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1" htmlFor="analytics-stale">Порог актуальности</label>
              <select
                id="analytics-stale"
                value={staleDays}
                onChange={(event) => setStaleDays(Number(event.target.value))}
                className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-muted text-foreground outline-none focus:border-indigo-500"
              >
                <option value={30}>30 дней</option>
                <option value={60}>60 дней</option>
                <option value={90}>90 дней</option>
                <option value={180}>180 дней</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1" htmlFor="analytics-mandatory-status">Статус ознакомлений</label>
              <select
                id="analytics-mandatory-status"
                value={mandatoryStatus}
                onChange={(event) => setMandatoryStatus(event.target.value)}
                className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-muted text-foreground outline-none focus:border-indigo-500"
              >
                {Object.entries(mandatoryStatusLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>
        </AdminFilterBar>
      </div>

      <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1">
        <button
          type="button"
          onClick={() => setActiveAnalyticsTab('overview')}
          className={`h-8 rounded-md px-3 text-xs font-bold transition-colors ${
            activeAnalyticsTab === 'overview'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Обзор
        </button>
        <button
          type="button"
          onClick={() => setActiveAnalyticsTab('mandatory')}
          className={`h-8 rounded-md px-3 text-xs font-bold transition-colors ${
            activeAnalyticsTab === 'mandatory'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Обязательное ознакомление
        </button>
      </div>

      {activeAnalyticsTab === 'overview' && (
        <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {metrics.map(({ label, value, detail, icon: Icon, color }) => (
          <div key={label} className="min-h-28 p-4 sm:p-5 rounded-lg border border-border bg-card shadow-premium">
            <div className="flex items-center justify-between gap-2 text-muted-foreground">
              <span className="text-[10px] sm:text-xs font-semibold uppercase">{label}</span>
              <Icon className={`w-4 h-4 sm:w-5 sm:h-5 shrink-0 ${color}`} />
            </div>
            <div className="mt-3 text-2xl font-bold text-foreground">{numberFormatter.format(Number(value))}</div>
            <div className="mt-1 text-[10px] text-muted-foreground">{detail}</div>
          </div>
        ))}
      </div>

      <section className="border border-border bg-card rounded-lg p-4 sm:p-5 shadow-premium">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-bold text-foreground">Динамика просмотров</h3>
          <span className="text-[10px] text-muted-foreground">Уникальных читателей: {numberFormatter.format(report.overview.active_users)}</span>
        </div>
        <div className="h-44 flex items-end gap-1 border-b border-border" aria-label="График просмотров по дням">
          {report.dailyViews.map((item) => {
            const height = Number(item.views) === 0 ? 2 : Math.max(8, (Number(item.views) / maxDailyViews) * 100);
            return (
              <div key={item.day} className="group flex-1 h-full flex items-end min-w-0" title={`${formatDate(item.day)}: ${item.views} просмотров`}>
                <div className="w-full rounded-t bg-indigo-500/70 group-hover:bg-indigo-500 transition-colors" style={{ height: `${height}%` }} />
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
          <span>{formatDate(firstDay || null)}</span>
          <span>{formatDate(lastDay || null)}</span>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <ReportTable title="Популярные статьи" icon={<BookOpen className="w-4 h-4 text-indigo-500" />} headers={['Статья', 'Просмотры', 'Читатели']}>
          {report.topArticles.length === 0 ? (
            <EmptyRow columns={3} text="Просмотров пока нет" />
          ) : report.topArticles.map((item) => (
            <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/40">
              <td className="p-3"><Link to={`/articles/${item.slug}`} className="font-semibold text-foreground hover:text-indigo-500">{item.title}</Link></td>
              <td className="p-3 text-right text-muted-foreground">{numberFormatter.format(Number(item.period_views))}</td>
              <td className="p-3 text-right text-muted-foreground">{numberFormatter.format(Number(item.unique_readers))}</td>
            </tr>
          ))}
        </ReportTable>

        <ReportTable title="Разделы" icon={<Layers className="w-4 h-4 text-violet-500" />} headers={['Раздел', 'Статей', 'Просмотры']}>
          {report.sectionStats.length === 0 ? (
            <EmptyRow columns={3} text="Разделы ещё не созданы" />
          ) : report.sectionStats.map((item) => (
            <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/40">
              <td className="p-3"><div className="font-semibold text-foreground">{item.section_name}</div><div className="text-[10px] text-muted-foreground">{item.space_name}</div></td>
              <td className="p-3 text-right text-muted-foreground">{numberFormatter.format(Number(item.article_count))}</td>
              <td className="p-3 text-right text-muted-foreground">{numberFormatter.format(Number(item.period_views))}</td>
            </tr>
          ))}
        </ReportTable>
      </div>

      <ReportTable title="Активность сотрудников" icon={<Users className="w-4 h-4 text-emerald-500" />} headers={['Сотрудник', 'Роль', 'Статей', 'Просмотры', 'Последняя активность']}>
        {report.userActivity.length === 0 ? (
          <EmptyRow columns={5} text="Активности пока нет" />
        ) : report.userActivity.map((item) => (
          <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/40">
            <td className="p-3 font-semibold text-foreground">{item.name}</td>
            <td className="p-3 text-muted-foreground">{item.role}</td>
            <td className="p-3 text-right text-muted-foreground">{numberFormatter.format(Number(item.unique_articles))}</td>
            <td className="p-3 text-right text-muted-foreground">{numberFormatter.format(Number(item.views))}</td>
            <td className="p-3 text-right text-muted-foreground whitespace-nowrap">{formatDate(item.last_viewed_at)}</td>
          </tr>
        ))}
      </ReportTable>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <ReportTable title="Авторы и редакторы" icon={<Activity className="w-4 h-4 text-sky-500" />} headers={['Сотрудник', 'Статей', 'Правок']}>
          {report.contributorStats.length === 0 ? (
            <EmptyRow columns={3} text="Авторов пока нет" />
          ) : report.contributorStats.map((item) => (
            <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/40">
              <td className="p-3"><div className="font-semibold text-foreground">{item.name}</div><div className="text-[10px] text-muted-foreground">{item.role}</div></td>
              <td className="p-3 text-right text-muted-foreground">{numberFormatter.format(Number(item.authored_articles))}</td>
              <td className="p-3 text-right text-muted-foreground">{numberFormatter.format(Number(item.period_edits))}</td>
            </tr>
          ))}
        </ReportTable>

        <ReportTable title="Требуют проверки" icon={<Clock3 className="w-4 h-4 text-amber-500" />} headers={['Статья', 'Владелец', 'Без обновления']}>
          {report.staleArticles.length === 0 ? (
            <EmptyRow columns={3} text="Просроченных материалов нет" />
          ) : report.staleArticles.map((item) => (
            <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/40">
              <td className="p-3"><Link to={`/articles/${item.slug}`} className="font-semibold text-foreground hover:text-indigo-500">{item.title}</Link></td>
              <td className="p-3 text-muted-foreground">{item.owner_name || 'Не назначен'}</td>
              <td className="p-3 text-right text-amber-500 whitespace-nowrap">{numberFormatter.format(Number(item.days_without_update))} дн.</td>
            </tr>
          ))}
        </ReportTable>
      </div>

        </>
      )}

      {activeAnalyticsTab === 'mandatory' && (
        <div className="space-y-5">
          <section className="rounded-lg border border-border bg-card p-4 sm:p-5 shadow-premium">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <ShieldCheck className="h-4 w-4 text-indigo-500" />
                  Обязательное ознакомление
                </h3>
                <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
                  Контроль назначенных материалов: кто открыл статью, дочитал до конца, подтвердил ознакомление и кто просрочил срок.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={mandatoryStatus}
                  onChange={(event) => setMandatoryStatus(event.target.value)}
                  className="h-9 min-w-52 rounded-lg border border-border bg-muted px-3 text-xs text-foreground outline-none focus:border-indigo-500"
                >
                  {Object.entries(mandatoryStatusLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                <div className="inline-flex rounded-lg border border-border bg-muted/50 p-1">
                  <button
                    type="button"
                    onClick={() => setMandatoryViewMode('employees')}
                    className={`h-7 rounded-md px-3 text-[11px] font-bold ${mandatoryViewMode === 'employees' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
                  >
                    По сотрудникам
                  </button>
                  <button
                    type="button"
                    onClick={() => setMandatoryViewMode('articles')}
                    className={`h-7 rounded-md px-3 text-[11px] font-bold ${mandatoryViewMode === 'articles' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
                  >
                    По статьям
                  </button>
                </div>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {mandatoryMetrics.map(({ label, value, detail, icon: Icon, color }) => (
              <div key={label} className="min-h-28 rounded-lg border border-border bg-card p-4 sm:p-5 shadow-premium">
                <div className="flex items-center justify-between gap-2 text-muted-foreground">
                  <span className="text-[10px] sm:text-xs font-semibold uppercase">{label}</span>
                  <Icon className={`w-4 h-4 sm:w-5 sm:h-5 shrink-0 ${color}`} />
                </div>
                <div className="mt-3 text-2xl font-bold text-foreground">{numberFormatter.format(Number(value || 0))}</div>
                <div className="mt-1 text-[10px] text-muted-foreground">{detail}</div>
              </div>
            ))}
          </div>

          {mandatoryViewMode === 'employees' ? (
            <section className="overflow-hidden rounded-lg border border-border bg-card shadow-premium">
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <Users className="h-4 w-4 text-emerald-500" />
                <h3 className="text-sm font-bold text-foreground">Ознакомление по сотрудникам</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[1180px] w-full text-left text-xs">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      {['Сотрудник', 'Подразделение', 'Должность', 'Статья', 'Версия', 'Назначено', 'Первый просмотр', 'До конца', 'Подтверждено', 'Срок', 'Статус', 'Просрочка'].map((header) => (
                        <th key={header} className="whitespace-nowrap p-3 font-semibold">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.mandatoryAcknowledgement.rows.length === 0 ? (
                      <tr><td colSpan={12} className="p-8 text-center italic text-muted-foreground">Назначений пока нет</td></tr>
                    ) : report.mandatoryAcknowledgement.rows.map((item) => (
                      <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                        <td className="p-3">
                          <div className="font-semibold text-foreground">{item.user_name || 'Не указан'}</div>
                          <div className="text-[10px] text-muted-foreground">{item.username || 'без логина'}</div>
                        </td>
                        <td className="p-3 text-muted-foreground">{item.department_name || 'Не указан'}</td>
                        <td className="p-3 text-muted-foreground">{item.position_name || 'Не указана'}</td>
                        <td className="p-3">
                          <Link to={`/articles/${item.article_slug}`} className="font-semibold text-foreground hover:text-indigo-500">
                            {item.article_title || item.title || 'Без названия'}
                          </Link>
                          <div className="text-[10px] text-muted-foreground">{item.article_sections || 'Без раздела'}</div>
                        </td>
                        <td className="p-3 text-muted-foreground">{item.article_version}</td>
                        <td className="p-3 whitespace-nowrap text-muted-foreground">{formatDateTime(item.assigned_at)}</td>
                        <td className="p-3 whitespace-nowrap text-muted-foreground">{formatDateTime(item.first_viewed_at)}</td>
                        <td className="p-3 whitespace-nowrap text-muted-foreground">{formatDateTime(item.read_completed_at)}</td>
                        <td className="p-3 whitespace-nowrap text-muted-foreground">{formatDateTime(item.acknowledged_at)}</td>
                        <td className="p-3 whitespace-nowrap text-muted-foreground">{formatDateTime(item.due_at)}</td>
                        <td className="p-3"><MandatoryStatusPill status={item.status} /></td>
                        <td className="p-3 whitespace-nowrap text-right text-muted-foreground">{Number(item.overdue_days || 0)} дн.</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : (
            <section className="overflow-hidden rounded-lg border border-border bg-card shadow-premium">
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <BookOpen className="h-4 w-4 text-indigo-500" />
                <h3 className="text-sm font-bold text-foreground">Ознакомление по статьям</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[860px] w-full text-left text-xs">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      {['Статья', 'Версия', 'Назначено', 'Ознакомились', 'Не ознакомились', 'Просрочили', 'Выполнение', 'Среднее время'].map((header) => (
                        <th key={header} className="whitespace-nowrap p-3 font-semibold">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.mandatoryAcknowledgement.byArticle.length === 0 ? (
                      <tr><td colSpan={8} className="p-8 text-center italic text-muted-foreground">Обязательных статей пока нет</td></tr>
                    ) : report.mandatoryAcknowledgement.byArticle.map((item) => (
                      <tr key={`${item.article_id}-${item.article_version}`} className="border-b border-border last:border-0 hover:bg-muted/40">
                        <td className="p-3">
                          <Link to={`/articles/${item.article_slug}`} className="font-semibold text-foreground hover:text-indigo-500">
                            {item.article_title}
                          </Link>
                        </td>
                        <td className="p-3 text-muted-foreground">{item.article_version}</td>
                        <td className="p-3 text-muted-foreground">{numberFormatter.format(Number(item.assigned_count))}</td>
                        <td className="p-3 text-emerald-600 dark:text-emerald-300">{numberFormatter.format(Number(item.acknowledged_count))}</td>
                        <td className="p-3 text-muted-foreground">{numberFormatter.format(Number(item.not_acknowledged_count))}</td>
                        <td className="p-3 text-red-600 dark:text-red-300">{numberFormatter.format(Number(item.overdue_count))}</td>
                        <td className="p-3">
                          <div className="flex min-w-36 items-center gap-2">
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, Number(item.completion_percent || 0))}%` }} />
                            </div>
                            <span className="w-11 text-right font-semibold text-foreground">{Number(item.completion_percent || 0)}%</span>
                          </div>
                        </td>
                        <td className="p-3 text-muted-foreground">{item.avg_hours_to_ack === null ? 'Нет данных' : `${Number(item.avg_hours_to_ack)} ч.`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function ReportTable({ title, icon, headers, children }: { title: string; icon: React.ReactNode; headers: string[]; children: React.ReactNode }) {
  return (
    <section className="border border-border bg-card rounded-lg overflow-hidden shadow-premium">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        {icon}
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>{headers.map((header, index) => <th key={header} className={`p-3 font-semibold whitespace-nowrap ${index > 0 ? 'text-right' : ''}`}>{header}</th>)}</tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </section>
  );
}

function EmptyRow({ columns, text }: { columns: number; text: string }) {
  return <tr><td colSpan={columns} className="p-8 text-center text-muted-foreground italic">{text}</td></tr>;
}

function MandatoryStatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-1 text-[10px] font-bold ${mandatoryStatusClass(status)}`}>
      {mandatoryStatusLabels[status] || status}
    </span>
  );
}
