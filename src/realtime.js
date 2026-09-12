import { WebSocketServer } from 'ws';

/**
 * realtime.js
 * ------------------------------------------------------------------
 * Une connexion WebSocket, contrairement à une requête HTTP classique,
 * reste OUVERTE : le serveur peut envoyer des messages au navigateur à
 * tout moment, sans que celui-ci ait besoin de redemander quoi que ce
 * soit. C'est exactement l'inverse du principe utilisé partout ailleurs
 * dans ce projet jusqu'ici (fetch() = le navigateur demande, le serveur
 * répond une fois, puis la connexion se referme).
 *
 * On garde ici la liste de tous les navigateurs actuellement connectés,
 * pour pouvoir leur envoyer un message à tous en même temps (broadcast()).
 * ------------------------------------------------------------------
 */

let wss = null;

/** À appeler une seule fois, avec le serveur HTTP créé dans server.js. */
export function initRealtime(httpServer) {
  wss = new WebSocketServer({ server: httpServer });

  wss.on('connection', (socket) => {
    socket.on('error', () => {}); // évite qu'une erreur de socket fasse planter le process
  });
}

/**
 * Envoie un événement à TOUS les navigateurs connectés en même temps.
 * `event` doit être un objet simple (converti en JSON) — ex:
 * broadcast({ type: 'new-post', post }).
 */
export function broadcast(event) {
  if (!wss) return; // initRealtime() pas encore appelé (ne devrait pas arriver, sécurité par défaut)

  const payload = JSON.stringify(event);
  for (const client of wss.clients) {
    // readyState 1 = OPEN — inutile d'essayer d'envoyer à une connexion
    // en train de se fermer ou déjà fermée.
    if (client.readyState === 1) client.send(payload);
  }
}
