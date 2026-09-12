const listEl = document.getElementById('postsList');
const emptyEl = document.getElementById('empty');
const errorEl = document.getElementById('error');
const pillsEl = document.getElementById('categoryPills');
const readerEl = document.getElementById('reader');

const CATEGORY_LABELS = {
  publication: 'Publication',
  annonce: 'Annonce',
  nouveaute: 'Nouveauté',
  guide: 'Guide',
};

let allPosts = [];
let activeCategory = 'Toutes';

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function excerpt(content, length = 140) {
  const clean = content.replace(/\n+/g, ' ').trim();
  return clean.length > length ? clean.slice(0, length) + '…' : clean;
}

function postCardHtml(post) {
  return `
    <button class="post-card" data-id="${post.id}">
      <span class="category-tag">${CATEGORY_LABELS[post.category] || post.category}</span>
      <div class="post-title">${escapeHtml(post.title)}</div>
      <div class="post-excerpt">${escapeHtml(excerpt(post.content))}</div>
      <div class="post-meta">${escapeHtml(post.authorName)} · ${new Date(post.createdAt).toLocaleDateString('fr-FR')}</div>
    </button>
  `;
}

function applyFilter() {
  const filtered = activeCategory === 'Toutes' ? allPosts : allPosts.filter((p) => p.category === activeCategory);
  emptyEl.style.display = filtered.length ? 'none' : 'block';
  listEl.innerHTML = filtered.map(postCardHtml).join('');

  listEl.querySelectorAll('.post-card').forEach((card) => {
    card.addEventListener('click', () => openReader(Number(card.dataset.id)));
  });
}

function renderPills() {
  const categories = ['Toutes', ...Object.keys(CATEGORY_LABELS)];
  pillsEl.innerHTML = categories
    .map((cat) => `<button class="pill ${cat === activeCategory ? 'active' : ''}" data-category="${cat}">${cat === 'Toutes' ? 'Toutes' : CATEGORY_LABELS[cat]}</button>`)
    .join('');

  pillsEl.querySelectorAll('.pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeCategory = btn.dataset.category;
      renderPills();
      applyFilter();
    });
  });
}

function openReader(id) {
  const post = allPosts.find((p) => p.id === id);
  if (!post) return;

  document.getElementById('readerCategory').textContent = CATEGORY_LABELS[post.category] || post.category;
  document.getElementById('readerTitle').textContent = post.title;
  document.getElementById('readerMeta').textContent =
    `Par ${post.authorName} · ${new Date(post.createdAt).toLocaleDateString('fr-FR')}`;
  // Un simple retour à la ligne dans le texte devient un paragraphe séparé.
  document.getElementById('readerContent').innerHTML = post.content
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('');

  listEl.style.display = 'none';
  pillsEl.style.display = 'none';
  readerEl.style.display = 'block';
}

document.getElementById('readerClose').addEventListener('click', () => {
  readerEl.style.display = 'none';
  listEl.style.display = '';
  pillsEl.style.display = '';
});

async function load() {
  try {
    const res = await fetch('/api/posts');
    if (!res.ok) {
      errorEl.textContent = `Erreur serveur (${res.status})`;
      errorEl.style.display = 'block';
      return;
    }
    const { posts } = await res.json();
    allPosts = posts;
    renderPills();
    applyFilter();
  } catch {
    errorEl.textContent = 'Impossible de contacter le serveur.';
    errorEl.style.display = 'block';
  }
}

load();

// Notification plutôt que rafraîchissement silencieux : quelqu'un en
// train de lire ne doit pas voir la liste bouger sous ses yeux sans
// prévenir — on lui laisse le choix de rafraîchir.
window.addEventListener('hub-realtime', (e) => {
  if (e.detail.type !== 'new-post') return;

  const banner = document.getElementById('notifBanner');
  banner.textContent = `🔔 Nouvelle publication : "${e.detail.post.title}" — cliquer pour actualiser`;
  banner.style.display = 'block';
  banner.onclick = () => {
    banner.style.display = 'none';
    load();
  };
});
