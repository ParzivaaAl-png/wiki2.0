import { Request, Response } from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as dns from 'dns/promises';
import * as fs from 'fs';
import * as net from 'net';
import * as path from 'path';
import { randomUUID } from 'crypto';
import sanitizeHtml from 'sanitize-html';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as ArticleModel from '../models/article';
import * as msService from '../services/meilisearch';
import { parseDocument } from '../services/parser';
import { AuthenticatedRequest } from '../middleware/auth';
import { query } from '../config/db';
import { getUserAllowedSections } from '../models/orgStructure';
import { canCreateInSections, canEditArticle, canRestoreArticle, getUserCapabilities, isWikiAdmin } from '../services/accessControl';
import {
  getClientIp,
  isIpAllowedBySettings,
  logSecurityEvent,
  normalizeIpRestrictionSettings,
} from '../services/security';

const execFileAsync = promisify(execFile);
const UPLOADS_ROOT = path.join(__dirname, '../../uploads');
const IMPORT_SESSIONS_ROOT = path.join(UPLOADS_ROOT, 'import-sessions');

type GuestAccessGrant = {
  article_id: number | null;
  section_id: number | null;
  expires_at: Date | string;
};

type GuestAccessInfo = {
  type: 'article' | 'section';
  expires_at: string;
  article_id: number | null;
  section_id: number | null;
};

const toIsoString = (value: Date | string) => new Date(value).toISOString();

type DocumentImportSessionRow = {
  id: string;
  user_id: number | null;
  original_file_name: string;
  mime_type: string | null;
  file_ext: string | null;
  original_file_path: string;
  working_file_path: string;
  preview_html: string | null;
  title: string;
  summary: string | null;
  status: string;
  article_id: number | null;
  source_url: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  expires_at: Date | string;
};

const normalizePublicOrigin = (value: string) => (
  value
    .replace(/\/api\/?$/i, '')
    .replace(/\/$/, '')
);

const getPublicOrigin = (req: Request) => (
  normalizePublicOrigin(
    process.env.PUBLIC_BACKEND_URL ||
    process.env.API_PUBLIC_URL ||
    `${req.protocol}://${req.get('host')}`
  )
);

const getOnlyOfficeServerUrl = () => (
  (process.env.ONLYOFFICE_DOCUMENT_SERVER_URL || process.env.ONLYOFFICE_DOCS_URL || '').replace(/\/$/, '')
);

const getUploadUrl = (filePath: string) => {
  const relative = path.relative(UPLOADS_ROOT, filePath);
  return `/uploads/${relative.split(path.sep).map(encodeURIComponent).join('/')}`;
};

const getAbsoluteUploadUrl = (req: Request, filePath: string) => `${getPublicOrigin(req)}${getUploadUrl(filePath)}`;

const sanitizeFileName = (fileName: string) => (
  fileName
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180) || `document-${Date.now()}`
);

const slugifyTitle = (title: string, suffix: string | number = Date.now()) => {
  const base = title
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u0400-\u04FF-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');

  return `${base || 'imported-document'}-${suffix}`;
};

const getFallbackImportPreview = (originalName: string, errorMessage?: string) => {
  const ext = path.extname(originalName).toLowerCase();
  const title = path.basename(originalName, ext).replace(/[_-]/g, ' ').trim() || 'Импортированный документ';
  const note = errorMessage
    ? `<p>Встроенный HTML-предпросмотр недоступен: ${errorMessage}</p>`
    : '<p>Предпросмотр для этого формата недоступен, но оригинальный файл сохранён.</p>';

  return {
    title,
    content: [
      '<div class="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900">',
      '<h3>Оригинальный документ сохранён</h3>',
      note,
      '<p>Скачайте оригинал или откройте рабочую копию в исходном формате, если нужно сохранить сложное форматирование без потерь.</p>',
      '</div>',
    ].join(''),
    summary: `Импортирован файл "${originalName}". Точное отображение хранится в оригинальном документе.`,
  };
};

const parseDocumentSafely = async (filePath: string, originalName: string) => {
  try {
    return await parseDocument(filePath, originalName);
  } catch (error: any) {
    return getFallbackImportPreview(originalName, error?.message || 'формат не поддерживается');
  }
};

const isPrivateIpAddress = (address: string) => {
  if (net.isIP(address) === 4) {
    const parts = address.split('.').map(Number);
    const [a, b] = parts;
    return (
      a === 10 ||
      a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      a === 0
    );
  }

  if (net.isIP(address) === 6) {
    const normalized = address.toLowerCase();
    return (
      normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe80:')
    );
  }

  return false;
};

const validateWebsiteImportUrl = async (rawUrl: string) => {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Некорректная ссылка на сайт.');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Можно импортировать только http/https страницы.');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname === '0.0.0.0' ||
    hostname === '::1'
  ) {
    throw new Error('Внутренние адреса нельзя использовать для импорта.');
  }

  if (net.isIP(hostname) && isPrivateIpAddress(hostname)) {
    throw new Error('Внутренние адреса нельзя использовать для импорта.');
  }

  const addresses = await dns.lookup(hostname, { all: true }).catch(() => []);
  if (addresses.some((entry) => isPrivateIpAddress(entry.address))) {
    throw new Error('Адрес сайта указывает на внутреннюю сеть, импорт заблокирован.');
  }

  return parsed;
};

const normalizeExternalUrl = (value: string | undefined, baseUrl: string) => {
  if (!value) return value;
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
};

const sanitizeImportedWebsiteHtml = (html: string) => sanitizeHtml(html, {
  allowedTags: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's',
    'blockquote', 'pre', 'code',
    'ul', 'ol', 'li',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'a', 'img',
    'div', 'span',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    '*': ['style', 'class'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: {
    img: ['http', 'https', 'data'],
  },
  allowedStyles: {
    '*': {
      color: [/^#(0x)?[0-9a-f]+$/i, /^rgb\(/i, /^rgba\(/i],
      'background-color': [/^#(0x)?[0-9a-f]+$/i, /^rgb\(/i, /^rgba\(/i],
      'font-weight': [/^\d+$/, /^(bold|normal|bolder|lighter)$/],
      'font-style': [/^(italic|normal)$/],
      'text-align': [/^(left|right|center|justify)$/],
      'text-decoration': [/^(underline|line-through|none)$/],
      'padding-left': [/^\d+(px|rem|em)$/],
      'margin-left': [/^\d+(px|rem|em)$/],
    },
  },
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }, true),
  },
});

const extractWebsiteContent = (html: string, sourceUrl: string) => {
  const $ = cheerio.load(html);
  $('script, style, noscript, template, svg, canvas, form, input, button').remove();

  $('a[href]').each((_, element) => {
    const href = $(element).attr('href');
    $(element).attr('href', normalizeExternalUrl(href, sourceUrl));
  });

  $('img[src]').each((_, element) => {
    const src = $(element).attr('src');
    $(element).attr('src', normalizeExternalUrl(src, sourceUrl));
  });

  const title = (
    $('meta[property="og:title"]').attr('content') ||
    $('meta[name="twitter:title"]').attr('content') ||
    $('h1').first().text() ||
    $('title').first().text() ||
    new URL(sourceUrl).hostname
  ).replace(/\s+/g, ' ').trim();

  const summary = (
    $('meta[name="description"]').attr('content') ||
    $('meta[property="og:description"]').attr('content') ||
    $('p').first().text() ||
    `Импортировано с сайта ${sourceUrl}`
  ).replace(/\s+/g, ' ').trim().slice(0, 300);

  const contentRoot = $('article').first().length
    ? $('article').first()
    : ($('main').first().length ? $('main').first() : $('[role="main"]').first());
  const selectedHtml = contentRoot.length ? contentRoot.html() || '' : $('body').html() || '';
  const sanitized = sanitizeImportedWebsiteHtml(selectedHtml);

  return {
    title: title || 'Импорт с сайта',
    summary,
    content: sanitized || `<p>Контент страницы не удалось выделить автоматически. Исходный HTML сохранён.</p><p><a href="${sourceUrl}" target="_blank" rel="noopener noreferrer">${sourceUrl}</a></p>`,
  };
};

const getImportSessionById = async (id: string): Promise<DocumentImportSessionRow | null> => {
  const result = await query('SELECT * FROM document_import_sessions WHERE id = $1', [id]);
  return result.rows.length ? result.rows[0] : null;
};

const canAccessImportSession = (session: DocumentImportSessionRow, user?: AuthenticatedRequest['user']) => {
  if (!user) return false;
  return user.role === 'Admin' || user.role === 'Администратор Wiki' || session.user_id === user.id;
};

const buildOnlyOfficeConfig = (req: AuthenticatedRequest, session: DocumentImportSessionRow) => {
  const documentServerUrl = getOnlyOfficeServerUrl();
  const ext = (session.file_ext || '').replace('.', '').toLowerCase();
  const isDocx = ext === 'docx';

  if (!documentServerUrl || !isDocx) {
    return {
      enabled: false,
      documentServerUrl: documentServerUrl || null,
      reason: isDocx
        ? 'ONLYOFFICE Document Server не настроен.'
        : 'Нативное редактирование доступно только для DOCX.',
    };
  }

  const publicOrigin = getPublicOrigin(req);

  return {
    enabled: true,
    documentServerUrl,
    config: {
      documentType: 'word',
      width: '100%',
      height: '100%',
      document: {
        fileType: ext,
        key: `${session.id}-${new Date(session.updated_at).getTime()}`.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128),
        title: session.original_file_name,
        url: getAbsoluteUploadUrl(req, session.working_file_path),
        permissions: {
          edit: true,
          download: true,
          print: true,
          review: true,
        },
      },
      editorConfig: {
        mode: 'edit',
        lang: 'ru',
        callbackUrl: `${publicOrigin}/api/articles/import-sessions/${session.id}/onlyoffice/callback`,
        user: {
          id: String(req.user?.id || 'system'),
          name: req.user?.name || 'Wiki user',
        },
        customization: {
          autosave: true,
          forcesave: true,
        },
      },
    },
  };
};

const serializeImportSession = (req: AuthenticatedRequest, session: DocumentImportSessionRow) => ({
  id: session.id,
  original_file_name: session.original_file_name,
  mime_type: session.mime_type,
  file_ext: session.file_ext,
  title: session.title,
  slug: slugifyTitle(session.title, new Date(session.created_at).getTime()),
  summary: session.summary || '',
  preview_html: session.preview_html || '',
  status: session.status,
  article_id: session.article_id,
  source_url: session.source_url,
  created_at: session.created_at,
  updated_at: session.updated_at,
  expires_at: session.expires_at,
  original_url: getUploadUrl(session.original_file_path),
  working_url: getUploadUrl(session.working_file_path),
  original_absolute_url: getAbsoluteUploadUrl(req, session.original_file_path),
  working_absolute_url: getAbsoluteUploadUrl(req, session.working_file_path),
  onlyoffice: buildOnlyOfficeConfig(req, session),
});

const indexImportedArticleIfNeeded = async (article: ArticleModel.Article) => {
  if (article.published && article.is_visible && article.status === 'published') {
    const doc: msService.ArticleDocument = {
      id: article.id,
      title: article.title,
      slug: article.slug,
      content: article.content,
      summary: article.summary,
      categoryName: '',
      tags: article.tags,
      published: article.published,
      createdAt: article.created_at.toISOString(),
      section_ids: article.section_ids,
    };
    await msService.indexArticle(doc);
  }
};

type MandatoryAckSettings = {
  enabled: boolean;
  target_user_ids: number[];
  target_department_ids: number[];
  target_position_ids: number[];
  start_at: string | null;
  due_days: number;
  due_at: string | null;
  require_reacknowledgement: boolean;
  notifications_enabled: boolean;
  reminders_enabled: boolean;
};

type ArticleIpRestrictionInput = {
  enabled: boolean;
  allowed_ranges: string[];
  apply_to_attachments: boolean;
};

const normalizeNumberIds = (value: unknown): number[] => {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => Number(item)).filter((id) => Number.isFinite(id) && id > 0)));
};

const normalizeMandatoryAckSettings = (input: any): MandatoryAckSettings => ({
  enabled: !!input?.enabled,
  target_user_ids: normalizeNumberIds(input?.target_user_ids),
  target_department_ids: normalizeNumberIds(input?.target_department_ids),
  target_position_ids: normalizeNumberIds(input?.target_position_ids),
  start_at: input?.start_at || null,
  due_days: Math.max(1, Math.min(365, Number(input?.due_days || 7))),
  due_at: input?.due_at || null,
  require_reacknowledgement: !!input?.require_reacknowledgement,
  notifications_enabled: input?.notifications_enabled !== false,
  reminders_enabled: !!input?.reminders_enabled,
});

const normalizeArticleIpRestriction = (input: any): ArticleIpRestrictionInput => {
  const settings = normalizeIpRestrictionSettings(input);
  return {
    enabled: settings.enabled,
    allowed_ranges: settings.allowed_ranges,
    apply_to_attachments: settings.apply_to_attachments,
  };
};

const syncArticleIpRestriction = async (articleId: number, input: any) => {
  const settings = normalizeArticleIpRestriction(input);
  await query(
    `UPDATE articles
     SET ip_restriction_enabled = $2,
         ip_restriction_settings = $3,
         updated_at = updated_at
     WHERE id = $1`,
    [
      articleId,
      settings.enabled,
      JSON.stringify(settings),
    ]
  );
};

const enforceArticleIpRestriction = async (
  req: Request,
  article: ArticleModel.Article,
  action: string
) => {
  const settings = normalizeIpRestrictionSettings({
    ...(article.ip_restriction_settings || {}),
    enabled: !!article.ip_restriction_enabled,
  });

  if (!settings.enabled) return true;

  const authReq = req as AuthenticatedRequest;
  const clientIp = getClientIp(req);
  const allowed = isIpAllowedBySettings(clientIp, settings);

  await logSecurityEvent({
    req,
    actorUserId: authReq.user?.id || null,
    articleId: article.id,
    action,
    status: allowed ? 'allowed' : 'denied',
    metadata: {
      article_title: article.title,
      allowed_ranges: settings.allowed_ranges,
      apply_to_attachments: settings.apply_to_attachments,
    },
  });

  return allowed;
};

