import { pool } from '../config/db';

export interface WikiCapabilities {
  can_read: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_publish: boolean;
  can_approve: boolean;
  can_manage_users: boolean;
  can_manage_structure: boolean;
  can_manage_access: boolean;
}

export interface WikiRole {
  id: number;
  code: string;
  name: string;
  description: string | null;
  capabilities: WikiCapabilities;
}

export interface UserAccessProfile {
  id: number;
  username: string;
  name: string;
  role: string;
  employee_id: number | null;
  position_id: number | null;
  position_name: string | null;
  department_id: number | null;
  department_name: string | null;
  wiki_roles: WikiRole[];
  capabilities: WikiCapabilities;
}

export const emptyCapabilities = (): WikiCapabilities => ({
  can_read: false,
  can_create: false,
  can_edit: false,
  can_publish: false,
  can_approve: false,
  can_manage_users: false,
  can_manage_structure: false,
  can_manage_access: false,
});

export const fullCapabilities = (): WikiCapabilities => ({
  can_read: true,
  can_create: true,
  can_edit: true,
  can_publish: true,
  can_approve: true,
  can_manage_users: true,
  can_manage_structure: true,
  can_manage_access: true,
});

export const mergeCapabilities = (...items: Partial<WikiCapabilities>[]): WikiCapabilities => {
  const result = emptyCapabilities();
  for (const item of items) {
    (Object.keys(result) as (keyof WikiCapabilities)[]).forEach((key) => {
      result[key] = result[key] || !!item[key];
    });
  }
  return result;
};

export const DEFAULT_WIKI_ROLES: Array<{
  code: string;
  name: string;
  description: string;
  capabilities: WikiCapabilities;
}> = [
  {
    code: 'reader',
    name: 'Читатель',
    description: 'Просмотр опубликованных статей в доступных разделах.',
    capabilities: mergeCapabilities({ can_read: true }),
  },
  {
    code: 'editor',
    name: 'Редактор',
    description: 'Создание и редактирование статей в доступных разделах без полного администрирования.',
    capabilities: mergeCapabilities({ can_read: true, can_create: true, can_edit: true }),
  },
  {
    code: 'process_owner',
    name: 'Владелец бизнес-процесса',
    description: 'Отвечает за актуальность своего процесса и может публиковать материалы в своей зоне.',
    capabilities: mergeCapabilities({
      can_read: true,
      can_create: true,
      can_edit: true,
      can_publish: true,
    }),
  },
  {
    code: 'approver',
    name: 'Согласователь',
    description: 'Проверяет и утверждает статьи перед публикацией.',
    capabilities: mergeCapabilities({
      can_read: true,
      can_edit: true,
      can_approve: true,
      can_publish: true,
    }),
  },
  {
    code: 'wiki_admin',
    name: 'Администратор Wiki',
    description: 'Полное управление структурой, пользователями, ролями и доступом.',
    capabilities: fullCapabilities(),
  },
];

const legacyAdminRoles = new Set(['Admin', 'Администратор Wiki']);
const legacyStaffRoles = new Set([
  'Editor',
  'Коммерческий директор',
  'Руководитель группы',
  'Супервайзер',
  'HR-менеджер',
  'IT-специалист',
  'Бухгалтер',
]);

export const getLegacyCapabilities = (role?: string | null): WikiCapabilities => {
  if (role && legacyAdminRoles.has(role)) {
    return fullCapabilities();
  }

  if (role && legacyStaffRoles.has(role)) {
    return mergeCapabilities({
      can_read: true,
      can_create: true,
      can_edit: true,
      can_publish: true,
      can_approve: true,
    });
  }

  return mergeCapabilities({ can_read: true });
};

const normalizeRoleRow = (row: any): WikiRole => ({
  id: Number(row.id),
  code: row.code,
  name: row.name,
  description: row.description,
  capabilities: mergeCapabilities({
    can_read: row.can_read,
    can_create: row.can_create,
    can_edit: row.can_edit,
    can_publish: row.can_publish,
    can_approve: row.can_approve,
    can_manage_users: row.can_manage_users,
    can_manage_structure: row.can_manage_structure,
    can_manage_access: row.can_manage_access,
  }),
});

export const getUserWikiRoles = async (userId: number): Promise<WikiRole[]> => {
  const result = await pool.query(
    `SELECT wr.*
     FROM user_wiki_roles uwr
     JOIN wiki_roles wr ON wr.id = uwr.wiki_role_id
     WHERE uwr.user_id = $1
     ORDER BY wr.name ASC`,
    [userId]
  );

  return result.rows.map(normalizeRoleRow);
};

