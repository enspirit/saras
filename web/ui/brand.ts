/**
 * The brand of this installation: its name, tagline and logo, read from /brand/brand.json.
 * Colours and fonts are in /brand/theme.css, loaded by the page itself.
 */
import type { Brand } from './atoms.ts';

/** brand.json as written by a company: file names, not URLs. */
interface BrandFile {
  name: string;
  tagline: string;
  logo: string | null;
  logoDark: string | null;
}

const FALLBACK: BrandFile = { name: 'saras', tagline: '', logo: null, logoDark: null };

export async function loadBrand(): Promise<Brand> {
  let brand = FALLBACK;
  try {
    const res = await fetch('/brand/brand.json');
    if (res.ok) brand = { ...FALLBACK, ...((await res.json()) as Partial<BrandFile>) };
  } catch {
    // An unreadable brand file must not prevent the application from starting.
  }
  document.title = brand.name;
  const asset = (file: string | null): string | null => (file ? `/brand/${file}` : null);
  return { name: brand.name, tagline: brand.tagline, logo: asset(brand.logo), logoDark: asset(brand.logoDark) };
}