const filterSearchResultsByIpRestriction = async <T extends { id: number }>(
  req: Request,
  results: T[]
) => {
  if (!results.length) return results;

  const articleIds = results.map((item) => Number(item.id)).filter(Boolean);
  const restrictionResult = await query(
    `SELECT id, title, ip_restriction_enabled, ip_restriction_settings
     FROM articles
     WHERE id = ANY($1::int[])
       AND ip_restriction_enabled = true`,
    [articleIds]
  );

  if (restrictionResult.rows.length === 0) return results;

  const restrictions = new Map<number, ArticleModel.Article>(
    restrictionResult.rows.map((row) => [Number(row.id), row as ArticleModel.Article])
  );

  const allowedResults: T[] = [];
  for (const item of results) {
    const restrictedArticle = restrictions.get(Number(item.id));
    if (!restrictedArticle) {
      allowedResults.push(item);
      continue;
    }

    const allowed = await enforceArticleIpRestriction(req, restrictedArticle, 'restricted_article_search');
    if (allowed) {
      allowedResults.push(item);
    }
  }

  return allowedResults;
};

const getArticleVersionKey = (article: Pick<ArticleModel.Article, 'id' | 'updated_at'>) => (
  `article-${article.id}-${new Date(article.updated_at).getTime()}`
);

const getAssignmentEffectiveStatus = (assignment: any) => {
  if (!assignment) return null;
  if (assignment.acknowledged_at) return 'acknowledged';
  if (assignment.due_at && new Date(assignment.due_at).getTime() < Date.now()) return 'overdue';
  if (assignment.read_completed_at) return 'read_completed';
  if (assignment.first_viewed_at) return 'in_progress';
  return assignment.status || 'not_open';
};

const resolveMandatoryAckCandidates = async (settings: MandatoryAckSettings) => {
  const result = await query(
    `SELECT
       u.id AS user_id,
       u.username,
       u.name AS user_name,
       u.role,
       e.id AS employee_id,
       e.department_id,
       d.name AS department_name,
       e.position_id,
       p.name AS position_name,
       e.manager_id,
       m.full_name AS manager_name
     FROM users u
     JOIN employees e ON e.id = u.employee_id
     LEFT JOIN departments d ON d.id = e.department_id
     LEFT JOIN positions p ON p.id = e.position_id
     LEFT JOIN employees m ON m.id = e.manager_id
     WHERE u.is_blocked = false AND e.is_active = true
     ORDER BY u.name ASC`
  );

  const hasExplicitTargets =
    settings.target_user_ids.length > 0 ||
    settings.target_department_ids.length > 0 ||
    settings.target_position_ids.length > 0;

  if (!hasExplicitTargets) return [];

  return result.rows.filter((row) => (
    settings.target_user_ids.includes(Number(row.user_id)) ||
    settings.target_department_ids.includes(Number(row.department_id)) ||
    settings.target_position_ids.includes(Number(row.position_id))
  ));
};

const userCanAccessArticleSections = async (candidate: any, articleSectionIds: number[]) => {
  if (articleSectionIds.length === 0) return true;
  const allowedSectionIds = await getUserAllowedSections(candidate.employee_id, candidate.role || 'User', candidate.user_id);
  return articleSectionIds.some((sectionId) => allowedSectionIds.includes(sectionId));
};

const createMandatoryNotifications = async (assignments: any[], article: ArticleModel.Article, dueAt: Date | null) => {
  if (assignments.length === 0) return;
  await Promise.all(assignments.map((assignment) => query(
    `INSERT INTO notifications (user_id, title, message, type)
     VALUES ($1, $2, $3, 'warning')`,
    [
      assignment.user_id,
      `Обязательное ознакомление: ${article.title}`,
      `Вам назначена обязательная статья "${article.title}". Срок: ${dueAt ? dueAt.toLocaleDateString('ru-RU') : 'не указан'}.`,
    ]
  ).catch((err) => console.error('Failed to create mandatory acknowledgement notification:', err))));
};

