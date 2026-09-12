import { API_KEY } from '../config.js';

/**
 * Un "middleware" Express, c'est une fonction qui s'exécute AVANT la route
 * elle-même. Ici : on vérifie que la requête a bien la bonne clé API dans
 * son en-tête `x-api-key` — si non, on arrête tout avec une erreur 401
 * (non autorisé) et on ne laisse jamais la route se lancer.
 *
 * Le prochain (`next`) est ce qui dit à Express "c'est bon, continue vers
 * la route" — sans l'appeler, la requête reste bloquée ici pour toujours.
 */
export function requireApiKey(req, res, next) {
  if (!API_KEY) {
    // Cause côté SERVEUR (pas la faute de la personne qui tape une clé) :
    // .env n'a jamais été configuré. Message différent de "mauvaise clé"
    // pour que ce soit diagnosticable depuis le navigateur, sans avoir à
    // aller lire les logs du serveur.
    return res.status(500).json({
      error: "Le serveur n'a pas de DASHBOARD_API_KEY configurée (.env manquant ou incomplet) — contacte l'administrateur du Hub.",
    });
  }

  const key = req.header('x-api-key');
  if (key !== API_KEY) {
    return res.status(401).json({ error: 'Clé API invalide.' });
  }

  next();
}
