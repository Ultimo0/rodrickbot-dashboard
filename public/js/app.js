const STORAGE_KEY = 'rodrickbot_dashboard_api_key';
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

function instanceCardHtml(inst) {
  const enabled = inst.enabled !== false;
  // Le bouton 🗑️ n'apparaît que pour les copies hors ligne : pensé pour
  // nettoyer le dashboard des instances mortes en permanence, pas pour
  // supprimer une copie active par erreur.
  const deleteBtn = !inst.online
    ? `<button class="delete-btn" data-id="${escapeHtml(inst.instanceId)}" title="Supprimer définitivement cette instance">🗑️</button>`
    : '';

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
      <div class="info-row"><span class="k">Préfixe</span><span>${escapeHtml(inst.prefix)}</span></div>
      <div class="info-row"><span class="k">Uptime</span><span>${formatUptime(inst.uptimeSeconds)}</span></div>
      <div class="info-row"><span class="k">Messages traités</span><span>${inst.messageCount ?? '—'}</span></div>
      <div class="info-row"><span class="k">Dernier contact</span><span>${timeAgo(inst.lastSeen)}</span></div>
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
      errorEl.textContent = res.status === 401
        ? 'Clé API invalide — vérifie ta clé ci-dessus.'
        : `Erreur serveur (${res.status})`;
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

const summonBtn = document.getElementById('summonBtn');

async function summonAll() {
  const key = apiKey();
  if (!key) { alert('Renseigne d\'abord ta clé API ci-dessus.'); return; }

  const confirmed = confirm(
    'Envoyer "Je m\'incline devant votre sagesse, Seigneur." dans tous les groupes de toutes les copies en ligne ?'
  );
  if (!confirmed) return;

  summonBtn.disabled = true;
  const originalLabel = summonBtn.textContent;
  summonBtn.textContent = '🔥 Invocation en cours…';

  try {
    const res = await fetch('/api/summon', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      alert('Invocation impossible (clé API invalide ou erreur serveur).');
    } else {
      summonBtn.textContent = '✅ Invocation envoyée';
      setTimeout(() => { summonBtn.textContent = originalLabel; }, 3000);
    }
  } catch {
    alert('Impossible de contacter le serveur.');
  } finally {
    summonBtn.disabled = false;
    if (summonBtn.textContent === '🔥 Invocation en cours…') summonBtn.textContent = originalLabel;
  }
}

summonBtn.addEventListener('click', summonAll);

refresh();
setInterval(refresh, 10000);