const syncMandatoryAcknowledgementAssignments = async (
  article: ArticleModel.Article,
  rawSettings: any,
  user: AuthenticatedRequest['user'],
  forceNewVersion: boolean
) => {
  const settings = normalizeMandatoryAckSettings(rawSettings);
  await query(
    `UPDATE articles
     SET mandatory_ack_enabled = $2,
         mandatory_ack_settings = $3
     WHERE id = $1`,
    [article.id, settings.enabled, settings.enabled ? JSON.stringify(settings) : null]
  );

  if (!settings.enabled) {
    await query(
      `UPDATE mandatory_ack_assignments
       SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
       WHERE article_id = $1 AND acknowledged_at IS NULL`,
      [article.id]
    );
    return;
  }

  const existing = await query('SELECT COUNT(*)::int AS count FROM mandatory_ack_assignments WHERE article_id = $1', [article.id]);
  const shouldCreateAssignments = forceNewVersion || Number(existing.rows[0]?.count || 0) === 0;
  if (!shouldCreateAssignments) return;

  const articleSectionIds = article.section_ids || [];
  const candidates = await resolveMandatoryAckCandidates(settings);
  const eligibleCandidates = [];
  for (const candidate of candidates) {
    if (await userCanAccessArticleSections(candidate, articleSectionIds)) {
      eligibleCandidates.push(candidate);
    }
  }

  const startAt = settings.start_at ? new Date(settings.start_at) : new Date();
  const dueAt = settings.due_at
    ? new Date(settings.due_at)
    : new Date(startAt.getTime() + settings.due_days * 24 * 60 * 60 * 1000);
  const version = getArticleVersionKey(article);
  const initialStatus = forceNewVersion ? 'requires_reacknowledgement' : 'not_open';

  await query(
    `UPDATE mandatory_ack_assignments
     SET status = 'superseded', updated_at = CURRENT_TIMESTAMP
     WHERE article_id = $1 AND acknowledged_at IS NULL AND article_version <> $2`,
    [article.id, version]
  );

  const insertedAssignments: any[] = [];
  for (const candidate of eligibleCandidates) {
    const inserted = await query(
      `INSERT INTO mandatory_ack_assignments (
         article_id,
         user_id,
         employee_id,
         article_version,
         assigned_by,
         start_at,
         due_at,
         status,
         department_id,
         department_name,
         position_id,
         position_name,
         manager_id,
         manager_name
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (article_id, user_id, article_version) DO UPDATE SET
         start_at = EXCLUDED.start_at,
         due_at = EXCLUDED.due_at,
         department_id = EXCLUDED.department_id,
         department_name = EXCLUDED.department_name,
         position_id = EXCLUDED.position_id,
         position_name = EXCLUDED.position_name,
         manager_id = EXCLUDED.manager_id,
         manager_name = EXCLUDED.manager_name,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        article.id,
        candidate.user_id,
        candidate.employee_id,
        version,
        user?.id || null,
        startAt,
        dueAt,
        initialStatus,
        candidate.department_id,
        candidate.department_name,
        candidate.position_id,
        candidate.position_name,
        candidate.manager_id,
        candidate.manager_name,
      ]
    );
    insertedAssignments.push(inserted.rows[0]);
  }

  if (eligibleCandidates.length > 0) {
    const eligibleIds = eligibleCandidates.map((candidate) => Number(candidate.user_id));
    await query(
      `UPDATE mandatory_ack_assignments
       SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
       WHERE article_id = $1
         AND article_version = $2
         AND acknowledged_at IS NULL
         AND NOT (user_id = ANY($3::int[]))`,
      [article.id, version, eligibleIds]
    );
  }

  if (settings.notifications_enabled) {
    await createMandatoryNotifications(insertedAssignments, article, dueAt);
  }
};

const extractInternalArticleReferences = (content: string) => {
  const articleIds = new Set<number>();
  const slugs = new Set<string>();

  const idRegex = /data-article-id=["'](\d+)["']/gi;
  let idMatch: RegExpExecArray | null;
  while ((idMatch = idRegex.exec(content || '')) !== null) {
    const id = Number(idMatch[1]);
    if (Number.isFinite(id) && id > 0) articleIds.add(id);
  }

  const hrefRegex = /href=["'][^"']*\/articles\/([^"'?#\s]+)(?:[?#][^"']*)?["']/gi;
  let slugMatch: RegExpExecArray | null;
  while ((slugMatch = hrefRegex.exec(content || '')) !== null) {
    try {
      slugs.add(decodeURIComponent(slugMatch[1]));
    } catch {
      slugs.add(slugMatch[1]);
    }
  }

  return {
    articleIds: Array.from(articleIds),
    slugs: Array.from(slugs),
  };
};

const syncContentArticleLinks = async (sourceArticleId: number, content: string) => {
  const references = extractInternalArticleReferences(content);
  const targetIds = new Set<number>(
    references.articleIds.filter((targetId) => targetId !== sourceArticleId)
  );

  if (references.slugs.length > 0) {
    const slugResult = await query(
      'SELECT id FROM articles WHERE slug = ANY($1::text[]) AND id <> $2',
      [references.slugs, sourceArticleId]
    );
    slugResult.rows.forEach((row) => {
      const id = Number(row.id);
      if (Number.isFinite(id) && id > 0) targetIds.add(id);
    });
  }

  const targetArticleIds = Array.from(targetIds);

  if (targetArticleIds.length === 0) {
    await query(
      `DELETE FROM article_links
       WHERE source_article_id = $1
         AND link_source = 'content'`,
      [sourceArticleId]
    );
    return;
  }

  await query(
    `DELETE FROM article_links
     WHERE source_article_id = $1
       AND link_source = 'content'
       AND NOT (target_article_id = ANY($2::int[]))`,
    [sourceArticleId, targetArticleIds]
  );

  await query(
    `INSERT INTO article_links (source_article_id, target_article_id, link_text, link_source)
     SELECT $1, target_id, $3, 'content'
     FROM unnest($2::int[]) AS target_ids(target_id)
     WHERE target_id <> $1
       AND EXISTS (SELECT 1 FROM articles WHERE id = target_id)
     ON CONFLICT (source_article_id, target_article_id)
     DO UPDATE SET
       link_text = CASE
         WHEN COALESCE(article_links.link_source, 'manual') = 'content' THEN EXCLUDED.link_text
         ELSE article_links.link_text
       END,
       link_source = CASE
         WHEN COALESCE(article_links.link_source, 'manual') = 'manual' THEN article_links.link_source
         ELSE EXCLUDED.link_source
       END`,
    [sourceArticleId, targetArticleIds, 'Внутренняя ссылка']
  );
};

type ArticleVersionSource =
  | 'initial'
  | 'save'
  | 'publish'
  | 'import_draft'
  | 'import_publish'
  | 'restore'
  | 'sync';

type ArticleVersionSnapshotOptions = {
  source_type: ArticleVersionSource;
  change_comment?: string | null;
  editor_comment?: string | null;
  restored_from_version_id?: number | null;
  restored_from_version_number?: number | null;
  restore_comment?: string | null;
  created_by?: number | null;
};

const toJsonbParam = (value: unknown, fallback: unknown = null) => (
  value === undefined ? JSON.stringify(fallback) : JSON.stringify(value)
);

const getRequestSessionId = async (req: Request): Promise<number | null> => {
  const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
  if (!refreshToken) return null;

  try {
    const sessionResult = await query(
      'SELECT id FROM user_sessions WHERE refresh_token = $1 LIMIT 1',
      [refreshToken]
    );
    return sessionResult.rows[0]?.id ? Number(sessionResult.rows[0].id) : null;
  } catch (error) {
    console.error('Failed to resolve session for article version snapshot:', error);
    return null;
  }
};

const createArticleVersionSnapshot = async (
  req: Request,
  articleId: number,
  options: ArticleVersionSnapshotOptions
) => {
  const article = await ArticleModel.getArticleById(articleId);
  if (!article) {
    throw new Error('Article not found for version snapshot.');
  }

  const authReq = req as AuthenticatedRequest;
  const nextVersionResult = await query(
    'SELECT COALESCE(MAX(version_number), 0) + 1 AS version_number FROM article_versions WHERE article_id = $1',
    [article.id]
  );
  const versionNumber = Number(nextVersionResult.rows[0]?.version_number || 1);
  const sessionId = await getRequestSessionId(req);

  const result = await query(
    `INSERT INTO article_versions (
       article_id,
       version_number,
       title,
       slug,
       content,
       summary,
       status,
       published,
       is_visible,
       tags,
       section_ids,
       article_type,
       owner_id,
       approver_id,
       source_url,
       sync_interval,
       structured_data,
       mandatory_ack_enabled,
       mandatory_ack_settings,
       ip_restriction_enabled,
       ip_restriction_settings,
       created_by,
       change_comment,
       editor_comment,
       source_type,
       restored_from_version_id,
       restored_from_version_number,
       restore_comment,
       ip_address,
       session_id,
       user_agent
     )
     VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9,
       $10, $11, $12, $13, $14, $15, $16, $17,
       $18, $19, $20, $21, $22, $23, $24, $25,
       $26, $27, $28, $29, $30, $31
     )
     RETURNING *`,
    [
      article.id,
      versionNumber,
      article.title,
      article.slug,
      article.content,
      article.summary || '',
      article.status || (article.published ? 'published' : 'draft'),
      !!article.published,
      article.is_visible !== false,
      toJsonbParam(article.tags || [], []),
      article.section_ids || [],
      article.article_type || 'general',
      article.owner_id || null,
      article.approver_id || null,
      article.source_url || null,
      article.sync_interval || 'manual',
      toJsonbParam(article.structured_data, null),
      !!article.mandatory_ack_enabled,
      article.mandatory_ack_enabled ? toJsonbParam(article.mandatory_ack_settings || null, null) : null,
      !!article.ip_restriction_enabled,
      article.ip_restriction_enabled ? toJsonbParam(article.ip_restriction_settings || null, null) : null,
      options.created_by !== undefined ? options.created_by : authReq.user?.id || null,
      options.change_comment || null,
      options.editor_comment || null,
      options.source_type,
      options.restored_from_version_id || null,
      options.restored_from_version_number || null,
      options.restore_comment || null,
      getClientIp(req),
      sessionId,
      req.headers['user-agent'] || '',
    ]
  );

  return result.rows[0];
};

const canViewArticleVersions = async (req: Request, article: ArticleModel.Article) => {
  const authReq = req as AuthenticatedRequest;
  if (await canEditArticle(authReq.user?.id, authReq.user?.role, article)) {
    return true;
  }

  if (!article.published || !article.is_visible || article.status !== 'published') {
    return false;
  }

  const allowedSectionIds = await getAllowedSectionsForRequest(req);
  return (article.section_ids || []).some((sectionId) => allowedSectionIds.includes(Number(sectionId)));
};

const getActiveGuestAccessGrants = async (userId: number): Promise<GuestAccessGrant[]> => {
  if (!userId) return [];

  const result = await query(
    `SELECT article_id, section_id, expires_at
     FROM guest_access
     WHERE user_id = $1
       AND status = 'Active'
       AND expires_at > CURRENT_TIMESTAMP`,
    [userId]
  );

  return result.rows;
};

const getGuestAccessInfoForArticle = (
  grants: GuestAccessGrant[],
  articleId: number,
  sectionIds: number[] = []
): GuestAccessInfo | null => {
  const normalizedSectionIds = sectionIds.map(Number);
  const matching = grants
    .filter((grant) => {
      const grantArticleId = grant.article_id ? Number(grant.article_id) : null;
      const grantSectionId = grant.section_id ? Number(grant.section_id) : null;
      return grantArticleId === Number(articleId) || (grantSectionId !== null && normalizedSectionIds.includes(grantSectionId));
    })
    .sort((a, b) => new Date(b.expires_at).getTime() - new Date(a.expires_at).getTime());

  if (!matching.length) return null;

  const grant = matching[0];
  return {
    type: grant.article_id ? 'article' : 'section',
    expires_at: toIsoString(grant.expires_at),
    article_id: grant.article_id ? Number(grant.article_id) : null,
    section_id: grant.section_id ? Number(grant.section_id) : null,
  };
};

const getGuestAccessInfoForSection = (
  grants: GuestAccessGrant[],
  sectionId: number
): GuestAccessInfo | null => {
  const matching = grants
    .filter((grant) => grant.section_id && Number(grant.section_id) === Number(sectionId))
    .sort((a, b) => new Date(b.expires_at).getTime() - new Date(a.expires_at).getTime());

  if (!matching.length) return null;

  const grant = matching[0];
  return {
    type: 'section',
    expires_at: toIsoString(grant.expires_at),
    article_id: null,
    section_id: Number(grant.section_id),
  };
};

// Получение списка разрешенных разделов для запроса
const getAllowedSectionsForRequest = async (req: Request): Promise<number[]> => {
  const authReq = req as AuthenticatedRequest;
  const employeeId = authReq.user ? authReq.user.employee_id : null;
  const role = authReq.user ? authReq.user.role : '';
  const userId = authReq.user ? authReq.user.id : undefined;
  return getUserAllowedSections(employeeId, role, userId);
};

export const getArticles = async (req: Request, res: Response) => {
  try {
    const { tag, all, filter, mandatory } = req.query;
    const authReq = req as AuthenticatedRequest;
    const role = authReq.user ? authReq.user.role : '';
    const userId = authReq.user ? authReq.user.id : 0;
    const employeeId = authReq.user ? authReq.user.employee_id : null;

    const allowedSectionIds = await getUserAllowedSections(employeeId, role, userId);
    const activeGuestGrants = userId ? await getActiveGuestAccessGrants(userId) : [];
    const { capabilities } = await getUserCapabilities(userId || null, role);
    const canManageCatalog =
      !!authReq.user &&
      (capabilities.can_manage_access || capabilities.can_manage_structure || capabilities.can_manage_users);
    const canEditCatalog =
      !!authReq.user &&
      (canManageCatalog ||
        capabilities.can_create ||
        capabilities.can_edit ||
        capabilities.can_publish ||
        capabilities.can_approve);
    const includeHidden = all === 'true' && canEditCatalog;

    let allowedStatuses = ['published', 'requires_verification'];
    if (canManageCatalog) {
      allowedStatuses = ['draft', 'on_approval', 'published', 'requires_verification', 'archived', 'expired'];
    } else if (canEditCatalog) {
      allowedStatuses = ['published', 'requires_verification', 'archived', 'expired'];
    }

    let articles: any[] = [];
    if (filter === 'new') {
      const resData = await query(
        `SELECT a.id, a.title, a.slug, '' as content, a.summary, a.category_id, a.author_id, a.published, a.is_visible, a.status, a.views, a.position, a.created_at, a.updated_at, a.article_type, a.owner_id, a.approver_id, a.source_url, a.sync_interval, a.last_sync_at, a.next_sync_at, a.structured_data, a.mandatory_ack_enabled, a.mandatory_ack_settings, a.ip_restriction_enabled, a.ip_restriction_settings, u.name as author_name,
                COALESCE(array_agg(DISTINCT t.tag_name) FILTER (WHERE t.tag_name IS NOT NULL), '{}') as tags,
                COALESCE(array_agg(DISTINCT axs.section_id) FILTER (WHERE axs.section_id IS NOT NULL), '{}') as section_ids
         FROM articles a
         LEFT JOIN users u ON a.author_id = u.id
         LEFT JOIN article_tags t ON a.id = t.article_id
         LEFT JOIN article_sections axs ON a.id = axs.article_id
         WHERE a.is_visible = true 
           AND (a.status = ANY($2::varchar[]) OR a.author_id = $3)
           AND axs.section_id = ANY($1::int[])
         GROUP BY a.id, u.name
         ORDER BY a.created_at DESC`,
        [allowedSectionIds, allowedStatuses, userId]
      );
      articles = resData.rows;
    } else if (filter === 'popular') {
      const resData = await query(
        `SELECT a.id, a.title, a.slug, '' as content, a.summary, a.category_id, a.author_id, a.published, a.is_visible, a.status, a.views, a.position, a.created_at, a.updated_at, a.article_type, a.owner_id, a.approver_id, a.source_url, a.sync_interval, a.last_sync_at, a.next_sync_at, a.structured_data, a.mandatory_ack_enabled, a.mandatory_ack_settings, a.ip_restriction_enabled, a.ip_restriction_settings, u.name as author_name,
                COALESCE(array_agg(DISTINCT t.tag_name) FILTER (WHERE t.tag_name IS NOT NULL), '{}') as tags,
                COALESCE(array_agg(DISTINCT axs.section_id) FILTER (WHERE axs.section_id IS NOT NULL), '{}') as section_ids
         FROM articles a
         LEFT JOIN users u ON a.author_id = u.id
         LEFT JOIN article_tags t ON a.id = t.article_id
         LEFT JOIN article_sections axs ON a.id = axs.article_id
         WHERE a.is_visible = true
           AND (a.status = ANY($2::varchar[]) OR a.author_id = $3)
           AND axs.section_id = ANY($1::int[])
         GROUP BY a.id, u.name
         ORDER BY a.views DESC, a.created_at DESC`,
        [allowedSectionIds, allowedStatuses, userId]
      );
      articles = resData.rows;
    } else if (filter === 'actual' || filter === 'trending') {
      const resData = await query(
        `SELECT a.id, a.title, a.slug, '' as content, a.summary, a.category_id, a.author_id, a.published, a.is_visible, a.status, a.views, a.position, a.created_at, a.updated_at, a.article_type, a.owner_id, a.approver_id, a.source_url, a.sync_interval, a.last_sync_at, a.next_sync_at, a.structured_data, a.mandatory_ack_enabled, a.mandatory_ack_settings, a.ip_restriction_enabled, a.ip_restriction_settings, COUNT(DISTINCT COALESCE(vl.user_id::text, vl.ip_address)) as trending_views, u.name as author_name,
                COALESCE(array_agg(DISTINCT t.tag_name) FILTER (WHERE t.tag_name IS NOT NULL), '{}') as tags,
                COALESCE(array_agg(DISTINCT axs.section_id) FILTER (WHERE axs.section_id IS NOT NULL), '{}') as section_ids
         FROM articles a
         LEFT JOIN users u ON a.author_id = u.id
         LEFT JOIN article_tags t ON a.id = t.article_id
         LEFT JOIN article_sections axs ON a.id = axs.article_id
         LEFT JOIN article_views_log vl ON a.id = vl.article_id AND vl.viewed_at > NOW() - INTERVAL '7 days'
         WHERE a.is_visible = true
           AND (a.status = ANY($2::varchar[]) OR a.author_id = $3)
           AND axs.section_id = ANY($1::int[])
         GROUP BY a.id, u.name
         ORDER BY trending_views DESC, a.views DESC, a.created_at DESC`,
        [allowedSectionIds, allowedStatuses, userId]
      );
      articles = resData.rows;
    } else if (filter === 'recommended') {
      const resData = await query(
        `SELECT a.id, a.title, a.slug, '' as content, a.summary, a.category_id, a.author_id, a.published, a.is_visible, a.status, a.views, a.position, a.created_at, a.updated_at, a.article_type, a.owner_id, a.approver_id, a.source_url, a.sync_interval, a.last_sync_at, a.next_sync_at, a.structured_data, a.mandatory_ack_enabled, a.mandatory_ack_settings, a.ip_restriction_enabled, a.ip_restriction_settings, COUNT(fa.user_id) as favorites_count, u.name as author_name,
                COALESCE(array_agg(DISTINCT t.tag_name) FILTER (WHERE t.tag_name IS NOT NULL), '{}') as tags,
                COALESCE(array_agg(DISTINCT axs.section_id) FILTER (WHERE axs.section_id IS NOT NULL), '{}') as section_ids
         FROM articles a
         LEFT JOIN users u ON a.author_id = u.id
         LEFT JOIN article_tags t ON a.id = t.article_id
         LEFT JOIN article_sections axs ON a.id = axs.article_id
         LEFT JOIN user_favorite_articles fa ON a.id = fa.article_id
         WHERE a.is_visible = true
           AND (a.status = ANY($2::varchar[]) OR a.author_id = $3)
           AND axs.section_id = ANY($1::int[])
         GROUP BY a.id, u.name
         ORDER BY favorites_count DESC, a.views DESC, a.created_at DESC`,
        [allowedSectionIds, allowedStatuses, userId]
      );
      articles = resData.rows;
    } else {
      articles = await ArticleModel.getAllArticles({
        publishedOnly: !includeHidden,
        tag: tag as string,
        all: includeHidden,
        allowedSectionIds,
        allowedStatuses,
        authorId: canEditCatalog ? userId : undefined
      });
    }

    const directGuestArticleIds = Array.from(new Set(
      activeGuestGrants
        .map((grant) => grant.article_id ? Number(grant.article_id) : null)
        .filter((id): id is number => id !== null)
    ));
    const existingArticleIds = new Set(articles.map((article) => Number(article.id)));
    const missingDirectGuestArticleIds = directGuestArticleIds.filter((id) => !existingArticleIds.has(id));

    if (missingDirectGuestArticleIds.length > 0) {
      const directGuestArticlesRes = await query(
        `SELECT a.id, a.title, a.slug, '' as content, a.summary, a.category_id, a.author_id, a.published, a.is_visible, a.status, a.views, a.position, a.created_at, a.updated_at, a.article_type, a.owner_id, a.approver_id, a.source_url, a.sync_interval, a.last_sync_at, a.next_sync_at, a.structured_data, a.mandatory_ack_enabled, a.mandatory_ack_settings, a.ip_restriction_enabled, a.ip_restriction_settings, u.name as author_name,
                COALESCE(array_agg(DISTINCT t.tag_name) FILTER (WHERE t.tag_name IS NOT NULL), '{}') as tags,
                COALESCE(array_agg(DISTINCT axs.section_id) FILTER (WHERE axs.section_id IS NOT NULL), '{}') as section_ids
         FROM articles a
         LEFT JOIN users u ON a.author_id = u.id
         LEFT JOIN article_tags t ON a.id = t.article_id
         LEFT JOIN article_sections axs ON a.id = axs.article_id
         WHERE a.id = ANY($1::int[])
           AND a.is_visible = true
           AND (a.status = ANY($2::varchar[]) OR a.author_id = $3)
         GROUP BY a.id, u.name
         ORDER BY a.position ASC, a.created_at DESC`,
        [missingDirectGuestArticleIds, allowedStatuses, userId]
      );
      articles = [...articles, ...directGuestArticlesRes.rows];
    }

    if (mandatory === 'true') {
      articles = articles.filter((article) => article.mandatory_ack_enabled === true);
    }

    articles = articles.map((article) => ({
      ...article,
      guest_access: getGuestAccessInfoForArticle(activeGuestGrants, article.id, article.section_ids || [])
    }));
    
    res.json(articles);
  } catch (error: any) {
    console.error('Error fetching articles:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const getHomeData = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const role = authReq.user ? authReq.user.role : '';
    const userId = authReq.user ? authReq.user.id : 0;
    const employeeId = authReq.user ? authReq.user.employee_id : null;

    const allowedSectionIds = await getUserAllowedSections(employeeId, role, userId);
    const activeGuestGrants = userId ? await getActiveGuestAccessGrants(userId) : [];
    const { capabilities } = await getUserCapabilities(userId || null, role);

    const canManageCatalog =
      !!authReq.user &&
      (capabilities.can_manage_access || capabilities.can_manage_structure || capabilities.can_manage_users);
    const canEditCatalog =
      !!authReq.user &&
      (canManageCatalog ||
        capabilities.can_create ||
        capabilities.can_edit ||
        capabilities.can_publish ||
        capabilities.can_approve);

    let allowedStatuses = ['published', 'requires_verification'];
    if (canManageCatalog) {
      allowedStatuses = ['draft', 'on_approval', 'published', 'requires_verification', 'archived', 'expired'];
    } else if (canEditCatalog) {
      allowedStatuses = ['published', 'requires_verification', 'archived', 'expired'];
    }

    const allArticles = await ArticleModel.getAllArticles({
      publishedOnly: !canEditCatalog,
      all: canEditCatalog,
      allowedSectionIds,
      allowedStatuses,
      authorId: canEditCatalog ? userId : undefined
    });

    const trendingArticles = [...allArticles].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 12);
    const recommendedArticles = [...allArticles].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 12);

    const favsQuery = userId ? query(
      `SELECT a.id, a.title, a.slug, '' as content, a.summary, a.category_id, a.author_id, a.published, a.is_visible, a.status, a.views, a.position, a.created_at, a.updated_at, a.article_type, u.name as author_name, COALESCE(array_agg(DISTINCT t.tag_name) FILTER (WHERE t.tag_name IS NOT NULL), '{}') as tags, COALESCE(array_agg(DISTINCT axs.section_id) FILTER (WHERE axs.section_id IS NOT NULL), '{}') as section_ids
       FROM user_favorite_articles ufa
       JOIN articles a ON ufa.article_id = a.id
       LEFT JOIN users u ON a.author_id = u.id
       LEFT JOIN article_tags t ON a.id = t.article_id
       LEFT JOIN article_sections axs ON a.id = axs.article_id
       WHERE ufa.user_id = $1 AND a.is_visible = true
       GROUP BY a.id, u.name, ufa.created_at
       ORDER BY ufa.created_at DESC`,
      [userId]
    ) : Promise.resolve({ rows: [] });

    const historyQuery = userId ? query(
      `SELECT a.id, a.title, a.slug, '' as content, a.summary, a.category_id, a.author_id, a.published, a.is_visible, a.status, a.views, a.position, a.created_at, a.updated_at, a.article_type, u.name as author_name, COALESCE(array_agg(DISTINCT t.tag_name) FILTER (WHERE t.tag_name IS NOT NULL), '{}') as tags, COALESCE(array_agg(DISTINCT axs.section_id) FILTER (WHERE axs.section_id IS NOT NULL), '{}') as section_ids
       FROM user_reading_history urh
       JOIN articles a ON urh.article_id = a.id
       LEFT JOIN users u ON a.author_id = u.id
       LEFT JOIN article_tags t ON a.id = t.article_id
       LEFT JOIN article_sections axs ON a.id = axs.article_id
       WHERE urh.user_id = $1 AND a.is_visible = true
       GROUP BY a.id, u.name, urh.read_at
       ORDER BY urh.read_at DESC
       LIMIT 20`,
      [userId]
    ) : Promise.resolve({ rows: [] });

    const mandatoryQuery = userId ? query(
      `SELECT m.*, a.title as article_title, a.slug as article_slug
       FROM mandatory_acknowledgement_assignments m
       JOIN articles a ON m.article_id = a.id
       WHERE m.user_id = $1
       ORDER BY m.assigned_at DESC`,
      [userId]
    ) : Promise.resolve({ rows: [] });

    const [favsRes, historyRes, mandatoryRes] = await Promise.all([
      favsQuery,
      historyQuery,
      mandatoryQuery
    ]);

    const attachGuestInfo = (arts: any[]) => arts.map(art => ({
      ...art,
      guest_access: getGuestAccessInfoForArticle(activeGuestGrants, art.id, art.section_ids || [])
    }));

    res.setHeader('Cache-Control', 'private, max-age=60, stale-while-revalidate=120');
    res.json({
      allArticles: attachGuestInfo(allArticles),
      trendingArticles: attachGuestInfo(trendingArticles),
      recommendedArticles: attachGuestInfo(recommendedArticles),
      favoriteArticles: favsRes.rows,
      readingHistory: historyRes.rows,
      mandatoryAcknowledgements: mandatoryRes.rows
    });
  } catch (error: any) {
    console.error('Error fetching home data:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const getArticle = async (req: Request, res: Response) => {
  try {
    const { slugOrId } = req.params;
    const authReq = req as AuthenticatedRequest;
    const role = authReq.user ? authReq.user.role : '';
    const userId = authReq.user ? authReq.user.id : 0;
    const employeeId = authReq.user ? authReq.user.employee_id : null;
    
    let article = null;
    if (isNaN(Number(slugOrId))) {
      article = await ArticleModel.getArticleBySlug(slugOrId);
    } else {
      article = await ArticleModel.getArticleById(Number(slugOrId));
    }

    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    const hasAllowedIp = await enforceArticleIpRestriction(req, article, 'restricted_article_view');
    if (!hasAllowedIp) {
      return res.status(403).json({ error: 'Статья доступна только из разрешенной сети.' });
    }

    const activeGuestGrants = userId ? await getActiveGuestAccessGrants(userId) : [];
    const articleGuestAccess = getGuestAccessInfoForArticle(activeGuestGrants, article.id, article.section_ids || []);

    // Проверка доступа к разделам и статусу статьи
    if (role !== 'Admin') {
      const allowedSections = await getUserAllowedSections(employeeId, role, userId);
      const hasSectionAccess = article.section_ids.some(id => allowedSections.includes(id));
      const hasGuestAccess = !!articleGuestAccess;
      
      if (!hasSectionAccess && !hasGuestAccess && article.section_ids.length > 0) {
        return res.status(403).json({ error: 'Доступ ограничен: У вас нет прав на просмотр этой статьи.' });
      }

      const isAuthor = article.author_id === userId;
      if (article.status === 'draft' || article.status === 'on_approval') {
        if (!isAuthor) {
          return res.status(403).json({ error: 'Доступ ограничен: Черновики и статьи на согласовании видны только авторам.' });
        }
      } else if (article.status === 'archived' || article.status === 'expired') {
        if (role !== 'Editor' && !isAuthor) {
          return res.status(403).json({ error: 'Доступ ограничен: Архивные статьи доступны только редакторам и авторам.' });
        }
      }
    }

    // Запись детального просмотра с IP и User ID в фоновом режиме
    const ip = getClientIp(req);
    
    ArticleModel.incrementArticleViews(article.id, userId, ip).catch(err => 
      console.error(`Failed to increment views for article ${article?.id}:`, err)
    );

    // Добавление в историю просмотров пользователя с лимитом в 20 записей
    if (userId) {
      query(`
        INSERT INTO user_reading_history (user_id, article_id, viewed_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id, article_id) DO UPDATE SET viewed_at = CURRENT_TIMESTAMP
      `, [userId, article.id]).then(() => {
        query(`
          DELETE FROM user_reading_history
          WHERE user_id = $1 AND id NOT IN (
            SELECT id FROM user_reading_history
            WHERE user_id = $1
            ORDER BY viewed_at DESC
            LIMIT 20
          )
        `, [userId]);
      }).catch(err => console.error('Failed to save to reading history:', err));
    }

    // Получение информации о последнем изменении статьи
    const changesRes = await query(
      `SELECT cl.*, u.name as user_name, u.role as user_role
       FROM article_changes_log cl
       LEFT JOIN users u ON cl.user_id = u.id
       WHERE cl.article_id = $1
       ORDER BY cl.changed_at DESC LIMIT 1`,
      [article.id]
    );
    const latestChange = changesRes.rows.length ? changesRes.rows[0] : null;

    res.json({
      ...article,
      latest_change: latestChange,
      guest_access: articleGuestAccess
    });
  } catch (error: any) {
    console.error('Error fetching article:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const createArticle = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const {
      title,
      slug,
      content,
      summary,
      published,
      tags,
      position,
      is_visible,
      source_url,
      sync_interval,
      section_ids,
      status,
      article_type,
      owner_id,
      approver_id,
      mandatory_acknowledgement,
      ip_restriction,
    } = req.body;
    
    if (!title || !slug || !content) {
      return res.status(400).json({ error: 'Title, slug, and content are required fields.' });
    }

    const authorId = authReq.user ? authReq.user.id : null;
    const selectedSectionIds = Array.isArray(section_ids) ? section_ids.map((id) => Number(id)).filter(Boolean) : [];
    const hasCreateAccess = await canCreateInSections(authorId, authReq.user?.role, selectedSectionIds);
    if (!hasCreateAccess) {
      return res.status(403).json({ error: 'Недостаточно прав для создания статьи в выбранных разделах.' });
    }

    let article = await ArticleModel.createArticle({
      title,
      slug,
      content,
      summary: summary || '',
      category_id: null,
      author_id: authorId,
      published: published === undefined ? true : !!published,
      is_visible: is_visible === undefined ? true : !!is_visible,
      status: status || ((published === undefined || published) ? 'published' : 'draft'),
      tags: tags || [],
      section_ids: selectedSectionIds,
      position: position !== undefined ? Number(position) : 0,
      source_url: source_url || null,
      sync_interval: sync_interval || 'manual',
      article_type: article_type || 'general',
      owner_id: owner_id ? Number(owner_id) : null,
      approver_id: approver_id ? Number(approver_id) : null,
    });

    try {
      await syncArticleIpRestriction(article.id, ip_restriction);
      article = await ArticleModel.getArticleById(article.id) || article;
    } catch (ipErr) {
      console.error('Failed to sync IP restriction settings (non-fatal):', ipErr);
    }

    try {
      await syncContentArticleLinks(article.id, article.content);
    } catch (linkSyncErr) {
      console.error('Failed to sync internal article links (non-fatal):', linkSyncErr);
    }

    try {
      await syncMandatoryAcknowledgementAssignments(
        article,
        mandatory_acknowledgement,
        authReq.user,
        !!mandatory_acknowledgement?.enabled && article.published && article.status === 'published'
      );
      article = await ArticleModel.getArticleById(article.id) || article;
    } catch (ackErr) {
      console.error('Failed to sync mandatory acknowledgement assignments (non-fatal):', ackErr);
    }

    try {
      await createArticleVersionSnapshot(req, article.id, {
        source_type: article.published && article.status === 'published' ? 'publish' : 'save',
        change_comment: article.published && article.status === 'published'
          ? 'Создание и публикация статьи'
          : 'Создание черновика статьи',
        editor_comment: null,
        created_by: authorId,
      });
    } catch (versionErr) {
      console.error('Failed to create initial article version snapshot (non-fatal):', versionErr);
    }

    // Auto-index to Meilisearch
    const isArticlePublished = Boolean((article.published === undefined || article.published) && (article.is_visible === undefined || article.is_visible) && article.status !== 'archived');
    if (isArticlePublished) {
      const doc: msService.ArticleDocument = {
        id: article.id,
        title: article.title,
        slug: article.slug,
        content: article.content,
        summary: article.summary,
        categoryName: '',
        tags: article.tags || [],
        published: true,
        createdAt: article.created_at instanceof Date ? article.created_at.toISOString() : new Date(article.created_at).toISOString(),
        section_ids: article.section_ids,
      };
      msService.indexArticle(doc).catch(err => 
        console.error('Failed to auto-index new article to Meilisearch:', err)
      );
    } else {
      msService.deleteArticle(article.id).catch(err =>
        console.error('Failed to remove unpublished article from Meilisearch:', err)
      );
    }

    res.status(201).json(article);
  } catch (error: any) {
    console.error('Error creating article:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const updateArticle = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      title,
      slug,
      content,
      summary,
      published,
      tags,
      position,
      is_visible,
      source_url,
      sync_interval,
      section_ids,
      status,
      article_type,
      owner_id,
      approver_id,
      change_description,
      editor_comment,
      mandatory_acknowledgement,
      ip_restriction,
    } = req.body;

    if (!title || !slug || !content) {
      return res.status(400).json({ error: 'Title, slug, and content are required.' });
    }

    // Retrieve current state before update
    const currentArticle = await ArticleModel.getArticleById(Number(id));
    if (!currentArticle) {
      return res.status(404).json({ error: 'Article not found' });
    }

    const authReq = req as AuthenticatedRequest;
    const hasEditAccess = await canEditArticle(authReq.user?.id, authReq.user?.role, currentArticle);
    if (!hasEditAccess) {
      return res.status(403).json({ error: 'Недостаточно прав для редактирования этой статьи.' });
    }

    const selectedSectionIds = Array.isArray(section_ids) ? section_ids.map((sectionId) => Number(sectionId)).filter(Boolean) : [];
    let article = await ArticleModel.updateArticle(Number(id), {
      title,
      slug,
      content,
      summary: summary || '',
      category_id: null,
      published: published === undefined ? true : !!published,
      is_visible: is_visible === undefined ? true : !!is_visible,
      status: status || 'draft',
      tags: tags || [],
      section_ids: selectedSectionIds,
      position: position !== undefined ? Number(position) : 0,
      source_url: source_url || null,
      sync_interval: sync_interval || 'manual',
      article_type: article_type || currentArticle.article_type || 'general',
      owner_id: owner_id !== undefined ? (owner_id ? Number(owner_id) : null) : currentArticle.owner_id || null,
      approver_id: approver_id !== undefined ? (approver_id ? Number(approver_id) : null) : currentArticle.approver_id || null,
    });

    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    try {
      await syncArticleIpRestriction(
        article.id,
        ip_restriction === undefined
          ? {
              ...(currentArticle.ip_restriction_settings || {}),
              enabled: !!currentArticle.ip_restriction_enabled,
            }
          : ip_restriction
      );
      article = await ArticleModel.getArticleById(article.id) || article;
    } catch (ipErr) {
      console.error('Failed to sync IP restriction settings (non-fatal):', ipErr);
    }

    try {
      await syncContentArticleLinks(article.id, article.content);
    } catch (linkSyncErr) {
      console.error('Failed to sync internal article links (non-fatal):', linkSyncErr);
    }

    try {
      await syncMandatoryAcknowledgementAssignments(
        article,
        mandatory_acknowledgement,
        authReq.user,
        !!mandatory_acknowledgement?.enabled &&
          !!mandatory_acknowledgement?.require_reacknowledgement &&
          article.published &&
          article.status === 'published'
      );
      article = await ArticleModel.getArticleById(article.id) || article;
    } catch (ackErr) {
      console.error('Failed to sync mandatory acknowledgement assignments (non-fatal):', ackErr);
    }

    // Сохранение записи в журнале изменений статьи со снимками
    try {
      await query(
        `INSERT INTO article_changes_log (article_id, user_id, change_description, editor_comment, old_content, new_content, old_title, new_title)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          article.id,
          authReq.user ? authReq.user.id : null,
          change_description || 'Обновлено содержание статьи',
          editor_comment || 'Редактирование статьи',
          currentArticle.content,
          article.content,
          currentArticle.title,
          article.title
        ]
      );
    } catch (logErr) {
      console.error('Failed to write article change log (non-fatal):', logErr);
    }

    try {
      await createArticleVersionSnapshot(req, article.id, {
        source_type: article.published && article.status === 'published' ? 'publish' : 'save',
        change_comment: change_description || (article.published && article.status === 'published'
          ? 'Сохранение опубликованной версии'
          : 'Сохранение черновика'),
        editor_comment: editor_comment || null,
      });
    } catch (versionErr) {
      console.error('Failed to create article version snapshot (non-fatal):', versionErr);
    }

    // Добавление системного уведомления
    const authorName = authReq.user ? authReq.user.name : 'Система';
    const authorRole = authReq.user ? authReq.user.role : '';
    const authorRoleName = authorRole === 'Admin' ? 'Администратор' : (authorRole === 'Editor' ? 'Редактор' : 'Пользователь');

    try {
      await query(
        `INSERT INTO notifications (title, message, type) VALUES ($1, $2, $3)`,
        [
          `Статья "${article.title}" была обновлена.`,
          `Автор: ${authorName} (${authorRoleName})\n\nОписание изменений:\n${change_description || 'Обновлено содержание статьи'}`,
          'info'
        ]
      );
    } catch (notifErr) {
      console.error('Failed to write notification (non-fatal):', notifErr);
    }

    // Auto-index or delete from Meilisearch depending on published and visible status
    const isArticlePublished = Boolean((article.published === undefined || article.published) && (article.is_visible === undefined || article.is_visible) && article.status !== 'archived');
    if (isArticlePublished) {
      const doc: msService.ArticleDocument = {
        id: article.id,
        title: article.title,
        slug: article.slug,
        content: article.content,
        summary: article.summary,
        categoryName: '',
        tags: article.tags || [],
        published: true,
        createdAt: article.created_at instanceof Date ? article.created_at.toISOString() : new Date(article.created_at).toISOString(),
        section_ids: article.section_ids,
      };
      msService.indexArticle(doc).catch(err => 
        console.error('Failed to update Meilisearch index for article:', err)
      );
    } else {
      // If unpublished or hidden, make sure it is removed from index
      msService.deleteArticle(article.id).catch(err =>
        console.error('Failed to remove article from Meilisearch:', err)
      );
    }

    res.json(article);
  } catch (error: any) {
    console.error('Error updating article:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const getRecentChanges = async (req: Request, res: Response) => {
  try {
    const allowedSectionIds = await getAllowedSectionsForRequest(req);
    const result = await query(
      `SELECT cl.*, a.title as article_title, a.slug as article_slug, u.name as user_name, u.role as user_role
       FROM article_changes_log cl
       INNER JOIN articles a ON cl.article_id = a.id
       LEFT JOIN users u ON cl.user_id = u.id
       LEFT JOIN article_sections axs ON a.id = axs.article_id
       WHERE axs.section_id = ANY($1::int[]) AND a.is_visible = true
       ORDER BY cl.changed_at DESC
       LIMIT 5`,
      [allowedSectionIds]
    );
    res.json(result.rows);
  } catch (error: any) {
    console.error('Failed to get recent changes:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const getArticleVersions = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const article = await ArticleModel.getArticleById(Number(id));
    if (!article) {
      return res.status(404).json({ error: 'Статья не найдена.' });
    }

    const canView = await canViewArticleVersions(req, article);
    if (!canView) {
      return res.status(403).json({ error: 'Недостаточно прав для просмотра истории версий.' });
    }

    const result = await query(
      `SELECT
         av.*,
         u.name AS created_by_name,
         u.role AS created_by_role
       FROM article_versions av
       LEFT JOIN users u ON u.id = av.created_by
       WHERE av.article_id = $1
       ORDER BY av.version_number DESC`,
      [article.id]
    );

    res.json(result.rows);
  } catch (error: any) {
    console.error('Failed to get article versions:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const getArticleVersion = async (req: Request, res: Response) => {
  try {
    const { id, versionId } = req.params;
    const article = await ArticleModel.getArticleById(Number(id));
    if (!article) {
      return res.status(404).json({ error: 'Статья не найдена.' });
    }

    const canView = await canViewArticleVersions(req, article);
    if (!canView) {
      return res.status(403).json({ error: 'Недостаточно прав для просмотра версии статьи.' });
    }

    const result = await query(
      `SELECT
         av.*,
         u.name AS created_by_name,
         u.role AS created_by_role
       FROM article_versions av
       LEFT JOIN users u ON u.id = av.created_by
       WHERE av.id = $1 AND av.article_id = $2
       LIMIT 1`,
      [Number(versionId), article.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Версия не найдена.' });
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Failed to get article version:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const restoreArticleVersion = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const versionId = Number(req.params.versionId || req.params.changeId);
    const authReq = req as AuthenticatedRequest;
    const shouldPublish = req.body?.publish === true;
    const restoreComment = typeof req.body?.comment === 'string' ? req.body.comment.trim() : '';
    const requireReacknowledgement = !!req.body?.require_reacknowledgement;

    if (!authReq.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const currentArticle = await ArticleModel.getArticleById(Number(id));
    if (!currentArticle) {
      return res.status(404).json({ error: 'Статья не найдена.' });
    }

    const hasRestoreAccess = await canRestoreArticle(authReq.user.id, authReq.user.role, currentArticle);
    if (!hasRestoreAccess) {
      await logSecurityEvent({
        req,
        actorUserId: authReq.user.id,
        articleId: currentArticle.id,
        action: 'article_version_restore',
        status: 'denied',
        metadata: { source_version_id: versionId, publish: shouldPublish },
      });
      return res.status(403).json({ error: 'Недостаточно прав для восстановления этой статьи.' });
    }

    const versionRes = await query(
      `SELECT *
       FROM article_versions
       WHERE id = $1 AND article_id = $2
       LIMIT 1`,
      [versionId, Number(id)]
    );
    if (versionRes.rows.length === 0) {
      return res.status(404).json({ error: 'Версия не найдена.' });
    }
    const version = versionRes.rows[0];

    const restoredTags = Array.isArray(version.tags) ? version.tags : [];
    const restoredSectionIds = Array.isArray(version.section_ids)
      ? version.section_ids.map((sectionId: unknown) => Number(sectionId)).filter(Boolean)
      : [];
    const targetStatus = shouldPublish ? 'published' : 'draft';

    let updatedArticle = await ArticleModel.updateArticle(Number(id), {
      title: version.title || currentArticle.title,
      slug: version.slug || currentArticle.slug,
      content: version.content || '',
      summary: version.summary || '',
      category_id: currentArticle.category_id,
      published: shouldPublish,
      is_visible: true,
      status: targetStatus,
      tags: restoredTags,
      section_ids: restoredSectionIds,
      position: currentArticle.position,
      source_url: version.source_url || null,
      sync_interval: version.sync_interval || 'manual',
      structured_data: version.structured_data || null,
      article_type: version.article_type || 'general',
      owner_id: version.owner_id || null,
      approver_id: version.approver_id || null,
    });

    if (!updatedArticle) {
      return res.status(404).json({ error: 'Не удалось обновить статью при восстановлении.' });
    }

    try {
      await syncArticleIpRestriction(updatedArticle.id, {
        ...(version.ip_restriction_settings || {}),
        enabled: !!version.ip_restriction_enabled,
      });
      updatedArticle = await ArticleModel.getArticleById(updatedArticle.id) || updatedArticle;
    } catch (ipErr) {
      console.error('Failed to restore IP restriction settings (non-fatal):', ipErr);
    }

    try {
      await syncContentArticleLinks(updatedArticle.id, updatedArticle.content);
    } catch (linkSyncErr) {
      console.error('Failed to sync links after version restore (non-fatal):', linkSyncErr);
    }

    const isMandatoryArticle = !!currentArticle.mandatory_ack_enabled || !!version.mandatory_ack_enabled;
    try {
      await syncMandatoryAcknowledgementAssignments(
        updatedArticle,
        isMandatoryArticle
          ? {
              ...(version.mandatory_ack_settings || currentArticle.mandatory_ack_settings || {}),
              enabled: true,
              require_reacknowledgement: requireReacknowledgement,
            }
          : { enabled: false },
        authReq.user,
        shouldPublish && isMandatoryArticle && requireReacknowledgement
      );
      updatedArticle = await ArticleModel.getArticleById(updatedArticle.id) || updatedArticle;
    } catch (ackErr) {
      console.error('Failed to restore mandatory acknowledgement settings (non-fatal):', ackErr);
    }

    const changeDescription = `Восстановлена версия ${version.version_number}${shouldPublish ? ' и опубликована' : ' в черновик'}`;
    const editorComment = restoreComment || `Восстановление из версии ${version.version_number}`;

    await query(
      `INSERT INTO article_changes_log (article_id, user_id, change_description, editor_comment, old_content, new_content, old_title, new_title)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        updatedArticle.id,
        authReq.user.id,
        changeDescription,
        editorComment,
        currentArticle.content,
        updatedArticle.content,
        currentArticle.title,
        updatedArticle.title,
      ]
    );

    const newVersion = await createArticleVersionSnapshot(req, updatedArticle.id, {
      source_type: 'restore',
      change_comment: `Восстановлена из версии ${version.version_number}`,
      editor_comment: restoreComment || null,
      restored_from_version_id: version.id,
      restored_from_version_number: version.version_number,
      restore_comment: restoreComment || null,
      created_by: authReq.user.id,
    });

    await logSecurityEvent({
      req,
      actorUserId: authReq.user.id,
      articleId: updatedArticle.id,
      action: 'article_version_restore',
      status: 'success',
      metadata: {
        source_version_id: version.id,
        source_version_number: version.version_number,
        new_version_id: newVersion.id,
        new_version_number: newVersion.version_number,
        publish: shouldPublish,
        require_reacknowledgement: requireReacknowledgement,
        restore_comment: restoreComment || null,
        session_id: newVersion.session_id || null,
      },
    });

    await query(
      `INSERT INTO notifications (title, message, type) VALUES ($1, $2, $3)`,
      [
        `Статья "${updatedArticle.title}" была восстановлена.`,
        `Автор: ${authReq.user.name}\n\nОписание изменений:\n${changeDescription}`,
        'info'
      ]
    );

    if (updatedArticle.published && updatedArticle.is_visible && updatedArticle.status === 'published') {
      const doc: msService.ArticleDocument = {
        id: updatedArticle.id,
        title: updatedArticle.title,
        slug: updatedArticle.slug,
        content: updatedArticle.content,
        summary: updatedArticle.summary,
        categoryName: '',
        tags: updatedArticle.tags,
        published: updatedArticle.published,
        createdAt: updatedArticle.created_at.toISOString(),
        section_ids: updatedArticle.section_ids,
      };
      await msService.indexArticle(doc);
    } else {
      await msService.deleteArticle(updatedArticle.id);
    }

    res.json({ article: updatedArticle, version: newVersion });
  } catch (error: any) {
    console.error('Failed to restore article version:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};


export const deleteArticle = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = await ArticleModel.deleteArticle(Number(id));
    
    if (!success) {
      return res.status(404).json({ error: 'Article not found' });
    }

    // Remove from Meilisearch
    msService.deleteArticle(Number(id)).catch(err =>
      console.error('Failed to delete article from Meilisearch index:', err)
    );

    res.json({ message: 'Article deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting article:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const searchArticles = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { q, category, tag } = req.query;
    const searchQueryStr = typeof q === 'string' ? q.trim() : '';
    const userId = authReq.user ? authReq.user.id : undefined;
    const role = authReq.user ? authReq.user.role : '';
    const isAdmin = authReq.user ? (role === 'Admin' || await isWikiAdmin(userId, role)) : false;

    let allowedSectionIds: number[] | undefined = undefined;
    if (!isAdmin && authReq.user) {
      allowedSectionIds = await getAllowedSectionsForRequest(req);
    }
    
    let results = await msService.searchArticles(
      searchQueryStr,
      category as string,
      tag as string,
      allowedSectionIds
    );

    if (results && results.length > 0 && allowedSectionIds && allowedSectionIds.length > 0) {
      const articleIds = results.map(r => r.id);
      const secMapRes = await query(
        'SELECT article_id, section_id FROM article_sections WHERE article_id = ANY($1::int[])',
        [articleIds]
      );
      const articleToSections: Record<number, number[]> = {};
      secMapRes.rows.forEach(row => {
        if (!articleToSections[row.article_id]) {
          articleToSections[row.article_id] = [];
        }
        articleToSections[row.article_id].push(row.section_id);
      });

      results = results.filter(art => {
        const sections = articleToSections[art.id] || [];
        if (sections.length === 0) return true;
        return sections.some(id => allowedSectionIds!.includes(id));
      });

      results = await filterSearchResultsByIpRestriction(req, results);
    }

    // FALLBACK: If Meilisearch returned no results, search directly in Postgres DB
    if ((!results || results.length === 0) && searchQueryStr.length > 0) {
      const searchTerm = `%${searchQueryStr}%`;
      const sql = `
        SELECT DISTINCT a.id, a.title, a.slug, a.summary, a.published, a.created_at as "createdAt"
        FROM articles a
        LEFT JOIN article_sections axs ON a.id = axs.article_id
        LEFT JOIN article_tags t ON a.id = t.article_id
        WHERE a.published = true 
          AND a.is_visible = true 
          AND ($1::boolean = true OR $2::int[] IS NULL OR axs.section_id = ANY($2::int[]) OR axs.section_id IS NULL)
          AND (
            a.title ILIKE $3 OR 
            a.summary ILIKE $3 OR 
            a.content ILIKE $3 OR 
            a.slug ILIKE $3 OR 
            t.tag_name ILIKE $3
          )
        ORDER BY a.created_at DESC
        LIMIT 20
      `;
      const dbRes = await query(sql, [isAdmin || !authReq.user, allowedSectionIds || null, searchTerm]);
      results = dbRes.rows.map(row => ({
        id: Number(row.id),
        title: row.title,
        slug: row.slug,
        summary: row.summary || '',
        categoryName: '',
        tags: [],
        published: row.published,
        createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : new Date(row.createdAt).toISOString(),
        highlights: [row.summary || row.title],
        score: 1.0,
      }));

      results = await filterSearchResultsByIpRestriction(req, results);
    }
    
    res.json(results || []);
  } catch (error: any) {
    console.error('Search request failed:', error);
    res.status(500).json({ error: 'Search Service Unavailable', details: error.message });
  }
};

export const suggestArticles = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { q } = req.query;
    const searchQueryStr = typeof q === 'string' ? q.trim() : '';
    const userId = authReq.user ? authReq.user.id : undefined;
    const role = authReq.user ? authReq.user.role : '';
    const isAdmin = authReq.user ? (role === 'Admin' || await isWikiAdmin(userId, role)) : false;

    let allowedSectionIds: number[] | undefined = undefined;
    if (!isAdmin && authReq.user) {
      allowedSectionIds = await getAllowedSectionsForRequest(req);
    }
    
    let results = await msService.suggestArticles(
      searchQueryStr, 
      allowedSectionIds
    );
    
    if (results && results.length > 0 && allowedSectionIds && allowedSectionIds.length > 0) {
      const articleIds = results.map(r => r.id);
      const secMapRes = await query(
        'SELECT article_id, section_id FROM article_sections WHERE article_id = ANY($1::int[])',
        [articleIds]
      );
      const articleToSections: Record<number, number[]> = {};
      secMapRes.rows.forEach(row => {
        if (!articleToSections[row.article_id]) {
          articleToSections[row.article_id] = [];
        }
        articleToSections[row.article_id].push(row.section_id);
      });

      results = results.filter(art => {
        const sections = articleToSections[art.id] || [];
        if (sections.length === 0) return true;
        return sections.some(id => allowedSectionIds!.includes(id));
      });

      results = await filterSearchResultsByIpRestriction(req, results);
    }

    // FALLBACK: If Meilisearch returned no suggestions, query Postgres DB directly
    if ((!results || results.length === 0) && searchQueryStr.length > 0) {
      const searchTerm = `%${searchQueryStr}%`;
      const sql = `
        SELECT DISTINCT a.id, a.title, a.slug, a.summary, a.published, a.created_at as "createdAt"
        FROM articles a
        LEFT JOIN article_sections axs ON a.id = axs.article_id
        LEFT JOIN article_tags t ON a.id = t.article_id
        WHERE a.published = true 
          AND a.is_visible = true 
          AND ($1::boolean = true OR $2::int[] IS NULL OR axs.section_id = ANY($2::int[]) OR axs.section_id IS NULL)
          AND (
            a.title ILIKE $3 OR 
            a.summary ILIKE $3 OR 
            a.content ILIKE $3 OR 
            a.slug ILIKE $3 OR 
            t.tag_name ILIKE $3
          )
        ORDER BY a.created_at DESC
        LIMIT 10
      `;
      const dbRes = await query(sql, [isAdmin || !authReq.user, allowedSectionIds || null, searchTerm]);
      results = dbRes.rows.map(row => ({
        id: Number(row.id),
        title: row.title,
        slug: row.slug,
        summary: row.summary || '',
        categoryName: '',
        tags: [],
        published: row.published,
        createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : new Date(row.createdAt).toISOString(),
        highlights: [row.title],
        score: 1.0,
      }));

      results = await filterSearchResultsByIpRestriction(req, results);
    }

    res.json(results || []);
  } catch (error: any) {
    console.error('Suggestions request failed:', error);
    res.status(500).json({ error: 'Suggestions Service Unavailable', details: error.message });
  }
};

export const uploadImage = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded.' });
    }

    const fileUrl = `/uploads/${encodeURIComponent(req.file.filename)}`;
    
    res.status(201).json({ 
      message: 'Image uploaded successfully', 
      url: fileUrl
    });
  } catch (error: any) {
    console.error('Image upload failed:', error);
    res.status(500).json({ error: 'Image upload failed', details: error.message });
  }
};

export const importArticle = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No document file uploaded.' });
    }

    await fs.promises.mkdir(IMPORT_SESSIONS_ROOT, { recursive: true });

    const sessionId = randomUUID();
    const { path: tempPath, originalname, mimetype } = req.file;
    const safeName = sanitizeFileName(originalname);
    const fileExt = path.extname(safeName).toLowerCase();
    const sessionDir = path.join(IMPORT_SESSIONS_ROOT, sessionId);
    await fs.promises.mkdir(sessionDir, { recursive: true });

    const originalFilePath = path.join(sessionDir, `original-${safeName}`);
    const workingFilePath = path.join(sessionDir, `working-${safeName}`);

    await fs.promises.copyFile(tempPath, originalFilePath);
    await fs.promises.copyFile(tempPath, workingFilePath);
    await fs.promises.unlink(tempPath).catch(() => undefined);

    const parsedDoc = await parseDocumentSafely(workingFilePath, safeName);
    const authorId = req.user ? req.user.id : null;

    const inserted = await query(
      `INSERT INTO document_import_sessions (
        id,
        user_id,
        original_file_name,
        mime_type,
        file_ext,
        original_file_path,
        working_file_path,
        preview_html,
        title,
        summary,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active')
      RETURNING *`,
      [
        sessionId,
        authorId,
        safeName,
        mimetype || null,
        fileExt || null,
        originalFilePath,
        workingFilePath,
        parsedDoc.content,
        parsedDoc.title || path.basename(safeName, fileExt),
        parsedDoc.summary || '',
      ]
    );

    res.status(201).json(serializeImportSession(req, inserted.rows[0]));
  } catch (error: any) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error('Document import failed:', error);
    res.status(500).json({ error: 'Document import failed', details: error.message });
  }
};

export const importWebsite = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rawUrl = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
    if (!rawUrl) {
      return res.status(400).json({ error: 'Website URL is required.' });
    }

    const parsedUrl = await validateWebsiteImportUrl(rawUrl);
    const sourceUrl = parsedUrl.toString();

    const response = await axios.get<string>(sourceUrl, {
      timeout: 15000,
      maxContentLength: 10 * 1024 * 1024,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Wiki2ImportBot/1.0; +https://wiki2-frontend.vercel.app)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      responseType: 'text',
      transformResponse: [(data) => data],
    });

    const contentType = String(response.headers['content-type'] || '').toLowerCase();
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      return res.status(415).json({ error: 'Ссылка не похожа на HTML-страницу. Для файлов используйте импорт документа.' });
    }

    await fs.promises.mkdir(IMPORT_SESSIONS_ROOT, { recursive: true });

    const html = response.data;
    const parsed = extractWebsiteContent(html, sourceUrl);
    const sessionId = randomUUID();
    const hostname = parsedUrl.hostname.replace(/[^\w.-]+/g, '-');
    const safeName = sanitizeFileName(`${hostname}-${Date.now()}.html`);
    const sessionDir = path.join(IMPORT_SESSIONS_ROOT, sessionId);
    await fs.promises.mkdir(sessionDir, { recursive: true });

    const originalFilePath = path.join(sessionDir, `original-${safeName}`);
    const workingFilePath = path.join(sessionDir, `working-${safeName}`);

    await fs.promises.writeFile(originalFilePath, html, 'utf8');
    await fs.promises.writeFile(workingFilePath, parsed.content, 'utf8');

    const inserted = await query(
      `INSERT INTO document_import_sessions (
        id,
        user_id,
        original_file_name,
        mime_type,
        file_ext,
        original_file_path,
        working_file_path,
        preview_html,
        title,
        summary,
        status,
        source_url
      )
      VALUES ($1, $2, $3, $4, '.html', $5, $6, $7, $8, $9, 'active', $10)
      RETURNING *`,
      [
        sessionId,
        req.user ? req.user.id : null,
        safeName,
        'text/html',
        originalFilePath,
        workingFilePath,
        parsed.content,
        parsed.title,
        parsed.summary,
        sourceUrl,
      ]
    );

    res.status(201).json(serializeImportSession(req, inserted.rows[0]));
  } catch (error: any) {
    console.error('Website import failed:', error);
    res.status(500).json({ error: 'Website import failed', details: error.message });
  }
};

export const getImportSession = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const session = await getImportSessionById(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Import session not found.' });
    }
    if (!canAccessImportSession(session, req.user)) {
      return res.status(403).json({ error: 'Недостаточно прав для просмотра этой импорт-сессии.' });
    }

    res.json(serializeImportSession(req, session));
  } catch (error: any) {
    console.error('Failed to get import session:', error);
    res.status(500).json({ error: 'Failed to get import session', details: error.message });
  }
};

export const updateImportSession = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const session = await getImportSessionById(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Import session not found.' });
    }
    if (!canAccessImportSession(session, req.user)) {
      return res.status(403).json({ error: 'Недостаточно прав для редактирования этой импорт-сессии.' });
    }
    if (session.status !== 'active') {
      return res.status(409).json({ error: 'Import session is already completed.' });
    }

    const {
      title = session.title,
      summary = session.summary || '',
      preview_html = session.preview_html || '',
    } = req.body;

    await fs.promises.writeFile(session.working_file_path, preview_html, 'utf8').catch((writeErr) => {
      console.error('Failed to update import working copy (non-fatal):', writeErr);
    });

    const updated = await query(
      `UPDATE document_import_sessions
       SET title = $2,
           summary = $3,
           preview_html = $4,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [session.id, title, summary, preview_html]
    );

    res.json(serializeImportSession(req, updated.rows[0]));
  } catch (error: any) {
    console.error('Failed to update import session:', error);
    res.status(500).json({ error: 'Failed to update import session', details: error.message });
  }
};

export const resetImportSession = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const session = await getImportSessionById(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Import session not found.' });
    }
    if (!canAccessImportSession(session, req.user)) {
      return res.status(403).json({ error: 'Недостаточно прав для сброса этой импорт-сессии.' });
    }
    if (session.status !== 'active') {
      return res.status(409).json({ error: 'Import session is already completed.' });
    }

    await fs.promises.copyFile(session.original_file_path, session.working_file_path);
    const parsedDoc = session.file_ext === '.html' && session.source_url
      ? extractWebsiteContent(await fs.promises.readFile(session.original_file_path, 'utf8'), session.source_url)
      : await parseDocumentSafely(session.working_file_path, session.original_file_name);
    if (session.file_ext === '.html') {
      await fs.promises.writeFile(session.working_file_path, parsedDoc.content, 'utf8').catch(() => undefined);
    }
    const updated = await query(
      `UPDATE document_import_sessions
       SET preview_html = $2,
           title = $3,
           summary = $4,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [session.id, parsedDoc.content, parsedDoc.title, parsedDoc.summary || '']
    );

    res.json(serializeImportSession(req, updated.rows[0]));
  } catch (error: any) {
    console.error('Failed to reset import session:', error);
    res.status(500).json({ error: 'Failed to reset import session', details: error.message });
  }
};

export const cancelImportSession = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const session = await getImportSessionById(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Import session not found.' });
    }
    if (!canAccessImportSession(session, req.user)) {
      return res.status(403).json({ error: 'Недостаточно прав для отмены этой импорт-сессии.' });
    }
    if (session.article_id) {
      return res.status(409).json({ error: 'Import session already created an article.' });
    }

    await query('DELETE FROM document_import_sessions WHERE id = $1', [session.id]);
    await fs.promises.rm(path.dirname(session.original_file_path), { recursive: true, force: true }).catch(() => undefined);
    res.status(204).send();
  } catch (error: any) {
    console.error('Failed to cancel import session:', error);
    res.status(500).json({ error: 'Failed to cancel import session', details: error.message });
  }
};

const createArticleFromImportSession = async (
  req: AuthenticatedRequest,
  res: Response,
  targetStatus: 'draft' | 'published'
) => {
  const session = await getImportSessionById(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Import session not found.' });
  }
  if (!canAccessImportSession(session, req.user)) {
    return res.status(403).json({ error: 'Недостаточно прав для сохранения этой импорт-сессии.' });
  }
  if (session.status !== 'active') {
    return res.status(409).json({ error: 'Import session is already completed.' });
  }

  const {
    title = session.title,
    slug,
    summary = session.summary || '',
    content = session.preview_html || '',
    section_ids,
    tags,
    article_type,
    owner_id,
    approver_id,
    source_url,
  } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required.' });
  }

  const selectedSectionIds = Array.isArray(section_ids)
    ? section_ids.map((sectionId) => Number(sectionId)).filter(Boolean)
    : [];
  const authorId = req.user ? req.user.id : null;
  const hasCreateAccess = await canCreateInSections(authorId, req.user?.role, selectedSectionIds);
  if (!hasCreateAccess) {
    return res.status(403).json({ error: 'Недостаточно прав для создания статьи в выбранных разделах.' });
  }

  const article = await ArticleModel.createArticle({
    title,
    slug: slug || slugifyTitle(title),
    content,
    summary,
    category_id: null,
    author_id: authorId,
    published: targetStatus === 'published',
    is_visible: true,
    status: targetStatus,
    tags: Array.isArray(tags) ? tags : ['импорт'],
    section_ids: selectedSectionIds,
    article_type: article_type || 'general',
    owner_id: owner_id ? Number(owner_id) : null,
    approver_id: approver_id ? Number(approver_id) : null,
    source_url: source_url || session.source_url || null,
    structured_data: {
      importSessionId: session.id,
      originalFileName: session.original_file_name,
      originalUrl: getUploadUrl(session.original_file_path),
      workingUrl: getUploadUrl(session.working_file_path),
      fileExt: session.file_ext,
      sourceUrl: source_url || session.source_url || null,
      importedAt: new Date().toISOString(),
      sourcePreserved: true,
    },
  });

  try {
    await syncContentArticleLinks(article.id, article.content);
  } catch (linkSyncErr) {
    console.error('Failed to sync internal article links after import (non-fatal):', linkSyncErr);
  }

  try {
    await query(
      `INSERT INTO article_changes_log (article_id, user_id, change_description, editor_comment, old_content, new_content, old_title, new_title)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        article.id,
        authorId,
        targetStatus === 'published' ? 'Импорт документа и публикация' : 'Импорт документа в черновик',
        `Исходный файл: ${session.original_file_name}`,
        null,
        article.content,
        null,
        article.title,
      ]
    );
  } catch (logErr) {
    console.error('Failed to write import change log (non-fatal):', logErr);
  }

  try {
    await createArticleVersionSnapshot(req, article.id, {
      source_type: targetStatus === 'published' ? 'import_publish' : 'import_draft',
      change_comment: targetStatus === 'published' ? 'Импорт документа и публикация' : 'Импорт документа в черновик',
      editor_comment: `Исходный файл: ${session.original_file_name}`,
      created_by: authorId,
    });
  } catch (versionErr) {
    console.error('Failed to create imported article version snapshot (non-fatal):', versionErr);
  }

  try {
    await indexImportedArticleIfNeeded(article);
  } catch (indexErr) {
    console.error('Failed to index imported article (non-fatal):', indexErr);
  }

  await query(
    `UPDATE document_import_sessions
     SET status = $2,
         article_id = $3,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [session.id, targetStatus === 'published' ? 'published' : 'draft_saved', article.id]
  );

  return res.status(201).json(article);
};

export const saveImportSessionDraft = async (req: AuthenticatedRequest, res: Response) => {
  try {
    return await createArticleFromImportSession(req, res, 'draft');
  } catch (error: any) {
    console.error('Failed to save import as draft:', error);
    res.status(500).json({ error: 'Failed to save import as draft', details: error.message });
  }
};

export const publishImportSession = async (req: AuthenticatedRequest, res: Response) => {
  try {
    return await createArticleFromImportSession(req, res, 'published');
  } catch (error: any) {
    console.error('Failed to publish imported article:', error);
    res.status(500).json({ error: 'Failed to publish imported article', details: error.message });
  }
};

export const handleOnlyOfficeImportCallback = async (req: Request, res: Response) => {
  try {
    const session = await getImportSessionById(req.params.id);
    if (!session) {
      return res.json({ error: 0 });
    }

    const status = Number(req.body?.status);
    const fileUrl = req.body?.url;

    if ((status === 2 || status === 6) && fileUrl && session.status === 'active') {
      const response = await axios.get<ArrayBuffer>(fileUrl, { responseType: 'arraybuffer' });
      await fs.promises.writeFile(session.working_file_path, Buffer.from(response.data));
      const parsedDoc = await parseDocumentSafely(session.working_file_path, session.original_file_name);

      await query(
        `UPDATE document_import_sessions
         SET preview_html = $2,
             summary = $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [session.id, parsedDoc.content, parsedDoc.summary || session.summary || '']
      );
    }

    res.json({ error: 0 });
  } catch (error) {
    console.error('ONLYOFFICE import callback failed:', error);
    res.json({ error: 1 });
  }
};

const getLatestMandatoryAssignmentForUser = async (articleId: number, userId: number) => {
  const result = await query(
    `SELECT ma.*, a.title, a.slug, a.summary, a.updated_at AS article_updated_at
     FROM mandatory_ack_assignments ma
     JOIN articles a ON a.id = ma.article_id
     WHERE ma.article_id = $1
       AND ma.user_id = $2
       AND ma.status NOT IN ('cancelled', 'superseded')
     ORDER BY ma.assigned_at DESC, ma.id DESC
     LIMIT 1`,
    [articleId, userId]
  );
  return result.rows[0] || null;
};

const serializeMandatoryAssignment = (assignment: any) => {
  const status = getAssignmentEffectiveStatus(assignment);
  const overdueDays = assignment.due_at && !assignment.acknowledged_at
    ? Math.max(0, Math.ceil((Date.now() - new Date(assignment.due_at).getTime()) / (24 * 60 * 60 * 1000)))
    : Number(assignment.overdue_days || 0);

  return {
    ...assignment,
    status,
    overdue_days: overdueDays,
  };
};

export const getMyMandatoryAcknowledgements = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const result = await query(
      `SELECT ma.*, a.title, a.slug, a.summary, a.updated_at AS article_updated_at, u.name AS assigned_by_name
       FROM mandatory_ack_assignments ma
       JOIN articles a ON a.id = ma.article_id
       LEFT JOIN users u ON u.id = ma.assigned_by
       WHERE ma.user_id = $1
         AND ma.status NOT IN ('cancelled', 'superseded')
         AND a.is_visible = true
       ORDER BY
         CASE WHEN ma.acknowledged_at IS NULL THEN 0 ELSE 1 END,
         ma.due_at ASC NULLS LAST,
         ma.assigned_at DESC`,
      [req.user.id]
    );
    res.json(result.rows.map(serializeMandatoryAssignment));
  } catch (error: any) {
    console.error('Failed to get mandatory acknowledgements:', error);
    res.status(500).json({ error: 'Failed to get mandatory acknowledgements', details: error.message });
  }
};

export const getMandatoryAcknowledgementCount = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const result = await query(
      `SELECT COUNT(*)::int AS count
       FROM mandatory_ack_assignments ma
       JOIN articles a ON a.id = ma.article_id
       WHERE ma.user_id = $1
         AND ma.acknowledged_at IS NULL
         AND ma.status NOT IN ('cancelled', 'superseded')
         AND a.is_visible = true`,
      [req.user.id]
    );
    res.json({ count: Number(result.rows[0]?.count || 0) });
  } catch (error: any) {
    console.error('Failed to get mandatory acknowledgement count:', error);
    res.status(500).json({ error: 'Failed to get mandatory acknowledgement count', details: error.message });
  }
};

