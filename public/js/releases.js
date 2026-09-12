const STORAGE_KEY = 'rodrick_hub_api_key';

const listEl = document.getElementById('releasesList');
const emptyEl = document.getElementById('empty');
const errorEl = document.getElementById('error');
const bannerEl = document.getElementById('latestBanner');
const apiKeyInput = document.getElementById('apiKeyInput');
const publishForm = document.getElementById('publishForm');
const publishErrorEl = document.getElementById('publishError');

apiKeyInput.value = localStorage.getItem(STORAGE_KEY) || '';

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

  return `
    <div class="release-card ${isLatest ? 'is-latest' : ''}">
      <div class="release-top">
        <div class="release-version">v${escapeHtml(release.version)} ${isLatest ? '<span class="badge-latest">Dernière</span>' : ''}</div>
        <div class="release-date">${escapeHtml(release.date)}</div>
      </div>
      ${changelogHtml(release.changelog)}
      <div class="release-actions">${downloadBtn}</div>
    </div>
  `;
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

    emptyEl.style.display = releases.length ? 'none' : 'block';

    bannerEl.innerHTML = releases.length
      ? `<div class="latest-banner">🚀 Dernière version : <strong>v${escapeHtml(releases[0].version)}</strong></div>`
      : '';

    listEl.innerHTML = releases.map((r, i) => releaseCardHtml(r, i === 0)).join('');
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

refresh();
