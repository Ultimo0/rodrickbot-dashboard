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

// Icônes en SVG "trait" (stroke), dans l'esprit Feather/Lucide, dessinées
// à la main plutôt qu'importées d'une bibliothèque — juste 5 icônes,
// inutile d'ajouter une dépendance externe pour ça. stroke="currentColor"
// est la partie importante : l'icône hérite automatiquement de la couleur
// CSS de son lien parent (.hub-tabbar-icon), donc elle s'adapte toute
// seule aux 4 thèmes ET à l'état actif, sans variante à maintenir.
const ICONS = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10"/></svg>',
  rocket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5c2.3 2 3.8 5.3 3.8 8.7 0 1.9-.5 3.7-1.2 5L12 19l-2.6-2.8c-.7-1.3-1.2-3.1-1.2-5 0-3.4 1.5-6.7 3.8-8.7z"/><path d="M9.3 15.3 7 17.6l-.8 2.7 2.7-.8 2.3-2.3"/><circle cx="12" cy="10.2" r="1.4"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.4-2.5 1a7.5 7.5 0 0 0-1.7-1L15 3h-4l-.3 2.6a7.5 7.5 0 0 0-1.7 1l-2.5-1-2 3.4L6.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.4 2.5-1c.5.4 1.1.8 1.7 1L11 21h4l.3-2.6c.6-.2 1.2-.6 1.7-1l2.5 1 2-3.4z"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="20" x2="5" y2="12"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="19" y1="20" x2="19" y2="15"/></svg>',
};

const PAGES = [
  { href: 'index.html', label: 'Dashboard', icon: ICONS.home },
  { href: 'releases.html', label: 'Versions', icon: ICONS.rocket },
  { href: 'commands.html', label: 'Commandes', icon: ICONS.gear },
  { href: 'community.html', label: 'Communauté', icon: ICONS.chat },
  { href: 'stats.html', label: 'Statistiques', icon: ICONS.chart },
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
