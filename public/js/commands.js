import {
  FAVORITES_FILTER,
  filterCommands,
  formatCommandUsage,
} from './ui-utils.js';

const listEl = document.getElementById('commandsList');
const emptyEl = document.getElementById('empty');
const errorEl = document.getElementById('error');
const feedbackEl = document.getElementById('commandFeedback');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearch');
const countEl = document.getElementById('commandCount');
const pillsEl = document.getElementById('categoryPills');
const FAVORITES_KEY = 'rodrick_hub_command_favorites';

let allCommands = [];
let activeCategory = 'Toutes';
let feedbackTimer;

function readFavorites() {
  try {
    const value = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
    return new Set(Array.isArray(value) ? value.filter((name) => typeof name === 'string') : []);
  } catch {
    return new Set();
  }
}

const favorites = readFavorites();

function saveFavorites() {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites]));
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function showFeedback(message, isError = false) {
  clearTimeout(feedbackTimer);
  feedbackEl.textContent = message;
  feedbackEl.classList.toggle('is-error', isError);
  feedbackEl.hidden = false;
  feedbackTimer = setTimeout(() => { feedbackEl.hidden = true; }, 3500);
}

function commandCardHtml(cmd) {
  const aliases = Array.isArray(cmd.aliases) ? cmd.aliases : [];
  const aliasesHtml = aliases.length
    ? `<span class="muted-small command-aliases">Alias : ${aliases.map((alias) => `!${escapeHtml(alias)}`).join(', ')}</span>`
    : '';
  const usage = formatCommandUsage(cmd);
  const isFavorite = favorites.has(cmd.name);

  return `
    <article class="command-card">
      <div class="command-top">
        <div class="command-name">!${escapeHtml(cmd.name)}</div>
        <div class="command-card-actions">
          <div class="command-tags">
            <span class="category-tag">${escapeHtml(cmd.category)}</span>
            ${cmd.adminOnly ? '<span class="admin-tag">Admin</span>' : ''}
          </div>
          <button class="favorite-btn ${isFavorite ? 'is-favorite' : ''}" type="button"
            data-action="favorite" data-name="${escapeHtml(cmd.name)}"
            aria-label="${isFavorite ? 'Retirer' : 'Ajouter'} ${escapeHtml(cmd.name)} ${isFavorite ? 'des' : 'aux'} favoris"
            aria-pressed="${isFavorite}">${isFavorite ? '★' : '☆'}</button>
        </div>
      </div>
      <div class="command-description">${escapeHtml(cmd.description)}</div>
      <div class="command-usage-row">
        <code class="command-syntax">${escapeHtml(usage)}</code>
        <button class="copy-usage-btn" type="button" data-action="copy" data-usage="${escapeHtml(usage)}"
          aria-label="Copier l’usage de ${escapeHtml(cmd.name)}">Copier</button>
      </div>
      ${aliasesHtml}
    </article>
  `;
}

function applyFilters() {
  const filtered = filterCommands(allCommands, {
    query: searchInput.value,
    category: activeCategory,
    favorites,
  });

  countEl.textContent = `${filtered.length} commande${filtered.length === 1 ? '' : 's'}`;
  emptyEl.hidden = filtered.length > 0;
  listEl.innerHTML = filtered.map(commandCardHtml).join('');
  clearSearchBtn.hidden = searchInput.value.length === 0;
}

function renderCategoryPills() {
  const categories = [...new Set(allCommands.map((command) => command.category).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'fr'));
  const filters = [
    { value: 'Toutes', label: `Toutes <span>${allCommands.length}</span>` },
    { value: FAVORITES_FILTER, label: `☆ Favoris <span>${favorites.size}</span>` },
    ...categories.map((category) => ({ value: category, label: escapeHtml(category) })),
  ];

  pillsEl.innerHTML = filters.map(({ value, label }) => `
    <button class="pill ${value === activeCategory ? 'active' : ''}" type="button"
      data-category="${escapeHtml(value)}" aria-pressed="${value === activeCategory}">${label}</button>
  `).join('');
}

async function copyUsage(value) {
  try {
    await navigator.clipboard.writeText(value);
    showFeedback('Usage copié. Tu peux le coller dans WhatsApp.');
  } catch {
    showFeedback('Copie impossible sur cet appareil. Sélectionne l’usage et copie-le manuellement.', true);
  }
}

async function load() {
  try {
    const res = await fetch('/api/commands');
    if (!res.ok) {
      errorEl.textContent = `Impossible de charger le catalogue (erreur ${res.status}).`;
      errorEl.style.display = 'block';
      return;
    }
    const data = await res.json();
    allCommands = Array.isArray(data.commands) ? data.commands : [];
    renderCategoryPills();
    applyFilters();
  } catch {
    errorEl.textContent = 'Impossible de contacter le serveur pour charger les commandes.';
    errorEl.style.display = 'block';
  }
}

searchInput.addEventListener('input', applyFilters);
clearSearchBtn.addEventListener('click', () => {
  searchInput.value = '';
  searchInput.focus();
  applyFilters();
});

pillsEl.addEventListener('click', (event) => {
  const button = event.target.closest('[data-category]');
  if (!button) return;
  activeCategory = button.dataset.category;
  renderCategoryPills();
  applyFilters();
});

listEl.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;

  if (button.dataset.action === 'favorite') {
    if (favorites.has(button.dataset.name)) favorites.delete(button.dataset.name);
    else favorites.add(button.dataset.name);
    saveFavorites();
    renderCategoryPills();
    applyFilters();
  } else if (button.dataset.action === 'copy') {
    copyUsage(button.dataset.usage);
  }
});

load();
