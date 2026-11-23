// Pure: the link that lets a member choose a new password, and the letter that carries it.
import type { Letter } from '../../tooling/postman.ts';

/** Where the link leads: the page of the interface that asks for the new password. */
export const resetLink = (baseUrl: string, token: string): string => `${baseUrl}/#/reset-password/${token}`;

const LETTERS: Record<string, (link: string, minutes: number) => Omit<Letter, 'to'>> = {
  en: (link, minutes) => ({
    subject: 'Choose a new password for saras',
    text: `Someone, probably you, asked for a new password for this address in saras.\n\nChoose it here, within ${minutes} minutes:\n${link}\n\nIf it was not you, ignore this message: your password has not changed.`,
  }),
  fr: (link, minutes) => ({
    subject: 'Choisir un nouveau mot de passe pour saras',
    text: `Quelqu’un, sans doute vous, a demandé un nouveau mot de passe pour cette adresse dans saras.\n\nChoisissez-le ici, dans les ${minutes} minutes :\n${link}\n\nSi ce n’était pas vous, ignorez ce message : votre mot de passe n’a pas changé.`,
  }),
};

/** The letter, in the member's language; in English when we do not write theirs. */
export function resetLetter(to: string, language: string, link: string, minutes: number): Letter {
  const write = LETTERS[language.split('-')[0] ?? ''] ?? LETTERS.en!;
  return { to, ...write(link, minutes) };
}
