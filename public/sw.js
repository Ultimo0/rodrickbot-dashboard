/**
 * sw.js
 * ------------------------------------------------------------------
 * Un service worker est un script que le navigateur garde actif EN
 * ARRIÈRE-PLAN, même quand aucun onglet du Hub n'est ouvert — c'est ce
 * qui permet à une notification push d'arriver alors que le site n'est
 * pas affiché. Volontairement minimal : ce fichier ne fait QUE la
 * réception des notifications, pas de mise en cache pour un
 * fonctionnement hors-ligne (un dashboard en temps réel n'a pas grand
 * sens sans connexion de toute façon).
 * ------------------------------------------------------------------
 */

self.addEventListener('push', (event) => {
  let data = { title: 'Rodrick Hub', body: 'Nouveauté sur le Hub.', url: '/' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // payload mal formé — on garde les valeurs par défaut ci-dessus plutôt que d'échouer
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      data: { url: data.url || '/' },
    })
  );
});

// Au clic sur la notification : ramène au premier plan un onglet du Hub
// déjà ouvert s'il y en a un (plutôt que d'en ouvrir un nouveau à chaque
// fois), sinon en ouvre un nouveau sur la page concernée.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === targetUrl && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
