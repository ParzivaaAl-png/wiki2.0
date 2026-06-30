import { Request, Response } from 'express';
import { query, pool } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';
import {
  DEFAULT_WIKI_ROLES,
  expandSectionIdsWithDescendants,
  getRuleAllowedSectionIds,
  getSubordinatePositionIds,
  getUserAccessProfile,
  getUserCapabilities,
  seedDefaultAccessModel,
} from '../services/accessControl';

const getRoles = async () => {
  const result = await query(
    `SELECT id, code, name, description,
            can_read, can_create, can_edit, can_publish, can_approve,
            can_manage_users, can_manage_structure, can_manage_access,
            created_at, updated_at
     FROM wiki_roles
     ORDER BY
       CASE code
         WHEN 'reader' THEN 1
         WHEN 'editor' THEN 2
         WHEN 'process_owner' THEN 3
         WHEN 'approver' THEN 4
         WHEN 'wiki_admin' THEN 5
         ELSE 10
       END,
       name ASC`
  );
  return result.rows;
};

const getUsersWithRoles = async () => {
  const result = await query(
    `SELECT u.id, u.username, u.name, u.role, u.is_blocked, u.employee_id,
            e.full_name AS employee_name,
            p.name AS position_name,
            d.name AS department_name,
            COALESCE(uas.access_mode, 'auto') AS access_mode,
            COALESCE(
              array_agg(DISTINCT umar.department_id) FILTER (WHERE umar.department_id IS NOT NULL),
              '{}'
            ) AS manual_department_ids,
            COALESCE(
              array_agg(DISTINCT umar.section_id) FILTER (WHERE umar.section_id IS NOT NULL),
              '{}'
            ) AS manual_section_ids,
            COALESCE(
              json_agg(
                DISTINCT jsonb_build_object('id', wr.id, 'code', wr.code, 'name', wr.name)
              ) FILTER (WHERE wr.id IS NOT NULL),
              '[]'
            ) AS wiki_roles
     FROM users u
     LEFT JOIN employees e ON e.id = u.employee_id
     LEFT JOIN positions p ON p.id = e.position_id
     LEFT JOIN departments d ON d.id = e.department_id
     LEFT JOIN user_wiki_roles uwr ON uwr.user_id = u.id
     LEFT JOIN wiki_roles wr ON wr.id = uwr.wiki_role_id
     LEFT JOIN user_access_settings uas ON uas.user_id = u.id
     LEFT JOIN user_manual_access_rules umar ON umar.user_id = u.id
     GROUP BY u.id, e.full_name, p.name, d.name, uas.access_mode
     ORDER BY u.id ASC`
  );
  return result.rows;
};

const getSections = async () => {
  const result = await query(
    `SELECT s.id, s.name, s.description, s.space_id, sp.name AS space_name,
            s.position_id, p.name AS position_name,
            s.parent_section_id, s.owner_id, u.name AS owner_name,
            s.status, s.visibility_scope
     FROM sections s
     LEFT JOIN spaces sp ON sp.id = s.space_id
     LEFT JOIN positions p ON p.id = s.position_id
     LEFT JOIN users u ON u.id = s.owner_id
     ORDER BY sp.name ASC, s.parent_section_id NULLS FIRST, s.name ASC`
  );
  return result.rows;
};

const getRules = async () => {
  const result = await query(
    `SELECT sar.*,
            s.name AS section_name,
            sp.name AS space_name,
            p.name AS position_name,
            d.name AS department_name,
            wr.name AS wiki_role_name,
            wr.code AS wiki_role_code
     FROM section_access_rules sar
     JOIN sections s ON s.id = sar.section_id
     LEFT JOIN spaces sp ON sp.id = s.space_id
     LEFT JOIN positions p ON p.id = sar.position_id
     LEFT JOIN departments d ON d.id = sar.department_id
     LEFT JOIN wiki_roles wr ON wr.id = sar.wiki_role_id
     ORDER BY sp.name ASC, s.name ASC, sar.id ASC`
  );
  return result.rows;
};

