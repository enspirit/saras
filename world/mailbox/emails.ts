// The emails the mailbox holds: invented correspondents writing to an invented consultancy,
// in English and in French, as a small business receives them — requests, invoices, problems,
// meetings, and the automated mail around them.

export interface SampleEmail {
  from: string;
  address: string;
  subject: string;
  /** When it was received, in hours before the mailbox starts. */
  hoursAgo: number;
  text: string;
  /** Already read in the mailbox. */
  read?: boolean;
  /** Headers besides the usual ones, e.g. those of a newsletter. */
  headers?: string[];
  /** The name of a PDF it carries. */
  pdf?: string;
}

const NEWSLETTER = ['List-Unsubscribe: <mailto:unsubscribe@news.example>', 'List-Id: <weekly.news.example>'];

export const CLIENTS: SampleEmail[] = [
  { from: 'Claire Fontaine', address: 'claire@northwind.example', subject: 'Signed quote needed before Friday', hoursAgo: 1,
    text: 'Hello,\n\nThank you for the workshop proposal. Our board meets on Friday morning and I would like to bring them the signed quote. Could you send the final version, with the two extra sessions we discussed, by Thursday evening?\n\nKind regards,\nClaire Fontaine' },
  { from: 'Northwind Accounts', address: 'accounts@northwind.example', subject: 'Invoice 2026-118: a question on line 3', hoursAgo: 3, pdf: 'invoice-2026-118.pdf',
    text: 'Good morning,\n\nWe received invoice 2026-118. Line 3 bills two days of preparation where the order mentions one and a half. Could you confirm which is right, or send a corrected invoice?\n\nThank you,\nNorthwind Accounts' },
  { from: 'Idris Okafor', address: 'idris@lakeside.example', subject: 'The export shows an error since Monday', hoursAgo: 4,
    text: 'Hi,\n\nSince Monday the monthly export stops with "error 502" after about a minute. Nothing changed on our side. We need the figures for Thursday. Can someone look into it today?\n\nIdris' },
  { from: 'Tomás Vidal', address: 'tomas@atelier-vidal.example', subject: 'Devis pour une formation de deux jours', hoursAgo: 6,
    text: 'Bonjour,\n\nNous aimerions organiser une formation de deux jours pour huit personnes en janvier, dans nos locaux à Namur. Pouvez-vous nous envoyer un devis, et nous dire quelles dates vous conviendraient ?\n\nBien à vous,\nTomás Vidal' },
  { from: 'Maya Lindholm', address: 'maya@fjordworks.example', subject: 'Dates for the January workshop', hoursAgo: 9, read: true,
    text: 'Hello,\n\nFor the January workshop, the 14th and the 21st both work for us. The 21st would be better for the team in Oslo. Which do you prefer?\n\nMaya' },
  { from: 'Sophie Leroy', address: 'sophie@leroy-conseil.example', subject: 'Report de notre rendez-vous de jeudi', hoursAgo: 12,
    text: 'Bonjour,\n\nUn imprévu m’oblige à reporter notre rendez-vous de jeudi 10h. Seriez-vous disponible vendredi à la même heure, ou lundi après-midi ?\n\nCordialement,\nSophie Leroy' },
  { from: 'Marc Dubois', address: 'marc@dubois-freres.example', subject: 'Merci pour hier', hoursAgo: 20, read: true,
    text: 'Bonjour,\n\nMerci pour la réunion d’hier, tout est clair de notre côté. Nous revenons vers vous dès que le comité a tranché.\n\nMarc' },
  { from: 'Hannah Becker', address: 'hannah@becker-partner.example', subject: 'Facture 2026-104 toujours impayée ?', hoursAgo: 26,
    text: 'Bonjour,\n\nSauf erreur de notre part, votre facture 2026-104 du mois dernier ne nous est jamais parvenue en original, et notre comptabilité ne peut pas la régler sans cela. Pouvez-vous nous la renvoyer en PDF ?\n\nMerci d’avance,\nHannah Becker' },
  { from: 'Priya Raman', address: 'priya@brightlane.example', subject: 'Pricing for ten more seats', hoursAgo: 30,
    text: 'Hi,\n\nWe are growing and would need ten more seats from next month. Is there a volume price above thirty seats? A quote would help me get this approved.\n\nThanks,\nPriya' },
  { from: 'Julien Morel', address: 'julien@morel-industrie.example', subject: 'Panne du tableau de bord depuis ce matin', hoursAgo: 34,
    text: 'Bonjour,\n\nLe tableau de bord n’affiche plus rien depuis ce matin : la page reste blanche après la connexion, sur tous nos postes. C’est bloquant pour l’équipe de production. Pouvez-vous regarder en priorité ?\n\nJulien Morel' },
  { from: 'Elena Costa', address: 'elena@costa-studio.example', subject: 'Could we move our call to next week?', hoursAgo: 50,
    text: 'Hello,\n\nI am travelling on Wednesday after all. Could we move our call to next week, Tuesday or Wednesday morning?\n\nBest,\nElena' },
  { from: 'Olivier Renard', address: 'olivier@renard-avocats.example', subject: 'Contrat de prestation : deux remarques', hoursAgo: 75, pdf: 'contrat-annote.pdf',
    text: 'Bonjour,\n\nVous trouverez en pièce jointe le contrat annoté. Deux points : la clause de confidentialité (article 7) nous paraît trop large, et le délai de paiement devrait être de 30 jours fin de mois. Qu’en pensez-vous ?\n\nBien cordialement,\nOlivier Renard' },
  { from: 'Sam Whitfield', address: 'sam@whitfield.example', subject: 'Quick question about your availability in March', hoursAgo: 100,
    text: 'Hi,\n\nA quick one: would you have two consecutive days free in the second half of March for an on-site audit in Leeds?\n\nSam' },
  { from: 'Northwind Accounts', address: 'accounts@northwind.example', subject: 'Payment sent for invoice 2026-097', hoursAgo: 150, read: true,
    text: 'Good afternoon,\n\nThis is to let you know that invoice 2026-097 was paid this morning by bank transfer. No action needed on your side.\n\nNorthwind Accounts' },
];

