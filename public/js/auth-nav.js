/**
 * Ce fichier est inclus sur TOUTES les pages du Hub. Il regarde si la
 * personne est connectée (en demandant au serveur via /api/auth/me — le
 * cookie de session part automatiquement avec la requête, pas besoin de
 * le gérer nous-mêmes) et met à jour le petit bout de nav en conséquence.
 */
(async function initAuthNav() {
  const el = document.getElementById('authStatus');
  if (!el) return;

  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      const user = await res.json();
      const adminLink = user.role === 'admin' ? '<a href="admin.html" class="admin-nav-link">🛠️ Admin</a>' : '';
      el.innerHTML = `${adminLink}<a href="profile.html">👤 ${user.name || user.email}</a>`;
    } else {
      el.innerHTML = '<a href="login.html">Connexion</a>';
    }
  } catch {
    el.innerHTML = '<a href="login.html">Connexion</a>';
  }
})();
