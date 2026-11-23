// Who really hosts an address is asked of its domain: an address at one's own domain is often
// at Google or Microsoft, where signing in is the way that works.

import type { Profile } from '../../shared/member.ts';
import { readMailHost } from '../api/mailboxes.ts';
import { t } from '../i18n.ts';
import type { MailHost, MailServers } from '../../shared/mailbox.ts';
import { domainOf } from '../mail-presets.ts';
import { Callout } from '../ui/molecules/callout.ts';
import type { ChoicesHandle } from '../ui/molecules/choices.ts';

export interface MailHostAdviceHandle {
  /** Where the advice shows, hidden until there is some. */
  element: HTMLElement;
  /** Asks who hosts this address, proposes its servers, and says how best to connect it. */
  find(address: string): Promise<void>;
}

interface Connecting {
  oauth: Profile['oauth'];
  /** The choice of where the mailbox is hosted. */
  host: ChoicesHandle;
  /** Fills the servers in when some are sure, and says so; says that none were found otherwise. */
  propose(servers: MailServers | null): void;
  /** Says that the servers are being looked for. */
  searching(on: boolean): void;
  /** Called when the advice chose a host in place of the user. */
  onHostChosen(): void;
}

/** What to say once the host is known: sign in there when that is set up, else that a password will be needed. */
function adviceFor(found: MailHost, address: string, { oauth, host, onHostChosen }: Connecting): HTMLElement | null {
  if (found.provider === 'other') return null;
  const provider = found.provider === 'google' ? t('mailboxes.connectGoogle') : t('mailboxes.connectMicrosoft');
  if (oauth[found.provider] && host.select(found.provider)) {
    onHostChosen();
    return Callout('info', t('mailboxes.hostedSignIn', { address, provider }));
  }
  return Callout('warn', t('mailboxes.hostedPassword', { address, provider }));
}

/** Asks who hosts an address, saying meanwhile that its servers are looked for. No answer is an unknown host. */
async function hostOf(address: string, { searching }: Connecting): Promise<MailHost> {
  searching(true);
  const found = await readMailHost(address).catch((): MailHost => ({ provider: 'other', servers: null }));
  searching(false);
  return found;
}

/** The advice about where an address is hosted, empty until `find` has something to say. */
export function MailHostAdvice(connecting: Connecting): MailHostAdviceHandle {
  const advice: MailHostAdviceHandle = { element: Callout('info', ''), find };
  advice.element.hidden = true;
  const advise = (next: HTMLElement | null): void => {
    const shown = next ?? Callout('info', '');
    shown.hidden = next === null;
    advice.element.replaceWith(shown);
    advice.element = shown;
  };
  let asked = '';
  async function find(address: string): Promise<void> {
    if (!domainOf(address) || address === asked) return;
    asked = address;
    const found = await hostOf(address, connecting);
    if (address !== asked) return;
    connecting.propose(found.servers);
    advise(adviceFor(found, address, connecting));
  }
  return advice;
}
