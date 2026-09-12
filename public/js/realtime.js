/**
 * Ouvre une connexion WebSocket vers le serveur et rediffuse chaque
 * message reçu comme un événement navigateur classique
 * (window.addEventListener('hub-realtime', ...)) — comme ça, chaque page
 * peut écouter uniquement les événements qui l'intéressent, sans avoir à
 * connaître les détails de la connexion WebSocket elle-même.
 *
 * Reconnexion automatique en cas de coupure : sans ça, un simple
 * redémarrage du serveur couperait le temps réel définitivement, jusqu'à
 * ce que la personne recharge la page à la main.
 */
(function initRealtimeClient() {
  const statusEl = document.getElementById('liveStatus');
  let socket;
  let reconnectDelay = 1000; // repart à 1s après une reconnexion réussie

  function setStatus(connected) {
    if (!statusEl) return;
    statusEl.textContent = connected ? '🟢 Temps réel connecté' : '🔴 Reconnexion...';
    statusEl.className = connected ? 'live-status connected' : 'live-status disconnected';
  }

  function connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(`${protocol}//${window.location.host}`);

    socket.addEventListener('open', () => {
      setStatus(true);
      reconnectDelay = 1000; // la connexion a réussi, on réinitialise le délai
    });

    socket.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        window.dispatchEvent(new CustomEvent('hub-realtime', { detail: data }));
      } catch {
        // message mal formé, ignoré
      }
    });

    socket.addEventListener('close', () => {
      setStatus(false);
      // Nouvelle tentative après un délai qui augmente à chaque échec
      // (1s, 2s, 4s... jusqu'à 30s max) — évite de marteler le serveur
      // s'il met du temps à revenir.
      setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, 30000);
    });

    socket.addEventListener('error', () => socket.close());
  }

  connect();
})();
