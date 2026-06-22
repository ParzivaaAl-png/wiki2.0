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

  try {
    const [
      overviewResult,
      dailyViewsResult,
      topArticlesResult,
      sectionStatsResult,
      contributorStatsResult,
      userActivityResult,
      staleArticlesResult,
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
    });
  } catch (error) {
    console.error('Failed to build analytics report:', error);
    res.status(500).json({ error: 'Failed to build analytics report' });
  }
};
