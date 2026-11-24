// An email's text, as it is read: what its sender says, set apart from what it quotes of earlier
// emails and from how it is signed.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { partsOfText } from '../../web/ui/text-parts.ts';

/** The parts, one per line: their kind, then their text with its lines joined by ' / '. */
const read = (text: string): string[] => partsOfText(text).map((part) => `${part.kind}: ${part.text.split('\n').join(' / ')}`);

const CASES: [string, string, string[]][] = [
  ['a text that quotes nothing is said', 'Bonjour,\n\nLe devis est joint.', ['said: Bonjour, /  / Le devis est joint.']],
  ['lines marked > are quoted, without their mark', 'Oui.\n\n> Pouvez-vous confirmer ?\n> Merci', ['said: Oui.', 'quoted: Pouvez-vous confirmer ? / Merci']],
  ['the line above a quote goes with it', 'Oui.\nLe 23 nov. 2026 à 17:02, Bernard a écrit :\n\n> Où en est-on ?', ['said: Oui.', 'quoted: Le 23 nov. 2026 à 17:02, Bernard a écrit : /  / Où en est-on ?']],
  ['an answer between quotes is said', '> Le prix ?\n1200 EUR.\n> Le délai ?\nTrois semaines.', ['quoted: Le prix ?', 'said: 1200 EUR.', 'quoted: Le délai ?', 'said: Trois semaines.']],
  ['what follows "-- " is a signature, until a quote, and the line itself goes', 'Merci.\n-- \nClaire Martin\nClient SA\n> Bonjour', ['said: Merci.', 'signed: Claire Martin / Client SA', 'quoted: Bonjour']],
  ['what a phone adds is a signature', 'Les mails sont traités\n\nEnvoyé de mon iPhone', ['said: Les mails sont traités', 'signed: Envoyé de mon iPhone']],
  ['under "Original Message", everything is quoted', 'Vu.\n-----Original Message-----\nFrom: Bob\nSent: Monday\n\nHello', ['said: Vu.', 'quoted: -----Original Message----- / From: Bob / Sent: Monday /  / Hello']],
  ['so it is under the line Outlook draws', 'Vu.\n________________________________\nDe : Bob\nVu aussi', ['said: Vu.', 'quoted: ________________________________ / De : Bob / Vu aussi']],
  ['blank lines are kept to one, and none begins or ends a part', '\n\nA\n\n\n\nB\n\n', ['said: A /  / B']],
  ['a mention of writing that quotes nothing is said', 'On Monday, Bob wrote:\nnothing more', ['said: On Monday, Bob wrote: / nothing more']],
  ['an empty text has no part', '', []],
];

for (const [name, text, expected] of CASES) test(name, () => assert.deepEqual(read(text), expected));
