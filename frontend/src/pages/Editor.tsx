import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { 
  ArrowLeft, 
  Save, 
  Tag as TagIcon,
  X,
  Sparkles,
  ShieldCheck,
  History
} from 'lucide-react';
import {
  fetchArticle,
  createArticle,
  updateArticle,
  fetchNavigationTree,
  adminFetchUsers,
  fetchDepartments,
  fetchPositions,
  Department,
  Position,
  User,
  MandatoryAcknowledgementSettings,
  IpRestrictionSettings,
} from '../lib/api';
import { ModalPortal } from '../components/modal-portal';
import WYSIWYGEditor from '../components/wysiwyg-editor';
import ArticleEditorNavigation from '../components/article-editor-navigation';

export default function Editor() {
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = React.useState(true);
  const [editorInstance, setEditorInstance] = React.useState<any>(null);

  // Form states
  const [title, setTitle] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [summary, setSummary] = React.useState('');
  const [content, setContent] = React.useState('');
  const [published, setPublished] = React.useState(true);
  const [status, setStatus] = React.useState('draft');
  const [tags, setTags] = React.useState<string[]>([]);
  const [sectionIds, setSectionIds] = React.useState<number[]>([]);
  const [spaces, setSpaces] = React.useState<any[]>([]);
  const [newTag, setNewTag] = React.useState('');
  const [position, setPosition] = React.useState<number>(0);
  const [sourceUrl, setSourceUrl] = React.useState('');
  const [syncInterval, setSyncInterval] = React.useState('manual');
  
  // Custom metadata states
  const [articleType, setArticleType] = React.useState('general');
  const [ownerId, setOwnerId] = React.useState<number | ''>('');
  const [approverId, setApproverId] = React.useState<number | ''>('');
  const [users, setUsers] = React.useState<User[]>([]);
  const [departments, setDepartments] = React.useState<Department[]>([]);
  const [positions, setPositions] = React.useState<Position[]>([]);
  const [mandatoryAck, setMandatoryAck] = React.useState<MandatoryAcknowledgementSettings>({
    enabled: false,
    target_user_ids: [],
    target_department_ids: [],
    target_position_ids: [],
    start_at: new Date().toISOString().slice(0, 10),
    due_days: 7,
    due_at: null,
    require_reacknowledgement: false,
    notifications_enabled: true,
    reminders_enabled: false,
  });

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [changeDescription, setChangeDescription] = React.useState('');
  const [editorComment, setEditorComment] = React.useState('');
  const [showSaveModal, setShowSaveModal] = React.useState(false);

  // Initial Fetch
  React.useEffect(() => {
    async function loadEditorData() {
      setIsLoading(true);
      try {
        // 1. Загружаем дерево разделов
        const tree = await fetchNavigationTree();
        setSpaces(tree);

        // 1.5. Загружаем список пользователей
        try {
          const [userList, deptList, positionList] = await Promise.all([
            adminFetchUsers(),
            fetchDepartments(),
            fetchPositions(),
          ]);
          setUsers(userList);
          setDepartments(deptList);
          setPositions(positionList);
        } catch (uErr) {
          console.error('Failed to load users/departments/positions in editor:', uErr);
        }

        // 2. Если режим редактирования, загружаем данные статьи
        if (isEditMode && id) {
          const article = await fetchArticle(id);
          setTitle(article.title);
          setSlug(article.slug);
          setSummary(article.summary || '');
          setContent(article.content);
          setPublished(article.published);
          setStatus(article.status || 'draft');
          setTags(article.tags || []);
          setSectionIds(article.section_ids || []);
          setPosition(article.position || 0);
          setSourceUrl(article.source_url || '');
          setSyncInterval(article.sync_interval || 'manual');
          setArticleType(article.article_type || 'general');
          setOwnerId(article.owner_id || '');
          setApproverId(article.approver_id || '');
          if (article.mandatory_ack_settings) {
            setMandatoryAck({
              enabled: !!article.mandatory_ack_enabled,
              target_user_ids: article.mandatory_ack_settings.target_user_ids || [],
              target_department_ids: article.mandatory_ack_settings.target_department_ids || [],
              target_position_ids: article.mandatory_ack_settings.target_position_ids || [],
              start_at: article.mandatory_ack_settings.start_at ? article.mandatory_ack_settings.start_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
              due_days: article.mandatory_ack_settings.due_days || 7,
              due_at: article.mandatory_ack_settings.due_at || null,
              require_reacknowledgement: !!article.mandatory_ack_settings.require_reacknowledgement,
              notifications_enabled: article.mandatory_ack_settings.notifications_enabled !== false,
              reminders_enabled: !!article.mandatory_ack_settings.reminders_enabled,
            });
          }
        } else {
          // Если новая статья, проверяем, передан ли в URL раздел по умолчанию
          const queryParams = new URLSearchParams(window.location.search);
          const preselectedSectionId = queryParams.get('sectionId');
          if (preselectedSectionId) {
            setSectionIds([Number(preselectedSectionId)]);
          }
        }
      } catch (err) {
        console.error('Failed to load editor data:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadEditorData();
  }, [id, isEditMode]);

  // Auto slugify title
  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!isEditMode) {
      const slugified = val
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w\u0400-\u04FF-]+/g, '')
        .replace(/--+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
      setSlug(slugified);
    }
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newTag.trim()) {
      e.preventDefault();
      const cleaned = newTag.trim().toLowerCase();
      if (!tags.includes(cleaned)) {
        setTags([...tags, cleaned]);
      }
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const toggleMandatoryTarget = (
    key: 'target_user_ids' | 'target_department_ids' | 'target_position_ids',
    id: number
  ) => {
    setMandatoryAck((prev) => ({
      ...prev,
      [key]: prev[key].includes(id)
        ? prev[key].filter((item) => item !== id)
        : [...prev[key], id],
    }));
  };

  const handleSaveClick = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !slug.trim() || !content.trim()) {
      alert('Пожалуйста, заполните Название, Slug и Текст статьи.');
      return;
    }
    if (sectionIds.length === 0) {
      alert('Пожалуйста, привяжите статью хотя бы к одному разделу оргструктуры.');
      return;
    }
    if (isEditMode) {
      setShowSaveModal(true);
    } else {
      submitForm();
    }
  };

  const submitForm = async () => {
    setIsSubmitting(true);
    const payload = {
      title,
      slug,
      summary,
      content,
      category_id: null,
      published,
      status,
      tags,
      section_ids: sectionIds,
      position,
      source_url: sourceUrl || null,
      sync_interval: syncInterval,
      article_type: articleType,
      owner_id: ownerId ? Number(ownerId) : null,
      approver_id: approverId ? Number(approverId) : null,
      mandatory_acknowledgement: {
        ...mandatoryAck,
        due_days: Number(mandatoryAck.due_days || 7),
      },
      ...(isEditMode && {
        change_description: changeDescription.trim() || 'Обновлено содержание статьи',
        editor_comment: editorComment.trim() || 'Редактирование статьи',
      }),
    };

    try {
      if (isEditMode && id) {
        await updateArticle(Number(id), payload);
      } else {
        await createArticle(payload);
      }
      localStorage.removeItem(`wiki_autosave_${id || 'new'}`);
      setShowSaveModal(false);
      navigate('/admin');
    } catch (err: any) {
      console.error(err);
      alert(`Не удалось сохранить: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderSectionCheckbox = (sec: any, depth = 0) => {
    const isChecked = sectionIds.includes(sec.id);
    const handleCheckboxChange = (checked: boolean) => {
      if (checked) {
        setSectionIds(prev => [...prev, sec.id]);
      } else {
        setSectionIds(prev => prev.filter(id => id !== sec.id));
      }
    };

    return (
      <div key={sec.id} className="space-y-1 mt-1">
        <label 
          style={{ paddingLeft: `${depth * 12}px` }}
          className="flex items-center gap-2 text-xs font-semibold text-muted-foreground cursor-pointer select-none py-0.5 hover:text-primary"
        >
          <input
            type="checkbox"
            checked={isChecked}
            onChange={(e) => handleCheckboxChange(e.target.checked)}
            className="rounded border-border text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
          />
          <span>{sec.name}</span>
        </label>
        {sec.subsections && sec.subsections.map((sub: any) => renderSectionCheckbox(sub, depth + 1))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 animate-pulse space-y-6">
        <div className="h-4 w-32 bg-muted rounded" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-[450px] bg-muted rounded-xl" />
          <div className="h-80 bg-muted rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Navigation and Save Actions */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Link
            to="/admin"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Отмена и возврат
          </Link>
          {isEditMode && id && (
            <Link
              to={`/articles/${id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              title="Открыть статью и просмотреть историю версий"
            >
              <History className="w-3.5 h-3.5" />
              История версий
            </Link>
          )}
        </div>

        <button
          onClick={handleSaveClick}
          disabled={isSubmitting}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 transition-all cursor-pointer"
        >
          <Save className="w-4 h-4" />
          {isSubmitting ? 'Сохранение...' : 'Сохранить статью'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Sidebar Settings & Live Article Navigation */}
        <div className="lg:order-2 space-y-6">
          <div className="sticky top-20 z-10">
            <ArticleEditorNavigation editor={editorInstance} content={content} />
          </div>

          <div className="p-5 border border-border bg-card text-card-foreground rounded-xl shadow-premium dark:shadow-premium-dark space-y-4">
            <h3 className="font-outfit text-sm font-bold text-foreground flex items-center gap-2">
              <Sparkles className="w-4.5 h-4.5 text-indigo-500" />
              Настройки и метаданные
            </h3>

            {/* Статус статьи */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-muted-foreground mb-1">Статус статьи</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-muted text-foreground outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="draft">📝 Черновик (Draft)</option>
                <option value="on_approval">⏳ На согласовании (On approval)</option>
                <option value="published">✅ Опубликована (Published)</option>
                <option value="requires_verification">⚠️ Требует проверки (Requires verification)</option>
                <option value="archived">📦 В архиве (Archived)</option>
                <option value="expired">⌛ Срок истек (Expired)</option>
              </select>
            </div>

            {/* Тип статьи */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-muted-foreground mb-1">Тип статьи</label>
              <select
                value={articleType}
                onChange={(e) => setArticleType(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-muted text-foreground outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="general">📝 Общая статья</option>
                <option value="job_description">📋 Должностная инструкция</option>
                <option value="regulation">📜 Регламент</option>
                <option value="instruction">📖 Инструкция</option>
                <option value="tool_description">🛠️ Описание инструмента</option>
              </select>
            </div>

            {/* Владелец процесса */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-muted-foreground mb-1">Владелец процесса</label>
              <select
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value ? Number(e.target.value) : '')}
                className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-muted text-foreground outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="">-- Не назначен --</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.username})
                  </option>
                ))}
              </select>
            </div>

            {/* Согласующий */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-muted-foreground mb-1">Согласующий</label>
              <select
                value={approverId}
                onChange={(e) => setApproverId(e.target.value ? Number(e.target.value) : '')}
                className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-muted text-foreground outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="">-- Не назначен --</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.username})
                  </option>
                ))}
              </select>
            </div>

            {/* Выбор разделов оргструктуры */}
            <div>
              <label className="block text-[10px] uppercase font-bold text-muted-foreground mb-1.5">Разделы оргструктуры</label>
              <div className="max-h-52 overflow-y-auto border border-border rounded-lg p-2.5 space-y-3 bg-muted/10">
                {spaces.map(space => (
                  <div key={space.id} className="space-y-1">
                    <div className="text-[10px] font-extrabold uppercase text-indigo-500 flex items-center gap-1">
                      <span>📁 {space.name}</span>
                    </div>
                    <div className="pl-2 space-y-1 border-l border-border">
                      {space.sections.map((sec: any) => renderSectionCheckbox(sec, 0))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/[0.03] p-4 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs font-extrabold text-foreground">
                    <ShieldCheck className="h-4 w-4 text-indigo-500" />
                    Обязательное ознакомление
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    Назначается только сотрудникам, у которых есть доступ к выбранным разделам статьи.
                  </p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={mandatoryAck.enabled}
                    onChange={(e) => setMandatoryAck((prev) => ({ ...prev, enabled: e.target.checked }))}
                    className="peer sr-only"
                  />
                  <span className="h-5 w-9 rounded-full bg-muted after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-border after:bg-white after:transition-all peer-checked:bg-indigo-600 peer-checked:after:translate-x-full" />
                </label>
              </div>

              {mandatoryAck.enabled && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Дата начала</label>
                      <input
                        type="date"
                        value={mandatoryAck.start_at || ''}
                        onChange={(e) => setMandatoryAck((prev) => ({ ...prev, start_at: e.target.value }))}
                        className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-xs text-foreground outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase text-muted-foreground">Срок, дней</label>
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={mandatoryAck.due_days}
                        onChange={(e) => setMandatoryAck((prev) => ({ ...prev, due_days: Number(e.target.value) }))}
                        className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-xs text-foreground outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="mb-1 text-[10px] font-bold uppercase text-muted-foreground">Подразделения</div>
                      <div className="max-h-28 overflow-y-auto rounded-lg border border-border bg-card p-2 space-y-1">
                        {departments.map((department) => (
                          <label key={department.id} className="flex items-center gap-2 text-[11px] font-semibold text-foreground">
                            <input
                              type="checkbox"
                              checked={mandatoryAck.target_department_ids.includes(department.id)}
                              onChange={() => toggleMandatoryTarget('target_department_ids', department.id)}
                              className="h-3.5 w-3.5 rounded border-border text-indigo-600"
                            />
                            <span>{department.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="mb-1 text-[10px] font-bold uppercase text-muted-foreground">Должности</div>
                      <div className="max-h-32 overflow-y-auto rounded-lg border border-border bg-card p-2 space-y-1">
                        {positions.map((position) => (
                          <label key={position.id} className="flex items-center gap-2 text-[11px] font-semibold text-foreground">
                            <input
                              type="checkbox"
                              checked={mandatoryAck.target_position_ids.includes(position.id)}
                              onChange={() => toggleMandatoryTarget('target_position_ids', position.id)}
                              className="h-3.5 w-3.5 rounded border-border text-indigo-600"
                            />
                            <span>{position.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="mb-1 text-[10px] font-bold uppercase text-muted-foreground">Сотрудники</div>
                      <div className="max-h-32 overflow-y-auto rounded-lg border border-border bg-card p-2 space-y-1">
                        {users.map((targetUser) => (
                          <label key={targetUser.id} className="flex items-center gap-2 text-[11px] font-semibold text-foreground">
                            <input
                              type="checkbox"
                              checked={mandatoryAck.target_user_ids.includes(targetUser.id)}
                              onChange={() => toggleMandatoryTarget('target_user_ids', targetUser.id)}
                              className="h-3.5 w-3.5 rounded border-border text-indigo-600"
                            />
                            <span>{targetUser.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-border pt-3">
                    <label className="flex items-start gap-2 text-[11px] font-semibold text-foreground">
                      <input
                        type="checkbox"
                        checked={mandatoryAck.require_reacknowledgement}
                        onChange={(e) => setMandatoryAck((prev) => ({ ...prev, require_reacknowledgement: e.target.checked }))}
                        className="mt-0.5 h-3.5 w-3.5 rounded border-border text-indigo-600"
                      />
                      <span>Требовать повторное ознакомление после публикации новой версии</span>
                    </label>
                    <label className="flex items-start gap-2 text-[11px] font-semibold text-foreground">
                      <input
                        type="checkbox"
                        checked={mandatoryAck.notifications_enabled}
                        onChange={(e) => setMandatoryAck((prev) => ({ ...prev, notifications_enabled: e.target.checked }))}
                        className="mt-0.5 h-3.5 w-3.5 rounded border-border text-indigo-600"
                      />
                      <span>Отправлять уведомления при назначении</span>
                    </label>
                    <label className="flex items-start gap-2 text-[11px] font-semibold text-foreground">
                      <input
                        type="checkbox"
                        checked={mandatoryAck.reminders_enabled}
                        onChange={(e) => setMandatoryAck((prev) => ({ ...prev, reminders_enabled: e.target.checked }))}
                        className="mt-0.5 h-3.5 w-3.5 rounded border-border text-indigo-600"
                      />
                      <span>Включить напоминания о сроке</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-muted-foreground mb-1">Slug (путь URL)</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                placeholder="slug-url-endpoint"
                required
                className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-muted text-foreground outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-muted-foreground mb-1">Источник данных (Source URL)</label>
              <input
                type="text"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="Например, ссылка на классификатор Яндекса"
                className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-muted text-foreground outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-muted-foreground mb-1">Интервал авто-синхронизации</label>
              <select
                value={syncInterval}
                onChange={(e) => setSyncInterval(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-muted text-foreground outline-none focus:border-indigo-500"
              >
                <option value="manual">Вручную (Manual)</option>
                <option value="6h">Каждые 6 часов</option>
                <option value="12h">Каждые 12 часов</option>
                <option value="24h">Каждые 24 часа</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-muted-foreground mb-1">Порядковый номер (Позиция)</label>
              <input
                type="number"
                value={position}
                onChange={(e) => setPosition(Number(e.target.value))}
                placeholder="0"
                min="0"
                className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-muted text-foreground outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-muted-foreground mb-1">Теги (нажмите Enter)</label>
              <div className="flex items-center gap-2 border border-border rounded-lg px-3 py-1 bg-muted/50 mb-2">
                <TagIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={handleAddTag}
                  placeholder="добавить тег..."
                  className="bg-transparent text-xs text-foreground outline-none w-full py-1"
                />
              </div>

              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border border-border bg-muted text-muted-foreground font-medium"
                    >
                      {tag}
                      <button type="button" onClick={() => handleRemoveTag(tag)} className="text-muted-foreground hover:text-red-500">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-semibold text-foreground">Отображать на главной</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={published}
                  onChange={(e) => setPublished(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-muted rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Content Pane */}
        <div className="lg:col-span-2 lg:order-1 flex flex-col border border-border bg-card text-card-foreground rounded-xl overflow-hidden shadow-premium dark:shadow-premium-dark p-6 space-y-4">
          <input
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Название статьи..."
            required
            className="w-full text-xl sm:text-2xl font-extrabold text-neutral-950 dark:text-white placeholder-neutral-300 dark:placeholder-neutral-800 bg-transparent outline-none border-b border-neutral-100 dark:border-neutral-900 pb-2"
          />

          <input
            type="text"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Краткое описание (summary) этой статьи..."
            className="w-full text-xs text-neutral-500 bg-transparent outline-none placeholder-neutral-400 dark:placeholder-neutral-800 border-b border-neutral-100 dark:border-neutral-900 pb-2"
          />

          <div className="flex-1">
            <WYSIWYGEditor
              content={content}
              onChange={setContent}
              articleId={id || 'new'}
              onEditorReady={setEditorInstance}
            />
          </div>
        </div>
      {/* Save Prompt Modal */}
      {showSaveModal && (
        <ModalPortal>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 animate-fadeIn">
          <div className="relative w-full max-w-md p-6 border border-border bg-card text-card-foreground rounded-2xl shadow-2xl animate-scaleUp">
            <button
              onClick={() => setShowSaveModal(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h3 className="font-outfit text-base font-bold text-foreground flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-indigo-500" />
              Что изменено в статье?
            </h3>
            
            <p className="text-xs text-muted-foreground mb-4">
              Пожалуйста, кратко опишите внесенные изменения. Это поможет другим пользователям понять историю обновлений.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-muted-foreground mb-1">
                  Описание изменений <span className="text-red-500 font-bold">*</span>
                </label>
                <textarea
                  value={changeDescription}
                  onChange={(e) => setChangeDescription(e.target.value)}
                  placeholder="Например: обновлен классификатор автомобилей, добавлены тарифы, исправлены опечатки..."
                  rows={4}
                  required
                  className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-muted text-foreground outline-none focus:border-indigo-500 resize-none placeholder-muted-foreground"
                />
              </div>
              
              <div>
                <label className="block text-[10px] uppercase font-bold text-muted-foreground mb-1">
                  Комментарий редактора <span className="text-muted-foreground font-normal">(необязательно)</span>
                </label>
                <input
                  type="text"
                  value={editorComment}
                  onChange={(e) => setEditorComment(e.target.value)}
                  placeholder="Например: Исправление критической уязвимости"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-muted text-foreground outline-none focus:border-indigo-500 placeholder-muted-foreground"
                />
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 border border-border text-muted-foreground hover:bg-muted rounded-lg text-xs font-semibold transition-colors"
              >
                Отмена
              </button>
              
              <button
                type="button"
                onClick={() => {
                  if (!changeDescription.trim()) {
                    alert('Пожалуйста, укажите описание изменений.');
                    return;
                  }
                  submitForm();
                }}
                disabled={isSubmitting}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-md shadow-indigo-600/10 transition-colors"
              >
                {isSubmitting ? 'Сохранение...' : 'Подтвердить и сохранить'}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
      </div>
    </div>
  );
}
