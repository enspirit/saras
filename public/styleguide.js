// Living style guide: every token and every component of the design system, rendered with
// the installation's own brand. It is built from the same modules as the application and
// reads the token list from design/tokens.css itself, so it cannot drift from the real thing.
import { Badge, BrandMark, Button, ButtonLink, Checkbox, Code, Heading, Input, Link, List, Muted, Notice, Prose, Select, Small, Spacer, Strong, Text, Textarea } from './ui/atoms.js';
import { Actions, Assurance, Block, Card, CardSection, CheckField, EmailListItem, EmptyState, Field, Form, FormRow, Message, NavItem, PageHeader, Swatch, createToast } from './ui/molecules.js';
import { AuthPanel, Mailbox, Page, ReadingHeader } from './ui/organisms.js';
import { loadBrand } from './ui/brand.js';

const toast = createToast(document.getElementById('toast'));

/** Names of the custom properties declared in tokens.css, in file order. */
async function tokenNames() {
  const css = await (await fetch('/design/tokens.css')).text();
  return [...new Set([...css.matchAll(/^\s*(--[\w-]+)\s*:/gm)].map((m) => m[1]))];
}

const computed = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const valueLine = (name) => Text({ small: true }, Code(name), Muted(` — ${computed(name)}`));

const brand = await loadBrand();
const tokens = await tokenNames();
const group = (prefix) => tokens.filter((t) => t.startsWith(prefix));
document.title = `Guide de style — ${brand.name}`;

const sampleEmail = (over = {}) =>
  EmailListItem({ from: 'Claire Martin', date: '09:30', subject: 'Demande de devis pour 20 licences', snippet: 'Bonjour, nous souhaitons équiper 20 personnes…', ...over });

