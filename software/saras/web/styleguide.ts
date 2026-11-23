// Living style guide: every token and every component of the design system, rendered with
// the installation's own brand. It is built from the same modules as the application and
// reads the token list from design/tokens.css itself, so it cannot drift from the real thing.

import { initI18n, language, t, tRich } from './i18n.ts';
import { atomsSection } from './styleguide/atoms.ts';
import { moleculesSection } from './styleguide/molecules.ts';
import { organismsSection } from './styleguide/organisms.ts';
import { tokenNames, tokensSection } from './styleguide/tokens.ts';
import { ButtonLink } from './ui/atoms/button.ts';
import { Code } from './ui/atoms/text.ts';
import { loadBrand } from './ui/brand.ts';
import { PageHeader } from './ui/molecules/page-header.ts';
import { Page } from './ui/organisms/page.ts';

await initI18n();
const brand = await loadBrand(language());
const tokens = await tokenNames();
document.title = t('styleguide.title', { product: brand.name });

(document.getElementById('app') as HTMLElement).replaceChildren(
  Page(
    PageHeader({ title: t('styleguide.title', { product: brand.name }), intro: tRich('styleguide.intro', {}, { code: Code }) }, ButtonLink(t('styleguide.back'), { href: '/' })),
    tokensSection(tokens),
    atomsSection(brand),
    moleculesSection(),
    organismsSection(brand),
  ),
);
