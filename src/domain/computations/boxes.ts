// Pure: the boxes a member sees their emails in, and where each email stands in them.
import { BOXES } from '../../../shared/email.ts';
import type { Box, EmailStatus } from '../../../shared/email.ts';

const NAMES = Object.keys(BOXES) as Box[];
const isBox = (box: unknown): box is Box => NAMES.includes(box as Box);

/** The statuses of the box asked for; of the emails to handle when it is not one. */
export const statusesOf = (box: unknown): readonly EmailStatus[] => BOXES[isBox(box) ? box : 'todo'];

const holds = (box: Box, status: EmailStatus): boolean => (BOXES[box] as readonly EmailStatus[]).includes(status);

/** How many emails each box holds, from how many have each status. */
export function countsPerBox(perStatus: { status: EmailStatus; n: number }[]): Record<Box, number> {
  const counts = { todo: 0, none: 0, sent: 0, ignored: 0 };
  for (const { status, n } of perStatus) {
    for (const box of NAMES) if (holds(box, status)) counts[box] += n;
  }
  return counts;
}
