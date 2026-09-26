/**
 * errors.js
 * ------------------------------------------------------------------
 * Logique de public/errors.html — même style que public/js/releases.js
 * (escapeHtml, fetch + rendu, gestion d'erreur inline) pour rester
 * cohérent avec le reste des pages du Hub.
 *
 * GET /api/error-reports est déjà protégée côté serveur (requireAuth +
 * requireAdmin, voir src/routes/errorReports.js) : un visiteur non-admin
 * qui charge cette page reçoit un 401/403 de l'API, jamais les données —
 * ce script ne fait qu'afficher un message clair dans ce cas, la
 * sécurité réelle vient du serveur, pas de ce contrôle côté client.
 * ------------------------------------------------------------------
 */

const listEl = document.getElementById('errorsList');
const emptyEl = document.getElementById('empty');
const errorEl = document.getElementById('error');
const notAdminEl = document.getElementById('notAdmin');

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function formatDate(timestampMs) {
  if (!timestampMs) return '?';
  return new Date(Number(timestampMs)).toLocaleString('fr-FR');
}

// La stack est repliée par défaut (accordéon <details>) — une liste de
// plusieurs dizaines d'erreurs reste lisible d'un coup d'œil, le détail
// technique n'est ouvert que sur demande.
function reportCardHtml(report) {
  return `
    <div class="release-card" data-report-id="${report.id}">
      <div class="release-top">
        <div class="release-version">${escapeHtml(report.errorMessage)}</div>
        <div class="release-date">${report.occurrenceCount}× — dernière: ${formatDate(report.lastSeenAt)}</div>
      </div>
      <div class="muted-small">
        Instance: <code>${escapeHtml(report.instanceId)}</code>
        — ${escapeHtml(report.botName || '?')} v${escapeHtml(report.version || '?')}
        — Node ${escapeHtml(report.nodeVersion || '?')}
        — première occurrence: ${formatDate(report.firstSeenAt)}
      </div>
      ${report.errorStack ? `
      <details>
        <summary>Stack trace</summary>
        <pre class="error-stack">${escapeHtml(report.errorStack)}</pre>
      </details>` : ''}
    </div>
  `;
}

async function refresh() {
  errorEl.style.display = 'none';
  notAdminEl.style.display = 'none';

  try {
    const res = await fetch('/api/error-reports');

    if (res.status === 401 || res.status === 403) {
      notAdminEl.style.display = 'block';
      listEl.innerHTML = '';
      emptyEl.style.display = 'none';
      return;
    }

    if (!res.ok) {
      errorEl.textContent = `Erreur serveur (${res.status})`;
      errorEl.style.display = 'block';
      return;
    }

    const { reports } = await res.json();
    emptyEl.style.display = reports.length ? 'none' : 'block';
    listEl.innerHTML = reports.map(reportCardHtml).join('');
  } catch {
    errorEl.textContent = 'Impossible de contacter le serveur.';
    errorEl.style.display = 'block';
  }
}

refresh();
