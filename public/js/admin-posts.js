const listEl = document.getElementById('postsList');
const errorEl = document.getElementById('error');
const form = document.getElementById('postForm');
const formErrorEl = document.getElementById('formError');
const formPanelEl = document.getElementById('formPanel');
const formSummaryEl = document.getElementById('formSummary');
const submitBtn = document.getElementById('formSubmitBtn');
const cancelBtn = document.getElementById('formCancelBtn');

const CATEGORY_LABELS = {
  publication: 'Publication',
  annonce: 'Annonce',
  nouveaute: 'Nouveauté',
  guide: 'Guide',
};

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function postRowHtml(post) {
  return `
    <div class="admin-post-row">
      <div class="admin-post-main">
        <span class="category-tag">${CATEGORY_LABELS[post.category] || post.category}</span>
        <div class="post-title">${escapeHtml(post.title)}</div>
        <div class="user-email">${escapeHtml(post.authorName)} · ${new Date(post.createdAt).toLocaleDateString('fr-FR')}</div>
      </div>
      <div class="admin-post-actions">
        <button class="edit-btn" data-id="${post.id}">Modifier</button>
        <button class="delete-btn" data-id="${post.id}">Supprimer</button>
      </div>
    </div>
  `;
}

let allPosts = [];

async function loadPosts() {
  errorEl.style.display = 'none';
  try {
    const res = await fetch('/api/posts');
    if (!res.ok) {
      errorEl.textContent = `Erreur serveur (${res.status})`;
      errorEl.style.display = 'block';
      return;
    }
    const { posts } = await res.json();
    allPosts = posts;
    listEl.innerHTML = posts.map(postRowHtml).join('');
    attachRowHandlers();
  } catch {
    errorEl.textContent = 'Impossible de contacter le serveur.';
    errorEl.style.display = 'block';
  }
}

function attachRowHandlers() {
  listEl.querySelectorAll('.edit-btn').forEach((btn) => {
    btn.addEventListener('click', () => startEdit(Number(btn.dataset.id)));
  });
  listEl.querySelectorAll('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', () => removePost(Number(btn.dataset.id)));
  });
}

function startEdit(id) {
  const post = allPosts.find((p) => p.id === id);
  if (!post) return;

  document.getElementById('fId').value = post.id;
  document.getElementById('fTitle').value = post.title;
  document.getElementById('fCategory').value = post.category;
  document.getElementById('fContent').value = post.content;

  formSummaryEl.textContent = `✏️ Modifier : ${post.title}`;
  submitBtn.textContent = 'Enregistrer les modifications';
  cancelBtn.style.display = '';
  formPanelEl.open = true;
  formPanelEl.scrollIntoView({ behavior: 'smooth' });
}

function resetForm() {
  form.reset();
  document.getElementById('fId').value = '';
  formSummaryEl.textContent = '➕ Nouvelle publication';
  submitBtn.textContent = 'Publier';
  cancelBtn.style.display = 'none';
}

cancelBtn.addEventListener('click', resetForm);

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  formErrorEl.style.display = 'none';

  const id = document.getElementById('fId').value;
  const body = {
    title: document.getElementById('fTitle').value.trim(),
    category: document.getElementById('fCategory').value,
    content: document.getElementById('fContent').value.trim(),
  };

  try {
    const res = await fetch(id ? `/api/posts/${id}` : '/api/posts', {
      method: id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      formErrorEl.textContent = data.error || `Erreur serveur (${res.status})`;
      formErrorEl.style.display = 'block';
      return;
    }

    resetForm();
    loadPosts();
  } catch {
    formErrorEl.textContent = 'Impossible de contacter le serveur.';
    formErrorEl.style.display = 'block';
  }
});

async function removePost(id) {
  if (!confirm('Supprimer définitivement cette publication ?')) return;

  try {
    const res = await fetch(`/api/posts/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || `Erreur serveur (${res.status})`);
      return;
    }
    loadPosts();
  } catch {
    alert('Impossible de contacter le serveur.');
  }
}

window.addEventListener('admin-verified', loadPosts);
