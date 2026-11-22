/**
 * The brand of this installation: its name, tagline and logo, read from /brand/brand.json.
 * Colours and fonts are in /brand/theme.css, loaded by the page itself.
 */

/** Name, logo and tagline of the installation, as loadBrand returns them. */
export interface Brand {
  name: string;
  tagline: string;
  /** URL of the logo, when the brand has one. */
  logo: string | null;
  /** URL of the variant used in dark mode. */
  logoDark: string | null;
  /** Who offers this installation, shown next to the name on the sign-in screen ("by …"). */
  byline: string;
  /** Small print under the sign-in form ("Engineered by …"). */
  credit: string;
  /** The installation and the AI it calls are hosted in Europe: the sign-in screen may say so. */
  euHosting: boolean;
}

/** brand.json as written by a company: file names, not URLs. */
interface BrandFile {
  name: string;
  /** One text for every language, or one per language tag. */
  tagline: string | Record<string, string>;
  logo: string | null;
  logoDark: string | null;
  /** Optional, one text or one per language: who offers the installation, and small print for the sign-in screen. */
  byline?: string | Record<string, string>;
  credit?: string | Record<string, string>;
  /** True when the installation and the AI it calls are hosted in Europe. */
  euHosting?: boolean;
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
  const text = (value: string | Record<string, string> | undefined): string => (typeof value === 'string' ? value : (value?.[language] ?? Object.values(value ?? {})[0] ?? ''));
  return { name: brand.name, tagline: text(brand.tagline), logo: asset(brand.logo), logoDark: asset(brand.logoDark), byline: text(brand.byline), credit: text(brand.credit), euHosting: brand.euHosting === true };
}
