/**
 * generate-commands.js
 * ------------------------------------------------------------------
 * Lit tous les fichiers de src/commands/ d'un projet RodrickBOT et
 * remplace le contenu de la table Postgres "commands" — le catalogue
 * affiché sur commands.html.
 *
 * Usage :
 *   node scripts/generate-commands.js /chemin/vers/rodrickbot/src/commands
 *
 * Nécessite un fichier .env local avec DATABASE_URL renseigné (voir
 * .env.example) — c'est la ligne juste en dessous qui le charge.
 *
 * Pourquoi un script séparé plutôt qu'une route API : RodrickBOT et
 * Rodrick Hub sont deux projets distincts, sur deux serveurs différents.
 * Le Hub n'a pas accès aux fichiers du bot en direct — on régénère donc
 * le catalogue à la main (ou via ce script) à chaque fois qu'on veut le
 * mettre à jour, un peu comme on republie une nouvelle version.
 * ------------------------------------------------------------------
 */

import 'dotenv/config';
import { readFileSync, readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../src/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const commandsDir = process.argv[2];
if (!commandsDir) {
  console.error('Usage: node scripts/generate-commands.js /chemin/vers/rodrickbot/src/commands');
  process.exit(1);
}

/**
 * Extrait le texte entre `description:` et le prochain champ connu.
 * La description est parfois une seule chaîne, parfois plusieurs chaînes
 * concaténées avec "+" sur plusieurs lignes — on récupère tout le bloc
 * brut ici, et extractQuotedStrings() s'occupe de le nettoyer ensuite.
 */
function extractDescriptionBlock(content) {
  const match = content.match(/description:\s*([\s\S]*?)(?:category:|adminOnly:|privateOnly:|cooldownMs:|execute:)/);
  return match ? match[1] : '';
}

/** Récupère toutes les chaînes '...'/"..." d'un bloc et les recolle. */
function extractQuotedStrings(block) {
  const matches = [...block.matchAll(/'([^']*)'|"([^"]*)"/g)];
  return matches.map((m) => m[1] ?? m[2]).join(' ').replace(/\s+/g, ' ').trim();
}

function extractField(content, regex) {
  const match = content.match(regex);
  return match ? match[1] : null;
}

/** La partie "Usage: ..." d'une description, si elle existe. */
function extractSyntax(description) {
  const match = description.match(/Usage\s*:\s*(.+)$/i);
  return match ? match[1].trim() : null;
}

function parseCommandFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');

  const name = extractField(content, /name:\s*'([^']+)'/);
  if (!name) return null; // pas un fichier de commande reconnaissable, on ignore

  const aliasesRaw = extractField(content, /aliases:\s*\[([^\]]*)\]/);
  const aliases = aliasesRaw ? [...aliasesRaw.matchAll(/'([^']+)'/g)].map((m) => m[1]) : [];

  const description = extractQuotedStrings(extractDescriptionBlock(content));
  const category = extractField(content, /category:\s*'([^']+)'/) || 'Général';
  const adminOnly = /adminOnly:\s*true/.test(content);

  return {
    name,
    aliases,
    description,
    category,
    adminOnly,
    syntax: extractSyntax(description),
  };
}

const files = readdirSync(commandsDir).filter((f) => f.endsWith('.js'));
const commands = files
  .map((f) => parseCommandFile(path.join(commandsDir, f)))
  .filter(Boolean)
  .sort((a, b) => a.name.localeCompare(b.name));

// Remplace TOUT le contenu de la table à chaque génération — le catalogue
// reflète toujours exactement l'état actuel des fichiers de commandes,
// jamais un mélange d'ancien et de nouveau. Un client dédié (plutôt que
// pool.query directement) garantit que BEGIN/DELETE/INSERT/COMMIT
// s'exécutent tous sur la MÊME connexion.
async function replaceAll(cmds) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM commands');
    for (const cmd of cmds) {
      await client.query(
        `INSERT INTO commands (name, aliases, description, category, "adminOnly", syntax)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [cmd.name, JSON.stringify(cmd.aliases), cmd.description, cmd.category, cmd.adminOnly ? 1 : 0, cmd.syntax]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

await replaceAll(commands);
console.log(`✅ ${commands.length} commandes écrites dans la base de données.`);
await pool.end();
