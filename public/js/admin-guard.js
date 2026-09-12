/**
 * Inclus sur CHAQUE page du panel admin. Convention : chaque page doit
 * avoir un élément #adminContent (le contenu réservé) et #deniedBanner
 * (le message affiché si la personne n'est pas admin).
 *
 * Important à comprendre : cette vérification est seulement pour le
 * CONFORT visuel (cacher/afficher les bons éléments). La vraie sécurité
 * est côté SERVEUR (requireAdmin dans src/middleware/) — n'importe qui
 * pourrait modifier ce script dans son navigateur, mais ça ne lui
 * donnerait jamais accès aux vraies routes /api/admin/..., toujours
 * protégées côté serveur.
 */
(async function adminGuard() {
  const contentEl = document.getElementById('adminContent');
  const deniedEl = document.getElementById('deniedBanner');

  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) {
      deniedEl.style.display = 'block';
      deniedEl.innerHTML = '🚫 Connecte-toi pour accéder à cette page. <a href="login.html">Se connecter</a>';
      return;
    }

    const user = await res.json();
    if (user.role !== 'admin') {
      deniedEl.style.display = 'block';
      return;
    }

    if (contentEl) contentEl.style.display = '';
    window.dispatchEvent(new CustomEvent('admin-verified', { detail: user }));
  } catch {
    deniedEl.style.display = 'block';
    deniedEl.textContent = 'Impossible de contacter le serveur.';
  }
})();
