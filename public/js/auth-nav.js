/**
 * Ce fichier est inclus sur TOUTES les pages du Hub. Il regarde si la
 * personne est connectée (en demandant au serveur via /api/auth/me — le
 * cookie de session part automatiquement avec la requête, pas besoin de
 * le gérer nous-mêmes) et met à jour le petit bout de nav en conséquence.
 */

// Même fonction que dans community.js/admin-posts.js/admin-users.js —
// n'importe quelle valeur insérée dans du HTML via innerHTML doit passer
// par ici d'abord, y compris les propres nom/avatar de la personne
// connectée (elle pourrait les avoir mis à jour via /api/profile avec un
// contenu inhabituel, volontairement ou non).
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

(async function initAuthNav() {
  const el = document.getElementById('authStatus');
  if (!el) return;

  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      const user = await res.json();
      const adminLink = user.role === 'admin' ? '<a href="admin.html" class="admin-nav-link">🛠️ Admin</a>' : '';
      const displayName = escapeHtml(user.name || user.email);

      // Avatar miniature si la personne en a déjà défini une (voir
      // profile.html) — sinon un rond avec l'initiale du nom, plutôt
      // qu'une icône générique impersonnelle.
      const avatarHtml = user.avatarUrl
        ? `<img src="${escapeHtml(user.avatarUrl)}" alt="" class="nav-avatar" />`
        : `<span class="nav-avatar nav-avatar-fallback">${escapeHtml((user.name || user.email || '?').charAt(0).toUpperCase())}</span>`;

      el.innerHTML = `${adminLink}<a href="profile.html" class="nav-profile-link">${avatarHtml}${displayName}</a>`;
    } else {
      el.innerHTML = '<a href="login.html">Connexion</a>';
    }
  } catch {
    el.innerHTML = '<a href="login.html">Connexion</a>';
  }
})();