document.getElementById('app').replaceChildren(
  Page(
    PageHeader(`Guide de style — ${brand.name}`, Spacer(), ButtonLink('Retour à l’application', { href: '/' })),
    Block(Text({ muted: true }, 'Tous les tokens et composants du design system, rendus avec la marque de cette installation. Modifiez ', Code('theme.css'), ' dans le dossier de marque puis rechargez cette page pour juger du résultat.')),

    Heading(2, '1. Tokens'),
    Card({ title: 'Marque — les entrées à changer' },
      Block(Text({ muted: true, small: true }, 'Définies dans brand/theme.css. Tout le reste en découle.')),
      group('--brand-').map((t) => (/(accent|canvas|ink)/.test(t) ? Swatch(t) : valueLine(t))),
    ),
    Card({ title: 'Couleurs sémantiques' },
      Block(Text({ muted: true, small: true }, 'Ce que les composants ont le droit d’utiliser. Calculées à partir de la marque, en clair comme en sombre.')),
      group('--color-').map(Swatch),
    ),
    Card({ title: 'Typographie' }, [...group('--font-'), ...group('--text-'), ...group('--weight-'), ...group('--leading')].map(valueLine)),
    Card({ title: 'Espace, forme, mise en page' },
      [...group('--space-'), ...group('--radius-'), '--border-width', '--shadow-overlay', '--nav-width', '--list-width', '--content-width', '--auth-width', '--logo-height'].map(valueLine),
    ),

    Heading(2, '2. Atomes'),
    Card({ title: 'Marque' }, Actions(BrandMark(brand), BrandMark(brand, { large: true }))),
    Card({ title: 'Boutons' },
      Block(Actions(Button('Par défaut'), Button('Principal', { variant: 'primary' }), Button('Danger', { variant: 'danger' }), Button('Lien', { variant: 'link' }))),
      Actions(ButtonLink('Lien bouton', { href: '#' }), ButtonLink('Indisponible', { disabled: true, title: 'Pourquoi c’est indisponible' })),
    ),
    Card({ title: 'Badges' }, Actions(Badge('Accent'), Badge('Succès', 'ok'), Badge('Attention', 'warn'), Badge('Danger', 'danger'), Badge('Neutre', 'neutral'))),
    Card({ title: 'Messages' },
      Block(Notice('info', 'Information. ', Link('Un lien', '#'), '.')),
      Block(Notice('ok', 'Succès.')),
      Block(Notice('warn', 'Attention.')),
      Notice('danger', 'Erreur.'),
    ),
    Card({ title: 'Texte' },
      Heading(1, 'Titre de niveau 1'),
      Heading(2, 'Titre de niveau 2'),
      Heading(3, 'Titre de niveau 3'),
      Text({}, 'Paragraphe courant, avec du ', Strong('texte fort'), ', du ', Code('code'), ' et un ', Link('lien', '#'), '.'),
      Text({ muted: true }, 'Paragraphe atténué.'),
      Text({ small: true }, 'Petit texte. ', Small(Muted('Petit et atténué.'))),
      List(['Premier élément', 'Second élément']),
    ),
    Card({ title: 'Champs' },
      FormRow(Field('Texte', Input({ placeholder: 'Saisie' })), Field('Liste', Select([{ value: 1, label: 'Première option' }, { value: 2, label: 'Seconde option' }]))),
      Field('Zone de texte', Textarea({ placeholder: 'Plusieurs lignes' })),
      Field('Désactivé', Input({ value: 'Non modifiable', disabled: true })),
      Actions(Checkbox({ checked: true }), Checkbox()),
    ),

    Heading(2, '3. Molécules'),
    Card({ title: 'Champ, rangée de formulaire, actions' },
      Form(
        FormRow(Field('Avec aide', Input(), { hint: 'Texte d’aide sous le champ.' }), Field('Étroit', Input({ type: 'number', value: 993 }), { size: 'narrow' }), CheckField('Case à cocher', Checkbox({ checked: true }), { size: 'narrow' })),
        Actions(Button('Valider', { variant: 'primary', onClick: () => toast('Notification affichée.') }), Button('Erreur', { onClick: () => toast('Notification d’erreur.', true) }), Spacer(), Button('À droite')),
      ),
    ),
    Card({ title: 'Carte', badges: [Badge('Avec badge', 'neutral'), Badge('3 à traiter')] },
      Block(Text({ muted: true }, 'Une carte regroupe un sujet : un titre, d’éventuels badges, un contenu.')),
      CardSection('Section de carte', Text({ small: true }, 'Une sous-partie titrée.')),
    ),
    Card({ title: 'Navigation et garantie' },
      NavItem({ href: '#', label: 'Entrée active', count: 4, current: true }),
      NavItem({ href: '#', label: 'Entrée', count: 12 }),
      Block(NavItem({ href: '#', label: 'Entrée sans compteur' })),
      Assurance('IA sans conservation de données (ZDR) : imposé à chaque requête'),
    ),
    Card({ title: 'Ligne d’email, corps de message, état vide' },
      sampleEmail({ badges: [Badge('Prioritaire', 'danger')] }),
      sampleEmail({ current: true, from: 'Sophie Leroy', subject: 'Report de notre rendez-vous', badges: [Badge('Non trié', 'warn'), Badge('Brouillon', 'neutral')] }),
      Message(Prose('Bonjour,\n\nCorps d’un message en texte brut, tel qu’il a été reçu.\n\nCordialement')),
      EmptyState('Rien à afficher.'),
    ),

    Heading(2, '4. Organismes'),
    Card({ title: 'En-tête de lecture' },
      ReadingHeader({ subject: 'Demande de devis pour 20 licences', meta: [['De ', Strong('Claire Martin <claire@client.example>'), ' · jeudi 19 novembre 2026 à 09:30']], triage: [Badge('Tri IA', 'neutral'), ' Une réponse est attendue.'] }),
    ),
    Card({ title: 'Boîte : liste et volet de lecture' },
      Mailbox({ title: 'À traiter', action: Button('Relever'), items: [sampleEmail({ current: true }), sampleEmail({ from: 'Marc Dubois', subject: 'Merci pour hier' })], backHref: '#', detail: Card({ title: 'Volet de lecture' }, Text({ muted: true }, 'Le contenu de l’email ouvert et la réponse.')) }),
    ),
    Card({ title: 'Panneau de connexion' },
      AuthPanel({ brand, tagline: brand.tagline, foot: 'Pied du panneau.' }, Form(Field('Email', Input({ type: 'email' })), Button('Se connecter', { variant: 'primary', block: true }))),
    ),
    Block(Text({ muted: true, small: true }, 'Le cadre de l’application (navigation latérale) est l’organisme AppShell : il se voit dans l’application elle-même.')),
  ),
);
