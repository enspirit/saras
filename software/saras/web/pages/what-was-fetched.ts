// What a fetch brought in, said to who asked for it.

import type { FetchResult } from '../../shared/mailbox.ts';
import { t } from '../i18n.ts';
import { toast } from './actions.ts';

/** How many emails came in. A fetch takes a limited number, the most recent first: when it left older ones for later, how many is said too. */
export const sayFetched = ({ fetched, toCome }: Pick<FetchResult, 'fetched' | 'toCome'>): void =>
  toast(toCome ? t('mailbox.fetchedSome', { count: fetched, toCome }) : t('mailbox.fetched', { count: fetched }));
