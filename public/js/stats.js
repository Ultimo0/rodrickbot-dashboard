const errorEl = document.getElementById('error');
const cardsEl = document.getElementById('overviewCards');
const userGrowthEl = document.getElementById('userGrowthChart');
const activityEl = document.getElementById('activityChart');
const topCommandsEl = document.getElementById('topCommandsChart');

function cardHtml(label, value) {
  return `<div class="stat-card"><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>`;
}

function renderOverview(o) {
  cardsEl.innerHTML = [
    cardHtml('Comptes Hub', o.totalUsers),
    cardHtml('Publications', o.totalPosts),
    cardHtml('Instances en ligne', `${o.onlineInstances} / ${o.totalInstances}`),
    cardHtml('Messages traités (cumulé)', o.totalMessages.toLocaleString('fr-FR')),
  ].join('');
}

/**
 * Construit un graphique en barres avec juste des <div> dont la hauteur
 * est un pourcentage — pas besoin d'une bibliothèque de graphiques pour
 * quelque chose d'aussi simple. Chaque barre a une hauteur relative au
 * MAXIMUM de la série, pas à une échelle fixe.
 */
function renderBarChart(container, data) {
  const max = Math.max(...data.map((d) => d.count), 1); // évite une division par zéro si tout est à 0

  container.innerHTML = data
    .map((d) => {
      const heightPercent = Math.round((d.count / max) * 100);
      const shortDate = d.date.slice(5); // "MM-JJ" plutôt que "AAAA-MM-JJ", plus lisible sur un petit graphique
      return `
        <div class="bar-wrapper" title="${d.date} : ${d.count}">
          <div class="bar" style="height: ${heightPercent}%"></div>
          <div class="bar-label">${shortDate}</div>
        </div>
      `;
    })
    .join('');
}

function renderLeaderboard(container, commands) {
  if (!commands.length) {
    container.innerHTML = '<div class="muted-small">Pas encore de données de commandes.</div>';
    return;
  }

  const max = Math.max(...commands.map((c) => c.count), 1);

  container.innerHTML = commands
    .map((c) => `
      <div class="leaderboard-row">
        <div class="leaderboard-name">!${c.name}</div>
        <div class="leaderboard-track">
          <div class="leaderboard-fill" style="width: ${Math.round((c.count / max) * 100)}%"></div>
        </div>
        <div class="leaderboard-count">${c.count}</div>
      </div>
    `)
    .join('');
}

async function load() {
  try {
    const res = await fetch('/api/stats');
    if (!res.ok) {
      errorEl.textContent = `Erreur serveur (${res.status})`;
      errorEl.style.display = 'block';
      return;
    }

    const { overview, userGrowth, activityOverTime, topCommands } = await res.json();
    renderOverview(overview);
    renderBarChart(userGrowthEl, userGrowth);
    renderBarChart(activityEl, activityOverTime);
    renderLeaderboard(topCommandsEl, topCommands);
  } catch {
    errorEl.textContent = 'Impossible de contacter le serveur.';
    errorEl.style.display = 'block';
  }
}

load();
