const listEl = document.getElementById('commandsList');
const emptyEl = document.getElementById('empty');
const errorEl = document.getElementById('error');
const searchInput = document.getElementById('searchInput');
const pillsEl = document.getElementById('categoryPills');

let allCommands = [];
let activeCategory = 'Toutes';

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function commandCardHtml(cmd) {
  const aliases = cmd.aliases.length
    ? `<span class="muted-small">Alias : ${cmd.aliases.map((a) => `!${escapeHtml(a)}`).join(', ')}</span>`
    : '';

  return `
    <div class="command-card">
      <div class="command-top">
        <div class="command-name">!${escapeHtml(cmd.name)}</div>
        <div class="command-tags">
          <span class="category-tag">${escapeHtml(cmd.category)}</span>
          ${cmd.adminOnly ? '<span class="admin-tag">🔒 Admin</span>' : ''}
        </div>
      </div>
      <div class="command-description">${escapeHtml(cmd.description)}</div>
      ${cmd.syntax ? `<div class="command-syntax">${escapeHtml(cmd.syntax)}</div>` : ''}
      ${aliases}
    </div>
  `;
}

/**
 * Recalcule la liste affichée à partir des deux filtres actifs (texte
 * recherché + catégorie sélectionnée). C'est le coeur du "filtrage côté
 * client" : on ne redemande rien au serveur, on retravaille juste le
 * tableau `allCommands` déjà en mémoire.
 */
function applyFilters() {
  const query = searchInput.value.trim().toLowerCase();

  const filtered = allCommands.filter((cmd) => {
    const matchesCategory = activeCategory === 'Toutes' || cmd.category === activeCategory;
    const matchesQuery =
      !query ||
      cmd.name.toLowerCase().includes(query) ||
      cmd.description.toLowerCase().includes(query) ||
      cmd.aliases.some((a) => a.toLowerCase().includes(query));
    return matchesCategory && matchesQuery;
  });

  emptyEl.style.display = filtered.length ? 'none' : 'block';
  listEl.innerHTML = filtered.map(commandCardHtml).join('');
}

function renderCategoryPills() {
  const categories = ['Toutes', ...new Set(allCommands.map((c) => c.category))].sort();

  pillsEl.innerHTML = categories
    .map((cat) => `<button class="pill ${cat === activeCategory ? 'active' : ''}" data-category="${escapeHtml(cat)}">${escapeHtml(cat)}</button>`)
    .join('');

  pillsEl.querySelectorAll('.pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeCategory = btn.dataset.category;
      renderCategoryPills(); // pour mettre à jour laquelle a la classe "active"
      applyFilters();
    });
  });
}

async function load() {
  try {
    const res = await fetch('/api/commands');
    if (!res.ok) {
      errorEl.textContent = `Erreur serveur (${res.status})`;
      errorEl.style.display = 'block';
      return;
    }
    const { commands } = await res.json();
    allCommands = commands;
    renderCategoryPills();
    applyFilters();
  } catch {
    errorEl.textContent = 'Impossible de contacter le serveur.';
    errorEl.style.display = 'block';
  }
}

searchInput.addEventListener('input', applyFilters);

load();
