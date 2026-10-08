ALTER TABLE oauth_states ADD COLUMN transaction_hash TEXT;

CREATE INDEX IF NOT EXISTS oauth_states_expiry ON oauth_states(expires_at);

ALTER TABLE participants ADD COLUMN public_profile_id TEXT;
UPDATE participants SET public_profile_id=lower(hex(randomblob(16))) WHERE public_profile_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS participants_public_profile_id ON participants(public_profile_id);
