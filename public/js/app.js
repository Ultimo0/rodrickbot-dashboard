import { filterInstances } from './ui-utils.js';

const STORAGE_KEY = 'rodrick_hub_api_key';
const input = document.getElementById('apiKeyInput');
const grid = document.getElementById('grid');
const summary = document.getElementById('summary');
const emptyEl = document.getElementById('empty');
const noResultsEl = document.getElementById('noResults');
const errorEl = document.getElementById('error');
const feedbackEl = document.getElementById('actionFeedback');
const toolbar = document.getElementById('instanceToolbar');
const searchInput = document.getElementById('instanceSearch');
const filterBar = document.getElementById('instanceFilters');
const resultCountEl = document.getElementById('instanceResultCount');

let allInstances = [];
let activeFilter = 'all';
let feedbackTimer;

input.value = localStorage.getItem(STORAGE_KEY) || '';

document.getElementById('saveKeyBtn').addEventListener('click', () => {
  const key = input.value.trim();
  if (!key) {
    input.focus();
    showFeedback('Saisis la clé API du dashboard pour charger tes instances.', true);
    return;
  }
  localStorage.setItem(STORAGE_KEY, key);
  showFeedback('Connexion en cours…');
  refresh(true);
});
input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') document.getElementById('saveKeyBtn').click();
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
  if (ts == null || !Number.isFinite(Number(ts))) return 'inconnu';
  const diff = Math.max(0, Math.floor((Date.now() - Number(ts)) / 1000));
  if (diff < 60) return `il y a ${diff}s`;
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  return `il y a ${Math.floor(diff / 86400)}j`;
}

function showFeedback(message, isError = false) {
  clearTimeout(feedbackTimer);
  feedbackEl.textContent = message;
  feedbackEl.classList.toggle('is-error', isError);
  feedbackEl.hidden = false;
  feedbackTimer = setTimeout(() => { feedbackEl.hidden = true; }, 4500);
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
  const online = inst.online === true;
  // Le bouton 🗑️ n'apparaît que pour les copies hors ligne : pensé pour
  // nettoyer le dashboard des instances mortes en permanence, pas pour
  // supprimer une copie active par erreur.
  const deleteBtn = !online
    ? `<button class="delete-btn" type="button" data-id="${escapeHtml(inst.instanceId)}" aria-label="Supprimer l’instance ${escapeHtml(inst.instanceId)}" title="Supprimer définitivement cette instance">🗑️</button>`
    : '';

  // appliedConfigVersion vaut null tant que le bot n'a JAMAIS envoyé cet
  // accusé de réception : c'est une copie pas encore mise à jour vers une
  // version qui gère la configuration poussée (RodrickBOT 1.82.0+). Lui
  // pousser un préfixe resterait "en attente" indéfiniment, donc bouton
  // désactivé avec l'explication plutôt qu'une promesse trompeuse.
  const canPushConfig = inst.appliedConfigVersion != null;
  const prefixBtn = `<button class="prefix-btn" type="button" aria-label="Changer le préfixe de ${escapeHtml(inst.instanceId)}" data-id="${escapeHtml(inst.instanceId)}" data-prefix="${escapeHtml(inst.prefix)}" ${canPushConfig ? '' : 'disabled'} title="${canPushConfig ? 'Changer le préfixe à distance' : 'Cette copie doit d\'abord être mise à jour (RodrickBOT 1.82.0 ou plus)'}">✏️</button>`;
  const pendingPrefix = pendingRemotePrefix(inst);

  return `
    <article class="instance-card ${enabled ? '' : 'disabled-card'}">
      <div class="top">
        <div>
          <div class="owner">${escapeHtml(inst.ownerName)}</div>
          <div class="instance-id">${escapeHtml(inst.instanceId)}</div>
        </div>
        <div class="instance-status">
          <span class="badge ${online ? 'online' : 'offline'}"><span class="status-dot" aria-hidden="true"></span>${online ? 'En ligne' : 'Hors ligne'}</span>
          ${enabled ? '' : '<span class="badge disabled-badge">Désactivée</span>'}
        </div>
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
        <button class="toggle-btn ${enabled ? 'is-on' : 'is-off'}" type="button" data-id="${escapeHtml(inst.instanceId)}" data-enabled="${enabled}">
          ${enabled ? 'Désactiver cette instance' : 'Réactiver cette instance'}
        </button>
        ${deleteBtn}
      </div>
    </article>
  `;
}

function renderSummary() {
  const onlineCount = allInstances.filter((instance) => instance.online === true).length;
  const disabledCount = allInstances.filter((instance) => instance.enabled === false).length;
  const offlineCount = allInstances.length - onlineCount;

  summary.innerHTML = `
    <div class="stat" data-tone="total"><div class="value">${allInstances.length}</div><div class="label">Instances</div></div>
    <div class="stat" data-tone="online"><div class="value">${onlineCount}</div><div class="label">En ligne</div></div>
    <div class="stat" data-tone="offline"><div class="value">${offlineCount}</div><div class="label">Hors ligne</div></div>
    <div class="stat" data-tone="disabled"><div class="value">${disabledCount}</div><div class="label">Désactivées</div></div>
  `;
}

