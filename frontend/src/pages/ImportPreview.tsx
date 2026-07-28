import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  FileText,
  Loader2,
  RotateCcw,
  Save,
  Send,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Building2,
} from 'lucide-react';
import WYSIWYGEditor from '../components/wysiwyg-editor';
import {
  cancelImportSession,
  DocumentImportSession,
  fetchImportSession,
  fetchNavigationTree,
  FinalizeImportPayload,
  getApiAssetUrl,
  publishImportSession,
  resetImportSession,
  saveImportSessionDraft,
  Space,
  updateImportSession,
} from '../lib/api';

const slugify = (value: string) => {
  const base = value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u0400-\u04FF-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');

  return base || 'imported-document';
};

function OnlyOfficeEditor({ session }: { session: DocumentImportSession }) {
  const editorRef = React.useRef<any>(null);
  const holderId = React.useMemo(() => `onlyoffice-editor-${session.id}`, [session.id]);

  React.useEffect(() => {
    if (!session.onlyoffice.enabled || !session.onlyoffice.documentServerUrl || !session.onlyoffice.config) return;

    let cancelled = false;
    const scriptUrl = `${session.onlyoffice.documentServerUrl}/web-apps/apps/api/documents/api.js`;

    const mountEditor = () => {
      if (cancelled || !(window as any).DocsAPI) return;
      if (editorRef.current?.destroyEditor) {
        editorRef.current.destroyEditor();
      }
      editorRef.current = new (window as any).DocsAPI.DocEditor(holderId, session.onlyoffice.config);
    };

    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${scriptUrl}"]`);
    if (existingScript) {
      if ((window as any).DocsAPI) mountEditor();
      else existingScript.addEventListener('load', mountEditor, { once: true });
    } else {
      const script = document.createElement('script');
      script.src = scriptUrl;
      script.async = true;
      script.onload = mountEditor;
      script.onerror = () => console.error('ONLYOFFICE API script failed to load.');
      document.body.appendChild(script);
    }

    return () => {
      cancelled = true;
      if (editorRef.current?.destroyEditor) {
        editorRef.current.destroyEditor();
      }
      editorRef.current = null;
    };
  }, [holderId, session]);

  if (!session.onlyoffice.enabled) {
    return (
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-700 dark:text-amber-300">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Нативный DOCX-редактор пока не подключён</p>
            <p className="mt-1 text-xs text-amber-700/80 dark:text-amber-200/80">
              {session.onlyoffice.reason || 'Документ можно проверить во встроенном редакторе. Оригинал сохранён отдельно.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[680px] overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div id={holderId} className="h-full w-full" />
    </div>
  );
}

export default function ImportPreview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [session, setSession] = React.useState<DocumentImportSession | null>(null);
  const [spaces, setSpaces] = React.useState<Space[]>([]);
  const [title, setTitle] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [summary, setSummary] = React.useState('');
  const [content, setContent] = React.useState('');
  const [sectionIds, setSectionIds] = React.useState<number[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [editorKey, setEditorKey] = React.useState(0);

  const loadSession = React.useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const [sessionData, tree] = await Promise.all([
        fetchImportSession(id),
        fetchNavigationTree(),
      ]);
      setSession(sessionData);
      setSpaces(tree);
      setTitle(sessionData.title);
      setSlug(sessionData.slug || `${slugify(sessionData.title)}-${Date.now()}`);
      setSummary(sessionData.summary || '');
      setContent(sessionData.preview_html || '<p></p>');
      setEditorKey((value) => value + 1);
    } catch (err: any) {
      setError(err.message || 'Не удалось открыть импорт.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    loadSession();
  }, [loadSession]);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!slug || slug.startsWith(slugify(title))) {
      setSlug(`${slugify(value)}-${Date.now()}`);
    }
  };

  const toggleSection = (sectionId: number) => {
    setSectionIds((prev) => (
      prev.includes(sectionId)
        ? prev.filter((id) => id !== sectionId)
        : [...prev, sectionId]
    ));
  };

  const renderSectionCheckboxes = (sections: any[], depth = 0): React.ReactNode => (
    sections.map((section) => (
      <div key={section.id} className="space-y-1">
        <label
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/70"
          style={{ marginLeft: depth * 12 }}
        >
          <input
            type="checkbox"
            checked={sectionIds.includes(section.id)}
            onChange={() => toggleSection(section.id)}
            className="h-4 w-4 rounded border-border text-indigo-600 focus:ring-indigo-500"
          />
          <span>{section.name}</span>
        </label>
        {section.subsections?.length ? renderSectionCheckboxes(section.subsections, depth + 1) : null}
      </div>
    ))
  );

  const persistPreview = async () => {
    if (!session) return session;
    return updateImportSession(session.id, {
      title,
      summary,
      preview_html: content,
    });
  };

  const getPayload = (): FinalizeImportPayload => ({
    title,
    slug,
    summary,
    content,
    section_ids: sectionIds,
    tags: ['импорт'],
    article_type: 'general',
    source_url: session?.source_url || null,
  });

  const handleSaveDraft = async () => {
    if (!session) return;
    setIsSubmitting(true);
    try {
      await persistPreview();
      const article = await saveImportSessionDraft(session.id, getPayload());
      navigate(`/admin/editor/${article.id}`);
    } catch (err: any) {
      alert(err.message || 'Не удалось сохранить черновик.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePublish = async () => {
    if (!session) return;
    setIsSubmitting(true);
    try {
      await persistPreview();
      const article = await publishImportSession(session.id, getPayload());
      navigate(`/articles/${article.slug}`);
    } catch (err: any) {
      alert(err.message || 'Не удалось опубликовать статью.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!session) return;
    if (!window.confirm('Отменить импорт? Временная сессия будет удалена без создания статьи.')) return;
    setIsSubmitting(true);
    try {
      await cancelImportSession(session.id);
      navigate('/admin');
    } catch (err: any) {
      alert(err.message || 'Не удалось отменить импорт.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = async () => {
    if (!session) return;
    if (!window.confirm('Сбросить изменения и восстановить рабочую копию из оригинального файла?')) return;
    setIsSubmitting(true);
    try {
      const resetSession = await resetImportSession(session.id);
      setSession(resetSession);
      setTitle(resetSession.title);
      setSlug(resetSession.slug || `${slugify(resetSession.title)}-${Date.now()}`);
      setSummary(resetSession.summary || '');
      setContent(resetSession.preview_html || '<p></p>');
      setEditorKey((value) => value + 1);
    } catch (err: any) {
      alert(err.message || 'Не удалось сбросить изменения.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex items-center justify-center rounded-xl border border-border bg-card p-10 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Открываем документ...
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-red-600 dark:text-red-300">
          <p className="font-bold">Импорт недоступен</p>
          <p className="mt-2 text-sm">{error || 'Сессия импорта не найдена.'}</p>
          <Link to="/admin" className="mt-4 inline-flex text-sm font-semibold underline">
            Вернуться в админ-панель
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Link
          to="/admin"
          className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад в админ-панель
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={getApiAssetUrl(session.original_url)}
            download
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-foreground shadow-sm transition-colors hover:bg-muted"
          >
            <Download className="h-4 w-4" />
            Скачать оригинал
          </a>
          <button
            onClick={handleReset}
            disabled={isSubmitting}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-muted-foreground shadow-sm transition-colors hover:bg-muted disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" />
            Сбросить изменения
          </button>
          <button
            onClick={handleCancel}
            disabled={isSubmitting}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 text-xs font-semibold text-red-600 transition-colors hover:bg-red-500/10 disabled:opacity-50 dark:text-red-300"
          >
            <Trash2 className="h-4 w-4" />
            Отменить импорт
          </button>
        </div>
      </div>

      <div className="mb-5 rounded-xl border border-border bg-card p-5 shadow-premium dark:shadow-premium-dark">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/5 px-3 py-1 text-xs font-bold text-indigo-600 dark:text-indigo-300">
              <FileText className="h-3.5 w-3.5" />
              Предварительный импорт
            </div>
            <h1 className="mt-3 font-outfit text-2xl font-extrabold text-foreground">
              Проверка документа перед сохранением
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {session.source_url
                ? 'Страница сайта сохранена как исходный HTML и рабочая копия. Статья появится только после сохранения в черновик или публикации.'
                : 'Файл сохранён как оригинал и рабочая копия. Статья появится только после сохранения в черновик или публикации.'}
            </p>
            {session.source_url && (
              <a
                href={session.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex max-w-full truncate text-xs font-semibold text-indigo-600 underline underline-offset-2 dark:text-indigo-300"
              >
                {session.source_url}
              </a>
            )}
          </div>

          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="h-4 w-4" />
              Оригинал сохранён
            </div>
            <div className="mt-1 max-w-xs truncate text-emerald-700/80 dark:text-emerald-200/80">
              {session.original_file_name}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4 min-w-0">
          <OnlyOfficeEditor session={session} />

          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-foreground">Wiki-представление для статьи и поиска</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Это HTML-представление будет сохранено в Wiki. Сложное форматирование остаётся в оригинальном файле.
                </p>
              </div>
            </div>
            <WYSIWYGEditor key={editorKey} content={content} onChange={setContent} />
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-bold text-foreground">Настройки статьи</h2>
            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Название</label>
                <input
                  value={title}
                  onChange={(event) => handleTitleChange(event.target.value)}
                  className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Slug</label>
                <input
                  value={slug}
                  onChange={(event) => setSlug(slugify(event.target.value))}
                  className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm font-mono text-foreground outline-none transition-colors focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Краткое описание</label>
                <textarea
                  value={summary}
                  onChange={(event) => setSummary(event.target.value)}
                  rows={4}
                  className="w-full resize-none rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Building2 className="h-4 w-4 text-indigo-500" />
              Разделы Wiki
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Выберите один или несколько разделов, где будет лежать статья.
            </p>
            <div className="mt-4 max-h-[340px] overflow-y-auto rounded-lg border border-border bg-muted/20 p-2">
              {spaces.map((space) => (
                <div key={space.id} className="mb-3 last:mb-0">
                  <div className="mb-1 px-2 text-[10px] font-extrabold uppercase text-indigo-500">
                    {space.name}
                  </div>
                  <div className="space-y-1 border-l border-border pl-2">
                    {renderSectionCheckboxes(space.sections)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="sticky bottom-4 rounded-xl border border-border bg-card p-4 shadow-premium dark:shadow-premium-dark">
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={handleSaveDraft}
                disabled={isSubmitting || !title.trim() || !content.trim()}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-bold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Сохранить в черновик
              </button>
              <button
                onClick={handlePublish}
                disabled={isSubmitting || !title.trim() || !content.trim()}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-bold text-white shadow-md shadow-indigo-600/20 transition-colors hover:bg-indigo-700 disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Редактировать и опубликовать
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
