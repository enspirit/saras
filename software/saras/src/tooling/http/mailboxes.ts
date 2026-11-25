// Routes: the mailboxes of an organisation. The operations are in domain/mailboxes.
import { clipped } from '../../domain/computations/given.ts';
import { chooseWatchedFolder } from '../../domain/mailboxes/choose-watched-folder.ts';
import { beginHostSignIn, connectMailboxByHostSignIn } from '../../domain/mailboxes/connect-mailbox-by-host-sign-in.ts';
import { connectMailboxByServers } from '../../domain/mailboxes/connect-mailbox-by-servers.ts';
import { changeMailboxServers, mailboxServers } from '../../domain/mailboxes/change-mailbox-servers.ts';
import { disconnectMailbox } from '../../domain/mailboxes/disconnect-mailbox.ts';
import { fetchMailboxNow } from '../../domain/mailboxes/fetch-mailbox-now.ts';
import { nameMailbox } from '../../domain/mailboxes/name-mailbox.ts';
import { listFolders } from '../../domain/mailboxes/list-folders.ts';
import { renewMailboxPassword } from '../../domain/mailboxes/renew-mailbox-credentials.ts';
import { shareMailbox } from '../../domain/mailboxes/share-mailbox.ts';
import { mailboxesOf } from '../../domain/observations/mailboxes.ts';
import { Refusal } from '../../domain/refusal.ts';
import { errorMessage } from '../errors.ts';
import { lookupMailHost } from '../mail/lookup.ts';
import type { MessageCode } from '../messages.ts';
import { actorOf, done } from './route.ts';
import type { Handle, Route } from './route.ts';

const list: Handle = async ({ world }, req, res) => void res.json(await mailboxesOf(world.db, actorOf(req), world.config));

const connectByServers: Handle = async ({ world }, req, res) => void res.status(201).json({ id: (await connectMailboxByServers(world, actorOf(req), req.body)).id });

/** Who hosts the mail of an address, from its domain's MX records: the connection page uses it to propose the right way in. */
const mailHost: Handle = async (_http, req, res) => void res.json(await lookupMailHost(clipped(req.query.email, 320)));

const folders: Handle = async ({ world }, req, res) => void res.json(await listFolders(world, actorOf(req), req.params.id));

const watchFolder: Handle = async ({ world }, req, res) => {
  const folder = await chooseWatchedFolder(world, actorOf(req), req.params.id, req.body);
  res.json({ ok: true, folder: folder.id, folderName: folder.name });
};

const renewByPassword: Handle = async ({ world }, req, res) => {
  await renewMailboxPassword(world, actorOf(req), req.params.id, req.body.password);
  done(res);
};

const servers: Handle = async ({ world }, req, res) => void res.json(await mailboxServers(world, actorOf(req), req.params.id));

const changeServers: Handle = async ({ world }, req, res) => {
  await changeMailboxServers(world, actorOf(req), req.params.id, req.body);
  done(res);
};

const name: Handle = async ({ world }, req, res) => {
  await nameMailbox(world, actorOf(req), req.params.id, req.body.displayName);
  done(res);
};

const share: Handle = async ({ world }, req, res) => {
  await shareMailbox(world, actorOf(req), req.params.id);
  done(res);
};

const disconnect: Handle = async ({ world }, req, res) => {
  await disconnectMailbox(world, actorOf(req), req.params.id);
  done(res);
};

const fetchNow: Handle = async ({ world }, req, res) => void res.json(await fetchMailboxNow(world, actorOf(req), req.params.id));

const signInAtHost: Handle = async ({ world }, req, res) =>
  res.redirect(await beginHostSignIn(world, actorOf(req), req.user.sid, String(req.params.kind), req.query.shared === '1', req.query.renew));

/** Where the member lands after the host: the outcome travels in the URL, as a message code and its technical detail when there is one. */
const backToMailboxes = (code?: MessageCode, detail = ''): string => `/#/mailboxes${code ? `?error=${encodeURIComponent(code)}&detail=${encodeURIComponent(detail)}` : ''}`;

const backFromHost: Handle = async ({ world, fetchImpl }, req, res) => {
  const { state, code, error } = req.query;
  try {
    await connectMailboxByHostSignIn(world, actorOf(req), req.user.sid, { kind: String(req.params.kind), remembered: req.user.oauth_state, state, code, error }, fetchImpl);
    res.redirect(backToMailboxes());
  } catch (e) {
    if (e instanceof Refusal) res.redirect(backToMailboxes(e.problem.code, String(e.problem.params.detail ?? '')));
    else res.redirect(backToMailboxes('oauth.failed', errorMessage(e)));
  }
};

export const MAILBOXES: Route[] = [
  { method: 'get', path: '/mailboxes', handle: list },
  { method: 'post', path: '/mailboxes/imap', handle: connectByServers },
  { method: 'get', path: '/mail/host', handle: mailHost },
  { method: 'get', path: '/mailboxes/:id/folders', handle: folders },
  { method: 'put', path: '/mailboxes/:id/folder', handle: watchFolder },
  { method: 'put', path: '/mailboxes/:id/password', handle: renewByPassword },
  { method: 'get', path: '/mailboxes/:id/servers', handle: servers },
  { method: 'put', path: '/mailboxes/:id/servers', handle: changeServers },
  { method: 'put', path: '/mailboxes/:id/name', handle: name },
  { method: 'put', path: '/mailboxes/:id/shared', handle: share },
  { method: 'delete', path: '/mailboxes/:id', handle: disconnect },
  { method: 'post', path: '/mailboxes/:id/fetch', handle: fetchNow },
  { method: 'get', path: '/oauth/:kind/start', handle: signInAtHost },
  { method: 'get', path: '/oauth/:kind/callback', handle: backFromHost },
];
