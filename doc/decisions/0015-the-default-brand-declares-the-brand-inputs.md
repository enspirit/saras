# 0015 — The default brand declares the brand inputs, and the design system loads it

## Context

A brand changes the look by a dozen inputs (`--brand-accent`, `--brand-canvas`, `--brand-radius`…), from which `public/design/tokens.css` derives everything else. A brand is a folder, and the default one is `public/brand/`.

The inputs of the default brand were written twice: as defaults at the top of `tokens.css`, for a brand that leaves one out, and again in `public/brand/theme.css`, the file an operator copies to make a brand. Nothing held the two together. Changing the default brand meant changing both, and changing one only showed nothing wrong until another brand was put in place.

## Decision

The brand inputs are declared by the default brand, in `public/brand/theme.css`, and nowhere else. `tokens.css` reads them and declares none.

`public/design/index.css` loads that file with the tokens, in their layer, so it is part of the design system's style sheet whatever the brand in place. A brand's own `theme.css` is loaded after it, outside any layer, as before: it changes the inputs it names and keeps the default brand's for the others.

`test/unit/design-system.test.ts` holds it: the default brand declares every input `tokens.css` reads, `tokens.css` declares none, and no token is declared by both.

## Alternatives

- **Keep the defaults in `tokens.css`, and have the default `theme.css` set nothing.** Written once as well. But the default brand's folder would no longer show what a brand is: an operator would copy an empty file, or start from the example brand and its fictitious firm. And the style guide says of the inputs that they are defined in `brand/theme.css`.
- **Keep both, and a test that compares them.** Two places still, and a failure to read on every change of the default brand.
- **Have the server answer a brand's `theme.css` with the default's before it.** The fallback would be the server's doing, not the style sheet's: a page served by anything else would lose it.

## Consequences

- With no brand folder, the default `theme.css` reaches the page twice, in the bundle and as `/brand/theme.css`. Both say the same.
- `--logo-height`, which a brand sets like an input, is declared by the default brand too.
- The style guide lists the inputs by reading which ones `tokens.css` uses, since it no longer declares them.
- A brand input is added in `public/brand/theme.css` with the default brand's value, then read in `tokens.css`.
- The default `theme.css` is a source of the bundle: changing it calls for `npm run build`, which the watch of `npm run dev` does.

## What would reverse it

A default brand that needs what a layer cannot give: a `@font-face` whose file must not be bundled, or a rule that has to win over a component. It would then be loaded as any brand's, outside the layers, and the inputs would need their defaults back in `tokens.css`.
