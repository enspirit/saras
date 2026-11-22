// Measures source files: how long each is, and how long each of its functions is.
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { parse } from 'acorn';
import type { Node } from 'acorn';

export interface Measured {
  name: string;
  line: number;
  lines: number;
}

export const lineCount = (path: string): number => readFileSync(path, 'utf8').replace(/\n$/, '').split('\n').length;

const FUNCTIONS = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
type Tree = Node & Record<string, unknown>;
const isNode = (value: unknown): value is Tree => typeof value === 'object' && value !== null && typeof (value as Tree).type === 'string';
const identifier = (node: unknown): string | null => (isNode(node) && typeof node.name === 'string' ? node.name : null);

/** What a reader would call the function: its own name, or that of what it is assigned or passed to. */
function nameOf(node: Tree, parent: Tree | null): string {
  const own = identifier(node.id);
  if (own) return own;
  if (parent?.type === 'VariableDeclarator') return identifier(parent.id) ?? '(anonymous)';
  if (parent?.type === 'Property' || parent?.type === 'MethodDefinition') return identifier(parent.key) ?? '(anonymous)';
  if (parent?.type === 'CallExpression') return `${identifier(parent.callee) ?? 'a call'}(…)`;
  return '(anonymous)';
}

/** The children of a node, in any of its properties. */
const childrenOf = (node: Tree): Tree[] => Object.values(node).flatMap((value) => (Array.isArray(value) ? value : [value]).filter(isNode));

/** Every function of a TypeScript file, with the lines it spans, signature and braces included. */
export function functionsOf(path: string): Measured[] {
  // Types are replaced by blanks, so that every line stays where it is.
  const program = parse(stripTypeScriptTypes(readFileSync(path, 'utf8')), { ecmaVersion: 'latest', sourceType: 'module', locations: true }) as unknown as Tree;
  const found: Measured[] = [];
  const visit = (node: Tree, parent: Tree | null): void => {
    if (FUNCTIONS.has(node.type) && node.loc) found.push({ name: nameOf(node, parent), line: node.loc.start.line, lines: node.loc.end.line - node.loc.start.line + 1 });
    for (const child of childrenOf(node)) visit(child, node);
  };
  visit(program, null);
  return found;
}
