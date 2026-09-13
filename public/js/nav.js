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
});