export const getUserCapabilities = async (
  userId?: number | null,
  legacyRole?: string | null
): Promise<{ roles: WikiRole[]; capabilities: WikiCapabilities }> => {
  const roles = userId ? await getUserWikiRoles(userId) : [];
  const roleCapabilities = roles.map((role) => role.capabilities);

  return {
    roles,
    capabilities: roles.length > 0
      ? mergeCapabilities(...roleCapabilities)
      : getLegacyCapabilities(legacyRole),
  };
};

export const getUserAccessProfile = async (userId: number): Promise<UserAccessProfile | null> => {
  const userResult = await pool.query(
    `SELECT u.id, u.username, u.name, u.role, u.employee_id,
            e.position_id, p.name AS position_name,
            e.department_id, d.name AS department_name
     FROM users u
     LEFT JOIN employees e ON e.id = u.employee_id
     LEFT JOIN positions p ON p.id = e.position_id
     LEFT JOIN departments d ON d.id = e.department_id
     WHERE u.id = $1`,
    [userId]
  );

  if (userResult.rows.length === 0) {
    return null;
  }

  const row = userResult.rows[0];
  const { roles, capabilities } = await getUserCapabilities(row.id, row.role);

  return {
    id: Number(row.id),
    username: row.username,
    name: row.name,
    role: row.role,
    employee_id: row.employee_id ? Number(row.employee_id) : null,
    position_id: row.position_id ? Number(row.position_id) : null,
    position_name: row.position_name || null,
    department_id: row.department_id ? Number(row.department_id) : null,
    department_name: row.department_name || null,
    wiki_roles: roles,
    capabilities,
  };
};

export const isWikiAdmin = async (userId?: number | null, legacyRole?: string | null): Promise<boolean> => {
  const { capabilities } = await getUserCapabilities(userId, legacyRole);
  return capabilities.can_manage_access || capabilities.can_manage_structure || capabilities.can_manage_users;
};

export const getSubordinatePositionIds = async (positionId: number | null | undefined): Promise<number[]> => {
  if (!positionId) {
    return [];
  }

  const result = await pool.query(
    `WITH RECURSIVE subordinate_positions AS (
       SELECT id FROM positions WHERE id = $1
       UNION ALL
       SELECT p.id
       FROM positions p
       INNER JOIN subordinate_positions sp ON p.parent_position_id = sp.id
     )
     SELECT id FROM subordinate_positions`,
    [positionId]
  );

  return result.rows.map((row) => Number(row.id));
};

export const expandSectionIdsWithDescendants = async (sectionIds: number[]): Promise<number[]> => {
  if (sectionIds.length === 0) {
    return [];
  }

  const result = await pool.query(
    `WITH RECURSIVE section_tree AS (
       SELECT id FROM sections WHERE id = ANY($1::int[])
       UNION ALL
       SELECT s.id
       FROM sections s
       INNER JOIN section_tree st ON s.parent_section_id = st.id
       WHERE s.status = 'Active'
     )
     SELECT DISTINCT id FROM section_tree`,
    [sectionIds]
  );

  return result.rows.map((row) => Number(row.id));
};

export const getRuleAllowedSectionIds = async (userId?: number | null): Promise<number[]> => {
  const allowed = new Set<number>();

  const publicResult = await pool.query(
    `SELECT id
     FROM sections
     WHERE status = 'Active' AND visibility_scope = 'public'`
  );
  publicResult.rows.forEach((row) => allowed.add(Number(row.id)));

  if (!userId) {
    return Array.from(allowed);
  }

  const profile = await getUserAccessProfile(userId);
  if (!profile) {
    return Array.from(allowed);
  }

  if (profile.capabilities.can_manage_access) {
    const allSections = await pool.query(`SELECT id FROM sections WHERE status = 'Active'`);
    return allSections.rows.map((row) => Number(row.id));
  }

  const positionIds = await getSubordinatePositionIds(profile.position_id);
  const roleIds = profile.wiki_roles.map((role) => role.id);

  if (positionIds.length > 0) {
    const positionSectionsResult = await pool.query(
      `SELECT id FROM sections WHERE position_id = ANY($1::int[]) AND status = 'Active'`,
      [positionIds]
    );
    positionSectionsResult.rows.forEach((row) => allowed.add(Number(row.id)));
  }

  const ruleResult = await pool.query(
    `SELECT DISTINCT sar.section_id, sar.grant_subsections
     FROM section_access_rules sar
     WHERE sar.can_read = true
       AND (
         (sar.position_id IS NOT NULL AND sar.position_id = ANY($1::int[]))
         OR (sar.department_id IS NOT NULL AND sar.department_id = $2)
         OR (sar.wiki_role_id IS NOT NULL AND sar.wiki_role_id = ANY($3::int[]))
       )`,
    [positionIds, profile.department_id, roleIds]
  );

  const directSectionIds: number[] = [];
  const recursiveSectionIds: number[] = [];

  ruleResult.rows.forEach((row) => {
    const sectionId = Number(row.section_id);
    directSectionIds.push(sectionId);
    if (row.grant_subsections) {
      recursiveSectionIds.push(sectionId);
    }
  });

  directSectionIds.forEach((id) => allowed.add(id));
  const descendants = await expandSectionIdsWithDescendants(recursiveSectionIds);
  descendants.forEach((id) => allowed.add(id));

  return Array.from(allowed);
};

