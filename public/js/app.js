const STORAGE_KEY = 'rodrick_hub_api_key';
const input = document.getElementById('apiKeyInput');
const grid = document.getElementById('grid');
const summary = document.getElementById('summary');
const emptyEl = document.getElementById('empty');
const errorEl = document.getElementById('error');

input.value = localStorage.getItem(STORAGE_KEY) || '';

document.getElementById('saveKeyBtn').addEventListener('click', () => {
  localStorage.setItem(STORAGE_KEY, input.value.trim());
  refresh();
});

function apiKey() {
  return localStorage.getItem(STORAGE_KEY) || '';
}

function formatUptime(seconds) {
  if (seconds == null) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d) parts.push(d + 'j');
  if (h) parts.push(h + 'h');
  parts.push(m + 'min');
  return parts.join(' ');
}

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `il y a ${diff}s`;
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  return `il y a ${Math.floor(diff / 86400)}j`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function topCommandsHtml(commandStats) {
  const entries = Object.entries(commandStats || {}).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (!entries.length) {
    return '<div class="top-commands"><div class="k">Top commandes</div><div class="muted-small">Aucune donnée pour le moment</div></div>';
  }
  const rows = entries
    .map(([name, count]) => `<div class="cmd-row"><span>!${escapeHtml(name)}</span><span>${count}</span></div>`)
    .join('');
  return `<div class="top-commands"><div class="k">Top commandes</div>${rows}</div>`;
}

// Mêmes règles que le bot (config/index.js::isValidPrefix) et que la route
// POST /api/instances/:id/config : 1 à 5 caractères, sans espace. Ici pour
// refuser tôt avec un message clair — le serveur ET le bot re-valident.
function isValidPrefix(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 5 && !/\s/.test(value);
}

// Préfixe poussé depuis le Hub mais pas encore appliqué par le bot (le bot
// l'applique au heartbeat suivant, voir core/remoteConfig.js côté
// RodrickBOT). null si rien n'est en attente. Une valeur identique au
// préfixe déjà en place n'est pas "en attente" : rien de visible à attendre.
function pendingRemotePrefix(inst) {
  const wanted = inst.remoteConfig?.prefix;
  if (!wanted) return null;
  if ((inst.configVersion ?? 0) <= (inst.appliedConfigVersion ?? 0)) return null;
  if (wanted === inst.prefix) return null;
  return wanted;
}

// Codes de l'énum DisconnectReason de @whiskeysockets/baileys, affichés en
// clair pour ne pas obliger à connaître le paquet par cœur — un code non
// listé ici s'affiche simplement tel quel ("code 123"), jamais masqué.
const DISCONNECT_REASON_LABELS = {
  401: 'session fermée',
  403: 'interdit',
  408: 'connexion perdue',
  411: 'version multi-appareils incompatible',
  428: 'connexion fermée',
  440: 'remplacée par une autre session',
  500: 'session corrompue',
  515: 'redémarrage requis',
};

// Santé de connexion (Phase 1b) — reconnectCount/lastDisconnectAt sont NULL
// pour une copie pas encore mise à jour (RodrickBOT < 1.79.0, voir
// core/state.js côté bot) : dans ce cas on n'affiche rien plutôt qu'une
// ligne à moitié vide.
function connectionHealthHtml(inst) {
  if (inst.reconnectCount == null && inst.lastDisconnectAt == null) return '';

  const reason = inst.lastDisconnectCode != null
    ? (DISCONNECT_REASON_LABELS[inst.lastDisconnectCode] || `code ${inst.lastDisconnectCode}`)
    : null;

  return `
    <div class="info-row"><span class="k">Reconnexions</span><span>${inst.reconnectCount ?? '—'}</span></div>
    ${inst.lastDisconnectAt != null
      ? `<div class="info-row"><span class="k">Dernière coupure</span><span>${timeAgo(inst.lastDisconnectAt)}${reason ? ` (${escapeHtml(reason)})` : ''}</span></div>`
      : ''}
  `;
}

