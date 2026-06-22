import { pool } from '../config/db';

type TestArticle = {
  title: string;
  slug: string;
  summary: string;
  content: string;
  sectionName: string;
  tags: string[];
  published: boolean;
  position: number;
};

const articles: TestArticle[] = [
  {
    title: '[Тест] Добро пожаловать в iCore Wiki',
    slug: 'test-icore-wiki-start',
    summary: 'Краткая вводная статья для проверки главной страницы, навигации и поиска.',
    sectionName: 'Общий сотрудник',
    tags: ['тест', 'wiki', 'старт'],
    published: true,
    position: 100,
    content: `
      <h1>Добро пожаловать в iCore Wiki</h1>
      <p>Это тестовая статья для проверки каркаса корпоративной базы знаний.</p>
      <h2>Что уже можно проверить</h2>
      <ul>
        <li>ролевую навигацию по пространствам и разделам;</li>
        <li>полнотекстовый поиск;</li>
        <li>избранное и историю чтения;</li>
        <li>аналитику просмотров и активности.</li>
      </ul>
      <blockquote><p>Материал является демонстрационным и не содержит реальных регламентов компании.</p></blockquote>
    `,
  },
  {
    title: '[Тест] Как подготовить статью к публикации',
    slug: 'test-article-publication-guide',
    summary: 'Тестовый процесс создания, проверки и публикации материала.',
    sectionName: 'Общий сотрудник',
    tags: ['тест', 'редактор', 'публикация'],
    published: true,
    position: 110,
    content: `
      <h1>Как подготовить статью к публикации</h1>
      <ol>
        <li>Сформулируйте один понятный результат статьи.</li>
        <li>Разбейте инструкцию на короткие последовательные шаги.</li>
        <li>Добавьте владельца процесса и дату следующей проверки.</li>
        <li>Проверьте внутренние ссылки и права доступа.</li>
      </ol>
      <h2>Минимальная проверка качества</h2>
      <table><tbody>
        <tr><th>Проверка</th><th>Ожидаемый результат</th></tr>
        <tr><td>Название</td><td>Понятно без открытия статьи</td></tr>
        <tr><td>Структура</td><td>Есть заголовки и шаги</td></tr>
        <tr><td>Доступ</td><td>Статья видна нужной роли</td></tr>
      </tbody></table>
    `,
  },
  {
    title: '[Тест] Чек-лист онбординга оператора',
    slug: 'test-operator-onboarding-checklist',
    summary: 'Демонстрационный чек-лист первого рабочего дня оператора.',
    sectionName: 'Оператор',
    tags: ['тест', 'онбординг', 'оператор'],
    published: true,
    position: 120,
    content: `
      <h1>Чек-лист онбординга оператора</h1>
      <h2>Первый рабочий день</h2>
      <ul data-type="taskList">
        <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Проверить доступ к iCore</p></div></li>
        <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Открыть должностную инструкцию</p></div></li>
        <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Пройти тестовый сценарий обращения</p></div></li>
        <li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Получить обратную связь супервайзера</p></div></li>
      </ul>
    `,
  },
  {
    title: '[Тест] Базовые правила информационной безопасности',
    slug: 'test-information-security-basics',
    summary: 'Демонстрационная техническая инструкция для проверки IT-раздела.',
    sectionName: 'IT-специалист',
    tags: ['тест', 'it', 'безопасность'],
    published: true,
    position: 130,
    content: `
      <h1>Базовые правила информационной безопасности</h1>
      <p><strong>Не передавайте</strong> пароль, одноразовый код или токен доступа другим сотрудникам.</p>
      <h2>При подозрительной активности</h2>
      <ol>
        <li>Завершите активные сессии.</li>
        <li>Смените пароль.</li>
        <li>Зафиксируйте время и описание события.</li>
        <li>Передайте информацию ответственному IT-специалисту.</li>
      </ol>
    `,
  },
  {
    title: '[Тест] Ежедневный чек-лист супервайзера',
    slug: 'test-supervisor-daily-checklist',
    summary: 'Тестовый операционный чек-лист для ролевого раздела супервайзера.',
    sectionName: 'Супервайзер',
    tags: ['тест', 'супервайзер', 'чек-лист'],
    published: true,
    position: 140,
    content: `
      <h1>Ежедневный чек-лист супервайзера</h1>
      <ul>
        <li>Проверить состав смены и доступность операторов.</li>
        <li>Просмотреть очередь обращений и критические отклонения.</li>
        <li>Провести выборочную оценку диалогов.</li>
        <li>Зафиксировать итоги смены и задачи на следующий день.</li>
      </ul>
    `,
  },
  {
    title: '[Тест] Проект регламента контроля качества',
    slug: 'test-quality-control-draft',
    summary: 'Черновик для проверки статусов, фильтров и административной аналитики.',
    sectionName: 'Супервайзер',
    tags: ['тест', 'черновик', 'качество'],
    published: false,
    position: 150,
    content: `
      <h1>Проект регламента контроля качества</h1>
      <p>Черновой материал. Перед публикацией необходимо согласовать критерии оценки и владельца процесса.</p>
    `,
  },
];

