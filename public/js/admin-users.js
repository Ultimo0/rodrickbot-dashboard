const listEl = document.getElementById('usersList');
const errorEl = document.getElementById('error');

let currentUserId = null;

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function avatarHtml(user) {
  if (user.avatarUrl) {
    return `<img src="${escapeHtml(user.avatarUrl)}" alt="" class="nav-avatar" />`;
  }
  const initial = (user.name || user.email || '?').charAt(0).toUpperCase();
  return `<span class="nav-avatar nav-avatar-fallback">${initial}</span>`;
}

function userRowHtml(user) {
  const isSelf = user.id === currentUserId;
  const nextRole = user.role === 'admin' ? 'user' : 'admin';
  const actionLabel = user.role === 'admin' ? 'Rétrograder en membre' : 'Promouvoir admin';

  return `
    <div class="user-row">
      <div class="user-main">
        ${avatarHtml(user)}
        <div>
          <div class="user-name">${escapeHtml(user.name || '(sans nom)')} ${isSelf ? '<span class="you-tag">toi</span>' : ''}</div>
          <div class="user-email">${escapeHtml(user.email)}</div>
        </div>
      </div>
      <span class="role-badge ${user.role === 'admin' ? 'role-admin' : ''}">${user.role === 'admin' ? 'Administrateur' : 'Membre'}</span>
      <button
        class="role-toggle-btn"
        data-id="${user.id}"
        data-next-role="${nextRole}"
        ${isSelf ? 'disabled title="Tu ne peux pas modifier ton propre rôle"' : ''}
      >${actionLabel}</button>
    </div>
  `;
}

async function loadUsers() {
  errorEl.style.display = 'none';

  try {
    const res = await fetch('/api/admin/users');
    if (!res.ok) {
      errorEl.textContent = `Erreur serveur (${res.status})`;
      errorEl.style.display = 'block';
      return;
    }
    const { users } = await res.json();
    listEl.innerHTML = users.map(userRowHtml).join('');
    attachToggleHandlers();
  } catch {
    errorEl.textContent = 'Impossible de contacter le serveur.';
    errorEl.style.display = 'block';
  }
}

function attachToggleHandlers() {
  listEl.querySelectorAll('.role-toggle-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const role = btn.dataset.nextRole;

      btn.disabled = true;
      try {
        const res = await fetch(`/api/admin/users/${id}/role`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          alert(data.error || `Erreur serveur (${res.status})`);
          btn.disabled = false;
          return;
        }

        loadUsers(); // recharge toute la liste pour refléter le changement
      } catch {
        alert('Impossible de contacter le serveur.');
        btn.disabled = false;
      }
    });
  });
}

// On attend la confirmation d'admin-guard.js (voir admin-guard.js) avant
// de charger quoi que ce soit — inutile de tenter une requête tant qu'on
// ne sait pas si la personne a le droit de voir cette page.
window.addEventListener('admin-verified', (e) => {
  currentUserId = e.detail.id;
  loadUsers();
});
