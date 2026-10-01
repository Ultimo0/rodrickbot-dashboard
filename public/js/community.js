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
let currentUser = null;
let openPostId = null;
let commentsCursor = null;
let loadingOlderComments = false;

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

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
      <div class="post-meta">
        ${escapeHtml(post.authorName)} · ${new Date(post.createdAt).toLocaleDateString('fr-FR')}
        ${post.commentCount ? `<span class="post-meta-stat">💬 ${post.commentCount}</span>` : ''}
        ${post.reactionCount ? `<span class="post-meta-stat">❤️ ${post.reactionCount}</span>` : ''}
      </div>
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

  openPostId = id;

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

  document.getElementById('commentForm').style.display = currentUser ? 'flex' : 'none';
  document.getElementById('commentLoginHint').style.display = currentUser ? 'none' : 'block';
  document.getElementById('commentsError').style.display = 'none';

  loadReactions(id);
  loadComments(id);

  listEl.style.display = 'none';
  pillsEl.style.display = 'none';
  readerEl.style.display = 'block';
}

document.getElementById('readerClose').addEventListener('click', () => {
  readerEl.style.display = 'none';
  listEl.style.display = '';
  pillsEl.style.display = '';
  openPostId = null;
});

// --- Réactions --------------------------------------------------------

function reactionsBarHtml(summary) {
  return REACTION_EMOJIS.map((emoji) => {
    const count = summary.counts[emoji] || 0;
    const active = summary.myReaction === emoji ? ' active' : '';
    return `<button class="reaction-pill${active}" data-emoji="${emoji}">${emoji}${count ? ` <span class="reaction-count">${count}</span>` : ''}</button>`;
  }).join('');
}

async function loadReactions(postId) {
  const bar = document.getElementById('reactionsBar');
  try {
    const res = await fetch(`/api/posts/${postId}/reactions`);
    if (!res.ok) return;
    const summary = await res.json();
    if (openPostId !== postId) return;
    bar.innerHTML = reactionsBarHtml(summary);
    bar.querySelectorAll('.reaction-pill').forEach((btn) => {
      btn.addEventListener('click', () => toggleReaction(postId, btn.dataset.emoji));
    });
  } catch {
    bar.innerHTML = '';
  }
}

