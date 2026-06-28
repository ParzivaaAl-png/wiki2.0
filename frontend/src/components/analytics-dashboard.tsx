import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  BookOpen,
  Clock3,
  Download,
  FileWarning,
  Layers,
  RefreshCw,
  Users,
} from 'lucide-react';
import { AnalyticsReport, fetchAnalyticsReport } from '../lib/api';

const numberFormatter = new Intl.NumberFormat('ru-RU');

const formatDate = (value: string | null) => {
  if (!value) return 'Нет данных';
  return new Date(value).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
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
  const [report, setReport] = React.useState<AnalyticsReport | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  const loadReport = React.useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      setReport(await fetchAnalyticsReport(periodDays, staleDays));
    } catch (err: any) {
      console.error('Failed to load analytics report:', err);
      setError(err.message || 'Не удалось загрузить аналитику.');
    } finally {
      setIsLoading(false);
    }
  }, [periodDays, staleDays]);

  React.useEffect(() => {
    loadReport();
  }, [loadReport]);

  const exportExcel = () => {
    if (!report) return;

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
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-muted-foreground" htmlFor="analytics-period">Период</label>
          <select
            id="analytics-period"
            value={periodDays}
            onChange={(event) => setPeriodDays(Number(event.target.value))}
            className="h-9 rounded-lg border border-border bg-card px-3 text-xs text-foreground outline-none focus:border-indigo-500"
          >
            <option value={7}>7 дней</option>
            <option value={30}>30 дней</option>
            <option value={90}>90 дней</option>
          </select>
          <label className="text-xs text-muted-foreground ml-2" htmlFor="analytics-stale">Актуальность</label>
          <select
            id="analytics-stale"
            value={staleDays}
            onChange={(event) => setStaleDays(Number(event.target.value))}
            className="h-9 rounded-lg border border-border bg-card px-3 text-xs text-foreground outline-none focus:border-indigo-500"
          >
            <option value={30}>30 дней</option>
            <option value={60}>60 дней</option>
            <option value={90}>90 дней</option>
            <option value={180}>180 дней</option>
          </select>
          <button
            type="button"
            onClick={loadReport}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Обновить отчёт"
            aria-label="Обновить отчёт"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={exportExcel}
            className="inline-flex h-9 items-center gap-1.5 px-3 rounded-lg border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted"
          >
            <Download className="w-4 h-4" />
            Excel
          </button>
        </div>
      </div>

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
