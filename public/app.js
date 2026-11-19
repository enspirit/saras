// mailia — interface. Vanilla JS, no build step. All user/mail content goes through
// textContent (never innerHTML), so an email cannot inject markup.

const root = document.getElementById('app');
const toastEl = document.getElementById('toast');

// ---- helpers ----------------------------------------------------------------------------
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k in el && k !== 'list' && k !== 'form') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

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

let toastTimer;
function toast(message, isError = false) {
  toastEl.textContent = message;
  toastEl.className = isError ? 'error' : '';
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toastEl.hidden = true), isError ? 8000 : 3500);
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

const fmtDate = (iso) => {
  const d = new Date(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
};
const fmtFull = (iso) => new Date(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' });
const splitAddresses = (s) => s.split(/[,;\s]+/).map((a) => a.trim()).filter(Boolean);
const field = (label, control, hint) => h('div', { class: 'field' }, h('label', {}, label, control), hint && h('p', { class: 'muted small' }, hint));

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

// ---- auth -------------------------------------------------------------------------------
async function renderAuth(mode = 'login', typedEmail = '') {
  const info = await api('GET', '/public').catch(() => ({ allowSignup: false }));
  const signup = mode === 'signup' && info.allowSignup;
  const email = h('input', { type: 'email', required: true, autocomplete: 'username', value: typedEmail });
  const password = h('input', { type: 'password', required: true, minLength: signup ? 10 : 1, autocomplete: signup ? 'new-password' : 'current-password' });
  const submit = h('button', { class: 'btn primary', type: 'submit' }, signup ? 'Créer mon compte' : 'Se connecter');
  const form = h('form', {}, field('Email', email), field('Mot de passe', password, signup && '10 caractères minimum.'), submit);
  form.addEventListener(
    'submit',
    busy(submit, '…', async () => {
      await api('POST', signup ? '/auth/signup' : '/auth/login', { email: email.value, password: password.value });
      if (signup) location.hash = '#/comptes';
      await boot();
    }),
  );
  root.replaceChildren(
    h('div', { class: 'auth' },
      h('div', { class: 'auth-card' },
        h('h1', {}, 'mailia'),
        h('p', { class: 'muted' }, 'Vos réponses aux emails, proposées par l’IA, validées par vous.'),
        info.firstAccount && h('p', { class: 'notice field' }, 'Aucun compte n’existe encore : le premier créé sera l’administrateur.'),
        form,
        !info.allowSignup && h('p', { class: 'small muted' }, 'Pas de compte ? Demandez une invitation à votre administrateur.'),
        info.allowSignup &&
          h('p', { class: 'small muted' },
            signup ? 'Déjà un compte ? ' : 'Pas encore de compte ? ',
            h('button', { class: 'btn link', type: 'button', onclick: () => renderAuth(signup ? 'login' : 'signup', email.value) }, signup ? 'Se connecter' : 'Créer un compte'),
          ),
      ),
    ),
  );
  email.focus();
}

/** Landing page of an invitation link: the invited person only chooses a password. */
async function renderInvitation(token) {
  const card = (...children) => root.replaceChildren(h('div', { class: 'auth' }, h('div', { class: 'auth-card' }, h('h1', {}, 'mailia'), ...children)));
  const leave = () => {
    // Drop the token from the address bar and the history.
    history.replaceState(null, '', '/');
    return boot();
  };
  let invitation;
  try {
    invitation = await api('POST', '/invitations/check', { token });
  } catch (e) {
    return card(h('p', { class: 'notice danger field' }, e.message), h('button', { class: 'btn', type: 'button', onclick: leave }, 'Aller à la connexion'));
  }
  const password = h('input', { type: 'password', required: true, minLength: 10, autocomplete: 'new-password' });
  const submit = h('button', { class: 'btn primary', type: 'submit' }, 'Créer mon compte');
  const form = h('form', {},
    field('Email', h('input', { type: 'email', value: invitation.email, disabled: true, autocomplete: 'username' })),
    field('Choisissez un mot de passe', password, '10 caractères minimum.'),
    submit,
  );
  form.addEventListener('submit', busy(submit, '…', async () => {
    await api('POST', '/invitations/accept', { token, password: password.value });
    history.replaceState(null, '', '/#/comptes');
    await boot();
  }));
  card(h('p', { class: 'muted' }, 'Vous avez été invité à rejoindre mailia.'), form);
  password.focus();
}

// ---- shell ------------------------------------------------------------------------------
function navLink(path, label, count) {
  const current = route().page === path;
  return h('a', { href: `#/${path}`, 'aria-current': current ? 'page' : null }, h('span', {}, label), count ? h('span', { class: 'count' }, count) : null);
}

function shell(content) {
  const logout = h('button', { class: 'btn', type: 'button' }, 'Déconnexion');
  logout.addEventListener('click', busy(logout, '…', async () => {
    await api('POST', '/auth/logout');
    location.hash = '';
    await boot();
  }));
  root.replaceChildren(
    h('div', { class: 'shell' },
      h('nav', { class: 'nav' },
        h('div', { class: 'brand' }, 'mailia'),
        h('div', { class: 'nav-title' }, 'Emails'),
        BOXES.map((b) => navLink(b.path, b.label, state.counts[b.id])),
        h('div', { class: 'nav-title' }, 'Configuration'),
        PAGES.filter((p) => !p.admin || isAdmin()).map((p) => navLink(p.path, p.label)),
        h('div', { class: 'nav-foot' },
          h('div', { class: 'shield', title: 'Chaque appel à l’IA impose zdr=true et data_collection=deny chez OpenRouter.' }, 'IA sans conservation de données (ZDR) : imposé à chaque requête'),
          h('div', { class: 'small muted' }, state.me.email),
          logout,
        ),
      ),
      h('main', { class: 'main' }, content),
    ),
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

const guard = (fn) => async (...args) => {
  try {
    await fn(...args);
  } catch (e) {
    if (e.status === 401) return boot();
    toast(e.message, true);
  }
};

// ---- mailbox ----------------------------------------------------------------------------
const renderMailbox = guard(async (box, selectedId) => {
  const [{ emails, counts }, prompts] = await Promise.all([api('GET', `/emails?box=${box.id}`), api('GET', '/prompts')]);
  state.counts = counts;

  const refresh = h('button', { class: 'btn', type: 'button', title: 'Relever toutes les boîtes' }, 'Relever');
  refresh.addEventListener('click', busy(refresh, 'Relève…', async () => {
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
  }));

  const list = h('section', { class: 'list' },
    h('div', { class: 'list-head' }, h('h2', {}, box.label), refresh),
    emails.length
      ? emails.map((e) =>
          h('button', { class: 'item', type: 'button', 'aria-current': e.id === selectedId ? 'true' : null, onclick: () => (location.hash = `#/${box.path}/${e.id}`) },
            h('div', { class: 'item-top' }, h('span', { class: 'item-from' }, e.fromName || e.fromAddr), h('span', { class: 'item-date' }, fmtDate(e.date))),
            h('div', { class: 'item-subject' }, e.subject || '(sans objet)'),
            h('div', { class: 'item-snippet' }, e.snippet),
            h('div', { class: 'item-tags' },
              e.status === 'pending' && h('span', { class: 'badge warn' }, 'Non trié'),
              e.priority === 'high' && e.status !== 'sent' && h('span', { class: 'badge danger' }, 'Prioritaire'),
              e.replyMode === 'draft' && h('span', { class: 'badge plain' }, 'Brouillon'),
            ),
          ),
        )
      : h('div', { class: 'empty' }, box.empty),
  );

  const detail = h('section', { class: 'detail' });
  shell(h('div', { class: `mailbox${selectedId ? ' has-detail' : ''}` }, list, detail));
  if (!selectedId) return void detail.append(h('div', { class: 'empty' }, emails.length ? 'Sélectionnez un email.' : ''));
  renderDetail(detail, await api('GET', `/emails/${selectedId}`), prompts, box);
});

function renderDetail(detail, email, prompts, box) {
  const sourceLabel = { ai: 'Tri IA', rule: 'Règle', user: 'Vous' }[email.triageSource];
  const setStatus = (status, message) => async () => {
    await api('POST', `/emails/${email.id}/status`, { status });
    toast(message);
    location.hash = `#/${box.path}`;
  };

  detail.append(
    h('a', { class: 'btn back', href: `#/${box.path}` }, '← Retour'),
    h('div', { class: 'detail-head' },
      h('h1', {}, email.subject || '(sans objet)'),
      h('p', { class: 'meta' }, 'De ', h('strong', {}, email.fromName ? `${email.fromName} <${email.fromAddr}>` : email.fromAddr), ` · ${fmtFull(email.date)}`),
      h('p', { class: 'meta' }, `À ${email.to.map((a) => a.address).join(', ') || email.account}`, email.cc.length ? ` · Cc ${email.cc.map((a) => a.address).join(', ')}` : ''),
      (email.triageReason || email.status === 'pending') &&
        h('p', { class: 'triage' },
          email.status === 'pending' ? h('span', { class: 'badge warn' }, 'Non trié') : h('span', { class: 'badge plain' }, sourceLabel || 'Tri'),
          ' ',
          email.status === 'pending' ? 'Le tri automatique n’a pas encore eu lieu (clé OpenRouter manquante ou erreur).' : email.triageReason,
        ),
    ),
    h('div', { class: 'card' }, email.bodyText ? h('pre', { class: 'mail-body' }, email.bodyText) : h('p', { class: 'muted' }, 'Contenu effacé (durée de conservation dépassée).')),
  );

  if (email.status === 'sent' && email.reply) {
    const r = email.reply;
    detail.append(
      h('div', { class: 'card' },
        h('div', { class: 'card-head' },
          h('h2', {}, r.mode === 'draft' ? 'Brouillon déposé dans votre boîte' : 'Réponse envoyée'),
          h('span', { class: `badge ${r.wasEdited ? 'warn' : 'ok'}` }, r.wasEdited ? 'Proposition modifiée' : 'Proposition gardée telle quelle'),
        ),
        h('p', { class: 'meta' }, `${fmtFull(r.sentAt)} · À ${r.to.join(', ')}`, r.cc.length ? ` · Cc ${r.cc.join(', ')}` : ''),
        r.changeReason && h('p', { class: 'triage' }, h('strong', {}, 'Raison de la modification : '), r.changeReason),
        r.mode === 'draft' && h('p', { class: 'notice field' }, 'Ce message n’est pas parti : il attend dans le dossier Brouillons de votre messagerie, où vous pouvez le compléter et l’envoyer.'),
        h('pre', { class: 'mail-body' }, r.finalText || '(texte effacé)'),
      ),
    );
    return;
  }

  // -- composer --
  let draft = email.draft;
  const suggested = email.suggestedPromptId;
  const promptSelect = h('select', {},
    prompts.map((p) => h('option', { value: p.id, selected: p.id === (draft?.promptId ?? suggested) }, p.id === suggested ? `${p.name} (suggéré par l’IA)` : p.name)),
  );
  const instructions = h('input', { type: 'text', placeholder: 'Ex. : accepter, proposer jeudi 14 h', value: draft?.instructions || '' });
  const generate = h('button', { class: 'btn', type: 'button' }, 'Proposer une réponse');
  const to = h('input', { type: 'text', value: email.recipients.to.join(', ') });
  const cc = h('input', { type: 'text', value: '' });
  const hasOthers = email.recipientsAll.cc.length > 0;
  const replyAll = h('input', { type: 'checkbox' });
  replyAll.addEventListener('change', () => (cc.value = replyAll.checked ? email.recipientsAll.cc.join(', ') : ''));
  const text = h('textarea', { class: 'reply', placeholder: 'La proposition de l’IA apparaîtra ici. Vous pouvez aussi écrire directement.' });
  text.value = draft?.aiText || '';
  const reason = h('input', { type: 'text', placeholder: 'Ex. : trop formel, je tutoie ce client' });
  const reasonField = h('div', { class: 'field', hidden: true },
    h('label', {}, 'Pourquoi cette modification ? (optionnel)', reason),
    h('p', { class: 'muted small' }, 'Sera pris en compte dans les prochaines propositions faites avec ce prompt.'),
  );
  const modelInfo = h('p', { class: 'muted small' }, draft ? `Proposition générée par ${draft.model}.` : '');
  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  const syncReason = () => (reasonField.hidden = !draft || norm(text.value) === norm(draft.aiText));
  text.addEventListener('input', syncReason);

  generate.addEventListener('click', busy(generate, 'Rédaction en cours…', async () => {
    if (draft && norm(text.value) !== norm(draft.aiText) && !confirm('Remplacer votre texte par une nouvelle proposition ?')) return;
    draft = await api('POST', `/emails/${email.id}/draft`, { promptId: Number(promptSelect.value), instructions: instructions.value });
    text.value = draft.aiText;
    modelInfo.textContent = `Proposition générée par ${draft.model}${draft.provider ? ` via ${draft.provider}` : ''}.`;
    syncReason();
  }));

  const replyPayload = () => ({
    draftId: draft?.id,
    text: text.value,
    to: splitAddresses(to.value),
    cc: splitAddresses(cc.value),
    changeReason: reasonField.hidden ? '' : reason.value,
  });
  const send = h('button', { class: 'btn primary', type: 'button' }, 'Envoyer');
  send.addEventListener('click', busy(send, 'Envoi…', async () => {
    const payload = replyPayload();
    if (!confirm(`Envoyer cette réponse depuis ${email.account} à ${payload.to.join(', ')} ?`)) return;
    await api('POST', `/emails/${email.id}/send`, payload);
    toast('Réponse envoyée.');
    location.hash = `#/${box.path}`;
  }));
  const saveDraft = h('button', { class: 'btn', type: 'button', title: 'Dépose la réponse dans le dossier Brouillons de votre messagerie, sans l’envoyer' }, 'Enregistrer en brouillon');
  saveDraft.addEventListener('click', busy(saveDraft, 'Enregistrement…', async () => {
    await api('POST', `/emails/${email.id}/save-draft`, replyPayload());
    toast(`Brouillon déposé dans la boîte ${email.account}.`);
    location.hash = `#/${box.path}`;
  }));

  const noReply = h('button', { class: 'btn', type: 'button' }, 'Pas de réponse nécessaire');
  noReply.addEventListener('click', busy(noReply, '…', setStatus('no_reply', 'Classé sans réponse.')));
  const ignore = h('button', { class: 'btn', type: 'button' }, 'Ignorer');
  ignore.addEventListener('click', busy(ignore, '…', setStatus('ignored', 'Email ignoré.')));
  const restore = h('button', { class: 'btn', type: 'button' }, 'Remettre dans « À traiter »');
  restore.addEventListener('click', busy(restore, '…', setStatus('needs_reply', 'Remis dans À traiter.')));
  const inTodo = ['needs_reply', 'pending'].includes(email.status);

  detail.append(
    h('div', { class: 'card composer' },
      h('h2', {}, 'Votre réponse'),
      !state.me.hasKey && h('p', { class: 'notice warn field' }, 'Aucune clé OpenRouter configurée : ajoutez-la dans ', h('a', { href: '#/reglages' }, 'Réglages'), ' pour obtenir des propositions.'),
      !prompts.length && h('p', { class: 'notice warn field' }, isAdmin() ? ['Aucun prompt : créez-en un dans ', h('a', { href: '#/prompts' }, 'Prompts'), '.'] : 'Aucun prompt disponible : demandez à un administrateur d’en créer.'),
      h('div', { class: 'row' },
        field('Prompt', promptSelect),
        field('Consignes (optionnel)', instructions),
        h('div', { class: 'field' }, generate),
      ),
      h('div', { class: 'row' }, field('À', to), field('Cc', cc)),
      hasOthers && h('div', { class: 'field' }, h('label', { class: 'check' }, replyAll, 'Répondre à tous')),
      h('div', { class: 'field' }, h('label', {}, 'Texte', text), modelInfo),
      reasonField,
      h('div', { class: 'actions' }, send, saveDraft, h('span', { class: 'spacer' }), inTodo ? [noReply, ignore] : restore),
    ),
  );
}

// ---- prompts ----------------------------------------------------------------------------
const renderPrompts = guard(async () => {
  const prompts = await api('GET', '/prompts');
  const page = h('div', { class: 'page' });

  function editor(prompt) {
    const name = h('input', { type: 'text', required: true, value: prompt?.name || '' });
    const description = h('input', { type: 'text', value: prompt?.description || '' });
    const system = h('textarea', { required: true, rows: 7 });
    system.value = prompt?.systemPrompt || '';
    const save = h('button', { class: 'btn primary', type: 'submit' }, prompt ? 'Enregistrer' : 'Créer le prompt');
    const lessons = h('div', {});
    const form = h('form', { class: 'card' },
      h('h2', {}, prompt ? 'Modifier le prompt' : 'Nouveau prompt'),
      field('Nom', name),
      field('Quand l’utiliser', description, 'L’IA lit cette description pour suggérer le bon prompt à chaque email.'),
      field('Instructions (system prompt)', system, 'Ton, structure, règles métier. Les consignes communes (langue de l’email, texte brut, ne rien inventer, signature) sont ajoutées automatiquement.'),
      lessons,
      h('div', { class: 'actions' }, save, h('button', { class: 'btn', type: 'button', onclick: renderPrompts }, 'Annuler')),
    );
    form.addEventListener('submit', busy(save, '…', async () => {
      const body = { name: name.value, description: description.value, systemPrompt: system.value };
      await (prompt ? api('PUT', `/prompts/${prompt.id}`, body) : api('POST', '/prompts', body));
      toast('Prompt enregistré.');
      renderPrompts();
    }));
    if (prompt) {
      api('GET', `/prompts/${prompt.id}/corrections`).then((items) => {
        if (!items.length) return;
        lessons.append(
          h('div', { class: 'field' },
            h('label', {}, 'Corrections apportées par les utilisateurs aux propositions de ce prompt'),
            h('p', { class: 'muted small' }, 'Chacune ne s’applique qu’aux propositions de son auteur. Intégrez ici celles qui valent pour tous.'),
            h('ul', { class: 'small' }, items.map((c) => h('li', {}, c.reason, h('span', { class: 'muted' }, ` — ${c.user}, ${fmtDate(c.at)}`)))),
          ),
        );
      }).catch(() => {});
    }
    page.replaceChildren(h('h1', {}, 'Prompts'), form);
    name.focus();
  }

  page.append(
    h('div', { class: 'page-head' }, h('h1', {}, 'Prompts'), h('span', { class: 'spacer' }), h('button', { class: 'btn primary', type: 'button', onclick: () => editor(null) }, 'Nouveau prompt')),
    h('p', { class: 'muted field' }, 'Chaque prompt décrit une façon de répondre. Ils sont communs à tous les utilisateurs : au tri, l’IA suggère le plus adapté, et chacun reste libre d’en choisir un autre pour chaque email. Les utilisateurs voient le nom et la description, pas les instructions.'),
    ...prompts.map((p) => {
      const del = h('button', { class: 'btn danger', type: 'button' }, 'Supprimer');
      del.addEventListener('click', busy(del, '…', async () => {
        if (!confirm(`Supprimer le prompt « ${p.name} » ?`)) return;
        await api('DELETE', `/prompts/${p.id}`);
        renderPrompts();
      }));
      return h('div', { class: 'card' },
        h('div', { class: 'card-head' },
          h('h2', {}, p.name),
          p.used > 0 && h('span', { class: 'badge plain' }, `${p.used} réponse(s), dont ${p.edited} modifiée(s)`),
        ),
        p.description && h('p', { class: 'muted field' }, p.description),
        h('p', { class: 'small field' }, p.systemPrompt),
        h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: () => editor(p) }, 'Modifier'), del),
      );
    }),
  );
  shell(page);
});

// ---- users (administrators) -------------------------------------------------------------
const renderUsers = guard(async (freshInvitation) => {
  const [users, invitations] = await Promise.all([api('GET', '/users'), api('GET', '/invitations')]);

  const email = h('input', { type: 'email', required: true, placeholder: 'prenom.nom@exemple.com' });
  const role = h('select', {}, h('option', { value: 'user' }, 'Utilisateur'), h('option', { value: 'admin' }, 'Administrateur'));
  const invite = h('button', { class: 'btn primary', type: 'submit' }, 'Créer le lien d’invitation');
  const inviteForm = h('form', {}, h('div', { class: 'row' }, field('Adresse email', email), h('div', { class: 'field narrow' }, h('label', {}, 'Rôle', role)), h('div', { class: 'field' }, invite)));
  inviteForm.addEventListener('submit', busy(invite, '…', async () => {
    renderUsers(await api('POST', '/invitations', { email: email.value, role: role.value }));
  }));

  let linkBox = null;
  if (freshInvitation?.link) {
    const link = h('input', { type: 'text', readOnly: true, value: freshInvitation.link, onfocus: (e) => e.target.select() });
    const copy = h('button', { class: 'btn', type: 'button' }, 'Copier');
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(freshInvitation.link);
        toast('Lien copié.');
      } catch {
        link.focus();
        toast('Copie impossible : sélectionnez le lien et copiez-le.', true);
      }
    });
    linkBox = h('div', { class: 'notice ok field' },
      h('p', { class: 'field' }, h('strong', {}, `Lien d’invitation pour ${freshInvitation.email}`), ` — valable ${freshInvitation.validDays} jours, utilisable une seule fois. Transmettez-le vous-même : il ne sera plus affiché.`),
      h('div', { class: 'row' }, h('div', { class: 'field' }, link), h('div', { class: 'field narrow' }, copy)),
    );
  }

  shell(
    h('div', { class: 'page' },
      h('h1', {}, 'Utilisateurs'),
      h('p', { class: 'muted field' }, 'Les administrateurs gèrent les prompts, les invitations et les rôles. Ils n’ont pas accès aux emails des autres utilisateurs.'),
      h('div', { class: 'card' },
        h('h2', {}, 'Inviter quelqu’un'),
        linkBox,
        inviteForm,
        invitations.length > 0 && h('div', {},
          h('h3', {}, 'Invitations en attente'),
          ...invitations.map((i) => {
            const revoke = h('button', { class: 'btn link', type: 'button' }, 'Révoquer');
            revoke.addEventListener('click', busy(revoke, '…', async () => {
              await api('DELETE', `/invitations/${i.id}`);
              renderUsers();
            }));
            return h('div', { class: 'actions' },
              h('span', {}, i.email),
              h('span', { class: 'badge plain' }, i.role === 'admin' ? 'Administrateur' : 'Utilisateur'),
              h('span', { class: `small ${i.expired ? '' : 'muted'}` }, i.expired ? 'Expirée' : `expire le ${fmtFull(i.expiresAt)}`),
              h('span', { class: 'spacer' }),
              revoke,
            );
          }),
        ),
      ),
      ...users.map((u) => {
        const admin = u.role === 'admin';
        const self = u.email === state.me.email;
        const toggle = h('button', { class: 'btn', type: 'button' }, admin ? 'Retirer le rôle administrateur' : 'Nommer administrateur');
        toggle.addEventListener('click', busy(toggle, '…', async () => {
          await api('PUT', `/users/${u.id}`, { role: admin ? 'user' : 'admin' });
          if (self) return boot();
          renderUsers();
        }));
        const del = h('button', { class: 'btn danger', type: 'button' }, 'Supprimer le compte');
        del.addEventListener('click', busy(del, '…', async () => {
          if (!confirm(`Supprimer le compte ${u.email} ? Ses boîtes connectées, emails et réponses enregistrés ici seront effacés. Sa messagerie n’est pas touchée.`)) return;
          await api('DELETE', `/users/${u.id}`);
          renderUsers();
        }));
        return h('div', { class: 'card' },
          h('div', { class: 'card-head' },
            h('h2', {}, u.email),
            h('span', { class: `badge ${admin ? '' : 'plain'}` }, admin ? 'Administrateur' : 'Utilisateur'),
            self && h('span', { class: 'badge plain' }, 'Vous'),
          ),
          h('p', { class: 'muted small field' }, `Inscrit le ${fmtFull(u.createdAt)} · ${u.accounts} boîte(s) connectée(s)`),
          h('div', { class: 'actions' }, toggle, !self && del),
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
    oauth[kind]
      ? h('a', { class: 'btn', href: `/api/oauth/${kind}/start` }, label)
      : h('span', { class: 'btn', 'aria-disabled': 'true', title: `Non configuré sur ce serveur (variables ${kind.toUpperCase()}_CLIENT_ID / _SECRET)` }, label);

  // IMAP form
  const email = h('input', { type: 'email', required: true });
  const displayName = h('input', { type: 'text', placeholder: 'Nom affiché aux destinataires' });
  const username = h('input', { type: 'text', placeholder: 'Si différent de l’adresse', autocomplete: 'off' });
  const password = h('input', { type: 'password', required: true, autocomplete: 'new-password' });
  const imapHost = h('input', { type: 'text', required: true, placeholder: 'imap.exemple.com' });
  const imapPort = h('input', { type: 'number', required: true, value: 993, min: 1, max: 65535 });
  const imapSecure = h('input', { type: 'checkbox', checked: true });
  const smtpHost = h('input', { type: 'text', required: true, placeholder: 'smtp.exemple.com' });
  const smtpPort = h('input', { type: 'number', required: true, value: 465, min: 1, max: 65535 });
  const smtpSecure = h('input', { type: 'checkbox', checked: true });
  imapPort.addEventListener('input', () => (imapSecure.checked = imapPort.value === '993'));
  smtpPort.addEventListener('input', () => (smtpSecure.checked = smtpPort.value === '465'));
  const connect = h('button', { class: 'btn primary', type: 'submit' }, 'Tester et connecter');
  const form = h('form', {},
    h('div', { class: 'row' }, field('Adresse email', email), field('Nom', displayName)),
    h('div', { class: 'row' }, field('Identifiant', username), field('Mot de passe', password)),
    h('div', { class: 'row' },
      field('Serveur IMAP', imapHost),
      h('div', { class: 'field narrow' }, h('label', {}, 'Port', imapPort)),
      h('div', { class: 'field narrow' }, h('label', { class: 'check' }, imapSecure, 'TLS direct')),
    ),
    h('div', { class: 'row' },
      field('Serveur SMTP', smtpHost),
      h('div', { class: 'field narrow' }, h('label', {}, 'Port', smtpPort)),
      h('div', { class: 'field narrow' }, h('label', { class: 'check' }, smtpSecure, 'TLS direct')),
    ),
    h('p', { class: 'muted small field' }, 'TLS direct : ports 993 (IMAP) et 465 (SMTP). Décoché, la connexion passe par STARTTLS (143 / 587). Le mot de passe est chiffré en base ; préférez un mot de passe d’application.'),
    connect,
  );
  form.addEventListener('submit', busy(connect, 'Test de connexion…', async () => {
    await api('POST', '/accounts/imap', {
      email: email.value, displayName: displayName.value, username: username.value, password: password.value,
      imapHost: imapHost.value, imapPort: Number(imapPort.value), imapSecure: imapSecure.checked,
      smtpHost: smtpHost.value, smtpPort: Number(smtpPort.value), smtpSecure: smtpSecure.checked,
    });
    toast('Boîte connectée. Première relève en cours…');
    renderAccounts();
  }));

  shell(
    h('div', { class: 'page' },
      h('h1', {}, 'Comptes mail'),
      oauthError && h('p', { class: 'notice danger field' }, `Connexion échouée : ${oauthError}`),
      accounts.length === 0 && h('p', { class: 'notice field' }, 'Connectez une première boîte mail pour commencer.'),
      accounts.map((a) => {
        const syncBtn = h('button', { class: 'btn', type: 'button' }, 'Relever maintenant');
        syncBtn.addEventListener('click', busy(syncBtn, 'Relève…', async () => {
          const r = await api('POST', `/accounts/${a.id}/sync`);
          if (r.error) toast(r.error, true);
          else toast(`${r.fetched} email(s) relevé(s), ${r.triaged} trié(s) par l’IA.`);
          renderAccounts();
        }));
        const del = h('button', { class: 'btn danger', type: 'button' }, 'Déconnecter');
        del.addEventListener('click', busy(del, '…', async () => {
          if (!confirm(`Déconnecter ${a.email} ? Les emails et réponses enregistrés ici seront supprimés (votre boîte n’est pas touchée).`)) return;
          await api('DELETE', `/accounts/${a.id}`);
          renderAccounts();
        }));
        return h('div', { class: 'card' },
          h('div', { class: 'card-head' }, h('h2', {}, a.email), h('span', { class: 'badge plain' }, KIND[a.kind]), a.todo > 0 && h('span', { class: 'badge' }, `${a.todo} à traiter`)),
          h('p', { class: 'muted small field' }, a.lastSyncAt ? `Dernière relève : ${fmtFull(a.lastSyncAt)}` : 'Jamais relevée'),
          a.lastError && h('p', { class: 'notice danger field' }, a.lastError),
          h('div', { class: 'actions' }, syncBtn, del),
        );
      }),
      h('div', { class: 'card' },
        h('h2', {}, 'Connecter avec OAuth'),
        h('p', { class: 'muted field' }, 'Aucun mot de passe n’est saisi ici : vous autorisez l’accès chez Google ou Microsoft (lecture de la boîte de réception et envoi).'),
        h('div', { class: 'actions' }, oauthButton('google', 'Connecter Gmail / Google Workspace'), oauthButton('microsoft', 'Connecter Outlook / Microsoft 365')),
      ),
      h('div', { class: 'card' }, h('h2', {}, 'Connecter en IMAP / SMTP'), form),
    ),
  );
});

// ---- settings ---------------------------------------------------------------------------
const renderSettings = guard(async () => {
  state.me = await api('GET', '/me');
  const me = state.me;
  const model = h('input', { type: 'text', value: me.model, placeholder: me.defaultModel });
  const signature = h('textarea', { rows: 4, placeholder: 'Cordialement,\nPrénom Nom' });
  signature.value = me.signature;
  const key = h('input', { type: 'password', autocomplete: 'off', placeholder: me.hasOwnKey ? '•••••••• (enregistrée)' : me.hasKey ? 'Clé du serveur utilisée' : 'sk-or-…' });
  const save = h('button', { class: 'btn primary', type: 'submit' }, 'Enregistrer');
  const form = h('form', { class: 'card' },
    h('h2', {}, 'Rédaction'),
    field('Modèle OpenRouter', model, `Identifiant « fournisseur/modèle ». Laisser vide pour le modèle du serveur (${me.defaultModel}). Le modèle doit avoir au moins un fournisseur ZDR, sinon la requête est refusée.`),
    field('Signature', signature, 'Ajoutée telle quelle à la fin de chaque proposition.'),
    field('Clé API OpenRouter personnelle', key, me.hasOwnKey ? 'Laissez vide pour conserver la clé actuelle.' : 'Chiffrée en base. Laissez vide pour utiliser la clé du serveur.'),
    h('div', { class: 'actions' }, save, me.hasOwnKey && h('button', { class: 'btn danger', type: 'button', onclick: guard(async () => {
      await api('PUT', '/settings', { openrouterKey: '' });
      toast('Clé personnelle supprimée.');
      renderSettings();
    }) }, 'Supprimer ma clé')),
  );
  form.addEventListener('submit', busy(save, '…', async () => {
    const body = { model: model.value === me.defaultModel ? '' : model.value, signature: signature.value };
    if (key.value) body.openrouterKey = key.value;
    await api('PUT', '/settings', body);
    toast('Réglages enregistrés.');
    renderSettings();
  }));

  shell(
    h('div', { class: 'page' },
      h('h1', {}, 'Réglages'),
      !me.hasKey && h('p', { class: 'notice warn field' }, 'Aucune clé OpenRouter : le tri automatique et les propositions sont désactivés.'),
      form,
      h('div', { class: 'card' },
        h('h2', {}, 'Confidentialité'),
        h('ul', {},
          h('li', {}, 'Chaque requête envoyée à OpenRouter porte ', h('code', {}, `provider: ${JSON.stringify(me.privacy)}`), '. Ce n’est pas désactivable : si aucun fournisseur du modèle ne garantit la non-conservation et le non-entraînement, la requête échoue au lieu d’être routée ailleurs.'),
          h('li', {}, 'Dans votre compte OpenRouter, laissez désactivée la journalisation des prompts (Settings → Privacy) : ce réglage dépend de votre compte, pas de cette application.'),
          h('li', {}, 'Newsletters et notifications sont écartées par des règles locales et ne sont jamais envoyées à l’IA.'),
          h('li', {}, me.retentionDays ? `Le contenu des emails est effacé de cette application après ${me.retentionDays} jours.` : 'Le contenu des emails est conservé sans limite dans cette application.'),
          h('li', {}, 'Mots de passe, tokens OAuth et clés API sont chiffrés en base (AES-256-GCM).'),
          h('li', {}, 'Aucun email n’est envoyé sans votre validation explicite.'),
          h('li', {}, 'Les raisons que vous donnez en modifiant une proposition sont visibles des administrateurs, qui s’en servent pour améliorer les prompts. Vos emails ne le sont pas.'),
        ),
      ),
    ),
  );
});

boot();
