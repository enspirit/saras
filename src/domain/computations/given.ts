// What a client gave, brought to what the domain talks about. Anything may arrive: these
// never refuse, they reduce.

/** A trimmed, length-capped text out of anything; nothing for anything that is not text. */
export const clipped = (value: unknown, max = 10_000): string => (typeof value === 'string' ? value.trim().slice(0, max) : '');

/** An address as it is compared and stored: trimmed, capped, in lower case. */
export const addressGiven = (value: unknown): string => clipped(value, 320).toLowerCase();

/** A list of addresses; anything that is not a list is an empty one. */
export const addressesGiven = (value: unknown): string[] => (Array.isArray(value) ? value.map(addressGiven).filter(Boolean) : []);

/** A language tag as the interface sends it, or English when it does not look like one. */
export const languageGiven = (value: unknown): string => (typeof value === 'string' && /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(value) ? value : 'en');