export const getSectionPermissionsForUser = async (
  userId: number | null | undefined,
  legacyRole: string | null | undefined,
  sectionIds: number[]
): Promise<WikiCapabilities> => {
  const { capabilities } = await getUserCapabilities(userId, legacyRole);
  if (!userId || sectionIds.length === 0) {
    return mergeCapabilities({ can_read: capabilities.can_read });
  }

  if (capabilities.can_manage_access) {
    return capabilities;
  }

  const profile = await getUserAccessProfile(userId);
  if (!profile) {
    return mergeCapabilities({ can_read: capabilities.can_read });
  }

  const positionIds = await getSubordinatePositionIds(profile.position_id);
  const roleIds = profile.wiki_roles.map((role) => role.id);

  const ruleResult = await pool.query(
    `SELECT sar.can_read, sar.can_create, sar.can_edit, sar.can_publish, sar.can_approve
     FROM section_access_rules sar
     WHERE sar.section_id = ANY($1::int[])
       AND (
         (sar.position_id IS NOT NULL AND sar.position_id = ANY($2::int[]))
         OR (sar.department_id IS NOT NULL AND sar.department_id = $3)
         OR (sar.wiki_role_id IS NOT NULL AND sar.wiki_role_id = ANY($4::int[]))
       )`,
    [sectionIds, positionIds, profile.department_id, roleIds]
  );

  const ruleCapabilities = ruleResult.rows.reduce(
    (acc, row) => mergeCapabilities(acc, row),
    emptyCapabilities()
  );

  const positionScopeResult = positionIds.length > 0
    ? await pool.query(
        `SELECT id
         FROM sections
         WHERE id = ANY($1::int[])
           AND position_id = ANY($2::int[])
           AND status = 'Active'
         LIMIT 1`,
        [sectionIds, positionIds]
      )
    : { rowCount: 0 };
  const positionScopeCapabilities = (positionScopeResult.rowCount ?? 0) > 0
    ? mergeCapabilities({ can_read: true })
    : emptyCapabilities();

  const ownerResult = await pool.query(
    `SELECT id FROM sections WHERE id = ANY($1::int[]) AND owner_id = $2 LIMIT 1`,
    [sectionIds, userId]
  );
  const isSectionOwner = (ownerResult.rowCount ?? 0) > 0;

  const ownerCapabilities = isSectionOwner
    ? mergeCapabilities({ can_read: true, can_create: true, can_edit: true, can_publish: true })
    : emptyCapabilities();

  const scopedCapabilities = mergeCapabilities(ruleCapabilities, positionScopeCapabilities, ownerCapabilities);
  const canWorkInsideReadableScope = scopedCapabilities.can_read;

  return mergeCapabilities({
    can_read: capabilities.can_read && scopedCapabilities.can_read,
    can_create: capabilities.can_create && (scopedCapabilities.can_create || canWorkInsideReadableScope),
    can_edit: capabilities.can_edit && (scopedCapabilities.can_edit || canWorkInsideReadableScope),
    can_publish: capabilities.can_publish && (scopedCapabilities.can_publish || scopedCapabilities.can_edit),
    can_approve: capabilities.can_approve && (scopedCapabilities.can_approve || scopedCapabilities.can_edit),
    can_manage_users: capabilities.can_manage_users,
    can_manage_structure: capabilities.can_manage_structure,
    can_manage_access: capabilities.can_manage_access,
  });
};

export const canCreateInSections = async (
  userId: number | null | undefined,
  legacyRole: string | null | undefined,
  sectionIds: number[]
): Promise<boolean> => {
  const permissions = await getSectionPermissionsForUser(userId, legacyRole, sectionIds);
  return permissions.can_create || permissions.can_manage_access;
};

export const canEditArticle = async (
  userId: number | null | undefined,
  legacyRole: string | null | undefined,
  article: { author_id?: number | null; owner_id?: number | null; approver_id?: number | null; section_ids?: number[]; status?: string }
): Promise<boolean> => {
  if (!userId) {
    return false;
  }

  const { capabilities } = await getUserCapabilities(userId, legacyRole);
  if (capabilities.can_manage_access) {
    return true;
  }

  if (article.owner_id === userId && (capabilities.can_edit || capabilities.can_publish)) {
    return true;
  }

  if (article.approver_id === userId && (capabilities.can_approve || capabilities.can_publish)) {
    return true;
  }

  if (article.author_id === userId && article.status !== 'published') {
    return true;
  }

  const permissions = await getSectionPermissionsForUser(userId, legacyRole, article.section_ids || []);
  return permissions.can_edit || permissions.can_publish || permissions.can_approve;
};

