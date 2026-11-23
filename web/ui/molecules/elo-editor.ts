import { syntaxHighlighting } from '@codemirror/language';
import { EditorView, placeholder } from '@codemirror/view';
import { elo } from '@enspirit/codemirror-lang-elo';
import { classHighlighter } from '@lezer/highlight';
import { basicSetup } from 'codemirror';
import { h } from '../dom.ts';

export interface EloEditorHandle {
  element: HTMLDivElement;
  /** The rule as it is written now. */
  value(): string;
}

/**
 * What CodeMirror and its highlighter put on the elements they build, and the sheet of this
 * component dresses in the colours of the brand: the editor's own parts, and what each word is.
 */
export const DRESSED = [
  'cm-editor', 'cm-focused', 'cm-scroller', 'cm-content', 'cm-gutters', 'cm-placeholder', 'cm-tooltip', 'cm-tooltip-autocomplete',
  'tok-keyword', 'tok-string', 'tok-number', 'tok-bool', 'tok-null', 'tok-literal', 'tok-comment', 'tok-operator', 'tok-punctuation',
];

/**
 * An editor for a rule written in Elo: highlighting, bracket matching, folding and completion
 * come from the language's own CodeMirror support. Colours are ours: the highlighter only
 * names what each word is, and the sheet of this component gives each its colour.
 */
export function EloEditor({ value = '', label, hint }: { value?: string; label: string; hint?: string }): EloEditorHandle {
  const element = h('div', { class: 'elo-editor' });
  const view = new EditorView({
    doc: value,
    parent: element,
    extensions: [
      basicSetup,
      elo(),
      syntaxHighlighting(classHighlighter),
      EditorView.lineWrapping,
      // CodeMirror writes its own style sheet into the page: the server allows it by the nonce it gave this page.
      EditorView.cspNonce.of(document.querySelector<HTMLMetaElement>('meta[name="csp-nonce"]')?.content ?? ''),
      EditorView.contentAttributes.of({ 'aria-label': label, spellcheck: 'false' }),
      hint ? placeholder(hint) : [],
    ],
  });
  return { element, value: () => view.state.doc.toString() };
}
