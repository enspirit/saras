// Dates as the interface shows them, in the reader's locale.
import { locale } from '../i18n.ts';

const asDate = (iso: string): Date => new Date(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`);

export const fmtDate = (iso: string): string => {
  const d = asDate(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
};

/** Day and time, short: for the head of an email or of a reply. */
export const fmtWhen = (iso: string): string => {
  const d = asDate(iso);
  return d.toDateString() === new Date().toDateString() ? fmtDate(iso) : d.toLocaleString(locale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export const fmtFull = (iso: string): string => asDate(iso).toLocaleString(locale(), { dateStyle: 'full', timeStyle: 'short' });
export const fmtDay = (iso: string): string => asDate(iso).toLocaleDateString(locale(), { dateStyle: 'medium' });
