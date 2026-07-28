import { Request, Response } from 'express';
import { pool } from '../config/db';

const ALLOWED_PERIODS = new Set([7, 30, 90, 180, 365]);

const parsePeriod = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && ALLOWED_PERIODS.has(parsed) ? parsed : fallback;
};

const parseStaleDays = (value: unknown) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 30 && parsed <= 730 ? parsed : 90;
};

export const getAnalyticsReport = async (req: Request, res: Response) => {
  const periodDays = parsePeriod(req.query.days, 30);
  const staleDays = parseStaleDays(req.query.staleDays);
  const mandatoryStatus = typeof req.query.mandatoryStatus === 'string' ? req.query.mandatoryStatus : 'all';
  const mandatoryArticleId = Number(req.query.mandatoryArticleId || 0);
  const mandatoryDepartmentId = Number(req.query.mandatoryDepartmentId || 0);
  const mandatoryPositionId = Number(req.query.mandatoryPositionId || 0);
  const mandatoryEmployeeId = Number(req.query.mandatoryEmployeeId || 0);

  try {
    const [
      overviewResult,
      dailyViewsResult,
      topArticlesResult,
      sectionStatsResult,
      contributorStatsResult,
      userActivityResult,
      staleArticlesResult,
      mandatoryRowsResult,
      mandatoryByArticleResult,
      mandatorySummaryResult,
    ] = await Promise.all([
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE a.is_visible = true) AS total_articles,
           COUNT(*) FILTER (WHERE a.is_visible = true AND a.published = true) AS published_articles,
           COUNT(*) FILTER (WHERE a.is_visible = true AND a.published = false) AS draft_articles,
           COUNT(*) FILTER (WHERE a.is_visible = false) AS archived_articles,
           COUNT(*) FILTER (
             WHERE a.is_visible = true
               AND a.published = true
               AND a.updated_at < NOW() - ($2::int * INTERVAL '1 day')
           ) AS stale_articles,
           COUNT(*) FILTER (
             WHERE a.updated_at >= NOW() - ($1::int * INTERVAL '1 day')
           ) AS updated_articles,
           (SELECT COUNT(*) FROM spaces WHERE status = 'Active') AS total_spaces,
           (SELECT COUNT(*) FROM sections WHERE status = 'Active') AS total_sections,
           (SELECT COUNT(*) FROM users WHERE is_blocked = false) AS total_users,
           (SELECT COUNT(*) FROM article_views_log
             WHERE viewed_at >= NOW() - ($1::int * INTERVAL '1 day')) AS period_views,
           (SELECT COUNT(DISTINCT user_id) FROM article_views_log
             WHERE user_id IS NOT NULL
               AND viewed_at >= NOW() - ($1::int * INTERVAL '1 day')) AS active_users
         FROM articles a`,
        [periodDays, staleDays]
      ),
      pool.query(
        `WITH days AS (
           SELECT generate_series(
             CURRENT_DATE - ($1::int - 1),
             CURRENT_DATE,
             INTERVAL '1 day'
           )::date AS day
         )
         SELECT d.day,
                COUNT(v.id)::int AS views,
                COUNT(DISTINCT v.user_id)::int AS unique_readers
         FROM days d
         LEFT JOIN article_views_log v ON v.viewed_at::date = d.day
         GROUP BY d.day
         ORDER BY d.day`,
        [periodDays]
      ),
      pool.query(
        `SELECT a.id, a.title, a.slug, a.views AS total_views,
                COUNT(v.id)::int AS period_views,
                COUNT(DISTINCT COALESCE(v.user_id::text, v.ip_address))::int AS unique_readers,
                (SELECT COUNT(*) FROM user_favorite_articles f WHERE f.article_id = a.id)::int AS favorites
         FROM articles a
         LEFT JOIN article_views_log v
           ON v.article_id = a.id
          AND v.viewed_at >= NOW() - ($1::int * INTERVAL '1 day')
         WHERE a.is_visible = true
         GROUP BY a.id
         ORDER BY period_views DESC, a.views DESC, a.title ASC
         LIMIT 10`,
        [periodDays]
      ),
      pool.query(
        `SELECT s.id, s.name AS section_name, sp.name AS space_name,
                COUNT(DISTINCT a.id) FILTER (WHERE a.is_visible = true)::int AS article_count,
                COUNT(v.id)::int AS period_views,
                MAX(a.updated_at) AS last_updated_at
         FROM sections s
         JOIN spaces sp ON sp.id = s.space_id
         LEFT JOIN article_sections axs ON axs.section_id = s.id
         LEFT JOIN articles a ON a.id = axs.article_id AND a.is_visible = true
         LEFT JOIN article_views_log v
           ON v.article_id = a.id
          AND v.viewed_at >= NOW() - ($1::int * INTERVAL '1 day')
         WHERE s.status = 'Active'
         GROUP BY s.id, s.name, sp.name
         ORDER BY period_views DESC, article_count DESC, s.name ASC
         LIMIT 20`,
        [periodDays]
      ),
      pool.query(
        `SELECT u.id, u.name, u.role,
                COUNT(DISTINCT a.id)::int AS authored_articles,
                COUNT(DISTINCT c.id) FILTER (
                  WHERE c.changed_at >= NOW() - ($1::int * INTERVAL '1 day')
                )::int AS period_edits,
                MAX(c.changed_at) AS last_edit_at
         FROM users u
         LEFT JOIN articles a ON a.author_id = u.id AND a.is_visible = true
         LEFT JOIN article_changes_log c ON c.user_id = u.id
         WHERE u.is_blocked = false
         GROUP BY u.id, u.name, u.role
         HAVING COUNT(DISTINCT a.id) > 0 OR COUNT(c.id) > 0
         ORDER BY period_edits DESC, authored_articles DESC, u.name ASC
         LIMIT 20`,
        [periodDays]
      ),
      pool.query(
        `SELECT u.id, u.name, u.role,
                COUNT(v.id)::int AS views,
                COUNT(DISTINCT v.article_id)::int AS unique_articles,
                MAX(v.viewed_at) AS last_viewed_at
         FROM users u
         LEFT JOIN article_views_log v
           ON v.user_id = u.id
          AND v.viewed_at >= NOW() - ($1::int * INTERVAL '1 day')
         WHERE u.is_blocked = false
         GROUP BY u.id, u.name, u.role
         ORDER BY views DESC, u.name ASC
         LIMIT 50`,
        [periodDays]
      ),
      pool.query(
        `SELECT a.id, a.title, a.slug, a.updated_at, a.views,
                u.name AS owner_name,
                EXTRACT(DAY FROM NOW() - a.updated_at)::int AS days_without_update
         FROM articles a
         LEFT JOIN users u ON u.id = COALESCE(a.owner_id, a.author_id)
         WHERE a.is_visible = true
           AND a.published = true
           AND a.updated_at < NOW() - ($1::int * INTERVAL '1 day')
         ORDER BY a.updated_at ASC
         LIMIT 50`,
        [staleDays]
      ),
      pool.query(
        `SELECT
           ma.id,
           ma.user_id,
           ma.employee_id,
           u.username,
           u.name AS user_name,
           ma.department_id,
           ma.department_name,
           ma.position_id,
           ma.position_name,
           ma.manager_name,
           a.id AS article_id,
           a.title AS article_title,
           a.slug AS article_slug,
           a.updated_at AS article_updated_at,
           a.created_at AS article_published_at,
           author.name AS article_author,
           ma.article_version,
           ma.assigned_at,
           ma.first_viewed_at,
           ma.read_completed_at,
           ma.acknowledged_at,
           ma.due_at,
           CASE
             WHEN ma.acknowledged_at IS NOT NULL THEN 'acknowledged'
             WHEN ma.due_at IS NOT NULL AND ma.due_at < NOW() THEN 'overdue'
             WHEN ma.read_completed_at IS NOT NULL THEN 'read_completed'
             WHEN ma.first_viewed_at IS NOT NULL THEN 'in_progress'
             ELSE ma.status
           END AS status,
           CASE
             WHEN ma.due_at IS NOT NULL AND ma.acknowledged_at IS NULL AND ma.due_at < NOW()
               THEN CEIL(EXTRACT(EPOCH FROM (NOW() - ma.due_at)) / 86400)::int
             ELSE COALESCE(ma.overdue_days, 0)
           END AS overdue_days,
           COALESCE(ma.completed_in_time, false) AS completed_in_time,
           COALESCE(string_agg(DISTINCT s.name, ', '), 'Без раздела') AS article_sections
         FROM mandatory_ack_assignments ma
         JOIN users u ON u.id = ma.user_id
         JOIN articles a ON a.id = ma.article_id
         LEFT JOIN users author ON author.id = a.author_id
         LEFT JOIN article_sections axs ON axs.article_id = a.id
         LEFT JOIN sections s ON s.id = axs.section_id
         WHERE ma.status NOT IN ('cancelled', 'superseded')
           AND ma.assigned_at >= NOW() - ($1::int * INTERVAL '1 day')
           AND ($2::text = 'all' OR (
             CASE
               WHEN ma.acknowledged_at IS NOT NULL THEN 'acknowledged'
               WHEN ma.due_at IS NOT NULL AND ma.due_at < NOW() THEN 'overdue'
               WHEN ma.read_completed_at IS NOT NULL THEN 'read_completed'
               WHEN ma.first_viewed_at IS NOT NULL THEN 'in_progress'
               ELSE ma.status
             END
           ) = $2::text)
           AND ($3::int = 0 OR ma.article_id = $3::int)
           AND ($4::int = 0 OR ma.department_id = $4::int)
           AND ($5::int = 0 OR ma.position_id = $5::int)
           AND ($6::int = 0 OR ma.employee_id = $6::int)
         GROUP BY ma.id, u.id, a.id, author.name
         ORDER BY ma.due_at ASC NULLS LAST, ma.assigned_at DESC
         LIMIT 1000`,
        [periodDays, mandatoryStatus, mandatoryArticleId, mandatoryDepartmentId, mandatoryPositionId, mandatoryEmployeeId]
      ),
      pool.query(
        `SELECT
           a.id AS article_id,
           a.title AS article_title,
           a.slug AS article_slug,
           ma.article_version,
           COUNT(*)::int AS assigned_count,
           COUNT(*) FILTER (WHERE ma.acknowledged_at IS NOT NULL)::int AS acknowledged_count,
           COUNT(*) FILTER (WHERE ma.acknowledged_at IS NULL)::int AS not_acknowledged_count,
           COUNT(*) FILTER (WHERE ma.acknowledged_at IS NULL AND ma.due_at IS NOT NULL AND ma.due_at < NOW())::int AS overdue_count,
           ROUND(
             CASE WHEN COUNT(*) = 0 THEN 0 ELSE COUNT(*) FILTER (WHERE ma.acknowledged_at IS NOT NULL)::numeric * 100 / COUNT(*) END,
             1
           )::float AS completion_percent,
           ROUND(AVG(EXTRACT(EPOCH FROM (ma.acknowledged_at - ma.assigned_at)) / 3600) FILTER (WHERE ma.acknowledged_at IS NOT NULL), 1)::float AS avg_hours_to_ack
         FROM mandatory_ack_assignments ma
         JOIN articles a ON a.id = ma.article_id
         WHERE ma.status NOT IN ('cancelled', 'superseded')
           AND ma.assigned_at >= NOW() - ($1::int * INTERVAL '1 day')
           AND ($2::text = 'all' OR (
             CASE
               WHEN ma.acknowledged_at IS NOT NULL THEN 'acknowledged'
               WHEN ma.due_at IS NOT NULL AND ma.due_at < NOW() THEN 'overdue'
               WHEN ma.read_completed_at IS NOT NULL THEN 'read_completed'
               WHEN ma.first_viewed_at IS NOT NULL THEN 'in_progress'
               ELSE ma.status
             END
           ) = $2::text)
           AND ($3::int = 0 OR ma.article_id = $3::int)
           AND ($4::int = 0 OR ma.department_id = $4::int)
           AND ($5::int = 0 OR ma.position_id = $5::int)
           AND ($6::int = 0 OR ma.employee_id = $6::int)
         GROUP BY a.id, a.title, a.slug, ma.article_version
         ORDER BY overdue_count DESC, assigned_count DESC, a.title ASC
         LIMIT 300`,
        [periodDays, mandatoryStatus, mandatoryArticleId, mandatoryDepartmentId, mandatoryPositionId, mandatoryEmployeeId]
      ),
      pool.query(
        `SELECT
           (SELECT COUNT(*) FROM articles WHERE mandatory_ack_enabled = true AND is_visible = true)::int AS mandatory_articles,
           COUNT(*)::int AS assigned_count,
           COUNT(*) FILTER (WHERE acknowledged_at IS NOT NULL)::int AS acknowledged_count,
           COUNT(*) FILTER (WHERE acknowledged_at IS NULL)::int AS not_acknowledged_count,
           COUNT(*) FILTER (WHERE acknowledged_at IS NULL AND due_at IS NOT NULL AND due_at < NOW())::int AS overdue_count,
           ROUND(
             CASE WHEN COUNT(*) = 0 THEN 0 ELSE COUNT(*) FILTER (WHERE acknowledged_at IS NOT NULL)::numeric * 100 / COUNT(*) END,
             1
           )::float AS completion_percent
         FROM mandatory_ack_assignments
         WHERE status NOT IN ('cancelled', 'superseded')
           AND assigned_at >= NOW() - ($1::int * INTERVAL '1 day')
           AND ($2::text = 'all' OR (
             CASE
               WHEN acknowledged_at IS NOT NULL THEN 'acknowledged'
               WHEN due_at IS NOT NULL AND due_at < NOW() THEN 'overdue'
               WHEN read_completed_at IS NOT NULL THEN 'read_completed'
               WHEN first_viewed_at IS NOT NULL THEN 'in_progress'
               ELSE status
             END
           ) = $2::text)
           AND ($3::int = 0 OR article_id = $3::int)
           AND ($4::int = 0 OR department_id = $4::int)
           AND ($5::int = 0 OR position_id = $5::int)
           AND ($6::int = 0 OR employee_id = $6::int)`,
        [periodDays, mandatoryStatus, mandatoryArticleId, mandatoryDepartmentId, mandatoryPositionId, mandatoryEmployeeId]
      ),
    ]);

    const overview = Object.fromEntries(
      Object.entries(overviewResult.rows[0] || {}).map(([key, value]) => [key, Number(value || 0)])
    );

    res.json({
      generatedAt: new Date().toISOString(),
      periodDays,
      staleDays,
      overview,
      dailyViews: dailyViewsResult.rows,
      topArticles: topArticlesResult.rows,
      sectionStats: sectionStatsResult.rows,
      contributorStats: contributorStatsResult.rows,
      userActivity: userActivityResult.rows,
      staleArticles: staleArticlesResult.rows,
      mandatoryAcknowledgement: {
        summary: mandatorySummaryResult.rows[0] || {
          mandatory_articles: 0,
          assigned_count: 0,
          acknowledged_count: 0,
          not_acknowledged_count: 0,
          overdue_count: 0,
          completion_percent: 0,
        },
        rows: mandatoryRowsResult.rows,
        byArticle: mandatoryByArticleResult.rows,
      },
    });
  } catch (error) {
    console.error('Failed to build analytics report:', error);
    res.status(500).json({ error: 'Failed to build analytics report' });
  }
};
