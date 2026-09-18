const STORAGE_KEY = 'rodrick_hub_api_key';

const listEl = document.getElementById('releasesList');
const emptyEl = document.getElementById('empty');
const errorEl = document.getElementById('error');
const bannerEl = document.getElementById('latestBanner');
const apiKeyInput = document.getElementById('apiKeyInput');
const publishForm = document.getElementById('publishForm');
const publishErrorEl = document.getElementById('publishError');
const publishPanelEl = document.getElementById('publishPanel');
const bulkToolbarEl = document.getElementById('bulkToolbar');
const bulkCountEl = document.getElementById('bulkCount');
const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');

apiKeyInput.value = localStorage.getItem(STORAGE_KEY) || '';

// Rempli une fois au chargement (voir checkIsAdmin ci-dessous) — toutes
// les fonctions de rendu ci-dessous s'y réfèrent pour savoir si elles
// doivent afficher les commandes admin ou non.
let isAdmin = false;
let releasesCache = [];
const selectedIds = new Set();

function apiKey() {
  return localStorage.getItem(STORAGE_KEY) || '';
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// Le changelog est stocké comme un texte brut avec des retours à la
// ligne — on transforme chaque ligne en élément de liste pour un rendu
// plus lisible, sans avoir besoin d'un vrai éditeur de texte enrichi.
function changelogHtml(changelog) {
  const lines = (changelog || '').split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return '<div class="muted-small">Pas de détails pour cette version.</div>';
  return '<ul class="changelog-list">' + lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('') + '</ul>';
}

function releaseCardHtml(release, isLatest) {
  const downloadBtn = release.downloadUrl
    ? `<a class="btn-download" href="${escapeHtml(release.downloadUrl)}" download>⬇️ Télécharger</a>`
    : '<span class="muted-small">Aucun lien de téléchargement</span>';

  // Case à cocher + boutons "Modifier"/"Supprimer" uniquement pour un
  // admin — un visiteur normal ne voit que la carte "en lecture seule"
  // d'origine, rien n'est ajouté au DOM pour lui.
  const adminControls = isAdmin ? `
    <div class="release-admin-controls">
      <label class="release-checkbox">
        <input type="checkbox" class="release-select" data-id="${release.id}" ${selectedIds.has(release.id) ? 'checked' : ''} />
      </label>
      <button class="btn-edit-outline" data-edit-id="${release.id}" type="button">Modifier</button>
      <button class="btn-delete-outline" data-delete-id="${release.id}" type="button">Supprimer</button>
    </div>
  ` : '';

  return `
    <div class="release-card ${isLatest ? 'is-latest' : ''}" data-release-id="${release.id}">
      <div class="release-top">
        <div class="release-version">v${escapeHtml(release.version)} ${isLatest ? '<span class="badge-latest">Dernière</span>' : ''}</div>
        <div class="release-date">${escapeHtml(release.date)}</div>
      </div>
      ${changelogHtml(release.changelog)}
      <div class="release-actions">${downloadBtn}</div>
      ${adminControls}
    </div>
  `;
}

// Remplace la carte d'une version par un formulaire pré-rempli — pas de
// modale séparée, l'édition se fait "sur place", moins de contexte perdu
// pour la personne qui édite.
function releaseEditFormHtml(release) {
  return `
    <div class="release-card is-editing" data-release-id="${release.id}">
      <form class="release-edit-form">
        <input class="e-version" type="text" value="${escapeHtml(release.version)}" placeholder="Version" required />
        <input class="e-date" type="date" value="${escapeHtml(release.date)}" required />
        <textarea class="e-changelog" rows="4" placeholder="Changelog">${escapeHtml(release.changelog || '')}</textarea>
        <input class="e-downloadUrl" type="text" value="${escapeHtml(release.downloadUrl || '')}" placeholder="Lien de téléchargement" />
        <div class="release-edit-actions">
          <button type="submit">Enregistrer</button>
          <button type="button" class="btn-cancel-edit">Annuler</button>
        </div>
        <div class="edit-error"></div>
      </form>
    </div>
  `;
}

function renderList() {
  emptyEl.style.display = releasesCache.length ? 'none' : 'block';

  bannerEl.innerHTML = releasesCache.length
    ? `<div class="latest-banner">🚀 Dernière version : <strong>v${escapeHtml(releasesCache[0].version)}</strong></div>`
    : '';

  listEl.innerHTML = releasesCache.map((r, i) => releaseCardHtml(r, i === 0)).join('');
  updateBulkToolbar();
}

function updateBulkToolbar() {
  if (!isAdmin || selectedIds.size === 0) {
    bulkToolbarEl.style.display = 'none';
    return;
  }
  bulkToolbarEl.style.display = 'flex';
  bulkCountEl.textContent = `${selectedIds.size} sélectionnée${selectedIds.size > 1 ? 's' : ''}`;
}

async function refresh() {
  errorEl.style.display = 'none';

  try {
    const res = await fetch('/api/releases');
    if (!res.ok) {
      errorEl.textContent = `Erreur serveur (${res.status})`;
      errorEl.style.display = 'block';
      return;
    }

    const { releases } = await res.json();
    releasesCache = releases;
    selectedIds.clear();
    renderList();
  } catch {
    errorEl.textContent = 'Impossible de contacter le serveur.';
    errorEl.style.display = 'block';
  }
}

publishForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  publishErrorEl.style.display = 'none';

  const key = apiKeyInput.value.trim();
  localStorage.setItem(STORAGE_KEY, key); // mémorisé pour la prochaine visite

  const body = {
    version: document.getElementById('fVersion').value.trim(),
    date: document.getElementById('fDate').value,
    changelog: document.getElementById('fChangelog').value,
    downloadUrl: document.getElementById('fDownloadUrl').value.trim(),
  };

  try {
    const res = await fetch('/api/releases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      publishErrorEl.textContent = data.error || `Erreur serveur (${res.status})`;
      publishErrorEl.style.display = 'block';
      return;
    }

    publishForm.reset();
    refresh();
  } catch {
    publishErrorEl.textContent = 'Impossible de contacter le serveur.';
    publishErrorEl.style.display = 'block';
  }
});

