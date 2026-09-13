/**
 * nav.js
 * ------------------------------------------------------------------
 * Source UNIQUE de la liste des pages du Hub. Avant ce fichier, chacune
 * des 11 pages HTML recopiait à la main les mêmes 5 liens — et cette
 * duplication avait déjà dérivé : login.html, register.html et
 * profile.html n'avaient que 3 liens sur 5, sans qu'on s'en rende compte
 * en éditant une page à la fois.
 *
 * Ce fichier peuple DEUX zones à partir de la même liste :
 *   1. #hubNavLinks   — la barre du haut (desktop, et visible mais sans
 *                       les liens sur mobile, voir style.css)
 *   2. #hubTabBar      — la barre d'onglets fixée en bas, visible
 *                       UNIQUEMENT sur mobile (créée ici, pas dans le HTML,
 *                       pour ne pas alourdir chaque page d'un bloc de plus)
 *
 * Chaque page HTML n'a donc plus qu'un conteneur vide à tenir à jour
 * (aucun) — ajouter une page au Hub se fait en modifiant UNE seule fois
 * PAGES ci-dessous, plus jamais 11 fichiers séparés.
 *
 * Ce fichier gère aussi le balayage tactile (swipe) gauche/droite pour
 * changer de page — voir initSwipeNavigation() plus bas.
 */

const PAGES = [
  { href: 'index.html', label: 'Dashboard', icon: '🏠' },
  { href: 'releases.html', label: 'Versions', icon: '🚀' },
  { href: 'commands.html', label: 'Commandes', icon: '⚙️' },
  { href: 'community.html', label: 'Communauté', icon: '💬' },
  { href: 'stats.html', label: 'Statistiques', icon: '📊' },
];

function currentPage() {
  // "" (racine du site) doit compter comme index.html — sans ce cas
  // particulier, aucun onglet ne serait jamais marqué actif sur "/".
  const path = location.pathname.split('/').pop();
  return path === '' ? 'index.html' : path;
}

function renderTopNavLinks() {
  const container = document.getElementById('hubNavLinks');
  if (!container) return; // page qui n'a pas encore le conteneur (ne devrait pas arriver)

  const here = currentPage();
  container.innerHTML = PAGES.map(
    (p) => `<a href="${p.href}"${p.href === here ? ' class="active"' : ''}>${p.label}</a>`
  ).join('');
}

function renderBottomTabBar() {
  const here = currentPage();
  const tabBar = document.createElement('nav');
  tabBar.className = 'hub-tabbar';
  tabBar.id = 'hubTabBar';
  tabBar.setAttribute('aria-label', 'Navigation principale');

  tabBar.innerHTML = PAGES.map((p) => `
    <a href="${p.href}"${p.href === here ? ' class="active"' : ''}>
      <span class="hub-tabbar-icon" aria-hidden="true">${p.icon}</span>
      <span class="hub-tabbar-label">${p.label}</span>
    </a>
  `).join('');

  document.body.appendChild(tabBar);
}

document.addEventListener('DOMContentLoaded', () => {
  renderTopNavLinks();
  renderBottomTabBar();
  initSwipeNavigation();
});

/**
 * Balayer vers la gauche → page suivante, vers la droite → page
 * précédente, dans l'ordre de PAGES (celui de la barre d'onglets).
 * Convention identique à un carrousel de photos : swiper à gauche fait
 * "avancer" (comme si le contenu suivant arrivait par la droite).
 *
 * Ce site n'est pas une SPA (chaque page est un vrai fichier HTML
 * séparé) — un swipe déclenche donc une vraie navigation
 * (location.href), exactement comme un tap sur l'onglet correspondant.
 */
function initSwipeNavigation() {
  const here = currentPage();
  const currentIndex = PAGES.findIndex((p) => p.href === here);
  // Page hors de la liste (ex: admin.html, login.html) : pas de
  // "suivant/précédent" qui aurait un sens, on ne branche rien.
  if (currentIndex === -1) return;

  const MIN_DISTANCE = 70; // px — en dessous, on considère que ce n'est pas un vrai swipe volontaire
  let startX = 0;
  let startY = 0;
  let ignoreThisTouch = false;

  // Un élément a déjà son propre défilement horizontal (ex: le graphique
  // en barres de stats.html) — dans ce cas, on laisse ce défilement
  // natif se produire plutôt que de lui voler le geste pour changer de
  // page. On vérifie l'élément touché ET ses parents, jusqu'à <body>.
  function startsInsideHorizontalScroller(target) {
    let el = target;
    while (el && el !== document.body) {
      if (el.scrollWidth > el.clientWidth + 1) return true;
      el = el.parentElement;
    }
    return false;
  }

  document.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    ignoreThisTouch = startsInsideHorizontalScroller(e.target);
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (ignoreThisTouch) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;

    // Un vrai swipe de navigation doit être largement plus horizontal
    // que vertical — sinon c'est un scroll de page vertical normal, pas
    // une intention de changer d'onglet.
    if (Math.abs(deltaX) < MIN_DISTANCE || Math.abs(deltaX) < Math.abs(deltaY)) return;

    const nextIndex = deltaX < 0 ? currentIndex + 1 : currentIndex - 1;
    if (nextIndex < 0 || nextIndex >= PAGES.length) return; // déjà au premier/dernier onglet

    location.href = PAGES[nextIndex].href;
  }, { passive: true });
}