export const getArticleMandatoryAcknowledgement = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const assignment = await getLatestMandatoryAssignmentForUser(Number(req.params.id), req.user.id);
    if (!assignment) {
      return res.json({ required: false, assignment: null });
    }
    res.json({ required: true, assignment: serializeMandatoryAssignment(assignment) });
  } catch (error: any) {
    console.error('Failed to get article mandatory acknowledgement:', error);
    res.status(500).json({ error: 'Failed to get article mandatory acknowledgement', details: error.message });
  }
};

export const markMandatoryAcknowledgementOpened = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const assignment = await getLatestMandatoryAssignmentForUser(Number(req.params.id), req.user.id);
    if (!assignment) return res.json({ required: false, assignment: null });
    if (assignment.acknowledged_at) {
      return res.json({ required: true, assignment: serializeMandatoryAssignment(assignment) });
    }

    const updated = await query(
      `UPDATE mandatory_ack_assignments
       SET first_viewed_at = COALESCE(first_viewed_at, CURRENT_TIMESTAMP),
           status = CASE WHEN status = 'not_open' OR status = 'requires_reacknowledgement' THEN 'in_progress' ELSE status END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [assignment.id]
    );
    res.json({ required: true, assignment: serializeMandatoryAssignment(updated.rows[0]) });
  } catch (error: any) {
    console.error('Failed to mark mandatory acknowledgement opened:', error);
    res.status(500).json({ error: 'Failed to mark mandatory acknowledgement opened', details: error.message });
  }
};

export const markMandatoryAcknowledgementReadComplete = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const assignment = await getLatestMandatoryAssignmentForUser(Number(req.params.id), req.user.id);
    if (!assignment) return res.json({ required: false, assignment: null });
    if (assignment.acknowledged_at) {
      return res.json({ required: true, assignment: serializeMandatoryAssignment(assignment) });
    }

    const updated = await query(
      `UPDATE mandatory_ack_assignments
       SET first_viewed_at = COALESCE(first_viewed_at, CURRENT_TIMESTAMP),
           read_completed_at = COALESCE(read_completed_at, CURRENT_TIMESTAMP),
           status = 'read_completed',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [assignment.id]
    );
    res.json({ required: true, assignment: serializeMandatoryAssignment(updated.rows[0]) });
  } catch (error: any) {
    console.error('Failed to mark mandatory acknowledgement read complete:', error);
    res.status(500).json({ error: 'Failed to mark mandatory acknowledgement read complete', details: error.message });
  }
};