/**
 * Un seul écouteur sur le conteneur plutôt qu'un par bouton : les cartes
 * sont recréées à chaque renderList()/refresh(), donc des écouteurs
 * attachés directement aux boutons individuels seraient perdus (et
 * jamais rattachés) à chaque nouveau rendu. La délégation d'événements
 * (écouter sur le parent stable, regarder QUEL enfant a été cliqué)
 * évite ce problème une fois pour toutes.
 */
listEl.addEventListener('click', async (e) => {
  const editBtn = e.target.closest('[data-edit-id]');
  const deleteBtn = e.target.closest('[data-delete-id]');
  const cancelBtn = e.target.closest('.btn-cancel-edit');

  if (editBtn) {
    const release = releasesCache.find((r) => r.id === Number(editBtn.dataset.editId));
    if (release) {
      e.target.closest('.release-card').outerHTML = releaseEditFormHtml(release);
    }
    return;
  }

  if (cancelBtn) {
    renderList(); // le plus simple pour annuler : tout redessiner depuis le cache, sans requête réseau
    return;
  }

  if (deleteBtn) {
    const id = Number(deleteBtn.dataset.deleteId);
    const release = releasesCache.find((r) => r.id === id);
    if (!release || !confirm(`Supprimer définitivement la version v${release.version} ? Cette action est irréversible.`)) return;

    try {
      const res = await fetch('/api/releases', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Échec de la suppression.');
      refresh();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = 'block';
    }
  }
});

// Cases à cocher : même logique de délégation, sur l'événement "change".
listEl.addEventListener('change', (e) => {
  const checkbox = e.target.closest('.release-select');
  if (!checkbox) return;

  const id = Number(checkbox.dataset.id);
  if (checkbox.checked) selectedIds.add(id);
  else selectedIds.delete(id);
  updateBulkToolbar();
});

// Soumission du formulaire d'édition "sur place" — lui aussi délégué,
// pour la même raison que les boutons ci-dessus (le formulaire est
// recréé à chaque édition, pas présent au chargement de la page).
listEl.addEventListener('submit', async (e) => {
  const form = e.target.closest('.release-edit-form');
  if (!form) return;
  e.preventDefault();

  const card = form.closest('.release-card');
  const id = Number(card.dataset.releaseId);
  const errorBox = form.querySelector('.edit-error');
  errorBox.style.display = 'none';

  const body = {
    version: form.querySelector('.e-version').value.trim(),
    date: form.querySelector('.e-date').value,
    changelog: form.querySelector('.e-changelog').value,
    downloadUrl: form.querySelector('.e-downloadUrl').value.trim(),
  };

  try {
    const res = await fetch(`/api/releases/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Échec de la mise à jour.');
    refresh();
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.style.display = 'block';
  }
});

bulkDeleteBtn.addEventListener('click', async () => {
  const ids = Array.from(selectedIds);
  if (!ids.length) return;
  if (!confirm(`Supprimer définitivement ${ids.length} version${ids.length > 1 ? 's' : ''} ? Cette action est irréversible.`)) return;

  try {
    const res = await fetch('/api/releases', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Échec de la suppression.');
    refresh();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
  }
});

async function checkIsAdmin() {
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      const user = await res.json();
      isAdmin = user.role === 'admin';
    }
  } catch {
    isAdmin = false;
  }
  if (isAdmin) publishPanelEl.style.display = 'block';
}

(async function init() {
  await checkIsAdmin();
  await refresh();
})();
