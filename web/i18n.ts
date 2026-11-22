/**
 * Translations at run time. Messages are JSON files in public/i18n/, one folder per language
 * and one file per section of the interface, in Tolgee's native format (keys nested on dots,
 * ICU MessageFormat values); public/i18n/index.json lists the languages and the sections.
 * Nothing here is specific to this application.
 */
import { flatten, format, formatRich } from './i18n/format.ts';
import type { Params } from './i18n/format.ts';
import type { Child } from './ui/dom.ts';

export interface Language {
  /** BCP 47 tag, also the name of its folder. */
  tag: string;
  /** Its own name, as shown in the language picker. */
  name: string;
}

interface Catalogue {
  /** Language of the keys' source text, and fallback for a missing translation. */
  default: string;
  languages: Language[];
}

const STORAGE_KEY = 'saras.language';

// Used only if index.json cannot be read.
let catalogue: Catalogue = { default: 'en', languages: [{ tag: 'en', name: 'en' }] };
let current = 'en';
let messages: Record<string, string> = {};
let fallback: Record<string, string> = {};

async function loadJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(path);
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

/** Every message of a language, by its full key: `npm run build` gathers its sections into one file. */
const loadMessages = async (tag: string): Promise<Record<string, string>> => flatten(await loadJson(`/js/i18n/${tag}.json`));

/** The stored choice, else the first browser language we have, else the default. */
function pickLanguage(): string {
  const available = catalogue.languages.map((l) => l.tag);
  const matching = (wanted: string | null): string | undefined =>
    wanted ? (available.find((tag) => tag === wanted) ?? available.find((tag) => tag.split('-')[0] === wanted.split('-')[0])) : undefined;
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage may be unavailable (private mode): the browser language decides.
  }
  return matching(stored) ?? navigator.languages.map(matching).find(Boolean) ?? catalogue.default;
}

/** Loads the catalogue and the messages. To be awaited before anything is rendered. */
export async function initI18n(): Promise<void> {
  catalogue = (await loadJson<Catalogue>('/i18n/index.json')) ?? catalogue;
  current = pickLanguage();
  fallback = await loadMessages(catalogue.default);
  messages = current === catalogue.default ? fallback : await loadMessages(current);
  document.documentElement.lang = current;
}

/** The message of a key: in the current language, else in the default one, else the key itself. */
const template = (key: string): string => messages[key] ?? fallback[key] ?? key;

/** Whether a key has a message, in the current language or the default one. */
export const hasMessage = (key: string): boolean => key in messages || key in fallback;

/** Translates a key. */
export function t(key: string, params?: Params): string {
  return format(template(key), params, current);
}

/**
 * Translates a key whose message holds `<tag>…</tag>` parts, each rendered by the function
 * given under its name: tRich('k', {}, { link: (text) => Link(text, '#/settings') }).
 */
export function tRich(key: string, params: Params, tags: Record<string, (text: string) => Child>): Child[] {
  return formatRich(template(key), params, current).map((part) => (typeof part === 'string' ? part : (tags[part.tag]?.(part.text) ?? part.text)));
}

/** The current language tag. */
export const language = (): string => current;

/**
 * The locale for dates: the browser's regional variant of the current language when it has one
 * (en-GB for a British reader of the English interface), else the language itself.
 */
export const locale = (): string => navigator.languages.find((tag) => tag.split('-')[0] === current.split('-')[0]) ?? current;
export const languages = (): Language[] => catalogue.languages;

/** Remembers the choice and reloads, so that every screen is rebuilt in the new language. */
export function setLanguage(tag: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, tag);
  } catch {
    // Without storage the choice cannot be kept.
  }
  location.reload();
}