export const confirmMandatoryAcknowledgement = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const assignment = await getLatestMandatoryAssignmentForUser(Number(req.params.id), req.user.id);
    if (!assignment) return res.status(404).json({ error: 'Обязательное ознакомление для этой статьи не назначено.' });
    if (assignment.acknowledged_at) {
      return res.json({ required: true, assignment: serializeMandatoryAssignment(assignment) });
    }
    if (!assignment.read_completed_at) {
      return res.status(400).json({ error: 'Подтверждение доступно только после прокрутки статьи до конца.' });
    }
    const articleResult = await query('SELECT content FROM articles WHERE id = $1', [Number(req.params.id)]);
    const requiredBlocksInArticle = String(articleResult.rows[0]?.content || '').match(/data-required-for-ack=["']true["']/gi)?.length || 0;
    const openedRequiredBlocks = Number(req.body?.opened_required_collapsibles_count || 0);
    if (requiredBlocksInArticle > 0 && openedRequiredBlocks < requiredBlocksInArticle) {
      return res.status(400).json({ error: 'Откройте все обязательные раскрывающиеся блоки перед подтверждением ознакомления.' });
    }

    const now = new Date();
    const dueAt = assignment.due_at ? new Date(assignment.due_at) : null;
    const completedInTime = dueAt ? now.getTime() <= dueAt.getTime() : true;
    const overdueDays = dueAt && !completedInTime
      ? Math.max(1, Math.ceil((now.getTime() - dueAt.getTime()) / (24 * 60 * 60 * 1000)))
      : 0;

    const updated = await query(
      `UPDATE mandatory_ack_assignments
       SET acknowledged_at = CURRENT_TIMESTAMP,
           status = 'acknowledged',
           completed_in_time = $2,
           overdue_days = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND acknowledged_at IS NULL
       RETURNING *`,
      [assignment.id, completedInTime, overdueDays]
    );

    res.json({ required: true, assignment: serializeMandatoryAssignment(updated.rows[0] || assignment) });
  } catch (error: any) {
    console.error('Failed to confirm mandatory acknowledgement:', error);
    res.status(500).json({ error: 'Failed to confirm mandatory acknowledgement', details: error.message });
  }
};