const getAccessMatrix = async () => {
  const positionsResult = await query(
    `SELECT p.id, p.name, p.department_id, d.name AS department_name, p.parent_position_id, p.hierarchy_level, p.status
     FROM positions p
     LEFT JOIN departments d ON d.id = p.department_id
     ORDER BY p.hierarchy_level ASC, p.name ASC`
  );

  const sections = await getSections();
  const sectionById = new Map<number, any>(sections.map((section) => [Number(section.id), section]));

  const matrixRows = [];
  for (const position of positionsResult.rows) {
    const subordinateIds = await getSubordinatePositionIds(Number(position.id));
    const directSectionIds = sections
      .filter((section) => section.position_id && subordinateIds.includes(Number(section.position_id)))
      .map((section) => Number(section.id));

    const explicitRules = await query(
      `SELECT section_id, grant_subsections, access_level, can_read, can_create, can_edit, can_publish, can_approve
       FROM section_access_rules
       WHERE position_id = $1`,
      [Number(position.id)]
    );

    const explicitDirectIds = explicitRules.rows.map((row) => Number(row.section_id));
    const explicitRecursiveIds = explicitRules.rows
      .filter((row) => row.grant_subsections)
      .map((row) => Number(row.section_id));
    const recursiveIds = await expandSectionIdsWithDescendants(explicitRecursiveIds);

    const publicSectionIds = sections
      .filter((section) => section.visibility_scope === 'public')
      .map((section) => Number(section.id));

    const sectionIds = Array.from(new Set([...directSectionIds, ...explicitDirectIds, ...recursiveIds, ...publicSectionIds]));

    matrixRows.push({
      position_id: Number(position.id),
      position_name: position.name,
      department_name: position.department_name,
      hierarchy_level: Number(position.hierarchy_level || 1),
      sections: sectionIds
        .map((id) => sectionById.get(id))
        .filter(Boolean)
        .map((section) => ({
          id: Number(section.id),
          name: section.name,
          space_name: section.space_name,
          visibility_scope: section.visibility_scope,
        })),
    });
  }

  return matrixRows;
};

