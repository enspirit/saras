-- The sample emails carry the dates they had when the seed was flushed. They
-- are all moved by the same amount, so that the latest was received an hour
-- ago: the demo reads the same next month, and nothing in it is older than
-- the retention period.
WITH shift AS (
  SELECT now() - interval '1 hour' - max(date) AS by FROM emails WHERE account_id = 900001
)
UPDATE emails SET date = date + shift.by, created_at = now() FROM shift WHERE account_id = 900001;

UPDATE accounts SET last_sync_at = now(), created_at = now() WHERE id = 900001;
UPDATE organizations SET created_at = now() WHERE id = 900001;
UPDATE users SET created_at = now() WHERE org_id = 900001;
