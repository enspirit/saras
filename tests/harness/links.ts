// The links scanner: every relative link of a markdown file leads to something that exists.
// Pure: it is given the text and a way to ask whether a path exists.

const FENCE = /^(```|~~~)/;
const LINK = /!?\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;
const ELSEWHERE = /^([a-z][a-z0-9+.-]*:|\/\/|#)/i;

/** The lines of a markdown text that are prose: not inside a fenced block, and without their inline code. */
function prose(markdown: string): string[] {
  let fenced = false;
  return markdown.split('\n').map((line) => {
    if (FENCE.test(line.trim())) {
      fenced = !fenced;
      return '';
    }
    return fenced ? '' : line.replace(/`[^`]*`(?!\])/g, '');
  });
}

/** Where the relative links of a markdown text lead, each without its fragment. */
export function relativeLinks(markdown: string): string[] {
  return prose(markdown)
    .flatMap((line) => [...line.matchAll(LINK)].map((match) => match[1] ?? ''))
    .filter((target) => target !== '' && !ELSEWHERE.test(target))
    .map((target) => decodeURI(target.split('#')[0] ?? ''))
    .filter((target) => target !== '');
}

/** The path a link of a file leads to, from the root of the repository. */
export function resolve(file: string, target: string): string {
  const parts = target.startsWith('/') ? [] : file.split('/').slice(0, -1);
  for (const part of target.split('/')) {
    if (part === '..') parts.pop();
    else if (part !== '.' && part !== '') parts.push(part);
  }
  return parts.join('/');
}

/** The links of a file that lead nowhere, as a reader would be told. */
export function brokenLinks(file: string, markdown: string, exists: (path: string) => boolean): string[] {
  return relativeLinks(markdown)
    .filter((target) => !exists(resolve(file, target)))
    .map((target) => `${file}: (${target}) leads nowhere`);
}
