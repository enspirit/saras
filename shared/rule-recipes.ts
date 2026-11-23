// Rules to start from, shown in the guide to writing one. Each is a whole rule that fits the
// email (a test checks it); the values they answer are examples, to be replaced by one's own.

export interface Recipe {
  key: 'domain' | 'words' | 'attachment' | 'mailbox' | 'newsletter' | 'reason';
  elo: string;
}

export const RECIPES: Recipe[] = [
  { key: 'domain', elo: `let domain = lower(_.from.address) |> split('@') |> fetch(.1)\nin if domain == 'client.example' then 'high' else null` },
  { key: 'words', elo: `let words = lower(_.subject + ' ' + _.text)\nin if contains(words, 'invoice') || contains(words, 'facture')\n  then 'billing' else null` },
  { key: 'attachment', elo: `if any(_.attachments, a ~> a.type == 'application/pdf')\nthen 'with a document' else null` },
  { key: 'mailbox', elo: `if lower(_.mailbox) == 'billing@acme.example'\nthen 'billing' else null` },
  { key: 'newsletter', elo: `if _.headers.listUnsubscribe != '' || _.headers.listId != ''\nthen 'newsletter' else null` },
  { key: 'reason', elo: `if contains(lower(_.subject), 'urgent')\nthen {value: 'high', reason: 'the subject says urgent'}\nelse null` },
];

/** The language in a few lines: what one meets in nearly every rule. */
export const ELO_IN_BRIEF = [
  { key: 'choice', elo: `if a then 'x' else null` },
  { key: 'naming', elo: `let name = … in …` },
  { key: 'contains', elo: `contains(lower(_.subject), 'x')` },
  { key: 'any', elo: `any(_.attachments, a ~> a.size > 1000000)` },
  { key: 'chain', elo: `_.from.address |> split('@') |> fetch(.1)` },
  { key: 'logic', elo: `a && b,  a || b,  a == b,  a != b` },
] as const;