export const seedDefaultAccessModel = async (): Promise<{
  roles: number;
  userRoleAssignments: number;
  sectionRules: number;
  publicSections: number;
}> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const role of DEFAULT_WIKI_ROLES) {
      await client.query(
        `INSERT INTO wiki_roles (
           code, name, description,
           can_read, can_create, can_edit, can_publish, can_approve,
           can_manage_users, can_manage_structure, can_manage_access
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (code) DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           can_read = EXCLUDED.can_read,
           can_create = EXCLUDED.can_create,
           can_edit = EXCLUDED.can_edit,
           can_publish = EXCLUDED.can_publish,
           can_approve = EXCLUDED.can_approve,
           can_manage_users = EXCLUDED.can_manage_users,
           can_manage_structure = EXCLUDED.can_manage_structure,
           can_manage_access = EXCLUDED.can_manage_access,
           updated_at = CURRENT_TIMESTAMP`,
        [
          role.code,
          role.name,
          role.description,
          role.capabilities.can_read,
          role.capabilities.can_create,
          role.capabilities.can_edit,
          role.capabilities.can_publish,
          role.capabilities.can_approve,
          role.capabilities.can_manage_users,
          role.capabilities.can_manage_structure,
          role.capabilities.can_manage_access,
        ]
      );
    }

    const roleMapResult = await client.query('SELECT id, code FROM wiki_roles');
    const roleIds = new Map<string, number>(roleMapResult.rows.map((row) => [row.code, Number(row.id)]));

    const assignments = await client.query(
      `INSERT INTO user_wiki_roles (user_id, wiki_role_id)
       SELECT u.id,
              CASE
                WHEN u.role IN ('Admin', 'Администратор Wiki') THEN $1
                WHEN u.role IN ('Коммерческий директор', 'Руководитель группы', 'Супервайзер', 'HR-менеджер', 'IT-специалист', 'Бухгалтер', 'Editor') THEN $2
                ELSE $3
              END AS wiki_role_id
       FROM users u
       WHERE NOT EXISTS (
         SELECT 1 FROM user_wiki_roles uwr WHERE uwr.user_id = u.id
       )
       ON CONFLICT (user_id, wiki_role_id) DO NOTHING`,
      [roleIds.get('wiki_admin'), roleIds.get('process_owner'), roleIds.get('reader')]
    );

    const publicUpdate = await client.query(
      `UPDATE sections s
       SET visibility_scope = 'public'
       FROM spaces sp
       LEFT JOIN departments d ON d.id = sp.department_id
       WHERE s.space_id = sp.id
         AND (
           LOWER(s.name) IN ('общий сотрудник', 'общий раздел', 'общие статьи')
           OR LOWER(sp.name) LIKE '%общ%'
           OR LOWER(COALESCE(d.name, '')) LIKE '%общ%'
         )`
    );

    const positionRules = await client.query(
      `INSERT INTO section_access_rules (
         section_id, position_id, access_level,
         can_read, can_create, can_edit, can_publish, can_approve, grant_subsections
       )
       SELECT s.id, s.position_id, 'read',
              true, false, false, false, false, true
       FROM sections s
       WHERE s.position_id IS NOT NULL
       ON CONFLICT DO NOTHING`
    );

    const ownerRules = await client.query(
      `INSERT INTO section_access_rules (
         section_id, wiki_role_id, access_level,
         can_read, can_create, can_edit, can_publish, can_approve, grant_subsections
       )
       SELECT s.id, $1, 'write',
              true, true, true, true, false, true
       FROM sections s
       WHERE s.status = 'Active'
       ON CONFLICT DO NOTHING`,
      [roleIds.get('process_owner')]
    );

    const approverRules = await client.query(
      `INSERT INTO section_access_rules (
         section_id, wiki_role_id, access_level,
         can_read, can_create, can_edit, can_publish, can_approve, grant_subsections
       )
       SELECT s.id, $1, 'approve',
              true, false, true, true, true, true
       FROM sections s
       WHERE s.status = 'Active'
       ON CONFLICT DO NOTHING`,
      [roleIds.get('approver')]
    );

    await client.query('COMMIT');

    return {
      roles: DEFAULT_WIKI_ROLES.length,
      userRoleAssignments: assignments.rowCount ?? 0,
      sectionRules: (positionRules.rowCount ?? 0) + (ownerRules.rowCount ?? 0) + (approverRules.rowCount ?? 0),
      publicSections: publicUpdate.rowCount ?? 0,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
