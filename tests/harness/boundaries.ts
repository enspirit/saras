// The boundaries scanner: which part of the code may not import which. Pure: it is given
// the text of a file and the rules.
import { resolve } from './links.ts';

export interface Boundary {
  /** The files held to the rule: those under this path. */
  within: string;
  /** What they may not import: a path of the repository (a file under it), or a package by name. */
  mayNotImport: string[];
  why: string;
}

const IMPORT = /(?:^|\n)\s*(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g;

/** What a source file imports, as it is written. */
export const importsOf = (source: string): string[] => [...source.matchAll(IMPORT)].map((match) => match[1] ?? match[2] ?? match[3] ?? '');

/** An import as a path of the repository when it is relative, as the package's name otherwise. */
const reached = (file: string, imported: string): string => (imported.startsWith('.') ? resolve(file, imported) : imported);

const isUnder = (path: string, parent: string): boolean => path === parent || path.startsWith(parent.endsWith('/') ? parent : `${parent}/`);

/** The imports of a file that cross a boundary, as a reader would be told. */
export function crossings(file: string, source: string, boundaries: Boundary[]): string[] {
  const imports = importsOf(source).map((imported) => reached(file, imported));
  return boundaries
    .filter((boundary) => isUnder(file, boundary.within))
    .flatMap((boundary) => imports.filter((path) => boundary.mayNotImport.some((forbidden) => isUnder(path, forbidden))).map((path) => `${file} imports ${path}: ${boundary.why}`));
}
