// ConnectMailboxByHostSignIn — a member connects a mailbox by signing in at its host (Google,
// Microsoft), which then tells us whose mailbox it is. It takes two steps, the member being
// away at the host in between.
//
// The same two steps renew the access to a mailbox already connected (RenewMailboxCredentials),
// when the sign-in was begun for that.
//
// BeginHostSignIn
//   DomPre   the member's session remembers no sign-in under way, or an older one
//   DomPost  it remembers this one: the host, a secret of ours, shared or not, the mailbox to renew if any
//   ReqPre   this server is set up for that host
//            to renew: the member manages the mailbox
//
// ConnectMailboxByHostSignIn
//   DomPre, DomPost  those of ConnectMailbox; the session remembers no sign-in any more
//   ReqPre   this server is set up for that host
//            the host did not report a refusal
//            the answer is to the sign-in the session remembers
//            the host gives us lasting access, and all of what was asked: reading, drafts and sending
//            to renew: the member signed in to that very mailbox
import { randomToken } from '../../tooling/crypto.ts';
import { PartialGrant, authorizationUrl, exchangeCode, fetchIdentity, isConfigured, isOAuthKind } from '../../tooling/mail/oauth.ts';
import { answersSignIn, connectsAsShared, isSameMailbox, rememberedSignIn, signInRemembered } from '../computations/mailboxes.ts';
import type { HostSignIn } from '../computations/mailboxes.ts';
import { clipped } from '../computations/given.ts';
import { Refusal, accepted } from '../refusal.ts';
import { forgetHostSignIn, rememberHostSignIn } from '../state/sessions.ts';
import type { AccountRow, OAuthKind, OAuthTokens } from '../model/mailbox.ts';
import type { Actor, World } from '../world.ts';
import { connectMailbox } from './connect-mailbox.ts';
import { mailboxToRenew, renewWith } from './renew-mailbox-credentials.ts';

type Fetch = typeof fetch;

/** The address at the host where the member signs in. */
export async function beginHostSignIn(world: World, actor: Actor, sessionId: string, kind: string, sharedAsked: boolean, renewsAsked: unknown = null): Promise<string> {
  const { db, config } = world;
  if (!isOAuthKind(kind) || !isConfigured(config, kind)) throw new Refusal('notFound', 'oauth.notConfigured');
  const renews = renewsAsked ? (await mailboxToRenew(world, actor, renewsAsked)).id : null;
  const state = randomToken(24);
  // Whether a shared mailbox was asked for is kept with the state, on our side of the round trip.
  await rememberHostSignIn(db, sessionId, rememberedSignIn({ kind, state, shared: connectsAsShared(actor, sharedAsked), renews }));
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

/** What the host grants and whose mailbox it says it is. ReqPre: lasting access. */
async function grantedBy({ config }: World, kind: OAuthKind, code: unknown, fetchImpl: Fetch): Promise<{ tokens: OAuthTokens; identity: { email: string; name: string } }> {
  try {
    const tokens = await exchangeCode(config, kind, String(code || ''), fetchImpl);
    if (!tokens.refreshToken) throw new Error('no refresh token received');
    return { tokens, identity: await fetchIdentity(kind, tokens.accessToken, fetchImpl) };
  } catch (e) {
    if (e instanceof PartialGrant) throw new Refusal('forbidden', 'oauth.partialGrant');
    throw new Refusal('upstream', 'oauth.failed', { detail: e instanceof Error ? e.message : String(e) });
  }
}

/** ReqPre of the answer itself: for a host this server is set up for, not a refusal, and to the sign-in the session remembers. */
function signInAnswered({ config }: World, answer: HostAnswer): { kind: OAuthKind; remembered: HostSignIn } {
  const { kind } = answer;
  if (!isOAuthKind(kind) || !isConfigured(config, kind)) throw new Refusal('notFound', 'oauth.notConfigured');
  if (answer.error) throw new Refusal('forbidden', 'oauth.denied', { detail: clipped(answer.error, 100) });
  const remembered = signInRemembered(answer.remembered);
  accepted(answersSignIn(remembered, kind, answer.state));
  return { kind, remembered };
}

async function renewByHostSignIn(world: World, actor: Actor, mailboxId: number, kind: OAuthKind, address: string, tokens: OAuthTokens): Promise<AccountRow> {
  const mailbox = await mailboxToRenew(world, actor, mailboxId);
  accepted(isSameMailbox(mailbox, kind, address));
  return renewWith(world, mailbox, tokens);
}

export async function connectMailboxByHostSignIn(world: World, actor: Actor, sessionId: string, answer: HostAnswer, fetchImpl: Fetch): Promise<AccountRow> {
  await forgetHostSignIn(world.db, sessionId);
  const { kind, remembered } = signInAnswered(world, answer);
  const { tokens, identity } = await grantedBy(world, kind, answer.code, fetchImpl);
  if (remembered.renews) return renewByHostSignIn(world, actor, remembered.renews, kind, identity.email, tokens);
  return connectMailbox(world, actor, { kind, address: identity.email, displayName: identity.name, shared: connectsAsShared(actor, remembered.shared) }, tokens);
}
