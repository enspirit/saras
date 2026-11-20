/**
 * The brand of this installation: its name, tagline and logo, read from /brand/brand.json.
 * Colours and fonts are in /brand/theme.css, loaded by the page itself.
 */
const FALLBACK = { name: 'saras', tagline: '', logo: null, logoDark: null };

export async function loadBrand() {
  let brand = FALLBACK;
  try {
    const res = await fetch('/brand/brand.json');
    if (res.ok) brand = { ...FALLBACK, ...(await res.json()) };
  } catch {
    // An unreadable brand file must not prevent the application from starting.
  }
  document.title = brand.name;
  const asset = (file) => (file ? `/brand/${file}` : null);
  return { name: brand.name, tagline: brand.tagline, logo: asset(brand.logo), logoDark: asset(brand.logoDark) };
}
