import { pool } from '../db.js';

export async function loadCommands() {
  const { rows } = await pool.query('SELECT * FROM commands ORDER BY name');
  return rows.map((row) => ({
    ...row,
    aliases: row.aliases ? JSON.parse(row.aliases) : [],
    adminOnly: Boolean(row.adminOnly),
  }));
}
