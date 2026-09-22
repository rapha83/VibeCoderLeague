CREATE TABLE IF NOT EXISTS rate_limits (
  scope TEXT NOT NULL,
  actor_key TEXT NOT NULL,
  request_count INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  PRIMARY KEY (scope, actor_key)
);
CREATE INDEX IF NOT EXISTS rate_limits_expiry ON rate_limits(expires_at);
