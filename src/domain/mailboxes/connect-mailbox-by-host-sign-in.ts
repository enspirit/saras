// ConnectMailboxByHostSignIn — a member connects a mailbox by signing in at its host (Google,
// Microsoft), which then tells us whose mailbox it is. It takes two steps, the member being
// away at the host in between.
//
// BeginHostSignIn
//   DomPre   the member's session remembers no sign-in under way, or an older one
//   DomPost  it remembers this one: the host, a secret of ours, shared or not
//   ReqPre   this server is set up for that host
//
// ConnectMailboxByHostSignIn
//   DomPre, DomPost  those of ConnectMailbox; the session remembers no sign-in any more
//   ReqPre   this server is set up for that host
//            the host did not report a refusal
//            the answer is to the sign-in the session remembers
//            the host gives us lasting access
//   ReqTrig  a mailbox that already watches a folder is fetched at once
import { randomToken } from '../../tooling/crypto.ts';
import { authorizationUrl, exchangeCode, fetchIdentity, isConfigured, isOAuthKind } from '../../tooling/mail/oauth.ts';
import { answersSignIn, connectsAsShared, rememberedSignIn, signInRemembered } from '../computations/mailboxes.ts';
import { clipped } from '../computations/given.ts';
import { Refusal, accepted } from '../refusal.ts';
import { forgetHostSignIn, rememberHostSignIn } from '../state/sessions.ts';
import type { AccountRow } from '../../types.ts';
import type { Actor, World } from '../world.ts';
import { connectMailbox } from './connect-mailbox.ts';

type Fetch = typeof fetch;

/** The address at the host where the member signs in. */
export async function beginHostSignIn({ db, config }: World, actor: Actor, sessionId: string, kind: string, sharedAsked: boolean): Promise<string> {
  if (!isOAuthKind(kind) || !isConfigured(config, kind)) throw new Refusal('notFound', 'oauth.notConfigured');
  const state = randomToken(24);
  // Whether a shared mailbox was asked for is kept with the state, on our side of the round trip.
  await rememberHostSignIn(db, sessionId, rememberedSignIn({ kind, state, shared: connectsAsShared(actor, sharedAsked) }));
  return authorizationUrl(config, kind, state);
}

export interface HostAnswer {
  kind: string;
  /** What the session remembered when the answer came. */
  remembered: string | null | undefined;
  state: unknown;
  code: unknown;
  error: unknown;
}

export async function connectMailboxByHostSignIn(world: World, actor: Actor, sessionId: string, answer: HostAnswer, fetchImpl: Fetch): Promise<AccountRow> {
  const { db, config } = world;
  const { kind } = answer;
  await forgetHostSignIn(db, sessionId);
  if (!isOAuthKind(kind) || !isConfigured(config, kind)) throw new Refusal('notFound', 'oauth.notConfigured');
  if (answer.error) throw new Refusal('forbidden', 'oauth.denied', { detail: clipped(answer.error, 100) });
  const remembered = signInRemembered(answer.remembered);
  accepted(answersSignIn(remembered, kind, answer.state));
  let tokens, identity;
  try {
    tokens = await exchangeCode(config, kind, String(answer.code || ''), fetchImpl);
    if (!tokens.refreshToken) throw new Error('no refresh token received');
    identity = await fetchIdentity(kind, tokens.accessToken, fetchImpl);
  } catch (e) {
    throw new Refusal('upstream', 'oauth.failed', { detail: e instanceof Error ? e.message : String(e) });
  }
  const mailbox = await connectMailbox(world, actor, { kind, address: identity.email, displayName: identity.name, shared: connectsAsShared(actor, remembered.shared) }, tokens);
  // Reconnecting a mailbox that already watches a folder resumes fetching at once.
  if (mailbox.folder) world.fetching.inBackground(mailbox);
  return mailbox;
}
