import { Request, Response } from 'express';
import { query, pool } from '../config/db';
import { OrgStructureSyncService } from '../services/orgStructureSync';

// DEPARTMENTS
export const getDepartments = async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM departments ORDER BY id ASC');
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const createDepartment = async (req: Request, res: Response) => {
  try {
    const { name, description, parent_department_id } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Название отдела обязательно.' });
    }
    const result = await query(
      'INSERT INTO departments (name, description, parent_department_id) VALUES ($1, $2, $3) RETURNING *',
      [name, description || null, parent_department_id || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const updateDepartment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, parent_department_id, status } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Название отдела обязательно.' });
    }
    const result = await query(
      'UPDATE departments SET name = $1, description = $2, parent_department_id = $3, status = $4, updated_at = NOW() WHERE id = $5 RETURNING *',
      [name, description || null, parent_department_id || null, status || 'Active', id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Отдел не найден.' });
    }
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const deleteDepartment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM departments WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Отдел не найден.' });
    }
    res.json({ message: 'Отдел успешно удален.' });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

// POSITIONS
export const getPositions = async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM positions ORDER BY id ASC');
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const createPosition = async (req: Request, res: Response) => {
  try {
    const { name, department_id, parent_position_id, hierarchy_level } = req.body;
    if (!name || !department_id) {
      return res.status(400).json({ error: 'Название должности и ID отдела обязательны.' });
    }
    const result = await query(
      'INSERT INTO positions (name, department_id, parent_position_id, hierarchy_level) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, department_id, parent_position_id || null, hierarchy_level || 1]
    );
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const updatePosition = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, department_id, parent_position_id, hierarchy_level, status } = req.body;
    if (!name || !department_id) {
      return res.status(400).json({ error: 'Название должности и ID отдела обязательны.' });
    }
    const result = await query(
      'UPDATE positions SET name = $1, department_id = $2, parent_position_id = $3, hierarchy_level = $4, status = $5, updated_at = NOW() WHERE id = $6 RETURNING *',
      [name, department_id, parent_position_id || null, hierarchy_level || 1, status || 'Active', id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Должность не найдена.' });
    }
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const deletePosition = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM positions WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Должность не найдена.' });
    }
    res.json({ message: 'Должность успешно удалена.' });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

// EMPLOYEES
export const getEmployees = async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM employees ORDER BY id ASC');
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const createEmployee = async (req: Request, res: Response) => {
  try {
    const { full_name, email, position_id, department_id, manager_id, is_active } = req.body;
    if (!full_name || !email) {
      return res.status(400).json({ error: 'ФИО сотрудника и Email обязательны.' });
    }
    const result = await query(
      'INSERT INTO employees (full_name, email, position_id, department_id, manager_id, is_active) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [full_name, email, position_id || null, department_id || null, manager_id || null, is_active !== undefined ? is_active : true]
    );
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const updateEmployee = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { full_name, email, position_id, department_id, manager_id, is_active } = req.body;
    if (!full_name || !email) {
      return res.status(400).json({ error: 'ФИО сотрудника и Email обязательны.' });
    }
    const result = await query(
      'UPDATE employees SET full_name = $1, email = $2, position_id = $3, department_id = $4, manager_id = $5, is_active = $6, updated_at = NOW() WHERE id = $7 RETURNING *',
      [full_name, email, position_id || null, department_id || null, manager_id || null, is_active !== undefined ? is_active : true, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Сотрудник не найден.' });
    }
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const deleteEmployee = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM employees WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Сотрудник не найден.' });
    }
    res.json({ message: 'Сотрудник успешно удален.' });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

// SPACES
export const getSpaces = async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM spaces ORDER BY name ASC');
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const createSpace = async (req: Request, res: Response) => {
  try {
    const { name, description, department_id, status } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Название пространства обязательно.' });
    }
    const result = await query(
      'INSERT INTO spaces (name, description, department_id, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, description || null, department_id || null, status || 'Active']
    );
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const updateSpace = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, department_id, status } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Название пространства обязательно.' });
    }
    const result = await query(
      'UPDATE spaces SET name = $1, description = $2, department_id = $3, status = $4, updated_at = NOW() WHERE id = $5 RETURNING *',
      [name, description || null, department_id || null, status || 'Active', id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Пространство не найдено.' });
    }
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const deleteSpace = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM spaces WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Пространство не найдено.' });
    }
    res.json({ message: 'Пространство успешно удалено.' });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

// SECTIONS
export const getSections = async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM sections ORDER BY id ASC');
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const createSection = async (req: Request, res: Response) => {
  try {
    const { name, description, space_id, position_id, parent_section_id, status, owner_id } = req.body;
    if (!name || !space_id) {
      return res.status(400).json({ error: 'Название раздела и ID пространства обязательны.' });
    }
    const result = await query(
      'INSERT INTO sections (name, description, space_id, position_id, parent_section_id, status, owner_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [name, description || null, space_id, position_id || null, parent_section_id || null, status || 'Active', owner_id || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const updateSection = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, space_id, position_id, parent_section_id, status, owner_id } = req.body;
    if (!name || !space_id) {
      return res.status(400).json({ error: 'Название раздела и ID пространства обязательны.' });
    }
    const result = await query(
      'UPDATE sections SET name = $1, description = $2, space_id = $3, position_id = $4, parent_section_id = $5, status = $6, owner_id = $7, updated_at = NOW() WHERE id = $8 RETURNING *',
      [name, description || null, space_id, position_id || null, parent_section_id || null, status || 'Active', owner_id || null, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Раздел не найден.' });
    }
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

export const deleteSection = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM sections WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Раздел не найден.' });
    }
    res.json({ message: 'Раздел успешно удален.' });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};

// ORG STRUCTURE MANUAL SYNC
export const syncOrgStructure = async (req: Request, res: Response) => {
  try {
    const syncRes = await OrgStructureSyncService.syncAll();
    res.json({ message: 'Синхронизация успешно завершена', details: syncRes });
  } catch (error: any) {
    res.status(500).json({ error: 'Ошибка при синхронизации оргструктуры', details: error.message });
  }
};
