-- Prism OAuth integration
ALTER TABLE users ADD COLUMN prism_sub TEXT;
ALTER TABLE users ADD COLUMN auth_source TEXT NOT NULL DEFAULT 'local';

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_prism_sub
  ON users(prism_sub) WHERE prism_sub IS NOT NULL;

CREATE TABLE IF NOT EXISTS prism_oauth_states (
  state TEXT PRIMARY KEY,
  code_verifier TEXT NOT NULL,
  redirect_to TEXT,
  link_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

INSERT OR IGNORE INTO settings VALUES ('prism_enabled', '0');
INSERT OR IGNORE INTO settings VALUES ('prism_base_url', '');
INSERT OR IGNORE INTO settings VALUES ('prism_client_id', '');
INSERT OR IGNORE INTO settings VALUES ('prism_client_secret', '');
INSERT OR IGNORE INTO settings VALUES ('prism_auto_provision', '0');