export const reindexAndClearCache = async (req: Request, res: Response) => {
  try {
    console.log('Triggering manual search index sync and cache clearing...');
    await msService.triggerFullSync();
    res.json({ message: 'Кэш и поисковый индекс Meilisearch успешно очищены и синхронизированы!' });
  } catch (error: any) {
    console.error('Error clearing cache/syncing Meilisearch:', error);
    res.status(500).json({ error: 'Failed to reindex', details: error.message });
  }
};

export const seedSectionArticles = async (req: Request, res: Response) => {
  try {
    const scriptPath = path.join(__dirname, '../scripts/seedSectionArticles.js');
    const { stdout, stderr } = await execFileAsync(process.execPath, [scriptPath], {
      env: {
        ...process.env,
        CONFIRM_SECTION_ARTICLES: 'true',
      },
      timeout: 120000,
      maxBuffer: 1024 * 1024,
    });

    const jsonLine = stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .find((line) => line.startsWith('{') && line.endsWith('}'));

    let result = null;
    if (jsonLine) {
      try {
        result = JSON.parse(jsonLine);
      } catch (parseError) {
        console.warn('Failed to parse section seed output:', parseError);
      }
    }

    res.json({
      message: 'Section demo articles seeded successfully.',
      result,
      warning: stderr.trim() || undefined,
    });
  } catch (error: any) {
    console.error('Failed to seed section articles:', error);
    res.status(500).json({
      error: 'Failed to seed section articles',
      details: error.stderr || error.message,
    });
  }
};

