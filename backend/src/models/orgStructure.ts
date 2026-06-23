import { pool } from '../config/db';
import { getRuleAllowedSectionIds, isWikiAdmin } from '../services/accessControl';

export interface Department {
  id: number;
  name: string;
  description?: string;
  parent_department_id?: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface Position {
  id: number;
  name: string;
  department_id: number;
  parent_position_id?: number | null;
  hierarchy_level: number;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface Employee {
  id: number;
  full_name: string;
  email: string;
  position_id?: number | null;
  department_id?: number | null;
  manager_id?: number | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Space {
  id: number;
  name: string;
  description?: string;
  department_id?: number | null;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface Section {
  id: number;
  name: string;
  description?: string;
  space_id: number;
  position_id: number;
  parent_section_id?: number | null;
  status: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Получить список всех разрешенных ID разделов (sections) для сотрудника
 * на основе его должности, иерархии подчинения и специальных правил.
 */
export const getUserAllowedSections = async (
  employeeId: number | null | undefined,
  userRole: string,
  userId?: number
): Promise<number[]> => {
  // 1. Администратор видит все разделы
  if (await isWikiAdmin(userId, userRole)) {
    const { rows } = await pool.query('SELECT id FROM sections WHERE status = \'Active\'');
    return rows.map((r) => r.id);
  }

  const allowedSectionIds = new Set<number>();

  // 1b. Явные правила новой ролевой модели и публичные разделы
  const ruleAllowedSections = await getRuleAllowedSectionIds(userId);
  ruleAllowedSections.forEach((id) => allowedSectionIds.add(id));

  // 2. Всегда добавляем разделы общего отдела (свободный доступ для всех сотрудников)
  const commonSectionsQuery = `
    SELECT s.id 
    FROM sections s
    JOIN spaces sp ON s.space_id = sp.id
    JOIN departments d ON sp.department_id = d.id
    WHERE d.name = 'Общий отдел' AND s.status = 'Active'
  `;
  const commonRes = await pool.query(commonSectionsQuery);
  commonRes.rows.forEach((r) => allowedSectionIds.add(r.id));

  // 2b. Добавляем разделы, к которым выдан активный гостевой доступ
  let resolvedUserId = userId;
  if (!resolvedUserId && employeeId) {
    const userRes = await pool.query('SELECT id FROM users WHERE employee_id = $1', [employeeId]);
    if (userRes.rows.length > 0) {
      resolvedUserId = userRes.rows[0].id;
    }
  }

  if (resolvedUserId) {
    const guestRes = await pool.query(
      `SELECT section_id FROM guest_access 
       WHERE user_id = $1 AND section_id IS NOT NULL AND status = 'Active' AND expires_at > NOW()`,
      [resolvedUserId]
    );
    guestRes.rows.forEach((r) => allowedSectionIds.add(r.section_id));
  }

  // Если нет привязанного сотрудника, возвращаем только общие + гостевые разделы
  if (!employeeId) {
    return Array.from(allowedSectionIds);
  }

  // Получаем информацию о должности сотрудника
  const employeeQuery = `
    SELECT e.position_id, p.name as position_name, d.name as dept_name
    FROM employees e
    LEFT JOIN positions p ON e.position_id = p.id
    LEFT JOIN departments d ON e.department_id = d.id
    WHERE e.id = $1 AND e.is_active = true
  `;
  const empRes = await pool.query(employeeQuery, [employeeId]);
  if (empRes.rows.length === 0 || !empRes.rows[0].position_id) {
    return Array.from(allowedSectionIds);
  }

  const positionId = empRes.rows[0].position_id;
  const positionName = empRes.rows[0].position_name || '';
  const departmentName = empRes.rows[0].dept_name || '';

  // 3. Рекурсивно находим все подчиненные должности (включая собственную)
  const subPositionsQuery = `
    WITH RECURSIVE subordinate_positions AS (
      SELECT id FROM positions WHERE id = $1
      UNION ALL
      SELECT p.id FROM positions p
      INNER JOIN subordinate_positions sp ON p.parent_position_id = sp.id
    )
    SELECT id FROM subordinate_positions;
  `;
  const subPosRes = await pool.query(subPositionsQuery, [positionId]);
  const positionIds = subPosRes.rows.map((r) => r.id);

  if (positionIds.length > 0) {
    // Находим секции, привязанные к этим должностям
    const sectionsQuery = `
      SELECT id FROM sections 
      WHERE position_id = ANY($1) AND status = 'Active'
    `;
    const secRes = await pool.query(sectionsQuery, [positionIds]);
    secRes.rows.forEach((r) => allowedSectionIds.add(r.id));
  }

  // 4. Дополнительные правила (Special Overrides)
  // IT-специалисты / Системный администратор имеют доступ ко всей IT-документации
  if (
    positionName.toLowerCase().includes('системный администратор') || 
    positionName.toLowerCase().includes('it-специалист') ||
    departmentName.toLowerCase().includes('it') ||
    userRole === 'IT-специалист'
  ) {
    const itSectionsQuery = `
      SELECT s.id 
      FROM sections s
      JOIN spaces sp ON s.space_id = sp.id
      JOIN departments d ON sp.department_id = d.id
      WHERE d.name = 'IT-отдел' AND s.status = 'Active'
    `;
    const itRes = await pool.query(itSectionsQuery);
    itRes.rows.forEach((r) => allowedSectionIds.add(r.id));
  }

  // Бухгалтеры имеют доступ ко всей финансовой документации
  if (
    positionName.toLowerCase().includes('бухгалтер') || 
    departmentName.toLowerCase().includes('бухгалтер') ||
    userRole === 'Бухгалтер'
  ) {
    const accSectionsQuery = `
      SELECT s.id 
      FROM sections s
      JOIN spaces sp ON s.space_id = sp.id
      JOIN departments d ON sp.department_id = d.id
      WHERE d.name = 'Бухгалтерия' AND s.status = 'Active'
    `;
    const accRes = await pool.query(accSectionsQuery);
    accRes.rows.forEach((r) => allowedSectionIds.add(r.id));
  }

  // HR-менеджеры имеют доступ к HR-документации + раздел Оператор для онбординга
  if (
    positionName.toLowerCase().includes('hr') || 
    departmentName.toLowerCase().includes('hr') ||
    userRole === 'HR-менеджер'
  ) {
    const hrSectionsQuery = `
      SELECT s.id 
      FROM sections s
      JOIN spaces sp ON s.space_id = sp.id
      JOIN departments d ON sp.department_id = d.id
      WHERE (d.name = 'HR' OR s.name = 'Оператор' OR s.position_id = 4) AND s.status = 'Active'
    `;
    const hrRes = await pool.query(hrSectionsQuery);
    hrRes.rows.forEach((r) => allowedSectionIds.add(r.id));
  }

  return Array.from(allowedSectionIds);
};