export const AUTOMATED: SampleEmail[] = [
  { from: 'The Weekly Brief', address: 'newsletter@news.example', subject: 'Ten things to read this week', hoursAgo: 2, headers: NEWSLETTER,
    text: 'This week: remote teams, landing pages that work, and a long read on procurement.\n\nUnsubscribe at any time.' },
  { from: 'La Lettre du Conseil', address: 'lettre@conseil-hebdo.example', subject: 'Les actus de la semaine', hoursAgo: 28, headers: NEWSLETTER,
    text: 'Au sommaire : la facturation électronique, trois retours d’expérience, et l’agenda du mois.\n\nSe désabonner.' },
  { from: 'Railway Tickets', address: 'no-reply@rail.example', subject: 'Your ticket Brussels – Paris, 14 January', hoursAgo: 8,
    text: 'Your booking is confirmed. Your ticket is attached to your account.\n\nThis is an automatic message, please do not reply.' },
  { from: 'Cloud Hosting', address: 'notification@hosting.example', subject: 'Scheduled maintenance on Sunday night', hoursAgo: 40,
    text: 'A maintenance window is scheduled on Sunday from 01:00 to 03:00 UTC. Short interruptions are possible.' },
  { from: 'Paul Girard', address: 'paul@girard.example', subject: 'Absent jusqu’au 6 janvier', hoursAgo: 14, headers: ['Auto-Submitted: auto-replied'],
    text: 'Bonjour,\n\nJe suis absent jusqu’au 6 janvier et répondrai à votre message à mon retour.\n\nPaul Girard' },
  { from: 'Office Supplies', address: 'promo@supplies.example', subject: 'Winter sale: 20% off paper and ink', hoursAgo: 60, headers: ['Precedence: bulk'],
    text: 'Stock up for the new year. Offer valid until the end of the month.' },
];
