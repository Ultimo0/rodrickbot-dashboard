/**
 * asyncHandler.js
 * ------------------------------------------------------------------
 * Express 4 (utilisé dans ce projet) ne rattrape PAS automatiquement les
 * erreurs levées dans un handler de route déclaré `async` — contrairement
 * à Express 5. Sans ce filet, une requête Postgres qui échoue (connexion
 * perdue, contrainte violée...) laisserait la requête HTTP sans réponse,
 * ou ferait planter tout le process selon le cas.
 *
 * ah(fn) enveloppe un handler async et redirige toute erreur vers le
 * middleware d'erreur global défini dans server.js, au lieu de la laisser
 * non gérée.
 *
 * Usage : router.get('/route', ah(async (req, res) => { ... }));
 */
export function ah(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
