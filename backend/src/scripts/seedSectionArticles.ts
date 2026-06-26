import { pool } from '../config/db';

type SectionRow = {
  id: number;
  name: string;
  description: string | null;
  space_name: string | null;
  position_name: string | null;
};

const stripHtml = (value: string) => value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

const buildSectionContent = (section: SectionRow) => `
  <h1>${section.name}</h1>
  <p>Это примерная статья для раздела <strong>${section.name}</strong>. Она нужна, чтобы проверить навигацию, поиск, доступы и связи между материалами Wiki.</p>
  <h2>Назначение раздела</h2>
  <p>${section.description || `Раздел относится к пространству "${section.space_name || 'Wiki'}" и помогает сотрудникам быстро находить инструкции по своей зоне ответственности.`}</p>
  <h2>Что здесь можно хранить</h2>
  <ul>
    <li>регламенты и инструкции;</li>
    <li>чек-листы ежедневной работы;</li>
    <li>ответственных за процесс и дату следующей проверки;</li>
    <li>ссылки на связанные материалы из других разделов.</li>
  </ul>
  <h2>Ответственность</h2>
  <p>${section.position_name ? `Базовая связанная должность: <strong>${section.position_name}</strong>.` : 'Ответственного можно назначить через владельца бизнес-процесса в карточке статьи.'}</p>
  <blockquote><p>Материал демонстрационный. Его можно заменить на реальный регламент, когда будет готов контент отдела.</p></blockquote>
`;

const run = async () => {
  if (process.env.CONFIRM_SECTION_ARTICLES !== 'true') {
    throw new Error('Set CONFIRM_SECTION_ARTICLES=true to create demo articles for active sections.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const adminResult = await client.query(
      `SELECT id FROM users
       WHERE role IN ('Admin', 'Администратор Wiki') AND is_blocked = false
       ORDER BY id
       LIMIT 1`
    );
    const authorId = adminResult.rows[0]?.id ?? null;

    const sectionsResult = await client.query<SectionRow>(
      `SELECT s.id, s.name, s.description, sp.name AS space_name, p.name AS position_name
       FROM sections s
       LEFT JOIN spaces sp ON sp.id = s.space_id
       LEFT JOIN positions p ON p.id = s.position_id
       WHERE s.status = 'Active'
       ORDER BY COALESCE(sp.name, ''), s.name`
    );

    if (sectionsResult.rows.length === 0) {
      throw new Error('No active sections found.');
    }

    const primarySectionId = sectionsResult.rows[0].id;
    const createdArticleIds: number[] = [];

    const hubContent = `
      <h1>Карта разделов Wiki</h1>
      <p>Эта демонстрационная статья связывает все активные разделы Wiki и показывает, как работают внутренние ссылки и обратные ссылки.</p>
      <h2>Как пользоваться</h2>
      <p>Откройте любую статью раздела ниже: в блоке <strong>«На эту статью ссылаются»</strong> появится ссылка обратно на эту карту.</p>
      <ul>
        ${sectionsResult.rows.map((section) => `<li>${section.space_name ? `${section.space_name}: ` : ''}${section.name}</li>`).join('')}
      </ul>
    `;

    const hubResult = await client.query(
      `INSERT INTO articles (
         title, slug, content, summary, category_id, author_id, published,
         views, position, is_visible, status, article_type, owner_id, structured_data
       ) VALUES ($1, $2, $3, $4, NULL, $5, true, 0, 900, true, 'published', 'general', $5, $6::jsonb)
       ON CONFLICT (slug) DO UPDATE SET
         title = EXCLUDED.title,
         content = EXCLUDED.content,
         summary = EXCLUDED.summary,
         author_id = EXCLUDED.author_id,
         published = true,
         position = EXCLUDED.position,
         is_visible = true,
         status = 'published',
         article_type = EXCLUDED.article_type,
         owner_id = EXCLUDED.owner_id,
         structured_data = EXCLUDED.structured_data,
         updated_at = CURRENT_TIMESTAMP
       RETURNING id`,
      [
        '[Пример] Карта разделов Wiki',
        'demo-wiki-section-map',
        hubContent.trim(),
        'Демонстрационная карта разделов с внутренними ссылками и обратными ссылками.',
        authorId,
        JSON.stringify({ fixture: 'section-articles', kind: 'hub' }),
      ]
    );
    const hubArticleId = Number(hubResult.rows[0].id);
    await client.query('DELETE FROM article_sections WHERE article_id = $1', [hubArticleId]);
    await client.query(
      'INSERT INTO article_sections (article_id, section_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [hubArticleId, primarySectionId]
    );

    for (const [index, section] of sectionsResult.rows.entries()) {
      const content = buildSectionContent(section).trim();
      const summary = stripHtml(section.description || `Примерная статья для раздела ${section.name}.`);
      const slug = `demo-section-${section.id}`;

      const articleResult = await client.query(
        `INSERT INTO articles (
           title, slug, content, summary, category_id, author_id, published,
           views, position, is_visible, status, article_type, owner_id, structured_data
         ) VALUES ($1, $2, $3, $4, NULL, $5, true, 0, $6, true, 'published', 'general', $5, $7::jsonb)
         ON CONFLICT (slug) DO UPDATE SET
           title = EXCLUDED.title,
           content = EXCLUDED.content,
           summary = EXCLUDED.summary,
           author_id = EXCLUDED.author_id,
           published = true,
           position = EXCLUDED.position,
           is_visible = true,
           status = 'published',
           article_type = EXCLUDED.article_type,
           owner_id = EXCLUDED.owner_id,
           structured_data = EXCLUDED.structured_data,
           updated_at = CURRENT_TIMESTAMP
         RETURNING id`,
        [
          `[Пример] ${section.name}`,
          slug,
          content,
          summary,
          authorId,
          1000 + index,
          JSON.stringify({ fixture: 'section-articles', sectionId: section.id }),
        ]
      );

      const articleId = Number(articleResult.rows[0].id);
      createdArticleIds.push(articleId);

      await client.query('DELETE FROM article_sections WHERE article_id = $1', [articleId]);
      await client.query(
        'INSERT INTO article_sections (article_id, section_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [articleId, section.id]
      );

      await client.query('DELETE FROM article_tags WHERE article_id = $1', [articleId]);
      for (const tag of ['пример', 'раздел', section.name]) {
        await client.query(
          'INSERT INTO article_tags (article_id, tag_name) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [articleId, tag]
        );
      }

      await client.query(
        `INSERT INTO article_links (source_article_id, target_article_id, link_text)
         VALUES ($1, $2, $3)
         ON CONFLICT (source_article_id, target_article_id)
         DO UPDATE SET link_text = EXCLUDED.link_text`,
        [hubArticleId, articleId, `Материал раздела: ${section.name}`]
      );
    }

    await client.query('COMMIT');
    console.log(JSON.stringify({
      hubArticleId,
      sectionArticles: createdArticleIds.length,
      linkedSections: sectionsResult.rows.length,
    }));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

run().catch((error) => {
  console.error('Failed to seed section articles:', error);
  process.exitCode = 1;
});
