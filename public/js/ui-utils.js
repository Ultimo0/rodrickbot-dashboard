export const FAVORITES_FILTER = '__favorites__';

export function normalizeSearch(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^[!/.]+/, '')
    .trim()
    .toLocaleLowerCase('fr');
}

export function filterInstances(instances, { query = '', status = 'all' } = {}) {
  const needle = normalizeSearch(query);

  return instances.filter((instance) => {
    const online = instance.online === true;
    const enabled = instance.enabled !== false;
    const matchesStatus = status === 'all'
      || (status === 'online' && online)
      || (status === 'offline' && !online)
      || (status === 'disabled' && !enabled);
    if (!matchesStatus) return false;

    const searchable = normalizeSearch([
      instance.instanceId,
      instance.ownerName,
      instance.botName,
      instance.version,
    ].join(' '));
    return !needle || searchable.includes(needle);
  });
}

export function filterCommands(commands, { query = '', category = 'Toutes', favorites = new Set() } = {}) {
  const needle = normalizeSearch(query);

  return commands.filter((command) => {
    const matchesCategory = category === 'Toutes'
      || (category === FAVORITES_FILTER
        ? favorites.has(command.name)
        : command.category === category);
    if (!matchesCategory) return false;

    const searchable = normalizeSearch([
      command.name,
      command.category,
      command.description,
      command.syntax,
      ...(Array.isArray(command.aliases) ? command.aliases : []),
    ].join(' '));
    return !needle || searchable.includes(needle);
  });
}

export function formatCommandUsage(command) {
  const syntax = String(command.syntax ?? '').trim().replace(/\{prefix\}/gi, '!');
  return syntax || `!${command.name}`;
}

const FEATURE_LABELS = {
  welcome: 'Bienvenue',
  bye: 'Départ',
  antilink: 'Anti-lien',
  antipromote: 'Anti-promotion',
  antidemote: 'Anti-rétrogradation',
  guardian: 'Guardian',
  antispam: 'Anti-spam',
  antipurge: 'Anti-suppression',
  antistatut: 'Anti-statut',
  antiflood: 'Anti-flood',
  antiraid: 'Anti-raid',
  antitransfer: 'Anti-transfert',
  autotranslate: 'Traduction automatique',
  linkWhitelist: 'Liste blanche de liens',
};

export function activeFeatureCounts(features) {
  if (!features || typeof features !== 'object' || Array.isArray(features)) return null;

  return Object.entries(features)
    .filter(([, count]) => Number.isSafeInteger(count) && count > 0)
    .map(([name, count]) => ({
      name,
      label: FEATURE_LABELS[name] || name.replace(/([a-z])([A-Z])/g, '$1 $2'),
      count,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'fr'));
}

export function formatDateTime(timestamp) {
  if (timestamp == null || !Number.isFinite(Number(timestamp))) return 'Non communiqué';
  const date = new Date(Number(timestamp));
  if (Number.isNaN(date.getTime())) return 'Non communiqué';
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function ytDlpRefreshLabel(status) {
  if (status === true) return 'Actualisation réussie';
  if (status === false) return 'Échec de la dernière actualisation';
  return 'État non communiqué par cette version';
}