function updateFilterButtons() {
  filterBar.querySelectorAll('[data-filter]').forEach((button) => {
    const active = button.dataset.filter === activeFilter;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function renderInstances() {
  const visible = filterInstances(allInstances, {
    query: searchInput.value,
    status: activeFilter,
  });

  resultCountEl.textContent = `${visible.length} sur ${allInstances.length} instance${allInstances.length === 1 ? '' : 's'}`;
  emptyEl.hidden = allInstances.length > 0;
  noResultsEl.hidden = allInstances.length === 0 || visible.length > 0;
  grid.innerHTML = visible.map(instanceCardHtml).join('');
}

async function refresh(showSuccess = false) {
  const key = apiKey();
  errorEl.style.display = 'none';
  errorEl.textContent = '';

  try {
    const res = await fetch('/api/instances', { headers: { 'x-api-key': key } });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      errorEl.textContent = data.error || `Erreur serveur (${res.status})`;
      errorEl.style.display = 'block';
      grid.innerHTML = '';
      summary.innerHTML = '';
      toolbar.hidden = true;
      emptyEl.hidden = true;
      noResultsEl.hidden = true;
      showFeedback(errorEl.textContent, true);
      return;
    }

    const { instances } = await res.json();
    allInstances = Array.isArray(instances) ? instances : [];
    toolbar.hidden = false;
    renderSummary();
    renderInstances();
    if (showSuccess) showFeedback('Connexion réussie : tes instances sont chargées.');
  } catch (err) {
    errorEl.textContent = 'Impossible de contacter le serveur.';
    errorEl.style.display = 'block';
    showFeedback('La connexion au dashboard a échoué. Vérifie le réseau et la clé API.', true);
  }
}

async function toggleInstance(instanceId, enabled, button) {
  const key = apiKey();
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = 'Mise à jour…';
  try {
    const res = await fetch(`/api/instances/${encodeURIComponent(instanceId)}/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key },
      body: JSON.stringify({ enabled }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showFeedback(data.error || 'Impossible de changer le statut. Vérifie la clé API.', true);
      return;
    }
    showFeedback(enabled ? 'Instance réactivée.' : 'Instance désactivée.');
    await refresh();
  } catch {
    showFeedback('Impossible de contacter le serveur pour modifier cette instance.', true);
  } finally {
    if (button.isConnected) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}

// Un prompt() natif plutôt qu'un <input> dans la carte : refresh() reconstruit
// toute la grille (grid.innerHTML) à CHAQUE heartbeat de n'importe quelle
// instance — un champ de saisie intégré à la carte serait vidé en pleine
// frappe. prompt() vit hors du DOM de la grille, et reste cohérent avec les
// confirm() déjà utilisé ici.
async function changeRemotePrefix(instanceId, currentPrefix) {
  const answer = prompt(
    `Nouveau préfixe pour "${instanceId}" (actuel : "${currentPrefix}").\n` +
    `1 à 5 caractères, sans espace.\n\n` +
    `Il sera appliqué au prochain contact du bot (jusqu'à 5 min, ou à son retour s'il est hors ligne).`,
    currentPrefix
  );
  if (answer === null) return; // annulé

  const prefix = answer.trim();
  if (!isValidPrefix(prefix)) { showFeedback('Préfixe invalide : 1 à 5 caractères, sans espace.', true); return; }
  if (prefix === currentPrefix) { showFeedback('C’est déjà le préfixe actuel de cette copie.'); return; }

  const key = apiKey();
  try {
    const res = await fetch(`/api/instances/${encodeURIComponent(instanceId)}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key },
      body: JSON.stringify({ prefix }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showFeedback(data.error || 'Impossible de changer le préfixe. Vérifie la clé API.', true);
      return;
    }
    showFeedback(`Préfixe « ${prefix} » envoyé. Il sera appliqué au prochain contact du bot.`);
    await refresh();
  } catch { showFeedback('Impossible de contacter le serveur pour changer le préfixe.', true); }
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
    if (!res.ok) { showFeedback('Impossible de supprimer cette instance. Vérifie la clé API.', true); return; }
    showFeedback('Instance supprimée du tableau de bord.');
    await refresh();
  } catch { showFeedback('Impossible de contacter le serveur pour supprimer cette instance.', true); }
}

searchInput.addEventListener('input', renderInstances);
filterBar.addEventListener('click', (event) => {
  const button = event.target.closest('[data-filter]');
  if (!button) return;
  activeFilter = button.dataset.filter;
  updateFilterButtons();
  renderInstances();
});

grid.addEventListener('click', (event) => {
  const toggleButton = event.target.closest('.toggle-btn');
  if (toggleButton) {
    toggleInstance(toggleButton.dataset.id, toggleButton.dataset.enabled !== 'true', toggleButton);
    return;
  }

  const deleteButton = event.target.closest('.delete-btn');
  if (deleteButton) {
    deleteInstance(deleteButton.dataset.id);
    return;
  }

  const prefixButton = event.target.closest('.prefix-btn');
  if (prefixButton) changeRemotePrefix(prefixButton.dataset.id, prefixButton.dataset.prefix);
});

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
