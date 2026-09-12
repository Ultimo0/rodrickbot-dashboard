/**
 * Contrairement à requireApiKey.js (une clé partagée pour toutes les
 * copies de RodrickBOT), ici chaque PERSONNE a son propre compte. La
 * "session" est stockée côté serveur (via express-session, branché dans
 * server.js) ; le navigateur ne garde qu'un cookie qui pointe vers cette
 * session — jamais le mot de passe, jamais rien de sensible.
 */
export function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Connexion requise.' });
  }
  next();
}
