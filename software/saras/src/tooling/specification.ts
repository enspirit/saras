// The specification of the operations, as the server reads it: the types of the data it
// exchanges, and, for each operation, its entry and the type of its input. One text says them,
// for the server that is held to them and for the suite that holds it: tests/operations/
// specification, reached here as specification/ (a link on a checkout, a copy in the image).
// It is read as opspicy reads it: _shared/ first, then each area in the order of its name.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

export const SPECIFICATION_DIR = fileURLToPath(new URL('../../specification', import.meta.url));

const SHARED = '_shared';

/** What the specification says of one operation or observation. */
export interface Specified {
  name: string;
  method: 'get' | 'post' | 'put' | 'delete';
  path: string;
  /** The type of what it is given, path parameters included; none when it is given nothing. */
  input?: string;
  /** Where it is said. */
  file: string;
}

export interface Specification {
  /** Every type the specification declares, as one Elo prelude. */
  types: string;
  /** By name, each operation and observation. */
  operations: Map<string, Specified>;
}

const areasIn = (root: string): string[] => {
  const areas = readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  return [...areas.filter((area) => area === SHARED), ...areas.filter((area) => area !== SHARED)];
};

const typesOf = (root: string, area: string): string => (existsSync(join(root, area, 'types.elo')) ? readFileSync(join(root, area, 'types.elo'), 'utf8') : '');

const filesOf = (root: string, area: string): string[] =>
  ['operations', 'observations'].flatMap((as) => {
    const dir = join(root, area, as);
    return existsSync(dir) ? readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter((file) => file.endsWith('.yml')).map((file) => join(dir, file)) : [];
  });

/** One file of the specification: its name, its entry (`POST /api/boards`, read under /api), its input. */
function specifiedIn(file: string): Specified {
  const { name, entry, input } = parse(readFileSync(file, 'utf8')) as { name: string; entry: string; input?: string };
  const [method = '', path = ''] = String(entry).split(/\s+/);
  return { name, method: method.toLowerCase() as Specified['method'], path: path.replace(/^\/api(?=\/)/, ''), input, file };
}

export function readSpecification(root = SPECIFICATION_DIR): Specification {
  const areas = areasIn(root);
  const operations = new Map(areas.flatMap((area) => filesOf(root, area)).map(specifiedIn).map((one) => [one.name, one]));
  return { types: areas.map((area) => typesOf(root, area)).join('\n'), operations };
}
