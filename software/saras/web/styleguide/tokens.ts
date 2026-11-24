// The tokens of the design system, read from design/tokens.css itself so that the style guide
// cannot drift from the real thing.

import { t } from '../i18n.ts';
import { Code, Heading, Muted, Text } from '../ui/atoms/text.ts';
import type { Child } from '../ui/dom.ts';
import { Card } from '../ui/molecules/card.ts';
import { Block } from '../ui/molecules/field.ts';
import { Swatch } from '../ui/molecules/swatch.ts';

/** Names of the custom properties declared in tokens.css, in file order. */
export async function tokenNames() {
  const css = await (await fetch('/design/tokens.css')).text();
  return [...new Set([...css.matchAll(/^\s*(--[\w-]+)\s*:/gm)].map((m) => m[1]))];
}

const computed = (name: string): string => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const valueLine = (name: string) => Text({ small: true }, Code(name), Muted(` — ${computed(name)}`));

/** Every token with its value: the brand's inputs, then what is derived from them. */
export function tokensSection(tokens: string[]): Child[] {
  const group = (prefix: string): string[] => tokens.filter((t) => t.startsWith(prefix));
  return [
    Heading(2, t('styleguide.tokens')),
    Card({ title: t('styleguide.brandInputs') },
      Block(Text({ muted: true, small: true }, t('styleguide.brandInputsHint'))),
      group('--brand-').map((t) => (/(accent|canvas|ink)/.test(t) ? Swatch(t) : valueLine(t))),
    ),
    Card({ title: t('styleguide.colors') },
      Block(Text({ muted: true, small: true }, t('styleguide.colorsHint'))),
      group('--color-').map(Swatch),
    ),
    Card({ title: t('styleguide.typography') }, [...group('--font-'), ...group('--text-'), ...group('--weight-'), ...group('--leading')].map(valueLine)),
    Card({ title: t('styleguide.layout') },
      [...group('--space-'), ...group('--radius-'), '--border-width', '--nav-width', '--list-width', '--page-width', '--form-width', '--auth-width', '--dialog-width', '--logo-height'].map(valueLine),
    ),
    Card({ title: t('styleguide.elevation') }, [...group('--shadow-'), ...group('--duration-'), '--ease', ...group('--control-'), ...group('--icon-')].map(valueLine)),
  ];
}
