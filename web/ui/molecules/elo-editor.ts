import { syntaxHighlighting } from '@codemirror/language';
import { linter } from '@codemirror/lint';
import type { Diagnostic } from '@codemirror/lint';
import { EditorView, placeholder } from '@codemirror/view';
import { elo } from '@enspirit/codemirror-lang-elo';
import { classHighlighter } from '@lezer/highlight';
import { basicSetup } from 'codemirror';
import { h } from '../dom.ts';

/** Something wrong in the rule: where (line and column from 1), over how many characters, and what probably was meant. */
export interface EloProblem {
  line: number;
  column: number;
  length: number;
  message: string;
  suggestion: string | null;
}

export interface EloEditorHandle {
  element: HTMLDivElement;
  /** The rule as it is written now. */
  value(): string;
  /** Writes this where the cursor is, in place of what is selected. */
  insert(text: string): void;
  /** Puts the suggestion of a problem in place of what it is about. */
  fix(problem: EloProblem): void;
}

export interface EloEditorOptions {
  value?: string;
  label: string;
  hint?: string;
  /** Asked a moment after the writing stops: what is wrong in the rule as it stands. */
  check?: (source: string) => Promise<EloProblem[]>;
  /** Told each time the rule was checked. */
  onChecked?: (problems: EloProblem[]) => void;
}

/**
 * What CodeMirror and its highlighter put on the elements they build, and the sheet of this
 * component dresses in the colours of the brand: the editor's own parts, and what each word is.
 */
export const DRESSED = [
  'cm-editor', 'cm-focused', 'cm-scroller', 'cm-content', 'cm-gutters', 'cm-placeholder', 'cm-tooltip', 'cm-tooltip-autocomplete', 'cm-diagnostic', 'cm-lintRange-error',
  'tok-keyword', 'tok-string', 'tok-number', 'tok-bool', 'tok-null', 'tok-literal', 'tok-comment', 'tok-operator', 'tok-punctuation',
];

/** Where a problem is in the text: from its line and column, kept inside what is written. */
function span(view: EditorView, { line, column, length }: EloProblem): { from: number; to: number } {
  const doc = view.state.doc;
  const start = doc.line(Math.min(Math.max(line, 1), doc.lines));
  const from = Math.min(start.from + Math.max(column - 1, 0), start.to);
  return { from, to: Math.min(from + Math.max(length, 1), doc.length) };
}

const replace = (view: EditorView, from: number, to: number, insert: string): void => view.dispatch({ changes: { from, to, insert }, selection: { anchor: from + insert.length } });

/** A problem as the editor underlines it; with a suggestion, one click puts it in place. */
const underlined = (view: EditorView, problem: EloProblem): Diagnostic => ({
  ...span(view, problem),
  severity: 'error',
  message: problem.message,
  actions: problem.suggestion ? [{ name: problem.suggestion, apply: (v, from, to) => replace(v, from, to, problem.suggestion ?? '') }] : [],
});

/** Checks the rule a moment after the writing stops. A check that cannot be made says nothing. */
const checking = ({ check, onChecked }: EloEditorOptions) =>
  linter(async (view) => {
    const problems = await check!(view.state.doc.toString()).catch(() => []);
    onChecked?.(problems);
    return problems.map((problem) => underlined(view, problem));
  }, { delay: 400 });

/** What the editor is made of: the language, our colours, and the check when one is asked for. */
const extensionsOf = (options: EloEditorOptions) => [
  basicSetup,
  elo(),
  syntaxHighlighting(classHighlighter),
  EditorView.lineWrapping,
  // CodeMirror writes its own style sheet into the page: the server allows it by the nonce it gave this page.
  EditorView.cspNonce.of(document.querySelector<HTMLMetaElement>('meta[name="csp-nonce"]')?.content ?? ''),
  EditorView.contentAttributes.of({ 'aria-label': options.label, spellcheck: 'false' }),
  options.hint ? placeholder(options.hint) : [],
  options.check ? checking(options) : [],
];

/**
 * An editor for a rule written in Elo: highlighting, bracket matching, folding and completion
 * come from the language's own CodeMirror support. Colours are ours: the highlighter only
 * names what each word is, and the sheet of this component gives each its colour.
 */
export function EloEditor(options: EloEditorOptions): EloEditorHandle {
  const element = h('div', { class: 'elo-editor' });
  const view = new EditorView({ doc: options.value ?? '', parent: element, extensions: extensionsOf(options) });
  const insert = (text: string): void => {
    const { from, to } = view.state.selection.main;
    replace(view, from, to, text);
    view.focus();
  };
  const fix = (problem: EloProblem): void => {
    const { from, to } = span(view, problem);
    if (problem.suggestion) replace(view, from, to, problem.suggestion);
  };
  return { element, value: () => view.state.doc.toString(), insert, fix };
}
