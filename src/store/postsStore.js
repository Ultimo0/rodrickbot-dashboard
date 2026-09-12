import { db } from '../db.js';

// La jointure (JOIN) récupère le nom de l'auteur en même temps que le
// post, en une seule requête — plutôt que de faire une requête séparée
// "trouve l'auteur du post X" pour chaque post affiché.
const selectAll = db.prepare(`
  SELECT posts.*, users.name AS authorName
  FROM posts
  JOIN users ON users.id = posts.authorId
  ORDER BY posts.createdAt DESC
`);

const selectByCategory = db.prepare(`
  SELECT posts.*, users.name AS authorName
  FROM posts
  JOIN users ON users.id = posts.authorId
  WHERE posts.category = ?
  ORDER BY posts.createdAt DESC
`);

const selectOne = db.prepare(`
  SELECT posts.*, users.name AS authorName
  FROM posts
  JOIN users ON users.id = posts.authorId
  WHERE posts.id = ?
`);

const insert = db.prepare(`
  INSERT INTO posts (title, content, category, authorId, createdAt)
  VALUES (?, ?, ?, ?, ?)
`);
const update = db.prepare('UPDATE posts SET title = ?, content = ?, category = ? WHERE id = ?');
const remove = db.prepare('DELETE FROM posts WHERE id = ?');

export function listPosts(category) {
  return category ? selectByCategory.all(category) : selectAll.all();
}

export function getPost(id) {
  return selectOne.get(id) || null;
}

export function createPost({ title, content, category, authorId }) {
  const result = insert.run(title, content, category, authorId, Date.now());
  return getPost(result.lastInsertRowid);
}

export function updatePost(id, { title, content, category }) {
  update.run(title, content, category, id);
  return getPost(id);
}

export function deletePost(id) {
  remove.run(id);
}
