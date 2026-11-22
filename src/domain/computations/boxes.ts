// Pure: the boxes a member sees their emails in, and where each email stands in them.
import type { EmailStatus } from '../model/email.ts';

/** The boxes, and the statuses each one shows. An email waiting to be sorted is to handle. */
export const BOXES: Record<string, EmailStatus[]> = { todo: ['needs_reply', 'pending'], none: ['no_reply'], sent: ['sent'], ignored: ['ignored'] };

/** The statuses of the box asked for; of the emails to handle when it is not one. */
export const statusesOf = (box: unknown): EmailStatus[] => BOXES[String(box)] ?? BOXES.todo!;

/** How many emails each box holds, from how many have each status. */
export function countsPerBox(perStatus: { status: EmailStatus; n: number }[]): Record<string, number> {
  const counts = Object.fromEntries(Object.keys(BOXES).map((box) => [box, 0]));
  for (const { status, n } of perStatus) {
    for (const [box, statuses] of Object.entries(BOXES)) if (statuses.includes(status)) counts[box] = (counts[box] ?? 0) + n;
  }
  return counts;
}
