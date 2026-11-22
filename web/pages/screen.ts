// The one place of the document where the application is shown.
const root = document.getElementById('app') as HTMLElement;

/** Nothing is on screen yet. */
export const screenIsBlank = (): boolean => !root.hasChildNodes();

/** Puts a whole screen in place of the one shown. */
export const showScreen = (screen: Node): void => root.replaceChildren(screen);
