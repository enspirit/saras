# 0016 — The order of boards is each member's, kept with the member

## Context

The boards of the menu came in one order for everybody: the shared ones first, then one's own, each as it was made. A member wants the boards they work from most at the top, and drags them there ([US-97](../1-user-stories.md#us-97--put-my-boards-in-order)).

A menu holds boards of two kinds: the member's own, which nobody else sees, and the shared ones, which every member sees and administrators manage. An order has to say where each stands among the others.

## Decision

The order is the member's: **ArrangeBoards** changes their menu and nobody else's, shared boards included. Anyone arranges what they see, administrator or not.

It is kept with the member, as the list of the boards' numbers, first to last (`users.board_order_json`). A board the list does not name comes after those it names, in the order boards always had: one made or shared later comes last, and a member who never arranged anything sees no change. A number left in the list by a board since deleted, or no longer shared, names nothing and is dropped at the next arrangement.

## Alternatives

- **One order for the organisation, as a position on each board.** A shared board would stand at the same place for everyone, which only administrators could change, while personal boards would need positions of their own between them: two orders in one menu, and a member unable to put their own board above a shared one.
- **A table of places, one row per member and board.** The same facts, with foreign keys that forget a place when its board goes. But the order is only ever read and written whole, by one member, and a table more is a table more in every seed ([`software/storage`](../../software/storage/README.md)); the list tolerates a number that names nothing at no cost.
- **Keep the order in the browser.** Nothing to migrate, and lost on the next device.

## Consequences

- The order is read with the boards, in one statement; boards are still counted one by one.
- Deleting a member deletes their order with them. Deleting a board leaves its number in the lists that named it, until their members arrange again.
- The version of the server before this one ignores the column.

## What would reverse it

A team asking that shared boards come in the same order for all of them: the order of the shared ones would then be the organisation's, set by administrators, and a member's own order would apply to what remains.