function instanceCardHtml(inst) {
  const enabled = inst.enabled !== false;
  // Le bouton 🗑️ n'apparaît que pour les copies hors ligne : pensé pour
  // nettoyer le dashboard des instances mortes en permanence, pas pour
  // supprimer une copie active par erreur.
  const deleteBtn = !inst.online
    ? `<button class="delete-btn" data-id="${escapeHtml(inst.instanceId)}" title="Supprimer définitivement cette instance">🗑️</button>`
    : '';

  // appliedConfigVersion vaut null tant que le bot n'a JAMAIS envoyé cet
  // accusé de réception : c'est une copie pas encore mise à jour vers une
  // version qui gère la configuration poussée (RodrickBOT 1.82.0+). Lui
  // pousser un préfixe resterait "en attente" indéfiniment, donc bouton
  // désactivé avec l'explication plutôt qu'une promesse trompeuse.
  const canPushConfig = inst.appliedConfigVersion != null;
  const prefixBtn = `<button class="prefix-btn" data-id="${escapeHtml(inst.instanceId)}" data-prefix="${escapeHtml(inst.prefix)}" ${canPushConfig ? '' : 'disabled'} title="${canPushConfig ? 'Changer le préfixe à distance' : 'Cette copie doit d\'abord être mise à jour (RodrickBOT 1.82.0 ou plus)'}">✏️</button>`;
  const pendingPrefix = pendingRemotePrefix(inst);

  return `
    <div class="instance-card ${enabled ? '' : 'disabled-card'}">
      <div class="top">
        <div>
          <div class="owner">${escapeHtml(inst.ownerName)}</div>
          <div class="instance-id">${escapeHtml(inst.instanceId)}</div>
        </div>
        <div class="badge ${inst.online ? 'online' : 'offline'}">${inst.online ? '🟢 En ligne' : '🔴 Hors ligne'}</div>
      </div>
      <div class="info-row"><span class="k">Bot</span><span>${escapeHtml(inst.botName)} v${escapeHtml(inst.version)}</span></div>
      <div class="info-row"><span class="k">Mode</span><span>${escapeHtml(inst.mode)}</span></div>
      <div class="info-row"><span class="k">Préfixe</span><span>${escapeHtml(inst.prefix)}${prefixBtn}</span></div>
      ${pendingPrefix ? `<div class="config-pending">⏳ En attente : « ${escapeHtml(pendingPrefix)} » — appliqué au prochain contact du bot</div>` : ''}
      <div class="info-row"><span class="k">Uptime</span><span>${formatUptime(inst.uptimeSeconds)}</span></div>
      <div class="info-row"><span class="k">Messages traités</span><span>${inst.messageCount ?? '—'}</span></div>
      <div class="info-row"><span class="k">Dernier contact</span><span>${timeAgo(inst.lastSeen)}</span></div>
      ${connectionHealthHtml(inst)}
      ${topCommandsHtml(inst.commandStats)}
      <div class="actions">
        <button class="toggle-btn ${enabled ? 'is-on' : 'is-off'}" data-id="${escapeHtml(inst.instanceId)}" data-enabled="${enabled}">
          ${enabled ? '🟢 Activée — cliquer pour désactiver' : '🔴 Désactivée — cliquer pour réactiver'}
        </button>
        ${deleteBtn}
      </div>
    </div>
  `;
}

