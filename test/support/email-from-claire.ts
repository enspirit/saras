// An email as saras reads it from a mailbox: Claire asks for a quote, with two colleagues in the loop.
export const email = {
  fromName: 'Claire Martin',
  fromAddr: 'claire@client.example',
  replyTo: '',
  to: [{ name: '', address: 'me@corp.example' }, { name: '', address: 'paul@client.example' }],
  cc: [{ name: '', address: 'lea@client.example' }],
  subject: 'Devis',
  date: '2026-11-18T09:30:00.000Z',
  bodyText: 'Bonjour,\nPouvez-vous m’envoyer un devis ?\n> ancien message',
  messageId: '<m2@client.example>',
  refs: '<m1@client.example>',
  headers: {},
};
