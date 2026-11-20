// Pages of the application. They hold behaviour and wording only: every element on screen
// comes from the design system in ./ui (atoms, molecules, organisms). No class name and
// no element is created here directly; a test enforces it.
import { Badge, Button, ButtonLink, Checkbox, Code, Heading, Input, Link, List, Muted, Notice, Prose, Select, Small, Spacer, Strong, Text, Textarea } from './ui/atoms.js';
import { Actions, Block, Card, CardSection, CheckField, EmailListItem, Field, Form, FormRow, Message, PageHeader, createToast } from './ui/molecules.js';
import { AppShell, AuthPanel, Mailbox, Page, ReadingHeader } from './ui/organisms.js';
import { loadBrand } from './ui/brand.js';

const root = document.getElementById('app');
const toast = createToast(document.getElementById('toast'));
let brand = { name: '', tagline: '', logo: null, logoDark: null };

// ---- helpers ----------------------------------------------------------------------------
class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function api(method, path, body) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: method === 'GET' ? {} : { 'content-type': 'application/json' },
    body: method === 'GET' ? undefined : JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || `Erreur ${res.status}`, res.status);
  return data;
}

/** Run an async action from a button: disables it meanwhile and reports failures. */
function busy(button, label, fn) {
  return async (event) => {
    event?.preventDefault();
    const original = button.textContent;
    button.disabled = true;
    button.textContent = label;
    try {
      await fn();
    } catch (e) {
      if (e.status === 401) return boot();
      toast(e.message, true);
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  };
}

/** A button wired to an async action. */
function ActionButton(label, busyLabel, fn, options) {
  const button = Button(label, options);
  button.addEventListener('click', busy(button, busyLabel, fn));
  return button;
}

/** A form whose submit button runs an async action. */
function SubmitForm(submit, busyLabel, fn, ...children) {
  const form = Form(children);
  form.addEventListener('submit', busy(submit, busyLabel, fn));
  return form;
}

const asDate = (iso) => new Date(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`);
const fmtDate = (iso) => {
  const d = asDate(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
};
const fmtFull = (iso) => asDate(iso).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' });
const splitAddresses = (s) => s.split(/[,;\s]+/).map((a) => a.trim()).filter(Boolean);
const roleLabel = (role) => (role === 'admin' ? 'Administrateur' : 'Utilisateur');

// ---- state & routing --------------------------------------------------------------------
const BOXES = [
  { id: 'todo', path: 'a-traiter', label: 'À traiter', empty: 'Rien à traiter. Lancez une synchronisation depuis Comptes.' },
  { id: 'none', path: 'sans-reponse', label: 'Sans réponse requise', empty: 'Aucun email écarté par le tri.' },
  { id: 'sent', path: 'repondus', label: 'Répondus', empty: 'Aucune réponse envoyée ni mise en brouillon pour l’instant.' },
  { id: 'ignored', path: 'ignores', label: 'Ignorés', empty: 'Aucun email ignoré.' },
];
const PAGES = [
  { path: 'comptes', label: 'Comptes mail' },
  { path: 'reglages', label: 'Réglages' },
  { path: 'prompts', label: 'Prompts', admin: true },
  { path: 'utilisateurs', label: 'Utilisateurs', admin: true },
];
const isAdmin = () => state.me?.role === 'admin';

const state = { me: null, counts: {} };

function route() {
  const [path, query = ''] = location.hash.replace(/^#\/?/, '').split('?');
  const [page = '', id] = path.split('/');
  return { page: page || 'a-traiter', id: id ? Number(id) : null, query: new URLSearchParams(query) };
}

const invitationToken = () => location.hash.match(/^#\/invitation\/([\w-]+)$/)?.[1] || null;

async function boot() {
  if (invitationToken()) return renderInvitation(invitationToken());
  try {
    state.me = await api('GET', '/me');
  } catch (e) {
    if (e.status !== 401) toast(e.message, true);
    state.me = null;
    return renderAuth();
  }
  render();
}

window.addEventListener('hashchange', () => (invitationToken() ? boot() : state.me && render()));

const guard = (fn) => async (...args) => {
  try {
    await fn(...args);
  } catch (e) {
    if (e.status === 401) return boot();
    toast(e.message, true);
  }
};

// ---- auth -------------------------------------------------------------------------------
async function renderAuth(mode = 'login', typedEmail = '') {
  const info = await api('GET', '/public').catch(() => ({ allowSignup: false }));
  const signup = mode === 'signup' && info.allowSignup;
  const email = Input({ type: 'email', required: true, autocomplete: 'username', value: typedEmail });
  const password = Input({ type: 'password', required: true, minLength: signup ? 10 : 1, autocomplete: signup ? 'new-password' : 'current-password' });
  const submit = Button(signup ? 'Créer mon compte' : 'Se connecter', { variant: 'primary', type: 'submit', block: true });
  const form = SubmitForm(submit, '…', async () => {
    await api('POST', signup ? '/auth/signup' : '/auth/login', { email: email.value, password: password.value });
    if (signup) location.hash = '#/comptes';
    await boot();
  }, Field('Email', email), Field('Mot de passe', password, { hint: signup && '10 caractères minimum.' }), submit);

  const foot = info.allowSignup
    ? [signup ? 'Déjà un compte ? ' : 'Pas encore de compte ? ', Button(signup ? 'Se connecter' : 'Créer un compte', { variant: 'link', onClick: () => renderAuth(signup ? 'login' : 'signup', email.value) })]
    : 'Pas de compte ? Demandez une invitation à votre administrateur.';

  root.replaceChildren(
    AuthPanel({ brand, tagline: brand.tagline, foot },
      info.firstAccount && Block(Notice('info', 'Aucun compte n’existe encore : le premier créé sera l’administrateur.')),
      form,
    ),
  );
  email.focus();
}

/** Landing page of an invitation link: the invited person only chooses a password. */
async function renderInvitation(token) {
  const leave = () => {
    // Drop the token from the address bar and the history.
    history.replaceState(null, '', '/');
    return boot();
  };
  let invitation;
  try {
    invitation = await api('POST', '/invitations/check', { token });
  } catch (e) {
    return root.replaceChildren(AuthPanel({ brand, tagline: brand.tagline }, Block(Notice('danger', e.message)), Button('Aller à la connexion', { onClick: leave })));
  }
  const password = Input({ type: 'password', required: true, minLength: 10, autocomplete: 'new-password' });
  const submit = Button('Créer mon compte', { variant: 'primary', type: 'submit', block: true });
  const form = SubmitForm(submit, '…', async () => {
    await api('POST', '/invitations/accept', { token, password: password.value });
    history.replaceState(null, '', '/#/comptes');
    await boot();
  },
    Field('Email', Input({ type: 'email', value: invitation.email, disabled: true, autocomplete: 'username' })),
    Field('Choisissez un mot de passe', password, { hint: '10 caractères minimum.' }),
    submit,
  );
  root.replaceChildren(AuthPanel({ brand, tagline: `Vous avez été invité à rejoindre ${brand.name}.` }, form));
  password.focus();
}

// ---- shell ------------------------------------------------------------------------------
function shell(content) {
  const current = route().page;
  const item = (path, label, count) => ({ href: `#/${path}`, label, count, current: current === path });
  root.replaceChildren(
    AppShell({
      brand,
      sections: [
        { title: 'Emails', items: BOXES.map((b) => item(b.path, b.label, state.counts[b.id])) },
        { title: 'Configuration', items: PAGES.filter((p) => !p.admin || isAdmin()).map((p) => item(p.path, p.label)) },
      ],
      assurance: {
        text: 'IA sans conservation de données (ZDR) : imposé à chaque requête',
        title: 'Chaque appel à l’IA impose zdr=true et data_collection=deny chez OpenRouter.',
      },
      user: state.me.email,
      logout: ActionButton('Déconnexion', '…', async () => {
        await api('POST', '/auth/logout');
        location.hash = '';
        await boot();
      }),
    }, content),
  );
}

function render() {
  const r = route();
  const box = BOXES.find((b) => b.path === r.page);
  if (box) return renderMailbox(box, r.id);
  if (r.page === 'prompts' && isAdmin()) return renderPrompts();
  if (r.page === 'utilisateurs' && isAdmin()) return renderUsers();
  if (r.page === 'comptes') return renderAccounts(r.query.get('erreur'));
  if (r.page === 'reglages') return renderSettings();
  location.hash = '#/a-traiter';
}

// ---- mailbox ----------------------------------------------------------------------------
const renderMailbox = guard(async (box, selectedId) => {
  const [{ emails, counts }, prompts] = await Promise.all([api('GET', `/emails?box=${box.id}`), api('GET', '/prompts')]);
  state.counts = counts;

  const refresh = ActionButton('Relever', 'Relève…', async () => {
    const accounts = await api('GET', '/accounts');
    if (!accounts.length) return void (location.hash = '#/comptes');
    let fetched = 0;
    const errors = [];
    for (const a of accounts) {
      const r = await api('POST', `/accounts/${a.id}/sync`);
      fetched += r.fetched;
      if (r.error) errors.push(`${a.email} : ${r.error}`);
    }
    if (errors.length) toast(errors.join(' — '), true);
    else toast(fetched ? `${fetched} email(s) relevé(s).` : 'Aucun nouvel email.');
    render();
  }, { title: 'Relever toutes les boîtes' });

  const detail = selectedId ? emailDetail(await api('GET', `/emails/${selectedId}`), prompts, box) : null;

  shell(
    Mailbox({
      title: box.label,
      action: refresh,
      empty: box.empty,
      backHref: `#/${box.path}`,
      detail,
      items: emails.map((e) =>
        EmailListItem({
          from: e.fromName || e.fromAddr,
          date: fmtDate(e.date),
          subject: e.subject || '(sans objet)',
          snippet: e.snippet,
          current: e.id === selectedId,
          onClick: () => (location.hash = `#/${box.path}/${e.id}`),
          badges: [
            e.status === 'pending' && Badge('Non trié', 'warn'),
            e.priority === 'high' && e.status !== 'sent' && Badge('Prioritaire', 'danger'),
            e.replyMode === 'draft' && Badge('Brouillon', 'neutral'),
          ],
        }),
      ),
    }),
  );
});

function emailDetail(email, prompts, box) {
  const sourceLabel = { ai: 'Tri IA', rule: 'Règle', user: 'Vous' }[email.triageSource];
  const pending = email.status === 'pending';
  const header = ReadingHeader({
    subject: email.subject || '(sans objet)',
    meta: [
      ['De ', Strong(email.fromName ? `${email.fromName} <${email.fromAddr}>` : email.fromAddr), ` · ${fmtFull(email.date)}`],
      [`À ${email.to.map((a) => a.address).join(', ') || email.account}`, email.cc.length ? ` · Cc ${email.cc.map((a) => a.address).join(', ')}` : ''],
    ],
    triage: (email.triageReason || pending) && [
      pending ? Badge('Non trié', 'warn') : Badge(sourceLabel || 'Tri', 'neutral'),
      ' ',
      pending ? 'Le tri automatique n’a pas encore eu lieu (clé OpenRouter manquante ou erreur).' : email.triageReason,
    ],
  });
  const original = Card({}, email.bodyText ? Message(Prose(email.bodyText)) : Text({ muted: true }, 'Contenu effacé (durée de conservation dépassée).'));

  if (email.status === 'sent' && email.reply) return [header, original, sentReply(email.reply)];
  return [header, original, composer(email, prompts, box)];
}

function sentReply(r) {
  const draft = r.mode === 'draft';
  return Card({
    title: draft ? 'Brouillon déposé dans votre boîte' : 'Réponse envoyée',
    badges: [Badge(r.wasEdited ? 'Proposition modifiée' : 'Proposition gardée telle quelle', r.wasEdited ? 'warn' : 'ok')],
  },
    Block(Text({ muted: true, small: true }, `${fmtFull(r.sentAt)} · À ${r.to.join(', ')}`, r.cc.length ? ` · Cc ${r.cc.join(', ')}` : '')),
    r.changeReason && Block(Text({ small: true }, Strong('Raison de la modification : '), r.changeReason)),
    draft && Block(Notice('info', 'Ce message n’est pas parti : il attend dans le dossier Brouillons de votre messagerie, où vous pouvez le compléter et l’envoyer.')),
    Message(Prose(r.finalText || '(texte effacé)')),
  );
}

function composer(email, prompts, box) {
  let draft = email.draft;
  const suggested = email.suggestedPromptId;
  const norm = (s) => s.replace(/\s+/g, ' ').trim();

  const promptSelect = Select(prompts.map((p) => ({
    value: p.id,
    label: p.id === suggested ? `${p.name} (suggéré par l’IA)` : p.name,
    selected: p.id === (draft?.promptId ?? suggested),
  })));
  const instructions = Input({ placeholder: 'Ex. : accepter, proposer jeudi 14 h', value: draft?.instructions || '' });
  const to = Input({ value: email.recipients.to.join(', ') });
  const cc = Input();
  const replyAll = Checkbox({ onchange: () => (cc.value = replyAll.checked ? email.recipientsAll.cc.join(', ') : '') });
  const text = Textarea({ tall: true, value: draft?.aiText || '', placeholder: 'La proposition de l’IA apparaîtra ici. Vous pouvez aussi écrire directement.' });
  const modelInfo = Small(draft ? `Proposition générée par ${draft.model}.` : '');
  const reason = Input({ placeholder: 'Ex. : trop formel, je tutoie ce client' });
  const reasonField = Field('Pourquoi cette modification ? (optionnel)', reason, { hint: 'Sera pris en compte dans vos prochaines propositions faites avec ce prompt.' });
  const syncReason = () => (reasonField.hidden = !draft || norm(text.value) === norm(draft.aiText));
  syncReason();
  text.addEventListener('input', syncReason);

  const generate = ActionButton('Proposer une réponse', 'Rédaction en cours…', async () => {
    if (draft && norm(text.value) !== norm(draft.aiText) && !confirm('Remplacer votre texte par une nouvelle proposition ?')) return;
    draft = await api('POST', `/emails/${email.id}/draft`, { promptId: Number(promptSelect.value), instructions: instructions.value });
    text.value = draft.aiText;
    modelInfo.textContent = `Proposition générée par ${draft.model}${draft.provider ? ` via ${draft.provider}` : ''}.`;
    syncReason();
  });

  const payload = () => ({
    draftId: draft?.id,
    text: text.value,
    to: splitAddresses(to.value),
    cc: splitAddresses(cc.value),
    changeReason: reasonField.hidden ? '' : reason.value,
  });
  const done = (message) => {
    toast(message);
    location.hash = `#/${box.path}`;
  };
  const send = ActionButton('Envoyer', 'Envoi…', async () => {
    const reply = payload();
    if (!confirm(`Envoyer cette réponse depuis ${email.account} à ${reply.to.join(', ')} ?`)) return;
    await api('POST', `/emails/${email.id}/send`, reply);
    done('Réponse envoyée.');
  }, { variant: 'primary' });
  const saveDraft = ActionButton('Enregistrer en brouillon', 'Enregistrement…', async () => {
    await api('POST', `/emails/${email.id}/save-draft`, payload());
    done(`Brouillon déposé dans la boîte ${email.account}.`);
  }, { title: 'Dépose la réponse dans le dossier Brouillons de votre messagerie, sans l’envoyer' });

  const setStatus = (status, message) => async () => {
    await api('POST', `/emails/${email.id}/status`, { status });
    done(message);
  };
  const triageActions = ['needs_reply', 'pending'].includes(email.status)
    ? [ActionButton('Pas de réponse nécessaire', '…', setStatus('no_reply', 'Classé sans réponse.')), ActionButton('Ignorer', '…', setStatus('ignored', 'Email ignoré.'))]
    : ActionButton('Remettre dans « À traiter »', '…', setStatus('needs_reply', 'Remis dans À traiter.'));

  return Card({ title: 'Votre réponse' },
    !state.me.hasKey && Block(Notice('warn', 'Aucune clé OpenRouter configurée : ajoutez-la dans ', Link('Réglages', '#/reglages'), ' pour obtenir des propositions.')),
    !prompts.length && Block(Notice('warn', isAdmin() ? ['Aucun prompt : créez-en un dans ', Link('Prompts', '#/prompts'), '.'] : 'Aucun prompt disponible : demandez à un administrateur d’en créer.')),
    FormRow(Field('Prompt', promptSelect), Field('Consignes (optionnel)', instructions), Field(null, generate, { size: 'fit' })),
    FormRow(Field('À', to), Field('Cc', cc)),
    email.recipientsAll.cc.length > 0 && CheckField('Répondre à tous', replyAll),
    Field('Texte', text, { hint: modelInfo }),
    reasonField,
    Actions(send, saveDraft, Spacer(), triageActions),
  );
}

// ---- prompts (administrators) -----------------------------------------------------------
const renderPrompts = guard(async () => {
  const prompts = await api('GET', '/prompts');

  async function editor(prompt) {
    const items = prompt ? await api('GET', `/prompts/${prompt.id}/corrections`).catch(() => []) : [];
    const name = Input({ required: true, value: prompt?.name || '' });
    const description = Input({ value: prompt?.description || '' });
    const system = Textarea({ required: true, rows: 7, value: prompt?.systemPrompt || '' });
    const save = Button(prompt ? 'Enregistrer' : 'Créer le prompt', { variant: 'primary', type: 'submit' });
    const form = SubmitForm(save, '…', async () => {
      const body = { name: name.value, description: description.value, systemPrompt: system.value };
      await (prompt ? api('PUT', `/prompts/${prompt.id}`, body) : api('POST', '/prompts', body));
      toast('Prompt enregistré.');
      renderPrompts();
    },
      Field('Nom', name),
      Field('Quand l’utiliser', description, { hint: 'L’IA lit cette description pour suggérer le bon prompt à chaque email.' }),
      Field('Instructions (system prompt)', system, { hint: 'Ton, structure, règles métier. Les consignes communes (langue de l’email, texte brut, ne rien inventer, signature) sont ajoutées automatiquement.' }),
      items.length > 0 && CardSection('Corrections apportées par les utilisateurs aux propositions de ce prompt',
        Block(Text({ muted: true, small: true }, 'Chacune ne s’applique qu’aux propositions de son auteur. Intégrez ici celles qui valent pour tous.')),
        Block(List(items.map((c) => [c.reason, Muted(` — ${c.user}, ${fmtDate(c.at)}`)]))),
      ),
      Actions(save, Button('Annuler', { onClick: () => renderPrompts() })),
    );
    shell(Page(Heading(1, 'Prompts'), Card({ title: prompt ? 'Modifier le prompt' : 'Nouveau prompt' }, form)));
    name.focus();
  }

  shell(
    Page(
      PageHeader('Prompts', Spacer(), Button('Nouveau prompt', { variant: 'primary', onClick: () => editor(null) })),
      Block(Text({ muted: true }, 'Chaque prompt décrit une façon de répondre. Ils sont communs à tous les utilisateurs : au tri, l’IA suggère le plus adapté, et chacun reste libre d’en choisir un autre pour chaque email. Les utilisateurs voient le nom et la description, pas les instructions.')),
      prompts.map((p) =>
        Card({ title: p.name, badges: [p.used > 0 && Badge(`${p.used} réponse(s), dont ${p.edited} modifiée(s)`, 'neutral')] },
          p.description && Block(Text({ muted: true }, p.description)),
          Block(Text({ small: true }, p.systemPrompt)),
          Actions(
            Button('Modifier', { onClick: () => editor(p) }),
            ActionButton('Supprimer', '…', async () => {
              if (!confirm(`Supprimer le prompt « ${p.name} » ?`)) return;
              await api('DELETE', `/prompts/${p.id}`);
              renderPrompts();
            }, { variant: 'danger' }),
          ),
        ),
      ),
    ),
  );
});

// ---- users (administrators) -------------------------------------------------------------
const renderUsers = guard(async (freshInvitation) => {
  const [users, invitations] = await Promise.all([api('GET', '/users'), api('GET', '/invitations')]);

  const email = Input({ type: 'email', required: true, placeholder: 'prenom.nom@exemple.com' });
  const role = Select([{ value: 'user', label: 'Utilisateur' }, { value: 'admin', label: 'Administrateur' }]);
  const invite = Button('Créer le lien d’invitation', { variant: 'primary', type: 'submit' });
  const inviteForm = SubmitForm(invite, '…', async () => renderUsers(await api('POST', '/invitations', { email: email.value, role: role.value })),
    FormRow(Field('Adresse email', email), Field('Rôle', role, { size: 'narrow' }), Field(null, invite, { size: 'fit' })),
  );

  let freshLink = null;
  if (freshInvitation?.link) {
    const link = Input({ readOnly: true, value: freshInvitation.link, onfocus: (e) => e.target.select() });
    const copy = Button('Copier', {
      onClick: async () => {
        try {
          await navigator.clipboard.writeText(freshInvitation.link);
          toast('Lien copié.');
        } catch {
          link.focus();
          toast('Copie impossible : sélectionnez le lien et copiez-le.', true);
        }
      },
    });
    freshLink = [
      Block(Notice('ok', Strong(`Lien d’invitation pour ${freshInvitation.email}`), ` — valable ${freshInvitation.validDays} jours, utilisable une seule fois. Transmettez-le vous-même : il ne sera plus affiché.`)),
      FormRow(Field(null, link), Field(null, copy, { size: 'fit' })),
    ];
  }

  shell(
    Page(
      Heading(1, 'Utilisateurs'),
      Block(Text({ muted: true }, 'Les administrateurs gèrent les prompts, les invitations et les rôles. Ils n’ont pas accès aux emails des autres utilisateurs.')),
      Card({ title: 'Inviter quelqu’un' },
        freshLink,
        inviteForm,
        invitations.length > 0 && CardSection('Invitations en attente',
          invitations.map((i) =>
            Actions(
              i.email,
              Badge(roleLabel(i.role), 'neutral'),
              i.expired ? Small('Expirée') : Small(Muted(`expire le ${fmtFull(i.expiresAt)}`)),
              Spacer(),
              ActionButton('Révoquer', '…', async () => {
                await api('DELETE', `/invitations/${i.id}`);
                renderUsers();
              }, { variant: 'link' }),
            ),
          ),
        ),
      ),
      users.map((u) => {
        const admin = u.role === 'admin';
        const self = u.email === state.me.email;
        return Card({ title: u.email, badges: [Badge(roleLabel(u.role), admin ? 'accent' : 'neutral'), self && Badge('Vous', 'neutral')] },
          Block(Text({ muted: true, small: true }, `Inscrit le ${fmtFull(u.createdAt)} · ${u.accounts} boîte(s) connectée(s)`)),
          Actions(
            ActionButton(admin ? 'Retirer le rôle administrateur' : 'Nommer administrateur', '…', async () => {
              await api('PUT', `/users/${u.id}`, { role: admin ? 'user' : 'admin' });
              if (self) return boot();
              renderUsers();
            }),
            !self && ActionButton('Supprimer le compte', '…', async () => {
              if (!confirm(`Supprimer le compte ${u.email} ? Ses boîtes connectées, emails et réponses enregistrés ici seront effacés. Sa messagerie n’est pas touchée.`)) return;
              await api('DELETE', `/users/${u.id}`);
              renderUsers();
            }, { variant: 'danger' }),
          ),
        );
      }),
    ),
  );
});

// ---- accounts ---------------------------------------------------------------------------
const KIND = { imap: 'IMAP / SMTP', google: 'Google', microsoft: 'Microsoft' };

const renderAccounts = guard(async (oauthError) => {
  const accounts = await api('GET', '/accounts');
  const { oauth } = state.me;

  const oauthButton = (kind, label) =>
    ButtonLink(label, { href: `/api/oauth/${kind}/start`, disabled: !oauth[kind], title: oauth[kind] ? undefined : `Non configuré sur ce serveur (variables ${kind.toUpperCase()}_CLIENT_ID / _SECRET)` });

  const email = Input({ type: 'email', required: true });
  const displayName = Input({ placeholder: 'Nom affiché aux destinataires' });
  const username = Input({ placeholder: 'Si différent de l’adresse', autocomplete: 'off' });
  const password = Input({ type: 'password', required: true, autocomplete: 'new-password' });
  const imapHost = Input({ required: true, placeholder: 'imap.exemple.com' });
  const imapPort = Input({ type: 'number', required: true, value: 993, min: 1, max: 65535 });
  const imapSecure = Checkbox({ checked: true });
  const smtpHost = Input({ required: true, placeholder: 'smtp.exemple.com' });
  const smtpPort = Input({ type: 'number', required: true, value: 465, min: 1, max: 65535 });
  const smtpSecure = Checkbox({ checked: true });
  imapPort.addEventListener('input', () => (imapSecure.checked = imapPort.value === '993'));
  smtpPort.addEventListener('input', () => (smtpSecure.checked = smtpPort.value === '465'));
  const connect = Button('Tester et connecter', { variant: 'primary', type: 'submit' });
  const form = SubmitForm(connect, 'Test de connexion…', async () => {
    await api('POST', '/accounts/imap', {
      email: email.value, displayName: displayName.value, username: username.value, password: password.value,
      imapHost: imapHost.value, imapPort: Number(imapPort.value), imapSecure: imapSecure.checked,
      smtpHost: smtpHost.value, smtpPort: Number(smtpPort.value), smtpSecure: smtpSecure.checked,
    });
    toast('Boîte connectée. Première relève en cours…');
    renderAccounts();
  },
    FormRow(Field('Adresse email', email), Field('Nom', displayName)),
    FormRow(Field('Identifiant', username), Field('Mot de passe', password)),
    FormRow(Field('Serveur IMAP', imapHost), Field('Port', imapPort, { size: 'narrow' }), CheckField('TLS direct', imapSecure, { size: 'narrow' })),
    FormRow(Field('Serveur SMTP', smtpHost), Field('Port', smtpPort, { size: 'narrow' }), CheckField('TLS direct', smtpSecure, { size: 'narrow' })),
    Block(Text({ muted: true, small: true }, 'TLS direct : ports 993 (IMAP) et 465 (SMTP). Décoché, la connexion passe par STARTTLS (143 / 587). Le mot de passe est chiffré en base ; préférez un mot de passe d’application.')),
    connect,
  );

  shell(
    Page(
      Heading(1, 'Comptes mail'),
      oauthError && Block(Notice('danger', `Connexion échouée : ${oauthError}`)),
      accounts.length === 0 && Block(Notice('info', 'Connectez une première boîte mail pour commencer.')),
      accounts.map((a) =>
        Card({ title: a.email, badges: [Badge(KIND[a.kind], 'neutral'), a.todo > 0 && Badge(`${a.todo} à traiter`)] },
          Block(Text({ muted: true, small: true }, a.lastSyncAt ? `Dernière relève : ${fmtFull(a.lastSyncAt)}` : 'Jamais relevée')),
          a.lastError && Block(Notice('danger', a.lastError)),
          Actions(
            ActionButton('Relever maintenant', 'Relève…', async () => {
              const r = await api('POST', `/accounts/${a.id}/sync`);
              if (r.error) toast(r.error, true);
              else toast(`${r.fetched} email(s) relevé(s), ${r.triaged} trié(s) par l’IA.`);
              renderAccounts();
            }),
            ActionButton('Déconnecter', '…', async () => {
              if (!confirm(`Déconnecter ${a.email} ? Les emails et réponses enregistrés ici seront supprimés (votre boîte n’est pas touchée).`)) return;
              await api('DELETE', `/accounts/${a.id}`);
              renderAccounts();
            }, { variant: 'danger' }),
          ),
        ),
      ),
      Card({ title: 'Connecter avec OAuth' },
        Block(Text({ muted: true }, 'Aucun mot de passe n’est saisi ici : vous autorisez l’accès chez Google ou Microsoft (lecture de la boîte de réception, brouillons et envoi).')),
        Actions(oauthButton('google', 'Connecter Gmail / Google Workspace'), oauthButton('microsoft', 'Connecter Outlook / Microsoft 365')),
      ),
      Card({ title: 'Connecter en IMAP / SMTP' }, form),
    ),
  );
});

// ---- settings ---------------------------------------------------------------------------
const renderSettings = guard(async () => {
  state.me = await api('GET', '/me');
  const me = state.me;
  const model = Input({ value: me.model, placeholder: me.defaultModel });
  const signature = Textarea({ rows: 4, placeholder: 'Cordialement,\nPrénom Nom', value: me.signature });
  const key = Input({ type: 'password', autocomplete: 'off', placeholder: me.hasOwnKey ? '•••••••• (enregistrée)' : me.hasKey ? 'Clé du serveur utilisée' : 'sk-or-…' });
  const save = Button('Enregistrer', { variant: 'primary', type: 'submit' });
  const form = SubmitForm(save, '…', async () => {
    const body = { model: model.value === me.defaultModel ? '' : model.value, signature: signature.value };
    if (key.value) body.openrouterKey = key.value;
    await api('PUT', '/settings', body);
    toast('Réglages enregistrés.');
    renderSettings();
  },
    Field('Modèle OpenRouter', model, { hint: `Identifiant « fournisseur/modèle ». Laisser vide pour le modèle du serveur (${me.defaultModel}). Le modèle doit avoir au moins un fournisseur ZDR, sinon la requête est refusée.` }),
    Field('Signature', signature, { hint: 'Ajoutée telle quelle à la fin de chaque proposition.' }),
    Field('Clé API OpenRouter personnelle', key, { hint: me.hasOwnKey ? 'Laissez vide pour conserver la clé actuelle.' : 'Chiffrée en base. Laissez vide pour utiliser la clé du serveur.' }),
    Actions(save, me.hasOwnKey && ActionButton('Supprimer ma clé', '…', async () => {
      await api('PUT', '/settings', { openrouterKey: '' });
      toast('Clé personnelle supprimée.');
      renderSettings();
    }, { variant: 'danger' })),
  );

  shell(
    Page(
      Heading(1, 'Réglages'),
      !me.hasKey && Block(Notice('warn', 'Aucune clé OpenRouter : le tri automatique et les propositions sont désactivés.')),
      Card({ title: 'Rédaction' }, form),
      Card({ title: 'Confidentialité' },
        List([
          ['Chaque requête envoyée à OpenRouter porte ', Code(`provider: ${JSON.stringify(me.privacy)}`), '. Ce n’est pas désactivable : si aucun fournisseur du modèle ne garantit la non-conservation et le non-entraînement, la requête échoue au lieu d’être routée ailleurs.'],
          'Dans votre compte OpenRouter, laissez désactivée la journalisation des prompts (Settings → Privacy) : ce réglage dépend de votre compte, pas de cette application.',
          'Newsletters et notifications sont écartées par des règles locales et ne sont jamais envoyées à l’IA.',
          me.retentionDays ? `Le contenu des emails est effacé de cette application après ${me.retentionDays} jours.` : 'Le contenu des emails est conservé sans limite dans cette application.',
          'Mots de passe, tokens OAuth et clés API sont chiffrés en base (AES-256-GCM).',
          'Aucun email n’est envoyé sans votre validation explicite.',
          'Les raisons que vous donnez en modifiant une proposition sont visibles des administrateurs, qui s’en servent pour améliorer les prompts. Vos emails ne le sont pas.',
        ]),
      ),
      isAdmin() && Card({ title: 'Apparence' },
        Text({}, 'Couleurs, typographie, logo et nom viennent du dossier de marque du serveur. ', Link('Voir le guide de style', '/styleguide.html'), ' pour vérifier le rendu de tous les composants.'),
      ),
    ),
  );
});

loadBrand().then((loaded) => {
  brand = loaded;
  boot();
});
