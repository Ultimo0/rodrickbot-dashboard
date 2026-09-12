/**
 * Le choix de thème est appliqué en DEUX temps, volontairement :
 *
 * 1. Un petit script séparé, dans le <head> de chaque page (voir le haut
 *    de chaque fichier .html), applique le thème sauvegardé AVANT même
 *    que le CSS ne s'affiche — sinon on verrait le thème par défaut
 *    pendant une fraction de seconde avant que celui-ci ne s'applique
 *    ("flash" désagréable à chaque changement de page).
 *
 * 2. CE script (chargé normalement, à la fin de la page) s'occupe juste
 *    de faire fonctionner le SÉLECTEUR — synchroniser sa valeur affichée,
 *    et réagir quand quelqu'un en choisit un autre.
 */
const THEME_KEY = 'rodrick_hub_theme';

const picker = document.getElementById('themeSwitcher');
if (picker) {
  picker.value = localStorage.getItem(THEME_KEY) || 'classique';

  picker.addEventListener('change', () => {
    localStorage.setItem(THEME_KEY, picker.value);
    document.documentElement.setAttribute('data-theme', picker.value);
  });
}
