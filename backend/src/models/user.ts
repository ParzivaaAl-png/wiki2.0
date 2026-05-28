import { pool } from '../config/db';

export interface User {
  id: number;
  username: string;
  password_hash: string;
  name: string;
  role: string;
  is_blocked: boolean;
  created_at: Date;
  updated_at: Date;
}

export const createUser = async (
  username: string,
  passwordHash: string,
  name: string,
  role: string = 'User'
): Promise<User> => {
  const query = `
    INSERT INTO users (username, password_hash, name, role)
    VALUES ($1, $2, $3, $4)
    RETURNING id, username, name, role, is_blocked, created_at, updated_at
  `;
  const values = [username.trim(), passwordHash, name, role];
  const { rows } = await pool.query(query, values);
  return rows[0];
};

export const getUserByUsername = async (username: string): Promise<User | null> => {
  const query = 'SELECT * FROM users WHERE username = $1';
  const { rows } = await pool.query(query, [username.trim()]);
  return rows.length ? rows[0] : null;
};

export const getUserById = async (id: number): Promise<User | null> => {
  const query = 'SELECT * FROM users WHERE id = $1';
  const { rows } = await pool.query(query, [id]);
  return rows.length ? rows[0] : null;
};

export const getAllUsers = async (): Promise<Omit<User, 'password_hash'>[]> => {
  const query = 'SELECT id, username, name, role, is_blocked, created_at, updated_at FROM users ORDER BY id ASC';
  const { rows } = await pool.query(query);
  return rows;
};

export const deleteUser = async (id: number): Promise<boolean> => {
  const query = 'DELETE FROM users WHERE id = $1';
  const { rowCount } = await pool.query(query, [id]);
  return rowCount ? rowCount > 0 : false;
};

export const blockUser = async (id: number, isBlocked: boolean): Promise<boolean> => {
  const query = 'UPDATE users SET is_blocked = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1';
  const { rowCount } = await pool.query(query, [id, isBlocked]);
  return rowCount ? rowCount > 0 : false;
};

export const changeUserRole = async (id: number, role: string): Promise<boolean> => {
  const query = 'UPDATE users SET role = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1';
  const { rowCount } = await pool.query(query, [id, role]);
  return rowCount ? rowCount > 0 : false;
};

export const resetUserPassword = async (id: number, passwordHash: string): Promise<boolean> => {
  const query = 'UPDATE users SET password_hash = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1';
  const { rowCount } = await pool.query(query, [id, passwordHash]);
  return rowCount ? rowCount > 0 : false;
};