async function toggleReaction(postId, emoji) {
  if (!currentUser) {
    window.location.href = 'login.html';
    return;
  }
  try {
    const res = await fetch(`/api/posts/${postId}/reactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji }),
    });
    if (!res.ok) return;
    const summary = await res.json();
    if (openPostId !== postId) return;
    const bar = document.getElementById('reactionsBar');
    bar.innerHTML = reactionsBarHtml(summary);
    bar.querySelectorAll('.reaction-pill').forEach((btn) => {
      btn.addEventListener('click', () => toggleReaction(postId, btn.dataset.emoji));
    });
  } catch {
    // Silencieux : une réaction ratée n'a pas besoin d'interrompre la lecture.
  }
}

// --- Commentaires -------------------------------------------------------

function commentHtml(comment) {
  const canDelete = currentUser && (currentUser.id === comment.authorId || currentUser.role === 'admin');
  const avatarHtml = comment.authorAvatarUrl
    ? `<img src="${escapeHtml(comment.authorAvatarUrl)}" alt="" class="comment-avatar" />`
    : `<span class="comment-avatar comment-avatar-fallback">${escapeHtml((comment.authorName || '?').charAt(0).toUpperCase())}</span>`;

  return `
    <div class="comment" data-id="${comment.id}">
      ${avatarHtml}
      <div class="comment-body">
        <div class="comment-head">
          <span class="comment-author">${escapeHtml(comment.authorName)}</span>
          <span class="comment-date">${new Date(comment.createdAt).toLocaleDateString('fr-FR')}</span>
          ${canDelete ? '<button class="comment-delete" title="Supprimer">✕</button>' : ''}
        </div>
        <div class="comment-content">${escapeHtml(comment.content)}</div>
      </div>
    </div>
  `;
}

async function loadComments(postId) {
  const listEl = document.getElementById('commentsList');
  const countEl = document.getElementById('commentsCount');
  const olderButton = document.getElementById('loadOlderComments');
  try {
    const res = await fetch(`/api/posts/${postId}/comments?limit=50`);
    if (!res.ok) return;
    const { comments, totalCount, hasMore, nextCursor } = await res.json();
    if (openPostId !== postId) return;

    commentsCursor = nextCursor;
    countEl.textContent = totalCount ? `(${totalCount})` : '';
    olderButton.style.display = hasMore ? 'block' : 'none';
    listEl.innerHTML = comments.length
      ? comments.map(commentHtml).join('')
      : '<div class="comments-empty">Aucun commentaire pour le moment.</div>';
  } catch {
    // Un fil de commentaires qui ne charge pas ne doit pas casser le reste du lecteur.
  }
}

async function loadOlderComments() {
  if (!openPostId || !commentsCursor || loadingOlderComments) return;
  loadingOlderComments = true;
  const postId = openPostId;
  const button = document.getElementById('loadOlderComments');
  button.disabled = true;
  try {
    const res = await fetch(`/api/posts/${postId}/comments?limit=50&before=${commentsCursor}`);
    if (!res.ok) return;
    const { comments, hasMore, nextCursor } = await res.json();
    if (openPostId !== postId) return;
    const listEl = document.getElementById('commentsList');
    if (comments.length) {
      listEl.insertAdjacentHTML('afterbegin', comments.map(commentHtml).join(''));
      commentsCursor = nextCursor;
    }
    button.style.display = hasMore ? 'block' : 'none';
  } catch {
    // L'utilisateur peut réessayer.
  } finally {
    loadingOlderComments = false;
    button.disabled = false;
  }
}

document.getElementById('loadOlderComments').addEventListener('click', loadOlderComments);

async function removeComment(postId, commentId) {
  if (!confirm('Supprimer ce commentaire ?')) return;
  try {
    const res = await fetch(`/api/posts/${postId}/comments/${commentId}`, { method: 'DELETE' });
    if (res.ok) loadComments(postId);
  } catch {
    // Ignoré : l'utilisateur peut réessayer.
  }
}

document.getElementById('commentsList').addEventListener('click', (event) => {
  const button = event.target.closest('.comment-delete');
  if (!button || !openPostId) return;
  const commentId = Number(button.closest('.comment').dataset.id);
  removeComment(openPostId, commentId);
});

document.getElementById('commentForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!openPostId) return;

  const input = document.getElementById('commentInput');
  const content = input.value.trim();
  const errorEl2 = document.getElementById('commentsError');
  errorEl2.style.display = 'none';
  if (!content) return;

  try {
    const res = await fetch(`/api/posts/${openPostId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    const data = await res.json();
    if (!res.ok) {
      errorEl2.textContent = data.error || 'Erreur lors de la publication du commentaire.';
      errorEl2.style.display = 'block';
      return;
    }
    input.value = '';
    loadComments(openPostId);
  } catch {
    errorEl2.textContent = 'Impossible de contacter le serveur.';
    errorEl2.style.display = 'block';
  }
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

// Nécessaire pour savoir si on affiche le formulaire de commentaire et
// les boutons de suppression (auteur/admin) — pas de session, pas de rôle.
async function loadCurrentUser() {
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) currentUser = await res.json();
  } catch {
    currentUser = null;
  }
}

load();
loadCurrentUser();

// Notification plutôt que rafraîchissement silencieux : quelqu'un en
// train de lire ne doit pas voir la liste bouger sous ses yeux sans
// prévenir — on lui laisse le choix de rafraîchir.
window.addEventListener('hub-realtime', (e) => {
  if (e.detail.type === 'new-post') {
    const banner = document.getElementById('notifBanner');
    banner.textContent = `🔔 Nouvelle publication : "${e.detail.post.title}" — cliquer pour actualiser`;
    banner.style.display = 'block';
    banner.onclick = () => {
      banner.style.display = 'none';
      load();
    };
    return;
  }

  // Commentaires/réactions : seul le post actuellement ouvert dans le
  // lecteur nous intéresse — pas de bannière, juste un recalcul discret
  // pendant que la personne lit, comme un fil de discussion qui vit.
  if (!openPostId) return;
  if ((e.detail.type === 'new-comment' || e.detail.type === 'delete-comment') && e.detail.postId === openPostId) {
    loadComments(openPostId);
  }
  if (e.detail.type === 'post-reaction' && e.detail.postId === openPostId) {
    loadReactions(openPostId);
  }
});
