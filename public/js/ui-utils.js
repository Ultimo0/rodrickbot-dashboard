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
