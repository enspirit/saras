-- What the rows of this seed cannot carry, since a seed is flushed and not
-- written: what the suite must know and the server told once, and what depends
-- on the day the seed is installed. tests/operations/specification/world.yml tells the
-- same tokens, as what the runner knows of the world.

-- The invitation of nora, and milo's link to a new password: a token the suite
-- knows, kept as its hash like any other, and good from now.
UPDATE invitations
   SET token_hash = encode(sha256('the-invitation-of-nora'::bytea), 'hex'),
       expires_at = now() + interval '7 days'
 WHERE email = 'nora@atelier.example';
UPDATE password_resets
   SET token_hash = encode(sha256('the-link-of-milo'::bytea), 'hex'),
       expires_at = now() + interval '1 hour';

-- The emails are as recent as on the day they were fetched: the most recent
-- arrives now, and the others keep their distance to it.
UPDATE emails
   SET date = date + (now() - (SELECT max(date) FROM emails));

-- Everything made by a case is numbered from 5001 on, in every table: a case
-- starts from the same numbers whatever ran before it.
SELECT setval(format('%I.%I', schemaname, sequencename)::regclass, 5000)
  FROM pg_sequences
 WHERE schemaname = 'public';