async function refresh() {
  const key = apiKey();
  errorEl.style.display = 'none';

  try {
    const res = await fetch('/api/instances', { headers: { 'x-api-key': key } });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      errorEl.textContent = data.error || `Erreur serveur (${res.status})`;
      errorEl.style.display = 'block';
      grid.innerHTML = '';
      summary.innerHTML = '';
      return;
    }

    const { instances } = await res.json();
    const onlineCount = instances.filter((i) => i.online).length;

    summary.innerHTML = `
      <div class="stat"><div class="value">${instances.length}</div><div class="label">Copies totales</div></div>
      <div class="stat"><div class="value">${onlineCount}</div><div class="label">En ligne</div></div>
      <div class="stat"><div class="value">${instances.length - onlineCount}</div><div class="label">Hors ligne</div></div>
    `;

    emptyEl.style.display = instances.length ? 'none' : 'block';
    grid.innerHTML = instances.map(instanceCardHtml).join('');

    document.querySelectorAll('.toggle-btn').forEach((btn) => {
      btn.addEventListener('click', () => toggleInstance(btn.dataset.id, btn.dataset.enabled !== 'true'));
    });
    document.querySelectorAll('.delete-btn').forEach((btn) => {
      btn.addEventListener('click', () => deleteInstance(btn.dataset.id));
    });
    document.querySelectorAll('.prefix-btn').forEach((btn) => {
      btn.addEventListener('click', () => changeRemotePrefix(btn.dataset.id, btn.dataset.prefix));
    });
  } catch (err) {
    errorEl.textContent = 'Impossible de contacter le serveur.';
    errorEl.style.display = 'block';
  }
}

async function toggleInstance(instanceId, enabled) {
  const key = apiKey();
  try {
    const res = await fetch(`/api/instances/${encodeURIComponent(instanceId)}/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key },
      body: JSON.stringify({ enabled }),
    });
    if (!res.ok) { alert('Impossible de changer le statut (clé API invalide ou erreur serveur).'); return; }
    refresh();
  } catch { alert('Impossible de contacter le serveur.'); }
}

// Un prompt() natif plutôt qu'un <input> dans la carte : refresh() reconstruit
// toute la grille (grid.innerHTML) à CHAQUE heartbeat de n'importe quelle
// instance — un champ de saisie intégré à la carte serait vidé en pleine
// frappe. prompt() vit hors du DOM de la grille, et reste cohérent avec les
// confirm()/alert() déjà utilisés ici.
async function changeRemotePrefix(instanceId, currentPrefix) {
  const answer = prompt(
    `Nouveau préfixe pour "${instanceId}" (actuel : "${currentPrefix}").\n` +
    `1 à 5 caractères, sans espace.\n\n` +
    `Il sera appliqué au prochain contact du bot (jusqu'à 5 min, ou à son retour s'il est hors ligne).`,
    currentPrefix
  );
  if (answer === null) return; // annulé

  const prefix = answer.trim();
  if (!isValidPrefix(prefix)) { alert('Préfixe invalide : 1 à 5 caractères, sans espace.'); return; }
  if (prefix === currentPrefix) { alert('C\'est déjà le préfixe actuel de cette copie.'); return; }

  const key = apiKey();
  try {
    const res = await fetch(`/api/instances/${encodeURIComponent(instanceId)}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key },
      body: JSON.stringify({ prefix }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'Impossible de changer le préfixe (clé API invalide ou erreur serveur).');
      return;
    }
    refresh();
  } catch { alert('Impossible de contacter le serveur.'); }
}

async function deleteInstance(instanceId) {
  const confirmed = confirm(
    `Supprimer définitivement les infos de "${instanceId}" ?\nCette action est irréversible — utile uniquement si la copie est hors ligne pour de bon.`
  );
  if (!confirmed) return;

  const key = apiKey();
  try {
    const res = await fetch(`/api/instances/${encodeURIComponent(instanceId)}`, {
      method: 'DELETE',
      headers: { 'x-api-key': key },
    });
    if (!res.ok) { alert('Impossible de supprimer cette instance (clé API invalide ou erreur serveur).'); return; }
    refresh();
  } catch { alert('Impossible de contacter le serveur.'); }
}

refresh();

// Avant le temps réel, on redemandait "y a-t-il du nouveau ?" toutes les
// 10s, que ça ait changé ou non (setInterval(refresh, 10000)). Maintenant,
// le serveur PRÉVIENT lui-même dès qu'une instance se met à jour — on
// n'a plus qu'à réagir à l'événement, sans jamais interroger pour rien.
window.addEventListener('hub-realtime', (e) => {
  if (e.detail.type === 'instance-update' || e.detail.type === 'instance-deleted') {
    refresh();
  }
});