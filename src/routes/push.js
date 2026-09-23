import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { addSubscription, removeUserSubscription } from '../store/pushStore.js';
import { ah } from '../utils/asyncHandler.js';

export const pushRouter = Router();

/**
 * Réservé aux comptes connectés (voir la discussion dans le chat : un
 * abonnement est toujours rattaché à un "userId", jamais anonyme) — le
 * navigateur envoie ici l'objet PushSubscription tel que
 * pushManager.subscribe() le renvoie (endpoint + keys.p256dh + keys.auth).
 */
pushRouter.post('/push/subscribe', requireAuth, ah(async (req, res) => {
  const { subscription } = req.body || {};

  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return res.status(400).json({ error: 'Abonnement push invalide.' });
  }

  await addSubscription(req.session.userId, subscription);
  res.json({ ok: true });
}));

pushRouter.post('/push/unsubscribe', requireAuth, ah(async (req, res) => {
  const { endpoint } = req.body || {};
  if (!endpoint) return res.status(400).json({ error: 'endpoint requis.' });

  await removeUserSubscription(req.session.userId, endpoint);
  res.json({ ok: true });
}));
