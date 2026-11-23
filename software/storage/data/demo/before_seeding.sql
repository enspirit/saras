-- The demo is a slice: one organisation, added to a database that may hold
-- others (`db:apply`). What it replaces is itself: the organisation goes, and
-- everything of it with it — its member, mailbox, emails, prompts, attributes
-- and boards all hang from it and are deleted in cascade.
DELETE FROM organizations WHERE id = 900001;
