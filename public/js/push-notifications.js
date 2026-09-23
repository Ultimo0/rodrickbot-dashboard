/**
 * push-notifications.js
 * ------------------------------------------------------------------
 * Exporte deux fonctions sur window.RodrickPush, utilisées par
 * profile.js : getStatus() pour savoir où on en est au chargement de la
 * page, et toggle() pour activer/désactiver au clic. Isolé dans son
 * propre fichier plutôt que mélangé à profile.js — cette logique ne
 * dépend de rien de spécifique à la page profil, elle pourrait resservir
 * ailleurs telle quelle.
 * ------------------------------------------------------------------
 */

// Format attendu par pushManager.subscribe() : un ArrayBuffer, pas la
// chaîne base64url telle quelle — cette conversion est nécessaire à
// chaque fois qu'on utilise une clé VAPID côté navigateur.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function getVapidPublicKey() {
  const res = await fetch('/api/config');
  const { vapidPublicKey } = await res.json();
  return vapidPublicKey;
}

/**
 * "unsupported" : navigateur trop ancien ou contexte non sécurisé (les
 * notifications push exigent HTTPS, sauf sur localhost).
 * "denied" : la personne a explicitement refusé la permission — on ne
 * peut plus la lui redemander par programme, seulement l'orienter vers
 * les réglages du navigateur (voir profile.js).
 * "subscribed" / "not-subscribed" : les deux cas normaux.
 */
async function getStatus() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';

  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  return subscription ? 'subscribed' : 'not-subscribed';
}

async function subscribe() {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Permission refusée.');

  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  const vapidPublicKey = await getVapidPublicKey();
  if (!vapidPublicKey) throw new Error('Notifications non configurées côté serveur (VAPID manquant).');

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true, // exigé par Chrome : chaque push DOIT afficher une notification visible, jamais un traitement silencieux
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });

  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Échec de l\'abonnement.');
}

async function unsubscribe() {
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;

  await fetch('/api/push/unsubscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });

  await subscription.unsubscribe();
}

async function toggle() {
  const status = await getStatus();
  if (status === 'subscribed') await unsubscribe();
  else await subscribe();
  return getStatus();
}

window.RodrickPush = { getStatus, toggle };
