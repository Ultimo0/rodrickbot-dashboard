import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { listPosts, getPost, createPost, updatePost, deletePost } from '../store/postsStore.js';
import { broadcast } from '../realtime.js';
import { ah } from '../utils/asyncHandler.js';

export const postsRouter = Router();

const VALID_CATEGORIES = ['publication', 'annonce', 'nouveaute', 'guide'];

// Public, comme /api/releases et /api/commands : l'espace communauté est
// fait pour être lu par n'importe quel visiteur du Hub.
postsRouter.get('/posts', ah(async (req, res) => {
  const { category } = req.query;
  res.json({ posts: await listPosts(category || null) });
}));

postsRouter.get('/posts/:id', ah(async (req, res) => {
  const post = await getPost(Number(req.params.id));
  if (!post) return res.status(404).json({ error: 'Publication introuvable.' });
  res.json(post);
}));

postsRouter.post('/posts', requireAuth, requireAdmin, ah(async (req, res) => {
  const { title, content, category } = req.body || {};

  if (!title || !content) {
    return res.status(400).json({ error: 'Titre et contenu requis.' });
  }
  if (!VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `Catégorie invalide (attendu : ${VALID_CATEGORIES.join(', ')}).` });
  }

  const post = await createPost({ title, content, category, authorId: req.session.userId });
  broadcast({ type: 'new-post', post });
  res.json({ ok: true, post });
}));

postsRouter.patch('/posts/:id', requireAuth, requireAdmin, ah(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await getPost(id);
  if (!existing) return res.status(404).json({ error: 'Publication introuvable.' });

  const { title, content, category } = req.body || {};
  if (category && !VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `Catégorie invalide (attendu : ${VALID_CATEGORIES.join(', ')}).` });
  }

  const post = await updatePost(id, {
    title: title || existing.title,
    content: content || existing.content,
    category: category || existing.category,
  });
  res.json({ ok: true, post });
}));

postsRouter.delete('/posts/:id', requireAuth, requireAdmin, ah(async (req, res) => {
  const id = Number(req.params.id);
  if (!(await getPost(id))) return res.status(404).json({ error: 'Publication introuvable.' });

  await deletePost(id);
  res.json({ ok: true, deleted: id });
}));