export const reorderArticles = async (req: Request, res: Response) => {
  try {
    const { orders } = req.body; // array of { id: number, position: number }
    if (!orders || !Array.isArray(orders)) {
      return res.status(400).json({ error: 'Orders array is required.' });
    }

    for (const item of orders) {
      await ArticleModel.updateArticlePosition(Number(item.id), Number(item.position));
    }

    res.json({ message: 'Articles reordered successfully' });
  } catch (error: any) {
    console.error('Error reordering articles:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const syncArticle = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { force } = req.body;
    
    // Lazy load the sync service to avoid circular dependency
    const { syncArticle: runSync } = require('../services/sourceSync');
    await runSync(Number(id), { force: !!force });
    
    res.json({ message: 'Синхронизация завершена успешно!' });
  } catch (error: any) {
    console.error('Manual sync failed:', error);
    res.status(500).json({ error: 'Синхронизация завершилась ошибкой', details: error.message });
  }
};

export const getArticleSyncHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const historyRes = await query(
      'SELECT * FROM article_sync_history WHERE article_id = $1 ORDER BY synced_at DESC LIMIT 50',
      [Number(id)]
    );
    res.json(historyRes.rows);
  } catch (error: any) {
    console.error('Failed to get sync history:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const getClassifierData = async (req: Request, res: Response) => {
  try {
    const mainRes = await query(
      "SELECT structured_data FROM articles WHERE slug = 'auto-list'"
    );
    if (mainRes.rows.length > 0 && mainRes.rows[0].structured_data) {
      return res.json(mainRes.rows[0].structured_data);
    }
    res.json(null);
  } catch (error: any) {
    console.error('Failed to fetch classifier data:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const getNotifications = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userRole = req.user ? req.user.role : '';
    const userId = req.user ? req.user.id : null;
    
    const sql = `
      SELECT * FROM notifications 
      WHERE (role = $1 OR user_id = $2 OR (role IS NULL AND user_id IS NULL))
      ORDER BY created_at DESC LIMIT 30
    `;
    const notifRes = await query(sql, [userRole, userId]);
    res.json(notifRes.rows);
  } catch (error: any) {
    console.error('Failed to get notifications:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const markNotificationsRead = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userRole = req.user ? req.user.role : '';
    const userId = req.user ? req.user.id : null;
    
    const sql = `
      UPDATE notifications 
      SET is_read = true 
      WHERE (role = $1 OR user_id = $2 OR (role IS NULL AND user_id IS NULL))
    `;
    await query(sql, [userRole, userId]);
    res.json({ message: 'Уведомления помечены как прочитанные' });
  } catch (error: any) {
    console.error('Failed to mark notifications read:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const getArticleChanges = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT cl.*, u.name as user_name, u.role as user_role
       FROM article_changes_log cl
       LEFT JOIN users u ON cl.user_id = u.id
       WHERE cl.article_id = $1
       ORDER BY cl.changed_at DESC`,
      [Number(id)]
    );
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const getPopularArticles = async (req: Request, res: Response) => {
  try {
    const allowedSectionIds = await getAllowedSectionsForRequest(req);
    const result = await query(
      `SELECT a.*, u.name as author_name,
              COALESCE(array_agg(DISTINCT t.tag_name) FILTER (WHERE t.tag_name IS NOT NULL), '{}') as tags
       FROM articles a
       LEFT JOIN users u ON a.author_id = u.id
       LEFT JOIN article_tags t ON a.id = t.article_id
       LEFT JOIN article_sections axs ON a.id = axs.article_id
       WHERE a.published = true AND a.is_visible = true AND axs.section_id = ANY($1::int[])
       GROUP BY a.id, u.name
       ORDER BY a.views DESC, a.created_at DESC
       LIMIT 10`,
      [allowedSectionIds]
    );
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const getTrendingArticles = async (req: Request, res: Response) => {
  try {
    const allowedSectionIds = await getAllowedSectionsForRequest(req);
    const result = await query(
      `SELECT a.*, COUNT(DISTINCT COALESCE(vl.user_id::text, vl.ip_address)) as trending_views, u.name as author_name,
              COALESCE(array_agg(DISTINCT t.tag_name) FILTER (WHERE t.tag_name IS NOT NULL), '{}') as tags
       FROM articles a
       LEFT JOIN users u ON a.author_id = u.id
       LEFT JOIN article_tags t ON a.id = t.article_id
       LEFT JOIN article_sections axs ON a.id = axs.article_id
       LEFT JOIN article_views_log vl ON a.id = vl.article_id AND vl.viewed_at > NOW() - INTERVAL '7 days'
       WHERE a.published = true AND a.is_visible = true AND axs.section_id = ANY($1::int[])
       GROUP BY a.id, u.name
       ORDER BY trending_views DESC, a.views DESC, a.created_at DESC
       LIMIT 10`,
      [allowedSectionIds]
    );
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const getRecommendedArticles = async (req: Request, res: Response) => {
  try {
    const allowedSectionIds = await getAllowedSectionsForRequest(req);
    const result = await query(
      `SELECT a.*, COUNT(fa.user_id) as favorites_count, u.name as author_name,
              COALESCE(array_agg(DISTINCT t.tag_name) FILTER (WHERE t.tag_name IS NOT NULL), '{}') as tags
       FROM articles a
       LEFT JOIN users u ON a.author_id = u.id
       LEFT JOIN article_tags t ON a.id = t.article_id
       LEFT JOIN article_sections axs ON a.id = axs.article_id
       LEFT JOIN user_favorite_articles fa ON a.id = fa.article_id
       WHERE a.published = true AND a.is_visible = true AND axs.section_id = ANY($1::int[])
       GROUP BY a.id, u.name
       ORDER BY favorites_count DESC, a.views DESC, a.created_at DESC
       LIMIT 10`,
      [allowedSectionIds]
    );
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const getNavigationTree = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const role = authReq.user ? authReq.user.role : '';
    const userId = authReq.user ? authReq.user.id : 0;
    const employeeId = authReq.user ? authReq.user.employee_id : null;

    const allowedSectionIds = await getUserAllowedSections(employeeId, role, userId);
    const activeGuestGrants = userId ? await getActiveGuestAccessGrants(userId) : [];
    const directGuestArticleIds = Array.from(new Set(
      activeGuestGrants
        .map((grant) => grant.article_id ? Number(grant.article_id) : null)
        .filter((id): id is number => id !== null)
    ));

    let directGuestSectionIds: number[] = [];
    if (directGuestArticleIds.length > 0) {
      const directGuestSectionsRes = await query(
        `SELECT DISTINCT section_id
         FROM article_sections
         WHERE article_id = ANY($1::int[])`,
        [directGuestArticleIds]
      );
      directGuestSectionIds = directGuestSectionsRes.rows.map((row) => Number(row.section_id));
    }

    const navigationSectionIds = Array.from(new Set([...allowedSectionIds, ...directGuestSectionIds]));

    if (navigationSectionIds.length === 0) {
      return res.json([]);
    }

    // 1. Получаем все разделы (sections), которые разрешены пользователю
    const sectionsRes = await query(
      `SELECT s.id, s.name, s.description, s.space_id, s.parent_section_id, s.position_id
       FROM sections s
       WHERE s.id = ANY($1::int[]) AND s.status = 'Active'
       ORDER BY s.id ASC`,
      [navigationSectionIds]
    );
    const sections = sectionsRes.rows;

    const spaceIds = Array.from(new Set(sections.map(s => s.space_id)));

    if (spaceIds.length === 0) {
      return res.json([]);
    }

    // 2. Получаем все пространства (spaces) для этих разделов
    const spacesRes = await query(
      `SELECT sp.id, sp.name, sp.description, sp.department_id
       FROM spaces sp
       WHERE sp.id = ANY($1::int[]) AND sp.status = 'Active'
       ORDER BY sp.name ASC`,
      [spaceIds]
    );
    const spaces = spacesRes.rows;

    // 3. Получаем все статьи (articles), привязанные СТРОГО к своему основному разделу (Primary Section)
    let allowedStatuses = ['published', 'requires_verification'];
    if (role === 'Admin') {
      allowedStatuses = ['draft', 'on_approval', 'published', 'requires_verification', 'archived', 'expired'];
    } else if (role === 'Editor') {
      allowedStatuses = ['published', 'requires_verification', 'archived', 'expired'];
    }

    const articlesRes = await query(
      `SELECT a.id, a.title, a.slug, a.status, a.position, a.article_type, ps.section_id
       FROM articles a
       JOIN (
         SELECT DISTINCT ON (article_id) article_id, section_id
         FROM article_sections
         ORDER BY article_id, id ASC
       ) ps ON a.id = ps.article_id
       WHERE EXISTS (
           SELECT 1 FROM article_sections axs_check
           WHERE axs_check.article_id = a.id
             AND (axs_check.section_id = ANY($1::int[]) OR a.id = ANY($4::int[]))
         )
         AND a.is_visible = true
         AND (a.status = ANY($2::varchar[]) OR a.author_id = $3)
       ORDER BY (CASE WHEN a.article_type = 'job_description' THEN 0 ELSE 1 END) ASC, a.position ASC, a.created_at DESC`,
      [allowedSectionIds, allowedStatuses, userId, directGuestArticleIds]
    );
    const articles = articlesRes.rows;

    // 4. Группируем статьи строго по их первичному основному разделу
    const articlesBySection: Record<number, any[]> = {};
    articles.forEach(art => {
      const secId = Number(art.section_id);
      if (!articlesBySection[secId]) {
        articlesBySection[secId] = [];
      }
      if (!articlesBySection[secId].some(a => a.id === art.id)) {
        articlesBySection[secId].push({
          id: art.id,
          title: art.title,
          slug: art.slug,
          status: art.status,
          position: art.position,
          article_type: art.article_type,
          guest_access: getGuestAccessInfoForArticle(activeGuestGrants, art.id, [secId])
        });
      }
    });

    // Хелпер для подсчета собственных статей в разделе (включая подразделы)
    const countSectionArticles = (sectionNode: any): number => {
      let count = sectionNode.articles ? sectionNode.articles.length : 0;
      if (sectionNode.subsections) {
        sectionNode.subsections.forEach((sub: any) => {
          count += countSectionArticles(sub);
        });
      }
      return count;
    };

    // 5. Группируем разделы по пространствам и исключаем должности без собственных статей
    const buildSectionTree = (
      allSections: any[],
      parentId: number | null,
      spaceId: number
    ): any[] => {
      return allSections
        .filter(s => s.space_id === spaceId && s.parent_section_id === parentId)
        .map(s => {
          const children = buildSectionTree(allSections, s.id, spaceId);
          const sectionGuestAccess = getGuestAccessInfoForSection(activeGuestGrants, s.id);
          return {
            id: s.id,
            name: s.name,
            description: s.description,
            position_id: s.position_id,
            guest_access: sectionGuestAccess,
            articles: articlesBySection[s.id] || [],
            subsections: children
          };
        })
        .filter(node => countSectionArticles(node) > 0);
    };

    const result = spaces
      .map(sp => {
        const spaceSections = sections.filter(s => s.space_id === sp.id);
        
        const rootSections = spaceSections.filter(s => 
          s.parent_section_id === null || !allowedSectionIds.includes(s.parent_section_id)
        );

        const sectionTree = rootSections
          .map(s => {
            const children = buildSectionTree(spaceSections, s.id, sp.id);
            const sectionGuestAccess = getGuestAccessInfoForSection(activeGuestGrants, s.id);
            return {
              id: s.id,
              name: s.name,
              description: s.description,
              position_id: s.position_id,
              guest_access: sectionGuestAccess,
              articles: articlesBySection[s.id] || [],
              subsections: children
            };
          })
          .filter(node => countSectionArticles(node) > 0);

        return {
          id: sp.id,
          name: sp.name,
          description: sp.description,
          department_id: sp.department_id,
          sections: sectionTree
        };
      })
      .filter(sp => sp.sections && sp.sections.length > 0);

    res.json(result);
  } catch (error: any) {
    console.error('Error fetching navigation tree:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

// CHECK ACCESS ENDPOINT
export const checkAccess = async (req: Request, res: Response) => {
  try {
    const { sectionId, articleId } = req.query;
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user ? authReq.user.id : 0;
    const role = authReq.user ? authReq.user.role : '';
    const employeeId = authReq.user ? authReq.user.employee_id : null;

    if (role === 'Admin') {
      return res.json({ hasAccess: true });
    }

    const activeGuestGrants = userId ? await getActiveGuestAccessGrants(userId) : [];

    if (articleId) {
      const article = await ArticleModel.getArticleById(Number(articleId));
      if (!article) return res.status(404).json({ error: 'Article not found' });
      
      const allowedSections = await getUserAllowedSections(employeeId, role, userId);
      const hasSectionAccess = article.section_ids.some(id => allowedSections.includes(id));
      const guestAccess = getGuestAccessInfoForArticle(activeGuestGrants, article.id, article.section_ids || []);
      const hasGuestAccess = !!guestAccess;
      
      return res.json({ hasAccess: hasSectionAccess || hasGuestAccess, guestAccess });
    }

    if (sectionId) {
      const allowedSections = await getUserAllowedSections(employeeId, role, userId);
      const guestAccess = getGuestAccessInfoForSection(activeGuestGrants, Number(sectionId));
      const hasAccess = allowedSections.includes(Number(sectionId)) || !!guestAccess;
      return res.json({ hasAccess, guestAccess });
    }

    return res.status(400).json({ error: 'sectionId or articleId required' });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

// ARTICLE LINKS ENDPOINTS
export const getArticleLinks = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const authReq = req as AuthenticatedRequest;
    const role = authReq.user ? authReq.user.role : '';
    const userId = authReq.user ? authReq.user.id : 0;
    const employeeId = authReq.user ? authReq.user.employee_id : null;
    const allowedSectionIds = await getUserAllowedSections(employeeId, role, userId);
    const activeGuestGrants = userId ? await getActiveGuestAccessGrants(userId) : [];
    const directGuestArticleIds = activeGuestGrants
      .map((grant) => grant.article_id ? Number(grant.article_id) : null)
      .filter((guestArticleId): guestArticleId is number => guestArticleId !== null);
    const guestSectionIds = activeGuestGrants
      .map((grant) => grant.section_id ? Number(grant.section_id) : null)
      .filter((guestSectionId): guestSectionId is number => guestSectionId !== null);
    const { capabilities } = await getUserCapabilities(userId || null, role);
    const canManageCatalog =
      !!authReq.user &&
      (capabilities.can_manage_access || capabilities.can_manage_structure || capabilities.can_manage_users);
    const canEditCatalog =
      !!authReq.user &&
      (canManageCatalog ||
        capabilities.can_create ||
        capabilities.can_edit ||
        capabilities.can_publish ||
        capabilities.can_approve);
    let allowedStatuses = ['published', 'requires_verification'];
    if (canManageCatalog) {
      allowedStatuses = ['draft', 'on_approval', 'published', 'requires_verification', 'archived', 'expired'];
    } else if (canEditCatalog) {
      allowedStatuses = ['published', 'requires_verification', 'archived', 'expired'];
    }

    const result = await query(
      `SELECT al.*,
              a.title as target_title,
              a.slug as target_slug,
              a.summary as target_summary,
              a.status as target_status,
              a.updated_at as target_updated_at,
              COALESCE(array_agg(DISTINCT CONCAT(sp.name, ' / ', s.name)) FILTER (WHERE s.id IS NOT NULL), '{}') as target_section_paths
       FROM article_links al
       JOIN articles a ON al.target_article_id = a.id
       LEFT JOIN article_sections axs ON axs.article_id = a.id
       LEFT JOIN sections s ON s.id = axs.section_id
       LEFT JOIN spaces sp ON sp.id = s.space_id
       WHERE al.source_article_id = $1
         AND a.is_visible = true
         AND (a.status = ANY($2::varchar[]) OR a.author_id = $3)
         AND (
           axs.section_id = ANY($4::int[])
           OR NOT EXISTS (SELECT 1 FROM article_sections WHERE article_id = a.id)
           OR a.id = ANY($5::int[])
           OR axs.section_id = ANY($6::int[])
         )
       GROUP BY al.id, a.id
       ORDER BY al.created_at DESC`,
      [id, allowedStatuses, userId, allowedSectionIds, directGuestArticleIds, guestSectionIds]
    );
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const getArticleBacklinks = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const authReq = req as AuthenticatedRequest;
    const role = authReq.user ? authReq.user.role : '';
    const userId = authReq.user ? authReq.user.id : 0;
    const employeeId = authReq.user ? authReq.user.employee_id : null;
    const allowedSectionIds = await getUserAllowedSections(employeeId, role, userId);
    const activeGuestGrants = userId ? await getActiveGuestAccessGrants(userId) : [];
    const directGuestArticleIds = activeGuestGrants
      .map((grant) => grant.article_id ? Number(grant.article_id) : null)
      .filter((guestArticleId): guestArticleId is number => guestArticleId !== null);
    const guestSectionIds = activeGuestGrants
      .map((grant) => grant.section_id ? Number(grant.section_id) : null)
      .filter((guestSectionId): guestSectionId is number => guestSectionId !== null);
    const { capabilities } = await getUserCapabilities(userId || null, role);
    const canManageCatalog =
      !!authReq.user &&
      (capabilities.can_manage_access || capabilities.can_manage_structure || capabilities.can_manage_users);
    const canEditCatalog =
      !!authReq.user &&
      (canManageCatalog ||
        capabilities.can_create ||
        capabilities.can_edit ||
        capabilities.can_publish ||
        capabilities.can_approve);
    let allowedStatuses = ['published', 'requires_verification'];
    if (canManageCatalog) {
      allowedStatuses = ['draft', 'on_approval', 'published', 'requires_verification', 'archived', 'expired'];
    } else if (canEditCatalog) {
      allowedStatuses = ['published', 'requires_verification', 'archived', 'expired'];
    }

    const result = await query(
      `SELECT al.*,
              a.title as source_title,
              a.slug as source_slug,
              a.summary as source_summary,
              a.status as source_status,
              a.updated_at as source_updated_at,
              COALESCE(array_agg(DISTINCT CONCAT(sp.name, ' / ', s.name)) FILTER (WHERE s.id IS NOT NULL), '{}') as source_section_paths
       FROM article_links al
       JOIN articles a ON al.source_article_id = a.id
       LEFT JOIN article_sections axs ON axs.article_id = a.id
       LEFT JOIN sections s ON s.id = axs.section_id
       LEFT JOIN spaces sp ON sp.id = s.space_id
       WHERE al.target_article_id = $1
         AND a.is_visible = true
         AND (a.status = ANY($2::varchar[]) OR a.author_id = $3)
         AND (
           axs.section_id = ANY($4::int[])
           OR NOT EXISTS (SELECT 1 FROM article_sections WHERE article_id = a.id)
           OR a.id = ANY($5::int[])
           OR axs.section_id = ANY($6::int[])
         )
       GROUP BY al.id, a.id
       ORDER BY al.created_at DESC`,
      [id, allowedStatuses, userId, allowedSectionIds, directGuestArticleIds, guestSectionIds]
    );
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const createArticleLink = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { target_article_id, link_text } = req.body;
    
    if (!target_article_id) {
      return res.status(400).json({ error: 'target_article_id is required' });
    }

    const result = await query(
      `INSERT INTO article_links (source_article_id, target_article_id, link_text, link_source)
       VALUES ($1, $2, $3, 'manual')
       ON CONFLICT (source_article_id, target_article_id) 
       DO UPDATE SET link_text = EXCLUDED.link_text, link_source = 'manual'
       RETURNING *`,
      [id, target_article_id, link_text || '']
    );
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const deleteArticleLink = async (req: Request, res: Response) => {
  try {
    const { id, linkId } = req.params;
    const result = await query(
      'DELETE FROM article_links WHERE id = $1 AND source_article_id = $2',
      [linkId, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Link not found' });
    }
    res.json({ message: 'Link deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};
