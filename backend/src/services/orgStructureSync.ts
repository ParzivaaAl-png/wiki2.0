import { query, pool } from '../config/db';

export class OrgStructureSyncService {
  /**
   * Запустить полную синхронизацию оргструктуры с Wiki-структурой.
   * 1. Синхронизация Departments -> Spaces
   * 2. Синхронизация Positions -> Sections
   */
  public static async syncAll(): Promise<{ success: boolean; spacesSynced: number; sectionsSynced: number }> {
    const client = await pool.connect();
    let spacesSynced = 0;
    let sectionsSynced = 0;

    try {
      await client.query('BEGIN');

      // 1. Синхронизация Отделов (Departments) в Пространства (Spaces)
      const deptsRes = await client.query('SELECT * FROM departments');
      const departments = deptsRes.rows;

      for (const dept of departments) {
        // Проверяем существование пространства
        const spaceRes = await client.query('SELECT id FROM spaces WHERE department_id = $1', [dept.id]);
        
        const status = dept.status === 'Inactive' ? 'Inactive' : 'Active';

        if (spaceRes.rows.length === 0) {
          // Создаем новое пространство
          await client.query(
            `INSERT INTO spaces (name, description, department_id, status)
             VALUES ($1, $2, $3, $4)`,
            [dept.name, dept.description || `Пространство для отдела ${dept.name}`, dept.id, status]
          );
        } else {
          // Обновляем существующее пространство
          await client.query(
            `UPDATE spaces 
             SET name = $1, description = COALESCE($2, description), status = $3, updated_at = NOW()
             WHERE department_id = $4`,
            [dept.name, dept.description, status, dept.id]
          );
        }
        spacesSynced++;
      }

      // 2. Синхронизация Должностей (Positions) в Разделы (Sections)
      const positionsRes = await client.query('SELECT * FROM positions');
      const positions = positionsRes.rows;

      // Сначала убедимся, что все разделы созданы без привязки к parent_section_id (чтобы избежать циклов/отсутствия родителей)
      // Затем пропишем связи parent_section_id во втором проходе.
      for (const pos of positions) {
        // Ищем Space ID для отдела этой должности
        const spaceRes = await client.query('SELECT id FROM spaces WHERE department_id = $1', [pos.department_id]);
        if (spaceRes.rows.length === 0) {
          // Если пространства еще нет (например, отдел не синхронизирован), пропускаем
          continue;
        }
        const spaceId = spaceRes.rows[0].id;

        const sectionRes = await client.query('SELECT id FROM sections WHERE position_id = $1', [pos.id]);
        const sectionStatus = pos.status === 'Active' ? 'Active' : 'Archived';

        if (sectionRes.rows.length === 0) {
          // Создаем новый раздел без родительского раздела на первом шаге
          await client.query(
            `INSERT INTO sections (name, description, space_id, position_id, status)
             VALUES ($1, $2, $3, $4, $5)`,
            [pos.name, `Раздел для должности ${pos.name}`, spaceId, pos.id, sectionStatus]
          );
        } else {
          // Обновляем существующий раздел
          await client.query(
            `UPDATE sections 
             SET name = $1, space_id = $2, status = $3, updated_at = NOW()
             WHERE position_id = $4`,
            [pos.name, spaceId, sectionStatus, pos.id]
          );
        }
      }

      // Второй проход: связываем разделы по иерархии parent_section_id
      for (const pos of positions) {
        if (!pos.parent_position_id) {
          // Если нет родительской должности, сбрасываем родительский раздел в NULL
          await client.query(
            'UPDATE sections SET parent_section_id = NULL WHERE position_id = $1',
            [pos.id]
          );
          continue;
        }

        // Ищем ID раздела для родительской должности
        const parentSecRes = await client.query('SELECT id FROM sections WHERE position_id = $1', [pos.parent_position_id]);
        if (parentSecRes.rows.length > 0) {
          const parentSectionId = parentSecRes.rows[0].id;
          await client.query(
            'UPDATE sections SET parent_section_id = $1 WHERE position_id = $2',
            [parentSectionId, pos.id]
          );
        } else {
          await client.query(
            'UPDATE sections SET parent_section_id = NULL WHERE position_id = $1',
            [pos.id]
          );
        }
        sectionsSynced++;
      }

      // 3. Архивация разделов, должности которых были удалены (position_id IS NULL, но статус еще не Archived)
      // Либо у которых должность больше не существует в списке активных
      const posIds = positions.map(p => p.id);
      if (posIds.length > 0) {
        await client.query(
          `UPDATE sections 
           SET status = 'Archived', position_id = NULL, parent_section_id = NULL, updated_at = NOW()
           WHERE position_id IS NOT NULL AND NOT (position_id = ANY($1::int[]))`,
          [posIds]
        );
      }

      await client.query('COMMIT');
      return { success: true, spacesSynced, sectionsSynced };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('OrgStructureSyncService failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}