const run = async () => {
  if (process.env.CONFIRM_TEST_CONTENT !== 'true') {
    throw new Error('Set CONFIRM_TEST_CONTENT=true to archive current articles and install test content.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const archived = await client.query(
      `UPDATE articles
       SET is_visible = false, published = false, status = 'archived', updated_at = CURRENT_TIMESTAMP
       WHERE slug NOT LIKE 'auto-list%'
         AND slug NOT LIKE 'test-%'`
    );

    const classifier = await client.query(
      `UPDATE articles
       SET is_visible = true, published = true, status = 'published'
       WHERE slug LIKE 'auto-list%'`
    );

    const adminResult = await client.query(
      `SELECT id FROM users
       WHERE role IN ('Admin', 'Администратор Wiki') AND is_blocked = false
       ORDER BY id
       LIMIT 1`
    );
    const authorId = adminResult.rows[0]?.id ?? null;

    const sectionResult = await client.query('SELECT id, name FROM sections WHERE status = \'Active\'');
    const sectionIds = new Map<string, number>(sectionResult.rows.map((row) => [row.name, row.id]));
    const generalSectionId = sectionIds.get('Общий сотрудник') ?? sectionResult.rows[0]?.id;
    let classifierSectionLinks = 0;

    if (generalSectionId) {
      const linkedClassifier = await client.query(
        `INSERT INTO article_sections (article_id, section_id)
         SELECT id, $1 FROM articles WHERE slug LIKE 'auto-list%'
         ON CONFLICT DO NOTHING`,
        [generalSectionId]
      );
      classifierSectionLinks = linkedClassifier.rowCount ?? 0;
    }

    const createdIds = new Map<string, number>();

    for (const article of articles) {
      const status = article.published ? 'published' : 'draft';
      const result = await client.query(
        `INSERT INTO articles (
           title, slug, content, summary, category_id, author_id, published,
           views, position, is_visible, status, article_type, owner_id, structured_data
         ) VALUES ($1, $2, $3, $4, NULL, $5, $6, 0, $7, true, $8, 'general', $5, $9::jsonb)
         ON CONFLICT (slug) DO UPDATE SET
           title = EXCLUDED.title,
           content = EXCLUDED.content,
           summary = EXCLUDED.summary,
           author_id = EXCLUDED.author_id,
           published = EXCLUDED.published,
           position = EXCLUDED.position,
           is_visible = true,
           status = EXCLUDED.status,
           article_type = EXCLUDED.article_type,
           owner_id = EXCLUDED.owner_id,
           structured_data = EXCLUDED.structured_data,
           updated_at = CURRENT_TIMESTAMP
         RETURNING id`,
        [
          article.title,
          article.slug,
          article.content.trim(),
          article.summary,
          authorId,
          article.published,
          article.position,
          status,
          JSON.stringify({ fixture: 'icore-test', sectionName: article.sectionName }),
        ]
      );

      const articleId = result.rows[0].id as number;
      createdIds.set(article.slug, articleId);

      await client.query('DELETE FROM article_tags WHERE article_id = $1', [articleId]);
      for (const tag of article.tags) {
        await client.query(
          'INSERT INTO article_tags (article_id, tag_name) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [articleId, tag]
        );
      }

      await client.query('DELETE FROM article_sections WHERE article_id = $1', [articleId]);
      const sectionId = sectionIds.get(article.sectionName);
      if (sectionId) {
        await client.query(
          'INSERT INTO article_sections (article_id, section_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [articleId, sectionId]
        );
      }
    }

    const links: Array<[string, string, string]> = [
      ['test-icore-wiki-start', 'test-article-publication-guide', 'Как подготовить статью'],
      ['test-icore-wiki-start', 'test-operator-onboarding-checklist', 'Чек-лист онбординга'],
      ['test-icore-wiki-start', 'test-information-security-basics', 'Правила безопасности'],
    ];

    for (const [sourceSlug, targetSlug, linkText] of links) {
      const sourceId = createdIds.get(sourceSlug);
      const targetId = createdIds.get(targetSlug);
      if (!sourceId || !targetId) continue;
      await client.query(
        `INSERT INTO article_links (source_article_id, target_article_id, link_text)
         VALUES ($1, $2, $3)
         ON CONFLICT (source_article_id, target_article_id)
         DO UPDATE SET link_text = EXCLUDED.link_text`,
        [sourceId, targetId, linkText]
      );
    }

    await client.query('COMMIT');
    console.log(JSON.stringify({
      archivedArticles: archived.rowCount ?? 0,
      classifierArticles: classifier.rowCount ?? 0,
      classifierSectionLinks,
      testArticles: articles.length,
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
  console.error('Failed to install test content:', error);
  process.exitCode = 1;
});
