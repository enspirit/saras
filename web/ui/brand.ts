/**
 * The brand of this installation: its name, tagline and logo, read from /brand/brand.json.
 * Colours and fonts are in /brand/theme.css, loaded by the page itself.
 */
import type { Brand } from './atoms.ts';

/** brand.json as written by a company: file names, not URLs. */
interface BrandFile {
  name: string;
  /** One text for every language, or one per language tag. */
  tagline: string | Record<string, string>;
  logo: string | null;
  logoDark: string | null;
}

const FALLBACK: BrandFile = { name: 'saras', tagline: '', logo: null, logoDark: null };

/**
 * @param language the tag of the language in use, to pick the tagline
 */
export async function loadBrand(language: string): Promise<Brand> {
  let brand = FALLBACK;
  try {
    const res = await fetch('/brand/brand.json');
    if (res.ok) brand = { ...FALLBACK, ...((await res.json()) as Partial<BrandFile>) };
  } catch {
    // An unreadable brand file must not prevent the application from starting.
  }
  document.title = brand.name;
  const asset = (file: string | null): string | null => (file ? `/brand/${file}` : null);
  const { tagline } = brand;
  const text = typeof tagline === 'string' ? tagline : (tagline[language] ?? Object.values(tagline)[0] ?? '');
  return { name: brand.name, tagline: text, logo: asset(brand.logo), logoDark: asset(brand.logoDark) };
}
