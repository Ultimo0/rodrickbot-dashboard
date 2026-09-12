import { db } from '../db.js';

const selectAll = db.prepare('SELECT * FROM commands ORDER BY name');

export function loadCommands() {
  return selectAll.all().map((row) => ({
    ...row,
    aliases: row.aliases ? JSON.parse(row.aliases) : [],
    adminOnly: Boolean(row.adminOnly),
  }));
}