export const getAccessOverview = async (req: Request, res: Response) => {
  try {
    const [roles, users, departments, positions, sections, rules, matrix] = await Promise.all([
      getRoles(),
      getUsersWithRoles(),
      query('SELECT * FROM departments ORDER BY name ASC').then((result) => result.rows),
      query('SELECT * FROM positions ORDER BY hierarchy_level ASC, name ASC').then((result) => result.rows),
      getSections(),
      getRules(),
      getAccessMatrix(),
    ]);

    res.json({
      roles,
      users,
      departments,
      positions,
      sections,
      rules,
      matrix,
      defaults: DEFAULT_WIKI_ROLES.map((role) => ({
        code: role.code,
        name: role.name,
        description: role.description,
        capabilities: role.capabilities,
      })),
      summary: {
        users: users.length,
        roles: roles.length,
        departments: departments.length,
        positions: positions.length,
        sections: sections.length,
        rules: rules.length,
      },
    });
  } catch (error: any) {
    console.error('Failed to build access overview:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const seedAccessDefaults = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await seedDefaultAccessModel();
    res.json({
      message: 'Каркас ролевой модели создан и синхронизирован.',
      details: result,
    });
  } catch (error: any) {
    console.error('Failed to seed access defaults:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const updateUserWikiRoles = async (req: AuthenticatedRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { role_ids } = req.body;

    if (!Array.isArray(role_ids)) {
      return res.status(400).json({ error: 'role_ids должен быть массивом ID ролей.' });
    }

    const uniqueRoleIds = Array.from(new Set(role_ids.map((roleId: any) => Number(roleId)).filter(Boolean)));

    const roleCheck = await client.query(
      'SELECT id FROM wiki_roles WHERE id = ANY($1::int[])',
      [uniqueRoleIds]
    );
    if (roleCheck.rows.length !== uniqueRoleIds.length) {
      return res.status(400).json({ error: 'Одна или несколько Wiki-ролей не найдены.' });
    }

    await client.query('BEGIN');
    await client.query('DELETE FROM user_wiki_roles WHERE user_id = $1', [Number(id)]);

    for (const roleId of uniqueRoleIds) {
      await client.query(
        `INSERT INTO user_wiki_roles (user_id, wiki_role_id, assigned_by)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, wiki_role_id) DO NOTHING`,
        [Number(id), roleId, req.user?.id || null]
      );
    }

    await client.query('COMMIT');

    const profile = await getUserAccessProfile(Number(id));
    res.json(profile);
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('Failed to update user wiki roles:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  } finally {
    client.release();
  }
};

export const updateUserAccessScope = async (req: AuthenticatedRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { access_mode, department_ids, section_ids } = req.body;
    const userId = Number(id);
    const accessMode = access_mode === 'manual' ? 'manual' : 'auto';
    const departmentIds = Array.from(new Set(
      Array.isArray(department_ids)
        ? department_ids.map((departmentId: any) => Number(departmentId)).filter(Boolean)
        : []
    ));
    const sectionIds = Array.from(new Set(
      Array.isArray(section_ids)
        ? section_ids.map((sectionId: any) => Number(sectionId)).filter(Boolean)
        : []
    ));

    const userCheck = await client.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден.' });
    }

    if (departmentIds.length > 0) {
      const departmentCheck = await client.query('SELECT id FROM departments WHERE id = ANY($1::int[])', [departmentIds]);
      if (departmentCheck.rows.length !== departmentIds.length) {
        return res.status(400).json({ error: 'Один или несколько отделов не найдены.' });
      }
    }

    if (sectionIds.length > 0) {
      const sectionCheck = await client.query('SELECT id FROM sections WHERE id = ANY($1::int[])', [sectionIds]);
      if (sectionCheck.rows.length !== sectionIds.length) {
        return res.status(400).json({ error: 'Один или несколько разделов не найдены.' });
      }
    }

    await client.query('BEGIN');
    await client.query(
      `INSERT INTO user_access_settings (user_id, access_mode, updated_by, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE SET
         access_mode = EXCLUDED.access_mode,
         updated_by = EXCLUDED.updated_by,
         updated_at = CURRENT_TIMESTAMP`,
      [userId, accessMode, req.user?.id || null]
    );

    await client.query('DELETE FROM user_manual_access_rules WHERE user_id = $1', [userId]);

    if (accessMode === 'manual') {
      for (const departmentId of departmentIds) {
        await client.query(
          `INSERT INTO user_manual_access_rules (user_id, department_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [userId, departmentId]
        );
      }

      for (const sectionId of sectionIds) {
        await client.query(
          `INSERT INTO user_manual_access_rules (user_id, section_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [userId, sectionId]
        );
      }
    }

    await client.query(
      `INSERT INTO access_audit_logs (actor_user_id, target_user_id, action, new_value)
       VALUES ($1, $2, 'update_user_access_scope', $3::jsonb)`,
      [req.user?.id || null, userId, JSON.stringify({ access_mode: accessMode, department_ids: departmentIds, section_ids: sectionIds })]
    );

    await client.query('COMMIT');

    const profile = await getUserAccessProfile(userId);
    res.json(profile);
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('Failed to update user access scope:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  } finally {
    client.release();
  }
};

export const getEffectiveAccess = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const requestedUserId = Number(req.query.userId || req.user?.id);
    if (!requestedUserId) {
      return res.status(400).json({ error: 'Не указан пользователь для проверки доступа.' });
    }

    const profile = await getUserAccessProfile(requestedUserId);
    if (!profile) {
      return res.status(404).json({ error: 'Пользователь не найден.' });
    }

    const allowedSectionIds = await getRuleAllowedSectionIds(requestedUserId);
    const capabilities = await getUserCapabilities(profile.id, profile.role);
    const sectionsResult = allowedSectionIds.length
      ? await query(
          `SELECT s.id, s.name, s.description, s.visibility_scope, sp.name AS space_name, u.name AS owner_name
           FROM sections s
           LEFT JOIN spaces sp ON sp.id = s.space_id
           LEFT JOIN users u ON u.id = s.owner_id
           WHERE s.id = ANY($1::int[])
           ORDER BY sp.name ASC, s.name ASC`,
          [allowedSectionIds]
        )
      : { rows: [] };

    res.json({
      user: profile,
      capabilities: capabilities.capabilities,
      wiki_roles: capabilities.roles,
      sections: sectionsResult.rows,
      section_count: sectionsResult.rows.length,
    });
  } catch (error: any) {
    console.error('Failed to calculate effective access:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};
