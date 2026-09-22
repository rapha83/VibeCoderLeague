CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY, github_id TEXT NOT NULL, github_login TEXT NOT NULL,
  avatar_url TEXT, csrf_token TEXT NOT NULL, access_token_ciphertext TEXT,
  expires_at TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS oauth_states (
  state_hash TEXT PRIMARY KEY, expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS participants (
  github_id TEXT PRIMARY KEY, github_login TEXT NOT NULL, avatar_url TEXT,
  display_name TEXT NOT NULL, consent_active INTEGER NOT NULL DEFAULT 0,
  withdrawn_at TEXT, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS consents (
  github_id TEXT NOT NULL, repo_id TEXT NOT NULL, repo_name TEXT NOT NULL,
  installation_id TEXT NOT NULL, visibility TEXT NOT NULL DEFAULT 'unknown',
  declared_tooling TEXT, declared_model TEXT, active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL, PRIMARY KEY (github_id, repo_id)
);
CREATE TABLE IF NOT EXISTS pull_requests (
  pr_id TEXT PRIMARY KEY, repo_id TEXT NOT NULL, repo_name TEXT NOT NULL,
  author_id TEXT NOT NULL, author_login TEXT NOT NULL, author_avatar_url TEXT,
  merged_at TEXT NOT NULL, month_utc TEXT NOT NULL, generation INTEGER NOT NULL,
  declared_tooling TEXT, declared_model TEXT
);
CREATE INDEX IF NOT EXISTS pr_month_author ON pull_requests(month_utc, author_id);
CREATE TABLE IF NOT EXISTS sync_jobs (
  github_id TEXT NOT NULL, repo_id TEXT NOT NULL, cursor TEXT, generation INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'idle', lease_until TEXT, last_success_at TEXT, last_error_code TEXT,
  pages_processed INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (github_id, repo_id)
);
