// Where one is in the application, and how a page asks for another. The entry file (app.ts)
// knows every page and says here how to show them, so that pages never import each other in a circle.

/** `#/page/12`, `#/page/part` or `#/page/part/12`: a page, optionally one of its parts, optionally one thing by its number. */
export function route() {
  const [path, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
  const [page = '', first = '', second = ''] = path.split('/');
  const numbered = /^\d+$/.test(first);
  return { page: page || 'inbox', part: numbered ? '' : first, id: numbered ? Number(first) : second ? Number(second) : null, query: new URLSearchParams(query) };
}

/** The token of the invitation link being opened, when the address is one. */
export const invitationToken = (): string | null => location.hash.match(/^#\/invitation\/([\w-]+)$/)?.[1] || null;

const wired = { showPage: (): void => {}, start: async (): Promise<void> => {} };

/** Called once by the entry file, with what the two functions below do. */
export const wireNavigation = (functions: typeof wired): void => void Object.assign(wired, functions);

/** Shows the page of the current address again. */
export const showPage = (): void => wired.showPage();

/** Starts over: asks who is signed in, then shows the page of the address, or the sign-in page. */
export const start = (): Promise<void> => wired.start();

/** Goes to another address and shows its page at once, even when the address was already this one. */
export function goTo(hash: string): void {
  location.hash = hash;
  showPage();
}
