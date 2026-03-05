-- KRNL Drive Database Schema
-- Apply with: wrangler d1 execute krnl-drive-db --file=worker/schema.sql

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'user', -- 'admin' | 'user' | 'guest'
  disabled INTEGER NOT NULL DEFAULT 0,
  totp_secret TEXT,
  totp_enabled INTEGER NOT NULL DEFAULT 0,
  default_share_title TEXT,
  default_share_description TEXT,
  avatar_url TEXT,
  root_folder_id TEXT REFERENCES files(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Migrations: run once on existing databases
-- wrangler d1 execute krnl-drive-db --command="ALTER TABLE users ADD COLUMN avatar_url TEXT" --remote
-- wrangler d1 execute krnl-drive-db --command="ALTER TABLE users ADD COLUMN root_folder_id TEXT REFERENCES files(id) ON DELETE SET NULL" --remote

CREATE TABLE IF NOT EXISTS recovery_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS passkeys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id TEXT UNIQUE NOT NULL,
  public_key TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL DEFAULT 'Passkey',
  transports TEXT,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER
);

CREATE TABLE IF NOT EXISTS webauthn_challenges (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  challenge TEXT NOT NULL,
  type TEXT NOT NULL, -- 'register' | 'authenticate'
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pending_2fa INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES files(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'file' | 'folder'
  size INTEGER NOT NULL DEFAULT 0,
  mime_type TEXT,
  r2_key TEXT,
  owner_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_files_parent ON files(parent_id);
CREATE INDEX IF NOT EXISTS idx_files_owner ON files(owner_id);

CREATE TABLE IF NOT EXISTS upload_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  filename TEXT NOT NULL,
  parent_id TEXT REFERENCES files(id),
  total_size INTEGER NOT NULL,
  chunk_size INTEGER NOT NULL DEFAULT 5242880,
  total_chunks INTEGER NOT NULL,
  uploaded_chunks TEXT NOT NULL DEFAULT '[]',
  r2_key TEXT NOT NULL,
  r2_upload_id TEXT,
  parts TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'completed' | 'failed'
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS shares (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  custom_title TEXT,
  custom_description TEXT,
  expires_at INTEGER,
  max_views INTEGER,
  max_downloads INTEGER,
  view_count INTEGER NOT NULL DEFAULT 0,
  download_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shares_token ON shares(token);
CREATE INDEX IF NOT EXISTS idx_shares_file ON shares(file_id);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Default settings
INSERT OR IGNORE INTO settings VALUES ('default_share_expiry_hours', '168');
INSERT OR IGNORE INTO settings VALUES ('default_max_views', '0');
INSERT OR IGNORE INTO settings VALUES ('default_max_downloads', '0');
INSERT OR IGNORE INTO settings VALUES ('default_share_title', '');
INSERT OR IGNORE INTO settings VALUES ('default_share_description', '');
INSERT OR IGNORE INTO settings VALUES ('site_name', 'KRNL Drive');
INSERT OR IGNORE INTO settings VALUES ('allow_registration', '0');
INSERT OR IGNORE INTO settings VALUES ('guest_can_download', '1');
INSERT OR IGNORE INTO settings VALUES ('chunk_size', '5242880');
